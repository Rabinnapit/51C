"""CSE teaser - procedural music beds. Pure synthesis: no samples, no downloads.
Usage: python synth_music.py [A|B|C|all] [outdir]
"""
import sys, os, math
import numpy as np
import scipy.signal as sg
import soundfile as sf

SR = 48000
rng = np.random.default_rng(411)

def sec(x): return int(round(x * SR))
def T(n): return np.arange(n) / SR
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def clampf(f): return float(min(max(f, 20.0), SR / 2 - 200))

# ---------------- envelopes ----------------
def adsr(n, a=0.01, d=0.1, s=0.7, r=0.2):
    la, ld, lr = sec(a), sec(d), sec(r)
    tot = la + ld + lr
    if tot > n and tot > 0:
        k = n / tot; la, ld = int(la * k), int(ld * k); lr = max(0, n - la - ld)
    ls = max(0, n - la - ld - lr)
    parts = [np.linspace(0, 1, la, endpoint=False), np.linspace(1, s, ld, endpoint=False),
             np.full(ls, s), np.linspace(s, 0, lr)]
    e = np.concatenate(parts)
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))

# ---------------- oscillators ----------------
def osc_sine(f, n, ph=0.0): return np.sin(2 * np.pi * f * T(n) + ph)
def osc_saw(f, n, nh=None, ph=0.0):
    tt = T(n); out = np.zeros(n)
    nh = nh or max(1, int(min(40, 18000 / f)))
    for k in range(1, nh + 1):
        out += ((-1) ** (k + 1)) * np.sin(2 * np.pi * f * k * tt + ph * k) / k
    return out * (2 / np.pi)
def osc_square(f, n, nh=None, ph=0.0):
    tt = T(n); out = np.zeros(n)
    nh = nh or max(1, int(min(30, 18000 / f)))
    for k in range(1, nh + 1, 2):
        out += np.sin(2 * np.pi * f * k * tt + ph * k) / k
    return out * (4 / np.pi)
def noise(n): return rng.standard_normal(n)

# ---------------- filters ----------------
def lp(x, fc, order=2):
    return sg.sosfilt(sg.butter(order, clampf(fc), "low", fs=SR, output="sos"), x)
def hp(x, fc, order=2):
    return sg.sosfilt(sg.butter(order, clampf(fc), "high", fs=SR, output="sos"), x)
def bp(x, lo, hi, order=2):
    return sg.sosfilt(sg.butter(order, [clampf(lo), clampf(hi)], "band", fs=SR, output="sos"), x)

def _sweep(x, fcs, kind, block=512):
    n = len(x); out = np.empty(n); zi = None
    for i, fc in enumerate(fcs):
        seg = x[i * block:(i + 1) * block]
        if len(seg) == 0: break
        if kind == "low":
            sos = sg.butter(2, clampf(fc), "low", fs=SR, output="sos")
        else:
            sos = sg.butter(2, [clampf(fc / 1.6), clampf(fc * 1.6)], "band", fs=SR, output="sos")
        if zi is None: zi = sg.sosfilt_zi(sos) * seg[0]
        y, zi = sg.sosfilt(sos, seg, zi=zi)
        out[i * block:i * block + len(seg)] = y
    return out
def lp_sweep(x, f0, f1, block=512):
    nb = math.ceil(len(x) / block); return _sweep(x, np.geomspace(f0, f1, nb), "low", block)
def bp_sweep(x, f0, f1, block=512):
    nb = math.ceil(len(x) / block); return _sweep(x, np.geomspace(f0, f1, nb), "band", block)

# ---------------- space ----------------
def make_ir(rt=2.2, predelay=0.012, tone=3800):
    n = sec(rt + predelay); ir = rng.standard_normal((n, 2)) * np.exp(-T(n) * (6.91 / rt))[:, None]
    ir[:sec(predelay)] = 0
    ir[:, 0] = lp(ir[:, 0], tone); ir[:, 1] = lp(ir[:, 1], tone)
    return ir / np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True)) * 0.35
