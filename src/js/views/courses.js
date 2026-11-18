/* VIEW courses — every course on the path: what it covers, prerequisites, how to get ready, how to pass, my status */
(function () {
  'use strict';
  var CORB = window.CORB;
  var GROUPS = [['all', 'All'], ['required', 'Required'], ['prereq', 'Before CON 1300V'], ['exam', 'Exam and prep'], ['recommended', 'Recommended']];
  var GROUP_LABEL = { required: 'Required', prereq: 'Required before CON 1300V', exam: 'Exam', prep: 'Exam prep', recommended: 'Recommended' };

  function statusSeg(c, h) {
    var cur = (CORB.get('progress.courses.' + c.id) || {}).status || '';
    var seg = h('div.seg', { role: 'radiogroup', 'aria-label': 'My status for ' + c.code });
    [['', 'Not started'], ['registered', 'Signed up'], ['done', 'Done']].forEach(function (s) {
      seg.appendChild(h('button' + (cur === s[0] ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': cur === s[0] ? 'true' : 'false', onclick: function (e) {
        e.stopPropagation();
        CORB.set('progress.courses.' + c.id, s[0] ? { status: s[0], date: CORB.util.today() } : undefined);
        if (s[0] === 'done') { CORB.touch(c.id); CORB.ui.toast(c.code + ' marked done', 'ok'); }
        CORB.render();
      } }, s[1]));
    });
    return seg;
  }

  function list(title, items, h) { return items && items.length ? h('div.c-sec', {}, h('h4', {}, title), h('ul.tips', {}, items.map(function (t) { return h('li', {}, CORB.ui.rich(t)); }))) : null; }

  // a course with its own AITAS page (CON 7300V): the three steps and the button
  function aitasBox(c, h, icon) {
    var A = c.aitas; if (!A || !A.url) return null;
    return h('div.c-sec.c-aitas', {}, h('h4', {}, 'How to sign up'), A.note ? h('p.small', {}, A.note) : null,
      h('ol.c-steps', {}, (A.steps || []).map(function (s) { return h('li', {}, CORB.ui.rich(s)); })),
      h('div.row.tight', {}, CORB.ui.extLink(A.url, 'Open ' + c.code + ' in AITAS', '.btn.primary.sm'),
        h('a.btn.sm', { href: '#/cert?tab=signup' }, icon('help'), 'AITAS questions')));
  }

  // the class list copied from AITAS (data/classes.json): only classes still to start, with the seats and waits of the
  // day it was copied, filtered by time zone or open seats. Folded, so the course page stays short.
  function classRow(x, h) {
    var st = x.seats > 0 ? CORB.ui.badge('ok', x.seats + (x.seats === 1 ? ' seat open' : ' seats open'))
      : x.waits > 0 ? CORB.ui.badge('warn', 'Full · ' + x.waits + ' waiting') : CORB.ui.badge('neutral', 'No open seats');
    var onsite = /^5\d\d$/.test(x.n);
    return h('li.cl-row', { 'data-tz': x.tz, 'data-open': x.seats > 0 ? '1' : '' },
      h('span.cl-date', {}, CORB.util.fmtShort(x.start) + ' – ' + CORB.util.fmtDate(x.end)),
      h('span.cl-meta', {}, h('b', {}, 'Class ' + x.n), ' · ' + x.tz, onsite ? h('span', { title: 'Classes numbered 5xx are usually onsites: seats set aside for one group first' }, ' · onsite') : null,
        h('span.tiny.muted', {}, 'Res. close ' + CORB.util.fmtShort(x.close))),
      h('span.cl-st', {}, st));
  }
  function classList(c, h, icon, openIt) {
    var K = (CORB.DATA.classes || {})[c.id]; if (!K || !(K.classes || []).length) return null;
    var today = CORB.util.today(), up = K.classes.filter(function (x) { return x.start >= today; }), asOf = CORB.util.fmtDate(K.as_of);
    var body = h('div.cl-body');
    if (!up.length) body.appendChild(h('p.small', {}, 'The class list in this guide is out of date. Open AITAS for the current dates.'));
    else {
      var open = up.filter(function (x) { return x.seats > 0; }), tzs = [];
      up.forEach(function (x) { if (tzs.indexOf(x.tz) < 0) tzs.push(x.tz); });
      var EW = ['Eastern', 'Central', 'Mountain', 'Pacific', 'Alaska', 'Hawaii'];   // east to west, as on a map
      tzs.sort(function (p, q) { return (EW.indexOf(p) + 1 || 99) - (EW.indexOf(q) + 1 || 99); });
      body.appendChild(h('p.small', {}, up.length + ' classes from ' + CORB.util.fmtDate(up[0].start) + ' to ' + CORB.util.fmtDate(up[up.length - 1].start) + ', online, listed by time zone. On ' + asOf + ', ' + open.length + ' had open seats' +
        (open[0] ? '; the earliest was Class ' + open[0].n + ' (' + open[0].tz + '), starting ' + CORB.util.fmtDate(open[0].start) + '.' : '.')));
      body.appendChild(h('p.tiny.muted', {}, 'Seats and waitlists change every day, and AITAS has the full list. Pick a time zone whose class hours you can attend.'));
      var rows = h('ul.cl-list', {}, up.map(function (x) { return classRow(x, h); }));
      var chips = h('div.chips.cl-chips', { role: 'group', 'aria-label': 'Show classes' });
      var picks = [['', 'All', up.length], ['open', 'Open seats', open.length]].concat(tzs.map(function (t) { return [t, t, up.filter(function (x) { return x.tz === t; }).length]; }));
      function show(key) {
        Array.prototype.forEach.call(rows.children, function (li) { li.hidden = !(key === '' || (key === 'open' ? li.getAttribute('data-open') === '1' : li.getAttribute('data-tz') === key)); });
        Array.prototype.forEach.call(chips.children, function (b) { var on = b.getAttribute('data-k') === key; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      }
      picks.forEach(function (p) { chips.appendChild(h('button.chip', { type: 'button', 'data-k': p[0], 'aria-pressed': 'false', onclick: function () { show(p[0]); } }, p[1], h('span.count', {}, String(p[2])))); });
      body.appendChild(chips); body.appendChild(rows); show('');
    }
    body.appendChild(h('div.row.tight', {}, CORB.ui.extLink(K.url, 'Live list in AITAS', '.btn.sm')));
    return h('details.c-classes', { open: openIt ? true : null }, h('summary', {}, icon('calendar'), h('span.grow', {}, h('b', {}, 'Class dates and seats'), h('span.tiny.muted', {}, ' from AITAS, ' + asOf)), icon('chevron', 'chev')), body);
  }

  function card(c, h, icon, open, openClasses) {
    var st = (CORB.get('progress.courses.' + c.id) || {});
    var det = h('details.course' + (st.status === 'done' ? '.is-done' : ''), { id: 'c-' + c.id, open: !!open },
      h('summary', {},
        h('div.c-code', {}, h('span.mono', {}, c.code), st.status === 'done' ? icon('check') : null),
        h('div.c-main', {}, h('b', {}, c.title), h('div.row.tight.mt-1', {},
          CORB.ui.badge(c.group === 'required' ? 'accent' : c.group === 'exam' ? 'brass' : 'neutral', GROUP_LABEL[c.group] || c.group),
          c.delivery ? h('span.tiny.muted', {}, c.delivery) : null, c.length ? h('span.tiny.muted', {}, '· ' + c.length) : null,
          st.status === 'registered' ? CORB.ui.badge('info', 'Signed up') : null)),
        icon('chevron', 'chev')),
      h('div.c-body', {},
        c.about ? CORB.ui.rich(c.about) : null,
        h('div.c-facts', {},
          c.prereq_text ? h('div', {}, h('span.k', {}, 'Prerequisites'), h('span', {}, c.prereq_text)) : null,
          c.length ? h('div', {}, h('span.k', {}, 'Length'), h('span', {}, c.length)) : null,
          c.delivery ? h('div', {}, h('span.k', {}, 'Format'), h('span', {}, c.delivery)) : null,
          c.clps ? h('div', {}, h('span.k', {}, 'Continuous learning points'), h('span', {}, String(c.clps))) : null),
        aitasBox(c, h, icon), classList(c, h, icon, openClasses),
        list('What you will learn', c.learn, h), list('Before it starts', c.before, h), list('How to do well', c.pass, h), list('Good to know', c.notes, h),
        c.lessons && c.lessons.length ? h('div.c-sec', {}, h('h4', {}, 'Study these lessons first'), h('div.row.tight', {}, c.lessons.map(function (lid) { var l = CORB.data.lesson(lid); return l ? h('a.btn.sm', { href: '#/lesson?id=' + lid }, icon('book'), l.title) : null; }))) : null,
        h('div.c-actions', {}, h('span.small.muted', {}, 'My status'), statusSeg(c, h),
          c.url ? CORB.ui.extLink(c.url, 'Official course page', '.btn.sm') : null,
          c.verified_on ? h('span.tiny.muted', {}, 'Checked ' + CORB.util.fmtDate(c.verified_on)) : null)));
    return det;
  }

  CORB.registerView({ id: 'courses', mobileAs: 'path', title: 'Courses', section: 'Get certified', icon: 'school', nav: true, order: 40,
    blurb: 'Every course, in order, and how to pass it', keywords: 'CON 1100 1200V 1300V 7300V 1400V 3910 3900V 3990V WarU DAU iCatalog prerequisites FAC 069 082 085 CON 0074 0470',
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon, p = ctx.params;
      var group = p.group || 'all';
      var all = CORB.data.courses();
      var req = CORB.data.requiredCourses(), done = req.filter(function (c) { return CORB.data.courseDone(c.id); }).length;
      root.appendChild(CORB.ui.pageHead({ title: 'Courses', lede: 'Five courses and one exam make up the training. Open a course to see what it covers, what to finish before it starts, and how to do well.',
        meta: [CORB.ui.badge('accent', done + ' of ' + req.length + ' required courses done', 'check'), CORB.ui.badge('neutral', 'From the WarU catalog, checked ' + CORB.util.fmtDate((CORB.DATA.meta || {}).content_verified_on))] }));
      if (group === 'all' && !p.id) root.appendChild(h('div.card.flow-card.mb-5', {}, CORB.courseFlow()));
      root.appendChild(h('div.chips.mb-4', { role: 'tablist' }, GROUPS.map(function (g) {
        var n = g[0] === 'all' ? all.length : all.filter(function (c) { return g[0] === 'exam' ? (c.group === 'exam' || c.group === 'prep') : c.group === g[0]; }).length;
        return h('button.chip' + (group === g[0] ? '.on' : ''), { type: 'button', onclick: function () { CORB.go('courses', { group: g[0] }); } }, g[1], h('span.count', {}, String(n)));
      })));
      var shown = all.filter(function (c) { return group === 'all' || (group === 'exam' ? (c.group === 'exam' || c.group === 'prep') : c.group === group); });
      root.appendChild(h('div.stack.tight.course-list', {}, shown.map(function (c) { return card(c, h, icon, p.id === c.id, p.id === c.id && p.show === 'classes'); })));
      root.appendChild(h('div.mt-5', {}, CORB.ui.callout('info', 'info', 'Course names and lengths change', 'WarU (formerly DAU) updates its catalog often, and CON 1100 is shorter while the FAR Overhaul rules are being finalized. Before you register, open the official course page and read your welcome letter (it arrives about 25 days before class).')));
      if (p.id) setTimeout(function () { var el = document.getElementById('c-' + p.id); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60);
    } });
})();
