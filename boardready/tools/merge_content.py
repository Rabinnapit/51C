"""Merge agent-authored content from app/content/out/*.json into app/src/data/*.json.
Idempotent: re-running re-derives every data module from questions.json (the frozen bank) plus the outputs.
  python tools/merge_content.py
"""
import os, json, re, sys, datetime
from pathlib import Path
from collections import Counter

APP = Path(__file__).resolve().parents[1]
OUT = APP / "content" / "out"
DATA = APP / "src" / "data"
TODAY = datetime.date.today().isoformat()
report = []


def R(msg):
    report.append(msg)
    print(msg)


def load(name, default):
    p = OUT / name
    if not p.exists():
        R(f"  (missing) {name}")
        return default
    try:
        return json.loads(p.read_text(encoding="utf-8-sig"))
    except Exception as e:
        R(f"  (INVALID JSON) {name}: {e}")
        return default


def load_glob(pattern):
    items = []
    for p in sorted(OUT.glob(pattern)):
        if ".review" in p.name or ".verify" in p.name:
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8-sig"))
            items.append((p.name, d))
        except Exception as e:
            R(f"  (INVALID JSON) {p.name}: {e}")
    return items


def as_list(d, *keys):
    if isinstance(d, list):
        return d
    if isinstance(d, dict):
        for k in keys:
            if isinstance(d.get(k), list):
                return d[k]
        for v in d.values():
            if isinstance(v, list):
                return v
    return []


def norm_cite(c):
    return re.sub(r"\s+", " ", str(c or "")).replace("RFO ", "").strip().upper()


# ---------------- questions (frozen bank + drafts + Korea scenarios + crosswalk) ----------------
questions = json.loads((DATA / "questions.json").read_text(encoding="utf-8"))
byid = {q["id"]: q for q in questions}
# strip anything a previous merge added so the merge is idempotent
questions = [q for q in questions if not str(q["id"]).startswith(("K", "N"))]
byid = {q["id"]: q for q in questions}

# ---------------- source lists: questions the fuzzy merge folded together ----------------
# build_bank.py merges near-identical questions. Three 409th CSB (Germany, ABG-75) questions were folded into ACC-wide
# questions, and their ABG-75 answers even became the shown answer of two of them. Every source row that is not
# represented by its own question is split back out here, with stable ids after the highest existing Q number.
R("== source lists: split folded questions ==")
import csv as _csv, html as _html, difflib as _difflib
import openpyxl as _openpyxl
def _sources_root():
    """The folder that holds corb/WarrantQA.csv and CORB2/: CORB_SOURCES, or the nearest parent of the app that has them."""
    env = os.environ.get("CORB_SOURCES")
    if env:
        return Path(env)
    for parent in APP.parents:
        if (parent / "corb" / "WarrantQA.csv").exists() or (parent / "CORB2").exists():
            return parent
    return APP.parents[1]


ROOT = _sources_root()


def _clean(t):
    if t is None:
        return ""
    t = str(t).replace("​", "").replace("﻿", "")
    t = re.sub(r"(?i)<br\s*/?>", "\n", t)
    t = re.sub(r"(?i)</p>|</li>|</div>|</h\d>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = _html.unescape(t).replace("\xa0", " ")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n\s*\n+", "\n\n", t)
    return t.strip()


def _flat(t):
    """Source rows carry hard line wraps inside sentences; join single line breaks, keep paragraph breaks."""
    return re.sub(r" {2,}", " ", re.sub(r"(?<!\n)\n(?!\n)", " ", _clean(t))).strip()


def _nk(t):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", _clean(t).lower())).strip()


def _open(a):
    return (not a) or ("intentionally not populated" in a.lower()) or len(a.strip()) < 8


