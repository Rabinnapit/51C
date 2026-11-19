"""Contact sheets of a captured frames dir: for each segment, N frames spread over its duration.
usage: python sheet.py <frames-dir> <out-dir> <segments csv> [n] [tile-width]"""
import json, os, sys
from PIL import Image
FR, OUT, SEGS = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
N = int(sys.argv[4]) if len(sys.argv) > 4 else 6
W = int(sys.argv[5]) if len(sys.argv) > 5 else 640
os.makedirs(OUT, exist_ok=True)
man = {s['name']: s for s in json.load(open(os.path.join(FR, 'manifest.json')))['segments']}
for name in SEGS:
    fr = man[name]['frames']; tot = sum(d for _, d in fr)
    picks = []
    for k in range(N):
        t = tot * (k + 0.5) / N; acc = 0
        for p, d in fr:
            acc += d
            if acc >= t: picks.append(p); break
    ims = [Image.open(p).convert('RGB') for p in picks]
    h = round(W * ims[0].height / ims[0].width); cols = 3; rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * W, rows * h), '#000')
    for i, im in enumerate(ims): sheet.paste(im.resize((W, h), Image.LANCZOS), ((i % cols) * W, (i // cols) * h))
    sheet.save(os.path.join(OUT, name + '.jpg'), quality=88)
    print(name, len(fr), 'frames', round(tot, 2), 's')
