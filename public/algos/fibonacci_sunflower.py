"""fibonacci_sunflower (algo 13) : tournesol de points placés selon l'angle d'or.

Le point numéro k est à l'angle k * angle (calculé directement, sans cumul d'erreurs)
et au rayon c * sqrt(k + 0.5) : l'aire par point reste constante, d'où une densité régulière.
Convention : run(params) -> dict de type "points" (keyframes si frames > 1 : rotation lente).
"""
import math
import numpy as np

PARAMS = [
    {"name": "count", "label": "Nombre de points", "type": "int", "min": 100, "max": 3000, "default": 900},
    {"name": "angle", "label": "Angle (degrés)", "type": "float", "min": 100.0, "max": 180.0, "default": 137.5},
    {"name": "spread", "label": "Écartement", "type": "float", "min": 2.0, "max": 14.0, "default": 7.0},
    {"name": "size", "label": "Taille des points", "type": "float", "min": 1.0, "max": 8.0, "default": 3.0},
    {"name": "palette_mode", "label": "Palette", "type": "select", "options": ["rose", "violet", "mixte"], "default": "violet"},
    {"name": "frames", "label": "Images de rotation (1 = fixe)", "type": "int", "min": 1, "max": 24, "default": 1},
]
MAX_POINTS = 12000

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

def lerp(a, b, t):
    return a + (b - a) * t


def hex_to_rgb(h):
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def rgb_to_hex(r, g, b):
    return "#%02x%02x%02x" % (int(round(r)), int(round(g)), int(round(b)))


def gradient(stops, u):
    """Dégradé par morceaux entre des couleurs hexadécimales, u entre 0 et 1."""
    u = min(1.0, max(0.0, u))
    pos = u * (len(stops) - 1)
    i = min(int(pos), len(stops) - 2)
    t = pos - i
    a, b = hex_to_rgb(stops[i]), hex_to_rgb(stops[i + 1])
    return rgb_to_hex(*(lerp(a[k], b[k], t) for k in range(3)))

def pt(x, y, r, alpha, color, nd=1):
    """Un point du rendu 'points', en types natifs, coordonnées arrondies pour alléger le JSON."""
    return {"x": round(float(x), nd), "y": round(float(y), nd), "r": float(r),
            "alpha": round(float(alpha), 3), "color": color}


def margin_of(p, extra=0.0):
    """Marge de sécurité autour du dessin, en pixels."""
    return max(4.0, 0.04 * min(p["width"], p["height"])) + extra

STOPS = {
    "rose": ["#f9a8d4", "#ec4899", "#fbcfe8"],
    "violet": ["#c4b5fd", "#8b5cf6", "#ddd6fe"],
    "mixte": ["#a78bfa", "#f472b6", "#ffffff"],
}


def run(params):
    p = read_params(params, PARAMS)
    n = p["count"]
    frames = max(1, min(p["frames"], MAX_POINTS // n))
    m = margin_of(p, p["size"])
    cx, cy = p["width"] / 2, p["height"] / 2
    r_max = min(p["width"], p["height"]) / 2 - m
    c = min(p["spread"], r_max / math.sqrt(n - 0.5))  # plafonné : tout reste dans le canvas

    k = np.arange(n)
    radius = c * np.sqrt(k + 0.5)
    theta = np.radians(p["angle"]) * k
    stops = STOPS[p["palette_mode"]]
    colors = [gradient(stops, i / (n - 1)) for i in range(n)]
    alphas = 0.6 + 0.4 * (k / (n - 1))

    keyframes = []
    for f in range(frames):
        rot = 2 * math.pi * f / frames
        xs = cx + radius * np.cos(theta + rot)
        ys = cy + radius * np.sin(theta + rot)
        keyframes.append({"points": [pt(xs[i], ys[i], p["size"], alphas[i], colors[i]) for i in range(n)]})
    out = {"type": "points", "points": keyframes[0]["points"], "palette": stops}
    if frames > 1:
        out.update({"keyframes": keyframes, "fps": 20, "loop": True})
    return out
