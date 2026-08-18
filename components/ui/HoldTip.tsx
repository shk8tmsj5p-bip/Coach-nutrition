"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const HOLD_MS = 420;

export function HoldTip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);
  const held = useRef(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240, up: false });

  function overflows() {
    const el = textRef.current;
    return Boolean(el && el.scrollWidth > el.clientWidth + 1);
  }

  function place() {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    const width = Math.min(280, window.innerWidth - 24);
    const left = Math.max(12, Math.min(box.left, window.innerWidth - width - 12));
    const up = box.bottom + 80 > window.innerHeight;
    setPos({ top: up ? box.top - 8 : box.bottom + 8, left, width, up });
  }

  function show() {
    if (!overflows()) return;
    place();
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  function startHold(event: React.PointerEvent) {
    if (event.pointerType === "mouse") return;
    held.current = false;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      held.current = true;
      show();
    }, HOLD_MS);
  }

  function endHold() {
    window.clearTimeout(timer.current);
  }

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("pointerdown", close);
    };
  }, [open]);

  return (
    <>
      <span
        ref={wrapRef}
        className={cn("relative min-w-0 flex-1 select-none", className)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        onContextMenu={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (!held.current) return;
          event.preventDefault();
          event.stopPropagation();
          held.current = false;
        }}
      >
        <span ref={textRef} className="block truncate">
          {children}
        </span>
      </span>
      {open
        ? createPortal(
            <span
              role="tooltip"
              onPointerDown={(event) => event.stopPropagation()}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: pos.width,
                transform: pos.up ? "translateY(-100%)" : undefined,
              }}
              className="z-[80] rounded-xl bg-health-ink px-3 py-2 text-[12px] font-medium leading-snug text-white shadow-card"
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
