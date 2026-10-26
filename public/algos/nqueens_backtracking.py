"""nqueens_backtracking (algo 21) : n reines sur un échiquier, par backtracking.

Ligne par ligne, on essaie chaque colonne : si la case est attaquée (colonne ou diagonale déjà
prise) on abandonne cet essai (ÉLAGAGE) ; sinon on pose la reine, on explore la suite, puis on la
retire (RETOUR EN ARRIÈRE). Les ensembles cols / diag1 / diag2 donnent le test en O(1).
Codes des frames (matrice n x n) : 0 vide, 1 reine, 2 essai refusé (case attaquée).
Mode "toutes" : le nombre de solutions est compté par un solveur à masques de bits (rapide, avec
symétrie) ; l'animation montre le début de la recherche (RECORD_CAP étapes) puis une solution.
"""
import math
import numpy as np

PARAMS = [
    {"name": "n", "label": "Taille de l'échiquier", "type": "int", "min": 4, "max": 12, "default": 8},
    {"name": "mode", "label": "Mode", "type": "select", "options": ["première solution", "toutes"], "default": "première solution"},
    {"name": "max_frames", "label": "Images maximum", "type": "int", "min": 30, "max": 600, "default": 300},
]
RECORD_CAP = 60000  # nombre maximal d'étapes enregistrées

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


def search(n, find_all=False, cap=RECORD_CAP):
    """Backtracking enregistré. Renvoie (étapes, solutions trouvées, première solution, noeuds explorés)."""
    cols, d1, d2 = set(), set(), set()
    placement = [-1] * n
    events = []  # (placement, case refusée ou None)
    found = {"count": 0, "first": None, "nodes": 0, "stop": False}

    def rec(r):
        if r == n:
            found["count"] += 1
            if found["first"] is None:
                found["first"] = tuple(placement)
            found["stop"] = not find_all
            return
        for c in range(n):
            found["nodes"] += 1
            if c in cols or (r + c) in d1 or (r - c) in d2:
                if len(events) < cap:
                    events.append((tuple(placement), (r, c)))  # essai refusé : on l'enregistre
                continue
            placement[r] = c  # choisir
            cols.add(c); d1.add(r + c); d2.add(r - c)
            if len(events) < cap:
                events.append((tuple(placement), None))
            rec(r + 1)  # explorer
            if found["stop"]:
                return  # première solution trouvée : on s'arrête (le plateau reste tel quel)
            cols.discard(c); d1.discard(r + c); d2.discard(r - c)  # défaire
            placement[r] = -1
            if len(events) < cap:
                events.append((tuple(placement), None))

    rec(0)
    return events, found["count"], found["first"], found["nodes"]


def count_solutions(n):
    """Nombre de solutions avec des masques de bits (la première ligne est limitée à la moitié gauche : symétrie)."""
    full = (1 << n) - 1

    def go(cols, d1, d2):
        if cols == full:
            return 1
        total = 0
        free = full & ~(cols | d1 | d2)
        while free:
            bit = free & -free
            free ^= bit
            total += go(cols | bit, ((d1 | bit) << 1) & full, (d2 | bit) >> 1)
        return total

    half = n // 2
    total = 0
    for c in range(half):
        bit = 1 << c
        total += 2 * go(bit, (bit << 1) & full, bit >> 1)
    if n % 2 == 1:
        bit = 1 << half
        total += go(bit, (bit << 1) & full, bit >> 1)
    return total


def board(placement, refused=None):
    n = len(placement)
    g = np.zeros((n, n), dtype=np.int64)
    for r, c in enumerate(placement):
        if c >= 0:
            g[r, c] = 1
    if refused is not None:
        g[refused] = 2
    return g


def run(params):
    p = read_params(params, PARAMS)
    n = p["n"]
    events, found, first, nodes = search(n, find_all=False)
    if p["mode"] == "toutes":
        solutions = count_solutions(n)
    else:
        solutions = found
    states = [((-1,) * n, None)] + events
    if first is not None:
        states.append((first, None))
    n_frames = max(2, min(p["max_frames"], len(states)))
    idx = np.unique(np.rint(np.linspace(0, len(states) - 1, n_frames)).astype(int))
    frames = [board(*states[int(i)]).tolist() for i in idx]
    return {"type": "frames", "encoding": "grid", "cols": n, "rows": n, "frames": frames, "fps": 20, "loop": False,
            "solutions": int(solutions), "first_solution": [int(c) for c in first], "nodes": int(nodes),
            "palette": ["#0f0820", "#f9a8d4", "#ef4444"]}
