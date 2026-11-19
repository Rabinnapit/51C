"""Title cards and the caption band for the phone-sized (portrait) cut, 1080 x 1920, in the same palette, fonts and
words as cards.py. Usage: python cards_tall.py [outdir]   (default ../cards_tall)
  card_open / card_title / card_end   full-frame cards at 2x (2160 x 3840)
  band.png                            the 240 px band above the app's screen, and the screen's two rounded top corners
  cap_*.png                           one caption each, drawn inside the band (transparent everywhere else)
"""
import os, sys
from playwright.sync_api import sync_playwright
import cards as K                      # the fonts, the icon, the QR code and the captions' words

OUT = sys.argv[1] if len(sys.argv) > 1 else "../cards_tall"
os.makedirs(OUT, exist_ok=True)
BAND = 240

CSS = """
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:transparent}
body{color:#eef3ee;font-family:"Manrope","Segoe UI Variable Text","Segoe UI",sans-serif}
.card{position:relative;width:1080px;height:1920px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at 50% 38%,#1b4a39 0%,#10281f 46%,#070d0a 100%)}
.card:after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 300px 80px rgba(0,0,0,.72);pointer-events:none}
.grid{position:absolute;inset:0;opacity:.07;background-image:linear-gradient(#e2b65c 1px,transparent 1px),linear-gradient(90deg,#e2b65c 1px,transparent 1px);background-size:96px 96px}
.eyebrow{font-family:"JetBrains Mono","Cascadia Mono","Consolas",monospace;letter-spacing:.34em;font-size:27px;line-height:1.75;color:#e2b65c;text-transform:uppercase;text-align:center;padding:0 70px}
.title{font-family:"Archivo","Segoe UI Variable Display","Segoe UI",sans-serif;font-weight:800;letter-spacing:.04em;font-size:150px;text-transform:uppercase;text-align:center;line-height:1.02;color:#f5f8f4}
.title.sm{font-size:104px}
.huge{font-family:"Archivo","Segoe UI",sans-serif;font-weight:800;font-size:440px;letter-spacing:-.01em;color:#e2b65c;line-height:.9;margin-top:60px;text-align:center;text-shadow:0 0 70px rgba(226,182,92,.25)}
.huge small{display:block;font-size:150px;letter-spacing:.03em;color:#f5f8f4;line-height:1.1;margin-top:18px}
.tag{font-size:58px;line-height:1.2;color:#d4ddd6;margin-top:44px;letter-spacing:.01em;font-weight:400;text-align:center;padding:0 80px}
.tag b{color:#f5f8f4;font-weight:700}
.tag.brass{color:#e2b65c;font-weight:700;font-family:"Archivo","Segoe UI",sans-serif;font-size:56px}
.rule{width:520px;height:2px;background:linear-gradient(90deg,transparent,#e2b65c,transparent);margin-top:54px}
.foot{position:absolute;bottom:120px;left:0;right:0;text-align:center;font-family:"JetBrains Mono","Consolas",monospace;font-size:23px;letter-spacing:.26em;line-height:1.9;color:#8ea397;text-transform:uppercase;padding:0 70px}
.icon{width:260px;height:260px;border-radius:58px;box-shadow:0 24px 70px -20px rgba(0,0,0,.8),0 0 0 1px rgba(226,182,92,.25)}
.qr{width:400px;height:400px;background:#fff;border-radius:26px;padding:26px;box-shadow:0 18px 50px -16px rgba(0,0,0,.8)}
.qr svg{width:100%;height:100%;display:block}
.scan{font-family:"JetBrains Mono","Consolas",monospace;font-size:31px;letter-spacing:.2em;text-transform:uppercase;color:#f5f8f4;margin-top:40px;text-align:center}
.scan.sub{font-size:23px;color:#9fb3a7;margin-top:16px}
.band{position:absolute;left:0;top:0;width:1080px;height:BANDpx;display:flex;align-items:center;padding:0 54px}
.band.bg{background:linear-gradient(180deg,#08110d 0%,#10281f 100%)}
.corner{position:absolute;top:BANDpx;width:46px;height:46px}
.cap{display:flex;align-items:stretch;gap:26px}
.cap .bar{flex:none;width:9px;border-radius:5px;background:#e2b65c}
.cap .e{font-family:"JetBrains Mono","Consolas",monospace;font-size:27px;letter-spacing:.32em;color:#e2b65c;text-transform:uppercase}
.cap .l{font-family:"Archivo","Segoe UI",sans-serif;font-weight:700;font-size:52px;letter-spacing:.01em;color:#f5f8f4;margin-top:9px;line-height:1.1;text-wrap:balance}
""".replace("BANDpx", f"{BAND}px")
def card(body): return f"<!doctype html><html><head><meta charset='utf-8'><style>{K.FONTS}\n{CSS}</style></head><body>{body}</body></html>"

