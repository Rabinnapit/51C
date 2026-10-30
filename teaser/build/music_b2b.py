"""The bed for the B2B Exam Prep teaser: "DAY ONE", a hybrid trailer cue laid over the shot timeline.
100 BPM (bar = 2.4 s), A minor rising to C major at the close. Same instrument library as the CSE teaser
(synth_music.py: pure synthesis, no samples), a new piece: a ticking clock under the hook, a plucked motif for the
study pages, taikos for the title, an arcade drive, and a major-key lift for "certified".
Hits on bars 6 (14.4 s title), 15 (36.0 s certification), 30 (72.0 s Arcade accent) and 43 (103.2 s end card).
Usage: python music_b2b.py <out.wav>
"""
import os, sys
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth_music import (SR, sec, midi, rng, adsr, osc_saw, lp, hp, Mix, make_ir, kick, taiko, boom, snare,
                         hat, cymbal, riser, braam, pulse, blip, pluck, noise, T)

BPM = 100; B = 60 / BPM; BAR = 4 * B
HIT1, HIT2, ACC, HIT3 = 6, 15, 30, 43
FINAL_TAIL = 11.2                      # the end card: 103.2 -> 114.4
TOTAL = HIT3 * BAR + FINAL_TAIL

def pad2(chord, dur, att=0.9, rel=1.5, fc=1400, detune=8, voices=3):
    n = sec(dur); L = np.zeros(n); R = np.zeros(n)
    for m in chord:
        f = midi(m); nh = max(3, int(min(40, 2.2 * fc / f)))
        for v in range(voices):
            d = (v - (voices - 1) / 2) * detune
            L += osc_saw(f * 2 ** ((d - 2) / 1200), n, nh=nh, ph=rng.uniform(0, 6.28))
            R += osc_saw(f * 2 ** ((d + 2) / 1200), n, nh=nh, ph=rng.uniform(0, 6.28))
    k = len(chord) * voices; e = adsr(n, att, 0.2, 0.9, rel)
    return np.stack([lp(L / k, fc), lp(R / k, fc)], 1) * e[:, None]

def tick(bright=False):
    """A clock tick: a short filtered click with a little wooden body."""
    n = sec(0.06); tt = T(n)
    body = np.sin(2 * np.pi * (2600 if bright else 1900) * tt) * np.exp(-tt / 0.006)
    click = hp(noise(n), 4000) * np.exp(-tt / 0.003) * 0.7
    return (body + click) * 0.8

def bell(m, dur=1.6):
    """A soft bell for the closing: sine partials with a quick, uneven decay."""
    n = sec(dur); tt = T(n); f = midi(m)
    y = (np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.9) + 0.45 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt / 0.25)
         + 0.25 * np.sin(2 * np.pi * f * 5.4 * tt) * np.exp(-tt / 0.12))
    return y * adsr(n, 0.002, 0.05, 0.9, 0.5) * 0.6

