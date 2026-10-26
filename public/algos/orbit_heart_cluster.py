"""orbit_heart_cluster (algo 3) : des petits coeurs qui tournent sur des anneaux.

L'anneau j a le rayon (j+1)/rings * R_max ; le coeur i de l'anneau est à l'angle
phase_j + 2*pi*i/hearts + sens_j * 2*pi*speed*k/N (angle calculé directement, sans cumul).
Chaque petit coeur est tourné avec l'orbite pour que sa pointe vise le centre.
Les anneaux tournent en sens inverse l'un de l'autre. Boucle parfaite (speed entier).
Convention : run(params) -> "points" avec keyframes.
"""
import math
import numpy as np

PARAMS = [
    {"name": "rings", "label": "Anneaux", "type": "int", "min": 1, "max": 4, "default": 2},
    {"name": "hearts", "label": "Coeurs par anneau", "type": "int", "min": 3, "max": 16, "default": 6},
    {"name": "points_per_heart", "label": "Points par coeur", "type": "int", "min": 12, "max": 60, "default": 16},
    {"name": "heart_size", "label": "Taille d'un coeur (px)", "type": "float", "min": 6.0, "max": 40.0, "default": 18.0},
    {"name": "speed", "label": "Tours par boucle", "type": "int", "min": 1, "max": 3, "default": 1},
    {"name": "frames", "label": "Images", "type": "int", "min": 12, "max": 96, "default": 36},
    {"name": "size", "label": "Taille des points", "type": "float", "min": 0.5, "max": 3.0, "default": 1.4},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
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

RING_COLORS = ["#c4b5fd", "#f9a8d4", "#ffffff", "#a78bfa"]


def rotate(p, center, theta):
    """Tourne le point p = (x, y) de theta radians (sens trigonométrique) autour de center."""
    dx, dy = p[0] - center[0], p[1] - center[1]
    c, s = math.cos(theta), math.sin(theta)
    return center[0] + dx * c - dy * s, center[1] + dx * s + dy * c


def run(params):
    p = read_params(params, PARAMS)
    rings, hearts, m = p["rings"], p["hearts"], p["points_per_heart"]
    total = rings * hearts * m
    n = max(1, min(p["frames"], MAX_POINTS // total))
    margin = margin_of(p, p["size"])
    r_max = min(p["width"], p["height"]) / 2 - margin - 0.6 * p["heart_size"]
    # r_max reste > 0 : canvas >= 64 px, heart_size <= 40, marge <= 7 px
    cx, cy = p["width"] / 2, p["height"] / 2
    rng = np.random.default_rng(p["seed"])
    phases = rng.uniform(0, 2 * math.pi, rings)

    t = (np.arange(m) + 0.5) * (2 * math.pi / m)
    hx, hy = heart_curve(t)
    unit = p["heart_size"] / (2 * HEART_HALF)  # pixels par unité du coeur
    colors = [gradient([RING_COLORS[j % 4], "#ffffff"], 0.35 * i / m) for j in range(rings) for i in range(m)]

    keyframes = []
    for k in range(n):
        pts = []
        for j in range(rings):
            radius = (j + 1) / rings * r_max
            direction = 1 if j % 2 == 0 else -1
            for i in range(hearts):
                theta = phases[j] + 2 * math.pi * i / hearts + direction * 2 * math.pi * p["speed"] * k / n
                ox, oy = radius * math.cos(theta), radius * math.sin(theta)
                for q in range(m):
                    # pointe du coeur (0, -1) tournée vers le centre : angle theta + 3*pi/2
                    x, y = rotate((hx[q] * unit, hy[q] * unit), (0.0, 0.0), theta + 1.5 * math.pi)
                    pts.append(pt(cx + ox + x, cy - (oy + y), p["size"], 0.9, colors[j * m + q]))
        keyframes.append({"points": pts})
    return {"type": "points", "points": keyframes[0]["points"], "keyframes": keyframes,
            "fps": 20, "loop": True, "palette": RING_COLORS[:3], "frames_capped": n < p["frames"]}
