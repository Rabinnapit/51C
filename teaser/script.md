# B2B Exam Prep teaser: script, shot list and build (v1.4, 2026-11-19)

**Live cut: v1.4** (app 0.35.1, 19 November 2026): v1.2's script and shots, every screen filmed again from app 0.35.0.
What changed on screen since v1.2 was filmed (0.30.0): Exam path and My plan are one page (the side menu shows one My
plan entry; the setup ends on My plan's This week; the plan shot is My plan with This week, All weeks, Steps and
dates), the setup's steps 3 and 4 say optional, Settings & help is the slimmer 0.33.0 page, the Arcade opens on today's
range card, and the phone in the last shot has the bar Home, Plan, Learn, Practice, More. L05 no longer names the Exam
path ("Twenty-six dated weeks, ...", 6.0 s, starts at 27.0 s); its caption card reads "My plan". Everything else
(the other sixteen narration lines, the music, the title cards, the timeline) is v1.2's. The read-aloud shot is still
the voice settings with Hear a sample, as the owner asked.

**History.** v1.2 was live from app 0.30.0, and again from 0.32.1 (18 November 2026). A v1.3 cut made for app 0.31.0 replaced the read-aloud
shot with lesson one's "Who does what" picture read by the app's Joe voice, its cards popping as he spoke (and moved
the lessons shot to lesson four). The owner preferred v1.2's read-aloud shot, which shows the voice settings with
Hear a sample, so the app plays v1.2 again and these scripts are v1.2's. The v1.3 scripts are in git at 3259a7b
(`teaser/build/capture.py`, `assemble.py`) and its MP4s sit at the top of the main folder's `teaser/`; v1.2's MP4s are
in `teaser/v1.2/`. Recut with these scripts unless the owner asks for the v1.3 shot back.

A 114-second introduction video in the style of the CSE teaser (`Interactive Map/Distributions/Teaser`): real screens
of the app driven by a visible cursor, one narrator, lower-left captions, three title cards, and a procedural trailer
bed whose hits land on the cuts. Ad-style: it shows what the guide does for a brand-new 51C or 1102, not how it is built.

v1.2 changes (the release check of 16 November 2026, so the video matches app 0.30.0, which now opens on it): every
screen filmed again from 0.30.0 (the four-step onboarding with Next past the dates, the look and the voice; the Arcade
lobby with the range card, the qualification table and the season; five games in real 3D; 395 questions; 254 terms);
L04 says "Four quick steps", L10 "five of them in real 3D", L12 "Two hundred fifty-four terms" (L13 starts 0.4 s later
to make room); the captions follow, and the official-documents caption says "one tap away" instead of "in the file"
(8 of the 26 are stored in the app). The capture marks the intro as seen and hides Home's "Watch the intro" button,
so the video does not show itself. The end card's QR code is the new `?install=1` code (33 modules, bigger than v1.1's);
`cards.py` now sizes it from the SVG itself, so its quiet zone is no longer clipped. After the independent video
review: Home pulls out from 1.045x to 1.0 (no snap when the still gives way to the live page), Range Day's cabinet press
and ripple stay in the lobby and the game starts off camera (no loading frames, no cursor over the range), Buddy's panel
is enlarged by a style rule before it opens, the app's Try-it box is wide enough for $1,000,000,000, and the masters are
encoded in standard range BT.709 at High@4.1 with colour tags (the frames are full-range BT.601 JPEGs). The web copy the app plays is
`src/web/root/intro.mp4` (see Build, step 8).

v1.1 changes (the owner's review of v1.0): the hook card reads "Most Brigades want it in six."; a read-aloud shot after the
lessons, with the app's own Joe voice saying its sample sentence in the mix; the Arcade line says two games are in real
3D (0.26.0 made Supply Line 3D); the "everywhere" composite says tablet instead of NIPR desktop and adds "Updated as
regulations and policies change."; the end card drops the web address, shows the whole QR code and says "Built by a
51C, for 51Cs and 1102s."; the closing line says the same. Range Day's boards no longer touch (app fix 0.26.2, so the
clip no longer shows two boards reading as one). The app captured is 0.26.2.

