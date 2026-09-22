"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cycleTabHref, ignoreTabSwipeTarget, tabHrefFromPath } from "@/lib/tabs";

const THRESHOLD_PX = 64;

export function useTabSwipe() {
  const pathname = usePathname();
  const router = useRouter();
  const start = useRef<{ x: number; y: number; ignore: boolean } | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    start.current = {
      x: event.clientX,
      y: event.clientY,
      ignore: ignoreTabSwipeTarget(event.target),
    };
  }, []);

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const origin = start.current;
      start.current = null;
      if (!origin || origin.ignore) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (Math.abs(dx) < THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;
      const current = tabHrefFromPath(pathRef.current);
      const next = cycleTabHref(pathRef.current, dx < 0 ? 1 : -1);
      if (next === current) return;
      router.push(next);
    },
    [router],
  );

  const onPointerCancel = useCallback(() => {
    start.current = null;
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel };
}
