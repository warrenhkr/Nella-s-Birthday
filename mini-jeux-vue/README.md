# Mini-jeux Vue pour le site d'anniversaire

24 mini-jeux jouables (Nuxt 4, Vue 3, TypeScript en `<script setup lang="ts">`, Tailwind), regroupés dans une galerie `/mini-jeux`. Aucune nouvelle dépendance : seuls `vue` et les auto-imports de Nuxt (`useHead`, `useRoute`, `createError`, `NuxtLink`, `ClientOnly`) sont utilisés.

> **À lire d'abord : je n'ai pas pu lire votre projet.** Seuls les deux cahiers PDF m'ont été transmis, pas le code du site. Je n'ai donc pas pu vérifier la section jeux existante (`/jeu`, `TerminalPuzzle`), la navigation, ni vos styles. Les fichiers sont isolés dans leurs propres dossiers (`mini-jeux`) pour ne rien écraser, et la liste « Hypothèses » plus bas dit ce qu'il faut contrôler.

## Les 24 jeux

| Catégorie | Jeux |
|---|---|
| 🎈 Fête (15, pour tout le monde) | Simon des bougies · Memory des cadeaux · Gâteau à étages · Allume le gâteau · Pop les ballons · Taquin illustré · Mots mêlés de la fête · Plus ou moins · Pile à l'heure · Chasse aux différences · Les gobelets · Sudoku en couleurs · Tri des couleurs · Vrai ou faux · Serpent gourmand |
| 💻 Geek (4) | Chasseur de bugs · Bougies binaires · Portes logiques · Devine le code couleur |
| 🔐 Cybersécurité (5) | Phishing ou cadeau ? · Mot de passe en or · Mini CTF · Casse-coffre · Pare-feu |

