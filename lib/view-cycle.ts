import type { ViewMode } from "@/lib/types";

export const VIEW_ORDER: ViewMode[] = ["alexis", "elodie", "couple"];

/** Swipe gauche (dir +1) = suivant. Swipe droite (dir −1) = précédent. */
export function cycleView(view: ViewMode, dir: -1 | 1): ViewMode {
  const index = VIEW_ORDER.indexOf(view);
  const from = index < 0 ? 0 : index;
  return VIEW_ORDER[(from + dir + VIEW_ORDER.length) % VIEW_ORDER.length];
}

export function ignoreProfileSwipeTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return true;
  if (target.closest("input, textarea, select, [contenteditable='true']")) return true;
  if (target.closest("nav")) return true;
  let node: Element | null = target;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if (style.position === "fixed") return true;
    if (node.scrollWidth > node.clientWidth + 12) return true;
    node = node.parentElement;
  }
  return false;
}
