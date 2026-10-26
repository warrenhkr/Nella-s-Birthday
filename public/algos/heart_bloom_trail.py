"""heart_bloom_trail (algo 2) : des lumières qui parcourent le coeur en laissant une traînée.

L'historique des positions de chaque tête est gardé dans une deque(maxlen=trail) : les plus
anciennes sortent toutes seules. L'opacité décroît avec l'âge, et la taille GRANDIT avec l'âge
(effet "floraison"). On remplit d'abord la deque avec les positions d'avant l'image 0 (la fin
du tour précédent) : la boucle est donc sans saut.
Convention : run(params) -> "points" avec keyframes (points rangés par tête, puis par âge).
"""
import math
from collections import deque
import numpy as np

PARAMS = [
    {"name": "heads", "label": "Têtes lumineuses", "type": "int", "min": 1, "max": 6, "default": 2},
    {"name": "trail", "label": "Longueur de traînée", "type": "int", "min": 5, "max": 80, "default": 30},
    {"name": "frames", "label": "Images par tour", "type": "int", "min": 24, "max": 120, "default": 60},
    {"name": "size", "label": "Taille de la tête", "type": "float", "min": 1.0, "max": 6.0, "default": 3.0},
    {"name": "bloom", "label": "Floraison", "type": "float", "min": 0.0, "max": 3.0, "default": 1.0},
]
MAX_POINTS = 12000
STOPS = ["#ffffff", "#f9a8d4", "#a78bfa"]

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

def pt(x, y, r, alpha, color, nd=1):
    """Un point du rendu 'points', en types natifs, coordonnées arrondies pour alléger le JSON."""
    return {"x": round(float(x), nd), "y": round(float(y), nd), "r": float(r),
            "alpha": round(float(alpha), 3), "color": color}


def margin_of(p, extra=0.0):
    """Marge de sécurité autour du dessin, en pixels."""
    return max(4.0, 0.04 * min(p["width"], p["height"])) + extra


def run(params):
    p = read_params(params, PARAMS)
    heads, trail = p["heads"], p["trail"]
    n = max(1, min(p["frames"], MAX_POINTS // (heads * trail)))
    m = margin_of(p, p["size"] * (1 + p["bloom"]))
    s = (min(p["width"], p["height"]) / 2 - m) / HEART_HALF
    cx, cy = p["width"] / 2, p["height"] / 2

    def position(h, k):
        t = 2 * math.pi * (h / heads + k / n) + 1e-3  # petit décalage : évite le point de rebroussement exact
        x, y = heart_curve(np.array([t]))
        return cx + s * float(x[0]), cy - s * float(y[0])

    queues = [deque(maxlen=trail) for _ in range(heads)]
    for k in range(-(trail - 1), 0):  # avant l'image 0 : fin du tour précédent
        for h in range(heads):
            queues[h].appendleft(position(h, k))
    keyframes = []
    for k in range(n):
        pts = []
        for h in range(heads):
            queues[h].appendleft(position(h, k))  # index 0 = la plus récente
            for age, (x, y) in enumerate(queues[h]):
                u = age / trail
                pts.append(pt(x, y, p["size"] * (1 + p["bloom"] * u), (1 - u) ** 1.5, gradient(STOPS, u)))
        keyframes.append({"points": pts})
    return {"type": "points", "points": keyframes[0]["points"], "keyframes": keyframes,
            "fps": 24, "loop": True, "palette": STOPS, "frames_capped": n < p["frames"]}
