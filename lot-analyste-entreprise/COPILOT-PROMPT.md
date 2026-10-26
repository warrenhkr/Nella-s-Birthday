# Prompt à coller dans Copilot (mode Agent, VS Code)

> Copie le bloc ci-dessous tel quel. Le ZIP doit déjà être décompressé à la racine du projet.

```text
Tu es dans mon projet Nuxt 4 (site d'anniversaire). Je viens de décompresser un lot de fichiers « analyste d'entreprise » à la racine : lis d'abord README.md et MANIFEST.md.

Contraintes : ne réécris pas la logique des jeux ; ne crée pas d'architecture parallèle ; reprends les conventions du projet (nom des fichiers, styles, navigation). Si un fichier existant doit changer, montre-moi le diff avant.

Étapes :
1. Lis mon projet : nuxt.config.ts, package.json, la navigation/le layout, la page /algos (app/data/algos.ts, les renderers et le worker Pyodide) et la section /jeu existante. Dis-moi ce que tu as trouvé.
2. Installe l'unique dépendance nécessaire : npm install @lucide/vue (le paquet lucide-vue-next est obsolète).
3. Vérifie que les pages app/pages/analyste/* ne rentrent pas en conflit avec des routes existantes. Ajoute un lien « Bureau de l'analyste » (/analyste) dans la navigation, en suivant le style du menu (voir patches/EXEMPLE-navigation.diff).
4. Algorithmes Python : pour chacun des 12 fichiers de public/algos/ listés dans registry-analyste.json, ajoute l'entrée correspondante dans app/data/algos.ts (id, titre, description, tags, fichier, type de rendu, paramètres avec min/max/défaut). Vérifie que les renderers gèrent bien : "image" (data URI PNG + width/height, champs facultatifs title et summary), "text" (lines, color, line_delay), "grid" (cols, rows, levels, cells, mask, palette, row_labels, col_labels) et "points" (+ palette, clusters, segments). Si un renderer manque ou ignore un champ, complète-le sans casser les algos existants.
5. Lance : npx nuxt typecheck, puis node --test tests/analyste/*.test.ts, puis python tests/analyste-algos/test_analyste_algos.py. Corrige ce qui vient de l'intégration (pas la logique des jeux).
6. Lance le site (npm run dev) et vérifie à la main : /analyste, /analyste/jeux, un jeu au tactile (mode mobile du navigateur), /analyste/etude-de-cas, /analyste/glossaire, et 3 algos dans /algos (un "image", un "grid", un "points"). Donne-moi la liste de ce qui marche, de ce qui a été modifié, et de ce qui reste à décider.
```