def _classes(v):
    v = _clean(v)
    parts = None
    if v.startswith("["):
        try:
            parts = [str(x) for x in json.loads(v)]
        except Exception:
            parts = None
    if parts is None:
        parts = re.split(r";#|,", v)
    out = []
    for part in parts:
        p = part.strip().replace("Class ", "").replace("Class", "").strip()
        if p in ("I", "II", "III", "IV"):
            out.append(p)
        elif p.lower().startswith("agree"):
            out.append("Agreements")
        elif p.lower().startswith("grant"):
            out.append("Grants")
    order = {"I": 0, "II": 1, "III": 2, "IV": 3, "Agreements": 4, "Grants": 5}
    return sorted(dict.fromkeys(out), key=lambda x: order.get(x, 9))


def _tags(v):
    v = _clean(v)
    items = None
    if v.startswith("["):
        try:
            items = [str(t) for t in json.loads(v)]
        except Exception:
            items = None
    if items is None:
        items = v.split(";#")
    return [t.strip() for t in items if t.strip() and not re.fullmatch(r"\d+", t.strip())]


SRC_ROWS = {}
_csv_path = ROOT / "corb" / "WarrantQA.csv"
_xlsx_path = ROOT / "CORB2" / "Warrant Board Study Group - Question and Answer List.xlsx"
if _csv_path.exists():
    with open(_csv_path, encoding="utf-8-sig") as f:
        for i, r in enumerate(_csv.DictReader(f), start=2):
            if _clean(r.get("Question")):
                SRC_ROWS[("pam-csv-legacy", i)] = {"q": r.get("Question"), "a": r.get("Answer"), "unit": _clean(r.get("SCO Location")) or "ACC-All",
                                                   "topic": _clean(r.get("Topic")), "classes": r.get("Warrant"), "tags": r.get("Topics Applicable to –")}
if _xlsx_path.exists():
    _ws = _openpyxl.load_workbook(_xlsx_path, data_only=True).active
    for i, r in enumerate(list(_ws.iter_rows(values_only=True))[1:], start=2):
        if r and any(r) and _clean(r[1]):
            SRC_ROWS[("pam-xlsx-2026-01", i)] = {"q": r[1], "a": r[2], "unit": _clean(r[5]) or "ACC-All", "topic": _clean(r[0]), "classes": r[4], "tags": r[3]}

questions = [q for q in questions if not q.get("split_from")]          # split questions are rebuilt every run
_located = {}
for q in questions:
    for s in q.get("sources", []):
        _located[(s.get("src"), s.get("row"))] = q

_groups = {}
for key, row in SRC_ROWS.items():
    q = _located.get(key)
    if q is not None and _difflib.SequenceMatcher(None, _nk(row["q"]), _nk(q["question"])).ratio() >= 0.98:
        continue
    _groups.setdefault(_nk(row["q"]), []).append((key, row, q))


def _nearest(text):
    best, score = None, 0.0
    for q in questions:
        if q.get("split_from") or not str(q["id"]).startswith("Q"):
            continue
        s = _difflib.SequenceMatcher(None, _nk(text), _nk(q["question"])).ratio()
        if s > score:
            best, score = q, s
    return best if score >= 0.85 else None


