export const APP_TAB_HREFS = ["/", "/repas", "/suivi", "/metabolique", "/parametres"] as const;

export type AppTabHref = (typeof APP_TAB_HREFS)[number];

export function tabHrefFromPath(pathname: string): AppTabHref {
  const hit = APP_TAB_HREFS.find((href) => href !== "/" && pathname.startsWith(href));
  return hit ?? "/";
}

/** Swipe gauche (dir +1) = onglet suivant. Swipe droite (dir −1) = précédent. */
export function cycleTabHref(pathname: string, dir: -1 | 1): AppTabHref {
  const current = tabHrefFromPath(pathname);
  const index = APP_TAB_HREFS.indexOf(current);
  const from = index < 0 ? 0 : index;
  return APP_TAB_HREFS[(from + dir + APP_TAB_HREFS.length) % APP_TAB_HREFS.length];
}

/** Repas + Réglages : toujours le foyer (Alexis + Élodie). */
export function isHouseholdTab(pathname: string) {
  const href = tabHrefFromPath(pathname);
  return href === "/repas" || href === "/parametres";
}

/** Aujourd’hui / Suivi / Métabo : le sélecteur Alexis | Élodie s’applique. */
export function isFocusTab(pathname: string) {
  return !isHouseholdTab(pathname);
}

export function ignoreTabSwipeTarget(target: EventTarget | null) {
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
