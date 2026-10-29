# CORB Prep App — Build Contract

Every agent building a module reads this first. It is the only coordination document.
Deviations must be noted at the top of the module file in a comment.

## 1. Hard constraints (physics, not preferences)

1. **Ships as ONE self-contained `.html`** (`app/dist/<AppName>.html`) built by `app/tools/build.py`.
   Development is multi-file under `app/src/`; the build inlines everything.
2. **Zero network at runtime.** No CDN, no Google Fonts links, no `fetch()` of local files, no ES modules,
   no `import`. Fonts are embedded as base64 `@font-face` data URIs in `src/css/00-fonts.css`.
   Only exception: the optional LLM connector, which the user enables explicitly and which fails gracefully.
3. **`file://` protocol.** Plain classic `<script>` blocks. `fetch('data/x.json')` will NOT work.
   All data is in `src/data/*.js` as `window.CORB_DATA.<name> = ...` assignments.
4. **Browser storage may throw.** Only touch storage via `CORB.store.safeGet/safeSet/safeDel`.
   The app must be fully usable with storage disabled; progress can always be exported to a file.
5. **Runs on**: NIPR Edge (Chromium) laptops, personal laptops, phones/tablets, projectors. Responsive down to 360px.
6. **No PII.** No real names or emails of mentors, board members, or candidates anywhere in the bundle. The one exception is the developer and maintainer contact in `meta.maintainer`, shown at the maintainer's request.
7. **Training aid, not authoritative.** Every answer/threshold shows its verification status. Never render an
   AI-drafted or unverified item without its flag badge.

## 2. Source layout

```
app/src/
  index.html               shell: <head> fonts/css, <body> #app, then scripts in order
  css/00-fonts.css         @font-face data URIs (built by tools/fetch_fonts.py)
  css/01-tokens.css        design tokens (colors, type, spacing, radii, shadows, motion) — light + dark
  css/02-base.css          reset, typography, layout primitives, utilities
  css/03-components.css    buttons, cards, badges, inputs, modal, toast, tabs, progress, tooltip
  css/views/<view>.css     one file per view, ALL selectors prefixed `.v-<view>` (no leaks)
  js/core/00-namespace.js  window.CORB = {}
  js/core/01-store.js      state + safe storage + progress export/import
  js/core/02-router.js     hash router, view registry, role gating
  js/core/03-ui.js         DOM helpers (h, el, on, delegate), toast, modal, confirm, badge, icon
  js/core/04-data.js       CORB.data: query API over CORB_DATA (filter/search/random/tf-idf)
  js/core/05-speech.js     offline TTS wrapper (speechSynthesis) with graceful no-op
  js/core/06-connector.js  LLM connector (OpenAI-compatible + Anthropic + custom) + offline retrieval fallback
  js/core/07-scoring.js    rubric scoring, readiness math, spaced repetition (SM-2 lite)
  js/views/<view>.js       one file per view; registers itself via CORB.registerView(...)
  data/*.js                window.CORB_DATA.questions = [...] etc.
app/tools/build.py         inlines css/js/data into dist/<AppName>.html, checks no external refs
app/tools/build_bank.py    xlsx/csv/decks -> questions.json (then data/questions.js)
app/tools/xlsx_to_json.py  facilitator re-import path
```