def reverb(x2, ir):
    return np.stack([sg.fftconvolve(x2[:, 0], ir[:, 0])[:len(x2)],
                     sg.fftconvolve(x2[:, 1], ir[:, 1])[:len(x2)]], 1)
def st(x, pan=0.0):
    th = (pan + 1) * np.pi / 4; return np.stack([x * np.cos(th), x * np.sin(th)], 1)

class Mix:
    def __init__(self, dur):
        self.dry = np.zeros((sec(dur), 2)); self.send = np.zeros_like(self.dry)
    def add(self, sig, at, gain=1.0, pan=0.0, verb=0.0):
        if sig.ndim == 1: sig = st(sig, pan)
        i = sec(at); n = min(len(sig), len(self.dry) - i)
        if n <= 0 or i < 0: return
        self.dry[i:i + n] += sig[:n] * gain
        if verb > 0: self.send[i:i + n] += sig[:n] * gain * verb
    def render(self, ir, peak_db=-1.0):
        x = self.dry + reverb(self.send, ir)
        x = np.tanh(x * 1.15) / np.tanh(1.15)
        x = hp(x, 28)
        return x / (np.max(np.abs(x)) + 1e-9) * 10 ** (peak_db / 20)

# ---------------- instruments ----------------
def kick(dur=0.5, f0=170, f1=48):
    n = sec(dur); tt = T(n); f = f1 + (f0 - f1) * np.exp(-tt / 0.045)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.13)
    click = hp(noise(n), 2500) * np.exp(-tt / 0.004) * 0.6
    return np.tanh((body * 1.6 + click) * 1.4)
def taiko(dur=1.3):
    n = sec(dur); tt = T(n); f = 52 + 95 * np.exp(-tt / 0.06)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.34)
    skin = lp(noise(n), 1800) * np.exp(-tt / 0.05) * 0.9
    return np.tanh((body * 1.5 + skin) * 1.2)
def boom(dur=3.2):
    n = sec(dur); tt = T(n); f = 38 + 62 * np.exp(-tt / 0.12)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.95)
    crack = lp_sweep(noise(n), 6000, 120) * np.exp(-tt / 0.25) * 0.7
    return np.tanh((sub * 1.8 + crack) * 1.1)
def snare(dur=0.35):
    n = sec(dur); tt = T(n)
    body = np.sin(2 * np.pi * 185 * tt) * np.exp(-tt / 0.04)
    nz = bp(noise(n), 1200, 7000) * np.exp(-tt / 0.09)
    return np.tanh(body * 0.8 + nz * 1.3)
def hat(open_=False):
    n = sec(0.3 if open_ else 0.07); tt = T(n)
    return hp(noise(n), 7500) * np.exp(-tt / (0.09 if open_ else 0.018)) * 0.8
def cymbal(dur=2.5):
    n = sec(dur); tt = T(n)
    return hp(noise(n), 5000) * np.exp(-tt / 0.7) * 0.6
def riser(dur=2.0, f_lo=150, f_hi=6000):
    n = sec(dur); tt = T(n)
    nz = bp_sweep(noise(n), f_lo, f_hi); amp = (tt / dur) ** 1.6
    f = 73.4 * 2 ** (tt / dur); ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) * 0.35 + np.sin(2 * ph) * 0.15
    return (nz * 0.9 + tone) * amp
def braam(chord, dur=3.0, att=0.25, rel=1.2, fc0=180, fc1=2600, drive=2.0):
    n = sec(dur); out = np.zeros(n)
    for m in chord:
        for det in (-9, -3, 3, 9):
            out += osc_saw(midi(m) * 2 ** (det / 1200), n, ph=rng.uniform(0, 6.28))
    out = lp_sweep(out / (len(chord) * 4), fc0, fc1)
    return np.tanh(out * drive) * adsr(n, att, 0.3, 0.85, rel)
