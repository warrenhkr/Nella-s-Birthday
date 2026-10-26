"""heart_wave_ribbon (algo 4) : ruban ondulé qui suit le contour du coeur.

On calcule la normale à la courbe (vers l'extérieur), puis on décale chaque point le long de
cette normale d'une quantité largeur + amplitude * sin(vagues * t + phase).
Deux bords (+largeur et -largeur) forment le ruban ; la phase avance pour l'animation.
Convention : run(params) -> "points" + links (paires d'indices) + keyframes.
"""
import math
import numpy as np

PARAMS = [
    {"name": "samples", "label": "Points par bord", "type": "int", "min": 60, "max": 600, "default": 160},
    {"name": "amplitude", "label": "Amplitude (px)", "type": "float", "min": 0.0, "max": 30.0, "default": 10.0},
    {"name": "waves", "label": "Nombre de vagues", "type": "int", "min": 2, "max": 30, "default": 12},
    {"name": "width_ribbon", "label": "Largeur du ruban (px)", "type": "float", "min": 2.0, "max": 30.0, "default": 10.0},
    {"name": "size", "label": "Taille des points", "type": "float", "min": 0.5, "max": 4.0, "default": 1.6},
    {"name": "link_alpha", "label": "Opacité des liens", "type": "float", "min": 0.1, "max": 1.0, "default": 0.6},
    {"name": "frames", "label": "Images", "type": "int", "min": 4, "max": 48, "default": 20},
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


def _normals(t):
    """Normale unitaire sortante (repère mathématique) de la courbe du coeur."""
    dx = 48 * np.sin(t) ** 2 * np.cos(t)
    dy = -13 * np.sin(t) + 10 * np.sin(2 * t) + 6 * np.sin(3 * t) + 4 * np.sin(4 * t)
    norm = np.maximum(np.hypot(dx, dy), 1e-9)
    return -dy / norm, dx / norm  # le coeur est parcouru dans le sens horaire


def run(params):
    p = read_params(params, PARAMS)
    n = p["samples"]
    frames = max(1, min(p["frames"], MAX_POINTS // (2 * n)))
    m = margin_of(p, p["size"] + p["amplitude"] + p["width_ribbon"])
    cx, cy = p["width"] / 2, p["height"] / 2
    s = (min(p["width"], p["height"]) / 2 - m) / HEART_HALF

    t = (np.arange(n) + 0.5) * (2 * math.pi / n)
    hx, hy = heart_curve(t)
    nx, ny = _normals(t)
    colors = [gradient(STOPS, i / n) for i in range(n)]

    keyframes = []
    for k in range(frames):
        phase = 2 * math.pi * k / frames
        wave = p["amplitude"] * np.sin(p["waves"] * t + phase)
        pts = []
        for side in (1, -1):
            off = side * p["width_ribbon"] + wave
            xs = cx + s * hx + off * nx
            ys = cy - (s * hy + off * ny)
            pts += [pt(xs[i], ys[i], p["size"], 0.9, colors[i]) for i in range(n)]
        keyframes.append({"points": pts})
    links = [[i, (i + 1) % n] for i in range(n)] + [[n + i, n + (i + 1) % n] for i in range(n)]
    return {
        "type": "points", "points": keyframes[0]["points"], "links": links,
        "link_alpha": p["link_alpha"], "keyframes": keyframes, "fps": 20, "loop": True,
        "palette": STOPS,
    }
