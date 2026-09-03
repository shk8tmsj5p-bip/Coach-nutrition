import nodemailer from "nodemailer";
import { householdSecret, requestOrigin } from "@/lib/auth/household";
import { makeUrgenceToken, urgenceKind } from "@/lib/auth/urgence";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AuthAlertKind =
  | "password_fail"
  | "password_lockout"
  | "password_fail_burst"
  | "password_unlock_new_device"
  | "face_id_register"
  | "face_id_removed"
  | "health_webhook_denied";

const DEDUP_MS: Record<AuthAlertKind, number> = {
  password_fail: 0,
  password_lockout: 10 * 60 * 1000,
  password_fail_burst: 15 * 60 * 1000,
  password_unlock_new_device: 30 * 60 * 1000,
  face_id_register: 2 * 60 * 1000,
  face_id_removed: 2 * 60 * 1000,
  health_webhook_denied: 15 * 60 * 1000,
};

const lastSent = new Map<string, number>();

export function alertsConfigured() {
  return Boolean(alertEmails().length && (smtpConfigured() || resendKey()));
}

export async function notifyAuthAlert(kind: AuthAlertKind, request: Request) {
  await deliver(kind, request, true);
}

export async function recordPasswordFailure(request: Request, lockedOut: boolean) {
  const fails = await persist("password_fail", request, false);
  if (lockedOut) await deliver("password_lockout", request, true);
  if (fails >= 9) await deliver("password_fail_burst", request, true);
}

export async function sendTestAlert(request: Request) {
  if (!alertsConfigured()) {
    return {
      ok: false,
      error: "Ajoute ALERT_SMTP_USER + ALERT_SMTP_PASS (Gmail) dans Vercel, ou un domaine Resend.",
    };
  }
  const result = await sendAlertEmail("password_unlock_new_device", request, { skipDedup: true, test: true });
  await persist("password_unlock_new_device", request, result.ok);
  return result.ok
    ? { ok: true as const, error: null, sent: result.sent }
    : { ok: false as const, error: result.error ?? "Envoi du mail refusé.", sent: result.sent };
}

async function deliver(kind: AuthAlertKind, request: Request, email: boolean) {
  const emailed = email ? (await sendAlertEmail(kind, request)).ok : false;
  await persist(kind, request, emailed);
}

async function persist(kind: AuthAlertKind, request: Request, emailed: boolean) {
  const admin = createAdminSupabaseClient();
  if (!admin) return 0;
  const ipHash = await hashIp(clientIp(request));
  const { error } = await admin.from("auth_events").insert({
    kind,
    ip_hash: ipHash,
    user_agent: uaSummary(request.headers.get("user-agent") ?? ""),
    emailed,
  });
  if (error) return 0;
  if (kind !== "password_fail") return 0;
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("auth_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", "password_fail")
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  return count ?? 0;
}

async function sendAlertEmail(
  kind: AuthAlertKind,
  request: Request,
  opts?: { skipDedup?: boolean; test?: boolean },
) {
  if (kind === "password_fail") return { ok: false, sent: 0, error: undefined };
  const to = alertEmails();
  if (!to.length) {
    console.error("[auth-alert] HOUSEHOLD_ALERT_EMAILS manquant");
    return { ok: false, sent: 0, error: "Adresses d’alerte manquantes." };
  }
  if (!smtpConfigured() && !resendKey()) {
    console.error("[auth-alert] ni Gmail SMTP ni Resend");
    return { ok: false, sent: 0, error: "Ajoute ALERT_SMTP_USER + ALERT_SMTP_PASS dans Vercel." };
  }
  const ip = clientIp(request);
  const windowMs = DEDUP_MS[kind];
  if (!opts?.skipDedup && windowMs > 0 && !claimSend(`${kind}:${await hashIp(ip)}`, windowMs)) {
    return { ok: false, sent: 0, error: "Déjà envoyé récemment." };
  }

  const copy = emailCopy(kind, request, ip);
  const subject = opts?.test ? "Coach Nutrition · mail test" : copy.subject;
  const text = opts?.test
    ? `Ceci est un test depuis Paramètres. Si tu lis ça, l’alerte arrive bien.\n\n${copy.text}`
    : copy.text;

  if (smtpConfigured()) return sendViaGmail(to, subject, await withUrgenceLink(kind, request, text, opts?.test));
  return sendViaResend(to, subject, await withUrgenceLink(kind, request, text, opts?.test));
}

async function withUrgenceLink(kind: AuthAlertKind, request: Request, text: string, test?: boolean) {
  if (test || !urgenceKind(kind)) return text;
  const token = await makeUrgenceToken(kind);
  const url = `${requestOrigin(request)}/urgence?k=${encodeURIComponent(token)}`;
  return `${text}\n\nAgir depuis l’iPhone (lien valable 48 h) :\n${url}\nTu tapes un nouveau code foyer. Ça bloque l’ancien et déconnecte tous les appareils. Ensuite rouvre l’app avec le nouveau code et réactive Face ID.`;
}

async function sendViaGmail(to: string[], subject: string, text: string) {
  const user = smtpUser();
  const pass = smtpPass();
  try {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    const info = await transport.sendMail({
      from: `Coach Nutrition <${user}>`,
      to: to.join(", "),
      subject,
      text,
    });
    const sent = Array.isArray(info.accepted) ? info.accepted.length : to.length;
    return { ok: true, sent: sent || to.length, error: undefined };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "SMTP";
    console.error("[auth-alert] Gmail", detail.slice(0, 220));
    return { ok: false, sent: 0, error: explainSmtp(detail) };
  }
}

