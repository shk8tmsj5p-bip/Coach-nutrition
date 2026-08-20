"use client";

import { useEffect, useState } from "react";
import { subscribeGeminiWait } from "@/lib/gemini/wait";

export function GeminiWaitHost() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => subscribeGeminiWait(setLabel), []);
  if (!label) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-[260px] rounded-card bg-white px-5 py-6 text-center shadow-card">
        <RunningCat />
        <p className="mt-4 text-[15px] font-semibold leading-snug text-health-ink">{label}</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-health-muted">
          On attend la réponse — sans toucher, ça tourne tout seul.
        </p>
      </div>
    </div>
  );
}

function RunningCat() {
  return (
    <div className="gemini-cat-scene mx-auto h-14 w-[180px] overflow-hidden">
      <svg viewBox="0 0 180 56" className="h-full w-full text-health-ink" aria-hidden>
        <g className="gemini-cat-ground" fill="currentColor" opacity="0.22">
          <rect x="0" y="48" width="14" height="3" rx="1.5" />
          <rect x="24" y="48" width="18" height="3" rx="1.5" />
          <rect x="54" y="48" width="12" height="3" rx="1.5" />
          <rect x="78" y="48" width="16" height="3" rx="1.5" />
          <rect x="108" y="48" width="14" height="3" rx="1.5" />
          <rect x="134" y="48" width="20" height="3" rx="1.5" />
          <rect x="166" y="48" width="14" height="3" rx="1.5" />
        </g>
        <g className="gemini-cat-run origin-center" fill="currentColor">
          <ellipse className="gemini-cat-leg" cx="18" cy="42" rx="3.2" ry="8" />
          <ellipse className="gemini-cat-leg gemini-cat-leg-b" cx="28" cy="42" rx="3.2" ry="8" />
          <ellipse className="gemini-cat-leg" cx="46" cy="42" rx="3.2" ry="8" />
          <ellipse className="gemini-cat-leg gemini-cat-leg-b" cx="56" cy="42" rx="3.2" ry="8" />
          <ellipse cx="38" cy="30" rx="22" ry="13" />
          <circle cx="58" cy="20" r="11" />
          <polygon points="50,12 54,2 58,12" />
          <polygon points="58,12 64,1 68,13" />
          <path
            className="gemini-cat-tail"
            d="M16 26 C6 18 2 10 8 4 C10 14 12 20 18 28 Z"
          />
        </g>
      </svg>
    </div>
  );
}