Chaque jeu présente ses règles (écran d'intro, bouton « Règles » pendant la partie), se rejoue avec « ↻ Rejouer », gère la victoire et la défaite avec un écran de fin, et se joue au doigt comme à la souris (zones tactiles de 44 px, `touch-action` réglé sur les plateaux). Les records sont gardés dans le navigateur (`localStorage`, clés `mini-jeux:best:*`), jamais envoyés.

Contenus originaux : scène de fête, cadeaux et bougies dessinés en SVG dans le code ; questions, messages, extraits de code, marques et adresses entièrement inventés. Le « Vrai ou faux » repose sur des faits courants : relisez-les avant publication.

## Où placer les fichiers

Décompressez le ZIP **à la racine du projet** (là où se trouve `nuxt.config.ts`). Aucun fichier existant n'est remplacé. Si votre projet n'a pas de dossier `app/` (ancienne structure Nuxt 3), retirez simplement le préfixe `app/` : tous les imports sont relatifs et restent valides.

| Fichier(s) | Destination | Rôle |
|---|---|---|
| `app/pages/mini-jeux/index.vue` | idem | Galerie, filtres par catégorie (`/mini-jeux`) |
| `app/pages/mini-jeux/[slug].vue` | idem | Page d'un jeu (`/mini-jeux/memory-cadeaux`, etc.), 404 si le jeu n'existe pas |
| `app/data/mini-jeux.ts` | idem | **Registre** des mini-jeux (titre, catégorie, difficulté, chargement paresseux du composant) |
| `app/components/mini-jeux/GameShell.vue`, `GameButton.vue`, `LevelPicker.vue` | idem | Cadre commun (intro, règles, stats, fin de partie), bouton, choix de niveau |
| `app/components/mini-jeux/BirthdayScene.vue`, `GiftIcon.vue` | idem | Illustrations SVG originales |
| `app/components/mini-jeux/jeux/*.vue` (24 fichiers) | idem | Un composant par jeu |
| `app/utils/games/*.ts` (23 fichiers) | idem | Logique pure des jeux (sans Vue), testable |
| `tests/mini-jeux/*.test.ts` (3 fichiers) | idem | Tests de la logique, sans dépendance |
| `patches/EXEMPLE-navigation.diff` | à lire seulement | Forme du changement de navigation (voir plus bas) |

Le registre des mini-jeux est **séparé** de celui des algorithmes Python (`app/data/algos.ts`) : on ne les mélange pas.

## Ajouter les jeux à la navigation

Les jeux sont accessibles dès l'installation à l'adresse `/mini-jeux`. Il reste à ajouter un lien dans votre menu, ce qui touche un fichier existant que je n'ai pas vu :

```vue
<NuxtLink to="/mini-jeux">Mini-jeux</NuxtLink>
```

`patches/EXEMPLE-navigation.diff` montre où l'insérer. **Ce diff est un exemple à adapter : il n'est pas applicable tel quel** (le fichier `AppNav.vue` est supposé). Autre option : mettre un lien vers `/mini-jeux` depuis la page `/jeu` existante, ou, si vous préférez tout regrouper sous `/jeu`, déplacer les deux pages vers `app/pages/jeu/` en prenant garde de ne pas entrer en conflit avec les routes existantes (et corriger les liens `'/mini-jeux/'` dans `[slug].vue`, `index.vue`).

### Ajouter un 25ᵉ jeu plus tard
1. Écrire `app/components/mini-jeux/jeux/MonJeu.vue` en s'appuyant sur `GameShell` (props `phase` = `'intro' | 'playing' | 'won' | 'lost'`, événements `start` et `restart`) ; n'importe quel jeu existant sert de modèle.
2. Ajouter une ligne dans `MINI_GAMES` (`app/data/mini-jeux.ts`). C'est tout : la galerie et la navigation précédent/suivant se mettent à jour.

## Hypothèses à vérifier à l'intégration

- **Thème sombre violet/rose.** Les styles utilisent les couleurs de base de Tailwind (`violet`, `pink`, `rose`, `emerald`…), sans `@apply` ni configuration personnalisée, pour être indépendants de la version (testé avec Tailwind 4). Si votre site est clair, ou si vous avez des couleurs de marque, ajustez surtout `GameShell.vue` et `GameButton.vue`.
- **Tailwind 3 uniquement :** vérifiez que `content` couvre `app/components/**/*.vue` et `app/pages/**/*.vue` (c'est le cas par défaut avec `@nuxtjs/tailwindcss`).
- **Imports avec extension `.ts`** (`import … from './rng.ts'`) dans `app/utils/games/` : nécessaires pour lancer les tests avec Node seul ; acceptés par Nuxt 4 (`allowImportingTsExtensions`). Si votre `tsconfig` les refuse, retirez `.ts` dans ces imports et lancez les tests avec votre outil habituel.
- **Aucun conflit attendu** avec : `app/data/algos.ts`, `public/algos/`, `TerminalPuzzle`. Les composants sont importés explicitement et rangés dans des dossiers `mini-jeux`, pour éviter les collisions d'auto-import. À contrôler : qu'aucune de vos pages n'utilise déjà `/mini-jeux`.
- Les jeux ne s'exécutent que côté navigateur (`<ClientOnly>` dans `[slug].vue`) : pas de décalage d'hydratation avec le rendu serveur.

## Ce qui a été vérifié, et ce qui ne l'a pas été

Vérifié dans un projet Nuxt jetable (Nuxt 4.5.2, Vue 3.5.43, vue-tsc 3.3.12, TypeScript 5.9.3, Tailwind 4.3.3), **pas dans votre projet** :
- `nuxt typecheck` : aucune erreur, y compris avec `strict`, `noUnusedLocals`, `noUnusedParameters` (contrôle de détection fait avec une erreur volontaire) ;
- `nuxt build` : réussi, et les classes Tailwind particulières (valeurs arbitraires, `clip-path`, `aspect-[4/3]`…) se retrouvent dans le CSS généré ;
- 18 tests de logique (`node --test`) : règles des jeux, génération de grilles toujours résolubles (taquin, Lights Out, tri des couleurs, sudoku à solution unique), mots mêlés, chaque niveau des portes logiques résoluble, chaque drapeau du CTF retrouvable avec les outils, etc. ;
- 36 tests de montage dans un faux navigateur (happy-dom, non livrés car ils exigent vitest) : les 24 jeux démarrent, jouent 100 actions aléatoires et redémarrent sans erreur ni avertissement Vue, et 13 jeux ont été joués jusqu'à la victoire ou la défaite via le DOM. Ces tests ont révélé et fait corriger 3 vrais bugs (champ numérique de « Plus ou moins », indice du sudoku, indice en boucle du tri des couleurs).

**Non vérifié :** rendu visuel réel et ergonomie sur de vrais téléphones et navigateurs (aucun navigateur n'était disponible ici), performances sur appareil modeste, accessibilité au lecteur d'écran au-delà des libellés fournis, typecheck et build **dans votre projet**. Faites un passage rapide sur mobile avant de partager le lien.

Lancer les tests de logique (Node 22.18 ou plus récent ; sur 22.6 à 22.17 ajouter `--experimental-strip-types`) :

```bash
node --test tests/mini-jeux/*.test.ts
```

Aucun algorithme Python n'est ajouté à la galerie dans cette livraison : les 24 algorithmes Pyodide ont été livrés séparément.
