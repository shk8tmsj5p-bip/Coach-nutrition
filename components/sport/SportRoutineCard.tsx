"use client";

import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useProfile } from "@/context/ProfileContext";
import { CardioPlanner } from "@/components/sport/CardioPlanner";
import { HypertrophyPlanner } from "@/components/sport/HypertrophyPlanner";
import { SportSessionSheet } from "@/components/sport/SportSessionSheet";
import {
  activityLabel,
  effortLabel,
  emptySession,
  formatExerciseLine,
  formatWeekdays,
  parseSportRoutine,
  removeSessionById,
  unshareById,
  upsertSession,
  withSessions,
} from "@/lib/sport-routine";
import type { Profile, ProfileId, SportActivity, SportRoutine, SportSession } from "@/lib/types";

type Pending =
  | { kind: "save"; session: SportSession }
  | { kind: "delete"; session: SportSession };

export function SportRoutineCard({
  profile,
  pane,
}: {
  profile: Profile;
  pane: SportActivity | "coach";
}) {
  const { catalog, updateSportRoutine, updateSportRoutines } = useProfile();
  const routine = useMemo(() => parseSportRoutine(profile.sportRoutine), [profile.sportRoutine]);
  const [editing, setEditing] = useState<SportSession | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessions = pane === "coach" ? [] : routine.sessions.filter((session) => session.activity === pane);

  function sessionsOf(id: ProfileId) {
    return parseSportRoutine(catalog[id].sportRoutine).sessions;
  }

  async function persistRoutine(next: SportRoutine) {
    setSaving(true);
    setError(null);
    try {
      const message = await updateSportRoutine(profile.id, next);
      if (message) setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function persistSelf(sessions: SportSession[]) {
    await persistRoutine(withSessions(routine, sessions));
  }

  async function persistPair(alexis: SportSession[], elodie: SportSession[]) {
    setSaving(true);
    setError(null);
    try {
      const message = await updateSportRoutines({
        alexis: withSessions(parseSportRoutine(catalog.alexis.sportRoutine), alexis),
        elodie: withSessions(parseSportRoutine(catalog.elodie.sportRoutine), elodie),
      });
      if (message) setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function saveBoth(session: SportSession) {
    const shared = { ...session, shared: true };
    await persistPair(
      upsertSession(sessionsOf("alexis"), shared),
      upsertSession(sessionsOf("elodie"), shared),
    );
  }

  async function saveSelfOnly(session: SportSession) {
    const local = { ...session, shared: false };
    const mine = upsertSession(routine.sessions, local);
    const otherId: ProfileId = profile.id === "alexis" ? "elodie" : "alexis";
    const others = unshareById(sessionsOf(otherId), session.id);
    await persistPair(
      profile.id === "alexis" ? mine : others,
      profile.id === "elodie" ? mine : others,
    );
  }

  async function deleteBoth(sessionId: string) {
    await persistPair(
      removeSessionById(sessionsOf("alexis"), sessionId),
      removeSessionById(sessionsOf("elodie"), sessionId),
    );
  }

  async function deleteSelfOnly(sessionId: string) {
    const mine = removeSessionById(routine.sessions, sessionId);
    const otherId: ProfileId = profile.id === "alexis" ? "elodie" : "alexis";
    const others = unshareById(sessionsOf(otherId), sessionId);
    await persistPair(
      profile.id === "alexis" ? mine : others,
      profile.id === "elodie" ? mine : others,
    );
  }

  async function requestSave(session: SportSession) {
    const existing = routine.sessions.find((item) => item.id === session.id);
    if (!existing) {
      if (session.shared) await saveBoth(session);
      else await persistSelf(upsertSession(routine.sessions, { ...session, shared: false }));
      setEditing(null);
      return;
    }
    if (existing.shared || session.shared) {
      setPending({ kind: "save", session });
      return;
    }
    await persistSelf(upsertSession(routine.sessions, { ...session, shared: false }));
    setEditing(null);
  }

  function requestDelete(session: SportSession) {
    if (session.shared) {
      setPending({ kind: "delete", session });
      return;
    }
    void persistSelf(removeSessionById(routine.sessions, session.id));
  }

  async function confirmPending(scope: "both" | "self") {
    if (!pending) return;
    if (pending.kind === "save") {
      if (scope === "both") await saveBoth({ ...pending.session, shared: true });
      else await saveSelfOnly(pending.session);
    } else if (scope === "both") {
      await deleteBoth(pending.session.id);
    } else {
      await deleteSelfOnly(pending.session.id);
    }
    setPending(null);
    setEditing(null);
  }

  if (pane === "coach") {
    return (
      <>
        <p className="mb-3 text-[12px] leading-snug text-health-muted">
          Propose les séances. Tu valides → ça devient ta routine.
        </p>
        <CardioPlanner
          key={`${profile.id}-cardio`}
          profile={profile}
          routine={routine}
          saving={saving}
          onApply={persistRoutine}
        />
        {profile.primaryGoal === "prise" ? (
          <HypertrophyPlanner
            key={`${profile.id}-hyp`}
            profile={profile}
            routine={routine}
            saving={saving}
            onApply={persistRoutine}
          />
        ) : null}
        {error && <p className="mt-3 text-[12px] text-coral">Enregistré en local · {error}</p>}
      </>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] text-health-muted">
          {sessions.length === 0
            ? `Aucune séance ${activityLabel(pane).toLowerCase()}.`
            : `${sessions.length} séance${sessions.length > 1 ? "s" : ""}`}
        </p>
        <button
          type="button"
          onClick={() => setEditing(emptySession(pane))}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-health-ink"
        >
          <Plus size={14} />
          Ajouter
        </button>
      </div>
      {sessions.length > 0 ? (
        <div className="space-y-1.5">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              disabled={saving}
              onEdit={() => setEditing(session)}
              onDelete={() => requestDelete(session)}
            />
          ))}
        </div>
      ) : null}
      {error && <p className="mt-3 text-[12px] text-coral">Enregistré en local · {error}</p>}

      {editing && (
        <SportSessionSheet
          session={editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={(session) => void requestSave(session)}
        />
      )}

      {pending && (
        <DuoConfirm
          pending={pending}
          saving={saving}
          onBoth={() => void confirmPending("both")}
          onSelf={() => void confirmPending("self")}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}

function SessionRow({
  session,
  disabled,
  onEdit,
  onDelete,
}: {
  session: SportSession;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const days = formatWeekdays(session.weekdays);
  const named = session.exercises.filter((exercise) => exercise.name.trim());
  return (
    <div className="rounded-2xl bg-health-bg px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[14px] font-semibold">{effortLabel(session.effort)}</p>
        {session.shared && <DuoBadge />}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {days && <Badge>{days}</Badge>}
        <Badge>{session.durationMin} min</Badge>
        {session.activity !== "muscu" && <Badge>D+ {session.elevationM} m</Badge>}
        <Badge>{effortLabel(session.effort)}</Badge>
      </div>
      {named.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {named.map((exercise) => (
            <li key={exercise.id} className="text-[12px] leading-snug text-health-muted">
              {formatExerciseLine(exercise)}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onEdit}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-white py-1.5 text-[12px] font-semibold disabled:opacity-50"
        >
          <Pencil size={12} />
          Éditer
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-white py-1.5 text-[12px] font-semibold text-coral disabled:opacity-50"
        >
          <Trash2 size={12} />
          Supprimer
        </button>
      </div>
    </div>
  );
}

function DuoConfirm({
  pending,
  saving,
  onBoth,
  onSelf,
  onClose,
}: {
  pending: Pending;
  saving: boolean;
  onBoth: () => void;
  onSelf: () => void;
  onClose: () => void;
}) {
  const isDelete = pending.kind === "delete";
  const unlink = pending.kind === "save" && !pending.session.shared;
  const title = isDelete
    ? "Supprimer la séance duo"
    : unlink
      ? "Retirer le lien duo ?"
      : "Mettre à jour pour les deux profils ?";
  const body = isDelete
    ? "Cette séance est partagée. Tu peux la retirer chez Alexis et Élodie, ou seulement sur ce profil."
    : unlink
      ? "L’autre profil gardera une copie, sans synchronisation."
      : "La séance restera identique chez Alexis et Élodie, avec le badge Duo.";

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/30">
      <div className="w-full max-w-[430px] rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="text-[14px] leading-relaxed text-health-muted">{body}</p>
        {unlink ? (
          <button
            type="button"
            disabled={saving}
            onClick={onSelf}
            className="mt-4 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            Retirer le lien
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={onBoth}
              className="mt-4 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {isDelete ? "Supprimer pour les deux" : "Mettre à jour les deux profils"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onSelf}
              className="mt-2 w-full rounded-card bg-health-bg py-3 text-[14px] font-semibold disabled:opacity-50"
            >
              Ce profil seulement
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DuoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-health-ink">
      <Users size={12} />
      Duo
    </span>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-health-ink">
      {children}
    </span>
  );
}
