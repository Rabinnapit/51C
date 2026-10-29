"""Draw the Board Ready app icons (PNG for the installable web app, SVG for the browser tab).

  python tools/make_icons.py      (run once; the output in src/web/icons is committed)

Needs Pillow and a bold system font (Segoe UI Bold on Windows, DejaVu Sans Bold on Linux). Adapted from B2B Exam Prep's
make_icons.py: navy square, a gold check mark under the "BR" monogram.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "web" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

NAVY, NAVY_DARK, GOLD, PAPER = (23, 58, 107), (14, 36, 70), (226, 182, 87), (246, 244, 238)
FONTS = ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]


def font(size):
    for f in FONTS:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def draw_icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, size, size], fill=NAVY)
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=NAVY)
    # a darker diagonal band for depth
    band = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.polygon([(0, size * 0.70), (size, size * 0.36), (size, size), (0, size)], fill=NAVY_DARK + (150,))
    if not maskable:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
        band.putalpha(Image.composite(band.split()[3], Image.new("L", (size, size), 0), mask))
    img = Image.alpha_composite(img, band)
    d = ImageDraw.Draw(img)
    scale = 0.74 if maskable else 1.0          # keep the mark inside the maskable safe zone
    cx = size / 2
    # the monogram
    f = font(int(size * 0.36 * scale))
    text = "BR"
    tw = d.textlength(text, font=f)
    d.text((cx - tw / 2, size * (0.50 - 0.36 * scale)), text, font=f, fill=PAPER)
    # the check mark: the board's "pass"
    w = max(2, int(size * 0.07 * scale))
    pts = [(cx - size * 0.22 * scale, size * (0.50 + 0.18 * scale)), (cx - size * 0.06 * scale, size * (0.50 + 0.30 * scale)), (cx + size * 0.24 * scale, size * (0.50 + 0.08 * scale))]
    d.line(pts, fill=GOLD, width=w, joint="curve")
    r = w / 2
    for x, y in (pts[0], pts[2]):
        d.ellipse([x - r, y - r, x + r, y + r], fill=GOLD)
    return img


for name, size, mask in [("icon-192.png", 192, False), ("icon-512.png", 512, False), ("maskable-512.png", 512, True),
                         ("apple-touch-icon.png", 180, True), ("icon-32.png", 32, False)]:
    draw_icon(size, mask).save(OUT / name)
    print("wrote", OUT / name)

svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
       '<rect width="64" height="64" rx="14" fill="#173a6b"/>'
       '<text x="32" y="31" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="22" fill="#f6f4ee">BR</text>'
       '<path d="M19 43 L28 51 L46 35" fill="none" stroke="#e2b657" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
       '</svg>')
(ROOT / "src" / "web" / "favicon.svg").write_text(svg, encoding="utf-8")
print("wrote favicon.svg")
