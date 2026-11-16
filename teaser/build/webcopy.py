"""The copy of the teaser that the app plays (core/13-intro.js): a 720p streaming encode, a poster and a captions file,
written into src/web/root/ (tools/build.py copies them next to the page on the website; the offline file never has them).
Usage, from teaser/build after assemble.py:  python webcopy.py [master.mp4]
  intro.mp4         1280x720 H.264 High, AAC, about 14 MB, BT.709 limited range, moov first (starts while it streams)
  intro-poster.jpg  the title card at 16.5 s
  intro.vtt         one cue per sentence of the narration, timed from narration/timing.json and assemble.py's VO starts,
                    in the app's own spelling (B2B, 51C, 1102, numerals), plus the app voice sample
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__)); TEASER = os.path.dirname(HERE); REPO = os.path.dirname(TEASER)
OUT = os.path.join(REPO, "src", "web", "root"); os.makedirs(OUT, exist_ok=True)
MASTER = sys.argv[1] if len(sys.argv) > 1 else os.path.join(TEASER, "B2B_Exam_Prep_Teaser_1080p.mp4")
TARGET_MB, ABR = 14.0, 96

# ---- the captions: written sentences, one list per narration line, in the same order as the spoken sentences ----
WRITTEN = {
    "L01": ["Day one. New unit. New job.", "And the certification clock is already running."],
    "L02": ["Five courses. One exam. Twelve months of experience.", "And nobody hands you the map."],
    "L03": ["Introducing B2B Exam Prep.", "From day one to certified."],
    "L04": ["Four quick steps, and it builds your plan:", "every step dated, from week one to exam day."],
    "L05": ["The exam path: 26 dated weeks, monthly checkpoints,", "and two full simulations before exam week."],
    "L06": ["The rules, explained in pictures,", "beside the real official documents."],
    "L07": ["35 plain-English lessons, organized like the exam.", "Every picture plays.", "Every dollar rule has a try-it tool."],
    "LV": ["It reads aloud too, in four voices that work offline."],
    "L08": ["Nearly 400 questions, each answer explained with a citation.", "Plus a timed simulator, like the real exam."],
    "L09": ["14 flashcard decks that remember what you forget."],
    "L10": ["Then the Arcade: seven games on the same content,", "five of them in real 3D.", "Range Day puts you on the qualification range."],
    "L11a": ["Ask Buddy."], "L11b": ["“When can I take the exam?”"], "L11c": ["Answered from the guide, on your device.", "No signal needed."],
    "L12": ["254 terms, all the FAR parts,", "every threshold and deadline."],
    "L13": ["On your phone, your laptop, or your tablet.", "Updated as regulations and policies change.", "No app store. Free."],
    "L14": ["Built by a 51C, for 51Cs and 1102s.", "B2B Exam Prep.", "From day one to certified."],
}
# where each written piece ends in the spoken words (the count of spoken words it covers)
def spoken_words(text): return [w for w in re.split(r"\s+", text.strip()) if w]

def vo_starts():
    src = open(os.path.join(HERE, "assemble.py"), encoding="utf-8").read()
    m = re.search(r"VO = (\{.*?\})", src, re.S)
    return json.loads(m.group(1).replace("'", '"'))

def samples():
    src = open(os.path.join(HERE, "assemble.py"), encoding="utf-8").read()
    m = re.search(r'SAMPLES = \{"voice_joe\.wav": \(([\d.]+),', src)
    return float(m.group(1)) if m else None

def ts(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"

def captions():
    timing = json.load(open(os.path.join(TEASER, "narration", "timing.json"), encoding="utf-8"))
    vo = vo_starts(); cues = []
    for lid, pieces in WRITTEN.items():
        t = timing[lid]; words = t["words"]; base = vo[lid]
        # split the spoken words into as many runs as there are written pieces, at the spoken sentence and clause marks
        spoken = spoken_words(t["text"])
        marks = [i + 1 for i, w in enumerate(spoken) if re.search(r"[.?!:,]$", w)]
        # choose cut points: for each written piece but the last, the mark whose share of words is closest to the piece's share
        n_written = [len(spoken_words(p)) for p in pieces]; total_w = sum(n_written); cuts = []; acc = 0
        for k in n_written[:-1]:
            acc += k; want = acc / total_w * len(spoken)
            cand = [m for m in marks if m not in cuts and (not cuts or m > cuts[-1])]
            cuts.append(min(cand, key=lambda m: abs(m - want)))
        bounds = [0] + cuts + [len(spoken)]
        # word boundary events may number differently from the split words (hyphens, numerals): map by proportion
        nb = len(words)
        for i, piece in enumerate(pieces):
            a = round(bounds[i] / len(spoken) * nb); b = round(bounds[i + 1] / len(spoken) * nb)
            a = min(a, nb - 1); b = max(a + 1, min(b, nb))
            start = base + words[a][0]; end = base + words[b - 1][0] + words[b - 1][1] + 0.25
            cues.append([start, end, piece])
    j = samples()
    if j: cues.append([j, j + 2.6, "(the app voice) “Hi, this is how B2B Exam Prep sounds.”"])
    cues.sort(key=lambda c: c[0])
    for i in range(len(cues) - 1):   # no overlaps: a cue ends where the next one starts
        if cues[i][1] > cues[i + 1][0] - 0.02: cues[i][1] = cues[i + 1][0] - 0.02
    out = ["WEBVTT", "", "NOTE B2B Exam Prep intro (teaser v1.2): the narration, sentence by sentence", ""]
    for i, (a, b, text) in enumerate(cues, 1):
        out += [str(i), f"{ts(a)} --> {ts(b)}", text, ""]
    open(os.path.join(OUT, "intro.vtt"), "w", encoding="utf-8", newline="\n").write("\n".join(out))
    print("captions:", len(cues), "cues")

def probe_dur(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip())

def encode():
    dur = probe_dur(MASTER); vbr = int(TARGET_MB * 8e6 / dur / 1000) - ABR - 8
    out = os.path.join(OUT, "intro.mp4"); log = os.path.join(TEASER, "audio", "pass_web")
    vf = "scale=1280:720:flags=lanczos:in_range=tv:out_range=tv:in_color_matrix=bt709:out_color_matrix=bt709,format=yuv420p"
    common = ["-vf", vf, "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-level", "3.1", "-b:v", f"{vbr}k",
              "-maxrate", f"{int(vbr * 2.2)}k", "-bufsize", f"{int(vbr * 4)}k", "-g", "60", "-color_range", "tv",
              "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-passlogfile", log]
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", MASTER] + common + ["-pass", "1", "-an", "-f", "mp4", os.devnull], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", MASTER] + common + ["-pass", "2", "-c:a", "aac", "-b:a", f"{ABR}k", "-ar", "48000",
                    "-movflags", "+faststart+write_colr", out], check=True)
    print("intro.mp4: %.1f MB, video %d kbit/s, %.1f s" % (os.path.getsize(out) / 1e6, vbr, dur))
    poster = os.path.join(OUT, "intro-poster.jpg")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", "16.5", "-i", MASTER, "-frames:v", "1", "-vf", "scale=1280:720:flags=lanczos", "-q:v", "4", poster], check=True)
    print("intro-poster.jpg: %d KB" % (os.path.getsize(poster) // 1024))

if __name__ == "__main__":
    captions()
    encode()
