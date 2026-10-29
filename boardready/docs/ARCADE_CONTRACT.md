# Board Ready Arcade — game contract

The Arcade is a full-screen view inside Board Ready (`#/arcade`) with animated, canvas-based games that drill the same
content as the main app. Same offline rules as `CONTRACT.md` §1: one file, no network, classic scripts, storage may throw.
`tools/build.py` inlines `src/arcade/` into `dist/BoardReady.html`. The view `src/js/views/arcade.js` builds `ARCADE.DATA`
from `CORB_DATA`, shares the profile's warrant class, and calls `ARCADE.mount(root, params)` and `ARCADE.unmount()`.
A standalone copy for development is written to `src/arcade/index.standalone.html`. All Arcade CSS is scoped under
`.arcade-root`.

## Files

```
src/arcade/index.html          template (placeholders expanded by build.py)
src/arcade/css/arcade.css      shell styling (dark neon; tokens below)
src/arcade/js/core/engine.js   window.ARCADE: register, data, rng, audio, particles, text, shapes, best scores
src/arcade/js/app.js           shell: title screen (cabinets), play screen (canvas + HUD), pause, results/review
src/arcade/js/games/<id>.js    one file per game — registers itself with ARCADE.register(def)
```
Data available at runtime as `ARCADE.DATA`:
```js
{ meta:{app_name, main_file, version, built_on, content_verified_on},
  games:{ threshold_ladder:[{id,label,facts[],value_number,correct_class,explanation,difficulty,classes?}],
          fiscal_sort:[{id,statement,bucket,explanation,cite,difficulty,classes?}],   // bucket: Purpose | Time | Amount | No violation
          protest_clock:[{id,event,days,day_type,anchor,rule,cite,difficulty,classes?}],
          clause_match:[{id,clause,title,applies,status,difficulty,classes?,reserved?}],   // reserved: never a correct catch
          jeopardy:{categories:[{name,clues:[{value,clue,response,accepted[],cite}]}],final:{}},
          branching:{cases:[...]} },
  mcq:[{qid,stem,options:[{text,correct,why}],difficulty,cite,domain,classes?}],   // classes from the source question
  crosswalk:[{old,new,title,note,difficulty,classes?}],   // verified pairs; difficulty and classes (by part) set in arcade.js
  thresholds:[{id,name,value,value_number,applies,cite}],
  questions:[{id,question,answer,status,key_points[],cites[],domain,topic,kind,classes[],difficulty?,flags[]}] }   // the board question bank (Class I-IV items), for games that play the questions and answers
```
`difficulty` is 1 easy, 2 medium or 3 hard. `classes` lists the contracting officer warrant classes ("I" to "IV") an
item is for; an item without it is for every class.

## Registering a game

The Arcade home lists games in the order of `LIST_ORDER` in `src/arcade/js/core/engine.js` (Threshold Run and Deadline Dash
first, by user request); a new game not named there goes last. Add its id to `LIST_ORDER` to place it.

```js
/* GAME: threshold-run */
(function () {
  'use strict';
  var A = window.ARCADE;
  A.register({
    id: 'threshold-run',                 // kebab-case, also the file name
    title: 'Threshold Run',
    tagline: 'Drive into the lane of the class that can sign it.',
    blurb: 'Two sentences for the cabinet card: what you do and what it drills.',
    controls: 'Arrows or A/D change lanes · drag on touch · P pauses',
    icon: '🏎️',                          // emoji, rendered by the shell
    accent: A.C.gold,                    // cabinet accent color
    drills: 'Warrant classes and cumulative instrument value',
    dataOk: function (D) { return ((D.games || {}).threshold_ladder || []).length >= 8; },
    create: function (api) {
      // build state here; return the instance
      return {
        update: function (dt) {},                 // dt in seconds, capped at 0.05
        draw: function (ctx) {},                  // ctx is a 2D context in logical coords api.W x api.H (960 x 540)
        onKey: function (key, down) {},           // key = e.key (e.g. 'ArrowLeft', 'a', ' ')
        onPointer: function (p) {},               // p = {type:'down'|'move'|'up', x, y, dx, dy} in logical coords
        destroy: function () {},                  // stop timers, release references
        _auto: function (ok) {}                   // optional test hook: answer the current prompt correctly (ok) or wrongly, as a player would; used by the headless play harness, never by the shell
      };
    }
  });
})();
```

## The `api` object (everything a game needs)

