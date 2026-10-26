"""moving_average_forecast : ventes mensuelles, moyenne mobile et prévision par tendance linéaire.

Méthode (celle d'un premier tableau de bord prévisionnel) :
 - série simulée = base + tendance * t + saisonnalité * sin(2*pi*t/12) + bruit ;
 - moyenne mobile sur `window` mois : lisse le bruit mais retarde sur la tendance ;
 - prévision : droite des moindres carrés (régression linéaire) prolongée de `horizon` mois.
Convention : run(params) -> dict de type "image" (PNG en base64) + résumé chiffré.
"""
import base64
import io
import unicodedata
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PARAMS = [
    {"name": "months", "label": "Mois d'historique", "type": "int", "min": 12, "max": 48, "default": 24},
    {"name": "window", "label": "Fenêtre de la moyenne mobile", "type": "int", "min": 2, "max": 6, "default": 3},
    {"name": "horizon", "label": "Mois à prévoir", "type": "int", "min": 1, "max": 12, "default": 6},
    {"name": "trend", "label": "Tendance (unités par mois)", "type": "float", "min": -5.0, "max": 20.0, "default": 4.0},
    {"name": "seasonality", "label": "Saisonnalité", "type": "float", "min": 0.0, "max": 40.0, "default": 15.0},
    {"name": "noise", "label": "Bruit", "type": "float", "min": 0.0, "max": 30.0, "default": 8.0},
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


def simulate(p):
    rng = np.random.default_rng(p["seed"])
    t = np.arange(p["months"], dtype=float)
    series = 200 + p["trend"] * t + p["seasonality"] * np.sin(2 * math.pi * t / 12) + p["noise"] * rng.standard_normal(p["months"])
    return t, series


def moving_average(series, window):
    """Moyenne mobile : valeur i = moyenne des `window` derniers points (None tant que l'historique est trop court)."""
    out = [None] * len(series)
    for i in range(window - 1, len(series)):
        out[i] = float(np.mean(series[i - window + 1:i + 1]))
    return out


def linear_fit(t, y):
    """Pente et ordonnée à l'origine des moindres carrés."""
    tm, ym = t.mean(), y.mean()
    denom = float(((t - tm) ** 2).sum())
    slope = float(((t - tm) * (y - ym)).sum() / denom) if denom else 0.0
    return slope, float(ym - slope * tm)


def run(params):
    p = read_params(params, PARAMS)
    t, y = simulate(p)
    ma = moving_average(y, p["window"])
    slope, intercept = linear_fit(t, y)
    future_t = np.arange(p["months"], p["months"] + p["horizon"], dtype=float)
    forecast = intercept + slope * future_t
    # erreur de la moyenne mobile utilisée comme prévision du mois suivant (MAPE)
    errors = [abs(y[i + 1] - ma[i]) / abs(y[i + 1]) for i in range(p["window"] - 1, p["months"] - 1) if y[i + 1] != 0]
    mape = 100 * float(np.mean(errors)) if errors else 0.0

    w, h = chart_size(p)
    c = Chart(w, h)
    lo = float(min(y.min(), forecast.min())) * 0.95
    hi = float(max(y.max(), forecast.max())) * 1.05
    ticks = nice_ticks(lo, hi, 5)
    lo, hi = min(lo, ticks[0]), max(hi, ticks[-1])
    box = (58, 52, w - 16, h - 62)
    ypix = frame(c, box, lo, hi, ticks, "Ventes mensuelles et prévision", "Mois", None)
    total = p["months"] + p["horizon"] - 1
    xpix = lambda i: box[0] + (i / max(1, total)) * (box[2] - box[0])
    c.rect(xpix(p["months"] - 1), box[1], box[2], box[3], fill="#eef2ff")
    c.line([(xpix(i), ypix(float(v))) for i, v in enumerate(y)], BLUE, 2.5)
    pts = [(xpix(i), ypix(v)) for i, v in enumerate(ma) if v is not None]
    if len(pts) > 1:
        c.line(pts, AMBER, 2.5)
    c.line([(xpix(p["months"] - 1), ypix(intercept + slope * (p["months"] - 1)))] + [(xpix(float(i)), ypix(float(v))) for i, v in zip(future_t, forecast)], TEAL, 2.5)
    for i in range(0, total + 1, max(1, total // 8)):
        c.text(xpix(i), box[3] + 6, str(i + 1), 11, MUTED, "ma")
    legend(c, box[0], h - 18, [(BLUE, "Ventes"), (AMBER, "Moyenne mobile %d mois" % p["window"]), (TEAL, "Prévision")])
    return {
        "type": "image", "format": "png", "data": to_data_uri(c.finish()), "width": w, "height": h,
        "summary": {"slope": round(slope, 3), "intercept": round(intercept, 2), "forecast": [round(float(v), 1) for v in forecast],
                    "mape_moyenne_mobile_pct": round(mape, 2), "history": [round(float(v), 1) for v in y]},
    }
