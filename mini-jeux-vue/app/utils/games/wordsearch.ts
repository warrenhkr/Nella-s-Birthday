import type { Rng } from './rng.ts'

export interface Placement {
  word: string
  row: number
  col: number
  dr: number
  dc: number
}

export interface WordSearch {
  size: number
  /** grille[ligne][colonne] : une lettre majuscule */
  grid: string[][]
  placements: Placement[]
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIRS_EASY: [number, number][] = [[0, 1], [1, 0]]
const DIRS_HARD: [number, number][] = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]]

/** Génère une grille de mots mêlés. Les mots les plus longs sont posés en premier ; échoue (null) si un mot ne rentre pas. */
export function generateWordSearch(size: number, words: string[], rng: Rng, hard: boolean): WordSearch | null {
  const dirs = hard ? DIRS_HARD : DIRS_EASY
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(''))
  const placements: Placement[] = []
  const sorted = words.slice().sort((a, b) => b.length - a.length)
  for (const word of sorted) {
    let placed = false
    for (let attempt = 0; attempt < 300 && !placed; attempt++) {
      const [dr, dc] = dirs[Math.floor(rng() * dirs.length)]!
      const row = Math.floor(rng() * size)
      const col = Math.floor(rng() * size)
      const endR = row + dr * (word.length - 1)
      const endC = col + dc * (word.length - 1)
      if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue
      let ok = true
      for (let k = 0; k < word.length && ok; k++) {
        const cell = grid[row + dr * k]![col + dc * k]!
        if (cell !== '' && cell !== word[k]) ok = false
      }
      if (!ok) continue
      for (let k = 0; k < word.length; k++) grid[row + dr * k]![col + dc * k] = word[k]!
      placements.push({ word, row, col, dr, dc })
      placed = true
    }
    if (!placed) return null
  }
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (grid[r]![c] === '') grid[r]![c] = LETTERS[Math.floor(rng() * 26)]!
  return { size, grid, placements }
}

/** Cases d'une ligne droite (horizontale, verticale ou diagonale) entre deux cases ; null si elles ne sont pas alignées. */
export function lineCells(a: [number, number], b: [number, number]): [number, number][] | null {
  const dr = b[0] - a[0]
  const dc = b[1] - a[1]
  if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null
  const len = Math.max(Math.abs(dr), Math.abs(dc))
  const sr = Math.sign(dr)
  const sc = Math.sign(dc)
  const out: [number, number][] = []
  for (let k = 0; k <= len; k++) out.push([a[0] + sr * k, a[1] + sc * k])
  return out
}

/** Mot correspondant à une sélection (dans un sens ou dans l'autre), ou null. */
export function matchSelection(ws: WordSearch, cells: [number, number][], found: ReadonlySet<string>): string | null {
  const text = cells.map(([r, c]) => ws.grid[r]![c]!).join('')
  const reversed = text.split('').reverse().join('')
  for (const p of ws.placements) {
    if (found.has(p.word)) continue
    if (p.word === text || p.word === reversed) return p.word
  }
  return null
}

export function placementCells(p: Placement): [number, number][] {
  return Array.from({ length: p.word.length }, (_, k) => [p.row + p.dr * k, p.col + p.dc * k] as [number, number])
}
