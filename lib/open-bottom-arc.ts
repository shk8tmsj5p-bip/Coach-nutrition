/** Jauge 270° ouverte en bas : départ bas-gauche, arrivée bas-droite, sans fermer le cercle. */
export function openBottomArc(size: number, stroke: number) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2 - 4;
  const toPt = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const from = toPt(135);
  const to = toPt(45);
  return {
    from,
    to,
    d: `M ${from.x} ${from.y} A ${r} ${r} 0 1 1 ${to.x} ${to.y}`,
    cropH: Math.ceil(to.y + stroke * 0.75),
  };
}
