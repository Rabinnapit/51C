/* GAME: deadline-dash — side-scrolling runner on the protest / claim / notice timeline.
   Three stacked lanes, each with a gate labelled a number of days; run through the right one.
   Each run also builds up to six date cards from calendar-day clocks: a new start date, and gates
   labelled with calendar dates instead of day counts.
   Levels are question difficulty (api.progress): headline deadlines first, then harder clocks.
   The run keeps its level-1 pace the whole way; the shell's clock gives harder levels more time. */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var ROUND_CARDS = 24;                       // a round ends after this many gates, or sooner when lives run out
  var MIN_CARDS = 12;                         // a small card set still gets a real round (cards repeat after a full pass)
  var PER_LEVEL = 5;                          // correct answers per question level
  var BASE_SPEED = 172;                       // run speed in px per second for the whole round; never ramps
  var HURDLE_GAP = [2.2, 3.8];                // seconds between hurdles; fixed for the whole round
  var FALLBACK_DAYS = [5, 10, 30, 60, 90, 100];
  var LEVEL_NAMES = ['Easy questions', 'Medium questions', 'Hard questions'];
  var LEVEL_COLORS = [A.C.green, A.C.sky, A.C.orange];

  // ---- data ----------------------------------------------------------------
  function clockCards(D) {
    var raw = ((D || {}).games || {}).protest_clock;
    if (!raw || !raw.length) return [];
    var out = [], i, it, d;
    for (i = 0; i < raw.length; i++) {
      it = raw[i];
      if (!it || !it.event) continue;
      if (it.days === null || it.days === undefined || it.days === '') continue;
      d = Number(it.days);
      if (!isFinite(d) || d <= 0) continue;
      out.push({
        id: it.id || ('pc' + i),
        event: String(it.event),
        days: d,
        day_type: it.day_type ? String(it.day_type) : '',
        anchor: it.anchor ? String(it.anchor) : '',
        rule: it.rule ? String(it.rule) : '',
        cite: it.cite ? String(it.cite) : '',
        difficulty: it.difficulty,              // 1 easy, 2 medium, 3 hard; api.progress counts a missing value as 2
        classes: it.classes                   // warrant classes; api.progress.pick filters by the player's class
      });
    }
    return out;
  }
  function dayWord(card) { return card && card.day_type ? card.day_type + ' days' : 'days'; }
  // how alike two day counts look: a ratio distance, so 90 vs 100 is closer than 1 vs 5
  function closeness(v, target) { return Math.abs(Math.log((v + 1) / (target + 1))); }

  // ---- date cards: the same clocks with real calendar dates, new every run ----
  // Sources are calendar-day clocks of 1 to 120 days that count forward from an event ("from", "after", "following").
  // The start date is a random business day in the next 365 days; a start whose due date falls on a Saturday, Sunday or
  // federal holiday is re-rolled (30 tries, then the source is skipped), so no answer turns on a roll-forward rule.
  var DATE_CARDS = 6;                           // date cards per run
  var DATE_TRIES = 30;
  var DATE_MAX_DAYS = 120;
  var DATE_PLATE_W = 136;                       // plate width on date gates: "Wed 30 Sep" fits at 20 px, never below 16 px
  var DAY_MS = 86400000;
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var holidayMemo = {};

  function dayNum(y, m, d) { return Math.round(Date.UTC(y, m, d) / DAY_MS); }   // whole days since 1 January 1970
  function dayParts(n) { var t = new Date(n * DAY_MS); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), wd: t.getUTCDay() }; }
  function todayNum() { var t = new Date(); return dayNum(t.getFullYear(), t.getMonth(), t.getDate()); }
  function nthWeekday(y, m, wd, nth) { var first = dayNum(y, m, 1); return first + (wd - dayParts(first).wd + 7) % 7 + (nth - 1) * 7; }
  function lastWeekday(y, m, wd) { var last = dayNum(y, m + 1, 0); return last - (dayParts(last).wd - wd + 7) % 7; }
  function observed(n) { var wd = dayParts(n).wd; return wd === 6 ? n - 1 : wd === 0 ? n + 1 : n; }   // Saturday -> Friday, Sunday -> Monday
  function holidaysIn(y) {
    if (holidayMemo[y]) return holidayMemo[y];
    var set = {};
    [observed(dayNum(y, 0, 1)),                 // New Year's Day
      nthWeekday(y, 0, 1, 3),                   // Birthday of Martin Luther King, Jr.: third Monday in January
      nthWeekday(y, 1, 1, 3),                   // Washington's Birthday: third Monday in February
      lastWeekday(y, 4, 1),                     // Memorial Day: last Monday in May
      observed(dayNum(y, 5, 19)),               // Juneteenth National Independence Day
      observed(dayNum(y, 6, 4)),                // Independence Day
      nthWeekday(y, 8, 1, 1),                   // Labor Day: first Monday in September
      nthWeekday(y, 9, 1, 2),                   // Columbus Day: second Monday in October
      observed(dayNum(y, 10, 11)),              // Veterans Day
      nthWeekday(y, 10, 4, 4),                  // Thanksgiving Day: fourth Thursday in November
      observed(dayNum(y, 11, 25))               // Christmas Day
    ].forEach(function (n) { set[n] = 1; });
    holidayMemo[y] = set;
    return set;
  }
  // a 1 January that falls on a Saturday is observed on 31 December of the year before
  function isHoliday(n) { var y = dayParts(n).y; return !!(holidaysIn(y)[n] || holidaysIn(y + 1)[n]); }
  function isBusinessDay(n) { var wd = dayParts(n).wd; return wd !== 0 && wd !== 6 && !isHoliday(n); }
  function longDate(n) { var p = dayParts(n); return WEEKDAYS[p.wd] + ', ' + p.d + ' ' + MONTHS[p.m] + ' ' + p.y; }             // Tuesday, 3 March 2026
  function gateDate(n) { var p = dayParts(n); return WEEKDAYS[p.wd].slice(0, 3) + ' ' + p.d + ' ' + MONTHS[p.m].slice(0, 3); }  // Fri 13 Mar
  function shortDate(n) { return gateDate(n) + ' ' + dayParts(n).y; }                                                           // Fri 13 Mar 2026
  function countWord(n) { return n + (n === 1 ? ' calendar day' : ' calendar days'); }
  function startLine(card) { return 'Clock starts ' + longDate(card.start) + (card.anchor ? ' (' + card.anchor + ')' : ''); }
  function dueQuestion(card) { return 'Due date? ' + startLine(card); }

  function dateSource(card) {
    if (!card || card.gen || card.day_type !== 'calendar') return false;
    if (!(card.days >= 1 && card.days <= DATE_MAX_DAYS) || Math.round(card.days) !== card.days) return false;
    var anchor = String(card.anchor || '');
    return !/\bbefore\b/i.test(anchor) && /\b(from|after|following)\b/i.test(anchor);
  }
  function randomBusinessDay(today) {           // a business day in the next 365 days
    for (var k = 0; k < 60; k++) { var n = today + A.randInt(1, 365); if (isBusinessDay(n)) return n; }
    return -1;
  }
  // fits(card) keeps sources inside the player's warrant class; each date card carries its source's classes, rule and cite,
  // and sits one difficulty step above its source
  function makeDateCards(cards, fits) {
    var out = [], today = todayNum(), list = [], i, j, src, start, n, diff;
    for (i = 0; i < cards.length; i++) if (dateSource(cards[i]) && (!fits || fits(cards[i]))) list.push(cards[i]);
    list = A.shuffle(list);
    for (i = 0; i < list.length && out.length < DATE_CARDS; i++) {
      src = list[i]; start = -1;
      for (j = 0; j < DATE_TRIES; j++) {
        n = randomBusinessDay(today);
        if (n >= 0 && isBusinessDay(n + src.days)) { start = n; break; }
      }
      if (start < 0) continue;
      diff = Math.round(Number(src.difficulty));
      if (!(diff >= 1 && diff <= 3)) diff = 2;  // api.progress counts a missing difficulty as 2
      out.push({
        id: 'GEN-' + src.id + '-' + (out.length + 1), gen: true,
        event: src.event, days: src.days, day_type: src.day_type, anchor: src.anchor, rule: src.rule, cite: src.cite,
        difficulty: Math.min(3, diff + 1),
        classes: Array.isArray(src.classes) ? src.classes.slice() : src.classes,
        source: src.id, start: start, due: start + src.days
      });
    }
    return out;
  }

  A.register({
    id: 'deadline-dash',
    title: 'Deadline Dash',
    tagline: 'Run the gate that matches the clock.',
    blurb: 'A contracting officer sprints down the timeline while protest, claim and notice deadlines fly at her in three lanes. Pick the lane with the right number of days, or the right due date on a date card: every five right answers brings harder deadlines, never a faster run.',
    controls: '↑/↓ or W/S change lane · Space jumps · tap a lane or swipe on touch · P pauses',
    icon: '⏱️',
    accent: A.C.green,
    drills: 'Protest, claim and notice deadlines',
    dataOk: function (D) { return clockCards(D).length >= 6; },

    create: function (api) {
      var C = api.C, W = api.W, H = api.H;

      // ---- layout ----------------------------------------------------------
      var HEAD_Y = 27;                         // level and card-count row above the question card
      var CARD = { x: 24, y: 54, w: W - 48, h: 126 };
      var TRACK_TOP = 186, TRACK_BOT = 468;
      var LANE_Y = [233, 327, 421];            // lane centres
      var RAIL = 36;                           // rail sits this far below the lane centre
      var RUN_X = 210;                         // where the officer runs / the gate line
      var SPAWN_X = W + 40;
      var STRIP = { x: 24, y: 476, w: W - 48, h: 52 };
      var JUMPBTN = { x: 800, y: 482, w: 134, h: 40 };
      var HORIZON = 300;

      // ---- question levels (shell-owned) -----------------------------------
      api.progress.configure({ perLevel: PER_LEVEL });
      function levelNow() { return api.clamp(Math.round(Number(api.progress.level)) || 1, 1, 3); }
      function levelName(n) { var names = api.progress.names; return (names && names[n - 1]) || LEVEL_NAMES[n - 1]; }
      function correctToNext() {
        var lvl = levelNow(), max = api.clamp(Math.round(Number(api.progress.maxLevel)) || 3, 1, 3);
        if (lvl >= max) return 0;
        var per = Number(api.progress.perLevel) || PER_LEVEL, since = Number(api.progress.sinceUp) || 0;
        return Math.max(1, per - since);
      }

      // ---- round state -----------------------------------------------------
      var cards = clockCards(api.data), warrantId = (api.warrant && api.warrant.id) || 'all';
      var pool = cards.concat(makeDateCards(cards, function (c) { return typeof A.classFit !== 'function' || A.classFit(c, warrantId) !== 'none'; }));                                  // api.progress.pick serves these by difficulty
      var cap = Math.min(ROUND_CARDS, Math.max(MIN_CARDS, pool.length));
      var dayPool = (function () {
        var seen = {}, out = [], i, v;
        for (i = 0; i < pool.length; i++) { v = pool[i].days; if (!seen[v]) { seen[v] = 1; out.push(v); } }
        return out;
      })();

      var LIVES = (api.difficulty && api.difficulty.lives) || 3;   // lives come from the chosen difficulty
      var st = {
        served: 0, card: null, gate: null,
        lane: 1, laneY: LANE_Y[1], tilt: 0,
        speed: BASE_SPEED, combo: 1, correct: 0, answered: 0, lives: LIVES,
        phase: 0,
        jumpT: -1, jumpDur: 0.62, yOff: 0,
        stumble: 0, over: false,
        hurdles: [], hurdleTimer: 2.6,
        feedback: null, feedbackT: 0,
        cite: '', hintT: 3.4, levelFx: 0,
        swipe: 0, downY: 0
      };

      api.hud.set({ lives: LIVES, maxLives: LIVES, combo: 1, level: levelNow(), time: null, progress: 0 });

      // ---- parallax layers -------------------------------------------------
      var off = { sky: 0, cal: 0, flag: 0, track: 0 };
      function rightMost(list) { var m = -1e9, i; for (i = 0; i < list.length; i++) if (list[i].x > m) m = list[i].x; return m; }

      var skyline = [], calendars = [], flags = [], i0;
      for (i0 = 0; i0 < 16; i0++) skyline.push(makeBuilding(i0 * 78 + api.rand(-12, 12)));
      for (i0 = 0; i0 < 6; i0++) calendars.push(makePage(i0 * 210 + api.rand(-40, 40)));
      for (i0 = 0; i0 < 9; i0++) flags.push(makeFlag(i0 * 150 + api.rand(-30, 30)));

      function makeBuilding(x) { return { x: x, w: api.rand(40, 74), h: api.rand(42, 104), kind: api.randInt(0, 3), win: api.randInt(2, 4) }; }
      function makePage(x) { return { x: x, y: api.rand(196, 248), w: 46, h: 54, rot: api.rand(-0.16, 0.16), bob: api.rand(0, 6.283) }; }
      function makeFlag(x) { return { x: x, h: api.rand(30, 48), hue: api.pick([C.gold, C.teal, C.sky, C.orange]) }; }

      function scroll(list, dx, make, gapMin, gapMax) {
        var i, b;
        for (i = 0; i < list.length; i++) {
          b = list[i]; b.x -= dx;
          if (b.x + (b.w || 30) < -40) { var nb = make(rightMost(list) + api.rand(gapMin, gapMax)); list[i] = nb; }
        }
      }

      // ---- helpers ---------------------------------------------------------
      function clampLines(ctx, str, size, weight, maxW, maxLines, fam) {
        ctx.save();
        ctx.font = api.font(size, fam || 'body', weight);
        var ls = api.wrap(ctx, str || '', maxW);
        ctx.restore();
        if (ls.length > maxLines) { ls = ls.slice(0, maxLines); ls[maxLines - 1] = ls[maxLines - 1] + ' …'; }
        return ls;
      }
      function fitMono(ctx, str, maxW, size, min) {      // largest mono size from size down to min that fits maxW
        ctx.save();
        for (; size > min; size--) { ctx.font = api.font(size, 'mono', 700); if (ctx.measureText(str).width <= maxW) break; }
        ctx.restore();
        return size;
      }
      function setLane(n) {
        n = api.clamp(Math.round(n), 0, 2);
        if (n === st.lane) return;
        st.lane = n; api.audio.blip();
      }
      function jump() {
        if (st.jumpT >= 0 || st.over) return;
        st.jumpT = 0; api.audio.whoosh();
      }

      // ---- question plumbing ----------------------------------------------
      // Harder levels bring closer day counts to the gates; the time to decide never shrinks.
      // Date cards pass prefer: inside the same level band, day counts whose date is a business day come first,
      // so a weekend date on a wrong gate never gives the answer away.
      function distractors(correct, level, prefer) {
        var cand = [], i, v;
        function add(x) { if (x > 0 && x !== correct && cand.indexOf(x) < 0) cand.push(x); }
        for (i = 0; i < dayPool.length; i++) add(dayPool[i]);
        for (i = 0; i < FALLBACK_DAYS.length; i++) add(FALLBACK_DAYS[i]);
        cand.sort(function (a, b) { return closeness(a, correct) - closeness(b, correct); });
        var band = level >= 3 ? cand.slice(0, 3)       // hard: the nearest day counts
          : level === 2 ? cand.slice(0, 6)             // medium: near neighbours
          : cand.slice(3, 9);                          // easy: skip the three nearest so the gates look different
        var picked = prefer ? api.shuffle(band.filter(prefer)).slice(0, 2) : [];
        var mixed = api.shuffle(band);
        for (i = 0; i < mixed.length && picked.length < 2; i++) if (picked.indexOf(mixed[i]) < 0) picked.push(mixed[i]);
        for (i = 0; i < cand.length && picked.length < 2; i++) if (picked.indexOf(cand[i]) < 0) picked.push(cand[i]);
        var bump = 5;
        while (picked.length < 2) { v = correct + bump; if (picked.indexOf(v) < 0) picked.push(v); bump += 5; }
        return picked;
      }

      function nextCard() {
        var card = pool.length ? api.progress.pick(pool) : null;   // a card matched to the current question level
        if (!card) { finish('cap'); return; }
        var lvl = levelNow();
        var d = distractors(card.days, lvl, card.gen ? function (v) { return isBusinessDay(card.start + v); } : null);
        var lane = api.randInt(0, 2);
        var opts = [];
        opts[lane] = card.days;
        var fill = 0, i;
        for (i = 0; i < 3; i++) if (i !== lane) { opts[i] = d[fill]; fill++; }
        st.served++;
        st.card = card;
        st.gate = { x: SPAWN_X, opts: opts, correctLane: lane, resolved: false, chosenLane: -1, t: 0, level: lvl };
        if (api.ready) api.ready(card.gen ? card.event + ' ' + dueQuestion(card) : (card.event || '') + ' ' + (card.anchor || ''));   // reading pause on easier difficulties
      }

      function resolve() {
        var g = st.gate, card = st.card;
        if (!g || !card || g.resolved) return;
        var chosen = g.opts[st.lane];
        var ok = chosen === card.days;
        var word = dayWord(card);
        g.resolved = true; g.chosenLane = st.lane;
        st.answered++;
        st.cite = card.cite;

        if (card.gen) {
          api.review.add({
            prompt: card.event + ' · ' + startLine(card),
            correct: shortDate(card.due) + ' (' + countWord(card.days) + ')',
            given: shortDate(card.start + chosen) + ' (' + countWord(chosen) + ')',
            ok: ok,
            explanation: (card.rule ? card.rule + ' ' : '') + 'Arithmetic: ' + longDate(card.start) + ' + ' + countWord(card.days) + ' = ' + longDate(card.due) + ', a weekday that is not a federal holiday.',
            cite: card.cite
          });
        } else {
          api.review.add({
            prompt: card.event,
            correct: card.days + ' ' + word + (card.anchor ? ' ' + card.anchor : ''),
            given: chosen + ' ' + word,
            ok: ok,
            explanation: card.rule,
            cite: card.cite
          });
        }

        var gy = LANE_Y[st.lane];
        if (ok) {
          st.correct++;
          api.score(120 * st.combo);
          st.combo = Math.min(9, st.combo + 1);
          api.audio.correct();
          api.particles.emit({ x: g.x, y: gy, n: 34, color: [C.green, C.gold2, C.white], speed: 330, life: .8, size: 6, gravity: 120, shape: 'spark' });
          api.particles.emit({ x: RUN_X + 24, y: gy, n: 14, color: [C.green, C.teal], speed: 180, life: .6, size: 5, gravity: 40 });
          api.hud.set({ combo: st.combo, banner: 'Correct · ' + (card.gen ? shortDate(card.due) : card.days + ' ' + word), bannerTime: 1.0 });
          st.feedback = { ok: true, card: card, chosen: chosen }; st.feedbackT = 1.5;
          // after our banner, so the shell's level-up banner wins; a level-up changes the questions, not the pace
          if (api.progress.correct()) {
            st.levelFx = 1.8;
            api.particles.emit({ x: CARD.x + 130, y: HEAD_Y, n: 40, color: [LEVEL_COLORS[levelNow() - 1], C.gold2, C.white], speed: 260, life: .9, size: 6, gravity: 60, shape: 'spark' });
          }
          api.hud.set({ level: levelNow() });
        } else {
          st.combo = 1;
          st.stumble = 0.85;
          api.audio.wrong();
          api.shake(14);
          api.flash('rgba(255,107,107,.28)');
          api.particles.emit({ x: RUN_X + 10, y: gy, n: 22, color: [C.red, C.orange], speed: 250, life: .7, size: 5, gravity: 320 });
          api.hud.set({ combo: 1, banner: card.gen ? shortDate(card.due) + ' · ' + countWord(card.days) : card.days + ' ' + word, sub: card.rule, bannerTime: 2.0 });
          st.feedback = { ok: false, card: card, chosen: chosen }; st.feedbackT = 2.1;
          var left = api.life(-1);
          st.lives = left;
          if (left <= 0) st.over = true;
        }
        api.hud.set({ progress: st.answered / Math.max(1, cap) });
      }

      function finish(reason) {
        if (st.over) return;
        st.over = true;
        var lvl = levelNow();
        var msg = 'You cleared ' + st.correct + ' of ' + st.answered + ' gates and reached level ' + lvl + ' (' + levelName(lvl).toLowerCase() + ').';
        var clean = st.answered > 0 && st.correct === st.answered;
        api.end({ won: reason === 'cap' && st.correct > 0, title: clean ? 'Clean timeline run' : 'Timeline run complete', message: msg });
      }

      // ---- hurdles ---------------------------------------------------------
      function spawnHurdle() {
        var gx = st.gate ? st.gate.x : -9999;
        if (Math.abs(gx - SPAWN_X) < 240) return;            // never on top of a gate
        st.hurdles.push({ x: SPAWN_X, lane: api.randInt(0, 2), hit: false });
      }

      // ---- update ----------------------------------------------------------
      function update(dt) {
        if (st.over) return;

        if (st.hintT > 0) st.hintT -= dt;
        if (st.levelFx > 0) st.levelFx = Math.max(0, st.levelFx - dt);
        st.phase += dt * (st.speed / 18);
        var dx = st.speed * dt;                              // constant pace: no ramp per answer or level
        off.track += dx;
        scroll(skyline, dx * 0.14, makeBuilding, 46, 96);
        scroll(calendars, dx * 0.42, makePage, 170, 280);
        scroll(flags, dx * 0.72, makeFlag, 110, 200);

        // runner
        var ly = LANE_Y[st.lane];
        st.laneY += (ly - st.laneY) * Math.min(1, dt * 13);
        st.tilt = api.clamp((ly - st.laneY) * -0.004, -0.22, 0.22);
        if (st.jumpT >= 0) {
          st.jumpT += dt;
          if (st.jumpT >= st.jumpDur) { st.jumpT = -1; st.yOff = 0; }
          else st.yOff = -Math.sin(Math.PI * (st.jumpT / st.jumpDur)) * 82;
        } else st.yOff = 0;
        if (st.stumble > 0) st.stumble = Math.max(0, st.stumble - dt);

        // feedback timer
        if (st.feedbackT > 0) st.feedbackT -= dt;

        // gate
        if (st.gate) {
          var g = st.gate;
          g.x -= dx; g.t += dt;
          if (!g.resolved && g.x <= RUN_X) resolve();
          if (st.over) return;
          if (g.resolved && g.x < -130 && st.feedbackT <= 0) { st.gate = null; st.card = null; st.feedback = null; }
        } else if (st.answered >= cap) {
          finish('cap');
          return;
        } else {
          nextCard();
          if (st.over) return;
        }

        // hurdles (same spacing at every level)
        st.hurdleTimer -= dt;
        if (st.hurdleTimer <= 0) { spawnHurdle(); st.hurdleTimer = api.rand(HURDLE_GAP[0], HURDLE_GAP[1]); }
        for (var i = st.hurdles.length - 1; i >= 0; i--) {
          var hd = st.hurdles[i];
          hd.x -= dx;
          if (!hd.hit && hd.lane === st.lane && Math.abs(hd.x - RUN_X) < 22 && st.yOff > -34) {
            hd.hit = true;
            st.combo = 1; st.stumble = 0.7;
            api.score(-20);
            api.audio.boom(); api.shake(9);
            api.particles.emit({ x: hd.x, y: LANE_Y[hd.lane] + 20, n: 16, color: [C.orange, C.gold], speed: 240, life: .6, size: 5 });
            api.hud.set({ combo: 1, banner: 'Tripped', sub: 'Space jumps the hurdles', bannerTime: .9 });
          }
          if (hd.x < -70) st.hurdles.splice(i, 1);
        }
      }

      // ================= drawing ============================================
      function drawSky(ctx) {
        var g = ctx.createLinearGradient(0, TRACK_TOP, 0, TRACK_BOT);
        g.addColorStop(0, '#0b142a');
        g.addColorStop(0.55, '#0a1020');
        g.addColorStop(1, '#070b16');
        ctx.fillStyle = g;
        ctx.fillRect(0, TRACK_TOP, W, TRACK_BOT - TRACK_TOP);
        // low sun behind the skyline
        var sg = ctx.createRadialGradient(720, HORIZON - 30, 6, 720, HORIZON - 30, 170);
        sg.addColorStop(0, 'rgba(95,211,154,.18)');
        sg.addColorStop(1, 'rgba(95,211,154,0)');
        ctx.fillStyle = sg; ctx.fillRect(520, TRACK_TOP, 400, HORIZON - TRACK_TOP + 40);
      }

      function drawSkyline(ctx) {
        ctx.save();
        ctx.globalAlpha = .45; ctx.fillStyle = '#18233f';
        for (var i = 0; i < skyline.length; i++) {
          var b = skyline[i], x = b.x, top = HORIZON - b.h;
          ctx.fillRect(x, top, b.w, b.h);
          if (b.kind === 0) {                       // pediment + columns
            ctx.beginPath(); ctx.moveTo(x - 4, top); ctx.lineTo(x + b.w / 2, top - 12); ctx.lineTo(x + b.w + 4, top); ctx.closePath(); ctx.fill();
          } else if (b.kind === 1) {                // dome
            ctx.beginPath(); ctx.arc(x + b.w / 2, top, b.w * .32, Math.PI, 0); ctx.fill();
            ctx.fillRect(x + b.w / 2 - 2, top - b.w * .32 - 10, 4, 12);
          } else if (b.kind === 2) {                // antenna
            ctx.fillRect(x + b.w / 2 - 1.5, top - 16, 3, 16);
          }
          ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = '#2b3a63';
          for (var r = 0; r < Math.floor(b.h / 16); r++) for (var c2 = 0; c2 < b.win; c2++) {
            if (((r * 7 + c2 * 3 + i) % 5) === 0) continue;
            ctx.fillRect(x + 6 + c2 * ((b.w - 10) / b.win), top + 8 + r * 16, 5, 6);
          }
          ctx.restore();
        }
        ctx.restore();
      }

      function drawCalendars(ctx) {
        ctx.save();
        for (var i = 0; i < calendars.length; i++) {
          var p = calendars[i];
          ctx.save();
          ctx.globalAlpha = .5;
          ctx.translate(p.x + p.w / 2, p.y + Math.sin(off.track / 90 + p.bob) * 5);
          ctx.rotate(p.rot);
          api.roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 6);
          ctx.fillStyle = '#131d33'; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.5; ctx.stroke();
          api.roundRect(ctx, -p.w / 2, -p.h / 2, p.w, 13, 6);
          ctx.fillStyle = 'rgba(255,107,107,.65)'; ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.30)';
          for (var r = 0; r < 3; r++) for (var c2 = 0; c2 < 4; c2++) ctx.fillRect(-p.w / 2 + 7 + c2 * 9, -p.h / 2 + 21 + r * 9, 5, 5);
          ctx.restore();
        }
        ctx.restore();
      }

      function drawFlags(ctx) {
        ctx.save();
        ctx.globalAlpha = .7;
        for (var i = 0; i < flags.length; i++) {
          var f = flags[i], base = HORIZON + 34;
          ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(f.x, base); ctx.lineTo(f.x, base - f.h); ctx.stroke();
          var w = 20 + Math.sin(off.track / 60 + f.x / 90) * 4;
          ctx.fillStyle = f.hue;
          ctx.beginPath(); ctx.moveTo(f.x, base - f.h); ctx.lineTo(f.x + w, base - f.h + 6); ctx.lineTo(f.x, base - f.h + 13); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }

      function drawLanes(ctx) {
        var i;
        for (i = 0; i < 3; i++) {
          var ly = LANE_Y[i], top = ly - 44, h = 84, on = (i === st.lane);
          api.roundRect(ctx, 8, top, W - 16, h, 14);
          ctx.fillStyle = on ? 'rgba(95,211,154,.09)' : 'rgba(255,255,255,.025)';
          ctx.fill();
          ctx.strokeStyle = on ? 'rgba(95,211,154,.35)' : 'rgba(255,255,255,.08)';
          ctx.lineWidth = on ? 2 : 1;
          ctx.stroke();

          // rail + day ticks
          var rail = ly + RAIL;
          ctx.strokeStyle = on ? 'rgba(95,211,154,.75)' : 'rgba(255,255,255,.22)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(10, rail); ctx.lineTo(W - 10, rail); ctx.stroke();
          var step = 48, o = off.track % step, n0 = Math.floor(off.track / step);
          ctx.strokeStyle = on ? 'rgba(95,211,154,.5)' : 'rgba(255,255,255,.16)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (var x = -step; x < W + step; x += step) {
            var xx = x - o, big = ((Math.round((x + n0 * step) / step)) % 5) === 0;
            ctx.moveTo(xx, rail); ctx.lineTo(xx, rail - (big ? 11 : 5));
          }
          ctx.stroke();
        }
      }

      function drawHurdles(ctx) {
        for (var i = 0; i < st.hurdles.length; i++) {
          var hd = st.hurdles[i], rail = LANE_Y[hd.lane] + RAIL, x = hd.x;
          ctx.save();
          if (hd.hit) ctx.globalAlpha = .35;
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x - 11, rail); ctx.lineTo(x - 5, rail - 26); ctx.moveTo(x + 11, rail); ctx.lineTo(x + 5, rail - 26); ctx.stroke();
          api.glow(ctx, C.orange, 12);
          api.roundRect(ctx, x - 18, rail - 32, 36, 11, 4);
          ctx.fillStyle = C.orange; ctx.fill();
          api.noGlow(ctx);
          ctx.fillStyle = 'rgba(0,0,0,.5)';
          for (var s = -16; s < 14; s += 9) ctx.fillRect(x + s, rail - 31, 3.5, 9);
          ctx.restore();
        }
      }

      function drawGate(ctx) {
        var g = st.gate, card = st.card;
        if (!g || !card) return;
        for (var i = 0; i < 3; i++) {
          var ly = LANE_Y[i], x = g.x, v = g.opts[i];
          var pw = card.gen ? DATE_PLATE_W : 72, half = pw / 2;   // date gates get a wider plate so the date fits at 16 px or more
          var mode = 'live';
          if (g.resolved) mode = (i === g.correctLane) ? 'good' : (i === g.chosenLane ? 'bad' : 'dim');
          var col = mode === 'good' ? C.green : mode === 'bad' ? C.red : mode === 'dim' ? C.muted : (i === st.lane ? C.gold2 : C.sky);
          var alpha = mode === 'dim' ? .35 : 1;
          ctx.save();
          ctx.globalAlpha = alpha;

          // opening glow
          var og = ctx.createLinearGradient(x - half - 4, 0, x + half + 4, 0);
          og.addColorStop(0, 'rgba(255,255,255,0)');
          og.addColorStop(.5, mode === 'good' ? 'rgba(95,211,154,.20)' : mode === 'bad' ? 'rgba(255,107,107,.18)' : 'rgba(143,198,255,.10)');
          og.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = og; ctx.fillRect(x - half - 8, ly - 44, pw + 16, 84);

          // posts
          api.glow(ctx, col, 16);
          ctx.fillStyle = col;
          ctx.fillRect(x - half - 8, ly - 46, 7, 82);
          ctx.fillRect(x + half + 1, ly - 46, 7, 82);
          api.roundRect(ctx, x - half - 10, ly - 52, pw + 20, 9, 4); ctx.fill();
          api.noGlow(ctx);

          // number plate
          api.roundRect(ctx, x - half, ly - 34, pw, 50, 10);
          ctx.fillStyle = 'rgba(6,10,20,.82)'; ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
          if (card.gen) {                              // date card: "Fri 13 Mar" over the year
            var label = gateDate(card.start + v);
            api.text(ctx, label, x, ly - 6, { size: fitMono(ctx, label, pw - 14, 20, 16), fam: 'mono', weight: 700, align: 'center', baseline: 'middle', color: mode === 'dim' ? C.ink2 : C.ink });
            api.text(ctx, String(dayParts(card.start + v).y), x, ly + 22, { size: 16, fam: 'body', weight: 700, align: 'center', baseline: 'middle', color: col, alpha: .95 });
          } else {
            api.text(ctx, String(v), x, ly - 6, { size: 30, fam: 'mono', weight: 700, align: 'center', baseline: 'middle', color: mode === 'dim' ? C.ink2 : C.ink });
            api.text(ctx, 'days', x, ly + 22, { size: 16, fam: 'body', weight: 700, align: 'center', baseline: 'middle', color: col, alpha: .95 });
          }
          ctx.restore();
        }
      }

      function drawRunner(ctx) {
        var rail = st.laneY + RAIL, jf = st.yOff < 0 ? Math.min(1, -st.yOff / 82) : 0;
        ctx.save();
        // shadow
        ctx.globalAlpha = .32 - jf * .18;
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(RUN_X, rail + 3, 21 - jf * 7, 5 - jf * 1.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;

        // speed lines
        ctx.strokeStyle = 'rgba(143,198,255,.25)'; ctx.lineWidth = 2;
        for (var s = 0; s < 3; s++) {
          var sy = rail - 20 - s * 16, len = 18 + ((off.track * 2 + s * 37) % 30);
          ctx.beginPath(); ctx.moveTo(RUN_X - 34 - len, sy); ctx.lineTo(RUN_X - 34, sy); ctx.stroke();
        }

        ctx.translate(RUN_X, rail + st.yOff);
        var lean = 0.10 + st.tilt;
        if (st.stumble > 0) lean += 0.42 * (st.stumble / 0.85) + Math.sin(st.stumble * 46) * 0.07;
        ctx.rotate(lean);

        var p = st.phase, tuck = jf > 0.1 || st.stumble > 0;
        api.glow(ctx, C.green, 14);
        ctx.strokeStyle = '#e9eef8'; ctx.fillStyle = '#e9eef8';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';

        // legs
        ctx.lineWidth = 7;
        drawLeg(ctx, tuck ? 1.15 : p, tuck);
        drawLeg(ctx, tuck ? -1.35 : p + Math.PI, tuck);

        // torso
        ctx.save();
        ctx.translate(1, -52); ctx.rotate(0.1);
        api.roundRect(ctx, -9, -14, 18, 29, 8); ctx.fill();
        ctx.restore();

        // head
        ctx.beginPath(); ctx.arc(6, -74, 8.5, 0, Math.PI * 2); ctx.fill();

        // back arm
        ctx.lineWidth = 6;
        var ba = tuck ? -2.0 : p + Math.PI;
        ctx.beginPath(); ctx.moveTo(0, -64); ctx.quadraticCurveTo(Math.sin(ba) * 9 - 4, -54, Math.sin(ba) * 17 - 4, -44 + Math.cos(ba) * 4); ctx.stroke();

        // front arm + briefcase
        var fa = tuck ? 1.5 : p;
        var hx = Math.sin(fa) * 13 + 7, hy = -46 + Math.abs(Math.cos(fa)) * 4;
        ctx.beginPath(); ctx.moveTo(2, -64); ctx.quadraticCurveTo(hx * .7 + 5, -56, hx, hy); ctx.stroke();
        api.noGlow(ctx);
        ctx.save();
        ctx.translate(hx, hy); ctx.rotate(st.stumble > 0 ? st.stumble * 3.4 : Math.sin(p) * 0.12);
        ctx.strokeStyle = C.gold2; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 3, 5, Math.PI, 0); ctx.stroke();
        api.roundRect(ctx, -12, 4, 24, 16, 3);
        ctx.fillStyle = C.gold; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-12, 10, 24, 2.5);
        ctx.restore();
        ctx.restore();
      }
      function drawLeg(ctx, ph, tuck) {
        var fx = Math.sin(ph) * 17, lift = Math.max(0, Math.cos(ph));
        var fy = tuck ? -14 - lift * 4 : -lift * 10;
        var kx = fx * 0.5 + 3 + lift * 4, ky = -21 - (tuck ? 6 : 0);
        ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
      }

      // level (from api.progress.level), steps to the next level, and the card count
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
          ctx.beginPath(); ctx.arc(px + i * 18, HEAD_Y, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = i < lvl ? LEVEL_COLORS[i] : 'rgba(255,255,255,.14)'; ctx.fill();
        }
        var need = correctToNext();
        var note = need > 0 ? need + ' more correct for level ' + (lvl + 1) : 'Top level · the hardest clocks';
        api.text(ctx, note, px + 3 * 18 + 8, HEAD_Y + 1, { size: 16, weight: 600, color: C.ink2, baseline: 'middle' });

        var label = 'CARD ' + api.clamp(st.served, 1, cap) + ' / ' + cap;
        ctx.save(); ctx.font = api.font(16, 'mono', 600); var cw = ctx.measureText(label).width + 22; ctx.restore();
        api.pill(ctx, label, CARD.x + CARD.w - cw, HEAD_Y,
          { size: 16, fam: 'mono', bg: 'rgba(95,211,154,.14)', stroke: 'rgba(95,211,154,.45)', color: C.ink });
      }

      // Phone text size only: the whole 960x540 canvas is scaled down to fit a narrow screen, so a logical font size
      // that reads fine on desktop can render unreadably small in real screen pixels on a phone. Grow the card's own
      // text on a narrow canvas; the numbers are chosen so the worst case (a two-line event above a two-line
      // question) still stays inside the fixed card box. CARD.x/y/w/h and the track below are untouched.
      function narrowCanvas(ctx) {
        var w = W;
        try { w = ctx.canvas.getBoundingClientRect().width || W; } catch (e) {}
        return w > 0 && w < 560;
      }
      function cardTextSizes(ctx) {
        return narrowCanvas(ctx)
          ? { e: 26, eLH: 30, q: 23, qLH: 27, head: 26, headLH: 31, rule: 22, ruleLH: 29, top: 24, gap: 6 }
          : { e: 19, eLH: 22, q: 17, qLH: 20, head: 19, headLH: 23, rule: 16, ruleLH: 21, top: 34, gap: 8 };
      }

      function drawCard(ctx) {
        api.roundRect(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 16);
        ctx.fillStyle = 'rgba(10,16,30,.88)'; ctx.fill();
        ctx.strokeStyle = st.feedback ? (st.feedback.ok ? 'rgba(95,211,154,.55)' : 'rgba(255,107,107,.55)') : 'rgba(255,255,255,.14)';
        ctx.lineWidth = 1.5; ctx.stroke();

        // accent stripe
        ctx.save();
        api.roundRect(ctx, CARD.x, CARD.y, 6, CARD.h, 3);
        ctx.fillStyle = st.feedback ? (st.feedback.ok ? C.green : C.red) : C.green; ctx.fill();
        ctx.restore();

        var tx = CARD.x + 22, i, ls, sz = cardTextSizes(ctx);

        if (st.feedback) {
          var f = st.feedback, word = dayWord(f.card);
          var head = clampLines(ctx, (f.ok ? '✓ ' : '✕ ') + (f.card.gen ? shortDate(f.card.due) + ' · ' + countWord(f.card.days) : f.card.days + ' ' + word) + (f.card.anchor ? ' ' + f.card.anchor : ''),
            sz.head, 700, f.ok ? CARD.w - 60 : CARD.w - 330, 2);
          for (i = 0; i < head.length; i++) api.text(ctx, head[i], tx, CARD.y + sz.top + i * sz.headLH, { size: sz.head, weight: 700, color: f.ok ? C.green : C.red });
          var ry = CARD.y + sz.top + head.length * sz.headLH + sz.gap;
          var room = Math.max(1, Math.floor((CARD.y + CARD.h - 8 - ry) / sz.ruleLH) + 1);
          ls = clampLines(ctx, f.card.rule, sz.rule, 500, CARD.w - 60, room);
          for (i = 0; i < ls.length; i++) api.text(ctx, ls[i], tx, ry + i * sz.ruleLH, { size: sz.rule, weight: 500, color: C.ink2 });
          if (!f.ok) api.text(ctx, f.card.gen ? 'You ran the ' + gateDate(f.card.start + f.chosen) + ' gate' : 'You ran the ' + f.chosen + '-day gate', CARD.x + CARD.w - 22, CARD.y + sz.top, { size: sz.rule, align: 'right', color: C.red, alpha: .9 });
          return;
        }

        if (!st.card) return;
        var card = st.card;
        ls = clampLines(ctx, card.event, sz.e, 700, CARD.w - 60, 2);
        for (i = 0; i < ls.length; i++) api.text(ctx, ls[i], tx, CARD.y + sz.top + i * sz.eLH, { size: sz.e, weight: 700, color: C.ink });

        var qy = CARD.y + sz.top + ls.length * sz.eLH + sz.gap;
        var q = card.gen ? dueQuestion(card) : '___ ' + dayWord(card) + (card.anchor ? ' ' + card.anchor : '');
        ls = clampLines(ctx, q, sz.q, 500, CARD.w - 60, 2);
        for (i = 0; i < ls.length; i++) api.text(ctx, ls[i], tx, qy + i * sz.qLH, { size: sz.q, weight: 500, color: C.gold2 });

        // decision meter (same length at every level)
        if (st.gate && !st.gate.resolved) {
          var frac = api.clamp((st.gate.x - RUN_X) / (SPAWN_X - RUN_X), 0, 1);
          var bw = (CARD.w - 44) * frac;
          api.roundRect(ctx, CARD.x + 22, CARD.y + CARD.h - 11, CARD.w - 44, 5, 3);
          ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fill();
          api.roundRect(ctx, CARD.x + 22, CARD.y + CARD.h - 11, Math.max(3, bw), 5, 3);
          ctx.fillStyle = frac > .55 ? C.green : frac > .28 ? C.gold : C.red; ctx.fill();
        }
      }

      function drawStrip(ctx) {
        api.roundRect(ctx, STRIP.x, STRIP.y, STRIP.w, STRIP.h, 12);
        ctx.fillStyle = 'rgba(10,16,30,.82)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.2; ctx.stroke();
        var label = st.cite ? 'Cite · ' + st.cite : 'Cite · appears after each gate';
        var ls = clampLines(ctx, label, 16, 600, STRIP.w - 200, 1, 'mono');
        api.text(ctx, ls[0], STRIP.x + 18, STRIP.y + 32, { size: 16, fam: 'mono', weight: 600, color: st.cite ? C.ink2 : C.muted });

        // jump button
        api.roundRect(ctx, JUMPBTN.x, JUMPBTN.y, JUMPBTN.w, JUMPBTN.h, 10);
        ctx.fillStyle = st.jumpT >= 0 ? 'rgba(95,211,154,.30)' : 'rgba(255,255,255,.07)'; ctx.fill();
        ctx.strokeStyle = 'rgba(95,211,154,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
        api.text(ctx, '▲ JUMP', JUMPBTN.x + JUMPBTN.w / 2, JUMPBTN.y + JUMPBTN.h / 2, { size: 16, align: 'center', baseline: 'middle', color: C.ink });
      }

      function drawHint(ctx) {
        if (st.hintT <= 0) return;
        var a = Math.min(1, st.hintT / 0.9);
        ctx.save(); ctx.globalAlpha = a;
        api.pill(ctx, '↑ ↓ or W / S change lane · Space jumps · tap a lane or swipe', W / 2, TRACK_BOT - 16,
          { size: 17, fam: 'body', align: 'center', bg: 'rgba(6,10,20,.8)', stroke: 'rgba(255,255,255,.2)', color: C.ink });
        ctx.restore();
      }

      function draw(ctx) {
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
        drawSky(ctx);
        drawSkyline(ctx);
        drawCalendars(ctx);
        drawFlags(ctx);
        drawLanes(ctx);
        drawHurdles(ctx);
        drawGate(ctx);
        drawRunner(ctx);
        drawHeader(ctx);
        drawCard(ctx);
        drawStrip(ctx);
        drawHint(ctx);
      }

      // ---- input -----------------------------------------------------------
      function onKey(k, down) {
        if (!down || st.over) return;
        if (k === 'ArrowUp' || k === 'w' || k === 'W') setLane(st.lane - 1);
        else if (k === 'ArrowDown' || k === 's' || k === 'S') setLane(st.lane + 1);
        else if (k === ' ' || k === 'Spacebar' || k === 'Enter' || k === 'ArrowRight') jump();
        else if (k === '1' || k === '2' || k === '3') setLane(Number(k) - 1);
      }

      function onPointer(p) {
        if (!p || st.over) return;
        if (p.type === 'down') {
          st.swipe = 0; st.downY = p.y;
          if (p.x >= JUMPBTN.x && p.x <= JUMPBTN.x + JUMPBTN.w && p.y >= JUMPBTN.y - 8 && p.y <= JUMPBTN.y + JUMPBTN.h + 8) { jump(); return; }
          if (p.y >= TRACK_TOP && p.y <= TRACK_BOT) setLane(Math.floor((p.y - TRACK_TOP) / ((TRACK_BOT - TRACK_TOP) / 3)));
          else if (p.y > TRACK_BOT) jump();
        } else if (p.type === 'move' && api.input.pointer.down) {
          st.swipe += p.dy || 0;
          if (st.swipe > 42) { setLane(st.lane + 1); st.swipe = 0; }
          else if (st.swipe < -42) { setLane(st.lane - 1); st.swipe = 0; }
        }
      }

      return {
        update: update,
        draw: draw,
        onKey: onKey,
        onPointer: onPointer,
        destroy: function () { st.hurdles.length = 0; st.gate = null; st.card = null; st.feedback = null; pool = []; dayPool = []; skyline.length = 0; calendars.length = 0; flags.length = 0; }
      };
    }
  });
})();
