"""lsystem_heart_tree (algo 23) : arbre fractal (L-système) dont les bouts de branches sont des coeurs.

L-système : axiome "F", règle F -> F[+F][-F] appliquée `iterations` fois (réécriture SIMULTANÉE :
on construit une nouvelle chaîne à chaque étape). Interprétation "tortue" : F trace un segment,
+ / - tournent, [ sauvegarde la position (pile), ] la restaure. La longueur d'une branche est
length_ratio ^ profondeur, la profondeur étant la hauteur de la pile. Un petit aléa sur l'angle
(seed) rend l'arbre naturel. Comme la règle réécrit AUSSI le F du tronc, le nombre de segments F vaut 3^iterations
(le tronc s'allonge de segments) ; extrémités (F de profondeur maximale) : 2^iterations.
Convention : run(params) -> "points" + links (segments, indices des points de l'arbre uniquement).
"""
import math
import numpy as np

PARAMS = [
    {"name": "iterations", "label": "Itérations", "type": "int", "min": 1, "max": 7, "default": 5},
    {"name": "angle", "label": "Angle (degrés)", "type": "float", "min": 10.0, "max": 45.0, "default": 22.0},
    {"name": "length_ratio", "label": "Rapport des longueurs", "type": "float", "min": 0.5, "max": 0.9, "default": 0.72},
    {"name": "leaf_size", "label": "Taille des coeurs (px)", "type": "float", "min": 3.0, "max": 16.0, "default": 8.0},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
]
RULES = {"F": "F[+F][-F]"}
JITTER = 0.15  # variation relative de l'angle
LEAF_POINTS = 14

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


def expand(axiom, rules, n):
    s = axiom
    for _ in range(n):
        s = "".join(rules.get(ch, ch) for ch in s)  # nouvelle chaîne : pas de modification en cours de route
    return s


def turtle(s, angle, ratio, iterations, rng):
    """Interprète la chaîne. Renvoie (noeuds (x, y, profondeur), segments (i, j), indices des extrémités)."""
    x = y = 0.0
    heading = math.pi / 2
    stack = []
    nodes = [(0.0, 0.0, 0)]
    cur = 0
    links, tips = [], []
    for ch in s:
        if ch == "F":
            depth = len(stack)
            length = ratio ** depth
            x += length * math.cos(heading)
            y += length * math.sin(heading)
            nodes.append((x, y, depth))
            links.append((cur, len(nodes) - 1))
            cur = len(nodes) - 1
            if depth == iterations:
                tips.append(cur)
        elif ch in "+-":
            turn = math.radians(angle) * (1 + JITTER * (2 * rng.random() - 1))
            heading += turn if ch == "+" else -turn
        elif ch == "[":
            stack.append((x, y, heading, cur))
        elif ch == "]":
            x, y, heading, cur = stack.pop()
    return nodes, links, tips


def build(p):
    import random
    rng = random.Random(p["seed"])
    s = expand("F", RULES, p["iterations"])
    nodes, links, tips = turtle(s, p["angle"], p["length_ratio"], p["iterations"], rng)
    xs = np.array([q[0] for q in nodes])
    ys = np.array([q[1] for q in nodes])
    m = margin_of(p, 0.6 * p["leaf_size"] + 1.0)
    bw, bh = max(xs.max() - xs.min(), 1e-9), max(ys.max() - ys.min(), 1e-9)
    scale = min((p["width"] - 2 * m) / bw, (p["height"] - 2 * m) / bh)
    px = p["width"] / 2 + scale * (xs - (xs.max() + xs.min()) / 2)
    py = p["height"] - m - scale * (ys - ys.min())
    return {"string": s, "px": px, "py": py, "depth": [q[2] for q in nodes], "links": links, "tips": tips}


def run(params):
    p = read_params(params, PARAMS)
    b = build(p)
    pts = []
    for i, d in enumerate(b["depth"]):
        col = gradient(["#ddd6fe", "#c4b5fd", "#a78bfa"], d / max(1, p["iterations"]))
        pts.append(pt(b["px"][i], b["py"][i], max(0.9, 3.0 * p["length_ratio"] ** d), 0.9, col))
    t = (np.arange(LEAF_POINTS) + 0.5) * (2 * math.pi / LEAF_POINTS)
    hx, hy = heart_curve(t)
    u = p["leaf_size"] / (2 * HEART_HALF)
    for tip in b["tips"]:
        for q in range(LEAF_POINTS):
            col = gradient(["#f9a8d4", "#f472b6"], q / LEAF_POINTS)
            pts.append(pt(b["px"][tip] + u * hx[q], b["py"][tip] - u * hy[q], 1.2, 1.0, col))
    return {"type": "points", "points": pts, "links": [[a, c] for a, c in b["links"]], "link_alpha": 0.8,
            "palette": ["#c4b5fd", "#f9a8d4", "#ffffff"], "branches": len(b["links"]), "tips": len(b["tips"])}
