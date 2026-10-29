# Board Ready — CORB Prep & Warrant Guide (411th CSB)

A study and board-support app for the Army Contracting Officer Review Board, as an installable web app and as
self-contained HTML files. It lives in the `boardready/` folder of the public repository **Rabinnapit/51C**
(https://github.com/Rabinnapit/51C) beside B2B Exam Prep, and GitHub Pages serves it at
**https://rabinnapit.github.io/51C/boardready/**.

| Where | Edition | For |
|---|---|---|
| `https://rabinnapit.github.io/51C/boardready/` | Candidate, web | Open it on a phone or computer: it offers to install itself as an app (Android, iPhone, Windows, Mac), works offline afterwards and updates itself when a newer build is published. Its Settings page offers the files below for download |

Self-contained HTML files for Contracting Officer Review Board preparation and board support, in three files:

| File | Edition | For |
|---|---|---|
| `dist/BoardReady-Candidate-Offline.html` | Candidate, offline | The one to share widely: the candidate edition without the AI connector. The app's own code makes no network requests; the mentor answers only from the content inside it |
| `dist/BoardReady-Candidate.html` | Candidate | Candidates only: study and practice, with no board room, projector, content editor, role switch or passcode |
| `dist/BoardReady.html` | Full | Candidates, board members and facilitators |

Open any file in Edge or Chrome. No install, no network, no server. The files share progress when they are opened in the
same browser, because they store it in the same place.

**First open.** The landing page is the door on a first visit. After that the file opens straight on the dashboard, where
"Start here" gives the first steps in order. The first open also offers a short guided tour (8 stops for a candidate) that
points at the top-bar controls and the menu groups. The ? button, or the ? key, starts it again.

**Less on screen (v1.1.0).** Four first-time-user reviews drove a subtraction pass: answers in the question library start
hidden, a question card carries at most three badges, the dashboard hides its readiness ring and streak until there is
something to measure, the quiz, flashcards and mock board put Start first with their settings behind "Change settings", and
each page states privacy and keyboard help once instead of on every screen. Nothing was removed from the question bank.

**Owner, terms and the QR sheet (v1.2.1).** The app names its owner (SFC Rabin Napit) and shows short terms of use once
before first use (`core/08a-terms.js`, text in `meta.terms`; About and the side menu show them any time). The About page
and the web edition's install page carry a QR code for the website (`tools/make_handout.py` writes it into `meta.app_qr`
and prints `handout/Board_Ready_Install_Sheet.pdf`, a one-page sheet to post or hand out). About also lists what is new
in each version (`meta.whats_new`), and a single-file copy tells the reader where the newest version is. The manifest
gained shortcuts (long-press the icon: Quiz, Flashcards, Mock board, Library), small buttons grow on touch screens, and
top-bar tooltips open below the bar. New links: the FAR Companion, the searchable overhauled FAR and the FAI hub.

**On the web (v1.2.0).** The web edition is the candidate edition plus `core/09-pwa.js`: an install page on first open (one
button for the device: Chrome's install box on Android, Safari's three taps on an iPhone, the address-bar install on a
computer), a service worker that keeps the app working with no signal, a `version.json` check that offers a reload when a
newer build is live, and a "Get the app" section in Settings with the single-file copies and the Word packages. The same
release adds a side menu that collapses to a rail of icons, four text sizes, a theme that can follow the device, the
read-aloud engine shared with B2B Exam Prep (the device's natural voices, contracting pronunciation, rise-and-fall
delivery), a board date computed from the cadence, a "What changed" panel in the Regulation explorer, and the content
re-check of 29 October 2026 (`docs/PLAN-1.2.md`).

**Fairer quiz (v1.1.1).** The longest answer choice used to be the right one in 87 percent of quiz items, so picking the
longest choice could beat real knowledge. 255 quiz items were rewritten: wrong choices now carry specific, believable detail
and right answers lost their padding, so the longest choice is right in about a fifth of items, less often than a blind guess
(one in four). Questions, right answers and explanations keep their meaning, and `merge_content.py` now warns if the pattern
comes back.

**Warrant class.** The class chip in the top bar sets one class for the whole app; a page that needs it shows
"Warrant class: ... Change", which opens that same picker. The quiz, flashcards, mock board, question library, scenarios, readiness score and Arcade all show that class
plus the classes below it, weighted toward the chosen class. Search and the mentor still find other classes, after yours.
The library has a "Show all classes" button. The classes are Class I to IV: Korea has no Grants or Agreements officers, so
those tracks are not offered, and questions written only for them are left out of both files.

