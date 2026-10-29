/* GAME: threshold-run — four-lane pseudo-3D warrant highway.
   An action card slides in with the facts and the cumulative instrument value;
   steer into the lane of the SMALLEST warrant class that can sign it before the
   gate line arrives. Army Warranting Program Policy v12, Table 1 and para 4.2.
   Levels (api.progress) make the ACTIONS harder every 5 right lanes: plain awards,
   then options and orders, then ceilings, deductive mods, the SaP nuance and
   values near a class line. The road keeps the same pace at every level. */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var CLASSES = ['I', 'II', 'III', 'IV'];
  var CITE = 'Army Warranting Program Policy v12, Table 1 and 4.2';
  var ROUND_ITEMS = 20;              // a run ends after 20 actions, or sooner when the lives run out
  var GEN_ITEMS = 12;                // practice items generated per run, two of each archetype
  var SPEED = 7.4;                   // road pace (world units per second), the same at every level
  var LEVEL_NAMES = ['EASY', 'MEDIUM', 'HARD'];
  var DEF_SAT = 350000;
  var DEF_SAP = 9000000;
  var T3 = [10000000, 25000000, 50000000, 100000000];
  var T4 = [250000000, 500000000];

  // ---------- small data helpers -------------------------------------------
  function fin(v) { var n = Number(v); return (typeof n === 'number' && isFinite(n)) ? n : null; }

  function thrOf(D, id, dflt) {
    var list = (D && D.thresholds) || [];
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t && t.id === id) { var v = fin(t.value_number); if (v !== null && v > 0) return v; }
    }
    return dflt;
  }

  function normClass(s) {
    var c = String(s == null ? '' : s).toUpperCase().replace(/CLASS/g, '').replace(/[^IV]/g, '');
    return CLASSES.indexOf(c) >= 0 ? c : '';
  }

  // Warrant classes a card belongs to: the class that can sign it and the class just below, so each candidate
  // practices actions at their own limit and just past it. Classes given in the data win.
  function ladderClasses(given, cls) {
    if (given && given.length) return given;
    var i = CLASSES.indexOf(cls);
    return i <= 0 ? ['I'] : [CLASSES[i - 1], CLASSES[i]];
  }

  function dollars(n) {
    n = Math.round(Number(n) || 0);
    var neg = n < 0, s = String(Math.abs(n)), out = '';
    while (s.length > 3) { out = ',' + s.slice(-3) + out; s = s.slice(0, -3); }
    return (neg ? '-$' : '$') + s + out;
  }

  function shortExp(text, max) {
    var t = String(text == null ? '' : text).replace(/\s*\n+\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    max = max || 180;
    if (t.length <= max) return t;
    var cut = t.slice(0, max), p = cut.lastIndexOf('. ');
    if (p > 60) return cut.slice(0, p + 1);
    p = cut.lastIndexOf(' ');
    return (p > 40 ? cut.slice(0, p) : cut) + '…';
  }

  // repository items -> playable cards
  function ladderCards(D) {
    var raw = ((D || {}).games || {}).threshold_ladder;
    if (!raw || !raw.length) return [];
    var out = [], i, j, it, cls, v, facts;
    for (i = 0; i < raw.length; i++) {
      it = raw[i];
      if (!it || !it.label) continue;
      cls = normClass(it.correct_class);
      if (!cls) continue;
      v = fin(it.value_number);
      if (v === null) continue;
      facts = [];
      if (it.facts && it.facts.length) for (j = 0; j < it.facts.length; j++) if (it.facts[j]) facts.push(String(it.facts[j]));
      var diff = Math.round(Number(it.difficulty));
      out.push({
        id: it.id ? String(it.id) : ('ITEM' + i),
        label: String(it.label),
        facts: facts,
        total: Math.abs(v),
        cls: cls,
        explanation: it.explanation ? String(it.explanation) : '',
        difficulty: diff >= 1 && diff <= 3 ? diff : 0,        // 0 = not rated in the data; rated in create
        gen: false,
        classes: ladderClasses(it.classes, cls)
      });
    }
    return out;
  }

  A.register({
    id: 'threshold-run',
    title: 'Threshold Run',
    tagline: 'Drive into the lane of the class that can sign it.',
    blurb: 'Four lanes of highway, one per Army warrant class. Read the action, add up base plus options plus ceiling plus the absolute value of the modification, and take the lane of the smallest class that can sign it before the gate slams shut. Every five right lanes the actions get harder, never faster.',
    controls: '← → or A/D change lanes · tap a side or drag on touch · P pauses',
    icon: '🏎️',
    accent: A.C.gold,
    drills: 'Warrant classes and cumulative instrument value',
    dataOk: function (D) { return ladderCards(D).length >= 8; },

    create: function (api) {
      var C = api.C, W = api.W, H = api.H;
      api.progress.configure({ perLevel: 5 });     // level 2 after 5 right lanes, level 3 after 10

      // ---------------- layout ------------------------------------------
      var CARD = { x: 16, y: 10, w: 928, h: 160 };  // tall enough for 4 fact lines on harder actions
      var FACT_LINES = 4;
      var CARD_SPLIT = 626;                       // left text column ends here
      var HZ = 186, RB = 430;                     // horizon / road bottom
      var Z0 = 3.0, HW = 400, LANE_W = 200;       // camera depth, road half width
      var LANE_WX = [-300, -100, 100, 300];
      var Z_CAR = 0.6, Z_FAR = 42, SEG = 2.2;
      var NB = Math.ceil(Z_FAR / SEG) + 2;
      var CURVE_K = 0.55, CX = W / 2;
      var K_CAR = Z0 / (Z0 + Z_CAR), Y_CAR = HZ + (RB - HZ) * K_CAR;
      var ROW = { y: 434, h: 44 };                // lane label row
      var BAR = { x: 150, y: 498, w: 794, h: 18 };
      var LANE_COL = [C.teal, C.sky, C.purple, C.orange];

      // ---------------- thresholds & classification ----------------------
      var SAT = thrOf(api.data, 'sat', DEF_SAT);
      var SAP = thrOf(api.data, 'sap_commercial_ceiling', DEF_SAP);
      if (!(SAT > 0)) SAT = DEF_SAT;
      if (!(SAP > SAT)) SAP = Math.max(DEF_SAP, SAT * 4);
      var T2 = [500000, 1000000, 5000000];

      function classify(total, sap) {
        total = Math.abs(Number(total) || 0);
        if (total <= SAT) return 'I';
        if (total <= T2[2]) return 'II';
        if (sap && total <= SAP) return 'II';
        if (total <= T3[3]) return 'III';
        return 'IV';
      }
      // hard territory: within 10% of a class line (SAT, $5M, SaP, $100M), or the $5M-to-SaP band where the SaP nuance decides
      function tight(total) {
        var lines = [SAT, T2[2], SAP, T3[3]];
        for (var i = 0; i < lines.length; i++) if (Math.abs(total - lines[i]) <= lines[i] * 0.1) return true;
        return total > T2[2] && total <= SAP;
      }
      // repository items carry a curated difficulty; older data without one is rated roughly by the same rules
      function rateCard(c) {
        if (c.difficulty >= 1 && c.difficulty <= 3) return c.difficulty;
        var t = (c.label + ' ' + c.facts.join(' ')).toLowerCase().replace(/\bno (priced )?options?\b|\bno ceiling\b|purchase order/g, ' ');
        if (tight(c.total) || /ceiling|not-to-exceed|deobligat|deduct|anticipated/.test(t)) return 3;
        return /option|order|call|modification/.test(t) ? 2 : 1;
      }
      function tierLabel(total, sap) {
        total = Math.abs(Number(total) || 0);
        var i;
        if (total <= SAT) return 'SAT (' + api.money(SAT) + ')';
        for (i = 0; i < T2.length; i++) if (total <= T2[i]) return api.money(T2[i]);
        if (sap && total <= SAP) return 'SaP (' + api.money(SAP) + ')';
        for (i = 0; i < T3.length; i++) if (total <= T3[i]) return api.money(T3[i]);
        for (i = 0; i < T4.length; i++) if (total <= T4[i]) return api.money(T4[i]);
        return 'Unlimited';
      }
      function boundary(total, sap) {
        var cls = classify(total, sap), tier = tierLabel(total, sap);
        var s = 'The warrant has to be greater than or equal to the cumulative instrument value of ' + dollars(total) + '. ';
        if (cls === 'I') return s + 'That is at or below the SAT of ' + dollars(SAT) + ', so Class I — a SAT warrant — is the smallest class that can sign it.';
        if (cls === 'II') return s + 'That is above the SAT of ' + dollars(SAT) + ', and the smallest Class II tier that reaches it is ' + tier + '. Class II tiers are $500K, $1M, $5M and SaP.';
        if (cls === 'III') return s + 'No Class II tier reaches it' + (sap ? ' — even the SaP ceiling of ' + dollars(SAP) + ' falls short' : ' (without the SaP authority the top Class II tier is $5M)') + ', so the smallest tier that does is the Class III ' + tier + ' tier. Class III is $10M, $25M, $50M and $100M.';
        return s + 'That is above the top Class III tier of $100M, so it takes a Class IV warrant at the ' + tier + ' tier. Class IV is $250M, $500M and Unlimited.';
      }

      // ---------------- procedural items ---------------------------------
      var NOUNS = ['grounds maintenance', 'vehicle spare parts', 'IT help desk support', 'range instrumentation',
        'dining facility support', 'facility repairs', 'medical supplies', 'training support services',
        'fuel delivery', 'transportation services', 'base operations support', 'aircraft component overhaul'];

      function round10k(n) { return Math.max(10000, Math.round(n / 10000) * 10000); }

      function genItem(i) {
        var noun = api.pick(NOUNS) || 'supplies';
        var kind = i % 6;                       // even spread of the six archetypes
        var facts = [], label = '', total = 0, sap = false, arith = '', deductive = false;

        if (kind === 0) {                        // base + priced options
          var base = round10k(api.pick([120000, 180000, 240000, 310000, 420000, 650000, 900000, 1200000, 2400000, 3400000]));
          var nOpt = api.randInt(1, 4);
          var opt = round10k(base * api.pick([0.8, 1, 1, 1.15]));
          total = base + nOpt * opt;
          label = 'Practice · base year with ' + nOpt + ' priced option ' + (nOpt > 1 ? 'years' : 'year');
          facts.push('Base year ' + dollars(base) + ' for ' + noun + '.');
          facts.push(nOpt + ' one-year option' + (nOpt > 1 ? 's' : '') + ' priced at ' + dollars(opt) + ' each.');
          facts.push('Options are priced and evaluated in the solicitation; none exercised at award.');
          arith = 'Base ' + dollars(base) + ' + ' + nOpt + ' × ' + dollars(opt) + ' in priced options = ' + dollars(total) +
            '. Para 4.2 counts base plus all options at award even though no option money is obligated yet. ';
        } else if (kind === 1) {                 // IDIQ ceiling
          var ceil = api.pick([12000000, 24000000, 48000000, 95000000, 180000000, 260000000, 600000000, 1100000000]);
          var minG = api.pick([2500, 5000, 15000]);
          total = ceil;
          label = 'Practice · single-award IDIQ with an ordering ceiling';
          facts.push('Single-award indefinite-delivery indefinite-quantity contract for ' + noun + '.');
          facts.push('Maximum ordering ceiling ' + dollars(ceil) + ' over a five-year ordering period.');
          facts.push('Minimum guarantee ' + dollars(minG) + '; no orders issued at award.');
          arith = 'Para 4.2 counts any ceiling, so the instrument value is the full ' + dollars(ceil) +
            ' ceiling — not the ' + dollars(minG) + ' minimum guarantee and not the money obligated today. ';
        } else if (kind === 2) {                 // modification: the contract's value plus the absolute value of the modification
          var cval = api.pick([180000, 240000, 900000, 4200000, 18000000, 32000000, 140000000, 250000000]);
          var mag = api.pick([1200, 45000, 260000, 480000, 2100000, 6500000, 14000000]);
          var down = api.rand(0, 1) < 0.45;
          if (down && mag >= cval) mag = Math.round(cval * 0.2);   // a deduction cannot exceed the contract it reduces
          deductive = down;
          total = cval + mag;
          label = 'Practice · bilateral modification on a ' + api.money(cval) + ' contract';
          facts.push('Existing contract with a total value of ' + dollars(cval) + '.');
          facts.push('Bilateral modification ' + (down ? 'deobligates ' : 'adds work worth ') + dollars(mag) + '.');
          facts.push('The modification is the only instrument being signed today.');
          // Policy v12 para 4.2 and its Summary of Key Changes: for a modification the warrant must be equal to or
          // greater than the cumulative value of the contract including the modification
          arith = 'For a modification the warrant must cover the cumulative value of the contract including the modification' +
            (down ? ', and a deductive modification counts at its absolute value' : '') + ': ' +
            dollars(cval) + ' + ' + dollars(mag) + ' = ' + dollars(total) + '. ';
        } else if (kind === 3) {                 // order against a vehicle
          var ord = api.pick([42000, 96000, 240000, 330000, 410000, 780000, 2600000, 6400000, 11000000]);
          var parent = api.pick([95000000, 240000000, 600000000]);
          total = ord;
          label = 'Practice · order against an existing contract vehicle';
          facts.push('Delivery order for ' + noun + ' against a multiple-award IDIQ with a ' + dollars(parent) + ' ceiling.');
          facts.push('Order amount ' + dollars(ord) + '. No options on the order, no not-to-exceed ceiling.');
          facts.push('You are signing the order, not the parent contract.');
          arith = 'The instrument you are signing is the ' + dollars(ord) + ' order; the ' + dollars(parent) +
            ' parent ceiling belongs to whoever signed the contract. ';
        } else if (kind === 5) {                 // one plain award, clearly inside a class
          var amt = api.pick([48000, 96000, 175000, 240000, 620000, 1400000, 2800000, 16000000, 38000000, 64000000, 180000000, 420000000]);
          total = amt;
          label = 'Practice · single firm-fixed-price award';
          facts.push('Firm-fixed-price award for ' + noun + '.');
          facts.push('Award amount ' + dollars(amt) + '. No options, no ceiling, not a modification.');
          arith = 'Nothing to add: the instrument value is the ' + dollars(amt) + ' award itself. ';
        } else {                                 // commercial SaP award
          sap = true;
          var b2 = api.pick([1800000, 2400000, 3100000, 4200000, 5400000]);
          var o2 = round10k(b2 * api.pick([0.35, 0.6, 0.9]));
          var n2 = api.randInt(1, 3);
          total = b2 + n2 * o2;
          label = 'Practice · commercial buy under simplified procedures';
          facts.push('Commercial services (' + noun + ') acquired under simplified procedures for commercial products and commercial services.');
          facts.push('Base year ' + dollars(b2) + ' plus ' + n2 + ' priced option year' + (n2 > 1 ? 's' : '') + ' at ' + dollars(o2) + ' each.');
          facts.push('Cumulative base plus all options is ' + dollars(total) + '.');
          arith = 'Base ' + dollars(b2) + ' + ' + n2 + ' × ' + dollars(o2) + ' = ' + dollars(total) +
            '. This one is bought under the SaP authority, so the SaP tier is in play. ';
        }

        if (!sap && total > T2[2] && total <= SAP) {
          // the deciding fact goes second so the card never cuts it off
          facts.splice(1, 0, 'Non-commercial requirement: the SaP authority (simplified procedures for commercial products and commercial services) does not apply.');
        }

        // difficulty: 1 plain award, 2 options or an order/mod under a vehicle, 3 ceilings, deductive mods, SaP nuance, near a class line
        var diff = kind === 5 ? 1 : 2;
        if (kind === 1 || deductive || tight(Math.abs(total)) || (sap && total > T2[2])) diff = 3;

        return {
          id: 'GEN' + i,
          label: label,
          facts: facts,
          total: Math.abs(total),
          cls: classify(total, sap),
          difficulty: diff,
          explanation: arith + boundary(total, sap) +
            '\n\nCumulative instrument value is base plus all options plus any ceiling plus the absolute value of a modification.' +
            '\n\nThis item was generated for practice from the thresholds in the repository (SAT ' + dollars(SAT) + ', SaP ceiling ' + dollars(SAP) + '); the rule and the tiers are from the policy.',
          gen: true,
          classes: ladderClasses(null, classify(total, sap))
        };
      }

      // ---------------- pool ---------------------------------------------
      // every repository item plus the practice items; api.progress.pick chooses each action for the current level
      var pool = (function () {
        var repo = ladderCards(api.data);
        var gen = [], seen = {}, i, tries, made;
        for (i = 0; i < repo.length; i++) { repo[i].difficulty = rateCard(repo[i]); seen[repo[i].total] = 1; }
        for (i = 0; i < GEN_ITEMS; i++) {
          for (tries = 0; tries < 6; tries++) {
            made = null;
            try { made = genItem(i); } catch (e) { made = null; }       // never throw on odd data
            if (!made) break;
            if (!seen[made.total]) break;                                // no two cards with the same figure
            made = null;
          }
          if (made) { seen[made.total] = 1; gen.push(made); }
        }
        return repo.concat(gen);
      })();
      var TARGET = ROUND_ITEMS;

      // ---------------- state --------------------------------------------
      var LIVES = (api.difficulty && api.difficulty.lives) || 3;   // lives come from the chosen level
      var st = {
        idx: -1, item: null, gate: null,
        lane: 1, wx: LANE_WX[1], tilt: 0,
        boost: 0, scroll: 0, dist: 0, bend: 0, lvlT: 0,
        combo: 1, correct: 0, answered: 0, lives: LIVES, over: false,
        traffic: [], spawnT: 3.2,
        crash: 0, crashRot: 0, crashHop: 0,
        fb: null, fbT: 0, gap: 0,
        cardT: 0, hintT: 3.4,
        dragX: 0, dragged: false
      };
      api.hud.set({ lives: LIVES, maxLives: LIVES, combo: 1, level: api.progress.level, time: null, progress: 0 });

      // ---------------- perspective --------------------------------------
      function kOf(z) { if (z < -Z0 + 0.35) z = -Z0 + 0.35; return Z0 / (Z0 + z); }
      function ky(k) { return HZ + (RB - HZ) * k; }
      function curveAt(z) { return st.bend * z * z * CURVE_K; }
      function xOf(wx, k, z) { return CX + (wx + curveAt(z)) * k; }
      function fade(k) { return api.clamp((k - 0.052) / 0.055, 0, 1); }

      // ---------------- scenery -------------------------------------------
      var stars = [], skyline = [], posts = [];
      (function () {
        var i;
        for (i = 0; i < 70; i++) stars.push({ x: api.rand(0, W), y: api.rand(6, HZ - 14), r: api.rand(0.5, 1.7), p: api.rand(0, 6.28) });
        for (i = 0; i < 34; i++) skyline.push({ x: i * 30 + api.rand(-8, 8), w: api.rand(14, 30), h: api.rand(8, 44), kind: i % 4 });
        for (i = 0; i < 14; i++) posts.push({ z: i * (Z_FAR / 14), side: i % 2 ? 1 : -1 });
      })();

      // ---------------- gameplay ------------------------------------------
      function setLane(n) {
        n = api.clamp(Math.round(n), 0, 3);
        if (n === st.lane || st.over || st.crash > 0) return;
        st.lane = n;
        api.audio.blip();
      }

      function nextItem() {
        if (st.answered >= ROUND_ITEMS) { finish('cap'); return; }
        var it = api.progress.pick(pool);                // an unseen action whose difficulty matches the current level
        if (!it) { finish('cap'); return; }
        st.idx++;
        st.item = it;
        st.cardT = 0;
        st.gate = { z: Z_FAR, resolved: false, chosen: -1, correctLane: CLASSES.indexOf(st.item.cls), openT: 0, shatter: 0 };
        if (st.gate.correctLane < 0) st.gate.correctLane = 0;
        api.audio.whoosh();
        if (api.ready) api.ready({ text: (st.item.label || '') + ' ' + [].concat(st.item.facts || []).join(' '), delay: 0.9 });   // let the card slide in, then pause on easier levels
      }

      function resolve() {
        var g = st.gate, it = st.item;
        if (!g || !it || g.resolved) return;
        g.resolved = true;
        g.chosen = st.lane;
        var given = CLASSES[st.lane] || 'I';
        var ok = given === it.cls;
        st.answered++;

        api.review.add({
          prompt: it.label + ' — ' + api.money(it.total),
          correct: 'Class ' + it.cls,
          given: 'Class ' + given,
          ok: ok,
          explanation: it.explanation,
          cite: CITE
        });

        var gy = ky(kOf(Math.max(g.z, 0))), gx = xOf(LANE_WX[st.lane], kOf(Math.max(g.z, 0)), Math.max(g.z, 0));
        st.fb = { ok: ok, item: it, given: given };
        st.fbT = ok ? 1.15 : 2.8;

        if (ok) {
          st.correct++;
          api.score(140 * st.combo);
          st.combo = Math.min(9, st.combo + 1);
          st.boost = 1;                                  // exhaust flare only; the road pace never changes
          api.audio.correct();
          api.particles.emit({ x: gx, y: gy - 40, n: 34, color: [C.green, C.gold2, C.white], speed: 340, life: .8, size: 6, gravity: 90, shape: 'spark' });
          api.particles.emit({ x: xOf(st.wx, K_CAR, Z_CAR), y: Y_CAR - 20, n: 16, color: [C.gold, C.teal], speed: 200, life: .6, size: 5, gravity: 40 });
          api.hud.set({ combo: st.combo, banner: 'Class ' + it.cls + ' · gate open', sub: 'Smallest class that covers ' + api.money(it.total), bannerTime: 1.0 });
          if (api.progress.correct()) {                  // level up: the shell updates the HUD level, banner and fanfare
            st.lvlT = 2.4;
            api.particles.emit({ x: CARD.x + CARD.w - 150, y: CARD.y + CARD.h - 16, n: 26, color: [C.gold2, C.sky, C.white], speed: 260, life: .9, size: 5, gravity: 60, shape: 'spark' });
          }
        } else {
          st.combo = 1;
          st.crash = 1.5;
          st.crashRot = 0;
          st.crashHop = 0;
          st.boost = 0;
          g.shatter = 1;
          api.audio.boom();
          api.shake(18);
          api.flash('rgba(255,107,107,.32)');
          api.particles.emit({ x: gx, y: gy - 46, n: 30, color: [C.red, C.orange, C.gold], speed: 320, life: .8, size: 6, gravity: 340 });
          api.particles.emit({ x: xOf(st.wx, K_CAR, Z_CAR), y: Y_CAR - 26, n: 22, color: ['#8b93a6', '#5a6377', C.orange], speed: 190, life: 1.1, size: 8, gravity: -40 });
          api.hud.set({ combo: 1, banner: 'Class ' + it.cls + ', not Class ' + given, sub: shortExp(it.explanation, 150), bannerTime: 2.6 });
          st.lives = api.life(-1);
          if (st.lives <= 0) { finish('wreck'); return; }
        }
        // the round ends naturally once the last gate has flown past and its
        // explanation has been on screen (nextItem -> finish('cap') after ROUND_ITEMS actions)
        api.hud.set({ progress: st.answered / Math.max(1, TARGET) });
      }

      function finish(reason) {
        if (st.over) return;
        st.over = true;
        var lvl = Math.min(3, Math.max(1, api.progress.level || 1));
        var msg = 'You signed ' + st.correct + ' of ' + st.answered + ' actions from the right lane and reached level ' + lvl + ' (' + LEVEL_NAMES[lvl - 1].toLowerCase() + ' questions).';
        if (reason === 'wreck') api.end({ won: false, title: 'Wrecked at the gate', message: msg + ' Every miss is explained below.' });
        else api.end({ won: st.lives > 0 && st.correct >= Math.ceil(st.answered * 0.6), title: 'Run complete', message: msg });
      }

      function spawnTraffic() {
        if (st.traffic.length >= 4) return;
        var bad = [0, 1, 2, 3], i;
        if (st.gate && !st.gate.resolved) {
          bad = [];
          for (i = 0; i < 4; i++) if (i !== st.gate.correctLane) bad.push(i);
          if (st.gate.z < 20) return;                 // never ambush a live decision
        }
        var lane = api.pick(bad);
        if (lane == null) return;
        for (i = 0; i < st.traffic.length; i++) if (Math.abs(st.traffic[i].z - Z_FAR) < 5) return;
        st.traffic.push({ z: Z_FAR, wx: LANE_WX[lane] + api.rand(-18, 18), lane: lane, hit: false, truck: api.rand(0, 1) < 0.42, hue: api.pick(['#38455f', '#2f3a52', '#44506b']) });
      }

      function hitTraffic(t) {
        t.hit = true;
        st.combo = 1;
        api.score(-25);
        api.audio.boom();
        api.shake(11);
        api.particles.emit({ x: xOf(st.wx, K_CAR, Z_CAR), y: Y_CAR - 24, n: 18, color: [C.orange, C.gold, '#8b93a6'], speed: 250, life: .7, size: 6, gravity: 220 });
        api.hud.set({ combo: 1, banner: 'Traffic', sub: 'Change lanes early — the gate does not wait', bannerTime: 1.0 });
        st.crashHop = 10;
      }

      // ---------------- update ---------------------------------------------
      function update(dt) {
        if (st.over) return;
        if (st.hintT > 0) st.hintT -= dt;

        // pace: the boost after a correct call is an exhaust flare only; a crash makes the car crawl
        if (st.boost > 0) st.boost = Math.max(0, st.boost - dt * 0.9);
        if (st.crash > 0) {
          st.crash = Math.max(0, st.crash - dt);
          st.crashRot += dt * (2.6 + st.crash * 4.5);
          st.crashHop = Math.max(0, st.crashHop - dt * 30);
        } else if (st.crashHop > 0) st.crashHop = Math.max(0, st.crashHop - dt * 40);
        var crawl = st.crash > 0 ? 0.3 + (1 - st.crash / 1.5) * 0.5 : 1;
        var v = SPEED * crawl;                         // one pace for the whole run; only a crash slows it

        st.dist += v * dt;
        st.scroll += v * dt;
        st.bend = Math.sin(st.dist * 0.06) * 0.55 + Math.sin(st.dist * 0.023 + 1.3) * 0.45;

        // car lateral tween
        var target = LANE_WX[st.lane];
        var d = target - st.wx;
        st.wx += d * Math.min(1, dt * 8);
        st.tilt = api.clamp(d * 0.0018, -0.34, 0.34);
        if (st.cardT < 1) st.cardT = Math.min(1, st.cardT + dt * 2.2);
        if (st.fbT > 0) st.fbT -= dt;
        if (st.lvlT > 0) st.lvlT -= dt;

        // gate
        if (st.gate) {
          var g = st.gate;
          g.z -= v * dt;
          if (g.resolved && g.openT < 1) g.openT = Math.min(1, g.openT + dt * 3.2);
          if (g.shatter > 0) g.shatter = Math.max(0, g.shatter - dt * 1.4);
          if (!g.resolved && g.z <= Z_CAR) { resolve(); if (st.over) return; }
          if (g.z < -1.6 && st.fbT <= 0) { st.gate = null; st.item = null; st.fb = null; st.gap = 0.3; }
        } else if (st.gap > 0) {
          st.gap -= dt;
        } else {
          nextItem();
          if (st.over) return;
        }

        // traffic
        st.spawnT -= dt;
        if (st.spawnT <= 0) { spawnTraffic(); st.spawnT = api.rand(2.6, 4.6); }   // same traffic density at every level
        for (var i = st.traffic.length - 1; i >= 0; i--) {
          var t = st.traffic[i];
          t.z -= (v - SPEED * 0.45) * dt;
          if (!t.hit && st.crash <= 0 && Math.abs(t.z - Z_CAR) < 1.0 && Math.abs(t.wx - st.wx) < 112) hitTraffic(t);
          if (t.z < -1.5) st.traffic.splice(i, 1);
        }
      }

      // ================= drawing ===========================================
      function clampLines(ctx, str, size, weight, maxW, maxLines, fam) {
        ctx.save();
        ctx.font = api.font(size, fam || 'body', weight);
        var ls = api.wrap(ctx, str == null ? '' : str, maxW);
        ctx.restore();
        if (ls.length > maxLines) { ls = ls.slice(0, maxLines); ls[maxLines - 1] = ls[maxLines - 1] + ' …'; }
        return ls;
      }

      function drawSky(ctx) {
        var g = ctx.createLinearGradient(0, 0, 0, HZ);
        g.addColorStop(0, '#05080f');
        g.addColorStop(0.62, '#0a1122');
        g.addColorStop(1, '#1a2440');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, HZ);

        ctx.save();
        ctx.fillStyle = '#ffffff';
        for (var i = 0; i < stars.length; i++) {
          var s = stars[i];
          ctx.globalAlpha = 0.20 + Math.abs(Math.sin(s.p + st.dist * 0.05)) * 0.45;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // low sun behind the vanishing point
        var vx = CX + st.bend * 90;
        var sg = ctx.createRadialGradient(vx, HZ, 4, vx, HZ, 220);
        sg.addColorStop(0, 'rgba(226,182,87,.30)');
        sg.addColorStop(0.45, 'rgba(226,182,87,.08)');
        sg.addColorStop(1, 'rgba(226,182,87,0)');
        ctx.fillStyle = sg; ctx.fillRect(0, HZ - 150, W, 152);

        // distant skyline
        ctx.save();
        ctx.globalAlpha = 0.55; ctx.fillStyle = '#111a30';
        var off = (st.dist * 1.6 + st.bend * 60) % 30;
        for (var b = 0; b < skyline.length; b++) {
          var bd = skyline[b], x = bd.x - off, top = HZ - bd.h;
          if (x > W + 20) x -= 34 * 30;
          ctx.fillRect(x, top, bd.w, bd.h);
          if (bd.kind === 0) { ctx.beginPath(); ctx.moveTo(x - 2, top); ctx.lineTo(x + bd.w / 2, top - 6); ctx.lineTo(x + bd.w + 2, top); ctx.closePath(); ctx.fill(); }
          else if (bd.kind === 1) { ctx.fillRect(x + bd.w / 2 - 1, top - 9, 2, 9); }
        }
        ctx.restore();

        // horizon line
        ctx.strokeStyle = 'rgba(226,182,87,.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, HZ + 0.5); ctx.lineTo(W, HZ + 0.5); ctx.stroke();
      }

      function drawRoad(ctx) {
        var gg = ctx.createLinearGradient(0, HZ, 0, RB);
        gg.addColorStop(0, '#0a1122'); gg.addColorStop(1, '#05080f');
        ctx.fillStyle = gg; ctx.fillRect(0, HZ, W, RB - HZ + 2);

        var off = st.scroll % SEG, base = Math.floor(st.scroll / SEG);
        for (var n = NB - 1; n >= 0; n--) {
          var za = n * SEG - off, zb = za + SEG;
          if (zb <= 0.002) continue;
          if (za < 0) za = 0;
          var ka = kOf(za), kb = kOf(zb);
          var ya = ky(ka), yb = ky(kb);
          if (ya - yb < 0.4 && n > 5) continue;
          var dark = ((n + base) % 2) === 0;

          // verge
          ctx.fillStyle = dark ? 'rgba(143,198,255,.030)' : 'rgba(0,0,0,.16)';
          ctx.fillRect(0, yb, W, ya - yb + 1.2);

          var alx = xOf(-HW, ka, za), arx = xOf(HW, ka, za);
          var blx = xOf(-HW, kb, zb), brx = xOf(HW, kb, zb);

          quad(ctx, alx, ya, arx, ya, brx, yb, blx, yb, dark ? '#161f33' : '#111828');

          // rumble strips
          var ra = 20 * ka, rb = 20 * kb, rc = dark ? '#e8edf6' : '#c9556a';
          quad(ctx, alx - ra, ya, alx, ya, blx, yb, blx - rb, yb, rc);
          quad(ctx, arx, ya, arx + ra, ya, brx + rb, yb, brx, yb, rc);

          // lane dashes
          if (dark) {
            for (var L = 0; L < 3; L++) {
              var wx = -200 + L * 200, hwid = 6;
              quad(ctx, xOf(wx - hwid, ka, za), ya, xOf(wx + hwid, ka, za), ya,
                xOf(wx + hwid, kb, zb), yb, xOf(wx - hwid, kb, zb), yb, L === 1 ? 'rgba(226,182,87,.55)' : 'rgba(255,255,255,.42)');
            }
          }
        }

        // roadside light posts
        for (var p = 0; p < posts.length; p++) {
          var po = posts[p];
          var pz = ((po.z - st.scroll) % Z_FAR + Z_FAR) % Z_FAR;
          if (pz < 0.2) continue;
          var kk = kOf(pz), yy = ky(kk), a = fade(kk);
          if (a <= 0.02) continue;
          var px = xOf(po.side * (HW + 90), kk, pz), hgt = 150 * kk;
          ctx.save(); ctx.globalAlpha = a * 0.8;
          ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = Math.max(1, 6 * kk);
          ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(px, yy - hgt); ctx.stroke();
          api.glow(ctx, C.gold, 16 * kk + 4);
          ctx.fillStyle = C.gold2;
          ctx.beginPath(); ctx.arc(px - po.side * 6 * kk, yy - hgt, Math.max(1.4, 7 * kk), 0, Math.PI * 2); ctx.fill();
          api.noGlow(ctx);
          ctx.restore();
        }
      }

      function quad(ctx, x1, y1, x2, y2, x3, y3, x4, y4, fill) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
      }

      function drawGate(ctx) {
        var g = st.gate, it = st.item;
        if (!g || !it || g.z < -1.6) return;
        var z = g.z, k = kOf(z), y = ky(k), a = fade(k);
        if (a <= 0.02) return;
        ctx.save();
        ctx.globalAlpha = a;

        var beamY = y - 178 * k;
        // top beam
        var bl = xOf(-HW - 26, k, z), br = xOf(HW + 26, k, z);
        api.glow(ctx, C.gold, 20 * k + 4);
        ctx.fillStyle = 'rgba(226,182,87,.85)';
        ctx.fillRect(bl, beamY, br - bl, Math.max(2, 16 * k));
        api.noGlow(ctx);
        if (k > 0.45) {
          api.text(ctx, api.money(it.total), xOf(0, k, z), beamY - 8 * k, {
            size: Math.round(api.clamp(34 * k, 16, 34)), fam: 'mono', weight: 700, align: 'center', baseline: 'alphabetic', color: C.gold2, shadow: 'rgba(0,0,0,.8)'
          });
        }

        for (var i = 0; i < 4; i++) {
          var wx = LANE_WX[i];
          var px1 = xOf(wx - 92, k, z), px2 = xOf(wx + 92, k, z);
          var top = y - 150 * k;
          var open = 0;
          if (g.resolved && (i === g.correctLane)) open = g.openT;
          var col = LANE_COL[i], mode = 'live';
          if (g.resolved) {
            if (i === g.correctLane) { col = C.green; mode = 'good'; }
            else if (i === g.chosen) { col = C.red; mode = 'bad'; }
            else { col = C.muted; mode = 'dim'; }
          } else if (i === st.lane) { col = C.gold2; }

          ctx.save();
          if (mode === 'dim') ctx.globalAlpha = a * 0.4;
          if (mode === 'bad' && g.shatter > 0) ctx.globalAlpha = a * (0.35 + 0.65 * (1 - g.shatter));

          // barrier panel (lifts when the gate opens)
          var ph = (y - top) * (1 - open);
          if (ph > 1) {
            var gd = ctx.createLinearGradient(0, y - ph, 0, y);
            gd.addColorStop(0, 'rgba(255,255,255,.03)');
            gd.addColorStop(1, hexA(col, .22));
            ctx.fillStyle = gd;
            ctx.fillRect(px1, y - ph, px2 - px1, ph);
            // chevrons
            ctx.save();
            ctx.beginPath(); ctx.rect(px1, y - ph, px2 - px1, ph); ctx.clip();
            ctx.strokeStyle = hexA(col, .30); ctx.lineWidth = Math.max(1, 8 * k);
            for (var cvx = px1 - ph; cvx < px2 + ph; cvx += Math.max(10, 34 * k)) {
              ctx.beginPath(); ctx.moveTo(cvx, y); ctx.lineTo(cvx + ph, y - ph); ctx.stroke();
            }
            ctx.restore();
            ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, 3 * k);
            ctx.strokeRect(px1, y - ph, px2 - px1, ph);
          }
          // uprights
          api.glow(ctx, col, 18 * k + 4);
          ctx.fillStyle = col;
          ctx.fillRect(px1 - 5 * k, top, Math.max(1.5, 9 * k), y - top);
          ctx.fillRect(px2 - 4 * k, top, Math.max(1.5, 9 * k), y - top);
          api.noGlow(ctx);

          // class plate
          if (k > 0.30) {
            var ps = Math.round(api.clamp(46 * k, 16, 46));
            var plateY = top + (y - top) * 0.42;
            api.text(ctx, CLASSES[i], xOf(wx, k, z), plateY, {
              size: ps, fam: 'display', weight: 400, align: 'center', baseline: 'middle',
              color: mode === 'dim' ? C.ink2 : C.ink, shadow: 'rgba(0,0,0,.85)'
            });
            if (k > 0.55) {
              api.text(ctx, 'CLASS', xOf(wx, k, z), plateY - ps * 0.72, {
                size: 16, fam: 'mono', weight: 700, align: 'center', baseline: 'middle', color: col, alpha: .95
              });
              api.text(ctx, tierRow(i), xOf(wx, k, z), plateY + ps * 0.66, {
                size: 16, weight: 700, align: 'center', baseline: 'middle', color: C.ink2, maxWidth: Math.max(60, (px2 - px1) - 8)
              });
            }
          }
          ctx.restore();
        }
        ctx.restore();
      }

      function hexA(hex, a) {
        var h = String(hex || '#ffffff').replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        var r = parseInt(h.slice(0, 2), 16) || 255, g2 = parseInt(h.slice(2, 4), 16) || 255, b = parseInt(h.slice(4, 6), 16) || 255;
        return 'rgba(' + r + ',' + g2 + ',' + b + ',' + a + ')';
      }

      function tierRow(i) {
        if (i === 0) return 'to ' + api.money(SAT);
        if (i === 1) return 'to ' + api.money(SAP);
        if (i === 2) return 'to $100M';
        return 'to Unlimited';
      }

      function drawTraffic(ctx, t) {
        var k = kOf(t.z), y = ky(k), a = fade(k);
        if (a <= 0.02) return;
        var x = xOf(t.wx, k, t.z);
        var bw = (t.truck ? 150 : 122) * k, bh = (t.truck ? 96 : 66) * k;
        ctx.save();
        ctx.globalAlpha = a * (t.hit ? 0.4 : 1);
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        ctx.beginPath(); ctx.ellipse(x, y, bw * 0.55, Math.max(1.5, 8 * k), 0, 0, Math.PI * 2); ctx.fill();
        api.roundRect(ctx, x - bw / 2, y - bh, bw, bh, Math.max(2, 10 * k));
        ctx.fillStyle = t.hue; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = Math.max(1, 2 * k); ctx.stroke();
        // rear window / cargo door
        api.roundRect(ctx, x - bw * 0.36, y - bh + bh * (t.truck ? 0.14 : 0.16), bw * 0.72, bh * (t.truck ? 0.5 : 0.34), Math.max(1.5, 6 * k));
        ctx.fillStyle = t.truck ? 'rgba(255,255,255,.10)' : 'rgba(10,18,34,.85)'; ctx.fill();
        // tail lights
        api.glow(ctx, C.red, 12 * k + 3);
        ctx.fillStyle = C.red;
        api.roundRect(ctx, x - bw * 0.44, y - bh * 0.30, bw * 0.17, Math.max(2, bh * 0.12), Math.max(1, 3 * k)); ctx.fill();
        api.roundRect(ctx, x + bw * 0.27, y - bh * 0.30, bw * 0.17, Math.max(2, bh * 0.12), Math.max(1, 3 * k)); ctx.fill();
        api.noGlow(ctx);
        ctx.restore();
      }

      function drawBeams(ctx) {
        var cx = xOf(st.wx, K_CAR, Z_CAR);
        var kf = kOf(18), yf = ky(kf), xf = xOf(st.wx, kf, 18);
        var g = ctx.createLinearGradient(0, Y_CAR, 0, yf);
        g.addColorStop(0, 'rgba(243,213,140,.16)');
        g.addColorStop(1, 'rgba(243,213,140,0)');
        ctx.save();
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx - 44, Y_CAR - 18); ctx.lineTo(cx + 44, Y_CAR - 18);
        ctx.lineTo(xf + 26, yf); ctx.lineTo(xf - 26, yf);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      function drawCar(ctx) {
        var k = K_CAR, cx = xOf(st.wx, k, Z_CAR), cy = Y_CAR;
        ctx.save();
        ctx.globalAlpha = 0.42; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(cx, cy + 2, 76 * k, 13 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // speed streaks
        ctx.save();
        ctx.strokeStyle = 'rgba(143,198,255,.30)';
        var sp = 1 + st.boost;
        for (var s = 0; s < 5; s++) {
          var sy = cy - 24 - s * 22, len = (26 + ((st.dist * 40 + s * 41) % 44)) * sp;
          ctx.lineWidth = 2.4 - s * 0.3;
          ctx.beginPath(); ctx.moveTo(cx - 104 - len, sy); ctx.lineTo(cx - 104, sy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx + 104, sy); ctx.lineTo(cx + 104 + len, sy); ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.translate(cx, cy - st.crashHop);
        ctx.scale(k, k);
        if (st.crash > 0) ctx.rotate(st.crashRot);
        else ctx.rotate(-st.tilt * 0.3);

        // exhaust / boost glow
        if (st.boost > 0.02) {
          api.glow(ctx, C.gold, 26);
          ctx.fillStyle = hexA(C.gold2, 0.55 * st.boost);
          ctx.beginPath(); ctx.ellipse(-26, -12, 16, 8 + 10 * st.boost, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(26, -12, 16, 8 + 10 * st.boost, 0, 0, Math.PI * 2); ctx.fill();
          api.noGlow(ctx);
        }

        // wheels
        ctx.fillStyle = '#0c111c';
        api.roundRect(ctx, -76, -40, 22, 38, 7); ctx.fill();
        api.roundRect(ctx, 54, -40, 22, 38, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.14)';
        api.roundRect(ctx, -74, -36 + ((st.dist * 90) % 14), 18, 5, 2); ctx.fill();
        api.roundRect(ctx, 56, -36 + ((st.dist * 90) % 14), 18, 5, 2); ctx.fill();

        // body
        api.glow(ctx, C.gold, 22);
        var bg = ctx.createLinearGradient(0, -86, 0, -6);
        bg.addColorStop(0, C.gold2); bg.addColorStop(0.55, C.gold); bg.addColorStop(1, '#8a6a24');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(-66, -6); ctx.lineTo(-60, -46); ctx.lineTo(-40, -74);
        ctx.lineTo(40, -74); ctx.lineTo(60, -46); ctx.lineTo(66, -6);
        ctx.closePath(); ctx.fill();
        api.noGlow(ctx);
        ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2; ctx.stroke();

        // rear glass
        ctx.beginPath();
        ctx.moveTo(-34, -70); ctx.lineTo(34, -70); ctx.lineTo(42, -48); ctx.lineTo(-42, -48);
        ctx.closePath();
        ctx.fillStyle = 'rgba(10,18,34,.9)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(143,198,255,.16)';
        ctx.beginPath(); ctx.moveTo(-30, -68); ctx.lineTo(-4, -68); ctx.lineTo(-18, -50); ctx.lineTo(-38, -50); ctx.closePath(); ctx.fill();

        // spoiler
        ctx.fillStyle = '#141b2b';
        api.roundRect(ctx, -58, -88, 116, 9, 4); ctx.fill();
        ctx.fillRect(-46, -80, 7, 10); ctx.fillRect(39, -80, 7, 10);

        // stripe
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        ctx.fillRect(-6, -74, 12, 68);

        // tail lights
        api.glow(ctx, C.red, 18);
        ctx.fillStyle = C.red;
        api.roundRect(ctx, -56, -38, 30, 11, 4); ctx.fill();
        api.roundRect(ctx, 26, -38, 30, 11, 4); ctx.fill();
        api.noGlow(ctx);

        // plate
        ctx.fillStyle = 'rgba(6,10,20,.85)';
        api.roundRect(ctx, -24, -26, 48, 16, 3); ctx.fill();
        api.text(ctx, 'KO', 0, -18, { size: 16, fam: 'mono', weight: 700, align: 'center', baseline: 'middle', color: C.ink2 });
        ctx.restore();
      }

      // on-canvas level label, driven by api.progress.level; glows for a moment after a level-up
      function levelTag(ctx, x, y) {
        var lvl = Math.min(3, Math.max(1, api.progress.level || 1)), col = [C.green, C.sky, C.orange][lvl - 1];
        if (st.lvlT > 0) api.glow(ctx, col, 8 + 16 * Math.min(1, st.lvlT));
        api.text(ctx, LEVEL_NAMES[lvl - 1] + ' QUESTIONS', x, y, { size: 16, fam: 'mono', weight: 700, align: 'right', color: col });
        api.noGlow(ctx);
      }

      function drawCard(ctx) {
        var it = st.item, fb = st.fb;
        var slide = (1 - api.ease.outCubic(api.clamp(st.cardT, 0, 1))) * (W + 40);
        ctx.save();
        ctx.translate(slide, 0);

        api.roundRect(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 16);
        ctx.fillStyle = 'rgba(8,13,26,.93)'; ctx.fill();
        ctx.strokeStyle = fb ? (fb.ok ? 'rgba(95,211,154,.6)' : 'rgba(255,107,107,.6)') : 'rgba(255,255,255,.14)';
        ctx.lineWidth = 1.5; ctx.stroke();
        api.roundRect(ctx, CARD.x, CARD.y, 6, CARD.h, 3);
        ctx.fillStyle = fb ? (fb.ok ? C.green : C.red) : C.gold; ctx.fill();

        if (!it) { ctx.restore(); return; }

        var tx = CARD.x + 26, maxW = CARD_SPLIT - tx - 18, i, ls;

        if (fb) {
          var head = fb.ok
            ? '✓ Class ' + fb.item.cls + ' — gate open at ' + api.money(fb.item.total)
            : '✕ Class ' + fb.item.cls + ' signs this, not Class ' + fb.given;
          api.text(ctx, head, tx, CARD.y + 34, { size: 20, weight: 700, color: fb.ok ? C.green : C.red, maxWidth: CARD.w - 70 });
          ls = clampLines(ctx, shortExp(fb.item.explanation, 340), 16, 500, CARD.w - 70, 4);
          for (i = 0; i < ls.length; i++) api.text(ctx, ls[i], tx, CARD.y + 62 + i * 21, { size: 16, weight: 500, color: C.ink2 });
          api.text(ctx, 'Cite · ' + CITE, tx, CARD.y + CARD.h - 12, { size: 16, fam: 'mono', weight: 600, color: C.muted, maxWidth: 600 });
          levelTag(ctx, CARD.x + CARD.w - 24, CARD.y + CARD.h - 12);
          ctx.restore();
          return;
        }

        // label
        ls = clampLines(ctx, it.label, 20, 700, maxW, 1);
        api.text(ctx, ls[0], tx, CARD.y + 32, { size: 20, weight: 700, color: C.ink });

        // facts
        ctx.save(); ctx.font = api.font(16, 'body', 500);
        var lines = [], truncated = false;
        for (i = 0; i < it.facts.length; i++) {
          var w2 = api.wrap(ctx, '· ' + it.facts[i], maxW);
          for (var j = 0; j < w2.length; j++) {
            if (lines.length >= FACT_LINES) { truncated = true; break; }
            lines.push(w2[j]);
          }
          if (lines.length >= FACT_LINES && i < it.facts.length - 1) truncated = true;
        }
        ctx.restore();
        if (truncated && lines.length) lines[lines.length - 1] += ' …';
        for (i = 0; i < lines.length; i++) api.text(ctx, lines[i], tx, CARD.y + 56 + i * 21, { size: 16, weight: 500, color: C.ink2 });

        api.text(ctx, 'Para 4.2 · base + all options + any ceiling + |modification|', tx, CARD.y + CARD.h - 12,
          { size: 16, weight: 600, color: C.muted, maxWidth: maxW });

        // value column
        var rx = CARD.x + CARD.w - 24;
        api.text(ctx, 'ITEM ' + Math.min(st.idx + 1, TARGET) + ' / ' + TARGET + (it.gen ? ' · PRACTICE' : ' · FILE'), rx, CARD.y + 28,
          { size: 16, fam: 'mono', weight: 600, align: 'right', color: C.muted });
        api.text(ctx, 'CUMULATIVE VALUE', rx, CARD.y + 52, { size: 16, fam: 'mono', weight: 700, align: 'right', color: C.gold });
        api.glow(ctx, C.gold, 14);
        api.text(ctx, api.money(it.total), rx, CARD.y + 88, { size: 34, fam: 'mono', weight: 700, align: 'right', color: C.gold2 });
        api.noGlow(ctx);
        api.text(ctx, dollars(it.total) + ' exactly', rx, CARD.y + 106, { size: 16, fam: 'mono', weight: 600, align: 'right', color: C.ink2 });
        levelTag(ctx, rx, CARD.y + 130);
        api.text(ctx, 'smallest class that can sign?', rx, CARD.y + CARD.h - 12, { size: 16, weight: 700, align: 'right', color: C.sky });

        // divider
        ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(CARD_SPLIT, CARD.y + 16); ctx.lineTo(CARD_SPLIT, CARD.y + CARD.h - 16); ctx.stroke();

        // decision meter
        if (st.gate && !st.gate.resolved) {
          var frac = api.clamp((st.gate.z - Z_CAR) / (Z_FAR - Z_CAR), 0, 1);
          api.roundRect(ctx, CARD.x + 22, CARD.y + CARD.h - 5, CARD.w - 44, 4, 2);
          ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fill();
          api.roundRect(ctx, CARD.x + 22, CARD.y + CARD.h - 5, Math.max(3, (CARD.w - 44) * frac), 4, 2);
          ctx.fillStyle = frac > 0.55 ? C.green : frac > 0.26 ? C.gold : C.red; ctx.fill();
        }
        ctx.restore();
      }

      function drawLaneRow(ctx) {
        var names = ['up to SAT ' + api.money(SAT), '$500K/$1M/$5M/SaP', '$10M/$25M/$50M/$100M', '$250M/$500M/Unlimited'];
        for (var i = 0; i < 4; i++) {
          var x = 80 + i * LANE_W, on = (i === st.lane);
          var col = LANE_COL[i];
          api.roundRect(ctx, x + 3, ROW.y, LANE_W - 6, ROW.h, 10);
          ctx.fillStyle = on ? hexA(col, .16) : 'rgba(255,255,255,.035)'; ctx.fill();
          ctx.strokeStyle = on ? col : 'rgba(255,255,255,.10)'; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
          api.text(ctx, 'CLASS ' + CLASSES[i], x + LANE_W / 2, ROW.y + 20,
            { size: 17, weight: 700, align: 'center', color: on ? C.ink : C.ink2 });
          api.text(ctx, names[i], x + LANE_W / 2, ROW.y + 38,
            { size: 16, weight: 600, align: 'center', color: on ? col : C.muted, maxWidth: LANE_W - 18 });
        }
      }

      function drawStrip(ctx) {
        var lo = Math.log(5000), hi = Math.log(2000000000), span = hi - lo;
        function px(v) { return BAR.x + BAR.w * api.clamp((Math.log(Math.max(5200, v)) - lo) / span, 0, 1); }
        var edges = [BAR.x, px(SAT), px(SAP), px(100000000), BAR.x + BAR.w];

        api.text(ctx, 'WHERE IT SITS', 16, BAR.y + 14, { size: 16, fam: 'mono', weight: 700, color: C.muted });

        for (var i = 0; i < 4; i++) {
          var a = edges[i], b = edges[i + 1];
          ctx.fillStyle = hexA(LANE_COL[i], st.item && st.item.cls === CLASSES[i] ? .55 : .22);
          ctx.fillRect(a, BAR.y, Math.max(1, b - a), BAR.h);
          ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1;
          ctx.strokeRect(a + .5, BAR.y + .5, Math.max(1, b - a) - 1, BAR.h - 1);
          if (b - a > 44) api.text(ctx, CLASSES[i], (a + b) / 2, BAR.y + BAR.h / 2 + 1,
            { size: 16, weight: 700, align: 'center', baseline: 'middle', color: C.ink, alpha: .95 });
        }
        // boundary ticks
        var ticks = [[SAT, api.money(SAT)], [5000000, '$5M'], [SAP, api.money(SAP)], [100000000, '$100M']];
        for (var t = 0; t < ticks.length; t++) {
          var tx = px(ticks[t][0]);
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(tx, BAR.y - 3); ctx.lineTo(tx, BAR.y + BAR.h); ctx.stroke();
          api.text(ctx, ticks[t][1], tx, BAR.y - 6, { size: 16, fam: 'mono', weight: 600, align: 'center', color: C.muted });
        }
        // marker
        if (st.item) {
          var mx = px(st.item.total);
          api.glow(ctx, C.gold, 16);
          ctx.strokeStyle = C.gold2; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(mx, BAR.y - 5); ctx.lineTo(mx, BAR.y + BAR.h + 2); ctx.stroke();
          ctx.fillStyle = C.gold2;
          ctx.beginPath();
          var my = BAR.y + BAR.h / 2;
          ctx.moveTo(mx, my - 9); ctx.lineTo(mx + 8, my); ctx.lineTo(mx, my + 9); ctx.lineTo(mx - 8, my);
          ctx.closePath(); ctx.fill();
          api.noGlow(ctx);
          api.text(ctx, api.money(st.item.total), api.clamp(mx, BAR.x + 34, BAR.x + BAR.w - 34), BAR.y + BAR.h + 17,
            { size: 17, fam: 'mono', weight: 700, align: 'center', color: C.gold2, shadow: 'rgba(0,0,0,.85)' });
        }
      }

      function drawHint(ctx) {
        if (st.hintT <= 0) return;
        var al = Math.min(1, st.hintT / 0.8);
        ctx.save(); ctx.globalAlpha = al;
        api.pill(ctx, '← → or A / D pick the lane · tap a side or drag on touch', CX, RB - 26,
          { size: 17, fam: 'body', align: 'center', bg: 'rgba(6,10,20,.86)', stroke: 'rgba(226,182,87,.45)', color: C.ink });
        api.pill(ctx, 'Smallest class that can sign the cumulative value', CX, RB - 62,
          { size: 16, fam: 'body', align: 'center', bg: 'rgba(6,10,20,.7)', stroke: 'rgba(255,255,255,.16)', color: C.ink2 });
        ctx.restore();
      }

      function drawVerdict(ctx) {
        if (!st.fb || st.fbT <= 0) return;
        var f = st.fb, a = Math.min(1, st.fbT / 0.5);
        var lift = (1 - api.clamp(st.fbT / (f.ok ? 1.7 : 2.8), 0, 1)) * 34;
        ctx.save(); ctx.globalAlpha = a;
        api.pill(ctx, (f.ok ? '✓ CLASS ' : '✕ CLASS ') + f.item.cls + (f.ok ? '' : ' — you took ' + f.given),
          xOf(st.wx, K_CAR, Z_CAR), Y_CAR - 132 - lift,
          { size: 18, fam: 'body', align: 'center', bg: f.ok ? 'rgba(20,52,40,.92)' : 'rgba(64,20,26,.92)', stroke: f.ok ? C.green : C.red, color: C.ink });
        ctx.restore();
      }

      function draw(ctx) {
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
        drawSky(ctx);
        drawRoad(ctx);
        drawBeams(ctx);

        // depth-sorted actors
        var list = [], i;
        for (i = 0; i < st.traffic.length; i++) list.push({ z: st.traffic[i].z, t: st.traffic[i] });
        if (st.gate) list.push({ z: st.gate.z, g: 1 });
        list.push({ z: Z_CAR, car: 1 });
        list.sort(function (a, b) { return b.z - a.z; });
        for (i = 0; i < list.length; i++) {
          if (list[i].car) drawCar(ctx);
          else if (list[i].g) drawGate(ctx);
          else drawTraffic(ctx, list[i].t);
        }

        // foreground panel behind the dashboard rows
        ctx.fillStyle = 'rgba(5,8,16,.92)';
        ctx.fillRect(0, RB, W, H - RB);
        ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, RB + 0.5); ctx.lineTo(W, RB + 0.5); ctx.stroke();

        drawLaneRow(ctx);
        drawStrip(ctx);
        drawCard(ctx);
        drawVerdict(ctx);
        drawHint(ctx);
      }

      // ---------------- input ----------------------------------------------
      function onKey(k, down) {
        if (!down || st.over) return;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') setLane(st.lane - 1);
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') setLane(st.lane + 1);
        else if (k === '1' || k === '2' || k === '3' || k === '4') setLane(Number(k) - 1);
      }

      function onPointer(p) {
        if (!p || st.over) return;
        if (p.type === 'down') {
          st.dragX = 0; st.dragged = false;
          if (p.y >= ROW.y - 10 && p.y <= ROW.y + ROW.h + 10) {
            var li = Math.floor((p.x - 80) / LANE_W);
            if (li >= 0 && li < 4) { setLane(li); st.dragged = true; }
          }
        } else if (p.type === 'move' && api.input.pointer.down) {
          st.dragX += p.dx || 0;
          if (st.dragX > 46) { setLane(st.lane + 1); st.dragX = 0; st.dragged = true; }
          else if (st.dragX < -46) { setLane(st.lane - 1); st.dragX = 0; st.dragged = true; }
        } else if (p.type === 'up') {
          if (!st.dragged) setLane(p.x < W / 2 ? st.lane - 1 : st.lane + 1);
          st.dragged = false; st.dragX = 0;
        }
      }

      nextItem();

      return {
        update: update,
        draw: draw,
        onKey: onKey,
        onPointer: onPointer,
        destroy: function () {
          st.traffic.length = 0; st.gate = null; st.item = null; st.fb = null;
          pool = []; stars.length = 0; skyline.length = 0; posts.length = 0;
        }
      };
    }
  });
})();
