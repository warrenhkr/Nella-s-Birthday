import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

export type Quadrant = 'S' | 'W' | 'O' | 'T'

export const QUADRANTS: { key: Quadrant; label: string; hint: string }[] = [
  { key: 'S', label: 'Force', hint: 'Interne, positif' },
  { key: 'W', label: 'Faiblesse', hint: 'Interne, négatif' },
  { key: 'O', label: 'Opportunité', hint: 'Externe, positif' },
  { key: 'T', label: 'Menace', hint: 'Externe, négatif' },
]

export interface SwotScenario {
  title: string
  intro: string
  items: { text: string; quad: Quadrant }[]
}

export const SCENARIOS: SwotScenario[] = [
  {
    title: 'Atelier Cannelle, pâtisserie en ligne',
    intro: 'Une petite pâtisserie qui vend des gâteaux et des box cadeaux sur Internet.',
    items: [
      { quad: 'S', text: 'Une recette signature que les concurrents ne peuvent pas copier facilement.' },
      { quad: 'S', text: 'Deux pâtissiers formés depuis plus de dix ans.' },
      { quad: 'S', text: 'Une liste de 4 000 clients abonnés à la newsletter.' },
      { quad: 'W', text: 'Toute la production dépend d’un seul four professionnel.' },
      { quad: 'W', text: 'Aucun suivi des stocks : des ingrédients sont jetés chaque semaine.' },
      { quad: 'W', text: 'Le site met plus de 8 secondes à s’afficher sur mobile.' },
      { quad: 'O', text: 'Les ventes de box cadeaux en ligne augmentent chaque année dans la région.' },
      { quad: 'O', text: 'Une grande entreprise voisine cherche un traiteur pour ses événements.' },
      { quad: 'O', text: 'Un service de livraison local propose des tarifs réduits aux petits commerces.' },
      { quad: 'T', text: 'Le prix du beurre a augmenté de 30 % en un an.' },
      { quad: 'T', text: 'Un concurrent à bas prix ouvre une boutique en ligne le mois prochain.' },
      { quad: 'T', text: 'Une nouvelle règle d’hygiène oblige à refaire l’étiquetage de tous les produits.' },
    ],
  },
  {
    title: 'Trajet+, application de covoiturage étudiant',
    intro: 'Une jeune application qui met en relation des étudiants pour partager leurs trajets.',
    items: [
      { quad: 'S', text: 'Une application notée 4,7 sur 5 par ses premiers utilisateurs.' },
      { quad: 'S', text: 'Un algorithme de mise en relation déjà breveté.' },
      { quad: 'S', text: 'Une équipe qui connaît très bien la vie étudiante.' },
      { quad: 'W', text: 'Un seul développeur maîtrise le code de l’application.' },
      { quad: 'W', text: 'Trésorerie insuffisante pour tenir plus de six mois.' },
      { quad: 'W', text: 'Le service ne fonctionne que dans deux villes.' },
      { quad: 'O', text: 'Le prix de l’essence pousse les étudiants à partager leurs trajets.' },
      { quad: 'O', text: 'Plusieurs universités cherchent un partenaire de mobilité durable.' },
      { quad: 'O', text: 'Les subventions pour les projets écologiques augmentent cette année.' },
      { quad: 'T', text: 'Un géant du covoiturage prépare une offre gratuite pour les étudiants.' },
      { quad: 'T', text: 'Une loi pourrait limiter le partage des frais entre particuliers.' },
      { quad: 'T', text: 'Les magasins d’applications changent leurs règles de commission.' },
    ],
  },
  {
    title: 'Les Pages Vives, librairie de quartier',
    intro: 'Une librairie indépendante installée près d’un lycée et d’un marché.',
    items: [
      { quad: 'S', text: 'Des libraires reconnus pour la qualité de leurs conseils de lecture.' },
      { quad: 'S', text: 'Un emplacement à côté du lycée et du marché.' },
      { quad: 'S', text: 'Un club de lecture de 120 membres fidèles.' },
      { quad: 'W', text: 'Aucun site de vente en ligne.' },
      { quad: 'W', text: 'Un local trop petit pour exposer toutes les nouveautés.' },
      { quad: 'W', text: 'Des horaires limités : la librairie est fermée le soir.' },
      { quad: 'O', text: 'La ville organise un salon du livre dans la rue de la librairie.' },
      { quad: 'O', text: 'Les ventes de livres d’occasion progressent auprès des jeunes.' },
      { quad: 'O', text: 'Une école voisine cherche un fournisseur pour ses manuels.' },
      { quad: 'T', text: 'Des sites en ligne vendent les mêmes livres à prix cassés.' },
      { quad: 'T', text: 'Le loyer des commerces du quartier va augmenter de 20 %.' },
      { quad: 'T', text: 'Les jeunes lisent de plus en plus sur écran.' },
    ],
  },
]

export function drawScenario(rng: Rng, excludeIndex = -1): { index: number; scenario: SwotScenario; cards: { id: number; text: string; quad: Quadrant }[] } {
  const choices = SCENARIOS.map((_, i) => i).filter((i) => i !== excludeIndex)
  const index = choices[Math.floor(rng() * choices.length)]!
  const scenario = SCENARIOS[index]!
  const cards = shuffle(scenario.items.map((it, id) => ({ id, ...it })), rng)
  return { index, scenario, cards }
}
