# Conventions et spécifications des algorithmes Python

## État actuel du projet

- la page de liste `/algos` est active et lit le registre depuis `app/data/algos.ts`
- la page de détail `/algos/[id]` expose les paramètres du registre
- les fichiers Python de référence sont stockés dans `public/algos/`
- le runner Pyodide est branché via un worker dédié et renvoie le résultat vers le renderer
- le renderer `points` est actif pour la prévisualisation des cœurs animés
- les renderers `grille`, `texte` et `image` sont préparés pour compléter le playground multi-rendus
- chaque algorithme doit conserver un point d’entrée unique : `run(params)`

## Convention de sortie

Chaque fichier Python d’algorithme doit exposer une fonction `run(params)`.

```python
import math
import numpy as np


def run(params):
    # params est un dictionnaire
    return {
        "type": "points",
        "points": [
            {"x": 120, "y": 80, "r": 3, "alpha": 1.0, "color": "#ff5ea8"}
        ],
    }
```

### Types de rendu acceptés

- `points` : points / courbes / particules / cœur dessiné par points
- `frames` : séquence d’images animées
- `grille` : matrice 2D pour automates / cellules / terrains
- `texte` : lignes de texte stylisées pour terminal / console
- `image` : image PNG/JPEG rendue en base64 ou tableau d’octets

### Réponses attendues par type

```python
# points
{
  "type": "points",
  "points": [{"x": 0, "y": 0, "r": 4, "color": "#ffffff", "alpha": 1.0}],
  "palette": ["#ff6ea8", "#ffd1dc", "#ffffff"],
  "duration": 1200
}

# frames
{
  "type": "frames",
  "frames": [array_2d_1, array_2d_2, array_2d_3],
  "fps": 24,
  "loop": True
}

# grille
{
  "type": "grille",
  "grid": [[0, 1, 0], [1, 1, 1]],
  "palette": ["#120b1d", "#ff5ea8", "#ffd166"],
  "width": 32,
  "height": 32
}

# texte
{
  "type": "texte",
  "lines": ["LOVE", "ART", "CODE"],
  "font": "monospace",
  "color": "#ff5ea8"
}

# image
{
  "type": "image",
  "image": "data:image/png;base64,...",
  "width": 640,
  "height": 640
}
```

### Bibliothèques recommandées

- `math`
- `random`
- `numpy`
- `colorsys`
- `Pillow` (`PIL.Image`, `ImageDraw`, `ImageFilter`)
- `cv2` si besoin de traitements visuels
- `dataclasses` si tu veux des structures de particules simples

---

# Liste des algorithmes à coder soi-même

## 1. HeartPulsePoints

- Nom : `heart_pulse_points`
- But : générer un cœur animé en points qui pulse et garde une courbe de cœur propre.
- Fichiers utiles : `numpy`, `math`, `random`
- Paramètres :
  - `seed` : int, défaut `42`
  - `points_count` : int, min `200`, max `4000`, défaut `1200`
  - `scale` : float, min `0.7`, max `2.5`, défaut `1.2`
  - `amplitude` : float, min `0.2`, max `1.8`, défaut `0.9`
  - `speed` : float, min `0.2`, max `4.0`, défaut `1.0`
- Sortie attendue : `type = "points"`
- Critère de validation :
  - 1 cœur net, centré, visible sur fond transparent
  - pulsation légère et régulière
  - palette rose / rouge / blanc uniquement

## 2. HeartBloomTrail

- Nom : `heart_bloom_trail`
- But : dessiner un cœur central avec une traînée de particules qui suit les contours du cœur.
- Fichiers utiles : `numpy`, `random`, `math`
- Paramètres :
  - `particle_count` : int, min `50`, max `1500`, défaut `500`
  - `trail_length` : int, min `4`, max `40`, défaut `16`
  - `spread` : float, min `0.5`, max `3.0`, défaut `1.2`
  - `glow` : float, min `0.2`, max `2.0`, défaut `0.9`
- Sortie attendue : `type = "points"`
- Critère de validation :
  - particules non aléatoires partout
  - trajectoire concentrée autour du contour du cœur
  - intensité lumineuse décroissante dans le temps

## 3. OrbitHeartCluster

- Nom : `orbit_heart_cluster`
- But : créer un groupe de petits cœurs orbitant autour d’un cœur principal.
- Fichiers utiles : `numpy`, `math`, `random`
- Paramètres :
  - `orbit_count` : int, min `6`, max `36`, défaut `14`
  - `radius` : float, min `40`, max `220`, défaut `120`
  - `speed` : float, min `0.2`, max `6.0`, défaut `1.8`
  - `size` : float, min `6`, max `40`, défaut `16`
  - `phase_shift` : float, min `0`, max `6.28`, défaut `0.0`