async function sendViaResend(to: string[], subject: string, text: string) {
  const key = resendKey();
  let sent = 0;
  let lastError = "";
  for (const recipient of to) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom(),
        to: [recipient],
        subject,
        text,
      }),
    });
    if (response.ok) {
      sent += 1;
      continue;
    }
    lastError = await response.text().catch(() => "");
    console.error("[auth-alert] Resend", response.status, lastError.slice(0, 220));
  }
  return {
    ok: sent > 0,
    sent,
    error: sent > 0 ? undefined : explainResend(lastError),
  };
}

function explainSmtp(raw: string) {
  if (/invalid login|username and password|eauth/i.test(raw)) {
    return "Gmail a refusé le mot de passe. Utilise un « mot de passe d’application » (16 caractères), pas ton mot de passe Gmail.";
  }
  return "Gmail n’a pas pu envoyer. Vérifie ALERT_SMTP_USER / ALERT_SMTP_PASS.";
}

function explainResend(raw: string) {
  if (/only send testing emails|verify a domain|resend\.dev/i.test(raw)) {
    return "Resend n’envoie vers Gmail que si tu as un domaine à toi (Resend → Domains). Le relais Apple du compte ne suffit pas.";
  }
  if (!raw.trim()) return "Resend a refusé l’envoi.";
  return "Resend a refusé l’envoi. Ouvre Resend → Logs.";
}

function claimSend(slot: string, windowMs: number) {
  const prev = lastSent.get(slot) ?? 0;
  if (Date.now() - prev < windowMs) return false;
  lastSent.set(slot, Date.now());
  return true;
}

function emailCopy(kind: AuthAlertKind, request: Request, ip: string) {
  const when = parisStamp();
  const device = uaSummary(request.headers.get("user-agent") ?? "");
  const meta = `Quand : ${when}\nAppareil : ${device}\nAdresse : ${ip}\n`;
  const footer =
    "\nSi c’est toi ou Élodie, tu peux ignorer.\nSinon ouvre le lien d’action dans ce mail (ou Paramètres → Accès foyer sur un iPhone déjà à vous).\nLe code tapé n’est jamais envoyé dans ce mail.";

  switch (kind) {
    case "password_lockout":
      return {
        subject: "Coach Nutrition · 3 essais code foyer, pause 15 min",
        text: `Quelqu’un a tapé 3 fois un mauvais code foyer. Ce navigateur est bloqué 15 min.\n\n${meta}${footer}`,
      };
    case "password_fail_burst":
      return {
        subject: "Coach Nutrition · plusieurs codes faux depuis la même adresse",
        text: `Plus de 3 essais ratés depuis la même adresse, au-delà d’un seul navigateur. Quelqu’un peut tester le code en boucle.\n\n${meta}${footer}`,
      };
    case "password_unlock_new_device":
      return {
        subject: "Coach Nutrition · ouverture avec le code (sans Face ID)",
        text: `Le code foyer a ouvert l’app sur un appareil sans Face ID. C’est le signal d’un nouvel iPhone / Safari, ou d’une réinstall.\n\n${meta}${footer}`,
      };
    case "face_id_register":
      return {
        subject: "Coach Nutrition · Face ID activé sur un appareil",
        text: `Face ID vient d’être enregistré. Normal la première fois sur chaque iPhone. Inhabituel si vous n’êtes pas en train de le faire.\n\n${meta}${footer}`,
      };
    case "face_id_removed":
      return {
        subject: "Coach Nutrition · Face ID retiré",
        text: `Face ID a été désactivé sur un appareil (Paramètres → Accès foyer).\n\n${meta}${footer}`,
      };
    case "health_webhook_denied":
      return {
        subject: "Coach Nutrition · webhook Santé : secret refusé",
        text: `Une requête vers le webhook Apple Santé a été refusée (mauvais secret). Peut être un raccourci mal copié, ou quelqu’un qui sonde l’URL.\n\n${meta}${footer}`,
      };
    default:
      return {
        subject: "Coach Nutrition · alerte accès",
        text: `${meta}${footer}`,
      };
  }
}

function smtpUser() {
  return process.env.ALERT_SMTP_USER?.trim() ?? "";
}

function smtpPass() {
  return (process.env.ALERT_SMTP_PASS ?? "").replace(/\s+/g, "");
}

function smtpConfigured() {
  return Boolean(smtpUser() && smtpPass());
}

function resendKey() {
  return process.env.RESEND_API_KEY?.trim() ?? "";
}

function resendFrom() {
  return process.env.RESEND_FROM?.trim() || "Coach Nutrition <beth.t@example.com>";
}

function alertEmails() {
  return (process.env.HOUSEHOLD_ALERT_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((value) => value.trim())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "inconnue";
}

function uaSummary(ua: string) {
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Android/i.test(ua)) return "Android";
  if (ua.trim()) return "Autre navigateur";
  return "Inconnu";
}

function parisStamp(date = new Date()) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function hashIp(ip: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${householdSecret()}:${ip}`),
  );
  return Array.from(new Uint8Array(bytes))
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
