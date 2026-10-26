/** Logique du « Gâteau à étages » : un étage mobile tombe sur l'étage précédent, ce qui dépasse est coupé. */
export interface Layer {
  x: number
  w: number
}

export interface DropResult {
  layer: Layer
  /** Alignement quasi parfait : la largeur est conservée. */
  perfect: boolean
  /** Partie coupée (à faire tomber visuellement). */
  cut: Layer | null
}

/**
 * Pose `current` sur `previous`. Renvoie null s'il n'y a aucun recouvrement (partie perdue).
 * `tolerance` : écart en unités en dessous duquel l'étage est considéré parfaitement posé.
 */
export function dropLayer(previous: Layer, current: Layer, tolerance = 3): DropResult | null {
  const left = Math.max(previous.x, current.x)
  const right = Math.min(previous.x + previous.w, current.x + current.w)
  const overlap = right - left
  if (overlap <= 0) return null
  if (Math.abs(current.x - previous.x) <= tolerance) {
    return { layer: { x: previous.x, w: previous.w }, perfect: true, cut: null }
  }
  const layer = { x: left, w: overlap }
  let cut: Layer
  if (current.x < previous.x) cut = { x: current.x, w: previous.x - current.x }
  else cut = { x: previous.x + previous.w, w: current.x + current.w - (previous.x + previous.w) }
  return { layer, perfect: false, cut }
}

/** Position d'un étage qui fait des allers-retours entre 0 et max - w, à partir du temps écoulé. */
export function oscillate(elapsedMs: number, speed: number, w: number, max: number): number {
  const range = Math.max(1, max - w)
  const dist = (elapsedMs / 1000) * speed
  const m = dist % (2 * range)
  return m <= range ? m : 2 * range - m
}
