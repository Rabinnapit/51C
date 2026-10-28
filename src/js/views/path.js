/* VIEW path — the 6-month exam path: 26 dated weeks of tasks with monthly checkpoints, the B2B class material check, and test-taker topics */
(function () {
  'use strict';
  var CORB = window.CORB;
  var TABS = [['week', 'This week'], ['all', 'All 26 weeks'], ['check', 'Class material check'], ['tips', 'Test-taker tips']];
  var STATUS = { ok: ['ok', 'Still right', 'check'], updated: ['info', 'Updated', 'refresh'], fixed: ['warn', 'Corrected', 'alert'], verify: ['verify', 'Verify locally', 'flag'] };

  function P() { return CORB.DATA.path || { weeks: [], months: [], checks: [], intel: [], files: [] }; }

  // ---- dates: the path starts on My plan's start date and stretches when the goal is longer than 6 months ----
  var path = CORB.path = {};
  path.weeks = function () { return P().weeks || []; };
  path.total = function () { return path.weeks().length || 26; };
  path.scale = function () { var U = CORB.util, pl = CORB.plan; return Math.max(30, U.daysBetween(pl.start(), pl.goal())) / (P().baseline_days || 182); };
  path.weekStart = function (n) { return CORB.util.addDays(CORB.plan.start(), Math.round((n - 1) * 7 * path.scale())); };
  path.weekEnd = function (n) { return CORB.util.addDays(path.weekStart(n + 1), -1); };
  path.currentWeek = function () { var t = CORB.util.today(), cur = 1; path.weeks().forEach(function (w) { if (path.weekStart(w.n) <= t) cur = w.n; }); return cur; };
  path.week = function (n) { return path.weeks().filter(function (w) { return w.n === n; })[0] || null; };
  path.month = function (m) { return (P().months || []).filter(function (x) { return x.n === m; })[0] || { n: m, title: '', sub: '' }; };
  path.examDate = function () { return CORB.get('progress.exam.scheduled') || path.weekStart(P().exam_week || 24); };

  // ---- task state. Lessons, courses and the real exam tick themselves; drills and checkpoints record their score ----
  function rec(id) { return CORB.get('progress.path.' + id); }
  path.taskDone = function (t) {
    if (rec(t.id)) return true;
    if (t.kind === 'lesson') return CORB.data.lessonDone(t.lesson);
    if (t.kind === 'course') return CORB.data.courseDone(t.course);
    if (t.kind === 'realexam') return CORB.plan.examPassed();
    return false;
  };
  path.best = function (t) { var r = rec(t.id); return r && typeof r === 'object' && r.best != null ? r.best : null; };
  path.weekStats = function (w) { var d = w.tasks.filter(path.taskDone).length; return { done: d, total: w.tasks.length, pct: CORB.util.pct(d, w.tasks.length) }; };
  path.progress = function () { var d = 0, t = 0; path.weeks().forEach(function (w) { var s = path.weekStats(w); d += s.done; t += s.total; }); return { done: d, total: t, pct: CORB.util.pct(d, t) }; };
  function setTask(t, on) {
    var U = CORB.util;
    if (t.kind === 'lesson') CORB.scoring.setLessonDone(t.lesson, on);
    if (t.kind === 'course') CORB.set('progress.courses.' + t.course, on ? { status: 'done', date: U.today() } : undefined);
    CORB.set('progress.path.' + t.id, on ? U.today() : undefined);
    if (on) CORB.touch(t.id);
  }
  CORB.on('path-quiz', function (e) {
    var r = rec(e.id), best = Math.max(e.pct, (r && typeof r === 'object' && r.best) || 0);
    CORB.set('progress.path.' + e.id, { d: CORB.util.today(), last: e.pct, best: best });
  });

  // weakest exam area by recent answers; with no answers yet, the biggest area
  function weakest() {
    var rd = CORB.scoring.readiness().byPhase, ph = CORB.data.phases().slice();
    var scored = ph.filter(function (p) { return rd[p.id] && rd[p.id].pct != null; }).sort(function (a, b) { return rd[a.id].pct - rd[b.id].pct; });
    return scored[0] || ph.sort(function (a, b) { return b.qs - a.qs; })[0];
  }
  function startTask(t) {
    var o = { mode: t.kind === 'exam' ? 'exam' : t.missed ? 'missed' : 'practice', n: t.n || 10, label: t.t, path: t.id, lessons: t.lessons, src: t.src, phase: t.phase };
    if (t.weak) { var w = weakest(); o.phase = w.id; o.label = t.t + ': ' + w.name; }
    CORB.quiz.start(o);
  }

  // ---- one task row ----
  function taskRow(t, h, icon) {
    var U = CORB.util, done = path.taskDone(t), lesson = t.kind === 'lesson' ? CORB.data.lesson(t.lesson) : null, course = t.kind === 'course' ? CORB.data.course(t.course) : null;
    var title = t.t || (lesson ? 'Lesson: ' + lesson.title : course ? course.code + ' ' + course.title : t.id);
    var kind = { lesson: ['book', 'Lesson'], read: ['scale', 'FAR reading'], cards: ['cards', 'Flashcards'], drill: ['quiz', 'Check'], exam: ['timer', 'Checkpoint'], course: ['school', 'Course'], game: ['gamepad', 'Game'], realexam: ['award', 'The exam'], do: ['clipboard', 'To do'] }[t.kind] || ['dot', ''];
    var acts = [];
    if (lesson) acts.push(h('a.btn.sm', { href: '#/lesson?id=' + lesson.id }, icon('book'), 'Open lesson'), h('span.tiny.muted', {}, '~' + (lesson.minutes || 8) + ' min'));
    if (t.kind === 'read') {
      var url = CORB.data.citeUrl('FAR Part ' + t.far), part = CORB.data.farParts().filter(function (p) { return p.n === t.far; })[0];
      acts.push(h('a.btn.sm', { href: '#/far?tab=parts&q=' + t.far }, icon('scale'), 'Part ' + t.far + (part ? ': ' + part.title : '')));
      if (url) acts.push(CORB.ui.extLink(url, 'RFO text', '.btn.sm.ghost'));
    }
    if (t.kind === 'cards') acts.push(h('a.btn.sm', { href: '#/cards?deck=' + t.deck + '&go=1' }, icon('play'), 'Study the deck'));
    if (t.kind === 'drill' || t.kind === 'exam') {
      var best = path.best(t);
      acts.push(h('button.btn.sm' + (done ? '' : '.primary'), { type: 'button', onclick: function () { startTask(t); } }, icon(t.kind === 'exam' ? 'timer' : 'play'), done ? 'Take it again' : t.kind === 'exam' ? 'Start the timer' : 'Start'),
        h('span.tiny.muted', {}, (t.n || 10) + ' questions' + (t.kind === 'exam' ? ' · ' + Math.round((t.n || 10) * 72 / 60) + ' min' : '')));
      if (best != null) acts.push(CORB.ui.badge(t.target ? (best >= t.target ? 'ok' : 'warn') : (best >= 70 ? 'ok' : 'neutral'), 'Best ' + best + '%' + (t.target ? (best >= t.target ? ' · target met' : ' · target ' + t.target + '%') : ''), t.target && best >= t.target ? 'check' : 'target'));
      else if (t.target) acts.push(CORB.ui.badge('neutral', 'Target ' + t.target + '%', 'target'));
    }
    if (course) acts.push(h('a.btn.sm', { href: '#/courses?id=' + course.id }, icon('school'), 'About the course'));
    if (t.kind === 'game') acts.push(h('a.btn.sm', { href: '#/games?game=' + t.game }, icon('gamepad'), 'Play'));
    if (t.view) acts.push(h('button.btn.sm', { type: 'button', onclick: function () { CORB.go(t.view, t.params || {}); } }, icon('arrow-right'), 'Open'));
    var sub = h('div', {}, h('div.row.tight', {}, CORB.ui.badge('neutral', kind[1], kind[0]), t.d ? h('span.small.muted', {}, t.d) : null), acts.length ? h('div.row.tight.mt-2.task-acts', {}, acts) : null);
    sub.addEventListener('click', function (e) { if (!e.target.closest('a, button, input')) e.preventDefault(); });   // reading the details must not tick the task
    var row = CORB.ui.checkItem({ checked: done, title: title, sub: sub, onChange: function (v) { setTask(t, v); if (v) CORB.ui.toast('Done', 'ok'); setTimeout(CORB.render, 200); } });
    row.classList.add('task', 'k-' + t.kind);
    return row;
  }

  // ---- This week ----
  function weekTab(root, h, icon, params) {
    var U = CORB.util, cur = path.currentWeek(), n = U.clamp(+params.w || cur, 1, path.total()), w = path.week(n);
    if (!w) { root.appendChild(h('div.empty', {}, 'No weeks in the path data.')); return; }
    var m = path.month(w.m), st = path.weekStats(w), prog = path.progress(), exam = path.examDate(), left = U.daysUntil(exam);
    if (!CORB.plan.hasSetup()) root.appendChild(h('div.mb-4', {}, CORB.ui.callout('brass', 'calendar', 'Your path starts today until you set your start date', h('span', {}, 'Build your plan so the weeks line up with your real start date and goal. ',
      h('button.btn.sm.mt-2', { type: 'button', onclick: changeDates }, icon('route'), 'Set my dates')))));
    var when = n === cur ? 'This week' : n < cur ? 'Earlier week' : 'Coming up';
    root.appendChild(h('section.card.raised.path-hero', {},
      h('div.grow', {}, h('div.eyebrow', {}, 'Week ' + n + ' of ' + path.total() + ' · Month ' + w.m + ': ' + m.title),
        h('h2', {}, w.title), h('div.row.tight.mt-2', {}, CORB.ui.badge(n === cur ? 'brass' : 'neutral', when + ' · ' + U.fmtShort(path.weekStart(n)) + ' to ' + U.fmtShort(path.weekEnd(n)), 'calendar'), h('span.small.muted', {}, st.done + ' of ' + st.total + ' tasks done')),
        h('p.lede.mt-3', {}, w.goal)),
      h('div.path-ring', {}, CORB.ui.ring(prog.pct, prog.pct + '%', 'var(--accent)', 96), h('div.tiny.muted.center', {}, 'of the whole path'),
        h('div.small.center.mt-2', {}, h('b', {}, left >= 0 ? U.plural(left, 'day') : 'Exam date passed'), h('div.tiny.muted', {}, (CORB.get('progress.exam.scheduled') ? 'to your exam' : 'to your target exam week') + ' · ' + U.fmtShort(exam))))));
    root.appendChild(h('div.row.between.week-nav', {},
      n > 1 ? h('button.btn.sm.ghost', { type: 'button', onclick: function () { CORB.go('path', { w: n - 1 }); } }, icon('chevron-left'), 'Week ' + (n - 1)) : h('span'),
      n !== cur ? h('button.btn.sm', { type: 'button', onclick: function () { CORB.go('path', {}); } }, icon('calendar'), 'Back to this week') : h('span'),
      n < path.total() ? h('button.btn.sm.ghost', { type: 'button', onclick: function () { CORB.go('path', { w: n + 1 }); } }, 'Week ' + (n + 1), icon('chevron-right')) : h('span')));
    var left2 = h('div.stack', {},
      h('div.stack.tight.tasks', {}, w.tasks.map(function (t) { return taskRow(t, h, icon); })),
      w.tip ? CORB.ui.callout('info', 'bulb', 'How to study this week', CORB.ui.rich(w.tip)) : null,
      w.class ? CORB.ui.callout('brass', 'school', 'From your B2B class', CORB.ui.rich(w.class)) : null);
    root.appendChild(h('section.split.mt-4', {}, left2, h('div.stack', {}, monthCard(w.m, n, h, icon), readinessCard(h))));
  }

  function monthCard(mn, sel, h, icon) {
    var U = CORB.util, m = path.month(mn), weeks = path.weeks().filter(function (w) { return w.m === mn; }), cur = path.currentWeek();
    var cps = []; weeks.forEach(function (w) { w.tasks.forEach(function (t) { if (t.kind === 'exam') cps.push(t); }); });
    return h('div.card.month-card', {}, h('div.eyebrow', {}, 'Month ' + mn + ' of 6'), h('h3', {}, m.title), h('p.small.muted', {}, m.sub),
      h('div.list.mt-3', {}, weeks.map(function (w) {
        var s = path.weekStats(w), late = w.n < cur && s.done < s.total;
        return h('a.list-item.week-mini' + (w.n === sel ? '.on' : ''), { href: '#/path?w=' + w.n }, h('span.num.small', {}, 'W' + w.n), h('span.grow.small', {}, w.title),
          s.done === s.total ? CORB.ui.badge('ok', 'Done', 'check') : late ? CORB.ui.badge('warn', s.done + '/' + s.total) : h('span.tiny.muted', {}, s.done + '/' + s.total));
      })),
      cps.map(function (t) { var b = path.best(t); return h('div.cp-row.mt-3', {}, icon('timer'), h('div.grow', {}, h('b.small', {}, t.t), h('div.tiny.muted', {}, 'Target ' + t.target + '%' + (b != null ? ' · your best ' + b + '%' : ' · not taken yet'))), b != null && b >= t.target ? CORB.ui.badge('ok', 'Met', 'check') : null); }));
  }

  function readinessCard(h) {
    var rd = CORB.scoring.readiness();
    return h('div.card.readiness', {}, h('div.row.between', {}, h('h3', {}, 'Exam readiness'), rd.overall != null ? CORB.ui.ring(rd.overall, rd.overall + '%', rd.overall >= 70 ? 'var(--ok)' : 'var(--accent-2)', 56) : null),
      h('p.tiny.muted', {}, rd.overall == null ? 'Your weekly checks fill these bars in.' : 'Share of your recent answers that were right, by exam area. 70% passes.'),
      h('div.stack.tight.mt-2', {}, CORB.data.phases().map(function (p) {
        var o = rd.byPhase[p.id] || {};
        return h('div.rd-row', {}, h('div.row.between', {}, h('span.small', {}, h('span.phase-dot.ph-' + p.id), ' ', p.name), h('span.num.small', {}, o.pct == null ? '—' : o.pct + '%')), CORB.ui.bar(o.pct || 0, 'ph-' + p.id), h('div.tiny.muted', {}, p.qs + ' of 150 exam questions'));
      })));
  }

  // ---- All weeks ----
  function allTab(root, h, icon) {
    var U = CORB.util, cur = path.currentWeek();
    root.appendChild(h('div.card.how-card', {}, h('h3', {}, 'How the path works'), CORB.ui.rich((P().how || []).map(function (x) { return '- ' + x; }).join('\n'))));
    (P().months || []).forEach(function (m) {
      var weeks = path.weeks().filter(function (w) { return w.m === m.n; });
      var d = 0, t = 0; weeks.forEach(function (w) { var s = path.weekStats(w); d += s.done; t += s.total; });
      root.appendChild(h('section.month-sec', {}, h('div.section-head', {}, h('h2', {}, h('span.month-n', {}, 'Month ' + m.n), ' ', m.title), h('span.muted.small', {}, d + ' of ' + t + ' tasks')), h('p.muted.small.month-sub', {}, m.sub),
        h('div.stack.tight', {}, weeks.map(function (w) {
          var s = path.weekStats(w), late = w.n < cur && s.done < s.total;
          var chip = s.done === s.total ? CORB.ui.badge('ok', 'Done', 'check') : w.n === cur ? CORB.ui.badge('brass', 'This week', 'calendar') : late ? CORB.ui.badge('warn', 'Behind · ' + (s.total - s.done) + ' left', 'clock') : CORB.ui.badge('neutral', U.fmtShort(path.weekStart(w.n)), 'calendar');
          return h('details.acc.week-acc' + (w.n === cur ? '.cur' : ''), { open: w.n === cur }, h('summary', {}, h('span.num.week-n', {}, 'W' + w.n), h('span.grow', {}, w.title), chip, icon('chevron', 'chev')),
            h('div.acc-body', {}, h('p', {}, w.goal),
              h('ul.week-tasks', {}, w.tasks.map(function (tk) { var dn = path.taskDone(tk); var l = tk.kind === 'lesson' ? CORB.data.lesson(tk.lesson) : null, c = tk.kind === 'course' ? CORB.data.course(tk.course) : null; return h('li' + (dn ? '.done' : ''), {}, CORB.ui.icon(dn ? 'check' : 'dot'), tk.t || (l ? 'Lesson: ' + l.title : c ? c.code : tk.id)); })),
              h('a.btn.sm.mt-2', { href: '#/path?w=' + w.n }, 'Open week ' + w.n, icon('arrow-right'))));
        }))));
    });
  }

  // ---- Class material check ----
  function checkTab(root, h, icon, params) {
    var X = P(), list = X.checks || [], qs = CORB.data.questions().filter(function (q) { return q.src === 'class'; });
    var qc = { same: 0, updated: 0, fixed: 0 }; qs.forEach(function (q) { qc[q.check] = (qc[q.check] || 0) + 1; });
    root.appendChild(h('p.lede', {}, 'Every claim and practice question in the B2B class materials was checked against the RFO FAR that DoW has used since 1 February 2026 and the exam has tested since 31 March 2026 (checked ' + CORB.util.fmtDate(X.checked_on) + ' on acquisition.gov\'s FAR Overhaul pages).'));
    root.appendChild(h('div.grid.cols-4.mt-4', {},
      h('div.stat', {}, h('div.label', {}, 'Class questions checked'), h('div.value', {}, String(qs.length)), h('div.sub', {}, 'In the Practice test')),
      h('div.stat', {}, h('div.label', {}, 'Still right'), h('div.value', {}, String(qc.same || 0)), h('div.sub', {}, 'Kept as written, plain-language edits')),
      h('div.stat', {}, h('div.label', {}, 'Updated'), h('div.value', {}, String(qc.updated || 0)), h('div.sub', {}, 'Same answer, new RFO cite or figure')),
      h('div.stat', {}, h('div.label', {}, 'Corrected'), h('div.value', {}, String(qc.fixed || 0)), h('div.sub', {}, 'Wrong or unclear under the RFO'))));
    root.appendChild(h('div.row.tight.mt-4', {}, h('button.btn.primary', { type: 'button', onclick: function () { CORB.quiz.start({ mode: 'practice', src: 'class', n: 25, label: 'B2B class practice exam' }); } }, icon('play'), 'Practice the class exam'),
      h('span.small.muted', {}, 'Each answer shows whether it changed and why.')));
    var f = params.f || 'all';
    var seg = h('div.seg.mt-5', { role: 'radiogroup', 'aria-label': 'Filter' }, [['all', 'All ' + list.length], ['changed', 'Changed by the RFO'], ['ok', 'Still right'], ['verify', 'Check locally']].map(function (x) {
      return h('button' + (f === x[0] ? '.on' : ''), { type: 'button', onclick: function () { CORB.go('path', { tab: 'check', f: x[0] }); } }, x[1]);
    }));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'What the class taught, and what the FAR says now')));
    root.appendChild(seg);
    var shown = list.filter(function (c) { return f === 'all' || (f === 'changed' && (c.status === 'updated' || c.status === 'fixed')) || (f === 'ok' && c.status === 'ok') || (f === 'verify' && (c.verify || c.status === 'verify')); });
    root.appendChild(h('div.stack.tight.mt-3.checks', {}, shown.map(function (c) {
      var s = STATUS[c.status] || STATUS.verify;
      return h('div.card.check-card.st-' + c.status, {}, h('div.row.between', {}, h('b', {}, c.topic), h('div.row.tight', {}, h('span.tiny.muted', {}, c.src), CORB.ui.badge(s[0], s[1], s[2]))),
        h('div.grid.cols-2.mt-2.cmp', {}, h('div', {}, h('div.cmp-h', {}, 'Class material'), h('p.small', {}, c.said)), h('div', {}, h('div.cmp-h', {}, 'Now'), CORB.ui.rich(c.now))),
        h('div.row.tight.mt-2', {}, c.cite ? CORB.ui.rich(c.cite) : null, c.verify ? CORB.ui.verifyBadge() : null));
    })));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'Your class files')));
    root.appendChild(h('div.card.flush', {}, h('div.list', {}, (X.files || []).map(function (fl) {
      return h('div.list-item', {}, icon(fl.status === 'locked' ? 'key' : 'file'), h('div.grow', {}, h('b', {}, fl.name), h('div.small.muted', {}, fl.what)), CORB.ui.badge(fl.status === 'locked' ? 'warn' : 'ok', fl.status === 'locked' ? 'Not opened' : 'Checked', fl.status === 'locked' ? 'alert' : 'check'));
    }))));
  }

  // ---- Test-taker tips ----
  function tipsTab(root, h, icon) {
    var items = P().intel || [], nT = CORB.data.questions().filter(function (q) { return q.src === 'tips'; }).length;
    root.appendChild(h('p.lede', {}, 'What people who took CON 3990V say to know, from the notes your class shared, each checked against the RFO. Recalled exam questions are not copied; they became the topics below and ' + nT + ' new practice questions.'));
    root.appendChild(h('div.row.tight.mt-3', {}, h('button.btn.primary', { type: 'button', onclick: function () { CORB.quiz.start({ mode: 'practice', src: 'tips', n: 20, label: 'Test-taker topics' }); } }, icon('play'), 'Drill these topics'),
      h('span.small.muted', {}, 'Test takers describe the exam as about 80% scenarios.')));
    root.appendChild(h('div.grid.cols-2.mt-4.intel', {}, items.map(function (it) {
      var l = it.lesson ? CORB.data.lesson(it.lesson) : null;
      return h('div.card.intel-card', {}, h('b', {}, it.t), h('div.small.mt-2', {}, CORB.ui.rich(it.d)),
        h('div.row.tight.mt-3', {}, l ? h('a.btn.sm', { href: '#/lesson?id=' + l.id }, icon('book'), l.title) : null, it.deck ? h('a.btn.sm.ghost', { href: '#/cards?deck=' + it.deck + '&go=1' }, icon('cards'), 'Flashcards') : null));
    })));
  }

  function changeDates() {
    var f = CORB.setupForm();
    CORB.ui.modal({ title: 'Set my dates', body: f.el, actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: function () { if (!f.save()) return false; CORB.ui.toast('Dates saved', 'ok'); CORB.render(); } }] });
  }

  CORB.registerView({ id: 'path', title: 'Exam path', section: 'Start', icon: 'target', nav: true, order: 15, mobile: true, short: 'Path',
    blurb: '26 weeks to pass CON 3990V', keywords: 'six month 6-month exam path weekly study plan schedule CON 3990V checkpoint B2B class material check test taker tips RFO',
    badge: function () { try { var w = path.week(path.currentWeek()); if (!w) return 0; var s = path.weekStats(w); return s.total - s.done; } catch (e) { return 0; } },
    topTitle: function (p) { return p.tab === 'check' ? 'Class material check' : p.tab === 'tips' ? 'Test-taker tips' : 'Exam path'; },
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon, p = ctx.params, tab = p.tab || 'week', X = P();
      root.appendChild(CORB.ui.pageHead({ eyebrow: 'CON 3990V · ' + path.total() + ' weeks', title: X.title || '6-Month Exam Path', lede: tab === 'week' ? X.lede : null }));
      root.appendChild(h('div.tabs', { role: 'tablist' }, TABS.map(function (t) { return h('button' + (t[0] === tab ? '.on' : ''), { type: 'button', role: 'tab', 'aria-selected': t[0] === tab ? 'true' : 'false', onclick: function () { CORB.go('path', t[0] === 'week' ? {} : { tab: t[0] }); } }, t[1]); })));
      var body = h('div.tab-body'); root.appendChild(body);
      ({ week: weekTab, all: allTab, check: checkTab, tips: tipsTab }[tab] || weekTab)(body, h, icon, p);
    } });
})();
