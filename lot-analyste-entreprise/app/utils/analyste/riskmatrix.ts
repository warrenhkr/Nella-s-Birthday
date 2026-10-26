import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

/** Matrice des risques : probabilité (1 à 3) × impact (1 à 3). */
export interface Risk {
  id: number
  text: string
  p: 1 | 2 | 3
  i: 1 | 2 | 3
  why: string
}

export const RISKS: Risk[] = [
  { id: 1, text: 'Retard d’un fournisseur secondaire', p: 3, i: 1, why: 'Fréquent, mais un fournisseur secondaire se remplace facilement : impact faible.' },
  { id: 2, text: 'Panne du site pendant les soldes', p: 2, i: 3, why: 'Une panne arrive de temps en temps, et en période de soldes elle coûte très cher.' },
  { id: 3, text: 'Départ du seul développeur du projet', p: 1, i: 3, why: 'Rare, mais personne d’autre ne connaît le code : impact très élevé.' },
  { id: 4, text: 'Fuite de données clients', p: 1, i: 3, why: 'Peu probable avec de bonnes protections, mais très grave (loi, confiance, amendes).' },
  { id: 5, text: 'Erreur de saisie d’un prix sur le site', p: 3, i: 2, why: 'Les erreurs humaines sont fréquentes ; un mauvais prix coûte de l’argent sans mettre l’entreprise en danger.' },
  { id: 6, text: 'Mauvais temps le jour d’un événement en intérieur', p: 2, i: 1, why: 'Possible, mais sans effet réel sur un événement en intérieur.' },
  { id: 7, text: 'Hausse de 30 % du prix d’une matière première', p: 3, i: 3, why: 'Les prix bougent souvent et une telle hausse pèse lourd sur les marges.' },
  { id: 8, text: 'Panne de l’imprimante de bureau', p: 3, i: 1, why: 'Arrive souvent, se contourne en quelques minutes.' },
  { id: 9, text: 'Un client très important cesse de commander', p: 2, i: 3, why: 'Cela arrive ; si ce client pèse une grosse part du chiffre d’affaires, l’impact est élevé.' },
  { id: 10, text: 'Attaque par rançongiciel', p: 1, i: 3, why: 'Peu fréquente, mais elle peut bloquer toute l’activité.' },
  { id: 11, text: 'Absence d’un employé pour maladie', p: 3, i: 2, why: 'Très courant ; une absence gêne l’équipe sans arrêter l’activité.' },
  { id: 12, text: 'Retard d’une validation interne', p: 2, i: 2, why: 'Occasionnel, avec un effet modéré sur le calendrier.' },
]

/** 2 points si la case est exacte, 1 point si on se trompe d'un cran sur un seul axe, sinon 0. */
export function scorePlacement(risk: Pick<Risk, 'p' | 'i'>, placed: { p: number; i: number }): number {
  const d = Math.abs(risk.p - placed.p) + Math.abs(risk.i - placed.i)
  return d === 0 ? 2 : d === 1 ? 1 : 0
}

export function drawRisks(count: number, rng: Rng): Risk[] {
  return shuffle(RISKS, rng).slice(0, count)
}

/** Niveau de risque d'une case : faible, moyen ou élevé. */
export function level(p: number, i: number): 'faible' | 'moyen' | 'eleve' {
  const s = p * i
  return s >= 6 ? 'eleve' : s >= 3 ? 'moyen' : 'faible'
}
