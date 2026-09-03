"use client";

import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startRegistration,
} from "@simplewebauthn/browser";
import { Card, SectionTitle } from "@/components/ui/Card";
import { FACEID_STORAGE_KEY } from "@/lib/auth/constants";

export function HouseholdLockCard({ alertsOn }: { alertsOn?: boolean }) {
  const [faceOn, setFaceOn] = useState(false);
  const [canFace, setCanFace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    setFaceOn(localStorage.getItem(FACEID_STORAGE_KEY) === "1");
    void platformAuthenticatorIsAvailable().then((ok) => {
      setCanFace(browserSupportsWebAuthn() && ok);
    });
  }, []);

  async function sendTestMail() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/alert-test", { method: "POST", credentials: "include" });
      const payload = (await response.json()) as { error?: string; sent?: number };
      if (!response.ok) {
        flash(payload.error ?? "Mail test refusé", 10000);
        return;
      }
      flash(
        payload.sent && payload.sent > 1
          ? `Mail test envoyé (${payload.sent} destinataires). Regarde aussi les spams.`
          : "Mail test envoyé. Regarde aussi les spams.",
        8000,
      );
    } catch {
      flash("Impossible d’envoyer le mail test");
    } finally {
      setBusy(false);
    }
  }

  function flash(message: string, ms = 2400) {
    setToast(message);
    window.setTimeout(() => setToast(null), ms);
  }

  async function enableFace() {
    setBusy(true);
    try {
      const options = await fetch("/api/auth/webauthn/register", { credentials: "include" });
      const payload = await options.json();
      if (!options.ok) {
        flash(payload.error ?? "Face ID indisponible");
        return;
      }
      const attestation = await startRegistration({ optionsJSON: payload });
      const saved = await fetch("/api/auth/webauthn/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attestation),
      });
      const result = await saved.json();
      if (!saved.ok) {
        flash(result.error ?? "Impossible d’activer Face ID");
        return;
      }
      localStorage.setItem(FACEID_STORAGE_KEY, "1");
      setFaceOn(true);
      flash("Face ID activé sur cet iPhone");
    } catch {
      flash("Face ID annulé");
    } finally {
      setBusy(false);
    }
  }

  async function disableFace() {
    setBusy(true);
    try {
      await fetch("/api/auth/passkey/forget", { method: "POST", credentials: "include" });
      localStorage.removeItem(FACEID_STORAGE_KEY);
      setFaceOn(false);
      flash("Face ID retiré de cet iPhone");
    } finally {
      setBusy(false);
    }
  }

  async function changeCode() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/foyer-lock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        flash(payload.error ?? "Impossible de changer le code", 8000);
        return;
      }
      setPassword("");
      setConfirm("");
      flash("Code changé. Les autres appareils sont déconnectés. Dis le nouveau code à Élodie.", 8000);
    } catch {
      flash("Impossible de changer le code");
    } finally {
      setBusy(false);
    }
  }

  async function kickOthers() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/foyer-lock", { method: "PUT", credentials: "include" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        flash(payload.error ?? "Impossible d’éjecter", 8000);
        return;
      }
      flash("Les autres appareils sont déconnectés. Celui-ci reste ouvert.", 8000);
    } catch {
      flash("Impossible d’éjecter");
    } finally {
      setBusy(false);
    }
  }

  async function lockNow() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      window.location.replace("/unlock");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionTitle className="mb-1.5 mt-3">Accès foyer</SectionTitle>
      <Card compact>
        <p className="text-[13px] font-semibold">Un seul code, pas d’identifiant</p>
        <p className="mt-0.5 text-[11px] leading-snug text-health-muted">
          Session gardée sur cet iPhone. Face ID remplace le code après activation.
        </p>
        <p className="mt-2 text-[11px] leading-snug text-health-muted">
          {alertsOn
            ? "Mail d’alerte : lien « Bloquer l’accès » valable 48 h, ou les boutons ci-dessous."
            : "Mail d’alerte inactif — Gmail : ALERT_SMTP_USER + ALERT_SMTP_PASS dans Vercel."}
        </p>
        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-health-muted">Nouveau code foyer</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-card bg-health-bg px-3 py-2.5 text-[16px] outline-none"
          />
        </label>
        <label className="mt-1.5 block">
          <span className="text-[12px] font-medium text-health-muted">Encore une fois</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="mt-1 w-full rounded-card bg-health-bg px-3 py-2.5 text-[16px] outline-none"
          />
        </label>
        <button
          type="button"
          disabled={busy || password.length < 8}
          onClick={() => void changeCode()}
          className="mt-2 w-full rounded-card bg-health-ink py-2.5 text-[13px] font-semibold text-health-on-fill disabled:opacity-40"
        >
          Changer le code et éjecter les autres
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void kickOthers()}
          className="mt-1.5 w-full rounded-card bg-health-bg py-2.5 text-[13px] font-semibold disabled:opacity-50"
        >
          Éjecter les autres appareils (même code)
        </button>
        <p className="mt-1.5 text-[11px] leading-snug text-health-muted">
          Code ouvert sans Face ID → change le code. Essais ratés seulement → éjecter peut suffire. Le
          mail a le même changement de code (tu te recos ensuite).
        </p>
        {canFace ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void (faceOn ? disableFace() : enableFace())}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-card bg-health-bg py-2.5 text-[13px] font-semibold disabled:opacity-50"
          >
            <ScanFace size={16} />
            {faceOn ? "Désactiver Face ID" : "Activer Face ID"}
          </button>
        ) : (
          <p className="mt-2 text-[11px] text-health-muted">Face ID indisponible sur cet appareil.</p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void sendTestMail()}
          className="mt-1.5 w-full rounded-card bg-health-bg py-2.5 text-[13px] font-semibold text-health-muted disabled:opacity-50"
        >
          Envoyer un mail test
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void lockNow()}
          className="mt-1.5 w-full rounded-card bg-health-bg py-2.5 text-[13px] font-semibold text-health-muted disabled:opacity-50"
        >
          Verrouiller maintenant
        </button>
        {toast ? <p className="mt-2 text-center text-[11px] text-health-muted">{toast}</p> : null}
      </Card>
    </>
  );
}
