# Changelog

## 0.25.1 (30 October 2026): the sweep

- **Eleven more questions** on the three thin job lessons: contingency thresholds and the determination behind them,
  the field ordering officer, the SF 44, SAM registration and exclusions, ACWS, why system roles are requested in
  week one, exam attempts and spacing, closed book, CON 3900V after a failed try, and the 72 seconds a question.
- **Lesson 33 cite fixed.** Contractor personnel accountability and SPOT are DFARS 225.371-3 and clause 252.225-7040,
  not DFARS 225.770 (which is the Chinese military companies prohibition).
- **Buddy answers voice questions** ("male voice", "accent", "robotic") with where the App voices are and which are men.
- **Bigger tap targets on phones.** FAR cite chips, the Play button on lesson pictures, the glossary letter buttons and
  the top-bar buttons no longer fall under 36 pixels on narrow screens; the top-bar buttons stop shrinking under a
  long title. Every screen was checked at phone width for sideways scrolling, unlabeled buttons and clipped text.

## 0.25.0 (30 October 2026): Range Day, the first game in real 3D

- **Range Day.** The qualification range rebuilt in real 3D, first in the Arcade: the tower reads a glossary clue, three
  plywood targets pop up downrange carrying terms, and you fire an M4A1 at the right one before they drop. Twenty
  exposures and thirty rounds a table, scored like a rifle table: 18 hits Expert, 15 Sharpshooter, 12 Marksman. Paces,
  rounds, the reading pause, XP, ranks and the study list all work as in every other game; missed terms come back.
- **How it looks.** Physically based materials with textures generated in code (sand, dirt, plywood, paper, gunmetal), an
  HDR sky whose sun also lights the metal, soft shadows, haze, terrain with hills, trees, rocks, sandbags, the range
  tower, and a post pass with bloom, vignette and film grain. The rifle is an M4A1 as the Army issues it: flat-top
  upper with an M68 close-combat optic, rail with tan covers and a PEQ-15, vertical grip, A2 flash hider, 30-round
  magazine. Every shot has a muzzle flash that lights the lane, smoke, ejected brass, a camera kick and recoil; every
  hit has splinters, sparks, dust, a bullet hole, a 60 ms freeze and a buzz on Android.
- **The feel kit.** A shared module for all games: Less motion awareness, haptics, hit-stop, trauma shake and layered
  sounds. Range Day lowers its own picture quality by itself on a slow phone.
- **three.js** (MIT License) is now bundled inside the single file, which grows by about 0.65 MB. The offline NIPR
  edition stays network-free: the library's loaders are never used, and the build still checks every edition.
- The lobby, the tour and Home now say seven games. Qual Range, the 2D version of the same drill, stays.

## 0.24.0 (30 October 2026): the app's own voices

- **Four voices that sound the same on every phone.** Settings & help → Display → Read aloud → Voice now lists App
  voices: Amber and Joe (US, a woman and a man) and Cori and Leo (UK). Each is a one-time download of about 63 MB,
  plus 31 MB for the speech engine the first time, from the owner's GitHub page (not a cloud service); after that it
  works offline, on the website and the installed app. Pick one and it downloads with a progress bar, then speaks the
  sample. Remove any of them under "About the app voices".
- **Why.** On Android, Chrome ignores the voice you pick from the phone's list and always uses the system default, so
  the five "voices" the phone offered all sounded the same (and all female). The app voices are Piper neural voices
  run on the device with ONNX Runtime Web in a worker, so the accent and the gender you choose are what you hear.
  The phone's own voices stay available, and Apple's Enhanced and Premium voices remain the best choice on an iPhone.
- The offline NIPR file is unchanged: it cannot download anything, so it keeps using the computer's voices.

## 0.23.2 (29 October 2026): the terms say what Google shares

- **Terms of use updated** (version 2026-10-29.5, so everyone agrees once more on their next open): the privacy point
  now says an account can be created with an email address and a password or with a Google account, and that a Google
  sign-in also passes on the profile picture link Google shares; nothing else is collected. The account card on
  Settings & help and README → Accounts say the same.
- **Continue with Google while offline** now says to connect first, instead of opening a browser error page.
- README: What is inside lists the optional accounts; Accounts has the Google Cloud project and client details.

## 0.23.1 (29 October 2026): what the owner confirmed

