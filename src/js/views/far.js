/* VIEW far — FAR basics and how to read a cite, all 53 part titles, old→new numbers, key numbers and deadlines, what's new */
(function () {
  'use strict';
  var CORB = window.CORB;
  var TABS = [['basics', 'FAR basics'], ['parts', 'Part titles'], ['moved', 'Old → new numbers'], ['numbers', 'Key numbers'], ['new', 'What is new']];

  function anatomy(h) {
    var segs = [['FAR', 'The regulation', 'far'], ['15', 'Part 15: Contracting by Negotiation', 'part'], ['.4', 'Subpart 15.4: Contract Pricing', 'sub'], ['04', 'Section 15.404: Proposal analysis', 'sec'], ['-1', 'Subsection 15.404-1: Price analysis', 'ss'], ['(b)', 'Paragraph (b)', 'par']];
    return h('div.cite-anatomy', { role: 'img', 'aria-label': 'FAR 15.404-1(b) means Part 15, Subpart 15.4, Section 15.404, Subsection 15.404-1, paragraph (b)' },
      h('div.ca-code', {}, segs.map(function (s) { return h('span.ca-' + s[2], {}, s[0] === 'FAR' ? 'FAR ' : s[0]); })),
      h('div.ca-legend', {}, segs.map(function (s) { return h('div.ca-row', {}, h('span.ca-sw.ca-' + s[2], {}, s[0]), h('span', {}, s[1])); })));
  }

  function basics(root, F, h, icon) {
    (F.basics || []).forEach(function (s, i) {
      root.appendChild(h('section.card.basics-sec', {}, h('h2', {}, s.h), CORB.ui.rich(s.body), i === 1 ? anatomy(h) : null));
    });
    root.appendChild(h('div.row.mt-4', {}, CORB.ui.extLink('https://www.acquisition.gov/far-overhaul', 'FAR Overhaul home on acquisition.gov', '.btn'), CORB.ui.extLink('https://www.acq.osd.mil/dpap/dars/dfars_far_overhaul_class_deviations.html', 'DoW RFO class deviations (DFARS)', '.btn')));
  }

  function parts(root, F, h, icon, params) {
    var st = { q: params.q || '', exam: params.exam === '1' };
    var input = h('input.input#far-q', { type: 'search', placeholder: 'Part number or words, for example 15 or small business', value: st.q, 'aria-label': 'Search FAR parts' });
    var tog = h('label.switch', {}, h('input', { type: 'checkbox', checked: st.exam }), 'Only the 20 parts named for the exam');
    var list = h('div.parts');
    root.appendChild(h('div.row.mb-4', {}, h('div.search.grow', {}, icon('search'), input), tog));
    function paint() {
      list.innerHTML = '';
      var q = st.q.toLowerCase();
      CORB.data.farParts().filter(function (p) { return (!st.exam || p.exam) && (!q || String(p.n) === q || p.title.toLowerCase().indexOf(q) >= 0 || (p.plain || '').toLowerCase().indexOf(q) >= 0); }).forEach(function (p) {
        list.appendChild(h('a.part' + (p.exam ? '.exam' : '') + (/reserved/i.test(p.title) ? '.reserved' : ''), { href: CORB.data.citeUrl('FAR Part ' + p.n), target: '_blank', rel: 'noopener' },
          h('span.part-n.num', {}, String(p.n)), h('span.part-body', {}, h('b', {}, p.title), p.plain ? h('span.small.muted', {}, p.plain) : null),
          p.exam ? CORB.ui.badge('brass', 'On the exam', 'star') : null));
      });
      if (!list.childNodes.length) list.appendChild(h('div.empty', {}, 'No part matches.'));
    }
    input.addEventListener('input', CORB.util.debounce(function () { st.q = input.value.trim(); paint(); }, 100));
    tog.querySelector('input').addEventListener('change', function (e) { st.exam = e.target.checked; paint(); });
    root.appendChild(list); paint();
    root.appendChild(h('div.row.mt-4', {}, h('a.btn', { href: '#/cards?deck=far-exam' }, icon('cards'), 'Flashcards: exam part titles'), h('a.btn', { href: '#/games?game=farmatch' }, icon('gamepad'), 'FAR Part Match')));
  }

  function moved(root, F, h) {
    root.appendChild(h('p.muted.prose', {}, 'The FAR Overhaul renumbered many sections. Older guides, templates and people still use the old numbers, so it pays to recognize both. These are the ones a new contract specialist meets most.'));
    root.appendChild(h('div.card.flush.scroll-x', {}, h('table.table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Topic'), h('th', {}, 'Old number'), h('th', {}, 'RFO number'))),
      h('tbody', {}, (F.crosswalk || []).map(function (c) { return h('tr', {}, h('td', {}, c.what), h('td', {}, h('span.cite', {}, c.old)), h('td', {}, h('span.cite', {}, c.new))); })))));
    if (F.crosswalk_note) root.appendChild(h('p.tiny.muted.mt-3', {}, F.crosswalk_note));
  }

  function numbers(root, F, h, icon) {
    function table(rows) {
      return h('div.card.flush.scroll-x', {}, h('table.table.numbers', {}, h('thead', {}, h('tr', {}, h('th', {}, 'What'), h('th', {}, 'Number'), h('th', {}, 'In plain English'), h('th', {}, 'Where'))),
        h('tbody', {}, rows.map(function (n) { return h('tr', {}, h('td', {}, h('b', {}, n.name)), h('td.val', {}, n.value), h('td', {}, n.plain), h('td', {}, n.cite ? CORB.ui.inline ? h('span', { html: CORB.ui.inline(n.cite) }) : n.cite : '')); }))));
    }
    root.appendChild(CORB.ui.callout('info', 'flag', 'Check before you rely on a number', F.numbers_note || 'Dollar thresholds change with inflation adjustments, laws and class deviations. These were checked on the date shown at the bottom of the page.'));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'Dollar thresholds')));
    root.appendChild(table(F.numbers || []));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'Deadlines and time limits')));
    root.appendChild(table(F.deadlines || []));
    root.appendChild(h('div.row.mt-4', {}, h('a.btn', { href: '#/cards?deck=numbers' }, icon('cards'), 'Flashcards: key numbers'), h('a.btn', { href: '#/games?game=threshold' }, icon('gamepad'), 'Threshold check game')));
    root.appendChild(h('p.tiny.muted.mt-3', {}, 'Checked ' + CORB.util.fmtDate(F.checked_on || (CORB.meta().content_verified_on)) + '.'));
  }

  function whatsNew(root, F, h) {
    var U = CORB.data.updates();
    root.appendChild(h('p.muted.prose', {}, 'Contracting rules are changing fast. This list shows the changes that matter to a new 51C or 1102, newest first. When the maintainer updates the guide, new entries appear here.'));
    root.appendChild(h('div.timeline', {}, (U.far_updates || []).map(function (u) {
      return h('div.tl-item', {}, h('div.tl-date.num', {}, CORB.util.fmtDate(u.date)), h('div.tl-body', {}, h('b', {}, u.title), CORB.ui.rich(u.body), u.source ? h('div.tiny.muted.mt-1', {}, u.url ? h('a', { href: u.url, target: '_blank', rel: 'noopener' }, u.source) : u.source) : null));
    })));
    if ((U.guide_changes || []).length) {
      root.appendChild(h('div.section-head', {}, h('h2', {}, 'Changes to this guide')));
      root.appendChild(h('div.card.flush', {}, h('div.list', {}, U.guide_changes.map(function (g) { return h('div.list-item', { style: { padding: '12px 16px' } }, h('span.num.small', { style: { minWidth: '90px' } }, 'v' + g.version), h('div.grow', {}, h('b', {}, g.title), h('div.small.muted', {}, g.notes), h('div.tiny.muted', {}, CORB.util.fmtDate(g.date)))); }))));
    }
  }

  CORB.registerView({ id: 'far', mobileAs: 'glossary', title: 'FAR & key numbers', section: 'Look it up', icon: 'scale', nav: true, order: 110,
    blurb: 'FAR part titles, thresholds, deadlines and what changed', keywords: 'FAR DFARS AFARS RFO overhaul citation part titles thresholds micro-purchase simplified acquisition threshold SAT TINA deadlines protest closeout crosswalk what is new updates',
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon, F = CORB.DATA.far || {}, tab = ctx.params.tab || 'basics';
      root.appendChild(CORB.ui.pageHead({ title: 'FAR & key numbers', lede: 'The Federal Acquisition Regulation (FAR) is the rulebook for buying things for the Government. Here is how it is organized, how to read a citation, the numbers you will use every week, and what changed lately.' }));
      root.appendChild(h('div.tabs', { role: 'tablist' }, TABS.map(function (t) { return h('button' + (t[0] === tab ? '.on' : ''), { type: 'button', role: 'tab', 'aria-selected': t[0] === tab ? 'true' : 'false', onclick: function () { CORB.go('far', { tab: t[0] }); } }, t[1]); })));
      var body = h('div'); root.appendChild(body);
      ({ basics: basics, parts: parts, moved: moved, numbers: numbers, 'new': whatsNew }[tab] || basics)(body, F, h, icon, ctx.params);
    } });
})();
