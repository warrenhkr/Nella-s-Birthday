"""game_of_life_heart (algo 18) : jeu de la vie de Conway, départ en forme de coeur.

Règles : une cellule naît avec exactement 3 voisines vivantes ; elle survit avec 2 ou 3.
La nouvelle génération est calculée entièrement à partir de l'ancienne (mise à jour
simultanée). Les 8 voisines sont comptées avec np.roll (bords qui bouclent) ou un remplissage
de zéros (bords morts). Arrêt anticipé quand la grille ne change plus.
Convention : run(params) -> "grid", keyframes = une génération par image (0 ou 1).
"""
import math
import numpy as np

PARAMS = [
    {"name": "grid_size", "label": "Taille de la grille", "type": "int", "min": 20, "max": 120, "default": 48},
    {"name": "steps", "label": "Générations", "type": "int", "min": 10, "max": 300, "default": 120},
    {"name": "initial_density", "label": "Densité initiale", "type": "float", "min": 0.05, "max": 0.6, "default": 0.3},
    {"name": "wrap", "label": "Bords qui bouclent", "type": "bool", "default": True},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
]
MAX_CELLS = 300000

def read_params(params, spec):
    """Vérifie les paramètres reçus et renvoie un dict complet (défauts inclus).
    Lève ValueError avec un message clair si une valeur est invalide.
    Types gérés : int, float, bool, str (min/max = longueur), select (options)."""
    full = [
        {"name": "width", "type": "int", "min": 64, "max": 2000, "default": 640},
        {"name": "height", "type": "int", "min": 64, "max": 2000, "default": 640},
    ] + list(spec)
    params = dict(params or {})
    out = {}
    for s in full:
        name, kind = s["name"], s["type"]
        v = params.get(name, s["default"])
        if kind in ("int", "float"):
            if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
                raise ValueError("%s doit être un nombre (reçu : %r)" % (name, v))
            if kind == "int":
                if float(v) != int(v):
                    raise ValueError("%s doit être un entier (reçu : %r)" % (name, v))
                v = int(v)
            else:
                v = float(v)
            if not (s["min"] <= v <= s["max"]):
                raise ValueError("%s doit être entre %s et %s (reçu : %r)" % (name, s["min"], s["max"], v))
        elif kind == "bool":
            if not isinstance(v, bool):
                raise ValueError("%s doit être vrai ou faux (reçu : %r)" % (name, v))
        elif kind == "select":
            if v not in s["options"]:
                raise ValueError("%s doit être l'une des options %s (reçu : %r)" % (name, list(s["options"]), v))
        elif kind == "str":
            if not isinstance(v, str) or not (s["min"] <= len(v) <= s["max"]):
                raise ValueError("%s doit être un texte de %s à %s caractères (reçu : %r)" % (name, s["min"], s["max"], v))
        else:
            raise ValueError("type de paramètre inconnu : %r" % kind)
        out[name] = v
    return out

HEART_HALF = 16.0  # demi-étendue du coeur paramétrique après centrage (|x| et |y| <= 16)
HEART_SHIFT_Y = 2.54  # décalage pour centrer verticalement la courbe du coeur


def heart_curve(t):
    """Coeur paramétrique centré sur (0, 0), repère mathématique (y vers le haut).
    t : ndarray d'angles en radians."""
    x = 16 * np.sin(t) ** 3
    y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t) + HEART_SHIFT_Y
    return x, y


def heart_inside(x, y):
    """Coeur implicite (x, y en repère mathématique, centré en (0, 0.118)) : True à l'intérieur.
    Équation : (x² + y² - 1)³ - x²·y³ <= 0. Étendue : |x| <= 1.139, y entre -1 et 1.236."""
    y = y + 0.118
    return (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0


HEART_IN_HALF = 1.14  # demi-étendue du coeur implicite centré

def heart_mask(g):
    """Masque booléen g x g du coeur (ligne 0 en haut), symétrique gauche-droite."""
    c = (g - 1) / 2
    xs = (np.arange(g) - c) / (g / 2) * HEART_IN_HALF
    ys = -(np.arange(g) - c) / (g / 2) * HEART_IN_HALF  # y vers le haut dans la formule
    X, Y = np.meshgrid(xs, ys)
    return heart_inside(X, Y)

NEIGHBORS = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy, dx) != (0, 0)]


def life_step(grid, wrap):
    """Une génération de Conway. `grid` : tableau 2D de 0/1 ; renvoie un NOUVEAU tableau."""
    g = grid.astype(np.uint8)
    h, w = g.shape
    if wrap:
        count = sum(np.roll(np.roll(g, dy, axis=0), dx, axis=1) for dy, dx in NEIGHBORS)
    else:
        pad = np.pad(g, 1)
        count = sum(pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w] for dy, dx in NEIGHBORS)
    return ((count == 3) | ((g == 1) & (count == 2))).astype(np.uint8)


def run(params):
    p = read_params(params, PARAMS)
    g = p["grid_size"]
    steps = max(1, min(p["steps"], MAX_CELLS // (g * g)))
    rng = np.random.default_rng(p["seed"])
    grid = ((rng.random((g, g)) < p["initial_density"]) & heart_mask(g)).astype(np.uint8)

    generations = [grid]
    stable_at = None
    for i in range(1, steps):
        nxt = life_step(grid, p["wrap"])
        if np.array_equal(nxt, grid):
            stable_at = i - 1  # la grille ne bouge plus à partir de cette génération
            break
        generations.append(nxt)
        grid = nxt
    keyframes = [m.tolist() for m in generations]
    return {
        "type": "grid", "cols": g, "rows": g, "levels": 1,
        "cells": keyframes[0], "keyframes": keyframes, "fps": 10, "loop": False,
        "palette": ["#0f0820", "#f9a8d4"], "stable_at": stable_at,
        "frames_capped": steps < p["steps"],
    }
