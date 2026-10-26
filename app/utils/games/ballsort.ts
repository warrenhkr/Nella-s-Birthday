import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

/** Tri des couleurs : chaque tube est une pile (du fond vers le haut), capacité 4. */
export const CAPACITY = 4
export type Tubes = number[][]

export function canPour(tubes: Tubes, from: number, to: number): boolean {
  if (from === to) return false
  const a = tubes[from]!
  const b = tubes[to]!
  if (a.length === 0 || b.length >= CAPACITY) return false
  const color = a[a.length - 1]!
  if (b.length > 0 && b[b.length - 1] !== color) return false
  // inutile de verser un tube déjà uniforme vers un tube vide
  if (b.length === 0 && a.every(c => c === color)) return false
  return true
}

/** Verse d'un tube à l'autre le plus de billes de même couleur possible. Renvoie un nouvel état ou null. */
export function pour(tubes: Tubes, from: number, to: number): Tubes | null {
  if (!canPour(tubes, from, to)) return null
  const next = tubes.map(t => t.slice())
  const a = next[from]!
  const b = next[to]!
  const color = a[a.length - 1]!
  while (a.length > 0 && a[a.length - 1] === color && b.length < CAPACITY) b.push(a.pop()!)
  return next
}

export function isWon(tubes: Tubes): boolean {
  return tubes.every(t => t.length === 0 || (t.length === CAPACITY && t.every(c => c === t[0])))
}

function key(tubes: Tubes): string {
  return tubes.map(t => t.join('')).sort().join('|')
}

/** Recherche en profondeur d'une suite de coups [de, vers] qui gagne ; null si rien trouvé dans la limite de noeuds. */
export function solve(start: Tubes, maxNodes = 60000): [number, number][] | null {
  const seen = new Set<string>()
  let nodes = 0
  const path: [number, number][] = []
  const go = (tubes: Tubes): boolean => {
    if (isWon(tubes)) return true
    if (++nodes > maxNodes) return false
    const k = key(tubes)
    if (seen.has(k)) return false
    seen.add(k)
    const moves: { from: number, to: number, score: number }[] = []
    for (let i = 0; i < tubes.length; i++) for (let j = 0; j < tubes.length; j++) {
      if (!canPour(tubes, i, j)) continue
      const dest = tubes[j]!
      // on préfère compléter un tube existant plutôt que remplir un tube vide
      moves.push({ from: i, to: j, score: dest.length === 0 ? 0 : 1 + dest.length })
    }
    moves.sort((a, b) => b.score - a.score)
    for (const m of moves) {
      const next = pour(tubes, m.from, m.to)!
      path.push([m.from, m.to])
      if (go(next)) return true
      path.pop()
    }
    return false
  }
  return go(start) ? path.slice() : null
}

/** Nouvelle partie : `colors` couleurs, deux tubes vides en plus. Recommence jusqu'à trouver une grille vérifiée résoluble. */
export function generate(colors: number, rng: Rng): { tubes: Tubes, solution: [number, number][] } {
  for (let attempt = 0; attempt < 200; attempt++) {
    const balls: number[] = []
    for (let c = 0; c < colors; c++) for (let k = 0; k < CAPACITY; k++) balls.push(c)
    const mixed = shuffle(balls, rng)
    const tubes: Tubes = []
    for (let t = 0; t < colors; t++) tubes.push(mixed.slice(t * CAPACITY, (t + 1) * CAPACITY))
    tubes.push([], [])
    if (isWon(tubes)) continue
    const solution = solve(tubes)
    if (solution) return { tubes, solution }
  }
  // repli sûr : grille simple et facile
  const tubes: Tubes = []
  for (let c = 0; c < colors; c++) tubes.push([c, c, c, (c + 1) % colors])
  tubes.push([], [])
  return { tubes, solution: solve(tubes) ?? [] }
}
