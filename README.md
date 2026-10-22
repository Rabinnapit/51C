# B2B Guide

**From day one to certified.** A plain-language guide for brand-new Army 51C contracting NCOs and 1102 contract
specialists working toward the **DoW Contracting Professional certification** (Back-to-Basics): a dated plan, the rules,
every course, lessons, practice exams, flashcards, games, a glossary and a FAR reference, in one file that works offline.

Unofficial training aid. Not endorsed by the U.S. Army, the Department of War or the Warfighting Acquisition University
(WarU, formerly DAU). Content checked 22 October 2026.

## What is inside (version 0.9.0)

| Area | What the reader gets |
|---|---|
| Home and My plan | Three setup questions (51C / 1102 / mentor, start date, goal), then a dated checklist from week one to certified, with a timeline from start to the 36-month deadline. Exports to Outlook (.ics) and prints. |
| Certification 101 | The requirements (5 courses, 1 exam, 12 months), the course order, AITAS sign-up steps, the exam facts and its official 150-question blueprint, test-day and retake rules, an experience checklist, continuous learning, credentials, reciprocity, 15 FAQs and dated sources. |
| Courses | 19 courses: the five required (CON 1100V, 1200V, 1300V, 7300V, 1400V), the five online modules required before CON 1300V, exam and prep (CON 3910, 3900V, 3990V) and recommended courses for 51Cs. Each with format, length, prerequisites, what you learn, how to prepare and how to do well, plus "My status". |
| Lessons | 35 plain-English lessons organized like the exam (Guiding Principles, Pre-Award, Award, Post-Award, plus on-the-job topics such as contingency contracting for 51Cs), each with an example, a memory aid, common mistakes, RFO citations and "Check yourself" questions. |
| How-to guides | 13 step-by-step checklists: first week, registering in AITAS, scheduling the exam, applying for certification, a simplified buy, price reasonableness, market research, unauthorized commitments, modifications, options, closeout, finding things in the FAR, and protests. |
| Practice test | 197 exam-style questions, every answer explained with a citation. Quick 10, practice by exam area, missed-question review, and a timed exam simulator weighted like CON 3990V. |
| Flashcards | 10 decks with spaced repetition: FAR part titles (the 20 on the exam and all 53), acronyms, key terms, key numbers, deadlines, courses, certification facts, roles and contract types. |
| Games | FAR Part Match, Which phase?, Threshold check, Who carries the risk? |
| Look it up | Glossary of 243 terms (any acronym in the guide can be tapped for its meaning), FAR & key numbers (how to read a citation, all 53 RFO part titles, 44 old-to-new numbers, thresholds and deadlines, what changed lately) and 35 official links. |
| For everyone | Read-aloud on every lesson, card and question; four text sizes; day/night; search with `/`; works on phones; no network needed; progress can be saved inside the file itself. |

## How people get it: three ways

1. **The website (best).** Publish it on GitHub Pages (below). People open a link, and can install it like an app on a
   phone or computer. **When you change the content on GitHub, everyone gets the new version the next time they open it**
   with an internet connection, and a bar offers a reload if a newer version came out while they had it open.
