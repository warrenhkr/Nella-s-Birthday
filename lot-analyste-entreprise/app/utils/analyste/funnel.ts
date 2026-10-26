import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

export const STEPS = ['Visiteurs', 'Fiches produit vues', 'Ajouts au panier', 'Paiements commencés', 'Commandes validées']

export function makeFunnel(rng: Rng): number[] {
  const counts = [20000 + Math.floor(rng() * 80000)]
  const keep = [0.35 + rng() * 0.3, 0.12 + rng() * 0.3, 0.4 + rng() * 0.35, 0.65 + rng() * 0.3]
  for (const k of keep) counts.push(Math.max(1, Math.round(counts[counts.length - 1]! * k)))
  return counts
}

export const rate = (counts: readonly number[], i: number) => (100 * counts[i + 1]!) / counts[i]!

/** Indice de l'étape de passage où l'on perd la plus grande proportion de visiteurs. */
export function worstTransition(counts: readonly number[]): number {
  let worst = 0
  for (let i = 1; i < counts.length - 1; i++) if (rate(counts, i) < rate(counts, worst)) worst = i
  return worst
}

export interface FunnelQuestion {
  prompt: string
  options: string[]
  answer: string
  why: string
}

const pct = (v: number) => v.toFixed(1).replace('.', ',') + ' %'
const nb = (v: number) => v.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')

function distinct(correct: string, candidates: string[], rng: Rng): string[] {
  const set = new Set<string>([correct])
  for (const c of shuffle(candidates, rng)) if (set.size < 4) set.add(c)
  let bump = 1
  while (set.size < 4) set.add(correct + ' ' + '+'.repeat(bump++)) // garde-fou : ne devrait jamais servir
  return shuffle([...set], rng)
}

/** Six questions de lecture d'entonnoir, avec une seule bonne réponse chacune. */
export function makeQuestions(counts: readonly number[], rng: Rng): FunnelQuestion[] {
  const out: FunnelQuestion[] = []
  const transitions = shuffle([0, 1, 2, 3], rng)
  for (const i of transitions.slice(0, 3)) {
    const r = rate(counts, i)
    const correct = pct(r)
    const options = distinct(correct, [pct(100 - r), pct(rate(counts, (i + 1) % 4)), pct(r / 2), pct(Math.min(99.9, r * 1.6)), pct((100 * counts[i + 1]!) / counts[0]!)], rng)
    out.push({
      prompt: 'Quel est le taux de passage entre « ' + STEPS[i] + ' » et « ' + STEPS[i + 1] + ' » ?',
      options, answer: correct,
      why: nb(counts[i + 1]!) + ' ÷ ' + nb(counts[i]!) + ' = ' + correct + '. On divise toujours par l’étape de départ.',
    })
  }
  const worst = worstTransition(counts)
  const labels = [0, 1, 2, 3].map((i) => STEPS[i] + ' → ' + STEPS[i + 1])
  out.push({
    prompt: 'À quel passage perd-on la plus grande part des visiteurs ?',
    options: shuffle(labels, rng), answer: labels[worst]!,
    why: 'Ce passage garde seulement ' + pct(rate(counts, worst)) + ' des visiteurs : c’est le plus faible taux de l’entonnoir.',
  })
  const overall = (100 * counts[4]!) / counts[0]!
  const correctOverall = pct(overall)
  out.push({
    prompt: 'Quel est le taux de conversion global (des visiteurs aux commandes validées) ?',
    options: distinct(correctOverall, [pct(rate(counts, 3)), pct(overall * 10), pct(overall / 2), pct(100 - overall), pct((100 * counts[2]!) / counts[0]!)], rng),
    answer: correctOverall,
    why: nb(counts[4]!) + ' ÷ ' + nb(counts[0]!) + ' = ' + correctOverall + '. Le taux global est le produit des taux de chaque étape.',
  })
  const lost = counts[1]! - counts[2]!
  const correctLost = nb(lost)
  out.push({
    prompt: 'Combien de visiteurs sont perdus entre « ' + STEPS[1] + ' » et « ' + STEPS[2] + ' » ?',
    options: distinct(correctLost, [nb(counts[2]!), nb(counts[1]!), nb(lost + Math.round(counts[1]! * 0.1)), nb(Math.max(1, lost - Math.round(counts[1]! * 0.1)))], rng),
    answer: correctLost,
    why: nb(counts[1]!) + ' − ' + nb(counts[2]!) + ' = ' + correctLost + ' visiteurs perdus.',
  })
  return out
}
