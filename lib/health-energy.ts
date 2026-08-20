/** Apple Santé « Énergie au repos » : la Somme Raccourcis additionne souvent Watch + iPhone, ou envoie le total du jour (proche TDEE). */

const TDEE_NEAR = 0.12;

export function sanitizeRestingKcal(
  raw: number,
  anchors: { bmr: number; tdee: number },
): { value: number; corrected: boolean } {
  const kcal = Math.max(0, Math.round(raw));
  const bmr = anchors.bmr > 400 ? anchors.bmr : 1600;
  const tdee = anchors.tdee > bmr ? anchors.tdee : Math.round(bmr * 1.55);
  const maxPlausible = Math.round(bmr * 1.2);

  if (kcal <= maxPlausible) return { value: kcal, corrected: false };

  if (tdee > 0 && Math.abs(kcal - tdee) / tdee <= TDEE_NEAR) {
    return { value: Math.round(bmr), corrected: true };
  }

  const half = kcal / 2;
  if (half >= bmr * 0.65 && half <= maxPlausible) {
    return { value: Math.round(half), corrected: true };
  }

  return { value: maxPlausible, corrected: true };
}

/** Dépense du jour : repos (corrigé) + énergie active Watch. */
export function burnedKcalFromHealth(
  movement: { activeEnergyKcal: number; restingEnergyKcal: number },
  anchors: { bmr: number; tdee: number },
) {
  const resting = sanitizeRestingKcal(movement.restingEnergyKcal, anchors).value;
  const active = Math.max(0, Math.round(movement.activeEnergyKcal));
  const hasLive = active > 0 || movement.restingEnergyKcal > 0;
  if (!hasLive) {
    return { burned: Math.round(anchors.tdee), live: false, resting };
  }
  return { burned: resting + active, live: true, resting };
}