2. **The single file.** `B2B-Guide.html` (download it from the website's Help page, or build it locally into `dist/`).
   Put it on Teams or SharePoint, or a thumb drive. It works with no network. A copy keeps the date it was built, so a
   file someone saved last month will not update itself; its Help page links to the website for the newest version.
3. **Army email.** Email blocks `.html` attachments, so send the two Word documents instead (READ ME FIRST + the code
   document). They are on the website's Help page, or in `dist/docx/` after a local build.

Test whether `github.io` opens on your NIPR computer. If it does, use the website for everyone. If not, use the file.

## Put it on GitHub (one time, about 15 minutes)

This folder is a git repository. `.gitignore` leaves out the built files (`docs/`, `dist/`), which GitHub rebuilds,
and any PDF or Office documents you keep here for reference, so official course material never goes public by accident.

1. Create a free account at github.com (use a personal email if your Army account cannot sign up).
2. On github.com, click **New repository**. Name it `b2b-guide`, choose **Public** (free GitHub Pages needs a public
   repository; everything in the guide is public information) and leave README, .gitignore and license off, so it
   starts empty.
3. In the new repository: **Settings, Pages, Build and deployment, Source: GitHub Actions.** Ignore the workflows GitHub
   suggests; this repository brings its own.
4. Send this folder up. In a terminal opened in this folder, run:

   ```bash
   git remote add origin https://github.com/<your-github-name>/b2b-guide.git
   git push -u origin main
   ```

   If a GitHub sign-in window opens, sign in. (With **GitHub Desktop** instead: File, Add local repository, pick this
   folder, Publish repository, and untick "Keep this code private". That creates the repository too, so skip step 2
   and do step 3 right after.)
5. Open the **Actions** tab. "Build and publish B2B Guide" runs now and after every future change. A green check means
   your site is live at `https://<your-github-name>.github.io/b2b-guide/`. A red X on the very first run usually means
   step 3 was not done yet: do it, open the run and click **Re-run all jobs**.
6. Open that address on a phone and a government computer. Use "Install" (Help page) to add it like an app.

The workflow checks the content, builds the website, the offline file and the Word email package, and publishes them.
If a check fails, the old site stays up and the Actions tab says what is wrong.

## Update the content

Content is plain text in `src/data/*.json`, not inside the code. Typical updates:

| What changed | File to edit |
|---|---|
| A FAR or DFARS rule, number or threshold | `far.json` (numbers, deadlines, old-to-new), plus the lesson that teaches it in `lessons-*.json` and any question in `quiz-*.json` |
| News readers should see | `updates.json` (newest first; it also shows on Home) |
| A course or the certification rules | `courses.json`, `cert.json`, `plan.json` |
| A new practice question or a fix to one | `quiz-*.json` (exactly one option has `"correct": true`; every option has a `"why"`) |
| A term | `glossary.json` |
| A link | `links.json` |
| Version number, maintainer, disclaimer | `meta.json` |

Then commit to GitHub (GitHub Desktop: Commit, then Push; or edit the file directly on github.com and click Commit
changes). The site rebuilds itself in about two minutes. Easiest of all: open this folder with Claude and ask, for
example, "The SAT changed to $X on <date>; update B2B Guide", then push.

Before relying on a change, run the checks locally if you can:

```bash
python tools/check_content.py
```

```bash
python tools/build.py
```

```bash
python tools/make_docx.py
```

`check_content.py` catches broken links between files, duplicate ids and questions without exactly one right answer.
`build.py` writes `dist/B2B-Guide.html` (offline), `dist/B2B-Guide-Preview.html` (claude.ai preview) and `docs/` (the
website). `make_docx.py` (needs `pip install python-docx`) writes the Word email package. Local preview: run
`python -m http.server 8790 --directory src` and open `http://localhost:8790/index.dev.html`.

## From test version to app

1. **Now (0.9):** test with new 51Cs and 1102s. Testers use Help, then "Send tester feedback" (see `TESTERS.md`).
2. **Website:** GitHub Pages as above. It is already a Progressive Web App: installable on Android, iPhone, Windows and Mac,
   works offline, updates itself.
3. **App stores, later:** the same website can be wrapped for Google Play and the Apple App Store (for example with
   PWABuilder or Capacitor) without rewriting it. Government phones often cannot install store apps, so the installable
   website will likely stay the main way in.

## Fusing with Board Ready

B2B Guide is built on Board Ready's architecture on purpose: the same build approach (src to one HTML), the same core API
(`window.CORB`), compatible data shapes (glossary, quiz items, resources) and a matching design system. The plan for
merging them into one career-long guide is in `CONTRACT.md`.

## Files

```
src/            the app: index.html template, css/, js/core/, js/views/, data/*.json (content), web/ (icons, service worker)
tools/          check_content.py, build.py, make_docx.py, fetch_fonts.py, make_icons.py
content/        SOURCES.md (what was checked, where, when), VERIFY.md (items to confirm locally)
.github/        the GitHub Pages workflow
docs/, dist/    built output (not committed; rebuilt by the workflow)
CONTRACT.md     architecture, data formats, content rules and the Board Ready fusion plan
TESTERS.md      a ready-to-send note for test users and what to look for
CHANGELOG.md    what changed in each version
```

Maintainer: SFC Rabin Napit. Fonts: Archivo, Manrope, JetBrains Mono (SIL Open Font License).
