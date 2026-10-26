"""heart_confetti_burst (algo 6) : des confettis jaillissent du contour d'un coeur.

Simulation image par image : v <- v * friction ; vy <- vy + gravity ; position <- position + v.
Chaque confetti part d'un point du contour, avec une vitesse dirigée vers l'extérieur et une
force tirée au hasard (seed). Les bords du canvas font rebondir (amorti) pour que tout reste
dedans. L'opacité diminue avec l'âge du confetti.
Convention : run(params) -> "points" avec keyframes.
"""
import math
import numpy as np

PARAMS = [
    {"name": "count", "label": "Confettis", "type": "int", "min": 20, "max": 400, "default": 150},
    {"name": "power", "label": "Puissance", "type": "float", "min": 2.0, "max": 20.0, "default": 9.0},
    {"name": "friction", "label": "Frottement", "type": "float", "min": 0.8, "max": 0.99, "default": 0.94},
    {"name": "gravity", "label": "Gravité", "type": "float", "min": 0.0, "max": 0.5, "default": 0.1},
    {"name": "frames", "label": "Images", "type": "int", "min": 20, "max": 120, "default": 48},
    {"name": "size", "label": "Taille", "type": "float", "min": 1.0, "max": 5.0, "default": 2.5},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
]
MAX_POINTS = 12000
COLORS = ["#c4b5fd", "#f9a8d4", "#ffffff", "#a78bfa", "#f472b6", "#ddd6fe"]

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

def pt(x, y, r, alpha, color, nd=1):
    """Un point du rendu 'points', en types natifs, coordonnées arrondies pour alléger le JSON."""
    return {"x": round(float(x), nd), "y": round(float(y), nd), "r": float(r),
            "alpha": round(float(alpha), 3), "color": color}


def margin_of(p, extra=0.0):
    """Marge de sécurité autour du dessin, en pixels."""
    return max(4.0, 0.04 * min(p["width"], p["height"])) + extra


def simulate(p):
    """Renvoie la liste des positions (tableau n x 2 par image), en pixels canvas, + paramètres par confetti."""
    n = p["count"]
    frames = max(1, min(p["frames"], MAX_POINTS // n))
    rng = np.random.default_rng(p["seed"])
    t = rng.uniform(0, 2 * math.pi, n)
    hx, hy = heart_curve(t)
    m = margin_of(p, p["size"] * 1.4)
    lo = np.array([m, m])
    hi = np.array([p["width"] - m, p["height"] - m])
    s = 0.5 * (min(p["width"], p["height"]) / 2 - m) / HEART_HALF  # le coeur de départ occupe la moitié du canvas
    pos = np.column_stack([p["width"] / 2 + s * hx, p["height"] / 2 - s * hy])
    out_dir = np.column_stack([hx, -hy])  # vers l'extérieur, en repère canvas
    out_dir /= np.maximum(np.hypot(out_dir[:, 0], out_dir[:, 1]), 1e-9)[:, None]
    vel = out_dir * (p["power"] * rng.uniform(0.4, 1.0, n))[:, None]
    life = rng.uniform(0.5, 1.0, n)
    radius = p["size"] * rng.uniform(0.6, 1.4, n)
    color_ids = rng.integers(0, len(COLORS), n)

    history = [pos.copy()]
    for _ in range(1, frames):
        vel *= p["friction"]
        vel[:, 1] += p["gravity"]
        pos = pos + vel
        for axis in (0, 1):
            low, high = pos[:, axis] < lo[axis], pos[:, axis] > hi[axis]
            pos[low, axis], pos[high, axis] = lo[axis], hi[axis]
            vel[low | high, axis] *= -0.5
        history.append(pos.copy())
    return history, life, radius, color_ids, frames


def run(params):
    p = read_params(params, PARAMS)
    history, life, radius, color_ids, frames = simulate(p)
    n = p["count"]
    keyframes = []
    for k, pos in enumerate(history):
        age = k / frames
        pts = []
        for i in range(n):
            alpha = max(0.05, 1.0 - (age / life[i]) ** 2) if age < life[i] else 0.05
            pts.append(pt(pos[i, 0], pos[i, 1], radius[i], alpha, COLORS[color_ids[i]]))
        keyframes.append({"points": pts})
    return {"type": "points", "points": keyframes[0]["points"], "keyframes": keyframes,
            "fps": 24, "loop": False, "palette": COLORS[:3], "frames_capped": frames < p["frames"]}
