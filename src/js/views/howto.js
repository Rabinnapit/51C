/* VIEW howto — step-by-step checklists for career admin (sign up, schedule the exam) and real contracting tasks */
(function () {
  'use strict';
  var CORB = window.CORB;
  var CATS = [['all', 'All'], ['career', 'Your certification'], ['job', 'Contracting tasks']];

  function detail(root, x, h, icon) {
    var saved = CORB.get('progress.howto.' + x.id) || {}, n = (x.steps || []).length;
    var count = h('b', {});
    function paint() { var s = CORB.get('progress.howto.' + x.id) || {}; count.textContent = Object.keys(s).filter(function (k) { return s[k]; }).length + ' of ' + n + ' steps done'; }
    root.appendChild(h('header.page-head', {}, h('a.back-link', { href: '#/howto' }, icon('arrow-left'), 'All how-to guides'),
      h('div.row.tight.mt-2', {}, CORB.ui.badge(x.cat === 'career' ? 'brass' : 'accent', x.cat === 'career' ? 'Your certification' : 'Contracting task'), x.time ? h('span.tiny.muted', {}, x.time) : null),
      h('h1', {}, x.title), x.when ? h('p.lede', {}, x.when) : null,
      h('div.row.tight.mt-3.no-print', {}, CORB.ui.listenBtn(function () { return x.title + '. ' + (x.steps || []).map(function (s, i) { return 'Step ' + (i + 1) + '. ' + s.t + '. ' + (s.d || ''); }).join(' '); }),
        CORB.can('print') ? h('button.btn.sm.ghost', { type: 'button', onclick: function () { window.print(); } }, icon('print'), 'Print') : null,
        h('button.btn.sm.ghost', { type: 'button', onclick: function () { CORB.set('progress.howto.' + x.id, {}); CORB.render(); } }, icon('refresh'), 'Clear ticks'))));
    if (x.who) root.appendChild(h('p.muted.small', {}, h('b', {}, 'Who: '), x.who));
    var box = h('div.card.raised', {}, h('div.row.between.mb-3', {}, count, h('span.tiny.muted', {}, 'Ticks stay on this device')));
    (x.steps || []).forEach(function (s, i) {
      var row = CORB.ui.checkItem({ checked: !!saved[i], title: (i + 1) + '. ' + s.t, sub: s.d ? CORB.ui.rich(s.d + (s.cite ? '\nCite: ' + s.cite : '')) : null,
        onChange: function (v) { CORB.set('progress.howto.' + x.id + '.' + i, v || undefined); if (v) CORB.touch(x.id); paint(); } });
      var sub = row.querySelector('.check-sub'); if (sub) sub.addEventListener('click', function (e) { if (!e.target.closest('a, button')) e.preventDefault(); });
      box.appendChild(row);
    });
    paint();
    root.appendChild(box);
    var extras = h('div.grid.cols-2.mt-4', {});
    if ((x.tips || []).length) extras.appendChild(h('div.card', {}, h('h3', {}, icon('bulb'), ' Tips'), h('ul.tips', {}, x.tips.map(function (t) { return h('li', {}, CORB.ui.rich(t)); }))));
    if ((x.watch || []).length) extras.appendChild(h('div.card', {}, h('h3', {}, icon('alert'), ' Watch out for'), h('ul.tips', {}, x.watch.map(function (t) { return h('li', {}, CORB.ui.rich(t)); }))));
    if (extras.childNodes.length) root.appendChild(extras);
    var rel = h('div.row.tight.mt-4', {},
      (x.lessons || []).map(function (lid) { var l = CORB.data.lesson(lid); return l ? h('a.btn.sm', { href: '#/lesson?id=' + lid }, icon('book'), l.title) : null; }),
      (x.links || []).map(function (l) { return CORB.ui.extLink(l.url, l.label, '.btn.sm'); }),
      x.verify ? CORB.ui.verifyBadge(x.verify === true ? null : x.verify) : null);
    if (rel.childNodes.length) root.appendChild(h('div', {}, h('h3.mt-4', {}, 'Related'), rel));
  }

  CORB.registerView({ id: 'howto', mobileAs: 'learn', title: 'How-to guides', section: 'Learn', icon: 'steps', nav: true, order: 60,
    blurb: 'Step-by-step checklists', keywords: 'procedure checklist steps register AITAS exam Pearson simplified acquisition price reasonableness modification closeout ratification market research',
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon, p = ctx.params;
      if (p.id) { var x = CORB.data.howto(p.id); if (x) { detail(root, x, h, icon); return; } }
      var cat = p.cat || 'all';
      root.appendChild(CORB.ui.pageHead({ title: 'How-to guides', lede: 'Step-by-step checklists. Some walk you through your own certification paperwork; others walk through real contracting tasks the way a contracting office does them.' }));
      root.appendChild(h('div.chips.mb-4', {}, CATS.map(function (c) { return h('button.chip' + (cat === c[0] ? '.on' : ''), { type: 'button', onclick: function () { CORB.go('howto', { cat: c[0] }); } }, c[1]); })));
      var list = CORB.data.howtos().filter(function (x) { return cat === 'all' || x.cat === cat; });
      root.appendChild(h('div.grid.auto', {}, list.map(function (x) {
        var s = CORB.get('progress.howto.' + x.id) || {}, d = Object.keys(s).filter(function (k) { return s[k]; }).length, n = (x.steps || []).length;
        return h('a.card.lift.howto-tile', { href: '#/howto?id=' + x.id }, h('div.row.between', {}, CORB.ui.badge(x.cat === 'career' ? 'brass' : 'accent', x.cat === 'career' ? 'Certification' : 'Contracting task'), h('span.tiny.muted', {}, n + ' steps')),
          h('b', {}, x.title), h('span.small.muted.clamp-2', {}, x.when || ''), d ? CORB.ui.bar(CORB.util.pct(d, n), 'ok') : null);
      })));
    } });
})();
