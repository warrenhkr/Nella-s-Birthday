"""heart_frame_sequence (algo 11) : une séquence d'images PNG (Pillow) d'un coeur qui bat.

Pour chaque image k, le temps u = (1 - cos(2*pi*k/N)) / 2 est périodique (boucle parfaite), puis
un easing (linéaire, ease-in, ease-out, smoothstep) donne l'échelle du coeur et sa couleur
(violet -> rose). Des étincelles (seed) scintillent. On dessine en 2x puis on réduit (anti-crénelage).
Chaque image est un PNG encodé en base64 (data URI). Budget : 90 images de 512 px maximum.
Convention : run(params) -> dict de type "frames", encoding "png_base64".
"""
import base64
import io
import math
import numpy as np
from PIL import Image, ImageDraw

PARAMS = [
    {"name": "frames", "label": "Images", "type": "int", "min": 10, "max": 90, "default": 24},
    {"name": "size", "label": "Taille (px)", "type": "int", "min": 128, "max": 512, "default": 256},
    {"name": "easing", "label": "Easing", "type": "select", "options": ["linear", "ease-in", "ease-out", "smoothstep"], "default": "smoothstep"},
    {"name": "sparkles", "label": "Étincelles", "type": "int", "min": 0, "max": 40, "default": 12},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
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

def lerp(a, b, t):
    return a + (b - a) * t


def hex_to_rgb(h):
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def rgb_to_hex(r, g, b):
    return "#%02x%02x%02x" % (int(round(r)), int(round(g)), int(round(b)))


def gradient(stops, u):
    """Dégradé par morceaux entre des couleurs hexadécimales, u entre 0 et 1."""
    u = min(1.0, max(0.0, u))
    pos = u * (len(stops) - 1)
    i = min(int(pos), len(stops) - 2)
    t = pos - i
    a, b = hex_to_rgb(stops[i]), hex_to_rgb(stops[i + 1])
    return rgb_to_hex(*(lerp(a[k], b[k], t) for k in range(3)))

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

BACKGROUND = (20, 12, 38)
SMALL, BIG = 0.72, 1.0  # échelle du coeur au repos / au maximum
SUPERSAMPLE = 2
EASINGS = {
    "linear": lambda t: t,
    "ease-in": lambda t: t * t,
    "ease-out": lambda t: 1 - (1 - t) ** 2,
    "smoothstep": lambda t: 3 * t * t - 2 * t ** 3,
}


def pulse(k, n, easing):
    """Valeur d'animation entre 0 et 1, périodique : pulse(n) == pulse(0)."""
    u = (1 - math.cos(2 * math.pi * k / n)) / 2
    return EASINGS[easing](u)


def render(size, e, sparkle_list, k, n):
    S = size * SUPERSAMPLE
    base = Image.new("RGBA", (S, S), BACKGROUND + (255,))
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    t = (np.arange(160) + 0.5) * (2 * math.pi / 160)
    hx, hy = heart_curve(t)
    scale = (SMALL + (BIG - SMALL) * e) * 0.40 * S / HEART_HALF
    c = S / 2

    def outline(f):
        return [(c + f * scale * hx[i], c - f * scale * hy[i]) for i in range(len(t))]

    for m in range(4, 0, -1):  # halo : coeurs de plus en plus grands et transparents
        d.polygon(outline(1 + 0.05 * m), fill=(236, 72, 153, int(14 + 10 * e)))
    r, g, b = (round(a + (z - a) * e) for a, z in zip((109, 40, 217), (236, 72, 153)))
    d.polygon(outline(1.0), fill=(r, g, b, 255))
    d.polygon(outline(0.62), fill=(min(255, r + 60), min(255, g + 60), min(255, b + 60), 150))
    d.line(outline(1.0) + [outline(1.0)[0]], fill=(255, 255, 255, 230), width=max(2, S // 110))
    for (sx, sy, rad, phase) in sparkle_list:
        a = 0.25 + 0.75 * max(0.0, math.sin(2 * math.pi * k / n + phase))
        px, py, rr = sx * S, sy * S, rad * S
        d.ellipse((px - rr, py - rr, px + rr, py + rr), fill=(255, 255, 255, int(255 * a)))
    img = Image.alpha_composite(base, layer).convert("RGB")
    return img.resize((size, size), Image.LANCZOS)


def to_data_uri(img):
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def make_sparkles(seed, count):
    rng = np.random.default_rng(seed)
    out = []
    for _ in range(count):
        out.append((float(rng.uniform(0.05, 0.95)), float(rng.uniform(0.05, 0.95)),
                    float(rng.uniform(0.004, 0.012)), float(rng.uniform(0, 2 * math.pi))))
    return out


def run(params):
    p = read_params(params, PARAMS)
    n, size = p["frames"], p["size"]
    sparkle_list = make_sparkles(p["seed"], p["sparkles"])
    frames = [to_data_uri(render(size, pulse(k, n, p["easing"]), sparkle_list, k, n)) for k in range(n)]
    return {"type": "frames", "encoding": "png_base64", "frames": frames, "width": size, "height": size,
            "fps": 16, "loop": True, "palette": ["#6d28d9", "#ec4899", "#ffffff"]}
