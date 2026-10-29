"""Check the Board Ready content and code before a build (GitHub Actions runs this first).

  python tools/check_content.py

Checks: every src/data/*.json parses; the modules the app needs are there with the shape docs/CONTRACT.md describes;
meta.json carries version, app_name, maintainer, content_verified_on, the owner notice, the terms of use, the website's
QR code (with the install sheet it belongs to) and a What's new entry for this version; no email address in the content apart from the
maintainer's; every quiz item has exactly one right option and a reason per option; the right answer does not give itself
away by length (the same rule as tools/merge_content.py); every view registers itself; and `node --check` passes on every
script when Node is installed. Exit code 1 on any problem.
"""
import json, re, shutil, subprocess, sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
SRC = APP / "src"
DATA = SRC / "data"
problems, notes = [], []


def P(msg):
    problems.append(msg)


# ---- data modules ----
mods = {}
for f in sorted(DATA.glob("*.json")):
    if f.name.startswith("_"):
        continue
    try:
        mods[f.stem] = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:   # noqa: BLE001
        P(f"{f.name}: not valid JSON ({e})")
for name in ("meta", "questions", "mcq", "primers", "glossary", "process", "regulations", "games", "rubric_board", "resources", "units"):
    if name not in mods:
        P(f"src/data/{name}.json is missing")

meta = mods.get("meta") or {}
for key in ("app_name", "version", "maintainer", "content_verified_on", "disclaimer"):
    if not meta.get(key):
        P(f"meta.json: {key} is missing")
if not re.fullmatch(r"\d+\.\d+\.\d+", str(meta.get("version", ""))):
    P(f"meta.json: version {meta.get('version')!r} is not major.minor.patch")
ns = (SRC / "js" / "core" / "00-namespace.js").read_text(encoding="utf-8")
m = re.search(r"CORB\.VERSION = '([^']+)'", ns)
if m and m.group(1) != meta.get("version"):
    P(f"CORB.VERSION {m.group(1)} differs from meta.json version {meta.get('version')}")

# ---- owner notice, terms of use, the phone-app QR code and the install sheet (core/08a-terms.js, tools/make_handout.py) ----
for key in ("owner", "copyright", "site_url"):
    if not meta.get(key):
        P(f"meta.json: {key} is missing")
terms = meta.get("terms") or {}
if not (terms.get("version") and terms.get("points") and terms.get("agree")):
    P("meta.json: terms needs version, points and agree (the app shows them before first use)")
qr = meta.get("app_qr")
if meta.get("site_url") and not (isinstance(qr, list) and qr and all(isinstance(r, str) and len(r) == len(qr) and set(r) <= {"0", "1"} for r in qr)):
    P("meta.json: app_qr is missing or malformed; run tools/make_handout.py")
sheet = APP / "handout" / "Board_Ready_Install_Sheet.html"
if meta.get("site_url") and not sheet.exists():
    P("handout/Board_Ready_Install_Sheet.html is missing; run tools/make_handout.py")
elif meta.get("site_url") and sheet.exists():
    sheet_text = sheet.read_text(encoding="utf-8")
    if meta["site_url"] not in sheet_text:
        P("the install sheet does not show the current site_url; run tools/make_handout.py")
    if re.search(r"<(script|link|img)[^>]+(src|href)=\"https?://", sheet_text):
        P("the install sheet loads something from the network; it must stay self-contained")
wn = meta.get("whats_new")
if not isinstance(wn, list) or not wn or not all(isinstance(v, dict) and v.get("version") and v.get("items") for v in wn):
    P("meta.json: whats_new needs a list of {version, date, title, items[]}")
elif wn[0].get("version") != meta.get("version"):
    P(f"meta.json: whats_new starts with {wn[0].get('version')} but the version is {meta.get('version')}; add this version's entry")

questions = mods.get("questions") or []
ids = [q.get("id") for q in questions]
if len(ids) != len(set(ids)):
    P("questions.json: duplicate ids")
for q in questions:
    if not q.get("id") or not q.get("question"):
        P(f"questions.json: {q.get('id')!r} has no id or question text")
    if q.get("answer_status") not in ("official", "open", "ai-draft"):
        P(f"questions.json: {q.get('id')} has answer_status {q.get('answer_status')!r}")
    if q.get("answer_status") == "ai-draft" and "ai-drafted" not in (q.get("flags") or []):
        P(f"questions.json: {q.get('id')} is an AI draft without the ai-drafted flag")

# ---- quiz items: one right option, a reason each, and no length give-away ----
def long_answer(right, wrong):
    return right > 1.3 * max(wrong) and right - max(wrong) >= 15


mcq = mods.get("mcq") or []
longest = 0
for it in mcq:
    opts = it.get("options") or []
    right = [o for o in opts if o.get("correct")]
    if len(opts) < 3 or len(right) != 1:
        P(f"mcq.json: {it.get('qid')} needs 3+ options with exactly one right one")
        continue
    if any(not (o.get("text") or "").strip() or not (o.get("why") or "").strip() for o in opts):
        P(f"mcq.json: {it.get('qid')} has an option without text or a reason")
    rl = len(right[0].get("text") or "")
    wl = [len(o.get("text") or "") for o in opts if not o.get("correct")]
    longest += rl > max(wl)
    if long_answer(rl, wl):
        P(f"mcq.json: {it.get('qid')}: the right answer is much longer than every other option")
if mcq and longest > 0.35 * len(mcq):
    P(f"mcq.json: the right answer is the longest option in {longest} of {len(mcq)} items; keep it near a quarter")
elif mcq:
    notes.append(f"quiz length check: the right answer is the longest option in {longest} of {len(mcq)} items")

# ---- no personal data apart from the maintainer's contact ----
blob = json.dumps({k: v for k, v in mods.items() if k != "meta"}, ensure_ascii=False)
emails = {e for e in re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", blob) if not e.lower().endswith(("example.com", "example.mil"))}
if emails:
    P(f"email addresses in the content: {sorted(emails)[:5]}")

# ---- code ----
views = sorted((SRC / "js" / "views").glob("*.js"))
for f in views:
    if "CORB.registerView(" not in f.read_text(encoding="utf-8"):
        P(f"{f.name}: no CORB.registerView call")
scripts = sorted((SRC / "js" / "core").glob("*.js")) + views + sorted((SRC / "arcade" / "js").rglob("*.js")) + [SRC / "web" / "sw.js"]
node = shutil.which("node")
if node:
    bad = 0
    for f in scripts:
        if not f.exists():
            continue
        r = subprocess.run([node, "--check", str(f)], capture_output=True, text=True)
        if r.returncode:
            bad += 1
            P(f"{f.relative_to(SRC).as_posix()}: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else 'syntax error'}")
    notes.append(f"node --check: {len(scripts) - bad} of {len(scripts)} scripts pass")
else:
    notes.append("node is not installed here, so the scripts were not syntax-checked")
for f in (SRC / "css").rglob("*.css"):
    if re.search(r"url\(\s*['\"]?https?://", f.read_text(encoding="utf-8")):
        P(f"{f.name}: external url() in CSS (the app must not load anything from the network)")

print(f"modules: " + ", ".join(f"{k}({len(v) if isinstance(v, (list, dict)) else 1})" for k, v in mods.items()))
for n in notes:
    print("  " + n)
if problems:
    print("PROBLEMS:")
    for p in problems:
        print("  - " + p)
    sys.exit(1)
print("OK: content and code pass the checks")
