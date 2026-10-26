import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

/** Sprint planning : choisir des fonctionnalités pour le plus de valeur possible dans la capacité du sprint. */
export interface Feature {
  id: number
  name: string
  cost: number
  value: number
}

const NAMES = [
  'Connexion avec un compte', 'Paiement en un clic', 'Recherche de produits', 'Notifications de livraison', 'Mode sombre',
  'Export des factures en PDF', 'Tableau de bord des ventes', 'Avis clients', 'Programme de fidélité', 'Chat de support',
  'Codes promotionnels', 'Suivi de commande', 'Liste de souhaits', 'Recommandations personnalisées',
]

export interface Backlog {
  features: Feature[]
  capacity: number
  optimum: number
}

/** Programmation dynamique du sac à dos : valeur maximale possible sans dépasser la capacité. */
export function knapsack(features: readonly Feature[], capacity: number): { value: number; chosen: number[] } {
  const best: number[][] = Array.from({ length: features.length + 1 }, () => new Array<number>(capacity + 1).fill(0))
  for (let i = 1; i <= features.length; i++) {
    const f = features[i - 1]!
    for (let c = 0; c <= capacity; c++) {
      best[i]![c] = best[i - 1]![c]!
      if (f.cost <= c) best[i]![c] = Math.max(best[i]![c]!, best[i - 1]![c - f.cost]! + f.value)
    }
  }
  const chosen: number[] = []
  let c = capacity
  for (let i = features.length; i >= 1; i--) {
    if (best[i]![c] !== best[i - 1]![c]) {
      chosen.push(features[i - 1]!.id)
      c -= features[i - 1]!.cost
    }
  }
  return { value: best[features.length]![capacity]!, chosen: chosen.reverse() }
}

export function makeBacklog(count: number, rng: Rng): Backlog {
  const names = shuffle(NAMES, rng).slice(0, count)
  const features = names.map((name, id) => {
    const cost = 1 + Math.floor(rng() * 8)
    const value = Math.max(1, Math.min(10, Math.round(cost * (0.6 + rng() * 1.4) + rng() * 3)))
    return { id, name, cost, value }
  })
  const total = features.reduce((s, f) => s + f.cost, 0)
  const capacity = Math.max(6, Math.round(total * 0.45))
  return { features, capacity, optimum: knapsack(features, capacity).value }
}
