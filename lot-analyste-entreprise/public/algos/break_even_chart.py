"""break_even_chart : seuil de rentabilité (point mort) : combien d'unités faut-il vendre pour ne pas perdre d'argent ?

 chiffre d'affaires = prix * q ; coûts totaux = coûts fixes + coût variable * q
 seuil = coûts fixes / (prix - coût variable), arrondi À L'ENTIER SUPÉRIEUR (on ne vend pas une demi-unité).
Convention : run(params) -> "image" + résumé.
"""
import base64
import io
import unicodedata
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PARAMS = [
    {"name": "fixed_costs", "label": "Coûts fixes (€)", "type": "float", "min": 500.0, "max": 50000.0, "default": 12000.0},
    {"name": "price", "label": "Prix de vente unitaire (€)", "type": "float", "min": 5.0, "max": 500.0, "default": 40.0},
    {"name": "unit_cost", "label": "Coût variable unitaire (€)", "type": "float", "min": 1.0, "max": 400.0, "default": 22.0},
    {"name": "max_units", "label": "Unités affichées au minimum", "type": "int", "min": 10, "max": 5000, "default": 1000},
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


def break_even_units(fixed, price, unit_cost):
    """Plus petit nombre entier d'unités pour lequel le bénéfice est positif ou nul."""
    return int(math.ceil(fixed / (price - unit_cost) - 1e-9))


def profit(units, fixed, price, unit_cost):
    return units * price - (fixed + units * unit_cost)


def run(params):
    p = read_params(params, PARAMS)
    if p["price"] <= p["unit_cost"]:
        raise ValueError("price doit être supérieur à unit_cost (sinon aucune vente ne rapporte de marge) ; reçu : %r et %r" % (p["price"], p["unit_cost"]))
    fixed, price, vc = p["fixed_costs"], p["price"], p["unit_cost"]
    be = break_even_units(fixed, price, vc)
    xmax = max(p["max_units"], int(math.ceil(be * 1.5)))
    ymax = max(price * xmax, fixed + vc * xmax)
    w, h = chart_size(p)
    c = Chart(w, h)
    box = (66, 52, w - 16, h - 62)
    ticks = nice_ticks(0, ymax, 5)
    ypix = frame(c, box, 0, ticks[-1], ticks, "Seuil de rentabilité", "Unités vendues", "€")
    xpix = lambda q: box[0] + q / xmax * (box[2] - box[0])
    ymaxp = ticks[-1]
    ypix = lambda v, y0=box[1], y1=box[3]: y1 - v / ymaxp * (y1 - y0)
    c.polygon([(xpix(be), ypix(be * price)), (xpix(xmax), ypix(xmax * price)), (xpix(xmax), ypix(fixed + vc * xmax))], "#dcfce7")
    c.polygon([(xpix(0), ypix(0)), (xpix(be), ypix(be * price)), (xpix(0), ypix(fixed))], "#fee2e2")
    c.line([(xpix(0), ypix(fixed)), (xpix(xmax), ypix(fixed + vc * xmax))], ROSE, 2.5)
    c.line([(xpix(0), ypix(0)), (xpix(xmax), ypix(price * xmax))], BLUE, 2.5)
    c.dashed((xpix(0), ypix(fixed)), (xpix(xmax), ypix(fixed)), MUTED, 1.2)
    c.dashed((xpix(be), ypix(0)), (xpix(be), ypix(be * price)), AMBER, 1.5)
    c.circle(xpix(be), ypix(be * price), 5.5, AMBER, INK)
    c.text(xpix(be) + 8, ypix(be * price) + 10, "Seuil : %d unités" % be, 12, INK, "la")
    for q in nice_ticks(0, xmax, 5):
        c.text(xpix(q), box[3] + 6, fmt(q), 11, MUTED, "ma")
    legend(c, box[0], h - 18, [(BLUE, "Chiffre d'affaires"), (ROSE, "Coûts totaux"), ("#fee2e2", "Perte"), ("#dcfce7", "Bénéfice")])
    return {
        "type": "image", "format": "png", "data": to_data_uri(c.finish()), "width": w, "height": h,
        "summary": {"break_even_units": be, "break_even_revenue": round(be * price, 2), "margin_per_unit": round(price - vc, 2),
                    "margin_rate_pct": round(100 * (price - vc) / price, 1), "profit_at_break_even": round(profit(be, fixed, price, vc), 2)},
    }
