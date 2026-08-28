import type { CatFeelMood } from "@/lib/cat-feel";
import { cn } from "@/lib/utils";

export function CatSticker({
  mood,
  className,
  title,
}: {
  mood: CatFeelMood;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 40"
      className={cn("h-8 w-9", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {mood === "ok" ? <OkCat /> : mood === "bof" ? <BofCat /> : <CreveCat />}
    </svg>
  );
}

function OkCat() {
  return (
    <>
      <g fill="currentColor">
        <ellipse cx="22" cy="26" rx="14" ry="10" />
        <circle cx="32" cy="16" r="8" />
        <polygon points="26,11 28,3 32,12" />
        <polygon points="32,12 38,2 40,13" />
        <path d="M10 22 C4 16 2 10 7 6 C8 14 10 18 14 24 Z" />
      </g>
      <g className="fill-black/50 dark:fill-white/70">
        <circle cx="34" cy="16" r="1.2" />
        <circle cx="29.5" cy="16.2" r="1.2" />
      </g>
    </>
  );
}

function BofCat() {
  return (
    <>
      <g fill="currentColor">
        <ellipse cx="22" cy="27" rx="14.5" ry="9" />
        <ellipse cx="31" cy="18" rx="8" ry="7.2" />
        <polygon points="24,14 23,7 30,15" />
        <polygon points="32,15 39,8 39,16" />
        <path d="M9 24 C3 20 2 14 6 11 C8 17 10 20 13 25 Z" />
      </g>
      <g className="fill-black/50 dark:fill-white/70">
        <rect x="27.2" y="17.2" width="3.4" height="1.15" rx="0.6" />
        <rect x="32.4" y="17.2" width="3.4" height="1.15" rx="0.6" />
      </g>
    </>
  );
}

function CreveCat() {
  return (
    <>
      <g fill="currentColor">
        <ellipse cx="24" cy="28" rx="16" ry="7.5" />
        <ellipse cx="12" cy="24" rx="7.5" ry="6.5" />
        <polygon points="6,20 5,13 11,21" />
        <polygon points="12,21 16,12 18,22" />
        <path d="M38 26 C44 22 46 16 42 13 C41 20 40 23 36 27 Z" />
      </g>
      <g className="stroke-black/50 dark:stroke-white/70" fill="none" strokeWidth="1.2" strokeLinecap="round">
        <path d="M8.5 23.5 L11.5 26.2 M11.5 23.5 L8.5 26.2" />
        <path d="M13.2 23.2 L16 25.8 M16 23.2 L13.2 25.8" />
      </g>
    </>
  );
}
