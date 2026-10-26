import type { Rng } from './rng.ts'

/**
 * Taquin n×n. `tiles[i]` = numéro de la tuile en case i (0 = case vide).
 * État résolu : [1, 2, …, n²-1, 0].
 */
export function solvedTiles(n: number): number[] {
  const t: number[] = []
  for (let i = 1; i < n * n; i++) t.push(i)
  t.push(0)
  return t
}

export function isSolved(tiles: readonly number[]): boolean {
  return tiles.every((v, i) => (i === tiles.length - 1 ? v === 0 : v === i + 1))
}

function neighbors(index: number, n: number): number[] {
  const r = Math.floor(index / n)
  const c = index % n
  const out: number[] = []
  if (r > 0) out.push(index - n)
  if (r < n - 1) out.push(index + n)
  if (c > 0) out.push(index - 1)
  if (c < n - 1) out.push(index + 1)
  return out
}

/**
 * Mélange par de vrais coups depuis l'état résolu : le résultat est donc toujours résoluble.
 * On évite de défaire immédiatement le coup précédent, et on recommence si on retombe sur l'état résolu.
 */
export function scrambleTiles(n: number, moves: number, rng: Rng): number[] {
  let tiles = solvedTiles(n)
  let blank = tiles.length - 1
  let previous = -1
  for (let k = 0; k < moves; k++) {
    const options = neighbors(blank, n).filter((i) => i !== previous)
    const next = options[Math.floor(rng() * options.length)]!
    tiles[blank] = tiles[next]!
    tiles[next] = 0
    previous = blank
    blank = next
  }
  if (isSolved(tiles)) tiles = scrambleTiles(n, moves + 7, rng)
  return tiles
}

/**
 * Clic sur la case `index` : si elle est dans la ligne ou la colonne de la case vide, toutes les
 * tuiles entre les deux glissent d'un cran. Renvoie le nouvel état et le nombre de tuiles déplacées,
 * ou null si le coup est impossible.
 */
export function slide(tiles: readonly number[], n: number, index: number): { tiles: number[]; moved: number } | null {
  const blank = tiles.indexOf(0)
  if (index === blank) return null
  const br = Math.floor(blank / n)
  const bc = blank % n
  const ir = Math.floor(index / n)
  const ic = index % n
  if (br !== ir && bc !== ic) return null
  const out = tiles.slice()
  const step = br === ir ? (ic > bc ? 1 : -1) : ir > br ? n : -n
  let moved = 0
  let cur = blank
  while (cur !== index) {
    out[cur] = out[cur + step]!
    cur += step
    moved++
  }
  out[index] = 0
  return { tiles: out, moved }
}

/** Parité : un taquin est résoluble si le nombre d'inversions (et la ligne du vide) ont la bonne parité. */
export function isSolvable(tiles: readonly number[], n: number): boolean {
  const flat = tiles.filter((v) => v !== 0)
  let inversions = 0
  for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) if (flat[i]! > flat[j]!) inversions++
  if (n % 2 === 1) return inversions % 2 === 0
  const blankRowFromBottom = n - Math.floor(tiles.indexOf(0) / n)
  return blankRowFromBottom % 2 === 0 ? inversions % 2 === 1 : inversions % 2 === 0
}