def pad(chord, dur, att=0.9, rel=1.5, fc=1400, detune=8, voices=3):
    n = sec(dur); L = np.zeros(n); R = np.zeros(n)
    for m in chord:
        for v in range(voices):
            d = (v - (voices - 1) / 2) * detune
            L += osc_saw(midi(m) * 2 ** ((d - 2) / 1200), n, ph=rng.uniform(0, 6.28))
            R += osc_saw(midi(m) * 2 ** ((d + 2) / 1200), n, ph=rng.uniform(0, 6.28))
    k = len(chord) * voices; e = adsr(n, att, 0.2, 0.9, rel)
    return np.stack([lp(L / k, fc), lp(R / k, fc)], 1) * e[:, None]
def pluck(m, dur=0.2, fc0=4000, fc1=300):
    n = sec(dur); x = osc_saw(midi(m), n) * 0.5 + osc_square(midi(m), n) * 0.2
    return lp_sweep(x, fc0, fc1) * adsr(n, 0.003, dur * 0.5, 0.2, dur * 0.3)
def pulse(m, dur, fc=700):
    n = sec(dur); x = osc_saw(midi(m), n) * 0.6 + osc_sine(midi(m - 12), n) * 0.5
    return lp(x, fc) * adsr(n, 0.005, 0.05, 0.8, 0.04)
def stab(chord, dur=0.22, fc=2200):
    n = sec(dur); out = np.zeros(n)
    for m in chord:
        for det in (-6, 0, 6): out += osc_saw(midi(m) * 2 ** (det / 1200), n, ph=rng.uniform(0, 6.28))
    return lp(out / (3 * len(chord)), fc) * adsr(n, 0.01, 0.08, 0.5, 0.08)
def blip(f=2200, dur=0.03):
    n = sec(dur); return osc_sine(f, n) * adsr(n, 0.002, 0.01, 0.4, 0.015)
def duck_env(n, hits, depth=0.75, rel=0.16):
    e = np.ones(n); tt = T(n)
    for h in hits:
        i = sec(h)
        if 0 <= i < n: e[i:] = np.minimum(e[i:], 1 - depth * np.exp(-tt[:n - i] / rel))
    return e

# ---------------- pieces ----------------
def piece_A():
    """SOVEREIGN - cinematic hybrid trailer. 100 BPM, D minor."""
    bpm = 100; b = 60 / bpm; bar = 4 * b; dur = 8 * bar + 3.3
    m = Mix(dur); ir = make_ir(2.6)
    m.add(boom(), 0.0, 0.7, verb=0.5)
    m.add(pad([26, 38, 45], dur, att=2.0, fc=520), 0.0, 0.5, verb=0.35)
    chords = {0: [38, 41, 45, 50], 2: [34, 38, 41, 46], 4: [31, 38, 43, 46], 6: [33, 37, 40, 45]}
    roots = {0: 38, 2: 34, 4: 31, 6: 33}
    for bi in range(8):
        t0 = bi * bar
        if bi in chords and bi >= 2:
            m.add(pad(chords[bi], 2 * bar + 0.5, att=0.6, fc=1500), t0, 0.28 + 0.05 * bi, verb=0.45)
        for k in range(4):                                 # beat ticks
            m.add(hat(), t0 + k * b, 0.16 if bi < 4 else 0.28, pan=0.3)
            if bi >= 4:
                m.add(hat(), t0 + k * b + b / 2, 0.2, pan=-0.3)
                if k in (1, 3): m.add(hat(open_=True), t0 + k * b + b / 2, 0.12, pan=-0.3)
        if bi >= 1:                                        # pulse bass 8ths
            root = roots[max(r for r in roots if r <= bi)]
            g = 0.22 + 0.04 * min(bi, 5)
            for k in range(8):
                m.add(pulse(root, b / 2 * 0.9, fc=500 + 220 * bi), t0 + k * b / 2, g * (1.0 if k % 2 == 0 else 0.75))
        if bi in (1, 2, 3):
            m.add(taiko(), t0, 0.8, verb=0.4)
            if bi == 3: m.add(taiko(), t0 + 2 * b, 0.7, verb=0.4)
        if bi >= 2:
            m.add(kick(), t0, 0.9); m.add(kick(), t0 + 2 * b, 0.85)
        if bi >= 4:
            m.add(kick(), t0 + b, 0.9); m.add(kick(), t0 + 3 * b, 0.9)
            m.add(snare(), t0 + b, 0.55, verb=0.35); m.add(snare(), t0 + 3 * b, 0.6, verb=0.35)
            m.add(taiko(), t0, 0.9, verb=0.4)
        if bi == 3: m.add(snare(), t0 + 3.5 * b, 0.45, verb=0.4)
        if bi == 4: m.add(braam([31, 43, 50], 2 * bar, att=0.3, fc1=2400), t0, 0.55, verb=0.4)
        if bi == 6: m.add(braam([33, 45, 52], 2 * bar, att=0.3, fc1=3000), t0, 0.6, verb=0.4)
    m.add(riser(2 * b), 2 * bar - 2 * b, 0.45, verb=0.3)
    m.add(riser(bar), 8 * bar - bar, 0.7, verb=0.3)
    t_hit = 8 * bar
    m.add(boom(), t_hit, 1.0, verb=0.6)
    m.add(braam([26, 38, 45, 50], 3.2, att=0.05, rel=1.8, fc1=3200, drive=2.4), t_hit, 0.8, verb=0.5)
    m.add(cymbal(), t_hit, 0.35, verb=0.5)
    return m.render(ir)

