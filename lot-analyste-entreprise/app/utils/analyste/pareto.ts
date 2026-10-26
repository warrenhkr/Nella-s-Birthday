import type { Rng } from './rng.ts'

/** Pareto : quelques causes expliquent la majorité des problèmes. */
export interface Cause {
  name: string
  count: number
}

const POOL = [
  'Retard de livraison', 'Produit abîmé', 'Erreur de commande', 'Prix affiché faux', 'Service client lent', 'Site en panne',
  'Remboursement tardif', 'Emballage inadapté', 'Facture incorrecte', 'Article indisponible', 'Notice absente', 'Appel non rappelé',
]

/** Nombre minimal de premières causes (les plus fréquentes) dont le cumul atteint le seuil (en %). */
export function vitalFewCount(counts: readonly number[], thresholdPct: number): number {
  const sorted = counts.slice().sort((a, b) => b - a)
  const total = sorted.reduce((s, c) => s + c, 0)
  let acc = 0
  for (let i = 0; i < sorted.length; i++) {
    acc += sorted[i]!
    if ((100 * acc) / total >= thresholdPct - 1e-9) return i + 1
  }
  return sorted.length
}

/** Causes triées par effectif décroissant, sans égalité (le classement est donc sans ambiguïté). */
export function makeCauses(n: number, skew: number, rng: Rng): Cause[] {
  const names = POOL.slice().sort(() => rng() - 0.5).slice(0, n)
  const weights = names.map((_, i) => Math.pow(i + 1, -skew) * (0.85 + rng() * 0.3))
  const sum = weights.reduce((s, w) => s + w, 0)
  const counts = weights.map((w) => Math.max(1, Math.round((w / sum) * 400)))
  // on force une suite strictement décroissante
  for (let i = 1; i < counts.length; i++) if (counts[i]! >= counts[i - 1]!) counts[i] = counts[i - 1]! - 1
  return names.map((name, i) => ({ name, count: Math.max(1, counts[i]!) }))
}

export function cumulativePct(causes: readonly Cause[]): number[] {
  const total = causes.reduce((s, c) => s + c.count, 0)
  let acc = 0
  return causes.map((c) => ((acc += c.count), (100 * acc) / total))
}
