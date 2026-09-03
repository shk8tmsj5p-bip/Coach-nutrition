"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function UrgenceScreen() {
  const params = useSearchParams();
  const token = params.get("k") ?? "";
  const [kind, setKind] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/auth/urgence?k=${encodeURIComponent(token)}`);
      const payload = (await response.json()) as { error?: string; kind?: string };
      if (cancelled) return;
      if (!response.ok) {
        setError(payload.error ?? "Lien invalide");
        return;
      }
      setKind(payload.kind ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/urgence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirm }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Impossible de changer le code");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  const intro =
    kind === "password_unlock_new_device" || kind === "face_id_register"
      ? "Quelqu’un a ouvert l’app (code ou Face ID nouveau). Change le code maintenant : l’ancien ne marche plus, toutes les sessions sont coupées."
      : "Quelqu’un a tapé un mauvais code, plusieurs fois. Change le code pour qu’il ne puisse plus réessayer avec le bon.";

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-6">
        <h1 className="text-center text-[22px] font-bold tracking-tight">Code changé</h1>
        <p className="mt-3 text-center text-[14px] leading-relaxed text-health-muted">
          Sur chaque iPhone : ouvre l’app, entre le <span className="font-semibold text-health-ink">nouveau</span>{" "}
          code, puis réactive Face ID dans Paramètres.
        </p>
        <p className="mt-3 text-center text-[13px] text-health-muted">Dis le nouveau code à Élodie de vive voix.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6">
      <p className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-health-muted">Urgence foyer</p>
      <h1 className="mt-1 text-center text-[22px] font-bold tracking-tight">Bloquer l’accès</h1>
      <p className="mt-3 text-center text-[14px] leading-relaxed text-health-muted">{error ?? intro}</p>
      {!error ? (
        <form onSubmit={(event) => void onSubmit(event)} className="mt-6">
          <label className="block">
            <span className="text-[12px] font-medium text-health-muted">Nouveau code foyer</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-card bg-health-card px-3 py-3 text-[16px] outline-none shadow-card"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-[12px] font-medium text-health-muted">Encore une fois</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="mt-1 w-full rounded-card bg-health-card px-3 py-3 text-[16px] outline-none shadow-card"
            />
          </label>
          <button
            type="submit"
            disabled={busy || password.length < 8}
            className="mt-4 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-health-on-fill disabled:opacity-40"
          >
            {busy ? "Enregistrement…" : "Changer le code et éjecter tout le monde"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
