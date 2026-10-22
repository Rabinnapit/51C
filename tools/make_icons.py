"""Draw the app icons (PNG for the installable web app, SVG for the browser tab).

  python tools/make_icons.py      (run once; the output in src/web/icons is committed)

Needs Pillow and a bold system font (Segoe UI Bold on Windows, DejaVu Sans Bold on Linux).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "web" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

PINE, PINE_DARK, BRASS, PAPER = (31, 94, 70), (19, 64, 47), (201, 150, 58), (246, 248, 244)
FONTS = ["C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]


def font(size):
    for f in FONTS:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def draw_icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # background: full bleed for maskable (the OS crops it), rounded square otherwise
    if maskable:
        d.rectangle([0, 0, size, size], fill=PINE)
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=PINE)
    # soft diagonal band for depth
    band = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.polygon([(0, size * 0.72), (size, size * 0.38), (size, size), (0, size)], fill=PINE_DARK + (150,))
    if not maskable:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
        band.putalpha(Image.composite(band.split()[3], Image.new("L", (size, size), 0), mask))
    img = Image.alpha_composite(img, band)
    d = ImageDraw.Draw(img)
    scale = 0.74 if maskable else 1.0          # keep the mark inside the maskable safe zone
    cx = size / 2
    # the trail: three checkpoints climbing to a finish dot
    pts = [(cx - size * 0.27 * scale, size * (0.50 + 0.24 * scale)), (cx - size * 0.06 * scale, size * (0.50 + 0.14 * scale)),
           (cx + size * 0.10 * scale, size * (0.50 + 0.19 * scale)), (cx + size * 0.27 * scale, size * (0.50 + 0.09 * scale))]
    d.line(pts, fill=BRASS, width=max(2, int(size * 0.035 * scale)), joint="curve")
    r = size * 0.035 * scale
    for x, y in pts[:-1]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=PAPER)
    x, y = pts[-1]
    R = r * 1.7
    d.ellipse([x - R, y - R, x + R, y + R], fill=BRASS)
    # wordmark
    f = font(int(size * 0.30 * scale))
    text = "B2B"
    tw = d.textlength(text, font=f)
    d.text((cx - tw / 2, size * (0.50 - 0.34 * scale)), text, font=f, fill=PAPER)
    return img


for name, size, mask in [("icon-192.png", 192, False), ("icon-512.png", 512, False), ("maskable-512.png", 512, True),
                         ("apple-touch-icon.png", 180, True), ("icon-32.png", 32, False)]:
    draw_icon(size, mask).save(OUT / name)
    print("wrote", OUT / name)

svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
       '<rect width="64" height="64" rx="14" fill="#1f5e46"/>'
       '<path d="M14 46 L28 40 L39 43 L50 34" fill="none" stroke="#c9963a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
       '<circle cx="50" cy="34" r="4" fill="#c9963a"/>'
       '<text x="32" y="29" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="19" fill="#f6f8f4">B2B</text>'
       '</svg>')
(ROOT / "src" / "web" / "favicon.svg").write_text(svg, encoding="utf-8")
print("wrote favicon.svg")
