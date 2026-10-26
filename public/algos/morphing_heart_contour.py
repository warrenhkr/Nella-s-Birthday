"""morphing_heart_contour (algo 9) : un contour qui passe du cercle au coeur et revient.

Chaque point du contour est interpolé entre le cercle et le coeur avec un easing (smoothstep)
dont le temps u = (1 - cos(2*pi*k/N)) / 2 est périodique : la boucle est parfaite. On y ajoute
un bruit harmonique : somme de sinus d'harmoniques ENTIÈRES h (la courbe reste continue et
fermée) dont la phase avance de façon périodique.
Convention : run(params) -> "points" + links (anneau fermé) + keyframes.
"""
import math
import numpy as np

PARAMS = [
    {"name": "samples", "label": "Points du contour", "type": "int", "min": 80, "max": 600, "default": 160},
    {"name": "frames", "label": "Images", "type": "int", "min": 12, "max": 60, "default": 30},
    {"name": "harmonics", "label": "Harmoniques du bruit", "type": "int", "min": 1, "max": 8, "default": 4},
    {"name": "noise", "label": "Intensité du bruit", "type": "float", "min": 0.0, "max": 1.0, "default": 0.35},
    {"name": "size", "label": "Taille des points", "type": "float", "min": 0.5, "max": 4.0, "default": 1.6},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
]
MAX_POINTS = 12000
CIRCLE_RADIUS = 14.0

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

STOPS = ["#a78bfa", "#f9a8d4", "#ffffff", "#f9a8d4", "#a78bfa"]


def smoothstep(u):
    return u * u * (3 - 2 * u)


def build(p):
    """Renvoie (n_images, shape_at) ; shape_at(k) -> (x, y) en repère mathématique, avant mise à l'échelle."""
    n_pts = p["samples"]
    n = max(1, min(p["frames"], MAX_POINTS // n_pts))
    rng = np.random.default_rng(p["seed"])
    phases = rng.uniform(0, 2 * math.pi, p["harmonics"])
    speeds = rng.integers(1, 3, size=p["harmonics"])  # entiers : périodique en k
    t = (np.arange(n_pts) + 0.5) * (2 * math.pi / n_pts)
    hx, hy = heart_curve(t)
    cxr, cyr = CIRCLE_RADIUS * np.sin(t), CIRCLE_RADIUS * np.cos(t)

    def shape_at(k):
        u = (1 - math.cos(2 * math.pi * k / n)) / 2
        e = smoothstep(u)
        x, y = lerp(cxr, hx, e), lerp(cyr, hy, e)
        wobble = np.zeros(n_pts)
        for h in range(1, p["harmonics"] + 1):
            wobble += np.sin(h * t + phases[h - 1] + 2 * math.pi * speeds[h - 1] * k / n) / h
        f = 1 + 0.07 * p["noise"] * wobble
        return x * f, y * f

    return n, shape_at


def run(params):
    p = read_params(params, PARAMS)
    n, shape_at = build(p)
    shapes = [shape_at(k) for k in range(n)]
    extent = max(max(np.abs(x).max(), np.abs(y).max()) for x, y in shapes)
    s = (min(p["width"], p["height"]) / 2 - margin_of(p, p["size"])) / extent
    cx, cy = p["width"] / 2, p["height"] / 2
    n_pts = p["samples"]
    colors = [gradient(STOPS, i / n_pts) for i in range(n_pts)]
    keyframes = []
    for x, y in shapes:
        keyframes.append({"points": [pt(cx + s * x[i], cy - s * y[i], p["size"], 0.95, colors[i]) for i in range(n_pts)]})
    links = [[i, (i + 1) % n_pts] for i in range(n_pts)]
    return {"type": "points", "points": keyframes[0]["points"], "links": links, "link_alpha": 0.5,
            "keyframes": keyframes, "fps": 20, "loop": True, "palette": STOPS[:3]}
