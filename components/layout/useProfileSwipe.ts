"use client";

import { useCallback, useRef } from "react";
import { useProfile } from "@/context/ProfileContext";
import { cycleView, ignoreProfileSwipeTarget } from "@/lib/view-cycle";

const THRESHOLD_PX = 64;

export function useProfileSwipe() {
  const { view, setView } = useProfile();
  const start = useRef<{ x: number; y: number; ignore: boolean } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    start.current = {
      x: event.clientX,
      y: event.clientY,
      ignore: ignoreProfileSwipeTarget(event.target),
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
      setView(cycleView(viewRef.current, dx < 0 ? 1 : -1));
    },
    [setView],
  );

  const onPointerCancel = useCallback(() => {
    start.current = null;
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel };
}
