"""heart_constellation_map (algo 8) : des étoiles dans un coeur, reliées par un arbre couvrant minimal.

Étapes : (1) tirer des points dans le coeur (rejection sampling) ; (2) calculer toutes les
distances par paires avec numpy (broadcasting) ; (3) trier les arêtes par longueur ; (4) algorithme
de KRUSKAL avec UNION-FIND : on garde une arête si ses extrémités sont dans des groupes différents.
On s'arrête à n - 1 arêtes. `extra_links` ajoute les plus courtes arêtes refusées (des cycles),
pour une constellation moins "arbre".
Complexité : O(n²) en mémoire pour les distances (n <= 400 : 80 000 paires, sans souci).
"""
import math
import numpy as np

PARAMS = [
    {"name": "count", "label": "Étoiles", "type": "int", "min": 20, "max": 400, "default": 120},
    {"name": "size", "label": "Taille des étoiles", "type": "float", "min": 0.5, "max": 4.0, "default": 1.8},
    {"name": "link_alpha", "label": "Opacité des liens", "type": "float", "min": 0.1, "max": 1.0, "default": 0.5},
    {"name": "extra_links", "label": "Liens en plus (part)", "type": "float", "min": 0.0, "max": 0.5, "default": 0.15},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
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

STOPS = ["#ffffff", "#f9a8d4", "#a78bfa"]


class UnionFind:
    """Groupes disjoints avec compression de chemin et union par taille."""

    def __init__(self, n):
        self.parent = list(range(n))
        self.size = [1] * n

    def find(self, x):
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[x] != root:  # compression de chemin
            self.parent[x], x = root, self.parent[x]
        return root

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        if self.size[ra] < self.size[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        self.size[ra] += self.size[rb]
        return True


def kruskal(xy, extra=0):
    """Renvoie (arêtes de l'arbre, arêtes en plus) sous forme de listes de paires (i, j) avec i < j."""
    n = len(xy)
    diff = xy[:, None, :] - xy[None, :, :]
    dist = np.hypot(diff[:, :, 0], diff[:, :, 1])
    iu, ju = np.triu_indices(n, 1)
    order = np.argsort(dist[iu, ju], kind="stable")  # stable : résultat déterministe
    uf = UnionFind(n)
    tree, more = [], []
    for e in order:
        i, j = int(iu[e]), int(ju[e])
        if uf.union(i, j):
            tree.append((i, j))
        elif len(more) < extra:
            more.append((i, j))
        if len(tree) == n - 1 and len(more) >= extra:
            break
    return tree, more


def sample_heart(rng, n):
    out, have = [], 0
    while have < n:
        x = rng.uniform(-HEART_IN_HALF, HEART_IN_HALF, 2 * n)
        y = rng.uniform(-1.12, 1.12, 2 * n)
        keep = heart_inside(x, y)
        out.append(np.column_stack([x[keep], y[keep]]))
        have += int(keep.sum())
    return np.concatenate(out)[:n]


def run(params):
    p = read_params(params, PARAMS)
    n = p["count"]
    rng = np.random.default_rng(p["seed"])
    xy = sample_heart(rng, n)
    s = (min(p["width"], p["height"]) / 2 - margin_of(p, 1.5 * p["size"])) / HEART_IN_HALF
    px = np.column_stack([p["width"] / 2 + s * xy[:, 0], p["height"] / 2 - s * xy[:, 1]])
    tree, more = kruskal(px, extra=int(round(p["extra_links"] * n)))
    radii = p["size"] * rng.uniform(0.6, 1.5, n)
    alphas = rng.uniform(0.6, 1.0, n)
    pts = [pt(px[i, 0], px[i, 1], radii[i], alphas[i], gradient(STOPS, min(1.0, math.hypot(*xy[i]) / 1.15))) for i in range(n)]
    links = [[a, b] for a, b in tree + more]
    return {"type": "points", "points": pts, "links": links, "link_alpha": p["link_alpha"],
            "palette": STOPS, "tree_links": len(tree)}
