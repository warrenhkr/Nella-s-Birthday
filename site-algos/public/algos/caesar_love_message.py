"""caesar_love_message (algo 16) : chiffre de César, affiché comme dans un terminal.

Accents : ils sont NORMALISÉS (é -> e, ç -> c) avant le chiffrement, car le chiffre de
César ne connaît que les 26 lettres A-Z. Tout ce qui n'est pas une lettre (espaces,
ponctuation, chiffres) est conservé tel quel, ainsi que la casse.
Convention : run(params) -> dict de type "text".
"""
import math
import unicodedata

PARAMS = [
    {"name": "message", "label": "Message", "type": "str", "min": 1, "max": 80, "default": "JOYEUX ANNIVERSAIRE"},
    {"name": "shift", "label": "Décalage", "type": "int", "min": 1, "max": 25, "default": 7},
    {"name": "mode", "label": "Mode", "type": "select", "options": ["chiffrer", "déchiffrer", "animation"], "default": "animation"},
    {"name": "color", "label": "Couleur", "type": "str", "min": 7, "max": 7, "default": "#c4b5fd"},
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


def normalize(text):
    """Retire les accents : 'Élève' -> 'Eleve'."""
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def caesar(text, shift):
    """Décale chaque lettre de `shift` places (négatif = déchiffrer), garde la casse."""
    out = []
    for ch in text:
        if "a" <= ch <= "z":
            out.append(chr((ord(ch) - ord("a") + shift) % 26 + ord("a")))
        elif "A" <= ch <= "Z":
            out.append(chr((ord(ch) - ord("A") + shift) % 26 + ord("A")))
        else:
            out.append(ch)
    return "".join(out)


def chiffrer(text, shift):
    return caesar(normalize(text), shift)


def dechiffrer(text, shift):
    return caesar(normalize(text), -shift)


def run(params):
    p = read_params(params, PARAMS)
    c = p["color"]
    if not (c.startswith("#") and all(ch in "0123456789abcdefABCDEF" for ch in c[1:])):
        raise ValueError("color doit être une couleur hexadécimale #rrggbb (reçu : %r)" % c)
    msg, shift, mode = p["message"], p["shift"], p["mode"]

    if mode == "chiffrer":
        lines = ["$ cesar --chiffrer --decalage %d" % shift, "> clair   : " + normalize(msg),
                 "> chiffré : " + chiffrer(msg, shift)]
    elif mode == "déchiffrer":
        lines = ["$ cesar --dechiffrer --decalage %d" % shift, "> chiffré : " + normalize(msg),
                 "> clair   : " + dechiffrer(msg, shift)]
    else:
        secret = chiffrer(msg, shift)
        lines = ["$ cesar --animation --decalage %d" % shift, "> message chiffré : " + secret,
                 "> déchiffrement mot par mot :"]
        for word in secret.split(" "):
            if word:
                lines.append("   %s -> %s" % (word, caesar(word, -shift)))
        lines.append("> message clair : " + caesar(secret, -shift))
    return {"type": "text", "lines": lines, "color": c, "line_delay": 450}
