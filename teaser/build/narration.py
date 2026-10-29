"""Narration for the B2B Exam Prep teaser: Edge neural voice Andrew, one MP3 per line, with word-boundary
timing so the read can be checked and placed without ears. Same engine and settings as the CSE teaser.
Usage: python narration.py <outdir> [lines|variants|all]
Writes <outdir>/<id>.mp3 and <outdir>/timing.json {id: {text, dur, words: [[t, dur, text], ...]}}
"""
import asyncio, json, os, sys
import edge_tts

VOICE, RATE, PITCH = "en-US-AndrewMultilingualNeural", "-5%", "-3Hz"
OUT = sys.argv[1] if len(sys.argv) > 1 else "../narration"
MODE = sys.argv[2] if len(sys.argv) > 2 else "lines"
os.makedirs(OUT, exist_ok=True)

# spoken text is tuned for the engine; on-screen text uses the app's own spelling
LINES = [
    ("L01", "Day one. New unit. New job. And the certification clock is already running."),
    ("L02", "Five courses. One exam. Twelve months of experience. And nobody hands you the map."),
    ("L03", "Introducing B-to-B Exam Prep. From day one to certified."),
    ("L04", "Three questions, and it builds your plan: every step dated, from week one to exam day."),
    ("L05", "The exam path: twenty-six dated weeks, monthly checkpoints, and two full simulations before exam week."),
    ("L06", "The rules, explained in pictures, beside the real official documents."),
    ("L07", "Thirty-five plain-English lessons, organized like the exam. Every picture plays. Every dollar rule has a try-it tool."),
    ("L08", "Nearly four hundred questions, each answer explained with a citation. Plus a timed simulator, like the real exam."),
    ("L09", "Fourteen flashcard decks that remember what you forget."),
    ("L10", "Then the Arcade: seven games on the same content. Range Day puts you on the qualification range, in real 3D."),
    ("L11a", "Ask Buddy."),
    ("L11b", "When can I take the exam?"),
    ("L11c", "Answered from the guide, on your device. No signal needed."),
    ("L12", "Two hundred fifty terms, all the FAR parts, every threshold and deadline."),
    ("L13", "On your phone, your laptop, or a nipper desktop. No app store. Free."),
    ("L14", "Built by a contracting N-C-O, for new fifty-one Charlies and eleven-oh-twos. B-to-B Exam Prep. From day one to certified."),
]

VARIANTS = [
    ("V_b2b_1", "Introducing B2B Exam Prep."),
    ("V_b2b_2", "Introducing B-to-B Exam Prep."),
    ("V_b2b_3", "Introducing B two B Exam Prep."),
    ("V_nipr_1", "or a NIPR desktop."),
    ("V_nipr_2", "or a nipper desktop."),
    ("V_51c_1", "for new 51Cs and 1102s."),
    ("V_51c_2", "for new fifty-one Charlies and eleven-oh-twos."),
]

async def synth(id_, text, timing):
    comm = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH, boundary="WordBoundary")
    audio = bytearray(); words = []
    async for ch in comm.stream():
        if ch["type"] == "audio": audio += ch["data"]
        elif ch["type"] == "WordBoundary":
            words.append([round(ch["offset"] / 1e7, 3), round(ch["duration"] / 1e7, 3), ch["text"]])
    open(os.path.join(OUT, id_ + ".mp3"), "wb").write(audio)
    dur = (words[-1][0] + words[-1][1]) if words else 0
    timing[id_] = {"text": text, "dur": round(dur, 3), "words": words}
    print(f"{id_:8s} {dur:5.2f}s  " + " ".join(f"{w[2]}[{w[1]:.2f}]" for w in words), flush=True)

async def main():
    timing = {}
    items = (LINES if MODE in ("all", "lines") else []) + (VARIANTS if MODE in ("all", "variants") else [])
    for id_, text in items:
        for attempt in range(3):
            try:
                await synth(id_, text, timing); break
            except Exception as e:
                print("retry", id_, repr(e)[:120]); await asyncio.sleep(2)
    tp = os.path.join(OUT, "timing.json")
    old = json.load(open(tp)) if os.path.exists(tp) else {}
    old.update(timing); json.dump(old, open(tp, "w"), indent=1)
    tot = sum(v["dur"] for k, v in old.items() if k.startswith("L"))
    print(f"narration total (L* lines): {tot:.1f}s")

asyncio.run(main())
