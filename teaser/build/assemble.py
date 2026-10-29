"""Assemble the B2B Exam Prep teaser: captured frames + caption overlays -> clips -> xfade chain, narration + music bed
with lookahead ducking -> size-targeted MP4s. Same machinery as the CSE teaser; the timeline sits on a 2.4 s bar grid
(100 BPM) so the music's hits land on cuts.
Usage: python assemble.py [all|--finish|--clips-only|--audio-only]
  --finish keeps clips that already exist and rebuilds the rest.
"""
import json, os, subprocess, sys
import numpy as np, soundfile as sf, scipy.signal as sg

HERE = os.path.dirname(os.path.abspath(__file__)); T = os.path.dirname(HERE)
CARDS, NARR, AUD = (os.path.join(T, d) for d in ("cards", "narration", "audio"))
TAG = os.environ.get("TEASER_TAG", "")                          # a dry run on other frames: TEASER_TAG=smoke TEASER_FRAMES=<dir>
FR = os.environ.get("TEASER_FRAMES") or os.path.join(T, "frames")
CLIPS = os.path.join(T, "clips" + ("_" + TAG if TAG else ""))
os.makedirs(CLIPS, exist_ok=True); os.makedirs(AUD, exist_ok=True)
SR = 48000; FPS = 30; BAR = 2.4

# (clip, start, end, caption, transition-in seconds). A caption is a card name (shown from 0.5 s to the end of the clip)
# or a list of (card, from, until[, fade-in, fade-out]) in clip-relative seconds.
TL = [
    ("c_open",  0.0,   4.8,  None,          0.0),
    ("home",    4.8,   14.4, "cap_home",    0.8),
    ("c_title", 14.4,  19.2, None,          0.25),
    ("setup",   19.2,  26.4, "cap_plan",    0.5),
    ("path",    26.4,  36.0, "cap_path",    0.4),
    ("cert",    36.0,  43.2, [("cap_cert", 0.5, 3.3), ("cap_official", 3.7, 99)], 0.25),
    ("lessons", 43.2,  52.8, [("cap_lessons", 0.5, 5.6), ("cap_tryit", 5.9, 99)], 0.4),
    ("quiz",    52.8,  60.0, "cap_quiz",    0.3),
    ("cards",   60.0,  64.8, "cap_cards",   0.4),
    ("arcade",  64.8,  74.4, [("cap_arcade", 0.4, 2.1), ("cap_range", 2.6, 99)], 0.3),
    ("buddy",   74.4,  81.6, "cap_buddy",   0.3),
    ("lookup",  81.6,  86.4, "cap_lookup",  0.4),
    ("phone",   86.4,  93.6, None,          0.4),
    ("c_end",   93.6,  104.8, None,         0.3),
]
END = 104.8
VO = {"L01": 0.4, "L02": 6.4, "L03": 14.8, "L04": 20.2, "L05": 26.8, "L06": 36.4, "L07": 43.6, "L08": 53.1, "L09": 61.3,
      "L10": 65.2, "L11a": 74.8, "L11b": 76.6, "L11c": 78.0, "L12": 82.1, "L13": 87.6, "L14": 94.2}
PFX = (TAG + "_") if TAG else ""
OUTS = ((PFX + "B2B_Exam_Prep_Teaser_1080p.mp4", 1080, 28.0, 160), (PFX + "B2B_Exam_Prep_Teaser_Email_720p.mp4", 720, 19.0, 112))
MUSIC, VONLY = "music_b2b.wav", PFX + "video_only.mp4"

def run(args):
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + args, capture_output=True, text=True)
    if r.returncode: print(r.stderr[-1500:]); raise SystemExit("ffmpeg failed: " + " ".join(args[:6]))

def frames_for(seg, target):
    """The segment's frames trimmed to `target` seconds (a still hold shortens to fit)."""
    out, acc = [], 0.0
    for p, d in seg["frames"]:
        if acc >= target - 1e-6: break
        d2 = min(d, target - acc); out.append([p, d2]); acc += d2
    return out

