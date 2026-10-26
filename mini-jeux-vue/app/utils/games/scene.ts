/** Scène « salle de fête » : zones cliquables des 8 différences possibles (coordonnées dans le viewBox 400 × 300). */
export const SCENE_W = 400
export const SCENE_H = 300

export interface Difference {
  id: number
  label: string
  cx: number
  cy: number
  r: number
}

export const DIFFERENCES: Difference[] = [
  { id: 0, label: 'Un fanion a changé de couleur', cx: 126, cy: 37, r: 18 },
  { id: 1, label: 'La lune a disparu de la fenêtre', cx: 52, cy: 100, r: 18 },
  { id: 2, label: 'Il manque une bougie', cx: 205, cy: 138, r: 13 },
  { id: 3, label: 'L’assiette a changé de couleur', cx: 162, cy: 206, r: 12 },
  { id: 4, label: 'Un ballon a changé de couleur', cx: 378, cy: 118, r: 20 },
  { id: 5, label: 'Le ruban du cadeau a changé de couleur', cx: 86, cy: 214, r: 14 },
  { id: 6, label: 'L’écran de l’ordinateur est différent', cx: 286, cy: 182, r: 16 },
  { id: 7, label: 'Il manque une feuille à la plante', cx: 381, cy: 217, r: 12 },
]

/** Trouve la différence touchée par le point (x, y), avec une marge de tolérance pour les doigts. */
export function hitDifference(x: number, y: number, candidates: readonly Difference[], slack = 1.35): Difference | null {
  let best: Difference | null = null
  let bestDist = Infinity
  for (const d of candidates) {
    const dist = Math.hypot(x - d.cx, y - d.cy)
    if (dist <= d.r * slack && dist < bestDist) {
      best = d
      bestDist = dist
    }
  }
  return best
}
