# B2B Guide

**From day one to certified.** A plain-language guide for brand-new Army 51C contracting NCOs and 1102 contract
specialists working toward the **DoW Contracting Professional certification** (Back-to-Basics): a dated plan, the rules,
every course, lessons, practice exams, flashcards, games, a glossary and a FAR reference, in one file that works offline.

Unofficial training aid. Not endorsed by the U.S. Army, the Department of War or the Warfighting Acquisition University
(WarU, formerly DAU). Content checked 28 October 2026.

## Owner and license

B2B Guide is owned by **SFC Rabin Napit** (© 2026 Rabin Napit, all rights reserved). This repository is public so the
app can be hosted free; that does not make it open source: see [LICENSE](LICENSE). The app asks every reader to accept
its short terms of use before first use (free for personal study and for sharing unchanged; no copying, changing,
rehosting or selling without written permission). The terms text is `terms` in `src/data/meta.json`; changing its
`version` makes everyone accept the new terms on their next open.

## What is inside (version 0.14.2)

| Area | What the reader gets |
|---|---|
| Exam path | The 6-month path to pass CON 3990V: 26 dated weeks (starting on the reader's start date, stretching for longer goals), each with a goal, lessons, a FAR reading, flashcards and a 10-question check, plus monthly timed checkpoints with target scores and two full simulations before exam week. Also the Class material check (every claim in the B2B class materials against the RFO FAR) and Test-taker tips (what people who took the exam say to know). |
| Home and My plan | Three setup questions (51C / 1102 / mentor, start date, goal), then a dated checklist from week one to certified, with a timeline from start to the 36-month deadline. Exports to Outlook (.ics) and prints. |
| Certification 101 | The requirements (5 courses, 1 exam, 12 months), the course order, AITAS sign-up steps, the exam explained with pictures (the 11-step exam journey from the official roadmap and flowchart, the fine-print rules, retakes, the 36-month clock), tips from the WarU exam team, the official 150-question blueprint, an experience checklist with the WarU OJT tool, continuous learning points, the career path, credentials, reciprocity, 21 FAQs and dated sources. |
| Official documents | 26 DoW and WarU documents (exam FAQ, roadmap, flowchart, CON 7300V memo, Career Field Model, Competency Model, CL and reciprocity guidance, DoDI 5000.66 and the background memos), each with a simple picture version and the real pages; 8 of them (27 pages) are stored in the file and open offline. |
| Courses | 19 courses: the five required (CON 1100V, 1200V, 1300V, 7300V, 1400V), the five online modules required before CON 1300V, exam and prep (CON 3910, 3900V, 3990V) and recommended courses for 51Cs. Each with format, length, prerequisites, what you learn, how to prepare and how to do well, plus "My status". |
| Lessons | 35 plain-English lessons organized like the exam (Guiding Principles, Pre-Award, Award, Post-Award, plus on-the-job topics such as contingency contracting for 51Cs), each opening with pictures you can play (each part lights up and is read aloud) and, for the dollar rules, Try it tools that answer for any amount, then an example, a memory aid, common mistakes, RFO citations and "Check yourself" questions. |
| How-to guides | 13 step-by-step checklists: first week, registering in AITAS, scheduling the exam, applying for certification, a simplified buy, price reasonableness, market research, unauthorized commitments, modifications, options, closeout, finding things in the FAR, and protests. |
| Practice test | 374 exam-style questions, every answer explained with a citation: 197 written for the guide, 143 from the B2B class practice exam checked against the RFO (each says whether it changed and why), and 34 on topics past test takers reported. Quick 10, practice by exam area, the class exam, missed-question review, and a timed exam simulator weighted like CON 3990V. Answer options are balanced, so the longest one is not a giveaway. |
| Flashcards | 14 decks with spaced repetition: FAR part titles (the 20 on the exam and all 53), acronyms, key terms, key numbers, deadlines, courses, certification facts, roles, contract types, and from the B2B class: the Jeopardy review, UCF sections, common forms and PIID letters. |
| Arcade | Six games on the guide's own content, with four paces (Recruit to Elite), XP and ranks, sound and optional music, and a study list after every run: **Contract Quest** (RPG battles through the four exam areas and the Exam Citadel, all 374 bank questions), **Supply Line** (a story convoy: five checkpoints along the contract life cycle, crates for right answers, challenge coins for clean runs), **Fire Mission** (artillery: thresholds, deadlines, forms, J&A approvals, contract types), **Qual Range** (pop-up targets for the 243 glossary terms, scored Expert to Marksman), **Part Patrol** (space shooter: FAR parts, UCF sections, PIID letters, boss fights on bank questions) and **Sort Yard** (conveyor sorting: life-cycle phases, dollar thresholds, UCF parts, contract-type families). Works with a mouse, a keyboard or a touch screen, and on a phone held upright. The four quick drills (FAR Part Match, Which phase?, Threshold check, Who carries the risk?) stay at the bottom of the lobby. |
| Look it up | Glossary of 243 terms (any acronym in the guide can be tapped for its meaning), FAR & key numbers (how to read a citation, all 53 RFO part titles, 44 old-to-new numbers, thresholds and deadlines, what changed lately) and 37 official links. |
| For everyone | A guided tour (the ? button), an About page with the developer and maintainer and a feedback button, a side menu that collapses to icons, read-aloud on every lesson, card and question; four text sizes; day mode by default with night and follow-my-device; search with `/`; works on phones; no network needed; progress can be saved inside the file itself. |

## How people get it: three ways

1. **The app (best): https://rabinnapit.github.io/51C/.** People scan the QR code (print
   `handout/B2B_Guide_Install_Sheet.pdf`, or show the code on the guide's About page), open the link and add it to the
   home screen: on an iPhone, Safari, Share, Add to Home Screen; on Android, Chrome, Install app. It is free, needs no app
   store and no account, and works offline after the first open. **When you change the content on GitHub, everyone gets
   the new version the next time they open it** with an internet connection, and a bar offers a reload if a newer
   version came out while they had it open. Progress stays on each person's device.
2. **The single file.** `B2B-Guide.html` (download it from the website's Help page, or build it locally into `dist/`).
   Put it on Teams or SharePoint, or a thumb drive. It works with no network. A copy keeps the date it was built, so a
   file someone saved last month will not update itself; its Help page links to the website for the newest version.
3. **Army email.** Email blocks `.html` attachments, so send the two Word documents instead (READ ME FIRST + the code
   document). They are on the website's Help page, or in `dist/docx/` after a local build.

Test whether `github.io` opens on your NIPR computer. If it does, use the website for everyone. If not, use the file.

## On GitHub

The guide lives in the public repository **Rabinnapit/51C** (https://github.com/Rabinnapit/51C), on a GitHub account
kept apart from the maintainer's personal one. Commits here use that account's private noreply address (set in this
repository's own git config). `.gitignore` leaves out the built files (`docs/`, `dist/`), which GitHub rebuilds, and
any PDF or Office documents you keep here for reference, so official course material never goes public by accident.

One-time setup (already described here so it can be repeated):

1. The repository must be **Public** (free GitHub Pages needs it; everything in the guide is public information).
2. In the repository: **Settings, Pages, Build and deployment, Source: GitHub Actions.** Ignore the workflows GitHub
   suggests; this repository brings its own.
3. Connect this folder and send it up:

   ```bash
   git remote add origin https://Rabinnapit@github.com/Rabinnapit/51C.git
   git push -u origin main
   ```

   The user name in the address makes Git Credential Manager sign in as **Rabinnapit**, separately from any other GitHub
   account on this computer. When its sign-in window opens, sign in with that account.
4. Open the **Actions** tab. "Build and publish B2B Guide" runs now and after every future change. A green check means
   the app is live at https://rabinnapit.github.io/51C/. A red X on the very first run usually means step 2 was not
   done yet: do it, open the run and click **Re-run all jobs**.

## The QR code and install sheet

`python tools/make_handout.py` (needs `pip install segno`; Microsoft Edge prints the PDF) reads `site_url` from
`src/data/meta.json` and writes `handout/b2b-guide-qr.svg` and `.png`, the printable
`handout/B2B_Guide_Install_Sheet.html` and its PDF (PDFs stay off GitHub; print it from this computer), and the code
the About page draws (`app_qr` in `meta.json`). Run it again only if the address changes: the code points at the
address, and the address always serves the newest version.

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
src/            the app: index.html template, css/, js/core/, js/views/, js/arcade/ (Arcade engine and games), data/*.json (content), web/ (icons, service worker)
tools/          check_content.py, build.py, make_docx.py, fetch_fonts.py, make_icons.py
content/        SOURCES.md (what was checked, where, when), VERIFY.md (items to confirm locally),
                CLASS-MATERIAL-CHECK.md (the B2B class materials checked against the RFO FAR)
.github/        the GitHub Pages workflow
docs/, dist/    built output (not committed; rebuilt by the workflow)
CONTRACT.md     architecture, data formats, content rules and the Board Ready fusion plan
TESTERS.md      a ready-to-send note for test users and what to look for
CHANGELOG.md    what changed in each version
```

Maintainer: SFC Rabin Napit. Fonts: Archivo, Manrope, JetBrains Mono (SIL Open Font License).
