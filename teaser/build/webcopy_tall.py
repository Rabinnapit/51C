"""The phone-sized copy of the intro that the app plays on a phone held upright (core/13-intro.js, meta.intro.tall):
a 720 x 1280 streaming encode and its poster, written into src/web/root/. The captions are the landscape cut's
(intro.vtt): both cuts have the same narration at the same times.
Usage, from teaser/build after assemble_tall.py:  python webcopy_tall.py [master.mp4]
  intro-tall.mp4         720x1280 H.264 High, AAC, about 12 MB, BT.709 limited range, moov first
  intro-tall-poster.jpg  the title card at 16.5 s
"""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__)); TEASER = os.path.dirname(HERE); REPO = os.path.dirname(TEASER)
OUT = os.path.join(REPO, "src", "web", "root"); os.makedirs(OUT, exist_ok=True)
MASTER = sys.argv[1] if len(sys.argv) > 1 else os.path.join(TEASER, "B2B_Exam_Prep_Teaser_Phone_1080x1920.mp4")
TARGET_MB, ABR = 12.0, 96

def probe_dur(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip())

def encode():
    dur = probe_dur(MASTER); vbr = int(TARGET_MB * 8e6 / dur / 1000) - ABR - 8
    out = os.path.join(OUT, "intro-tall.mp4"); log = os.path.join(TEASER, "audio", "pass_web_tall")
    vf = "scale=720:1280:flags=lanczos:in_range=tv:out_range=tv:in_color_matrix=bt709:out_color_matrix=bt709,format=yuv420p"
    common = ["-vf", vf, "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-level", "3.1", "-b:v", f"{vbr}k",
              "-maxrate", f"{int(vbr * 2.2)}k", "-bufsize", f"{int(vbr * 4)}k", "-g", "60", "-color_range", "tv",
              "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-passlogfile", log]
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", MASTER] + common + ["-pass", "1", "-an", "-f", "mp4", os.devnull], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", MASTER] + common + ["-pass", "2", "-c:a", "aac", "-b:a", f"{ABR}k", "-ar", "48000",
                    "-movflags", "+faststart+write_colr", out], check=True)
    print("intro-tall.mp4: %.1f MB, video %d kbit/s, %.1f s" % (os.path.getsize(out) / 1e6, vbr, dur))
    poster = os.path.join(OUT, "intro-tall-poster.jpg")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", "16.5", "-i", MASTER, "-frames:v", "1", "-vf", "scale=720:1280:flags=lanczos", "-q:v", "4", poster], check=True)
    print("intro-tall-poster.jpg: %d KB" % (os.path.getsize(poster) // 1024))

if __name__ == "__main__":
    encode()
