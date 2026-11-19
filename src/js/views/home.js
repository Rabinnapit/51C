/* VIEW home — first visit: a four-step onboarding (who you are, your dates; how it looks and read aloud are optional) that builds the plan.
   Returning: one thing to do next, the plan's next step, quick tiles, where you stand, what's new */
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

  // ---- the setup questions (also used by My plan → Change dates) ----
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
    var f = CORB.setupForm(), nq = CORB.data.questions().length, nl = CORB.data.lessons().length;
    root.appendChild(h('section.home-hero', {},
      h('div.eyebrow', {}, 'Free \u00b7 Works offline \u00b7 Built by a 51C'),
      hello(h), h('h1', {}, 'Zero to certified.'),
      h('p.lede', {}, 'The free, fun way to pass CON 3990V. Your plan in 30 seconds. Lessons that play like pictures, ' + nq + ' questions that explain themselves, flashcards and seven games, five in real 3D, with a twelve-chapter campaign. Made by a 51C for new 51Cs and 1102s.'),
      h('div.home-proof', {}, ['79% pass on the first try (FY26)', nl + ' lessons, ' + nq + ' questions', 'No signal needed'].map(function (t) { return h('span', {}, icon('check'), t); })),
      CORB.intro && CORB.intro.available() ? h('button.btn.home-intro', { type: 'button', onclick: function () { CORB.intro.play({ replay: true }); } }, icon('play'), 'Watch the ' + CORB.intro.minutes() + '-minute intro') : null,
      h('div.home-three', {},
        [['school', '5 courses', 'CON 1100, 1200V, 1300V, 7300V and 1400V'], ['award', '1 exam', 'CON 3990V: 150 questions, 70% to pass'], ['clipboard', '12 months', 'of full-time contracting experience']].map(function (x) {
          return h('div.three-item', {}, icon(x[0]), h('div', {}, h('b', {}, x[1]), h('span', {}, x[2])));
        }))));
    root.appendChild(onboarding(h, icon));
    root.appendChild(tour());
  }

  // ---- the onboarding: four short steps; the look and the voice apply as soon as they are tapped, the plan saves at the end.
  //      Steps 3 and 4 are optional (0.35.0): Skip at the top of step 3 builds the plan with the look and the voice as they are ----
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
    function finish() { if (f.save()) { CORB.ui.toast('Your plan is ready', 'ok'); CORB.go('plan'); } else { step = 0; paint(); } }
    function paint() {
      var s = steps[step], optional = step >= 2;
      head.innerHTML = ''; body.innerHTML = ''; foot.innerHTML = '';
      head.appendChild(h('div', {}, h('div.eyebrow', {}, 'Step ' + (step + 1) + ' of ' + steps.length + (optional ? ' · optional' : '')), h('h2', {}, s.title), h('p.muted', {}, s.sub),
        optional && step < steps.length - 1 ? h('button.btn.sm.wiz-skip', { type: 'button', onclick: finish }, 'Skip, build my plan', icon('arrow-right')) : null));   // at the top: on a phone the buttons below are two screens down
      head.appendChild(h('div.wiz-dots', { 'aria-hidden': 'true' }, steps.map(function (x, i) { return h('i' + (i < step ? '.done' : i === step ? '.on' : '')); })));
      body.appendChild(s.el);
      if (step > 0) foot.appendChild(h('button.btn', { type: 'button', onclick: function () { step--; paint(); } }, icon('arrow-left'), 'Back'));
      if (step < steps.length - 1) foot.appendChild(h('button.btn.primary.lg', { type: 'button', onclick: function () { if (s.check && !s.check()) return; step++; paint(); try { head.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} } }, 'Next', icon('arrow-right')));   // the new step's title, not the middle of its options
      else foot.appendChild(h('button.btn.primary.lg', { type: 'button', onclick: finish }, 'Build my plan', icon('check')));
      if (!optional) foot.appendChild(h('button.btn.ghost', { type: 'button', onclick: function () { CORB.set('settings.welcomeSeen', true); CORB.render(); } }, 'Look around first'));   // once the dates are in, leaving would throw them away
      if (step === 0) foot.appendChild(h('button.btn.ghost', { type: 'button', onclick: function () { if (CORB.tour) CORB.tour.start(); } }, icon('help'), 'Show me around'));
    }
    paint();
    return h('section.card.raised.setup-card.wizard', {}, head, h('p.muted.small', {}, 'About a minute. Nothing leaves this device.'), body, foot);
  }

  function tour() {
    var h = CORB.ui.h, icon = CORB.ui.icon;
    var items = [
      ['plan', 'route', 'My plan', '26 weeks to pass CON 3990V, and every dated step to certified.'],
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

  // The one thing to do next this week, as a button that goes straight to it. Checks, checkpoints, games and to-dos are
  // started or ticked on their own row of My plan's This week (it knows the quiz setup), so those open this week.
  function taskGo(t) {
    var lesson = t.kind === 'lesson' ? CORB.data.lesson(t.lesson) : null, course = t.kind === 'course' ? CORB.data.course(t.course) : null;
    var title = t.t || (lesson ? lesson.title : course ? course.code + ' ' + course.title : 'This week\'s next task');
    if (lesson) return { title: title, kind: 'Lesson · about ' + (lesson.minutes || 8) + ' min', label: 'Open the lesson', icon: 'book', href: '#/lesson?id=' + lesson.id };
    if (t.kind === 'cards') return { title: title, kind: 'Flashcards', label: 'Study the deck', icon: 'cards', href: '#/cards?deck=' + t.deck + '&go=1' };
    if (t.kind === 'read') return { title: title, kind: 'FAR reading', label: 'Open Part ' + t.far, icon: 'scale', href: '#/far?tab=parts&q=' + t.far };
    if (course) return { title: title, kind: 'Course', label: 'About the course', icon: 'school', href: '#/courses?id=' + course.id };
    if (t.view) return { title: title, kind: 'To do', label: 'Open it', icon: 'arrow-right', href: '#/' + t.view + (t.params ? '?' + Object.keys(t.params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(t.params[k]); }).join('&') : '') };
    return { title: title, kind: { drill: 'Check', exam: 'Checkpoint', game: 'Game', realexam: 'The exam', 'do': 'To do' }[t.kind] || '', label: 'Open this week', icon: 'target', href: '#/plan' };
  }

  // A returning reader gets ONE thing to do next and one primary button. Everything else is a tile, a number or a fold.
  function returning(root) {
    var h = CORB.ui.h, icon = CORB.ui.icon, U = CORB.util, plan = CORB.plan;
    var setup = plan.hasSetup();
    if (setup) {
      var goal = plan.goal(), left = U.daysUntil(goal);
      root.appendChild(h('section.home-head', {},
        h('div', {}, h('div.eyebrow', {}, CORB.trackLabel(plan.track()) || 'Your path'),
          hello(h), h('h1', {}, 'Day ' + plan.dayNumber() + ' of your path'),
          h('p.lede', {}, left >= 0 ? 'Goal for courses and exam: ' + U.fmtDate(goal) + ' (' + U.plural(left, 'day') + ' to go).' : h('span', {}, 'Your goal date (' + U.fmtDate(goal) + ') has passed. ', h('a', { href: '#/plan?tab=steps' }, 'Pick a new one'), '.')))));
    } else {
      root.appendChild(h('section.home-head', {}, h('div', {}, h('div.eyebrow', {}, 'Welcome'), h('h1', {}, 'Look around'),
        h('p.lede', {}, 'When you are ready, build your plan so the guide can put dates on every step.'),
        h('button.btn.primary.mt-3', { type: 'button', onclick: function () { CORB.set('settings.welcomeSeen', false); CORB.render(); } }, icon('route'), 'Build my plan'))));
    }

    // ---- up next: this week's next task of the 26 weeks, with the one primary button of the page ----
    var nl = CORB.data.nextLesson(), upIsLesson = false;
    if (setup && CORB.path && CORB.path.weeks().length) {
      var pw = CORB.path.currentWeek(), wk = CORB.path.week(pw), ws = CORB.path.weekStats(wk), nextTask = wk.tasks.filter(function (t) { return !CORB.path.taskDone(t); })[0];
      var go = nextTask ? taskGo(nextTask) : null;
      upIsLesson = !!(nextTask && nextTask.kind === 'lesson');
      root.appendChild(h('section.card.raised.path-now.up-next', {},
        h('div.row.between', {}, h('div.eyebrow', {}, 'Up next · week ' + pw + ' of ' + CORB.path.total()), CORB.ui.badge(ws.done === ws.total ? 'ok' : 'brass', ws.done + ' of ' + ws.total + ' tasks done', ws.done === ws.total ? 'check' : 'target')),
        h('h2', {}, go ? go.title : 'Week ' + pw + ' is done. Nice work.'),
        h('p.muted.small', {}, go ? [go.kind, wk.title].filter(Boolean).join(' · ') : 'Look ahead to next week, or practice what you missed.'),
        CORB.ui.bar(ws.pct, 'brass'),
        h('div.row.mt-4', {}, h('a.btn.primary.lg', { href: go ? go.href : '#/plan' }, icon(go ? go.icon : 'target'), go ? go.label : 'Open my plan'),
          go && go.href !== '#/plan' ? h('a.btn.ghost', { href: '#/plan' }, 'This week', icon('arrow-right')) : null)));
    }

    // ---- from the plan: the next dated step, as a compact row (its details are on My plan, Steps and dates) ----
    if (setup) {
      var nx = plan.nextSteps(1)[0];
      if (nx) {
        var chip = nx.status === 'late' ? CORB.ui.badge('warn', 'Past target · ' + U.fmtShort(nx.target), 'clock') : nx.status === 'soon' ? CORB.ui.badge('info', 'Target ' + U.fmtShort(nx.target), 'calendar') : CORB.ui.badge('neutral', 'Target ' + U.fmtShort(nx.target), 'calendar');
        root.appendChild(h('section.card.next-step', {},
          h('div.row.between', {}, h('div.eyebrow', {}, 'From your plan'), chip),
          h('h3', {}, nx.title),
          h('div.row.tight.mt-3', {},
            h('button.btn.sm', { type: 'button', onclick: function () { if (nx.course) { CORB.set('progress.courses.' + nx.course, { status: 'done', date: U.today() }); } plan.setStep(nx.id, true); CORB.ui.toast('Done. Nice work.', 'ok'); CORB.render(); } }, icon('check'), 'Mark done'),
            nx.howto ? h('a.btn.sm', { href: '#/howto?id=' + nx.howto }, icon('steps'), 'Show me how') : nx.course ? h('a.btn.sm', { href: '#/courses?id=' + nx.course }, icon('school'), 'About this course') : null,
            h('a.btn.sm.ghost', { href: '#/plan?tab=steps' }, 'Details', icon('arrow-right')))));
      }
    }

    // ---- quick tiles: a short round of practice, the cards that are due, today's range card (the Arcade's come-back) ----
    var due = CORB.views.cards && CORB.views.cards.badge ? CORB.views.cards.badge() : 0, ls = CORB.scoring.lessonStats();
    var tiles = [];
    if (nl && !upIsLesson) tiles.push(h('a.card.lift.quick', { href: '#/lesson?id=' + nl.id }, icon('book'), h('span.quick-copy', {}, h('b', {}, 'Next lesson'), h('span.muted.small', {}, nl.title + ' · ' + ls.done + ' of ' + ls.total + ' done'))));
    tiles.push(h('a.card.lift.quick', { href: '#/quiz?start=quick' }, icon('zap'), h('span.quick-copy', {}, h('b', {}, 'Quick 10'), h('span.muted.small', {}, '10 mixed exam-style questions'))));
    tiles.push(h('a.card.lift.quick', { href: '#/cards' }, icon('cards'), h('span.quick-copy', {}, h('b', {}, due ? due + ' cards due' : 'Flashcards'), h('span.muted.small', {}, due ? 'Review them now' : 'FAR part titles first'))));
    var AR = CORB.arcadeReady && CORB.arcadeReady();
    if (AR) {
      var ds = AR.daily.summary(), streak = ds.streak ? ' · 🔥 ' + ds.streak + '-day streak' + (ds.atRisk ? ', close today\'s card to keep it' : '') : '';
      tiles.push(h('a.card.lift.quick.range-card', { href: ds.closed || !ds.next ? '#/arcade' : '#/arcade?daily=' + (ds.nextN || ds.done + 1) }, icon('gamepad'),
        h('span.quick-copy', {}, h('b', {}, ds.closed ? 'Range card closed' : 'Range card · ' + ds.done + ' of 3 passed'),
          h('span.muted.small', {}, (ds.closed ? 'Done for today. Nice work.' : ds.next ? 'Next: ' + ds.next.title : 'Three short missions today') + streak))));
    }
    root.appendChild(h('section.home-quick.n' + tiles.length, {}, tiles));
    // a week in, and once: keep this progress in an account (never during setup, never twice)
    var ask = CORB.account && CORB.account.ask ? CORB.account.ask('home') : null; if (ask) root.appendChild(ask);

    // ---- where you stand: the four milestones, then readiness by exam area (folded on a phone) ----
    if (setup) {
      var cd = plan.coursesDone(), months = Math.min(12, plan.monthsIn()), passed = plan.examPassed(), sched = CORB.get('progress.exam.scheduled');
      var dl = plan.deadline(), dlLeft = U.daysUntil(dl);
      root.appendChild(h('section.grid.cols-4.milestones', {},
        h('div.stat', {}, h('div.label', {}, 'Courses'), h('div.value', {}, cd.done + '/' + cd.total), CORB.ui.bar(U.pct(cd.done, cd.total)), h('div.sub', {}, 'Required for certification')),
        h('div.stat', {}, h('div.label', {}, 'Exam'), h('div.value', {}, passed ? 'Passed' : sched ? U.fmtShort(sched) : 'Not yet'), CORB.ui.bar(passed ? 100 : sched ? 50 : 0, 'brass'), h('div.sub', {}, passed ? 'CON 3990V done' : sched ? 'Scheduled' : '70% to pass')),
        h('div.stat', {}, h('div.label', {}, 'Experience'), h('div.value', {}, months >= 12 ? '12 mo' : (Math.floor(months * 10) / 10) + ' mo'), CORB.ui.bar(months / 12 * 100, 'ok'), h('div.sub', {}, 'of 12 months needed')),
        h('div.stat', {}, h('div.label', {}, '36-month deadline'), h('div.value.deadline', {}, U.fmtDate(dl)), h('div.sub', {}, dlLeft >= 0 ? dlLeft.toLocaleString() + ' days left to be certified' : 'Talk to your supervisor about a waiver'))));
    }
    var rd = CORB.scoring.readiness(), wide = false; try { wide = window.matchMedia('(min-width: 861px)').matches; } catch (e) {}
    root.appendChild(h('details.card.readiness', { open: wide ? true : null },
      h('summary', {}, h('span.rd-head', {}, h('b', {}, 'Exam readiness'), h('span.muted.small', {}, rd.overall == null ? 'Answer practice questions to see it' : 'Your recent answers that were right. You need 70% to pass.')),
        rd.overall != null ? CORB.ui.ring(rd.overall, rd.overall + '%', rd.overall >= 70 ? 'var(--ok)' : 'var(--accent-2)', 56) : null, icon('chevron', 'chev')),
      h('div.rd-grid', {}, CORB.data.phases().map(function (p) {
        var o = rd.byPhase[p.id] || {};
        return h('div.rd-row', {}, h('div.row.between', {}, h('span', {}, h('span.phase-dot.ph-' + p.id), ' ', p.name), h('span.num.small', {}, o.pct == null ? '—' : o.pct + '%')), CORB.ui.bar(o.pct || 0, 'ph-' + p.id), h('div.tiny.muted', {}, p.qs + ' exam questions'));
      }))));

    // what's new
    var ups = (CORB.data.updates().far_updates || []).slice(0, 3);
    if (ups.length) root.appendChild(h('section', {}, h('div.section-head', {}, h('h2', {}, 'What changed lately'), h('a', { href: '#/far?tab=new' }, 'All updates')),
      h('div.card.flush', {}, h('div.list.news', {}, ups.map(function (u, i) { return h('a.list-item.news-link', { href: '#/far?tab=new&open=' + i }, h('span.num.small.news-date', {}, CORB.util.fmtDate(u.date)), h('div.grow', {}, h('b', {}, u.title), h('div.muted.small', {}, u.body), h('span.tiny.news-more', {}, u.details ? 'Read more →' : 'Open →'))); })))));   // a tap opens the whole story
    if (CORB.get('profile.track') === 'mentor') root.appendChild(h('section.mt-5', {}, CORB.ui.callout('brass', 'users', 'Helping someone new?', h('span', {}, 'Build their plan together on day one. Walk the Week 1 steps, introduce your KMG, and sign off their experience tasks. ', h('a', { href: '#/cert?tab=experience' }, 'Open Experience')))));
    if (!setup) root.appendChild(tour());   // the page tiles are for looking around; with a plan, the menu and the tabs do that job
  }

  CORB.registerView({ id: 'home', title: 'Home', section: 'Start', icon: 'home', nav: true, order: 10, mobile: true, short: 'Home', blurb: 'Your next step and progress',
    render: function (root) {
      if (!CORB.plan.hasSetup() && !CORB.get('settings.welcomeSeen')) firstVisit(root); else returning(root);
    } });
})();
