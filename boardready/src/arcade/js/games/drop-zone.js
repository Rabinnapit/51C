/* GAME: drop-zone — a paratrooper over a three-strip drop zone.
   The board question is the mission brief. Each strip carries one sentence: one is a point from THIS
   question's model answer, the other two are points from other questions' answers. Steer onto the right
   strip before the altitude runs out, or cut away and land at once when you are sure.
   Levels (api.progress) are harder QUESTIONS, never a faster drop: level 1 pulls the decoys from another
   domain, level 2 from the same domain (different topic), level 3 from the same domain with the highest
   word overlap with the question. The altitude ceiling is the same at every level; the shell's clock gives
   harder levels more time. */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var ROUND_ITEMS = 20;                  // a round ends after 20 briefs, or sooner when the lives run out
  var MIN_ITEMS = 8;                     // below this the shell never starts the game
  var PER_LEVEL = 5;                     // correct landings per question level
  var DROP_SECONDS = 9;                  // altitude ceiling per brief; the same at every level
  var FALL_SECONDS = 0.45;               // cut-away drop once the player commits
  var COMMIT_LOCK = 0.8;                 // Enter, LAND NOW and tap-to-land wait this long into each brief: the shell arms the
                                         // reading pause 0.5 s after a prompt, and a fast press before it would land unread
  var HOLD_SECONDS = 1.6;                // how long a landing result stays on screen
  var SLIDE_SECONDS = 0.45;              // the next brief slides in
  var MOVE_SECONDS = 0.35;               // eased strip change
  var POINT_MIN = 40, POINT_MAX = 260;   // a usable answer point, after whitespace normalisation
  var POINT_CUT = 170;                   // how much of a point a strip shows before the ellipsis
  var GUST_MAX = 40;                     // under half the strip pitch (46): wind never carries the canopy over another strip
  var LEVEL_NAMES = ['Easy questions', 'Medium questions', 'Hard questions'];
  var LEVEL_COLORS = [A.C.green, A.C.sky, A.C.orange];
  var BADGE = ['A', 'B', 'C'];
  // openers that would not identify the question they came from
  var GENERIC = /^(yes|no|it depends|should indicate|applicants should|candidates should)\b/i;
  // "U.S.", "e.g." and "No." must not end a sentence
  var ABBR = /(?:^|[^A-Za-z])(?:[A-Za-z]\.){1,3}$|\b(?:no|nos|inc|corp|co|mr|mrs|ms|dr|vs|etc|sec|subpt|pt|app|fig|approx|est|dept|govt|jr|sr)\.$/i;

  // ---- data ----------------------------------------------------------------
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function squash(s) { return norm(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  // the body font (Manrope) ligates "(c)" into "©" on the canvas: a zero-width non-joiner keeps "7.107-2(c)(3)" verbatim
  function unlig(s) { return String(s == null ? '' : s).replace(/\(c\)/g, '(\u200Cc)'); }

  function sentences(text, max) {
    var t = norm(text), out = [], start = 0, i, ch, next, after, rest;
    if (!t) return out;
    max = max || 4;
    for (i = 0; i < t.length && out.length < max; i++) {
      ch = t.charAt(i);
      if (ch !== '.' && ch !== '!' && ch !== '?') continue;
      next = t.charAt(i + 1);
      if (!next) break;
      if (next !== ' ') continue;                                    // "15.404-1" and "U.S.C" stay whole
      after = t.charAt(i + 2);
      if (!/[A-Z0-9(“"']/.test(after || '')) continue;
      if (ABBR.test(t.slice(Math.max(0, i - 10), i + 1))) continue;
      out.push(norm(t.slice(start, i + 1)));
      start = i + 1;
    }
    if (out.length < max && start < t.length) { rest = norm(t.slice(start)); if (rest) out.push(rest); }
    return out;
  }

  function usable(p) { return !!p && p.length >= POINT_MIN && p.length <= POINT_MAX && !GENERIC.test(p); }

  // key_points first; with none usable, the first sentence of the answer (the first two when the first is short)
  function pointsOf(q) {
    var out = [], kp = (q && Array.isArray(q.key_points)) ? q.key_points : [], i, p, ss;
    for (i = 0; i < kp.length; i++) {
      p = norm(kp[i]);
      if (usable(p) && out.indexOf(p) < 0) out.push(p);
    }
    if (!out.length) {
      ss = sentences(q && q.answer, 3);
      if (ss.length) {
        p = ss[0];
        if (p.length < POINT_MIN && ss[1]) p = norm(p + ' ' + ss[1]);
        if (usable(p)) out.push(p);
      }
    }
    return out;
  }

  // a question without its own difficulty is spread evenly over 1 to 3 by a stable hash of its id
  function hashDiff(id) {
    var s = String(id == null ? '' : id), n = 0, i;
    for (i = 0; i < s.length; i++) n += s.charCodeAt(i);
    return (n % 3) + 1;
  }

  function buildPool(D) {
    var qs = ((D || {}).questions) || [], out = [], i, q, pts, d;
    if (!qs.length) return out;
    for (i = 0; i < qs.length; i++) {
      q = qs[i];
      if (!q || !q.id || !q.question) continue;
      pts = pointsOf(q);
      if (!pts.length) continue;
      d = Math.round(Number(q.difficulty));
      if (!(d >= 1 && d <= 3)) d = hashDiff(q.id);
      out.push({
        id: 'DZ-' + q.id,
        stem: q.question,                                            // the shell fingerprints the first 40 characters
        text: norm(q.question),
        q: q,
        points: pts,
        difficulty: d,                                               // 1 easy, 2 medium, 3 hard
        classes: Array.isArray(q.classes) ? q.classes.slice() : q.classes,  // warrant classes; api.progress.pick filters by them
        domain: norm(q.domain),
        topic: norm(q.topic),
        fp: squash(q.question).slice(0, 40)                          // twin questions share their opening words
      });
    }
    return out;
  }

  var memoFor = null, memoPool = null;
  function poolOf(D) {
    if (memoFor !== D || !memoPool) { memoFor = D; memoPool = buildPool(D); }
    return memoPool;
  }

  A.register({
    id: 'drop-zone',
    title: 'Drop Zone',
    tagline: 'Steer the jumper onto the strip that answers the question.',
    blurb: 'A jumper drifts over three landing strips and each one carries a sentence, but only one is a point from the model answer to the board question in the mission brief. Steer onto it before the altitude runs out: every five right landings pulls the decoys closer to the question, never speeds up the drop.',
    controls: '↑/↓ or W/S pick the strip · Space pulls the risers · Enter lands now · tap a strip on touch · P pauses',
    icon: '🪂',
    accent: A.C.teal,
    drills: 'Matching board questions to the points in their answers',
    dataOk: function (D) { return poolOf(D).length >= MIN_ITEMS; },

    create: function (api) {
      var C = api.C, W = api.W, H = api.H;

      // ---- layout --------------------------------------------------------
      var CARD = { x: 16, y: 10, w: 928, h: 152 };
      var CARD_SPLIT = 640;                       // the brief text ends here; the run tags sit to the right
      var QLINES = 4, QSIZE = 17, QLH = 22;
      var FIELD_TOP = 166;
      var STRIP = { x: 20, w: 920, h: 78 };
      var STRIP_Y = [258, 350, 442];              // strip centres, 92 apart
      var TEXT_X = 88, TEXT_W = 684;              // the sentence column, clear of the flight corridor
      var PAD = { x: 782, w: 152, cx: 858 };      // touchdown pad at the right end of every strip
      var JX_MIN = 818, JX_MAX = 898;             // the jumper drifts inside the corridor, never over the text
      var ALT = { x: 116, y: 506, w: 560, h: 18 };
      var LAND = { x: 772, y: 492, w: 168, h: 36 };
      var HINT_Y = 192;

      // ---- question levels (shell-owned) ---------------------------------
      api.progress.configure({ perLevel: PER_LEVEL });
      function levelNow() { return api.clamp(Math.round(Number(api.progress.level)) || 1, 1, 3); }
      function levelName(n) { var names = api.progress.names; return (names && names[n - 1]) || LEVEL_NAMES[n - 1]; }
      function correctToNext() {
        var lvl = levelNow(), max = api.clamp(Math.round(Number(api.progress.maxLevel)) || 3, 1, 3);
        if (lvl >= max) return 0;
        var per = Number(api.progress.perLevel) || PER_LEVEL, since = Number(api.progress.sinceUp) || 0;
        return Math.max(1, per - since);
      }

      // ---- pool and the flat point index ---------------------------------
      var POOL = poolOf(api.data).slice();
      var POINTS = [];                            // every usable point, with the item it belongs to
      (function () {
        var i, j, it, key;
        for (i = 0; i < POOL.length; i++) {
          it = POOL[i];
          for (j = 0; j < it.points.length; j++) {
            key = squash(it.points[j]);
            if (!key) continue;
            POINTS.push({ t: it.points[j], k: key, it: it, w: null });
          }
        }
      })();

      function wordsOf(s) {
        var list = String(s == null ? '' : s).toLowerCase().match(/[a-z][a-z-]{3,}/g) || [], o = {}, i;
        for (i = 0; i < list.length; i++) o[list[i]] = 1;
        return o;
      }
      function wordsFor(p) { if (!p.w) p.w = wordsOf(p.t); return p.w; }
      function overlap(qwords, p) { var w = wordsFor(p), n = 0, k; for (k in w) if (qwords[k]) n++; return n; }
      // two strips must never say nearly the same thing
      function nearSame(a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        if (a.length < 24 || b.length < 24) return false;
        if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;
        return a.slice(0, 48) === b.slice(0, 48);
      }

      // Level 1 takes decoys from another domain, level 2 from the same domain but another topic, level 3 the
      // same set ranked by word overlap with the question. A short set falls back to the next wider one.
      function candidates(item, mode) {
        var out = [], mine = {}, i, p;
        for (i = 0; i < item.points.length; i++) mine[squash(item.points[i])] = 1;
        for (i = 0; i < POINTS.length; i++) {
          p = POINTS[i];
          if (p.it === item || mine[p.k]) continue;                  // never this question's own points
          if (item.fp && p.it.fp === item.fp) continue;              // nor a twin's (Q0020/Q0021, Q0109/Q0281): its point may answer this one too
          if (mode === 'far') { if (item.domain && p.it.domain === item.domain) continue; }
          else if (mode === 'near') {
            if (!item.domain || p.it.domain !== item.domain) continue;
            if (item.topic && p.it.topic === item.topic) continue;
          }
          out.push(p);
        }
        return out;
      }

      function takeTwo(list, rank, qwords) {
        var picked = [], i, p;
        if (rank) {
          list = list.slice().sort(function (a, b) {
            var d = overlap(qwords, b) - overlap(qwords, a);
            return d !== 0 ? d : (a.k < b.k ? -1 : 1);
          });
        } else list = api.shuffle(list);
        for (i = 0; i < list.length && picked.length < 2; i++) {
          p = list[i];
          if (picked.length && nearSame(picked[0].k, p.k)) continue;
          picked.push(p);
        }
        return picked;
      }

      function decoysFor(item, level, correctKey) {
        var qwords = wordsOf(item.text + ' ' + item.topic), chain, i, list, got, best = [];
        chain = level >= 2 ? ['near', 'far', 'any'] : ['far', 'any'];
        for (i = 0; i < chain.length; i++) {
          list = candidates(item, chain[i]).filter(function (p) { return !nearSame(p.k, correctKey); });
          got = takeTwo(list, level >= 3 && chain[i] === 'near', qwords);
          if (got.length === 2) return got;
          if (got.length > best.length) best = got;
        }
        // last resort on a tiny pool: allow look-alikes rather than fail (still never this question's own points)
        list = candidates(item, 'any');
        for (i = 0; i < list.length && best.length < 2; i++) if (best.indexOf(list[i]) < 0) best.push(list[i]);
        return best;
      }

      // ---- round state ---------------------------------------------------
      var LIVES = (api.difficulty && api.difficulty.lives) || 3;
      var runIndex = api.randInt(0, 997);         // rotates which point of an item is the correct one, run to run
      var st = {
        clock: 0, autoClock: -1,
        served: 0, answered: 0, right: 0, combo: 1, lives: LIVES, over: false,
        item: null, lines: [], correct: '', correctStrip: 1, chosen: -1, lockIdx: -1,
        phase: 'fly', alt: 1, fallRate: 0, landT: 0, cardT: 1, ok: false,
        target: 1, py: STRIP_Y[1], fromY: STRIP_Y[1], moveT: 1,
        jx: PAD.cx, vx: 0, gust: 0, gustV: 0, gustT: 2.4, gustFx: 0,
        wt: api.rand(0, 20), windSeed: api.rand(0, 6.283), wind: 0,
        deploy: 0, tilt: 0, riser: 0, puff: 0,
        hintT: 3.2, levelFx: 0, dragY: 0, downIdx: -1, tapLand: false, cite: '', wrap: null
      };

      api.hud.set({ lives: LIVES, maxLives: LIVES, combo: 1, level: levelNow(), time: null, progress: 0 });

      // ---- ground scenery (drifts with the wind) -------------------------
      var scrub = [], smoke = [], i0;
      for (i0 = 0; i0 < 46; i0++) scrub.push({ x: api.rand(0, W), y: api.rand(FIELD_TOP, H), r: api.rand(1.2, 3.4), k: api.randInt(0, 2) });
      for (i0 = 0; i0 < 3; i0++) smoke.push({ x: [64, 910, 128][i0], y: [312, 386, 466][i0], hue: [C.teal, C.gold, C.orange][i0], ph: api.rand(0, 1) });
      var drift = { x: 0, y: 0 };

      // ---- helpers -------------------------------------------------------
      function clampLines(ctx, str, size, weight, maxW, maxLines, fam) {
        ctx.save();
        ctx.font = api.font(size, fam || 'body', weight);
        var ls = api.wrap(ctx, str || '', maxW);
        ctx.restore();
        if (ls.length > maxLines) { ls = ls.slice(0, maxLines); ls[maxLines - 1] = ls[maxLines - 1] + ' …'; }
        return ls;
      }
      function clip(s, max) {
        var t = norm(s), cut, p;
        if (t.length <= max) return t;
        cut = t.slice(0, max);
        p = cut.lastIndexOf(' ');
        return (p > max * 0.6 ? cut.slice(0, p) : cut).replace(/[,;:.\s]+$/, '') + '…';
      }
      function trimAnswer(text, max) {
        var t = norm(text), cut, p;
        if (!t || t.length <= max) return t;
        cut = t.slice(0, max);
        p = cut.lastIndexOf('. ');
        if (p > max * 0.45) return cut.slice(0, p + 1);
        p = cut.lastIndexOf(' ');
        return (p > 60 ? cut.slice(0, p) : cut) + '…';
      }
      function pillW(ctx, label, size, fam) {
        ctx.save(); ctx.font = api.font(size || 16, fam || 'mono', 600);
        var w = ctx.measureText(label).width + 22; ctx.restore();
        return w;
      }
      function pillRight(ctx, label, rx, y, o) {
        o = o || {};
        return api.pill(ctx, label, rx - pillW(ctx, label, o.size, o.fam), y, o);
      }
      function hexA(hex, a) {
        var h = String(hex).replace('#', '');
        if (h.length !== 6) return 'rgba(255,255,255,' + a + ')';
        return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
      }
      function nearestStrip() {
        var y = st.py + st.gust, best = 0, bd = 1e9, i, d;
        for (i = 0; i < 3; i++) { d = Math.abs(STRIP_Y[i] - y); if (d < bd) { bd = d; best = i; } }
        return best;
      }

      // ---- steering ------------------------------------------------------
      function steer(n) {
        n = api.clamp(Math.round(n), 0, 2);
        if (st.over || st.phase !== 'fly' || n === st.target) return;
        st.fromY = st.py; st.target = n; st.moveT = 0;
        api.audio.blip();
      }
      function risers() {                          // pull the risers: an immediate correction toward the strip centre
        if (st.over || st.phase !== 'fly') return;
        st.gust *= 0.18; st.gustV = 0; st.riser = 1;
        st.py += (STRIP_Y[st.target] - st.py) * 0.45;
        api.audio.tick();
        api.particles.emit({ x: st.jx, y: st.py + st.gust - 26, n: 8, color: [C.teal, C.sky], speed: 120, life: .45, size: 4, gravity: -30 });
      }
      function nudge(dir) {                        // cosmetic: lean against the wind
        if (st.over || st.phase !== 'fly') return;
        st.vx += dir * 120;
      }
      function commit() {                          // cut away and land now, on the strip the player picked
        if (st.over || st.phase !== 'fly' || !st.item) return;
        if ((st.age || 0) < COMMIT_LOCK) return;
        st.lockIdx = st.target;                    // not nearestStrip(): a quick ↓ then Enter (or a double tap) still reads the old strip mid-move
        st.phase = 'fall';
        st.fallRate = Math.max(st.alt, 0.1) / FALL_SECONDS;
        api.audio.whoosh();
      }

      // ---- questions -----------------------------------------------------
      function nextItem() {
        var tries, item = null, dec = null, correct = '', lvl = levelNow(), i, mix;
        for (tries = 0; tries < 6 && !item; tries++) {
          item = POOL.length ? api.progress.pick(POOL) : null;
          if (!item) break;
          correct = item.points[(runIndex + st.served) % item.points.length] || item.points[0];
          dec = decoysFor(item, lvl, squash(correct));
          if (!dec || dec.length < 2) item = null;
        }
        if (!item || !dec || dec.length < 2) { finish('cap'); return; }

        st.served++;
        mix = api.shuffle([{ t: correct, ok: true }, { t: dec[0].t, ok: false }, { t: dec[1].t, ok: false }]);
        st.item = item; st.lines = mix; st.correct = correct;
        st.correctStrip = 0;
        for (i = 0; i < mix.length; i++) if (mix[i].ok) st.correctStrip = i;
        st.cite = (item.q && Array.isArray(item.q.cites)) ? item.q.cites.join('; ') : '';
        st.wrap = null;                                              // wrapped card text, built on the first frame of this brief

        st.phase = 'fly'; st.alt = 1; st.chosen = -1; st.lockIdx = -1; st.ok = false;
        st.target = 1; st.py = STRIP_Y[1]; st.fromY = STRIP_Y[1]; st.moveT = 1;
        st.jx = api.rand(JX_MIN + 10, JX_MAX - 10); st.vx = 0;
        st.gust = 0; st.gustV = 0; st.gustT = api.rand(1.6, 2.8);
        st.deploy = 1; st.cardT = st.served === 1 ? 1 : 0;           // the first brief is already in place
        st.age = 0;                                                  // game seconds since this brief appeared

        // the reading pause gets the question and every label that is on screen
        api.ready(item.text + '  A: ' + mix[0].t + '  B: ' + mix[1].t + '  C: ' + mix[2].t);
      }

      function land(idx) {
        var item = st.item, chosen, ok, q;
        if (!item || st.phase === 'land') return;
        idx = api.clamp(Math.round(idx), 0, 2);
        chosen = st.lines[idx] ? st.lines[idx].t : '';
        ok = !!(st.lines[idx] && st.lines[idx].ok);
        q = item.q || {};
        st.chosen = idx; st.ok = ok; st.phase = 'land'; st.landT = HOLD_SECONDS;
        st.answered++; st.puff = 1; st.hintT = 0;        // the verdict takes the header row from the hint

        api.review.add({
          prompt: item.stem,
          correct: st.correct,
          given: chosen || 'no landing',
          ok: ok,
          explanation: 'From the model answer: ' + trimAnswer(q.answer, 900) + (q.status === 'ai-draft' ? ' (AI draft: verify)' : ''),
          cite: st.cite
        });

        if (ok) {
          st.right++;
          api.score(100 * st.combo);
          st.combo = Math.min(9, st.combo + 1);
          api.audio.correct();
          api.particles.emit({ x: st.jx, y: STRIP_Y[idx], n: 34, color: [C.teal, C.green, C.white], speed: 300, life: .8, size: 6, gravity: 60, shape: 'spark' });
          api.particles.emit({ x: st.jx, y: STRIP_Y[idx] + 6, n: 16, color: [C.teal, '#9fe8e0'], speed: 150, life: 1.0, size: 9, gravity: -20 });
          // no shell banner per answer: it sits over strip A's sentence (CSS top 42%) while the result holds;
          // the verdict pill in the header band, the ✓/✕ marks and the strip colours carry it
          api.hud.set({ combo: st.combo });
          if (api.progress.correct()) {            // the shell still shows its level-up banner
            st.levelFx = 1.8;
            api.particles.emit({ x: CARD.x + CARD.w - 150, y: CARD.y + 72, n: 30, color: [LEVEL_COLORS[levelNow() - 1], C.gold2, C.white], speed: 240, life: .9, size: 6, gravity: 50, shape: 'spark' });
          }
          api.hud.set({ level: levelNow() });
        } else {
          st.combo = 1;
          api.audio.wrong();
          api.shake(15);
          api.flash('rgba(255,107,107,.26)');
          api.particles.emit({ x: st.jx, y: STRIP_Y[idx], n: 26, color: [C.red, C.orange], speed: 280, life: .75, size: 6, gravity: 220 });
          api.hud.set({ combo: 1 });
          st.lives = api.life(-1);
          if (st.lives <= 0) { finish('lives'); return; }
        }
        api.hud.set({ progress: st.answered / ROUND_ITEMS });
      }

      function finish(reason) {
        if (st.over) return;
        st.over = true;
        var msg = 'You matched ' + st.right + ' of ' + st.answered + ' questions to their answers.';
        if (reason === 'lives') api.end({ won: false, title: 'Off the DZ', message: msg + ' Every miss is explained below.' });
        else api.end({ won: st.right > 0, title: 'Drop zone secured', message: msg });
      }

      // ---- update --------------------------------------------------------
      function update(dt) {
        if (st.over) return;
        st.clock += dt;
        st.age = (st.age || 0) + dt;
        if (st.hintT > 0) st.hintT -= dt;
        if (st.levelFx > 0) st.levelFx = Math.max(0, st.levelFx - dt);
        if (st.riser > 0) st.riser = Math.max(0, st.riser - dt * 2.4);
        if (st.puff > 0) st.puff = Math.max(0, st.puff - dt * 1.4);
        if (st.deploy > 0) st.deploy = Math.max(0, st.deploy - dt / 0.5);
        if (st.cardT < 1) st.cardT = Math.min(1, st.cardT + dt / SLIDE_SECONDS);
        if (st.gustFx > 0) st.gustFx = Math.max(0, st.gustFx - dt * 1.6);

        // wind: a slow lateral drift the jumper has to lean against
        st.wt += dt;
        st.wind = Math.sin(st.wt * 0.42 + st.windSeed) * 26 + Math.sin(st.wt * 0.17 + 1.7) * 12;
        drift.x -= st.wind * dt * 0.5;
        drift.y += 5 * dt;

        if (!st.item) { nextItem(); return; }

        if (st.phase === 'fly') {
          // gusts nudge toward a neighbouring strip, but never in the last moments before the ground
          st.gustT -= dt;
          if (st.gustT <= 0) {
            st.gustT = api.rand(2.0, 3.4);
            if (st.alt > 0.34) {
              st.gustV += (Math.random() < 0.5 ? -1 : 1) * api.rand(70, 130);
              st.gustFx = 1;
              api.audio.whoosh();
            }
          }
          st.gust += st.gustV * dt;
          st.gustV *= Math.pow(0.12, dt);
          st.gust *= Math.pow(0.5, dt);
          st.gust = api.clamp(st.gust, -GUST_MAX, GUST_MAX);

          // lateral drift plus the player's cosmetic nudges
          st.vx += st.wind * dt * 1.6;
          st.vx *= Math.pow(0.22, dt);
          st.jx = api.clamp(st.jx + st.vx * dt, JX_MIN, JX_MAX);

          // eased strip change
          if (st.moveT < 1) {
            st.moveT = Math.min(1, st.moveT + dt / MOVE_SECONDS);
            st.py = st.fromY + (STRIP_Y[st.target] - st.fromY) * api.ease.outCubic(st.moveT);
          } else st.py = STRIP_Y[st.target];

          st.alt -= dt / DROP_SECONDS;
          if (st.alt <= 0) { st.alt = 0; land(nearestStrip()); }
        } else if (st.phase === 'fall') {
          st.gust *= Math.pow(0.02, dt);
          st.py += (STRIP_Y[st.lockIdx] - st.py) * Math.min(1, dt * 9);
          st.vx *= Math.pow(0.05, dt);
          st.jx = api.clamp(st.jx + st.vx * dt, JX_MIN, JX_MAX);
          st.alt -= st.fallRate * dt;
          if (st.alt <= 0) { st.alt = 0; land(st.lockIdx); }
        } else {                                     // landed: hold the result, then the next brief slides in
          st.landT -= dt;
          if (st.landT <= 0) {
            if (st.answered >= ROUND_ITEMS) { finish('cap'); return; }
            st.item = null;
            nextItem();
          }
        }
        st.tilt = api.clamp(st.vx * 0.0016 + (STRIP_Y[st.target] - st.py) * -0.0016, -0.3, 0.3);
      }

      // ================= drawing ==========================================
      function drawField(ctx) {
        var g = ctx.createLinearGradient(0, FIELD_TOP, 0, H), i, s, x, y, gx, gy;
        g.addColorStop(0, '#111c2e');
        g.addColorStop(0.45, '#0c1422');
        g.addColorStop(1, '#070c16');
        ctx.fillStyle = g; ctx.fillRect(0, FIELD_TOP, W, H - FIELD_TOP);

        ctx.save();
        ctx.beginPath(); ctx.rect(0, FIELD_TOP, W, H - FIELD_TOP); ctx.clip();   // scenery never bleeds over the brief

        // survey grid, drifting with the wind
        gx = -(((drift.x % 64) + 64) % 64);
        gy = -(((drift.y % 64) + 64) % 64);
        ctx.save();
        ctx.strokeStyle = 'rgba(79,209,197,.06)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (x = gx; x < W + 64; x += 64) { ctx.moveTo(x, FIELD_TOP); ctx.lineTo(x, H); }
        for (y = FIELD_TOP + gy; y < H + 64; y += 64) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
        ctx.restore();

        // scrub
        ctx.save();
        for (i = 0; i < scrub.length; i++) {
          s = scrub[i];
          x = (((s.x + drift.x * 0.6) % W) + W) % W;
          y = FIELD_TOP + (((s.y - FIELD_TOP + drift.y * 0.6) % (H - FIELD_TOP)) + (H - FIELD_TOP)) % (H - FIELD_TOP);
          ctx.globalAlpha = 0.14 + (s.k * 0.05);
          ctx.fillStyle = s.k === 2 ? C.teal : '#5b6a86';
          if (s.k === 1) ctx.fillRect(x, y, s.r * 2.4, s.r);
          else { ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.restore();

        // drifting smoke markers
        ctx.save();
        for (i = 0; i < smoke.length; i++) {
          var m = smoke[i], p, age, px, py, r;
          for (p = 0; p < 7; p++) {
            age = ((st.wt * 0.22 + m.ph + p / 7) % 1);
            px = m.x + st.wind * age * 2.6 + Math.sin(age * 6 + p) * 6;
            py = m.y - age * 14;
            r = 7 + age * 30;
            ctx.globalAlpha = 0.20 * (1 - age);
            ctx.fillStyle = m.hue;
            ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = m.hue;
          ctx.beginPath(); ctx.arc(m.x, m.y, 3.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // drop-zone boundary
        ctx.setLineDash([12, 10]);
        ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1.5;
        api.roundRect(ctx, 8, 206, W - 16, 286, 18); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // the header band shares its row with the opening hint, so it fades in as the hint fades out
      function drawHeader(ctx) {
        var al = st.hintT > 0 ? 1 - Math.min(1, st.hintT / 0.9) : 1;
        if (al <= 0.01) return;
        var wind = st.wind, dir = wind >= 0 ? 1 : -1, len = 22 + Math.min(30, Math.abs(wind) * 0.8);
        var bx = 806, by = 212, top = by - 30, wob = Math.sin(st.wt * 3) * 2, k;
        ctx.save();
        ctx.globalAlpha = al;
        api.text(ctx, 'LANDING STRIPS', STRIP.x + 4, HINT_Y + 5, { size: 16, fam: 'mono', weight: 700, color: C.muted });
        ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(STRIP.x + 152, HINT_Y); ctx.lineTo(676, HINT_Y); ctx.stroke();

        // wind sock on its pole, clear of the label at full stretch
        api.text(ctx, 'WIND', bx - 76, HINT_Y + 5, { size: 16, fam: 'mono', weight: 700, align: 'right', color: st.gustFx > 0 ? C.orange : C.muted });
        ctx.strokeStyle = 'rgba(255,255,255,.26)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, top); ctx.stroke();
        ctx.translate(bx, top);
        api.glow(ctx, st.gustFx > 0 ? C.orange : C.teal, 10);
        ctx.fillStyle = st.gustFx > 0 ? C.orange : C.teal;
        ctx.globalAlpha = al * .9;
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(dir * len, -4 + wob); ctx.lineTo(dir * len, 4 + wob); ctx.lineTo(0, 8);
        ctx.closePath(); ctx.fill();
        api.noGlow(ctx);
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        for (k = 1; k <= 2; k++) ctx.fillRect(dir * len * (k / 3) - 2, -7 + wob * (k / 3), 4, 14 - k * 2);
        ctx.restore();
      }

      function stripMode(i) {
        if (st.phase === 'land' || st.phase === 'fall') {
          if (st.chosen < 0 && st.phase === 'fall') return i === st.lockIdx ? 'under' : 'idle';
          if (i === st.correctStrip) return 'good';
          if (i === st.chosen) return 'bad';
          return 'dim';
        }
        return i === nearestStrip() ? 'under' : 'idle';
      }

      function drawStrips(ctx) {
        var i, mode, col, top, ls, n, ty, slide, alpha, x, k;
        for (i = 0; i < 3; i++) {
          mode = stripMode(i);
          col = mode === 'good' ? C.green : mode === 'bad' ? C.red : mode === 'under' ? C.teal : mode === 'dim' ? C.muted : C.sky;
          top = STRIP_Y[i] - STRIP.h / 2;
          slide = api.ease.outCubic(api.clamp((st.cardT - i * 0.07) / 0.86, 0, 1));
          alpha = mode === 'dim' ? 0.45 : 1;
          ctx.save();
          ctx.globalAlpha = alpha * (0.15 + 0.85 * slide);
          ctx.translate((1 - slide) * -70, 0);

          // body
          api.roundRect(ctx, STRIP.x, top, STRIP.w, STRIP.h, 14);
          ctx.fillStyle = mode === 'good' ? 'rgba(25,70,52,.55)' : mode === 'bad' ? 'rgba(78,26,32,.55)' : mode === 'under' ? 'rgba(18,48,56,.55)' : 'rgba(12,20,34,.66)';
          ctx.fill();
          if (mode === 'under' || mode === 'good' || mode === 'bad') api.glow(ctx, col, 20);
          ctx.strokeStyle = mode === 'idle' ? 'rgba(255,255,255,.14)' : col;
          ctx.lineWidth = mode === 'idle' ? 1.2 : 2.2;
          ctx.stroke();
          api.noGlow(ctx);

          // threshold bars at the near end, like a runway seen from above
          ctx.fillStyle = hexA(mode === 'idle' ? C.sky : col, mode === 'idle' ? 0.22 : 0.6);
          for (k = 0; k < 4; k++) ctx.fillRect(STRIP.x + 6, top + 14 + k * 13, 5, 9);

          // centre dashes, stopping short of the touchdown pad
          ctx.save();
          ctx.globalAlpha = ctx.globalAlpha * 0.18;
          ctx.setLineDash([26, 22]);
          ctx.strokeStyle = col; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(TEXT_X, STRIP_Y[i]); ctx.lineTo(PAD.x - 10, STRIP_Y[i]); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          // letter badge
          x = STRIP.x + 10;
          api.roundRect(ctx, x, STRIP_Y[i] - 22, 44, 44, 12);
          ctx.fillStyle = mode === 'idle' ? 'rgba(255,255,255,.07)' : hexA(col, 0.22); ctx.fill();
          ctx.strokeStyle = mode === 'idle' ? 'rgba(255,255,255,.18)' : col; ctx.lineWidth = 1.5; ctx.stroke();
          api.text(ctx, BADGE[i], x + 22, STRIP_Y[i] + 1, { size: 21, fam: 'mono', weight: 700, align: 'center', baseline: 'middle', color: mode === 'idle' ? C.ink2 : C.ink });

          // touchdown pad: the corridor the jumper drifts in, kept clear of the sentence
          ctx.save();
          ctx.globalAlpha = ctx.globalAlpha * (mode === 'idle' ? 0.5 : 0.9);
          api.roundRect(ctx, PAD.x, STRIP_Y[i] - 28, PAD.w, 56, 10);
          ctx.fillStyle = mode === 'idle' ? 'rgba(255,255,255,.03)' : hexA(col, 0.12); ctx.fill();
          ctx.strokeStyle = mode === 'idle' ? 'rgba(255,255,255,.12)' : hexA(col, 0.65);
          ctx.lineWidth = 1.2; ctx.stroke();
          ctx.strokeStyle = mode === 'idle' ? 'rgba(255,255,255,.22)' : col; ctx.lineWidth = 2.4;
          ctx.beginPath();
          for (k = 0; k < 4; k++) {                          // corner brackets
            var cx0 = k % 2 ? PAD.x + PAD.w - 4 : PAD.x + 4, cy0 = k < 2 ? STRIP_Y[i] - 24 : STRIP_Y[i] + 24;
            ctx.moveTo(cx0 + (k % 2 ? -13 : 13), cy0); ctx.lineTo(cx0, cy0); ctx.lineTo(cx0, cy0 + (k < 2 ? 11 : -11));
          }
          ctx.stroke();
          ctx.restore();

          // the sentence (wrapped once per brief, not every frame)
          ls = st.lines[i] ? (st.lines[i].ls || (st.lines[i].ls = clampLines(ctx, unlig(clip(st.lines[i].t, POINT_CUT)), 16, 500, TEXT_W, 2))) : [];
          n = ls.length;
          ty = STRIP_Y[i] - (n - 1) * 10.5 + 5;
          for (k = 0; k < n; k++) {
            api.text(ctx, ls[k], TEXT_X, ty + k * 21, { size: 16, weight: 500, color: mode === 'dim' ? C.ink2 : C.ink });
          }

          ctx.restore();
        }
      }

      function drawJumper(ctx) {
        if (!st.item) return;
        var a = api.clamp(st.alt, 0, 1), jy = st.py + st.gust, s = 0.74 + 0.36 * a;
        // the canopy blossoms open, but never from nothing: a reading pause can freeze this frame
        var dep = st.deploy > 0 ? 0.52 + 0.48 * api.ease.outBack(api.clamp(1 - st.deploy, 0, 1)) : 1;
        var i;

        // shadow on the ground: it closes on the jumper as the altitude falls
        ctx.save();
        ctx.globalAlpha = 0.16 + 0.32 * (1 - a);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(st.jx + 30 * a, jy + 30 * a, (14 + 15 * a) * dep, (7 + 8 * a) * dep, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // landing puff on touchdown
        if (st.puff > 0 && st.chosen >= 0) {
          ctx.save();
          ctx.globalAlpha = 0.35 * st.puff;
          ctx.strokeStyle = st.ok ? C.teal : C.red; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(st.jx, STRIP_Y[st.chosen], 18 + (1 - st.puff) * 60, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(st.jx, jy);
        ctx.rotate(st.tilt);
        ctx.scale(s * (0.4 + 0.6 * dep), s * dep);

        // rig lines
        // the canopy folds over to one side once the jumper is down
        var fold = st.phase === 'land' ? 1 - api.clamp(st.landT / HOLD_SECONDS, 0, 1) : 0;
        ctx.save();
        ctx.translate(fold * 26, fold * 10);
        ctx.rotate(fold * 0.55);
        ctx.scale(1 - fold * 0.28, 1 - fold * 0.62);

        ctx.strokeStyle = 'rgba(233,238,248,.55)'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (i = -2; i <= 2; i++) { ctx.moveTo(i * 22, -20); ctx.lineTo(i * 3, 14); }
        ctx.stroke();

        // canopy
        api.glow(ctx, st.ok && st.phase === 'land' ? C.green : C.teal, 18);
        var cg = ctx.createLinearGradient(0, -54, 0, -16);
        cg.addColorStop(0, '#7fe6dc');
        cg.addColorStop(0.55, C.teal);
        cg.addColorStop(1, '#1f7f79');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.moveTo(-48, -20);
        ctx.bezierCurveTo(-48, -64, 48, -64, 48, -20);
        ctx.quadraticCurveTo(36, -11, 24, -20);
        ctx.quadraticCurveTo(12, -11, 0, -20);
        ctx.quadraticCurveTo(-12, -11, -24, -20);
        ctx.quadraticCurveTo(-36, -11, -48, -20);
        ctx.closePath();
        ctx.fill();
        api.noGlow(ctx);
        // cell lines
        ctx.strokeStyle = 'rgba(6,18,24,.45)'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (i = -1; i <= 1; i++) { ctx.moveTo(i * 24, -20); ctx.bezierCurveTo(i * 24, -44, i * 17, -52, 0, -54); }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-43, -30); ctx.bezierCurveTo(-25, -54, 25, -54, 43, -30); ctx.stroke();
        ctx.restore();

        // the jumper
        ctx.fillStyle = '#e9eef8';
        api.roundRect(ctx, -7, 12, 14, 22, 6); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 7, 6.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e9eef8'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-4, 32); ctx.lineTo(-9 - st.tilt * 10, 44);
        ctx.moveTo(4, 32); ctx.lineTo(9 - st.tilt * 10, 44);
        ctx.stroke();
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(-6, 16); ctx.lineTo(-14, 6);
        ctx.moveTo(6, 16); ctx.lineTo(14, 6);
        ctx.stroke();
        // ruck
        ctx.fillStyle = C.gold;
        api.roundRect(ctx, -6, 22, 12, 12, 3); ctx.fill();
        ctx.restore();

        // riser-pull flash
        if (st.riser > 0) {
          ctx.save();
          ctx.globalAlpha = st.riser * 0.5;
          ctx.strokeStyle = C.teal; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(st.jx, jy, 46 + (1 - st.riser) * 26, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
      }

      // verdict marks ride on top of the jumper so the canopy never hides them
      function drawMarks(ctx) {
        var i, mode, col;
        for (i = 0; i < 3; i++) {
          mode = stripMode(i);
          if (mode !== 'good' && mode !== 'bad') continue;
          col = mode === 'good' ? C.green : C.red;
          ctx.save();
          ctx.beginPath(); ctx.arc(PAD.x + 26, STRIP_Y[i], 17, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(6,10,20,.78)'; ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
          ctx.restore();
          api.text(ctx, mode === 'good' ? '✓' : '✕', PAD.x + 26, STRIP_Y[i] + 1,
            { size: 22, weight: 700, align: 'center', baseline: 'middle', color: col });
        }
      }

      function drawCard(ctx) {
        var it = st.item, slide = (1 - api.ease.outCubic(api.clamp(st.cardT, 0, 1))) * (W + 40);
        var lvl = levelNow(), col = LEVEL_COLORS[lvl - 1], rx = CARD.x + CARD.w - 24, i, ls, need, kick;
        ctx.save();
        ctx.translate(slide, 0);

        api.roundRect(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 16);
        ctx.fillStyle = 'rgba(9,15,28,.92)'; ctx.fill();
        ctx.strokeStyle = st.phase === 'land' ? (st.ok ? 'rgba(95,211,154,.55)' : 'rgba(255,107,107,.55)') : 'rgba(255,255,255,.14)';
        ctx.lineWidth = 1.5; ctx.stroke();
        api.roundRect(ctx, CARD.x, CARD.y, 6, CARD.h, 3);
        ctx.fillStyle = st.phase === 'land' ? (st.ok ? C.green : C.red) : C.teal; ctx.fill();

        if (!it) { ctx.restore(); return; }

        // wrap the brief once per item: a 1,100-character question is ~180 measureText calls a frame otherwise
        if (!st.wrap) {
          kick = it.domain + (it.topic ? ' · ' + it.topic : '');
          st.wrap = {
            kick: clampLines(ctx, unlig(kick), 16, 600, CARD_SPLIT - 180, 1),
            q: clampLines(ctx, unlig(it.text), QSIZE, 700, CARD_SPLIT - CARD.x - 44, QLINES),
            cite: st.cite ? clampLines(ctx, 'Cite · ' + st.cite, 16, 600, CARD_SPLIT - CARD.x - 44, 1, 'mono') : null
          };
        }

        // kicker: MISSION BRIEF + where the question comes from
        api.text(ctx, 'MISSION BRIEF', CARD.x + 26, CARD.y + 30, { size: 16, fam: 'mono', weight: 700, color: C.teal });
        api.text(ctx, st.wrap.kick[0], CARD.x + 160, CARD.y + 30, { size: 16, weight: 600, color: C.muted });

        // the question, verbatim, trimmed to what fits; a short question sits centred in the same box
        ls = st.wrap.q;
        var qy = CARD.y + 50 + (QLINES - ls.length) * (QLH / 2);
        for (i = 0; i < ls.length; i++) {
          api.text(ctx, ls[i], CARD.x + 26, qy + i * QLH, { size: QSIZE, weight: 700, color: C.ink });
        }

        // bottom line: the task, or the citation once the jumper is down
        if (st.phase === 'land' && st.wrap.cite) {
          api.text(ctx, st.wrap.cite[0], CARD.x + 26, CARD.y + CARD.h - 12, { size: 16, fam: 'mono', weight: 600, color: C.ink2 });
        } else {
          api.text(ctx, 'Land on the strip carrying a point from THIS question’s answer', CARD.x + 26, CARD.y + CARD.h - 12,
            { size: 16, weight: 600, color: C.gold2 });
        }

        // right column: item counter, level, question id, steps to the next level
        pillRight(ctx, 'ITEM ' + api.clamp(st.served, 1, ROUND_ITEMS) + ' / ' + ROUND_ITEMS, rx, CARD.y + 34,
          { size: 16, fam: 'mono', bg: 'rgba(79,209,197,.14)', stroke: 'rgba(79,209,197,.45)', color: C.ink });
        ctx.save();
        if (st.levelFx > 0) api.glow(ctx, col, 10 + 20 * Math.min(1, st.levelFx / 0.6));
        pillRight(ctx, levelName(lvl).toUpperCase(), rx, CARD.y + 70,   // the HUD already shows the level number
          { size: 16, fam: 'mono', bg: 'rgba(6,10,20,.85)', stroke: col, lineWidth: 1.6, color: C.ink });
        ctx.restore();
        need = correctToNext();
        api.text(ctx, need > 0 ? need + ' more for level ' + (lvl + 1) : 'Top level · closest decoys', rx, CARD.y + 104,
          { size: 16, weight: 600, align: 'right', color: C.ink2 });
        api.text(ctx, String((it.q && it.q.id) || ''), rx, CARD.y + 130, { size: 16, fam: 'mono', weight: 700, align: 'right', color: C.muted });

        // divider
        ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(CARD_SPLIT, CARD.y + 18); ctx.lineTo(CARD_SPLIT, CARD.y + CARD.h - 18); ctx.stroke();
        ctx.restore();
      }

      function drawAltimeter(ctx) {
        var a = api.clamp(st.alt, 0, 1), w = Math.max(2, ALT.w * a), i, x;
        var col = a > 0.55 ? C.teal : a > 0.28 ? C.gold : C.red;
        api.text(ctx, 'ALTITUDE', STRIP.x + 4, ALT.y + 14, { size: 16, fam: 'mono', weight: 700, color: C.muted });

        api.roundRect(ctx, ALT.x, ALT.y, ALT.w, ALT.h, 9);
        ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.stroke();

        ctx.save();
        api.roundRect(ctx, ALT.x, ALT.y, ALT.w, ALT.h, 9); ctx.clip();
        var g = ctx.createLinearGradient(ALT.x, 0, ALT.x + ALT.w, 0);
        g.addColorStop(0, hexA(col, 0.95));
        g.addColorStop(1, hexA(col, 0.45));
        ctx.fillStyle = g;
        ctx.fillRect(ALT.x, ALT.y, w, ALT.h);
        ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (i = 1; i < 9; i++) { x = ALT.x + ALT.w * (i / 9); ctx.moveTo(x, ALT.y); ctx.lineTo(x, ALT.y + ALT.h); }
        ctx.stroke();
        ctx.restore();

        if (a <= 0.28 && st.phase === 'fly') {
          ctx.save();
          ctx.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(st.clock * 7));
          api.glow(ctx, C.red, 16);
          api.roundRect(ctx, ALT.x, ALT.y, ALT.w, ALT.h, 9);
          ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.stroke();
          api.noGlow(ctx);
          ctx.restore();
        }
        api.text(ctx, String(Math.round(a * 30) * 100) + ' FT', LAND.x - 16, ALT.y + 14,
          { size: 16, fam: 'mono', weight: 700, align: 'right', color: col });

        // land-now button
        var hot = st.phase === 'fly';
        api.roundRect(ctx, LAND.x, LAND.y, LAND.w, LAND.h, 10);
        ctx.fillStyle = hot ? 'rgba(79,209,197,.16)' : 'rgba(255,255,255,.05)'; ctx.fill();
        ctx.strokeStyle = hot ? 'rgba(79,209,197,.55)' : 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5; ctx.stroke();
        api.text(ctx, '⤓ LAND NOW', LAND.x + LAND.w / 2, LAND.y + LAND.h / 2 + 1,
          { size: 16, weight: 700, align: 'center', baseline: 'middle', color: hot ? C.ink : C.muted });
      }

      function drawHint(ctx) {
        if (st.hintT <= 0) return;
        var al = Math.min(1, st.hintT / 0.9);
        var a = '↑ ↓ or W / S pick the strip · tap a strip on touch';
        var b = 'Space pulls the risers · Enter lands now';
        var wa = pillW(ctx, a, 17, 'body'), wb = pillW(ctx, b, 16, 'body'), total = wa + 12 + wb, x0 = (W - total) / 2;
        ctx.save();
        ctx.globalAlpha = al;
        api.pill(ctx, a, x0 + wa / 2, HINT_Y, { size: 17, fam: 'body', align: 'center', bg: 'rgba(6,10,20,.88)', stroke: 'rgba(79,209,197,.5)', color: C.ink });
        api.pill(ctx, b, x0 + wa + 12 + wb / 2, HINT_Y, { size: 16, fam: 'body', align: 'center', bg: 'rgba(6,10,20,.8)', stroke: 'rgba(255,255,255,.16)', color: C.ink2 });
        ctx.restore();
      }

      // the verdict sits in the header band, clear of the strips and of the shell's own banner
      function drawVerdict(ctx) {
        if (st.phase !== 'land' || st.chosen < 0) return;
        var f = api.clamp(st.landT / HOLD_SECONDS, 0, 1), lift = (1 - f) * 10;
        var label = st.ok ? '✓ A point from this answer' : '✕ That point answers another question';
        ctx.save();
        ctx.globalAlpha = Math.min(1, f * 2.4);
        api.pill(ctx, label, W / 2, HINT_Y - 6 - lift,
          { size: 18, fam: 'body', align: 'center', bg: st.ok ? 'rgba(18,54,42,.94)' : 'rgba(62,20,26,.94)', stroke: st.ok ? C.green : C.red, color: C.ink });
        ctx.restore();
      }

      function draw(ctx) {
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
        drawField(ctx);
        drawHeader(ctx);
        drawStrips(ctx);
        drawJumper(ctx);
        drawMarks(ctx);
        drawAltimeter(ctx);
        drawCard(ctx);
        drawVerdict(ctx);
        drawHint(ctx);
      }

      // ---- input ---------------------------------------------------------
      function onKey(k, down) {
        if (!down || st.over) return;
        if (k === 'ArrowUp' || k === 'w' || k === 'W') steer(st.target - 1);
        else if (k === 'ArrowDown' || k === 's' || k === 'S') steer(st.target + 1);
        else if (k === 'ArrowLeft' || k === 'a' || k === 'A') nudge(-1);
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') nudge(1);
        else if (k === ' ' || k === 'Spacebar') risers();
        else if (k === 'Enter') commit();
        else if (k === '1' || k === '2' || k === '3') steer(Number(k) - 1);
      }

      function stripAt(y) {
        var i;
        for (i = 0; i < 3; i++) if (y >= STRIP_Y[i] - 46 && y <= STRIP_Y[i] + 46) return i;
        return -1;
      }

      function onPointer(p) {
        if (!p || st.over) return;
        if (p.type === 'down') {
          st.dragY = 0; st.downIdx = -1; st.tapLand = false;
          if (p.x >= LAND.x - 8 && p.x <= LAND.x + LAND.w + 8 && p.y >= LAND.y - 10 && p.y <= LAND.y + LAND.h + 10) { commit(); return; }
          var i = stripAt(p.y);
          if (i >= 0) {
            st.downIdx = i;
            // tapping the strip you are already over lands there, on release: a press on the jumper that turns
            // into a drag steers instead of landing at once
            if (i === st.target) st.tapLand = true;
            else steer(i);
          }
        } else if (p.type === 'move' && api.input.pointer.down) {
          st.dragY += p.dy || 0;
          if (Math.abs(st.dragY) > 12) st.tapLand = false;
          if (st.dragY > 40) { steer(st.target + 1); st.dragY = 0; }
          else if (st.dragY < -40) { steer(st.target - 1); st.dragY = 0; }
        } else if (p.type === 'up') {
          if (st.tapLand && stripAt(p.y) === st.downIdx) commit();
          st.dragY = 0; st.downIdx = -1; st.tapLand = false;
        }
      }

      // ---- test hook (the play harness, never the shell) ------------------
      // Steers to the right strip (ok) or a wrong one, pulls the risers when the wind has carried the
      // jumper off, then lands. When the game clock has not moved since the last call the shell's reading
      // pause is holding it, so a Space keydown releases the gate the way the player's would.
      function _auto(ok) {
        if (st.over) return false;
        if (st.autoClock === st.clock) {
          try { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); } catch (e) {}
        }
        st.autoClock = st.clock;
        if (!st.item || st.phase !== 'fly') return false;
        var want = ok ? st.correctStrip : (st.correctStrip + 1) % 3;
        if (st.target !== want) { steer(want); return true; }
        if (Math.abs(st.gust) > 8) { risers(); return true; }
        if (Math.abs(st.py - STRIP_Y[want]) < 6) commit();
        return true;
      }

      nextItem();

      return {
        update: update,
        draw: draw,
        onKey: onKey,
        onPointer: onPointer,
        _auto: _auto,
        destroy: function () {
          st.item = null; st.lines = []; st.over = true;
          POOL = []; POINTS.length = 0; scrub.length = 0; smoke.length = 0;
          memoFor = null; memoPool = null;
        }
      };
    }
  });
})();
