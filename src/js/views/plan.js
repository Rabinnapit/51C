/* VIEW plan — the dated checklist from day one to certified, with a timeline from start to the 36-month deadline */
(function () {
  'use strict';
  var CORB = window.CORB;
  var GROUPS = [
    ['setup', 'Week 1: get set up', 'user'], ['courses', 'Courses', 'school'], ['exam', 'The certification exam', 'award'],
    ['certify', 'Experience and certification', 'certificate'], ['after', 'After you are certified', 'star']
  ];

  function changeDates() {
    var f = CORB.setupForm();
    CORB.ui.modal({ title: 'Change my plan', body: f.el, actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: function () { if (!f.save()) return false; CORB.ui.toast('Plan updated', 'ok'); CORB.render(); } }] });
  }

  function timeline(h, plan, U) {
    var start = plan.start(), end = plan.deadline(), total = Math.max(1, U.daysBetween(start, end));
    function pos(d) { return U.clamp(U.daysBetween(start, d) / total * 100, 0, 100); }
    var marks = [
      { d: start, label: 'Start', cls: 'm-start' },
      { d: plan.goal(), label: 'Courses + exam goal', cls: 'm-goal' },
      { d: plan.experienceDate(), label: '12 months experience', cls: 'm-exp' },
      { d: end, label: '36-month deadline', cls: 'm-end' }
    ];
    var today = U.today(), tp = pos(today);
    return h('div.tl', { role: 'img', 'aria-label': 'Timeline from ' + U.fmtDate(start) + ' to ' + U.fmtDate(end) },
      h('div.tl-track', {}, h('div.tl-fill', { style: { width: tp + '%' } })),
      marks.map(function (m, i) { return h('div.tl-mark.' + m.cls + (i % 2 ? '.below' : ''), { style: { left: pos(m.d) + '%' } }, h('span.tl-pin'), h('span.tl-lab', {}, h('b', {}, m.label), h('span', {}, U.fmtDate(m.d)))); }),
      today >= start && today <= end ? h('div.tl-today', { style: { left: tp + '%' } }, h('span', {}, 'Today')) : null);
  }

  function stepRow(s, h, U, plan) {
    var chip = s.done ? CORB.ui.badge('ok', 'Done', 'check') : s.status === 'late' ? CORB.ui.badge('warn', 'Past target · ' + U.fmtShort(s.target), 'clock') : s.status === 'soon' ? CORB.ui.badge('info', 'Next 2 weeks · ' + U.fmtShort(s.target), 'calendar') : CORB.ui.badge('neutral', U.fmtDate(s.target), 'calendar');
    var more = h('div.step-more', { hidden: true },
      s.detail ? CORB.ui.rich(s.detail) : null,
      h('div.row.tight.mt-3', {},
        s.course ? h('a.btn.sm', { href: '#/courses?id=' + s.course }, CORB.ui.icon('school'), 'About the course') : null,
        s.howto ? h('a.btn.sm', { href: '#/howto?id=' + s.howto }, CORB.ui.icon('steps'), 'Step-by-step') : null,
        s.lesson ? h('a.btn.sm', { href: '#/lesson?id=' + s.lesson }, CORB.ui.icon('book'), 'Lesson') : null,
        (s.links || []).map(function (l) { return CORB.ui.extLink(l.url, l.label, '.btn.sm'); }),
        s.verify ? CORB.ui.verifyBadge(s.verify === true ? null : s.verify) : null));
    more.addEventListener('click', function (e) { if (!e.target.closest('a, button, input')) e.preventDefault(); });   // reading the details must not tick the step
    var toggle = h('button.btn.sm.ghost.more-btn', { type: 'button', 'aria-expanded': 'false' }, 'Details', CORB.ui.icon('chevron'));
    toggle.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); more.hidden = !more.hidden; toggle.setAttribute('aria-expanded', more.hidden ? 'false' : 'true'); toggle.classList.toggle('open', !more.hidden); });
    var auto = s.course || s.auto;
    var row = CORB.ui.checkItem({ checked: s.done, title: s.title,
      sub: h('div', {}, h('div.row.tight', {}, chip, s.who ? h('span.tiny.muted', {}, s.who) : null, auto && !CORB.get('progress.steps.' + s.id) && s.done ? h('span.tiny.muted', {}, '(ticked for you)') : null), more),
      aside: toggle,
      onChange: function (v) {
        plan.setStep(s.id, v);
        if (s.course) { if (v) CORB.set('progress.courses.' + s.course, { status: 'done', date: U.today() }); else CORB.set('progress.courses.' + s.course, undefined); }
        if (v) CORB.ui.toast('Marked done', 'ok');
        setTimeout(CORB.render, 250);
      } });
    row.classList.add('step', 'st-' + s.status);
    return row;
  }

  CORB.registerView({ id: 'plan', title: 'My plan', section: 'Start', icon: 'route', nav: true, order: 20, mobile: true, short: 'Plan', blurb: 'Your dated steps to certification',
    keywords: 'timeline schedule calendar deadline 36 months 6 months goal checklist',
    render: function (root) {
      var h = CORB.ui.h, icon = CORB.ui.icon, U = CORB.util, plan = CORB.plan;
      root.appendChild(CORB.ui.pageHead({ title: 'My plan', lede: 'Every step from day one to certified. Tick a step when it is done. Dates move when you change your start date or goal.' }));
      if (!plan.hasSetup()) {
        var f = CORB.setupForm();
        root.appendChild(h('div.card.raised', {}, h('h2', {}, 'Tell us three things'), f.el, h('div.row.mt-5', {}, h('button.btn.primary.lg', { type: 'button', onclick: function () { if (f.save()) { CORB.ui.toast('Your plan is ready', 'ok'); CORB.render(); } } }, 'Build my plan', icon('arrow-right')))));
        return;
      }
      var pr = plan.progress();
      root.appendChild(h('section.card.raised.plan-top', {},
        h('div.row.between.top', {},
          h('div', {}, h('div.row.tight', {}, CORB.ui.badge('accent', CORB.trackLabel(plan.track()), 'user'), h('span.muted.small', {}, 'Started ' + U.fmtDate(plan.start()))),
            h('div.plan-count', {}, h('b.num', {}, pr.done + ' of ' + pr.total), ' steps done')),
          h('div.row.tight.no-print', {},
            h('button.btn.sm', { type: 'button', onclick: changeDates }, icon('edit'), 'Change dates'),
            CORB.can('download') ? h('button.btn.sm', { type: 'button', onclick: function () { if (CORB.store.download('B2B-Guide-plan.ics', plan.ics(), 'text/calendar')) CORB.ui.toast('Calendar file downloaded. Open it to add the dates to Outlook.', 'ok', 4500); } }, icon('calendar'), 'Add to calendar') : null,
            CORB.can('print') ? h('button.btn.sm', { type: 'button', onclick: function () { window.print(); } }, icon('print'), 'Print') : null)),
        CORB.ui.bar(pr.pct, 'brass'),
        timeline(h, plan, U),
        h('p.tiny.muted.tl-caption', {}, 'The green part of the line is time already passed: today is day ' + plan.dayNumber() + ' of your 36 months.')));
      root.appendChild(CORB.ui.callout('info', 'info', 'Why the goal and the certificate are different dates',
        'You can finish all five courses and pass the exam by your goal date. The certificate itself also needs 12 months of full-time contracting experience, so the earliest it can be granted is ' + U.fmtDate(plan.experienceDate()) + '. Equivalent prior experience can count if it is documented; ask your supervisor.'));
      var steps = plan.steps();
      GROUPS.forEach(function (g) {
        var list = steps.filter(function (s) { return s.phase === g[0]; }); if (!list.length) return;
        var done = list.filter(function (s) { return s.done; }).length;
        root.appendChild(h('section.plan-group', {},
          h('div.section-head', {}, h('h2', {}, icon(g[2]), ' ', g[1]), h('span.muted', {}, done + ' of ' + list.length + ' done')),
          h('div.stack.tight', {}, list.map(function (s) { return stepRow(s, h, U, plan); }))));
      });
      root.appendChild(h('p.muted.small.mt-5', {}, 'Dates are targets the guide spreads across your goal window. Course seats, deployments and leave move them; change your goal any time. Steps marked "Verify locally" depend on your unit or office.'));
    } });
})();
