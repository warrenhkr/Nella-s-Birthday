import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

export type Link = 'cause' | 'cache' | 'hasard'

export const LINK_LABEL: Record<Link, string> = {
  cause: 'Lien de cause à effet probable',
  cache: 'Facteur caché commun',
  hasard: 'Pure coïncidence',
}

export interface Scenario {
  text: string
  answer: Link
  why: string
}

export const SCENARIOS: Scenario[] = [
  { text: 'Les semaines où une boutique de plage vend plus de parasols, elle vend aussi plus de glaces.', answer: 'cache', why: 'Ni les parasols ne font acheter des glaces, ni l’inverse : le beau temps (la chaleur) fait augmenter les deux.' },
  { text: 'Les jours de forte pluie, les commandes de repas livrés à domicile augmentent.', answer: 'cause', why: 'La pluie donne envie de rester chez soi : le mécanisme est direct et plausible.' },
  { text: 'Dans les villes où il y a plus de pompiers, il y a aussi plus d’incendies graves.', answer: 'cache', why: 'La taille de la ville joue sur les deux : une grande ville a davantage de pompiers et davantage d’incendies.' },
  { text: 'Pendant cinq ans, les ventes de vélos d’une ville ont suivi presque exactement la courbe du nombre de pigeons du parc.', answer: 'hasard', why: 'Aucun lien imaginable : avec assez de séries de chiffres, certaines se ressemblent par hasard.' },
  { text: 'Les clients qui ont une carte de fidélité dépensent deux fois plus que les autres.', answer: 'cache', why: 'Ceux qui prennent la carte sont déjà de gros acheteurs : c’est leur engagement qui explique les deux faits.' },
  { text: 'Un site supprime l’obligation de créer un compte : sur la même période, avec un test A/B, la conversion du groupe test passe de 2 % à 3 %.', answer: 'cause', why: 'Une expérience contrôlée (deux groupes tirés au hasard) est la meilleure façon de prouver une cause.' },
  { text: 'Les étudiants qui prennent un petit-déjeuner ont en moyenne de meilleures notes.', answer: 'cache', why: 'Le sommeil, l’organisation et le mode de vie influencent à la fois le petit-déjeuner et les notes.' },
  { text: 'Les mois où l’on vend plus de manteaux, on compte aussi plus de rhumes.', answer: 'cache', why: 'L’hiver et le froid font vendre des manteaux et favorisent les rhumes : les manteaux ne donnent pas de rhume.' },
  { text: 'Sur trois ans, le chiffre d’affaires d’une librairie varie comme la hauteur de neige à Oslo.', answer: 'hasard', why: 'Deux courbes sans rapport peuvent se ressembler : une corrélation sans mécanisme possible est suspecte.' },
  { text: 'Chaque fois que le site tombe en panne, le nombre d’appels au service client augmente le jour même.', answer: 'cause', why: 'Les clients bloqués appellent : le lien est direct et le délai est cohérent.' },
  { text: 'Sur six ans, le nombre d’inscriptions à un club d’échecs suit presque celui des glaciers ouverts dans le pays.', answer: 'hasard', why: 'Deux chiffres qui augmentent lentement ensemble se ressemblent presque toujours, sans rien avoir à faire l’un avec l’autre.' },
]

export function drawScenarios(count: number, rng: Rng): Scenario[] {
  return shuffle(SCENARIOS, rng).slice(0, count)
}
