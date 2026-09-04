"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, Plus, Search, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { RejectedRecipe } from "@/lib/rejected";
import { groupRejectedByTheme, searchRejected } from "@/lib/rejected";
import { themeLabel } from "@/lib/favorites";

export function RejectedPanel({
  list,
  onOpen,
  onAddTitle,
}: {
  list: RejectedRecipe[];
  onOpen: (item: RejectedRecipe) => void;
  onAddTitle: (title: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const groups = useMemo(
    () => groupRejectedByTheme(searchRejected(list, query)),
    [list, query],
  );

  function submitDraft() {
    const title = draft.trim();
    if (!title) return;
    onAddTitle(title);
    setDraft("");
  }

  return (
    <div className="mt-3 space-y-3">
      <label className="relative block">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-health-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un plat banni…"
          className="w-full rounded-card bg-white py-2.5 pl-9 pr-3 text-[14px] shadow-card outline-none"
        />
      </label>

      {list.length === 0 ? (
        <Card>
          <p className="text-[14px] font-semibold">Aucun plat en Plus jamais</p>
          <p className="mt-1 text-[13px] leading-relaxed text-health-muted">
            Un plat ici n’est plus proposé par Gem et n’apparaît plus dans l’historique. Tu le
            retrouves seulement ici, avec « Je change d’avis ».
          </p>
        </Card>
      ) : groups.length === 0 ? (
        <p className="px-0.5 text-[13px] text-health-muted">Aucun plat pour « {query} ».</p>
      ) : (
        groups.map((group) => (
          <div key={group.theme}>
            <p className="mb-1.5 px-0.5 text-[12px] font-semibold uppercase tracking-wide text-health-muted">
              {group.theme}
            </p>
            <div className="space-y-1.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpen(item)}
                  className="flex w-full items-start gap-2 rounded-card bg-white px-3 py-3 text-left shadow-card"
                >
                  <Ban size={14} className="mt-0.5 shrink-0 text-red-600" />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold leading-snug">{item.title}</span>
                    <span className="mt-0.5 block text-[12px] text-health-muted">Toucher pour modifier ou retirer</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitDraft();
          }}
          placeholder="Ajouter un titre à bannir…"
          className="min-w-0 flex-1 rounded-card bg-white px-3 py-2.5 text-[14px] shadow-card outline-none"
        />
        <button
          type="button"
          onClick={submitDraft}
          disabled={!draft.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-health-ink text-white disabled:opacity-40"
          aria-label="Ajouter à Plus jamais"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}

export function RejectedRecipeSheet({
  item,
  onClose,
  onRemove,
  onSaveMeta,
}: {
  item: RejectedRecipe;
  onClose: () => void;
  onRemove: () => void;
  onSaveMeta: (patch: { title: string; theme: string }) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [theme, setTheme] = useState(item.theme === "Autre" ? "" : item.theme);

  useEffect(() => {
    setTitle(item.title);
    setTheme(item.theme === "Autre" ? "" : item.theme);
  }, [item.id, item.title, item.theme]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="flex max-h-[88vh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] bg-health-bg shadow-card">
        <div className="flex shrink-0 items-center justify-between bg-health-bg px-4 pb-2 pt-4">
          <h3 className="text-[17px] font-semibold">Plus jamais</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-white p-1.5 shadow-card">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10">
          <p className="text-[13px] leading-relaxed text-health-muted">
            Gem Chef ne proposera plus ce titre. Si tu changes d’avis, retire-le de la liste.
          </p>
          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-health-muted">
            Titre
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-card bg-white px-3 py-2.5 text-[14px] outline-none"
          />
          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-health-muted">
            Thème
          </label>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Ex. Satay, Bowl…"
            className="mt-1 w-full rounded-card bg-white px-3 py-2.5 text-[14px] outline-none"
          />
          <button
            type="button"
            onClick={() => onSaveMeta({ title: title.trim() || item.title, theme: themeLabel(theme) })}
            className="mt-2 text-[12px] font-semibold"
          >
            Enregistrer titre / thème
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white"
          >
            <Ban size={15} />
            Je change d’avis
          </button>
        </div>
      </div>
    </div>
  );
}
