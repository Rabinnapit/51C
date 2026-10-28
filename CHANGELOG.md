# Changelog

## 0.13.0 (28 October 2026): official documents, picture explanations and Supply Line

- **Supply Line**, a new Arcade game (a story convoy, original to B2B Guide): lead two trucks from the Ops Center to
  FOB Keystone through five checkpoints, one for each part of the contract life cycle (Ops Center: Guiding Principles,
  Market Square: Pre-Award, River Bridge: Award, Supply Depot: Post-Award, FOB Gate: all four). At each stop a contact
  sets the scene and six crates wait: a right answer loads a crate onto the truck, a wrong answer costs fuel and the radio
  explains the right answer with its citation. All six earn the checkpoint's gold challenge coin (four or five, silver).
  Run one checkpoint or the full 30-question mission, which ends with the gate opening. Route map, day-to-night scenes,
  phone layout, and a new exam path task in week 18 (the full mission).
- **Official documents** (Get certified → Official documents): 26 documents from the DPCAP Contract Policy workforce page
  and the WarU iCatalog, grouped into the exam, what certification takes, after certification, and background policy.
  Each opens with a **Simple version** (pictures, icons and short sentences for readers of every English level) and an
  **Official document** switch. Eight PDFs (27 pages) are stored inside the file as images, so the real exam FAQ, roadmap,
  flowchart, CON 7300V memo, Career Field Model, Competency Model, reciprocity FAQs and CL memo open offline, with zoom
  and full screen. The rest link to the official site; the broken 2024 A&S Workforce Framework link is flagged.
- **Certification 101 with pictures:** the exam as a road of 11 picture steps colour-coded by who acts (you, supervisor and
  training office, WarU, Pearson) with the official step numbers, the test center or OnVUE choice, the pass and fail
  branches, the four systems behind the scenes, and six fine-print cards (48-hour rule, reschedule versus cancel, the
  90-day window, matching ID names, cancelling in AITAS and Pearson, accommodations). Also pictures for the exam at a
  glance, retakes (including the fourth-try rule), the 36-month clock, continuous learning points, the career path,
  warrants, reciprocity and the WarU OJT tool. The words stay one tap away ("Read it in words").
- **New and corrected facts** from the official documents: continuous learning starts when you enter an acquisition
  position (DoDI 5000.66), not at certification, and the certification courses earn points (CON 1200V = 45); a waiver
  never certifies anyone; the 12 months of tries count from the first try; cancel in both AITAS and Pearson; the name on
  your ID must match Pearson; current credential codes (CCON 015B, 022A, 024A).
- **Tips from the WarU exam team** (June 2024 podcast and December 2024 webinar): study the competency model, use the
  CON 3910 practice exam as a diagnostic, know the UCF and common forms, read FAR Parts 1 and 15, learn the voice of the
  FAR. Six new FAQs; two WarU videos added to Official links.
- `tools/render_official.py` makes the page images from the official PDFs; the build embeds them as short base64 lines.

## 0.12.0 (28 October 2026): guided tour, About page and day mode

