"""heart_pulse_points (algo 1) : coeur en points qui pulse, boucle parfaite.

Principe : courbe paramétrique du coeur, répétée en "couches" de plus en plus petites.
Le facteur d'échelle suit 1 + amp * sin(2*pi*k/N) : périodique, donc la boucle est sans saut.
Convention : run(params) -> dict de type "points" avec keyframes (une image par pas).
Canvas : origine en haut à gauche, y vers le bas.
"""
import math
import numpy as np

PARAMS = [
    {"name": "count", "label": "Points par couche", "type": "int", "min": 40, "max": 400, "default": 120},
    {"name": "layers", "label": "Couches", "type": "int", "min": 1, "max": 5, "default": 3},
    {"name": "size", "label": "Taille des points", "type": "float", "min": 0.5, "max": 4.0, "default": 2.0},
    {"name": "pulse", "label": "Amplitude de pulsation", "type": "float", "min": 0.0, "max": 0.25, "default": 0.08},
    {"name": "frames", "label": "Images", "type": "int", "min": 4, "max": 48, "default": 24},
    {"name": "fps", "label": "Images par seconde", "type": "int", "min": 5, "max": 30, "default": 18},
]
MAX_POINTS = 12000  # budget total (points x images) : on réduit les images au besoin

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

STOPS = ["#a78bfa", "#f9a8d4", "#ffffff"]


def run(params):
    p = read_params(params, PARAMS)
    n, layers = p["count"], p["layers"]
    total = n * layers
    frames = max(1, min(p["frames"], MAX_POINTS // total))
    m = margin_of(p, p["size"])
    cx, cy = p["width"] / 2, p["height"] / 2
    s0 = (min(p["width"], p["height"]) / 2 - m) / (HEART_HALF * (1 + p["pulse"]))

    t = (np.arange(n) + 0.5) * (2 * math.pi / n)  # +0.5 : évite le point de rebroussement exact
    hx, hy = heart_curve(t)
    keyframes = []
    for k in range(frames):
        scale = s0 * (1 + p["pulse"] * math.sin(2 * math.pi * k / frames))
        pts = []
        for j in range(layers):
            f = 1.0 - 0.3 * j / layers  # couches de plus en plus petites
            color_u = j / max(1, layers - 1) * 0.6
            for i in range(n):
                u = (color_u + 0.4 * i / n) % 1.0
                pts.append(pt(cx + scale * f * hx[i], cy - scale * f * hy[i], p["size"], 0.55 + 0.45 * (1 - j / layers),
                              gradient(STOPS, u)))
        keyframes.append({"points": pts})
    return {
        "type": "points",
        "points": keyframes[0]["points"],
        "keyframes": keyframes,
        "fps": p["fps"],
        "loop": True,
        "palette": STOPS,
        "frames_capped": frames < p["frames"],
    }