_next_n = max([int(q["id"][1:]) for q in questions if re.fullmatch(r"Q\d{4}", str(q["id"]))] + [0]) + 1
_split = []
for gkey in sorted(_groups, key=lambda k: min((0 if s == "pam-xlsx-2026-01" else 1, r) for (s, r), _, _ in _groups[k])):
    members = sorted(_groups[gkey], key=lambda m: (0 if m[0][0] == "pam-xlsx-2026-01" else 1, m[0][1]))
    for key, row, parent in members:
        if parent is None:
            continue
        parent["sources"] = [s for s in parent.get("sources", []) if (s.get("src"), s.get("row")) != key]
        a_nk = _nk(row["a"])
        parent["alt_answers"] = [a for a in parent.get("alt_answers", []) if _nk(a.get("text")) != a_nk]
        if not _open(_clean(row["a"])) and _nk(parent.get("answer")) == a_nk:
            # this row's answer had become the shown answer of the ACC-wide question: fall back to that question's own rows
            fallback = None
            for s in parent["sources"]:
                cand = SRC_ROWS.get((s.get("src"), s.get("row")))
                if cand and not _open(_clean(cand["a"])):
                    fallback = (s.get("src"), cand)
                    break
            if fallback:
                parent["answer"], parent["answer_status"], parent["answer_source"] = _clean(fallback[1]["a"]), "official", fallback[0]
            else:
                parent["answer"], parent["answer_status"], parent["answer_source"] = "", "open", ""
            parent["key_points"], parent["citations"] = [], []
            parent["rfo"] = {"status": "n/a", "crosswalk": [], "notes": ""}
            parent.pop("citations_rfo", None)
        rows_left = [SRC_ROWS[(s.get("src"), s.get("row"))] for s in parent.get("sources", []) if (s.get("src"), s.get("row")) in SRC_ROWS]
        if rows_left:
            units = list(dict.fromkeys(rr["unit"] for rr in rows_left))
            parent["units"] = units
            parent["unit"] = "411th CSB" if "411th CSB" in units else ("ACC-All" if "ACC-All" in units else units[0])
            parent["classes"] = list(dict.fromkeys(c for rr in rows_left for c in _classes(rr["classes"]))) or parent.get("classes", [])
            if parent["unit"] not in ("411th CSB", "409th CSB"):
                parent["flags"] = [fl for fl in parent.get("flags", []) if fl != "verify-locally"]
    lead = members[0][1]
    answers = []
    for key, row, _p in members:
        a = _flat(row["a"])
        if not _open(a) and _nk(a) not in [_nk(x[1]) for x in answers]:
            answers.append((key[0], a))
    blob = (_flat(lead["q"]) + " " + " ".join(a for _s, a in answers)).lower()
    abg = bool(re.search(r"\babg|bauamt|german|imcom-e", blob))
    near = _nearest(lead["q"])
    topic = lead["topic"] if lead["topic"] and lead["topic"] != "Acceptance" else "Contract Administration"
    units = list(dict.fromkeys(m[1]["unit"] for m in members))
    unit = "411th CSB" if "411th CSB" in units else units[0]
    qid = f"Q{_next_n:04d}"
    _next_n += 1
    questions.append({
        "id": qid, "question": _flat(lead["q"]),
        "answer": answers[0][1] if answers else "", "answer_status": "official" if answers else "open",
        "answer_source": answers[0][0] if answers else "",
        "deck_notes": [], "alt_answers": [{"src": s, "text": a} for s, a in answers[1:]],
        "domain": "Germany ABG-75" if abg else (near["domain"] if near else "General Contracting"),
        "topic": ("ABG-75 " + topic) if abg and "abg" not in topic.lower() else topic,
        "alt_topics": [], "tags": list(dict.fromkeys(t for m in members for t in _tags(m[1]["tags"]))),
        "classes": list(dict.fromkeys(c for m in members for c in _classes(m[1]["classes"]))) or ["I", "II", "III"],
        "unit": unit, "units": units,
        "kind": "leadership" if re.search(r"mentor|leadership|team", blob) else "knowledge",
        "sources": [{"src": m[0][0], "row": m[0][1]} for m in members],
        "citations": [], "rfo": {"status": "n/a", "crosswalk": [], "notes": ""},
        "flags": ["verify-locally"] if unit in ("411th CSB", "409th CSB") else [],
        "key_points": [], "split_from": near["id"] if near else "",
    })
    _split.append(qid)
    R(f"  {qid} <- " + ", ".join(f"{s} row {r}" for (s, r), _x, _y in members) + f" (unit {unit}; similar to {near['id'] if near else 'none'})")
byid = {q["id"]: q for q in questions}
R(f"  split out {len(_split)} questions")

R("== open-answer drafts ==")
applied = 0
for name, d in load_glob("open_drafts_*.json"):
    for item in as_list(d, "drafts", "items", "answers"):
        q = byid.get(item.get("id"))
        if not q:
            R(f"  {name}: unknown id {item.get('id')}")
            continue
        if not item.get("answer"):
            continue
        q["answer"] = item["answer"].strip()
        q["answer_status"] = "ai-draft"
        q["answer_source"] = "ai-draft-2026-09"
        q["key_points"] = item.get("key_points") or []
        if item.get("citations"):
            q["citations"] = list(dict.fromkeys(item["citations"]))
        q["rfo"] = {"status": item.get("rfo_status") or "n/a", "crosswalk": item.get("crosswalk") or [], "notes": item.get("confidence_reason", "")}
        flags = set(q.get("flags") or []) | set(item.get("flags") or []) | {"ai-drafted"}
        q["flags"] = sorted(flags)
        q["confidence"] = item.get("confidence", "")
        applied += 1
