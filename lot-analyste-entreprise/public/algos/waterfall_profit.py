"""waterfall_profit : du chiffre d'affaires au résultat net, en cascade (graphique en cascade ou « waterfall »).

 marge brute = CA - coût des ventes ; résultat avant impôt = marge brute - marketing - salaires - autres charges ;
 impôt = taux * résultat avant impôt (0 si le résultat est négatif) ; résultat net = résultat avant impôt - impôt.
Convention : run(params) -> "image" + résumé.
"""
import base64
import io
import math
import unicodedata
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PARAMS = [
    {"name": "revenue", "label": "Chiffre d'affaires (€)", "type": "int", "min": 10000, "max": 1000000, "default": 200000},
    {"name": "cogs_pct", "label": "Coût des ventes (% du CA)", "type": "float", "min": 20.0, "max": 80.0, "default": 45.0},
    {"name": "marketing_pct", "label": "Marketing (% du CA)", "type": "float", "min": 2.0, "max": 30.0, "default": 12.0},
    {"name": "salaries_pct", "label": "Salaires (% du CA)", "type": "float", "min": 5.0, "max": 40.0, "default": 22.0},
    {"name": "other_pct", "label": "Autres charges (% du CA)", "type": "float", "min": 0.0, "max": 20.0, "default": 6.0},
    {"name": "tax_rate", "label": "Taux d'impôt (%)", "type": "float", "min": 0.0, "max": 40.0, "default": 25.0},
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

SS = 2  # les formes sont dessinées en 2x puis réduites (bords lisses) ; le texte est posé ensuite en 1x
INK, MUTED, GRID, BG = "#0f172a", "#64748b", "#e2e8f0", "#f8fafc"
BLUE, TEAL, AMBER, ROSE, VIOLET, GREEN = "#2563eb", "#0d9488", "#f59e0b", "#e11d48", "#7c3aed", "#16a34a"
SERIES = [BLUE, TEAL, AMBER, ROSE, VIOLET, GREEN]


_ASCII = {"€": "EUR", "²": "2", "’": "'", "×": "x", "≥": ">=", "≤": "<=", "→": "->", "–": "-", "«": '"', "»": '"', "œ": "oe", "Œ": "OE", "\u202f": " ", "\u00a0": " "}


def ascii_text(s):
    """La police intégrée de Pillow ne contient que l'ASCII : on retire les accents (é -> e) et on remplace €, ², ’…
    Les libellés complets avec accents sont renvoyés dans la sortie (title, summary) pour être affichés par le site."""
    for k, v in _ASCII.items():
        s = s.replace(k, v)
    s = "".join(ch for ch in unicodedata.normalize("NFD", s) if not unicodedata.combining(ch))
    return "".join(ch if ord(ch) < 128 else "?" for ch in s)


def font(size):
    """Police lisible si FreeType est disponible, sinon la police bitmap par défaut."""
    try:
        return ImageFont.load_default(size)
    except Exception:
        return ImageFont.load_default()


class Chart:
    """Mini bibliothèque de graphiques : coordonnées en pixels de l'image finale."""

    def __init__(self, width, height):
        self.w, self.h = int(width), int(height)
        self.big = Image.new("RGB", (self.w * SS, self.h * SS), BG)
        self.d = ImageDraw.Draw(self.big)
        self.texts = []

    def _s(self, pts):
        return [(x * SS, y * SS) for x, y in pts]

    def line(self, pts, color, width=2.0):
        self.d.line(self._s(pts), fill=color, width=max(1, int(round(width * SS))), joint="curve")

    def dashed(self, a, b, color, width=1.5, dash=7):
        length = math.hypot(b[0] - a[0], b[1] - a[1])
        if length == 0:
            return
        n = max(1, int(length // dash))
        for i in range(0, n, 2):
            t0, t1 = i / n, min(1.0, (i + 1) / n)
            self.line([(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0), (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)], color, width)

    def rect(self, x0, y0, x1, y1, fill=None, outline=None):
        if x1 < x0:
            x0, x1 = x1, x0
        if y1 < y0:
            y0, y1 = y1, y0
        self.d.rectangle([x0 * SS, y0 * SS, x1 * SS, y1 * SS], fill=fill, outline=outline)

    def circle(self, x, y, r, fill, outline=None):
        self.d.ellipse([(x - r) * SS, (y - r) * SS, (x + r) * SS, (y + r) * SS], fill=fill, outline=outline)

    def polygon(self, pts, fill):
        self.d.polygon(self._s(pts), fill=fill)

    def text(self, x, y, s, size=12, color=INK, anchor="la"):
        self.texts.append((x, y, ascii_text(str(s)), size, color, anchor))

    def finish(self):
        img = self.big.resize((self.w, self.h), Image.LANCZOS)
        d = ImageDraw.Draw(img)
        for x, y, s, size, color, anchor in self.texts:
            d.text((x, y), s, fill=color, font=font(size), anchor=anchor)
        return img


def nice_ticks(vmin, vmax, n=5):
    """Valeurs rondes qui encadrent [vmin, vmax] (la dernière graduation est >= vmax)."""
    if vmax <= vmin:
        vmax = vmin + 1
    raw = (vmax - vmin) / max(1, n)
    mag = 10 ** math.floor(math.log10(raw))
    step = min((m * mag for m in (1, 2, 2.5, 5, 10) if m * mag >= raw), default=10 * mag)
    v = math.floor(vmin / step + 1e-9) * step
    ticks = []
    while True:
        ticks.append(round(v, 10))
        if v >= vmax - step * 0.001:
            break
        v += step
    return ticks


def fmt(v):
    """Nombre lisible : 12 500, 1,2 k, 3,4 M."""
    a = abs(v)
    if a >= 1e6:
        s = ("%.1f" % (v / 1e6)).rstrip("0").rstrip(".") + " M"
    elif a >= 1e4:
        s = "{:,.0f}".format(v).replace(",", " ")
    elif a >= 100 or float(v).is_integer():
        s = "%d" % round(v)
    else:
        s = ("%.2f" % v).rstrip("0").rstrip(".")
    return s.replace(".", ",")


def frame(chart, box, ymin, ymax, ticks, title=None, xlabel=None, ylabel=None):
    """Cadre du graphique : grille horizontale, graduations de l'axe y, titre. Renvoie la fonction y -> pixel."""
    x0, y0, x1, y1 = box

    def ypix(v):
        return y1 - (v - ymin) / (ymax - ymin) * (y1 - y0)

    for t in ticks:
        y = ypix(t)
        chart.line([(x0, y), (x1, y)], GRID, 1)
        chart.text(x0 - 6, y, fmt(t), 11, MUTED, "rm")
    chart.line([(x0, y1), (x1, y1)], MUTED, 1.5)
    if title:
        chart.text(x0, 10, title, 15, INK, "la")
    if xlabel:
        chart.text((x0 + x1) / 2, chart.h - 30, xlabel, 11, MUTED, "ms")
    if ylabel:
        chart.text(8, y0 - 24, ylabel, 11, MUTED, "la")
    return ypix


def chart_size(p):
    """Dimensions de l'image : largeur demandée, hauteur proportionnelle (rapport 0.62)."""
    w = int(p["width"])
    return w, max(64, int(round(w * 0.62)))


def legend(chart, x, y, items):
    """Légende horizontale : liste de (couleur, libellé)."""
    for color, label in items:
        chart.rect(x, y + 3, x + 12, y + 11, fill=color)
        chart.text(x + 17, y, label, 11, INK, "la")
        x += 28 + 6.2 * len(label)


def to_data_uri(img):
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def income_statement(p):
    rev = float(p["revenue"])
    cogs = rev * p["cogs_pct"] / 100
    gross = rev - cogs
    mk, sal, oth = (rev * p[k] / 100 for k in ("marketing_pct", "salaries_pct", "other_pct"))
    ebt = gross - mk - sal - oth
    tax = max(0.0, ebt) * p["tax_rate"] / 100
    return {"revenue": rev, "cogs": cogs, "gross": gross, "marketing": mk, "salaries": sal, "other": oth, "ebt": ebt, "tax": tax, "net": ebt - tax}


def run(params):
    p = read_params(params, PARAMS)
    s = income_statement(p)
    bars = [("CA", "total", s["revenue"]), ("Cout ventes", "delta", -s["cogs"]), ("Marge brute", "total", s["gross"]),
            ("Marketing", "delta", -s["marketing"]), ("Salaires", "delta", -s["salaries"]), ("Autres", "delta", -s["other"]),
            ("Avant impot", "total", s["ebt"]), ("Impot", "delta", -s["tax"]), ("Net", "total", s["net"])]
    levels, level = [], 0.0
    for _, kind, v in bars:
        if kind == "total":
            levels.append((0.0, v))
            level = v
        else:
            levels.append((level, level + v))
            level += v
    lo = min(0.0, min(min(a, b) for a, b in levels))
    hi = max(max(a, b) for a, b in levels)
    ticks = nice_ticks(lo, hi * 1.08, 5)
    w, h = chart_size(p)
    c = Chart(w, h)
    box = (66, 52, w - 16, h - 62)
    ypix = frame(c, box, ticks[0], ticks[-1], ticks, "Du chiffre d'affaires au resultat net", None, "EUR")
    slot = (box[2] - box[0]) / len(bars)
    for i, ((label, kind, v), (a, b)) in enumerate(zip(bars, levels)):
        x0 = box[0] + i * slot + slot * 0.14
        color = BLUE if kind == "total" and v >= 0 else (ROSE if v < 0 else GREEN)
        c.rect(x0, ypix(a), x0 + slot * 0.72, ypix(b), fill=color)
        c.text(x0 + slot * 0.36, box[3] + 6, label, 10, MUTED, "ma")
        c.text(x0 + slot * 0.36, min(ypix(a), ypix(b)) - 4, fmt(round(v)), 10, INK, "ms")
    if ticks[0] < 0:
        c.line([(box[0], ypix(0)), (box[2], ypix(0))], INK, 1.2)
    return {
        "type": "image", "format": "png", "data": to_data_uri(c.finish()), "width": w, "height": h,
        "title": "Du chiffre d'affaires au résultat net",
        "summary": {k: round(v, 2) for k, v in s.items()} | {"net_margin_pct": round(100 * s["net"] / s["revenue"], 2)},
    }
