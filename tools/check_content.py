"""Check the content in src/data before a build.

  python tools/check_content.py

Fails (exit 1) on broken links between modules, duplicate ids, questions without exactly one right answer,
and blueprint totals that do not add up to 150. Prints warnings for things worth a look.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
errors, warns = [], []


def load():
    mods = {}
    for f in sorted(DATA.glob("*.json")):
        name = f.stem.split("-")[0]
        try:
            obj = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            errors.append(f"{f.name}: not valid JSON ({e})")
            continue
        if name not in mods:
            mods[name] = obj
        elif isinstance(obj, list):
            mods[name] = mods[name] + obj
        else:
            mods[name] = {**mods[name], **obj}
    return mods


M = load()
need = ["meta", "cert", "courses", "plan", "lessons", "quiz", "glossary", "howto", "far", "updates", "links", "games", "cards"]
for n in need:
    if n not in M:
        errors.append(f"missing module: {n}")
if errors:
    print("\n".join("ERROR " + e for e in errors)); sys.exit(1)

phases = {p["id"]: p for p in M["cert"]["phases"]}
total = sum(p["qs"] for p in phases.values())
if total != 150:
    errors.append(f"blueprint phases add up to {total}, not 150")
for p in phases.values():
    s = sum(i["qs"] for i in p["items"])
    if s != p["qs"]:
        errors.append(f"phase {p['id']}: items add up to {s}, not {p['qs']}")


def dupes(items, key, label):
    seen = set()
    for it in items:
        k = it.get(key)
        if k in seen:
            errors.append(f"duplicate {label} {k}")
        seen.add(k)
    return seen


lesson_ids = dupes(M["lessons"], "id", "lesson")
course_ids = dupes(M["courses"], "id", "course")
howto_ids = dupes(M["howto"], "id", "how-to")
q_ids = dupes(M["quiz"], "id", "question")
terms = set()
for g in M["glossary"]:
    t = g["term"].lower()
    if t in terms:
        errors.append(f"duplicate glossary term {g['term']}")
    terms.add(t)
    if not g.get("definition"):
        errors.append(f"glossary {g['term']} has no definition")

for l in M["lessons"]:
    if l["phase"] not in phases and l["phase"] != "job":
        errors.append(f"lesson {l['id']}: unknown phase {l['phase']}")
    for k in ("title", "summary", "sections"):
        if not l.get(k):
            errors.append(f"lesson {l['id']}: missing {k}")
    for t in l.get("terms", []):
        if t.lower() not in terms:
            warns.append(f"lesson {l['id']}: key term '{t}' is not in the glossary")

per_lesson = {}
for q in M["quiz"]:
    right = [o for o in q["options"] if o.get("correct")]
    if len(right) != 1:
        errors.append(f"question {q['id']}: {len(right)} right answers")
    if len(q["options"]) != 4:
        warns.append(f"question {q['id']}: {len(q['options'])} options")
    if q["lesson"] not in lesson_ids:
        errors.append(f"question {q['id']}: unknown lesson {q['lesson']}")
    if q["phase"] not in phases and q["phase"] != "job":
        errors.append(f"question {q['id']}: unknown phase {q['phase']}")
    for o in q["options"]:
        if not o.get("why"):
            warns.append(f"question {q['id']}: an option has no explanation")
    texts = [o["text"] for o in q["options"]]
    if len(set(texts)) != len(texts):
        errors.append(f"question {q['id']}: repeated option text")
    per_lesson[q["lesson"]] = per_lesson.get(q["lesson"], 0) + 1
for l in M["lessons"]:
    if per_lesson.get(l["id"], 0) == 0:
        warns.append(f"lesson {l['id']} has no check questions")

by_phase = {}
for q in M["quiz"]:
    by_phase[q["phase"]] = by_phase.get(q["phase"], 0) + 1
for pid, p in phases.items():
    if by_phase.get(pid, 0) < p["qs"]:
        warns.append(f"phase {pid}: {by_phase.get(pid, 0)} questions in the bank, fewer than the {p['qs']} a full 150-question simulation draws")

for c in M["courses"]:
    for lid in c.get("lessons", []):
        if lid not in lesson_ids:
            errors.append(f"course {c['id']}: unknown lesson {lid}")
for x in M["howto"]:
    for lid in x.get("lessons", []):
        if lid not in lesson_ids:
            errors.append(f"how-to {x['id']}: unknown lesson {lid}")
for s in M["plan"]["steps"]:
    if s.get("course") and s["course"] not in course_ids:
        errors.append(f"plan step {s['id']}: unknown course {s['course']}")
    if s.get("howto") and s["howto"] not in howto_ids:
        errors.append(f"plan step {s['id']}: unknown how-to {s['howto']}")
    if s.get("lesson") and s["lesson"] not in lesson_ids:
        errors.append(f"plan step {s['id']}: unknown lesson {s['lesson']}")
    if ("day" in s) == ("months" in s):
        errors.append(f"plan step {s['id']}: needs exactly one of day or months")

parts = M["far"]["parts"]
if [p["n"] for p in parts] != list(range(1, 54)):
    errors.append("FAR parts must be 1 to 53 in order")
exam_parts = sorted(p["n"] for p in parts if p.get("exam"))
if exam_parts != [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 15, 16, 19, 31, 33, 42, 44, 46, 49]:
    errors.append(f"exam part list differs from the exam FAQ: {exam_parts}")
for g in M["games"]["phase_sort"]:
    if g["answer"] not in phases:
        errors.append(f"phase game item has unknown answer {g['answer']}")
for g in M["games"]["threshold"]:
    if g["answer"] not in g["choices"]:
        errors.append(f"threshold item answer not among its choices: {g['scenario'][:40]}")
for l in M["links"]:
    if not re.match(r"^https://", l["url"]):
        errors.append(f"link not https: {l['url']}")

for w in warns:
    print("warning:", w)
for e in errors:
    print("ERROR:", e)
print(f"lessons {len(M['lessons'])}, questions {len(M['quiz'])} {by_phase}, glossary {len(M['glossary'])}, courses {len(M['courses'])}, how-tos {len(M['howto'])}, plan steps {len(M['plan']['steps'])}, links {len(M['links'])}")
if errors:
    sys.exit(1)
print("OK: content checks pass")
