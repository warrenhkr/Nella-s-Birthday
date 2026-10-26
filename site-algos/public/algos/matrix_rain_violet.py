"""matrix_rain_violet (algo 14) : pluie de pixels violets qui tombent en colonnes.

Chaque colonne a 2 "emplacements" de goutte (actifs avec probabilité density). Une goutte
parcourt le cycle rows + tail et fait m tours complets pendant la boucle : après `steps`
images, tout est revenu au point de départ (boucle sans saut). Calcul en entiers : exact.
Convention : run(params) -> dict de type "grid", keyframes = une matrice par pas de temps,
valeurs entières de 0 (éteint) à 100 (tête de la goutte).
"""
import math
import numpy as np

PARAMS = [
    {"name": "cols", "label": "Colonnes", "type": "int", "min": 16, "max": 80, "default": 40},
    {"name": "rows", "label": "Lignes", "type": "int", "min": 16, "max": 60, "default": 30},
    {"name": "density", "label": "Densité", "type": "float", "min": 0.05, "max": 0.6, "default": 0.25},
    {"name": "tail", "label": "Longueur de traînée", "type": "int", "min": 3, "max": 20, "default": 8},
    {"name": "steps", "label": "Images", "type": "int", "min": 20, "max": 200, "default": 80},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
]
MAX_CELLS = 300000  # budget : cols x rows x images
SLOTS = 2

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


def trail_column(head, rows, tail):
    """Intensités (0-100) d'une colonne dont la tête est à la ligne `head`."""
    col = [0] * rows
    for d in range(tail):
        r = head - d
        if 0 <= r < rows:
            col[r] = int(round(100 * (1 - d / tail)))
    return col


def build(p):
    """Renvoie (n_images, frame_at) ; frame_at(t) donne la matrice rows x cols à l'instant t."""
    cols, rows, tail = p["cols"], p["rows"], p["tail"]
    n = max(1, min(p["steps"], MAX_CELLS // (cols * rows)))
    cycle = rows + tail
    rng = np.random.default_rng(p["seed"])
    active = rng.random((cols, SLOTS)) < p["density"]
    offset = rng.integers(0, cycle, size=(cols, SLOTS))
    laps = rng.integers(1, 4, size=(cols, SLOTS))

    def frame_at(t):
        grid = np.zeros((rows, cols), dtype=np.int64)
        for c in range(cols):
            for s in range(SLOTS):
                if not active[c, s]:
                    continue
                # position exacte en entiers : revient à l'identique quand t = n
                head = int(((offset[c, s] * n + cycle * laps[c, s] * t) % (cycle * n)) // n)
                col = np.array(trail_column(head, rows, tail))
                grid[:, c] = np.maximum(grid[:, c], col)
        return grid

    return n, frame_at


def run(params):
    p = read_params(params, PARAMS)
    n, frame_at = build(p)
    keyframes = [frame_at(t).tolist() for t in range(n)]
    return {
        "type": "grid", "cols": p["cols"], "rows": p["rows"], "levels": 100,
        "cells": keyframes[0], "keyframes": keyframes, "fps": 14, "loop": True,
        "palette": ["#0f0820", "#6d28d9", "#c4b5fd", "#ffffff"],
        "frames_capped": n < p["steps"],
    }