R(f"  applied {applied} drafted answers")

R("== RFO citation rewrites of official answers ==")
rw_changed, rw_seen = 0, 0
for name, d in load_glob("rfo_rewrite_*.json"):
    for item in as_list(d, "items", "rewrites"):
        q = byid.get(item.get("id"))
        if not q or q.get("answer_status") != "official":
            continue
        rw_seen += 1
        if item.get("changed") and item.get("answer"):
            q["answer"] = item["answer"].strip()
            rw_changed += 1
        pairs = [p for p in (item.get("crosswalk") or []) if p.get("old") and p.get("new")]
        status = item.get("rfo_status") or ("updated" if pairs else q.get("rfo", {}).get("status", "pending"))
        q["rfo"] = {"status": status, "crosswalk": pairs, "notes": item.get("notes", "")}
        if item.get("citations_rfo"):
            q["citations_rfo"] = list(dict.fromkeys(item["citations_rfo"]))
R(f"  rewrite records: {rw_seen}, answers changed: {rw_changed}")

R("== Korea scenarios ==")
kcount = 0
for name, d in load_glob("korea_scenarios_*.json"):
    for i, item in enumerate(as_list(d, "scenarios", "items")):
        if not item.get("question"):
            continue
        kid = item.get("id") or f"K{kcount+101}"
        if not str(kid).startswith("K"):
            kid = "K" + str(kid)
        q = {
            "id": kid, "question": item["question"].strip(), "answer": (item.get("answer") or "").strip(),
            "answer_status": "ai-draft" if item.get("answer") else "open", "answer_source": "ai-draft-2026-09" if item.get("answer") else "",
            "deck_notes": [], "alt_answers": [], "domain": item.get("domain") or "Korea, LCS & SOFA", "topic": item.get("topic") or "Korea scenario",
            "alt_topics": [], "tags": item.get("tags") or ["Korea", "Problem solving situations"], "classes": item.get("classes") or ["II", "III"],
            "unit": "411th CSB", "units": ["411th CSB"], "kind": "scenario", "sources": [{"src": "ai-authored-2026-09", "file": name}],
            "citations": list(dict.fromkeys(item.get("citations") or [])), "key_points": item.get("key_points") or [],
            "rfo": {"status": "n/a", "crosswalk": item.get("crosswalk") or [], "notes": ""},
            "flags": sorted(set(item.get("flags") or []) | {"ai-drafted", "korea-verify-cp", "verify-locally"}),
            "confidence": item.get("confidence", ""),
        }
        questions.append(q)
        kcount += 1
R(f"  added {kcount} Korea scenarios")

