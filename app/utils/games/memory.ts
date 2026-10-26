import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

/** Un jeu de cartes de memory : chaque identifiant de 0 à pairs-1 apparaît exactement deux fois, dans un ordre mélangé. */
export function buildDeck(pairs: number, rng: Rng): number[] {
  const ids: number[] = []
  for (let i = 0; i < pairs; i++) ids.push(i, i)
  return shuffle(ids, rng)
}

export type MemoryDifficulty = { key: string, label: string, cols: number, rows: number }

export const MEMORY_LEVELS: MemoryDifficulty[] = [
  { key: 'facile', label: 'Facile · 12 cartes', cols: 3, rows: 4 },
  { key: 'moyen', label: 'Moyen · 16 cartes', cols: 4, rows: 4 },
  { key: 'difficile', label: 'Difficile · 20 cartes', cols: 4, rows: 5 }
]
