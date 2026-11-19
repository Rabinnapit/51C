"""Checks on the finished phone-sized cut: a contact sheet (one frame every 2 s), its size and length against the
landscape cut, and the loudness of its sound track. Usage: python verify_tall.py [video]
"""
import glob, os, shutil, subprocess, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); T = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from assemble import END, PFX

video = sys.argv[1] if len(sys.argv) > 1 else os.path.join(T, PFX + "B2B_Exam_Prep_Teaser_Phone_1080x1920.mp4")
out = os.path.join(HERE, "verify"); os.makedirs(out, exist_ok=True)
tmp = os.path.join(out, "_frames_tall"); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-vf", "fps=1/2,scale=270:-1", os.path.join(tmp, "f%04d.png")], check=True)
fs = sorted(glob.glob(os.path.join(tmp, "f*.png"))); cols = 10; W, H = 270, 480
rows = (len(fs) + cols - 1) // cols; sheet_im = Image.new("RGB", (cols * (W + 4), rows * (H + 18)), (0, 0, 0)); dr = ImageDraw.Draw(sheet_im)
for i, f in enumerate(fs):
    im = Image.open(f).convert("RGB").resize((W, H)); x = (i % cols) * (W + 4); y = (i // cols) * (H + 18)
    sheet_im.paste(im, (x, y)); dr.text((x + 4, y + H + 3), f"{i * 2:5.1f}s", fill=(255, 255, 255))
sheet = os.path.join(out, PFX + "sheet_tall.png"); sheet_im.save(sheet); shutil.rmtree(tmp, ignore_errors=True)
print("sheet:", sheet, sheet_im.size)

def probe(path, entries, stream=None):
    a = ["ffprobe", "-v", "error"] + (["-select_streams", stream] if stream else []) + ["-show_entries", entries, "-of", "default=nw=1", path]
    return subprocess.run(a, capture_output=True, text=True).stdout.strip().replace("\n", " ")
print(probe(video, "stream=codec_name,width,height,r_frame_rate,pix_fmt,color_range,color_space", "v:0"))
print(probe(video, "stream=codec_name,sample_rate,channels", "a:0"))
print(probe(video, "format=duration,size"), "| the landscape cut runs", END, "s")
r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", video, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
tail = r.stderr[-700:]
print("loudness:", " ".join(l.strip() for l in tail.splitlines() if any(k in l for k in ("I:", "LRA:", "Peak:"))))