**Organization.** The organization picker (the top bar on a computer, the menu on a phone) sets whose questions you see.
For the 411th CSB, grants and agreements questions are now left out everywhere, not only in practice, because Korea has no
Grants or Agreements officers. The question library, flashcards, mock
board and readiness use that organization's list plus the ACC-wide set. The Quiz and every Arcade game use it by relevance:
general contracting questions from every organization's list, but no other organization's local procedures (409th ABG-75
questions outside the 409th, Korea questions outside the 411th). For the 411th CSB they also leave out grants, cooperative
agreements and other transactions. The Arcade home and the quiz summary name the organization. "All organizations" shows
everything.

**My notes.** Every question has a notes button, and a saved note shows under the answer. Notes live in the browser, which a
managed computer can clear at restart, so **Save notes** (in the top bar while a note is unsaved, in the notes window, or in
Settings → Your data) writes them into the HTML file itself. In Edge and Chrome the first save asks for the file: pick the
file the app was opened from and replace it, and later saves write straight to it. Where the browser blocks that, a copy with
the notes inside downloads instead. Opening that file brings the notes back even after the browser was cleared; a newer note
in the browser wins over the copy in the file. Anyone given that file can read the notes. A facilitator's "Save a new copy
of the app" never includes notes. The study-group notes that used to sit under some answers are gone.

**On a phone.** The top bar keeps the menu, search and the class chip; the organization picker, day/night and the tour sit
in the menu. The bottom bar is Dashboard, Library, Cards, Quiz and Board.

## What is inside (29 October 2026 build)

| Module | Count | Origin |
|---|---|---|
| Board questions | 307 | 232 from the PAM list, CSV and study decks; 20 Korea scenarios; 55 Class III and IV questions written for warrant-class practice, all AI-authored ones independently reviewed. The 49 questions written only for Grants or Agreements officers (USAMRAA and ACC-Warren) are left out; `src/data` keeps them for source tracing |
| Official answers | 181 | PAM list and 411th study-group decks |
| AI-drafted answers | 126 | drafted where the repository had none, plus the Class III and IV set; independently reviewed, badged |
| Study primers | 27 | mentor-voice explainers, one per board topic |
| Quiz items | 306 | four options each with a reason per option, reviewed; one for every board question except Q0114, whose source answer carries a superseded certified cost or pricing data threshold. Answer choices are always shuffled, and option lengths are balanced so the longest choice is right only about a fifth of the time |
| Arcade games | 8 | Threshold Run (104 cards plus practice cards each run), Deadline Dash (98 playable deadline cards plus date cards each run), Drop Zone (261 board questions and the points in their answers), Cite Express (195 board questions and the citations their answers use), Fiscal Asteroids (72 statements plus 8 generated each run), Clause Catcher (67 clauses), RFO Warp (91 citation pairs), Boss Board (the quiz bank) |
| Group games | 2 | Board Jeopardy (6 x 5, in the Board room); You're the KO (4 branching cases, in Scenarios) |
| RFO crosswalk | 139 verified pairs | old-to-new citation map, live-verified on acquisition.gov and the DoD class deviations |
| Thresholds | 33 | current dollar values with cites, marked "verify" until C&P confirms |
| Glossary | 224 | terms and acronyms |
| Resources | 48 | links, each checked (the FAR Companion, RFO.pdf and the FAI hub added 29 Oct 2026) |
| Process guide | 10 steps | 411th workflow, Policy v12, reciprocity note, VCE guide |

Verification detail: `content/VERIFICATION.md`.

## Who it is for

| Role | What they get |
|---|---|
| Candidate | Process guide, question library, primers, flashcards (spaced repetition), quiz, scenarios, timed mock board with rubric self-scoring, mentor, the Arcade, readiness dashboard; practice follows the warrant class they choose |
| Board member | Board console: balanced question sets, hidden answers, notes, rubric scoring, session export; study-group projector mode and Board Jeopardy |
| Facilitator | Everything above plus the content editor and "save a new copy of the app" |

Board-room views sit behind a local passcode the facilitator sets in Settings. It is a curtain, not security.

## The Arcade

Practice → Arcade opens full screen inside the app with eight animated canvas games built on the same content, listed in this
order: Threshold Run (car race across the warrant-class lanes), Deadline Dash (runner through protest and claim deadline
gates), Drop Zone (steer a parachutist onto the landing strip that carries a point from the board question's own model
answer), Cite Express (throw the rail switch to the track whose signal shows the citation the model answer uses), Fiscal
Asteroids (shoot the Purpose / Time / Amount / No-violation asteroid), Clause Catcher (catch the right clause number), RFO
Warp (fly through the portal with the new citation), and Boss Board (a boss battle answered with real board questions).
Drop Zone and Cite Express play the question bank itself, so every board question with answer points or citations is in a
game. During a game the top bar has "← All games" (back to the game list) beside "← Board Ready" (back to the app).