def piece_B():
    """VECTOR - tech briefing pulse. 124 BPM, D minor."""
    bpm = 124; b = 60 / bpm; bar = 4 * b; s16 = b / 4; dur = 10 * bar + 2.5
    m = Mix(dur); ir = make_ir(1.6, tone=5000)
    arp = [62, 65, 69, 72, 74, 72, 69, 65]
    kicks = [bi * bar + k * b for bi in range(2, 9) for k in range(4)]
    n = sec(dur); duck = duck_env(n, kicks, depth=0.7, rel=0.14)
    arpbuf = Mix(dur)
    for bi in range(9):
        for k in range(16):
            t0 = bi * bar + k * s16; fc1 = 900 + 2600 * min(1, bi / 4)
            arpbuf.add(pluck(arp[k % 8] + (12 if bi >= 6 and k % 4 == 0 else 0), 0.18, fc0=fc1 * 1.8, fc1=fc1 * 0.25),
                       t0, 0.36, pan=(-0.5 if k % 2 == 0 else 0.5))
    m.dry += arpbuf.dry * duck[:, None]; m.send += arpbuf.dry * 0.25 * duck[:, None]
    chords = {0: [50, 53, 57, 60, 64], 4: [46, 50, 53, 57, 60], 6: [48, 52, 55, 60], 8: [50, 53, 57, 60, 64]}
    padbuf = Mix(dur)
    for bi, ch in chords.items():
        ln = (4 if bi == 0 else 2) * bar + 1.0
        padbuf.add(pad(ch, ln, att=1.2 if bi == 0 else 0.4, fc=1300, detune=10), bi * bar, 0.26, verb=0.5)
    m.dry += padbuf.dry * (0.35 + 0.65 * duck)[:, None]; m.send += padbuf.send * duck[:, None]
    subroot = {0: 38, 4: 34, 6: 36, 8: 38}
    for bi in range(9):
        t0 = bi * bar; root = subroot[max(r for r in subroot if r <= bi)]
        for k in range(8):
            m.add(pulse(root - 12 if k % 2 == 0 else root, b / 2 * 0.85, fc=260), t0 + k * b / 2, 0.42 if bi >= 2 else 0.22)
        for k in range(16):
            m.add(hat(), t0 + k * s16, (0.10 if k % 2 else 0.17) * (0.6 if bi < 2 else 1.0), pan=0.25)
        if bi >= 2:
            for k in range(4):
                m.add(kick(0.4, 150, 46), t0 + k * b, 0.95)
                if k in (1, 3): m.add(hat(open_=True), t0 + k * b + b / 2, 0.16, pan=-0.3)
        if bi >= 4:
            m.add(snare(0.25), t0 + b, 0.5, verb=0.3); m.add(snare(0.25), t0 + 3 * b, 0.55, verb=0.3)
        for _ in range(3):
            m.add(blip(float(rng.choice([1800, 2400, 3200]))), t0 + int(rng.integers(0, 16)) * s16, 0.11,
                  pan=float(rng.uniform(-0.8, 0.8)), verb=0.3)
    m.add(riser(bar, 200, 7000), 8 * bar - bar, 0.6, verb=0.3)
    m.add(boom(2.8), 8 * bar, 0.9, verb=0.5)
    m.add(braam([38, 45, 50, 53], 2.6, att=0.04, rel=1.6, fc0=300, fc1=3600, drive=1.8), 8 * bar, 0.5, verb=0.45)
    m.add(cymbal(2.0), 8 * bar, 0.28, verb=0.4)
    return m.render(ir)

