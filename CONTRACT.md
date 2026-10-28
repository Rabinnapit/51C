# B2B Guide: build contract

Read this before changing code or content. It mirrors Board Ready's `app/docs/CONTRACT.md` so the two apps can be fused.

## 1. Hard constraints

1. **Ships as one self-contained HTML file** built by `tools/build.py` from `src/`. No CDN, no web fonts, no `fetch` of
   local files, no ES modules. Fonts are base64 in `src/css/00-fonts.css`.
2. **Works from `file://`** and on Army NIPR Edge laptops, phones and tablets, down to 360 px wide.
3. **Browser storage may throw or be wiped.** Touch it only through `CORB.store.safeGet/safeSet/safeDel`. The app must work
   with storage blocked; progress can be exported to a file and saved into the HTML file itself.
4. **No network code** in the offline and preview editions. All network code (service worker, version check) lives in
   `src/js/core/09-pwa.js`, which only the web edition includes; the build fails if `fetch(` or similar leaks elsewhere.
5. **No PII** except the maintainer contact in `meta.json`, shown at the maintainer's request.
6. **Training aid, not authoritative.** Anything local or uncertain carries a visible "Verify locally" note (`verify` field).
7. **Storage keys are `b2b.*`**, never Board Ready's `corb.*`: every `file://` page shares one origin.

## 2. Editions (`meta.edition`, set by the build)

| Edition | File | Differences |
|---|---|---|
| `offline` | `dist/B2B-Guide.html` (also `docs/B2B-Guide.html`) | Save progress into the file; no network code |
| `web` | `docs/index.html` + `manifest.webmanifest` + `sw.js` + `version.json` + `icons/` | Installable app, offline cache, "newer version" bar, download links for the offline file and Word package |
| `preview` | `dist/B2B-Guide-Preview.html` | For a claude.ai artifact: no outer `<html>` tags, downloads and printing hidden |

`CORB.can('download' | 'print' | 'saveFile' | 'install')` tells a view what the edition allows.

## 3. Source layout

```
src/index.html            template: theme/text-size boot script, embeddedState block, placeholders
src/css/00-fonts.css      embedded fonts (tools/fetch_fonts.py)
src/css/01-tokens.css     colour, type, spacing tokens; light + dark (system and explicit); text sizes; phase colours
src/css/02-base.css       reset, type, shell layout, utilities, print
src/css/03-components.css buttons, cards, badges, inputs, choice cards, check items, modal, toast, rich text, glossary popover
src/css/04-shell.css      side menu (and its collapsed icon rail), top bar, phone bar, search palette, update bar
src/css/05-tour.css       the guided tour
src/css/views/<view>.css  one file per view, selectors prefixed .v-<view> (shared course-flow styles live in cert.css)
src/js/core/00-namespace  CORB namespace, events, registerView, editions, date helpers (local dates only)
src/js/core/01-store      state, persistence, export/import, save progress into the file
src/js/core/02-router     hash routing, shell, theme, text size, keyboard, boot
src/js/core/03-ui         h(), icons, badges, rich text (bold, lists, cite links, glossary links), modal, toast, palette
src/js/core/04-data       queries over CORB_DATA, search index, citation URLs (FAR cites open the RFO part page)
src/js/core/05-speech     read-aloud in sentence-sized chunks
src/js/core/06-learning   SM-2 lite flashcards, quiz records, readiness by exam area, streak
src/js/core/07-plan       dated plan: goal, 12-month experience, 36-month deadline, step status, .ics export
src/js/core/08-tour       the guided tour (same engine as Board Ready's): spotlight + card, offered once, ? button and ? key
src/js/core/09-pwa        web edition only: service worker, update bar, install prompt
src/js/views/*.js         home, path, plan, cert, courses, official, learn (+ lesson), howto, quiz, cards, arcade, games (quick drills), glossary, far, links, settings, about;
                          explain.js is not a view: the picture explainers (CORB.explain) shared by cert and official
src/js/arcade/00-engine   window.ARCADE: register, palette, storage through A.host, pace levels, XP ranks, question memory, text, particles, floaters, sound, music
src/js/arcade/01-shell   lobby, play screen (HUD, prompt panel, fluid canvas, answer panel, reading pause, pause menu), results with the study list
src/js/arcade/games/*.js contract-quest, supply-line, fire-mission, qual-range, part-patrol, sort-yard
src/data/*.json           content (see section 4). <module>-<part>.json files join into <module>.
src/official/*.webp       official document pages, <doc id>-<page>.webp, made by tools/render_official.py from the PDFs
                          (PDFs stay out of git); the build embeds them as the `pages` module
src/web/                  icons (tools/make_icons.py), favicon.svg, sw.js template
```

