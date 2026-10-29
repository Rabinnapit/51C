"""Build B2B Exam Prep.

  python tools/build.py

Writes:
  dist/B2B-Exam-Prep.html           offline edition: one self-contained file with no network code. This is the copy to put on
                                Teams or SharePoint, email inside a Word document (tools/make_docx.py) or open from a thumb drive.
  dist/B2B-Exam-Prep-Preview.html   preview edition for a claude.ai artifact: no outer <html> tags, no downloads, no printing.
  docs/index.html               web edition for GitHub Pages: the same app plus "install as an app" and an update notice.
  docs/B2B-Exam-Prep.html           a copy of the offline edition that the website offers for download
  docs/manifest.webmanifest, docs/sw.js, docs/icons/, docs/version.json, docs/.nojekyll
  src/index.dev.html            multi-file page for development (python -m http.server 8790 --directory src)

Content lives in src/data/*.json. A file named <module>-<part>.json is joined into <module>, in file-name order
(lists are concatenated, objects are merged), so lessons-1-principles.json and lessons-2-preaward.json become `lessons`.
Official document pages in src/official/*.webp (tools/render_official.py) are embedded as the `pages` module.

Checks: no external script, style, font or image references; one embeddedState block; the boot block is the last
script; the offline and preview editions contain no fetch, XMLHttpRequest or service worker code; size budget.
Run tools/check_content.py first to validate the content itself.
"""
import base64, json, os, re, sys, shutil, hashlib, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
DIST = ROOT / "dist"
DOCS = ROOT / "docs"
SIZE_BUDGET = 4 * 1024 * 1024

template = (SRC / "index.html").read_text(encoding="utf-8")
css_files = sorted((SRC / "css").glob("*.css")) + sorted((SRC / "css" / "views").glob("*.css"))
core_files = sorted((SRC / "js" / "core").glob("*.js"))
view_files = sorted((SRC / "js" / "views").glob("*.js"))
# the Arcade engine, shell and games load after the views; the arcade view mounts them when it renders
arcade_files = sorted((SRC / "js" / "arcade").glob("*.js")) + sorted((SRC / "js" / "arcade" / "games").glob("*.js"))
WEB_ONLY_CORE = {"09-pwa.js"}          # service worker registration and the update notice: web edition only


def js_safe(s: str) -> str:
    return s.replace("</script", "<\\/script")


def dumps_lines(obj, depth=0) -> str:
    """Compact JSON, one array element (or top-level key) per line, so no line runs to megabytes.
    Word cannot hold a multi-megabyte paragraph, and the file travels by email inside a Word document."""
    if isinstance(obj, list) and depth < 4 and obj:
        return "[\n" + ",\n".join(dumps_lines(x, depth + 1) for x in obj) + "\n]"
    if isinstance(obj, dict) and depth < 3 and obj:
        return "{\n" + ",\n".join(json.dumps(k, ensure_ascii=False) + ":" + dumps_lines(v, depth + 1) for k, v in obj.items()) + "\n}"
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def load_modules():
    mods = {}
    for f in sorted((SRC / "data").glob("*.json")):
        name = f.stem.split("-")[0]
        obj = json.loads(f.read_text(encoding="utf-8"))
        if name not in mods:
            mods[name] = obj
        elif isinstance(mods[name], list) and isinstance(obj, list):
            mods[name] = mods[name] + obj
        elif isinstance(mods[name], dict) and isinstance(obj, dict):
            mods[name] = {**mods[name], **obj}
        else:
            raise SystemExit(f"cannot join {f.name} into {name}: one is a list and the other an object")
    return mods


def load_pages():
    """Official document pages (src/official/<doc id>-<page>.webp, made by tools/render_official.py) as base64,
    cut into short lines so the Word email package never holds a giant paragraph: {doc id: [[line, ...], ...]}."""
    found = {}
    for f in (SRC / "official").glob("*.webp"):
        m = re.fullmatch(r"(.+)-(\d+)", f.stem)
        if m:
            found.setdefault(m.group(1), {})[int(m.group(2))] = f
    pages = {}
    for doc_id in sorted(found):
        nums = sorted(found[doc_id])
        if nums != list(range(1, len(nums) + 1)):
            raise SystemExit(f"src/official/{doc_id}: pages {nums} are not numbered 1..{len(nums)}")
        pages[doc_id] = []
        for n in nums:
            b64 = base64.b64encode(found[doc_id][n].read_bytes()).decode("ascii")
            pages[doc_id].append([b64[i:i + PAGE_LINE] for i in range(0, len(b64), PAGE_LINE)])
    return pages


