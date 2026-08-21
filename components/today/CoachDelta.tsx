"use client";

import { useMemo, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoachAddChoice, CoachIngredientAdd, MacroKind } from "@/lib/coach-ingredients";

export function CoachBadge({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-semibold text-coral-dark">
      Ajustement Coach
      {onDismiss ? (
        <button
          type="button"
          aria-label="Masquer l’ajustement"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
          className="rounded-full p-0.5 text-coral-dark/80 hover:bg-white/60"
        >
          <X size={11} />
        </button>
      ) : null}
    </span>
  );
}

export function CoachDiffTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-coral-dark"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
          {tag}
        </span>
      ))}
    </div>
  );
}

export function CoachMealAddTags({
  adds,
  onAutreIdee,
  onValidate,
}: {
  adds: CoachIngredientAdd[];
  onAutreIdee?: (kind: CoachIngredientAdd["kind"]) => void;
  onValidate?: (picks: Array<{ kind: MacroKind; choice: CoachAddChoice }>) => void;
}) {
  const [selected, setSelected] = useState<Partial<Record<MacroKind, CoachAddChoice>>>({});
  const picks = useMemo(
    () =>
      adds
        .map((add) => {
          const choice = selected[add.kind];
          if (!choice) return null;
          if (choice === "quick" && !add.quickBadge) return null;
          return { kind: add.kind, choice };
        })
        .filter((item): item is { kind: MacroKind; choice: CoachAddChoice } => Boolean(item)),
    [adds, selected],
  );

  if (adds.length === 0) return null;

  function toggle(kind: MacroKind, choice: CoachAddChoice) {
    setSelected((current) => ({
      ...current,
      [kind]: current[kind] === choice ? undefined : choice,
    }));
  }

  return (
    <div className="mt-1.5 space-y-1.5" onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1">
        {adds.map((add) => (
          <ProposalChip
            key={`${add.kind}-ideal`}
            label={add.badge}
            selected={selected[add.kind] === "ideal"}
            onClick={() => toggle(add.kind, "ideal")}
            selectable={Boolean(onValidate)}
          />
        ))}
        {adds.map((add) =>
          add.quickBadge ? (
            <span key={`${add.kind}-quick`} className="inline-flex items-center gap-1">
              <ProposalChip
                label={add.quickBadge}
                selected={selected[add.kind] === "quick"}
                onClick={() => toggle(add.kind, "quick")}
                selectable={Boolean(onValidate)}
              />
              {onAutreIdee ? (
                <button
                  type="button"
                  onClick={() => onAutreIdee(add.kind)}
                  className="inline-flex items-center gap-0.5 rounded-full bg-health-bg px-2 py-0.5 text-[10px] font-semibold text-health-muted"
                >
                  <RefreshCw size={10} />
                  Autre idée
                </button>
              ) : null}
            </span>
          ) : null,
        )}
      </div>
      {onValidate ? (
        <>
          <p className="text-[10px] leading-snug text-health-muted">
            Coche Idéal (prochaine prépa) ou Rapide (maintenant), puis Ajouter.
          </p>
          <button
            type="button"
            disabled={picks.length === 0}
            onClick={() => onValidate(picks)}
            className="inline-flex items-center gap-1 rounded-full bg-coral px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
          >
            <Check size={12} strokeWidth={3} />
            {picks.length > 1 ? `Ajouter (${picks.length})` : "Ajouter"}
          </button>
        </>
      ) : null}
    </div>
  );
}

function ProposalChip({
  label,
  selected,
  onClick,
  selectable,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  selectable: boolean;
}) {
  if (!selectable) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-coral-dark">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        selected ? "bg-coral text-white" : "bg-coral-soft text-coral-dark",
      )}
    >
      <span
        className={cn(
          "flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border",
          selected ? "border-white bg-white text-coral" : "border-coral/50 bg-white/70",
        )}
      >
        {selected ? <Check size={9} strokeWidth={3} /> : null}
      </span>
      {label}
    </button>
  );
}

export function coachHighlightClass(active: boolean) {
  return cn(active && "ring-1 ring-coral/35");
}