def build_clip(name, start, end, cap, tin, tout):
    """Render one clip padded by half of each neighbouring transition so grid boundaries hold."""
    pad_in, pad_out = tin / 2, tout / 2
    dur = end - start + pad_in + pad_out
    out = os.path.join(CLIPS, name + ".mp4")
    n_out = round(dur * FPS)
    inputs, fc = [], []
    frames = frames_for(SEGS[name], end - start)
    if abs(sum(d for _, d in frames) - (end - start)) > 0.05: print(f"  NOTE {name}: captured {sum(d for _, d in frames):.2f}s for a {end - start:.2f}s slot", flush=True)
    frames[0][1] += pad_in; frames[-1][1] += pad_out
    if len(frames) == 1:   # still hold -> slow push-in
        inputs += ["-loop", "1", "-t", f"{dur:.3f}", "-i", frames[0][0]]
        fc.append(f"[0:v]zoompan=z='1+0.05*on/{n_out}':d={n_out}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps={FPS},format=yuv420p[b0]")
    else:
        lst = os.path.join(CLIPS, name + ".ffconcat")
        with open(lst, "w", encoding="utf-8") as f:
            f.write("ffconcat version 1.0\n")
            for p, d in frames: f.write(f"file '{p.replace(os.sep, '/')}'\nduration {d:.5f}\n")
            f.write(f"file '{frames[-1][0].replace(os.sep, '/')}'\n")
        inputs += ["-f", "concat", "-safe", "0", "-i", lst]
        fc.append(f"[0:v]scale=1920:1080:flags=lanczos,fps={FPS},format=yuv420p[b0]")
    caps = cap if isinstance(cap, list) else ([(cap, 0.5, dur - 0.3)] if cap else [])
    cur = "b0"
    for k, c in enumerate(caps):
        cname, t0, t1 = c[:3]; fin = c[3] if len(c) > 3 else 0.4; fout = c[4] if len(c) > 4 else 0.4
        inputs += ["-loop", "1", "-i", os.path.join(CARDS, cname + ".png")]
        t1 = min(t1, dur - 0.3); lab = f"c{k}"
        fc.append(f"[{k + 1}:v]scale=1920:1080,format=rgba,fade=t=in:st={t0:.3f}:d={fin:.3f}:alpha=1,fade=t=out:st={max(t0 + fin, t1 - fout):.3f}:d={fout:.3f}:alpha=1[{lab}f];"
                  f"[{cur}][{lab}f]overlay=0:0:shortest=1,format=yuv420p[{lab}]")
        cur = lab
    if name == "c_open": fc.append(f"[{cur}]fade=t=in:st=0:d=1.0[v]")
    elif name == "c_end": fc.append(f"[{cur}]fade=t=out:st={dur - 1.6:.3f}:d=1.6[v]")
    else: fc.append(f"[{cur}]null[v]")
    run(inputs + ["-filter_complex", ";".join(fc), "-map", "[v]", "-t", f"{dur:.3f}", "-r", str(FPS),
                  "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-pix_fmt", "yuv420p", out])
    print(f"clip {name:10s} {dur:5.2f}s", flush=True); return out

def chain(clips):
    """xfade chain; offsets are absolute grid boundaries minus half the transition."""
    inputs = []; fc = []; prev = "0:v"
    for i, e in enumerate(TL):
        name, start, end, cap, tin = e
        inputs += ["-i", clips[i]]
        if i == 0: continue
        td = max(tin, 0.04); off = start - td / 2
        fc.append(f"[{prev}][{i}:v]xfade=transition=fade:duration={td:.3f}:offset={off:.3f}[x{i}]"); prev = f"x{i}"
    fc.append(f"[{prev}]null[v]")
    out = os.path.join(AUD, VONLY)
    run(inputs + ["-filter_complex", ";".join(fc), "-map", "[v]", "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-pix_fmt", "yuv420p", out])
    print("video chain ok", flush=True); return out

def encode(video, mix, out, height, target_mb, abr_k):
    """Two-pass x264 to a file-size target."""
    vbr = int((target_mb * 8388608 / END - abr_k * 1000) * 0.97)
    vf = ["-vf", f"scale=-2:{height}:flags=lanczos"] if height != 1080 else []
    rate = ["-c:v", "libx264", "-b:v", str(vbr), "-maxrate", str(int(vbr * 1.6)), "-bufsize", str(vbr * 3), "-preset", "slow", "-pix_fmt", "yuv420p"]
    log = os.path.join(AUD, "pass_" + os.path.splitext(os.path.basename(out))[0])
    run(["-i", video] + vf + rate + ["-pass", "1", "-passlogfile", log, "-an", "-f", "null", "NUL"])
    run(["-i", video, "-i", mix, "-map", "0:v", "-map", "1:a"] + vf + rate + ["-pass", "2", "-passlogfile", log,
         "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", f"{abr_k}k", "-movflags", "+faststart", "-shortest", out])
    size = os.path.getsize(out) / 1048576
    print(f"{os.path.basename(out)}: {size:.1f} MB (target {target_mb:.1f}, video {vbr/1e6:.2f} Mbps)", flush=True); return size