**Purpose and audience.** New 51C Soldiers and 1102 civilians, their supervisors and the Contracting Master Gunners who
decide what the newcomers study. Everything said on screen or in narration comes from the app's own text, checked
content (28 October 2026) or the owner's confirmations: 36 months for the certification, most brigades ask for six;
five courses, one exam, twelve months of experience; 26 dated weeks; 35 lessons; 395 questions; 14 decks; seven games,
five in real 3D; four app voices; 254 glossary terms; 26 official documents. The app is named "B2B Exam Prep" on screen
and spoken "B-to-B", 51C "fifty-one Charlie", 1102 "eleven-oh-two", the same way the app's own read-aloud says them.

**Outputs.** `B2B_Exam_Prep_Teaser_1080p.mp4` (1920x1080, about 28 MB) and `B2B_Exam_Prep_Teaser_Email_720p.mp4`
(1280x720, under 20 MB for email). 30 fps, H.264 two-pass to size, AAC 48 kHz, loudness -16 LUFS.
Voice: Edge neural "Andrew" (rate -5 %, pitch -3 Hz), as in the CSE teaser. The app's voice heard at 0:57 is Piper
`en_US-joe-medium`, the same model the app downloads as "Joe", run locally (`piper-tts`) on the app's own sample text.
Music: "Day One", a procedural bed (`build/music_b2b.py`, instruments from the CSE teaser's `synth_music.py`), 100 BPM,
A minor rising to C major on the end card; every cut is on a bar line, hits at 14.4 / 36.0 / 72.0 / 103.2 s.

## Narration

| at | id | line |
|----|----|------|
| 0:00 | L01 | Day one. New unit. New job. And the certification clock is already running. |
| 0:06 | L02 | Five courses. One exam. Twelve months of experience. And nobody hands you the map. |
| 0:15 | L03 | Introducing B2B Exam Prep. From day one to certified. |
| 0:20 | L04 | Four quick steps, and it builds your plan: every step dated, from week one to exam day. |
| 0:27 | L05 | Twenty-six dated weeks, monthly checkpoints, and two full simulations before exam week. |
| 0:36 | L06 | The rules, explained in pictures, beside the real official documents. |
| 0:44 | L07 | Thirty-five plain-English lessons, organized like the exam. Every picture plays. Every dollar rule has a try-it tool. |
| 0:53 | LV | It reads aloud too, in four voices that work offline. *(then the app's Joe voice: "Hi, this is how B2B Exam Prep sounds.")* |
| 1:01 | L08 | Nearly four hundred questions, each answer explained with a citation. Plus a timed simulator, like the real exam. |
| 1:09 | L09 | Fourteen flashcard decks that remember what you forget. |
| 1:12 | L10 | Then the Arcade: seven games on the same content, five of them in real 3D. Range Day puts you on the qualification range. |
| 1:22 | L11 | Ask Buddy. — When can I take the exam? — Answered from the guide, on your device. No signal needed. |
| 1:29 | L12 | Two hundred fifty-four terms, all the FAR parts, every threshold and deadline. |
| 1:34 | L13 | On your phone, your laptop, or your tablet. Updated as regulations and policies change. No app store. Free. |
| 1:44 | L14 | Built by a 51C, for 51Cs and 1102s. B2B Exam Prep. From day one to certified. |

## Shot list (bar grid of 2.4 s; every boundary is a music bar line)

| t | clip | screen |
|---|------|--------|
| 0:00–0:05 | c_open | dark pine card: "36 MONTHS." / "Most Brigades want it in six." (the hook) |
| 0:05–0:14 | home | the first-visit Home ("Zero to certified."), slow push-in, then down to Build my plan |
| 0:14–0:19 | c_title | HIT · app icon, "B2B EXAM PREP", "From day one to certified." |
| 0:19–0:26 | setup | the four-step onboarding: cursor picks 51C Soldier, Next past the dates, the look and the voice (both marked optional), Build my plan; My plan appears on This week |
| 0:26–0:36 | path | My plan: This week, then "All weeks" scrolling past with the monthly checkpoints |
| 0:36–0:43 | cert | HIT · Certification 101, the exam tab: CON 3990V at a glance and the exam journey picture; Official documents library; one real document's official pages |
| 0:43–0:53 | lessons | the lesson list; lesson 1's "Who does what" picture playing part by part; lesson 13's Try-it tool sweeping the dollars |
| 0:53–1:00 | voice | lesson 5: cursor presses Listen to the lesson; Settings → Display → Read aloud, the voice list open with the four app voices (Joe selected); cursor presses Hear a sample and Joe speaks |
| 1:00–1:07 | quiz | Practice test: Quick 10, a question, the right answer explained with its citation |
| 1:07–1:12 | cards | Flashcards: the Acronyms deck, the question side, the flip |
| 1:12–1:22 | arcade | ACCENT · the Arcade lobby's cabinets; Range Day in 3D: the tower's clue, three boards rise, the sight walks to the answer, two shots |
| 1:22–1:29 | buddy | the Ask Buddy bubble, the question typed, the answer card from the guide |
| 1:29–1:34 | lookup | Glossary answering "COR"; FAR & key numbers, the dollar thresholds |
| 1:34–1:43 | phone | composite: "On your phone. On your laptop. On your tablet." / "Updated as regulations and policies change." / "Free. No app store." with a phone cycling Home, a lesson, the Arcade |
| 1:43–1:54 | c_end | HIT · icon, "B2B Exam Prep", "From day one to certified.", "Built by a 51C, for 51Cs and 1102s.", the QR code; fade out |

Captions (lower left, brass bar): Home · Zero to certified; My plan · Four quick steps → every step dated; My plan ·
26 dated weeks · checkpoints · simulations; Certification 101 · The rules, explained in pictures; Official documents ·
26 DoW and WarU documents, one tap away; Lessons · 35 lessons · pictures that play; Try it · Every dollar rule answers
for any amount; Read aloud · Four app voices · offline after one download; Practice test · 395 questions · every answer
explained; Flashcards · 14 decks · spaced repetition; Arcade · Seven games · five in real 3D; Range Day · The
qualification range, in real 3D; Ask Buddy · Answers from the guide, on your device; Look it up · 254 terms · 53 FAR
parts · thresholds.

## Build (all in `teaser/build/`; run from that folder)

0. `python tools/build.py` (repo root) so `docs/` holds the current web edition; the capture serves it on port 8797.
1. `python narration.py ../narration lines` — Edge TTS per line with word-boundary timing (`timing.json`).
2. The app voice sample: `pip install piper-tts`, download `en_US-joe-medium.onnx` and its `.json` from
   https://rabinnapit.github.io/51C-voices/v1/, then `PiperVoice.load(...).synthesize_wav("Hi, this is how B to B Exam
   Prep sounds.", wav)` into `../audio/voice_joe.wav` ("B to B" is how the app's pronunciation map says it).
3. `python cards.py ../cards` — title cards and captions at 2x, in the app's own fonts and palette.
4. `python music_b2b.py ../audio/music_b2b.wav` — the bed (a few minutes to render).
5. `python capture.py ../frames 2 [segments only]` — deterministic 30 fps frames from the app: virtual clock, on-screen
   cursor, keyboard for Range Day (the clock steps twice a frame there so the game's adaptive quality stays at full),
   a phone-sized context for the composite. `capture.py ../frames 2 arcade,voice only` re-captures just those.
6. `python assemble.py` (or `--finish` to keep existing clips) — clips → xfade chain → narration + sample + ducked bed → two-pass encodes.
7. `python verify.py` — contact sheet, narration placement against the shots, mix levels.
8. The copy the app plays: `python webcopy.py` encodes the 720p cut for streaming (about 14 MB, fast start), takes the
   poster from the title card and writes the captions file from `narration/timing.json`, into `src/web/root/`
   (`intro.mp4`, `intro-poster.jpg`, `intro.vtt`); `tools/build.py` copies them next to the page.

Heavy build products (frames, clips, audio, cards, MP3s, MP4s, logs) are ignored by git (`teaser/.gitignore`).
