import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

export interface BugSnippet {
  id: number
  lang: 'JavaScript' | 'Python'
  goal: string
  lines: string[]
  /** Numéro (à partir de 0) de la ligne fautive */
  bugLine: number
  why: string
  fix: string
  cyber?: boolean
}

export const SNIPPETS: BugSnippet[] = [
  {
    id: 1, lang: 'JavaScript', goal: 'Afficher chacune des 5 bougies du gâteau.',
    lines: ['const bougies = ["🕯️", "🕯️", "🕯️", "🕯️", "🕯️"]', 'for (let i = 0; i <= bougies.length; i++) {', '  console.log(bougies[i])', '}'],
    bugLine: 1, why: 'Les cases d’un tableau vont de 0 à longueur − 1. Avec « <= », la boucle lit une case de trop et affiche undefined.', fix: 'i < bougies.length'
  },
  {
    id: 2, lang: 'Python', goal: 'Dire si l’âge est exactement 18 ans.',
    lines: ['age = 18', 'if age = 18:', '    print("Pile la majorité !")'],
    bugLine: 1, why: 'Un seul « = » sert à ranger une valeur dans une variable. Pour comparer, il faut deux signes égal.', fix: 'if age == 18:'
  },
  {
    id: 3, lang: 'JavaScript', goal: 'Calculer le prix total : 3 gâteaux à 4 € chacun.',
    lines: ['const prix = 4', 'const quantite = 3', 'const total = prix + quantite', 'console.log("Total :", total)'],
    bugLine: 2, why: 'On additionne au lieu de multiplier : le programme affiche 7 au lieu de 12.', fix: 'const total = prix * quantite'
  },
  {
    id: 4, lang: 'Python', goal: 'Compter de 1 à 5, puis écrire « Terminé ».',
    lines: ['compteur = 1', 'while compteur <= 5:', '    print(compteur)', '    compteur = compteur - 1', 'print("Terminé")'],
    bugLine: 3, why: 'Le compteur descend au lieu de monter : la condition reste vraie pour toujours, c’est une boucle infinie.', fix: 'compteur = compteur + 1'
  },
  {
    id: 5, lang: 'JavaScript', goal: 'Accepter la réponse « oui » ou « ok », et rien d’autre.',
    lines: ['const reponse = "non"', 'if (reponse === "oui" || "ok") {', '  console.log("Accepté")', '}'],
    bugLine: 1, why: 'Le texte "ok" tout seul est toujours considéré comme vrai : la condition est vraie quoi que réponde la personne.', fix: 'reponse === "oui" || reponse === "ok"'
  },
  {
    id: 6, lang: 'Python', goal: 'Doubler un nombre et afficher le résultat.',
    lines: ['def doubler(n):', '    resultat = n * 2', '', 'print(doubler(4))'],
    bugLine: 1, why: 'La fonction calcule mais ne renvoie rien : le programme affiche None. Il manque un « return ».', fix: 'return n * 2'
  },
  {
    id: 7, lang: 'JavaScript', goal: 'Compter les invités.',
    lines: ['const invites = ["Léa", "Sam", "Noa"]', 'const nombre = invites.length()', 'console.log(nombre)'],
    bugLine: 1, why: 'length est une propriété, pas une fonction : on l’écrit sans parenthèses, sinon le programme plante.', fix: 'invites.length'
  },
  {
    id: 8, lang: 'Python', goal: 'Afficher trois bougies.',
    lines: ['for i in range(3):', 'print("bougie", i)'],
    bugLine: 1, why: 'En Python, le contenu d’une boucle doit être décalé vers la droite (indentation). Sans ça, le programme refuse de démarrer.', fix: '    print("bougie", i)'
  },
  {
    id: 9, lang: 'JavaScript', goal: 'Calculer la moyenne de deux notes.',
    lines: ['const a = 12', 'const b = 18', 'const moyenne = a + b / 2', 'console.log(moyenne)'],
    bugLine: 2, why: 'La division passe avant l’addition : on calcule 12 + 9 = 21. Il faut des parenthèses.', fix: 'const moyenne = (a + b) / 2'
  },
  {
    id: 10, lang: 'Python', goal: 'Afficher le dernier invité de la liste.',
    lines: ['invites = ["Mia", "Leo", "Zoe"]', 'dernier = invites[3]', 'print(dernier)'],
    bugLine: 1, why: 'Les positions commencent à 0 : avec trois invités, la dernière case est la numéro 2 (ou -1). La case 3 n’existe pas.', fix: 'dernier = invites[-1]'
  },
  {
    id: 11, lang: 'JavaScript', goal: 'Trier des nombres du plus petit au plus grand.',
    lines: ['const nombres = [10, 9, 100, 1]', 'nombres.sort()', 'console.log(nombres)'],
    bugLine: 1, why: 'Sans consigne, sort() trie comme du texte : 10 vient avant 9. Il faut donner une règle de comparaison.', fix: 'nombres.sort((a, b) => a - b)'
  },
  {
    id: 12, lang: 'JavaScript', goal: 'Afficher un message personnalisé.',
    lines: ['const prenom = "Inès"', 'console.log("Joyeux anniversaire " + prenon)'],
    bugLine: 1, why: 'Faute de frappe : la variable s’appelle « prenom », pas « prenon ». Le programme plante avec une erreur.', fix: '"Joyeux anniversaire " + prenom'
  },
  {
    id: 13, lang: 'JavaScript', goal: 'Chercher un membre par son nom dans une base de données.', cyber: true,
    lines: ['const nom = saisieDuVisiteur', 'const requete = "SELECT * FROM membres WHERE nom = \'" + nom + "\'"', 'base.execute(requete)'],
    bugLine: 1, why: 'Le texte du visiteur est collé directement dans la requête : c’est la porte ouverte à l’injection SQL. Il faut une requête préparée, où la saisie reste une simple valeur.', fix: 'une requête préparée avec un paramètre'
  },
  {
    id: 14, lang: 'JavaScript', goal: 'Vérifier le mot de passe saisi.', cyber: true,
    lines: ['function verifier(saisie) {', '  const motDePasse = "gateau123"', '  return saisie === motDePasse', '}'],
    bugLine: 1, why: 'Le mot de passe est écrit en clair dans le code : quiconque lit le fichier le connaît. On stocke seulement une empreinte (hash) et on compare les empreintes.', fix: 'comparer des empreintes, jamais de mot de passe en clair'
  }
]

export function drawSnippets(count: number, rng: Rng): BugSnippet[] {
  return shuffle(SNIPPETS, rng).slice(0, count)
}
