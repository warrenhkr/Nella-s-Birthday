import type { AsyncComponentLoader, Component } from 'vue'
import { Calculator, ChartColumn, Database, Eraser, Funnel, Gauge, GitCompareArrows, Grid2x2, ListChecks, Search, ShieldAlert, TrendingUp } from '@lucide/vue'

/**
 * Registre des jeux « Bureau de l'analyste ». Un jeu = une entrée ici + un composant dans components/analyste/jeux/.
 * (À ne pas confondre avec le registre des algorithmes Python, app/data/algos.ts.)
 */
export type AnalysteCategory = 'chiffres' | 'donnees' | 'methodes'

export interface AnalysteGame {
  slug: string
  title: string
  description: string
  category: AnalysteCategory
  /** Compétence travaillée, affichée sur la carte */
  skill: string
  icon: Component
  /** 1 = tranquille, 2 = demande de la réflexion, 3 = costaud */
  difficulty: 1 | 2 | 3
  duration: string
  loader: AsyncComponentLoader
}

export const CATEGORY_LABELS: Record<AnalysteCategory, string> = {
  chiffres: 'Chiffres et indicateurs',
  donnees: 'Données et requêtes',
  methodes: 'Méthodes d’analyse',
}

export const ANALYSTE_GAMES: AnalysteGame[] = [
  { slug: 'seuil-rentabilite', title: 'Seuil de rentabilité', description: 'Trouve la quantité à vendre pour cesser de perdre de l’argent.', category: 'chiffres', skill: 'Analyse financière', icon: Calculator, difficulty: 2, duration: '4 min', loader: () => import('../components/analyste/jeux/SeuilRentabilite.vue') },
  { slug: 'pareto-80-20', title: 'Pareto 80/20', description: 'Repère les rares causes qui expliquent l’essentiel des réclamations.', category: 'chiffres', skill: 'Priorisation', icon: ChartColumn, difficulty: 2, duration: '4 min', loader: () => import('../components/analyste/jeux/Pareto80.vue') },
  { slug: 'bon-indicateur', title: 'Le bon indicateur', description: 'Choisis le KPI qui répond vraiment à la question posée.', category: 'chiffres', skill: 'Indicateurs de performance', icon: Gauge, difficulty: 1, duration: '4 min', loader: () => import('../components/analyste/jeux/BonKpi.vue') },
  { slug: 'entonnoir-conversion', title: 'Entonnoir de conversion', description: 'Lis un entonnoir de vente et calcule les taux de passage.', category: 'chiffres', skill: 'Analyse du parcours client', icon: Funnel, difficulty: 2, duration: '4 min', loader: () => import('../components/analyste/jeux/EntonnoirConversion.vue') },
  { slug: 'devine-tendance', title: 'Devine la tendance', description: 'Prévois les ventes du mois suivant à partir de la courbe.', category: 'chiffres', skill: 'Prévision', icon: TrendingUp, difficulty: 2, duration: '4 min', loader: () => import('../components/analyste/jeux/DevineTendance.vue') },
  { slug: 'correlation-causalite', title: 'Corrélation ou causalité ?', description: 'Deux courbes se ressemblent : cause, facteur caché ou coïncidence ?', category: 'chiffres', skill: 'Esprit critique', icon: GitCompareArrows, difficulty: 2, duration: '4 min', loader: () => import('../components/analyste/jeux/CorrelationCausalite.vue') },
  { slug: 'donnees-propres', title: 'Données propres', description: 'Débusque doublons, valeurs manquantes et aberrantes dans un fichier.', category: 'donnees', skill: 'Qualité des données', icon: Eraser, difficulty: 2, duration: '5 min', loader: () => import('../components/analyste/jeux/DonneesPropres.vue') },
  { slug: 'sql-blocs', title: 'SQL en blocs', description: 'Assemble des requêtes SQL pour répondre à des questions métier.', category: 'donnees', skill: 'Requêtes de données', icon: Database, difficulty: 3, duration: '6 min', loader: () => import('../components/analyste/jeux/SqlBlocs.vue') },
  { slug: 'swot-express', title: 'SWOT express', description: 'Classe forces, faiblesses, opportunités et menaces de trois entreprises.', category: 'methodes', skill: 'Diagnostic stratégique', icon: Grid2x2, difficulty: 1, duration: '4 min', loader: () => import('../components/analyste/jeux/SwotExpress.vue') },
  { slug: 'cinq-pourquoi', title: 'Les 5 pourquoi', description: 'Remonte d’un symptôme à la cause racine d’un problème.', category: 'methodes', skill: 'Analyse des causes', icon: Search, difficulty: 2, duration: '5 min', loader: () => import('../components/analyste/jeux/CinqPourquoi.vue') },
  { slug: 'sprint-planning', title: 'Sprint planning', description: 'Choisis les fonctionnalités qui apportent le plus de valeur avec peu de temps.', category: 'methodes', skill: 'Priorisation et gestion de projet', icon: ListChecks, difficulty: 3, duration: '5 min', loader: () => import('../components/analyste/jeux/SprintPlanning.vue') },
  { slug: 'matrice-risques', title: 'Matrice des risques', description: 'Place chaque risque selon sa probabilité et son impact.', category: 'methodes', skill: 'Gestion des risques', icon: ShieldAlert, difficulty: 2, duration: '4 min', loader: () => import('../components/analyste/jeux/MatriceRisques.vue') },
]

export function findAnalysteGame(slug: string): AnalysteGame | undefined {
  return ANALYSTE_GAMES.find((g) => g.slug === slug)
}
