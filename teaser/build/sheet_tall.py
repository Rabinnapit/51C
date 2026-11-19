"""Contact sheets of a portrait frames dir: one row per segment, N frames spread over its length, each labelled with
its time in the shot. usage: python sheet_tall.py <frames-dir> <out-dir> [segments csv] [n] [tile-height] [rows-per-sheet]"""
import json, os, sys
from PIL import Image, ImageDraw
FR, OUT = sys.argv[1], sys.argv[2]
man = {s['name']: s for s in json.load(open(os.path.join(FR, 'manifest.json')))['segments']}
SEGS = sys.argv[3].split(',') if len(sys.argv) > 3 and sys.argv[3] != 'all' else list(man)
N = int(sys.argv[4]) if len(sys.argv) > 4 else 9
TH = int(sys.argv[5]) if len(sys.argv) > 5 else 340
PER = int(sys.argv[6]) if len(sys.argv) > 6 else 5
os.makedirs(OUT, exist_ok=True)
TW = round(TH * 9 / 16) + 30
for s0 in range(0, len(SEGS), PER):
    part = SEGS[s0:s0 + PER]
    sheet = Image.new('RGB', (N * (TW + 6) + 110, len(part) * (TH + 24)), '#181818'); dr = ImageDraw.Draw(sheet)
    for row, name in enumerate(part):
        fr = man[name]['frames']; tot = sum(d for _, d in fr); y = row * (TH + 24)
        dr.text((6, y + 8), '%s\n%.1f s\n%d fr' % (name, tot, len(fr)), fill='#fff')
        for k in range(N):
            t = tot * (k + 0.5) / N; acc = 0; pick = fr[-1][0]
            for p, d in fr:
                acc += d
                if acc >= t: pick = p; break
            im = Image.open(pick).convert('RGB'); w = round(TH * im.width / im.height); im = im.resize((w, TH), Image.LANCZOS)
            x = 110 + k * (TW + 6); sheet.paste(im, (x, y)); dr.text((x + 2, y + TH + 4), '%.1f s' % t, fill='#bbb')
    out = os.path.join(OUT, 'sheet_%d.jpg' % (s0 // PER)); sheet.save(out, quality=88); print(out, sheet.size, part)
