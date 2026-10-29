/* GAME: cite-express — a side-scrolling railway junction built on the citations behind the board answers.
   The board question is the cargo manifest. The main line forks into three tracks; each track carries a signal
   board showing a regulation citation. Throw the switch onto the track whose citation the model answer runs on
   before the engine reaches the points. Wrong track: red signal, a jolt, one life.
   Levels are question levels (api.progress): the decoy citations move closer — another framework, then the same
   framework, then the same part. The engine keeps its level-1 pace the whole way; the shell's clock gives harder
   levels more time. */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var ROUND_ITEMS = 20;                  // a round ends after 20 manifests, or sooner when lives run out
  var PER_LEVEL = 5;                     // correct answers per question level
  var MIN_POOL = 8;                      // below this the shell never starts the game
  var LEVEL_NAMES = ['Easy questions', 'Medium questions', 'Hard questions'];
  var LEVEL_COLORS = [A.C.green, A.C.sky, A.C.orange];
  var DECOY_RULE = ['ANOTHER FRAMEWORK', 'SAME FRAMEWORK', 'SAME PART'];

  // ---- citations ------------------------------------------------------------
  // A usable citation is one this game can put on a signal board and reason about: a framework plus a section
  // number. Everything else in the bank ("AFARS Appendix GG", "U.S.-ROK SOFA Article XV", policy memos) is shown
  // only in the explanation, never as a plate.
  var RE_FW = /^(FAR|DFARS PGI|DFARS|AFARS|PGI)\s+\d{1,4}(\.\d{1,4})?(-\d{1,3})?(\([^)]*\))*$/;
  var RE_USC = /^\d{1,2}\s+U\.S\.C\.\s+\d{3,5}[a-z]?(\([^)]*\))*$/;
  var RE_CFR = /^\d{1,2}\s+CFR\s+\d{1,4}(\.\d+)?(\([^)]*\))*$/;

  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().replace(/^RFO\s+/i, ''); }
  function dropParen(s) { return String(s).replace(/\s*\([^)]*\)\s*$/, ''); }
  // the body font (Manrope) ligates "(c)" into "©" on the canvas: a zero-width non-joiner keeps "52.212-4(c)" verbatim
  // (the mono plates are not affected)
  function unlig(s) { return String(s == null ? '' : s).replace(/\(c\)/g, '(\u200Cc)'); }

  // {full, fw, key, part}: key is the framework plus the number up to the first parenthesis (FAR 15.404-1),
  // part is the framework plus the digits before the first dot (FAR 15). A U.S.C. title is a framework of its own.
  function parseCite(raw) {
    var t = clean(raw), m, fw, num, sec, i;
    if (!t) return null;
    m = RE_FW.exec(t);
    if (m) {
      num = t.slice(m[1].length).replace(/^\s+/, '');
      sec = num.split('(')[0].trim();
      if (!sec) return null;
      fw = m[1] === 'PGI' ? 'DFARS PGI' : m[1];               // the bank writes the same PGI section both ways
      // num: the section number alone, so the same section under another name or framework is caught
      return { full: t, fw: fw, key: fw + ' ' + sec, part: fw + ' ' + sec.split('.')[0].split('-')[0], num: sec };
    }
    if (RE_USC.test(t)) {
      i = t.indexOf('U.S.C.');
      fw = t.slice(0, i + 6);                                  // "10 U.S.C."
      sec = t.slice(i + 6).replace(/^\s+/, '').split('(')[0].trim();
      if (!sec) return null;
      return { full: t, fw: fw, key: fw + ' ' + sec, part: fw, num: fw + ' ' + sec };
    }
    if (RE_CFR.test(t)) {
      i = t.indexOf('CFR');
      fw = t.slice(0, i + 3);                                  // "4 CFR"
      sec = t.slice(i + 3).replace(/^\s+/, '').split('(')[0].trim();
      if (!sec) return null;
      return { full: t, fw: fw, key: fw + ' ' + sec, part: fw + ' ' + sec.split('.')[0], num: sec };
    }
    return null;
  }

  // two plates clash when their section keys are equal or one is a prefix of the other (FAR 15.404 / FAR 15.404-1),
  // including a subpart and its sections (AFARS 5107.90 / AFARS 5107.9001)
  function clash(a, b) {
    if (!a || !b) return true;
    if (a === b) return true;
    var s = a.length < b.length ? a : b, l = a.length < b.length ? b : a, rest;
    if (l.slice(0, s.length) !== s) return false;
    rest = l.slice(s.length);
    return /^[.\-(]/.test(rest) || (/\.\d{1,2}$/.test(s) && /^\d{2}(?:-|$)/.test(rest));
  }
  function clashesAny(key, keys) {
    for (var i = 0; i < (keys || []).length; i++) if (clash(key, keys[i])) return true;
    return false;
  }

  // Every section number a question's cites, answer and key points name, in any form: "PGI 201.404-70" beside
  // "DFARS 201.404-70", "AFARS PGI 5137.890-4", "42 U.S.C. 1651-1654", "(RFO FAR 43.202(a), 1.402-1)". None of them
  // may come back as a decoy: the answer runs on it too.
  var RE_REF_NUM = /(^|[^\d.$])(\d{1,4}\.\d{1,4}(?:-\d{1,4})?)(?!\d)/g;
  var RE_REF_USC = /(\d{1,2})\s+U\.?\s?S\.?\s?C\.?\s+(\d{3,5}[a-z]?)/g;
  var RE_REF_PART = /\bPart\s+(\d{1,4})(?![\d.\-])/gi;          // "RFO FAR Part 37": only the Part plate itself is kept out
  function refsOf(q) {
    var parts = [].concat(Array.isArray(q.cites) ? q.cites : [], Array.isArray(q.key_points) ? q.key_points : [], [q.answer]);
    var text = parts.map(function (s) { return s == null ? '' : String(s); }).join(' ; '), seen = {}, refs = [], m, r;
    RE_REF_NUM.lastIndex = 0;
    while ((m = RE_REF_NUM.exec(text))) { r = m[2]; if (!seen[r]) { seen[r] = 1; refs.push(r); } }
    RE_REF_USC.lastIndex = 0;
    while ((m = RE_REF_USC.exec(text))) { r = m[1] + ' U.S.C. ' + m[2]; if (!seen[r]) { seen[r] = 1; refs.push(r); } }
    RE_REF_PART.lastIndex = 0;
    while ((m = RE_REF_PART.exec(text))) { r = 'Part ' + m[1]; if (!seen[r]) { seen[r] = 1; refs.push(r); } }
    return refs;
  }

  // questions with a difficulty use it; the rest spread evenly over 1 to 3 by a stable hash of the id
  function diffOf(q) {
    var d = Math.round(Number(q && q.difficulty));
    if (d >= 1 && d <= 3) return d;
    var id = String((q && q.id) || ''), s = 0, i;
    for (i = 0; i < id.length; i++) s += id.charCodeAt(i);
    return (s % 3) + 1;
  }

  function trimTo(text, max) {
    var t = String(text == null ? '' : text).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
    if (t.length <= max) return t;
    var cut = t.slice(0, max), p = cut.lastIndexOf('. ');
    if (p > max * 0.45) return cut.slice(0, p + 1);
    p = cut.lastIndexOf(' ');
    return (p > 40 ? cut.slice(0, p) : cut) + '…';
  }

  // ---- pool and decoy bank (memoized on the data object) ---------------------
  var CACHE = null;
  function build(D) {
    if (CACHE && CACHE.D === D) return CACHE;
    var qs = (D && D.questions) || [];
    var pool = [], bank = [], byKey = {}, i, j, q, cites, us, u, seen, keys;
    for (i = 0; i < qs.length; i++) {
      q = qs[i];
      if (!q || !q.id || !q.question) continue;
      cites = Array.isArray(q.cites) ? q.cites : [];
      us = []; seen = {};
      for (j = 0; j < cites.length; j++) {
        u = parseCite(cites[j]);
        if (!u) continue;
        if (!byKey[u.key]) { byKey[u.key] = u; bank.push(u); }
        if (!seen[u.key]) { seen[u.key] = 1; us.push(u); }
      }
      if (!us.length) continue;
      keys = [];
      for (j = 0; j < us.length; j++) keys.push(us[j].key);
      pool.push({
        id: 'CE-' + q.id,
        stem: String(q.question),                 // the shell fingerprints the first 40 characters of this
        q: q,
        cite: us[0].full,                         // the correct plate: the question's first usable citation
        key: us[0].key,
        part: us[0].part,
        fw: us[0].fw,
        allKeys: keys,
        keyMap: seen,
        refs: refsOf(q),                          // section numbers the answer names in any form (never a decoy)
        difficulty: diffOf(q),
        classes: Array.isArray(q.classes) ? q.classes.slice() : q.classes
      });
    }
    CACHE = { D: D, pool: pool, bank: bank };
    return CACHE;
  }

  A.register({
    id: 'cite-express',
    title: 'Cite Express',
    tagline: 'Throw the switch for the citation the answer runs on.',
    blurb: 'A board question rides the main line as a cargo manifest while three signal boards, one per track, each show a regulation citation. Throw the switch onto the track whose citation the model answer actually runs on: every five right routes brings the decoys closer — another framework, then the same framework, then the same part — never a faster engine.',
    controls: '↑/↓ or W/S throw the switch · Space confirms · tap a track on touch · P pauses',
    icon: '🚂',
    accent: A.C.sky,
    drills: 'Which regulation each board answer cites',
    dataOk: function (D) { var b = build(D); return b.pool.length >= MIN_POOL && b.bank.length >= 6; },

    create: function (api) {
      var C = api.C, W = api.W, H = api.H;

      // ---------------- layout ---------------------------------------------
      var HEAD_Y = 24;                                   // level / item row above the manifest card
      var CARD = { x: 22, y: 38, w: 916, h: 144 };       // manifest card: 4 wrapped lines at 18 px
      var SCENE_TOP = CARD.y + CARD.h;                   // 182: the railway world starts here
      var GROUND_Y = 258;
      var TRACK_Y = [266, 354, 442];                     // rail height of the top, middle and bottom tracks
      var MAIN_Y = TRACK_Y[1];                           // the main line runs in on the middle height
      var SWITCH_X = 318;                                // the points: fixed, a third of the way in
      var FORK_W = 170;                                  // the tracks have separated this far past the points
      var BOARD_CX = 656, BOARD_W = 264, BOARD_H = 52;   // signal boards park just past the fork
      var HEAD_X = BOARD_CX - BOARD_W / 2 - 36;          // the colour-light head sits left of each board
      var FOOT = { x: 22, y: 462, w: 916, h: 58 };
      var CARD_MIN_H = 88, CARD_LINE = 23;

      var START_X = 40;                                  // where the engine's front enters
      var SPEED = 53;                                    // px per second: one pace for the whole round
      // 5.2 s from the engine's entry to the points, 1.6 s on the result, 0.75 s to clear: about 7.6 s an item,
      // so 20 items run roughly three minutes. The shell's clock stretches that at levels 2 and 3.
      var DASH = 8;                                      // Space sends the engine on to the points at once
      var WHEEL_R = 13;
      var BOARD_IN = 0.9;                                // seconds for the signal boards to roll in
      var HOLD_T = 1.6;                                  // the result holds this long
      var OUT_T = 0.75;                                  // then the engine steams off, the boards clear, the next manifest rolls in
      var LEVER_A = [-0.78, 0, 0.78];
      var PUFF_GAP = 0.2;

      // ---------------- question levels (shell-owned) ------------------------
      api.progress.configure({ perLevel: PER_LEVEL });
      function levelNow() { return api.clamp(Math.round(Number(api.progress.level)) || 1, 1, 3); }
      function levelName(n) { var names = api.progress.names; return (names && names[n - 1]) || LEVEL_NAMES[n - 1]; }
      function correctToNext() {
        var lvl = levelNow(), max = api.clamp(Math.round(Number(api.progress.maxLevel)) || 3, 1, 3);
        if (lvl >= max) return 0;
        var per = Number(api.progress.perLevel) || PER_LEVEL, since = Number(api.progress.sinceUp) || 0;
        return Math.max(1, per - since);
      }

      // ---------------- round state ------------------------------------------
      var built = build(api.data), pool = built.pool, bank = built.bank;
      var LIVES = (api.difficulty && api.difficulty.lives) || 3;
      var st = {
        served: 0, item: null, route: 1,
        sel: 1, thrown: false, lever: 0,
        ex: START_X, wheel: 0, dash: false, outFrom: START_X,
        phase: 'run', boardT: 0, holdT: 0, outT: 0, cardT: 0,
        combo: 1, correct: 0, answered: 0, lives: LIVES, over: false,
        puffs: [], puffT: 0, spark: 0, levelFx: 0, hintT: 3.2, drag: 0, foot: null
      };
      var off = { far: 0, near: 0 };

      api.hud.set({ lives: LIVES, maxLives: LIVES, combo: 1, level: levelNow(), time: null, progress: 0 });

      // ---------------- scenery ----------------------------------------------
      var POLE_GAP = 168, POLE_N = 8, POLE_SPAN = POLE_GAP * POLE_N;
      var LANDMARKS = [
        { base: 120, kind: 'depot' }, { base: 640, kind: 'tower' }, { base: 1040, kind: 'shed' },
        { base: 1460, kind: 'depot' }, { base: 1820, kind: 'shed' }
      ];
      var LAND_SPAN = 2200;
      function wrapped(base, offset, span) {
        var x = (base - offset) % span;
        if (x < 0) x += span;
        return x - 240;
      }

      // ---------------- geometry ----------------------------------------------
      function pathY(i, x) {
        if (x <= SWITCH_X) return MAIN_Y;
        var t = api.clamp((x - SWITCH_X) / FORK_W, 0, 1), s = t * t * (3 - 2 * t);
        return MAIN_Y + (TRACK_Y[i] - MAIN_Y) * s;
      }
      function pathA(i, x) { return Math.atan2(pathY(i, x + 5) - pathY(i, x - 5), 10); }
      // the engine leans on the chord across its own wheelbase, not the local tangent: a rigid body on a
      // short curve would stand on end otherwise
      function bodyA(i, x) { return api.clamp(Math.atan2(pathY(i, x) - pathY(i, x - 128), 128), -0.30, 0.30); }

      // ---------------- decoys -------------------------------------------------
      // Level 1: a different part and, where the bank allows, a different framework.
      // Level 2: the same framework, a different part.  Level 3: the same part (falling back to the framework).
      function decoysFor(item, level) {
        var cand = [], i, c;
        for (i = 0; i < bank.length; i++) {
          c = bank[i];
          if (item.keyMap[c.key]) continue;
          if (clashesAny(c.key, item.allKeys) || clashesAny(c.num, item.refs)) continue;
          if (/^\d+$/.test(c.num) && item.refs.indexOf('Part ' + c.num) >= 0) continue;   // plate "FAR 37", answer "FAR Part 37"
          cand.push(c);
        }
        var samePart = [], sameFw = [], otherPart = [], otherFw = [];
        for (i = 0; i < cand.length; i++) {
          c = cand[i];
          if (c.part === item.part) samePart.push(c);
          else {
            otherPart.push(c);
            if (c.fw === item.fw) sameFw.push(c); else otherFw.push(c);
          }
        }
        var tiers = level >= 3 ? [samePart, sameFw, otherPart, cand]
          : level === 2 ? [sameFw, otherPart, cand]
          : [otherFw, otherPart, cand];
        // Levels 1 and 2 also keep the two decoys out of one another's part, so "the odd one out" is never
        // the tell. Level 3 wants both decoys inside the correct citation's part, so it skips that pass.
        var spread = level < 3;
        var picked = [], pass, t, list, j, ok, k;
        for (pass = 0; pass < 2 && picked.length < 2; pass++) {
          for (t = 0; t < tiers.length && picked.length < 2; t++) {
            list = api.shuffle(tiers[t] || []);
            for (j = 0; j < list.length && picked.length < 2; j++) {
              ok = true;
              for (k = 0; k < picked.length; k++) {
                if (clash(list[j].key, picked[k].key) || clash(list[j].num, picked[k].num)) { ok = false; break; }   // DFARS 215.202-71 beside DFARS PGI 215.202-71
                if (pass === 0 && spread && list[j].part === picked[k].part) { ok = false; break; }
              }
              if (ok) picked.push(list[j]);
            }
          }
        }
        return picked;
      }

      // ---------------- the manifest -------------------------------------------
      function explainFor(q) {
        var cites = Array.isArray(q.cites) ? q.cites.filter(Boolean) : [];
        // the results screen renders this as one text node, so the list ends in a full stop: without it the
        // first words of the answer read as another citation
        var head = cites.length ? 'The model answer cites: ' + cites.join('; ') + '.' : 'The model answer gives no citation.';
        var body = String(q.answer == null ? '' : q.answer);
        var text = trimTo(head + (body ? '\n\n' + body : ''), 700);
        if (q.status === 'ai-draft') text += ' (AI draft: verify)';
        return text;
      }

      function nextItem() {
        if (st.answered >= ROUND_ITEMS) { finish(true); return; }
        var lvl = levelNow(), item = null, d = null, tries;
        for (tries = 0; tries < 6; tries++) {
          item = pool.length ? api.progress.pick(pool) : null;
          if (!item) break;
          d = decoysFor(item, lvl);
          if (d && d.length >= 2) break;
          item = null;
        }
        if (!item || !d || d.length < 2) { finish(st.answered >= ROUND_ITEMS); return; }

        var tracks = api.shuffle([
          { full: item.cite, key: item.key, right: true },
          { full: d[0].full, key: d[0].key, right: false },
          { full: d[1].full, key: d[1].key, right: false }
        ]);
        var correctTrack = 0, i;
        for (i = 0; i < tracks.length; i++) if (tracks[i].right) correctTrack = i;

        // what the two decoys actually turned out to be: the level's rule falls back when a framework has
        // no other part to draw from (every U.S.C. title is a framework with one part), so say what is on
        // the boards rather than what was asked for
        var nPart = 0, nFw = 0;
        for (i = 0; i < d.length; i++) {
          if (d[i].part === item.part) nPart++;
          else if (d[i].fw === item.fw) nFw++;
        }
        var decoyLabel = nPart === 2 ? 'SAME PART' : (nPart + nFw) === 2 ? 'SAME FRAMEWORK'
          : (nPart + nFw) === 0 ? 'ANOTHER FRAMEWORK' : 'MIXED';

        st.served++;
        st.item = {
          src: item, q: item.q, stem: item.stem, tracks: tracks, correctTrack: correctTrack,
          correctFull: item.cite, explain: explainFor(item.q), level: lvl, decoyLabel: decoyLabel,
          resolved: false, ok: false, chosen: -1, fx: 0
        };
        st.phase = 'run'; st.ex = START_X; st.dash = false;
        st.sel = 1; st.thrown = false; st.route = 1;
        st.boardT = 0; st.holdT = HOLD_T; st.outT = 0; st.cardT = 0; st.age = 0;
        api.audio.whoosh();
        api.ready({                                      // reading pause on Recruit and Regular
          text: item.stem + ' — ' + tracks[0].full + ' · ' + tracks[1].full + ' · ' + tracks[2].full,
          delay: BOARD_IN
        });
      }

      function resolve() {
        var it = st.item;
        if (!it || it.resolved) return;
        it.resolved = true;
        it.chosen = st.thrown ? st.sel : -1;
        it.ok = it.chosen >= 0 && !!it.tracks[it.chosen].right;
        st.route = st.thrown ? st.sel : 1;
        st.phase = 'hold'; st.holdT = HOLD_T; st.dash = false;
        st.hintT = 0;                                     // the verdict takes the foot panel from here on
        st.answered++;

        api.review.add({
          prompt: it.stem,                                // must start with the question text: the shell fingerprints it
          correct: it.correctFull,
          given: it.chosen >= 0 ? it.tracks[it.chosen].full : 'no switch',
          ok: it.ok,
          explanation: it.explain,
          cite: it.correctFull
        });

        var cy = TRACK_Y[it.correctTrack] - 46, chy = it.chosen >= 0 ? TRACK_Y[it.chosen] - 46 : MAIN_Y;
        it.fx = 1;
        if (it.ok) {
          st.correct++;
          api.score(130 * st.combo);
          st.combo = Math.min(9, st.combo + 1);
          api.audio.correct();
          api.particles.emit({ x: HEAD_X, y: cy, n: 30, color: [C.green, C.gold2, C.white], speed: 300, life: .85, size: 6, gravity: 90, shape: 'spark' });
          api.particles.emit({ x: BOARD_CX, y: cy, n: 16, color: [C.green, C.teal], speed: 220, life: .7, size: 5, gravity: 40 });
          // no shell banner per answer: it sits over the top signal board (CSS top 42%) while the result holds;
          // the signal lamps, the lit boards and the foot panel carry the verdict
          api.hud.set({ combo: st.combo });
          if (api.progress.correct()) {                   // the shell still shows its level-up banner
            st.levelFx = 1.9;
            api.particles.emit({ x: CARD.x + 120, y: HEAD_Y, n: 34, color: [LEVEL_COLORS[levelNow() - 1], C.gold2, C.white], speed: 250, life: .9, size: 6, gravity: 60, shape: 'spark' });
          }
          api.hud.set({ level: levelNow() });
        } else {
          st.combo = 1;
          st.spark = 1;
          api.audio.wrong(); api.audio.boom();
          api.shake(15);
          api.flash('rgba(255,107,107,.28)');
          api.particles.emit({ x: SWITCH_X + 10, y: MAIN_Y, n: 24, color: [C.red, C.orange, C.gold], speed: 290, life: .8, size: 6, gravity: 330 });
          if (it.chosen >= 0) api.particles.emit({ x: HEAD_X, y: chy, n: 18, color: [C.red, C.orange], speed: 240, life: .7, size: 5, gravity: 120 });
          api.hud.set({ combo: 1 });
          st.lives = api.life(-1);
          if (st.lives <= 0) { finish(false); return; }
        }
        api.hud.set({ progress: st.answered / ROUND_ITEMS });
      }

      function finish(won) {
        if (st.over) return;
        st.over = true;
        var msg = 'You switched ' + st.correct + ' of ' + st.answered + ' questions onto the citation their answer runs on.';
        api.end({ won: !!won && st.answered > 0, title: won ? 'Right on schedule' : 'Derailed', message: msg });
      }

      // ---------------- smoke ---------------------------------------------------
      function spawnPuff() {
        if (st.puffs.length > 46) st.puffs.shift();
        var i = (st.item && st.item.resolved) ? st.route : 1;
        st.puffs.push({
          x: st.ex - 20 + api.rand(-2, 2), y: pathY(i, st.ex - 20) - 92,
          vx: api.rand(-16, -6), vy: api.rand(-26, -14),
          r: api.rand(4, 6.5), t: 0, life: api.rand(1.1, 1.7)
        });
      }
      function updatePuffs(dt) {
        for (var i = st.puffs.length - 1; i >= 0; i--) {
          var p = st.puffs[i];
          p.t += dt;
          if (p.t >= p.life) { st.puffs.splice(i, 1); continue; }
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vy *= 0.985; p.vx *= 0.995;
          p.r += 9 * dt;
        }
      }

      // ---------------- update ---------------------------------------------------
      function update(dt) {
        if (st.over) return;
        st.age = (st.age || 0) + dt;
        if (st.hintT > 0) st.hintT -= dt;
        if (st.levelFx > 0) st.levelFx = Math.max(0, st.levelFx - dt);
        if (st.spark > 0) st.spark = Math.max(0, st.spark - dt * 1.6);
        off.far += SPEED * 0.13 * dt;                   // two parallax speeds behind the line
        off.near += SPEED * 0.34 * dt;
        if (st.cardT < 1) st.cardT = Math.min(1, st.cardT + dt * 2.6);
        if (st.boardT < 1) st.boardT = Math.min(1, st.boardT + dt / BOARD_IN);
        st.lever += (LEVER_A[st.sel] - st.lever) * Math.min(1, dt * 12);
        st.puffT -= dt;
        if (st.puffT <= 0) { spawnPuff(); st.puffT = PUFF_GAP; }
        updatePuffs(dt);
        if (st.item && st.item.fx > 0) st.item.fx = Math.max(0, st.item.fx - dt * 0.55);

        if (!st.item) { nextItem(); if (st.over || !st.item) return; }

        var v;
        if (st.phase === 'run') {
          v = st.dash ? SPEED * DASH : SPEED;           // the pace never changes; Space is the player's own shortcut
          st.ex += v * dt;
          st.wheel += v * dt / WHEEL_R;
          if (st.ex >= SWITCH_X) { st.ex = SWITCH_X; resolve(); if (st.over) return; }
        } else if (st.phase === 'hold') {
          st.ex += SPEED * dt;
          st.wheel += SPEED * dt / WHEEL_R;
          st.holdT -= dt;
          if (st.holdT <= 0) { st.phase = 'out'; st.outT = 0; st.outFrom = st.ex; }
        } else {
          // the engine opens up and runs clear of the frame while the boards fade out behind it
          st.outT += dt;
          var o = api.clamp(st.outT / OUT_T, 0, 1);
          var nx = st.outFrom + (W + 280 - st.outFrom) * o * o;
          st.wheel += (nx - st.ex) / WHEEL_R;
          st.ex = nx;
          if (st.outT >= OUT_T) { st.item = null; }
        }
      }

      // ================= drawing =================================================
      function clampLines(ctx, str, size, weight, maxW, maxLines, fam) {
        ctx.save();
        ctx.font = api.font(size, fam || 'body', weight);
        var ls = api.wrap(ctx, str == null ? '' : str, maxW);
        ctx.restore();
        if (ls.length > maxLines) { ls = ls.slice(0, maxLines); ls[maxLines - 1] = ls[maxLines - 1] + ' …'; }
        return ls;
      }
      function hexA(hex, a) {
        var h = String(hex || '#ffffff').replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        if (isNaN(r) || isNaN(g) || isNaN(b)) { r = 255; g = 255; b = 255; }
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
      }
      // the plate text: 20 px mono, trailing paragraph parentheses dropped until it fits, then 19 to 16 px
      function fitPlate(ctx, plate, maxW) {
        if (plate.fitText) return plate;
        var t = String(plate.full || ''), size = 20, cut;
        ctx.save();
        ctx.font = api.font(20, 'mono', 700);
        while (ctx.measureText(t).width > maxW) {
          cut = dropParen(t);
          if (cut === t || !cut) break;
          t = cut;
        }
        if (ctx.measureText(t).width > maxW) {
          for (size = 19; size >= 16; size--) {
            ctx.font = api.font(size, 'mono', 700);
            if (ctx.measureText(t).width <= maxW) break;
          }
          if (size < 16) {
            size = 16; ctx.font = api.font(16, 'mono', 700);
            while (t.length > 5 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
            t += '…';
          }
        }
        ctx.restore();
        plate.fitText = t; plate.fitSize = size;
        return plate;
      }

      function drawScene(ctx) {
        var g = ctx.createLinearGradient(0, SCENE_TOP, 0, H);
        g.addColorStop(0, '#0a1428');
        g.addColorStop(0.36, '#0a1020');
        g.addColorStop(1, '#05080f');
        ctx.fillStyle = g;
        ctx.fillRect(0, SCENE_TOP, W, H - SCENE_TOP);
        var sg = ctx.createRadialGradient(250, GROUND_Y - 8, 6, 250, GROUND_Y - 8, 220);
        sg.addColorStop(0, 'rgba(143,198,255,.16)');
        sg.addColorStop(1, 'rgba(143,198,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(0, SCENE_TOP, 540, GROUND_Y - SCENE_TOP + 18);
      }

      function drawHills(ctx, base, amp, color, offset, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, base + 40);
        for (var x = 0; x <= W; x += 10) {
          var u = (x + offset) * 0.0062;
          ctx.lineTo(x, base - (Math.sin(u) * amp + Math.sin(u * 2.4 + 1.7) * amp * 0.42 + amp * 0.9));
        }
        ctx.lineTo(W, base + 40);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      function drawLandmark(ctx, x, kind) {
        if (x < -220 || x > W + 60) return;
        var base = GROUND_Y - 2;
        ctx.save();
        ctx.globalAlpha = 0.92;
        if (kind === 'depot') {
          ctx.fillStyle = '#1e2a49';
          ctx.fillRect(x, base - 34, 116, 34);
          ctx.beginPath();
          ctx.moveTo(x - 10, base - 34); ctx.lineTo(x + 58, base - 50); ctx.lineTo(x + 126, base - 34);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(243,213,140,.62)';
          for (var i = 0; i < 4; i++) ctx.fillRect(x + 12 + i * 26, base - 24, 11, 12);
          ctx.fillStyle = '#0e1730';
          ctx.fillRect(x + 50, base - 18, 16, 18);
        } else if (kind === 'tower') {
          ctx.fillStyle = '#1b2643';
          ctx.fillRect(x + 8, base - 54, 40, 26);
          ctx.beginPath(); ctx.moveTo(x + 4, base - 54); ctx.lineTo(x + 28, base - 64); ctx.lineTo(x + 52, base - 54); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x + 12, base - 28); ctx.lineTo(x + 16, base);
          ctx.moveTo(x + 44, base - 28); ctx.lineTo(x + 40, base);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#1a2440';
          ctx.fillRect(x, base - 24, 74, 24);
          ctx.fillStyle = 'rgba(255,255,255,.14)';
          ctx.fillRect(x, base - 28, 74, 5);
          ctx.fillStyle = 'rgba(143,198,255,.38)';
          ctx.fillRect(x + 10, base - 18, 12, 10);
        }
        ctx.restore();
      }

      function drawPoles(ctx) {
        var xs = [], i, x;
        for (i = 0; i < POLE_N; i++) {
          x = wrapped(i * POLE_GAP, off.near, POLE_SPAN);
          if (x > -120 && x < W + 120) xs.push(x);
        }
        xs.sort(function (a, b) { return a - b; });
        var top = 198, base = GROUND_Y + 2;
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = 'rgba(160,178,205,.30)';
        ctx.lineWidth = 1.4;
        for (i = 0; i < xs.length - 1; i++) {
          var a = xs[i], b = xs[i + 1];
          if (b - a > POLE_GAP * 1.4) continue;
          ctx.beginPath(); ctx.moveTo(a, top + 6); ctx.quadraticCurveTo((a + b) / 2, top + 24, b, top + 6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(a, top + 13); ctx.quadraticCurveTo((a + b) / 2, top + 32, b, top + 13); ctx.stroke();
        }
        for (i = 0; i < xs.length; i++) {
          x = xs[i];
          ctx.strokeStyle = 'rgba(190,205,228,.34)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, top); ctx.stroke();
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.moveTo(x - 12, top + 6); ctx.lineTo(x + 12, top + 6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - 9, top + 13); ctx.lineTo(x + 9, top + 13); ctx.stroke();
        }
        ctx.restore();
      }

      function drawGround(ctx) {
        var g = ctx.createLinearGradient(0, GROUND_Y, 0, H);
        g.addColorStop(0, '#111a2c');
        g.addColorStop(0.5, '#0b1220');
        g.addColorStop(1, '#070b14');
        ctx.fillStyle = g;
        ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
        ctx.strokeStyle = 'rgba(143,198,255,.14)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, GROUND_Y + .5); ctx.lineTo(W, GROUND_Y + .5); ctx.stroke();
      }

      function railStroke(ctx, i, x0, x1, dy) {
        var x, y;
        ctx.beginPath();
        for (x = x0; x < x1; x += 9) {
          y = pathY(i, x) + dy;
          if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineTo(x1, pathY(i, x1) + dy);
        ctx.stroke();
      }
      function drawSleepers(ctx, i, x0, x1, on) {
        ctx.save();
        ctx.fillStyle = on ? 'rgba(160,132,84,.55)' : 'rgba(120,98,66,.38)';
        for (var x = x0; x <= x1; x += 22) {
          ctx.save();
          ctx.translate(x, pathY(i, x));
          ctx.rotate(pathA(i, x));
          ctx.fillRect(-10, 0, 20, 7);
          ctx.restore();
        }
        ctx.restore();
      }
      // the route the engine is set for: blue until the switch is thrown, gold once it is, then the
      // result colour. A run through the points lights nothing.
      function selColor() {
        var it = st.item;
        if (it && it.resolved) return it.ok ? C.green : C.red;
        return st.thrown ? C.gold2 : C.sky;
      }
      function selShown() { var it = st.item; return !(it && it.resolved && it.chosen < 0); }

      function drawRails(ctx, i, x0, x1, on) {
        var col = on ? selColor() : 'rgba(150,164,186,.55)';
        ctx.save();
        // ballast shoulder
        ctx.strokeStyle = on ? 'rgba(226,182,87,.10)' : 'rgba(255,255,255,.035)';
        ctx.lineWidth = 22;
        ctx.lineCap = 'round';
        railStroke(ctx, i, x0, x1, 3);
        ctx.lineCap = 'butt';
        drawSleepers(ctx, i, x0, x1, on);
        if (on) api.glow(ctx, col, 12);
        ctx.strokeStyle = col;
        ctx.lineWidth = on ? 2.6 : 2;
        railStroke(ctx, i, x0, x1, -4);
        ctx.lineWidth = on ? 3 : 2.2;
        railStroke(ctx, i, x0, x1, 2);
        api.noGlow(ctx);
        ctx.restore();
      }

      function drawTracks(ctx) {
        var i, show = selShown();
        for (i = 0; i < 3; i++) if (!(show && i === st.sel)) drawRails(ctx, i, SWITCH_X, W, false);
        if (show) drawRails(ctx, st.sel, SWITCH_X, W, true);
        // the main line, lit in the route colour
        drawRails(ctx, 1, 0, SWITCH_X + 2, show);
      }

      function drawPoints(ctx) {
        // the decision line
        ctx.save();
        ctx.setLineDash([5, 8]);
        ctx.strokeStyle = 'rgba(143,198,255,.20)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(SWITCH_X, 250); ctx.lineTo(SWITCH_X, 458); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        api.text(ctx, 'POINTS', SWITCH_X, 242, { size: 16, fam: 'mono', weight: 700, align: 'center', color: 'rgba(143,198,255,.7)' });

        // the blade: a short rail leaning toward the selected track
        var bx = SWITCH_X - 34, by = MAIN_Y;
        if (selShown()) {
          ctx.save();
          api.glow(ctx, selColor(), 10);
          ctx.strokeStyle = selColor();
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(bx, by - 3);
          ctx.lineTo(SWITCH_X + 26, pathY(st.sel, SWITCH_X + 26) - 3);
          ctx.stroke();
          api.noGlow(ctx);
          ctx.restore();
        }

        // the switch stand and its lever
        var sx = SWITCH_X - 52, sy = MAIN_Y + 30;
        ctx.save();
        ctx.fillStyle = '#16203a';
        api.roundRect(ctx, sx - 11, sy - 8, 22, 18, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.fillStyle = '#1d2842';
        ctx.fillRect(sx - 3, sy + 8, 6, 16);
        // lever arm
        ctx.save();
        ctx.translate(sx, sy - 2);
        ctx.rotate(st.lever);
        api.glow(ctx, st.thrown ? C.gold : 'rgba(0,0,0,0)', st.thrown ? 12 : 0);
        ctx.strokeStyle = st.thrown ? C.gold2 : C.muted;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(28, 0); ctx.stroke();
        ctx.fillStyle = st.thrown ? C.gold2 : C.muted;
        ctx.beginPath(); ctx.arc(30, 0, 4.5, 0, Math.PI * 2); ctx.fill();
        api.noGlow(ctx);
        ctx.restore();
        // target lamp on the stand
        api.glow(ctx, st.thrown ? C.gold : C.muted, st.thrown ? 14 : 4);
        ctx.fillStyle = st.thrown ? C.gold2 : '#39445c';
        ctx.beginPath(); ctx.arc(sx, sy - 18, 5.5, 0, Math.PI * 2); ctx.fill();
        api.noGlow(ctx);
        ctx.restore();

        if (st.spark > 0) {
          ctx.save();
          ctx.globalAlpha = st.spark;
          api.glow(ctx, C.red, 22);
          ctx.strokeStyle = C.red;
          ctx.lineWidth = 3;
          for (var i = 0; i < 5; i++) {
            var a = -0.6 - i * 0.3;
            ctx.beginPath();
            ctx.moveTo(SWITCH_X, MAIN_Y);
            ctx.lineTo(SWITCH_X + Math.cos(a) * (18 + i * 7), MAIN_Y + Math.sin(a) * (18 + i * 7));
            ctx.stroke();
          }
          api.noGlow(ctx);
          ctx.restore();
        }
      }

      function boardX() {
        var inT = api.ease.outCubic(api.clamp(st.boardT, 0, 1));
        var x = W + 360 + (BOARD_CX - (W + 360)) * inT;
        if (st.phase === 'out') x -= 200 * outFrac() * outFrac();
        return x;
      }
      function outFrac() { return st.phase === 'out' ? api.clamp(st.outT / OUT_T, 0, 1) : 0; }

      function drawBoards(ctx) {
        var it = st.item;
        if (!it) return;
        var cx = boardX(), i, fade = 1 - outFrac();
        if (cx > W + 340 || fade <= 0.02) return;
        for (i = 0; i < 3; i++) {
          var rail = TRACK_Y[i], plate = it.tracks[i];
          var py = rail - 46, px = cx - BOARD_W / 2;
          var mode = 'live';
          if (it.resolved) {
            if (i === it.correctTrack) mode = 'good';
            else if (i === it.chosen) mode = 'bad';
            else mode = 'dim';
          } else if (i === st.sel) mode = 'sel';
          var col = mode === 'good' ? C.green : mode === 'bad' ? C.red : mode === 'dim' ? C.muted
            : mode === 'sel' ? (st.thrown ? C.gold2 : C.sky) : C.sky;
          var pulse = mode === 'good' && it.fx > 0 ? 0.5 + 0.5 * Math.sin(it.fx * 14) : 0;

          ctx.save();
          ctx.globalAlpha = (mode === 'dim' ? 0.42 : 1) * fade;

          // posts down to the rail they belong to
          ctx.strokeStyle = 'rgba(160,176,200,.38)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(px + 44, py + BOARD_H / 2); ctx.lineTo(px + 44, pathY(i, px + 44) + 2);
          ctx.moveTo(px + BOARD_W - 44, py + BOARD_H / 2); ctx.lineTo(px + BOARD_W - 44, pathY(i, px + BOARD_W - 44) + 2);
          ctx.stroke();

          // plate
          if (mode !== 'live' && mode !== 'dim') api.glow(ctx, col, 14 + pulse * 16);
          api.roundRect(ctx, px, py - BOARD_H / 2, BOARD_W, BOARD_H, 9);
          ctx.fillStyle = 'rgba(7,12,24,.93)';
          ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = mode === 'live' || mode === 'dim' ? 1.6 : 2.4 + pulse;
          ctx.stroke();
          api.noGlow(ctx);
          // top rivet strip
          api.roundRect(ctx, px + 6, py - BOARD_H / 2 + 5, BOARD_W - 12, 3, 2);
          ctx.fillStyle = hexA(col, .34); ctx.fill();

          fitPlate(ctx, plate, BOARD_W - 28);
          api.text(ctx, plate.fitText, cx, py + 3, {
            size: plate.fitSize, fam: 'mono', weight: 700, align: 'center', baseline: 'middle',
            color: mode === 'dim' ? C.ink2 : C.ink
          });

          // colour-light head on its own mast
          var hx = cx - BOARD_W / 2 - 36, hy = py;
          ctx.strokeStyle = 'rgba(160,176,200,.38)';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(hx, hy + 12); ctx.lineTo(hx, pathY(i, hx) + 2); ctx.stroke();
          ctx.fillStyle = '#101a30';
          api.roundRect(ctx, hx - 13, hy - 24, 26, 40, 7);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.4; ctx.stroke();
          // hood
          ctx.fillStyle = '#18233d';
          api.roundRect(ctx, hx - 15, hy - 27, 30, 6, 3); ctx.fill();

          var upLit = mode === 'good', downLit = mode === 'bad';
          var upCol = upLit ? C.green : 'rgba(60,78,66,.9)';
          var downCol = downLit ? C.red : 'rgba(78,60,64,.9)';
          if (upLit) api.glow(ctx, C.green, 18);
          ctx.fillStyle = upCol;
          ctx.beginPath(); ctx.arc(hx, hy - 12, 7, 0, Math.PI * 2); ctx.fill();
          api.noGlow(ctx);
          if (downLit) api.glow(ctx, C.red, 18);
          ctx.fillStyle = downCol;
          ctx.beginPath(); ctx.arc(hx, hy + 6, 7, 0, Math.PI * 2); ctx.fill();
          api.noGlow(ctx);
          if (mode === 'sel' && !it.resolved) {
            api.glow(ctx, st.thrown ? C.gold : C.sky, 14);
            ctx.fillStyle = st.thrown ? C.gold2 : C.sky;
            ctx.beginPath(); ctx.arc(hx, hy - 3, 4, 0, Math.PI * 2); ctx.fill();
            api.noGlow(ctx);
          }
          ctx.restore();
        }
      }

      function drawPuffs(ctx) {
        ctx.save();
        for (var i = 0; i < st.puffs.length; i++) {
          var p = st.puffs[i], a = 1 - p.t / p.life;
          ctx.globalAlpha = 0.18 * a;
          ctx.fillStyle = '#b8c6dd';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.11 * a;
          ctx.beginPath(); ctx.arc(p.x + p.r * .3, p.y - p.r * .25, p.r * .72, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      function drawLoco(ctx) {
        var i = (st.item && st.item.resolved) ? st.route : 1;
        var x = st.ex, y = pathY(i, x), ang = bodyA(i, x);
        if (x < -200 || x > W + 240) return;
        ctx.save();
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(x - 58, y + 8, 78, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;

        ctx.translate(x, y);
        ctx.rotate(ang);

        // headlamp beam
        var beam = ctx.createLinearGradient(0, -52, 190, -30);
        beam.addColorStop(0, 'rgba(243,213,140,.28)');
        beam.addColorStop(1, 'rgba(243,213,140,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(2, -58); ctx.lineTo(210, -76); ctx.lineTo(210, -4); ctx.lineTo(2, -46);
        ctx.closePath(); ctx.fill();

        // frame
        ctx.fillStyle = '#131b2f';
        ctx.fillRect(-138, -20, 144, 8);
        ctx.fillStyle = hexA(C.sky, .30);
        ctx.fillRect(-138, -21, 144, 2);

        // wheels: three drivers under the boiler, a pony ahead and a trailing wheel under the cab
        var wheels = [[-126, 8], [-100, WHEEL_R], [-68, WHEEL_R], [-36, WHEEL_R], [-10, 7]];
        var k, wx, wr, ph;
        for (k = 0; k < wheels.length; k++) {
          wx = wheels[k][0]; wr = wheels[k][1];
          ctx.save();
          ctx.translate(wx, -wr);
          ctx.fillStyle = '#0d1424';
          ctx.beginPath(); ctx.arc(0, 0, wr, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = hexA(C.sky, .55); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, wr - 1.5, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = 'rgba(200,214,236,.45)'; ctx.lineWidth = 1.6;
          for (ph = 0; ph < 4; ph++) {
            var a2 = st.wheel + ph * Math.PI / 4;
            ctx.beginPath();
            ctx.moveTo(-Math.cos(a2) * (wr - 2), -Math.sin(a2) * (wr - 2));
            ctx.lineTo(Math.cos(a2) * (wr - 2), Math.sin(a2) * (wr - 2));
            ctx.stroke();
          }
          ctx.fillStyle = C.gold2;
          ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        // side rod across the drivers
        var rodY = -WHEEL_R + Math.sin(st.wheel) * (WHEEL_R - 4);
        var rodX = Math.cos(st.wheel) * (WHEEL_R - 4);
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-100 + rodX, rodY); ctx.lineTo(-36 + rodX, rodY);
        ctx.stroke();

        // cab and coal bunker
        ctx.fillStyle = '#141d34';
        api.roundRect(ctx, -136, -54, 26, 36, 4); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fillRect(-132, -52, 18, 7);
        api.glow(ctx, C.sky, 12);
        ctx.fillStyle = '#1a2440';
        api.roundRect(ctx, -118, -78, 44, 60, 5); ctx.fill();
        api.noGlow(ctx);
        ctx.strokeStyle = hexA(C.sky, .5); ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = 'rgba(243,213,140,.55)';
        api.roundRect(ctx, -110, -70, 20, 20, 3); ctx.fill();
        ctx.fillStyle = '#0f1830';
        api.roundRect(ctx, -122, -84, 52, 8, 3); ctx.fill();

        // boiler
        var bg = ctx.createLinearGradient(0, -62, 0, -18);
        bg.addColorStop(0, '#26324f');
        bg.addColorStop(0.55, '#1a2340');
        bg.addColorStop(1, '#0f1728');
        ctx.fillStyle = bg;
        api.roundRect(ctx, -80, -62, 84, 44, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.strokeStyle = hexA(C.sky, .30); ctx.lineWidth = 2;
        for (k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-66 + k * 20, -60); ctx.lineTo(-66 + k * 20, -20); ctx.stroke(); }

        // smokebox front
        ctx.fillStyle = '#121b30';
        api.roundRect(ctx, -8, -62, 16, 46, 6); ctx.fill();
        ctx.strokeStyle = hexA(C.sky, .45); ctx.lineWidth = 2; ctx.stroke();

        // dome and funnel
        ctx.fillStyle = '#212c48';
        ctx.beginPath(); ctx.arc(-50, -62, 10, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#1b2440';
        ctx.beginPath();
        ctx.moveTo(-28, -62); ctx.lineTo(-12, -62); ctx.lineTo(-10, -84); ctx.lineTo(-30, -84);
        ctx.closePath(); ctx.fill();
        api.roundRect(ctx, -34, -92, 28, 10, 3);
        ctx.fillStyle = '#283454'; ctx.fill();
        ctx.strokeStyle = hexA(C.sky, .4); ctx.lineWidth = 1.4; ctx.stroke();

        // headlamp
        api.glow(ctx, C.gold, 20);
        ctx.fillStyle = C.gold2;
        ctx.beginPath(); ctx.arc(0, -52, 6.5, 0, Math.PI * 2); ctx.fill();
        api.noGlow(ctx);

        // cowcatcher
        ctx.fillStyle = '#1d2740';
        ctx.beginPath();
        ctx.moveTo(6, -22); ctx.lineTo(26, -2); ctx.lineTo(6, -2);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = hexA(C.gold, .5); ctx.lineWidth = 1.4; ctx.stroke();

        ctx.restore();
      }

      // ---- header, card, foot, hint --------------------------------------------
      function drawHeader(ctx) {
        var lvl = levelNow(), col = LEVEL_COLORS[lvl - 1];
        var fx = st.levelFx > 0 ? Math.min(1, st.levelFx / 0.6) : 0;
        ctx.save();
        if (fx > 0) api.glow(ctx, col, 10 + 18 * fx);
        var lw = api.pill(ctx, levelName(lvl).toUpperCase(), CARD.x, HEAD_Y,   // the HUD already shows the level number
          { size: 16, fam: 'mono', bg: 'rgba(6,10,20,.85)', stroke: col, lineWidth: 1.5 + fx * 1.5, color: C.ink });
        ctx.restore();

        var px = CARD.x + lw + 16, i;
        for (i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(px + i * 18, HEAD_Y, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = i < lvl ? LEVEL_COLORS[i] : 'rgba(255,255,255,.14)';
          ctx.fill();
        }
        var need = correctToNext();
        var note = need > 0 ? need + ' more correct for level ' + (lvl + 1) : 'Top level · decoys from the same part';
        api.text(ctx, note, px + 54 + 8, HEAD_Y + 1, { size: 16, weight: 600, color: C.ink2, baseline: 'middle' });

        var label = 'ITEM ' + api.clamp(st.served, 1, ROUND_ITEMS) + ' / ' + ROUND_ITEMS;
        ctx.save(); ctx.font = api.font(16, 'mono', 600);
        var cw = ctx.measureText(label).width + 22;
        ctx.restore();
        api.pill(ctx, label, CARD.x + CARD.w - cw, HEAD_Y,
          { size: 16, fam: 'mono', bg: 'rgba(143,198,255,.14)', stroke: 'rgba(143,198,255,.45)', color: C.ink });
      }

      function drawCard(ctx) {
        var it = st.item, i;
        // the card is only as tall as the question needs: short stems get a short card, never a half-empty one.
        // The stem is wrapped once per manifest: a 1,100-character question is ~180 measureText calls a frame otherwise.
        var ls = it ? (it.stemLines || (it.stemLines = clampLines(ctx, unlig(it.stem), 18, 600, CARD.w - 56, 4))) : [];
        var h = it ? Math.max(CARD_MIN_H, 75 + (ls.length - 1) * CARD_LINE) : CARD_MIN_H;
        var slide = (1 - api.ease.outCubic(api.clamp(st.cardT, 0, 1))) * -(CARD.y + h + 14);
        ctx.save();
        ctx.translate(0, slide);

        api.roundRect(ctx, CARD.x, CARD.y, CARD.w, h, 16);
        ctx.fillStyle = 'rgba(9,14,28,.92)';
        ctx.fill();
        ctx.strokeStyle = it && it.resolved ? (it.ok ? 'rgba(95,211,154,.55)' : 'rgba(255,107,107,.55)') : 'rgba(255,255,255,.14)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        api.roundRect(ctx, CARD.x, CARD.y, 6, h, 3);
        ctx.fillStyle = it && it.resolved ? (it.ok ? C.green : C.red) : C.sky;
        ctx.fill();

        api.text(ctx, 'CARGO MANIFEST', CARD.x + 24, CARD.y + 25, { size: 16, fam: 'mono', weight: 700, color: C.sky });

        if (!it) { ctx.restore(); return; }
        var q = it.q || {};
        if (!it.tagLine) it.tagLine = clampLines(ctx, String(q.id || '') + (q.domain ? ' · ' + q.domain : ''), 16, 600, 420, 1, 'mono');
        api.text(ctx, it.tagLine[0], CARD.x + CARD.w - 24, CARD.y + 25, { size: 16, fam: 'mono', weight: 600, align: 'right', color: C.muted });

        for (i = 0; i < ls.length; i++) {
          api.text(ctx, ls[i], CARD.x + 24, CARD.y + 52 + i * CARD_LINE, { size: 18, weight: 600, color: C.ink });
        }

        // decision meter: the same length at every level
        if (!it.resolved) {
          var frac = api.clamp((SWITCH_X - st.ex) / (SWITCH_X - START_X), 0, 1);
          api.roundRect(ctx, CARD.x + 24, CARD.y + h - 12, CARD.w - 48, 5, 3);
          ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fill();
          api.roundRect(ctx, CARD.x + 24, CARD.y + h - 12, Math.max(3, (CARD.w - 48) * frac), 5, 3);
          ctx.fillStyle = frac > .55 ? C.green : frac > .25 ? C.gold : C.red;
          ctx.fill();
        }
        ctx.restore();
      }

      function drawFoot(ctx) {
        api.roundRect(ctx, FOOT.x, FOOT.y, FOOT.w, FOOT.h, 12);
        ctx.fillStyle = 'rgba(9,14,28,.88)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.12)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        if (st.hintT > 0) {
          var a = Math.min(1, st.hintT / 0.8);
          ctx.save();
          ctx.globalAlpha = a;
          api.pill(ctx, '↑ ↓ or W / S throw the switch · tap a track on touch', W / 2, FOOT.y + FOOT.h / 2,
            { size: 17, fam: 'body', align: 'center', bg: 'rgba(6,10,20,.85)', stroke: 'rgba(143,198,255,.45)', color: C.ink });
          ctx.restore();
          return;
        }

        var f = footLines(ctx);
        api.text(ctx, f.l1[0], FOOT.x + 20, FOOT.y + 24, { size: 17, weight: 700, color: f.col1 });
        if (f.l2) api.text(ctx, f.l2[0], FOOT.x + 20, FOOT.y + 45, { size: 16, weight: 600, color: f.col2 });
        api.text(ctx, f.decoys, FOOT.x + FOOT.w - 20, FOOT.y + 45, { size: 16, fam: 'mono', weight: 600, align: 'right', color: C.muted });
      }

      // the foot lines change only with the switch or the verdict: build and wrap them then, not every frame
      function footLines(ctx) {
        var it = st.item, line1, col1, line2, col2, f = st.foot;
        var sig = !it ? 20 + levelNow() : it.resolved ? (it.ok ? 10 : 11) : (st.thrown ? st.sel : 9);
        if (f && f.it === it && f.sig === sig) return f;
        if (it && it.resolved) {
          if (it.ok) {
            line1 = '✓ Right on the money — the answer runs on ' + it.correctFull;
            col1 = C.green;
            line2 = 'Signal green on track ' + (it.correctTrack + 1);
            col2 = C.ink2;
          } else {
            line1 = '✕ The answer runs on ' + it.correctFull;
            col1 = C.red;
            line2 = it.chosen >= 0 ? 'You switched onto ' + it.tracks[it.chosen].full : 'The switch was never thrown — the engine ran through the points';
            col2 = C.ink2;
          }
        } else if (it) {
          line1 = 'Which citation does the model answer run on?';
          col1 = C.ink;
          line2 = st.thrown ? 'Switch set for track ' + (st.sel + 1) + ' · ' + it.tracks[st.sel].full : 'Switch not thrown — pick a track before the points or it counts as a miss';
          col2 = st.thrown ? C.gold2 : C.orange;
        } else {
          line1 = 'Next manifest coming up the line…';
          col1 = C.ink2;
          line2 = '';
          col2 = C.muted;
        }

        st.foot = {
          it: it, sig: sig, col1: col1, col2: col2,
          l1: clampLines(ctx, unlig(line1), 17, 700, FOOT.w - 250, 1),
          l2: line2 ? clampLines(ctx, unlig(line2), 16, 600, FOOT.w - 250, 1) : null,
          decoys: 'DECOYS · ' + (it ? it.decoyLabel : DECOY_RULE[levelNow() - 1])
        };
        return st.foot;
      }

      function draw(ctx) {
        ctx.fillStyle = C.bg;
        ctx.fillRect(0, 0, W, H);
        drawScene(ctx);
        drawHills(ctx, GROUND_Y + 2, 20, '#15213c', off.far, 0.95);
        drawHills(ctx, GROUND_Y + 8, 12, '#1d2c4c', off.far * 1.9, 0.95);
        for (var i = 0; i < LANDMARKS.length; i++) {
          drawLandmark(ctx, wrapped(LANDMARKS[i].base, off.far * 2.2, LAND_SPAN), LANDMARKS[i].kind);
        }
        drawPoles(ctx);
        drawGround(ctx);
        drawTracks(ctx);
        drawPoints(ctx);
        drawBoards(ctx);
        drawPuffs(ctx);
        drawLoco(ctx);
        drawHeader(ctx);
        drawCard(ctx);
        drawFoot(ctx);
      }

      // ---------------- input ----------------------------------------------------
      function setSel(n) {
        n = api.clamp(Math.round(n), 0, 2);
        if (st.over) return;
        var changed = (n !== st.sel) || !st.thrown;
        st.sel = n;
        st.thrown = true;
        if (changed) api.audio.blip();
      }
      function confirm() {
        if (st.over || st.phase !== 'run' || !st.item || st.item.resolved) return;
        if ((st.age || 0) < BOARD_IN + 0.3) return;      // the shell arms the reading pause BOARD_IN after a prompt; a faster press would answer unread
        if (!st.thrown) { st.thrown = true; api.audio.blip(); }
        if (!st.dash) { st.dash = true; api.audio.whoosh(); }
      }
      function onKey(k, down) {
        if (!down || st.over) return;
        if (k === 'ArrowUp' || k === 'w' || k === 'W') setSel(st.sel - 1);
        else if (k === 'ArrowDown' || k === 's' || k === 'S') setSel(st.sel + 1);
        else if (k === '1' || k === '2' || k === '3') setSel(Number(k) - 1);
        else if (k === ' ' || k === 'Spacebar' || k === 'Enter' || k === 'ArrowRight' || k === 'd' || k === 'D') confirm();
      }
      function trackAt(y) {
        var best = 1, bd = 1e9, i, d;
        // centres 30 px above each rail: every signal board (rail - 72 to rail - 20) and its rail map to their own track
        for (i = 0; i < 3; i++) { d = Math.abs(y - (TRACK_Y[i] - 30)); if (d < bd) { bd = d; best = i; } }
        return best;
      }
      function onPointer(p) {
        if (!p || st.over) return;
        if (p.type === 'down') {
          st.drag = 0;
          if (p.y >= SCENE_TOP && p.y < FOOT.y) setSel(trackAt(p.y));
          else if (p.y >= FOOT.y) confirm();
        } else if (p.type === 'move' && api.input.pointer.down) {
          st.drag += p.dy || 0;
          if (st.drag > 40) { setSel(st.sel + 1); st.drag = 0; }
          else if (st.drag < -40) { setSel(st.sel - 1); st.drag = 0; }
        }
      }

      nextItem();

      return {
        update: update,
        draw: draw,
        onKey: onKey,
        onPointer: onPointer,
        destroy: function () {
          st.puffs.length = 0;
          st.item = null; st.foot = null;
          pool = []; bank = [];
        },
        // test hook for the headless play harness: throw the switch onto the right (ok) or a wrong track.
        // Safe to call many times per prompt. The Space keydown releases the shell's reading gate on
        // Recruit and Regular, where the harness itself presses no keys.
        _auto: function (ok) {
          var it = st.item, live = !!(it && !it.resolved && st.phase === 'run' && !st.over);
          if (live) setSel(ok ? it.correctTrack : (it.correctTrack + 1) % 3);
          try {
            if (!api.paused) {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
              window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
            }
          } catch (e) { /* no KeyboardEvent constructor: the gate still releases on its own timer */ }
          return live;
        }
      };
    }
  });
})();
