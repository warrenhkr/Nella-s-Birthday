"""kmeans_customers : segmentation de clients par K-means (apprentissage non supervisé).

Chaque client = (fréquence d'achat, panier moyen). L'algorithme :
 1. choisit k centres (K-means++ : on privilégie des points éloignés des centres déjà choisis) ;
 2. affecte chaque client au centre le plus proche ;
 3. recalcule chaque centre comme la moyenne de son groupe ; répète jusqu'à stabilité.
L'inertie (somme des carrés des distances aux centres) ne peut que diminuer : elle est renvoyée à chaque étape.
Convention : run(params) -> "points" (une couleur par segment, les centres sont plus gros).
"""
import math
import numpy as np

PARAMS = [
    {"name": "customers", "label": "Clients", "type": "int", "min": 60, "max": 600, "default": 240},
    {"name": "clusters", "label": "Segments (k)", "type": "int", "min": 2, "max": 6, "default": 4},
    {"name": "iterations", "label": "Itérations maximum", "type": "int", "min": 1, "max": 50, "default": 15},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
]
COLORS = ["#38bdf8", "#f59e0b", "#34d399", "#f472b6", "#a78bfa", "#fb7185"]
SEGMENT_NAMES = ["Occasionnels", "Fidèles économes", "Gros paniers", "Ambassadeurs", "Inactifs", "Nouveaux"]

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


def make_customers(n, seed):
    """Clients en 4 grands profils, coordonnées normalisées entre 0 et 1."""
    rng = np.random.default_rng(seed)
    centers = np.array([[0.2, 0.25], [0.75, 0.3], [0.3, 0.8], [0.8, 0.82]])
    which = rng.integers(0, len(centers), n)
    pts = centers[which] + 0.07 * rng.standard_normal((n, 2))
    return np.clip(pts, 0.02, 0.98)


def kmeans(pts, k, max_iter, seed):
    """K-means++ puis itérations de Lloyd. Renvoie (centres, étiquettes, historique d'inertie)."""
    rng = np.random.default_rng(seed + 1)
    centers = [pts[int(rng.integers(len(pts)))]]
    while len(centers) < k:
        d2 = np.min(((pts[:, None, :] - np.array(centers)[None, :, :]) ** 2).sum(axis=2), axis=1)
        total = d2.sum()
        probs = d2 / total if total > 0 else np.full(len(pts), 1.0 / len(pts))
        centers.append(pts[int(rng.choice(len(pts), p=probs))])
    centers = np.array(centers, dtype=float)
    history = []
    labels = np.zeros(len(pts), dtype=int)
    for _ in range(max_iter):
        dist = ((pts[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
        labels = dist.argmin(axis=1)
        history.append(float(dist[np.arange(len(pts)), labels].sum()))
        new = centers.copy()
        for j in range(k):
            members = pts[labels == j]
            if len(members):
                new[j] = members.mean(axis=0)
            else:  # groupe vide : on le replace sur le point le plus mal servi
                new[j] = pts[int(dist.min(axis=1).argmax())]
        if np.allclose(new, centers):
            break
        centers = new
    return centers, labels, history


def run(params):
    p = read_params(params, PARAMS)
    pts = make_customers(p["customers"], p["seed"])
    centers, labels, history = kmeans(pts, p["clusters"], p["iterations"], p["seed"])
    m = max(6.0, 0.05 * min(p["width"], p["height"]))
    sx, sy = p["width"] - 2 * m, p["height"] - 2 * m
    out = []
    for (x, y), lab in zip(pts, labels):
        out.append({"x": round(float(m + x * sx), 1), "y": round(float(p["height"] - m - y * sy), 1), "r": 3.2, "alpha": 0.85, "color": COLORS[int(lab)]})
    for j, (x, y) in enumerate(centers):
        out.append({"x": round(float(m + x * sx), 1), "y": round(float(p["height"] - m - y * sy), 1), "r": 9.0, "alpha": 1.0, "color": "#ffffff"})
    sizes = [int((labels == j).sum()) for j in range(p["clusters"])]
    return {"type": "points", "points": out, "palette": COLORS[:p["clusters"]], "clusters": sizes,
            "segments": [SEGMENT_NAMES[j] for j in range(p["clusters"])], "inertia": [round(v, 4) for v in history],
            "iterations_used": len(history)}
