/* VIEW: dashboard — the candidate's home inside the workspace.
   First visit: greeting, the setup card, "Start here", the board countdown, domain heat and the study plan. The
   readiness ring, its four parts and the streak appear once there is something to measure, so day one is not a
   page of zeros. Records progress.lastView on every navigation so "Continue" can bring the user back. */
(function () {
  'use strict';
  var CORB = window.CORB, h = CORB.ui.h, icon = CORB.ui.icon, U = CORB.util;

  var CLASSES = ['I', 'II', 'III', 'IV'];
  var CLASS_HINT = { I: 'SAT', II: '$500K to $5M, SaP', III: '$10M to $100M', IV: '$250M and above' };
  var WEIGHTS = [
    ['coverage', 'Coverage', 30, 'Questions you have opened for your organization and warrant class', 'c-accent'],
    ['memory', 'Memory', 30, 'Spaced-repetition mastery from flashcards', 'c-gold'],
    ['accuracy', 'Accuracy', 20, 'Quiz answers, scored by domain', 'c-info'],
    ['performance', 'Performance', 20, 'Mock-board rubric scores, out of 5', 'c-ok']
  ];
  var frames = [];              // animation frames to cancel on leave

  // ---- remember where the user goes so the dashboard can offer "Continue" ----
  var NOT_RESUMABLE = { home: 1, dashboard: 1, settings: 1, about: 1, glossary: 1, resources: 1, regulations: 1 };
  CORB.on('route', function (r) {
    try {
      if (!r || !r.id || NOT_RESUMABLE[r.id]) return;
      var def = CORB.views[r.id]; if (!def || def.layout === 'full') return;
      CORB.set('progress.lastView', { view: r.id, title: def.title || r.id, params: r.params || {}, ts: new Date().toISOString() }, { silent: true });
    } catch (e) { /* never let bookkeeping break navigation */ }
  });

  // =====================================================================
  // helpers
  // =====================================================================
  function sum(a, b) { return a + b; }
  // Navigate, but never drop the user on the landing page because a view is missing from this build.
  function go(view, params) {
    return function () {
      if (!CORB.views[view]) { CORB.ui.toast('That section is not included in this build yet', 'warn'); return; }
      CORB.go(view, params || {});
    };
  }
  function dayKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function parseDay(iso) { var d = new Date(String(iso || '') + 'T00:00:00'); return isNaN(d) ? null : d; }
  function fmtDay(iso, o) { var d = parseDay(iso); if (!d) return String(iso || ''); return d.toLocaleDateString(undefined, o || { year: 'numeric', month: 'short', day: 'numeric' }); }
  function shortDay(iso) { return fmtDay(iso, { month: 'short', day: 'numeric' }); }
  function greeting() { var hr = new Date().getHours(); return hr < 5 ? 'Still at it' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'; }
  function classLabel(c) { return 'Class ' + c; }
  function relTime(ts) {
    if (!ts) return ''; var t = new Date(ts); if (isNaN(t)) return '';
    var m = Math.round((Date.now() - t.getTime()) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    var hr = Math.round(m / 60); if (hr < 24) return hr === 1 ? '1 hour ago' : hr + ' hours ago';
    var d = Math.round(hr / 24); if (d === 1) return 'yesterday'; if (d < 14) return d + ' days ago';
    return U.fmtDate(ts);
  }
  function raf(fn) { frames.push(requestAnimationFrame(function () { frames.push(requestAnimationFrame(fn)); })); }
  function trunc(s, n) { s = String(s || ''); if (s.length <= n) return s; return s.slice(0, n).replace(/\s+\S*$/, '') + '…'; }
  function nextSecondWednesday(from) {
    for (var i = 0; i < 3; i++) {
      var first = new Date(from.getFullYear(), from.getMonth() + i, 1);
      var off = (3 - first.getDay() + 7) % 7;
      var sw = new Date(first.getFullYear(), first.getMonth(), 1 + off + 7);
      if (sw > from) return sw;
    }
    return null;
  }

  // SVG progress ring (viewBox 100, scaled by CSS --size). Animates from empty on first paint.
  function svgEl(tag, attrs) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
  function ring(pct, stroke, cls) {
    var r = 50 - stroke / 2, c = 2 * Math.PI * r;
    var svg = svgEl('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', 'class': 'db-ring-svg' });
    svg.appendChild(svgEl('circle', { 'class': 'db-ring-track', cx: 50, cy: 50, r: r, fill: 'none', 'stroke-width': stroke }));
    var fill = svgEl('circle', { 'class': 'db-ring-fill' + (cls ? ' ' + cls : ''), cx: 50, cy: 50, r: r, fill: 'none', 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-dasharray': c.toFixed(3), 'stroke-dashoffset': c.toFixed(3), transform: 'rotate(-90 50 50)' });
    svg.appendChild(fill);
    var target = (c * (1 - U.clamp(pct || 0, 0, 100) / 100)).toFixed(3);
    raf(function () { fill.setAttribute('stroke-dashoffset', target); });
    return svg;
  }

  // ---- safe reads over core APIs (never throw, never depend on other views) ----
  function safeReadiness() {
    try { var r = CORB.scoring.readiness(); if (r && r.byDomain) return r; } catch (e) { console.error('[dashboard] readiness', e); }
    // Fallback: coverage-only readiness computed here, so a malformed quiz or board record cannot blank the page.
    var out = { overall: 0, byDomain: {}, seenCount: 0, total: 0, quizCount: 0, boardCount: 0, streak: 0, weakest: [] };
    try {
      var seen = CORB.get('progress.seen', {}) || {}; var pool = CORB.data.questions({}) || [];
      pool.forEach(function (q) {
        if (!q || !q.domain) return;
        var d = out.byDomain[q.domain] = out.byDomain[q.domain] || { total: 0, seen: 0, mastery: 0, mastered: 0, quizC: 0, quizT: 0, boardScores: [], score: 0, coverage: 0, quizAcc: null, boardAvg: null };
        d.total++; if (seen[q.id]) d.seen++;
      });
      var num = 0;
      Object.keys(out.byDomain).forEach(function (k) { var d = out.byDomain[k]; d.coverage = U.pct(d.seen, d.total); d.score = Math.round(d.coverage / 2); num += d.score * d.total; });
      out.total = pool.length; out.seenCount = Object.keys(seen).length; out.overall = out.total ? Math.round(num / out.total) : 0;
      out.weakest = Object.keys(out.byDomain).sort(function (a, b) { return out.byDomain[a].score - out.byDomain[b].score; }).slice(0, 3);
      try { out.streak = CORB.scoring.streak() || 0; } catch (e2) { out.streak = 0; }
    } catch (e3) { console.error('[dashboard] readiness fallback', e3); }
    return out;
  }
  function safeDue() { try { return CORB.scoring.srs.due() || []; } catch (e) { return []; } }
  function breakdown(R) {
    var tot = 0, seen = 0, mas = 0, mastered = 0, qc = 0, qt = 0, bs = [];
    Object.keys(R.byDomain || {}).forEach(function (k) { var d = R.byDomain[k]; tot += d.total || 0; seen += d.seen || 0; mas += d.mastery || 0; mastered += d.mastered || 0; qc += d.quizC || 0; qt += d.quizT || 0; bs = bs.concat(d.boardScores || []); });
    return {
      coverage: tot ? Math.round(seen / tot * 100) : 0, seen: seen, total: tot,
      memory: tot ? Math.round(mas / tot) : 0, mastered: mastered,
      accuracy: qt ? Math.round(qc / qt * 100) : null, quizC: qc, quizT: qt,
      performance: bs.length ? Math.round(bs.reduce(sum, 0) / bs.length * 10) / 10 : null, scored: bs.length
    };
  }
  function band(p) { return p >= 75 ? 'Board-ready' : p >= 50 ? 'Closing in' : p >= 25 ? 'Building' : 'Getting started'; }
  function rankDomains(R, firstRun) {
    var rows = Object.keys(R.byDomain || {}).map(function (k) { var d = R.byDomain[k]; return { name: k, total: d.total || 0, seen: d.seen || 0, score: d.score || 0, coverage: d.coverage || 0, quizAcc: d.quizAcc == null ? null : d.quizAcc, boardAvg: d.boardAvg == null ? null : d.boardAvg, mastered: d.mastered || 0 }; });
    rows.sort(function (a, b) { return firstRun ? (b.total - a.total || a.name.localeCompare(b.name)) : (a.score - b.score || b.total - a.total || a.name.localeCompare(b.name)); });
    return rows;
  }
  function activeDays(quiz, boards) {
    var days = {}; var seen = CORB.get('progress.seen', {}) || {};
    Object.keys(seen).forEach(function (k) { if (typeof seen[k] === 'string') days[seen[k]] = 1; });
    quiz.forEach(function (r) { if (r && r.ts) days[String(r.ts).slice(0, 10)] = 1; });
    boards.forEach(function (r) { if (r && r.ts) days[String(r.ts).slice(0, 10)] = 1; });
    return days;
  }
  function lastSeenQuestion() {
    var seen = CORB.get('progress.seen', {}) || {}; var best = null, key = null;
    Object.keys(seen).forEach(function (k) { var v = typeof seen[k] === 'string' ? seen[k] : ''; if (best === null || v >= best) { best = v; key = k; } });
    return key ? CORB.data.byId(key) : null;
  }
  function lastQuiz(quiz) {
    var r = quiz[quiz.length - 1]; if (!r) return null;
    var items = Array.isArray(r.items) ? r.items : []; var c = items.filter(function (i) { return i && i.correct; }).length;
    var pct = r.pct != null ? Math.round(+r.pct) : items.length ? U.pct(c, items.length) : (r.total ? U.pct(+r.score || 0, +r.total) : null);
    return { pct: isNaN(pct) ? null : pct, correct: items.length ? c : (+r.score || 0), total: items.length || +r.total || 0, ts: r.ts };
  }
  function lastBoard(boards) {
    var b = boards[boards.length - 1]; if (!b) return null;
    var vals = []; (b.questions || []).forEach(function (it) { Object.keys(it && it.scores || {}).forEach(function (k) { var v = +it.scores[k]; if (v) vals.push(v); }); });
    var avg = vals.length ? Math.round(vals.reduce(sum, 0) / vals.length * 10) / 10 : (b.avg != null ? +b.avg : null);
    return { avg: avg == null || isNaN(avg) ? null : avg, n: (b.questions || []).length, ts: b.ts };
  }

  // =====================================================================
  // profile form (shared by onboarding card and the edit modal)
  // =====================================================================
  function profileFields(profile, key, onEnter) {
    var idN = 'db-' + key + '-name', idC = 'db-' + key + '-class';
    var nameIn = h('input.input#' + idN, { type: 'text', maxlength: '40', autocomplete: 'off', placeholder: 'Rank and last name, or a callsign', value: profile.name || '' });
    var clsSel = h('select.select#' + idC, {}, h('option', { value: '' }, 'Not decided yet'), CLASSES.map(function (c) { return h('option', { value: c, selected: profile.targetClass === c }, classLabel(c) + (CLASS_HINT[c] ? ' · ' + CLASS_HINT[c] : '')); }));
    var el = h('div.db-form', {},
      h('div.field.wide', {}, h('label', { 'for': idN }, 'Your name'), nameIn, h('div.hint', {}, 'Greets you here and names your progress file.')),
      h('div.field', {}, h('label', { 'for': idC }, 'Warrant class'), clsSel));
    nameIn.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (typeof onEnter === 'function') { onEnter(); return; }
      var btn = el.parentNode && el.parentNode.querySelector('.db-form-save'); if (btn) btn.click();
    });
    return {
      el: el,
      focus: function () { nameIn.focus(); },
      save: function () {
        var n = nameIn.value.trim().slice(0, 40);
        if (!n) { CORB.ui.toast('Add a name or callsign so the app can greet you', 'warn'); nameIn.focus(); return false; }
        CORB.set('profile.name', n);
        CORB.set('profile.targetClass', clsSel.value || '');
        CORB.ui.toast('Profile saved', 'ok');
        return true;
      }
    };
  }
  function editProfile() {
    var f = profileFields(CORB.get('profile', {}) || {}, 'ed', function () { if (f.save()) { CORB.ui.closeModal(); CORB.refresh(); } });
    CORB.ui.modal({ title: 'Your profile', body: f.el, actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: function () { if (!f.save()) return false; CORB.refresh(); } }] });
  }
  function onboarding(profile) {
    var idN = 'db-ob-name';
    var nameIn = h('input.input#' + idN, { type: 'text', maxlength: '40', autocomplete: 'off', placeholder: 'Rank and last name, or a callsign', value: profile.name || '' });
    function save() {
      var n = nameIn.value.trim().slice(0, 40);
      if (n) CORB.set('profile.name', n);
      CORB.set('settings.setupDone', true);
      CORB.ui.toast(n ? 'Saved' : 'You can add a name later in Settings', 'ok');
      CORB.refresh();
    }
    nameIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    return h('section.db-onboard.rise', { 'aria-label': 'Set up' },
      h('div.db-onboard-copy', {},
        h('h2', {}, 'Set up in a few seconds'),
        h('div.field.wide.mt-3', {}, h('label', { 'for': idN }, 'Your name'), nameIn, h('div.hint', {}, 'Optional. It greets you here and names your progress file.')),
        CORB.ui.classLine ? h('div.mt-3', {}, CORB.ui.classLine()) : null),
      h('div.db-onboard-actions', {},
        h('button.btn.primary.db-form-save', { onclick: save }, icon('check'), 'Save'),
        h('button.btn.ghost', { onclick: function () { CORB.set('settings.setupDone', true); CORB.refresh(); } }, 'Later')));
  }

  // =====================================================================
  // hero, notes
  // =====================================================================
  function hero(name) {
    return h('header.db-hero.rise', {},
      h('div.db-hero-copy', {},
        h('h1.db-title', {}, greeting() + ', ', h('em', {}, name || 'Candidate'), '.'),
        name ? h('div.db-sub', {}, h('button.btn.sm.ghost', { onclick: editProfile }, icon('edit'), 'Edit profile')) : null));
  }
  function storageNote() {
    return h('div.callout.warn.db-note', {}, icon('alert'), h('div', {}, h('b', {}, 'Browser storage is switched off here'), 'Your progress lives in memory until you close this tab. Export it as a file before you leave.', h('div.mt-2', {}, h('button.btn.sm', { onclick: function () { CORB.store.exportProgress(); } }, icon('download'), 'Export progress now'))));
  }
  function noBank() {
    var cls = CORB.warrantClass ? CORB.warrantClass() : '';
    var otherClasses = !!cls && (CORB.data.questions({ anyClass: true }) || []).length > 0;
    if (otherClasses) {
      return h('div.empty.mt-5', {}, h('h3', {}, 'No ' + CORB.data.classLabel(cls) + ' questions for ' + CORB.unitName(CORB.unit())),
        h('p', {}, 'Every page follows your warrant class, and this organization has no questions tagged for it. Change your warrant class, or switch organization in the top bar.'),
        h('button.btn.primary.mt-4', { onclick: function () { CORB.ui.classPicker(); } }, icon('award'), 'Change warrant class'));
    }
    return h('div.empty.mt-5', {}, h('h3', {}, 'No questions for ' + CORB.unitName(CORB.unit())), h('p', {}, 'This copy of the app has no question bank for the selected organization. Switch organization in the top bar, or ask your facilitator for a current build.'), h('button.btn.mt-4', { onclick: go('process') }, icon('process'), 'Read the warrant process guide'));
  }

  // =====================================================================
  // readiness, countdown, streak
  // =====================================================================
  function explainReadiness() {
    CORB.ui.modal({ title: 'How readiness is measured', body: h('div', {},
      h('p.muted.small', {}, 'One score per domain, weighted by the number of questions in that domain, then rolled up for your organization and warrant class.'),
      h('div.list', {}, WEIGHTS.map(function (w) { return h('div.list-item', {}, h('b.num', { style: { minWidth: '3.2em' } }, w[2] + '%'), h('div', {}, h('b', {}, w[1]), h('div.muted.small', {}, w[3]))); })),
      h('p.muted.small.mt-3', {}, 'Until you take a quiz or run a mock board, coverage and memory carry the full weight. Readiness is a study aid, not a prediction of the board\'s decision.')) });
  }
  function readinessCard(R, firstRun) {
    var B = breakdown(R); var overall = R.overall || 0;
    var center = firstRun
      ? h('div.db-ring-center', {}, h('div.db-ring-value.dash', {}, '—'), h('div.db-ring-label', {}, 'Not started'))
      : h('div.db-ring-center', {}, h('div.db-ring-value', {}, String(overall), h('small', {}, '%')), h('div.db-ring-label', {}, band(overall)));
    var big = h('div.db-ring.db-ring-lg', { role: 'img', 'aria-label': firstRun ? 'Readiness not started' : 'Readiness ' + overall + ' percent, ' + band(overall) }, ring(firstRun ? 0 : overall, 8, overall >= 75 ? 'c-gold' : 'c-accent'), center);
    var parts = WEIGHTS.map(function (w) {
      var v = B[w[0]]; var perf = w[0] === 'performance';
      var pct = v == null ? 0 : perf ? v / 5 * 100 : v;
      var text = firstRun || v == null ? '—' : perf ? v.toFixed(1) : v + '%';
      var sub = firstRun ? w[3]
        : w[0] === 'coverage' ? B.seen + ' of ' + B.total + ' opened'
        : w[0] === 'memory' ? U.plural(B.mastered, 'card') + ' mastered'
        : w[0] === 'accuracy' ? (v == null ? 'No quiz yet' : B.quizC + ' of ' + B.quizT + ' correct')
        : (v == null ? 'No mock board yet' : 'of 5 · ' + U.plural(B.scored, 'scored answer'));
      return h('div.db-part', {},
        h('div.db-ring.db-ring-sm', { 'aria-hidden': 'true' }, ring(firstRun || v == null ? 0 : pct, 11, w[4])),
        h('div.db-part-text', {}, h('b', {}, text), h('span.db-part-name', {}, w[1]), h('span.db-part-sub', {}, sub)),
        h('span.db-part-w', { title: 'Weight in the overall score' }, w[2] + '%'));
    });
    var foot = firstRun
      ? 'Readiness appears after your first session: open questions, grade flashcards, take a quiz, run a mock board.'
      : U.plural(B.seen, 'question') + ' opened of ' + B.total + ' in ' + CORB.unitName(CORB.unit()) + (R.quizCount ? ' · ' + U.plural(R.quizCount, 'quiz', 'quizzes') : '') + (R.boardCount ? ' · ' + U.plural(R.boardCount, 'mock board') : '');
    return h('section.card.db-ready', { 'aria-label': 'Board readiness' },
      h('div.db-ready-head', {}, h('div.eyebrow', {}, 'Board readiness'), h('button.btn.sm.ghost', { onclick: explainReadiness }, icon('info'), 'How it works')),
      h('div.db-ready-body', {}, big, h('div.db-parts', {}, parts)),
      h('div.db-ready-foot', {}, foot));
  }
  function countdownTile(meta) {
    var iso = meta.next_board || '', cadence = meta.board_cadence || '';
    var days = iso && parseDay(iso) ? U.daysUntil(iso) : null;
    var big, lab, note, note2 = cadence;
    if (days == null || isNaN(days)) { big = '—'; lab = 'next board date not set'; note = 'Confirm the date with C&P.'; }
    else if (days > 0) {
      big = String(days); lab = days === 1 ? 'day to the board' : 'days to the board';
      var wk = Math.floor(days / 7), rem = days % 7;
      note = fmtDay(iso, { weekday: 'long', month: 'long', day: 'numeric' }) + (days >= 14 ? ' · ' + U.plural(wk, 'week') + (rem ? ', ' + U.plural(rem, 'day') : '') : '');
    }
    else if (days === 0) { big = 'Today'; lab = 'is board day'; note = 'Rule, cite, application, risk. You have done the work.'; }
    else {
      var proj = /second wednesday/i.test(cadence) ? nextSecondWednesday(new Date()) : null;
      big = String(-days); lab = -days === 1 ? 'day since the scheduled board' : 'days since the scheduled board';
      note = proj ? 'Next projected: ' + fmtDay(dayKey(proj)) + ' · confirm with C&P' : 'Confirm the next date with C&P.';
    }
    return h('section.db-count', { 'aria-label': 'Board countdown' },
      h('div.db-count-eyebrow', {}, icon('calendar'), 'Next CORB'),
      h('div.db-count-big', {}, big),
      h('div.db-count-label', {}, lab),
      h('div.db-count-note', {}, note),
      note2 ? h('div.db-count-note.dim', {}, note2) : null,
      h('div.db-count-orn', { 'aria-hidden': 'true' }));
  }
  function streakTile(R, quiz, boards) {
    var days = activeDays(quiz, boards); var today = new Date(); today.setHours(0, 0, 0, 0);
    var pips = []; for (var i = 6; i >= 0; i--) { var k = dayKey(addDays(today, -i)); pips.push(h('span.db-pip' + (days[k] ? '.on' : '') + (i === 0 ? '.today' : ''), { title: fmtDay(k, { weekday: 'short', month: 'short', day: 'numeric' }) })); }
    var n = R.streak || 0; var todayDone = !!days[dayKey(today)];
    var msg = n === 0 ? 'Open a question, take a quiz or run a mock board to start one.' : todayDone ? 'Studied today. Keep the chain unbroken.' : 'Study today to keep it going.';
    return h('section.stat.db-streak', { 'aria-label': 'Study streak' },
      h('div.label', {}, 'Study streak'),
      h('div.db-streak-row', {}, h('div.value', {}, String(n), h('small', {}, n === 1 ? ' day' : ' days')), h('div.db-pips', { 'aria-label': 'Activity over the last seven days' }, pips)),
      h('div.delta', {}, msg));
  }

  // =====================================================================
  // continue tiles + quick actions
  // =====================================================================
  function tile(o) {
    return h('button.db-tile', { onclick: o.on },
      h('span.db-tile-icon', {}, icon(o.icon)),
      h('span.db-tile-label', {}, o.label),
      h('span.db-tile-value' + (o.text ? '.text' : ''), {}, o.value),
      o.sub ? h('span.db-tile-sub', {}, o.sub) : null,
      h('span.db-tile-go', { 'aria-hidden': 'true' }, icon('arrow-right')));
  }
  function questionTile(q, label) {
    return tile({ label: label, value: trunc(q.question, 110), text: true, sub: q.domain + (q.topic ? ' · ' + q.topic : ''), icon: 'book', on: go('library', { id: q.id }) });
  }
  function resumeTile() {
    var lv = CORB.get('progress.lastView'); var def = lv && lv.view ? CORB.views[lv.view] : null;
    if (def && lv.view === 'library' && lv.params && lv.params.id) { var q = CORB.data.byId(lv.params.id); if (q) return questionTile(q, 'Last question'); }
    if (def) return tile({ label: 'Pick up where you left off', value: def.title || lv.title || lv.view, text: true, sub: relTime(lv.ts), icon: def.icon || 'arrow-right', on: go(lv.view, lv.params) });
    var last = lastSeenQuestion(); if (last) return questionTile(last, 'Last question opened');
    return tile({ label: 'Question library', value: 'Browse the bank', text: true, sub: 'Filter by class, domain and organization.', icon: 'book', on: go('library') });
  }
  function dueTile(due, srsAll) {
    var n = due.length, started = Object.keys(srsAll).length > 0;
    return tile({ label: 'Flashcards', value: n ? String(n) : started ? 'All clear' : 'New deck', text: !n, sub: n ? (n === 1 ? 'card due for review' : 'cards due for review') : started ? 'Nothing due today. Add ten new cards.' : 'Start with ten cards from your weakest domain.', icon: 'cards', on: go('flashcards') });
  }
  function quizTile(lq) {
    if (!lq || lq.pct == null) return tile({ label: 'Quiz', value: 'Not yet', text: true, sub: 'Ten questions set your accuracy score.', icon: 'quiz', on: go('quiz', { n: 10 }) });
    return tile({ label: 'Last quiz', value: lq.pct + '%', sub: (lq.total ? lq.correct + ' of ' + lq.total + ' correct · ' : '') + relTime(lq.ts), icon: 'quiz', on: go('quiz', { n: 10 }) });
  }
  function boardTile(lb) {
    if (!lb || lb.avg == null) return tile({ label: 'Mock board', value: 'Not yet', text: true, sub: 'Timed oral practice, scored on the rubric.', icon: 'mic', on: go('mockboard') });
    return tile({ label: 'Last mock board', value: lb.avg.toFixed(1) + ' / 5', sub: (lb.n ? U.plural(lb.n, 'question') + ' · ' : '') + relTime(lb.ts), icon: 'mic', on: go('mockboard') });
  }
  function continueSection(R, firstRun, due, quiz, boards, srsAll, ranked) {
    var tiles;
    if (firstRun) {
      var first = ranked[0] ? ranked[0].name : '';
      tiles = [
        tile({ label: 'Step 1', value: 'Read the process guide', text: true, sub: 'Ten minutes. Know the steps before you study a single question.', icon: 'process', on: go('process') }),
        tile({ label: 'Step 2', value: 'Open your first questions', text: true, sub: first ? 'Start with ' + first + ', the largest domain in your set.' : 'Start in the question library.', icon: 'book', on: go('library', first ? { domain: first } : {}) }),
        tile({ label: 'Step 3', value: 'Take a baseline quiz', text: true, sub: 'Ten questions with a reason for every option. Sets your starting readiness.', icon: 'quiz', on: go('quiz', { n: 10 }) }),
        tile({ label: 'Every day', value: 'Ten flashcards', text: true, sub: 'Spaced repetition schedules what you are about to forget.', icon: 'cards', on: go('flashcards') })
      ];
    } else {
      tiles = [resumeTile(), dueTile(due, srsAll), quizTile(lastQuiz(quiz)), boardTile(lastBoard(boards))];
    }
    return h('section.rise.rise-2' + (firstRun ? '.db-start' : ''), { 'aria-label': firstRun ? 'Start here' : 'Continue' },
      h('div.section-head', {}, h('h2', {}, firstRun ? 'Start here' : 'Continue'), h('span.muted', {}, firstRun ? 'Do these in order' : 'Pick up where you left off')),
      h('div.db-continue', {}, tiles));
  }
  // =====================================================================
  // domain heat list
  // =====================================================================
  var HEAT_TOP = 5;
  function heatCard(ranked, firstRun) {
    var rows = ranked.map(function (r, i) {
      var heat = firstRun || !r.seen ? 'none' : r.score < 35 ? 'hot' : r.score < 65 ? 'warm' : 'cool';
      var meta = firstRun ? U.plural(r.total, 'question')
        : [r.seen + ' of ' + r.total + ' opened', r.quizAcc != null ? 'quiz ' + r.quizAcc + '%' : null, r.boardAvg != null ? 'board ' + r.boardAvg.toFixed(1) : null].filter(Boolean).join(' · ');
      var bar = h('span.db-heat-bar.' + heat, { 'aria-hidden': 'true' }, h('span'));
      if (!firstRun) raf(function () { bar.firstChild.style.width = Math.max(r.score, r.seen ? 2 : 0) + '%'; });
      return h('button.db-heat-row', { onclick: go('library', { domain: r.name }), 'aria-label': r.name + ': ' + (firstRun ? meta : r.score + ' percent ready, ' + meta) },
        h('span.db-heat-rank.' + heat, {}, String(i + 1)),
        h('span.db-heat-name', {}, r.name),
        bar,
        h('span.db-heat-meta', {}, meta),
        h('span.db-heat-score', {}, firstRun ? icon('arrow-right') : [String(r.score), h('small', {}, '%')]));
    });
    var list = h('div.db-heat', {}, rows.slice(0, HEAT_TOP));
    var more = null;
    if (rows.length > HEAT_TOP) {
      more = h('button.btn.sm.ghost.db-heat-more', { type: 'button', onclick: function () {
        rows.slice(HEAT_TOP).forEach(function (row) { list.appendChild(row); });
        more.remove();
      } }, icon('chevron'), 'Show all ' + rows.length + ' domains');
    }
    return h('section.card.db-heat-card', { 'aria-label': 'Domains' },
      h('div.card-head', {}, h('div', {}, h('h3', {}, firstRun ? 'Your domains' : 'Weakest domains first')), h('span.muted.small', {}, 'Opens in the library')),
      rows.length ? h('div', {}, list, more) : h('div.empty', {}, 'No domains in this organization set.'));
  }

  // =====================================================================
  // six-week study plan (deterministic; stored under progress.path)
  // =====================================================================
  function currentPlan() { var p = CORB.get('progress.path'); return p && Array.isArray(p.weeks) && p.weeks.length ? p : null; }
  function specialDomain(names) {
    var unit = CORB.unit(); var has = function (n) { return names.indexOf(n) >= 0; };
    if (unit === '411th CSB' && has('Korea, LCS & SOFA')) return 'Korea, LCS & SOFA';
    if (unit === '409th CSB' && has('Germany ABG-75')) return 'Germany ABG-75';
    if (has('Authority, Ethics & Leadership')) return 'Authority, Ethics & Leadership';
    return names[0] || 'General Contracting';
  }
  function buildPlan(days, ranked, meta) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var span = days != null && days > 0 ? days : 42;
    var compressed = span < 42;
    var names = ranked.map(function (r) { return r.name; });
    var cnt = function (n) { var r = ranked.filter(function (x) { return x.name === n; })[0]; return r ? r.total : 0; };
    var w0 = names[0] || 'General Contracting', w1 = names[1] || w0, w2 = names[2] || w1;
    var special = specialDomain(names);
    var D = CORB.DATA || {};
    var hasPrimers = (D.primers || []).length > 0, hasScen = !!(D.scenarios && (D.scenarios.cases || []).length), hasGames = !!(D.games && Object.keys(D.games).length), hasRegs = !!(D.regulations && (D.regulations.frameworks || []).length);
    var defs = [
      { title: 'Orient and baseline', tasks: [
        ['Read the warrant process guide end to end', 'process'],
        ['Learn the rubric: rule, cite, application, risk', 'mockboard'],
        ['Open the first ten questions in ' + w0, 'library', { domain: w0 }],
        ['Take a ten-question baseline quiz', 'quiz', { n: 10 }],
        ['Start flashcards with ten new cards', 'flashcards']] },
      { title: 'Deep dive: ' + w0, tasks: [
        ['Work through every ' + w0 + ' question (' + cnt(w0) + ')', 'library', { domain: w0 }],
        hasPrimers ? ['Read the ' + w0 + ' primer', 'primers', { domain: w0 }] : ['Write a one-page summary of ' + w0 + ' in your notes', 'library', { domain: w0 }],
        ['Clear due flashcards every day this week', 'flashcards'],
        ['Ask the mentor to probe you on ' + w0, 'mentor', { q: 'Probe me with three board questions on ' + w0 + ' and critique my answers.' }]] },
      { title: w1 === w2 ? 'Deep dive: ' + w1 : 'Deep dive: ' + w1 + ' and ' + w2, tasks: [
        ['Open every ' + w1 + ' question (' + cnt(w1) + ')', 'library', { domain: w1 }],
        w1 === w2 ? ['Quiz yourself on ' + w1 + ' twice', 'quiz', { domain: w1, n: 10 }] : ['Open every ' + w2 + ' question (' + cnt(w2) + ')', 'library', { domain: w2 }],
        ['Quiz yourself on ' + w1, 'quiz', { domain: w1, n: 10 }],
        hasRegs ? ['Map every old FAR cite you know to its RFO number in the regulation explorer', 'regulations'] : ['List the RFO citations you use most and check each one on acquisition.gov', 'library']] },
      { title: special + ' and your first mock board', tasks: [
        ['Open every ' + special + ' question (' + cnt(special) + ')', 'library', { domain: special }],
        hasScen ? ['Run two branching scenarios as the KO', 'scenarios'] : ['Talk through two scenario questions aloud, then check the answer', 'library', { kind: 'scenario' }],
        ['First mock board: five questions, timed, self-scored', 'mockboard'],
        ['Bookmark and write a note on every question you stumbled on', 'library', { bookmarked: 1 }]] },
      { title: 'Breadth pass', tasks: [
        ['One ten-question quiz a day, mixed domains', 'quiz', { n: 10 }],
        ['Re-open your bookmarked questions until each one feels easy', 'library', { bookmarked: 1 }],
        ['Second mock board, scored on the rubric', 'mockboard'],
        hasGames ? ['Threshold Run and Clause Catcher in the Arcade until you finish a run without a miss', 'arcade'] : ['Recite the warrant class thresholds from memory, then check them', 'regulations']] },
      { title: 'Polish and rehearse', tasks: [
        ['Due flashcards only, every day', 'flashcards'],
        ['Third mock board: full length, questions read aloud', 'mockboard'],
        ['Re-open your three weakest domains one last time', 'library'],
        ['Packet check: every item on the packet checklist', 'process'],
        ['The night before: rest. Know your cites, and say "confirm with C&P" when a local SOP decides it.']] }
    ];
    var weeks = defs.map(function (def, i) {
      var s = compressed ? Math.round(i * span / 6) : i * 7;
      var e = compressed ? Math.round((i + 1) * span / 6) - 1 : i * 7 + 6; if (e < s) e = s;
      return { n: i + 1, title: def.title, start: dayKey(addDays(today, s)), end: dayKey(addDays(today, e)), tasks: def.tasks.map(function (t, j) { return { id: 'w' + (i + 1) + 't' + (j + 1), text: t[0], view: t[1] || '', params: t[2] || null }; }) };
    });
    return { version: 1, generated: U.today(), board: meta.next_board || '', days: days == null ? null : days, compressed: compressed, weakest: names.slice(0, 3), weeks: weeks, done: {} };
  }
  function refreshPlan(card) {
    var done = CORB.get('progress.path.done', {}) || {}; var total = 0, n = 0;
    Array.prototype.forEach.call(card.querySelectorAll('.db-week'), function (w) {
      var wt = 0, wn = 0;
      Array.prototype.forEach.call(w.querySelectorAll('.db-task'), function (t) { wt++; total++; var d = !!done[t.getAttribute('data-task')]; t.classList.toggle('done', d); if (d) { wn++; n++; } });
      var c = w.querySelector('.db-week-count'); if (c) c.textContent = wn + ' / ' + wt;
      w.classList.toggle('done', wt > 0 && wn === wt);
    });
    var bar = card.querySelector('.db-plan-bar > span'); if (bar) bar.style.width = U.pct(n, total) + '%';
    var lbl = card.querySelector('.db-plan-pct'); if (lbl) lbl.textContent = n + ' of ' + total + ' done';
  }
  function planCard(ctx) {
    var meta = ctx.meta, ranked = ctx.ranked, firstRun = ctx.firstRun;
    var days = meta.next_board && parseDay(meta.next_board) ? U.daysUntil(meta.next_board) : null;
    var plan = currentPlan();
    var card = h('section.card.db-plan', { 'aria-label': 'Study plan' });
    function swap(next) { var fresh = planCard(ctx); if (card.parentNode) card.parentNode.replaceChild(fresh, card); if (next) next(fresh); }
    function generate() { var p = buildPlan(days, ranked, meta); CORB.set('progress.path', p); CORB.ui.toast('Six-week plan generated', 'ok'); swap(); }

    if (!plan) {
      var top3 = ranked.slice(0, 3).map(function (r) { return r.name; });
      var special = specialDomain(ranked.map(function (r) { return r.name; }));
      card.appendChild(h('div.card-head', {}, h('div', {}, h('h3', {}, 'Study plan'), h('div.muted.small.mt-2', {}, days != null && days > 0 ? U.plural(days, 'day') + ' to the board' : 'Six weeks of study'))));
      card.appendChild(h('p.muted', {}, 'Six steps built from your ' + (firstRun ? 'largest' : 'weakest') + ' domains' + (top3.length ? ': ' + top3.join(', ') : '') + '. Rebuild it any time.'));
      card.appendChild(h('button.btn.primary.mt-4', { onclick: generate }, icon('spark'), 'Generate my plan'));
      return card;
    }

    var today = U.today();
    var weeks = plan.weeks.filter(function (w) { return w && typeof w === 'object'; });
    var anyCurrent = weeks.some(function (w) { return today >= w.start && today <= w.end; });
    var stale = plan.board && meta.next_board && plan.board !== meta.next_board;
    card.appendChild(h('div.card-head.db-plan-head', {},
      h('div', {}, h('h3', {}, 'Study plan'), h('div.muted.small.mt-2', {}, 'Made ' + fmtDay(plan.generated) + (plan.board ? ' for the ' + fmtDay(plan.board) + ' board' : ''))),
      h('button.btn.sm', { onclick: function () {
        var done = CORB.get('progress.path.done', {}) || {}; var any = Object.keys(done).some(function (k) { return done[k]; });
        if (!any) return generate();
        CORB.ui.confirm('Rebuild the plan from today\'s readiness? Checked-off tasks will be cleared.', { ok: 'Rebuild' }).then(function (yes) { if (yes) generate(); });
      } }, icon('refresh'), 'Rebuild')));
    if (stale) card.appendChild(h('div.callout.warn.mb-4', {}, icon('alert'), h('div', {}, h('b', {}, 'Board date changed'), 'This plan was built for ' + fmtDay(plan.board) + '. The next board is now ' + fmtDay(meta.next_board) + '. Rebuild to realign the weeks.')));
    card.appendChild(h('div.db-plan-progress', {}, h('span.db-plan-pct.muted.small', {}, ''), h('div.bar.db-plan-bar', {}, h('span'))));

    weeks.forEach(function (w, wi) {
      var n = w.n || (wi + 1);
      var cur = today >= w.start && today <= w.end;
      var past = today > w.end;
      var body = h('div.db-week-body', {}, (Array.isArray(w.tasks) ? w.tasks : []).map(function (t, j) {
        t = t && typeof t === 'object' ? t : { text: String(t || '') };
        var tid = String(t.id || ('w' + n + 't' + (j + 1))).replace(/[^\w-]/g, '_');
        var id = 'db-task-' + tid; var cb;
        cb = h('input', { type: 'checkbox', id: id, checked: !!(plan.done && plan.done[tid]), onchange: function () { CORB.set('progress.path.done.' + tid, cb.checked); refreshPlan(card); } });
        return h('div.db-task', { 'data-task': tid }, cb, h('label', { 'for': id }, t.text || 'Task'),
          t.view && CORB.views[t.view] ? h('button.btn.sm.ghost.db-task-go', { onclick: go(t.view, t.params || {}), 'aria-label': 'Open: ' + (t.text || 'task'), 'data-tip': 'Open' }, icon('arrow-right')) : null);
      }));
      card.appendChild(h('details.db-week' + (cur ? '.current' : '') + (past ? '.past' : ''), { open: cur || (!anyCurrent && n === 1) },
        h('summary', {},
          h('span.db-week-n', {}, String(n)),
          h('span.db-week-text', {}, h('span.db-week-title', {}, w.title), h('span.db-week-dates', {}, shortDay(w.start) + ' – ' + shortDay(w.end) + (cur ? ' · now' : ''))),
          h('span.db-week-count', {}, ''),
          icon('chevron', 'db-week-chev')),
        body));
    });
    refreshPlan(card);
    return card;
  }

  // =====================================================================
  // view
  // =====================================================================
  CORB.registerView({
    id: 'dashboard', title: 'Dashboard', icon: 'dashboard', section: 'Prepare', order: 10, nav: true, mobile: true, short: '',
    render: function (root) {
      frames = [];
      var meta = (CORB.DATA && CORB.DATA.meta) || {};
      var profile = CORB.get('profile', {}) || {};
      var name = String(profile.name || '').trim();
      var R = safeReadiness();
      var srsAll = CORB.get('progress.srs', {}) || {};
      var quiz = CORB.get('progress.quiz', []); if (!Array.isArray(quiz)) quiz = [];
      var boards = CORB.get('progress.boards', []); if (!Array.isArray(boards)) boards = [];
      var due = safeDue();
      var firstRun = !(R.seenCount || quiz.length || boards.length || Object.keys(srsAll).length);
      var ranked = rankDomains(R, firstRun);

      root.appendChild(hero(name));
      if (CORB.store && CORB.store.available === false) root.appendChild(storageNote());
      if (!name && !CORB.get('settings.setupDone')) root.appendChild(onboarding(profile));
      if (!R.total) { root.appendChild(h('div.db-top.rise.rise-1', {}, noBank(), h('div.db-side', {}, countdownTile(meta)))); return; }
      // day one: the steps come first and the empty ring and streak stay away until there is something to show
      if (firstRun) {
        root.appendChild(continueSection(R, firstRun, due, quiz, boards, srsAll, ranked));
        root.appendChild(h('div.db-countrow.rise.rise-1', {}, countdownTile(meta)));
      } else {
        root.appendChild(continueSection(R, firstRun, due, quiz, boards, srsAll, ranked));
        root.appendChild(h('div.db-top.rise.rise-3', {}, readinessCard(R, firstRun), h('div.db-side', {}, countdownTile(meta), streakTile(R, quiz, boards))));
      }
      root.appendChild(h('div.db-split.rise.rise-4', {}, heatCard(ranked, firstRun), planCard({ meta: meta, ranked: ranked, firstRun: firstRun })));
    },
    onLeave: function () { frames.forEach(function (id) { cancelAnimationFrame(id); }); frames = []; }
  });
})();
