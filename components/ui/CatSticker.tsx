import type { CatFeelMood } from "@/lib/cat-feel";
import { cn } from "@/lib/utils";

export function CatSticker({
  mood,
  className,
  title,
  selected = false,
}: {
  mood: CatFeelMood;
  className?: string;
  title?: string;
  selected?: boolean;
}) {
  const faceFill = selected
    ? "fill-[#1C1C1E]/70 dark:fill-white/90"
    : "fill-[#1C1C1E]/70";
  const faceStroke = selected
    ? "stroke-[#1C1C1E]/70 dark:stroke-white/90"
    : "stroke-[#1C1C1E]/70";

  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-8 w-8", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {mood === "ok" ? (
        <OkCat faceFill={faceFill} faceStroke={faceStroke} />
      ) : mood === "bof" ? (
        <BofCat faceFill={faceFill} faceStroke={faceStroke} />
      ) : (
        <CreveCat faceFill={faceFill} faceStroke={faceStroke} />
      )}
    </svg>
  );
}

function OkCat({ faceFill, faceStroke }: { faceFill: string; faceStroke: string }) {
  return (
    <>
      <g fill="currentColor">
        <polygon points="7.5,13 9.2,2 15.6,11" />
        <polygon points="16.4,11 22.8,2 24.5,13" />
        <circle cx="16" cy="19.4" r="10.4" />
      </g>
      <g className={faceFill}>
        <circle cx="12.1" cy="17.6" r="1.95" />
        <circle cx="19.9" cy="17.6" r="1.95" />
        <ellipse cx="16" cy="20.7" rx="1.2" ry="0.8" />
      </g>
      <path
        d="M12.4 23 C14.1 25.6 17.9 25.6 19.6 23"
        className={faceStroke}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  );
}

function BofCat({ faceFill, faceStroke }: { faceFill: string; faceStroke: string }) {
  return (
    <>
      <g fill="currentColor">
        <polygon points="5.2,14.5 3.4,5.4 14,12.2" />
        <polygon points="18,12.2 28.6,5.4 26.8,14.5" />
        <circle cx="16" cy="19.6" r="10.4" />
      </g>
      <g className={faceFill}>
        <rect x="9.8" y="17.3" width="4.6" height="1.85" rx="0.9" />
        <rect x="17.6" y="17.3" width="4.6" height="1.85" rx="0.9" />
        <ellipse cx="16" cy="21" rx="1.15" ry="0.7" />
      </g>
      <path
        d="M13.6 23.6 H18.4"
        className={faceStroke}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  );
}

function CreveCat({ faceStroke }: { faceFill: string; faceStroke: string }) {
  return (
    <g transform="rotate(-9 16 19)">
      <circle cx="16" cy="19.2" r="10.4" fill="currentColor" />
      <g fill="currentColor">
        <polygon points="5,16.2 2.2,27 12,20.2" />
        <polygon points="20,20.2 29.8,27 27,16.2" />
      </g>
      <g className={faceStroke} fill="none" strokeWidth="1.7" strokeLinecap="round">
        <path d="M10.2 16.2 L14.4 20.2 M14.4 16.2 L10.2 20.2" />
        <path d="M17.6 16.2 L21.8 20.2 M21.8 16.2 L17.6 20.2" />
        <path d="M13.2 23.8 C14.6 22.4 17.4 22.4 18.8 23.8" />
      </g>
    </g>
  );
}