- Sortie attendue : `type = "points"`
- Critère de validation :
  - les sous-cœurs tournent autour du centre
  - pas de chevauchement extrême
  - rendu stable et symétrique

## 4. HeartWaveRibbon

- Nom : `heart_wave_ribbon`
- But : générer un ruban sinusoïdal qui dessine un cœur en mouvement de vague.
- Fichiers utiles : `numpy`, `math`
- Paramètres :
  - `segments` : int, min `100`, max `2000`, défaut `800`
  - `wave_amplitude` : float, min `2`, max `48`, défaut `18`
  - `frequency` : float, min `0.5`, max `8.0`, défaut `2.2`
  - `phase` : float, min `0`, max `6.28`, défaut `0.0`
  - `thickness` : float, min `1`, max `16`, défaut `4`
- Sortie attendue : `type = "points"`
- Critère de validation :
  - contour du cœur visible en une ligne continue
  - mouvement de vague uniforme
  - net sur fond transparent

## 5. HeartGridPulse

- Nom : `heart_grid_pulse`
- But : créer une grille de cellules qui forment un cœur puis pulsent par activation/désactivation.
- Fichiers utiles : `numpy`, `random`, `math`
- Paramètres :
  - `grid_size` : int, min `16`, max `96`, défaut `36`
  - `pulse_speed` : float, min `0.2`, max `5.0`, défaut `1.2`
  - `threshold` : float, min `0.1`, max `1.0`, défaut `0.45`
  - `glow` : bool, défaut `True`
  - `palette_mode` : str, options `["rose", "fuchsia", "violet"]`, défaut `"rose"`
- Sortie attendue : `type = "grille"`
- Critère de validation :
  - forme du cœur clairement lisible dans la grille
  - changements d’état en ondes
  - pas d’artefacts de bord

## 6. HeartConfettiBurst

- Nom : `heart_confetti_burst`
- But : lancer un effet de confettis en forme de cœur avec particules tirées dans toutes les directions.
- Fichiers utiles : `random`, `math`, `numpy`
- Paramètres :
  - `count` : int, min `50`, max `3000`, défaut `700`
  - `force` : float, min `0.5`, max `6.0`, défaut `2.4`
  - `spread` : float, min `0.2`, max `2.0`, défaut `0.8`
  - `duration` : int, min `40`, max `2000`, défaut `360`
  - `shape` : str, options `["coeur", "etoile", "rond"]`, défaut `"coeur"`
- Sortie attendue : `type = "points"`
- Critère de validation :
  - explosion centrée sur un cœur
  - particules visibles sans saturation totale
  - décroissance progressive de la vitesse

## 7. HeartGlowParticleField

- Nom : `heart_glow_particle_field`
- But : simuler un champ de particules flottantes qui s’assemblent en cœur et brillent.
- Fichiers utiles : `numpy`, `random`, `colorsys`
- Paramètres :
  - `particle_count` : int, min `100`, max `2500`, défaut `800`
  - `drift` : float, min `0.1`, max `3.0`, défaut `0.9`
  - `alpha_range` : tuple float, défaut `(0.2, 1.0)`
  - `radius` : float, min `20`, max `220`, défaut `110`
  - `glow_strength` : float, min `0.3`, max `2.5`, défaut `1.2`
- Sortie attendue : `type = "points"`
- Critère de validation :
  - particules visibles dans un cœur de densité variable
  - intensité lumineuse uniforme
  - aucun amas de particules hors du cœur

## 8. HeartConstellationMap

- Nom : `heart_constellation_map`
- But : transformer un cœur en carte de constellations avec points liés par lignes légères.
- Fichiers utiles : `numpy`, `math`, `random`
- Paramètres :
  - `star_count` : int, min `20`, max `500`, défaut `120`
  - `link_distance` : float, min `8`, max `80`, défaut `24`
  - `alpha` : float, min `0.2`, max `1.0`, défaut `0.75`
  - `twinkle` : float, min `0.1`, max `2.0`, défaut `0.8`
- Sortie attendue : `type = "points"`
- Critère de validation :
  - points et liens formant clairement un cœur
  - structure lisible même en petit format
  - scintillement discret

## 9. MorphingHeartContour

