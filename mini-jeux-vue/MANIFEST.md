# Manifeste des fichiers

61 fichiers (dont ce manifeste). À décompresser à la racine du projet.

| Fichier | Lignes | Rôle |
|---|---:|---|
| `README.md` | 75 | Mode d'emploi, hypothèses, vérifications |
| `app/components/mini-jeux/BirthdayScene.vue` | 101 | Composant partagé |
| `app/components/mini-jeux/GameButton.vue` | 25 | Composant partagé |
| `app/components/mini-jeux/GameShell.vue` | 98 | Composant partagé |
| `app/components/mini-jeux/GiftIcon.vue` | 68 | Composant partagé |
| `app/components/mini-jeux/LevelPicker.vue` | 25 | Composant partagé |
| `app/components/mini-jeux/jeux/AllumeGateau.vue` | 111 | Jeu : AllumeGateau |
| `app/components/mini-jeux/jeux/BougiesBinaires.vue` | 132 | Jeu : BougiesBinaires |
| `app/components/mini-jeux/jeux/CasseCoffre.vue` | 149 | Jeu : CasseCoffre |
| `app/components/mini-jeux/jeux/ChasseDifferences.vue` | 141 | Jeu : ChasseDifferences |
| `app/components/mini-jeux/jeux/ChasseurBugs.vue` | 119 | Jeu : ChasseurBugs |
| `app/components/mini-jeux/jeux/CodeCouleur.vue` | 164 | Jeu : CodeCouleur |
| `app/components/mini-jeux/jeux/GateauEtages.vue` | 184 | Jeu : GateauEtages |
| `app/components/mini-jeux/jeux/Gobelets.vue` | 167 | Jeu : Gobelets |
| `app/components/mini-jeux/jeux/MemoryCadeaux.vue` | 134 | Jeu : MemoryCadeaux |
| `app/components/mini-jeux/jeux/MiniCtf.vue` | 194 | Jeu : MiniCtf |
| `app/components/mini-jeux/jeux/MotDePasseOr.vue` | 122 | Jeu : MotDePasseOr |
| `app/components/mini-jeux/jeux/MotsMeles.vue` | 202 | Jeu : MotsMeles |
| `app/components/mini-jeux/jeux/PareFeu.vue` | 185 | Jeu : PareFeu |
| `app/components/mini-jeux/jeux/PhishingOuCadeau.vue` | 109 | Jeu : PhishingOuCadeau |
| `app/components/mini-jeux/jeux/PileHeure.vue` | 121 | Jeu : PileHeure |
| `app/components/mini-jeux/jeux/PlusOuMoins.vue` | 143 | Jeu : PlusOuMoins |
| `app/components/mini-jeux/jeux/PopBallons.vue` | 115 | Jeu : PopBallons |
| `app/components/mini-jeux/jeux/PortesLogiques.vue` | 119 | Jeu : PortesLogiques |
| `app/components/mini-jeux/jeux/SerpentGourmand.vue` | 146 | Jeu : SerpentGourmand |
| `app/components/mini-jeux/jeux/SimonBougies.vue` | 145 | Jeu : SimonBougies |
| `app/components/mini-jeux/jeux/SudokuCouleurs.vue` | 170 | Jeu : SudokuCouleurs |
| `app/components/mini-jeux/jeux/TaquinIllustre.vue` | 125 | Jeu : TaquinIllustre |
| `app/components/mini-jeux/jeux/TriCouleurs.vue` | 184 | Jeu : TriCouleurs |
| `app/components/mini-jeux/jeux/VraiFaux.vue` | 101 | Jeu : VraiFaux |
| `app/data/mini-jeux.ts` | 56 | Registre des 24 mini-jeux |
| `app/pages/mini-jeux/[slug].vue` | 34 | Page d'un jeu /mini-jeux/:slug |
| `app/pages/mini-jeux/index.vue` | 56 | Galerie /mini-jeux |
| `app/utils/games/balloons.ts` | 37 | Logique pure (sans Vue) |
| `app/utils/games/ballsort.ts` | 87 | Logique pure (sans Vue) |
| `app/utils/games/bugs.ts` | 91 | Logique pure (sans Vue) |
| `app/utils/games/colorhex.ts` | 38 | Logique pure (sans Vue) |
| `app/utils/games/ctf.ts` | 121 | Logique pure (sans Vue) |
| `app/utils/games/firewall.ts` | 99 | Logique pure (sans Vue) |
| `app/utils/games/format.ts` | 12 | Logique pure (sans Vue) |
| `app/utils/games/gates.ts` | 149 | Logique pure (sans Vue) |
| `app/utils/games/lightsout.ts` | 67 | Logique pure (sans Vue) |
| `app/utils/games/mastermind.ts` | 29 | Logique pure (sans Vue) |
| `app/utils/games/memory.ts` | 17 | Logique pure (sans Vue) |
| `app/utils/games/passwordrules.ts` | 44 | Logique pure (sans Vue) |
| `app/utils/games/phishing.ts` | 112 | Logique pure (sans Vue) |
| `app/utils/games/rng.ts` | 51 | Logique pure (sans Vue) |
| `app/utils/games/scene.ts` | 36 | Logique pure (sans Vue) |
| `app/utils/games/slidepuzzle.ts` | 83 | Logique pure (sans Vue) |
| `app/utils/games/snake.ts` | 55 | Logique pure (sans Vue) |
| `app/utils/games/stack.ts` | 40 | Logique pure (sans Vue) |
| `app/utils/games/storage.ts` | 30 | Logique pure (sans Vue) |
| `app/utils/games/sudoku4.ts` | 87 | Logique pure (sans Vue) |
| `app/utils/games/truefalse.ts` | 59 | Logique pure (sans Vue) |
| `app/utils/games/useStopwatch.ts` | 38 | Logique pure (sans Vue) |
| `app/utils/games/wordsearch.ts` | 79 | Logique pure (sans Vue) |
| `patches/EXEMPLE-navigation.diff` | 10 | Exemple de lien de navigation (à adapter) |
| `tests/mini-jeux/logique-fete.test.ts` | 89 | Tests de logique (node --test) |
| `tests/mini-jeux/logique-geek-cyber.test.ts` | 212 | Tests de logique (node --test) |
| `tests/mini-jeux/scene.test.ts` | 19 | Tests de logique (node --test) |
| `MANIFEST.md` | - | Ce fichier |