Script load order in `index.html`: data/*.js → core/00..07 → views/*.js (alphabetical) → `CORB.boot()`.
The **last** script block captures `PRISTINE_HTML` for "Save a copy of this app with my edits".

## 3. Data modules (`window.CORB_DATA`)

All objects are plain JSON. Keep them serializable (the content editor re-embeds them).

### `questions: Question[]`
```js
{
  id: "Q0001",
  question: "text",                    // plain text, \n paragraphs
  answer: "text",                      // "" when answer_status === "open"
  answer_status: "official" | "open" | "ai-draft",
  answer_source: "pam-xlsx-2026-01" | "pam-csv-legacy" | "deck-2026-05-13" | "ai-draft-2026-09",
  deck_notes: [{src, text}],           // study-group answers; kept in src/data, not shipped (build.py drops them)
  alt_answers: [{src, text}],
  domain: "Fiscal Law & Funding" | ... (see §7),
  topic: "Bona Fide Need",
  alt_topics: [], tags: ["OCONUS","Services",...],
  classes: ["I","II","III","IV"],       // source data also has "Agreements" and "Grants"; the build leaves those out (see Editions, warrant class scope)
  unit: "411th CSB" | "ACC-All" | "409th CSB" | "USACE Alexandria" | "USACE Atlanta" | "USACE Dallas" | "USAMRAA" | "ACC-WRN" | "MICC - HQ",
  units: [...], kind: "knowledge" | "scenario" | "leadership",
  sources: [{src, row}|{src, slide}],
  citations: ["FAR 6.103-1", "10 U.S.C. 1724"],
  rfo: { status: "pending"|"updated"|"unverifiable"|"n/a", crosswalk: [{old,new}], notes: "" },
  flags: ["verify-locally","ai-drafted","korea-verify-cp"],
  key_points: ["..."],                 // optional, 3-6 bullets for flashcard back / rubric
  model_answer_outline: ["..."],       // optional
  mcq: { stem?, options:[{text, correct, why}] }  // optional, used by quiz
}
```
### `regulations` — regulation explorer
```js
{ frameworks:[{id:"far", name, description, url, parts:[{num:"6", title, summary, url, key_sections:[{ref,title,url,note}]}]}],
  crosswalk:[{old:"FAR 6.302-1", new:"FAR 6.103-1", title, note, confidence:"verified"|"probable"|"unverified", source_url}],
  thresholds:[{id:"sat", name:"Simplified Acquisition Threshold", value:"$…", value_number, cite, url, verified_on, status:"verify"|"verified", notes}],
  verified_on:"2026-09-13" }
```
### `process` — warrant process guide
```js
{ policy_summary:{...}, warrant_classes:[{cls:"I", thresholds:["SAT"], typical_roles, board_focus}],
  steps:[{n, who, what, routing, timeline, checklist:[{id,text,required}], tips:[], source}],
  after_appointment:[...], suspension_termination:{...}, reciprocity:{...}, vce_howto:[{title, steps:[]}],
  board:{composition, cadence:"2nd Wednesday monthly", format, scoring_note}, packet_checklist:[{id,text,required,who}] }
```
### `scenarios` — branching "You're the KO" + long-form scenario cases
```js
{ cases:[{id, title, unit, classes, setup, nodes:{id:{text, choices:[{label, next, score, feedback}]}}, start:"n1", learning_points:[], citations:[], flags:[]}] }
```
### `glossary: [{term, expansion, definition, domain, cite?}]`
### `primers: [{id, title, domain, summary, sections:[{heading, body}], key_cites:[], board_angles:[], flags}]`
### `games` — `{ threshold_ladder:[...], fiscal_sort:[...], protest_clock:[...], clause_match:[...], jeopardy:{categories:[...]}, }`
### `rubric` — `{ dimensions:[{id,name,description,anchors:{1..5}}], pass_rule:"unanimous", weights }`
### `resources: [{title, url, kind, note, access:"public"|"cac"|"local"}]`
### `units: [{id, name, short, default:true|false, description}]`
### `meta: { app_name, version, built_on, disclaimer, content_verified_on, next_board:"2026-10-14" }`

## 4. Core API (`window.CORB`)

```js
CORB.registerView({ id:"library", title:"Question Library", icon:"book", nav:true, order:30,
                    roles:["candidate","board","facilitator"],  // who sees it in nav
                    render(root, ctx){}, onLeave(){} });      // render is called on every navigation
CORB.go("library", {domain:"Fiscal Law & Funding"});          // navigate; params -> ctx.params
CORB.state                                                   // reactive-ish: CORB.set(path, value) triggers CORB.on('change')
CORB.set("progress.seen.Q0001", true); CORB.get("progress.seen")
CORB.on("change", fn); CORB.on("route", fn)
CORB.store.safeGet(k) / safeSet(k,v) / safeDel(k)           // try/catch wrapped; return null on failure
CORB.store.exportProgress() -> downloads JSON;  CORB.store.importProgress(file)
CORB.setNote(qid, text)                                      // the only way to write a note: also stamps progress.notesAt[qid]
CORB.store.saveNotesToFile() -> Promise<{how:"file"|"download"|"cancel", name, count}>   // CORB.ui.saveNotesToFile() wraps it
CORB.store.unsavedNotes() -> number                          // notes that differ from the copy saved in this file
CORB.ui.h("div.class#id", {attrs}, ...children)               // hyperscript; strings are text (escaped)
CORB.ui.toast(msg, kind); CORB.ui.modal({title, body, actions}); CORB.ui.confirm(msg) -> Promise<bool>
CORB.ui.badge(status) -> element for "official" | "open" | "ai-draft" | "verify-locally" | "korea-verify-cp" | "rfo-updated" | "rfo-unverifiable"
CORB.ui.icon(name) -> inline SVG (see icon set in 03-ui.js)
CORB.data.questions({unit, classes, domain, topic, kind, status, q}) -> Question[]   // respects active unit filter
CORB.data.search(text, {limit}) -> [{item, score, type}]   // tf-idf over questions/primers/glossary/process
CORB.data.random(filter, n)
CORB.speech.speak(text) / stop() / available
CORB.connector.ask(messages, {system}) -> Promise<string>     // falls back to CORB.connector.offlineAnswer(query)
CORB.connector.configured() -> bool
CORB.scoring.rubric(); CORB.scoring.readiness() -> {overall, byDomain:{...}, byClass:{...}}
CORB.scoring.srs.due(); CORB.scoring.srs.grade(qid, 0..5)
CORB.role() -> "candidate"|"board"|"facilitator"; CORB.unit() -> active unit id
```
State shape (persisted): `{ version, profile:{name?, role, unit, targetClass, theme}, progress:{seen:{}, srs:{}, quiz:[], boards:[], games:{}, notes:{}, notesAt:{}}, settings:{connector:{provider, baseUrl, model, key}, tts:true, boardPasscode}, overrides:{questions:{}, added:[]} }`
Never store the API key in the exported progress file.

## 5. Design tokens (see `01-tokens.css`)

- Two surfaces: **Landing = dark cinematic** (`body[data-surface="landing"]`), **Workspace = light editorial** (default), plus a user dark toggle for the workspace.
- Fonts: `--font-display` (Instrument Serif), `--font-body` (Manrope), `--font-mono` (JetBrains Mono). Fallback stacks included.
- Color roles only: `--bg, --bg-2, --panel, --ink, --ink-2, --muted, --line, --accent, --accent-2, --gold, --ok, --warn, --danger, --info` + `--shadow-*`, `--r-*`, `--space-*`.
- Status badge colors: official=ok, ai-draft=warn, open=muted, verify-locally=info, korea-verify-cp=gold, rfo-*=accent.
- Motion: `--ease`, `--dur`; honor `prefers-reduced-motion`.
- Never hardcode hex in view CSS. Use tokens.

## 6. View conventions

- One file, one `CORB.registerView` call, all DOM built with `CORB.ui.h` or template strings passed through `CORB.ui.esc`.
- Root element gets class `v-<id>`; all CSS scoped under it.
- Views must work with zero progress data and with storage disabled.
- Everything keyboard reachable; focus styles from base.
- Long lists: render at most 60 items then a "Show more" control (no virtual scrolling libs).
- One page, one job. A page head is a title and at most one sentence; the top bar already names the section, so
  `.page-head > .eyebrow` is hidden in `02-base.css`. Say privacy, keyboard help and "how this works" once, in Settings or
  About, not on every page.
- A setup page (quiz, flashcards, mock board) puts its primary button and a one-line summary first, with the settings the
  summary describes behind a collapsed `details.acc` "Change settings".
- Show no empty scoreboard. Rings, streaks, counters and "record" panels appear once there is something in them.
- Mobile: single column below 760px; primary action reachable by thumb.
- Projector mode: `body[data-projector]` scales type 1.4x; views should not break.

## 7. Domains (navigation taxonomy)

Fiscal Law & Funding · Competition & Market Research · Acquisition Planning & Contract Types · Source Selection & Evaluation · Pricing, Cost & Payment · Contract Administration · Terminations & Remedies · Protests, Claims & Disputes · Responsibility & Exclusions · Property, Security & Special Provisions · Authority, Ethics & Leadership · Small Business & Socioeconomic · Grants & Agreements · Korea, LCS & SOFA · Germany ABG-75 · General Contracting

## 8. Content rules for authors

- Cite RFO numbering (`FAR 6.103-1`, not `FAR 6.302-1`); add the crosswalk pair in `rfo.crosswalk` when you convert.
- Anything not confirmed against acquisition.gov or the Army policy gets `flags` and `rfo.status` set honestly.
- Korea/411th items: always `korea-verify-cp`. Never invent local approval levels; describe the roles and say "confirm current threshold with C&P".
- Plain text answers: short paragraphs, "•" bullets, no markdown headers, no HTML.
- Board-ready tone: answer as a KO would speak, then the citation line.

## Editions, warrant class scope and the guided tour (added 16 Sep 2026)

- `tools/build.py` writes three files. The candidate edition omits the board, projector, jeopardy and editor views and their CSS,
  and sets `meta.edition = "candidate"`. The offline candidate edition (`BoardReady-Candidate-Offline.html`) is the candidate
  edition without `core/06b-connector-network.js`, which holds the AI endpoint code and the app's only `fetch`; the build fails if
  `fetch(`, `XMLHttpRequest`, `sendBeacon` or `new WebSocket` appear in that file. Views gate every connector setting and mention
  on `CORB.hasConnector()`. Keep any future network code in `06b-connector-network.js`. Views check `CORB.isCandidateEdition()` to hide role switching, projector mode,
  the board room passcode and facilitator copy. `CORB.role()` always returns `candidate` there, and the candidate edition
  never writes `profile.role`, because both editions share browser storage.
- Warrant classes are Class I to IV only (`CORB.data.CLASSES`). Korea has no Grants or Agreements officers, so `build.py`
  leaves out every question tagged only "Agreements" or "Grants" (and its quiz items) and drops those tags from mixed
  questions. `src/data` keeps them so `content/SOURCE_COVERAGE.md` still traces every source-list row. `CORB.data.all()`
  applies the same rule to edited and imported questions, and the content editor skips such rows on CSV import.
- `CORB.data.relevantTo(q, unit)` is the organization rule for practice: false for another organization's local procedures
  (the 409th CSB list and the Germany ABG-75 topic outside the 409th; the 411th CSB list and the Korea, LCS & SOFA topic
  outside the 411th) and, for the 411th CSB, for the Grants & Agreements topic; true otherwise and for unit `all`.
  `CORB.data.cardRelevantTo(card, unit)` keeps game cards flagged `korea-verify-cp` for the 411th and `all` only. The Quiz
  (`buildPool`) and the Arcade (`arcadeData`: questions, quiz items, game cards) use both; the library, flashcards, mock board
  and readiness keep the stricter list filter (`unitAllows`).
- `CORB.data.questions(f)` follows the profile's warrant class (`profile.targetClass`: that class and the classes below
  it). A caller opts out with `f.classes` (explicit classes), `f.warrant` (apply another
  class) or `f.anyClass: true`. Board-room views and views that apply their own class pass `anyClass`. `CORB.data.search`
  keeps other classes but ranks them after the reader's class unless `opts.anyClass` is set.
- Notes saved into the file live in the `embeddedState` block as `notes`, `notesAt` and `notesSavedAt`, beside anything a
  facilitator baked in. `store.load()` restores a note from the file when the browser has none, or when the file's copy is
  newer. Saving uses `showSaveFilePicker` (the handle is reused for the rest of the session) and falls back to downloading a
  copy when the picker is missing or blocked. `store.saveCopy()` (the facilitator's shared copy) never includes notes.
- `02-base.css` turns off common ligatures on `body` (and `arcade.css` on `.arcade-root`): Manrope's ligatures draw "(c)" as a copyright sign, which broke every citation with a (c) paragraph. Keep `font-variant-ligatures: no-common-ligatures` when changing type styles.
- `CORB.ui.icon()` marks each icon with `data-icon`; `03-components.css` gives unsized icons a 1.15em default through
  `:where()`, so any rule that sizes an icon in context still wins. Never leave an icon without a size in a flex or grid box.
- `CORB.setWarrantClass(cls)` sets the class, shows a toast and re-renders; the top bar class chip opens `CORB.ui.classPicker()`.
- One warrant class control per page: `CORB.ui.classLine({label, note})` renders "Warrant class: Class I" with a Change
  button that opens the same picker. No view builds its own class selector (the library's multi-class filter, under "More
  filters", is the exception). The mock board follows it too, and an empty class there means a board drawn from every class
  with no 60/40 lean.
- Badges, one per meaning: `CORB.ui.flagsFor(q)` returns at most the answer status, `verify-locally` (which now covers
  `korea-verify-cp`; its tooltip names C&P) and `rfo-unverifiable` (which now covers `pending`). An up-to-date RFO cite gets
  no badge. `CORB.ui.classBadges(classes)` gives ONE badge for a question's classes ("Class II-III"). Question cards show no
  organization badge.
- `CORB.ui.questionCard` leads an open answer with its key points, keeps the write-up and the RFO crosswalk behind a
  collapsed "Full answer", and shows one cite line.
- `settings.hideAnswersDefault` defaults to **true**: question lists open with answers hidden. `settings.setupDone` records
  that the dashboard setup card was saved or dismissed.
- `CORB.tour` (core/08-tour.js): `start()`, `stop()`, `offer()`. Boot calls `offer()` once until `settings.tourSeen` is true.
  Eight stops for a candidate (the full edition adds role, board room and editor): class and organization, "Start here",
  the three menu groups, search, Settings and a closing step. They point at stable class names (`.topbar .class-chip`,
  `.topbar .unit-select`, `.db-start`, `.db-continue`, `.topbar .search-btn`, `.set-nav`); keep those names, or update the
  steps, when a view is redesigned.
- Boot (core/02-router.js) opens `#/home` only on a first visit; a browser that has seen the app (tour answered, a name, or
  any progress) opens `#/dashboard`.
- On a phone (<= 860px) the top bar keeps the menu, search and the class chip; the organization picker, the theme toggle and
  the tour move into `.side-tools` inside the side menu. The bottom bar is the first five `mobile: true` views.

## The web edition, the rail, text size and content patches (added 29 Oct 2026, v1.2.0)

- `tools/build.py` also writes `dist/web/`: the candidate edition plus `core/09-pwa.js` (install page, service worker
  registration, "a newer version is ready" bar) and `css/views/install.css`, with `meta.web = true`, `meta.build_id` (a hash
  of content and code, the same in every edition), `manifest.webmanifest`, `sw.js` (`src/web/sw.js` with the build id),
  `icons/` (`tools/make_icons.py`, committed), `version.json` and the single-file editions under `downloads/`.
  `tools/publish_site.py` copies it, with the Word packages, into the repository's `docs/boardready/`, which the 51C
  workflow uploads to GitHub Pages. The single-file editions never contain `CORE-09-PWA` or `serviceWorker.register`
  (the build checks). `CORB.isWeb()` gates web-only UI (Settings → Get the app). Keep every network call in
  `06b-connector-network.js` or `09-pwa.js`.
- Storage keys stay distinct from B2B Exam Prep (same origin on GitHub Pages and under `file://`): `corb.state.v1`,
  `corb.secret.v1`, `corb.theme`, `corb.textsize`, `corb.side`, `corb.installAsked`, `corb.lastBuild`.
- Theme: `profile.theme` is `light` (default), `dark` or `system`; the pre-paint script in `index.html` and
  `applyTheme()` in the router set `html[data-theme]` (`system` removes it and `01-tokens.css` follows
  `prefers-color-scheme`). `CORB.setTheme(t)`; `CORB.toggleTheme()` flips day and night.
- Text size: `profile.textSize` 0 to 3 → `html[data-text]` (`01-tokens.css`); `CORB.setTextSize(n)`, `CORB.cycleTextSize()`.
- The side menu: `CORB.setSideMini(on)` sets `html[data-side="mini"]` (a rail of icons, wide screens only); the top-bar
  menu button collapses it on a wide screen and opens it on a phone. Nav buttons carry `data-mini-tip` for the floating
  name beside a rail icon.
- `#app` is not a live region; the toasts container is (`role="status" aria-live="polite"`). On navigation to another
  view the router moves focus to `#content` (`tabindex="-1"`); `.skip-link` is the first Tab stop.
- `meta.next_board` is recomputed at boot by `CORB.util.nextBoard(meta)` from `meta.board_rule` ({week, weekday}; the
  411th's second Wednesday) whenever the stored date has passed.
- Read-aloud (`05-speech.js`) is the engine shared with B2B Exam Prep: `sp.voices()`, `sp.setVoice(id)`
  (`settings.voice`), `sp.segments(text)`, `settings.ttsTone` `lively` | `even`; `sp.listen()` is Board Ready's own.
- Owner and terms (1.2.1): `meta.owner`, `meta.copyright`, `meta.terms` {title, version, intro, points[], agree};
  `CORB.terms.require(then)` runs after the install page and before the tour offer (router boot); `CORB.terms.show()`
  is the reading copy (About, side foot). A new `terms.version` asks everyone again (`settings.termsAccepted`).
- `meta.site_url` is the website; `meta.app_qr` (rows of 0/1 from `tools/make_handout.py`) is drawn by `CORB.ui.qrSvg()`
  on the About page and the install page. `meta.whats_new` [{version, date, title, items[]}] is About's version list.
  Settings → Get the app shows install and downloads in the web edition and the website address in a single file.
- Touch screens (`pointer: coarse`, 1.2.3): every `.btn` (all sizes; small and icon buttons at least 44 px wide), `.input`/`.select`, `.chip`,
  `.tabs button`, `.switch`, `.rate button`, `.side .nav`, `.mobile-nav button` and `.topbar .unit-select` are at least
  44 px tall (`03-components.css`, `04-shell.css`); `.seg` keeps a 2 px rim around 40 px segments (46 px in all). A view that sizes a
  control itself (rating keys, the process jump buttons, the regulations tabs, the projector timer, letter and team
  buttons, search fields) repeats 44 px in a `pointer: coarse` block at the end of its stylesheet, and a small × that
  must stay small (`.tour-x`, `.gl-clear`, `.lib-clear`, `.res-clear`) gets a 44 px hit area through `::before`. Keep new
  controls at 44 px on touch. Top-bar tooltips open below the bar and align to the window edge at both ends
  (`03-components.css`).
- 1.2.2: `tools/build.py` copies `handout/` (the QR code and the install sheet from `tools/make_handout.py`) into
  `dist/web/handout/`, so the website serves `handout/Board_Ready_Install_Sheet.html`; Settings → Get the app → Share it
  (web edition) and About → Get it on your phone link to it and copy the link. About's "What is inside" counts the
  modules of this build (`CORB.DATA`, `ARCADE.games`). `CORB.terms.available()`; the first-use dialog (`show(onAgree)`)
  has no close button and `require()` brings it back if it is dismissed another way, until the reader agrees. The
  landing page footer shows `meta.copyright` and opens the terms. `check_content.py` requires `owner`, `copyright`,
  `site_url`, `terms` {version, points, agree}, a square `app_qr`, a self-contained install sheet that shows `site_url`,
  and a `whats_new` entry for the current version. READ ME FIRST (`make_docx.py`) names the owner and the website.
  The modal header and footer are sticky inside the scrolling `.modal` (`03-components.css`), so Close and I agree
  stay in view on a phone while a long body such as the terms scrolls.
- Content that is not in the source lists goes in `tools/content_patches.py` as a dated function; `merge_content.py`
  applies it before writing `src/data`, so a merge never undoes it. `regulations.updates[]` (`{id, date, title, text,
  url, status, source}`) is the "What changed" panel in the Regulation explorer.
