/* GAME: boss-board — a boss battle against The Board.
   Three silhouettes sit behind a long table and ask real multiple-choice board
   questions on a per-question timer. A correct answer lands a gavel strike that
   takes the board's HP down; a miss or a timeout draws an objection that costs
   a heart of composure. Every 25% of HP opens a new phase with a different
   domain mix and a little MORE time per question (25, 28, 30, 32 s).
   Question difficulty follows the shell's in-run level (api.progress), not the
   phase: easy questions first, medium after 5 correct answers, hard after 10. */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  // ---- fixed layout rails -------------------------------------------------
  var BOSS_HP = 100;
  var PER_LEVEL = 5;            // correct answers per question level (api.progress)
  var PHASE_MIX_MIN = 2;        // unused on-level questions a phase's domains need before the pick narrows to them
  var LEVEL_NAMES = ['Easy questions', 'Medium questions', 'Hard questions'];
  var DIFF_TAGS = ['EASY', 'MEDIUM', 'HARD'];
  var TOP = 56;                 // the DOM HUD strip covers roughly this much
  var BOTTOM = 530;             // the DOM progress bar sits below this
  var BOARD_TOP = 84;           // highest the heads may reach
  var OPT_X = 46, OPT_W = 868;
  var PANEL_X = 40, PANEL_W = 880;
  var SEAT_X = [188, 480, 772];

  // ---- phases -------------------------------------------------------------
  // A phase sets the domain mix and the clock. The clock never shrinks: each
  // phase allows at least as long as the one before. Question difficulty is not
  // a phase property; it follows api.progress.level.
  var PHASES = [
    {
      name: 'Authority', title: 'Phase 1: Authority', sub: 'Warrants, ethics and the acquisition plan.',
      limit: 25,
      domains: ['Authority, Ethics & Leadership', 'Acquisition Planning & Contract Types', 'Competition & Market Research']
    },
    {
      name: 'Fiscal law', title: 'Phase 2: Fiscal law', sub: 'Purpose, time and amount. Show your work.',
      limit: 28,
      domains: ['Fiscal Law & Funding', 'Pricing, Cost & Payment', 'Grants & Agreements']
    },
    {
      name: 'Source selection', title: 'Phase 3: Source selection', sub: 'Evaluate like the record will be protested.',
      limit: 30,
      domains: ['Source Selection & Evaluation', 'Responsibility & Exclusions', 'Small Business & Socioeconomic', 'Competition & Market Research']
    },
    {
      name: 'The record', title: 'Phase 4: The record', sub: 'Protests, terminations and administration.',
      limit: 32,
      domains: ['Protests, Claims & Disputes', 'Terminations & Remedies', 'Contract Administration', 'Property, Security & Special Provisions', 'Korea, LCS & SOFA', 'Germany ABG-75']
    }
  ];

  var OBJECTIONS = ['Objection.', 'That is not the rule.', 'Check the reference.', 'Not what the record says.', 'The board disagrees.'];
  var CONCURS = ['The board concurs.', 'Noted.', 'Acceptable.', 'Correct.', 'Well cited.'];

  // ---- data ---------------------------------------------------------------
  function cleanMcq(D) {
    var raw = ((D || {}).mcq) || [];
    var out = [], seen = {}, i, j;
    for (i = 0; i < raw.length; i++) {
      var q = raw[i];
      if (!q || !q.stem || !q.options || q.options.length !== 4) continue;
      var opts = [], nOk = 0, bad = false;
      for (j = 0; j < 4; j++) {
        var o = q.options[j];
        if (!o || !o.text) { bad = true; break; }
        if (o.correct) nOk++;
        opts.push({ text: String(o.text), correct: !!o.correct, why: o.why ? String(o.why) : '' });
      }
      if (bad || nOk !== 1) continue;
      var qid = q.qid ? String(q.qid) : ('q' + i);
      if (seen[qid]) continue;            // the qid is the no-repeat key, so keep it unique
      seen[qid] = 1;
      var d = Math.round(Number(q.difficulty));
      out.push({
        qid: qid,
        stem: String(q.stem),
        classes: q.classes,
        options: opts,
        difficulty: (d >= 1 && d <= 3) ? d : 2,   // same rounding and default as api.progress
        cite: q.cite ? String(q.cite) : '',
        domain: q.domain ? String(q.domain) : ''
      });
    }
    return out;
  }

  A.register({
    id: 'boss-board',
    title: 'Boss Board',
    tagline: 'Take the board down one right answer at a time.',
    blurb: 'Three silhouettes behind a long table fire real board questions at you: easy ones first, harder ones every five correct answers, and a little more time each phase. Land a strike for every correct answer, hold your composure through the objections, and survive four phases.',
    controls: '1-4 or A-D answer · click / tap an option · L spends the 50:50 lifeline · Space skips the readout · P pauses',
    icon: '🛡️',
    accent: A.C.red,
    drills: 'Real board questions, easy to hard',
    dataOk: function (D) { return cleanMcq(D).length >= 20; },

    create: function (api) {
      var C = api.C, W = api.W, H = api.H;

      // ---- pool ----------------------------------------------------------
      var POOL = api.shuffle(cleanMcq(api.data));
      var used = {};                                  // qid -> 1: never ask the same question twice in a run
      var START_HEARTS = (api.difficulty && api.difficulty.lives) || 3;   // lives come from the chosen level
      api.progress.configure({ perLevel: PER_LEVEL });

      var st = {
        mode: 'intro',           // intro | ask | strike | object | reveal | phase | done
        mt: 0,                   // mode timer
        modeDur: 1.5,
        phase: 1,
        pendingPhase: 0,         // phase to announce after the reveal
        announced: 0,            // phase already announced in a combined level-up banner
        hp: BOSS_HP, hpShown: BOSS_HP,
        hearts: START_HEARTS,
        combo: 1, bestCombo: 1,
        answered: 0, correct: 0,
        q: null, qn: 0,
        timeLeft: PHASES[0].limit, limit: PHASES[0].limit,
        tickAt: 5, dmg: 0, pts: 0, hitDone: false,
        picked: -1, correctIdx: -1, lastOk: false,
        removed: [false, false, false, false],
        lifeline: true, lifelineThis: false,
        hover: -1, hv: [0, 0, 0, 0],
        target: 1,               // which member takes the hit
        say: '', sayT: 0,
        hint: 3.6,
        L: null,                 // layout, rebuilt per question
        members: [], motes: [], rings: [], floats: [], bolt: null,
        result: '', over: false
      };

      var i0;
      for (i0 = 0; i0 < 3; i0++) {
        st.members.push({ x: SEAT_X[i0], bob: 0, ph: api.rand(0, 6.283), tilt: 0, recoil: 0, point: 0, lean: 0 });
      }
      for (i0 = 0; i0 < 26; i0++) {
        st.motes.push({ x: api.rand(120, 840), y: api.rand(TOP, BOTTOM), vy: api.rand(-9, -2), vx: api.rand(-5, 5), r: api.rand(.7, 2.1), a: api.rand(.1, .4) });
      }

      api.hud.set({ lives: START_HEARTS, maxLives: START_HEARTS, combo: 1, level: levelNow(), time: st.limit, progress: 0 });
      api.hud.set({ banner: PHASES[0].title, sub: 'Easy questions first. Every ' + PER_LEVEL + ' correct answers they get harder, and the clock never gets shorter.', bannerTime: 1.5 });

      // ---- small helpers --------------------------------------------------
      function phaseDef() { return PHASES[api.clamp(st.phase, 1, 4) - 1]; }
      function levelNow() { return api.clamp(Math.round(Number(api.progress.level)) || 1, 1, 3); }
      function qidOf(q) { return q.qid; }
      function phaseFor(hp) { return hp > 75 ? 1 : hp > 50 ? 2 : hp > 25 ? 3 : 4; }
      function wrapAt(ctx, str, size, weight, maxW, fam) {
        ctx.save(); ctx.font = api.font(size, fam || 'body', weight);
        var ls = api.wrap(ctx, str, maxW); ctx.restore();
        return ls.length ? ls : [''];
      }
      function clip(ctx, str, size, weight, maxW, fam) {
        ctx.save(); ctx.font = api.font(size, fam || 'body', weight);
        var s = String(str == null ? '' : str);
        if (ctx.measureText(s).width > maxW) {
          while (s.length > 3 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
          s += '…';
        }
        ctx.restore();
        return s;
      }

      // ---- question selection ---------------------------------------------
      // Difficulty follows api.progress.level (easy, then medium, then hard).
      // The phase's domain mix only breaks ties: the pick narrows to the phase's
      // domains while they still hold enough unused questions at this level.
      function nextQuestion() {
        var want = phaseDef(), lvl = levelNow(), fresh = [], inPhase = [], onLevel = 0, i;
        for (i = 0; i < POOL.length; i++) {
          var q = POOL[i];
          if (!q || used[q.qid]) continue;
          fresh.push(q);
          if (want.domains.indexOf(q.domain) >= 0) {
            inPhase.push(q);
            if (q.difficulty === lvl) onLevel++;
          }
        }
        if (!fresh.length) { endRun(false, 'empty'); return false; }
        var chosen = api.progress.pick(onLevel >= PHASE_MIX_MIN ? inPhase : fresh, qidOf) || fresh[0];
        used[chosen.qid] = 1;
        st.qn++;
        st.q = { src: chosen, options: api.shuffle(chosen.options) };
        st.correctIdx = -1;
        for (i = 0; i < st.q.options.length; i++) if (st.q.options[i].correct) st.correctIdx = i;
        st.picked = -1;
        st.removed = [false, false, false, false];
        st.lifelineThis = false;
        st.hover = -1; st.hv = [0, 0, 0, 0];
        st.limit = Math.max(st.limit || 0, want.limit);   // never shorter than the question before
        st.timeLeft = st.limit;
        st.tickAt = 5;
        st.hitDone = false;
        st.L = null;               // force a fresh layout on the next draw
        st.target = api.randInt(0, 2);
        setMode('ask', 0);
        api.hud.set({ time: st.timeLeft });
        if (api.ready) api.ready(chosen.stem + ' ' + st.q.options.map(function (o) { return o.text; }).join(' '));   // reading pause on easier levels
        return true;
      }

      function setMode(m, dur) { st.mode = m; st.mt = 0; st.modeDur = dur || 0; }

      // ---- answering -------------------------------------------------------
      function answer(i) {
        if (st.mode !== 'ask' || !st.q) return;
        if (i < 0 || i > 3) return;
        if (st.removed[i]) { api.audio.blip(); return; }
        resolve(i);
      }

      function resolve(i) {
        var q = st.q, src = q.src;
        var chosen = i >= 0 ? q.options[i] : null;
        var right = q.options[st.correctIdx] || { text: '', why: '' };
        var ok = !!(chosen && chosen.correct);
        st.picked = i;
        st.lastOk = ok;
        st.answered++;

        api.review.add({
          prompt: src.stem,
          correct: right.text,
          given: chosen ? chosen.text : '— out of time —',
          ok: ok,
          explanation: (chosen && chosen.why) ? chosen.why : right.why,
          cite: src.cite
        });

        var frac = api.clamp(st.timeLeft / Math.max(1, st.limit), 0, 1);

        if (ok) {
          st.correct++;
          var mult = 1 + Math.min(4, st.combo - 1) * 0.25;
          var pts = Math.round((100 + 120 * frac) * mult * (st.lifelineThis ? 0.6 : 1));
          api.score(pts);
          st.combo = Math.min(9, st.combo + 1);
          st.bestCombo = Math.max(st.bestCombo, st.combo);
          api.audio.correct();
          st.dmg = (3.5 + 3.5 * frac + Math.min(2.5, (st.combo - 2) * 0.5)) * (st.lifelineThis ? 0.7 : 1);
          st.dmg = Math.max(1.5, Math.round(st.dmg * 10) / 10);
          st.pts = pts;
          // The strike lands later in applyDamage, but its HP loss is fixed now,
          // so a phase change on this answer is already known.
          var hpAfter = Math.max(0, st.hp - st.dmg), phaseAfter = phaseFor(hpAfter);
          var leveled = api.progress.correct();       // every correct answer; may raise the level and show its banner
          api.hud.set({ combo: st.combo, level: levelNow() });
          if (leveled && hpAfter > 0 && phaseAfter > st.phase) {
            // level-up and new phase on the same answer: one combined banner replaces the level banner
            var nd = PHASES[phaseAfter - 1], lv = levelNow();
            api.hud.set({
              banner: 'Level ' + lv + ' · Phase ' + phaseAfter,
              sub: LEVEL_NAMES[lv - 1] + ' and ' + nd.limit + ' seconds a question. ' + nd.name + ': ' + nd.sub,
              bannerTime: 2.6
            });
            st.announced = phaseAfter;                 // advance() skips the separate phase banner
          }
          launchBolt();
          setMode('strike', 0.9);
        } else {
          st.combo = 1;
          api.hud.set({ combo: 1 });
          api.audio.wrong();
          st.say = api.pick(OBJECTIONS) || 'Objection.'; st.sayT = 1.7;
          st.members[st.target].point = 1;
          st.hitDone = false;
          setMode('object', 0.95);
        }
      }

      function launchBolt() {
        var m = st.members[st.target];
        st.bolt = { t: 0, dur: 0.5, x0: W / 2, y0: H + 26, x1: m.x, y1: headY(st.target) + 26, hit: false };
        api.audio.whoosh();
      }
      function headY(i) {
        var Lz = st.L; if (!Lz) return 160;
        return Lz.tableY - 104 * Lz.s;
      }

      // ---- damage / phases --------------------------------------------------
      function applyDamage() {
        var m = st.members[st.target];
        var hx = m.x, hy = headY(st.target) + 18;
        st.hp = Math.max(0, st.hp - (st.dmg || 5));
        m.recoil = 1;
        api.shake(9);
        api.particles.emit({ x: hx, y: hy, n: 34, color: [C.gold2, C.gold, C.white], speed: 340, life: .75, size: 6, gravity: 180, shape: 'spark' });
        api.particles.emit({ x: hx, y: hy, n: 16, color: [C.red, C.orange], speed: 200, life: .6, size: 5, gravity: 260 });
        st.rings.push({ x: hx, y: hy, t: 0, dur: .55, col: C.gold2, maxR: 130 });
        st.floats.push({ x: hx, y: hy - 16, t: 0, txt: '−' + (Math.round(st.dmg * 10) / 10) + ' HP', col: C.gold2, size: 24 });
        if (st.pts) st.floats.push({ x: hx, y: hy + 16, t: 0, txt: '+' + st.pts, col: C.green, size: 19 });
        st.say = api.pick(CONCURS) || 'Noted.'; st.sayT = 1.5;
        api.hud.set({ progress: 1 - st.hp / BOSS_HP });
        var np = phaseFor(st.hp);
        if (np > st.phase && st.hp > 0) st.pendingPhase = np;
      }

      function loseHeart() {
        st.hearts = Math.max(0, st.hearts - 1);
        api.hud.set({ lives: st.hearts });
        api.shake(18);
        api.flash('rgba(255,107,107,.32)');
        api.audio.boom();
        var cx = W / 2, cy = st.L ? st.L.tableY + 10 : 220;
        st.rings.push({ x: cx, y: cy, t: 0, dur: .85, col: C.red, maxR: 760 });
        st.rings.push({ x: cx, y: cy, t: -.12, dur: .85, col: C.red, maxR: 620 });
        api.particles.emit({ x: cx, y: H - 40, n: 26, color: [C.red, C.orange], speed: 260, life: .7, size: 5, gravity: 120, angle: -Math.PI / 2, spread: 1.2 });
      }

      // ---- lifeline ----------------------------------------------------------
      function useLifeline() {
        if (!st.lifeline || st.mode !== 'ask' || !st.q) return;
        var wrong = [], i;
        for (i = 0; i < 4; i++) if (i !== st.correctIdx) wrong.push(i);
        wrong = api.shuffle(wrong);
        st.removed[wrong[0]] = true;
        st.removed[wrong[1]] = true;
        st.lifeline = false;
        st.lifelineThis = true;
        api.audio.powerup();
        api.hud.set({ banner: '50:50', sub: 'Two wrong options struck — scoring reduced for this question', bannerTime: 1.1 });
        api.particles.emit({ x: W / 2, y: st.L ? st.L.stemTop + 20 : 240, n: 20, color: [C.purple, C.sky], speed: 220, life: .6, size: 5, gravity: 40 });
      }

      // ---- ending -------------------------------------------------------------
      function endRun(won, reason) {
        if (st.over) return;
        st.over = true;
        st.result = won ? 'win' : (reason === 'empty' ? 'dry' : 'lose');
        setMode('done', won ? 1.7 : 1.4);
        if (won) {
          api.audio.fanfare();
          api.particles.emit({ x: W / 2, y: 260, n: 70, color: [C.gold, C.gold2, C.green, C.white], speed: 420, life: 1.1, size: 7, gravity: 260 });
          api.shake(12);
        } else {
          api.audio.wrong();
        }
      }

      function finish() {
        var msg;
        if (st.result === 'win') {
          var bonus = 300 + st.hearts * 150;
          api.score(bonus);
          msg = 'You took the board down in ' + st.answered + ' questions with ' + st.hearts + ' of ' + START_HEARTS + ' composure left (+' + bonus + ' bonus).';
          api.end({ won: true, title: 'Board recommends', message: msg });
        } else if (st.result === 'dry') {
          msg = 'The question bank ran out with the board at ' + Math.ceil(st.hp) + '%. You answered ' + st.correct + ' of ' + st.answered + ' correctly.';
          api.end({ won: false, title: 'The board runs out of questions', message: msg });
        } else {
          msg = 'The board still had ' + Math.ceil(st.hp) + '% left. You answered ' + st.correct + ' of ' + st.answered + ' correctly · best combo ×' + st.bestCombo + '.';
          api.end({ won: false, title: 'Not this month', message: msg });
        }
      }

      // ================= update ==============================================
      function update(dt) {
        var i;
        st.mt += dt;
        if (st.hint > 0) st.hint -= dt;
        if (st.sayT > 0) st.sayT -= dt;
        st.hpShown += (st.hp - st.hpShown) * Math.min(1, dt * 5.5);

        // idle motion
        for (i = 0; i < 3; i++) {
          var m = st.members[i];
          m.ph += dt * (0.8 + i * 0.13);
          m.bob = Math.sin(m.ph) * 2.4;
          m.tilt = Math.sin(m.ph * 0.42 + i) * 0.035;
          if (m.recoil > 0) m.recoil = Math.max(0, m.recoil - dt * 2.6);
          if (m.point > 0) m.point = Math.max(0, m.point - dt * 1.1);
          var wantLean = (st.mode === 'ask' && st.limit > 0) ? api.clamp(1 - st.timeLeft / st.limit, 0, 1) : 0.15;
          m.lean += (wantLean - m.lean) * Math.min(1, dt * 3);
        }

        // dust motes in the spotlight
        for (i = 0; i < st.motes.length; i++) {
          var p = st.motes[i];
          p.y += p.vy * dt; p.x += p.vx * dt;
          if (p.y < TOP - 10) { p.y = BOTTOM; p.x = api.rand(150, 810); }
        }

        // effects
        for (i = st.rings.length - 1; i >= 0; i--) { st.rings[i].t += dt; if (st.rings[i].t > st.rings[i].dur) st.rings.splice(i, 1); }
        for (i = st.floats.length - 1; i >= 0; i--) { st.floats[i].t += dt; if (st.floats[i].t > 1.15) st.floats.splice(i, 1); }
        if (st.bolt) {
          st.bolt.t += dt;
          if (!st.bolt.hit && st.bolt.t >= st.bolt.dur) { st.bolt.hit = true; applyDamage(); }
          if (st.bolt.t > st.bolt.dur + 0.35) st.bolt = null;
        }

        // hover easing
        for (i = 0; i < 4; i++) {
          var want = (st.hover === i && st.mode === 'ask' && !st.removed[i]) ? 1 : 0;
          st.hv[i] += (want - st.hv[i]) * Math.min(1, dt * 12);
        }

        // ---- mode machine ----
        if (st.mode === 'intro') {
          if (st.mt >= st.modeDur) nextQuestion();

        } else if (st.mode === 'ask') {
          st.timeLeft -= dt;
          if (st.timeLeft <= st.tickAt && st.timeLeft > 0) { st.tickAt = Math.ceil(st.timeLeft) - 1; api.audio.tick(); }
          api.hud.set({ time: Math.max(0, st.timeLeft) });
          if (st.timeLeft <= 0) { st.timeLeft = 0; resolve(-1); }

        } else if (st.mode === 'strike') {
          if (st.mt >= st.modeDur) {
            if (st.hp <= 0) { endRun(true); }
            else setMode('reveal', 1.35);
          }

        } else if (st.mode === 'object') {
          if (st.mt >= 0.16 && !st.hitDone) { st.hitDone = true; loseHeart(); }
          if (st.mt >= st.modeDur) {
            st.hitDone = false;
            if (st.hearts <= 0) endRun(false);
            else {
              var right = st.q ? st.q.options[st.correctIdx] : null;
              api.hud.set({ banner: 'Objection', sub: right ? (right.text + (right.why ? ' — ' + right.why : '')) : '', bannerTime: 2.4 });
              setMode('reveal', 2.5);
            }
          }

        } else if (st.mode === 'reveal') {
          if (st.mt >= st.modeDur) advance();

        } else if (st.mode === 'phase') {
          if (st.mt >= st.modeDur) nextQuestion();

        } else if (st.mode === 'done') {
          if (st.mt >= st.modeDur) { st.mode = 'end'; finish(); }
        }
      }

      function advance() {
        if (st.pendingPhase > st.phase) {
          st.phase = st.pendingPhase;
          st.pendingPhase = 0;
          var d = phaseDef();
          api.shake(8);
          if (st.announced === st.phase) {
            // already announced with the level-up on the same answer: no second banner or fanfare
            st.announced = 0;
            setMode('phase', 0.8);
            return;
          }
          api.hud.set({ banner: d.title, sub: d.sub + ' ' + d.limit + ' seconds a question.', bannerTime: 1.6 });
          api.audio.fanfare();
          setMode('phase', 1.6);
          return;
        }
        nextQuestion();
      }

      // ================= layout ==============================================
      function ensureLayout(ctx) {
        if (st.L || !st.q) return st.L;
        var q = st.q, i;
        var stemLines = wrapAt(ctx, q.src.stem, 19, 700, PANEL_W - 44);
        if (stemLines.length > 5) stemLines = stemLines.slice(0, 5);
        var stemH = stemLines.length * 25 + 56;

        var rows = [], textW = OPT_W - 84, total = 0;
        for (i = 0; i < 4; i++) {
          var ls = wrapAt(ctx, q.options[i].text, 16, 600, textW);
          rows.push({ lines: ls, h: 0 });
        }
        function measure() {
          total = 0;
          for (var k = 0; k < 4; k++) { rows[k].h = Math.max(42, rows[k].lines.length * 20 + 18); total += rows[k].h; }
          total += 18;
          return stemH + total + 10;
        }
        var blockH = measure();
        // safety valve: if the metrics come out taller than the stage, trim the
        // longest option (full text is still shown on the results screen)
        var guard = 0;
        while (blockH > BOTTOM - 104 && guard++ < 12) {
          var big = 0;
          for (i = 1; i < 4; i++) if (rows[i].lines.length > rows[big].lines.length) big = i;
          if (rows[big].lines.length <= 2) break;
          rows[big].lines = rows[big].lines.slice(0, rows[big].lines.length - 1);
          rows[big].lines[rows[big].lines.length - 1] += ' …';
          blockH = measure();
        }

        var stemTop = BOTTOM - blockH;
        var boardBot = Math.min(302, stemTop + 58);
        var s = api.clamp((boardBot - 34 - BOARD_TOP) / 143, 0.30, 1.06);
        var tableY = boardBot - (34 + 16 * s);

        var y = stemTop + stemH + 10, list = [];
        for (i = 0; i < 4; i++) { list.push({ x: OPT_X, y: y, w: OPT_W, h: rows[i].h, lines: rows[i].lines }); y += rows[i].h + 6; }

        st.L = {
          stemTop: stemTop, stemH: stemH, stemLines: stemLines,
          rows: list, boardBot: boardBot, tableY: tableY, s: s,
          life: { x: PANEL_X + PANEL_W - 166, y: stemTop + 9, w: 92, h: 26 }
        };
        return st.L;
      }

      // ================= drawing =============================================
      function drawBackdrop(ctx, L) {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0a1020'); g.addColorStop(.42, '#0c1424'); g.addColorStop(1, '#05080f');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        // wall panelling behind the board
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
        for (var x = 42; x < W; x += 76) { ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x, L.boardBot); ctx.stroke(); }
        ctx.restore();

        // seal behind the centre chair
        var cy = L.tableY - 96 * L.s, r = 74 * L.s + 18;
        ctx.save(); ctx.globalAlpha = .16;
        ctx.strokeStyle = C.gold; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W / 2, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(W / 2, cy, r - 9, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = .1;
        for (var k = 0; k < 13; k++) {
          var a = k / 13 * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(W / 2 + Math.cos(a) * (r - 4.5), cy + Math.sin(a) * (r - 4.5), 2.6, 0, Math.PI * 2);
          ctx.fillStyle = C.gold2; ctx.fill();
        }
        ctx.restore();
      }

      function drawSpotlight(ctx, L) {
        // cone from above the board down onto the candidate side
        ctx.save();
        var g = ctx.createLinearGradient(0, TOP - 20, 0, H);
        g.addColorStop(0, 'rgba(226,182,87,.10)');
        g.addColorStop(.55, 'rgba(226,182,87,.045)');
        g.addColorStop(1, 'rgba(226,182,87,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(W / 2 - 54, TOP - 24); ctx.lineTo(W / 2 + 54, TOP - 24);
        ctx.lineTo(W / 2 + 430, H + 10); ctx.lineTo(W / 2 - 430, H + 10);
        ctx.closePath(); ctx.fill();

        // floor pool on the candidate side
        var pg = ctx.createRadialGradient(W / 2, H - 6, 8, W / 2, H - 6, 380);
        pg.addColorStop(0, 'rgba(226,182,87,.10)');
        pg.addColorStop(1, 'rgba(226,182,87,0)');
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.ellipse(W / 2, H - 6, 380, 70, 0, 0, Math.PI * 2); ctx.fill();

        // dust
        for (var i = 0; i < st.motes.length; i++) {
          var p = st.motes[i];
          ctx.globalAlpha = p.a * .6;
          ctx.fillStyle = C.gold2;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      function eyeState() {
        if (st.mode === 'ask' && st.limit > 0) return api.clamp(1 - st.timeLeft / st.limit, 0, 1);
        if (st.mode === 'object') return 1;
        if (st.mode === 'strike') return 0.15;
        return 0.3;
      }

      function drawMember(ctx, i, L) {
        var m = st.members[i], s = L.s, narrow = eyeState();
        var flin = m.recoil, lean = m.lean;
        ctx.save();
        ctx.translate(m.x, L.tableY + 8 + flin * 6 * s);
        ctx.scale(s, s);
        ctx.translate(0, m.bob + lean * 5);
        ctx.rotate(m.tilt + (flin ? -flin * 0.10 : 0) + lean * 0.03 * (i === 0 ? 1 : i === 2 ? -1 : 0));

        var body = ctx.createLinearGradient(0, -120, 0, 40);
        body.addColorStop(0, '#16203a');
        body.addColorStop(1, '#070c17');

        // torso / shoulders
        ctx.beginPath();
        ctx.moveTo(-74, 46);
        ctx.quadraticCurveTo(-68, -34, -27, -56);
        ctx.quadraticCurveTo(-14, -62, -14, -78);
        ctx.lineTo(14, -78);
        ctx.quadraticCurveTo(14, -62, 27, -56);
        ctx.quadraticCurveTo(68, -34, 74, 46);
        ctx.closePath();
        ctx.fillStyle = body; ctx.fill();
        ctx.strokeStyle = 'rgba(143,198,255,.22)'; ctx.lineWidth = 1.6; ctx.stroke();

        // collar
        ctx.strokeStyle = 'rgba(226,182,87,.30)'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-16, -74); ctx.lineTo(0, -52); ctx.lineTo(16, -74); ctx.stroke();

        // rank device on the chest
        ctx.fillStyle = 'rgba(226,182,87,.55)';
        if (i === 0) {
          for (var c = 0; c < 3; c++) {
            ctx.beginPath();
            ctx.moveTo(-34, -18 + c * 8); ctx.lineTo(-26, -23 + c * 8); ctx.lineTo(-18, -18 + c * 8);
            ctx.lineTo(-26, -20.5 + c * 8); ctx.closePath(); ctx.fill();
          }
        } else if (i === 1) {
          star(ctx, -28, -18, 8, 4);
        } else {
          ctx.beginPath(); ctx.ellipse(-28, -18, 8, 5, -0.5, 0, Math.PI * 2); ctx.fill();
        }

        // head
        ctx.beginPath(); ctx.ellipse(0, -104, 25, 29, 0, 0, Math.PI * 2);
        ctx.fillStyle = body; ctx.fill();
        ctx.strokeStyle = 'rgba(143,198,255,.24)'; ctx.lineWidth = 1.6; ctx.stroke();

        // headgear
        ctx.fillStyle = '#0e1628';
        ctx.strokeStyle = 'rgba(226,182,87,.35)'; ctx.lineWidth = 1.4;
        if (i === 0) {                                    // beret
          ctx.beginPath();
          ctx.moveTo(-27, -122); ctx.quadraticCurveTo(-4, -146, 26, -128);
          ctx.quadraticCurveTo(34, -124, 22, -120); ctx.lineTo(-26, -118);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (i === 1) {                             // service cap
          ctx.beginPath();
          ctx.moveTo(-27, -124); ctx.quadraticCurveTo(0, -150, 27, -124); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.beginPath(); api.roundRect(ctx, -30, -126, 60, 8, 4); ctx.fill(); ctx.stroke();
          ctx.beginPath();                                // visor
          ctx.moveTo(-32, -118); ctx.quadraticCurveTo(0, -108, 32, -118);
          ctx.quadraticCurveTo(0, -114, -32, -118); ctx.closePath();
          ctx.fillStyle = '#080d18'; ctx.fill();
        } else {                                          // bun
          ctx.beginPath(); ctx.arc(0, -132, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-26, -104); ctx.quadraticCurveTo(-28, -134, 0, -134);
          ctx.quadraticCurveTo(28, -134, 26, -104);
          ctx.quadraticCurveTo(14, -122, -14, -122); ctx.closePath();
          ctx.fill();
        }

        // eyes — narrow as the clock runs down
        var eh = 8 - narrow * 5.6, col = narrow > .62 ? C.red : narrow > .32 ? C.orange : C.sky;
        ctx.save();
        api.glow(ctx, col, 10 + narrow * 14);
        ctx.fillStyle = col;
        api.roundRect(ctx, -19, -110 - eh / 2, 15, eh, eh / 2); ctx.fill();
        api.roundRect(ctx, 4, -110 - eh / 2, 15, eh, eh / 2); ctx.fill();
        api.noGlow(ctx);
        ctx.restore();
        if (narrow > .35) {                                 // brow
          ctx.strokeStyle = 'rgba(255,255,255,.30)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-21, -120 + narrow * 3); ctx.lineTo(-5, -116 + narrow * 4);
          ctx.moveTo(21, -120 + narrow * 3); ctx.lineTo(5, -116 + narrow * 4);
          ctx.stroke();
        }

        // raised hand on an objection
        if (m.point > 0) {
          var p = api.ease.outBack(Math.min(1, (1 - m.point) * 2.4));
          ctx.save();
          ctx.strokeStyle = '#dfe6f3'; ctx.lineWidth = 9; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(34, -18);
          ctx.quadraticCurveTo(58, -30 - 26 * p, 44, -70 - 42 * p);
          ctx.stroke();
          ctx.fillStyle = '#eef2fa';
          ctx.beginPath(); ctx.arc(44, -74 - 44 * p, 7.5, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }

      function star(ctx, cx, cy, r, r2) {
        ctx.beginPath();
        for (var i = 0; i < 10; i++) {
          var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r2 : r;
          if (i === 0) ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
          else ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill();
      }

      function drawTable(ctx, L) {
        var ty = L.tableY, bb = L.boardBot, s = L.s, i;
        ctx.save();
        // top surface
        ctx.beginPath();
        ctx.moveTo(16, ty); ctx.lineTo(W - 16, ty); ctx.lineTo(W + 10, ty + 13); ctx.lineTo(-10, ty + 13); ctx.closePath();
        var tg = ctx.createLinearGradient(0, ty, 0, ty + 13);
        tg.addColorStop(0, '#2b3550'); tg.addColorStop(1, '#161f33');
        ctx.fillStyle = tg; ctx.fill();
        // front face
        var fg = ctx.createLinearGradient(0, ty + 13, 0, bb);
        fg.addColorStop(0, '#111a2c'); fg.addColorStop(1, '#070b14');
        ctx.fillStyle = fg; ctx.fillRect(-10, ty + 13, W + 20, Math.max(2, bb - ty - 13));
        // lit edge
        ctx.strokeStyle = 'rgba(226,182,87,.38)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-10, ty + 13.5); ctx.lineTo(W + 10, ty + 13.5); ctx.stroke();
        // panel grooves on the front face
        ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
        for (i = 0; i < 3; i++) {
          var gx = SEAT_X[i];
          ctx.strokeRect(gx - 96, ty + 21, 192, Math.max(4, bb - ty - 28));
        }
        // name plates and folders
        for (i = 0; i < 3; i++) {
          var x = SEAT_X[i], pw = 74 * s + 16, ph = 11 * s + 5;
          api.roundRect(ctx, x - pw / 2, ty - ph, pw, ph, 2);
          ctx.fillStyle = '#0c1424'; ctx.fill();
          ctx.strokeStyle = 'rgba(226,182,87,.45)'; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.save();
          ctx.globalAlpha = .55; ctx.fillStyle = C.gold2;
          ctx.fillRect(x - pw / 2 + 5, ty - ph / 2 - 1, pw - 10, 1.6);
          ctx.restore();
          // paper on the table
          ctx.save();
          ctx.globalAlpha = .5;
          ctx.translate(x + (i === 1 ? 0 : (i === 0 ? -62 : 62)), ty + 5);
          ctx.rotate(i === 0 ? -.12 : i === 2 ? .1 : .03);
          ctx.fillStyle = '#cfd8e8';
          ctx.fillRect(-20, -4, 40, 8);
          ctx.restore();
        }
        ctx.restore();
      }

      function drawBoltAndRings(ctx) {
        var i, b = st.bolt;
        // shockwave rings
        for (i = 0; i < st.rings.length; i++) {
          var r = st.rings[i];
          if (r.t < 0) continue;
          var k = api.clamp(r.t / r.dur, 0, 1), rad = api.ease.outCubic(k) * r.maxR;
          ctx.save();
          ctx.globalAlpha = (1 - k) * .55;
          ctx.strokeStyle = r.col; ctx.lineWidth = 3 + (1 - k) * 5;
          api.glow(ctx, r.col, 18);
          ctx.beginPath(); ctx.ellipse(r.x, r.y, rad, rad * .62, 0, 0, Math.PI * 2); ctx.stroke();
          api.noGlow(ctx);
          ctx.restore();
        }
        // gavel strike
        if (b) {
          var t = api.clamp(b.t / b.dur, 0, 1), e = api.ease.outCubic(t);
          var x = api.lerp(b.x0, b.x1, e), y = api.lerp(b.y0, b.y1, e);
          if (t < 1) {
            ctx.save();
            // trail
            for (i = 1; i <= 7; i++) {
              var tt = Math.max(0, e - i * 0.045);
              var tx = api.lerp(b.x0, b.x1, tt), tyy = api.lerp(b.y0, b.y1, tt);
              ctx.globalAlpha = (1 - i / 8) * .5;
              ctx.fillStyle = i % 2 ? C.gold2 : C.orange;
              ctx.beginPath(); ctx.arc(tx, tyy, 10 - i, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.translate(x, y);
            ctx.rotate(-Math.PI / 4 + b.t * 17);
            api.glow(ctx, C.gold2, 26);
            // gavel head
            ctx.fillStyle = C.gold2;
            api.roundRect(ctx, -9, -22, 18, 30, 5); ctx.fill();
            // handle
            ctx.fillStyle = C.gold;
            api.roundRect(ctx, -3.5, 6, 7, 30, 3.5); ctx.fill();
            api.noGlow(ctx);
            ctx.restore();
          }
        }
        // damage / points floaters
        for (i = 0; i < st.floats.length; i++) {
          var f = st.floats[i], k2 = f.t / 1.15;
          ctx.save();
          ctx.globalAlpha = 1 - k2 * k2;
          api.text(ctx, f.txt, f.x, f.y - k2 * 46, { size: f.size, fam: 'mono', weight: 700, align: 'center', color: f.col, shadow: true });
          ctx.restore();
        }
      }

      function drawSpeech(ctx, L) {
        if (st.sayT <= 0 || !st.say) return;
        var a = Math.min(1, st.sayT / .4);
        var y = Math.max(TOP + 24, L.tableY - 150 * L.s);
        ctx.save(); ctx.globalAlpha = a;
        api.pill(ctx, st.say, st.members[st.target].x, y, {
          size: 17, fam: 'body', align: 'center',
          bg: st.lastOk && st.mode !== 'object' ? 'rgba(95,211,154,.18)' : 'rgba(255,107,107,.20)',
          stroke: st.lastOk && st.mode !== 'object' ? 'rgba(95,211,154,.6)' : 'rgba(255,107,107,.6)',
          color: C.ink
        });
        ctx.restore();
      }

      function drawHp(ctx) {
        var x = 150, w = 680, y = 60, h = 20;
        var pct = api.clamp(st.hpShown / BOSS_HP, 0, 1);
        api.text(ctx, 'THE BOARD', x - 12, y + h / 2 + 1, { size: 16, fam: 'mono', weight: 700, align: 'right', baseline: 'middle', color: C.ink2 });

        api.roundRect(ctx, x, y, w, h, h / 2);
        ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.4; ctx.stroke();

        if (pct > 0) {
          ctx.save();
          api.roundRect(ctx, x, y, w, h, h / 2); ctx.clip();
          var g = ctx.createLinearGradient(x, 0, x + w, 0);
          g.addColorStop(0, C.red); g.addColorStop(.55, C.orange); g.addColorStop(1, C.gold2);
          ctx.fillStyle = g;
          ctx.fillRect(x, y, w * pct, h);
          // moving sheen
          ctx.globalAlpha = .18; ctx.fillStyle = '#fff';
          var sh = (api.elapsed * 120) % (w + 160) - 80;
          ctx.beginPath(); ctx.moveTo(x + sh, y); ctx.lineTo(x + sh + 34, y); ctx.lineTo(x + sh + 12, y + h); ctx.lineTo(x + sh - 22, y + h); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        // phase dividers
        ctx.save(); ctx.strokeStyle = 'rgba(5,8,16,.75)'; ctx.lineWidth = 2;
        for (var k = 1; k < 4; k++) { var px = x + w * (k / 4); ctx.beginPath(); ctx.moveTo(px, y + 1); ctx.lineTo(px, y + h - 1); ctx.stroke(); }
        ctx.restore();

        api.text(ctx, Math.ceil(st.hpShown) + '%', x + w + 12, y + h / 2 + 1, { size: 18, fam: 'mono', weight: 700, baseline: 'middle', color: pct > .5 ? C.ink : C.gold2 });
      }

      function drawPanel(ctx, L) {
        var q = st.q; if (!q) return;
        var x = PANEL_X, y = L.stemTop, w = PANEL_W, h = L.stemH;
        var reveal = (st.mode !== 'ask');       // anything but "asking" shows the resolved face

        // tail pointing up at the board
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(W / 2 - 16, y + 2); ctx.lineTo(W / 2, y - 14); ctx.lineTo(W / 2 + 16, y + 2); ctx.closePath();
        ctx.fillStyle = 'rgba(12,20,36,.96)'; ctx.fill();
        ctx.restore();

        api.roundRect(ctx, x, y, w, h, 16);
        ctx.fillStyle = 'rgba(11,18,33,.96)'; ctx.fill();
        ctx.strokeStyle = reveal ? (st.lastOk ? 'rgba(95,211,154,.5)' : 'rgba(255,107,107,.5)') : 'rgba(255,255,255,.14)';
        ctx.lineWidth = 1.6; ctx.stroke();

        // accent stripe
        ctx.save();
        api.roundRect(ctx, x, y + 10, 5, h - 20, 3);
        ctx.fillStyle = reveal ? (st.lastOk ? C.green : C.red) : C.red; ctx.fill();
        ctx.restore();

        // header row
        var hy = y + 22;
        var tag = 'Q' + st.qn + ' · PHASE ' + st.phase + ' · ' + (DIFF_TAGS[q.src.difficulty - 1] || 'MEDIUM');
        var pw = api.pill(ctx, tag, x + 18, hy, { size: 16, fam: 'mono', bg: 'rgba(255,107,107,.16)', stroke: 'rgba(255,107,107,.45)', color: C.ink });
        var domX = x + 18 + pw + 12;
        var right = x + w - 18;

        // timer (or cite once answered)
        if (!reveal) {
          var secs = Math.ceil(Math.max(0, st.timeLeft));
          var tc = st.timeLeft <= 5 ? C.red : st.timeLeft <= 10 ? C.orange : C.sky;
          api.text(ctx, secs + 's', right, hy + 1, { size: 21, fam: 'mono', weight: 700, align: 'right', baseline: 'middle', color: tc });
          right -= 56;
          // lifeline button
          var lb = L.life;
          lb.x = right - lb.w; lb.y = y + 9;
          api.roundRect(ctx, lb.x, lb.y, lb.w, lb.h, 8);
          ctx.fillStyle = st.lifeline ? 'rgba(183,139,255,.18)' : 'rgba(255,255,255,.04)'; ctx.fill();
          ctx.strokeStyle = st.lifeline ? 'rgba(183,139,255,.6)' : 'rgba(255,255,255,.10)'; ctx.lineWidth = 1.4; ctx.stroke();
          api.text(ctx, st.lifeline ? 'L 50:50' : 'USED', lb.x + lb.w / 2, lb.y + lb.h / 2 + 1,
            { size: 16, fam: 'mono', weight: 700, align: 'center', baseline: 'middle', color: st.lifeline ? C.purple : C.muted });
          right = lb.x - 12;
        } else {
          api.text(ctx, st.lastOk ? '✓ CORRECT' : '✕ OBJECTION', right, hy + 1,
            { size: 17, fam: 'mono', weight: 700, align: 'right', baseline: 'middle', color: st.lastOk ? C.green : C.red });
          right -= 140;
        }

        var dom = clip(ctx, q.src.domain || 'Board question', 16, 600, Math.max(60, right - domX), 'body');
        api.text(ctx, dom, domX, hy + 1, { size: 16, weight: 600, baseline: 'middle', color: C.ink2, alpha: .9 });

        // stem
        for (var i = 0; i < L.stemLines.length; i++) {
          api.text(ctx, L.stemLines[i], x + 22, y + 52 + i * 25, { size: 19, weight: 700, color: C.ink });
        }

        // footer: timer bar while asking, citation once answered
        var fy = y + h - 17;
        if (!reveal) {
          var frac = api.clamp(st.timeLeft / Math.max(1, st.limit), 0, 1);
          api.roundRect(ctx, x + 22, fy, w - 44, 6, 3);
          ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
          if (frac > 0) {
            api.roundRect(ctx, x + 22, fy, Math.max(4, (w - 44) * frac), 6, 3);
            ctx.fillStyle = frac > .45 ? C.green : frac > .2 ? C.gold : C.red; ctx.fill();
          }
        } else {
          var cite = q.src.cite ? 'Cite · ' + q.src.cite : 'No citation on this item';
          api.text(ctx, clip(ctx, cite, 16, 600, w - 44, 'mono'), x + 22, fy + 4,
            { size: 16, fam: 'mono', weight: 600, baseline: 'middle', color: q.src.cite ? C.ink2 : C.muted });
        }
      }

      function drawOptions(ctx, L) {
        var q = st.q; if (!q) return;
        var reveal = (st.mode !== 'ask');
        for (var i = 0; i < 4; i++) {
          var r = L.rows[i], gone = st.removed[i], hv = st.hv[i];
          var isRight = (i === st.correctIdx), isPick = (i === st.picked);
          var col = 'rgba(255,255,255,.14)', fill = 'rgba(255,255,255,.045)', ink = C.ink, alpha = 1;

          if (reveal) {
            if (isRight) { col = 'rgba(95,211,154,.85)'; fill = 'rgba(95,211,154,.14)'; }
            else if (isPick) { col = 'rgba(255,107,107,.85)'; fill = 'rgba(255,107,107,.14)'; ink = C.ink2; }
            else { alpha = .4; ink = C.ink2; }
          } else if (gone) {
            alpha = .3; ink = C.muted; fill = 'rgba(255,255,255,.02)';
          } else if (hv > .02) {
            col = 'rgba(226,182,87,' + (0.25 + hv * 0.55).toFixed(3) + ')';
            fill = 'rgba(226,182,87,' + (0.05 + hv * 0.09).toFixed(3) + ')';
          }

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(hv * 5, 0);

          api.roundRect(ctx, r.x, r.y, r.w, r.h, 12);
          ctx.fillStyle = fill; ctx.fill();
          if (reveal && (isRight || isPick)) api.glow(ctx, isRight ? C.green : C.red, 14);
          ctx.strokeStyle = col; ctx.lineWidth = (reveal && (isRight || isPick)) ? 2.2 : 1.4; ctx.stroke();
          api.noGlow(ctx);

          // key badge
          var bx = r.x + 12, by = r.y + (r.h - 30) / 2;
          api.roundRect(ctx, bx, by, 30, 30, 8);
          ctx.fillStyle = reveal
            ? (isRight ? 'rgba(95,211,154,.28)' : isPick ? 'rgba(255,107,107,.28)' : 'rgba(255,255,255,.06)')
            : (hv > .02 ? 'rgba(226,182,87,.22)' : 'rgba(255,255,255,.07)');
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.stroke();
          var mark = reveal && isRight ? '✓' : reveal && isPick ? '✕' : gone ? '–' : String(i + 1);
          api.text(ctx, mark, bx + 15, by + 16, {
            size: 17, fam: 'mono', weight: 700, align: 'center', baseline: 'middle',
            color: reveal && isRight ? C.green : reveal && isPick ? C.red : gone ? C.muted : C.ink
          });

          // text
          var ty = r.y + (r.h - r.lines.length * 20) / 2 + 15;
          for (var j = 0; j < r.lines.length; j++) {
            api.text(ctx, r.lines[j], bx + 44, ty + j * 20, { size: 16, weight: 600, color: ink });
          }

          // struck-through look for removed options
          if (gone) {
            ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(bx + 44, r.y + r.h / 2); ctx.lineTo(r.x + r.w - 18, r.y + r.h / 2); ctx.stroke();
          }
          ctx.restore();
        }
      }

      function drawHint(ctx, L) {
        if (st.hint <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, st.hint / .9);
        api.pill(ctx, 'Press 1-4 or tap an answer · L spends the 50:50 lifeline', W / 2, Math.max(TOP + 20, L.stemTop - 16), {
          size: 17, fam: 'body', align: 'center', bg: 'rgba(6,10,20,.88)', stroke: 'rgba(226,182,87,.45)', color: C.ink
        });
        ctx.restore();
      }

      function drawVerdict(ctx) {
        var k = api.clamp(st.mt / 0.5, 0, 1);
        ctx.save();
        ctx.globalAlpha = k * .78;
        ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        var win = st.result === 'win';
        var title = win ? 'BOARD RECOMMENDS' : st.result === 'dry' ? 'BOARD OUT OF QUESTIONS' : 'NOT THIS MONTH';
        var sub = win
          ? st.answered + ' questions · ' + st.hearts + ' composure left'
          : 'Board at ' + Math.ceil(st.hp) + '% · ' + st.correct + ' of ' + st.answered + ' correct';
        var sc = api.ease.outBack(api.clamp(st.mt / 0.55, 0, 1));
        ctx.translate(W / 2, H / 2 - 20);
        ctx.scale(0.6 + sc * 0.4, 0.6 + sc * 0.4);
        api.text(ctx, title, 0, 0, { size: 48, fam: 'display', align: 'center', baseline: 'middle', color: win ? C.gold2 : C.red, shadow: true, shadowBlur: 30 });
        api.text(ctx, sub, 0, 46, { size: 19, align: 'center', baseline: 'middle', color: C.ink2 });
        ctx.restore();
      }

      function draw(ctx) {
        var L = ensureLayout(ctx);
        if (!L) {
          // no question yet (intro / empty pool) — draw a neutral board frame
          L = st.L = { stemTop: 300, stemH: 90, stemLines: [], rows: [], boardBot: 302, tableY: 252, s: 1, life: { x: 0, y: 0, w: 92, h: 26 } };
        }
        drawBackdrop(ctx, L);
        for (var i = 0; i < 3; i++) drawMember(ctx, i, L);
        drawTable(ctx, L);
        drawSpotlight(ctx, L);
        drawBoltAndRings(ctx);
        drawSpeech(ctx, L);
        drawHp(ctx);
        if (st.q) { drawPanel(ctx, L); drawOptions(ctx, L); }
        else if (st.mode === 'intro') {
          api.text(ctx, phaseDef().title, W / 2, 400, { size: 34, fam: 'display', align: 'center', color: C.gold2 });
          api.text(ctx, phaseDef().sub, W / 2, 440, { size: 18, align: 'center', color: C.ink2 });
        }
        drawHint(ctx, L);
        if (st.mode === 'done' || st.mode === 'end') drawVerdict(ctx);
      }

      // ================= input ===============================================
      function hitRow(x, y) {
        var L = st.L; if (!L || !L.rows.length) return -1;
        for (var i = 0; i < 4; i++) {
          var r = L.rows[i];
          if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
        }
        return -1;
      }

      function onKey(k, down) {
        if (!down || st.over || st.mode === 'done' || st.mode === 'end') return;
        if (k === 'l' || k === 'L') { useLifeline(); return; }
        if (st.mode === 'reveal' && st.mt > 0.45 && (k === ' ' || k === 'Spacebar' || k === 'Enter')) { advance(); return; }
        if (st.mode !== 'ask') return;
        if (k >= '1' && k <= '4') { answer(Number(k) - 1); return; }
        var low = String(k).toLowerCase();
        if (low === 'a') answer(0);
        else if (low === 'b') answer(1);
        else if (low === 'c') answer(2);
        else if (low === 'd') answer(3);
      }

      function onPointer(p) {
        if (!p || st.over || st.mode === 'done' || st.mode === 'end') return;
        if (p.type === 'move' || p.type === 'down') st.hover = hitRow(p.x, p.y);
        if (p.type !== 'down') return;
        var L = st.L;
        if (st.mode === 'ask' && L && st.lifeline) {
          var lb = L.life;
          if (p.x >= lb.x - 4 && p.x <= lb.x + lb.w + 4 && p.y >= lb.y - 6 && p.y <= lb.y + lb.h + 6) { useLifeline(); return; }
        }
        if (st.mode === 'reveal') { if (st.mt > 0.45) advance(); return; }
        if (st.mode !== 'ask') return;
        var i = hitRow(p.x, p.y);
        if (i >= 0) answer(i);
      }

      return {
        update: update,
        draw: draw,
        onKey: onKey,
        onPointer: onPointer,
        destroy: function () {
          st.rings.length = 0; st.floats.length = 0; st.motes.length = 0; st.members.length = 0;
          st.bolt = null; st.q = null; st.L = null; POOL = []; used = {};
        }
      };
    }
  });
})();
