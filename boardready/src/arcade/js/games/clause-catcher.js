/* GAME: clause-catcher — a clause title and when it applies sit in the target panel;
   clause numbers rain down. Catch the one that matches, let the rest fall through. */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var PER_LEVEL = 5;               // correct catches per question level (api.progress)
  var LEVELS = 3;                  // easy, medium, hard questions
  var GOAL = PER_LEVEL * LEVELS;   // clearing all three levels ends the round as a win
  var TARGET_CAP = 30;             // safety stop so a round cannot run on forever through misses
  var LEVEL_NAMES = ['Easy', 'Medium', 'Hard'];

  // Obvious non-numbers. Never presented as real regulation cites: catching one costs a life.
  var JUNK = ['FAR 52.999-9', 'FAR 52.000-0', 'FAR 52.888-2', 'DFARS 252.999-7999', 'DFARS 252.000-7000'];

  // ---- data ----------------------------------------------------------------
  function tidy(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  function clauseItems(D) {
    var raw = ((D || {}).games || {}).clause_match;
    if (!raw || !raw.length) return [];
    var out = [], i, it, clause, title;
    for (i = 0; i < raw.length; i++) {
      it = raw[i];
      if (!it) continue;
      clause = tidy(it.clause);
      title = tidy(it.title);
      if (!clause || !title) continue;
      if (it.reserved) continue;      // numbers the RFO reserved stay out of the game: catching one would teach a retired cite
      out.push({
        id: it.id || ('cm' + i),
        clause: clause,
        title: title,
        applies: tidy(it.applies),
        status: tidy(it.status),
        difficulty: it.difficulty,      // 1 easy, 2 medium, 3 hard; api.progress.pick reads it
        classes: it.classes           // warrant classes; api.progress.pick filters by the player's class
      });
    }
    return out;
  }

  // 'DFARS 252.215-7992 (DEVIATION 2026-O0048)' -> ['DFARS 252.215-7992', '(DEVIATION 2026-O0048)']
  function splitNum(s) {
    var m = /^(.*?)\s*(\([^()]*\))\s*$/.exec(s || '');
    if (m && tidy(m[1])) return [tidy(m[1]), tidy(m[2])];
    return [tidy(s), ''];
  }
  function groupOf(s) { var m = /(\d+\.\d+)/.exec(s || ''); return m ? m[1] : ''; }
  function prefixOf(s) { return /dfars/i.test(s || '') ? 'D' : 'F'; }

  A.register({
    id: 'clause-catcher',
    title: 'Clause Catcher',
    tagline: 'Catch the number that matches the clause.',
    blurb: 'A clause title and the sentence about when it applies hang at the top while provision and clause numbers fall past you. Slide the folder under the right number and let the wrong ones drop; every five catches brings harder clauses and closer look-alike numbers, never faster paper.',
    controls: '← → or A/D slide the folder · drag anywhere on touch · P pauses',
    icon: '🧺',
    accent: A.C.purple,
    drills: 'Provision and clause numbers',
    dataOk: function (D) { return clauseItems(D).length >= 10; },

    create: function (api) {
      var START_LIVES = (api.difficulty && api.difficulty.lives) || 3;   // lives come from the chosen level
      var W = api.W, H = api.H, C = api.C;

      // ---- layout ----------------------------------------------------------
      var PANEL = { x: 22, y: 50, w: W - 44, h: 124 };
      var FIELD_TOP = PANEL.y + PANEL.h + 4;      // 178
      var RIM_Y = 446;                            // catch line (folder mouth)
      var BASKET_H = 58;
      var STRIP = { x: 22, y: 506, w: W - 44, h: 26 };
      var BASE_W = 152, WIDE_W = 244;
      var SIDE = 16;                              // field margin

      // ---- state -----------------------------------------------------------
      var items = clauseItems(api.data);
      var pool = (function () {
        var seen = {}, out = [], i, v;
        for (i = 0; i < items.length; i++) { v = items[i].clause; if (!seen[v]) { seen[v] = 1; out.push(v); } }
        return out;
      })();

      // Levels are question difficulty, never speed: api.progress hands out easy, then medium, then hard
      // clauses and the shell slows its clock at levels 2 and 3. This game keeps the level-1 pace all run.
      var prog = api.progress;
      prog.configure({ perLevel: PER_LEVEL, maxLevel: LEVELS });

      var st = {
        retry: [], retryN: 0,
        item: null, lines: null,
        tiles: [], pending: [], spawnT: 0,
        basket: { x: W / 2, target: W / 2, vx: 0, w: BASE_W, want: BASE_W, pop: 0, tilt: 0 },
        combo: 1, right: 0, answered: 0, resolved: 0, missed: 0, lives: START_LIVES,
        t: 0, over: false,
        hold: 0.35, verdict: null, verdictT: 0,
        slowT: 0, wideT: 0, puTimer: api.rand(11, 17),
        levelPulse: 0, hintT: 3.6, follow: false
      };

      api.hud.set({ score: 0, lives: START_LIVES, maxLives: START_LIVES, combo: 1, level: prog.level, time: null, progress: 0 });

      // ---- background furniture -------------------------------------------
      var sheets = [], rain = [], i0;
      for (i0 = 0; i0 < 8; i0++) sheets.push(makeSheet(api.rand(FIELD_TOP - 40, RIM_Y)));
      for (i0 = 0; i0 < 9; i0++) rain.push({ x: 44 + i0 * 104 + api.rand(-16, 16), y: api.rand(-260, H), sp: api.rand(11, 26), txt: api.pick(pool) || 'FAR 52', a: api.rand(0.035, 0.075) });

      function makeSheet(y) {
        return { x: api.rand(30, W - 30), y: y, w: api.rand(30, 46), h: api.rand(38, 56), rot: api.rand(-0.4, 0.4), sp: api.rand(14, 32), sway: api.rand(0, 6.283) };
      }

      // ---- helpers ---------------------------------------------------------
      function charW(size) { return size * 0.62; }   // mono advance estimate (no ctx at build time)

      function clampLines(ctx, str, size, weight, maxW, maxLines, fam) {
        ctx.save();
        ctx.font = api.font(size, fam || 'body', weight);
        var ls = api.wrap(ctx, str || '', maxW);
        ctx.restore();
        if (ls.length > maxLines) { ls = ls.slice(0, maxLines); ls[maxLines - 1] = ls[maxLines - 1] + ' …'; }
        return ls;
      }
      function fitText(ctx, str, maxW, size, fam) {
        ctx.save();
        ctx.font = api.font(size, fam || 'mono', 700);
        var s = String(str == null ? '' : str);
        if (ctx.measureText(s).width > maxW) {
          while (s.length > 4 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
          s = s + '…';
        }
        ctx.restore();
        return s;
      }
      function monoFit(ctx, str, x, y, size, maxW, color, alpha) {
        var s = size;
        ctx.save();
        ctx.font = api.font(s, 'mono', 700);
        while (s > 16 && ctx.measureText(str).width > maxW) { s -= 1; ctx.font = api.font(s, 'mono', 700); }
        ctx.restore();
        api.text(ctx, str, x, y, { size: s, fam: 'mono', weight: 700, align: 'center', baseline: 'middle', color: color || C.ink, alpha: alpha });
      }

      // one pace for the whole run (the level-1 pace); only the slow-time pickup changes it
      var FALL_SPEED = 96, SPAWN_GAP = 1.15;
      function fallSpeed() { return FALL_SPEED * (st.slowT > 0 ? 0.42 : 1); }
      function spawnGap() { return SPAWN_GAP; }
      function levelName() { return LEVEL_NAMES[Math.max(1, Math.min(LEVELS, prog.level || 1)) - 1]; }

      // ---- wave building ---------------------------------------------------
      function simScore(a, b) {
        var ga = groupOf(a), gb = groupOf(b);
        if (ga && gb && ga === gb) return 0;
        return prefixOf(a) === prefixOf(b) ? 1 : 2;
      }
      // distance between two numbers: the group gap dominates, then the gap inside the family (52.232-22 vs -20 = 2)
      function numDist(a, b) {
        var ma = /(\d+)\.(\d+)-(\d+)/.exec(a || ''), mb = /(\d+)\.(\d+)-(\d+)/.exec(b || '');
        if (!ma || !mb) return 1e9;
        return Math.abs(+ma[2] - +mb[2]) * 10000 + Math.abs(+ma[3] - +mb[3]);
      }
      // Level 1 draws distractors from the other regulation (easy to rule out), level 2 from the same regulation
      // but another family, level 3 from the closest look-alike numbers in the same family.
      function distractorsFor(clause, n, level) {
        var cands = [], i, v, spread, base = splitNum(clause)[0];
        var rank2 = [1, 0, 2];
        for (i = 0; i < pool.length; i++) {
          v = pool[i];
          if (!v || v === clause || splitNum(v)[0] === base) continue;
          cands.push({ v: v, s: simScore(clause, v), d: numDist(clause, v), r: Math.random() });
        }
        if (level >= 3) {
          cands.sort(function (a, b) { return (a.s - b.s) || (a.d - b.d) || (a.r - b.r); });
          spread = n + 2;
        } else if (level === 2) {
          cands.sort(function (a, b) { return (rank2[a.s] - rank2[b.s]) || (a.r - b.r); });
          spread = n + 6;
        } else {
          cands.sort(function (a, b) { return (b.s - a.s) || (a.r - b.r); });
          spread = n + 8;
        }
        var take = api.shuffle(cands.slice(0, Math.min(cands.length, spread)));
        var out = [];
        for (i = 0; i < take.length && out.length < n; i++) if (out.indexOf(take[i].v) < 0) out.push(take[i].v);
        for (i = 0; i < JUNK.length && out.length < n; i++) if (out.indexOf(JUNK[i]) < 0) out.push(JUNK[i]);
        return out;
      }

      function makeTile(text, correct, junk) {
        var parts = splitNum(text);
        var w = Math.max(charW(20) * parts[0].length, parts[1] ? charW(16) * parts[1].length : 0) + 50;
        w = api.clamp(Math.round(w), 132, 336);
        var h = parts[1] ? 70 : 54;
        return {
          kind: junk ? 'junk' : 'clause', text: text, lines: parts,
          w: w, h: h, x: W / 2, cx: W / 2, y: FIELD_TOP - h,
          k: api.rand(0.92, 1.12),
          wob: 0, phase: api.rand(0, 6.283),                 // clause tiles never wobble; harder levels are harder questions only
          rot: 0, correct: !!correct, dead: false, deadT: 0, t: 0
        };
      }
      function makePower(kind) {
        return {
          kind: 'pu', pu: kind, text: kind, lines: ['', ''],
          w: 78, h: 84, x: W / 2, cx: W / 2, y: FIELD_TOP - 84,
          k: 0.78, wob: 12, phase: api.rand(0, 6.283),
          rot: 0, correct: false, dead: false, deadT: 0, t: 0
        };
      }

      function placeTile(tl) {
        var half = tl.w / 2, i, other, tries, x, ok;
        for (tries = 0; tries < 14; tries++) {
          x = api.rand(SIDE + half, W - SIDE - half);
          ok = true;
          for (i = 0; i < st.tiles.length; i++) {
            other = st.tiles[i];
            if (Math.abs(other.y - tl.y) > 96) continue;
            if (Math.abs(other.cx - x) < (other.w + tl.w) / 2 + 18) { ok = false; break; }
          }
          if (ok) break;
        }
        if (!ok) return false;
        tl.x = x; tl.cx = x;
        return true;
      }

      function nextTarget() {
        if (st.over) return;
        if (st.right >= GOAL) { finish('cleared'); return; }
        if (st.resolved >= TARGET_CAP) { finish('cap'); return; }
        var item = null, i, back, tag;
        // a clause that fell through comes back a few targets later, still handed out by api.progress.pick
        for (i = 0; i < st.retry.length; i++) {
          if (st.retry[i].due <= st.resolved) {
            back = st.retry.splice(i, 1)[0];
            tag = 'retry' + (++st.retryN) + ':';
            item = prog.pick([back.item], function (it) { return tag + it.id; });
            break;
          }
        }
        if (!item) item = prog.pick(items);
        if (!item) { finish('data'); return; }
        st.item = item;
        st.lines = null;
        st.verdict = null;

        var lvl = prog.level;
        var dn = lvl >= 3 ? 3 : 2;                           // level 3 adds one look-alike tile, never less time
        var list = [makeTile(item.clause, true, false)];
        var ds = distractorsFor(item.clause, dn, lvl);
        for (i = 0; i < ds.length; i++) list.push(makeTile(ds[i], false, JUNK.indexOf(ds[i]) >= 0));

        list = api.shuffle(list);
        // never make the answer the very last tile of the wave
        if (list.length > 1 && list[list.length - 1].correct) {
          var j = api.randInt(0, list.length - 2);
          var tmp = list[j]; list[j] = list[list.length - 1]; list[list.length - 1] = tmp;
        }
        st.pending = list;
        st.spawnT = 0.15;
        if (api.ready) api.ready(item.title + ' ' + (item.applies || ''));   // reading pause on easier levels
      }

      // ---- resolution ------------------------------------------------------
      function record(given, ok) {
        var it = st.item;
        if (!it) return;
        api.review.add({
          prompt: it.title + (it.applies ? ' — ' + it.applies : ''),
          correct: it.clause,
          given: given,
          ok: !!ok,
          explanation: 'Status: ' + (it.status || 'unverified'),
          cite: it.clause
        });
      }
      function killWave() {
        st.pending = [];
        for (var i = 0; i < st.tiles.length; i++) if (st.tiles[i].kind !== 'pu') st.tiles[i].dead = true;
      }
      function bumpProgress() {
        st.resolved++;
        api.hud.set({ progress: Math.min(1, st.right / GOAL) });
      }

      function caughtRight(tl) {
        var it = st.item;
        st.answered++; st.right++;
        record(it.clause, true);
        var gain = 100 * st.combo;
        api.score(gain);
        st.combo = Math.min(8, st.combo + 1);
        api.audio.correct();
        api.particles.emit({ x: tl.cx, y: RIM_Y - 6, n: 30, color: [C.green, C.gold2, C.white], speed: 320, life: .8, size: 6, gravity: 160, shape: 'spark' });
        api.particles.emit({ x: tl.cx, y: RIM_Y - 6, n: 14, color: [C.purple, C.sky], speed: 170, life: .7, size: 5, gravity: 60 });
        api.hud.set({ combo: st.combo, banner: '+' + gain, sub: it.clause, bannerTime: 0.9 });
        st.basket.pop = 1;
        st.verdict = { ok: true, given: it.clause, clause: it.clause, junk: false }; st.verdictT = 2.2;
        killWave();
        bumpProgress();
        st.hold = 0.8;
        if (prog.correct()) {                                // level up: the shell shows the banner and plays the fanfare
          st.levelPulse = 2.4;
          st.hold = 2.2;                                     // let the level banner finish before the next clause
          api.hud.set({ level: prog.level });
        }
      }

      function caughtWrong(tl) {
        var it = st.item;
        st.answered++;
        record(tl.text, false);
        api.score(-60);
        st.combo = 1;
        api.audio.wrong();
        api.shake(13);
        api.flash('rgba(255,107,107,.26)');
        api.particles.emit({ x: tl.cx, y: RIM_Y - 6, n: 22, color: [C.red, C.orange], speed: 260, life: .7, size: 5, gravity: 320 });
        api.hud.set({ combo: 1, banner: it.clause, sub: it.title, bannerTime: 2.0 });
        st.verdict = { ok: false, given: tl.text, clause: it.clause, junk: tl.kind === 'junk' }; st.verdictT = 2.6;
        killWave();
        bumpProgress();
        st.lives = api.life(-1);
        if (st.lives <= 0) { st.over = true; return; }
        st.hold = 1.7;
      }

      function missedTarget(tl) {
        var it = st.item;
        st.missed++;
        record('— fell through —', false);
        api.score(-15);
        st.combo = 1;
        api.audio.tone(180, .22, 'sine', .07, 90);
        api.particles.emit({ x: tl.cx, y: RIM_Y + 26, n: 12, color: [C.muted, C.ink2], speed: 140, life: .6, size: 4, gravity: 200 });
        api.hud.set({ combo: 1, banner: 'Missed', sub: it.clause + ' comes back later', bannerTime: 1.3 });
        st.verdict = { ok: false, given: '', clause: it.clause, junk: false, miss: true }; st.verdictT = 2.2;
        killWave();
        bumpProgress();
        // bring the clause back a few targets later
        st.retry.push({ item: it, due: st.resolved + 3 + api.randInt(0, 3) });
        st.hold = 1.1;
      }

      function grabPower(tl) {
        api.score(25);
        api.audio.powerup();
        var col = tl.pu === 'slow' ? C.teal : C.gold;
        api.particles.emit({ x: tl.cx, y: RIM_Y - 6, n: 24, color: [col, C.white], speed: 240, life: .8, size: 5, gravity: 80, shape: 'spark' });
        st.basket.pop = 1;
        if (tl.pu === 'slow') { st.slowT = 5; api.hud.set({ banner: 'Slow time', sub: '5 seconds', bannerTime: 1.0 }); }
        else { st.wideT = 12; st.basket.want = WIDE_W; api.hud.set({ banner: 'Wide folder', sub: '12 seconds', bannerTime: 1.0 }); }
      }

      // The round ends as a win after 5 catches at each of the 3 levels, or stops after TARGET_CAP clauses.
      // Running out of lives is handled by the shell. There is no round clock: players get time to read.
      function finish(reason) {
        if (st.over) return;
        st.over = true;
        var bonus = Math.max(0, st.lives) * 80;
        if (bonus > 0) api.score(bonus);
        var msg = st.right + ' of ' + st.answered + ' caught · reached level ' + prog.level + ' (' + levelName().toLowerCase() + ' questions)' +
          (st.missed ? ' · ' + st.missed + ' fell through' : '') +
          (bonus ? ' · +' + bonus + ' folder bonus' : '');
        if (reason === 'cleared') api.end({ won: true, title: 'All three levels cleared', message: msg });
        else if (reason === 'data') api.end({ won: st.right > 0, title: 'Out of clauses', message: msg });
        else api.end({ won: prog.level >= LEVELS, title: 'Round over', message: msg + ' · ' + TARGET_CAP + ' clauses played' });
      }

      // ---- update ----------------------------------------------------------
      function update(dt) {
        if (st.over) return;
        st.t += dt;

        if (st.hintT > 0) st.hintT -= dt;
        if (st.levelPulse > 0) st.levelPulse = Math.max(0, st.levelPulse - dt);
        if (st.verdictT > 0) { st.verdictT -= dt; if (st.verdictT <= 0) st.verdict = null; }
        if (st.slowT > 0) st.slowT = Math.max(0, st.slowT - dt);
        if (st.wideT > 0) { st.wideT = Math.max(0, st.wideT - dt); if (st.wideT === 0) st.basket.want = BASE_W; }

        // no wind: tiles fall straight down at one pace for the whole run

        // basket
        var b = st.basket;
        b.w += (b.want - b.w) * Math.min(1, dt * 7);
        b.pop = Math.max(0, b.pop - dt * 3.2);
        var kx = 0, keys = api.input.keys;
        if (keys && keys.size) {
          if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) kx -= 1;
          if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) kx += 1;
        }
        if (kx !== 0) {
          st.follow = false;
          b.vx += (kx * 560 - b.vx) * Math.min(1, dt * 14);
        } else if (st.follow) {
          var want = api.clamp(b.target, SIDE + b.w / 2, W - SIDE - b.w / 2);
          b.vx = (want - b.x) * 11;
        } else {
          b.vx *= Math.pow(0.0016, dt);
        }
        b.x = api.clamp(b.x + b.vx * dt, SIDE + b.w / 2, W - SIDE - b.w / 2);
        b.tilt = api.clamp(b.vx * 0.00016, -0.14, 0.14);

        // background drift
        var i, s;
        for (i = 0; i < sheets.length; i++) {
          s = sheets[i];
          s.y += s.sp * dt; s.rot += dt * 0.22; s.x += Math.sin(st.t * 0.7 + s.sway) * 6 * dt;
          if (s.y > H + 60) sheets[i] = makeSheet(FIELD_TOP - 70);
        }
        for (i = 0; i < rain.length; i++) {
          rain[i].y += rain[i].sp * dt;
          if (rain[i].y > H + 40) { rain[i].y = -api.rand(40, 300); rain[i].txt = api.pick(pool) || 'FAR 52'; }
        }

        // power-up drop
        st.puTimer -= dt;
        if (st.puTimer <= 0) {
          st.puTimer = api.rand(17, 27);
          var pu = makePower(Math.random() < 0.5 ? 'slow' : 'wide');
          if (placeTile(pu)) st.tiles.push(pu); else st.puTimer = 1.2;
        }

        // between targets
        if (st.hold > 0) {
          st.hold -= dt;
          if (st.hold <= 0) { nextTarget(); if (st.over) return; }
        } else if (!st.item) {
          nextTarget();
          if (st.over) return;
        } else if (st.pending.length) {
          st.spawnT -= dt;
          if (st.spawnT <= 0) {
            var tl = st.pending[0];
            if (placeTile(tl)) { st.pending.shift(); st.tiles.push(tl); st.spawnT = spawnGap(); api.audio.blip(); }
            else st.spawnT = 0.22;
          }
        }

        // tiles — move, then catch, then cull
        var sp = fallSpeed(), t2;
        for (i = 0; i < st.tiles.length; i++) {
          t2 = st.tiles[i];
          t2.t += dt;
          if (t2.dead) t2.deadT += dt;
          t2.y += sp * t2.k * dt;
          t2.x = api.clamp(t2.x, SIDE + t2.w / 2, W - SIDE - t2.w / 2);
          t2.cx = t2.x + (t2.wob ? Math.sin(st.t * 3.1 + t2.phase) * t2.wob : 0);   // only pickups sway
          t2.rot = t2.wob ? Math.sin(st.t * 3.1 + t2.phase) * 0.05 : 0;
        }

        // catch pass: the answer and pickups win a tie against a wrong tile at the same instant
        var reach = st.basket.w / 2 + 14;
        var order = st.tiles.slice().sort(function (a, b) { return rank(a) - rank(b); });
        for (i = 0; i < order.length; i++) {
          t2 = order[i];
          if (t2.dead) continue;
          var bottom = t2.y + t2.h / 2;
          if (bottom < RIM_Y || bottom > RIM_Y + 34) continue;
          if (Math.abs(t2.cx - st.basket.x) > reach) continue;
          var at = st.tiles.indexOf(t2);
          if (at >= 0) st.tiles.splice(at, 1);
          if (t2.kind === 'pu') { grabPower(t2); continue; }
          if (st.hold > 0 || !st.item) continue;           // wave already resolved
          if (t2.correct) caughtRight(t2); else caughtWrong(t2);
          if (st.over) return;
        }

        // cull
        for (i = st.tiles.length - 1; i >= 0; i--) {
          t2 = st.tiles[i];
          if (t2.dead && t2.deadT > 0.55) { st.tiles.splice(i, 1); continue; }
          if (t2.y - t2.h / 2 > RIM_Y + 48) {
            st.tiles.splice(i, 1);
            if (!t2.dead && t2.correct && st.item && st.hold <= 0) { missedTarget(t2); if (st.over) return; }
          }
        }
      }
      function rank(t) { return t.kind === 'pu' ? 0 : (t.correct ? 1 : 2); }

      // ================= drawing ============================================
      function drawBack(ctx) {
        var g = ctx.createLinearGradient(0, FIELD_TOP, 0, H);
        g.addColorStop(0, '#0a0f1e');
        g.addColorStop(0.62, '#0b1120');
        g.addColorStop(1, '#06090f');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        // faint clause rain
        ctx.save();
        for (var i = 0; i < rain.length; i++) {
          var r = rain[i];
          api.text(ctx, r.txt, r.x, r.y, { size: 16, fam: 'mono', weight: 600, color: C.sky, alpha: r.a, align: 'center' });
        }
        ctx.restore();

        // side rails
        ctx.save();
        ctx.fillStyle = 'rgba(183,139,255,.05)';
        ctx.fillRect(0, FIELD_TOP, SIDE - 4, RIM_Y + 50 - FIELD_TOP);
        ctx.fillRect(W - SIDE + 4, FIELD_TOP, SIDE - 4, RIM_Y + 50 - FIELD_TOP);
        ctx.restore();

        // floating paper
        for (var j = 0; j < sheets.length; j++) {
          var s = sheets[j];
          ctx.save();
          ctx.globalAlpha = 0.22;
          ctx.translate(s.x, s.y); ctx.rotate(s.rot);
          api.roundRect(ctx, -s.w / 2, -s.h / 2, s.w, s.h, 4);
          ctx.fillStyle = '#182444'; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.25)';
          for (var k = 0; k < 4; k++) ctx.fillRect(-s.w / 2 + 5, -s.h / 2 + 8 + k * 8, s.w - 14, 2);
          ctx.restore();
        }

        // catch line
        ctx.save();
        var lg = ctx.createLinearGradient(0, 0, W, 0);
        lg.addColorStop(0, 'rgba(183,139,255,0)');
        lg.addColorStop(0.5, 'rgba(183,139,255,.45)');
        lg.addColorStop(1, 'rgba(183,139,255,0)');
        ctx.strokeStyle = lg; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(SIDE, RIM_Y); ctx.lineTo(W - SIDE, RIM_Y); ctx.stroke();
        ctx.strokeStyle = 'rgba(183,139,255,.16)'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (var x = SIDE; x < W - SIDE; x += 26) { ctx.moveTo(x, RIM_Y + 5); ctx.lineTo(x + 10, RIM_Y + 5); }
        ctx.stroke();
        ctx.restore();

        // catch beam over the folder
        ctx.save();
        var bx = st.basket.x, bw = st.basket.w;
        var bg2 = ctx.createLinearGradient(0, FIELD_TOP, 0, RIM_Y);
        bg2.addColorStop(0, 'rgba(183,139,255,0)');
        bg2.addColorStop(1, 'rgba(183,139,255,.13)');
        ctx.fillStyle = bg2;
        ctx.fillRect(bx - bw / 2, FIELD_TOP, bw, RIM_Y - FIELD_TOP);
        ctx.restore();

        if (st.slowT > 0) {
          ctx.save();
          var sg = ctx.createRadialGradient(W / 2, RIM_Y, 60, W / 2, RIM_Y, 620);
          sg.addColorStop(0, 'rgba(79,209,197,0)');
          sg.addColorStop(1, 'rgba(79,209,197,.13)');
          ctx.fillStyle = sg; ctx.fillRect(0, FIELD_TOP, W, H - FIELD_TOP);
          ctx.restore();
        }
      }

      function drawPanel(ctx) {
        api.roundRect(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 16);
        ctx.fillStyle = 'rgba(10,16,30,.90)'; ctx.fill();
        var edge = st.verdict ? (st.verdict.ok ? 'rgba(95,211,154,.55)' : 'rgba(255,107,107,.5)') : 'rgba(183,139,255,.34)';
        ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke();

        ctx.save();
        api.roundRect(ctx, PANEL.x, PANEL.y, 6, PANEL.h, 3);
        ctx.fillStyle = st.verdict ? (st.verdict.ok ? C.green : C.red) : C.purple; ctx.fill();
        ctx.restore();

        var it = st.item;
        api.pill(ctx, 'CAUGHT ' + Math.min(GOAL, st.right) + ' / ' + GOAL, PANEL.x + PANEL.w - 96, PANEL.y + 26,
          { size: 16, fam: 'mono', align: 'center', bg: 'rgba(183,139,255,.14)', stroke: 'rgba(183,139,255,.45)', color: C.ink });

        if (!it) {
          api.text(ctx, 'Loading the next clause…', PANEL.x + 24, PANEL.y + 44, { size: 18, weight: 700, color: C.ink2 });
          return;
        }

        var tx = PANEL.x + 24, i;
        if (!st.lines) {
          var tl2 = clampLines(ctx, it.title, 20, 700, PANEL.w - 220, 2);
          st.lines = {
            title: tl2,
            applies: clampLines(ctx, it.applies || 'When it applies: not stated in the repository.', 16, 500, PANEL.w - 56, tl2.length >= 2 ? 2 : 3)
          };
        }
        for (i = 0; i < st.lines.title.length; i++) {
          api.text(ctx, st.lines.title[i], tx, PANEL.y + 32 + i * 24, { size: 20, weight: 700, color: C.ink });
        }
        var ay = PANEL.y + 32 + st.lines.title.length * 24 + 10;
        for (i = 0; i < st.lines.applies.length; i++) {
          api.text(ctx, st.lines.applies[i], tx, ay + i * 21, { size: 16, weight: 500, color: C.ink2 });
        }
      }

      function drawTile(ctx, tl) {
        ctx.save();
        if (tl.dead) ctx.globalAlpha = Math.max(0, 1 - tl.deadT / 0.55);
        ctx.translate(tl.cx, tl.y);
        ctx.rotate(tl.rot);

        if (tl.kind === 'pu') { drawPower(ctx, tl); ctx.restore(); return; }

        var w = tl.w, h = tl.h, pulse = 14 + Math.sin(st.t * 3 + tl.phase) * 5;
        api.glow(ctx, C.sky, pulse);
        api.roundRect(ctx, -w / 2, -h / 2, w, h, 12);
        ctx.fillStyle = 'rgba(11,18,34,.94)'; ctx.fill();
        api.noGlow(ctx);
        ctx.strokeStyle = 'rgba(143,198,255,.85)'; ctx.lineWidth = 2; ctx.stroke();

        // sheen + punch holes so it reads as paper
        ctx.save();
        api.roundRect(ctx, -w / 2 + 5, -h / 2 + 4, w - 10, 10, 5);
        ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill();
        ctx.fillStyle = 'rgba(143,198,255,.35)';
        ctx.beginPath(); ctx.arc(-w / 2 + 12, 0, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w / 2 - 12, 0, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        if (tl.lines[1]) {
          monoFit(ctx, tl.lines[0], 0, -10, 20, w - 32, C.ink);
          monoFit(ctx, tl.lines[1], 0, 16, 16, w - 24, C.sky);
        } else {
          monoFit(ctx, tl.lines[0], 0, 1, 20, w - 32, C.ink);
        }

        // drop point: the folder catches on the tile's centre, so mark it
        ctx.beginPath();
        ctx.moveTo(-8, h / 2); ctx.lineTo(8, h / 2); ctx.lineTo(0, h / 2 + 8); ctx.closePath();
        ctx.fillStyle = 'rgba(143,198,255,.9)'; ctx.fill();
        ctx.restore();
      }

      // faint plumb line from a low tile down to the catch line
      function drawDrops(ctx) {
        ctx.save();
        for (var i = 0; i < st.tiles.length; i++) {
          var tl = st.tiles[i];
          if (tl.dead) continue;
          var bottom = tl.y + tl.h / 2;
          if (bottom < RIM_Y - 170) continue;
          var a = api.clamp((bottom - (RIM_Y - 170)) / 130, 0, 1) * 0.5;
          var col = tl.kind === 'pu' ? (tl.pu === 'slow' ? C.teal : C.gold) : C.sky;
          ctx.globalAlpha = a;
          ctx.strokeStyle = col; ctx.lineWidth = 2;
          ctx.setLineDash([4, 7]);
          ctx.beginPath(); ctx.moveTo(tl.cx, bottom + 10); ctx.lineTo(tl.cx, RIM_Y - 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = Math.min(1, a * 1.5);
          ctx.beginPath(); ctx.moveTo(tl.cx - 8, RIM_Y); ctx.lineTo(tl.cx + 8, RIM_Y); ctx.stroke();
        }
        ctx.restore();
      }

      function drawPower(ctx, tl) {
        var r = 27, col = tl.pu === 'slow' ? C.teal : C.gold, i, a, px, py;
        api.glow(ctx, col, 18 + Math.sin(st.t * 4 + tl.phase) * 6);
        ctx.beginPath();
        for (i = 0; i < 6; i++) {
          a = Math.PI / 6 + i * Math.PI / 3;
          px = Math.cos(a) * r; py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(9,14,26,.94)'; ctx.fill();
        api.noGlow(ctx);
        ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.stroke();

        ctx.save();
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
        if (tl.pu === 'slow') {                       // hourglass
          ctx.beginPath(); ctx.moveTo(-11, -13); ctx.lineTo(11, -13); ctx.moveTo(-11, 13); ctx.lineTo(11, 13); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(9, -12); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-9, 12); ctx.lineTo(9, 12); ctx.lineTo(0, 0); ctx.closePath();
          ctx.globalAlpha = .45; ctx.fill(); ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, 9); ctx.stroke();
        } else {                                      // wide folder
          ctx.beginPath(); ctx.moveTo(-10, -7); ctx.lineTo(10, -7); ctx.lineTo(7, 9); ctx.lineTo(-7, 9); ctx.closePath(); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-15, 1); ctx.lineTo(-21, 1); ctx.moveTo(-18, -3); ctx.lineTo(-22, 1); ctx.lineTo(-18, 5);
          ctx.moveTo(15, 1); ctx.lineTo(21, 1); ctx.moveTo(18, -3); ctx.lineTo(22, 1); ctx.lineTo(18, 5);
          ctx.stroke();
        }
        ctx.restore();
        api.text(ctx, tl.pu === 'slow' ? 'SLOW' : 'WIDE', 0, r + 15, { size: 16, fam: 'mono', weight: 700, align: 'center', baseline: 'middle', color: col });
      }

      function drawBasket(ctx) {
        var b = st.basket, half = b.w / 2, pop = b.pop;
        ctx.save();
        // shadow
        ctx.globalAlpha = .3; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(b.x, RIM_Y + BASKET_H + 6, half * 0.9, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;

        ctx.translate(b.x, RIM_Y);
        ctx.rotate(b.tilt);
        ctx.scale(1 + pop * 0.10, 1 - pop * 0.09);

        var wide = st.wideT > 0, accent = wide ? C.gold : C.purple;

        // papers peeking out of the mouth
        ctx.save();
        ctx.globalAlpha = .9;
        ctx.translate(-half * 0.35, -6); ctx.rotate(-0.12);
        api.roundRect(ctx, -22, -22, 44, 30, 3); ctx.fillStyle = '#dfe6f5'; ctx.fill();
        ctx.fillStyle = 'rgba(20,30,54,.35)';
        ctx.fillRect(-16, -16, 32, 2.4); ctx.fillRect(-16, -10, 26, 2.4); ctx.fillRect(-16, -4, 30, 2.4);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = .85;
        ctx.translate(half * 0.3, -3); ctx.rotate(0.15);
        api.roundRect(ctx, -20, -20, 40, 28, 3); ctx.fillStyle = '#c9d3e8'; ctx.fill();
        ctx.fillStyle = 'rgba(20,30,54,.3)';
        ctx.fillRect(-14, -14, 28, 2.2); ctx.fillRect(-14, -8, 22, 2.2);
        ctx.restore();

        // folder tab
        api.roundRect(ctx, -half + 10, -13, 74, 16, 5);
        ctx.fillStyle = wide ? 'rgba(226,182,87,.55)' : 'rgba(183,139,255,.45)'; ctx.fill();

        // folder body
        api.glow(ctx, accent, 20);
        ctx.beginPath();
        ctx.moveTo(-half, 0);
        ctx.lineTo(half, 0);
        ctx.lineTo(half - 16, BASKET_H - 8);
        ctx.quadraticCurveTo(half - 20, BASKET_H, half - 28, BASKET_H);
        ctx.lineTo(-half + 28, BASKET_H);
        ctx.quadraticCurveTo(-half + 20, BASKET_H, -half + 16, BASKET_H - 8);
        ctx.closePath();
        var fg = ctx.createLinearGradient(0, 0, 0, BASKET_H);
        fg.addColorStop(0, wide ? '#3a2f16' : '#241b3d');
        fg.addColorStop(1, '#0d1322');
        ctx.fillStyle = fg; ctx.fill();
        api.noGlow(ctx);
        ctx.strokeStyle = accent; ctx.lineWidth = 2.4; ctx.stroke();

        // front pocket + label
        ctx.save();
        api.roundRect(ctx, -half + 22, 16, b.w - 44, BASKET_H - 30, 6);
        ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = accent; ctx.globalAlpha = .75;
        ctx.fillRect(-half + 32, 26, Math.max(18, b.w - 110), 3);
        ctx.fillRect(-half + 32, 34, Math.max(12, b.w - 150), 3);
        ctx.restore();

        // glowing rim
        api.glow(ctx, accent, 22);
        ctx.strokeStyle = wide ? C.gold2 : '#d8c2ff';
        ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-half + 2, 0); ctx.lineTo(half - 2, 0); ctx.stroke();
        api.noGlow(ctx);
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(-half, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(half, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      function drawChips(ctx) {
        var y = FIELD_TOP + 20;
        // level chip, driven by api.progress.level; it glows for a moment after a level-up
        var lvl = prog.level, lcol = lvl >= 3 ? C.orange : lvl === 2 ? C.sky : C.green;
        ctx.save();
        if (st.levelPulse > 0) api.glow(ctx, lcol, 10 + Math.sin(st.t * 9) * 6 + st.levelPulse * 4);
        api.pill(ctx, levelName().toUpperCase() + ' QUESTIONS', SIDE + 150, y,   // the HUD already shows the level number
          { size: 16, fam: 'mono', align: 'center', bg: 'rgba(6,10,20,.78)', stroke: lcol, color: lcol });
        ctx.restore();
        // power-up chips stack down the right edge
        var chips = [];
        if (st.slowT > 0) chips.push({ label: 'SLOW ' + st.slowT.toFixed(1) + 's', col: C.teal, bg: 'rgba(79,209,197,.16)', stroke: 'rgba(79,209,197,.5)' });
        if (st.wideT > 0) chips.push({ label: 'WIDE ' + st.wideT.toFixed(1) + 's', col: C.gold2, bg: 'rgba(226,182,87,.16)', stroke: 'rgba(226,182,87,.5)' });
        var cx = W - SIDE - 90;
        for (var j = 0; j < chips.length; j++) {
          api.pill(ctx, chips[j].label, cx, y + j * 32,
            { size: 16, fam: 'mono', align: 'center', bg: chips[j].bg, stroke: chips[j].stroke, color: chips[j].col });
        }
      }

      function drawStrip(ctx) {
        api.roundRect(ctx, STRIP.x, STRIP.y, STRIP.w, STRIP.h, 8);
        ctx.fillStyle = 'rgba(8,13,26,.82)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.2; ctx.stroke();

        var label, col = C.muted;
        var v = st.verdict;
        if (v && v.ok) { label = '✓ ' + v.clause; col = C.green; }
        else if (v && v.miss) { label = '↓ ' + v.clause + ' — it comes back later'; col = C.orange; }
        else if (v) { label = '✕ ' + (v.junk ? 'not a real clause number: ' : 'caught ') + v.given + '  →  ' + v.clause; col = C.red; }
        else label = 'Catch the number that matches the title · wrong numbers cost a life';
        api.text(ctx, fitText(ctx, label, STRIP.w - 36, 16), W / 2, STRIP.y + STRIP.h / 2 + 1,
          { size: 16, fam: 'mono', weight: 600, align: 'center', baseline: 'middle', color: col });
      }

      function drawHint(ctx) {
        if (st.hintT <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, st.hintT / 0.9);
        api.pill(ctx, '← → or A / D slide the folder · drag anywhere on touch', W / 2, RIM_Y - 44,
          { size: 17, fam: 'body', align: 'center', bg: 'rgba(6,10,20,.82)', stroke: 'rgba(255,255,255,.22)', color: C.ink });
        ctx.restore();
      }

      function draw(ctx) {
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
        drawBack(ctx);
        drawDrops(ctx);
        for (var i = 0; i < st.tiles.length; i++) drawTile(ctx, st.tiles[i]);
        drawBasket(ctx);
        drawPanel(ctx);
        drawChips(ctx);
        drawStrip(ctx);
        drawHint(ctx);
      }

      // ---- input -----------------------------------------------------------
      function onKey(k, down) {
        if (!down || st.over) return;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'ArrowRight' || k === 'd' || k === 'D') st.follow = false;
      }
      function onPointer(p) {
        if (!p || st.over) return;
        if (p.type === 'down' || (p.type === 'move' && api.input.pointer.down)) {
          st.follow = true;
          st.basket.target = p.x;
        } else if (p.type === 'up') {
          st.basket.target = p.x;
        }
      }

      return {
        update: update,
        draw: draw,
        onKey: onKey,
        onPointer: onPointer,
        destroy: function () {
          st.tiles.length = 0; st.pending.length = 0; st.retry.length = 0;
          sheets.length = 0; rain.length = 0; items = []; pool = [];
          st.item = null; st.lines = null; st.verdict = null;
        }
      };
    }
  });
})();