- Nom : `morphing_heart_contour`
- But : créer un cœur qui change légèrement de silhouette au fil du temps sans perdre sa forme centrale.
- Fichiers utiles : `numpy`, `math`
- Paramètres :
  - `samples` : int, min `80`, max `2000`, défaut `500`
  - `morph_strength` : float, min `0.0`, max `1.0`, défaut `0.32`
  - `frequency` : float, min `0.5`, max `7.0`, défaut `1.7`
  - `phase` : float, min `0`, max `6.28`, défaut `0.0`
  - `line_width` : float, min `1`, max `12`, défaut `3`
- Sortie attendue : `type = "points"`
- Critère de validation :
  - contour toujours reconnaissable comme un cœur
  - morphing subtil et élégant
  - pas de courbure trop irrégulière

## 10. HeartRoseBloom

- Nom : `heart_rose_bloom`
- But : fusionner le cœur et une rose / fleur centrale en un motif élégant et romantique.
- Fichiers utiles : `numpy`, `math`, `random`
- Paramètres :
  - `petals` : int, min `6`, max `24`, défaut `12`
  - `petal_length` : float, min `10`, max `120`, défaut `48`
  - `bloom_scale` : float, min `0.5`, max `2.0`, défaut `1.0`
  - `heart_scale` : float, min `0.6`, max `2.0`, défaut `1.15`
  - `color_shift` : float, min `0`, max `1`, défaut `0.3`
- Sortie attendue : `type = "points"`
- Critère de validation :
  - fleurs concentriques et cœur central équilibrés
  - pas de pétales décollés ou trop dispersés
  - rendu florissant mais lisible

## 11. HeartFrameSequence

- Nom : `heart_frame_sequence`
- But : produire une séquence d’images animées avec un cœur qui grandit, pulse, puis s’étire légèrement.
- Fichiers utiles : `numpy`, `PIL.Image`, `PIL.ImageDraw`, `colorsys`
- Paramètres :
  - `frames` : int, min `8`, max `180`, défaut `48`
  - `size` : int, min `64`, max `1400`, défaut `512`
  - `start_scale` : float, min `0.4`, max `1.2`, défaut `0.72`
  - `end_scale` : float, min `0.9`, max `1.8`, défaut `1.28`
  - `background` : str, options `["transparent", "dark", "soft-pink"]`, défaut `"transparent"`
- Sortie attendue : `type = "frames"`
- Critère de validation :
  - séquence fluide et répétable
  - aucune frame cassée ou noire
  - taille standardisée pour rendu front-end

## 12. LoveTextConsole

- Nom : `love_text_console`
- But : générer un rendu texte “terminal / console” avec message amoureux, cœur ASCII, et lueur soft.
- Fichiers utiles : `random`, `numpy`
- Paramètres :
  - `lines` : int, min `5`, max `30`, défaut `12`
  - `font_mode` : str, options `["ascii", "block", "minimal"]`, défaut `"ascii"`
  - `message` : str, défaut `"REHAEL DORIA"`
  - `glow` : bool, défaut `True`
  - `padding` : int, min `1`, max `8`, défaut `2`
- Sortie attendue : `type = "texte"`
- Critère de validation :
  - rendu lisible dans un terminal stylé
  - présence d’un cœur ASCII ou d’une variante romantique
  - message centré et cohérent

---

# Template minimal pour un nouvel algorithme

```python
import math
import random
import numpy as np


def run(params):
    width = int(params.get("width", 640))
    height = int(params.get("height", 640))
    seed = int(params.get("seed", 0))
    random.seed(seed)
    np.random.seed(seed)

    # générer les données visuelles ici
    points = []

    for i in range(200):
        x = width / 2 + random.uniform(-120, 120)
        y = height / 2 + random.uniform(-120, 120)
        r = random.uniform(2, 7)
        points.append({
            "x": x,
            "y": y,
            "r": r,
            "color": "#ff6ea8",
            "alpha": 0.8,
        })

    return {
        "type": "points",
        "points": points,
        "palette": ["#ff6ea8", "#ffd1dc", "#ffffff"],
        "duration": 1500,
    }
```

# Règles de dépôt

- déposer chaque fichier Python dans `public/algos/`
- utiliser un nom de fichier lisible : `heart_pulse_points.py`
- garder la fonction `run(params)` comme point d’entrée unique
- utiliser des paramètres simples, typés en Python natif
- ne pas dépendre d’un environnement front spécifique
- privilégier un rendu léger, reproductible et cohérent avec le thème violet / rose / doux
