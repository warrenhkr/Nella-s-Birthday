# Lot « Analyste d'entreprise » : 12 jeux, 12 algorithmes, 5 pages

Thème : une amie qui veut devenir analyste d'entreprise. Tout le lot reprend les gestes du métier : lire des indicateurs, nettoyer des données, interroger une base, poser un diagnostic, recommander une action. Aucune émoji : toutes les icônes viennent de **Lucide**.

> **À lire d'abord.** Je n'ai pas pu lire le code de ton site (seuls des PDF m'ont été transmis). Les fichiers sont isolés dans des dossiers `analyste`, autonomes, et ne remplacent rien. La section « Hypothèses » dit quoi vérifier. Pour que Copilot fasse l'intégration, colle le contenu de `COPILOT-PROMPT.md`.

## Contenu

**12 jeux Vue** (`/analyste/jeux`) : Seuil de rentabilité · Pareto 80/20 · Le bon indicateur (KPI) · Entonnoir de conversion · Devine la tendance · Corrélation ou causalité ? · Données propres · SQL en blocs · SWOT express · Les 5 pourquoi · Sprint planning · Matrice des risques. Chacun a ses règles, un bouton « Rejouer », un écran de fin, et se joue au doigt ou à la souris.

**5 pages** :
- `/analyste` : le bureau de l'analyste (compétences, mission en 6 étapes reliées aux jeux, boîte à outils).
- `/analyste/jeux` et `/analyste/jeux/:slug` : galerie filtrable et page d'un jeu.
- `/analyste/etude-de-cas` : Atelier Cannelle, une pâtisserie en ligne (entreprise inventée). Graphiques interactifs (canaux, produits, entonnoir, Pareto), puis trois décisions à prendre, corrigées avec les calculs, et une note de synthèse. Tous les chiffres affichés sont **calculés** à partir des données brutes.
- `/analyste/glossaire` : 55 termes du métier avec exemple, recherche insensible aux accents, filtres.

**12 algorithmes Python** (galerie `/algos`, Pyodide, `run(params)`) :

| Algorithme | Rendu | Ce qu'il montre |
|---|---|---|
| `moving_average_forecast` | image | Moyenne mobile et prévision par régression linéaire |
| `pareto_chart` | image | Diagramme de Pareto et causes vitales |
| `break_even_chart` | image | Seuil de rentabilité (point mort) |
| `regression_scatter` | image | Nuage de points, droite, r et R² |
| `kmeans_customers` | points | Segmentation de clients par K-means |
| `monte_carlo_budget` | image | Simulation de Monte-Carlo du coût d'un projet |
| `ab_test_significance` | text | Test A/B : z, p-valeur, intervalle de confiance |
| `eoq_inventory` | image | Quantité économique de commande (Wilson) |
| `funnel_conversion` | image | Entonnoir de conversion et étape faible |
| `cohort_retention_heatmap` | grid | Rétention par cohorte (carte de chaleur) |
| `waterfall_profit` | image | Du chiffre d'affaires au résultat net (cascade) |
| `data_cleaning_report` | text | Audit qualité : doublons, manquants, aberrants |

## Où placer les fichiers

Décompresse à la **racine du projet** (là où est `nuxt.config.ts`). Sans dossier `app/` (ancienne structure Nuxt 3) : retire le préfixe `app/`, les imports sont relatifs.

| Fichier(s) | Rôle |
|---|---|
| `app/pages/analyste/*.vue`, `app/pages/analyste/jeux/*.vue` | Les 5 pages |
| `app/data/analyste-jeux.ts` | Registre des 12 jeux (séparé du registre des algos) |
| `app/components/analyste/*.vue`, `charts/*.vue`, `jeux/*.vue` | Cadre commun, graphiques SVG, 12 jeux |
| `app/utils/analyste/*.ts` | Logique pure (sans Vue), données de l'étude de cas, glossaire |
| `public/algos/*.py` (12) | Algorithmes Pyodide |
| `registry-analyste.json` | Paramètres et rendu de chaque algo, pour remplir `app/data/algos.ts` |
| `tests/analyste/*.test.ts`, `tests/analyste-algos/*.py` | Tests |
| `patches/EXEMPLE-navigation.diff` | Forme du lien de navigation (exemple, non applicable tel quel) |

**Dépendance unique : `npm install @lucide/vue`** (le paquet `lucide-vue-next` est déprécié). Chaque icône est importée par son nom, donc seules celles utilisées sont embarquées.

## Intégration des algorithmes

Pour chaque entrée de `registry-analyste.json`, ajouter l'entrée correspondante dans `app/data/algos.ts` (format de ton projet). Formats de sortie, identiques à ceux du lot précédent :

| `type` | Champs |
|---|---|
| `image` | `data` (data URI PNG), `width`, `height`, facultatifs : `title` (titre avec accents), `summary` (chiffres calculés) |
| `text` | `lines`, `color`, `line_delay`, facultatif `summary` |
| `grid` | `cols`, `rows`, `levels`, `cells`, `mask`, `palette`, `row_labels`, `col_labels`, `average_by_period` |
| `points` | `points` (`x`, `y`, `r`, `alpha`, `color`), `palette`, `clusters`, `segments`, `inertia` |

**Point d'attention :** la police intégrée de Pillow ne contient que l'ASCII. Dans les images, les textes sont donc écrits sans accents (« Resultat net ») ; les libellés complets avec accents sont dans `title` et `summary` : affiche-les dans la page autour de l'image. Les algos n'utilisent que numpy et Pillow.

## Hypothèses à vérifier

- **Thème sombre ardoise/turquoise** (classes Tailwind de base, sans `@apply` ni configuration). Pour un autre thème, modifier surtout `GameShell.vue`, `GameButton.vue` et `AnalysteNav.vue`.
- **Tailwind 3 :** `content` doit couvrir `app/components/**/*.vue` et `app/pages/**/*.vue`.
- Imports avec extension `.ts` dans `app/utils/analyste/` (pour lancer les tests avec Node seul) : acceptés par Nuxt 4.
- Aucune route existante ne doit utiliser `/analyste`.
- Le lien `/algos` (barre de navigation et page d'accueil) suppose que la galerie d'algorithmes existe à cette adresse.

## Ce qui a été vérifié, et ce qui ne l'a pas été

Dans un projet Nuxt jetable (Nuxt 4.5.2, Vue 3.5, Tailwind 4, `@lucide/vue` 1.52.0), **pas dans ton projet** :
- `nuxt typecheck` strict (variables inutilisées incluses), `nuxt build`, et rendu serveur des 5 pages (code 200, 404 pour un jeu inconnu, aucun « NaN ») ;
- 16 tests de logique TypeScript (`node --test`) ;
- 24 tests Python : conformité (types natifs, graine, valeurs extrêmes, valeurs invalides, tailles de canvas, temps) et calculs (formules de seuil, EOQ, test A/B, Pareto, K-means, Monte-Carlo…). 9 erreurs de calcul injectées exprès dans les algos sont toutes détectées ;
- 30 tests de montage dans un faux navigateur (non livrés, ils exigent vitest) : les 12 jeux démarrent, se jouent au hasard, redémarrent sans erreur ni avertissement, ne contiennent aucune émoji, 11 jeux sont joués jusqu’à la victoire et le dernier jusqu’à l’écran de fin ; les pages sont parcourues (recherche, onglets, décisions, note de synthèse).

**Non vérifié :** rendu visuel réel et ergonomie sur de vrais téléphones (aucun navigateur n'était disponible), exécution des algorithmes **dans Pyodide** (testés en Python 3.12 local) et rendu des polices Pillow dans Pyodide, typecheck et build dans ton projet. Passe sur mobile avant de partager.

Tests : `node --test tests/analyste/*.test.ts` (Node 22.18+) et `python tests/analyste-algos/test_analyste_algos.py` (numpy et Pillow).
