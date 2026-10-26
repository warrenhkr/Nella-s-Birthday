"""heart_grid_pulse (algo 5) : coeur en grille, avec une onde qui part du centre.

Un masque booléen (équation implicite du coeur) délimite la forme. L'intensité d'une case
vaut 0.5 + 0.5 * sin(2*pi * (distance / longueur_d_onde - k / N)) : une onde qui s'éloigne
du centre et dont la phase est périodique en k (boucle parfaite).
Convention : run(params) -> "grid" avec `mask` (1 = case du coeur) et keyframes (0 à 100).
"""
import math
import numpy as np

PARAMS = [
    {"name": "grid_size", "label": "Taille de la grille", "type": "int", "min": 16, "max": 120, "default": 48},
    {"name": "frames", "label": "Images", "type": "int", "min": 12, "max": 60, "default": 30},
    {"name": "wavelength", "label": "Longueur d'onde (cases)", "type": "float", "min": 2.0, "max": 30.0, "default": 8.0},
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


def build(p):
    g = p["grid_size"]
    n = max(1, min(p["frames"], MAX_CELLS // (g * g)))
    mask = heart_mask(g)
    c = (g - 1) / 2
    yy, xx = np.mgrid[0:g, 0:g]
    dist = np.hypot(xx - c, yy - c)

    def frame_at(k):
        wave = 0.5 + 0.5 * np.sin(2 * math.pi * (dist / p["wavelength"] - k / n))
        return np.where(mask, np.rint(100 * wave), 0).astype(np.int64)

    return n, frame_at, mask


def run(params):
    p = read_params(params, PARAMS)
    n, frame_at, mask = build(p)
    keyframes = [frame_at(k).tolist() for k in range(n)]
    g = p["grid_size"]
    return {
        "type": "grid", "cols": g, "rows": g, "levels": 100,
        "mask": mask.astype(int).tolist(), "cells": keyframes[0], "keyframes": keyframes,
        "fps": 14, "loop": True, "palette": ["#2e1065", "#a78bfa", "#f9a8d4", "#ffffff"],
        "frames_capped": n < p["frames"],
    }
