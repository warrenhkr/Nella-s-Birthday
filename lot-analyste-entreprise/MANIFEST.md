# Manifeste des fichiers

64 fichiers (dont ce manifeste). À décompresser à la racine du projet.

| Fichier | Lignes | Rôle |
|---|---:|---|
| `COPILOT-PROMPT.md` | 17 | Prompt à coller dans Copilot (VS Code) |
| `README.md` | 82 | Mode d'emploi, hypothèses, vérifications |
| `app/components/analyste/AnalysteNav.vue` | 29 | Composant partagé |
| `app/components/analyste/GameButton.vue` | 26 | Composant partagé |
| `app/components/analyste/GameShell.vue` | 99 | Composant partagé |
| `app/components/analyste/charts/BarChart.vue` | 74 | Graphique SVG |
| `app/components/analyste/charts/FunnelChart.vue` | 41 | Graphique SVG |
| `app/components/analyste/charts/LineChart.vue` | 99 | Graphique SVG |
| `app/components/analyste/charts/StackedBarChart.vue` | 55 | Graphique SVG |
| `app/components/analyste/jeux/BonKpi.vue` | 98 | Jeu : BonKpi |
| `app/components/analyste/jeux/CinqPourquoi.vue` | 133 | Jeu : CinqPourquoi |
| `app/components/analyste/jeux/CorrelationCausalite.vue` | 101 | Jeu : CorrelationCausalite |
| `app/components/analyste/jeux/DevineTendance.vue` | 139 | Jeu : DevineTendance |
| `app/components/analyste/jeux/DonneesPropres.vue` | 147 | Jeu : DonneesPropres |
| `app/components/analyste/jeux/EntonnoirConversion.vue` | 107 | Jeu : EntonnoirConversion |
| `app/components/analyste/jeux/MatriceRisques.vue` | 132 | Jeu : MatriceRisques |
| `app/components/analyste/jeux/Pareto80.vue` | 134 | Jeu : Pareto80 |
| `app/components/analyste/jeux/SeuilRentabilite.vue` | 126 | Jeu : SeuilRentabilite |
| `app/components/analyste/jeux/SprintPlanning.vue` | 125 | Jeu : SprintPlanning |
| `app/components/analyste/jeux/SqlBlocs.vue` | 113 | Jeu : SqlBlocs |
| `app/components/analyste/jeux/SwotExpress.vue` | 125 | Jeu : SwotExpress |
| `app/data/analyste-jeux.ts` | 47 | Registre des 12 jeux |
| `app/pages/analyste/etude-de-cas.vue` | 154 | Page |
| `app/pages/analyste/glossaire.vue` | 52 | Page |
| `app/pages/analyste/index.vue` | 102 | Page |
| `app/pages/analyste/jeux/[slug].vue` | 35 | Page |
| `app/pages/analyste/jeux/index.vue` | 40 | Page |
| `app/utils/analyste/breakeven.ts` | 36 | Logique pure / données |
| `app/utils/analyste/cas.ts` | 153 | Logique pure / données |
| `app/utils/analyste/charts.ts` | 28 | Logique pure / données |
| `app/utils/analyste/correlation.ts` | 34 | Logique pure / données |
| `app/utils/analyste/datacleaning.ts` | 103 | Logique pure / données |
| `app/utils/analyste/forecast.ts` | 50 | Logique pure / données |
| `app/utils/analyste/format.ts` | 18 | Logique pure / données |
| `app/utils/analyste/funnel.ts` | 78 | Logique pure / données |
| `app/utils/analyste/glossaire.ts` | 79 | Logique pure / données |
| `app/utils/analyste/kpi.ts` | 35 | Logique pure / données |
| `app/utils/analyste/pareto.ts` | 41 | Logique pure / données |
| `app/utils/analyste/riskmatrix.ts` | 42 | Logique pure / données |
| `app/utils/analyste/rng.ts` | 51 | Logique pure / données |
| `app/utils/analyste/rootcause.ts` | 70 | Logique pure / données |
| `app/utils/analyste/sprint.ts` | 55 | Logique pure / données |
| `app/utils/analyste/sqlblocs.ts` | 95 | Logique pure / données |
| `app/utils/analyste/storage.ts` | 30 | Logique pure / données |
| `app/utils/analyste/swot.ts` | 82 | Logique pure / données |
| `app/utils/analyste/useStopwatch.ts` | 33 | Logique pure / données |
| `patches/EXEMPLE-navigation.diff` | 10 | Exemple de lien de navigation (à adapter) |
| `public/algos/ab_test_significance.py` | 99 | Algorithme Pyodide : ab_test_significance |
| `public/algos/break_even_chart.py` | 245 | Algorithme Pyodide : break_even_chart |
| `public/algos/cohort_retention_heatmap.py` | 88 | Algorithme Pyodide : cohort_retention_heatmap |
| `public/algos/data_cleaning_report.py` | 132 | Algorithme Pyodide : data_cleaning_report |
| `public/algos/eoq_inventory.py` | 246 | Algorithme Pyodide : eoq_inventory |
| `public/algos/funnel_conversion.py` | 252 | Algorithme Pyodide : funnel_conversion |
| `public/algos/kmeans_customers.py` | 113 | Algorithme Pyodide : kmeans_customers |
| `public/algos/monte_carlo_budget.py` | 258 | Algorithme Pyodide : monte_carlo_budget |
| `public/algos/moving_average_forecast.py` | 267 | Algorithme Pyodide : moving_average_forecast |
| `public/algos/pareto_chart.py` | 260 | Algorithme Pyodide : pareto_chart |
| `public/algos/regression_scatter.py` | 250 | Algorithme Pyodide : regression_scatter |
| `public/algos/waterfall_profit.py` | 251 | Algorithme Pyodide : waterfall_profit |
| `registry-analyste.json` | 570 | Paramètres et rendu des 12 algos |
| `tests/analyste-algos/_harness.py` | 122 | Tests |
| `tests/analyste-algos/test_analyste_algos.py` | 230 | Tests |
| `tests/analyste/logique-analyste.test.ts` | 263 | Tests |
| `MANIFEST.md` | - | Ce fichier |