| Member | Meaning |
|---|---|
| `api.W`, `api.H` | logical canvas size (960 × 540). The shell scales and letterboxes; draw in these coordinates. The score/lives HUD sits in its own bar ABOVE the canvas, so the whole 960 × 540 is yours; only the banner (center) and the thin progress bar (bottom 5 px) overlay it. |
| `api.data` | `ARCADE.DATA` |
| `api.rand(a,b)`, `api.randInt(a,b)`, `api.pick(arr)`, `api.shuffle(arr)` | randomness |
| `api.C` | palette: `bg, panel, line, ink, ink2, muted, gold, gold2, sky, green, red, purple, orange, teal` |
| `api.font(px, 'display'|'body'|'mono', weight)` | returns a CSS font string using the embedded fonts |
| `api.text(ctx, str, x, y, {size, fam, weight, color, align, baseline, maxWidth, lineHeight, shadow, alpha})` | draws (and wraps when maxWidth is given); returns the number of lines |
| `api.wrap(ctx, str, maxWidth)` | array of lines |
| `api.roundRect(ctx, x, y, w, h, r)` | path helper (call fill/stroke after) |
| `api.glow(ctx, color, blur)` / `api.noGlow(ctx)` | shadow-based glow on/off |
| `api.particles` | `emit({x,y,n,color,speed,life,size,gravity,spread,shape})`, updated and drawn by the shell after `draw` |
| `api.audio` | `blip()`, `correct()`, `wrong()`, `boom()`, `whoosh()`, `tick()`, `fanfare()`, `tone(freq, sec, type, gain)`; respects mute |
| `api.hud.set({score, lives, combo, level, time, progress, banner, sub})` | updates the DOM HUD; pass only the keys you change; `banner` shows a big centered message that fades |
| `api.score(n)` | add points (negative allowed); returns total |
| `api.life(n)` | add/remove lives; when lives reach 0 the shell ends the game |
| `api.review.add({prompt, correct, given, ok, explanation, cite})` | record an answered item for the results screen (right or wrong) |
| `api.end({won, title, message})` | finish the game; the shell shows results |
| `api.shake(px)`, `api.flash(color)` | screen shake and a fullscreen flash |
| `api.input.keys` | `Set` of currently pressed `e.key` values |
| `api.input.pointer` | `{x, y, down}` in logical coords |
| `api.paused` | true while paused (the shell stops calling update) |
| `api.elapsed` | seconds since start |
| `api.bestScore` | best score for this game at the current level (or 0) |
| `api.difficulty` | `{id, name, timeScale, lives, read}` for the level the player chose: Recruit (0.6×, 5 lives, waits for Go), Regular (0.8×, 4 lives, short reading pause), Veteran (1×, 3 lives), Elite (1.25×, 2 lives). The shell already scales `dt`; games only read `lives`. |
| `api.progress` | in-run question levels. `configure({perLevel, maxLevel})` (defaults 5 correct per level, 3 levels). `pick(pool, keyOf?)` returns an unused item whose `difficulty` (1 easy, 2 medium, 3 hard; missing counts as 2) matches the current level, falling back to the nearest difficulty and starting a fresh pass when every item has been seen. `correct()` must be called on every correct answer; it raises the level, shows the banner and plays the fanfare, returning true on a level-up. `level` is the current level. The shell slows the game clock at levels 2 and 3 (×0.88, ×0.78) so harder questions get more thinking time. |
| `api.warrant` | `{id, name}` for the warrant class the player chose: `I`, `II`, `III`, `IV` or `all`. `api.progress.pick` already filters by it (the chosen class and the classes below, weighted about 60/40 toward the chosen class; untagged items count for every class). Games only display it. |
| `api.ready(text)` | call each time a new question or prompt becomes active, passing its text. Recruit freezes the game until the player presses Go; Regular freezes for a reading window sized to the text; Veteran and Elite ignore it. |

Rules for games:
1. Never throw on empty or odd data; guard every array read. If `dataOk` is false the shell never calls `create`.
2. Every question the player answers must go through `api.review.add` so the results screen can teach.
3. Progression comes from question levels (rule 10), never from speed, spawn rate or shorter timers. Combos multiply score. Aim for a round of 60 to 180 seconds.
4. Controls: keyboard AND pointer/touch. Draw a brief on-canvas hint for the first 3 seconds.
5. Visual bar: layered backgrounds, motion, easing, particles on hits, screen shake on crashes, readable text (never below 16 px, wrap long statements). Dark theme, palette from `api.C`.
6. Text content: show the study text verbatim (statements, citations); no invented regulation numbers.
7. No external assets, no images; draw everything with canvas primitives (vehicles, ships, asteroids, gates) — stylized silhouettes with glow are fine.
8. `node --check` must pass; wrap everything in an IIFE; ES2019, no modules. The shell sets `ctx.letterSpacing = '0.01px'` whenever it sizes the canvas, which turns off font ligatures (Manrope draws "(c)" as a copyright sign otherwise); never set `letterSpacing` back to `0px`.
9. Start lives from `api.difficulty.lives` (never a hard-coded 3) and call `api.ready(promptText)` whenever a new question appears. Do not scale speeds yourself for difficulty; the shell's clock does that.
10. Levels mean harder QUESTIONS, never faster play. Choose every question with `api.progress.pick(pool)`, call `api.progress.correct()` on each correct answer, and show `api.progress.level` in the HUD. Do not increase movement speed, spawn rate or shorten timers as the player advances; harder levels may add closer distractors, not less time.
11. Carry each item's `classes` (array of "I" to "IV") and `difficulty` through any function that copies or normalizes items, so `api.progress.pick` can filter by warrant class. Mark generated variations with `gen: true` and give them `classes` too; they are not remembered across runs. The `prompt` given to `api.review.add` must contain the text the shell fingerprints, the first present of: stem, statement, event, title, old citation, label. The shell matches the review to the question to remember what was seen and what was missed. Missed questions then return in later runs, and nothing repeats until the player has seen the whole set for their class.
