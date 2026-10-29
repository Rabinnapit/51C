"""Build the single-file app, in three files, and the web edition.
  python tools/build.py            -> dist/<AppName>.html                    full edition: candidates, board members, facilitators
                                      dist/<AppName>-Candidate.html          candidate edition: study only
                                      dist/<AppName>-Candidate-Offline.html  candidate edition without the AI connector
                                      dist/web/                               web edition for GitHub Pages: the candidate edition plus
                                                                              core/09-pwa.js (install page, service worker, update bar),
                                                                              manifest, icons, version.json and the files above as downloads
                                      src/index.dev.html                      multi-file full edition, for local preview
The candidate edition leaves out the board console, study group projector, Board Jeopardy and content editor, and
sets meta.edition = "candidate" so the app hides role switching, projector mode and the board room passcode.
The offline candidate edition also leaves out core/06b-connector-network.js (the AI connector and the app's only fetch),
so the app's own code makes no network requests; the mentor answers from the embedded content only.
Checks: no external script/style/font references, size budget, every referenced file present.
"""
import json, os, re, sys, datetime, hashlib, shutil
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
SRC = APP / "src"
# CORB_DIST builds into another folder and CORB_QUICK builds only the offline candidate edition there, so several
# people (or agents) can test their own changes at once without touching dist/ or the dev copies.
DIST = Path(os.environ["CORB_DIST"]) if os.environ.get("CORB_DIST") else APP / "dist"
DIST.mkdir(parents=True, exist_ok=True)