PAGE_LINE = 8000
MODS = load_modules()
PAGES = load_pages()
META = MODS["meta"]
NOW = datetime.datetime.now()
META["built_on"] = NOW.strftime("%Y-%m-%d %H:%M")
# On GitHub Actions the website address is known: https://<owner>.github.io/<repo>/
repo = os.environ.get("GITHUB_REPOSITORY", "")
if repo and "/" in repo and not META.get("site_url"):
    owner, name = repo.split("/", 1)
    META["site_url"] = f"https://{owner.lower()}.github.io/{name}/"
CONTENT_HASH = hashlib.sha256(json.dumps(MODS, sort_keys=True, ensure_ascii=False).encode("utf-8")
                              + json.dumps(PAGES, sort_keys=True).encode("ascii")
                              + b"".join(f.read_bytes() for f in core_files + view_files + arcade_files + css_files)).hexdigest()[:10]
META["build_id"] = CONTENT_HASH
APP_FILE = re.sub(r"[^\w-]+", "-", META.get("app_name", "B2B Exam Prep")).strip("-") or "B2B-Exam-Prep"


def data_js(edition: str) -> str:
    parts = ["window.CORB_DATA = window.CORB_DATA || {};"]
    for name, obj in MODS.items():
        if name == "meta":
            obj = dict(META, edition=edition)
        parts.append(f"window.CORB_DATA[{json.dumps(name)}] = {dumps_lines(obj)};")
    parts.append(f"window.CORB_DATA[\"pages\"] = {dumps_lines(PAGES)};")
    return js_safe("\n".join(parts))


BOOT = """/* BOOT-LAST-BLOCK: must stay the final script block; it snapshots the page for "save my progress into this file" */
window.PRISTINE_HTML = "<!DOCTYPE html>\\n" + document.documentElement.outerHTML;
window.CORB.boot();
"""


def favicon_tag():
    svg = (SRC / "web" / "favicon.svg").read_text(encoding="utf-8")
    from urllib.parse import quote
    return f'<link rel="icon" href="data:image/svg+xml,{quote(svg)}">'


def assemble(edition: str, dev: bool = False) -> str:
    cores = [f for f in core_files if edition == "web" or f.name not in WEB_ONLY_CORE]
    if dev:
        v = "?v=" + CONTENT_HASH    # the dev page re-reads every file after each build instead of a cached copy
        styles = "\n".join(f'<link rel="stylesheet" href="css/{f.relative_to(SRC / "css").as_posix()}{v}">' for f in css_files)
        (SRC / "data" / "_bundle.js").write_text(data_js(edition), encoding="utf-8")
        data = f'<script src="data/_bundle.js{v}"></script>'
        core = "\n".join(f'<script src="js/core/{f.name}{v}"></script>' for f in cores)
        views = "\n".join(f'<script src="js/views/{f.name}{v}"></script>' for f in view_files)
        views += "\n" + "\n".join(f'<script src="{f.relative_to(SRC).as_posix()}{v}"></script>' for f in arcade_files)
    else:
        styles = "\n".join(f'<style data-src="{f.name}">\n{f.read_text(encoding="utf-8")}\n</style>' for f in css_files)
        data = f'<script data-src="data">\n{data_js(edition)}\n</script>'
        core = "\n".join(f'<script data-src="{f.name}">\n{js_safe(f.read_text(encoding="utf-8"))}\n</script>' for f in cores)
        views = "\n".join(f'<script data-src="{f.name}">\n{js_safe(f.read_text(encoding="utf-8"))}\n</script>' for f in view_files + arcade_files)
    webhead = ""
    if edition == "web":
        webhead = ('<link rel="manifest" href="manifest.webmanifest">\n'
                   '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
                   '<meta name="apple-mobile-web-app-capable" content="yes">\n'
                   '<meta name="mobile-web-app-capable" content="yes">')
    if edition == "preview":
        webhead = '<meta name="claude:viewport-fit-sides" content="cover">'
    html = (template.replace("<!--@icon-->", favicon_tag()).replace("<!--@webhead-->", webhead)
            .replace("<!--@styles-->", styles).replace("<!--@data-->", data).replace("<!--@core-->", core)
            .replace("<!--@views-->", views).replace("<!--@boot-->", f'<script data-src="boot">\n{BOOT}\n</script>'))
    if edition == "preview":
        # an artifact page is wrapped in its own document skeleton at publish time
        html = re.sub(r"<!DOCTYPE html>\s*", "", html, count=1)
        html = re.sub(r"<html[^>]*>\s*<head>\s*", "", html, count=1)
        html = html.replace("</head>\n<body>\n", "", 1)
        html = re.sub(r"\s*</body>\s*</html>\s*$", "\n", html)
        # the <title> must sit in the first 8 KB: move title and description above the charset/viewport metas
        m = re.search(r"<title>.*?</title>", html)
        if m:
            html = m.group(0) + "\n" + html.replace(m.group(0), "", 1)
    return html


