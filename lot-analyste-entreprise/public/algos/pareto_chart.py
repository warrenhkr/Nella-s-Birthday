"""pareto_chart : diagramme de Pareto (règle des 80/20) des causes de réclamations.

Les causes sont triées de la plus fréquente à la moins fréquente ; la courbe montre le cumul en %.
Les « causes vitales » sont les premières causes (en nombre minimal) dont le cumul atteint le seuil.
Convention : run(params) -> "image" + résumé (counts, cumul, causes vitales).
"""
import base64
import io
import unicodedata
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PARAMS = [
    {"name": "causes", "label": "Nombre de causes", "type": "int", "min": 4, "max": 12, "default": 8},
    {"name": "skew", "label": "Concentration (plus haut = plus inégal)", "type": "float", "min": 0.5, "max": 3.0, "default": 1.5},
    {"name": "total", "label": "Réclamations au total", "type": "int", "min": 200, "max": 5000, "default": 1000},
    {"name": "threshold", "label": "Seuil (%)", "type": "int", "min": 50, "max": 95, "default": 80},
    {"name": "seed", "label": "Graine (seed)", "type": "int", "min": 0, "max": 999999, "default": 42},
]
SHORT = ["Retard", "Abimé", "Erreur cmd", "Prix faux", "SAV lent", "Panne site", "Rembours.", "Emballage", "Facture", "Rupture", "Notice", "Rappel"]
NAMES = ["Retard de livraison", "Produit abîmé", "Erreur de commande", "Prix affiché faux", "Service client lent", "Site en panne",
         "Remboursement tardif", "Emballage inadapté", "Facture incorrecte", "Article indisponible", "Notice absente", "Appel non rappelé"]

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


def make_counts(causes, skew, total, seed):
    """Effectifs triés par ordre décroissant, dont la somme vaut exactement `total`."""
    rng = np.random.default_rng(seed)
    weights = np.array([(i + 1) ** -skew for i in range(causes)]) * rng.uniform(0.85, 1.15, causes)
    raw = weights / weights.sum() * total
    counts = np.floor(raw).astype(int)
    for i in np.argsort(-(raw - counts))[:total - int(counts.sum())]:
        counts[i] += 1
    return sorted((int(c) for c in counts), reverse=True)


def vital_few(counts, threshold):
    """Nombre minimal de premières causes dont le cumul atteint `threshold` %, et la liste des cumuls en %."""
    total = sum(counts)
    cumul, run_sum = [], 0
    for c in counts:
        run_sum += c
        cumul.append(100.0 * run_sum / total)
    k = next(i + 1 for i, v in enumerate(cumul) if v >= threshold)
    return k, cumul


def run(params):
    p = read_params(params, PARAMS)
    counts = make_counts(p["causes"], p["skew"], p["total"], p["seed"])
    k, cumul = vital_few(counts, p["threshold"])
    w, h = chart_size(p)
    c = Chart(w, h)
    box = (58, 52, w - 52, h - 62)
    ymax = max(counts) * 1.15
    ticks = nice_ticks(0, ymax, 5)
    ypix = frame(c, box, 0, ticks[-1], ticks, "Pareto des causes de réclamations", None, None)
    n = len(counts)
    slot = (box[2] - box[0]) / n
    for i, v in enumerate(counts):
        x0 = box[0] + i * slot + slot * 0.15
        c.rect(x0, ypix(v), x0 + slot * 0.7, box[3], fill=ROSE if i < k else "#94a3b8")
        c.text(x0 + slot * 0.35, box[3] + 6, SHORT[i], 10, MUTED, "ma")
    right = lambda v: box[3] - v / 100 * (box[3] - box[1])
    c.line([(box[0] + (i + 0.5) * slot, right(v)) for i, v in enumerate(cumul)], BLUE, 2.5)
    for i, v in enumerate(cumul):
        c.circle(box[0] + (i + 0.5) * slot, right(v), 3.5, BLUE)
    c.dashed((box[0], right(p["threshold"])), (box[2], right(p["threshold"])), AMBER, 1.5)
    for pct in (0, 50, 100):
        c.text(box[2] + 6, right(pct), "%d %%" % pct, 11, BLUE, "lm")
    c.text(box[2] + 6, right(p["threshold"]), "%d %%" % p["threshold"], 11, AMBER, "lm")
    legend(c, box[0], h - 18, [(ROSE, "Causes vitales (%d)" % k), ("#94a3b8", "Autres"), (AMBER, "Seuil %d %%" % p["threshold"])])
    return {
        "type": "image", "format": "png", "data": to_data_uri(c.finish()), "width": w, "height": h,
        "summary": {"counts": counts, "causes": NAMES[:n], "cumul_pct": [round(v, 1) for v in cumul], "vital_few": k,
                    "vital_share_pct": round(cumul[k - 1], 1), "causes_share_pct": round(100.0 * k / n, 1)},
    }
