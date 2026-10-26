import type { Rng } from './rng.ts'

/** Seuil de rentabilité : combien d'unités vendre pour ne pas perdre d'argent. */
export interface BreakEvenRound {
  name: string
  fixed: number
  price: number
  unitCost: number
}

export function profit(units: number, r: BreakEvenRound): number {
  return units * (r.price - r.unitCost) - r.fixed
}

/** Plus petit nombre entier d'unités qui donne un bénéfice positif ou nul. */
export function breakEvenUnits(r: BreakEvenRound): number {
  return Math.ceil(r.fixed / (r.price - r.unitCost) - 1e-9)
}

const BUSINESSES = [
  'Stand de cupcakes', 'Atelier de t-shirts', 'Café-librairie', 'Livraison à vélo', 'Boutique de bougies',
  'Studio de photo', 'Camion de crêpes', 'Atelier de réparation de téléphones',
]

export function makeRounds(count: number, rng: Rng): BreakEvenRound[] {
  const names = BUSINESSES.slice().sort(() => rng() - 0.5).slice(0, count)
  return names.map((name) => {
    const price = 4 + Math.floor(rng() * 56)
    const margin = 2 + Math.floor(rng() * Math.max(1, Math.floor(price * 0.6)))
    const unitCost = Math.max(1, price - margin)
    const target = 40 + Math.floor(rng() * 360)
    // coûts fixes choisis pour que le seuil tombe autour de `target` unités, arrondis à la dizaine
    const fixed = Math.max(100, Math.round((target * (price - unitCost)) / 10) * 10)
    return { name, fixed, price, unitCost }
  })
}