Script order in the build: data, then `core/*` in file order, then `views/*`, then `arcade/*` and `arcade/games/*`, then the boot block, which must stay last
(it snapshots the page for "save progress into this file").

## 4. Data modules (`window.CORB_DATA`)

- `meta`: app_name, version, content_verified_on, site_url (filled automatically on GitHub Actions), experience_months,
  deadline_months, maintainer, disclaimer, currency, credits. The build adds `built_on`, `build_id`, `edition`.
- `cert`: `phases` (the four exam areas with the official question counts; they must total 150), requirements, deadlines,
  roles, education, register (steps, tips, verify), exam (facts with icon, source, study, study_source, testday, retake), experience (items), after, faq, sources.
- `official`: `{lede, checked, hub, groups: [{id, title, icon}], docs: [{id, group, icon, title, who, date, url, kind?: web|xlsx, broken?, simple?: [explainer], summary}], explain: {owners, journey, attempts, grace, fy27, requirements, career, cl, reciprocity, ojt, warrant}}`.
  `simple` names picture versions drawn by `CORB.explain.render(key)`: journey, examfacts, blueprint, attempts, grace, fy27, requirements, competency, career, cl, reciprocity, ojt, warrant.
- `pages` (built, not a data file): `{doc id: [[base64 line, ...] per page]}` from `src/official/`. `CORB.official.src(id, n)` returns a page as a data: URL.
- `courses`: `[{id, code, short, title, group: required|prereq|prep|exam|recommended, delivery, length, clps, prereq_text, about, learn[], before[], pass[], notes[], lessons[], url, verified_on}]`
- `plan`: `{baseline_days: 182, steps: [{id, phase: setup|courses|exam|certify|after, day | months, title, detail, who, course?, howto?, lesson?, auto?: exam|experience|goal, tracks?: [51c|1102], verify?}]}`.
  `day` values spread across a 6-month goal and scale to the reader's own goal; `months` are fixed from the start date.
- `lessons` (`lessons-1..5-*.json`): `[{id, phase: gp|pre|awd|post|job, comp, compName, title, minutes, summary, why, sections: [{h, body}], example: {title, body}, remember[], mistakes[], terms[], cites[], verify?}]`
- `quiz` (`quiz-1..6-*.json`): `[{id, lesson, phase, comp, d: 1-3, stem, options: [{text, correct, why}] (4 options, exactly one correct), cite, src?, check?, note?, verify?}]`.
  Same option shape as Board Ready's `mcq.json`, so either app's quiz can run the other's questions. `quiz-6-class-*.json` holds the B2B
  class material: `src: 'class'` questions (ids C…) carry `check: same | updated | fixed` and, when changed, a `note` saying what changed
  under the RFO; `src: 'tips'` questions (ids T…) cover topics past test takers reported. Recalled real exam questions are never copied.
- `path`: the 6-month exam path. `{title, lede, baseline_days: 182, exam_week, checked_on, how[], months: [{n, title, sub, phase}],
  weeks: [{n, m, title, goal, tasks: [{id, kind, t?, d?, …}], tip, class}], files[], checks: [{topic, src, said, now, status: ok|updated|fixed|verify, cite, verify?}], intel: [{t, d, lesson?, deck?}]}`.
  Task kinds: `lesson` (lesson), `read` (far: part number), `cards` (deck), `drill` (lessons[] | src | phase | missed | weak, n), `exam` (timed, n, target),
  `course` (course), `game` (game: an Arcade id or a quick drill id; `realm` gp|pre|awd|post|all opens a Contract Quest realm or a Supply Line checkpoint; Supply Line also takes `mission`, the full run), `do` and `realexam` (view, params).
  Week dates scale like `plan` steps (`baseline_days`). An Arcade run started from a task ticks it after three or more answers.
