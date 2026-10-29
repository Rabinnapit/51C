"""Make the phone-app handout: a QR code for the app's web address and a one-page install sheet to print.

  python tools/make_handout.py        (needs segno: pip install segno; Microsoft Edge prints the PDF)

Reads site_url from src/data/meta.json and writes:
  handout/board-ready-qr.svg, handout/board-ready-qr.png   the QR code, for slides, posters and email
  handout/Board_Ready_Install_Sheet.html                   the install sheet; Edge prints it to
  handout/Board_Ready_Install_Sheet.pdf                    (PDFs stay out of git: print it from this computer)
  src/data/meta.json "app_qr"                              the same QR as rows of 0 and 1; the About page and the
                                                           web edition's install page draw it
Run it again only if the address changes. People who scan the code get every later update by themselves.
Adapted from B2B Exam Prep's make_handout.py.
"""
import html, json, shutil, subprocess, sys, tempfile
from pathlib import Path
import segno

ROOT = Path(__file__).resolve().parents[1]
META_FILE = ROOT / "src" / "data" / "meta.json"
OUT = ROOT / "handout"
raw = META_FILE.read_bytes()
CRLF = b"\r\n" in raw
META = json.loads(raw.decode("utf-8"))
URL = META.get("site_url") or sys.exit("Set site_url in src/data/meta.json first.")
WHO = META.get("owner") or (META.get("maintainer") or {}).get("name", "")
COPY = META.get("copyright", "")
NAME = META.get("app_name", "Board Ready")

qr = segno.make(URL, error="m", micro=False)
OUT.mkdir(exist_ok=True)
qr.save(OUT / "board-ready-qr.svg", scale=10, border=4)
qr.save(OUT / "board-ready-qr.png", scale=12, border=4)
META["app_qr"] = ["".join("1" if cell else "0" for cell in row) for row in qr.matrix]
text = json.dumps(META, ensure_ascii=False, indent=2) + "\n"
META_FILE.write_text(text.replace("\n", "\r\n") if CRLF else text, encoding="utf-8", newline="")

