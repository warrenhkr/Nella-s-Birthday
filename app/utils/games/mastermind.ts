import type { Rng } from './rng.ts'

export interface Feedback {
  /** Bon symbole à la bonne place */
  exact: number
  /** Bon symbole mais à une autre place */
  misplaced: number
}

export function makeSecret(length: number, symbols: number, rng: Rng): number[] {
  return Array.from({ length }, () => Math.floor(rng() * symbols))
}

/** Évalue une proposition (les doublons sont gérés comme au Mastermind classique). */
export function score(secret: readonly number[], guess: readonly number[]): Feedback {
  let exact = 0
  const sLeft = new Map<number, number>()
  const gLeft = new Map<number, number>()
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === guess[i]) exact++
    else {
      sLeft.set(secret[i]!, (sLeft.get(secret[i]!) ?? 0) + 1)
      gLeft.set(guess[i]!, (gLeft.get(guess[i]!) ?? 0) + 1)
    }
  }
  let misplaced = 0
  for (const [sym, n] of gLeft) misplaced += Math.min(n, sLeft.get(sym) ?? 0)
  return { exact, misplaced }
}
