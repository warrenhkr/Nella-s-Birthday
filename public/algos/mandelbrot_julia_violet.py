"""mandelbrot_julia_violet (algo 22) : fractale de Mandelbrot ou de Julia en violet / rose.

On itère z -> z² + c sur toute l'image d'un coup avec numpy (aucune boucle sur les pixels) et on
ne garde dans le calcul que les points qui n'ont pas encore divergé. La couleur vient d'un
nombre d'itérations "lissé" (mu = n + 1 - log2(log|z|)) passé dans une palette de 256 couleurs.
 - Mandelbrot : z0 = 0, c = le pixel ; Julia : z0 = le pixel, c = (c_real, c_imag).
La grille est construite pour être EXACTEMENT symétrique autour de center_y (image symétrique
par rapport à l'axe réel si center_y = 0). La largeur visible est 3.5 / zoom (Mandelbrot) ou
3.0 / zoom (Julia).
Convention : run(params) -> dict de type "image" (PNG en base64).
"""
import base64
import io
import math
import numpy as np
from PIL import Image

PARAMS = [
    {"name": "kind", "label": "Fractale", "type": "select", "options": ["mandelbrot", "julia"], "default": "mandelbrot"},
    {"name": "size", "label": "Taille (px)", "type": "int", "min": 128, "max": 800, "default": 480},
    {"name": "max_iter", "label": "Itérations maximum", "type": "int", "min": 20, "max": 300, "default": 80},
    {"name": "zoom", "label": "Zoom", "type": "float", "min": 0.5, "max": 200.0, "default": 1.0},
    {"name": "center_x", "label": "Centre x", "type": "float", "min": -2.0, "max": 2.0, "default": 0.0},
    {"name": "center_y", "label": "Centre y", "type": "float", "min": -2.0, "max": 2.0, "default": 0.0},
    {"name": "c_real", "label": "c (réel) pour Julia", "type": "float", "min": -2.0, "max": 2.0, "default": -0.8},
    {"name": "c_imag", "label": "c (imaginaire) pour Julia", "type": "float", "min": -2.0, "max": 2.0, "default": 0.156},
    {"name": "palette", "label": "Palette", "type": "select", "options": ["violet", "rose", "nuit"], "default": "violet"},
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

PALETTES = {
    "violet": ["#0f0820", "#4c1d95", "#8b5cf6", "#f9a8d4", "#ffffff"],
    "rose": ["#1a0716", "#831843", "#ec4899", "#f9a8d4", "#ffffff"],
    "nuit": ["#02010a", "#1e1b4b", "#4338ca", "#a78bfa", "#f5f3ff"],
}
BAILOUT2 = 1e4  # |z|² au-delà duquel le point a divergé (grand : couleurs lissées plus justes)


def escape_values(kind, size, max_iter, zoom, cx, cy, c_real, c_imag):
    """Tableau size x size : mu lissé pour les points qui divergent, -1 pour ceux qui restent bornés."""
    span = (3.5 if kind == "mandelbrot" else 3.0) / zoom
    step = span / size
    idx = np.arange(size) - (size - 1) / 2  # demi-entiers : symétrie exacte
    xs = cx + idx * step
    ys = cy - idx * step  # la ligne 0 est en haut : y vers le haut
    X, Y = np.meshgrid(xs, ys)
    pix = (X + 1j * Y).ravel()
    if kind == "mandelbrot":
        c = pix.copy()
        z = np.zeros_like(pix)
    else:
        c = np.full(pix.shape, complex(c_real, c_imag))
        z = pix.copy()
    mu = np.full(pix.shape, -1.0)
    alive = np.arange(pix.size)  # indices des points encore en jeu
    for i in range(max_iter):
        z = z * z + c
        out = (z.real * z.real + z.imag * z.imag) > BAILOUT2
        if out.any():
            done = alive[out]
            mod = np.abs(z[out])
            mu[done] = i + 1 - np.log2(np.log(mod))
            keep = ~out
            alive, z, c = alive[keep], z[keep], c[keep]
            if alive.size == 0:
                break
    return mu.reshape(size, size)


def colorize(mu, palette, max_iter):
    lut = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in
                    (gradient(PALETTES[palette], k / 255) for k in range(256))], dtype=np.uint8)
    inside = mu < 0
    u = np.clip(np.sqrt(np.maximum(mu, 0) / max_iter), 0, 1)
    idx = np.rint(u * 255).astype(np.int64)
    img = lut[idx]
    img[inside] = lut[0]
    return img


def run(params):
    p = read_params(params, PARAMS)
    mu = escape_values(p["kind"], p["size"], p["max_iter"], p["zoom"], p["center_x"], p["center_y"],
                       p["c_real"], p["c_imag"])
    arr = colorize(mu, p["palette"], p["max_iter"])
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    data = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    return {"type": "image", "format": "png", "data": data, "width": p["size"], "height": p["size"],
            "palette": PALETTES[p["palette"]]}
