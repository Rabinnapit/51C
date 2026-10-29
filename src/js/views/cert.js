/* VIEW cert — Certification 101: what certification takes, the order of courses, signing up, the exam, experience, FAQ */
(function () {
  'use strict';
  var CORB = window.CORB;
  var TABS = [['overview', 'Overview'], ['signup', 'Sign up for courses'], ['exam', 'The exam'], ['experience', 'Experience'], ['after', 'After you are certified'], ['faq', 'Questions'], ['sources', 'Sources']];

  // the order of courses, drawn with boxes and arrows (stacks into one column on a phone)
  CORB.courseFlow = function () {
    var h = CORB.ui.h, icon = CORB.ui.icon;
    function node(id, sub, cls) {
      var c = CORB.data.course(id); if (!c) return null;
      var done = CORB.data.courseDone(id);
      return h('a.flow-node' + (cls ? '.' + cls : '') + (done ? '.done' : ''), { href: '#/courses?id=' + id, title: c.title }, done ? icon('check') : null,
        h('b.mono', {}, c.code), h('span', {}, c.short || c.title), sub ? h('em', {}, sub) : null);
    }
    function arrow(dir) { return h('div.flow-arrow' + (dir ? '.' + dir : ''), { 'aria-hidden': 'true' }, icon(dir === 'down' ? 'chevron' : 'chevron-right')); }
    return h('div.flow', { role: 'group', 'aria-label': 'Order of the certification courses' },
      h('div.flow-row', {}, h('div.flow-step', {}, h('span.flow-n', {}, '1'), node('con1100', '4 days'))),
      h('div.flow-split', {},
        h('div.flow-lane', {}, h('div.flow-lane-label', {}, 'Pre-award and award'),
          h('div.flow-chain', {}, node('con1200', '9 days'), arrow(), h('a.flow-node.prereq', { href: '#/courses?group=prereq' }, h('b', {}, '5 online modules'), h('span', {}, 'FAC 069, 082, 085, CON 0074, 0470'), h('em', {}, 'before or during 1300V')), arrow(), node('con1300', '8 days'), arrow(), node('con7300', '7 days'))),
        h('div.flow-lane.short', {}, h('div.flow-lane-label', {}, 'Post-award (any time after 1100)'), h('div.flow-chain', {}, node('con1400', '5 days')))),
      h('div.flow-row', {}, h('div.flow-chain', {}, node('con3910', 'optional, strongly advised', 'opt'), arrow(), node('con3990', '150 questions · 3 hours', 'exam'))),
      h('div.flow-row', {}, h('div.flow-chain', {}, h('div.flow-node.exp', {}, h('b', {}, '12 months'), h('span', {}, 'full-time contracting experience')), arrow(), h('div.flow-node.cert', {}, icon('certificate'), h('b', {}, 'Certified'), h('span', {}, 'DoW Contracting Professional')))));
  };

  // the same content in words, folded under a picture version
  function inWords(text, h) { return text ? h('details.in-words', {}, h('summary', {}, 'Read it in words'), CORB.ui.rich(text)) : null; }

  function overview(root, C, h, icon) {
    var X = CORB.explain;
    root.appendChild(h('div.grid.cols-3.req-cards', {}, (C.requirements || []).map(function (r) {
      return h('div.card.req', {}, h('div.req-icon', {}, icon(r.icon)), h('h3', {}, r.title), CORB.ui.rich(r.body));
    })));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'The order of the courses'), h('div.row.tight', {}, X.docButton('cert-standard', 'Official standard'), h('a', { href: '#/courses' }, 'Course details'))));
    root.appendChild(h('div.card.flow-card', {}, CORB.courseFlow()));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'Deadlines'), X.docButton('exam-faq', 'Official FAQ')));
    root.appendChild(h('div.card', {}, X.grace()));
    root.appendChild(h('div.grid.cols-2.mt-4', {}, (C.deadlines || []).map(function (d) { return h('div.card', {}, h('div.eyebrow', {}, d.label), h('h3.mt-2', {}, d.title), CORB.ui.rich(d.body)); })));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'Who does what')));
    root.appendChild(h('div.grid.auto.roles', {}, (C.roles || []).map(function (r) { return h('div.card.tight', {}, h('b', {}, r.name), h('p.small.muted.mt-2', {}, r.does)); })));
    if (C.education) root.appendChild(h('div.mt-5', {}, CORB.ui.callout('info', 'school', 'College degree?', C.education)));
  }

  function signup(root, C, h, icon) {
    var R = C.register || {};
    root.appendChild(h('div.card.raised', {}, h('h2', {}, 'Apply for a WarU course (Army)'), R.intro ? CORB.ui.rich(R.intro) : null,
      h('ol.steps-list', {}, (R.steps || []).map(function (s) { return h('li', {}, h('b', {}, s.t), s.d ? CORB.ui.rich(s.d) : null); })),
      R.verify ? h('div.mt-3', {}, CORB.ui.verifyBadge(R.verify)) : null));
    if ((R.tips || []).length) root.appendChild(h('div.card.mt-4', {}, h('h3', {}, 'Tips that save you a month'), h('ul.tips', {}, R.tips.map(function (t) { return h('li', {}, CORB.ui.rich(t)); }))));
    root.appendChild(h('div.row.mt-4', {}, (R.links || []).map(function (l) { return CORB.ui.extLink(l.url, l.label, '.btn.primary'); }),
      h('a.btn', { href: '#/howto?id=register-course' }, icon('steps'), 'Checklist: register for a course'), h('a.btn', { href: '#/courses' }, icon('school'), 'All courses')));
  }

  function exam(root, C, h, icon) {
    var E = C.exam || {}, X = CORB.explain;
    root.appendChild(h('div.card.raised', {}, h('div.row.between', {}, h('h2', {}, 'CON 3990V at a glance'), X.docButton('exam-faq', 'Official FAQ')),
      h('div.mt-4', {}, X.examFacts()), E.source ? h('p.tiny.muted.mt-3', {}, E.source) : null));
    // blueprint
    var phases = CORB.data.phases(), max = 18;
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'What the 150 questions cover'), h('span.muted', {}, 'Official question count per competency')));
    root.appendChild(h('div.grid.cols-2.blueprint', {}, phases.map(function (p) {
      return h('div.card.bp-card.ph-' + p.id, {}, h('div.row.between', {}, h('h3', {}, p.code + ' ' + p.name), h('span.bp-total.num', {}, p.qs + ' Qs')),
        h('p.small.muted', {}, p.plain),
        h('div.stack.tight.mt-3', {}, (p.items || []).map(function (it) {
          return h('div.bp-row', {}, h('div.row.between', {}, h('span.small', {}, h('span.num.muted', {}, it.code), ' ', it.name), h('b.num.small', {}, String(it.qs))), CORB.ui.bar(it.qs / max * 100, 'ph-' + p.id));
        })),
        h('a.btn.sm.mt-4', { href: '#/learn?phase=' + p.id }, icon('book'), 'Study ' + p.short));
    })));
    root.appendChild(h('div.callout.brass.mt-4', {}, icon('bulb'), h('div', {}, h('b', {}, 'Two tips straight from the exam FAQ'), h('span', {}, 'Learn the titles of FAR Parts 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 15, 16, 19, 31, 33, 42, 44, 46 and 49, and read FAR Part 15 thoroughly: many questions come from it. '),
      h('a', { href: '#/cards?deck=far-exam' }, 'Drill the FAR part titles'), ' · ', h('a', { href: '#/arcade?game=part-patrol' }, 'Play Part Patrol'), ' · ', h('a', { href: '#/games?game=farmatch' }, 'FAR Part Match'))));
    if ((E.study || []).length) {
      root.appendChild(h('div.section-head', {}, h('h2', {}, 'Tips from the WarU exam team')));
      root.appendChild(h('div.grid.cols-2.study-tips', {}, E.study.map(function (s) { return h('div.card.tight', {}, h('div.row.tight', {}, h('span.tip-ic', {}, icon(s.icon)), h('b', {}, s.t)), h('p.small.mt-2', {}, s.d)); })));
      if (E.study_source) root.appendChild(h('p.tiny.muted.mt-2', {}, E.study_source));
    }
    // what to trust from outside the guide: official first, free decks checked, "real exam" sets skipped
    var O = E.outside;
    if (O && (O.tiers || []).length) {
      root.appendChild(h('div.section-head', {}, h('h2', {}, O.title)));
      if (O.lede) root.appendChild(h('p.small', {}, O.lede));
      root.appendChild(h('div.grid.cols-3.outside-tiers.mt-3', {}, O.tiers.map(function (t) {
        return h('div.callout.' + t.tone, {}, icon(t.icon), h('div', {}, h('b', {}, t.t), h('ul.tips', {}, (t.items || []).map(function (it) {
          var go = it.href ? h('a', { href: it.href }, it.link) : it.url ? h('a', { href: it.url, target: '_blank', rel: 'noopener' }, it.link) : null;
          return h('li', {}, it.t, go ? ' ' : null, go);
        }))));
      })));
      if (O.checked) root.appendChild(h('p.tiny.muted.mt-2', {}, O.checked));
    }
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'The exam, step by step'), h('div.row.tight', {}, X.docButton('exam-roadmap', 'Official roadmap'), X.docButton('exam-flowchart', 'Official flowchart'))));
    root.appendChild(h('div.card', {}, X.journey()));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'The fine print')));
    root.appendChild(X.rules());
    root.appendChild(h('div.card.mt-4', {}, h('h3', {}, 'Behind the scenes'), h('p.small.muted', {}, 'Your request and your result pass through four systems. You do not need to do anything; this is why the email and the result take a day.'), X.flow()));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'If you do not pass'), X.docButton('exam-faq', 'Official FAQ')));
    root.appendChild(h('div.card', {}, X.attempts(), inWords((E.retake || []).map(function (t) { return '- ' + t; }).join('\n'), h)));
    root.appendChild(h('div.card.mt-4', {}, h('h3', {}, 'Test day checklist'), h('ul.tips', {}, (E.testday || []).map(function (t) { return h('li', {}, t); }))));
    // my attempts
    var at = CORB.get('progress.exam.attempts', []) || [];
    var sched = h('input.input#exam-date', { type: 'date', value: CORB.get('progress.exam.scheduled') || '' });
    sched.addEventListener('change', function () { CORB.set('progress.exam.scheduled', sched.value); CORB.ui.toast(sched.value ? 'Exam date saved' : 'Exam date cleared', 'ok'); });
    var score = h('input.input#exam-score', { type: 'number', min: '0', max: '100', placeholder: 'Score %' });
    root.appendChild(h('div.card.mt-4.my-exam', {}, h('h3', {}, 'My exam'),
      h('div.grid.cols-2', {}, h('div.field', {}, h('label', { for: 'exam-date' }, 'My exam date'), sched),
        h('div.field', {}, h('label', { for: 'exam-score' }, 'Record a result'), h('div.row.tight', {}, score, h('button.btn', { type: 'button', onclick: function () {
          var v = +score.value; if (!score.value || v < 0 || v > 100) { CORB.ui.toast('Type the score from your Pearson report (0 to 100).', 'warn'); return; }
          CORB.push('progress.exam.attempts', { date: CORB.util.today(), score: v, passed: v >= 70 });
          CORB.ui.toast(v >= 70 ? 'Congratulations! Recorded as passed.' : 'Recorded. Take CON 3900V before your next try.', v >= 70 ? 'ok' : 'warn', 5000); CORB.render();
        } }, 'Save')))),
      at.length ? h('div.list.mt-3', {}, at.map(function (a, i) { return h('div.list-item', {}, h('b', {}, 'Attempt ' + (i + 1)), h('span.grow', {}, CORB.util.fmtDate(a.date)), h('span.num', {}, a.score + '%'), CORB.ui.badge(a.passed ? 'ok' : 'warn', a.passed ? 'Passed' : 'Not passed')); })) : h('p.muted.small.mt-3', {}, 'Nothing recorded yet. Your result stays on this device.')));
  }

  function experience(root, C, h) {
    var X = C.experience || {};
    var items = X.items || [], done = items.filter(function (i) { return CORB.get('progress.exp.' + i.id); }).length;
    root.appendChild(h('div.card.raised', {}, h('h2', {}, '12 months of experience'), CORB.ui.rich(X.intro || ''),
      h('div.row.between.mt-4', {}, h('b', {}, done + ' of ' + items.length + ' tasks done'), h('span.muted.small', {}, 'Your supervisor decides what counts')), CORB.ui.bar(CORB.util.pct(done, items.length), 'ok')));
    var ojt = CORB.official && CORB.official.doc('ojt-tool');
    if (ojt) root.appendChild(h('div.card.mt-4', {}, h('div.row.between', {}, h('h3', {}, 'WarU On-the-Job Training Tool'), CORB.ui.extLink(ojt.url, 'Open the tool', '.btn.sm')), CORB.explain.ojt()));
    var byPhase = {};
    items.forEach(function (i) { (byPhase[i.phase] = byPhase[i.phase] || []).push(i); });
    CORB.data.phases().forEach(function (p) {
      var list = byPhase[p.id]; if (!list) return;
      root.appendChild(h('div.section-head', {}, h('h2', {}, h('span.phase-dot.ph-' + p.id), ' ', p.name)));
      root.appendChild(h('div.stack.tight', {}, list.map(function (i) {
        return CORB.ui.checkItem({ checked: !!CORB.get('progress.exp.' + i.id), title: i.text, sub: i.tip || '', onChange: function (v) { CORB.set('progress.exp.' + i.id, v ? CORB.util.today() : undefined); if (v) CORB.touch(i.id); } });
      })));
    });
    if (X.note) root.appendChild(h('p.muted.small.mt-4', {}, X.note));
  }

  function after(root, C, h, icon) {
    var A = C.after || {}, X = CORB.explain;
    root.appendChild(h('div.card', {}, h('div.row.between', {}, h('h2', {}, 'Stay current: 80 hours every 2 years'), X.docButton('cl-recommendations', 'Official memo')), h('div.mt-4', {}, X.cl()), inWords(A.cl, h)));
    root.appendChild(h('div.card.mt-4', {}, h('div.row.between', {}, h('h2', {}, 'Your career path'), X.docButton('career-model', 'Official career model')), h('div.mt-4', {}, X.career())));
    root.appendChild(h('div.card.mt-4', {}, h('div.row.between', {}, h('h2', {}, 'Next: a warrant'), X.docButton('warranting-program', 'Warranting Program Model')), CORB.ui.rich(A.next || ''), h('div.mt-4', {}, X.warrant())));
    if ((A.credentials || []).length) {
      root.appendChild(h('div.section-head', {}, h('h2', {}, 'Credentials worth earning')));
      root.appendChild(h('div.grid.auto', {}, A.credentials.map(function (c) { return h('div.card.tight', {}, h('div.row.between', {}, h('b.mono', {}, c.code), c.for ? CORB.ui.badge('brass', c.for) : null), h('div.mt-2', {}, h('b', {}, c.title)), h('p.small.muted.mt-2', {}, c.why)); })));
    }
    if (A.reciprocity) root.appendChild(h('div.card.mt-5', {}, h('div.row.between', {}, h('h2', {}, 'Civilian agencies and the FAC-C'), X.docButton('reciprocity-faq', 'Official FAQs')), h('div.mt-4', {}, X.reciprocity()), inWords(A.reciprocity, h)));
  }

  function faq(root, C, h, icon, params) {
    var list = C.faq || [];
    root.appendChild(h('div.stack.tight', {}, list.map(function (f, i) {
      return h('details.acc' , { open: String(i) === params.open }, h('summary', {}, icon('help'), h('span', {}, f.q), icon('chevron', 'chev')), h('div.acc-body', {}, CORB.ui.rich(f.a)));
    })));
  }

  function sources(root, C, h, icon) {
    root.appendChild(h('div.callout.ok.mb-4', {}, icon('file'), h('div', {}, h('b', {}, 'See the real documents'),
      h('span', {}, 'Official documents shows the DoW and WarU documents themselves, each with a picture version. The main ones open inside this file, without internet. '), h('a', { href: '#/official' }, 'Open Official documents'))));
    root.appendChild(h('p.muted', {}, 'Everything in Certification 101 was checked against these public sources on the dates shown. Rules change: when your KMG or WarU says something different, they win.'));
    root.appendChild(h('div.card.flush', {}, h('div.list', {}, (C.sources || []).map(function (s) {
      return h('div.list-item.src', {}, icon('file'), h('div.grow', {}, s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.title) : h('b', {}, s.title), h('div.tiny.muted', {}, (s.who ? s.who + ' · ' : '') + (s.date ? 'dated ' + s.date : '') + (s.checked ? ' · checked ' + s.checked : ''))));
    }))));
  }

  CORB.registerView({ id: 'cert', mobileAs: 'path', title: 'Certification 101', section: 'Get certified', icon: 'certificate', nav: true, order: 30,
    blurb: 'What it takes to get certified', keywords: 'requirements exam CON 3990V AITAS register experience 36 months deadline grace period continuous learning CLP FAQ reciprocity roadmap flowchart Pearson OnVUE retake 48 hours cancel reschedule career path warrant OJT',
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon, C = CORB.DATA.cert || {};
      var tab = ctx.params.tab || 'overview';
      root.appendChild(CORB.ui.pageHead({ title: 'Certification 101', lede: C.lede || 'The DoW Contracting Professional certification in plain English: what it takes, in what order, and how to sign up.' }));
      root.appendChild(h('div.tabs', { role: 'tablist' }, TABS.map(function (t) { return h('button' + (t[0] === tab ? '.on' : ''), { type: 'button', role: 'tab', 'aria-selected': t[0] === tab ? 'true' : 'false', onclick: function () { CORB.go('cert', { tab: t[0] }); } }, t[1]); })));
      var body = h('div.tab-body'); root.appendChild(body);
      ({ overview: overview, signup: signup, exam: exam, experience: experience, after: after, faq: faq, sources: sources }[tab] || overview)(body, C, h, icon, ctx.params);
    } });
})();
