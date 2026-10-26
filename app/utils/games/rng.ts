/**
 * Aléatoire reproductible pour les mini-jeux.
 * mulberry32 : petit générateur à graine, suffisant pour mélanger des cartes ou placer des ballons.
 */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Graine aléatoire (à appeler côté client, au début d'une partie). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296)
}

export function makeRng(seed?: number): Rng {
  return mulberry32(seed ?? randomSeed())
}

/** Entier aléatoire entre min et max, bornes incluses. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)] as T
}

/** Mélange de Fisher-Yates : renvoie une nouvelle liste, l'original n'est pas modifié. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i] as T
    out[i] = out[j] as T
    out[j] = tmp
  }
  return out
}

/** Attend ms millisecondes (pour les animations pas à pas). */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
