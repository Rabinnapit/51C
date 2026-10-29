"""Title cards and caption overlays for the B2B Exam Prep teaser, drawn in the app's own palette (pine and brass on
a dark field) and its own embedded fonts (Archivo, Manrope, JetBrains Mono from src/css/00-fonts.css), at 3840x2160
(1920x1080 @2x). Usage: python cards.py <outdir>
"""
import base64, os, sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
OUT = sys.argv[1] if len(sys.argv) > 1 else "../cards"
os.makedirs(OUT, exist_ok=True)

FONTS = open(os.path.join(REPO, "src", "css", "00-fonts.css"), encoding="utf-8").read()
ICON = "data:image/png;base64," + base64.b64encode(open(os.path.join(REPO, "src", "web", "icons", "icon-512.png"), "rb").read()).decode()
QR = open(os.path.join(REPO, "handout", "b2b-exam-prep-qr.svg"), encoding="utf-8").read()

CSS = """
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;background:transparent}
body{color:#eef3ee;font-family:"Manrope","Segoe UI Variable Text","Segoe UI",sans-serif}
.card{position:relative;width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at 50% 40%,#1b4a39 0%,#10281f 46%,#070d0a 100%)}
.card:after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 320px 90px rgba(0,0,0,.72);pointer-events:none}
.grid{position:absolute;inset:0;opacity:.07;background-image:linear-gradient(#e2b65c 1px,transparent 1px),linear-gradient(90deg,#e2b65c 1px,transparent 1px);background-size:96px 96px}
.eyebrow{font-family:"JetBrains Mono","Cascadia Mono","Consolas",monospace;letter-spacing:.42em;font-size:24px;color:#e2b65c;text-transform:uppercase;text-align:center}
.title{font-family:"Archivo","Segoe UI Variable Display","Segoe UI",sans-serif;font-weight:800;letter-spacing:.04em;font-size:112px;text-transform:uppercase;margin-top:26px;text-align:center;line-height:1.02;color:#f5f8f4}
.title.sm{font-size:82px}
.huge{font-family:"Archivo","Segoe UI",sans-serif;font-weight:800;font-size:250px;letter-spacing:-.01em;color:#e2b65c;line-height:.95;margin-top:28px;text-shadow:0 0 70px rgba(226,182,92,.25)}
.huge small{font-size:120px;letter-spacing:.02em;color:#f5f8f4;vertical-align:baseline}
.tag{font-size:42px;color:#d4ddd6;margin-top:30px;letter-spacing:.01em;font-weight:400;text-align:center}
.tag b{color:#f5f8f4;font-weight:700}
.rule{width:560px;height:2px;background:linear-gradient(90deg,transparent,#e2b65c,transparent);margin-top:34px}
.foot{position:absolute;bottom:62px;left:0;right:0;text-align:center;font-family:"JetBrains Mono","Consolas",monospace;font-size:21px;letter-spacing:.32em;color:#8ea397;text-transform:uppercase}
.icon{width:184px;height:184px;border-radius:40px;box-shadow:0 24px 70px -20px rgba(0,0,0,.8),0 0 0 1px rgba(226,182,92,.25)}
.brand{display:flex;align-items:center;gap:44px}
.brand .title{margin-top:0;text-align:left}
.qrbox{display:flex;align-items:center;gap:40px;margin-top:46px}
.qr{width:200px;height:200px;background:#fff;border-radius:16px;padding:14px;box-shadow:0 18px 50px -16px rgba(0,0,0,.8)}
.qr svg{width:100%;height:100%;display:block}
.url{font-family:"JetBrains Mono","Consolas",monospace;font-size:40px;color:#f5f8f4;letter-spacing:.02em}
.url small{display:block;font-size:22px;color:#9fb3a7;letter-spacing:.2em;text-transform:uppercase;margin-top:10px;font-family:"JetBrains Mono","Consolas",monospace}
.cap{position:absolute;left:64px;bottom:118px;display:flex;align-items:stretch;background:rgba(7,14,10,.80);border:1px solid rgba(226,182,92,.38);border-radius:10px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.45)}
.cap .bar{width:8px;background:#e2b65c}
.cap .txt{padding:16px 30px 18px 24px}
.cap .e{font-family:"JetBrains Mono","Consolas",monospace;font-size:17px;letter-spacing:.34em;color:#e2b65c;text-transform:uppercase}
.cap .l{font-family:"Archivo","Segoe UI",sans-serif;font-weight:700;font-size:40px;letter-spacing:.01em;color:#f5f8f4;margin-top:6px;line-height:1.08}
"""
def card(body): return f"<!doctype html><html><head><meta charset='utf-8'><style>{FONTS}\n{CSS}</style></head><body>{body}</body></html>"

