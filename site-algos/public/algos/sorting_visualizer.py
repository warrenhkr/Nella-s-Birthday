"""sorting_visualizer (algo 17) : visualise un tri, des barres qui se réorganisent.

On enregistre un instantané du tableau à chaque comparaison ou échange, puis on sous-échantillonne
pour respecter max_frames. Chaque instantané est une PERMUTATION valide de 1..count : le tri par
fusion est donc écrit "sur place" avec des échanges (insertion de l'élément de droite).
Une frame est une grille count x count : colonne = case du tableau, hauteur de la barre = valeur.
Codes : 0 vide, 1 barre, 2 barre comparée / échangée, 3 barre triée (dernière image).
"""
import math
import numpy as np

PARAMS = [
    {"name": "algorithm", "label": "Algorithme", "type": "select", "options": ["bubble", "insertion", "selection", "quick", "merge"], "default": "quick"},
    {"name": "count", "label": "Nombre de barres", "type": "int", "min": 8, "max": 120, "default": 40},
    {"name": "max_frames", "label": "Images maximum", "type": "int", "min": 30, "max": 600, "default": 240},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
]
MAX_CELLS = 200000  # budget : count x count x images

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


def record_steps(values, algorithm):
    """Trie `values` en enregistrant (tableau, positions_marquées) à chaque étape. Renvoie (étapes, tableau trié)."""
    a = list(values)
    n = len(a)
    steps = []

    def snap(*marks):
        steps.append((tuple(a), marks))

    def swap(i, j):
        a[i], a[j] = a[j], a[i]

    if algorithm == "bubble":
        for i in range(n):
            swapped = False
            for j in range(n - 1 - i):
                snap(j, j + 1)
                if a[j] > a[j + 1]:
                    swap(j, j + 1)
                    swapped = True
                    snap(j, j + 1)
            if not swapped:
                break
    elif algorithm == "insertion":
        for i in range(1, n):
            j = i
            while j > 0:
                snap(j - 1, j)
                if a[j - 1] > a[j]:
                    swap(j - 1, j)
                    snap(j - 1, j)
                    j -= 1
                else:
                    break
    elif algorithm == "selection":
        for i in range(n - 1):
            m = i
            for j in range(i + 1, n):
                snap(m, j)
                if a[j] < a[m]:
                    m = j
            if m != i:
                swap(i, m)
                snap(i, m)
    elif algorithm == "quick":
        def qs(lo, hi):
            if lo >= hi:
                return
            pivot = a[hi]
            i = lo
            for j in range(lo, hi):
                snap(j, hi)
                if a[j] < pivot:
                    swap(i, j)
                    snap(i, j)
                    i += 1
            swap(i, hi)
            snap(i, hi)
            qs(lo, i - 1)
            qs(i + 1, hi)
        qs(0, n - 1)
    elif algorithm == "merge":
        def merge(lo, mid, hi):
            i, j = lo, mid  # a[i:j] = reste de gauche, a[j:hi] = reste de droite (tous deux triés)
            while i < j < hi:
                snap(i, j)
                if a[i] <= a[j]:
                    i += 1
                else:
                    k = j
                    while k > i:  # on remonte a[j] à la place i par échanges successifs
                        swap(k - 1, k)
                        snap(k - 1, k)
                        k -= 1
                    i += 1
                    j += 1

        def ms(lo, hi):
            if hi - lo <= 1:
                return
            mid = (lo + hi) // 2
            ms(lo, mid)
            ms(mid, hi)
            merge(lo, mid, hi)
        ms(0, n)
    steps.append((tuple(a), ()))
    return steps, a


def to_grid(arr, marks, done=False):
    """Instantané -> matrice n x n (ligne 0 en haut, barres posées en bas)."""
    n = len(arr)
    vals = np.array(arr)
    rows = np.arange(n)[:, None]
    bars = rows >= (n - vals)[None, :]
    grid = np.where(bars, 3 if done else 1, 0)
    for m in marks:
        grid[:, m] = np.where(bars[:, m], 2, 0)
    return grid


def run(params):
    p = read_params(params, PARAMS)
    n = p["count"]
    rng = np.random.default_rng(p["seed"])
    values = (rng.permutation(n) + 1).tolist()
    steps, final = record_steps(values, p["algorithm"])
    assert final == sorted(values)
    total = len(steps) + 1  # + l'état initial
    n_frames = max(2, min(p["max_frames"], MAX_CELLS // (n * n), total))
    idx = np.unique(np.rint(np.linspace(0, total - 1, n_frames)).astype(int))
    all_states = [(tuple(values), ())] + steps
    frames = []
    for i in idx:
        arr, marks = all_states[int(i)]
        frames.append(to_grid(arr, marks, done=(int(i) == total - 1)).tolist())
    return {"type": "frames", "encoding": "grid", "cols": n, "rows": n, "frames": frames,
            "fps": 30, "loop": False, "steps_total": int(total), "sampled": bool(len(idx) < total),
            "palette": ["#0f0820", "#a78bfa", "#f9a8d4", "#ffffff"], "algorithm": p["algorithm"]}