template = (SRC / "index.html").read_text(encoding="utf-8")
meta = json.loads((SRC / "data" / "meta.json").read_text(encoding="utf-8"))
meta["built_on"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
app_name = re.sub(r"[^\w-]+", "", meta.get("app_name", "CORB-App")) or "CORB-App"

css_files = sorted((SRC / "css").glob("*.css")) + sorted((SRC / "css" / "views").glob("*.css"))
data_files = sorted((SRC / "data").glob("*.json"))
core_files = sorted((SRC / "js" / "core").glob("*.js"))
view_files = sorted((SRC / "js" / "views").glob("*.js"))
# The Arcade ships inside the same file: its styles after the app's, its scripts after the views and before boot.
_ARC = SRC / "arcade"
ARCADE_CSS = sorted((_ARC / "css").glob("*.css")) if (_ARC / "css").exists() else []
ARCADE_JS = (sorted((_ARC / "js" / "core").glob("*.js")) + [_ARC / "js" / "app.js"] + sorted((_ARC / "js" / "games").glob("*.js"))) if (_ARC / "js" / "app.js").exists() else []
# Every edition carries the same build id (content and code), so the web edition can tell a newer build from the one it has.
BUILD_ID = hashlib.sha256(b"".join(f.read_bytes() for f in data_files + core_files + view_files + css_files + ARCADE_CSS + ARCADE_JS)).hexdigest()[:10]
meta["build_id"] = BUILD_ID
# On GitHub Actions the website address is known: https://<owner>.github.io/<repo>/boardready/
_repo = os.environ.get("GITHUB_REPOSITORY", "")
if _repo and "/" in _repo and not meta.get("site_url"):
    _owner, _name = _repo.split("/", 1)
    meta["site_url"] = f"https://{_owner.lower()}.github.io/{_name}/boardready/"
WEB = SRC / "web"
WEB_ONLY_CORE = {"09-pwa.js"}      # install page, service worker and update bar: web edition only
WEB_ONLY_CSS = {"install.css"}
WEBHEAD = ('<link rel="manifest" href="manifest.webmanifest">\n'
           '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
           '<meta name="apple-mobile-web-app-capable" content="yes">\n'
           '<meta name="mobile-web-app-capable" content="yes">\n'
           '<meta name="apple-mobile-web-app-title" content="Board Ready">\n'
           '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n'
           '<meta name="theme-color" content="#0e121a" media="(prefers-color-scheme: dark)">')


def favicon_tag() -> str:
    f = WEB / "favicon.svg"
    if not f.exists():
        return ""
    from urllib.parse import quote
    return f'<link rel="icon" href="data:image/svg+xml,{quote(f.read_text(encoding="utf-8"))}">'


def js_safe(s: str) -> str:
    return s.replace("</script", "<\\/script")


def dumps_lines(obj, depth=0) -> str:
    """Compact JSON, but one array element (or top-level key) per line so no line runs to megabytes.
    Word documents used to email the file cannot hold a single multi-megabyte paragraph."""
    if isinstance(obj, list) and depth < 4 and obj:
        return "[\n" + ",\n".join(dumps_lines(x, depth + 1) for x in obj) + "\n]"
    if isinstance(obj, dict) and depth < 3 and obj:
        return "{\n" + ",\n".join(json.dumps(k, ensure_ascii=False) + ":" + dumps_lines(v, depth + 1) for k, v in obj.items()) + "\n}"
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


CANDIDATE_VIEWS_OUT = {"board.js", "projector.js", "jeopardy.js", "editor.js"}
CANDIDATE_CSS_OUT = {"board.css", "projector.css", "jeopardy.css", "editor.css"}
EDITIONS = {
    "full": {"file": f"{app_name}.html", "edition": "full", "views_out": set(), "css_out": set(), "core_out": set()},
    "candidate": {"file": f"{app_name}-Candidate.html", "edition": "candidate",
                  "views_out": CANDIDATE_VIEWS_OUT, "css_out": CANDIDATE_CSS_OUT, "core_out": set()},
    "offline": {"file": f"{app_name}-Candidate-Offline.html", "edition": "candidate",
                "views_out": CANDIDATE_VIEWS_OUT, "css_out": CANDIDATE_CSS_OUT, "core_out": {"06b-connector-network.js"}},
    # the web edition: the candidate edition (with the AI connector) plus the install page, service worker and update bar
    "web": {"file": "web/index.html", "edition": "candidate", "views_out": CANDIDATE_VIEWS_OUT, "css_out": CANDIDATE_CSS_OUT, "core_out": set(), "web": True},
}


KO_CLASSES = ["I", "II", "III", "IV"]
# Topic corrections from the source lists' classification: a BPA is a simplified acquisition vehicle, not a grant or an
# agreement; the two ACC-Warren rows ask about grants and assistance instruments. The Quiz and the Arcade leave grants
# topics out for the 411th CSB, so the topic has to be right.
DOMAIN_FIX = {"Q0105": "Acquisition Planning & Contract Types", "Q0225": "Grants & Agreements", "Q0227": "Grants & Agreements"}


def off_track_ids() -> set:
    """Korea has no Grants or Agreements officers, so questions tagged only for those tracks, and their quiz items, stay
    out of the app. src/data keeps them so every source-list row is still traced in content/SOURCE_COVERAGE.md."""
    qs = json.loads((SRC / "data" / "questions.json").read_text(encoding="utf-8"))
    return {q["id"] for q in qs if q.get("classes") and not any(c in KO_CLASSES for c in q["classes"])}


def data_js(edition: str = "full", web: bool = False) -> str:
    parts = ["window.CORB_DATA = window.CORB_DATA || {};"]
    off_track = off_track_ids()
    for f in data_files:
        name = f.stem
        obj = json.loads(f.read_text(encoding="utf-8"))
        if name == "meta":
            obj = dict(meta, edition=edition, web=web)
        elif name == "questions":   # a mixed tag keeps only its contracting officer classes; study-group notes are not shipped
            obj = [dict({k: v for k, v in q.items() if k != "deck_notes"}, classes=[c for c in q.get("classes") or [] if c in KO_CLASSES],
                        domain=DOMAIN_FIX.get(q.get("id"), q.get("domain")))
                   for q in obj if q.get("id") not in off_track]
        elif name == "mcq":
            obj = [dict(m, domain=DOMAIN_FIX[m["qid"]]) if m.get("qid") in DOMAIN_FIX else m for m in obj if m.get("qid") not in off_track]
        parts.append(f'window.CORB_DATA[{json.dumps(name)}] = {dumps_lines(obj)};')
    return js_safe("\n".join(parts))


BOOT = """/* BOOT-LAST-BLOCK — must remain the final script block: it snapshots the page for "save a copy" */
window.PRISTINE_HTML = "<!DOCTYPE html>\\n" + document.documentElement.outerHTML;
window.CORB.boot();
"""


def build_dist(edition: str = "full"):
    ed = EDITIONS[edition]
    web = bool(ed.get("web"))
    css = [f for f in css_files if not (f.parent.name == "views" and (f.name in ed["css_out"] or (f.name in WEB_ONLY_CSS and not web)))]
    views_in = [f for f in view_files if f.name not in ed["views_out"]]
    core_out = set(ed["core_out"]) | (set() if web else WEB_ONLY_CORE)
    styles = "\n".join(f"<style data-src=\"{f.name}\">\n{f.read_text(encoding='utf-8')}\n</style>" for f in css + ARCADE_CSS)
    data = f"<script data-src=\"data\">\n{data_js(ed['edition'], web)}\n</script>"
    core = "\n".join(f"<script data-src=\"{f.name}\">\n{js_safe(f.read_text(encoding='utf-8'))}\n</script>" for f in core_files if f.name not in core_out)
    views = "\n".join(f"<script data-src=\"{f.name}\">\n{js_safe(f.read_text(encoding='utf-8'))}\n</script>" for f in views_in + ARCADE_JS)
    boot = f"<script data-src=\"boot\">\n{BOOT}\n</script>"
    html = (template.replace("<!--@icon-->", favicon_tag()).replace("<!--@webhead-->", WEBHEAD if web else "")
            .replace("<!--@styles-->", styles).replace("<!--@data-->", data).replace("<!--@core-->", core).replace("<!--@views-->", views).replace("<!--@boot-->", boot))
    name = meta.get("app_name", "Board Ready")
    if ed["edition"] == "candidate":
        html = re.sub(r"<title>[^<]*</title>", f"<title>{name} · Candidate edition</title>", html, count=1)
        html = html.replace(", mentor, games, and board-member tools.", ", mentor and games, for warrant candidates.")
    else:
        html = html.replace("<title>Board Ready", f"<title>{name}")
    out = DIST / ed["file"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out, html


def write_web_assets(built):
    """Beside dist/web/index.html: the manifest, the service worker (with this build's id), the icons, version.json for the
    update check, .nojekyll, and the single-file editions as downloads. tools/publish_site.py copies the folder into the
    repository's docs/boardready, which GitHub Pages serves."""
    out = DIST / "web"
    out.mkdir(parents=True, exist_ok=True)
    (out / ".nojekyll").write_text("", encoding="utf-8")
    icons = out / "icons"
    if icons.exists():
        shutil.rmtree(icons)
    if (WEB / "icons").exists():
        shutil.copytree(WEB / "icons", icons)
    # the QR code and the install sheet (tools/make_handout.py), served beside the app at handout/
    hand, dest = APP / "handout", out / "handout"
    if dest.exists():
        shutil.rmtree(dest)
    if hand.exists():
        dest.mkdir()
        for f in sorted(hand.iterdir()):
            if f.is_file() and f.suffix.lower() in (".html", ".svg", ".png", ".pdf"):
                shutil.copyfile(f, dest / f.name)
    (out / "sw.js").write_text((WEB / "sw.js").read_text(encoding="utf-8").replace("__BUILD_ID__", BUILD_ID), encoding="utf-8")
    manifest = {
        "name": meta.get("app_name", "Board Ready"), "short_name": meta.get("app_name", "Board Ready"),
        "description": "Study app for the Army contracting officer warrant board: board questions, flashcards, quiz, mock board, mentor and games. Works offline.",
        "id": "./", "lang": "en", "categories": ["education"],
        "start_url": "./", "scope": "./", "display": "standalone", "orientation": "any",
        "background_color": "#f6f4ee", "theme_color": "#173a6b",
        "icons": [
            {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
        # long-press the icon on Android or right-click it on a computer: straight into practice
        "shortcuts": [
            {"name": "Quiz", "url": "./#/quiz?start=1", "icons": [{"src": "icons/icon-192.png", "sizes": "192x192"}]},
            {"name": "Flashcards", "url": "./#/flashcards", "icons": [{"src": "icons/icon-192.png", "sizes": "192x192"}]},
            {"name": "Mock board", "url": "./#/mockboard", "icons": [{"src": "icons/icon-192.png", "sizes": "192x192"}]},
            {"name": "Question library", "url": "./#/library", "icons": [{"src": "icons/icon-192.png", "sizes": "192x192"}]},
        ],
        # lets Chrome on Android answer navigator.getInstalledRelatedApps() for this very app
        "related_applications": [{"platform": "webapp", "url": (meta.get("site_url") or "").rstrip("/") + "/manifest.webmanifest"}],
    }
    (out / "manifest.webmanifest").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    version = {"app": meta.get("app_name"), "version": meta.get("version"), "build_id": BUILD_ID, "built_on": meta["built_on"],
               "content_verified_on": meta.get("content_verified_on")}
    (out / "version.json").write_text(json.dumps(version, indent=2, ensure_ascii=False), encoding="utf-8")
    downloads = out / "downloads"
    downloads.mkdir(exist_ok=True)
    for ed, (path, _html) in built.items():
        if ed != "web":
            shutil.copyfile(path, downloads / path.name)
    return out


def build_dev():
    styles = "\n".join([f'<link rel="stylesheet" href="css/{f.relative_to(SRC / "css").as_posix()}">' for f in css_files if f.name not in WEB_ONLY_CSS] + [f'<link rel="stylesheet" href="{f.relative_to(SRC).as_posix()}">' for f in ARCADE_CSS])
    (SRC / "data" / "_bundle.js").write_text(data_js(), encoding="utf-8")
    data = '<script src="data/_bundle.js"></script>'
    core = "\n".join(f'<script src="js/core/{f.name}"></script>' for f in core_files if f.name not in WEB_ONLY_CORE)
    views = "\n".join([f'<script src="js/views/{f.name}"></script>' for f in view_files] + [f'<script src="{f.relative_to(SRC).as_posix()}"></script>' for f in ARCADE_JS])
    boot = f"<script>\n{BOOT}\n</script>"
    html = (template.replace("<!--@icon-->", favicon_tag()).replace("<!--@webhead-->", "")
            .replace("<!--@styles-->", styles).replace("<!--@data-->", data).replace("<!--@core-->", core).replace("<!--@views-->", views).replace("<!--@boot-->", boot))
    out = SRC / "index.dev.html"
    out.write_text(html, encoding="utf-8")
    return out


def check(html: str):
    problems = []
    for m in re.finditer(r"<(script|link|img|iframe)[^>]+(src|href)=\"(https?:)?//[^\"]+\"", html):
        problems.append("external resource: " + m.group(0)[:120])
    if re.search(r"@import\s+url\(\s*['\"]?https?:", html):
        problems.append("@import of an external stylesheet")
    if "<!--@" in html:
        problems.append("unexpanded template placeholder")
    if html.count('<script id="embeddedState" type="application/json">') != 1:
        problems.append("embeddedState block missing or duplicated")
    if not html.rstrip().endswith("</html>"):
        problems.append("file does not end with </html>")
    last_script = html.rfind("<script")
    if "BOOT-LAST-BLOCK" not in html[last_script:]:
        problems.append("boot block is not the last script block")
    return problems


ARC = SRC / "arcade"
ARC_BOOT = """/* ARCADE-BOOT */
window.ARCADE.boot();
"""


def arcade_data_js() -> str:
    """Subset of the content the games need."""
    def load(name):
        p = SRC / "data" / f"{name}.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
    games = load("games") or {}
    regs = load("regulations") or {}
    # Every organization's questions are included, Germany (409th CSB) too. Each quiz item carries its source question's
    # contracting-officer warrant classes (I-IV) so the Arcade can filter by warrant. Items whose source question is only
    # for Agreements or Grants officers are left out, as in the main app.
    qs = load("questions") or []
    ko = ["I", "II", "III", "IV"]
    qclass = {q["id"]: ([c for c in ko if c in (q.get("classes") or [])], bool(q.get("classes"))) for q in qs}
    mcq = []
    for m in (load("mcq") or []):
        cls, tagged = qclass.get(m.get("qid"), (None, False))
        if tagged and not cls:
            continue          # Agreements- or Grants-only
        item = dict(m)
        if cls:
            item["classes"] = cls
        mcq.append(item)

    # same rules as crosswalkDifficulty() in src/js/views/arcade.js (the shipped app computes it there)
    cite_rx = re.compile(r"^(?:RFO\s+)?(DFARS PGI|AFARS PGI|PGI|FAR|DFARS|AFARS)\s+(?:Part\s+|Subpart\s+)?(\d+)(?:\.(\d+))?(.*)$", re.I)

    def parse_cite(c):
        m = cite_rx.match(str(c or "").strip())
        return (m.group(1).upper(), m.group(2), m.group(3) or "", re.sub(r"\(.*$", "", m.group(4) or "").strip()) if m else None

    def cw_difficulty(old, new):
        a, b = parse_cite(old), parse_cite(new)
        if not a or not b or a[0] != b[0] or a[1] != b[1]:
            return 3
        if not a[2] or not b[2] or a[2] == b[2] or a[2][0] == b[2][0]:
            return 1
        return 2 if a[3] == b[3] else 3
    part_classes = {13: ["I", "II"], 14: ["II", "III", "IV"], 15: ["II", "III", "IV"], 30: ["III", "IV"], 34: ["III", "IV"], 44: ["III", "IV"]}

    def cw_classes(old, new):   # same rules as crosswalkClasses() in src/js/views/arcade.js
        c = parse_cite(new) or parse_cite(old)
        if not c:
            return None
        part = int(c[1])
        if c[0].startswith("AFARS"):
            part -= 5100
        elif c[0].startswith("DFARS") or c[0] == "PGI":
            part -= 200
        if part == 17 and c[2][:1] == "1":
            return ["III", "IV"]
        return part_classes.get(part)
    trunc = re.compile(r"^(DFARS|PGI|AFARS)\s+\d{1,2}$", re.I)
    crosswalk = []
    for e in regs.get("crosswalk", []):
        if not (e.get("confidence") == "verified" and e.get("old") and e.get("new")) or trunc.match(str(e["old"]).strip()) or "52-245" in str(e["old"]):
            continue
        pair = {"old": e.get("old"), "new": e.get("new"), "title": e.get("title", ""), "note": (e.get("note") or "")[:220], "difficulty": cw_difficulty(e.get("old"), e.get("new"))}
        cls = cw_classes(e.get("old"), e.get("new"))
        if cls:
            pair["classes"] = cls
        crosswalk.append(pair)
    thresholds = [{k: t.get(k) for k in ("id", "name", "value", "value_number", "applies", "cite")} for t in regs.get("thresholds", [])]
    # the question bank as the app hands it to the Arcade (src/js/views/arcade.js arcadeData): Class I to IV items only
    bank = [{"id": q["id"], "question": q.get("question", ""), "answer": q.get("answer") or "", "status": q.get("answer_status") or "",
             "key_points": q.get("key_points") or [], "cites": (q.get("citations_rfo") or q.get("citations") or []), "domain": q.get("domain") or "",
             "topic": q.get("topic") or "", "kind": q.get("kind") or "knowledge", "classes": [c for c in (q.get("classes") or []) if c in ko],
             "difficulty": q.get("difficulty"), "flags": q.get("flags") or []}
            for q in qs if q.get("id") and q.get("question") and not (q.get("classes") and not qclass.get(q["id"], ([], False))[0])]
    payload = {
        "meta": {"app_name": meta.get("app_name"), "main_file": f"{app_name}.html", "version": meta.get("version"), "built_on": meta["built_on"], "content_verified_on": meta.get("content_verified_on")},
        "games": games, "mcq": mcq, "crosswalk": crosswalk, "thresholds": thresholds, "questions": bank,
    }
    return js_safe("window.ARCADE_DATA = " + dumps_lines(payload) + ";")


def build_arcade():
    if not (ARC / "index.html").exists():
        return None, ""
    tpl = (ARC / "index.html").read_text(encoding="utf-8")
    css_list = [SRC / "css" / "00-fonts.css"] + sorted((ARC / "css").glob("*.css"))
    core_list = sorted((ARC / "js" / "core").glob("*.js")) + [ARC / "js" / "app.js"]
    game_list = sorted((ARC / "js" / "games").glob("*.js")) if (ARC / "js" / "games").exists() else []
    styles = "\n".join(f"<style data-src=\"{f.name}\">\n{f.read_text(encoding='utf-8')}\n</style>" for f in css_list)
    data = f"<script data-src=\"arcade-data\">\n{arcade_data_js()}\n</script>"
    core = "\n".join(f"<script data-src=\"{f.name}\">\n{js_safe(f.read_text(encoding='utf-8'))}\n</script>" for f in core_list)
    games = "\n".join(f"<script data-src=\"{f.name}\">\n{js_safe(f.read_text(encoding='utf-8'))}\n</script>" for f in game_list)
    boot = f"<script data-src=\"boot\">\n{ARC_BOOT}\n</script>"
    html = tpl.replace("<!--@styles-->", styles).replace("<!--@data-->", data).replace("<!--@core-->", core).replace("<!--@games-->", games).replace("<!--@boot-->", boot)
    html = html.replace("<title>Board Ready Arcade</title>", f"<title>{meta.get('app_name', 'Board Ready')} Arcade</title>")
    out = ARC / "index.standalone.html"   # the Arcade on its own, for development only; the shipped app embeds it
    out.write_text(html, encoding="utf-8")
    # dev version (multi-file)
    (ARC / "data").mkdir(exist_ok=True)
    (ARC / "data" / "_bundle.js").write_text(arcade_data_js(), encoding="utf-8")
    dev_styles = "\n".join(f'<link rel="stylesheet" href="{"../css/00-fonts.css" if f.name == "00-fonts.css" else "css/" + f.name}">' for f in css_list)
    dev_html = tpl.replace("<!--@styles-->", dev_styles).replace("<!--@data-->", '<script src="data/_bundle.js"></script>') \
        .replace("<!--@core-->", "\n".join(f'<script src="js/{"core/" + f.name if f.parent.name == "core" else f.name}"></script>' for f in core_list)) \
        .replace("<!--@games-->", "\n".join(f'<script src="js/games/{f.name}"></script>' for f in game_list)) \
        .replace("<!--@boot-->", f"<script>\n{ARC_BOOT}\n</script>")
    (ARC / "index.dev.html").write_text(dev_html, encoding="utf-8")
    return out, html


if __name__ == "__main__":
    if os.environ.get("CORB_QUICK"):
        q_out, q_html = build_dist("offline")
        q_probs = check(q_html)
        print(f"quick build (offline candidate edition): {q_out} ({q_out.stat().st_size/1024/1024:.2f} MB)")
        for p in q_probs:
            print("  PROBLEM:", p)
        sys.exit(1 if q_probs else 0)
    built = {ed: build_dist(ed) for ed in EDITIONS}
    out, html = built["full"]
    web_dir = write_web_assets(built)
    dev = build_dev()
    arc_out, arc_html = build_arcade()
    for stale in (DIST / "BoardReady-Arcade.html", DIST / f"{app_name}-Arcade.html"):
        if stale.exists():
            stale.unlink()
    if arc_out:
        arc_probs = [p for p in check(arc_html) if "embeddedState" not in p and "boot block" not in p]
        if "ARCADE-BOOT" not in arc_html[arc_html.rfind("<script"):]:
            arc_probs.append("arcade boot block is not the last script block")
        print(f"arcade standalone dev copy: {arc_out} ({arc_out.stat().st_size/1024/1024:.2f} MB), games={len(sorted((ARC / 'js' / 'games').glob('*.js')) if (ARC / 'js' / 'games').exists() else [])}")
        if arc_probs:
            print("ARCADE PROBLEMS:")
            for p in arc_probs:
                print("  -", p)
            sys.exit(1)
    probs = []
    for ed, (ed_out, ed_html) in built.items():
        probs += [f"{ed}: {p}" for p in check(ed_html)]
        size = ed_out.stat().st_size
        print(f"dist ({ed} edition): {ed_out} ({size/1024/1024:.2f} MB)")
        if size > 5 * 1024 * 1024:
            probs.append(f"{ed}: size {size/1024/1024:.2f} MB exceeds the 5 MB budget")
        if EDITIONS[ed]["edition"] == "candidate":
            for view_id in ("board", "projector", "jeopardy", "editor"):
                if re.search(r"registerView\(\{\s*id: '" + view_id + "'", ed_html):
                    probs.append(f"{ed}: the {view_id} view is still in the file")
            if '"edition":"candidate"' not in ed_html.replace(" ", ""):
                probs.append(f"{ed}: meta.edition is not set")
        if ed == "offline":   # the file must not be able to contact a server
            for needle in ("fetch(", "XMLHttpRequest", "sendBeacon", "new WebSocket", "CORE-06B-CONNECTOR-NETWORK"):
                if needle in ed_html:
                    probs.append(f"offline: {needle} is still in the file")
        if ed == "web":
            if "CORE-09-PWA" not in ed_html or '"web":true' not in ed_html.replace(" ", ""):
                probs.append("web: the install page module or the web flag is missing")
        else:   # a single file never registers a service worker or shows the install page
            for needle in ("CORE-09-PWA", "serviceWorker.register"):
                if needle in ed_html:
                    probs.append(f"{ed}: {needle} is in the file")
    print(f"web:  {web_dir} (manifest, sw.js build {BUILD_ID}, icons, version.json, downloads/, handout/)")
    print(f"dev:  {dev}")
    print(f"css={len(css_files)} data={len(data_files)} core={len(core_files)} views={len(view_files)}")
    for f in data_files:
        print(f"  data/{f.name}: {f.stat().st_size//1024} KB")
    if probs:
        print("PROBLEMS:")
        for p in probs:
            print("  -", p)
        sys.exit(1)
    print("OK: single-file build passes checks")
