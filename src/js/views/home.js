/* VIEW home — first visit: three questions that build the plan. Returning: next step, milestones, study, what's new */
(function () {
  'use strict';
  var CORB = window.CORB;
  var TRACKS = [
    { id: '51c', title: '51C Soldier', sub: 'Contracting NCO, new to the MOS', icon: 'shield' },
    { id: '1102', title: '1102 civilian', sub: 'Contract specialist, new hire or intern', icon: 'user' },
    { id: 'mentor', title: 'Supervisor or mentor', sub: 'Helping a new 51C or 1102', icon: 'users' }
  ];
  CORB.TRACKS = TRACKS;
  CORB.trackLabel = function (id) { var t = TRACKS.filter(function (x) { return x.id === id; })[0]; return t ? t.title : ''; };

  // ---- the three setup questions (also used by My plan → Change dates) ----
  CORB.setupForm = function (o) {
    o = o || {};
    var h = CORB.ui.h, icon = CORB.ui.icon, U = CORB.util;
    var st = { track: CORB.get('profile.track') || '', start: CORB.get('profile.start') || U.today(), months: CORB.get('profile.goalDate') ? 0 : (+CORB.get('profile.goalMonths', 6) || 6), goalDate: CORB.get('profile.goalDate') || '' };
    var trackGrid = h('div.choice-grid', { role: 'radiogroup', 'aria-label': 'Who are you?' });
    function paintTracks() {
      trackGrid.innerHTML = '';
      TRACKS.forEach(function (t) {
        trackGrid.appendChild(h('button.choice' + (st.track === t.id ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': st.track === t.id ? 'true' : 'false', onclick: function () { st.track = t.id; paintTracks(); } }, icon(t.icon), h('div', {}, h('b', {}, t.title), h('span', {}, t.sub))));
      });
    }
    paintTracks();
    var startIn = h('input.input#setup-start', { type: 'date', value: st.start, max: U.addDays(U.today(), 365) });
    startIn.addEventListener('change', function () { st.start = startIn.value || U.today(); });
    var goalIn = h('input.input#setup-goal', { type: 'date', value: st.goalDate, hidden: st.months !== 0 });
    goalIn.addEventListener('change', function () { st.goalDate = goalIn.value; });
    var seg = h('div.seg', { role: 'radiogroup', 'aria-label': 'Goal' });
    function paintSeg() {
      seg.innerHTML = '';
      [[6, '6 months'], [9, '9 months'], [12, '12 months'], [0, 'Pick a date']].forEach(function (g) {
        seg.appendChild(h('button' + (st.months === g[0] ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': st.months === g[0] ? 'true' : 'false', onclick: function () { st.months = g[0]; goalIn.hidden = g[0] !== 0; paintSeg(); } }, g[1]));
      });
    }
    paintSeg();
    function save() {
      if (!st.track) { CORB.ui.toast('Pick who you are first.', 'warn'); return false; }
      if (st.months === 0 && (!st.goalDate || st.goalDate <= st.start)) { CORB.ui.toast('Pick a goal date after your start date.', 'warn'); return false; }
      CORB.set('profile.track', st.track); CORB.set('profile.start', st.start);
      CORB.set('profile.goalMonths', st.months || 6); CORB.set('profile.goalDate', st.months === 0 ? st.goalDate : '');
      CORB.set('settings.setupDone', true);
      return true;
    }
    var form = h('div.stack.loose.setup-form', {},
      h('div.field', {}, h('div.label', {}, '1. Who are you?'), trackGrid),
      h('div.field', {}, h('label', { for: 'setup-start' }, '2. When did you start in your contracting job?'), startIn,
        h('div.hint', {}, 'Use the date you were assigned to a contracting position. Your 36-month certification clock starts then. A guess is fine; you can change it later.')),
      h('div.field', {}, h('div.label', {}, '3. When do you want to finish your courses and the exam?'), seg, goalIn,
        h('div.hint', {}, 'Many brigades ask for 6 months. The rules allow 36 months for the whole certification.')));
    return { el: form, save: save };
  };

  function firstVisit(root) {
    var h = CORB.ui.h, icon = CORB.ui.icon;
    var f = CORB.setupForm();
    root.appendChild(h('section.home-hero', {},
      h('div.eyebrow', {}, 'Back to Basics · DoW Contracting Professional certification'),
      h('h1', {}, 'From day one to certified.'),
      h('p.lede', {}, 'A plain-language guide for new 51C contracting NCOs and 1102 contract specialists. Answer three questions and B2B Guide builds a dated plan and a 26-week path to pass the exam, then teaches and tests you on everything in it.'),
      h('div.home-three', {},
        [['school', '5 courses', 'CON 1100, 1200V, 1300V, 7300V and 1400V'], ['award', '1 exam', 'CON 3990V: 150 questions, 70% to pass'], ['clipboard', '12 months', 'of full-time contracting experience']].map(function (x) {
          return h('div.three-item', {}, icon(x[0]), h('div', {}, h('b', {}, x[1]), h('span', {}, x[2])));
        }))));
    root.appendChild(h('section.card.raised.setup-card', {}, h('h2', {}, 'Build my plan'), h('p.muted', {}, 'Takes 30 seconds. Nothing leaves this device.'), f.el,
      h('div.row.mt-5', {}, h('button.btn.primary.lg', { type: 'button', onclick: function () { if (f.save()) { CORB.ui.toast('Your plan and 6-month exam path are ready', 'ok'); CORB.go('path'); } } }, 'Build my plan', icon('arrow-right')),
        h('button.btn.ghost', { type: 'button', onclick: function () { CORB.set('settings.welcomeSeen', true); CORB.render(); } }, 'Look around first'),
        h('button.btn.ghost', { type: 'button', onclick: function () { if (CORB.tour) CORB.tour.start(); } }, icon('help'), 'Show me around'))));
    root.appendChild(tour());
  }

  function tour() {
    var h = CORB.ui.h, icon = CORB.ui.icon;
    var items = [
      ['path', 'target', 'Exam path', '26 weeks to pass CON 3990V, week by week.'],
      ['plan', 'route', 'My plan', 'Every step to certification, with dates.'],
      ['cert', 'certificate', 'Certification 101', 'The rules, the exam and who does what.'],
      ['courses', 'school', 'Courses', 'What each course covers and how to pass it.'],
      ['learn', 'book', 'Lessons', 'Short lessons in plain English, with examples.'],
      ['quiz', 'quiz', 'Practice test', 'Exam-style questions with explanations.'],
      ['cards', 'cards', 'Flashcards', 'FAR part titles, acronyms and key numbers.'],
      ['howto', 'steps', 'How-to guides', 'Step-by-step checklists for real tasks.'],
      ['glossary', 'glossary', 'Glossary', 'Every acronym, explained.']
    ];
    return h('section', {}, h('div.section-head', {}, h('h2', {}, 'What is inside')),
      h('div.grid.auto', {}, items.map(function (x) {
        return h('a.card.lift.tour-tile', { href: '#/' + x[0] }, h('div.tile-icon', {}, icon(x[1])), h('b', {}, x[2]), h('span.muted.small', {}, x[3]));
      })));
  }

  function returning(root) {
    var h = CORB.ui.h, icon = CORB.ui.icon, U = CORB.util, plan = CORB.plan;
    var setup = plan.hasSetup();
    if (setup) {
      var goal = plan.goal(), left = U.daysUntil(goal);
      root.appendChild(h('section.home-head', {},
        h('div', {}, h('div.eyebrow', {}, CORB.trackLabel(plan.track()) || 'Your path'),
          h('h1', {}, 'Day ' + plan.dayNumber() + ' of your path'),
          h('p.lede', {}, left >= 0 ? 'Goal for courses and exam: ' + U.fmtDate(goal) + ' (' + U.plural(left, 'day') + ' to go).' : 'Your goal date (' + U.fmtDate(goal) + ') has passed. Pick a new one in My plan.'))));
    } else {
      root.appendChild(h('section.home-head', {}, h('div', {}, h('div.eyebrow', {}, 'Welcome'), h('h1', {}, 'Look around'),
        h('p.lede', {}, 'When you are ready, build your plan so the guide can put dates on every step.'),
        h('button.btn.primary.mt-3', { type: 'button', onclick: function () { CORB.set('settings.welcomeSeen', false); CORB.render(); } }, icon('route'), 'Build my plan'))));
    }

    // this week on the 6-month exam path
    if (CORB.path && CORB.path.weeks().length) {
      var pw = CORB.path.currentWeek(), wk = CORB.path.week(pw), ws = CORB.path.weekStats(wk), nextTask = wk.tasks.filter(function (t) { return !CORB.path.taskDone(t); })[0];
      root.appendChild(h('section.card.raised.path-now', {},
        h('div.row.between', {}, h('div.eyebrow', {}, 'Exam path · week ' + pw + ' of ' + CORB.path.total()), CORB.ui.badge(ws.done === ws.total ? 'ok' : 'brass', ws.done + ' of ' + ws.total + ' tasks done', ws.done === ws.total ? 'check' : 'target')),
        h('h2', {}, wk.title), h('p.muted', {}, wk.goal),
        CORB.ui.bar(ws.pct, 'brass'),
        h('div.row.mt-4', {}, h('a.btn.primary', { href: '#/path' }, icon('target'), nextTask ? 'Continue this week' : 'Open my exam path'),
          nextTask ? h('span.small.muted', {}, 'Next: ' + (nextTask.t || (nextTask.kind === 'lesson' && CORB.data.lesson(nextTask.lesson) ? 'Lesson: ' + CORB.data.lesson(nextTask.lesson).title : ''))) : null)));
    }

    // next step
    if (setup) {
      var nx = plan.nextSteps(1)[0];
      if (nx) {
        var chip = nx.status === 'late' ? CORB.ui.badge('warn', 'Past target · ' + U.fmtShort(nx.target), 'clock') : nx.status === 'soon' ? CORB.ui.badge('info', 'Target ' + U.fmtShort(nx.target), 'calendar') : CORB.ui.badge('neutral', 'Target ' + U.fmtShort(nx.target), 'calendar');
        root.appendChild(h('section.card.raised.next-step', {},
          h('div.row.between', {}, h('div.eyebrow', {}, 'Your next step'), chip),
          h('h2', {}, nx.title), nx.detail ? CORB.ui.rich(nx.detail.split('\n\n')[0]) : null,
          h('div.row.mt-4', {},
            h('button.btn.primary', { type: 'button', onclick: function () { if (nx.course) { CORB.set('progress.courses.' + nx.course, { status: 'done', date: U.today() }); } plan.setStep(nx.id, true); CORB.ui.toast('Done. Nice work.', 'ok'); CORB.render(); } }, icon('check'), 'Mark done'),
            nx.course ? h('a.btn', { href: '#/courses?id=' + nx.course }, icon('school'), 'About this course') : null,
            nx.howto ? h('a.btn', { href: '#/howto?id=' + nx.howto }, icon('steps'), 'Show me how') : null,
            h('a.btn.ghost', { href: '#/plan' }, 'See the whole plan', icon('arrow-right')))));
      }
      // milestones
      var cd = plan.coursesDone(), months = Math.min(12, plan.monthsIn()), passed = plan.examPassed(), sched = CORB.get('progress.exam.scheduled');
      var dl = plan.deadline(), dlLeft = U.daysUntil(dl);
      root.appendChild(h('section.grid.cols-4.milestones', {},
        h('div.stat', {}, h('div.label', {}, 'Courses'), h('div.value', {}, cd.done + '/' + cd.total), CORB.ui.bar(U.pct(cd.done, cd.total)), h('div.sub', {}, 'Required for certification')),
        h('div.stat', {}, h('div.label', {}, 'Exam'), h('div.value', {}, passed ? 'Passed' : sched ? U.fmtShort(sched) : 'Not yet'), CORB.ui.bar(passed ? 100 : sched ? 50 : 0, 'brass'), h('div.sub', {}, passed ? 'CON 3990V done' : sched ? 'Scheduled' : '70% to pass')),
        h('div.stat', {}, h('div.label', {}, 'Experience'), h('div.value', {}, months >= 12 ? '12 mo' : (Math.floor(months * 10) / 10) + ' mo'), CORB.ui.bar(months / 12 * 100, 'ok'), h('div.sub', {}, 'of 12 months needed')),
        h('div.stat', {}, h('div.label', {}, '36-month deadline'), h('div.value.deadline', {}, U.fmtDate(dl)), h('div.sub', {}, dlLeft >= 0 ? dlLeft.toLocaleString() + ' days left to be certified' : 'Talk to your supervisor about a waiver'))));
    }

    // keep studying
    var nl = CORB.data.nextLesson(), ls = CORB.scoring.lessonStats();
    var due = CORB.views.cards && CORB.views.cards.badge ? CORB.views.cards.badge() : 0;
    var rd = CORB.scoring.readiness();
    var left2 = h('div.stack', {},
      nl ? h('a.card.lift.lesson-next', { href: '#/lesson?id=' + nl.id }, h('div.row.between', {}, h('div.eyebrow', {}, 'Next lesson · ' + ls.done + ' of ' + ls.total + ' done'), CORB.ui.phaseBadge(nl.phase, true)),
        h('h3', {}, nl.title), h('p.muted.small.clamp-2', {}, nl.summary), h('div.row.tight.mt-3', {}, h('span.btn.primary.sm', {}, icon('book'), 'Start lesson'), h('span.muted.small', {}, '~' + (nl.minutes || 8) + ' min')))
        : h('div.card', {}, h('h3', {}, 'All lessons done'), h('p.muted', {}, 'Review the ones you found hard, then take a full practice test.')),
      h('div.grid.cols-2', {},
        h('a.card.lift.quick', { href: '#/quiz?start=quick' }, icon('zap'), h('b', {}, 'Quick 10'), h('span.muted.small', {}, '10 mixed exam-style questions')),
        h('a.card.lift.quick', { href: '#/cards' }, icon('cards'), h('b', {}, due ? due + ' cards due' : 'Flashcards'), h('span.muted.small', {}, due ? 'Review them now' : 'FAR part titles first'))));
    var right2 = h('div.card.readiness', {}, h('div.row.between', {}, h('h3', {}, 'Exam readiness'), rd.overall != null ? CORB.ui.ring(rd.overall, rd.overall + '%', rd.overall >= 70 ? 'var(--ok)' : 'var(--accent-2)', 64) : null),
      h('p.muted.small', {}, rd.overall == null ? 'Answer practice questions and lesson checks to see how ready you are in each exam area.' : 'Share of your recent answers that were right. You need 70% to pass.'),
      h('div.stack.tight.mt-3', {}, CORB.data.phases().map(function (p) {
        var o = rd.byPhase[p.id] || {};
        return h('div.rd-row', {}, h('div.row.between', {}, h('span', {}, h('span.phase-dot.ph-' + p.id), ' ', p.name), h('span.num.small', {}, o.pct == null ? '—' : o.pct + '%')), CORB.ui.bar(o.pct || 0, 'ph-' + p.id), h('div.tiny.muted', {}, p.qs + ' exam questions'));
      })));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'Keep studying')));
    root.appendChild(h('section.split', {}, left2, right2));

    // what's new
    var ups = (CORB.data.updates().far_updates || []).slice(0, 3);
    if (ups.length) root.appendChild(h('section', {}, h('div.section-head', {}, h('h2', {}, 'What changed lately'), h('a', { href: '#/far?tab=new' }, 'All updates')),
      h('div.card.flush', {}, h('div.list.news', {}, ups.map(function (u) { return h('div.list-item', {}, h('span.num.small.news-date', {}, CORB.util.fmtDate(u.date)), h('div.grow', {}, h('b', {}, u.title), h('div.muted.small', {}, u.body))); })))));
    if (CORB.get('profile.track') === 'mentor') root.appendChild(h('section.mt-5', {}, CORB.ui.callout('brass', 'users', 'Helping someone new?', 'Sit down with them on day one and build their plan together. Walk the Week 1 steps, introduce them to your training office, and sign off experience tasks in Certification 101 → Experience as they do them.')));
    root.appendChild(tour());
  }

  CORB.registerView({ id: 'home', title: 'Home', section: 'Start', icon: 'home', nav: true, order: 10, mobile: true, short: 'Home', blurb: 'Your next step and progress',
    render: function (root) {
      if (!CORB.plan.hasSetup() && !CORB.get('settings.welcomeSeen')) firstVisit(root); else returning(root);
    } });
})();
