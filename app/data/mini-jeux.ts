import type { AsyncComponentLoader } from 'vue'

/**
 * Registre des mini-jeux Vue. Un jeu = une entrée ici + un composant dans components/mini-jeux/jeux/.
 * (À ne pas confondre avec le registre des algorithmes Python, app/data/algos.ts.)
 */
export type MiniGameCategory = 'fete' | 'geek' | 'cyber'

export interface MiniGame {
  slug: string
  title: string
  emoji: string
  description: string
  category: MiniGameCategory
  /** 1 = tranquille, 2 = demande de la réflexion, 3 = costaud */
  difficulty: 1 | 2 | 3
  duration: string
  loader: AsyncComponentLoader
}

export const CATEGORY_LABELS: Record<MiniGameCategory, string> = {
  fete: 'Fête',
  geek: 'Geek',
  cyber: 'Cybersécurité'
}

export const MINI_GAMES: MiniGame[] = [
  { slug: 'simon-bougies', title: 'Simon des bougies', emoji: '🕯️', description: 'Mémorise la séquence de bougies et rejoue-la.', category: 'fete', difficulty: 1, duration: '3 min', loader: () => import('../components/mini-jeux/jeux/SimonBougies.vue') },
  { slug: 'memory-cadeaux', title: 'Memory des cadeaux', emoji: '🎁', description: 'Retrouve les paires de cadeaux emballés.', category: 'fete', difficulty: 1, duration: '3 min', loader: () => import('../components/mini-jeux/jeux/MemoryCadeaux.vue') },
  { slug: 'gateau-etages', title: 'Gâteau à étages', emoji: '🎂', description: 'Empile les étages au bon moment pour un gâteau géant.', category: 'fete', difficulty: 2, duration: '2 min', loader: () => import('../components/mini-jeux/jeux/GateauEtages.vue') },
  { slug: 'allume-gateau', title: 'Allume le gâteau', emoji: '🔥', description: 'Un casse-tête de bougies à allumer toutes ensemble.', category: 'fete', difficulty: 2, duration: '4 min', loader: () => import('../components/mini-jeux/jeux/AllumeGateau.vue') },
  { slug: 'pop-ballons', title: 'Pop les ballons', emoji: '🎈', description: 'Éclate les ballons dans l’ordre, le plus vite possible.', category: 'fete', difficulty: 1, duration: '2 min', loader: () => import('../components/mini-jeux/jeux/PopBallons.vue') },
  { slug: 'taquin-illustre', title: 'Taquin illustré', emoji: '🧩', description: 'Reconstitue la scène de fête en faisant glisser les morceaux.', category: 'fete', difficulty: 2, duration: '5 min', loader: () => import('../components/mini-jeux/jeux/TaquinIllustre.vue') },
  { slug: 'mots-meles', title: 'Mots mêlés de la fête', emoji: '🔤', description: 'Des mots de fête, de musique et d’informatique à retrouver.', category: 'fete', difficulty: 1, duration: '5 min', loader: () => import('../components/mini-jeux/jeux/MotsMeles.vue') },
  { slug: 'plus-ou-moins', title: 'Plus ou moins', emoji: '🎯', description: 'Devine le nombre secret en peu d’essais.', category: 'fete', difficulty: 1, duration: '2 min', loader: () => import('../components/mini-jeux/jeux/PlusOuMoins.vue') },
  { slug: 'pile-a-l-heure', title: 'Pile à l’heure', emoji: '⏱️', description: 'Arrête le chrono exactement sur la cible.', category: 'fete', difficulty: 2, duration: '2 min', loader: () => import('../components/mini-jeux/jeux/PileHeure.vue') },
  { slug: 'chasse-differences', title: 'Chasse aux différences', emoji: '🔍', description: 'Repère ce qui a changé dans la salle de fête.', category: 'fete', difficulty: 1, duration: '3 min', loader: () => import('../components/mini-jeux/jeux/ChasseDifferences.vue') },
  { slug: 'gobelets', title: 'Les gobelets', emoji: '🥤', description: 'Suis des yeux le gobelet qui cache le cadeau.', category: 'fete', difficulty: 2, duration: '3 min', loader: () => import('../components/mini-jeux/jeux/Gobelets.vue') },
  { slug: 'sudoku-couleurs', title: 'Sudoku en couleurs', emoji: '🎨', description: 'Un sudoku 4×4 avec des couleurs et des symboles.', category: 'fete', difficulty: 2, duration: '4 min', loader: () => import('../components/mini-jeux/jeux/SudokuCouleurs.vue') },
  { slug: 'tri-couleurs', title: 'Tri des couleurs', emoji: '🧪', description: 'Verse les billes jusqu’à ce que chaque tube soit uni.', category: 'fete', difficulty: 3, duration: '6 min', loader: () => import('../components/mini-jeux/jeux/TriCouleurs.vue') },
  { slug: 'vrai-faux', title: 'Vrai ou faux', emoji: '🤔', description: 'Des faits surprenants… et des idées reçues à démonter.', category: 'fete', difficulty: 1, duration: '3 min', loader: () => import('../components/mini-jeux/jeux/VraiFaux.vue') },
  { slug: 'serpent-gourmand', title: 'Serpent gourmand', emoji: '🐍', description: 'Le snake des téléphones d’antan, avec des cupcakes.', category: 'fete', difficulty: 2, duration: '3 min', loader: () => import('../components/mini-jeux/jeux/SerpentGourmand.vue') },
  { slug: 'chasseur-bugs', title: 'Chasseur de bugs', emoji: '🐛', description: 'Trouve la ligne de code qui cloche.', category: 'geek', difficulty: 2, duration: '4 min', loader: () => import('../components/mini-jeux/jeux/ChasseurBugs.vue') },
  { slug: 'bougies-binaires', title: 'Bougies binaires', emoji: '🔢', description: 'Compte comme un ordinateur avec des bougies.', category: 'geek', difficulty: 2, duration: '3 min', loader: () => import('../components/mini-jeux/jeux/BougiesBinaires.vue') },
  { slug: 'portes-logiques', title: 'Portes logiques', emoji: '💡', description: 'Assemble ET, OU et NON pour allumer la lampe.', category: 'geek', difficulty: 3, duration: '6 min', loader: () => import('../components/mini-jeux/jeux/PortesLogiques.vue') },
  { slug: 'code-couleur', title: 'Devine le code couleur', emoji: '🌈', description: 'Lis et reconstitue les codes hexadécimaux des couleurs.', category: 'geek', difficulty: 2, duration: '3 min', loader: () => import('../components/mini-jeux/jeux/CodeCouleur.vue') },
  { slug: 'phishing-ou-cadeau', title: 'Phishing ou cadeau ?', emoji: '🎣', description: 'Trie les messages légitimes et les pièges.', category: 'cyber', difficulty: 1, duration: '4 min', loader: () => import('../components/mini-jeux/jeux/PhishingOuCadeau.vue') },
  { slug: 'mot-de-passe-or', title: 'Mot de passe en or', emoji: '🔑', description: 'Fabrique un mot de passe qui satisfait des règles de plus en plus folles.', category: 'cyber', difficulty: 2, duration: '4 min', loader: () => import('../components/mini-jeux/jeux/MotDePasseOr.vue') },
  { slug: 'mini-ctf', title: 'Mini CTF', emoji: '🚩', description: 'Cinq défis de piratage éthique très accessibles.', category: 'cyber', difficulty: 2, duration: '8 min', loader: () => import('../components/mini-jeux/jeux/MiniCtf.vue') },
  { slug: 'casse-coffre', title: 'Casse-coffre', emoji: '🔐', description: 'Déduis le code du coffre grâce aux indices.', category: 'cyber', difficulty: 2, duration: '4 min', loader: () => import('../components/mini-jeux/jeux/CasseCoffre.vue') },
  { slug: 'pare-feu', title: 'Pare-feu', emoji: '🛡️', description: 'Autorise ou bloque les paquets selon les règles.', category: 'cyber', difficulty: 3, duration: '4 min', loader: () => import('../components/mini-jeux/jeux/PareFeu.vue') }
]

export function findMiniGame(slug: string): MiniGame | undefined {
  return MINI_GAMES.find(g => g.slug === slug)
}