svg = qr.svg_inline(scale=10, border=4)
url = html.escape(URL)
sheet = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{html.escape(NAME)} - install sheet</title>
<style>
@page {{ size: Letter; margin: 0.45in; }}
* {{ box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
html, body {{ margin: 0; padding: 0; }}
body {{ color: #14181f; background: #fff; font: 12.5pt/1.45 "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif; }}
.sheet {{ width: 7.4in; margin: 0 auto; }}
.band {{ background: #173a6b; color: #fff; padding: 0.22in 0.3in 0.18in; border-radius: 0.08in 0.08in 0 0; }}
.band h1 {{ margin: 0; font: 800 32pt/1 "Bahnschrift", "Segoe UI", Arial, sans-serif; letter-spacing: 0.01em; }}
.band p {{ margin: 0.09in 0 0; font-size: 13pt; color: #d6e2f5; }}
.stripe {{ height: 0.12in; background: linear-gradient(90deg, #b8862b 0 25%, #2a5aa0 25% 50%, #1f7a4d 50% 75%, #e2b657 75%); }}
.scan {{ display: grid; grid-template-columns: 2.7in 1fr; gap: 0.38in; align-items: center; margin-top: 0.26in; }}
.qrbox {{ border: 1.5pt solid #14181f; border-radius: 0.06in; padding: 0.05in; line-height: 0; }}
.qrbox svg {{ display: block; width: 100%; height: auto; }}
.k {{ display: inline-block; background: #173a6b; color: #fff; font-size: 10pt; letter-spacing: 0.12em; padding: 0.05in 0.1in 0.04in; border-radius: 0.04in; }}
.scan h2 {{ margin: 0.12in 0 0.06in; font: 800 25pt/1.05 "Bahnschrift", "Segoe UI", Arial, sans-serif; }}
.scan p {{ margin: 0 0 0.1in; }}
.url {{ display: block; margin-top: 0.04in; padding: 0.1in 0.13in; border: 1.5pt solid #173a6b; border-radius: 0.05in; background: #e6edf8; font-size: 14pt; word-break: break-all; }}
.steps {{ display: grid; grid-template-columns: 1fr 1fr; gap: 0.16in; margin-top: 0.26in; }}
.col {{ border: 1.5pt solid #14181f; border-radius: 0.06in; padding: 0.14in 0.2in 0.08in; }}
.col h3 {{ margin: 0 0 0.08in; font: 800 15pt/1.2 "Bahnschrift", "Segoe UI", Arial, sans-serif; }}
.col h3 span {{ font: 400 11pt "Segoe UI", system-ui, sans-serif; color: #5f6774; }}
ol {{ margin: 0; padding: 0; list-style: none; counter-reset: s; }}
li {{ position: relative; padding: 0 0 0.09in 0.36in; counter-increment: s; font-size: 11.5pt; line-height: 1.36; }}
li::before {{ content: counter(s); position: absolute; left: 0; top: 0.01in; width: 0.24in; height: 0.24in; border-radius: 50%; background: #173a6b; color: #fff; text-align: center; font: 700 10.5pt/0.24in "Bahnschrift", Arial, sans-serif; }}
.does {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.12in; margin-top: 0.22in; }}
.cell {{ border-radius: 0.06in; background: #f1f3f7; padding: 0.12in 0.14in; font-size: 11pt; line-height: 1.38; }}
.cell b {{ display: block; margin-bottom: 0.03in; font-size: 12pt; color: #173a6b; }}
.foot {{ margin-top: 0.2in; font-size: 9.5pt; line-height: 1.45; color: #5f6774; }}
</style>
</head>
<body>
<div class="sheet">
  <div class="band">
    <h1>{html.escape(NAME)}</h1>
    <p>Free study app for the Army contracting officer warrant board (CORB) &middot; works offline after the first open</p>
  </div>
  <div class="stripe"></div>
  <div class="scan">
    <div class="qrbox">{svg}</div>
    <div>
      <span class="k">SCAN WITH YOUR PHONE CAMERA</span>
      <h2>Get the app in one minute</h2>
      <p>The page that opens has one job: put the app on your phone. No app store, no account, no cost.</p>
      <span class="url">{url}</span>
    </div>
  </div>
  <div class="steps">
    <div class="col"><h3>iPhone <span>(Safari)</span></h3><ol>
      <li>Scan the code with the <b>Camera</b> app: the page opens in <b>Safari</b>.</li>
      <li>Tap <b>Share</b> (the square with an arrow) in the bar at the bottom. If that bar shows <b>&middot;&middot;&middot;</b>, tap it first.</li>
      <li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
      <li>Open it from the new icon once while online.</li></ol></div>
    <div class="col"><h3>Android <span>(Chrome)</span></h3><ol>
      <li>Scan the code with the <b>Camera</b> app.</li>
      <li>Tap <b>Install app</b>. If the page opened in Samsung Internet, tap <b>Install with Chrome</b> first: only Chrome installs it without a warning.</li>
      <li>Tap <b>Install</b> in the box that appears.</li>
      <li>Open it from the new icon once while online.</li></ol></div>
  </div>
  <div class="does">
    <div class="cell"><b>Know the questions</b>More than 300 board questions with answers and citations, filtered to your warrant class and organization, plus study primers.</div>
    <div class="cell"><b>Rehearse the board</b>Flashcards, a quiz that explains every option, scenarios, a timed mock board scored on the rubric, a mentor and eight games.</div>
    <div class="cell"><b>Always current</b>New versions arrive by themselves when you are online. Your progress and notes stay on your phone.</div>
  </div>
  <p class="foot"><b>{html.escape(COPY)}</b> Owned by {html.escape(WHO)}. Free for your own study and for sharing this sheet or the link;
  copying, changing or selling the app needs the owner's written permission.<br>A training aid, not official guidance: confirm citations, thresholds and local
  procedures with the Contracting &amp; Policy office. No tracking and no account: nothing you do in the app is sent anywhere.
  Also works on Windows and Mac computers: open the same address in Edge or Chrome and choose Install.</p>
</div>
</body>
</html>
"""
html_file = OUT / "Board_Ready_Install_Sheet.html"
html_file.write_text(sheet, encoding="utf-8")
print("wrote", html_file.relative_to(ROOT), "and the QR code for", URL, f"({len(META['app_qr'])} rows into meta.app_qr)")

edge = shutil.which("msedge") or next((p for p in [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                                                    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"] if Path(p).exists()), None)
if edge:
    pdf = OUT / "Board_Ready_Install_Sheet.pdf"
    with tempfile.TemporaryDirectory() as profile:   # its own profile, so it works while Edge is open
        subprocess.run([edge, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={profile}", "--no-pdf-header-footer",
                        f"--print-to-pdf={pdf}", html_file.as_uri()], check=False, capture_output=True, timeout=120)
    print("printed", pdf.relative_to(ROOT) if pdf.exists() else "nothing: open the HTML sheet and print it to PDF")
else:
    print("Microsoft Edge not found: open the HTML sheet and print it to PDF")
