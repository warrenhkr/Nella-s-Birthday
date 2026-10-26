import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

/** Méthode des « 5 pourquoi » : remonter de proche en proche jusqu'à une cause racine qui permet d'agir. */
export interface Level {
  question: string
  ok: string
  bad: [string, string]
  why: string
}

export interface RootScenario {
  title: string
  problem: string
  levels: [Level, Level, Level, Level]
  root: string
  action: string
}

export const ROOT_SCENARIOS: RootScenario[] = [
  {
    title: 'Colis abîmés',
    problem: 'Chez Atelier Cannelle, 12 % des colis arrivent abîmés chez les clients.',
    levels: [
      { question: 'Pourquoi les colis arrivent-ils abîmés ?', ok: 'Les gâteaux bougent dans le carton pendant le transport.', bad: ['Le transporteur est négligent.', 'Les clients ouvrent mal leurs colis.'], why: 'C’est un constat observable sur les colis ouverts. Accuser quelqu’un ne donne aucune action possible, et l’ouverture arrive après les dégâts.' },
      { question: 'Pourquoi les gâteaux bougent-ils dans le carton ?', ok: 'Le carton est trop grand pour la commande et rien ne cale les produits.', bad: ['Le préparateur de commandes est distrait.', 'Le trajet est trop long.'], why: 'Le calage et la taille du carton sont des faits vérifiables ; la distraction d’une personne n’explique pas un défaut aussi fréquent.' },
      { question: 'Pourquoi le carton est-il trop grand ?', ok: 'Un seul format de carton est utilisé pour toutes les commandes.', bad: ['Les cartons coûtent trop cher.', 'Les clients commandent trop de gâteaux.'], why: 'Un seul format ne peut pas convenir à des commandes de tailles très différentes.' },
      { question: 'Pourquoi n’y a-t-il qu’un seul format ?', ok: 'Aucune règle ne définit quel carton utiliser selon la commande, et le stock n’en contient qu’un.', bad: ['Les employés manquent de motivation.', 'La concurrence utilise le même carton.'], why: 'On arrive à une cause qui relève de l’organisation : une règle et un stock manquent. Là, on peut agir.' },
    ],
    root: 'Aucune règle de choix du carton selon la commande.',
    action: 'Créer trois formats de cartons, une règle de choix selon le contenu et un stock minimum de chaque format.',
  },
  {
    title: 'Paniers abandonnés',
    problem: 'Sur le site marchand, 7 clients sur 10 abandonnent leur panier avant de payer.',
    levels: [
      { question: 'Pourquoi les clients abandonnent-ils leur panier ?', ok: 'Beaucoup quittent le site au moment du paiement, quand le total final s’affiche.', bad: ['Les clients sont indécis par nature.', 'Les clients préfèrent acheter en boutique.'], why: 'Les statistiques de navigation montrent à quelle étape les clients partent : c’est un constat, pas une hypothèse sur leur caractère.' },
      { question: 'Pourquoi le total final pose-t-il problème ?', ok: 'Les frais de livraison n’apparaissent qu’à la dernière étape et surprennent.', bad: ['Le bouton de paiement est de la mauvaise couleur.', 'Les prix des produits sont trop bas.'], why: 'Une hausse de prix inattendue en fin de parcours est une cause connue d’abandon.' },
      { question: 'Pourquoi les frais ne sont-ils visibles qu’à la fin ?', ok: 'Le site ne calcule les frais qu’une fois l’adresse saisie, sans estimation avant.', bad: ['Le transporteur refuse de donner ses tarifs.', 'Les clients ne lisent pas les conditions.'], why: 'C’est le fonctionnement du site qui est en cause, pas le comportement des clients.' },
      { question: 'Pourquoi n’y a-t-il pas d’estimation avant l’adresse ?', ok: 'Le site n’a pas de grille de tarifs par zone ou par poids qui puisse s’afficher dès le panier.', bad: ['Le développeur est trop lent.', 'Les clients sont mal informés.'], why: 'La cause racine est un élément manquant du système. On peut le construire.' },
    ],
    root: 'Pas de grille de tarifs affichable dès le panier.',
    action: 'Afficher une estimation des frais de livraison dès la page du panier, avec une grille par zone et par poids.',
  },
  {
    title: 'Réunions qui débordent',
    problem: 'Les réunions hebdomadaires de l’équipe durent 90 minutes au lieu de 45.',
    levels: [
      { question: 'Pourquoi les réunions durent-elles deux fois trop longtemps ?', ok: 'Les sujets s’accumulent et chacun est discuté sans limite de temps.', bad: ['Certains collègues parlent trop.', 'La salle de réunion est inconfortable.'], why: 'On cherche ce qui se passe dans le déroulement de la réunion, pas la faute d’une personne.' },
      { question: 'Pourquoi les sujets s’accumulent-ils sans limite de temps ?', ok: 'Il n’y a pas d’ordre du jour avec des durées, partagé à l’avance.', bad: ['Les participants arrivent en retard.', 'L’équipe est trop nombreuse.'], why: 'Sans ordre du jour chronométré, rien n’arrête une discussion.' },
      { question: 'Pourquoi n’y a-t-il pas d’ordre du jour ?', ok: 'Personne n’est chargé de le préparer.', bad: ['Le logiciel d’agenda est trop compliqué.', 'Les réunions sont trop fréquentes.'], why: 'Ce qui n’appartient à personne ne se fait pas.' },
      { question: 'Pourquoi personne n’en est-il chargé ?', ok: 'Le rôle d’animateur de réunion n’est défini nulle part dans le fonctionnement de l’équipe.', bad: ['Le manager n’aime pas les réunions.', 'Les employés n’ont pas le temps.'], why: 'Cause racine : un rôle manque dans l’organisation. On peut le créer.' },
    ],
    root: 'Le rôle d’animateur de réunion n’est pas défini.',
    action: 'Nommer chaque semaine un animateur différent, qui envoie la veille un ordre du jour chronométré.',
  },
]

export interface RootDraw {
  scenario: RootScenario
  /** Pour chaque niveau : les trois propositions mélangées */
  options: string[][]
}

export function drawRoot(rng: Rng): RootDraw[] {
  return shuffle(ROOT_SCENARIOS, rng).map((scenario) => ({
    scenario,
    options: scenario.levels.map((l) => shuffle([l.ok, ...l.bad], rng)),
  }))
}
