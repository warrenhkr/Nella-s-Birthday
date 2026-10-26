"""love_text_console (algo 12) : message d'amour dans une console, en texte centré.

Convention : run(params) -> dict de type "text" (lignes à afficher une par une).
Les lignes ont toutes la même longueur (width_chars) pour un centrage parfait.
"""
import math

PARAMS = [
    {"name": "message", "label": "Message", "type": "str", "min": 1, "max": 40, "default": "JOYEUX ANNIVERSAIRE"},
    {"name": "style", "label": "Style", "type": "select", "options": ["coeur", "boite", "simple"], "default": "coeur"},
    {"name": "width_chars", "label": "Largeur (caractères)", "type": "int", "min": 24, "max": 60, "default": 40},
    {"name": "color", "label": "Couleur", "type": "str", "min": 7, "max": 7, "default": "#c4b5fd"},
]

HEART_ART = [
    "  ***   ***  ",
    " ***** ***** ",
    "*************",
    " *********** ",
    "  *********  ",
    "   *******   ",
    "    *****    ",
    "     ***     ",
    "      *      ",
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


def run(params):
    p = read_params(params, PARAMS)
    c = p["color"]
    if not (c.startswith("#") and all(ch in "0123456789abcdefABCDEF" for ch in c[1:])):
        raise ValueError("color doit être une couleur hexadécimale #rrggbb (reçu : %r)" % c)
    w = p["width_chars"]
    msg = p["message"].strip()
    if len(msg) > w - 4:
        raise ValueError("message trop long pour width_chars=%d (max %d caractères)" % (w, w - 4))
    if not msg:
        raise ValueError("message ne doit pas être vide")

    lines = []
    if p["style"] == "coeur":
        lines += [row.center(w) for row in HEART_ART]
        lines.append(" ".center(w))
        lines.append(msg.center(w))
    elif p["style"] == "boite":
        inner = w - 2
        lines.append("+" + "-" * inner + "+")
        lines.append("|" + " " * inner + "|")
        lines.append("|" + msg.center(inner) + "|")
        lines.append("|" + " " * inner + "|")
        lines.append("+" + "-" * inner + "+")
    else:
        lines.append(msg.center(w))
    lines.append(" ".center(w))
    lines.append("<3".center(w))
    return {"type": "text", "lines": lines, "color": c, "line_delay": 140}