- **Guided tour** (same engine as Board Ready's): twelve stops that spotlight each part of the guide and say what it is
  for, on a computer or a phone. Offered once on first open; the ? button in the top bar, the ? key, Home and Settings &
  help start it again.
- **About** page (Help → About): what B2B Guide is and is not, the developer and maintainer (SFC Rabin Napit) with Send
  feedback and Report a problem buttons, live counts of what is inside, how it works offline, how it stays current with
  the latest changes, keyboard shortcuts, the disclaimer and credits. The old About tab in Settings & help forwards there.
  The Send feedback link stays in the side menu.
- **Side menu collapses** to a rail of icons on a wide screen (the menu button or "Collapse menu"); hovering an icon shows
  its name. The choice is remembered. On a phone the menu button still opens the full menu.
- **Day mode is the default.** Settings & help → Display offers Day, Night or Match my device.
- Top bar labels (Text size, Day / night, Tour) open below their buttons instead of running off the top of the window.
- **Contract Quest:** a right answer fires your RPG (aim, backblast, a rocket on a smoke trail, an explosion) instead of
  running in with a pen; a Warrant Strike fires a golden volley of three.

## 0.11.0 (28 October 2026): the B2B Arcade

- **Arcade** (Practice → Arcade, in place of Games): five canvas action games built on the guide's checked content, on an engine
  shaped like Board Ready's so the two arcades can merge:
  - **Contract Quest**: RPG battles. Five realms (one per exam area plus the Exam Citadel), two monsters and a boss each, bank
    questions as attacks, streaks, fast-answer hits, a Warrant Strike, 50/50 scrolls and potions, realm stars.
  - **Fire Mission**: artillery with wind, craters and observer corrections; targets carry dollar thresholds, deadlines, forms,
    J&A approvers and contract types; a battery rating at the end.
  - **Qual Range**: pop-up targets for the glossary (expansions first, then definitions); 20 exposures and 30 rounds, scored
    Expert, Sharpshooter or Marksman like a rifle table.
  - **Part Patrol**: a vertical space shooter on FAR parts, UCF sections and PIID letters, with drones, power-ups and an Audit
    Dreadnought boss that asks bank questions.
  - **Sort Yard**: a conveyor sorting line for life-cycle phases, dollar lanes, UCF parts and contract-type families, with Rush mode.
- Four paces (Recruit waits for Go on every question), XP and ten ranks from Trainee to Contracting Legend, question memory
  (missed items come back), sound effects, optional music, read-aloud of each question, and a study list with the reason, the
  cite and the lesson after every run. Missed bank questions also go to Practice test → Missed questions.
- Scores, XP, realm stars and question memory are part of your progress (exported, and saved into the file).
- **Exam path:** nine Arcade tasks across the six months (Contract Quest realms in weeks 4, 8, 12, 16 and 22, Qual Range in
  week 6, Sort Yard in week 7, Fire Mission in week 11, Part Patrol in week 20). A run started from a task ticks it.
- The four old games are now **Quick drills** (tap-to-answer, screen-reader friendly), listed at the bottom of the Arcade lobby.
- `check_content.py` knows the Arcade game ids and Contract Quest realms; the dev page loads files with a version stamp.

## 0.10.0 (28 October 2026): 6-Month Exam Path and the B2B class materials

- **Exam path** (new, second in the menu and on the phone bar): 26 dated weeks from the reader's start date, each with a goal,
  lessons, a FAR reading, flashcards and a 10-question check, in course order (CON 1100V, 1200V, 1400V, 1300V, 7300V, CON 3910).
  Monthly timed checkpoints with target scores (60%, 65%, 70%, 70%, then two full 150-question simulations at 75%), exam in week 24,
  after-the-exam steps in weeks 25 and 26. Drills tick themselves and keep the best score; Home shows this week's progress.
- **Class material check:** the Back to Basics class materials (Day 1, 3, 4 and 5 slides, the practice exam, the Jeopardy review,
  the FAR parts pop quiz and two sets of test-taker notes) checked against the RFO FAR on acquisition.gov. 52 claims are listed
  with what the class said, what the FAR says now, and a status. The Contracting Study Guide V9 is protected by an Army sensitivity
  label and was not opened.
- **Practice test:** 143 class practice questions added (91 still right, 38 updated, 14 corrected; each shows what changed),
  34 new questions on topics past test takers reported, and a "From your B2B class" card. Bank: 374 questions.
- **Flashcards:** four new decks: B2B Jeopardy review, UCF sections, common forms, PIID letters.
- **Fixes:** the commercial-buys lesson no longer lists 52.212-5 (reserved under the RFO, as is 52.212-3).
- `check_content.py` now checks the path (lessons, courses, decks, games, question sets) and the class question fields.

## 0.9.0 (23 October 2026): first test version

- Plan builder: three questions (51C / 1102 / mentor, start date, goal) produce a dated checklist with a timeline to the
  36-month deadline; ticks, calendar export and print.
- Certification 101: requirements (including CON 7300V from 1 Oct 2026), course order, AITAS sign-up, exam facts and the
  official 150-question blueprint, registration steps, test day, retakes, experience checklist, continuous learning,
  credentials, reciprocity, FAQ, sources.
- 19 courses, 35 lessons, 13 how-to guides, 197 practice questions with a timed exam simulator, 10 flashcard decks,
  4 games, 243 glossary terms, FAR & key numbers (RFO numbering), 35 official links.
- Read-aloud, four text sizes, day/night, search, offline single file, save progress into the file, export/import.
- Editions: offline file, GitHub Pages website (installable, self-updating) and a claude.ai preview.
