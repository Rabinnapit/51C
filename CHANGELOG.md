# Changelog

## 0.31.2 (18 November 2026): Range Day never stops at an error

- **Range Day moves to Qual Range by itself.** The tester's Google Pixel 10 Pro XL passed the Arcade's first small 3D check,
  then refused to start the 3D range ("Error creating WebGL context"), so Range Day stopped at an error card. Now, when a
  phone will not start 3D, the same run goes straight on as Qual Range, the same drill in 2D, with the same mission, lesson
  or range-card settings, so it still counts. A short note says why once ("Same drill, in 2D"), or the lesson's opening
  card says it. 3D then stays off until the page is reloaded, and Range Day's cabinet says "Play in 2D". Links straight to
  one game (the exam path, the FAR and certification pages) take the same route.
- **The phone check says why.** When a browser refuses 3D, the Arcade's "Check this phone" report now gives the browser's
  own reason (for example, that 3D is turned off or was blocked on the page), so a tester can send it in.

## 0.31.1 (18 November 2026): sound on, and no Go button

- **The intro tries to start with sound.** A browser that allows it plays the intro with the voice at once. Phones refuse
  sound before the first tap (Apple and Google both do on a site the phone has not seen, and no web page can change that),
  so there it plays silently, captions in the picture, under a big "Tap for sound": one tap anywhere on the video plays it
  from the top with the voice. It replaces the small Sound on button the owner found easy to miss.
- **No more Go button.** At Recruit, the easiest pace, each new question waited for a Go button that a tester missed ("why
  is this not working?"). It now gets a long reading pause, about half again as long as Regular's (4 to 14 seconds by the
  length of the text), with a bar that fills, and the game goes on by itself; Space or a tap still starts it sooner.

## 0.31.0 (18 November 2026): what the field test found

- **Games in the lessons.** 26 of the 35 lessons now end with "Want to play a game on this topic?": a short game on that
  lesson's own questions or words. Four lessons meet their boss in Contract Quest (who can bind the Government, competition,
  changes, protests), contract types and buying lanes sort crates in Dispatch, word-rich lessons go to Range Day with the
  lesson's own terms, and the others run a Supply Line checkpoint loaded by the lesson's questions. The game opens on a card
  that names the lesson and its topics, and its results lead back to the lesson. Thin lessons keep only Check yourself, so
  not every lesson pushes a game.
- **Never stuck without 3D.** On a phone that cannot draw the 3D range (a Google Pixel 10 Pro XL in testing), Range Day's
  campaign and range-card missions play as Qual Range, the same drill in 2D, with the same terms and table size, and count
  for the mission; Range Day's cabinet says so and plays Qual Range instead of showing Locked. A month that is still locked
  says what opens it when tapped, the line under the months names the missions still to pass, and the Arcade shows how it
  works in three steps (range card, campaign, any game). The 3-2-1 count no longer runs over a game that could not start.
- **Read-aloud.** The voice stops when you move on: to another page, the next practice question, a flipped card, another
  tab or a closed pop-up (it went on reading the old question). Citations say "dash", never "minus": 52.212-1, -2 and -4,
  DFARS 215.103-2-70, DA PAM 600-25, contract numbers and the parts of a citation. While a lesson picture plays, the part
  being read pops and the others dim, so a key part's own outline (the contracting officer's) is no longer mistaken for it.
- **Links that land.** FAR citations open at the cited section on the RFO page, and a cited paragraph is scrolled to and
  marked (a text fragment of its opening words): `tools/far_anchors.py` reads the RFO pages and writes
  `src/data/far_anchors.json` (371 citations placed). Old FAR numbers quoted on purpose (the old-to-new table, the class
  material notes) are no longer links into pages where they do not exist; the table's RFO column now links. U.S. Code
  citations open the cited section on Cornell's Legal Information Institute (the House site's section links now answer
  "Page Not Found").
- **What changed lately** items open to the whole story: Home's three go straight to it, and the FAR page's list has
  Read more under each summary.
