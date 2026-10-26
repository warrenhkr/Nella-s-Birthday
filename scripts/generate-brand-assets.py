#!/usr/bin/env python3
"""Génère les ressources visuelles provisoires du site Club Otaku ENEAM.

Sorties (à remplacer par les fichiers officiels du club quand ils seront fournis,
voir docs/ASSETS-A-FOURNIR.md) :

  public/favicon.ico              icône d'onglet, dérivée du logo officiel
  public/apple-touch-icon.png     icône iOS (180x180)
  public/icon-512.png             icône PWA / partage (512x512)
  public/og-default.png           image de partage (Open Graph, 1200x630)

L'emblème utilisé est extrait de public/logo-club-otaku.jpg (logo officiel du
club) : rien n'est inventé, seul l'habillage (fond sombre rouge/noir du site,
cadre, typographie) est ajouté.

Dépendance : Pillow (outil de développement uniquement, pas une dépendance
d'exécution du site).

Usage : python scripts/generate-brand-assets.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
LOGO = PUBLIC / "logo-club-otaku.jpg"

# --- palette du site (app/assets/css/main.css) -------------------------------
DARK = (5, 5, 10)          # --bg-color (thème sombre)
DARK_SOFT = (11, 11, 20)   # --bg-color-soft
CARD = (18, 18, 31)        # --panel-color-solid
RED = (193, 18, 45)        # --primary-color
RED_DARK = (143, 16, 35)   # --accent-color
CREAM = (244, 242, 251)    # --text-color (thème sombre)

FONTS = Path("C:/Windows/Fonts")
FONT_BOLD = FONTS / "arialbd.ttf"
FONT_REGULAR = FONTS / "arial.ttf"


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        return ImageFont.load_default(size)


def emblem() -> Image.Image:
    """Découpe le médaillon central du logo officiel (fond blanc retiré)."""
    logo = Image.open(LOGO).convert("RGB")
    # Le médaillon circulaire « OTAKU » occupe le centre du logo (1280x719).
    w, h = logo.size
    side = int(h * 0.78)
    cx, cy = int(w * 0.505), int(h * 0.44)
    box = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
    crop = logo.crop(box)

    # Le fond est blanc : on le rend transparent par diffusion depuis les bords,
    # ce qui préserve les blancs intérieurs (pages du livre, disque du soleil).
    rgba = crop.convert("RGBA")
    px = rgba.load()
    cw, ch = rgba.size
    from collections import deque

    seen = bytearray(cw * ch)
    queue: deque[tuple[int, int]] = deque()
    for x in range(cw):
        for y in (0, ch - 1):
            queue.append((x, y))
    for y in range(ch):
        for x in (0, cw - 1):
            queue.append((x, y))

    def close_to_white(p: tuple[int, int, int, int]) -> bool:
        return p[0] > 236 and p[1] > 236 and p[2] > 236

    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= cw or y >= ch:
            continue
        idx = y * cw + x
        if seen[idx]:
            continue
        seen[idx] = 1
        if not close_to_white(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return rgba


def circular(img: Image.Image, size: int, ring: tuple[int, int, int] | None = RED,
             bg: tuple[int, int, int] | None = CREAM, ring_width: int = 0) -> Image.Image:
    """Place l'emblème dans un disque (fond clair ou transparent)."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if bg is not None:
        ImageDraw.Draw(canvas).ellipse((0, 0, size - 1, size - 1), fill=(*bg, 255))
    inner = size - (ring_width * 2)
    art = img.resize((inner, inner), Image.LANCZOS)
    canvas.paste(art, (ring_width, ring_width), art)
    if ring is not None and ring_width > 0:
        ImageDraw.Draw(canvas).ellipse(
            (ring_width // 2, ring_width // 2, size - ring_width // 2 - 1, size - ring_width // 2 - 1),
            outline=(*ring, 255), width=ring_width,
        )
    return canvas


def og_background(width: int, height: int) -> Image.Image:
    """Fond sombre du site : dégradé, grille discrète, bandeau rouge."""
    base = Image.new("RGB", (width, height), DARK)
    draw = ImageDraw.Draw(base)
    # dégradé vertical
    for y in range(height):
        t = y / height
        color = (
            int(DARK[0] + (DARK_SOFT[0] - DARK[0]) * t),
            int(DARK[1] + (DARK_SOFT[1] - DARK[1]) * t),
            int(DARK[2] + (DARK_SOFT[2] - DARK[2]) * t),
        )
        draw.line([(0, y), (width, y)], fill=color)
    # grille technique
    grid = Image.new("RGB", (width, height), DARK)
    gdraw = ImageDraw.Draw(grid)
    for x in range(0, width, 60):
        gdraw.line([(x, 0), (x, height)], fill=(24, 24, 40))
    for y in range(0, height, 60):
        gdraw.line([(0, y), (width, y)], fill=(24, 24, 40))
    base = Image.blend(base, grid, 0.55)
    # halo rouge
    glow = Image.new("RGB", (width, height), DARK)
    ImageDraw.Draw(glow).ellipse((width * 0.45, -height * 0.55, width * 1.25, height * 0.85), fill=RED_DARK)
    glow = glow.filter(ImageFilter.GaussianBlur(150))
    base = Image.blend(base, glow, 0.35)
    # bandeau diagonal rouge
    band = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ImageDraw.Draw(band).polygon(
        [(width * 0.78, 0), (width, 0), (width, height * 0.42), (width * 0.86, height * 0.42)],
        fill=(*RED, 210),
    )
    base = Image.alpha_composite(base.convert("RGBA"), band).convert("RGB")
    return base


def build_og() -> Path:
    width, height = 1200, 630
    canvas = og_background(width, height).convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    # pastille claire contenant l'emblème officiel
    badge_size = 300
    badge_xy = (92, (height - badge_size) // 2)
    badge = circular(emblem(), badge_size, ring=RED, bg=CREAM, ring_width=6)
    shadow = Image.new("RGBA", (badge_size + 60, badge_size + 60), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((30, 30, badge_size + 30, badge_size + 30), fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas.alpha_composite(shadow, (badge_xy[0] - 30, badge_xy[1] - 30))
    canvas.alpha_composite(badge, badge_xy)

    # textes
    x = badge_xy[0] + badge_size + 66
    draw.text((x, 168), "CLUB OTAKU", font=font(FONT_BOLD, 92), fill=CREAM)
    draw.rectangle((x + 4, 282, x + 150, 292), fill=RED)
    draw.text((x, 316), "ENEAM • anime · manga · culture", font=font(FONT_REGULAR, 40), fill=(230, 60, 85))
    draw.text((x, 386), "Communauté, événements, cartes membres,", font=font(FONT_REGULAR, 32), fill=(167, 165, 182))
    draw.text((x, 428), "boutique et actualités.", font=font(FONT_REGULAR, 32), fill=(167, 165, 182))
    draw.text((92, height - 76), "club-otaku-eneam.vercel.app", font=font(FONT_BOLD, 26), fill=(120, 118, 140))

    out = PUBLIC / "og-default.png"
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    return out


def build_icons() -> list[Path]:
    art = emblem()
    written: list[Path] = []

    # favicon multi-résolutions (fond clair comme le logo officiel + anneau rouge)
    base = circular(art, 256, ring=RED, bg=CREAM, ring_width=5)
    ico = PUBLIC / "favicon.ico"
    base.save(ico, sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    written.append(ico)

    for name, size, ring_w in (("apple-touch-icon.png", 180, 4), ("icon-512.png", 512, 8)):
        img = circular(art, size, ring=RED, bg=CREAM, ring_width=ring_w)
        path = PUBLIC / name
        img.save(path, "PNG", optimize=True)
        written.append(path)
    return written


def main() -> int:
    if not LOGO.exists():
        print(f"Logo officiel introuvable : {LOGO}", file=sys.stderr)
        return 1
    written = build_icons()
    written.append(build_og())
    for path in written:
        print(f"{path.relative_to(ROOT)} — {path.stat().st_size} octets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
