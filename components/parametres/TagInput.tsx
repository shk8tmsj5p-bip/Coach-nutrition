"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TagInput({
  tags,
  onChange,
  placeholder,
  accent,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  accent: "coral" | "violet";
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const next = raw.trim();
    if (!next) return;
    const exists = tags.some((tag) => tag.toLowerCase() === next.toLowerCase());
    if (!exists) onChange([...tags, next]);
    setDraft("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              "inline-flex max-w-full items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
              accent === "coral" ? "bg-coral-soft text-coral-dark" : "bg-violet-soft text-violet-dark",
            )}
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              aria-label={`Retirer ${tag}`}
              onClick={() => onChange(tags.filter((item) => item !== tag))}
              className="shrink-0 opacity-70"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </span>
        ))}
      </div>
      <form
        className="mt-1.5 flex gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          add(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "," || event.key === "Enter") {
              event.preventDefault();
              add(draft.replace(/,/g, ""));
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg bg-health-bg px-2.5 py-1.5 text-[13px] outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-health-bg px-2.5 py-1.5 text-[12px] font-semibold"
        >
          Ajouter
        </button>
      </form>
    </div>
  );
}