- **What the research found.** Writing the longer change notes against the official sources turned up four slips, now
  fixed: the first FAR Overhaul proposed rules did not cover "21 parts" (the Federal Register titles name 19; the
  count is gone); Executive Order 14275 keeps what law requires or sound buying needs and directs OFPP, and the
  plain-language rewrite is how OFPP and the FAR Council carried it out; the warrant explainer cited FAR 1.603-2, which
  the RFO does not have (now FAR 1.403-1); and WarU now lists the Proposal Analysis Credential as CCON 003B, not 003A.
- **Content.** The games and flashcards use KO, the Army's abbreviation, not CO (the glossary keeps CO as a lookup); a
  practice question and two exam-path notes say KO too. PD2 is gone (the Army retired it for ACWS). The Army's contract
  file is VCE-PCF, the Paperless Contract File (new glossary entry PCF). The KMG entry says just "Master Gunner".
  Dispatch's life-cycle line has a fourth bay, "Every phase" for Guiding Principles tasks (a tester was told "gp" was the
  answer with only pre-award, award and post-award to choose from).
- **The intro (teaser v1.3).** The read-aloud shot now shows lesson one's "Who does what" picture read by the app's own Joe
  voice, each card popping as it is said; the lessons shot plays lesson four's picture.

## 0.30.0 (16 November 2026): ready for everyone

- **The two-minute intro, first.** The first visit in a browser (the QR code, or a shared link) opens on the intro
  video, above the install page. It starts muted, because browsers only start a video by themselves without sound;
  its captions are in the picture and its words run under it, which helps readers whose first language is not English.
  "Sound on" plays it from the top with the voice; Skip, Escape or the end of the video go on to the install page. It
  never plays in the installed app, only once on a device, and waits on its poster with Data Saver on. "Watch the
  intro" in About and Settings & help (and on Home until the plan is built) plays it any time. The video streams from the website (about 14 MB); the
  offline file stays the same size and the service worker leaves the video alone.
- **The intro is up to date (teaser v1.2).** Filmed again from this version: the four-step onboarding, the Arcade with
  five games in real 3D and the range card, 395 questions, 254 terms. The narrator now says "four quick steps", "five of
  them in real 3D" and "two hundred fifty-four terms"; the official-documents caption no longer says all 26 are in the
  file (8 are). The independent video review's points are in too: Range Day now cuts in clean (no loading frames or
  stray cursor), Buddy's panel and Home's opening move no longer jump, and the files use standard video range
  (BT.709), so no player crushes their blacks.
- **Scan, press Install.** The QR code (About, the install sheet) carries `?install=1`, so a scan always opens the
  install page, even on a phone that chose "Not now" in the last three days. Android, any browser: one **Install app**
  button. Samsung Internet and the other Android browsers still hand the page to Chrome, because the copy they build is
  blocked by Google Play Protect on Android 14 and later (Samsung support issue 123, open since April 2026); the short
  list on the way is Chromium's own rule, so the page says "choose Chrome", and picking Samsung Internet now explains
  instead of looping. Chrome says so when the app is already installed. iPhone: the three taps (Share, Add to Home
  Screen, Add) in Safari and, since iOS 16.4, in Chrome and the other iPhone browsers; in Safari "Not now" sits at the
  top, so the arrow to Share can no longer cover it. Reprint the install sheet: `handout/` has the new code, its counts
  come from the content (35 lessons, 395 questions, seven games), and it now prints on one page.
- **What the 51C proponent said, in full.** The complete transcript of the October 2026 session, checked against
  USAASC's pages, adds only what bears on certification: in the Army, anyone not yet certified on 1 October 2026 needs CON
  7300V to certify, even after passing the exam; a new question, "CON 7300V is full. What do I
  do?" (waitlists into May 2027, no substitute course yet, tell your KMG early); a bachelor's degree is not needed to
  apply for the certification, though USAASC says 51C NCOs must earn one to be fully MOS qualified; the next
  reclassification window (11 January to 23 April 2027, panel 3 May 2027). My plan, the exam path and the CON 7300V page
  say to request a seat early. The IDP step names CAPMIS: Army Career Tracker has been retired. "I am offered a job
  outside the 51C path" no longer quotes the proponent: that answer was about officers working toward both program
  management and contracting.