# harmony: Am - F - C - G (i VI III VII), closing on C major
AM, F, C, G = [45, 48, 52, 57], [41, 45, 48, 53], [36, 43, 48, 52], [43, 47, 50, 55]
CYCLE = [AM, F, C, G]; ROOT = {id(AM): 45, id(F): 41, id(C): 36, id(G): 43}
CMAJ = [36, 43, 48, 52, 55]
def chord_at(b): return CMAJ if b >= HIT3 else CYCLE[((b - HIT1) // 2) % 4] if b >= HIT1 else AM
ARP = {id(AM): [69, 72, 76, 81], id(F): [69, 72, 77, 81], id(C): [67, 72, 76, 79], id(G): [67, 71, 74, 79]}

def section(b):
    if b < 2: return "intro"            # the hook card: a clock ticking
    if b < HIT1: return "build"         # home: the pulse enters
    if b < HIT2: return "drive"         # title through the exam path
    if b < 22: return "drive2"          # certification, lessons
    if b < 25: return "voice"           # read aloud: the bed steps back so the app's own voice can be heard
    if b < ACC: return "study"          # practice test, flashcards: the plucked motif leads
    if b < 34: return "arcade"          # Range Day: heavy
    if b < 37: return "buddy"           # the chat: light, ticking hats and blips
    if b < HIT3: return "rebuild"       # look it up, every screen: snare roll into the close
    return "final"

def build():
    m = Mix(TOTAL); ir = make_ir(2.6)
    m.add(boom(), 0.0, 0.5, verb=0.5)
    m.add(pad2([33, 45, 52], HIT3 * BAR + 4.0, att=2.0, rel=4.0, fc=520), 0.0, 0.40, verb=0.35)
    for b in range(HIT3 + 1):
        t0 = b * BAR; s = section(b); ch = chord_at(b); root = ROOT.get(id(ch), 36)
        if s == "final":
            m.add(boom(3.6), t0, 1.0, verb=0.6); m.add(taiko(1.6), t0, 1.0, verb=0.5)
            m.add(braam(CMAJ, 4.0, att=0.05, rel=2.6, fc1=3000, drive=2.2), t0, 0.75, verb=0.5)
            m.add(cymbal(3.0), t0, 0.4, verb=0.5)
            m.add(pad2(CMAJ, FINAL_TAIL - 0.8, att=0.05, rel=4.5, fc=1500), t0, 0.34, verb=0.5)
            for k, nm in enumerate([84, 88, 91, 96]):                     # the bells climb to C: certified
                m.add(bell(nm, 2.2), t0 + 0.9 + k * 0.55, 0.22, pan=(-0.5 + 0.33 * k), verb=0.55)
            m.add(bell(96, 3.5), t0 + 5.2, 0.18, verb=0.6); m.add(bell(88, 3.5), t0 + 5.2, 0.12, pan=0.4, verb=0.6)
            continue
        # ---- clock: the hook ticks on every beat, brighter on the downbeat, and fades out through the build ----
        if s in ("intro", "build"):
            g = 0.55 if s == "intro" else 0.5 - 0.11 * (b - 2)
            for k in range(4): m.add(tick(k == 0), t0 + k * B, g * (1.0 if k % 2 == 0 else 0.75), pan=(0.35 if k % 2 else -0.35), verb=0.25)
        # ---- pads: one per two bars, chord-cycle aligned ----
        if s not in ("intro",) and (b - HIT1) % 2 == 0:
            g = {"build": 0.22, "study": 0.34, "buddy": 0.30, "arcade": 0.30, "voice": 0.26}.get(s, 0.34)
            fc = {"study": 1100, "buddy": 1300, "voice": 900}.get(s, 1500)
            m.add(pad2(ch, 2 * BAR + 0.6, att=0.5, fc=fc), t0, g, verb=0.45)
        # ---- the plucked motif: 8ths through the study pages, 16ths in the chat, sparse elsewhere ----
        arp = ARP.get(id(ch), ARP[id(AM)])
        if s in ("study", "buddy", "drive2", "voice"):
            div = 4 if s == "buddy" else 2; steps = 4 * div
            for k in range(steps):
                if s == "voice" and k % 4: continue                           # one pluck a beat under the spoken sample
                note = arp[k % 4] + (12 if (k // 4) % 2 and s == "buddy" else 0)
                g = (0.30 if s == "study" else 0.22 if s == "drive2" else 0.16 if s == "voice" else 0.20) * (1.0 if k % div == 0 else 0.7)
                m.add(pluck(note, 0.22, fc0=3600, fc1=500), t0 + k * B / div, g, pan=(-0.45 if k % 2 == 0 else 0.45), verb=0.35)
        if s in ("drive", "rebuild") and b % 2 == 1:
            for k in range(4): m.add(pluck(arp[k], 0.2, fc0=3000, fc1=500), t0 + 2 * B + k * B / 2, 0.16, pan=(-0.4 if k % 2 else 0.4), verb=0.35)
        # ---- hats ----
        if s in ("build", "study", "voice"):
            for k in range(8): m.add(hat(), t0 + k * B / 2, (0.14 if k % 2 else 0.2) * (0.6 if s == "voice" else 1.0), pan=0.3)
        elif s == "buddy":
            for k in range(16): m.add(hat(), t0 + k * B / 4, 0.10 if k % 2 else 0.16, pan=0.25 if k % 4 else -0.2)
            for _ in range(3):
                m.add(blip(float(rng.choice([1800, 2400, 3200]))), t0 + int(rng.integers(0, 16)) * B / 4, 0.08, pan=float(rng.uniform(-0.8, 0.8)), verb=0.3)
        elif s in ("drive", "drive2", "arcade", "rebuild"):
            for k in range(4):
                m.add(hat(), t0 + k * B, 0.26, pan=0.3); m.add(hat(), t0 + k * B + B / 2, 0.19, pan=-0.3)
                if k in (1, 3): m.add(hat(open_=True), t0 + k * B + B / 2, 0.11, pan=-0.3)
            if s == "arcade":
                for k in range(16): m.add(hat(), t0 + k * B / 4, 0.09 if k % 2 else 0.0, pan=0.2)
        # ---- pulse bass ----
        if s != "intro":
            g = {"build": 0.18 + 0.05 * (b - 2), "study": 0.30, "buddy": 0.32, "rebuild": 0.38, "arcade": 0.46, "voice": 0.20}.get(s, 0.42)
            fc = {"build": 500 + 200 * b, "study": 700, "buddy": 900, "arcade": 1500, "voice": 500}.get(s, 1200)
            for k in range(8):
                m.add(pulse(root, B / 2 * 0.9, fc=fc), t0 + k * B / 2, g * (1.0 if k % 2 == 0 else 0.75))
            if s == "arcade":
                for k in range(16): m.add(pulse(root + (12 if k % 4 == 2 else 0), B / 4 * 0.8, fc=2200), t0 + k * B / 4, 0.16 if k % 2 else 0.0)
        # ---- drums ----
        if s == "build":
            m.add(taiko(), t0, 0.7, verb=0.4)
            if b >= 4: m.add(kick(), t0, 0.85); m.add(kick(), t0 + 2 * B, 0.8)
            if b == HIT1 - 1: m.add(snare(), t0 + 3.5 * B, 0.45, verb=0.4)
        if s in ("drive", "drive2", "arcade"):
            kg = 0.95 if s == "arcade" else 0.9
            for k in range(4): m.add(kick(), t0 + k * B, kg)
            m.add(snare(), t0 + B, 0.5, verb=0.35); m.add(snare(), t0 + 3 * B, 0.55, verb=0.35)
            if (b - HIT1) % 2 == 0: m.add(taiko(), t0, 0.75, verb=0.4)
            if s == "arcade":
                for k in (3.5, 7.5): m.add(kick(0.35), t0 + k * B / 2, 0.6)
                m.add(snare(0.2), t0 + 3.75 * B, 0.3, verb=0.3)
        if s == "study":
            m.add(kick(), t0, 0.75); m.add(kick(), t0 + 2 * B, 0.7)
            m.add(snare(0.3), t0 + 3 * B, 0.35, verb=0.4); m.add(taiko(), t0, 0.45, verb=0.5)
        if s == "buddy":
            m.add(kick(0.4, 150, 46), t0, 0.7); m.add(kick(0.4, 150, 46), t0 + 2 * B, 0.65); m.add(kick(0.4, 150, 46), t0 + 3.5 * B, 0.5)
        if s == "rebuild":
            for k in range(4): m.add(kick(), t0 + k * B, 0.85)
            m.add(snare(), t0 + B, 0.5, verb=0.35); m.add(snare(), t0 + 3 * B, 0.55, verb=0.35)
            m.add(taiko(), t0, 0.8, verb=0.4)
            if b == HIT3 - 1:
                for k in range(16): m.add(snare(0.18), t0 + k * B / 4, 0.14 + 0.04 * k, verb=0.35)
                for k in range(8): m.add(kick(0.35), t0 + k * B / 2, 0.85)
            elif b == HIT3 - 2:
                for k in range(8): m.add(snare(0.2), t0 + 2 * B + k * B / 4, 0.16 + 0.04 * k, verb=0.35)
        # ---- hits, risers, braams ----
        if b in (HIT1, HIT2):
            m.add(boom(), t0, 0.9, verb=0.6); m.add(cymbal(), t0, 0.3, verb=0.5)
            m.add(braam(ch, 2 * BAR, att=0.05, rel=1.5, fc1=2800, drive=2.2), t0, 0.7, verb=0.45)
            m.add(taiko(1.5), t0, 0.9, verb=0.5)
        if b == ACC:
            m.add(taiko(1.5), t0, 1.0, verb=0.5); m.add(cymbal(2.0), t0, 0.3, verb=0.4); m.add(boom(2.4), t0, 0.7, verb=0.5)
            m.add(braam(ch, BAR, att=0.05, rel=1.0, fc1=2400, drive=2.0), t0, 0.5, verb=0.4)
        if b in (10, 19, 32, 39): m.add(braam(ch, 2 * BAR, att=0.35, rel=1.2, fc1=2400), t0, 0.40, verb=0.4)
        if b == 25: m.add(taiko(), t0, 0.6, verb=0.5)                        # the study pages pick the drive back up
        if b in (HIT2 - 1, ACC - 1): m.add(riser(BAR), t0, 0.6, verb=0.3)
        if b == HIT1 - 1: m.add(riser(BAR * 0.5, 150, 5000), t0 + BAR * 0.5, 0.4, verb=0.3)
        if b == HIT3 - 2: m.add(riser(2 * BAR, 120, 7000), t0, 0.7, verb=0.3)
    return m.render(ir)

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "../audio/music_b2b.wav"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    y = build(); sf.write(out, y.astype(np.float32), SR)
    print(f"ok {out}: {len(y)/SR:.1f}s rms {20*np.log10(np.sqrt(np.mean(y**2))):.1f} dBFS; hits at "
          + ", ".join(f"{b*BAR:.1f}" for b in (HIT1, HIT2, ACC, HIT3)))
