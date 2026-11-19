"""Assemble the phone-sized (portrait) cut: frames from capture_tall.py -> clips -> the same xfade chain, the same
narration and music mix as the landscape cut (audio/mix.wav is reused when it is there) -> size-targeted MP4s.
The picture is 1080 x 1920: the app's screen (1080 x 1680) under a 240 px caption band; the title cards and the
"every screen" composite fill the frame.
Usage: python assemble_tall.py [all|--finish|--clips-only|--audio-only]
  --finish keeps clips that already exist and rebuilds the rest.
  A dry run on other frames: TEASER_TAG=smoke TEASER_FRAMES=<dir> python assemble_tall.py
"""
import json, os, sys
import assemble as A
from assemble import run, frames_for, FPS, END, T, TAG, PFX

FR = os.environ.get("TEASER_FRAMES") or os.path.join(T, "frames_tall")
CARDS = os.path.join(T, "cards_tall")
CLIPS = os.path.join(T, "clips_tall" + ("_" + TAG if TAG else "")); os.makedirs(CLIPS, exist_ok=True)
CW, CH, BAND = 1080, 1920, 240
FULL = {"c_open", "c_title", "phone", "c_end"}      # filmed full frame; every other clip is the app's screen under the band

# the landscape cut's timeline (assemble.TL), with the captions timed for the phone shots; a caption sits in the band,
# so it never covers the app and can stay to the end of its shot
TL = [
    ("c_open",  0.0,   4.8,  None,          0.0),
    ("home",    4.8,   14.4, "cap_home",    0.8),
    ("c_title", 14.4,  19.2, None,          0.25),
    ("setup",   19.2,  26.4, "cap_plan",    0.5),
    ("path",    26.4,  36.0, "cap_path",    0.4),
    ("cert",    36.0,  43.2, [("cap_cert", 0.4, 2.9, 0.3, 0.2), ("cap_official", 3.1, 99, 0.3, 0.3)], 0.25),
    ("lessons", 43.2,  52.8, [("cap_lessons", 0.4, 6.0, 0.3, 0.2), ("cap_tryit", 6.2, 99, 0.3, 0.3)], 0.4),
    ("voice",   52.8,  60.0, "cap_voice",   0.4),
    ("quiz",    60.0,  67.2, "cap_quiz",    0.3),
    ("cards",   67.2,  72.0, "cap_cards",   0.4),
    ("arcade",  72.0,  81.6, [("cap_arcade", 0.4, 2.5, 0.3, 0.2), ("cap_range", 2.7, 99, 0.3, 0.3)], 0.3),
    ("buddy",   81.6,  88.8, "cap_buddy",   0.3),
    ("lookup",  88.8,  93.6, "cap_lookup",  0.4),
    ("phone",   93.6,  103.2, None,         0.4),
    ("c_end",   103.2, 114.4, None,         0.3),
]
assert [(e[0], e[1], e[2], e[4]) for e in TL] == [(e[0], e[1], e[2], e[4]) for e in A.TL], "the shots must sit where the landscape cut's do (the sound is shared)"
OUTS = ((PFX + "B2B_Exam_Prep_Teaser_Phone_1080x1920.mp4", 1920, 26.0, 160), (PFX + "B2B_Exam_Prep_Teaser_Phone_720x1280.mp4", 1280, 17.0, 112))
VONLY = PFX + "tall_video_only.mp4"

def build_clip(name, start, end, cap, tin, tout):
    """One clip, padded by half of each neighbouring transition so the grid boundaries hold."""
    pad_in, pad_out = tin / 2, tout / 2
    dur = end - start + pad_in + pad_out
    out = os.path.join(CLIPS, name + ".mp4")
    frames = frames_for(SEGS[name], end - start)
    if abs(sum(d for _, d in frames) - (end - start)) > 0.05: print(f"  NOTE {name}: captured {sum(d for _, d in frames):.2f}s for a {end - start:.2f}s slot", flush=True)
    frames[0][1] += pad_in; frames[-1][1] += pad_out
    lst = os.path.join(CLIPS, name + ".ffconcat")
    with open(lst, "w", encoding="utf-8") as f:
        f.write("ffconcat version 1.0\n")
        for p, d in frames: f.write(f"file '{p.replace(os.sep, '/')}'\nduration {d:.5f}\n")
        f.write(f"file '{frames[-1][0].replace(os.sep, '/')}'\n")
    inputs = ["-f", "concat", "-safe", "0", "-i", lst]
    if name in FULL:
        fc = [f"[0:v]scale={CW}:{CH}:flags=lanczos,fps={FPS},format=yuv420p[b0]"]; nxt = 1
    else:                                                  # the app's screen under the band, its top corners rounded into it
        inputs += ["-loop", "1", "-i", os.path.join(CARDS, "band.png")]
        fc = [f"[0:v]scale={CW}:{CH - BAND}:flags=lanczos,fps={FPS},pad={CW}:{CH}:0:{BAND}:color=0x10281f,format=yuv420p[a0]",
              f"[1:v]scale={CW}:{CH},format=rgba[bd]", "[a0][bd]overlay=0:0:shortest=1,format=yuv420p[b0]"]; nxt = 2
    caps = cap if isinstance(cap, list) else ([(cap, 0.4, dur - 0.2, 0.3, 0.3)] if cap else [])
    cur = "b0"
    for k, c in enumerate(caps):
        cname, t0, t1 = c[:3]; fin = c[3] if len(c) > 3 else 0.3; fout = c[4] if len(c) > 4 else 0.3
        inputs += ["-loop", "1", "-i", os.path.join(CARDS, cname + ".png")]
        t1 = min(t1, dur - 0.2); lab = f"c{k}"
        fc.append(f"[{nxt + k}:v]scale={CW}:{CH},format=rgba,fade=t=in:st={t0:.3f}:d={fin:.3f}:alpha=1,fade=t=out:st={max(t0 + fin, t1 - fout):.3f}:d={fout:.3f}:alpha=1[{lab}f];"
                  f"[{cur}][{lab}f]overlay=0:0:shortest=1,format=yuv420p[{lab}]")
        cur = lab
    if name == "c_open": fc.append(f"[{cur}]fade=t=in:st=0:d=1.0[v]")
    elif name == "c_end": fc.append(f"[{cur}]fade=t=out:st={dur - 1.6:.3f}:d=1.6[v]")
    else: fc.append(f"[{cur}]null[v]")
    run(inputs + ["-filter_complex", ";".join(fc), "-map", "[v]", "-t", f"{dur:.3f}", "-r", str(FPS),
                  "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-pix_fmt", "yuv420p", out])
    print(f"clip {name:10s} {dur:5.2f}s", flush=True); return out

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    A.TL, A.VONLY = TL, VONLY                              # assemble.chain() reads these
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
        video = A.chain(clips)
    else:
        video = os.path.join(A.AUD, VONLY)
    if mode in ("all", "--audio-only", "--finish"):
        mix = os.path.join(A.AUD, "mix.wav")               # the landscape cut's mix: same lines, same starts, same bed
        if os.path.exists(mix): print("audio: the landscape cut's mix.wav", flush=True)
        else: mix = A.audio("mix.wav")
        for name, height, target_mb, abr_k in OUTS:
            out = os.path.join(T, name); size = A.encode(video, mix, out, height, target_mb, abr_k)
            if size > target_mb + 0.6: A.encode(video, mix, out, height, target_mb * 0.92, abr_k)
        print("final:", ", ".join(o[0] for o in OUTS))