- `glossary`: `[{term, expansion, definition, cat, cite?}]` (Board Ready uses the same fields with `domain` for `cat`).
  Terms that look like acronyms are tapped-to-define everywhere in rich text.
- `howto`: `[{id, cat: career|job, title, when, who, time, steps: [{t, d, cite?}], tips[], watch[], lessons[], links[], verify?}]`
- `far` (`far.json` + `far-parts.json`): basics, parts (1 to 53 with `exam: true` on the 20 the exam names), crosswalk, numbers, deadlines, notes.
- `updates`: `far_updates` (newest first) and `guide_changes`.
- `links`: `[{group, title, url, access: public|cac, note}]`
- `games`: risk_order, phase_sort, threshold (the quick drills; `phase_sort` is also Sort Yard's first line). `cards`: extra flashcard decks.
- The Arcade has no data file of its own: `views/arcade.js` builds `ARCADE.DATA` from the modules above: `bank` (quiz), `facts`
  (fam dollars|days|form|ja|type|part|ucf|piid from `far` numbers, deadlines and parts and the forms, UCF, PIID and contract-type decks),
  `terms` (glossary with the term blanked in its own definition), `sorts` (life cycle, dollar lanes from the MPT and SAT, UCF parts,
  contract-type families) and `quick` (the quick drills). Change the content and the games follow.

Text fields are plain text: blank line = new paragraph, `- ` = bullet, `1. ` = numbered, `**bold**`. FAR, DFARS, AFARS,
U.S.C. and CFR citations are linked automatically. No HTML in content.

## 5. Content rules

1. Cite **RFO numbering** (in force for DoW since 1 February 2026); `far.json` keeps the old-to-new pairs.
2. Prefer part-level cites when a section number is uncertain. Never invent local procedures or approval levels; describe
   the role ("your Acquisition Training Office") and add a `verify` note.
3. Every practice question explains every option. Practice questions are written for the guide; never copy real exam items.
4. Plain language for someone in their first week: short sentences, define every acronym in the glossary.
5. Date anything that will age ("checked 22 October 2026") and add it to `updates.json` when it changes.
6. Run `python tools/check_content.py` before committing.

## 6. Core API (shared with Board Ready)

```js
CORB.registerView({ id, title, section, icon, nav, order, mobile, short, navAs, mobileAs, badge(), render(root, ctx), onLeave() })
CORB.go(id, params)  CORB.route()  CORB.render()
CORB.get(path, fallback)  CORB.set(path, value, {silent, noPersist})  CORB.update(path, fn)  CORB.push(path, item, cap)  CORB.touch(id)
CORB.store.safeGet/safeSet/safeDel  exportProgress()  importProgress(file)  saveProgressToFile()  resetProgress()  resetAll()
CORB.ui.h  icon  badge  phaseBadge  verifyBadge  rich  inline  callout  checkItem  listenBtn  modal  confirm  toast  palette  showTerm
CORB.data.phases/phase  lessons/lesson/nextLesson  questions/questionsFor  glossary/term  courses/course  howtos  farParts  search  citeUrl
CORB.speech.speak/stop   CORB.scoring.srs.grade/isDue   CORB.scoring.readiness()   CORB.plan.steps()/goal()/deadline()/ics()
CORB.path.currentWeek()/week(n)/weekStart(n)/taskDone(t)/weekStats(w)/progress()   CORB.quiz.start({mode, n, label, phase, lessons, src, path})
CORB.edition()  CORB.can(what)  CORB.setTheme('light' | 'dark' | 'system')  CORB.setTextSize  CORB.setSideMini(on)
CORB.tour.start() / offer() / stop() / running()   CORB.decks()   (the flashcard decks, counted on the About page)
```

The Arcade (same shape as Board Ready's, so the two can merge):

```js
ARCADE.register({ id, title, icon, accent, genre, tagline, drills, controls, music, aspect: [lo, hi], orient, gateAt, countdown, letterKeys,
                  noLives, livesLabel, livesText(state), outTitle, dataOk(DATA), thumb(ctx, w, h, t), create(api) -> { update(dt), draw(ctx), resize(W, H), onKey(k, down), onPointer(e), destroy() } })
api.W / api.H (fluid: logical px = CSS px up to 960 x 900, inside the game's aspect range)  api.difficulty  api.opts  api.progress.pick(pool, keyOf) / correct()
api.prompt.set({kicker, text, sub, color, big})  api.choices.set(items, onPick, {readOnly}) / lock / mark / disable / feedback({ok, title, body, cite, auto}, next) / tools(list) / timer(frac) / clear
api.ready({text})  api.review.add({prompt, given, correct, ok, explanation, cite, lesson, qid, key})  api.score(n)  api.life(n)  api.xp(n)  api.end({won, title, message, badge, xpBonus})
api.hud.set({...})  api.particles  api.floaters  api.audio  api.music  api.shake(px)  api.flash(color)
ARCADE.host = { get(k), set(k, v, quiet), speak(text), onAnswer(qid, ok), onRunEnd(summary), lessonHref(id), pathHref() }   (set by views/arcade.js)
ARCADE._debug.play(id, opts) / start() / step(seconds) / run()   (automated checks; no UI)
```

State (`b2b.state.v1`): `{version: 'b2b-state-1', profile: {track, start, goalMonths, goalDate, theme ('' or 'light' = day, the default; 'dark'; 'system'), textSize}, progress: {steps, courses, lessons, checks, quiz, missed, srs, howto, exp, games, exam, seen, bookmarks, path, arcade: {best, xp, quest, rot}}, settings: {tts, ttsRate, glossaryLinks, motion, setupDone, welcomeSeen, tourSeen, arcade: {tier, mute, music}}. Browser-only keys: `b2b.theme`, `b2b.textsize`, `b2b.side` ('mini' = the collapsed menu), meta: {updatedAt, lastOpened}}`.
The copy saved inside the HTML file wins over the browser's copy when its `meta.updatedAt` is newer.

## 7. Fusing with Board Ready (the "ultimate guide")

The goal is one app a 51C or 1102 uses from day one through the warrant board and beyond.

1. **Shell:** keep one shell (Board Ready's or this one) and add a top-level "career phase" choice: New (B2B) and Warrant
   (Board Ready). Both apps already register views the same way, so views move over unchanged; rename collisions
   (`home`, `glossary`, `quiz`, `cards`, `settings`, `about`) by prefix, for example `b2b-quiz`.
2. **Data:** merge `glossary` (same fields), feed B2B `quiz` items into Board Ready's quiz and Arcade (same option shape),
   merge `links` into Board Ready `resources`, and reuse Board Ready's verified `regulations.json` crosswalk and thresholds
   as the single source for `far.json` numbers.
3. **Core:** start from Board Ready's core (roles, units, warrant classes, connector, Arcade) and add this app's extras:
   text size, glossary auto-links, plan math (`07-plan.js`), editions and PWA (`09-pwa.js`).
4. **Storage:** migrate `b2b.state.v1` into the merged state once, on first open.
5. **Design:** both use tokenized CSS; pick one palette and keep B2B's phase colours for the exam areas.
6. **Arcade:** both arcades use `window.ARCADE`, `A.register` and `def.create(api)`. Keep this engine (fluid canvas, prompt and
   answer panels, `A.host` storage); Board Ready's eight games draw on a fixed 960 x 540 stage, so give them `aspect: [16/9, 16/9]`
   and they fit unchanged. Board Ready's warrant-class filter becomes a second lobby setting next to the pace.
