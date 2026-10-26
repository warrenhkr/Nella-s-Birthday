# Algos du site d'anniversaire : 24 algorithmes prêts à brancher

24 fichiers Python autonomes (`public/algos/`), un fichier de tests par algo (`tests/`),
et `registry.json` (paramètres, bornes et type de rendu de chaque algo, généré depuis le code).

    python run_all_tests.py          # tout lancer (Python 3.11+, numpy, pillow)
    python tests/test_maze_astar.py  # un seul algo

## Comment lire un fichier d'algo

Chaque fichier a la même forme, du haut vers le bas :

1. une docstring : le principe de l'algo, ses choix, ses pièges ;
2. `PARAMS` : la liste des réglages (nom, type, min, max, défaut). C'est la source unique pour la validation ET pour `registry.json` ;
3. des fonctions utilitaires (`read_params`, `heart_curve`, `gradient`…) copiées dans chaque fichier : un algo = un fichier, rien à importer côté Pyodide ;
4. la logique propre à l'algo (fonctions courtes, testables) ;
5. `run(params)` : le point d'entrée, il renvoie un dict en types natifs.

Pour modifier un algo : change le code, relance son test. Les tests parlent de propriétés (bornes, invariants), pas de valeurs au caractère près.

## Convention appliquée (section 2 du cahier)

Canvas 640×640, origine en haut à gauche, y vers le bas (`width`/`height` sont acceptés et validés : 64 à 2000). Types de paramètres : int, float, bool, str, select. `seed` partout où il y a du hasard (`default_rng` / `random.Random` locaux). Sorties en types natifs (`json.dumps` testé). `ValueError` en français pour toute valeur invalide. Aucune dépendance au-delà de numpy et Pillow.

## Formats de sortie (à donner à Copilot pour les renderers)

Le cahier ne figeait pas ces formats : voici ceux que j'ai choisis.

| `type` | Clés |
|---|---|
| `points` | `points` : liste de `{x, y, r, alpha, color}` ; option `links` (paires d'indices) + `link_alpha` ; option `keyframes` : liste de `{"points": [...]}` + `fps`, `loop` ; `palette` |
| `text` | `lines` (liste de str), `color`, `line_delay` (ms entre deux lignes) ; l'algo 24 ajoute `codes`, `bits`, `ratio` |
| `grid` | `cols`, `rows`, `levels` (valeur maximale d'une case), `cells` (1re matrice), `keyframes` (liste de matrices), `fps`, `loop`, `palette` ; option `mask` |
| `frames` | `encoding` = `"grid"` : `frames` = liste de matrices d'entiers (codes de couleur dans `palette`, dans l'ordre : 0, 1, 2…) ; `encoding` = `"png_base64"` : `frames` = liste de data URI PNG, avec `width`, `height` |
| `image` | `data` (data URI PNG), `width`, `height` |

## Décisions à connaître

- **Plafonnage automatique, jamais d'erreur.** Un rendu animé ne dépasse pas 12 000 points (ou 300 000 cases de grille). Au-delà, le nombre d'images est réduit et la sortie contient `frames_capped: true`. Toutes les constantes sont en haut des fichiers (`MAX_POINTS`, `MAX_CELLS`).
- **Algo 17 (tris)** : une frame est une grille `count × count` (hauteur de barre = valeur), comme dans la fiche ; le nombre d'images dépend donc du budget de cases (pour 120 barres, environ 13 images).
- **Algo 23 (L-système)** : la règle `F → F[+F][-F]` réécrit aussi le F du tronc, donc 3^n segments (et non 2^(n+1)−1) ; extrémités = 2^n. La fiche est à ajuster sur ce point.
- **Algo 22** : largeur visible 3,5/zoom (Mandelbrot) et 3,0/zoom (Julia), avec centre (0, 0) par défaut comme dans la fiche. Pour voir tout l'ensemble de Mandelbrot, prendre `center_x` ≈ −0,5.
- **Algo 16** : les accents sont normalisés (é → e) avant chiffrement ; le reste (ponctuation, casse) est conservé.
- **Algo 21** : le nombre de solutions (92 pour n = 8, 14 200 pour n = 12) est compté avec un solveur à masques de bits ; l'animation montre la recherche de la première solution.
- Les tests des 24 algos passent ; aux valeurs par défaut, le plus lent (algo 11, PNG) prend environ 0,3 s en local, tous les autres moins de 0,1 s.

## Reste à faire

- Brancher les 24 entrées dans le registre (`app/data/algos.ts`) à partir de `registry.json`, et écrire les renderers `points` (avec `keyframes`/`links`), `grid`, `frames`, `image`, `text`.
- Tester dans Pyodide : version de Python, `pip`/`loadPackage` pour numpy et Pillow. Je n'ai pu tester qu'en Python 3.12 local ; le code n'utilise rien de récent.
- Vérifier l'aperçu sur mobile et la charte violet / rose / blanc dans le site.