def piece_C():
    """IRON TIDE - orchestral percussion. 92 BPM, D minor."""
    bpm = 92; b = 60 / bpm; bar = 4 * b; dur = 8 * bar + 3.5
    m = Mix(dur); ir = make_ir(3.0, tone=3200)
    m.add(boom(), 0.0, 0.55, verb=0.6)
    m.add(pad([26, 38], dur, att=2.5, fc=380), 0.0, 0.45, verb=0.3)
    pattern = [(0, 1.0), (1.5, 0.6), (2.5, 0.85), (3.0, 1.0), (3.75, 0.5)]
    chords = {0: [38, 41, 45], 2: [34, 38, 41], 4: [31, 38, 43], 6: [33, 37, 40]}
    swells = {2: [34, 41, 46], 4: [31, 43, 46], 6: [33, 45, 49]}
    for bi in range(8):
        t0 = bi * bar
        g = 0.55 + 0.06 * bi
        for beat, acc in pattern:
            m.add(taiko(), t0 + beat * b, g * acc, pan=-0.25, verb=0.45)
            m.add(taiko(1.1), t0 + beat * b + 0.009, g * acc * 0.8, pan=0.25, verb=0.45)
            if bi >= 3: m.add(kick(0.45, 140, 44), t0 + beat * b, 0.5 * acc)
        if bi >= 1:
            ch = chords[max(r for r in chords if r <= bi)]
            for k in range(8):
                hit = [ch[0] - 12] if k % 2 else ch
                m.add(stab(hit, b / 2 * 0.8, fc=1800 + 120 * bi), t0 + k * b / 2, (0.5 if k % 4 == 0 else 0.34), verb=0.3)
        if bi in swells:
            m.add(braam(swells[bi], 2 * bar - 0.2, att=0.9, rel=1.0, fc0=220, fc1=1900, drive=1.5), t0, 0.5, verb=0.5)
        if bi >= 4:
            m.add(pad([74, 81], 2 * bar, att=0.8, fc=4000, detune=6), t0, 0.11, verb=0.6)
        if bi in (3, 7):
            for k in range(8):
                m.add(snare(0.2), t0 + 2 * b + k * b / 4, 0.18 + 0.06 * k, verb=0.35)
    m.add(riser(bar, 120, 5000), 8 * bar - bar, 0.55, verb=0.35)
    t_hit = 8 * bar
    m.add(boom(3.4), t_hit, 1.0, verb=0.6)
    m.add(taiko(1.6), t_hit, 1.0, verb=0.5)
    m.add(braam([26, 38, 45, 50], 3.4, att=0.05, rel=2.0, fc1=2600, drive=2.2), t_hit, 0.75, verb=0.5)
    m.add(cymbal(3.0), t_hit, 0.4, verb=0.5)
    return m.render(ir)

PIECES = {"A": ("music_A_sovereign", piece_A), "B": ("music_B_vector", piece_B), "C": ("music_C_iron_tide", piece_C)}

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    out = sys.argv[2] if len(sys.argv) > 2 else "../samples"
    os.makedirs(out, exist_ok=True)
    for key, (name, fn) in PIECES.items():
        if which not in ("all", key): continue
        y = fn(); p = os.path.join(out, name + ".wav")
        sf.write(p, y.astype(np.float32), SR)
        print(f"ok {name}: {len(y)/SR:.1f}s peak {20*np.log10(np.max(np.abs(y))):.1f} dBFS rms {20*np.log10(np.sqrt(np.mean(y**2))):.1f} dBFS")
