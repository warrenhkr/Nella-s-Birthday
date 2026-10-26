import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

/** Sudoku 4×4 : une grille de 16 cases, valeurs 1 à 4, 0 = vide. Blocs 2×2. */
export type Board = number[]

function allowed(board: readonly number[], index: number, v: number): boolean {
  const r = Math.floor(index / 4)
  const c = index % 4
  for (let k = 0; k < 4; k++) {
    if (board[r * 4 + k] === v && r * 4 + k !== index) return false
    if (board[k * 4 + c] === v && k * 4 + c !== index) return false
  }
  const br = r - (r % 2)
  const bc = c - (c % 2)
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const idx = (br + i) * 4 + bc + j
    if (idx !== index && board[idx] === v) return false
  }
  return true
}

/** Grille complète valide, tirée au hasard (retour en arrière). */
export function generateSolved(rng: Rng): Board {
  const board: Board = new Array(16).fill(0)
  const fill = (i: number): boolean => {
    if (i === 16) return true
    for (const v of shuffle([1, 2, 3, 4], rng)) {
      if (allowed(board, i, v)) {
        board[i] = v
        if (fill(i + 1)) return true
        board[i] = 0
      }
    }
    return false
  }
  fill(0)
  return board
}

/** Nombre de solutions (on s'arrête à `limit`). */
export function countSolutions(start: readonly number[], limit = 2): number {
  const board = start.slice()
  let count = 0
  const go = (): void => {
    if (count >= limit) return
    const i = board.indexOf(0)
    if (i < 0) {
      count++
      return
    }
    for (let v = 1; v <= 4; v++) {
      if (allowed(board, i, v)) {
        board[i] = v
        go()
        board[i] = 0
      }
    }
  }
  go()
  return count
}

/** Puzzle à solution unique avec `holes` cases vides (au mieux : on s'arrête si on ne peut pas en retirer davantage). */
export function makePuzzle(rng: Rng, holes: number): { puzzle: Board, solution: Board } {
  const solution = generateSolved(rng)
  const puzzle = solution.slice()
  let removed = 0
  for (const i of shuffle(Array.from({ length: 16 }, (_, k) => k), rng)) {
    if (removed >= holes) break
    const saved = puzzle[i]!
    puzzle[i] = 0
    if (countSolutions(puzzle) === 1) removed++
    else puzzle[i] = saved
  }
  return { puzzle, solution }
}

/** Indices des cases en conflit (même valeur dans une ligne, colonne ou bloc). */
export function conflicts(board: readonly number[]): Set<number> {
  const bad = new Set<number>()
  board.forEach((v, i) => {
    if (v !== 0 && !allowed(board, i, v)) bad.add(i)
  })
  return bad
}

export function isComplete(board: readonly number[]): boolean {
  return board.every(v => v !== 0) && conflicts(board).size === 0
}