**Pace settings**, chosen on the Arcade home screen (Recruit is the default):

| Setting | Speed | Lives | Reading pause |
|---|---|---|---|
| Recruit | slow motion | 5 | every new question waits until the player presses Go |
| Regular | a little slower than full speed | 4 | short pause, then the question starts by itself |
| Veteran | full speed | 3 | none |
| Elite | faster than full speed | 2 | none |

**Question levels** inside every game: a run starts with easy questions and moves to medium, then hard, after every five
correct answers. Harder levels never speed the game up; the game slows down so there is more time to think.

**Warrant class**: the Arcade uses the same warrant setting as Quiz, Flashcards and Mock board (Settings → Profile, or the
picker on the Arcade home screen). A Class III candidate gets mostly Class III questions plus Class I and II fundamentals;
All classes mixes everything. No question repeats until the whole set for that class has been played, and missed questions
come back in later runs.

Scores are kept per pace setting and stay in the browser. Every miss is explained on the results screen. Board Jeopardy,
the study-group game, is in the Board room. The contract for adding games is `docs/ARCADE_CONTRACT.md`; games live in
`src/arcade/js/games/`.

## Distribute it

The simplest way is the website: https://rabinnapit.github.io/51C/boardready/ installs as an app and keeps itself current.
Where the network blocks the website, use the files. Army email blocks .html attachments, so email the Word packages in
`dist/docx/` instead (the website's Settings page offers the same files).

1. Email "1 - READ ME FIRST - How to install Board Ready.docx" with the code document for the edition you need from `dist/docx/`: "4 - BoardReady-Candidate-Offline.html.docx" to share with candidates, "3 - BoardReady-Candidate.html.docx" for the candidate edition with the AI connector, "2 - BoardReady.html.docx" for the full version. Inside the Army network the .html file itself can be shared on Teams or SharePoint; recipients click it and choose Open or Save.
2. Recipients follow READ ME FIRST: open the code document in Word, then File → Save As → Plain Text, type the file name with the quotation marks ("BoardReady-Candidate.html" or "BoardReady.html"), and choose UTF-8. That document lists the exact file size to expect.
3. They double-click the file. The first time, it offers the guided tour. Progress is kept in that browser (when the network allows browser storage) and can always be exported to a file from Settings → Data. Notes can also be saved into the HTML file itself with Save notes.
4. To move progress between devices: Settings → Export progress file, then Import on the other device.

## Content labels

Every answer shows a badge. Do not remove the badges.

| Badge | Meaning |
|---|---|
| Official answer | From the PAM Warrant Board Q&A list or a 411th study-group deck |
| AI draft · verify | Drafted by AI where the repository had no answer; reviewed, but confirm before relying on it |
| Open · write your own | No answer in the repository and no draft |
| Verify locally | Organization-specific; confirm with your policy office |
| Korea · confirm with C&P | Depends on a 411th/USFK procedure or SOP |
| RFO cites | Citations were updated to Revolutionary FAR Overhaul numbering (crosswalk shown) |
| Cite unverified | A citation could not be confirmed on acquisition.gov; the old cite was kept |

Thresholds in Regulation explorer are marked "verify" until the policy office confirms them.

## Update content (facilitator)

**In the app**: role Facilitator → Content editor. Edit or add questions, then "Save a new copy of the app".
A new dated HTML file downloads with the edits embedded. Redistribute it in place of the old file.

**From the spreadsheet** (rebuild): put the updated PAM export at `CORB2/Warrant Board Study Group - Question and Answer List.xlsx`, then

```bash
python tools/build_bank.py
python tools/merge_content.py
python tools/check_content.py
python tools/build.py
python tools/make_docx.py
python tools/publish_site.py
```

`build_bank.py` and `merge_content.py` look for the source lists in `corb/` and `CORB2/` beside the CORB folder (any parent of
the app that has them, or `CORB_SOURCES`). Dated content changes that are not in the source lists (the October 2026 re-check,
for example) live in `tools/content_patches.py`; `merge_content.py` applies them on every merge, and `python
tools/content_patches.py` applies them to `src/data` directly. `check_content.py` validates the data, the quiz bank and every
script before a build; GitHub Actions runs it first. `publish_site.py` assembles `docs/boardready/` for GitHub Pages; the
workflow in `.github/workflows/pages.yml` runs all of this on every push to `main`, so nothing built is committed.

`build_bank.py` merges the xlsx, the legacy CSV and the study decks into `src/data/questions.json` and writes a change log to `content/bank_changelog.md`.
`merge_content.py` folds the agent-authored content in `content/out/` (drafts, primers, glossary, process, regulations, games, rubric, resources) into `src/data/*.json`.
`merge_content.py` also splits out any source-list question the fuzzy merge folded into another one, and regenerates `content/SOURCE_COVERAGE.md`, which traces every row of both source lists to its question and answer.
`merge_content.py` also checks that quiz answers do not give themselves away by length: it prints a WARNING (kept in `content/merge_report.md`) for any quiz item whose right answer is more than 30 percent and 15 characters longer than every other option, and when the right answer is the longest option in more than 35 percent of quiz items. Keep it near a quarter by making wrong options as specific as the right one.
`build.py` inlines everything, the Arcade included, into the three single-file editions and the web edition (`dist/web/`: `index.html`, `manifest.webmanifest`, `sw.js`, icons, `version.json` and the files as downloads) and refuses to build if any external resource sneaks in. It leaves out questions tagged only for Grants or Agreements officers (and their quiz items) and the study-group notes; `src/data` keeps both. The candidate edition leaves out `board.js`, `projector.js`, `jeopardy.js` and `editor.js` and sets `meta.edition` to `candidate`.
`make_docx.py` packages both files as Word documents for email, checks that the text comes back out exactly, and writes the READ ME FIRST instructions with the expected file sizes.

Rename the app by editing `app_name` in `src/data/meta.json` and rebuilding. The owner, copyright and terms text are `owner`, `copyright` and `terms` there (change `terms.version` and everyone accepts the new terms on their next open); `whats_new` is the About page's version list; `site_url` is the website (run `tools/make_handout.py` again if it changes). Change the next board date in the same file. The developer and maintainer name and email, shown on the About page and in the sidebar, are under `maintainer` in the same file.

## Development

```
src/index.html        template with placeholders; build.py expands it
src/css/              tokens → base → components → shell → views/*.css
src/js/core/          namespace, store, router, ui, data, speech, connector, scoring
src/js/views/         one file per view (registers itself)
src/data/*.json       content modules (inlined at build time)
src/arcade/           the Arcade: shell (js/app.js, js/core/engine.js), one file per game in js/games/, css/
src/web/              web edition only: sw.js (service worker), icons/ and favicon.svg (tools/make_icons.py)
handout/              the QR code and the one-page install sheet (tools/make_handout.py); the PDF is printed here, not committed
js/core/08a-terms.js  owner notice and terms of use (meta.terms), shown once before first use
js/core/09-pwa.js     web edition only: install page, service worker registration, update bar
tools/                build_bank.py, merge_content.py, content_patches.py, check_content.py, build.py, make_docx.py, publish_site.py, make_icons.py, make_handout.py, check_ladder.py, fetch_fonts.py, qa_browser.js
docs/CONTRACT.md      the build contract every module follows
```

Local preview: `python -m http.server 8766 --directory src` then open `http://localhost:8766/index.dev.html`. The web edition:
`python tools/publish_site.py` then `python -m http.server 8795 --directory ../docs/boardready` (the service worker registers on localhost).

## AI mentor connector

The offline candidate edition has no connector at all (`build.py` leaves out `src/js/core/06b-connector-network.js`, which holds the app's only `fetch`, and refuses to build if any network call remains in that file).

The mentor works offline by retrieving from the embedded repository. In the other two files, to get coached explanations, open Settings → AI connector and enter an endpoint:

* Army chat.genai or any OpenAI-compatible service: provider "OpenAI-compatible", base URL up to `/v1`, model name, key.
* Claude: provider "Anthropic", base URL `https://api.anthropic.com`, model, key.
* Gemini: provider "Google Gemini", base URL `https://generativelanguage.googleapis.com`, model, key.

Keys stay in that browser only and are never written into exported progress files or saved copies of the app.
The service must allow browser requests (CORS). On NIPR the connector is expected to fail; the offline mentor keeps working.

## Sources

PAM Warrant Board Q&A list (January 2026 extract), legacy WarrantQA CSV, 411th CSB study-group decks (April to July 2026),
Army Warranting Program Policy v12 (March 2026), 411th CSB Warrant Process Workflow (July 2026),
ACC Contracting Note 26-03 (May 2026), VCE-Warrants User Guide (February 2025), and, as of 14 September 2026, acquisition.gov, the DoD class deviations on acq.osd.mil, the AFARS effective 31 August 2026 with Appendix GG Revision 30, the eCFR and the U.S. Code.
Re-checked 29 October 2026 (`docs/PLAN-1.2.md`): acquisition.gov/far-overhaul and the DPCAP class deviations page; the Army policy and AFARS on PAM were not re-checked (CAC needed).
