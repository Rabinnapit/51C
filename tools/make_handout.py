"""Make the phone-app handout: a QR code for the app's web address and a one-page install sheet to print.

  python tools/make_handout.py        (needs segno: pip install segno; Microsoft Edge prints the PDF)

Reads site_url from src/data/meta.json and writes:
  handout/b2b-exam-prep-qr.svg, handout/b2b-exam-prep-qr.png   the QR code, for slides, posters and email
  handout/B2B_Exam_Prep_Install_Sheet.html                 the install sheet; Edge prints it to
  handout/B2B_Exam_Prep_Install_Sheet.pdf                  (PDFs stay out of git: print it from this computer)
  src/data/meta.json "app_qr"                          the same QR as rows of 0 and 1; the About page draws it
Run it again only if the address changes. People who scan the code get every later update by themselves.
"""
import html, json, re, shutil, subprocess, sys, tempfile
from pathlib import Path
import segno

ROOT = Path(__file__).resolve().parents[1]
META_FILE = ROOT / "src" / "data" / "meta.json"
OUT = ROOT / "handout"
META = json.loads(META_FILE.read_text(encoding="utf-8"))
URL = META.get("site_url") or sys.exit("Set site_url in src/data/meta.json first.")
WHO = META.get("owner") or (META.get("maintainer") or {}).get("name", "")
COPY = META.get("copyright", "")

qr = segno.make(URL, error="m", micro=False)
OUT.mkdir(exist_ok=True)
qr.save(OUT / "b2b-exam-prep-qr.svg", scale=10, border=4)
qr.save(OUT / "b2b-exam-prep-qr.png", scale=12, border=4)
rows = ["".join("1" if cell else "0" for cell in row) for row in qr.matrix]

# the About page draws the code from these rows; keep meta.json's one-key-per-line layout
raw = META_FILE.read_text(encoding="utf-8")
line = '  "app_qr": ' + json.dumps(rows) + ",\n"
if '"app_qr"' in raw:
    raw = re.sub(r'  "app_qr": \[.*?\],\n', lambda m: line, raw, count=1, flags=re.S)
else:
    raw = raw.replace('  "site_url": ', line + '  "site_url": ', 1)
META_FILE.write_text(raw, encoding="utf-8")

