"""cohort_retention_heatmap : rétention des clients par cohorte (carte de chaleur).

Une cohorte = les clients qui se sont inscrits le même mois. Pour chaque cohorte, on suit la part qui reste active
1, 2, 3… mois plus tard. Au mois 0, la rétention vaut 100 %. Les cohortes récentes ont moins de recul : la partie
inférieure droite du tableau est vide (triangle). Modèle : exp(-decay * mois), amélioré peu à peu (produit qui s'améliore).
Convention : run(params) -> "grid" : cells = pourcentages entiers (0 à 100), mask = 1 si la case est observée.
"""
import math
import numpy as np

PARAMS = [
    {"name": "cohorts", "label": "Cohortes (mois)", "type": "int", "min": 4, "max": 12, "default": 8},
    {"name": "periods", "label": "Mois de suivi", "type": "int", "min": 4, "max": 12, "default": 8},
    {"name": "decay", "label": "Vitesse de perte", "type": "float", "min": 0.1, "max": 1.0, "default": 0.35},
    {"name": "improvement", "label": "Amélioration par cohorte (%)", "type": "float", "min": 0.0, "max": 10.0, "default": 3.0},
    {"name": "noise", "label": "Bruit (points)", "type": "float", "min": 0.0, "max": 5.0, "default": 1.5},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
]

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


def make_matrix(p):
    """Renvoie (valeurs en % [cohortes x périodes], masque d'observation)."""
    rng = np.random.default_rng(p["seed"])
    n, m = p["cohorts"], p["periods"]
    values = np.zeros((n, m), dtype=float)
    mask = np.zeros((n, m), dtype=int)
    for i in range(n):
        decay = p["decay"] * (1 - p["improvement"] / 100) ** i
        prev = 100.0
        for j in range(m):
            if j == 0:
                v = 100.0
            else:
                v = 100.0 * math.exp(-decay * j) + p["noise"] * rng.standard_normal()
                v = min(prev, max(0.0, v))  # la rétention ne remonte jamais
            prev = v
            values[i, j] = v
            mask[i, j] = 1 if j < max(0, m - i) else 0
    return values, mask


def run(params):
    p = read_params(params, PARAMS)
    values, mask = make_matrix(p)
    cells = np.where(mask == 1, np.rint(values), 0).astype(int)
    avg = [round(float(np.mean([values[i, j] for i in range(p["cohorts"]) if mask[i, j]])), 1) for j in range(p["periods"]) if mask[:, j].any()]
    return {"type": "grid", "cols": p["periods"], "rows": p["cohorts"], "levels": 100, "mask": mask.tolist(), "cells": cells.tolist(),
            "palette": ["#0f172a", "#1e3a8a", "#0d9488", "#fcd34d"],
            "row_labels": ["Cohorte M%d" % (i + 1) for i in range(p["cohorts"])], "col_labels": ["M+%d" % j for j in range(p["periods"])],
            "average_by_period": avg}
