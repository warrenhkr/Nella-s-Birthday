import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

export interface KpiQuestion {
  situation: string
  answer: string
  wrong: [string, string, string]
  why: string
}

export const KPI_QUESTIONS: KpiQuestion[] = [
  { situation: 'La directrice veut savoir si les clients reviennent après un premier achat.', answer: 'Taux de rachat', wrong: ['Nombre total de visiteurs', 'Nombre de mentions « j’aime »', 'Chiffre d’affaires du mois'], why: 'Le taux de rachat est la part des clients qui achètent au moins deux fois : il mesure directement la fidélité. Les visiteurs et les « j’aime » mesurent l’audience, pas le retour des clients.' },
  { situation: 'On veut savoir si une campagne publicitaire rapporte plus qu’elle ne coûte.', answer: 'Retour sur investissement publicitaire (recettes ÷ dépense)', wrong: ['Nombre d’impressions de la publicité', 'Nombre de clics', 'Nombre d’abonnés gagnés'], why: 'Impressions, clics et abonnés sont des « métriques de vanité » : ils flattent mais ne disent pas si l’argent dépensé revient. Le retour sur investissement compare ce qui rentre à ce qui sort.' },
  { situation: 'Le service client veut mesurer sa rapidité de réaction.', answer: 'Délai médian de première réponse', wrong: ['Nombre de conseillers', 'Nombre de tickets reçus', 'Nombre d’heures d’ouverture'], why: 'Le délai de première réponse mesure ce que le client vit. On préfère la médiane à la moyenne : quelques cas très longs ne la faussent pas.' },
  { situation: 'Une application par abonnement veut mesurer la perte de ses clients.', answer: 'Taux de désabonnement (churn)', wrong: ['Nombre de téléchargements', 'Prix de l’abonnement', 'Note moyenne dans les magasins d’applications'], why: 'Le churn est la part des abonnés qui partent sur une période. Il révèle un problème de fond que la croissance des téléchargements peut cacher.' },
  { situation: 'Le gérant veut savoir si un produit est vraiment rentable.', answer: 'Marge brute en pourcentage', wrong: ['Chiffre d’affaires du produit', 'Nombre d’unités vendues', 'Nombre d’avis clients'], why: 'Un produit peut beaucoup se vendre et rapporter peu : la marge brute (prix moins coût direct) dit ce qu’il laisse réellement.' },
  { situation: 'On veut savoir si le site transforme bien ses visiteurs en acheteurs.', answer: 'Taux de conversion', wrong: ['Nombre de pages vues', 'Durée de chargement de la page d’accueil', 'Nombre de visiteurs uniques'], why: 'Le taux de conversion rapporte le nombre de commandes au nombre de visiteurs : c’est le résultat de tout le parcours d’achat.' },
  { situation: 'Une marque veut savoir si ses clients la recommanderaient.', answer: 'Net Promoter Score (NPS)', wrong: ['Nombre d’employés', 'Part de marché', 'Montant du panier moyen'], why: 'Le NPS vient d’une question simple : « recommanderiez-vous… ? » ; il mesure la satisfaction et le bouche-à-oreille.' },
  { situation: 'La responsable marketing veut connaître le prix payé pour gagner un nouveau client.', answer: 'Coût d’acquisition client (CAC)', wrong: ['Panier moyen', 'Taux de rebond', 'Marge brute'], why: 'Le CAC = dépenses marketing et commerciales ÷ nouveaux clients. Il se compare à la valeur qu’un client rapportera.' },
  { situation: 'Un entrepôt veut mesurer la fiabilité de ses livraisons.', answer: 'Taux de livraison à l’heure', wrong: ['Nombre de colis expédiés', 'Surface de l’entrepôt', 'Coût du carburant'], why: 'Le nombre de colis mesure l’activité, pas la qualité. Le taux de livraison à l’heure dit si la promesse faite au client est tenue.' },
  { situation: 'On veut estimer ce qu’un client rapportera pendant toute sa relation avec l’entreprise.', answer: 'Valeur vie client (CLV)', wrong: ['Chiffre d’affaires de la semaine', 'Nombre de visites du site', 'Taux de clics sur un e-mail'], why: 'La valeur vie client additionne les marges attendues d’un client sur la durée. Elle justifie jusqu’où on peut payer pour l’acquérir.' },
]

export interface KpiDraw {
  situation: string
  options: string[]
  answer: string
  why: string
}

export function drawKpi(count: number, rng: Rng): KpiDraw[] {
  return shuffle(KPI_QUESTIONS, rng)
    .slice(0, count)
    .map((q) => ({ situation: q.situation, answer: q.answer, why: q.why, options: shuffle([q.answer, ...q.wrong], rng) }))
}