- From the owner's own experience in contracting support brigades: the local certification goal is 6 months in most
  of them (Home setup, My plan, the FAQ); a system role takes two to three weeks to approve (Lesson 34); MICC's
  onboarding program is Next Generation Acquisition Professional (NGAP) and other brigades run their own (My plan);
  the certification request goes through CAMP and only authorized personnel can submit it (FAQ, how-to); a Soldier
  who will miss the 36-month deadline is usually covered by an exception to policy (FAQ). `content/VERIFY.md` says what
  is still open, and `content/RFI-2026-10-29.md` is the request for information the owner is sending to get it.

## 0.23.0 (29 October 2026): Continue with Google

- **Sign in with Google.** The sign-in and create-account pop-ups now start with a Continue with Google button: one tap
  with a Google account, no password to make up or remember, and the app says hello by the name on that account.
  Progress saves to the account the same way as with an email address and a password, and the two ways can be mixed:
  an email account and a Google account with the same address are the same reader. Switched on by the owner in the
  Supabase and Google Cloud dashboards (README → Accounts); the Google client secret lives only there, never in the app
  or this repository. Password reset stays off: the app still sends no email. A Google sign-in finished too late (the
  sign-in link lives a few minutes) now says so and asks for another tap, instead of landing silently on Home.

## 0.22.0 (29 October 2026): the content audit

- **Every lesson and question read against the FAR Overhaul.** All 35 lessons and 384 questions were checked, cite by
  cite, against the RFO part pages on acquisition.gov (Parts 1, 3, 4, 5, 7 to 13, 15, 17, 18, 22, 32, 33, 37, 42 to 44,
  46, 47 and 49) and DFARS Part 237. Thirteen corrections, the largest in Lesson 1: the guiding principles are now the
  seven RFO principles in FAR 1.102(a), not the pre-overhaul "best value, public trust, public policy" vision. Others:
  DFARS 237.172 for the QASP (237.872 does not exist), FAR 47.303 and 46.505 for f.o.b. terms and risk of loss,
  FAR 10.001 and 15.101(c) for sources sought notices and RFIs (5.103 is FFRDC and bundling notices now), the RFO
  wording of the competitive range and clarifications, 15.404 "Cost and/or price analysis", the 52.212 clauses in the
  commercial example, CCON 015B, and tighter answers on sealed bidding and the order of sources. The full log is in
  `content/AUDIT-2026-10-29.md`.
- **Seven glossary terms added** that the lessons and questions used without defining: PIID, GSAR, CBAR, QAR, SSDD, DFAS
  and EPA (250 terms).
- **Check yourself is short again.** A lesson's end-of-lesson check shows up to six of its own questions; the class and
  test-taker questions on the same topic (up to 32 on one lesson) sit behind "Practice all N questions on this lesson".
- **Keyboard in the Practice test.** 1 to 4 or A to D answer, Enter or → next; in the exam simulator ← back and F flag.
  Listed in Settings & help → Keyboard.

## 0.21.1 (29 October 2026): Buddy's bubble draws itself

- On the same 12-second beat as the nudge, the chat bubble's outline draws itself from a dot at its tail and three
  typing dots pop in one after another, so the icon reads as "someone to talk to" rather than a flat dialog box.
  Static (and the nudge off) once Buddy has been opened, and always under Less motion.

## 0.21.0 (29 October 2026): rise and fall

- **Read-aloud talks like a person reads.** Text is now spoken piece by piece, each with its own tone: questions rise,
  sentences settle, a heading comes a little slower with a breath after it, a short list is said in one breath
  ("supervisor, training approver, and KMG"), a long one item by item, answer choices with a beat between them, a
  paragraph ends with a longer pause and the last sentence of a passage settles down. Lessons are read with their
  section titles, paragraphs and Remember bullets kept, how-tos step by step, flashcards front then back.
- **Tone setting.** Settings & help → Display → Read aloud has Lively (the default) and Even, beside the voice and
  speed. The first Listen tap shows once where to change the voice and tone.
- **More words said right.** FAR and DFARS cites read "fifteen point four oh four dash one", Part IV is "Part four",
  Table 4-2 is "Table 4 dash 2", a parenthesis becomes an aside between commas, plurals come out as "K O's", capitals
  used for emphasis (NOT, FIRST) stay words, SAM.gov is "sam dot gov", and CPARS, GFEBS, QASP, TINA, JAM, SPOT, FOO,
  FOIA, MICC, DFAS, GWAC, MIPR, DPCAP, BATNA, GAAP and a dozen more are said the way contracting people say them.
- **Buddy says hello.** The chat bubble lifts gently every 12 seconds, on the beat, with a soft ring, until Buddy has
  been opened once; never under Less motion.

