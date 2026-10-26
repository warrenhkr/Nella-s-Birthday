"""huffman_love_tree (algo 24) : codage de Huffman d'un message, avec fréquences, codes et taux de compression.

Principe : on place chaque symbole dans un TAS (heapq) avec sa fréquence, puis on fusionne
toujours les deux plus petites fréquences en un noeud parent, jusqu'à ne garder qu'un arbre. Le
chemin racine -> feuille donne le code (0 = gauche, 1 = droite) : les symboles fréquents ont
des codes courts, et aucun code n'est préfixe d'un autre.
Déterminisme : le tas contient (fréquence, ordre d'arrivée, noeud) ; l'ordre d'arrivée départage
les égalités, et les symboles de départ sont triés par (fréquence, symbole).
Taux : bits Huffman / (8 bits par octet UTF-8 du message).
"""
import heapq
import math
from collections import Counter

PARAMS = [
    {"name": "message", "label": "Message", "type": "str", "min": 1, "max": 60, "default": "JOYEUX ANNIVERSAIRE"},
    {"name": "show_steps", "label": "Afficher les fusions", "type": "bool", "default": True},
    {"name": "show_tree", "label": "Afficher l'arbre", "type": "bool", "default": True},
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


def label(sym):
    return "␣" if sym == " " else sym


def build_tree(message):
    """Renvoie (racine, fusions). Noeud = (fréquence, symbole ou None, gauche, droite)."""
    freq = Counter(message)
    heap = []
    counter = 0
    for sym, f in sorted(freq.items(), key=lambda kv: (kv[1], kv[0])):
        heapq.heappush(heap, (f, counter, (f, sym, None, None)))
        counter += 1
    merges = []
    while len(heap) > 1:
        fa, _, a = heapq.heappop(heap)
        fb, _, b = heapq.heappop(heap)
        node = (fa + fb, None, a, b)
        merges.append((a, b, node))
        heapq.heappush(heap, (fa + fb, counter, node))
        counter += 1
    return heap[0][2], merges


def make_codes(root):
    if root[1] is not None:  # un seul symbole distinct : on lui donne le code "0"
        return {root[1]: "0"}
    codes = {}

    def walk(node, prefix):
        if node[1] is not None:
            codes[node[1]] = prefix
        else:
            walk(node[2], prefix + "0")
            walk(node[3], prefix + "1")

    walk(root, "")
    return codes


def leaves_of(node):
    if node[1] is not None:
        return label(node[1])
    return leaves_of(node[2]) + leaves_of(node[3])


def node_name(node):
    text = leaves_of(node)
    return "%s(%d)" % (text if len(text) <= 8 else text[:7] + "…", node[0])


def decode(bits, codes):
    inverse = {v: k for k, v in codes.items()}
    out, cur = [], ""
    for b in bits:
        cur += b
        if cur in inverse:
            out.append(inverse[cur])
            cur = ""
    return "".join(out)


def tree_lines(root):
    lines = [node_name(root)]

    def draw(node, prefix, tail, edge):
        lines.append(prefix + ("└─" if tail else "├─") + edge + node_name(node))
        if node[1] is None:
            ext = prefix + ("   " if tail else "│  ")
            draw(node[2], ext, False, "0:")
            draw(node[3], ext, True, "1:")

    if root[1] is None:
        draw(root[2], "", False, "0:")
        draw(root[3], "", True, "1:")
    return lines


def run(params):
    p = read_params(params, PARAMS)
    msg = p["message"]
    root, merges = build_tree(msg)
    codes = make_codes(root)
    bits = "".join(codes[ch] for ch in msg)
    original = 8 * len(msg.encode("utf-8"))
    ratio = len(bits) / original
    freq = Counter(msg)

    lines = ["HUFFMAN : " + msg, "", "Symbole | Fréq | Code"]
    for sym in sorted(codes, key=lambda s: (len(codes[s]), codes[s])):
        lines.append("   %-4s | %4d | %s" % (label(sym), freq[sym], codes[sym]))
    if p["show_steps"] and merges:
        lines += ["", "Fusions (les plus petites fréquences d'abord) :"]
        for i, (a, b, node) in enumerate(merges, 1):
            lines.append("  %d. %s + %s -> %d" % (i, node_name(a), node_name(b), node[0]))
    if p["show_tree"]:
        lines += ["", "Arbre :"] + tree_lines(root)
    lines += ["", "Bits (%d) :" % len(bits)]
    lines += [bits[i:i + 36] for i in range(0, len(bits), 36)]
    lines += ["", "Taille d'origine : %d bits (8 par octet)" % original,
              "Taille Huffman   : %d bits" % len(bits),
              "Taux : %.1f %% de l'original (gain %.1f %%)" % (100 * ratio, 100 * (1 - ratio))]
    return {"type": "text", "lines": lines, "color": "#c4b5fd", "line_delay": 160,
            "codes": codes, "bits": bits, "ratio": float(ratio)}