CARDS = {
    # the hook: the clock the newcomer is already on
    "card_open": card("""<div class="card"><div class="grid"></div>
        <div class="eyebrow">DoW Contracting Professional certification</div>
        <div class="huge">36 <small>MONTHS.</small></div>
        <div class="rule"></div>
        <div class="tag">Most brigades want it in <b>six</b>.</div>
        <div class="foot">For new 51C Soldiers and 1102 civilians</div></div>"""),
    "card_title": card(f"""<div class="card"><div class="grid"></div>
        <div class="eyebrow">Free &nbsp;·&nbsp; works offline &nbsp;·&nbsp; built by a 51C</div>
        <div class="brand" style="margin-top:34px"><img class="icon" src="{ICON}" alt=""><div class="title">B2B<br>Exam Prep</div></div>
        <div class="rule"></div>
        <div class="tag">From day one to <b>certified</b>.</div>
        <div class="foot">Plan · lessons · practice · flashcards · arcade · buddy</div></div>"""),
    "card_end": card(f"""<div class="card"><div class="grid"></div>
        <div class="brand" style="margin-top:-40px"><img class="icon" src="{ICON}" alt="" style="width:150px;height:150px;border-radius:34px"><div class="title sm">B2B Exam Prep</div></div>
        <div class="tag" style="margin-top:22px">From day one to <b>certified</b>.</div>
        <div class="qrbox"><div class="qr">{QR}</div><div class="url">rabinnapit.github.io/51C<small>Scan with the phone's camera · free · no app store</small></div></div>
        <div class="foot">Owned and built by SFC Rabin Napit &nbsp;·&nbsp; unofficial training aid, not endorsed by the Army, DoW or WarU</div></div>"""),
}
CAPS = {
    "cap_home":     ("Home", "Zero to certified"),
    "cap_plan":     ("My plan", "Three questions → every step dated"),
    "cap_path":     ("Exam path", "26 dated weeks · checkpoints · simulations"),
    "cap_cert":     ("Certification 101", "The rules, explained in pictures"),
    "cap_official": ("Official documents", "26 DoW and WarU documents, in the file"),
    "cap_lessons":  ("Lessons", "35 lessons · pictures that play"),
    "cap_tryit":    ("Try it", "Every dollar rule answers for any amount"),
    "cap_quiz":     ("Practice test", "395 questions · every answer explained"),
    "cap_cards":    ("Flashcards", "14 decks · spaced repetition"),
    "cap_arcade":   ("Arcade", "Seven games on the guide's own content"),
    "cap_range":    ("Range Day", "The qualification range, in real 3D"),
    "cap_buddy":    ("Ask Buddy", "Answers from the guide, on your device"),
    "cap_lookup":   ("Look it up", "250 terms · 53 FAR parts · thresholds"),
    "cap_phone":    ("Everywhere", "Phone · laptop · NIPR · free"),
}
for k, (e, l) in CAPS.items():
    CARDS[k] = card(f'<div class="cap"><div class="bar"></div><div class="txt"><div class="e">{e}</div><div class="l">{l}</div></div></div>')

if __name__ == "__main__":
    with sync_playwright() as p:
        br = p.chromium.launch(channel="msedge", headless=True)
        pg = br.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=2).new_page()
        for name, html in CARDS.items():
            pg.set_content(html); pg.evaluate("document.fonts.ready.then(()=>1)"); pg.wait_for_timeout(250)
            pg.screenshot(path=os.path.join(OUT, name + ".png"), omit_background=name.startswith("cap_"))
            print("ok", name, flush=True)
        br.close()
