"""ab_test_significance : un test A/B est-il concluant ? Test z de comparaison de deux proportions.

 p1 = conversions_A / visiteurs_A ; p2 = conversions_B / visiteurs_B
 p_commun = (conv_A + conv_B) / (visiteurs_A + visiteurs_B)
 z = (p2 - p1) / racine( p_commun (1 - p_commun) (1/n1 + 1/n2) )
 p-valeur (bilatérale) = erfc(|z| / racine(2)). Si p-valeur < alpha, l'écart est « statistiquement significatif ».
Aucune dépendance : seulement le module math. Convention : run(params) -> "text".
"""
import math

PARAMS = [
    {"name": "visitors_a", "label": "Visiteurs A", "type": "int", "min": 100, "max": 100000, "default": 5000},
    {"name": "rate_a", "label": "Conversion A (%)", "type": "float", "min": 0.5, "max": 60.0, "default": 10.0},
    {"name": "visitors_b", "label": "Visiteurs B", "type": "int", "min": 100, "max": 100000, "default": 5000},
    {"name": "rate_b", "label": "Conversion B (%)", "type": "float", "min": 0.5, "max": 60.0, "default": 11.5},
    {"name": "alpha", "label": "Seuil alpha (%)", "type": "float", "min": 1.0, "max": 10.0, "default": 5.0},
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


def two_proportion_test(n1, x1, n2, x2):
    """Renvoie (z, p-valeur bilatérale, écart p2 - p1, intervalle de confiance à 95 % de l'écart)."""
    p1, p2 = x1 / n1, x2 / n2
    pooled = (x1 + x2) / (n1 + n2)
    se0 = math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
    z = (p2 - p1) / se0 if se0 > 0 else 0.0
    pval = math.erfc(abs(z) / math.sqrt(2))
    se = math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2)
    diff = p2 - p1
    return z, pval, diff, (diff - 1.96 * se, diff + 1.96 * se)


def run(params):
    p = read_params(params, PARAMS)
    n1, n2 = p["visitors_a"], p["visitors_b"]
    x1 = int(round(n1 * p["rate_a"] / 100))
    x2 = int(round(n2 * p["rate_b"] / 100))
    z, pval, diff, ci = two_proportion_test(n1, x1, n2, x2)
    alpha = p["alpha"] / 100
    significant = pval < alpha
    lift = (diff / (x1 / n1) * 100) if x1 else 0.0
    lines = [
        "TEST A/B : comparaison de deux taux de conversion",
        "",
        "Version A : %d conversions sur %d visiteurs (%.2f %%)" % (x1, n1, 100 * x1 / n1),
        "Version B : %d conversions sur %d visiteurs (%.2f %%)" % (x2, n2, 100 * x2 / n2),
        "",
        "Écart B - A : %+.2f points (amélioration relative : %+.1f %%)" % (100 * diff, lift),
        "Intervalle de confiance à 95 %% de l'écart : de %+.2f à %+.2f points" % (100 * ci[0], 100 * ci[1]),
        "z = %.3f   p-valeur = %.4f   seuil alpha = %.2f" % (z, pval, alpha),
        "",
    ]
    if significant:
        lines.append("Verdict : écart SIGNIFICATIF. Si A et B étaient identiques, un écart aussi grand ne se verrait que dans %.1f %% des cas." % (100 * pval))
        lines.append("Recommandation : la version %s l'emporte ; vérifier aussi l'effet sur le chiffre d'affaires." % ("B" if diff > 0 else "A"))
    else:
        lines.append("Verdict : écart NON significatif. Le hasard suffit à l'expliquer (p-valeur %.1f %%)." % (100 * pval))
        lines.append("Recommandation : ne pas conclure ; collecter plus de visiteurs ou viser un effet plus grand.")
    lines += ["", "Rappel : « non significatif » ne veut pas dire « pas de différence », mais « preuve insuffisante »."]
    return {"type": "text", "lines": lines, "color": "#5eead4", "line_delay": 120,
            "summary": {"conversions_a": x1, "conversions_b": x2, "z": round(z, 4), "p_value": round(pval, 6), "significant": bool(significant),
                        "difference_points": round(100 * diff, 4), "ci95_points": [round(100 * ci[0], 4), round(100 * ci[1], 4)]}}
