"""Check the Board Ready content and code before a build (GitHub Actions runs this first).

  python tools/check_content.py

Checks: every src/data/*.json parses; the modules the app needs are there with the shape docs/CONTRACT.md describes;
meta.json carries version, app_name, maintainer and content_verified_on; no email address in the content apart from the
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
