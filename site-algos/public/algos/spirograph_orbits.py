"""spirograph_orbits (algo 15) : hypotrochoïde (spirographe) en dégradé violet.

x(t) = (R - r) cos t + d cos(((R - r) / r) t)
y(t) = (R - r) sin t - d sin(((R - r) / r) t)
La courbe se referme après r / pgcd(R, r) tours, donc t va de 0 à 2*pi*r/pgcd(R, r).
Convention : run(params) -> "points" + links (la courbe est tracée d'un trait).
"""
import math
import numpy as np

PARAMS = [
    {"name": "R", "label": "Grand cercle R", "type": "int", "min": 40, "max": 200, "default": 120},
    {"name": "r", "label": "Petit cercle r", "type": "int", "min": 5, "max": 120, "default": 47},
    {"name": "d", "label": "Distance du stylo d", "type": "float", "min": 5.0, "max": 150.0, "default": 70.0},
    {"name": "samples", "label": "Échantillons", "type": "int", "min": 300, "max": 4000, "default": 1500},
    {"name": "hue_shift", "label": "Décalage de teinte", "type": "float", "min": 0.0, "max": 1.0, "default": 0.2},
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
    R, r, d, n = p["R"], p["r"], p["d"], p["samples"]
    g = math.gcd(R, r)
    turns = r // g  # nombre de tours avant fermeture
    t = np.linspace(0, 2 * math.pi * turns, n)  # extrémité incluse : premier point = dernier point
    k = (R - r) / r
    x = (R - r) * np.cos(t) + d * np.cos(k * t)
    y = (R - r) * np.sin(t) - d * np.sin(k * t)

    extent = abs(R - r) + d  # |x| et |y| ne dépassent jamais cette valeur
    m = margin_of(p, 2.0)
    s = (min(p["width"], p["height"]) / 2 - m) / extent
    cx, cy = p["width"] / 2, p["height"] / 2

    pts = []
    for i in range(n):
        u = (i / (n - 1) + p["hue_shift"]) % 1.0
        tri = 1 - abs(2 * u - 1)  # va et vient : pas de saut de couleur
        pts.append(pt(cx + s * x[i], cy - s * y[i], 1.4, 0.95, gradient(STOPS, tri), nd=2))
    links = [[i, i + 1] for i in range(n - 1)]
    return {"type": "points", "points": pts, "links": links, "link_alpha": 0.5, "palette": STOPS, "turns": int(turns)}
