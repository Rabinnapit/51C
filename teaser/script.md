# B2B Exam Prep teaser: script, shot list and build (v1.0, 2026-10-30)

A 105-second introduction video in the style of the CSE teaser (`Interactive Map/Distributions/Teaser`): real screens
of the app driven by a visible cursor, one narrator, lower-left captions, three title cards, and a procedural trailer
bed whose hits land on the cuts. Ad-style: it shows what the guide does for a brand-new 51C or 1102, not how it is built.

**Purpose and audience.** New 51C Soldiers and 1102 civilians, their supervisors and the Contracting Master Gunners who
decide what the newcomers study. Everything said on screen or in narration comes from the app's own text, checked
content (28 October 2026) or the owner's confirmations: 36 months for the certification, most brigades ask for six;
five courses, one exam, twelve months of experience; 26 dated weeks; 35 lessons; 395 questions; 14 decks; seven games;
250 glossary terms; 26 official documents. The app is named "B2B Exam Prep" on screen and spoken "B-to-B", NIPR is
spoken "nipper", 51C "fifty-one Charlie", 1102 "eleven-oh-two", the same way the app's own read-aloud says them.

**Outputs.** `B2B_Exam_Prep_Teaser_1080p.mp4` (1920x1080, about 28 MB) and `B2B_Exam_Prep_Teaser_Email_720p.mp4`
(1280x720, under 20 MB for email). 30 fps, H.264 two-pass to size, AAC 48 kHz, loudness -16 LUFS.
Voice: Edge neural "Andrew" (rate -5 %, pitch -3 Hz), as in the CSE teaser.
Music: "Day One", a procedural bed (`build/music_b2b.py`, instruments from the CSE teaser's `synth_music.py`), 100 BPM,
A minor rising to C major on the end card; every cut is on a bar line, hits at 14.4 / 36.0 / 64.8 / 93.6 s.

## Narration

| at | id | line |
|----|----|------|
| 0:00 | L01 | Day one. New unit. New job. And the certification clock is already running. |
| 0:06 | L02 | Five courses. One exam. Twelve months of experience. And nobody hands you the map. |
| 0:15 | L03 | Introducing B2B Exam Prep. From day one to certified. |
| 0:20 | L04 | Three questions, and it builds your plan: every step dated, from week one to exam day. |
| 0:27 | L05 | The exam path: twenty-six dated weeks, monthly checkpoints, and two full simulations before exam week. |
| 0:36 | L06 | The rules, explained in pictures, beside the real official documents. |
| 0:44 | L07 | Thirty-five plain-English lessons, organized like the exam. Every picture plays. Every dollar rule has a try-it tool. |
| 0:53 | L08 | Nearly four hundred questions, each answer explained with a citation. Plus a timed simulator, like the real exam. |
| 1:01 | L09 | Fourteen flashcard decks that remember what you forget. |
| 1:05 | L10 | Then the Arcade: seven games on the same content. Range Day puts you on the qualification range, in real 3D. |
| 1:15 | L11 | Ask Buddy. — When can I take the exam? — Answered from the guide, on your device. No signal needed. |
| 1:22 | L12 | Two hundred fifty terms, all the FAR parts, every threshold and deadline. |
| 1:27 | L13 | On your phone, your laptop, or a NIPR desktop. No app store. Free. |
| 1:34 | L14 | Built by a contracting NCO, for new 51Cs and 1102s. B2B Exam Prep. From day one to certified. |

## Shot list (bar grid of 2.4 s; every boundary is a music bar line)

| t | clip | screen |
|---|------|--------|
| 0:00–0:05 | c_open | dark pine card: "36 MONTHS." / "Most brigades want it in six." (the hook) |
| 0:05–0:14 | home | the first-visit Home ("Zero to certified."), slow push-in, then down to Build my plan |
| 0:14–0:19 | c_title | HIT · app icon, "B2B EXAM PREP", "From day one to certified." |
| 0:19–0:26 | setup | cursor picks 51C Soldier, Build my plan; the exam path appears; My plan from the menu, timeline to 36 months |
| 0:26–0:36 | path | Exam path: this week, then "All 26 weeks" scrolling past with the monthly checkpoints |
| 0:36–0:43 | cert | HIT · Certification 101, the exam tab: CON 3990V at a glance and the exam journey picture; Official documents library; one real document's official pages |
| 0:43–0:53 | lessons | the lesson list; lesson 1's "Who does what" picture playing part by part; lesson 13's Try-it tool sweeping the dollars |
| 0:53–1:00 | quiz | Practice test: Quick 10, a question, the right answer explained with its citation |
| 1:00–1:05 | cards | Flashcards: the Acronyms deck, the question side, the flip |
| 1:05–1:14 | arcade | ACCENT · the Arcade lobby's cabinets; Range Day in 3D: the tower's clue, three boards rise, the sight walks to the answer, two shots |
| 1:14–1:22 | buddy | the Ask Buddy bubble, the question typed, the answer card from the guide |
| 1:22–1:26 | lookup | Glossary answering "COR"; FAR & key numbers, the dollar thresholds |
| 1:26–1:34 | phone | composite: "On your phone. On your laptop. On a NIPR desktop. Free. No app store." with a phone cycling Home, a lesson, the Arcade |
| 1:34–1:45 | c_end | HIT · icon, "B2B Exam Prep", tagline, the QR code and rabinnapit.github.io/51C, owner line; fade out |

Captions (lower left, brass bar): Home · Zero to certified; My plan · Three questions → every step dated; Exam path ·
26 dated weeks · checkpoints · simulations; Certification 101 · The rules, explained in pictures; Official documents ·
26 DoW and WarU documents, in the file; Lessons · 35 lessons · pictures that play; Try it · Every dollar rule answers
for any amount; Practice test · 395 questions · every answer explained; Flashcards · 14 decks · spaced repetition;
Arcade · Seven games on the guide's own content; Range Day · The qualification range, in real 3D; Ask Buddy · Answers
from the guide, on your device; Look it up · 250 terms · 53 FAR parts · thresholds.

## Build (all in `teaser/build/`; run from that folder)

0. `python tools/build.py` (repo root) so `docs/` holds the current web edition; the capture serves it on port 8797.
1. `python narration.py ../narration lines` — Edge TTS per line with word-boundary timing (`timing.json`).
2. `python cards.py ../cards` — title cards and captions at 2x, in the app's own fonts and palette.
3. `python music_b2b.py ../audio/music_b2b.wav` — the bed (a few minutes to render).
4. `python capture.py ../frames 2 [segments only]` — deterministic 30 fps frames from the app: virtual clock, on-screen
   cursor, keyboard for Range Day, a phone-sized context for the composite. `capture.py ../frames 2 arcade,buddy only`
   re-captures just those.
5. `python assemble.py` (or `--finish` to keep existing clips) — clips → xfade chain → narration + ducked bed → two-pass encodes.
6. `python verify.py` — contact sheet, narration placement against the shots, mix levels.

Heavy build products (frames, clips, audio, cards, MP3s, MP4s) are ignored by git (`teaser/.gitignore`).
