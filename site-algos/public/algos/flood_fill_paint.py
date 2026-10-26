"""flood_fill_paint (algo 19) : remplissage d'un coeur par propagation (BFS ou DFS).

Le contour du coeur est un mur : une case du masque est "mur" si l'une de ses 4 voisines est
hors du coeur, donc un remplissage en 4 directions ne peut jamais en sortir. `walls` ajoute des
murs aléatoires à l'intérieur. Si la case de départ est un mur, on prend la case libre la
plus proche (distance de Manhattan).
BFS : file, les cases sont peintes par vagues. DFS : pile, on s'enfonce (ruban sinueux).
Codes des frames : 0 hors coeur, 1 mur, 2 case libre, 3 peinte, 4 peinte à cette image (front).
"""
import math
from collections import deque
import numpy as np

PARAMS = [
    {"name": "grid_size", "label": "Taille de la grille", "type": "int", "min": 20, "max": 120, "default": 60},
    {"name": "start_x", "label": "Départ x (0 à 1)", "type": "float", "min": 0.0, "max": 1.0, "default": 0.5},
    {"name": "start_y", "label": "Départ y (0 à 1)", "type": "float", "min": 0.0, "max": 1.0, "default": 0.5},
    {"name": "algorithm", "label": "Algorithme", "type": "select", "options": ["bfs", "dfs"], "default": "bfs"},
    {"name": "walls", "label": "Murs aléatoires", "type": "float", "min": 0.0, "max": 0.3, "default": 0.08},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
]
MAX_CELLS = 300000
MAX_FRAMES = 150
DIRS = [(1, 0), (0, 1), (-1, 0), (0, -1)]

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

def heart_mask(g):
    """Masque booléen g x g du coeur (ligne 0 en haut), symétrique gauche-droite."""
    c = (g - 1) / 2
    xs = (np.arange(g) - c) / (g / 2) * HEART_IN_HALF
    ys = -(np.arange(g) - c) / (g / 2) * HEART_IN_HALF  # y vers le haut dans la formule
    X, Y = np.meshgrid(xs, ys)
    return heart_inside(X, Y)


def make_grid(p):
    """Grille de base (codes 0, 1, 2) et position de départ (ligne, colonne)."""
    g = p["grid_size"]
    inside = heart_mask(g)
    pad = np.pad(inside, 1, constant_values=False)
    all_four = pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:]
    boundary = inside & ~all_four
    rng = np.random.default_rng(p["seed"])
    random_walls = (rng.random((g, g)) < p["walls"]) & inside & ~boundary
    grid = np.zeros((g, g), dtype=np.int64)
    grid[inside] = 2
    grid[boundary | random_walls] = 1
    free = np.argwhere(grid == 2)
    if len(free) == 0:
        raise ValueError("aucune case libre dans le coeur : réduisez walls")
    target = np.array([p["start_y"] * (g - 1), p["start_x"] * (g - 1)])
    k = int(np.argmin(np.abs(free - target).sum(axis=1)))
    return grid, (int(free[k][0]), int(free[k][1]))


def fill_order(grid, start, algorithm):
    """Liste des cases dans l'ordre où elles sont peintes (chaque case une seule fois)."""
    h, w = grid.shape
    seen = np.zeros((h, w), dtype=bool)
    order = []
    if algorithm == "bfs":
        queue = deque([start])
        seen[start] = True  # marquée dès qu'elle entre dans la file
        order.append(start)
        while queue:
            r, c = queue.popleft()
            for dr, dc in DIRS:
                nr, nc = r + dr, c + dc
                if 0 <= nr < h and 0 <= nc < w and grid[nr, nc] == 2 and not seen[nr, nc]:
                    seen[nr, nc] = True
                    order.append((nr, nc))
                    queue.append((nr, nc))
    else:
        stack = [start]
        while stack:
            r, c = stack.pop()
            if seen[r, c]:
                continue  # empilée plusieurs fois : on ne la visite qu'une fois
            seen[r, c] = True
            order.append((r, c))
            for dr, dc in reversed(DIRS):
                nr, nc = r + dr, c + dc
                if 0 <= nr < h and 0 <= nc < w and grid[nr, nc] == 2 and not seen[nr, nc]:
                    stack.append((nr, nc))
    return order


def run(params):
    p = read_params(params, PARAMS)
    g = p["grid_size"]
    base, start = make_grid(p)
    order = fill_order(base, start, p["algorithm"])
    total = len(order)
    n_frames = max(1, min(MAX_FRAMES, MAX_CELLS // (g * g), total))
    bounds = np.rint(np.linspace(0, total, n_frames + 1)).astype(int)

    frames = [base.tolist()]
    cur = base.copy()
    for i in range(1, n_frames + 1):
        cur[cur == 4] = 3
        for r, c in order[bounds[i - 1]:bounds[i]]:
            cur[r, c] = 4
        frames.append(cur.tolist())
    cur[cur == 4] = 3
    frames.append(cur.tolist())
    return {
        "type": "frames", "encoding": "grid", "cols": g, "rows": g, "frames": frames,
        "fps": 24, "loop": False, "start": [start[0], start[1]], "filled": total,
        "palette": ["#0f0820", "#ffffff", "#2e1065", "#a78bfa", "#f9a8d4"],
    }
