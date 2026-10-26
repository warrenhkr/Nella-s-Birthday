import type { Rng } from './rng.ts'

/**
 * « Allume le gâteau » : un Lights Out. Appuyer sur une bougie inverse son état et celui de ses
 * quatre voisines. But : toutes les bougies allumées. `lit[i]` = bougie i allumée.
 */
export function press(lit: readonly boolean[], n: number, index: number): boolean[] {
  const out = lit.slice()
  const r = Math.floor(index / n)
  const c = index % n
  const flip = (rr: number, cc: number) => {
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) out[rr * n + cc] = !out[rr * n + cc]
  }
  flip(r, c)
  flip(r - 1, c)
  flip(r + 1, c)
  flip(r, c - 1)
  flip(r, c + 1)
  return out
}

/** Grille de départ : tout allumé, puis `presses` appuis aléatoires. Toujours résoluble. */
export function scramble(n: number, presses: number, rng: Rng): boolean[] {
  let lit: boolean[] = new Array(n * n).fill(true)
  for (let k = 0; k < presses; k++) lit = press(lit, n, Math.floor(rng() * n * n))
  if (lit.every(Boolean)) lit = press(lit, n, Math.floor(rng() * n * n))
  return lit
}

/**
 * Cherche un ensemble d'appuis qui allume tout (élimination de Gauss sur GF(2)).
 * Renvoie la liste des indices à presser (une solution minimale parmi celles trouvées), ou null.
 */
export function solve(lit: readonly boolean[], n: number): number[] | null {
  const size = n * n
  // matrice augmentée : colonne j = effet d'un appui en j ; dernière colonne = cases à inverser
  const m: number[][] = []
  for (let i = 0; i < size; i++) {
    const row = new Array(size + 1).fill(0) as number[]
    const press1 = press(new Array(size).fill(false), n, i) // appui en i
    for (let j = 0; j < size; j++) row[j] = press1[j] ? 1 : 0
    row[size] = lit[i] ? 0 : 1
    m.push(row)
  }
  // la matrice est symétrique : ligne i = colonne i, donc m[i][j] = effet de l'appui j sur la case i
  const pivots: number[] = []
  let r = 0
  for (let c = 0; c < size && r < size; c++) {
    let p = -1
    for (let i = r; i < size; i++) if (m[i]![c] === 1) { p = i; break }
    if (p < 0) continue
    const tmp = m[r]!
    m[r] = m[p]!
    m[p] = tmp
    for (let i = 0; i < size; i++) {
      if (i !== r && m[i]![c] === 1) for (let k = c; k <= size; k++) m[i]![k] = (m[i]![k]! ^ m[r]![k]!) as number
    }
    pivots.push(c)
    r++
  }
  for (let i = r; i < size; i++) if (m[i]![size] === 1) return null
  const x = new Array(size).fill(0) as number[]
  pivots.forEach((c, i) => { x[c] = m[i]![size]! })
  const result: number[] = []
  x.forEach((v, i) => { if (v === 1) result.push(i) })
  return result
}
