"""Assemble the Board Ready website folder from a finished build.

  python tools/build.py && python tools/make_docx.py && python tools/publish_site.py [target]

Copies dist/web/ (the web edition, manifest, service worker, icons, version.json and the single-file downloads) and the
Word packages in dist/docx/ into the target folder. The default target is <repository>/docs/boardready, the folder the
51C repository's GitHub Pages workflow uploads, so the app is served at https://<owner>.github.io/51C/boardready/.
CORB_SITE_DIR overrides the target. Nothing in the target is kept: it is rebuilt from scratch every time.
"""
import os, shutil, sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
WEB = APP / "dist" / "web"
DOCX = APP / "dist" / "docx"
target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(os.environ.get("CORB_SITE_DIR") or (APP.parent / "docs" / "boardready"))

if not (WEB / "index.html").exists():
    raise SystemExit(f"missing {WEB / 'index.html'}; run tools/build.py first")
if target.exists():
    shutil.rmtree(target)
shutil.copytree(WEB, target)
downloads = target / "downloads"
downloads.mkdir(exist_ok=True)
n = 0
for f in sorted(DOCX.glob("*.docx")) if DOCX.exists() else []:
    shutil.copyfile(f, downloads / f.name)
    n += 1
total = sum(p.stat().st_size for p in target.rglob("*") if p.is_file())
print(f"site: {target} ({total / 1024 / 1024:.1f} MB, {n} Word documents in downloads/)")
for p in sorted(target.rglob("*")):
    if p.is_file():
        print(f"  {p.relative_to(target).as_posix():48s} {p.stat().st_size / 1024:8.0f} KB")
