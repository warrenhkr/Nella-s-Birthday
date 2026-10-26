import type { Rng } from './rng.ts'

export interface Balloon {
  n: number
  /** Position du centre en pourcentage du plateau (0-100). */
  x: number
  y: number
  hue: number
}

/** Place `count` ballons numérotés de 1 à count, sans chevauchement (distance minimale en %). */
export function placeBalloons(count: number, rng: Rng, minDist = 14): Balloon[] {
  const out: Balloon[] = []
  let dist = minDist
  let attempts = 0
  while (out.length < count) {
    const x = 9 + rng() * 82
    const y = 10 + rng() * 78
    // les ballons sont plus hauts que larges : on étire un peu la distance verticale
    if (out.every(b => Math.hypot(b.x - x, (b.y - y) * 1.1) >= dist)) {
      out.push({ n: out.length + 1, x, y, hue: Math.floor(rng() * 360) })
    }
    if (++attempts > 400) {
      dist *= 0.9 // trop serré : on relâche un peu la contrainte
      attempts = 0
    }
  }
  // les numéros sont attribués dans un ordre aléatoire de position : on mélange les numéros
  const nums = out.map(b => b.n)
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = nums[i]!
    nums[i] = nums[j]!
    nums[j] = t
  }
  return out.map((b, i) => ({ ...b, n: nums[i]! }))
}
