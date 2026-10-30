/* VIEW home — first visit: a four-step onboarding (who you are, your dates, how it looks, read aloud) that builds the plan.
   Returning: next step, milestones, study, what's new */
(function () {
  'use strict';
  // "Hello, Name!" for a signed-in reader (accounts are on the website and the app only)
  function hello(h) { var n = window.CORB.account && window.CORB.account.signedIn() && window.CORB.account.firstName(); return n ? h('p.hello', {}, 'Hello, ' + n + '!') : null; }
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
    var n = o.split ? '' : null;
    var whoField = h('div.field', {}, h('div.label', {}, (n === null ? '1. ' : '') + 'Who are you?'), trackGrid);
    var startField = h('div.field', {}, h('label', { for: 'setup-start' }, (n === null ? '2. ' : '') + 'When did you start in your contracting job?'), startIn,
      h('div.hint', {}, 'Use the date you were assigned to a contracting position. Your 36-month certification clock starts then. A guess is fine; you can change it later.'));
    var goalField = h('div.field', {}, h('div.label', {}, (n === null ? '3. ' : '') + 'When do you want to finish your courses and the exam?'), seg, goalIn,
      h('div.hint', {}, 'Most contracting support brigades ask for 6 months. The rules allow 36 months for the whole certification.'));
    // one step at a time in the onboarding: valid('who') and valid('dates') check a part without saving
    function valid(part) {
      if (part === 'who' && !st.track) { CORB.ui.toast('Pick who you are first.', 'warn'); return false; }
      if (part === 'dates' && st.months === 0 && (!st.goalDate || st.goalDate <= st.start)) { CORB.ui.toast('Pick a goal date after your start date.', 'warn'); return false; }
      return true;
    }
    if (o.split) return { who: whoField, dates: h('div.stack.loose', {}, startField, goalField), valid: valid, save: save };
    var form = h('div.stack.loose.setup-form', {}, whoField, startField, goalField);
    return { el: form, save: save, valid: valid };
  };

  function firstVisit(root) {
    var h = CORB.ui.h, icon = CORB.ui.icon;
    var f = CORB.setupForm();
    root.appendChild(h('section.home-hero', {},
      h('div.eyebrow', {}, 'Free \u00b7 Works offline \u00b7 Built by a 51C'),
      hello(h), h('h1', {}, 'Zero to certified.'),
      h('p.lede', {}, 'The free, fun way to pass CON 3990V. Your plan in 30 seconds. Lessons that play like pictures, 384 questions that explain themselves, flashcards and seven games, two in real 3D, with a campaign. Made by a 51C for new 51Cs and 1102s.'),
      h('div.home-proof', {}, ['79% pass on the first try (FY26)', '35 lessons, 384 questions', 'No signal needed'].map(function (t) { return h('span', {}, icon('check'), t); })),
      h('div.home-three', {},
        [['school', '5 courses', 'CON 1100, 1200V, 1300V, 7300V and 1400V'], ['award', '1 exam', 'CON 3990V: 150 questions, 70% to pass'], ['clipboard', '12 months', 'of full-time contracting experience']].map(function (x) {
          return h('div.three-item', {}, icon(x[0]), h('div', {}, h('b', {}, x[1]), h('span', {}, x[2])));
        }))));
    root.appendChild(onboarding(h, icon));
    root.appendChild(tour());
  }

  // ---- the onboarding: four short steps; the look and the voice apply as soon as they are tapped, the plan saves at the end ----
  function onboarding(h, icon) {
    var f = CORB.setupForm({ split: true }), step = 0;
    function voiceStep() {
      if (!CORB.speech || !CORB.speech.available || !CORB.voicePicker) return h('p.muted', {}, 'Read-aloud is not available in this browser, so there is no voice to pick. Everything else works.');
      return h('div.stack', {}, h('div.field', {}, h('div.label', {}, 'Voice'), CORB.voicePicker()),
        h('div.row', {}, h('button.btn', { type: 'button', onclick: function () { CORB.speech.speak(CORB.VOICE_SAMPLE || 'Hi, this is how B2B Exam Prep sounds.'); } }, icon('volume'), 'Hear a sample'), h('button.btn.ghost', { type: 'button', onclick: function () { CORB.speech.stop(); } }, icon('stop'), 'Stop')),
        h('div.hint', {}, 'Picking a voice plays the sample. The Listen button on every lesson, question and card uses it. Change it later in Settings & help → Display → Read aloud.'));
    }
    var steps = [
      { title: 'Who are you?', sub: 'The guide tailors its plan and its words to you.', el: f.who, check: function () { return f.valid('who'); } },
      { title: 'Your dates', sub: 'Your 36-month certification clock starts the day you were assigned to contracting.', el: f.dates, check: function () { return f.valid('dates'); } },
      { title: 'How it looks', sub: 'Day or night, a colour theme and the text size. Change any of them later in Settings & help → Display.', el: CORB.lookPicker ? CORB.lookPicker() : h('div') },
      { title: 'Read aloud', sub: 'Every lesson, question and card can be read to you. Pick a voice and hear a sample.', el: voiceStep() }
    ];
    var head = h('div.wizard-head'), body = h('div.wizard-body'), foot = h('div.row.mt-5');
    function paint() {
      var s = steps[step];
      head.innerHTML = ''; body.innerHTML = ''; foot.innerHTML = '';
      head.appendChild(h('div', {}, h('div.eyebrow', {}, 'Step ' + (step + 1) + ' of ' + steps.length), h('h2', {}, s.title), h('p.muted', {}, s.sub)));
      head.appendChild(h('div.wiz-dots', { 'aria-hidden': 'true' }, steps.map(function (x, i) { return h('i' + (i < step ? '.done' : i === step ? '.on' : '')); })));
      body.appendChild(s.el);
      if (step > 0) foot.appendChild(h('button.btn', { type: 'button', onclick: function () { step--; paint(); } }, icon('arrow-left'), 'Back'));
      if (step < steps.length - 1) foot.appendChild(h('button.btn.primary.lg', { type: 'button', onclick: function () { if (s.check && !s.check()) return; step++; paint(); try { body.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} } }, 'Next', icon('arrow-right')));
      else foot.appendChild(h('button.btn.primary.lg', { type: 'button', onclick: function () { if (f.save()) { CORB.ui.toast('Your plan and 6-month exam path are ready', 'ok'); CORB.go('path'); } else { step = 0; paint(); } } }, 'Build my plan', icon('check')));
      foot.appendChild(h('button.btn.ghost', { type: 'button', onclick: function () { CORB.set('settings.welcomeSeen', true); CORB.render(); } }, 'Look around first'));
      if (step === 0) foot.appendChild(h('button.btn.ghost', { type: 'button', onclick: function () { if (CORB.tour) CORB.tour.start(); } }, icon('help'), 'Show me around'));
    }
    paint();
    return h('section.card.raised.setup-card.wizard', {}, head, h('p.muted.small', {}, 'About a minute. Nothing leaves this device.'), body, foot);
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
          hello(h), h('h1', {}, 'Day ' + plan.dayNumber() + ' of your path'),
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
    if (CORB.get('profile.track') === 'mentor') root.appendChild(h('section.mt-5', {}, CORB.ui.callout('brass', 'users', 'Helping someone new?', 'Sit down with them on day one and build their plan together. Walk the Week 1 steps, introduce them to your KMG, and sign off experience tasks in Certification 101 → Experience as they do them.')));
    root.appendChild(tour());
  }

  CORB.registerView({ id: 'home', title: 'Home', section: 'Start', icon: 'home', nav: true, order: 10, mobile: true, short: 'Home', blurb: 'Your next step and progress',
    render: function (root) {
      if (!CORB.plan.hasSetup() && !CORB.get('settings.welcomeSeen')) firstVisit(root); else returning(root);
    } });
})();