- **Checked before release.** The terms of use on first use close only with "I agree" (the close button and Escape
  let a reader past them). The phone's own top bar takes the app's colour, by day and night, in every colour theme,
  instead of staying pine green. Buddy's bubble nudges at random moments, as asked, and "who is my training contact"
  finds the Contracting Master Gunner. Home, the tour and Contract Quest take their counts from the content (395
  questions, 26 questions in Certification 101), the tour counts only the steps a screen shows, and its Official
  documents stop says what is really there. Settings & help says four onboarding steps and "Send feedback". Six practice
  questions no longer give the answer away by its length. The exam path names Dispatch, and the class-material list
  shows the Contracting Study Guide V9 as read. "Forgot your password?" now says a new account needs a different email
  address (the same one is refused) or that the owner can reset the password. The build now refuses a page that
  carries a stray control character, which breaks the Word email package.
- **Found by the independent review.** After a 10-target range-card or campaign Range Day, a normal Range Day ran the
  short table too (since 0.26); every run now sets its own size. Home's "Play the next mission" opens the first mission
  still open on today's card, even when the others were passed out of order. On iPhones the arrow to Share sits on a
  strip in the page colour along the bottom edge, so it never prints over the install steps. Buddy now searches the
  "Who does what" roles (it skipped them), so "who is my training NCO" finds the KMG. The degree answer cites USAASC
  and the proponent, not DoDI 5000.66 (which exempts enlisted members of the Contingency Contracting Force). The
  CON 7300V answer covers everyone not yet certified on 1 October 2026. The tour, About and the first-week how-to say
  four onboarding steps; the QR steps (About, the install sheet) mention the intro; and the intro goes straight on to
  the install page if the video cannot load. Caught before release in 0.29.0's new parts: drawing the weekly table
  counted as a change to the reader's progress (with an account, the sync would have asked which copy to keep), and so,
  since earlier versions, did the day's first look at the Arcade or a lesson (seeing a page still counts toward the
  study streak; it just no longer counts as a change, so a reader opening the app on the Arcade gets the account's
  newer progress instead of a "Which progress should we keep?" question);
  Fire Mission's 2D version (phones without 3D) now runs and scores the range card's mission instead of passing it at
  any score; the season counts every closed card of the quarter. Also: "/" and "?" no longer open search or the tour
  over the first-use terms, the phone check no longer says "does not work" when the simplest drawing works (nor puts
  3D back on a device the games had sent to 2D as too slow), a range card left open past midnight opens today's card
  instead of yesterday's mission, and pausing while a game loads now gives the 3-2-1 count on Resume.