def check(html: str, edition: str):
    problems = []
    for m in re.finditer(r"<(script|link|img|iframe|source|audio|video)[^>]+(src|href)=\"(https?:)?//[^\"]+\"", html):
        problems.append("external resource: " + m.group(0)[:120])
    if re.search(r"@import\s+url\(\s*['\"]?https?:", html) or re.search(r"url\(\s*['\"]?https?://", html):
        problems.append("external url() in CSS")
    if "<!--@" in html:
        problems.append("unexpanded template placeholder")
    if html.count('<script id="embeddedState" type="application/json">') != 1:
        problems.append("embeddedState block missing or duplicated")
    last = html.rfind("<script")
    if "BOOT-LAST-BLOCK" not in html[last:]:
        problems.append("boot block is not the last script block")
    if edition in ("offline", "preview"):
        for needle in ("fetch(", "XMLHttpRequest", "sendBeacon", "new WebSocket", "serviceWorker.register"):
            if needle in html:
                problems.append(f"{edition}: '{needle}' found; network code belongs in core/09-pwa.js (web edition only)")
    if edition == "preview" and "<title>" not in html[:8192]:
        problems.append("preview: <title> is not in the first 8 KB")
    if len(html.encode("utf-8")) > SIZE_BUDGET:
        problems.append(f"size {len(html.encode('utf-8'))/1024/1024:.2f} MB is over the {SIZE_BUDGET/1024/1024:.0f} MB budget")
    return problems


def write_web_assets():
    DOCS.mkdir(exist_ok=True)
    (DOCS / ".nojekyll").write_text("", encoding="utf-8")
    icons = DOCS / "icons"
    if icons.exists():
        shutil.rmtree(icons)
    shutil.copytree(SRC / "web" / "icons", icons)
    sw = (SRC / "web" / "sw.js").read_text(encoding="utf-8").replace("__BUILD_ID__", CONTENT_HASH)
    (DOCS / "sw.js").write_text(sw, encoding="utf-8")
    manifest = {
        "name": META.get("app_name", "B2B Exam Prep"),
        "short_name": META.get("short_name", "B2B Exam Prep"),
        "description": META.get("description", ""),
        "start_url": "./",
        "scope": "./",
        "display": "standalone",
        "orientation": "any",
        "background_color": "#f3f5f1",
        "theme_color": "#1f5e46",
        "icons": [
            {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    (DOCS / "manifest.webmanifest").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    latest = (MODS.get("updates") or {}).get("guide_changes", [{}])
    version = {"app": META.get("app_name"), "version": META.get("version"), "build_id": CONTENT_HASH, "built_on": META["built_on"],
               "content_verified_on": META.get("content_verified_on"), "latest_change": (latest[0] if latest else {})}
    (DOCS / "version.json").write_text(json.dumps(version, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    DIST.mkdir(exist_ok=True)
    outputs = {
        "offline": DIST / f"{APP_FILE}.html",
        "preview": DIST / f"{APP_FILE}-Preview.html",
        "web": DOCS / "index.html",
    }
    problems = []
    for edition, out in outputs.items():
        out.parent.mkdir(parents=True, exist_ok=True)
        html = assemble(edition)
        out.write_text(html, encoding="utf-8")
        problems += [f"{edition}: {p}" for p in check(html, edition)]
        print(f"{edition:8} {out.relative_to(ROOT)}  {out.stat().st_size/1024/1024:.2f} MB")
    shutil.copyfile(outputs["offline"], DOCS / f"{APP_FILE}.html")
    write_web_assets()
    dev = SRC / "index.dev.html"
    dev.write_text(assemble("offline", dev=True), encoding="utf-8")
    print(f"dev      {dev.relative_to(ROOT)}")
    print(f"build {CONTENT_HASH} · modules: " + ", ".join(f"{k}({len(v) if isinstance(v, (list, dict)) else 1})" for k, v in MODS.items()))
    if META.get("site_url"):
        print("site_url:", META["site_url"])
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("OK: all editions pass the checks")
