import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

/** Requêtes SQL à reconstituer en assemblant des blocs dans le bon ordre. */
export interface SqlQuestion {
  prompt: string
  schema: string[]
  blocks: string[]
  distractors: string[]
  why: string
}

export const SQL_QUESTIONS: SqlQuestion[] = [
  {
    prompt: 'Afficher les noms des clients qui habitent à Lyon.',
    schema: ['clients (id, nom, ville)'],
    blocks: ['SELECT nom', 'FROM clients', "WHERE ville = 'Lyon'"],
    distractors: ['WHERE ville = Lyon', 'GROUP BY ville'],
    why: 'SELECT choisit les colonnes, FROM indique la table, WHERE filtre les lignes. Un texte se met entre apostrophes.',
  },
  {
    prompt: 'Compter combien il y a de commandes.',
    schema: ['commandes (id, client_id, produit, montant, statut, date)'],
    blocks: ['SELECT COUNT(*)', 'FROM commandes'],
    distractors: ['SELECT SUM(*)', 'WHERE COUNT(*)'],
    why: 'COUNT(*) compte les lignes. SUM additionne les valeurs d’une colonne : SUM(*) n’a pas de sens.',
  },
  {
    prompt: 'Calculer le total des ventes pour chaque produit.',
    schema: ['commandes (id, client_id, produit, montant, statut, date)'],
    blocks: ['SELECT produit, SUM(montant)', 'FROM commandes', 'GROUP BY produit'],
    distractors: ['ORDER BY montant', 'WHERE SUM(montant)'],
    why: 'GROUP BY regroupe les lignes par produit, et SUM calcule un total pour chaque groupe.',
  },
  {
    prompt: 'Trouver les 3 clients qui ont le plus dépensé.',
    schema: ['commandes (id, client_id, produit, montant, statut, date)'],
    blocks: ['SELECT client_id, SUM(montant) AS total', 'FROM commandes', 'GROUP BY client_id', 'ORDER BY total DESC', 'LIMIT 3'],
    distractors: ['ORDER BY total ASC', 'WHERE LIMIT 3'],
    why: 'On regroupe par client, on trie du plus grand au plus petit (DESC), puis LIMIT garde les 3 premiers.',
  },
  {
    prompt: 'Lister les commandes de plus de 100 € qui sont payées.',
    schema: ['commandes (id, client_id, produit, montant, statut, date)'],
    blocks: ['SELECT *', 'FROM commandes', 'WHERE montant > 100', "AND statut = 'payée'"],
    distractors: ["OR statut = 'payée'", 'HAVING montant > 100'],
    why: 'AND exige que les deux conditions soient vraies. OR garderait aussi les commandes payées de moins de 100 €.',
  },
  {
    prompt: 'Calculer le montant moyen des commandes payées.',
    schema: ['commandes (id, client_id, produit, montant, statut, date)'],
    blocks: ['SELECT AVG(montant)', 'FROM commandes', "WHERE statut = 'payée'"],
    distractors: ['SELECT AVERAGE(montant)', 'GROUP BY montant'],
    why: 'La fonction de moyenne s’appelle AVG. WHERE filtre avant le calcul : seules les commandes payées comptent.',
  },
  {
    prompt: 'Trouver les produits dont le total des ventes dépasse 1 000 €.',
    schema: ['commandes (id, client_id, produit, montant, statut, date)'],
    blocks: ['SELECT produit, SUM(montant)', 'FROM commandes', 'GROUP BY produit', 'HAVING SUM(montant) > 1000'],
    distractors: ['WHERE SUM(montant) > 1000', 'ORDER BY produit'],
    why: 'WHERE filtre les lignes avant le regroupement ; HAVING filtre les groupes après un calcul comme SUM.',
  },
  {
    prompt: 'Afficher le nom de chaque client avec le montant de ses commandes.',
    schema: ['clients (id, nom, ville)', 'commandes (id, client_id, montant)'],
    blocks: ['SELECT clients.nom, commandes.montant', 'FROM clients', 'JOIN commandes ON clients.id = commandes.client_id'],
    distractors: ['JOIN commandes ON clients.id = commandes.id', 'WHERE clients.nom'],
    why: 'Une jointure relie deux tables par une clé : l’identifiant du client (clients.id) correspond à commandes.client_id.',
  },
  {
    prompt: 'Afficher les 5 commandes les plus récentes.',
    schema: ['commandes (id, client_id, produit, montant, statut, date)'],
    blocks: ['SELECT *', 'FROM commandes', 'ORDER BY date DESC', 'LIMIT 5'],
    distractors: ['ORDER BY date ASC', 'GROUP BY date'],
    why: 'DESC trie du plus récent au plus ancien ; LIMIT 5 garde les cinq premières lignes.',
  },
]

export interface SqlDraw {
  prompt: string
  schema: string[]
  pool: string[]
  answer: string[]
  why: string
}

export function drawSql(count: number, rng: Rng): SqlDraw[] {
  return shuffle(SQL_QUESTIONS, rng)
    .slice(0, count)
    .map((q) => ({ prompt: q.prompt, schema: q.schema, answer: q.blocks, why: q.why, pool: shuffle([...q.blocks, ...q.distractors], rng) }))
}

export function isCorrect(chosen: readonly string[], answer: readonly string[]): boolean {
  return chosen.length === answer.length && chosen.every((b, i) => b === answer[i])
}
