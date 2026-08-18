"use client";

import { cn } from "@/lib/utils";

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-health-line py-1.5 last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-tight">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] leading-snug text-health-muted">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "flex h-[28px] w-[46px] shrink-0 items-center rounded-full p-[2px] transition-colors",
          checked ? "justify-end bg-[#34C759]" : "justify-start bg-[#E5E5EA] dark:bg-[#39393D]",
        )}
      >
        <span className="block h-6 w-6 shrink-0 rounded-full bg-white shadow-sm" />
      </button>
    </div>
  );
}
