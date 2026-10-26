"""maze_astar (algo 20) : génère un labyrinthe parfait puis le résout (BFS, Dijkstra ou A*).

Labyrinthe : DFS itératif (retour en arrière) sur une grille de size x size cellules, dessinée
dans une matrice (2*size + 1)². "Parfait" : un seul chemin entre deux cases (c'est un arbre).
Résolution : départ en haut à gauche, arrivée en bas à droite, 4 directions, coût 1 par pas.
 - BFS : file ; Dijkstra : tas trié par g ; A* : tas trié par g + h (h admissible et cohérente).
Codes des frames : 0 libre, 1 mur, 2 explorée, 3 chemin final, 4 départ, 5 arrivée.
"""
import heapq
import math
from collections import deque
import numpy as np

PARAMS = [
    {"name": "size", "label": "Taille (cellules)", "type": "int", "min": 8, "max": 60, "default": 25},
    {"name": "algorithm", "label": "Algorithme", "type": "select", "options": ["bfs", "dijkstra", "astar"], "default": "astar"},
    {"name": "heuristic", "label": "Heuristique (A*)", "type": "select", "options": ["manhattan", "euclidienne"], "default": "manhattan"},
    {"name": "max_frames", "label": "Images maximum", "type": "int", "min": 30, "max": 600, "default": 300},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
]
MAX_CELLS = 300000
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


def make_maze(size, seed):
    """Matrice (2*size+1)² : 1 = mur, 0 = libre. Génération par DFS avec retour en arrière."""
    import random
    rng = random.Random(seed)  # générateur local
    d = 2 * size + 1
    grid = np.ones((d, d), dtype=np.int64)
    grid[1, 1] = 0
    stack = [(0, 0)]
    seen = {(0, 0)}
    while stack:
        r, c = stack[-1]
        options = [(r + dr, c + dc) for dr, dc in DIRS
                   if 0 <= r + dr < size and 0 <= c + dc < size and (r + dr, c + dc) not in seen]
        if not options:
            stack.pop()
            continue
        nr, nc = rng.choice(options)
        grid[r + nr + 1, c + nc + 1] = 0  # on abat le mur entre les deux cellules
        grid[2 * nr + 1, 2 * nc + 1] = 0
        seen.add((nr, nc))
        stack.append((nr, nc))
    return grid


def solve(grid, algorithm, heuristic="manhattan"):
    """Renvoie (cases explorées dans l'ordre, chemin du départ à l'arrivée)."""
    d = grid.shape[0]
    start, goal = (1, 1), (d - 2, d - 2)

    def h(node):
        dr, dc = abs(node[0] - goal[0]), abs(node[1] - goal[1])
        return dr + dc if heuristic == "manhattan" else math.hypot(dr, dc)

    parent = {start: None}
    explored = []
    if algorithm == "bfs":
        queue = deque([start])
        while queue:
            node = queue.popleft()
            explored.append(node)
            if node == goal:
                break
            for dr, dc in DIRS:
                nxt = (node[0] + dr, node[1] + dc)
                if grid[nxt] == 0 and nxt not in parent:
                    parent[nxt] = node
                    queue.append(nxt)
    else:
        best = {start: 0}
        counter = 0  # départage stable des égalités
        heap = [(0 if algorithm == "dijkstra" else h(start), counter, 0, start)]
        closed = set()
        while heap:
            _, _, g, node = heapq.heappop(heap)
            if node in closed:
                continue
            closed.add(node)
            explored.append(node)
            if node == goal:
                break
            for dr, dc in DIRS:
                nxt = (node[0] + dr, node[1] + dc)
                if grid[nxt] != 0:
                    continue
                ng = g + 1
                if ng < best.get(nxt, 10 ** 9):
                    best[nxt] = ng
                    parent[nxt] = node
                    counter += 1
                    prio = ng if algorithm == "dijkstra" else ng + h(nxt)
                    heapq.heappush(heap, (prio, counter, ng, nxt))
    path = []
    node = goal
    while node is not None:
        path.append(node)
        node = parent[node]
    return explored, path[::-1]


def run(params):
    p = read_params(params, PARAMS)
    grid = make_maze(p["size"], p["seed"])
    d = grid.shape[0]
    explored, path = solve(grid, p["algorithm"], p["heuristic"])
    n_chunks = max(1, min(p["max_frames"] - 2, MAX_CELLS // (d * d) - 2, len(explored)))
    bounds = np.rint(np.linspace(0, len(explored), n_chunks + 1)).astype(int)

    def marked(g):
        g = g.copy()
        g[1, 1], g[d - 2, d - 2] = 4, 5
        return g

    cur = grid.copy()
    frames = [marked(cur).tolist()]
    for i in range(1, n_chunks + 1):
        for r, c in explored[bounds[i - 1]:bounds[i]]:
            cur[r, c] = 2
        frames.append(marked(cur).tolist())
    for r, c in path:
        cur[r, c] = 3
    frames.append(marked(cur).tolist())
    return {"type": "frames", "encoding": "grid", "cols": d, "rows": d, "frames": frames, "fps": 30, "loop": False,
            "explored": len(explored), "path_length": len(path) - 1, "algorithm": p["algorithm"],
            "palette": ["#0f0820", "#ede9fe", "#6d28d9", "#f9a8d4", "#ffffff", "#f472b6"]}
