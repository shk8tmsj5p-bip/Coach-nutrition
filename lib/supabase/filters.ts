import type { ProfileId, ViewMode } from "@/lib/types";

/** Le sélecteur UI filtre les lignes ; un seul compte Auth voit tout. */
export function profileIdsForView(view: ViewMode): ProfileId[] {
  return view === "couple" ? ["alexis", "elodie"] : [view];
}