R("== warrant-class questions (N ids) ==")
class_mcq, ncount = [], 0
for name, d in load_glob("class_questions_*.json"):
    for item in as_list(d, "questions", "items"):
        if not item.get("question") or not str(item.get("id", "")).startswith("N") or item.get("withdrawn"):
            continue          # a reviewer withdraws an item that cannot be made right
        tags = item.get("tags") or []
        korea = any("korea" in str(t).lower() for t in tags) or item.get("domain") == "Korea, LCS & SOFA"
        flags = set(item.get("flags") or []) | {"ai-drafted"}
        if korea:
            flags |= {"korea-verify-cp"}
        unit = item.get("unit") or "ACC-All"
        q = {
            "id": item["id"], "question": item["question"].strip(), "answer": (item.get("answer") or "").strip(),
            "answer_status": "ai-draft" if item.get("answer") else "open", "answer_source": "ai-draft-2026-09" if item.get("answer") else "",
            "deck_notes": [], "alt_answers": [], "domain": item.get("domain") or "General Contracting",
            "topic": item.get("topic") or "Warrant class question", "alt_topics": [], "tags": tags,
            "classes": [c for c in ["I", "II", "III", "IV"] if c in (item.get("classes") or [])] or ["III", "IV"],
            "unit": unit, "units": [unit], "kind": item.get("kind") or "scenario",
            "sources": [{"src": "ai-authored-2026-09", "file": name}],
            "citations": list(dict.fromkeys(item.get("citations") or [])), "key_points": item.get("key_points") or [],
            "difficulty": item.get("difficulty"),
            "rfo": {"status": "updated" if item.get("crosswalk") else "n/a", "crosswalk": item.get("crosswalk") or [], "notes": item.get("confidence_reason", "")},
            "flags": sorted(flags), "confidence": item.get("confidence", ""),
        }
        questions.append(q)
        ncount += 1
        m = item.get("mcq") or {}
        opts = m.get("options") or []
        if m.get("stem") and len(opts) == 4 and sum(1 for o in opts if o.get("correct")) == 1:
            class_mcq.append({"qid": item["id"], "stem": m["stem"], "options": opts, "difficulty": m.get("difficulty") or item.get("difficulty") or 2,
                              "cite": m.get("cite") or "", "domain": q["domain"]})
R(f"  added {ncount} warrant-class questions and {len(class_mcq)} quiz items")

# ---------------- regulations: map + crosswalk + thresholds ----------------
R("== regulations ==")
regmap = load("regulations_map.json", {})
frameworks = regmap.get("frameworks") if isinstance(regmap, dict) else None
if not frameworks and isinstance(regmap, list):
    frameworks = regmap
frameworks = frameworks or []
cw_entries, cw_unchanged = [], []
for name, d in load_glob("crosswalk_*.json"):
    cw_entries += as_list(d, "entries")
    cw_unchanged += (d.get("unchanged") if isinstance(d, dict) else []) or []
seen_cw = {}
for e in cw_entries:
    if not e.get("old"):
        continue
    key = norm_cite(e["old"])
    if key not in seen_cw or (e.get("confidence") == "verified" and seen_cw[key].get("confidence") != "verified"):
        seen_cw[key] = e
crosswalk = list(seen_cw.values())
# extraction artifacts ("DFARS 20", "PGI 21", "FAR 52-245") mapped truncated citations inside questions; they are not real cites to display
crosswalk = [e for e in crosswalk if not re.match(r"^(DFARS|PGI|AFARS)\s+\d{1,2}$", str(e.get("old", "")).strip(), re.I) and "52-245" not in str(e.get("old", ""))]
thr = load("thresholds.json", {})
thresholds = as_list(thr, "thresholds") if thr else []
regulations = {"frameworks": frameworks, "crosswalk": crosswalk, "unchanged": sorted(set(cw_unchanged)), "thresholds": thresholds,
               "verified_on": (thr.get("verified_on") if isinstance(thr, dict) else None) or (regmap.get("verified_on") if isinstance(regmap, dict) else None) or TODAY,
               "notes": ((regmap.get("notes") if isinstance(regmap, dict) else "") or "")}
R(f"  frameworks={len(frameworks)} crosswalk={len(crosswalk)} unchanged={len(regulations['unchanged'])} thresholds={len(thresholds)}")

