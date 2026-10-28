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

# 6-month exam path: dated weeks of tasks that point at lessons, courses, decks, games and question sets
deck_ids = {"far-exam", "far-all", "acronyms", "terms", "numbers", "deadlines", "courses"} | {d["id"] for d in M["cards"]}
game_ids = {"farmatch", "phase", "threshold", "risk"}                                       # quick drills (views/games.js)
arcade_ids = {"contract-quest", "fire-mission", "qual-range", "part-patrol", "sort-yard"}    # the Arcade (js/arcade/games)
srcs = {q.get("src") for q in M["quiz"] if q.get("src")}
if "path" in M:
    weeks = M["path"]["weeks"]
    if [w["n"] for w in weeks] != list(range(1, len(weeks) + 1)):
        errors.append("path weeks must be numbered 1, 2, 3... in order")
    month_ids = {m["n"] for m in M["path"]["months"]}
    task_ids = set()
    for w in weeks:
        if w["m"] not in month_ids:
            errors.append(f"path week {w['n']}: unknown month {w['m']}")
        for t in w["tasks"]:
            if t["id"] in task_ids:
                errors.append(f"duplicate path task {t['id']}")
            task_ids.add(t["id"])
            k = t["kind"]
            if k == "lesson" and t.get("lesson") not in lesson_ids:
                errors.append(f"path task {t['id']}: unknown lesson {t.get('lesson')}")
            if k == "course" and t.get("course") not in course_ids:
                errors.append(f"path task {t['id']}: unknown course {t.get('course')}")
            if k == "cards" and t.get("deck") not in deck_ids:
                errors.append(f"path task {t['id']}: unknown deck {t.get('deck')}")
            if k == "game" and t.get("game") not in game_ids | arcade_ids:
                errors.append(f"path task {t['id']}: unknown game {t.get('game')}")
            if k == "game" and t.get("realm") and (t.get("game") != "contract-quest" or t["realm"] not in ("gp", "pre", "awd", "post", "all")):
                errors.append(f"path task {t['id']}: realm {t.get('realm')} needs Contract Quest and one of gp, pre, awd, post, all")
            if k == "read" and not 1 <= t.get("far", 0) <= 53:
                errors.append(f"path task {t['id']}: FAR part out of range")
            if k in ("drill", "exam"):
                for lid in t.get("lessons", []):
                    if lid not in lesson_ids:
                        errors.append(f"path task {t['id']}: unknown lesson {lid}")
                if t.get("src") and t["src"] not in srcs:
                    errors.append(f"path task {t['id']}: no questions with src {t['src']}")
                if t.get("phase") and t["phase"] not in phases:
                    errors.append(f"path task {t['id']}: unknown phase {t['phase']}")
            if k not in ("lesson", "read", "cards", "drill", "exam", "course", "game", "do", "realexam"):
                errors.append(f"path task {t['id']}: unknown kind {k}")
            if k in ("read", "cards", "drill", "exam", "game", "do", "realexam") and not t.get("t"):
                errors.append(f"path task {t['id']}: needs a title (t)")
    for c in M["path"].get("checks", []):
        if c.get("status") not in ("ok", "updated", "fixed", "verify"):
            errors.append(f"path check '{c.get('topic')}': unknown status {c.get('status')}")
    for it in M["path"].get("intel", []):
        if it.get("lesson") and it["lesson"] not in lesson_ids:
            errors.append(f"path tip '{it['t']}': unknown lesson {it['lesson']}")
        if it.get("deck") and it["deck"] not in deck_ids:
            errors.append(f"path tip '{it['t']}': unknown deck {it['deck']}")
for q in M["quiz"]:
    if q.get("src") == "class" and q.get("check") not in ("same", "updated", "fixed"):
        errors.append(f"question {q['id']}: class question needs check same, updated or fixed")
    if q.get("check") in ("updated", "fixed") and not q.get("note"):
        errors.append(f"question {q['id']}: an updated or fixed class question needs a note saying what changed")

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