CARDS = {
    "card_open": card("""<div class="card"><div class="grid"></div>
        <div class="eyebrow">DoW Contracting Professional<br>certification</div>
        <div class="huge">36<small>MONTHS.</small></div>
        <div class="rule"></div>
        <div class="tag">Most Brigades want it in <b>six</b>.</div>
        <div class="foot">For new 51C Soldiers<br>and 1102 civilians</div></div>"""),
    "card_title": card(f"""<div class="card"><div class="grid"></div>
        <div class="eyebrow">Free &nbsp;·&nbsp; works offline<br>built by a 51C</div>
        <img class="icon" src="{K.ICON}" alt="" style="margin-top:64px">
        <div class="title" style="margin-top:56px">B2B<br>Exam Prep</div>
        <div class="rule"></div>
        <div class="tag">From day one to <b>certified</b>.</div>
        <div class="foot">Plan · lessons · practice<br>flashcards · arcade · buddy</div></div>"""),
    "card_end": card(f"""<div class="card"><div class="grid"></div>
        <img class="icon" src="{K.ICON}" alt="" style="width:190px;height:190px;border-radius:44px;margin-top:-150px">
        <div class="title sm" style="margin-top:40px">B2B Exam Prep</div>
        <div class="tag" style="margin-top:30px">From day one to <b>certified</b>.</div>
        <div class="tag brass" style="margin-top:22px">Built by a 51C,<br>for 51Cs and 1102s.</div>
        <div class="qr" style="margin-top:64px">{K.QR}</div>
        <div class="scan">Scan with the phone's camera</div>
        <div class="scan sub">Free &nbsp;·&nbsp; no app store &nbsp;·&nbsp; updates itself</div>
        <div class="foot" style="bottom:96px">Owned and built by SFC Rabin Napit<br>Unofficial training aid &nbsp;·&nbsp; not endorsed<br>by the Army, DoW or WarU</div></div>"""),
    # the band the app's screen sits under, with the screen's top corners rounded into it
    "band": card(f"""<div class="band bg"></div>
        <svg class="corner" style="left:0" viewBox="0 0 46 46"><path d="M0 0H46A46 46 0 0 0 0 46Z" fill="#10281f"/></svg>
        <svg class="corner" style="right:0" viewBox="0 0 46 46"><path d="M46 0H0A46 46 0 0 1 46 46Z" fill="#10281f"/></svg>"""),
}
# where a caption of two lines breaks (the band is 937 px wide inside its margins: about 32 letters)
BREAKS = {'cap_path': '26 dated weeks<br>checkpoints · simulations', 'cap_official': '26 DoW and WarU documents,<br>one tap away',
          'cap_quiz': '395 questions<br>every answer explained', 'cap_voice': 'Four app voices<br>offline after one download',
          'cap_buddy': 'Answers from the guide,<br>on your device', 'cap_tryit': 'Every dollar rule<br>answers for any amount'}
for k, (e, l) in K.CAPS.items():
    l = BREAKS.get(k, l)
    CARDS[k] = card(f'<div class="band"><div class="cap"><div class="bar"></div><div><div class="e">{e}</div><div class="l">{l}</div></div></div></div>')

if __name__ == "__main__":
    with sync_playwright() as p:
        br = p.chromium.launch(channel="msedge", headless=True)
        big = br.new_context(viewport={"width": 1080, "height": 1920}, device_scale_factor=2).new_page()
        one = br.new_context(viewport={"width": 1080, "height": 1920}, device_scale_factor=1).new_page()
        for name, html in CARDS.items():
            pg = big if name.startswith("card_") else one
            pg.set_content(html); pg.evaluate("document.fonts.ready.then(()=>1)"); pg.wait_for_timeout(250)
            pg.screenshot(path=os.path.join(OUT, name + ".png"), omit_background=not name.startswith("card_"))
            print("ok", name, flush=True)
        br.close()