# apply crosswalk to questions' citations
updated, unver = 0, 0
for q in questions:
    cites = q.get("citations") or []
    if not cites:
        if q.get("rfo", {}).get("status") == "pending":
            q["rfo"]["status"] = "n/a"
        continue
    pairs = {(p.get("old"), p.get("new")) for p in q.get("rfo", {}).get("crosswalk", []) if p.get("old")}
    status = q.get("rfo", {}).get("status", "pending")
    any_unver = False
    new_cites = []
    for c in cites:
        e = seen_cw.get(norm_cite(c))
        if e and e.get("new") and norm_cite(e["new"]) != norm_cite(c):
            new_val = str(e["new"]).strip()
            pm = re.match(r"^(DFARS PGI|AFARS PGI|PGI|FAR|DFARS|AFARS)\b", str(c), re.I)
            if re.match(r"^\d", new_val) and pm:
                new_val = pm.group(1).upper() + " " + new_val
            pairs.add((c, new_val))
            new_cites.append(new_val)
            if e.get("confidence") == "unverified":
                any_unver = True
        else:
            new_cites.append(c)
            if e and e.get("confidence") == "unverified":
                any_unver = True
    if pairs:
        prior_status = q.get("rfo", {}).get("status", "pending")
        q["rfo"] = {"status": "unverifiable" if (any_unver or prior_status == "unverifiable") else "updated", "crosswalk": [{"old": o, "new": n} for o, n in sorted(pairs)], "notes": q.get("rfo", {}).get("notes", "")}
        if not q.get("citations_rfo"):            # the rewrite pass already supplied an authoritative list when present
            q["citations_rfo"] = list(dict.fromkeys(new_cites))
        updated += 1
        if any_unver:
            unver += 1
    elif status == "pending":
        q["rfo"]["status"] = "n/a" if not any_unver else "unverifiable"
R(f"  questions with crosswalk pairs: {updated} (unverifiable: {unver})")

# ---------------- simple modules ----------------
R("== other modules ==")
primers = []
for name, d in load_glob("primers_*.json"):
    primers += as_list(d, "primers")
R(f"  primers={len(primers)}")
mcq, mcq_qids = [], set()
for name, d in load_glob("mcq_*.json"):
    for it in as_list(d, "items", "mcq", "questions"):
        opts = it.get("options") or []
        if len(opts) == 4 and sum(1 for o in opts if o.get("correct")) == 1 and it.get("stem"):
            if it.get("qid") and it["qid"] in mcq_qids:
                R(f"  {name}: skipped a second quiz item for {it['qid']} (one per question)")
                continue
            mcq.append(it); mcq_qids.add(it.get("qid"))
mcq += class_mcq
R(f"  mcq={len(mcq)} (including {len(class_mcq)} from warrant-class questions)")


# the right answer must not give itself away by length (the quiz shuffles the options, which does not hide it)
def long_answer(right, wrong):
    return right > 1.3 * max(wrong) and right - max(wrong) >= 15


longest = 0
for it in mcq:
    right = [len(o.get("text") or "") for o in it["options"] if o.get("correct")]
    wrong = [len(o.get("text") or "") for o in it["options"] if not o.get("correct")]
    longest += right[0] > max(wrong)
    if long_answer(right[0], wrong):
        R(f"  WARNING quiz item {it.get('qid')}: the right answer is much longer than every other option")
if mcq and longest > 0.35 * len(mcq):
    R(f"  WARNING the right answer is the longest option in {longest} of {len(mcq)} quiz items; keep it near a quarter")
else:
    R(f"  quiz length check: the right answer is the longest option in {longest} of {len(mcq)} quiz items")
games = {}
GAME_KEYS = ("threshold_ladder", "fiscal_sort", "protest_clock", "clause_match", "jeopardy", "branching")
for name, d in load_glob("games_*.json"):
    if not isinstance(d, dict):
        continue
    if name.startswith("games_add_"):
        continue                  # add-on files are folded in after the base sets, below
    for k, v in d.items():
        if k in GAME_KEYS:
            games[k] = v          # later files (games_levels_*) replace earlier ones
        elif k not in ("verification_log", "review_log"):
            R(f"  ignored non-game key '{k}' in {name}")
# games_add_<set>.json: new items appended to a set (an id already present is skipped, so a base set stays authoritative)
for name, d in load_glob("games_add_*.json"):
    if not isinstance(d, dict):
        continue
    for k, v in d.items():
        if k in GAME_KEYS and isinstance(v, list):
            base = games.setdefault(k, [])
            have = {str(it.get("id")) for it in base if isinstance(it, dict)}
            added = 0
            for it in v:
                if isinstance(it, dict) and it.get("id") and str(it["id"]) not in have:
                    base.append(it); have.add(str(it["id"])); added += 1
            R(f"  {name}: added {added} to {k} (now {len(base)})")
        elif k not in ("verification_log", "review_log"):
            R(f"  ignored non-game key '{k}' in {name}")