## 0.20.0 (29 October 2026): a voice you choose, that talks like a person

- **Pick the voice.** Settings & help → Read aloud lists every English voice on the phone or computer, best first, with
  the natural ones (Apple's Enhanced and Premium voices, Google's and Samsung's on Android, Microsoft's natural voices
  in Edge) grouped at the top; "Best voice on this device" is the default. Hear a sample, set the speed, and read how
  to download a more human voice on an iPhone, Android, Windows or Mac.
- **Said the way people say it.** Read-aloud now spells or says acronyms the way contracting people do (K O, "core",
  "eye-tass", "dee-fars", "fifty-one charlie", "eleven oh two"), reads course numbers as "thirteen hundred V" and
  "thirty-nine ninety V", says "Department of War" for DoW, and turns bullets and markdown into pauses. Every Listen
  button, lesson picture and Buddy answer uses it.

## 0.19.2 (29 October 2026): the Contracting Master Gunner

- Your training contact is the **Contracting Master Gunner (KMG)**, the unit's senior 51C trainer: My plan, the exam
  path, the how-to guides, Certification 101, the official-documents pictures, the flashcards and the glossary now
  say so (the owner's correction). "Training NCO" and the "Acquisition Training Office" are gone; where AITAS needs
  a second approval after the supervisor, the text says "your organization's training approver in AITAS; your KMG
  knows who that is". The glossary's ATO entry became KMG.

## 0.19.1 (29 October 2026): $0 to run, and a persona pass

- **Accounts stay awake for free:** `.github/workflows/keepalive.yml` pings the Supabase project every third day, so the
  free plan never pauses it. No email password reset, by design (no email service to maintain): "Forgot your password?"
  now explains the no-email way (create a new account; the progress on the device stays) and points at Google sign-in
  once that is switched on.
- **Six readers walked through the app** on a phone-sized screen: a brand-new 51C on a Samsung, an 1102 on an iPhone,
  a sharp E-6 in a hurry, a reader with the largest text and less motion, an instructor checking claims, and a NIPR
  user with the offline file. Found: no page overflows at any text size, the quick menu and the chat bubble are at
  least 48 px to tap, less motion turns the scroll animation off, the offline file has Buddy and no network code, and
  the first open is install page → terms (291 words) → tour offer. Changed from their feedback: the eyebrow line is
  darker (4.5:1 contrast, it was 3.6:1), the proof chip names its year ("79% pass on the first try (FY26)"), Buddy's
  AI row says it needs the internet, and the chat bubble never covers the last button on a page.

## 0.19.0 (29 October 2026): Buddy, a new Home, pages that move

- **Buddy, the study buddy.** A chat bubble on every page, in every edition (the offline file too). Ask in plain
  words ("what is a KO", "how much is the SAT", "when do I have to protest", "how do I register in AITAS") and Buddy
  answers from the guide itself, on the device, with no internet and no AI account: it finds the passage that answers
  (glossary, FAR key numbers and deadlines, old-to-new numbers, lessons, certification facts and FAQ, the exam,
  registering, experience, after certification, courses, how-to guides, official documents, flashcards, practice
  questions, links, what changed), shows it with Open in the guide and Listen, lists other matches, and says "more"
  gives the rest. Buddy is not an AI and says so. **More depth? Ask Google AI Mode, ChatGPT or Claude:** one tap opens
  the reader's own AI with the question and the exam context (CON 3990V, the FAR after the 2026 overhaul) already
  typed; nothing leaves the device until that tap. Starter questions, greetings and "who are you" are built in. The
  name and tagline live in `meta.buddy`; the tour has a stop for it; Settings & help has an Ask Buddy button.
- **A Home page that sells it.** The first-visit hero now reads like an app, not a manual: "Zero to certified.", the
  free, fun way to pass CON 3990V, your plan in 30 seconds, lessons that play, 384 questions that explain themselves,
  made by a 51C for new 51Cs and 1102s, with proof chips (79% pass on the first try, FY26; 35 lessons and 384
  questions; no signal needed) and a soft glow behind it.
- **Pages that move.** Sections and cards rise into view as the reader scrolls, once per page, never on a redraw,
  and never when the reader has asked for less motion. Nothing can stay hidden: everything shows within four seconds
  regardless.

## 0.18.0 (29 October 2026): the install page, and accounts with a name

- **The install page.** Opening the website in a phone browser now shows one thing: the app's install page, with a
  single button for that phone, instead of the guide behind a pop-up. Android, Chrome: **Install app** opens Chrome's
  own install box, one tap. Samsung Internet (and Edge, Opera, Firefox and the browsers inside QR and social apps):
  **Install with Chrome** hands the page to Chrome, because those browsers build their own app package, which Google
  Play Protect blocks as "unsafe" (the warning readers saw with 0.17.0), or only make a browser shortcut. iPhone and
  iPad, Safari: the three taps (Share, Add to Home Screen, Add) with a pointer at the Share button, because Apple
  allows no install button on a website; other iPhone browsers get **Open in Safari**. After an install the page says
  so and points at the new icon. "Not now, use the website in this browser" stays, in small print, and waits three
  days before asking again. Settings & help → Install the app shows the same page again.
- **Accounts with a name; sign-up as a pop-up.** Sign in is now a button in the top bar of the website and the
  installed app. Creating an account asks for a name, an email address and a password, with an eye button to show the
  password, a terms-of-use checkbox and the terms to read right there. The guide then greets the reader by first name
  at the top of Home and in the account screen. The account screen (the initials in the top bar) saves now, changes
  the name, signs out, or deletes the account and its saved progress for good. Sign-in with Google and password reset
  are built in and switch on once the owner finishes the Google and Supabase setup (README, Accounts).
- The handout, About, Settings & help and the README describe the new install path. The website tells iPhones to
  label the app "B2B Prep" (apple-mobile-web-app-title), and the manifest names itself as a related app so Chrome can
  tell the page when the app is already installed.

## 0.17.0 (29 October 2026): optional accounts

- **Your progress in your account:** on the website and the installed app, Settings & help → Your account lets a reader
  create an account or sign in with an email and a password. Their progress then saves to the account a few seconds after
  every change and comes back on any other phone or computer where they sign in. A fresh device takes the account's
  progress; if a device and the account both have different progress, the reader chooses which to keep. Accounts are
  optional and the guide works the same without one. The offline file has no account code at all.
- Backend: the Supabase project **51C** (separate from the owner's other projects): a `progress` table where each
  signed-in reader can read and write only their own row, and a `signup` function that creates accounts that work at
  once (no confirmation email). Sources in `supabase/`. The terms of use, About and the tour now say what an account
  stores: the email address and the progress, nothing else.

## 0.16.0 (29 October 2026): B2B Exam Prep, install first

- **New name: B2B Exam Prep** (it was B2B Guide), to say plainly what it is for. The home-screen label is **B2B Prep**,
  short enough to show in full under the icon. The files follow: `B2B-Exam-Prep.html`, the Word package and the
  install sheet. The web address and the QR code do not change, and saved progress carries over. The terms of use
  name the new title, so everyone accepts them once more.
- **Install first:** anyone who opens the website in a phone or computer browser, most often from the QR code, now
  sees "Install B2B Exam Prep first" before anything else: one Install button where the browser allows it (Android,
  computers), picture steps for Safari on iPhone and iPad, or how to leave another app's browser. Continue in the
  browser goes on to the terms and the tour and waits three days before asking again. The installed app never asks.

## 0.15.0 (29 October 2026): what to trust from outside the guide

- **Study material from other places** on the exam page (Certification, The exam), in three picture cards: use first
  (CON 3910, the exam FAQ blueprint, the FAR Companion, the whole RFO in one searchable PDF, FAI's FAR Overhaul hub with
  WarU CONNECT Live, Pearson's demo test), check before you trust (Quizlet and other free sites: check the date, every
  dollar figure and every part title; the old "communications, discussions and clarifications" answer), and skip
  (sets sold as the real exam). The data is `exam.outside` in `cert.json`; `content/OUTSIDE-SOURCES.md` records what was
  checked on 29 October 2026 and why nothing outside was copied in.
- **Ten new practice questions** (384 in all) for the competencies the bank covered thinly against the official
  blueprint: 1.1 Skills and Roles, 1.5 Situational Assessment, 1.6 Team Dynamics, 2.2.1 Plan Sales, 2.2.2 Prepare Offer
  and 3.1.2 Plan Negotiations, written from the DoW Contracting Competency Model and RFO FAR 15.408-1, with balanced
  option lengths.
- **Five new official links:** FAR Companion (Version 2.0), the searchable RFO PDF, the FAR Overhaul FAQs, FAI's FAR
  Overhaul training hub and the Pearson VUE demo test.

## 0.14.2 (29 October 2026): install the app from the browser

- People who scan the QR code land in a browser, so the website now shows a **Get the B2B Guide app** card (after the
  terms and the tour offer): on Android and computers its **Install** button opens the device's own install dialog;
  on iPhone and iPad it opens picture steps for Safari's Share, Add to Home Screen. Inside another app's browser (some
  QR scanners) it says to open the page in Safari or Chrome first. Not now hides it for a week; the Help page has the
  same steps (Show me how to install). Web edition only: the offline file never shows it.

## 0.14.1 (29 October 2026): the phone app

- **B2B Guide is a free phone app** at https://rabinnapit.github.io/51C/, published from the public repository
  Rabinnapit/51C by the existing GitHub Pages workflow. Scan the QR code, open the link and add it to the home screen
  (iPhone: Safari, Share, Add to Home Screen; Android: Chrome, Install app). No app store, no account, no cost; it
  works offline after the first open, and every change pushed to GitHub reaches installed apps the next time they open.
- **Get it on your phone** on the About page: the QR code and the install steps, so anyone with the guide can share it.
- **Owner and terms of use:** on first open, B2B Guide now says it is owned by SFC Rabin Napit and asks the reader to
  accept short terms of use (free for personal study; share the link or unchanged copies; no copying, changing,
  rehosting or selling without written permission). The terms are on the About page and at the bottom of the side
  menu, the tour's first stop names the owner, the install sheet carries the notice, and the repository has a LICENSE.
- `tools/make_handout.py` makes the QR code (SVG and PNG) and a one-page install sheet to print (HTML and PDF) in
  `handout/`, modelled on the WHtR app's handout.

## 0.14.0 (29 October 2026): lesson pictures, a fairer question bank and the AITAS link

- **A picture at the top of every lesson** ("At a glance"): 49 diagrams across the 35 lessons, built from each lesson's
  own facts with icons and short labels, for readers of every English level. Among them: who does what on the team,
  where a warrant comes from, the rulebook layers and how to read a FAR citation, the three money rules, the dollar
  ladder from micro-purchase to negotiation, the contract-type risk scale, the J&A approval ladder, the debriefing and
  protest clocks, privity between the Government, the prime and the sub, unilateral versus bilateral modifications,
  convenience versus default, the closeout time limits and the exam blueprint. They reflow on phones, work in night
  mode and print. New `src/data/figs.json` and `views/lessonfig.js`.
- **Pictures that move and answer back:** each picture builds itself as it scrolls into view (not with reduced motion);
  **Play** lights up one part at a time and reads it aloud; tap a part of a contract to take it away (no consideration,
  no contract), fail one of the five allowable-cost tests, or tap a contract type to see who carries the risk. Five
  **Try it** tools answer for any dollar value you slide or type: which buying method fits, who approves a DoW J&A,
  whether a notice is needed, whether certified cost or pricing data are required (with the DoW 30 June 2026 switch)
  and whether a claim must be certified.
- **The question bank no longer gives answers away by length.** In 79% of the 374 questions the right answer was the
  longest option (in 60% by a wide margin), so "pick the longest" scored far above chance and practice scores looked
  better than real readiness. Options in 303 questions were rewritten: every right answer keeps its meaning, wrong
  options got plausible detail and padding came off right ones. The right answer is now the longest in 22% of
  questions, close to the 25% of pure chance, and clearly longer in 5%. The threshold drill got the same fix (from 15 of
  16 items to 1), and the content check now warns if the cue creeps back. This also makes the Arcade fairer.
- **Duplicates and a giveaway removed:** the Award bank's debriefing question is now a scenario (a losing offeror asks
  to see the winner's proposal) and the job-systems question now asks where signed DoW contracts are viewed (EDA),
  instead of repeating other questions. The exam-areas question no longer prints each area's question count in its
  options, which gave the answer away.
- **A fuller guided tour** (about 18 stops): it now says what B2B Guide is and opens the main pages, including Certification
  101, the new Official documents page, Courses, Lessons and a lesson's playable pictures, then How-to guides, Practice, the
  Arcade, Look it up (with Official links), search, reading aids and read-aloud, saving progress, and About and feedback.
- **AITAS link fixed:** Official links, Certification 101 (a new Open AITAS button on Sign up for courses) and the
  how-tos for the first week, registering for a course and scheduling the exam now open the AITAS landing page,
  https://www.atrrs.army.mil/Aitas/Public/Landing/, where you register for courses, instead of the ATRRS home page.

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
