/* GAME: fiscal-asteroids — read the statement, shoot the rock labeled with the fiscal rule it breaks */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var BUCKETS = [
    { bucket: 'Purpose', label: 'PURPOSE', key: 'purpose', color: A.C.gold },
    { bucket: 'Time', label: 'TIME', key: 'time', color: A.C.sky },
    { bucket: 'Amount', label: 'AMOUNT', key: 'amount', color: A.C.purple },
    { bucket: 'No violation', label: 'NO VIOLATION', key: 'no violation', color: A.C.green }
  ];

  function keyOf(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
  function bucketOf(s) {
    var k = keyOf(s), i;
    for (i = 0; i < BUCKETS.length; i++) if (BUCKETS[i].key === k) return BUCKETS[i];
    if (k.indexOf('no ') === 0 || k.indexOf('none') === 0 || k.indexOf('clean') === 0) return BUCKETS[3];
    for (i = 0; i < 3; i++) if (k.indexOf(BUCKETS[i].key) >= 0) return BUCKETS[i];
    return null;
  }
  function tidy(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  // One statement in the shape the game plays. It keeps each item's warrant classes, difficulty, gen flag and flags, so
  // api.progress.pick can filter by the player's warrant class and never remembers generated statements across runs.
  function normItem(it) {
    if (!it || typeof it !== 'object') return null;
    var statement = tidy(it.statement), b = bucketOf(it.bucket);
    if (!statement || !b) return null;
    var out = { statement: statement, bucket: b.bucket, explanation: String(it.explanation == null ? '' : it.explanation), cite: String(it.cite == null ? '' : it.cite) };
    if (it.id != null && it.id !== '') out.id = String(it.id);
    var d = Number(it.difficulty != null ? it.difficulty : it.level);
    if (d >= 1 && d <= 3) out.difficulty = Math.round(d);
    var cls = typeof A.itemClasses === 'function' ? A.itemClasses(it) : (Array.isArray(it.classes) ? it.classes.slice() : []);
    if (cls.length) out.classes = cls;
    if (it.gen || it.generated) out.gen = true;
    if (Array.isArray(it.flags) && it.flags.length) out.flags = it.flags.slice();
    return out;
  }
  function itemsFrom(D) {
    var raw = ((D || {}).games || {}).fiscal_sort;
    var out = [];
    if (!Array.isArray(raw)) return out;
    for (var i = 0; i < raw.length; i++) {
      var it = normItem(raw[i]);
      if (it) out.push(it);
    }
    return out;
  }

  // ---- generated statements: new dates and dollar figures every run ----
  // Up to GEN_PER_RUN statements join each run's pool. Each template's bucket follows mechanically from the facts it writes:
  //   severable  10 U.S.C. 3133: severable services that start in the current fiscal year may run into the next on that
  //              year's money if the period is one year or less; past one year, the later months are later-year needs
  //              (31 U.S.C. 1502(a)), so the statement is a Time violation.
  //   allotment  31 U.S.C. 1517(a): obligations above a formal allotment are an Antideficiency Act (Amount) violation; at or
  //              within the allotment, with nothing else wrong in the facts, there is no violation.
  //   stored     31 U.S.C. 1502(a): supplies bought with this year's money and stored for an event in the next fiscal year
  //              meet a next-year need (Time); for an event before this fiscal year ends they meet a current need.
  // Fiscal years are named for the year they end: FY27 runs 1 October 2026 through 30 September 2027. Dates are plain
  // {y, m, d} values (m is 0-based) so the arithmetic never depends on time zones or daylight saving.
  var GEN_PER_RUN = 8, GEN_MAX_WORDS = 36;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SERVICES = ['grounds maintenance', 'custodial work', 'security guards', 'refuse collection', 'laundry support', 'pest control', 'help desk support', 'shuttle bus operations', 'vehicle fleet maintenance'];
  var SUPPLIES = ['office supplies', 'cleaning supplies', 'repair parts', 'safety gear', 'printer toner', 'hand tools'];
  var STOCK = ['tents', 'folding cots', 'cold-weather parkas', 'radio batteries', 'first aid kits', 'sandbags', 'safety vests', 'sleeping bags'];
  var EVENTS = ['field exercise', 'training course', 'range week', 'readiness exercise'];

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysIn(y, m) { return m === 1 ? (isLeap(y) ? 29 : 28) : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]; }
  function ymd(y, m, d) { return { y: y, m: m, d: d }; }
  function dayNum(t) { return Math.round(Date.UTC(t.y, t.m, t.d) / 864e5); }
  function addDays(t, n) { var u = new Date(Date.UTC(t.y, t.m, t.d + n)); return ymd(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); }
  function addMonths(t, n) { var k = t.y * 12 + t.m + n, y = Math.floor(k / 12), m = k - y * 12; return ymd(y, m, Math.min(t.d, daysIn(y, m))); }
  function before(a, b) { return dayNum(a) < dayNum(b); }
  function fyOf(t) { return t.m >= 9 ? t.y + 1 : t.y; }
  function fyName(fy) { var s = String(((fy % 100) + 100) % 100); return 'FY' + (s.length < 2 ? '0' + s : s); }
  function fyFirst(fy) { return ymd(fy - 1, 9, 1); }
  function fyLast(fy) { return ymd(fy, 8, 30); }
  function dateText(t) { return t.d + ' ' + MONTHS[t.m] + ' ' + t.y; }
  function rangeText(a, b) {
    if (a.y !== b.y) return dateText(a) + ' to ' + dateText(b);
    if (a.m !== b.m) return a.d + ' ' + MONTHS[a.m] + ' to ' + dateText(b);
    return a.d + ' to ' + dateText(b);
  }
  function usd(n) { return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function wordCount(s) { return String(s).split(/\s+/).filter(Boolean).length; }
  function monthsPhrase(n) { return (n === 8 || n === 11 || n === 18 ? 'an ' : 'a ') + n + '-month'; }
  function fyRun(from, to) {
    var list = [];
    for (var f = from; f <= to; f++) list.push(fyName(f));
    return list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0];
  }
  function randomDay(api, lo, hi) { return addDays(lo, api.randInt(0, Math.max(0, dayNum(hi) - dayNum(lo)))); }

  function genSeverable(api, fy, over) {
    var first = fyFirst(fy), last = fyLast(fy), n = 0, start = null, end = null;
    for (var tries = 0; tries < 30; tries++) {
      n = over ? api.randInt(13, 24) : api.randInt(6, 12);
      start = randomDay(api, first, last);
      start = ymd(start.y, start.m, api.randInt(0, 2) ? 1 : Math.min(start.d, 28));   // day 1 to 28, so adding months never needs a missing day
      end = addDays(addMonths(start, n), -1);
      if (before(last, end)) break;                                                   // the period runs into the next fiscal year
      end = null;
    }
    if (!end) return null;
    var earliest = addDays(start, -45);
    var award = randomDay(api, before(earliest, first) ? first : earliest, start);     // awarded in the same fiscal year, on or before the start
    var F = fyName(fy), period = dateText(start) + ' through ' + dateText(end), tooLong = n > 12;
    return {
      statement: 'On ' + dateText(award) + ' you award ' + monthsPhrase(n) + ' severable services contract for ' + api.pick(SERVICES) + ', running ' + period + ', funded entirely with ' + F + ' O&M.',
      bucket: tooLong ? 'Time' : 'No violation',
      explanation: tooLong
        ? 'The period ' + period + ' is ' + n + ' months, more than the one year allowed for severable services that cross fiscal years. Services performed after ' + dateText(last) + ' are ' + fyRun(fy + 1, fyOf(end)) + ' needs, so ' + F + ' funds cannot pay for them.'
        : 'The period ' + period + ' is ' + n + ' months, within one year, and starts in ' + F + ', which ends ' + dateText(last) + '. The severable services authority lets ' + F + ' funds cover the whole period.',
      cite: '10 U.S.C. 3133 (severable services crossing fiscal years); 31 U.S.C. 1502(a) (bona fide needs rule)'
    };
  }

  function genAllotment(api, fy, over) {
    var when = randomDay(api, fyFirst(fy), fyLast(fy));
    var allot = api.randInt(40, 480) * 10000;                    // $400,000 to $4,800,000
    var room = api.randInt(5, 95) * 1000;                        // left in the allotment before this order
    var used = allot - room;
    var order = over ? room + api.randInt(1, 120) * 500 : (api.randInt(0, 9) === 0 ? room : api.randInt(2, room / 500) * 500);
    var total = used + order, F = fyName(fy);
    var sum = usd(used) + ' already obligated + ' + usd(order) + ' = ' + usd(total);
    return {
      statement: 'On ' + dateText(when) + ' an installation\'s ' + F + ' O&M allotment is ' + usd(allot) + ' and ' + usd(used) + ' is already obligated. A contracting officer then signs an order for ' + usd(order) + ' of ' + api.pick(SUPPLIES) + ' needed now.',
      bucket: total > allot ? 'Amount' : 'No violation',
      explanation: total > allot
        ? sum + ', which is ' + usd(total - allot) + ' more than the ' + usd(allot) + ' allotment. Obligating beyond a formal allotment violates the Antideficiency Act even when the appropriation as a whole still has money.'
        : sum + (total === allot ? ', exactly the ' + usd(allot) + ' allotment; reaching the limit is not exceeding it.' : ', which is ' + usd(allot - total) + ' under the ' + usd(allot) + ' allotment.') + ' The order stays inside the fund control limit, and nothing else in the facts is a problem.',
      cite: '31 U.S.C. 1517(a) (obligations exceeding an apportionment or administrative subdivision)'
    };
  }

  function genStored(api, fy, nextYear) {
    var last = fyLast(fy), bought, from, to;
    if (nextYear) {
      bought = randomDay(api, ymd(fy, 8, 1), ymd(fy, 8, 28));                          // September, the last month of the fiscal year
      from = api.randInt(0, 4) < 2 ? randomDay(api, fyFirst(fy + 1), ymd(fy, 9, 31))   // often just after the new fiscal year starts
        : randomDay(api, ymd(fy, 10, 1), ymd(fy + 1, 6, 31));
      to = addDays(from, api.randInt(2, 9));
    } else {
      bought = randomDay(api, ymd(fy, 8, 1), ymd(fy, 8, 20));
      from = randomDay(api, addDays(bought, 3), ymd(fy, 8, 27));
      to = addDays(from, api.randInt(1, 6));
      if (before(last, to)) to = last;
    }
    var F = fyName(fy), items = api.pick(STOCK), event = api.pick(EVENTS), amount = api.randInt(18, 480) * 500, later = fyOf(from) > fy;
    return {
      statement: 'On ' + dateText(bought) + ' an office spends ' + usd(amount) + ' of ' + F + ' O&M on ' + items + '. They are delivered at once and stored for a ' + event + ' running ' + rangeText(from, to) + '.',
      bucket: later ? 'Time' : 'No violation',
      explanation: later
        ? 'The ' + event + ' starts ' + dateText(from) + ', after ' + F + ' ends on ' + dateText(last) + ', so the ' + items + ' meet an ' + fyName(fyOf(from)) + ' need. Delivery and storage in ' + F + ' do not change that, so ' + F + ' money cannot buy them.'
        : 'The ' + event + ' runs ' + rangeText(from, to) + ', within ' + F + ', which ends on ' + dateText(last) + ', so the ' + items + ' meet a current ' + F + ' need. Buying near year-end and storing them until then does not change that.',
      cite: '31 U.S.C. 1502(a) (bona fide needs rule); GAO Red Book (Availability of Appropriations: Time)'
    };
  }

  var TEMPLATES = [
    { key: 'severable', difficulty: 2, make: genSeverable },
    { key: 'allotment', difficulty: 1, make: genAllotment },
    { key: 'stored', difficulty: 2, make: genStored }
  ];
  // This run's generated statements, dated from today: both outcomes of every template, then random extras up to GEN_PER_RUN.
  function generated(api) {
    var out = [], seen = {}, count = {}, plan = [], i, j, made, norm;
    var now = new Date(), fy = fyOf(ymd(now.getFullYear(), now.getMonth(), now.getDate()));
    for (i = 0; i < TEMPLATES.length; i++) { plan.push({ t: TEMPLATES[i], flip: true }); plan.push({ t: TEMPLATES[i], flip: false }); }
    while (plan.length < GEN_PER_RUN) plan.push({ t: api.pick(TEMPLATES), flip: api.rand(0, 1) < 0.5 });
    plan = api.shuffle(plan).slice(0, GEN_PER_RUN);
    for (i = 0; i < plan.length; i++) {
      made = null;
      for (j = 0; j < 6 && !made; j++) {
        try { made = plan[i].t.make(api, fy, plan[i].flip); } catch (e) { made = null; }      // never throw on odd input
        if (made && (seen[made.statement] || wordCount(made.statement) > GEN_MAX_WORDS)) made = null;
      }
      if (!made) continue;
      seen[made.statement] = 1;
      count[plan[i].t.key] = (count[plan[i].t.key] || 0) + 1;
      made.id = 'GEN-' + plan[i].t.key + '-' + count[plan[i].t.key];
      made.difficulty = plan[i].t.difficulty;
      made.gen = true;
      norm = normItem(made);
      if (norm) out.push(norm);
    }
    return out;
  }
  function shortExplain(s) {
    var v = tidy(s);
    if (!v) return '';
    if (v.length <= 170) return v;
    var cut = v.lastIndexOf('. ', 170);
    if (cut > 60) return v.slice(0, cut + 1);
    return v.slice(0, 167).replace(/\s+\S*$/, '') + '…';
  }
  function shortCite(s) {
    var v = tidy(s);
    if (!v) return '';
    var p = tidy(v.split(';')[0]);
    if (p.length > 92) p = p.slice(0, 89).replace(/\s+\S*$/, '') + '…';
    return p;
  }

  A.register({
    id: 'fiscal-asteroids',
    title: 'Fiscal Asteroids',
    tagline: 'Shoot the rule the statement breaks before the rock breaks you.',
    blurb: 'A fiscal-law statement rides above the field while labeled asteroids fall on your ship: shoot PURPOSE, TIME, AMOUNT or NO VIOLATION. Every five right calls bring harder statements (never faster rocks), and a wrong call costs a shield and shows you why.',
    controls: '← → or A/D move · ↑ ↓ or W/S nudge · Space fires · drag to move and tap to fire · P pauses',
    icon: '🚀',
    accent: A.C.sky,
    drills: 'Purpose, time and amount — the three fiscal rules',
    dataOk: function (D) { return itemsFrom(D).length >= 8; },

    create: function (api) {
      var W = api.W, H = api.H, C = api.C;
      var DUR = 120, MAX_SHIELDS = (api.difficulty && api.difficulty.lives) || 3;   // shields come from the chosen level
      var PANEL_X = 24, PANEL_Y = 12, PANEL_W = W - 48, PANEL_H = 168;
      var FIELD_TOP = PANEL_Y + PANEL_H + 2;
      var SHIP_TOP = H - 165, SHIP_BOT = H - 44, SHIP_R = 16;

      // Levels are question difficulty, not speed. The pace below is the level-1 pace for the whole run;
      // the shell slows the game clock at levels 2 and 3, and harder levels only add one labelled decoy rock.
      var PER_LEVEL = 5, LEVEL_TIME = 15;                       // correct calls per level; seconds added at each level-up
      var ROCK_SPEED = 73, ROCK_CAP = 5, SPAWN_GAP = 1.47;
      var LEVEL_NAMES = ['EASY', 'MEDIUM', 'HARD'];
      api.progress.configure({ perLevel: PER_LEVEL });
      var MAX_LEVEL = api.progress.maxLevel || 3;

      var pool = itemsFrom(api.data).concat(generated(api));   // the file's statements plus this run's generated ones (new dates and dollar figures)
      var shownCount = 0, cur = null, curB = null;
      var answered = 0, right = 0, stepRight = 0, combo = 1, shields = MAX_SHIELDS;
      var timeLeft = DUR, shownTime = -1, over = false, t = 0;
      var rocks = [], bolts = [], rings = [], layers = [];
      var cool = 0, spawnT = 0.5, shieldFlash = 0, verdict = null, hint = 3.2, levelFx = 0;
      var ship = { x: W / 2, y: H - 78, vx: 0, thrust: 0, kick: 0 };
      var drag = false, ptx = 0, pty = 0;
      var panelText = null, panelLines = [], panelSize = 18, panelLH = 24;

      // ---- starfield layers (parallax) ----
      (function () {
        var conf = [{ n: 54, r: 0.8, sp: 9, a: 0.34 }, { n: 34, r: 1.3, sp: 24, a: 0.55 }, { n: 20, r: 2.0, sp: 52, a: 0.8 }];
        for (var L = 0; L < conf.length; L++) {
          var arr = [];
          for (var i = 0; i < conf[L].n; i++) arr.push({ x: api.rand(0, W), y: api.rand(0, H), r: conf[L].r * api.rand(0.7, 1.35) });
          layers.push({ stars: arr, speed: conf[L].sp, alpha: conf[L].a });
        }
      })();

      api.hud.set({ score: 0, lives: MAX_SHIELDS, maxLives: MAX_SHIELDS, combo: 1, level: api.progress.level, time: DUR, progress: 0 });

      // ---- statement flow ----
      function nextStatement() {
        cur = api.progress.pick(pool);             // an unused statement matching the current question level
        curB = cur ? bucketOf(cur.bucket) : null;
        if (!cur || !curB) { cur = null; curB = null; finishRound(false, 'No statements available'); return; }
        shownCount++;
        panelText = null;
        if (api.progress.level >= 2) addDecoy();   // harder levels: one more labelled rock naming a wrong rule
        if (api.ready) api.ready(cur.statement);   // reading pause on the easier difficulty settings
      }
      nextStatement();

      function levelName() { return LEVEL_NAMES[Math.max(1, Math.min(3, api.progress.level)) - 1]; }

      function finishRound(won, title) {
        if (over) return;
        over = true;
        var bonus = Math.max(0, shields) * 100;
        if (bonus > 0) api.score(bonus);
        api.end({
          won: !!won,
          title: title || 'Run over',
          message: right + ' of ' + answered + ' statements called correctly · reached level ' + api.progress.level + ' (' + levelName().toLowerCase() + ' questions)' + (bonus ? ' · +' + bonus + ' shield bonus' : '')
        });
      }

      // ---- levels (question difficulty only; the pace never changes) ----
      function maxRocks() { return ROCK_CAP + (api.progress.level >= 2 ? 1 : 0); }   // room for the decoy, not more speed

      function levelUp() {
        stepRight = 0;
        levelFx = 2.4;
        timeLeft += LEVEL_TIME;                    // harder questions get more time on the round clock, never less
        api.hud.set({ level: api.progress.level });
        rings.push({ x: ship.x, y: ship.y, r: 10, max: 260, t: 0, life: 0.9, color: C.gold });
      }

      // ---- asteroids ----
      function hasCorrect() {
        if (!curB) return true;
        for (var i = 0; i < rocks.length; i++) if (rocks[i].b && rocks[i].b.key === curB.key) return true;
        return false;
      }
      function addDecoy() {
        if (!curB || rocks.length >= maxRocks()) return;
        var wrong = [];
        for (var i = 0; i < BUCKETS.length; i++) if (BUCKETS[i].key !== curB.key) wrong.push(BUCKETS[i]);
        if (wrong.length) spawnRock(api.pick(wrong), true);
      }
      function spawnRock(forceB, ignoreCap) {
        if (!ignoreCap && rocks.length >= maxRocks()) return;
        if (rocks.length >= 11) return;
        var b = forceB || null;
        if (!b) {
          if (!hasCorrect() && curB) b = curB;
          else if (Math.random() < 0.15) b = null;              // debris: no label, pure obstacle
          else b = api.pick(BUCKETS) || BUCKETS[0];
        }
        var r = b ? api.rand(34, 52) : api.rand(22, 38);
        var x = api.rand(r + 18, W - r - 18);
        for (var tries = 0; tries < 6; tries++) {
          var clash = false;
          for (var i = 0; i < rocks.length; i++) {
            var o = rocks[i];
            if (o.y < FIELD_TOP + 110 && Math.abs(o.x - x) < (o.r + r) * 1.05) { clash = true; break; }
          }
          if (!clash) break;
          x = api.rand(r + 18, W - r - 18);
        }
        var pts = [], n = api.randInt(9, 12);
        for (var p = 0; p < n; p++) pts.push(api.rand(0.74, 1.2));
        var craters = [];
        for (var c = 0; c < api.randInt(2, 3); c++) craters.push({ x: api.rand(-0.45, 0.45), y: api.rand(-0.45, 0.45), r: api.rand(0.1, 0.22) });
        rocks.push({
          x: x, y: FIELD_TOP - r - 4, r: r, vx: api.rand(-26, 26),
          vy: ROCK_SPEED * api.rand(0.82, 1.24),
          rot: api.rand(0, Math.PI * 2), spin: api.rand(-0.7, 0.7),
          b: b, pts: pts, craters: craters, hp: b ? 1 : 2, flash: 0
        });
      }

      function explode(rk, cols, n) {
        api.particles.emit({ x: rk.x, y: rk.y, n: n || 26, color: cols, speed: 260, life: 0.85, size: 6, gravity: 0, shape: 'circle' });
        api.particles.emit({ x: rk.x, y: rk.y, n: Math.round((n || 26) / 2), color: [C.white, cols[0]], speed: 400, life: 0.5, size: 4, gravity: 0, shape: 'spark' });
        rings.push({ x: rk.x, y: rk.y, r: rk.r * 0.5, max: rk.r * 3.4, t: 0, life: 0.5, color: cols[0] });
      }

      // ---- shooting ----
      function fire() {
        if (over || cool > 0) return;
        cool = 0.22;
        bolts.push({ x: ship.x, y: ship.y - 22 });
        ship.kick = 0.12;
        api.audio.tone(920, 0.05, 'square', 0.045, 300);
      }

      function answer(rk) {
        if (!cur || !curB || over) return;
        var ok = rk.b.key === curB.key;
        explode(rk, ok ? [C.green, C.teal, C.white] : [C.red, C.orange, C.white], ok ? 34 : 24);
        api.audio.boom();
        api.review.add({
          prompt: cur.statement,                   // starts with the statement text, which the shell matches to remember the question
          correct: cur.bucket, given: rk.b.bucket, ok: ok,
          explanation: cur.explanation, cite: cur.cite
        });
        answered++;
        if (ok) {
          right++;
          var lvl = api.progress.level;
          var pts = Math.round((100 + (lvl - 1) * 50) * combo);   // harder questions are worth more points
          api.score(pts);
          api.audio.correct();
          verdict = { ok: true, title: rk.b.label + ' — correct', sub: shortCite(cur.cite), color: rk.b.color, t: 1.9 };
          api.hud.set({ banner: '+' + pts + (combo > 1 ? '  ×' + combo : ''), sub: shortCite(cur.cite), bannerTime: 1.1 });
          combo = Math.min(8, combo + 1);
          api.hud.set({ combo: combo });
          api.particles.emit({ x: ship.x, y: ship.y, n: 14, color: [C.green, C.teal], speed: 180, life: 0.5, size: 4, gravity: 0 });
          if (api.progress.correct()) levelUp();   // the shell raises the level and shows the banner and fanfare
          else stepRight++;
          api.hud.set({ progress: Math.min(1, right / (PER_LEVEL * MAX_LEVEL)) });
          if (lvl >= MAX_LEVEL && stepRight >= PER_LEVEL) { finishRound(true, 'All three levels cleared'); return; }
        } else {
          combo = 1;
          api.audio.wrong();
          api.shake(13);
          api.flash('rgba(255,107,107,.26)');
          shieldFlash = 1;
          verdict = { ok: false, title: 'Wrong call — it was ' + curB.label, sub: shortExplain(cur.explanation), color: curB.color, t: 3.2 };
          api.hud.set({ combo: 1, banner: 'It was ' + cur.bucket, sub: shortExplain(cur.explanation), bannerTime: 3 });
          shields--;
          api.hud.set({ lives: Math.max(0, shields) });
          api.life(-1);
          if (shields <= 0) { over = true; return; }
        }
        nextStatement();
      }

      function crash(rk) {
        explode(rk, [C.orange, C.red, C.gold], 28);
        api.audio.boom();
        api.shake(17);
        api.flash('rgba(255,165,82,.24)');
        shieldFlash = 1;
        combo = 1;
        shields--;
        api.hud.set({ combo: 1, lives: Math.max(0, shields), banner: 'Shield hit', sub: 'Dodge the rocks you do not need — only shoot the one that names the violation.', bannerTime: 1.6 });
        api.life(-1);
        if (shields <= 0) over = true;
      }

      function held() {
        var keys = api.input.keys;
        for (var i = 0; i < arguments.length; i++) if (keys.has(arguments[i])) return true;
        return false;
      }

      // ---- drawing helpers ----
      function drawBackdrop(ctx) {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#060a14');
        g.addColorStop(0.55, '#081222');
        g.addColorStop(1, '#050810');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        var bx = W * 0.26 + Math.sin(t * 0.14) * 40, by = H * 0.42 + Math.cos(t * 0.11) * 26;
        var n1 = ctx.createRadialGradient(bx, by, 10, bx, by, 300);
        n1.addColorStop(0, 'rgba(143,198,255,.10)');
        n1.addColorStop(1, 'rgba(143,198,255,0)');
        ctx.fillStyle = n1; ctx.fillRect(0, 0, W, H);
        var cx = W * 0.78 + Math.cos(t * 0.09) * 40, cy = H * 0.66 + Math.sin(t * 0.13) * 24;
        var n2 = ctx.createRadialGradient(cx, cy, 10, cx, cy, 260);
        n2.addColorStop(0, 'rgba(183,139,255,.09)');
        n2.addColorStop(1, 'rgba(183,139,255,0)');
        ctx.fillStyle = n2; ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.fillStyle = C.white;
        for (var L = 0; L < layers.length; L++) {
          ctx.globalAlpha = layers[L].alpha;
          var arr = layers[L].stars;
          for (var i = 0; i < arr.length; i++) {
            var s = arr[i];
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();
      }

      function drawRock(ctx, rk) {
        var col = rk.b ? rk.b.color : C.muted;
        ctx.save();
        ctx.translate(rk.x, rk.y);
        ctx.save();
        ctx.rotate(rk.rot);
        api.glow(ctx, col, rk.flash > 0 ? 32 : 15);
        ctx.beginPath();
        for (var i = 0; i < rk.pts.length; i++) {
          var a = i / rk.pts.length * Math.PI * 2;
          var rr = rk.r * rk.pts[i];
          var x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = rk.flash > 0 ? 'rgba(255,255,255,.24)' : 'rgba(10,17,31,.92)';
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = col;
        ctx.stroke();
        api.noGlow(ctx);
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = col;
        for (var c = 0; c < rk.craters.length; c++) {
          var cr = rk.craters[c];
          ctx.beginPath(); ctx.arc(cr.x * rk.r, cr.y * rk.r, cr.r * rk.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        if (rk.b) {
          api.glow(ctx, col, 14);
          api.pill(ctx, rk.b.label, 0, 0, { align: 'center', size: 16, color: C.ink, bg: 'rgba(4,8,16,.86)', stroke: col, lineWidth: 2 });
          api.noGlow(ctx);
        } else {
          api.text(ctx, '✦', 0, 6, { size: 18, color: C.muted, align: 'center' });
        }
        ctx.restore();
      }

      function drawShip(ctx) {
        ctx.save();
        ctx.translate(ship.x, ship.y + (ship.kick > 0 ? ship.kick * 22 : 0));
        var flame = 16 + Math.abs(Math.sin(t * 26)) * 9 + ship.thrust * 14;
        api.glow(ctx, C.orange, 20);
        ctx.fillStyle = 'rgba(255,165,82,.9)';
        ctx.beginPath(); ctx.moveTo(-7, 12); ctx.lineTo(7, 12); ctx.lineTo(0, 12 + flame); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(243,213,140,.95)';
        ctx.beginPath(); ctx.moveTo(-3.4, 12); ctx.lineTo(3.4, 12); ctx.lineTo(0, 12 + flame * 0.6); ctx.closePath(); ctx.fill();
        api.glow(ctx, C.sky, 22);
        ctx.beginPath();
        ctx.moveTo(0, -24); ctx.lineTo(13, 4); ctx.lineTo(20, 14); ctx.lineTo(7, 12);
        ctx.lineTo(-7, 12); ctx.lineTo(-20, 14); ctx.lineTo(-13, 4);
        ctx.closePath();
        ctx.fillStyle = '#0e1c31';
        ctx.fill();
        ctx.lineWidth = 2.2; ctx.strokeStyle = C.sky; ctx.stroke();
        api.noGlow(ctx);
        ctx.fillStyle = 'rgba(143,198,255,.85)';
        ctx.beginPath(); ctx.ellipse(0, -6, 4.2, 7.5, 0, 0, Math.PI * 2); ctx.fill();
        if (shieldFlash > 0) {
          ctx.globalAlpha = shieldFlash;
          api.glow(ctx, C.red, 24);
          ctx.strokeStyle = C.red; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, -2, 26 + (1 - shieldFlash) * 26, 0, Math.PI * 2); ctx.stroke();
          api.noGlow(ctx);
          ctx.globalAlpha = 1;
        } else if (shields > 0) {
          ctx.globalAlpha = 0.16 + Math.abs(Math.sin(t * 2)) * 0.08;
          ctx.strokeStyle = C.teal; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(0, -2, 28, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }

      function drawPanel(ctx) {
        ctx.save();
        api.roundRect(ctx, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 16);
        ctx.fillStyle = 'rgba(5,9,18,.9)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(143,198,255,.32)';
        ctx.stroke();
        ctx.restore();

        // level label and pips, driven by api.progress.level
        var label = 'LEVEL ' + api.progress.level + ' · ' + levelName() + (cur ? '  ·  STATEMENT ' + shownCount : '');
        var lx = PANEL_X + 18, ly = PANEL_Y + 30;
        ctx.save();
        if (levelFx > 0) api.glow(ctx, C.gold, 10 + Math.min(1, levelFx) * 14);
        api.text(ctx, label, lx, ly, { size: 16, fam: 'mono', weight: 600, color: levelFx > 0 ? C.gold2 : C.sky });
        api.noGlow(ctx);
        ctx.font = api.font(16, 'mono', 600);
        var pipX = lx + ctx.measureText(label).width + 20;
        for (var k = 0; k < PER_LEVEL; k++) {
          ctx.beginPath();
          ctx.arc(pipX + k * 16, ly - 5, 5, 0, Math.PI * 2);
          ctx.fillStyle = k < stepRight ? C.gold : 'rgba(255,255,255,.16)';
          ctx.fill();
        }
        ctx.restore();
        if (levelFx > 0) api.text(ctx, '+' + LEVEL_TIME + ' s on the clock', pipX + PER_LEVEL * 16 + 8, ly, { size: 16, fam: 'mono', weight: 600, color: C.gold2, alpha: Math.min(1, levelFx) });
        api.text(ctx, 'Shoot the rule it breaks', PANEL_X + PANEL_W - 18, PANEL_Y + 30, { size: 16, fam: 'mono', weight: 600, color: C.muted, align: 'right' });

        var txt = cur ? cur.statement : 'Round complete.';
        if (panelText !== txt) {
          panelSize = 18; panelLH = 24;
          ctx.save();
          ctx.font = api.font(panelSize, 'body', 600);
          panelLines = api.wrap(ctx, txt, PANEL_W - 36);
          if (panelLines.length > 4) {
            panelSize = 16; panelLH = 21;
            ctx.font = api.font(panelSize, 'body', 600);
            panelLines = api.wrap(ctx, txt, PANEL_W - 36);
          }
          ctx.restore();
          panelText = txt;
        }
        for (var i = 0; i < panelLines.length && i < 5; i++) {
          api.text(ctx, panelLines[i], PANEL_X + 18, PANEL_Y + 58 + i * panelLH, { size: panelSize, weight: 600, color: C.ink });
        }
      }

      function drawVerdict(ctx) {
        if (!verdict) return;
        var fade = Math.min(1, verdict.t / 0.45);
        ctx.save();
        ctx.globalAlpha = fade;
        var bw = 720, bx = (W - bw) / 2, by = FIELD_TOP + 10;
        var sub = verdict.sub || '';
        ctx.font = api.font(16, 'body', 600);
        var lines = sub ? api.wrap(ctx, sub, bw - 36) : [];
        if (lines.length > 3) lines = lines.slice(0, 3);
        var bh = 40 + (lines.length ? lines.length * 20 + 8 : 0);
        api.roundRect(ctx, bx, by, bw, bh, 12);
        ctx.fillStyle = 'rgba(5,9,18,.88)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = verdict.ok ? C.green : C.red;
        ctx.stroke();
        api.text(ctx, (verdict.ok ? '✓ ' : '✕ ') + verdict.title, W / 2, by + 26, { size: 18, weight: 700, align: 'center', color: verdict.ok ? C.green : C.red });
        for (var i = 0; i < lines.length; i++) {
          api.text(ctx, lines[i], W / 2, by + 50 + i * 20, { size: 16, align: 'center', color: C.ink2 });
        }
        ctx.restore();
      }

      function drawHint(ctx) {
        if (hint <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, hint / 0.7);
        var msg = '← →  move  ·  ↑ ↓  nudge  ·  SPACE  fire  ·  drag to move, tap to fire';
        ctx.font = api.font(16, 'mono', 600);
        var w = ctx.measureText(msg).width + 34;
        api.roundRect(ctx, (W - w) / 2, H - 42, w, 30, 15);
        ctx.fillStyle = 'rgba(5,9,18,.85)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(143,198,255,.35)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        api.text(ctx, msg, W / 2, H - 22, { size: 16, fam: 'mono', weight: 600, align: 'center', color: C.ink2 });
        ctx.restore();
      }

      return {
        update: function (dt) {
          t += dt;
          if (hint > 0) hint -= dt;
          if (cool > 0) cool -= dt;
          if (ship.kick > 0) ship.kick = Math.max(0, ship.kick - dt * 1.4);
          if (shieldFlash > 0) shieldFlash = Math.max(0, shieldFlash - dt * 1.7);
          if (verdict) { verdict.t -= dt; if (verdict.t <= 0) verdict = null; }
          if (levelFx > 0) levelFx = Math.max(0, levelFx - dt);

          for (var L = 0; L < layers.length; L++) {
            var arr = layers[L].stars, sp = layers[L].speed;
            for (var si = 0; si < arr.length; si++) {
              var st = arr[si];
              st.y += sp * dt;
              if (st.y > H + 3) { st.y = -3; st.x = api.rand(0, W); }
            }
          }
          for (var ri = rings.length - 1; ri >= 0; ri--) {
            var rg = rings[ri];
            rg.t += dt;
            if (rg.t >= rg.life) rings.splice(ri, 1);
          }
          if (over) return;

          // clock
          timeLeft -= dt;
          var shown = Math.max(0, Math.ceil(timeLeft));
          if (shown !== shownTime) {
            shownTime = shown;
            api.hud.set({ time: shown });
            if (shown > 0 && shown <= 5) api.audio.tick();
          }
          if (timeLeft <= 0) { finishRound(right > 0 && right >= answered - right, 'Time'); return; }

          // ship control
          var dirX = (held('ArrowLeft', 'a', 'A') ? -1 : 0) + (held('ArrowRight', 'd', 'D') ? 1 : 0);
          var dirY = (held('ArrowUp', 'w', 'W') ? -1 : 0) + (held('ArrowDown', 's', 'S') ? 1 : 0);
          ship.thrust = Math.max(0, -dirY);
          if (drag) {
            var toX = ptx - ship.x;
            var step = Math.min(Math.abs(toX), 640 * dt) * (toX < 0 ? -1 : 1);
            ship.x += step;
            ship.vx = step / Math.max(dt, 0.0001) * 0.4;
            var goalY = api.clamp(pty, SHIP_TOP, SHIP_BOT);
            ship.y += api.clamp(goalY - ship.y, -320 * dt, 320 * dt);
          } else {
            if (dirX) ship.vx += dirX * 1900 * dt;
            else ship.vx *= Math.pow(0.0016, dt);
            ship.vx = api.clamp(ship.vx, -430, 430);
            ship.x += ship.vx * dt;
            if (dirY) ship.y += dirY * 230 * dt;
          }
          if (ship.x < 26) { ship.x = 26; ship.vx = 0; }
          if (ship.x > W - 26) { ship.x = W - 26; ship.vx = 0; }
          ship.y = api.clamp(ship.y, SHIP_TOP, SHIP_BOT);
          if (held(' ')) fire();

          // spawning
          spawnT -= dt;
          if (spawnT <= 0) {
            spawnT = SPAWN_GAP * api.rand(0.82, 1.3);
            spawnRock(null, false);
          }
          if (!hasCorrect() && rocks.length < maxRocks() + 1 && Math.random() < dt * 1.6) spawnRock(curB, true);

          // bolts
          for (var bi = bolts.length - 1; bi >= 0; bi--) {
            var bo = bolts[bi];
            bo.y -= 720 * dt;
            if (bo.y < FIELD_TOP - 24) { bolts.splice(bi, 1); continue; }
            var struck = false;
            for (var k = rocks.length - 1; k >= 0; k--) {
              var rk = rocks[k];
              var ddx = rk.x - bo.x, ddy = rk.y - bo.y, hitR = rk.r * 0.92;
              if (ddx * ddx + ddy * ddy > hitR * hitR) continue;
              struck = true;
              bolts.splice(bi, 1);
              if (rk.b) {
                rocks.splice(k, 1);
                answer(rk);
              } else {
                rk.hp--;
                rk.flash = 0.16;
                api.particles.emit({ x: bo.x, y: bo.y, n: 9, color: [C.muted, C.ink2], speed: 170, life: 0.4, size: 4, gravity: 0, shape: 'spark' });
                if (rk.hp <= 0) {
                  rocks.splice(k, 1);
                  explode(rk, [C.muted, C.ink2, C.white], 18);
                  api.audio.boom();
                  api.score(10);
                } else {
                  api.audio.blip();
                }
              }
              break;
            }
            if (over) return;
            if (struck) continue;
          }

          // rocks
          for (var i = rocks.length - 1; i >= 0; i--) {
            var r2 = rocks[i];
            r2.x += r2.vx * dt;
            r2.y += r2.vy * dt;
            r2.rot += r2.spin * dt;
            if (r2.flash > 0) r2.flash -= dt;
            if (r2.x < r2.r * 0.6) { r2.x = r2.r * 0.6; r2.vx = Math.abs(r2.vx); }
            if (r2.x > W - r2.r * 0.6) { r2.x = W - r2.r * 0.6; r2.vx = -Math.abs(r2.vx); }
            if (r2.y - r2.r > H + 12) { rocks.splice(i, 1); continue; }
            var cdx = r2.x - ship.x, cdy = r2.y - ship.y, cr = r2.r * 0.84 + SHIP_R;
            if (cdx * cdx + cdy * cdy < cr * cr) {
              rocks.splice(i, 1);
              crash(r2);
              if (over) return;
            }
          }
        },

        draw: function (ctx) {
          drawBackdrop(ctx);

          ctx.save();
          ctx.beginPath();
          ctx.rect(0, FIELD_TOP, W, H - FIELD_TOP);
          ctx.clip();
          var i;
          for (i = 0; i < rings.length; i++) {
            var rg = rings[i];
            var p = rg.t / rg.life;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - p) * 0.75;
            ctx.strokeStyle = rg.color;
            ctx.lineWidth = 3 * (1 - p) + 0.6;
            ctx.beginPath();
            ctx.arc(rg.x, rg.y, rg.r + (rg.max - rg.r) * api.ease.outCubic(p), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          for (i = 0; i < rocks.length; i++) drawRock(ctx, rocks[i]);
          ctx.save();
          api.glow(ctx, C.sky, 16);
          for (i = 0; i < bolts.length; i++) {
            var bo = bolts[i];
            ctx.strokeStyle = 'rgba(143,198,255,.95)';
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(bo.x, bo.y); ctx.lineTo(bo.x, bo.y + 16); ctx.stroke();
            ctx.strokeStyle = C.white;
            ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(bo.x, bo.y + 1); ctx.lineTo(bo.x, bo.y + 13); ctx.stroke();
          }
          api.noGlow(ctx);
          ctx.restore();
          drawShip(ctx);
          ctx.restore();

          var fade = ctx.createLinearGradient(0, FIELD_TOP, 0, FIELD_TOP + 46);
          fade.addColorStop(0, 'rgba(5,9,18,.85)');
          fade.addColorStop(1, 'rgba(5,9,18,0)');
          ctx.fillStyle = fade;
          ctx.fillRect(0, FIELD_TOP, W, 46);

          drawPanel(ctx);
          drawVerdict(ctx);
          drawHint(ctx);
        },

        onKey: function (k, down) {
          if (!down) return;
          if (k === ' ' || k === 'Spacebar' || k === 'Enter') fire();
        },

        onPointer: function (p) {
          if (over) return;
          if (p.type === 'down') { drag = true; ptx = p.x; pty = p.y; fire(); }
          else if (p.type === 'move') { if (api.input.pointer.down) { drag = true; ptx = p.x; pty = p.y; } }
          else { drag = false; }
        },

        destroy: function () {
          rocks.length = 0; bolts.length = 0; rings.length = 0; layers.length = 0; pool = [];
          cur = null; curB = null; over = true;
        }
      };
    }
  });
})();