R(f"  games keys={list(games.keys())}")
glossary = as_list(load("glossary.json", []), "glossary", "terms")
glossary = [g for g in glossary if g.get("term") and g.get("definition")]
glossary.sort(key=lambda g: g["term"].lower())
R(f"  glossary={len(glossary)}")
process = load("process.json", {})
if isinstance(process, dict):
    process.pop("verification_log", None)
R(f"  process steps={len(process.get('steps', [])) if isinstance(process, dict) else 0}")
rubric_board = load("rubric_board.json", {})
if isinstance(rubric_board, dict):
    rubric_board.pop("verification_log", None)
resources = as_list(load("resources.json", []), "resources", "links")
R(f"  resources={len(resources)}")

# ---------------- citation cosmetics ----------------
# The original extractor truncated DFARS/PGI/AFARS part numbers to two digits ("DFARS 20" for "DFARS 206.3");
# the crosswalk agents resolved those keys, but the truncated "old" text must not reach the UI.
TRUNC = re.compile(r"^(DFARS|PGI|AFARS)\s+\d{1,2}$", re.I)


def split_cites(items):
    out = []
    for c in items or []:
        prefix = ""
        for part in re.split(r"\s*;\s*|\s+/\s+", str(c)):
            part = part.strip().rstrip(".")
            if not part:
                continue
            m = re.match(r"^(RFO\s+)?(DFARS PGI|AFARS PGI|PGI|FAR|DFARS|AFARS)\b", part, re.I)
            if m:
                prefix = m.group(2).upper()
            elif re.match(r"^\d", part) and prefix:
                part = prefix + " " + part
            if part not in out:
                out.append(part)
    return out


fixed_pairs = 0
for q in questions:
    rfo = q.get("rfo") or {}
    pairs = [p for p in rfo.get("crosswalk", []) if p.get("old") and p.get("new") and not TRUNC.match(str(p["old"]).strip())]
    exp = []
    for p in pairs:
        news = split_cites([p["new"]])
        if len(news) > 1:
            for n in news:
                exp.append({"old": p["old"], "new": n})
        else:
            exp.append({"old": p["old"], "new": news[0] if news else p["new"]})
    if len(exp) != len(rfo.get("crosswalk", [])):
        fixed_pairs += 1
    rfo["crosswalk"] = exp
    q["rfo"] = rfo
    if q.get("citations_rfo"):
        q["citations_rfo"] = split_cites(q["citations_rfo"])
    q["citations"] = [c for c in (q.get("citations") or []) if not TRUNC.match(str(c).strip())]
R(f"  citation cosmetics: adjusted crosswalk lists on {fixed_pairs} questions")

