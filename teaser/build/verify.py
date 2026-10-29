"""Checks on the finished teaser: a contact sheet (one frame every 2 s), the narration placed against the shot
boundaries, and the audio levels. Usage: python verify.py [video]
"""
import json, os, subprocess, sys
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__)); T = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from assemble import TL, VO, END, NARR, AUD, PFX

video = sys.argv[1] if len(sys.argv) > 1 else os.path.join(T, PFX + "B2B_Exam_Prep_Teaser_1080p.mp4")
out = os.path.join(HERE, "verify"); os.makedirs(out, exist_ok=True)

# 1. contact sheet: one frame every 2 s, labelled with its time (PIL: ffmpeg's drawtext has no font config on Windows)
from PIL import Image, ImageDraw
import glob, shutil
tmp = os.path.join(out, "_frames"); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-vf", "fps=1/2,scale=384:-1", os.path.join(tmp, "f%04d.png")], check=True)
fs = sorted(glob.glob(os.path.join(tmp, "f*.png"))); cols = 6; W, H = 384, 216
rows = (len(fs) + cols - 1) // cols; sheet_im = Image.new("RGB", (cols * W, rows * (H + 16)), (0, 0, 0)); dr = ImageDraw.Draw(sheet_im)
for i, f in enumerate(fs):
    im = Image.open(f).convert("RGB").resize((W, H)); x = (i % cols) * W; y = (i // cols) * (H + 16)
    sheet_im.paste(im, (x, y)); dr.text((x + 4, y + H + 2), f"{i * 2:5.1f}s", fill=(255, 255, 255))
sheet = os.path.join(out, "sheet.png"); sheet_im.save(sheet); shutil.rmtree(tmp, ignore_errors=True)
print("sheet:", sheet, sheet_im.size)

# 2. narration against the shots
timing = json.load(open(os.path.join(NARR, "timing.json")))
def shot_at(t):
    for name, s, e, *_ in TL:
        if s <= t < e: return name
    return "?"
print(f"{'line':6s} {'start':>6s} {'end':>6s}  shot at start -> at end   gap to next")
ids = sorted(VO, key=VO.get)
for i, lid in enumerate(ids):
    s = VO[lid]; e = s + timing[lid]["dur"]
    nxt = VO[ids[i + 1]] if i + 1 < len(ids) else END
    flag = "  OVERLAP" if e > nxt else ""
    print(f"{lid:6s} {s:6.1f} {e:6.1f}  {shot_at(s):8s} -> {shot_at(e - 0.05):8s}   {nxt - e:5.1f}s{flag}")

# 3. levels of the mix
mix = os.path.join(AUD, PFX + "mix.wav")
if os.path.exists(mix):
    y, sr = sf.read(mix); mono = y.mean(1)
    rms = 20 * np.log10(np.sqrt(np.mean(mono ** 2)) + 1e-9); peak = 20 * np.log10(np.max(np.abs(y)) + 1e-9)
    print(f"mix: {len(y)/sr:.1f}s, rms {rms:.1f} dBFS, peak {peak:.1f} dBFS")
    # loudness per 10 s window, to see the shape of the bed
    w = int(10 * sr)
    print("rms per 10 s:", " ".join(f"{20*np.log10(np.sqrt(np.mean(mono[i:i+w]**2))+1e-9):5.1f}" for i in range(0, len(mono) - w + 1, w)))
r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "default=nw=1", video], capture_output=True, text=True)
print(r.stdout.strip())
