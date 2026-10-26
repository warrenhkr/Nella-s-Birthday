import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

export type Rgb = [number, number, number]

export function toHex(rgb: readonly number[]): string {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
}

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  if (!m) return null
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)]
}

/** Précision de 0 à 100 % entre deux couleurs (100 = identiques). */
export function accuracy(a: Rgb, b: Rgb): number {
  const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  return Math.max(0, Math.round((1 - d / (255 * Math.sqrt(3))) * 100))
}

/** Couleur dont les trois canaux sont bien distincts (pour que les permutations soient différentes). */
export function randomColor(rng: Rng): Rgb {
  for (;;) {
    const c: Rgb = [Math.floor(rng() * 256), Math.floor(rng() * 256), Math.floor(rng() * 256)]
    const s = c.slice().sort((x, y) => x - y)
    if (s[1]! - s[0]! >= 50 && s[2]! - s[1]! >= 50) return c
  }
}

const PERMS: [number, number, number][] = [[1, 2, 0], [2, 0, 1], [0, 2, 1], [1, 0, 2], [2, 1, 0]]

/** 4 propositions de code : le bon et trois permutations de ses canaux, mélangées. */
export function choices(target: Rgb, rng: Rng): { options: string[]; answer: string } {
  const answer = toHex(target)
  const others = shuffle(PERMS, rng).slice(0, 3).map((p) => toHex([target[p[0]]!, target[p[1]]!, target[p[2]]!]))
  return { options: shuffle([answer, ...others], rng), answer }
}
