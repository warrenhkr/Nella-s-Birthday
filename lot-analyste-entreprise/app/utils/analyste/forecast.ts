import type { Rng } from './rng.ts'

export const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']

export interface Series {
  values: number[] // 11 mois connus
  truth: number // 12e mois à deviner
  trend: number
}

/** Ventes simulées : base + tendance + petite saison + léger bruit. Le 12e mois suit la même loi. */
export function makeSeries(rng: Rng): Series {
  const base = 80 + Math.floor(rng() * 80)
  const trend = (rng() < 0.75 ? 1 : -1) * (2 + rng() * 6)
  const amp = rng() * 12
  const phase = rng() * 12
  const model = (t: number) => base + trend * t + amp * Math.sin((2 * Math.PI * (t + phase)) / 12)
  const values = Array.from({ length: 11 }, (_, t) => Math.round(model(t) + (rng() - 0.5) * 6))
  return { values, truth: Math.round(model(11) + (rng() - 0.5) * 4), trend }
}

/** Droite des moindres carrés sur les mois connus ; renvoie la valeur prolongée au mois `t`. */
export function linearForecast(values: readonly number[], t: number): number {
  const n = values.length
  const tm = (n - 1) / 2
  const ym = values.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  values.forEach((v, i) => {
    num += (i - tm) * (v - ym)
    den += (i - tm) ** 2
  })
  const slope = num / den
  return ym + slope * (t - tm)
}

/** Erreur relative en % entre une estimation et la valeur réelle. */
export function errorPct(guess: number, truth: number): number {
  return (100 * Math.abs(guess - truth)) / Math.abs(truth)
}

/** Points gagnés selon la précision de l'estimation (0 à 10). */
export function pointsFor(err: number): number {
  if (err <= 3) return 10
  if (err <= 6) return 8
  if (err <= 10) return 6
  if (err <= 15) return 3
  if (err <= 25) return 1
  return 0
}