# ---------------- PII scan ----------------
blob = json.dumps({"q": questions, "p": primers, "g": glossary, "pr": process, "rb": rubric_board, "rs": resources, "gm": games, "reg": regulations}, ensure_ascii=False)
emails = set(re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", blob))
emails = {e for e in emails if not e.lower().endswith(("example.com", "example.mil"))}
if emails:
    R(f"  WARNING emails found in content: {sorted(emails)[:10]}")
else:
    R("  PII scan: no email addresses in content")

# ---------------- source-list coverage report ----------------
R("== source-list coverage ==")


def _strip_updates(t):
    t = re.sub(r"(?im)^\s*cite:.*$", " ", _clean(t))
    t = re.sub(r"\([^()]*?(?:RFO|threshold updated|previously|Overhaul|deck cite)[^()]*?\)", " ", t, flags=re.I)
    return " ".join(w for w in _nk(t).split() if not re.search(r"\d", w))


def _wsim(x, y):
    """Word-level similarity. Character-level difflib on long answers trips its autojunk heuristic and under-scores near-identical text."""
    return _difflib.SequenceMatcher(None, _nk(x).split(), _nk(y).split(), autojunk=False).ratio()


_located = {}
for q in questions:
    for s in q.get("sources", []):
        _located[(s.get("src"), s.get("row"))] = q
_cov, _cov_rows = Counter(), []
for (src, row), r in sorted(SRC_ROWS.items(), key=lambda kv: (kv[0][0] != "pam-csv-legacy", kv[0][1])):
    lst = "Legacy WarrantQA CSV" if src == "pam-csv-legacy" else "PAM Q&A workbook"
    q = _located.get((src, row))
    a = _clean(r["a"])
    if not q:
        status = "MISSING"
    elif _open(a):
        status = "No answer in the list; Board Ready shows " + {"ai-draft": "a reviewed AI draft", "official": "an answer from the other list", "open": "no answer yet"}.get(q["answer_status"], q["answer_status"])
    elif _wsim(a, q.get("answer")) >= 0.8:
        status = "Shown as the answer"
    elif _difflib.SequenceMatcher(None, _strip_updates(a).split(), _strip_updates(q.get("answer")).split(), autojunk=False).ratio() >= 0.85:
        status = "Shown as the answer, citations updated to the FAR Overhaul"
    elif any(_wsim(a, x.get("text")) >= 0.8 for x in q.get("alt_answers", [])):
        status = "Shown under Other answers in the source lists"
    else:
        status = "ANSWER DIFFERS - check"
    _cov[(lst, status)] += 1
    _cov_rows.append((lst.split()[0] + " row " + str(row), q["id"] if q else "-", r["unit"], status, _flat(r["q"])[:110]))
_md = ["# Source-list coverage", "",
       f"Generated {TODAY}. Every question row in the legacy WarrantQA CSV (corb/WarrantQA.csv) and the PAM Q&A workbook, and where it lives in Board Ready.", "",
       "| List | Result | Rows |", "|---|---|---|"]
for (lst, st), n in sorted(_cov.items()):
    _md.append(f"| {lst} | {st} | {n} |")
_md += ["", "## Every row", "", "| Row | Board Ready id | Organization | Answer | Question |", "|---|---|---|---|---|"]
for row in _cov_rows:
    _md.append("| " + " | ".join(str(x).replace("|", "/").replace("\n", " ") for x in row) + " |")
(APP / "content" / "SOURCE_COVERAGE.md").write_text("\n".join(_md), encoding="utf-8")
_missing = sum(n for (l, s), n in _cov.items() if s == "MISSING")
_differs = sum(n for (l, s), n in _cov.items() if s.startswith("ANSWER DIFFERS"))
for (lst, st), n in sorted(_cov.items()):
    R(f"  {lst}: {st}: {n}")
R(f"  coverage: {sum(_cov.values())} rows checked, missing {_missing}, answers that differ {_differs}")

# ---------------- dated content patches (tools/content_patches.py) ----------------
sys.path.insert(0, str(APP / "tools"))
import content_patches
content_patches.apply({"regulations": regulations, "glossary": glossary, "primers": primers, "resources": resources})
R("  content patches applied: " + ", ".join(fn.__name__ for fn in content_patches.PATCHES))

# ---------------- write ----------------
def dump(name, obj):
    (DATA / name).write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    R(f"  wrote {name} ({(DATA / name).stat().st_size // 1024} KB)")


questions.sort(key=lambda q: (0 if q["id"].startswith("Q") else 1, q["id"]))
dump("questions.json", questions)
dump("primers.json", primers)
dump("mcq.json", mcq)
dump("games.json", games)
dump("glossary.json", glossary)
dump("process.json", process if isinstance(process, dict) else {})
dump("regulations.json", regulations)
dump("rubric_board.json", rubric_board if isinstance(rubric_board, dict) else {})
dump("resources.json", resources)
dump("korea_scenarios.json", [])  # Korea scenarios live inside questions.json (unit 411th CSB, kind scenario)

stats = Counter(q["answer_status"] for q in questions)
R(f"== bank now: {len(questions)} questions, status {dict(stats)}")
(APP / "content" / "merge_report.md").write_text("# Merge report " + TODAY + "\n\n" + "\n".join("- " + r for r in report), encoding="utf-8")
