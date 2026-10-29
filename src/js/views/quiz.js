/* VIEW quiz — practice questions with explanations, missed-question review, and a timed exam simulator weighted like CON 3990V */
(function () {
  'use strict';
  var CORB = window.CORB;
  var S = null;           // the quiz in progress (kept while the reader moves around the app)
  var timerId = null;
  var keyHandler = null;  // keyboard shortcuts while a question is on screen: 1-4 or A-D answer, Enter or → next, ← back and F flag in the simulator
  function unkey() { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } }

  function pickWeighted(n, all) {
    var phases = CORB.data.phases(), out = [], used = {};
    all = all || CORB.data.questions();
    var total = CORB.util.sum(phases.map(function (p) { return p.qs; })) || 150;
    phases.forEach(function (p) {
      var want = Math.round(n * p.qs / total), pool = CORB.util.shuffle(all.filter(function (q) { return q.phase === p.id; }));
      pool.slice(0, want).forEach(function (q) { out.push(q); used[q.id] = 1; });
    });
    var rest = CORB.util.shuffle(all.filter(function (q) { return !used[q.id]; }));
    while (out.length < n && rest.length) out.push(rest.pop());
    return CORB.util.shuffle(out).slice(0, n);
  }
  // o: { mode: practice|exam|missed, n, label, phase?, lessons?: [ids], src?: 'class'|'tips', path?: exam-path task id }
  function start(o) {
    var all = CORB.data.questions().filter(function (q) {
      return (!o.phase || q.phase === o.phase) && (!o.src || q.src === o.src) && (!o.lessons || o.lessons.indexOf(q.lesson) >= 0);
    }), pool;
    if (o.mode === 'exam') pool = pickWeighted(o.n, all);
    else if (o.mode === 'missed') pool = CORB.util.shuffle(CORB.scoring.missedIds().map(CORB.data.question).filter(Boolean)).slice(0, o.n || 25);
    else pool = CORB.util.shuffle(all).slice(0, o.n || 10);
    if (!pool.length) { CORB.ui.toast(o.mode === 'missed' ? 'No missed questions right now. Nice.' : 'No questions match that choice.', 'warn'); return; }
    S = { mode: o.mode, phase: o.phase || '', label: o.label, path: o.path || '', items: pool.map(function (q) { return { q: q, opts: CORB.util.shuffle(q.options), pick: -1, flag: false, done: false }; }), i: 0, started: Date.now(),
      limit: o.mode === 'exam' ? Math.round(pool.length * 72) : 0, finished: false };
    CORB.go('quiz', { run: '1' });
  }
  CORB.quiz = { start: start };
  function finish() {
    if (!S || S.finished) return;
    clearInterval(timerId); unkey();
    S.finished = true; S.ended = Date.now();
    var byPhase = {}, right = 0;
    S.items.forEach(function (it) {
      var ok = it.pick >= 0 && !!it.opts[it.pick].correct; it.ok = ok; if (ok) right++;
      var b = byPhase[it.q.phase] = byPhase[it.q.phase] || [0, 0]; b[1]++; if (ok) b[0]++;
      if (S.mode === 'exam' || !it.done) CORB.scoring.recordAnswer(it.q.id, ok);
    });
    S.right = right;
    CORB.scoring.recordQuiz({ mode: S.mode, label: S.label, path: S.path || undefined, total: S.items.length, correct: right, byPhase: byPhase, items: S.items.map(function (it) { return { id: it.q.id, ok: it.ok }; }) });
    if (S.path) CORB.emit('path-quiz', { id: S.path, pct: CORB.util.pct(right, S.items.length) });
    CORB.go('quiz', { result: '1' });
  }
  // where a question came from: the B2B class practice exam (checked against the RFO) or a topic past test takers reported
  function sourceNote(q) {
    var h = CORB.ui.h;
    if (q.src !== 'class' && q.src !== 'tips') return null;
    var label = q.src === 'tips' ? 'Topic reported by past test takers' : q.check === 'fixed' ? 'B2B class practice exam · corrected for the RFO' : q.check === 'updated' ? 'B2B class practice exam · updated for the RFO' : 'B2B class practice exam · still right under the RFO';
    return h('div.q-origin.mt-2', {}, CORB.ui.badge(q.check === 'fixed' ? 'warn' : q.src === 'tips' ? 'brass' : 'info', label, q.src === 'tips' ? 'users' : 'school'),
      q.note ? h('p.small.muted.mt-2', {}, h('b', {}, 'What changed: '), q.note) : null, q.verify ? CORB.ui.verifyBadge(q.verify) : null);
  }
  function fmtTime(sec) { sec = Math.max(0, Math.round(sec)); var hh = Math.floor(sec / 3600), mm = Math.floor(sec % 3600 / 60), ss = sec % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); }

  // ---- setup ----
  function setup(root, h, icon, p) {
    var missed = CORB.scoring.missedIds().length, bank = CORB.data.questions().length;
    root.appendChild(CORB.ui.pageHead({ title: 'Practice test', lede: 'Exam-style questions written from the official competency list and the RFO FAR. Each answer explains why, and shows where the rule is written.' }));
    if (S && !S.finished) root.appendChild(h('div.callout.brass.mb-4', {}, icon('clock'), h('div', {}, h('b', {}, 'You have a quiz in progress'), h('span', {}, (S.label || 'Quiz') + ' · question ' + (S.i + 1) + ' of ' + S.items.length + '. '), h('a', { href: '#/quiz?run=1' }, 'Go back to it'))));
    root.appendChild(h('div.card.raised.quiz-hero', {},
      h('div', {}, h('h2', {}, 'Quick 10'), h('p.muted', {}, '10 mixed questions with the answer explained after each one. A good daily habit.')),
      h('button.btn.primary.lg', { type: 'button', onclick: function () { start({ mode: 'practice', n: 10, label: 'Quick 10' }); } }, icon('play'), 'Start')));
    var phaseSel = h('select.select#q-phase', {}, [h('option', { value: '' }, 'All four areas')].concat(CORB.data.phases().map(function (ph) { return h('option', { value: ph.id, selected: p.phase === ph.id }, ph.code + ' ' + ph.name); })));
    var nSel = h('select.select#q-n', {}, [10, 25, 50].map(function (n) { return h('option', { value: String(n) }, n + ' questions'); }));
    var exN = h('div.seg', { role: 'radiogroup', 'aria-label': 'Exam length' }), exChoice = 50;
    function paintEx() { exN.innerHTML = ''; [[25, '25 · 30 min'], [50, '50 · 1 hr'], [100, '100 · 2 hrs'], [150, '150 · 3 hrs']].forEach(function (x) { exN.appendChild(h('button' + (exChoice === x[0] ? '.on' : ''), { type: 'button', onclick: function () { exChoice = x[0]; paintEx(); } }, x[1])); }); }
    paintEx();
    root.appendChild(h('div.grid.cols-3.mt-4.quiz-modes', {},
      h('div.card', {}, h('div.mode-icon', {}, icon('target')), h('h3', {}, 'By exam area'), h('p.small.muted', {}, 'Practice one area at a time, with explanations.'),
        h('div.stack.tight.mt-3', {}, phaseSel, nSel, h('button.btn', { type: 'button', onclick: function () { var ph = CORB.data.phase(phaseSel.value); start({ mode: 'practice', phase: phaseSel.value, n: +nSel.value, label: ph ? ph.name : 'Mixed practice' }); } }, icon('play'), 'Start practice'))),
      h('div.card', {}, h('div.mode-icon', {}, icon('repeat')), h('h3', {}, 'Missed questions'), h('p.small.muted', {}, missed ? 'You have ' + CORB.util.plural(missed, 'question') + ' to try again. Get one right and it leaves this list.' : 'Questions you miss anywhere in the guide collect here.'),
        h('button.btn.mt-3', { type: 'button', disabled: !missed, onclick: function () { start({ mode: 'missed', n: 25, label: 'Missed questions' }); } }, icon('play'), 'Retry missed')),
      h('div.card.exam-mode', {}, h('div.mode-icon', {}, icon('timer')), h('h3', {}, 'Exam simulator'), h('p.small.muted', {}, 'Timed like the real exam (72 seconds a question), mixed in the same proportions, no answers until you finish.'),
        h('div.mt-3', {}, exN), h('button.btn.brass.mt-3', { type: 'button', onclick: function () { start({ mode: 'exam', n: Math.min(exChoice, bank), label: 'Exam simulator · ' + Math.min(exChoice, bank) }); } }, icon('play'), 'Start the timer'))));
    var nClass = CORB.data.questions().filter(function (q) { return q.src === 'class'; }).length, nTips = CORB.data.questions().filter(function (q) { return q.src === 'tips'; }).length;
    if (nClass) root.appendChild(h('div.card.mt-4.class-sets', {}, h('div.row.between', {}, h('div', {}, h('h3', {}, 'From your B2B class'),
      h('p.small.muted', {}, 'The Back to Basics class practice exam (' + nClass + ' questions), checked against the RFO FAR and corrected where the rules changed, plus ' + nTips + ' questions on topics past test takers reported. Each answer says what changed.')),
      h('a.btn.sm.ghost', { href: '#/path?tab=check' }, icon('clipboard'), 'What changed')),
      h('div.row.tight.mt-3', {},
        h('button.btn', { type: 'button', onclick: function () { start({ mode: 'practice', src: 'class', n: 25, label: 'B2B class practice exam' }); } }, icon('play'), 'Class exam · 25'),
        h('button.btn', { type: 'button', onclick: function () { start({ mode: 'exam', src: 'class', n: 50, label: 'B2B class exam, timed · 50' }); } }, icon('timer'), 'Timed · 50'),
        nTips ? h('button.btn', { type: 'button', onclick: function () { start({ mode: 'practice', src: 'tips', n: 20, label: 'Test-taker topics' }); } }, icon('users'), 'Test-taker topics · 20') : null)));
    var hist = (CORB.get('progress.quiz', []) || []).slice(-8).reverse();
    if (hist.length) root.appendChild(h('section', {}, h('div.section-head', {}, h('h2', {}, 'Recent results')),
      h('div.card.flush', {}, h('div.list', {}, hist.map(function (r) {
        var pc = CORB.util.pct(r.correct, r.total);
        return h('div.list-item.hist', {}, h('span.num.hist-pc' + (pc >= 70 ? '.ok' : '.low'), {}, pc + '%'), h('div.grow', {}, h('b', {}, r.label || r.mode), h('div.tiny.muted', {}, r.correct + ' of ' + r.total + ' right · ' + CORB.util.fmtDateTime(r.ts))));
      })))));
    root.appendChild(h('p.muted.small.mt-5', {}, 'The bank has ' + bank + ' questions. They are practice questions written for this guide or adapted from B2B class material and checked against the RFO, not questions from the real exam, which WarU keeps secure. Pass mark on the real exam: 70%.'));
  }

  // ---- running ----
  function run(root, h, icon) {
    if (!S) { CORB.go('quiz'); return; }
    if (S.finished) { CORB.go('quiz', { result: '1' }); return; }
    var it = S.items[S.i], q = it.q, exam = S.mode === 'exam';
    var top = h('div.q-top', {}, h('div.row.between', {}, h('b', {}, S.label), h('div.row.tight', {},
      exam ? h('span.timer.num', { id: 'qtimer' }, '') : null,
      h('button.btn.sm.ghost', { type: 'button', onclick: function () { CORB.ui.confirm('Stop this quiz? Questions you answered so far are scored.', { ok: 'Stop and score it' }).then(function (ok) { if (ok) finish(); }); } }, icon('stop'), 'Stop'))),
      h('div.row.between.mt-2', {}, h('span.small.muted', {}, 'Question ' + (S.i + 1) + ' of ' + S.items.length), CORB.ui.phaseBadge(q.phase, true)),
      CORB.ui.bar((S.i) / S.items.length * 100));
    root.appendChild(top);
    var fb = h('div.q-feedback', { hidden: true });
    var card = h('div.card.raised.q-card', {}, h('div.q-stem-big', {}, q.stem));
    var btns = it.opts.map(function (o, oi) {
      var b = h('button.opt' + (it.pick === oi ? '.picked' : ''), { type: 'button', 'aria-pressed': it.pick === oi ? 'true' : 'false' }, h('span.opt-l', {}, 'ABCD'[oi]), h('span', {}, o.text));
      b.addEventListener('click', function () {
        if (!exam && it.done) return;
        it.pick = oi;
        if (exam) { btns.forEach(function (x, xi) { x.classList.toggle('picked', xi === oi); x.setAttribute('aria-pressed', xi === oi ? 'true' : 'false'); }); return; }
        it.done = true; var ok = !!o.correct; CORB.scoring.recordAnswer(q.id, ok);
        btns.forEach(function (x, xi) { x.disabled = true; if (it.opts[xi].correct) x.classList.add('right'); });
        if (!ok) b.classList.add('wrong');
        showFeedback(ok, o);
      });
      return b;
    });
    function showFeedback(ok, o) {
      fb.hidden = false; fb.innerHTML = '';
      var right = it.opts.filter(function (x) { return x.correct; })[0];
      fb.appendChild(CORB.ui.callout(ok ? 'ok' : 'warn', ok ? 'check' : 'info', ok ? 'Right.' : 'Not quite. The answer is: ' + right.text, CORB.ui.rich((ok ? '' : (o.why ? 'Why not your pick: ' + o.why + '\n\n' : '')) + (right.why || '') + (q.cite ? '\n\nWhere it is written: ' + q.cite : ''))));
      var origin = sourceNote(q); if (origin) fb.appendChild(origin);
      if (q.lesson && CORB.data.lesson(q.lesson)) fb.appendChild(h('a.btn.sm.ghost.mt-2', { href: '#/lesson?id=' + q.lesson }, icon('book'), 'Lesson: ' + CORB.data.lesson(q.lesson).title));
      nextBtn.disabled = false; nextBtn.focus();
    }
    card.appendChild(h('div.opts', {}, btns));
    card.appendChild(h('div.row.tight.mt-3', {}, CORB.ui.listenBtn(function () { return q.stem + '\n' + it.opts.map(function (o, i) { return 'ABCD'[i] + ': ' + o.text; }).join('\n'); }, 'Listen'),
      exam ? h('button.btn.sm' + (it.flag ? '.on' : ''), { type: 'button', onclick: function () { it.flag = !it.flag; CORB.render(); } }, icon('flag'), it.flag ? 'Flagged' : 'Flag for review') : null));
    card.appendChild(fb);
    root.appendChild(card);
    var last = S.i === S.items.length - 1;
    var nextBtn = h('button.btn.primary.lg', { type: 'button', disabled: !exam && !it.done, onclick: function () { if (last) { if (exam) { var un = S.items.filter(function (x) { return x.pick < 0; }).length; CORB.ui.confirm(un ? CORB.util.plural(un, 'question') + ' not answered. Finish anyway?' : 'Finish and see your score?', { ok: 'Finish' }).then(function (ok) { if (ok) finish(); }); } else finish(); } else { S.i++; CORB.render(); } } }, last ? 'Finish' : 'Next', icon(last ? 'check' : 'arrow-right'));
    root.appendChild(h('div.q-nav', {}, h('button.btn', { type: 'button', disabled: S.i === 0 || !exam, hidden: !exam, onclick: function () { S.i--; CORB.render(); } }, icon('arrow-left'), 'Back'), h('span.grow'), nextBtn));
    if (!exam && it.done) showFeedback(!!it.opts[it.pick].correct, it.opts[it.pick]);
    if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) card.appendChild(h('p.tiny.muted.mt-3.q-keys', {}, 'Keys: ', h('kbd', {}, '1'), '–', h('kbd', {}, '4'), ' answer · ', h('kbd', {}, 'Enter'), ' or ', h('kbd', {}, '→'), ' next' + (exam ? ' · ' : ''), exam ? h('kbd', {}, '←') : null, exam ? ' back · ' : null, exam ? h('kbd', {}, 'F') : null, exam ? ' flag' : null));
    unkey();
    keyHandler = function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (document.querySelector('.modal-scrim, .tour-layer, .buddy, .pop')) return;
      var k = e.key, idx = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 }[k.length === 1 ? k.toLowerCase() : k];
      if (idx != null) { if (btns[idx] && !btns[idx].disabled) { e.preventDefault(); btns[idx].click(); } return; }
      var onControl = document.activeElement && /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
      if ((k === 'ArrowRight' || (k === 'Enter' && !onControl)) && !nextBtn.disabled) { e.preventDefault(); nextBtn.click(); return; }
      if (k === 'ArrowLeft' && exam && S.i > 0) { e.preventDefault(); S.i--; CORB.render(); return; }
      if ((k === 'f' || k === 'F') && exam) { e.preventDefault(); it.flag = !it.flag; CORB.render(); }
    };
    document.addEventListener('keydown', keyHandler);
    if (exam) {
      root.appendChild(h('details.acc.mt-4', {}, h('summary', {}, icon('grid'), 'All questions', icon('chevron', 'chev')), h('div.acc-body', {}, h('div.q-grid', {}, S.items.map(function (x, xi) {
        return h('button' + (xi === S.i ? '.cur' : '') + (x.pick >= 0 ? '.ans' : '') + (x.flag ? '.flag' : ''), { type: 'button', 'aria-label': 'Question ' + (xi + 1), onclick: function () { S.i = xi; CORB.render(); } }, String(xi + 1));
      })), h('p.tiny.muted.mt-2', {}, 'Filled = answered · brass outline = flagged'))));
      var tick = function () { var el = document.getElementById('qtimer'); var left = S.limit - (Date.now() - S.started) / 1000; if (!el) return; el.textContent = fmtTime(left); el.classList.toggle('warn', left < 600); if (left <= 0) { clearInterval(timerId); CORB.ui.toast('Time is up', 'warn'); finish(); } };
      clearInterval(timerId); tick(); timerId = setInterval(tick, 1000);
    }
  }

  // ---- results ----
  function result(root, h, icon) {
    if (!S || !S.finished) { CORB.go('quiz'); return; }
    var pc = CORB.util.pct(S.right, S.items.length), pass = pc >= 70;
    root.appendChild(h('div.card.raised.result-hero', {}, CORB.ui.ring(pc, pc + '%', pass ? 'var(--ok)' : 'var(--accent-2)', 120),
      h('div', {}, h('div.eyebrow', {}, S.label), h('h1', {}, pass ? 'Passing score' : 'Keep going'), h('p.lede', {}, S.right + ' of ' + S.items.length + ' right. The real exam needs 70%.' + (S.mode === 'exam' ? ' Time used: ' + fmtTime((S.ended - S.started) / 1000) + '.' : '')),
        h('div.row.tight.mt-3', {}, S.path ? h('a.btn.primary', { href: '#/path' }, icon('route'), 'Back to my exam path') : null,
          h('button.btn' + (S.path ? '' : '.primary'), { type: 'button', onclick: function () { S = null; CORB.go('quiz'); } }, icon('refresh'), 'New quiz'),
          S.items.some(function (x) { return !x.ok; }) ? h('button.btn', { type: 'button', onclick: function () { start({ mode: 'missed', n: 25, label: 'Missed questions' }); } }, icon('repeat'), 'Retry the ones I missed') : null))));
    var by = {}; S.items.forEach(function (it) { var b = by[it.q.phase] = by[it.q.phase] || [0, 0]; b[1]++; if (it.ok) b[0]++; });
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'By exam area'), h('span.muted', {}, 'The Pearson score report shows the same four areas')));
    root.appendChild(h('div.grid.cols-4', {}, CORB.data.phases().map(function (p) {
      var b = by[p.id]; var v = b ? CORB.util.pct(b[0], b[1]) : null;
      return h('div.stat', {}, h('div.label', {}, p.short), h('div.value', {}, v == null ? '—' : v + '%'), CORB.ui.bar(v || 0, 'ph-' + p.id), h('div.sub', {}, b ? b[0] + ' of ' + b[1] : 'none in this quiz'));
    })));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'Review')));
    root.appendChild(h('div.stack.tight', {}, S.items.map(function (it, i) {
      var right = it.opts.filter(function (o) { return o.correct; })[0], mine = it.pick >= 0 ? it.opts[it.pick] : null;
      return h('details.acc.review' + (it.ok ? '.ok' : '.no'), {}, h('summary', {}, icon(it.ok ? 'check' : 'x'), h('span.grow', {}, (i + 1) + '. ' + it.q.stem), icon('chevron', 'chev')),
        h('div.acc-body', {}, h('p', {}, h('b', {}, 'Your answer: '), mine ? mine.text : 'not answered'), it.ok ? null : h('p', {}, h('b', {}, 'Right answer: '), right.text),
          CORB.ui.rich((right.why || '') + (it.q.cite ? '\n\nWhere it is written: ' + it.q.cite : '')), sourceNote(it.q),
          it.q.lesson && CORB.data.lesson(it.q.lesson) ? h('a.btn.sm.ghost.mt-2', { href: '#/lesson?id=' + it.q.lesson }, icon('book'), 'Lesson: ' + CORB.data.lesson(it.q.lesson).title) : null));
    })));
  }

  CORB.registerView({ id: 'quiz', title: 'Practice test', section: 'Practice', icon: 'quiz', nav: true, order: 70, mobile: true, short: 'Practice',
    blurb: 'Exam-style questions and a timed exam simulator', keywords: 'quiz test exam practice simulator questions CON 3990V',
    badge: function () { return 0; },
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon, p = ctx.params;
      if (p.start === 'quick') { start({ mode: 'practice', n: 10, label: 'Quick 10' }); return; }
      if (p.start === 'missed') { start({ mode: 'missed', n: 25, label: 'Missed questions' }); return; }
      if (p.run) run(root, h, icon); else if (p.result) result(root, h, icon); else setup(root, h, icon, p);
    },
    onLeave: function () { clearInterval(timerId); unkey(); } });
})();
