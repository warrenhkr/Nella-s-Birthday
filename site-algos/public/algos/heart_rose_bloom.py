"""heart_rose_bloom (algo 10) : une fleur de courbes "rose" avec un petit coeur au centre.

Courbe rose : r = cos(k * theta). Avec k impair : k pétales (theta de 0 à pi) ; avec k pair :
2k pétales (theta de 0 à 2*pi). Plusieurs couches de plus en plus petites, tournées les unes
par rapport aux autres, composent la fleur. Chaque couche est un anneau fermé (links).
"""
import math
import numpy as np

PARAMS = [
    {"name": "k", "label": "Paramètre k (pétales)", "type": "int", "min": 2, "max": 12, "default": 5},
    {"name": "layers", "label": "Couches", "type": "int", "min": 1, "max": 6, "default": 4},
    {"name": "samples", "label": "Points par couche", "type": "int", "min": 120, "max": 720, "default": 300},
    {"name": "rotation", "label": "Rotation entre couches (degrés)", "type": "float", "min": 0.0, "max": 90.0, "default": 15.0},
    {"name": "size", "label": "Taille des points", "type": "float", "min": 0.5, "max": 3.0, "default": 1.2},
    {"name": "heart_center", "label": "Coeur au centre", "type": "bool", "default": True},
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
HEART_POINTS = 60
HEART_RATIO = 0.16  # taille du coeur central par rapport au rayon de la fleur


def rose_xy(k, samples):
    """Courbe rose fermée (repère mathématique), rayon maximal 1."""
    period = math.pi if k % 2 == 1 else 2 * math.pi
    theta = np.arange(samples) * (period / samples)
    r = np.cos(k * theta)
    return r * np.cos(theta), r * np.sin(theta)


def run(params):
    p = read_params(params, PARAMS)
    n, layers = p["samples"], p["layers"]
    s = (min(p["width"], p["height"]) / 2 - margin_of(p, p["size"])) 
    cx, cy = p["width"] / 2, p["height"] / 2
    rx, ry = rose_xy(p["k"], n)
    pts, links = [], []
    for j in range(layers):
        scale = s * (1.0 - 0.7 * j / layers)
        rot = math.radians(j * p["rotation"])
        c, sn = math.cos(rot), math.sin(rot)
        x = scale * (rx * c - ry * sn)
        y = scale * (rx * sn + ry * c)
        color_u = j / max(1, layers - 1) if layers > 1 else 0.3
        for i in range(n):
            col = gradient(STOPS, (0.75 * color_u + 0.25 * i / n) % 1.0)
            pts.append(pt(cx + x[i], cy - y[i], p["size"], 0.55 + 0.4 * (1 - j / layers), col))
        base = j * n
        links += [[base + i, base + (i + 1) % n] for i in range(n)]
    if p["heart_center"]:
        t = (np.arange(HEART_POINTS) + 0.5) * (2 * math.pi / HEART_POINTS)
        hx, hy = heart_curve(t)
        u = HEART_RATIO * s / HEART_HALF
        base = len(pts)
        for i in range(HEART_POINTS):
            pts.append(pt(cx + u * hx[i], cy - u * hy[i], p["size"] * 1.3, 1.0, "#ffffff"))
        links += [[base + i, base + (i + 1) % HEART_POINTS] for i in range(HEART_POINTS)]
    return {"type": "points", "points": pts, "links": links, "link_alpha": 0.35, "palette": STOPS,
            "petals": p["k"] if p["k"] % 2 == 1 else 2 * p["k"]}