def env_follow(x, win=0.01, att=0.02, rel=0.35):
    w = int(win * SR); nf = len(x) // w
    r = np.sqrt(np.mean(x[:nf * w].reshape(nf, w) ** 2, axis=1)); a_att, a_rel = np.exp(-win / att), np.exp(-win / rel)
    e = np.zeros(nf); prev = 0.0
    for i in range(nf):
        a = a_att if r[i] > prev else a_rel; prev = a * prev + (1 - a) * r[i]; e[i] = prev
    return np.interp(np.arange(len(x)), np.arange(nf) * w + w / 2, e)

def decode(path):
    tmp = path + ".48k.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), tmp], check=True)
    y, _ = sf.read(tmp); os.remove(tmp); return y

def audio(mix_name="mix.wav"):
    n = int(END * SR); voice = np.zeros(n)
    hpf = sg.butter(2, 80, "high", fs=SR, output="sos")
    for lid, t0 in VO.items():
        v = sg.sosfilt(hpf, decode(os.path.join(NARR, lid + ".mp3")))
        env = env_follow(v, att=0.005, rel=0.12); v = v * np.minimum(1.0, (0.12 / (env + 1e-6)) ** 0.5)
        v = v / (np.max(np.abs(v)) + 1e-9) * 0.7
        i = int(t0 * SR); m = min(len(v), n - i); voice[i:i + m] += v[:m]
    music, sr = sf.read(os.path.join(AUD, MUSIC)); assert sr == SR
    music = music[:n] if len(music) >= n else np.pad(music, ((0, n - len(music)), (0, 0)))
    fo = int(1.8 * SR); music[-fo:] *= np.linspace(1, 0, fo)[:, None]
    duck = env_follow(voice, win=0.01, att=0.01, rel=0.45)
    la = int(0.12 * SR); duck = np.concatenate([duck[la:], np.zeros(la)])
    gain = 10 ** (-7 / 20) * (1 - 0.70 * np.clip(duck / 0.05, 0, 1))
    out = music * gain[:, None]; out[:, 0] += voice; out[:, 1] += voice
    out = np.tanh(out * 1.05) / np.tanh(1.05); out = out / (np.max(np.abs(out)) + 1e-9) * 10 ** (-1 / 20)
    p = os.path.join(AUD, mix_name); sf.write(p, out.astype(np.float32), SR); print("audio mix ok", flush=True); return p

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    SEGS = {s["name"]: s for s in json.load(open(os.path.join(FR, "manifest.json")))["segments"]} if mode != "--audio-only" else {}
    if mode in ("all", "--clips-only", "--finish"):
        clips = []
        for i, e in enumerate(TL):
            name, start, end, cap, tin = e
            tout = TL[i + 1][4] if i + 1 < len(TL) else 0.0
            out = os.path.join(CLIPS, name + ".mp4")
            if mode == "--finish" and os.path.exists(out) and os.path.getsize(out) > 0:
                clips.append(out); print(f"clip {name:10s} (kept)", flush=True); continue
            clips.append(build_clip(name, start, end, cap, max(tin, 0.04) if i else 0.0, max(tout, 0.04) if i + 1 < len(TL) else 0.0))
        video = chain(clips)
    else:
        video = os.path.join(AUD, VONLY)
    if mode in ("all", "--audio-only", "--finish"):
        mix = audio(PFX + "mix.wav")
        for name, height, target_mb, abr_k in OUTS:
            out = os.path.join(T, name); size = encode(video, mix, out, height, target_mb, abr_k)
            if size > target_mb + 0.6: encode(video, mix, out, height, target_mb * 0.92, abr_k)
        print("final:", ", ".join(o[0] for o in OUTS))
