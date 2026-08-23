"use client";

import { useEffect, useRef } from "react";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImagePickButton({
  icon: Icon,
  label,
  capture,
  disabled,
  onPick,
}: {
  icon: typeof Camera;
  label: string;
  capture?: boolean;
  disabled?: boolean;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (capture) input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
  }, [capture]);

  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col items-center gap-2 overflow-hidden rounded-card bg-health-bg py-6",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <Icon size={22} />
      <span className="text-[13px] font-semibold">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPick(file);
        }}
      />
    </label>
  );
}
