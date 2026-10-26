"""data_cleaning_report : audit de qualité d'un fichier de ventes (première étape de toute analyse).

On génère un petit fichier de ventes, on y glisse des défauts (lignes en double, valeurs manquantes, montants
aberrants), puis on les détecte comme le ferait un analyste :
 - doublons : lignes strictement identiques (on garde la première) ;
 - valeurs manquantes : cellules vides, comptées par colonne ;
 - valeurs aberrantes : règle de Tukey (IQR) : hors de [Q1 - 1,5 x IQR ; Q3 + 1,5 x IQR].
Un rapport avant / après nettoyage est affiché. Convention : run(params) -> "text".
"""
import math
import numpy as np

PARAMS = [
    {"name": "rows", "label": "Lignes du fichier", "type": "int", "min": 20, "max": 500, "default": 100},
    {"name": "duplicate_rate", "label": "Doublons (%)", "type": "float", "min": 0.0, "max": 20.0, "default": 5.0},
    {"name": "missing_rate", "label": "Valeurs manquantes (%)", "type": "float", "min": 0.0, "max": 30.0, "default": 8.0},
    {"name": "outlier_rate", "label": "Montants aberrants (%)", "type": "float", "min": 0.0, "max": 10.0, "default": 3.0},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
]
COUNTRIES = ["France", "Belgique", "Bénin", "Sénégal", "Canada"]

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


def make_file(p):
    """Renvoie (lignes, injecté) ; une ligne = [id, pays, quantité, montant]. Les cellules vides valent None."""
    rng = np.random.default_rng(p["seed"])
    n = p["rows"]
    rows = []
    for i in range(n):
        q = int(rng.integers(1, 10))
        rows.append([i + 1, COUNTRIES[int(rng.integers(len(COUNTRIES)))], q, round(float(q * rng.uniform(18, 26)), 2)])
    n_out = int(round(n * p["outlier_rate"] / 100))
    n_miss = int(round(n * p["missing_rate"] / 100))
    n_dup = int(round(n * p["duplicate_rate"] / 100))
    picks = [int(i) for i in rng.permutation(n)]
    outliers = picks[:n_out]
    for i in outliers:
        rows[i][3] = round(rows[i][3] * float(rng.uniform(15, 30)), 2)
    missing = []
    for i in picks[n_out:n_out + n_miss]:
        col = int(rng.choice([1, 3]))
        rows[i][col] = None
        missing.append((i, col))
    dup_sources = picks[n_out + n_miss:n_out + n_miss + n_dup]
    rows += [list(rows[i]) for i in dup_sources]
    return rows, {"duplicates": len(dup_sources), "missing": len(missing), "outliers": sorted(outliers), "outlier_count": len(outliers)}


def find_duplicates(rows):
    seen, dup = set(), []
    for i, r in enumerate(rows):
        key = tuple(r)
        if key in seen:
            dup.append(i)
        seen.add(key)
    return dup


def iqr_bounds(values):
    q1, q3 = (float(x) for x in np.percentile(values, [25, 75]))
    iqr = q3 - q1
    return q1 - 1.5 * iqr, q3 + 1.5 * iqr


def run(params):
    p = read_params(params, PARAMS)
    rows, injected = make_file(p)
    labels = ["id", "pays", "quantité", "montant"]
    dup_idx = find_duplicates(rows)
    clean = [r for i, r in enumerate(rows) if i not in set(dup_idx)]
    missing_by_col = {labels[c]: sum(1 for r in clean if r[c] is None) for c in (1, 2, 3)}
    amounts = [r[3] for r in clean if r[3] is not None]
    lo, hi = iqr_bounds(amounts)
    outliers = [r[0] for r in clean if r[3] is not None and (r[3] < lo or r[3] > hi)]
    kept = [r for r in clean if r[1] is not None and r[3] is not None and r[0] not in set(outliers)]
    mean_before = float(np.mean(amounts))
    mean_after = float(np.mean([r[3] for r in kept])) if kept else 0.0
    lines = [
        "AUDIT DE QUALITÉ : fichier de ventes",
        "",
        "Lignes reçues : %d" % len(rows),
        "Doublons exacts : %d (supprimés, première ligne conservée)" % len(dup_idx),
        "Valeurs manquantes : " + ", ".join("%s %d" % (k, v) for k, v in missing_by_col.items()),
        "Seuils de Tukey sur le montant : de %.2f à %.2f" % (lo, hi),
        "Montants aberrants : %d (à vérifier avec le métier avant de les retirer)" % len(outliers),
        "",
        "Lignes utilisables après nettoyage : %d sur %d (%.0f %%)" % (len(kept), len(rows), 100 * len(kept) / len(rows)),
        "Montant moyen avant : %.2f   après : %.2f" % (mean_before, mean_after),
        "",
        "À retenir : une moyenne calculée sans nettoyage peut être faussée par quelques valeurs aberrantes.",
    ]
    return {"type": "text", "lines": lines, "color": "#5eead4", "line_delay": 140,
            "summary": {"rows": len(rows), "duplicates_found": len(dup_idx), "missing_found": sum(missing_by_col.values()),
                        "outliers_found": sorted(outliers), "kept": len(kept), "mean_before": round(mean_before, 3), "mean_after": round(mean_after, 3),
                        "injected": injected}}