svg = qr.svg_inline(scale=10, border=4)
url = html.escape(URL)
sheet = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>B2B Exam Prep - install sheet</title>
<style>
@page {{ size: Letter; margin: 0.45in; }}
* {{ box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
html, body {{ margin: 0; padding: 0; }}
body {{ color: #14211b; background: #fff; font: 12.5pt/1.45 "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif; }}
.sheet {{ width: 7.4in; margin: 0 auto; }}
.band {{ background: #1f5e46; color: #fff; padding: 0.22in 0.3in 0.18in; border-radius: 0.08in 0.08in 0 0; }}
.band h1 {{ margin: 0; font: 800 32pt/1 "Bahnschrift", "Segoe UI", Arial, sans-serif; letter-spacing: 0.01em; }}
.band p {{ margin: 0.09in 0 0; font-size: 13pt; color: #d9ecdf; }}
.stripe {{ height: 0.12in; background: linear-gradient(90deg, #4e57b0 0 25%, #23649f 25% 50%, #a2620f 50% 75%, #0e7480 75%); }}
.scan {{ display: grid; grid-template-columns: 2.7in 1fr; gap: 0.38in; align-items: center; margin-top: 0.26in; }}
.qrbox {{ border: 1.5pt solid #14211b; border-radius: 0.06in; padding: 0.05in; line-height: 0; }}
.qrbox svg {{ display: block; width: 100%; height: auto; }}
.k {{ display: inline-block; background: #1f5e46; color: #fff; font-size: 10pt; letter-spacing: 0.12em; padding: 0.05in 0.1in 0.04in; border-radius: 0.04in; }}
.scan h2 {{ margin: 0.12in 0 0.06in; font: 800 25pt/1.05 "Bahnschrift", "Segoe UI", Arial, sans-serif; }}
.scan p {{ margin: 0 0 0.1in; }}
.url {{ display: block; margin-top: 0.04in; padding: 0.1in 0.13in; border: 1.5pt solid #1f5e46; border-radius: 0.05in; background: #e6f2ea; font-size: 15pt; word-break: break-all; }}
.steps {{ display: grid; grid-template-columns: 1fr 1fr; gap: 0.16in; margin-top: 0.26in; }}
.col {{ border: 1.5pt solid #14211b; border-radius: 0.06in; padding: 0.14in 0.2in 0.08in; }}
.col h3 {{ margin: 0 0 0.08in; font: 800 15pt/1.2 "Bahnschrift", "Segoe UI", Arial, sans-serif; }}
.col h3 span {{ font: 400 11pt "Segoe UI", system-ui, sans-serif; color: #4b5a52; }}
ol {{ margin: 0; padding: 0; list-style: none; counter-reset: s; }}
li {{ position: relative; padding: 0 0 0.09in 0.36in; counter-increment: s; font-size: 11.5pt; line-height: 1.36; }}
li::before {{ content: counter(s); position: absolute; left: 0; top: 0.01in; width: 0.24in; height: 0.24in; border-radius: 50%; background: #1f5e46; color: #fff; text-align: center; font: 700 10.5pt/0.24in "Bahnschrift", Arial, sans-serif; }}
.does {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.12in; margin-top: 0.22in; }}
.cell {{ border-radius: 0.06in; background: #f1f4f2; padding: 0.12in 0.14in; font-size: 11pt; line-height: 1.38; }}
.cell b {{ display: block; margin-bottom: 0.03in; font-size: 12pt; color: #1f5e46; }}
.foot {{ margin-top: 0.2in; font-size: 9.5pt; line-height: 1.45; color: #4b5a52; }}
</style>
</head>
<body>
<div class="sheet">
  <div class="band">
    <h1>B2B Exam Prep</h1>
    <p>Free phone app for new 51C and 1102 contracting professionals &middot; works offline after the first open</p>
  </div>
  <div class="stripe"></div>
  <div class="scan">
    <div class="qrbox">{svg}</div>
    <div>
      <span class="k">SCAN WITH YOUR PHONE CAMERA</span>
      <h2>Get the app in one minute</h2>
      <p>Open the link, then add it to your home screen. No app store, no account, no cost.</p>
      <span class="url">{url}</span>
    </div>
  </div>
  <div class="steps">
    <div class="col"><h3>iPhone <span>(Safari)</span></h3><ol>
      <li>Scan the code, or type the address, and open it in <b>Safari</b>.</li>
      <li>Tap <b>Share</b> (the square with an arrow).</li>
      <li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
      <li>Open it from the new icon once while online.</li></ol></div>
    <div class="col"><h3>Android <span>(Chrome)</span></h3><ol>
      <li>Scan the code and open the link in <b>Chrome</b>.</li>
      <li>Tap <b>Install app</b> when it is offered, or the menu (three dots), then <b>Install app</b> or <b>Add to Home screen</b>.</li>
      <li>Tap <b>Install</b>.</li>
      <li>Open it from the new icon once while online.</li></ol></div>
  </div>
  <div class="does">
    <div class="cell"><b>Get certified</b>The courses in order, signing up in AITAS, the CON 3990V exam step by step, and 26 official documents.</div>
    <div class="cell"><b>Learn and practice</b>35 lessons with pictures you can play, 374 explained practice questions, flashcards and six games.</div>
    <div class="cell"><b>Always current</b>New versions arrive by themselves when you are online. Your progress stays on your phone.</div>
  </div>
  <p class="foot"><b>{html.escape(COPY)}</b> Owned by {html.escape(WHO)}. Free for your own study and for sharing this sheet or the link;
  copying, changing or selling the app needs the owner's written permission.<br>An unofficial training aid for new 51Cs and 1102s. It is not official guidance:
  check the official sources it links to. No accounts and no tracking; nothing you do in the app is sent anywhere.
  Also works on Windows and Mac computers: open the same address in Edge or Chrome and choose Install.</p>
</div>
</body>
</html>
"""
html_file = OUT / "B2B_Exam_Prep_Install_Sheet.html"
html_file.write_text(sheet, encoding="utf-8")
print("wrote", html_file.relative_to(ROOT), "and the QR code for", URL)

edge = shutil.which("msedge") or next((p for p in [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                                                    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"] if Path(p).exists()), None)
if edge:
    pdf = OUT / "B2B_Exam_Prep_Install_Sheet.pdf"
    with tempfile.TemporaryDirectory() as profile:   # its own profile, so it works while Edge is open
        subprocess.run([edge, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={profile}", "--no-pdf-header-footer",
                        f"--print-to-pdf={pdf}", html_file.as_uri()], check=False, capture_output=True, timeout=120)
    print("printed", pdf.relative_to(ROOT) if pdf.exists() else "nothing: open the HTML sheet and print it to PDF")
else:
    print("Microsoft Edge not found: open the HTML sheet and print it to PDF")