- **From the device review.** The intro shows once per person: when the install page hands over to Chrome (from
  Samsung Internet) or to Safari (from an app's own browser), the second browser goes straight to the install button.
  "Sound on" always starts the intro from the top. On iPhones the arrow to Share shows only while it covers nothing
  (on short screens it appears once the steps are scrolled clear of it). Keyboard focus stays inside the intro, then
  moves to the install button; the phone's bar turns dark with the intro. Home's "Watch the 2-minute intro" button is
  full tap size; the tour card never grows taller than the screen; "training NCO", "training POC" and similar
  questions bring Buddy to the KMG; in an app's own browser, "Why Chrome?" no longer says that browser can install.
  "Sound on" sits above the picture, clear of the player's own buttons, and the lessons' Try-it box shows amounts up
  to $1,000,000,000 in full.
- **From the Arcade review.** Every 3D game left its 3D renderer in memory after it ended, held by a listener three.js
  leaves on what the games share (the sprite geometry, the procedural textures): about 3 MB a game, and past 16 games
  in one sitting the browser starts dropping 3D views (older than this release, but the range card makes long sessions
  likely). Finished runs now let go of it: after 12 games, 4 3D contexts in memory (3 before the first game) and 28 MB
  of script memory, instead of 13 and 52 MB. The
  stage no longer flashes blank for a frame when it changes size (Contract Quest does on most questions). The results
  screen's XP line counts the range card's and the campaign's XP, so a promotion they bring is announced. A failed
  range-card mission offers "Try again" instead of "Next on the card" with the same mission. A run that ends out of
  lives counts the targets and crates it did land. When a slow phone gives up on 3D during Range Day, the run ends with
  its answers kept, says the device was too slow (not that 3D does not work), and offers Qual Range instead of a
  Play again that could only fail. Fire Mission no longer asks to turn the phone sideways (on a phone its stage is
  smaller that way). On a 320-pixel-wide phone the Paused and "3D view stopped" cards fit their buttons on screen.

## 0.29.0 (16 November 2026): the range card, the qualification table and the seasons

- **Today's range card.** The Arcade now opens with three five-minute missions picked for the date, one each from
  three different games (a ten-target table, a convoy stop, six fire missions, a sector, a shift at the yard or a boss).
  Pass all three to close the card: 20 XP a mission, 50 for the card. A closed card a day builds a streak; miss a day
  and one repair a week keeps it alive. Home shows the card, the streak and what to play next.
- **This week's qualification table.** Every answer in any game fires one target, right or wrong, until the week's
  forty are fired; then the table is scored against the Army rifle standard: 23 hits Marksman, 30 Sharpshooter, 36
  Expert. The lobby shows the forty targets as they are fired, the badge stays on Home until Monday, and the last
  weeks' badges line up under the table.
- **Seasons and range skins.** The fiscal year's quarters are the seasons (FY27 Quarter 1 is October to December);
  each has a skin for Range Day and Fire Mission: Desert, Korea winter (snow and a cold sky), Forest (green slopes
  and more trees) and High summer (golden light). The season's skin is on by itself; pick any other in the lobby.
  Cosmetics only, nothing to buy. The lobby counts the cards closed this season.
- The Arcade can open straight onto a mission from Home (#/arcade?daily=N).

## 0.28.4 (16 November 2026): the 3D games on a phone

- **No more blank game screen.** On a phone a 3D game could sit on a black or frozen screen for several seconds while
  it built its scene and the phone compiled its graphics, long enough to look broken. A game now opens at once on a
  loading card with its name and a moving bar, builds behind it, compiles in the background where the phone allows it,
  and counts down only when the first frame is ready (one beat instead of three when the load already took a while).
- **Simpler drawing when a phone needs it.** Before the first 3D game, the app draws one test square through its
  effects and steps down until the square shows: full effects, no edge smoothing, basic colour, then plain drawing
  with no glow. A phone whose graphics chip cannot draw into the richer targets used to show a black scene.
- **A frame rate the phone can hold.** The five 3D games share one governor that reads real frame times. It draws
  smaller within a second or two when frames run slow, takes the step back if it did not help, and no longer changes
  anything that makes the phone recompile its graphics mid-game. Phones start with the lighter shadow filter. A
  device that cannot reach about five frames a second at the smallest size gets the 2D version of the game.
- **When the phone takes the graphics back.** If the phone stops the 3D view (low memory, or the app sat in the
  background), the game says so and offers Restart instead of staying black. If a scene cannot be drawn at all, Fire
  Mission, Part Patrol, Dispatch and Supply Line run in 2D, and Range Day says to use Qual Range.
- **Check this phone.** Under the game list: "Game screen blank or stuck? Check this phone" runs a 3D test and shows
  a short result (the graphics chip, the drawing mode chosen, load time) to copy or email to the developer.
- A game that fails to start shows a plain message instead of small red text. Each finished run hands its drawing
  memory back to the phone.
- **What the review found.** Pausing during the 3-2-1 count (P, or switching to another app) now holds the game until
  Resume; before, the game started under the Paused card. When the phone takes the graphics back, the card also stops
  the count and the music, puts Restart in focus, and "← Games" still leads back to the list. "Email it to the
  developer" now shows in Check this phone (the address never reached it), its buttons are 44 px tall, it says
  "device" on a computer, and the report gives its time as UTC. The five 3D cabinets said "real 3D" twice; they say
  it once, and not at all on a device where 3D does not work.

## 0.28.3 (4 November 2026): what the first tester found

- **Hear a sample on iPhones.** Apple's novelty voices (Bells, Bubbles, Zarvox and the rest sing or bubble the text)
  are no longer offered, and the older robotic ones sit at the bottom of the list. Read-aloud no longer cancels an
  empty queue right before it speaks, which an iPhone can answer with silence, and on iPhones it asks Safari for media
  playback, the way a video plays, before it speaks. A voice that never starts now stops within a few seconds and says
  what to check (volume, Silent mode, another voice) instead of leaving Listen stuck; the voice picker on iPhones says
  the same. The app voices also pick up again after a phone call or a trip to the home screen.
- **Range Day fits an upright phone.** On a narrow screen the targets in the outer lanes were cut off. The camera now
  steps back from the firing line until all three boards and their tap areas are on screen, at any phone size, and
  short terms get bigger letters so the far boards stay readable.
- **Exam words only on the range.** Range Day and Qual Range no longer ask about training and career terms (AITAS,
  CAMP, Pearson VUE, the proponent's board guidance): CON 3990V does not test them. They stay in the glossary and in
  Certification 101, and the first campaign chapter's range table drops them too.
- **DAU is WarU's old name.** The glossary entry says so, and DAU no longer comes up as a flashcard or a game question.

## 0.28.2 (30 October 2026): what the 51C proponent said

- **Four career questions, answered from the proponent.** After an October 2026 professional development session with
  the 51C proponent (the Army DACM Office at USAASC), checked against the USAASC pages: who the proponent is and when to
  contact them (with the team's org box); what to tell a Soldier who wants to become a 51C (eligibility, the CAMP
  application, the FY26 panel dates, results and the next window); where the promotion-board guidance is (DA PAM
  600-25, the Board Brief Supplement, the 51C NCO career map); and what the proponent says about a job off the 51C path.
- **AATC counts.** The proponent's page says the 51C course at Huntsville gives the WarU course equivalencies, leaving
  one year of experience, CON 3900V or 3910 and the exam. The FAQ and the plan's transcript step now say so; confirm on
  your own transcript.
- Three new Career links (USAASC NCO career planning, reclassification, points of contact), four glossary terms
  (Proponent, SRR, AAPDS, Board Brief Supplement), and the sources and verify logs updated. The transcript itself stays
  out of the repo.

## 0.28.1 (30 October 2026): Fire Mission no longer starts black

- **Fire Mission's first frames were black until the first shot.** The muzzle-flash timer started undefined, so the
  flash light's intensity was not-a-number and the lighting shader blacked out the whole picture; it is now zero from
  the start. Found with a pixel sample of the stage canvas in the browser pane.

## 0.28.0 (30 October 2026): five games in real 3D and the whole first year

- **Fire Mission in real 3D.** An M777-style howitzer on a plateau fires across a valley at trucks parked on the far
  slope, each under a sign board with an answer. Tap the target or the ground; the shell flies a real arc with a smoke
  trail, the muzzle blast lights the gun line, the impact throws sparks, debris and dust, scorches the ground and leaves
  the truck burning. Wind still pushes the round on harder levels; the observer still calls ADD or DROP. The time of day
  changes every three missions. The canvas-2D version (elevation and charge) stays as the fallback.
- **Part Patrol in real 3D.** The same patrol, now a lit fighter over a planet: carriers with lit label boards and shield
  bubbles, drones, laser bolts, the Audit Dreadnought with real turrets lettered A to D and armor plates that go dark as
  they break, explosions with light. The ship banks as it moves; a finger on the screen still steers it.
- **Dispatch (was Sort Yard) in real 3D.** A floodlit yard at dusk: the belt brings each crate from the warehouse with its
  text on a board, the diverter arm swings to the bay you pick, the crate flies in and stacks when right or gets kicked
  out in sparks when wrong. Bays light up, a forklift works the back, the Rush turns the lights pink.
- **Campaign chapters 5 to 12.** The whole first year is open: review (month 5), exam week (6), downrange contingency
  contracting (7), the systems (8), price and cost (9), sources and small business (10), changes and closeout (11) and
  the whole life cycle in one sitting (12). Every game has missions now; Fire Mission, Part Patrol and Dispatch take
  campaign options (fact families, sectors, sorting lines, crates a shift) and report their pass value.
- The shared 3D kit (materials, crates, wheels, trucks, a forklift, a Soldier, signs, hills, explosions) now lives in
  one place; each scene has its own file. The lobby, the tour and Home say five games in real 3D.

## 0.27.0 (30 October 2026): onboarding with a voice and a theme

- **Onboarding in four steps.** The first visit is now a short wizard instead of one form: who you are, your dates,
  how it looks, and read-aloud. The look step offers day or night, six colour themes and the text size; the voice step
  lists the device's voices and the app voices with a sample, so a reader hears the guide before the plan is built.
  Each choice applies as it is tapped; the plan saves at the end. "Look around first" still skips it.
- **Six colour themes, each with a day and a night look:** Pine (the default), Navy, Desert, Maroon, Slate, and Black
  and gold. A theme changes the accent, the paper and the panels but never the four life-cycle colours, so a lesson or
  question still shows where it sits. Pick one in Settings & help → Display → Theme, in the side menu's new Theme
  button, or during onboarding; the swatch shows the day colour on the left and the night colour on the right. The
  theme is remembered on the device and saved into the offline file with the rest of the look.

## 0.26.2 (30 October 2026): Range Day boards keep their distance

- **Range Day.** The three target boards no longer touch or overlap on screen (two boards side by side could read as
  one wide board). The lanes now widen with each row's distance, so neighbouring boards keep a gap from any angle,
  and the first level draws its boards at 25 and 50 metres only. The distance signs and the flag moved outward to
  stay clear of the wider lanes.

## 0.26.1 (30 October 2026): text size in one place

- **Text size left the side menu.** The bottom panel of the menu now shows Day / night only; text size stays under
  Settings & help, Display tab, where it already was (on a wide screen the Aa button in the top bar still cycles it).
  The tour's "Easier to read" step on a phone now points there.

## 0.26.0 (30 October 2026): the convoy in real 3D, the four bosses, the Master Gunner and the campaign

- **Supply Line in real 3D.** The convoy stage is now drawn by the same engine as Range Day: an FMTV-style cargo truck
  and an armored lead truck built from boxes and cylinders, a road that slides past with hills at two depths, trees,
  rocks, bushes and poles that recycle ahead of you, and the five checkpoints as real places: the Ops Center's tents and
  antenna mast, Market Square's striped stalls, the River Bridge over water, the Supply Depot's warehouse and forklift,
  and FOB Keystone's HESCO wall, guard tower, gate arm and floodlight. The day passes as you drive: dawn at the Ops
  Center, noon at the market, golden hour at the bridge, dusk at the depot, stars and headlights at the FOB. Crates fly
  from the pallet onto the bed on a right answer and get a red X on a wrong one; the contact waves you in; dust rises
  from the wheels. The canvas-2D version stays as the fallback where WebGL is missing.
- **The four things that end careers.** Contract Quest's realm bosses are now the Unauthorized Commitment, the Bid
  Bust, the Audit and the Protest. Each asks its own family of questions, and at half health enters a second phase with
  an attack of its own on every miss: a ratification heals the boss, a re-solicit costs your focus and brings a hard
  question, a finding takes a potion or a scroll, a stay of award holds your next hit to 1 damage.
- **The Master Gunner.** Your Contracting Master Gunner, drawn in code, briefs every chapter and boss, reacts to your
  answers in a bubble over the stage (pleased, a hint, worried when your hearts run low, proud when a boss falls or a
  coin is gold) and explains a wrong target in one line.
- **Campaign: Your first year as a 51C.** Chapters 1 to 4 (the four exam areas, in the order of the 6-month exam path):
  each is three missions, a ten-target Range Day table on the month's terms, a Supply Line stop on the month's lessons
  and a boss fight on its family. Pass all three to open the next chapter; a cleared chapter is worth 150 XP. Progress
  is saved with the rest of the Arcade's. Chapters 5 to 12 come in a later update.
- **Range Day** scales its badges to the table: a ten-target campaign table is Expert at 9, Sharpshooter at 8, Marksman
  at 6, and the Master Gunner names the term you missed.
- The lobby now opens with the campaign, then "All games". Haptics wait for your first tap, so phones no longer log a
  blocked vibration.

## 0.25.2 (30 October 2026): the terms and privacy on their own pages

- **terms.html and privacy.html** on the website, built from the same text as the in-app terms, with a plain privacy
  page (no tracking; what an account stores, with or without Google; how to delete it). About and the terms pop-up
  link to them. Google asks for public links like these before it will show the app's name on its sign-in screen;
  the 120-pixel logo for that review lives in the repository (`src/web/icons/logo-120.png`). Files in
  `src/web/root/` are copied to the root of the site (a Search Console verification file lives there).

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
