"use client";

import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { FACEID_STORAGE_KEY } from "@/lib/auth/constants";

type UnlockError = { message: string; locked?: boolean };

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...init });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    remaining?: number;
    lockedUntil?: number;
    ok?: boolean;
  };
  return { response, payload };
}

export function UnlockScreen() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UnlockError | null>(null);
  const [faceReady, setFaceReady] = useState(false);
  const [canFace, setCanFace] = useState(false);
  const [askFace, setAskFace] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = typeof window !== "undefined" && localStorage.getItem(FACEID_STORAGE_KEY) === "1";
      let serverFace = false;
      try {
        const probe = await jsonFetch("/api/auth/status");
        serverFace = Boolean((probe.payload as { faceId?: boolean }).faceId);
      } catch {
        serverFace = false;
      }
      const available = browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable());
      if (cancelled) return;
      setCanFace(available);
      setFaceReady(local || serverFace);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enterApp() {
    window.location.replace("/");
  }

  async function onPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { response, payload } = await jsonFetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError({
          message: payload.error ?? "Code incorrect",
          locked: response.status === 429,
        });
        setPassword("");
        return;
      }
      if (canFace && !faceReady) {
        setAskFace(true);
        return;
      }
      await enterApp();
    } finally {
      setBusy(false);
    }
  }

  async function enableFaceId() {
    setBusy(true);
    setError(null);
    try {
      const options = await jsonFetch("/api/auth/webauthn/register");
      if (!options.response.ok) {
        setError({ message: options.payload.error ?? "Face ID indisponible" });
        return;
      }
      const attestation = await startRegistration({ optionsJSON: options.payload as never });
      const saved = await jsonFetch("/api/auth/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attestation),
      });
      if (!saved.response.ok) {
        setError({ message: saved.payload.error ?? "Impossible d’activer Face ID" });
        return;
      }
      localStorage.setItem(FACEID_STORAGE_KEY, "1");
      await enterApp();
    } catch (err) {
      if (err instanceof Error && /not allowed|cancel|abort/i.test(err.message)) {
        await enterApp();
        return;
      }
      setError({ message: "Face ID annulé. Tu pourras l’activer dans Paramètres." });
    } finally {
      setBusy(false);
    }
  }

  async function withFaceId() {
    setBusy(true);
    setError(null);
    try {
      const options = await jsonFetch("/api/auth/webauthn/login");
      if (!options.response.ok) {
        setFaceReady(false);
        localStorage.removeItem(FACEID_STORAGE_KEY);
        setError({ message: "Utilise le code foyer sur cet iPhone." });
        return;
      }
      const assertion = await startAuthentication({ optionsJSON: options.payload as never });
      const saved = await jsonFetch("/api/auth/webauthn/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });
      if (!saved.response.ok) {
        setError({ message: saved.payload.error ?? "Face ID refusé" });
        return;
      }
      localStorage.setItem(FACEID_STORAGE_KEY, "1");
      await enterApp();
    } catch (err) {
      if (err instanceof Error && /not allowed|cancel|abort/i.test(err.message)) {
        return;
      }
      setError({ message: "Face ID indisponible. Utilise le code." });
    } finally {
      setBusy(false);
    }
  }

  if (askFace) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-6">
        <ScanFace className="mx-auto text-health-ink" size={36} />
        <h1 className="mt-4 text-center text-[22px] font-bold tracking-tight">Ouvrir avec Face ID</h1>
        <p className="mt-2 text-center text-[14px] leading-relaxed text-health-muted">
          La prochaine fois, plus de code sur cet iPhone.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void enableFaceId()}
          className="mt-6 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-health-on-fill disabled:opacity-50"
        >
          {busy ? "Face ID…" : "Activer Face ID"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void enterApp()}
          className="mt-2 w-full py-3 text-[14px] font-semibold text-health-muted"
        >
          Plus tard
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6">
      <p className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-health-muted">
        Foyer
      </p>
      <h1 className="mt-1 text-center text-[22px] font-bold tracking-tight">Coach Nutrition</h1>
      <p className="mt-2 text-center text-[13px] leading-relaxed text-health-muted">
        Pas d’identifiant. Le code foyer, ou Face ID sur cet iPhone.
      </p>

      {faceReady ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void withFaceId()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-card bg-health-ink py-3.5 text-[15px] font-semibold text-health-on-fill disabled:opacity-50"
        >
          <ScanFace size={18} />
          {busy ? "Face ID…" : "Ouvrir avec Face ID"}
        </button>
      ) : null}

      <form onSubmit={(event) => void onPassword(event)} className={faceReady ? "mt-4" : "mt-6"}>
        <label className="block">
          <span className="text-[12px] font-medium text-health-muted">Code foyer</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy || Boolean(error?.locked)}
            className="mt-1 w-full rounded-card bg-health-card px-3 py-3 text-[16px] outline-none shadow-card"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !password.trim() || Boolean(error?.locked)}
          className="mt-3 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-health-on-fill disabled:opacity-40"
        >
          {busy ? "Ouverture…" : "Entrer"}
        </button>
      </form>

      {error ? (
        <p className="mt-3 text-center text-[13px] font-medium text-coral-dark">{error.message}</p>
      ) : (
        <p className="mt-3 text-center text-[11px] text-health-muted">3 essais, puis pause 15 min.</p>
      )}
    </div>
  );
}
