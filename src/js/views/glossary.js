/* VIEW glossary — every acronym and term in plain English, searchable, filterable, read aloud */
(function () {
  'use strict';
  var CORB = window.CORB;
  CORB.registerView({ id: 'glossary', title: 'Glossary', section: 'Look it up', icon: 'glossary', nav: true, order: 100, mobile: true, short: 'Glossary',
    blurb: 'Every acronym, explained', keywords: 'acronym term definition dictionary meaning',
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon;
      var all = CORB.data.glossary().slice().sort(function (a, b) { return a.term.toLowerCase() < b.term.toLowerCase() ? -1 : 1; });
      var st = { q: ctx.params.q || '', cat: ctx.params.cat || '', letter: '', limit: 80 };
      var cats = []; all.forEach(function (g) { if (g.cat && cats.indexOf(g.cat) < 0) cats.push(g.cat); }); cats.sort();
      root.appendChild(CORB.ui.pageHead({ title: 'Glossary', lede: 'Contracting runs on acronyms. Every one in this guide is here in plain English. Tip: anywhere in the guide, a word with a dotted underline opens its meaning when you tap it.', meta: [CORB.ui.badge('neutral', all.length + ' terms')] }));
      var input = h('input.input#gl-q', { type: 'search', placeholder: 'Type a term or acronym, for example COR or option', value: st.q, 'aria-label': 'Search the glossary' });
      var letters = h('div.az', { role: 'group', 'aria-label': 'First letter' });
      var chips = h('div.chips');
      var list = h('div.gl-list');
      root.appendChild(h('div.gl-tools', {}, h('div.search', {}, icon('search'), input), letters, chips));
      root.appendChild(list);
      function paintFilters() {
        letters.innerHTML = '';
        ['All'].concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('')).forEach(function (L) {
          var has = L === 'All' || all.some(function (g) { var c = g.term.charAt(0).toUpperCase(); return L === '#' ? !/[A-Z]/.test(c) : c === L; });
          letters.appendChild(h('button' + ((st.letter === L || (L === 'All' && !st.letter)) ? '.on' : ''), { type: 'button', disabled: !has, onclick: function () { st.letter = L === 'All' ? '' : L; st.limit = 80; paintFilters(); paint(); } }, L));
        });
        chips.innerHTML = '';
        [''].concat(cats).forEach(function (c) { chips.appendChild(h('button.chip' + (st.cat === c ? '.on' : ''), { type: 'button', onclick: function () { st.cat = c; st.limit = 80; paintFilters(); paint(); } }, c || 'All topics')); });
      }
      function match(g) {
        if (st.cat && g.cat !== st.cat) return false;
        if (st.letter) { var c = g.term.charAt(0).toUpperCase(); if (st.letter === '#' ? /[A-Z]/.test(c) : c !== st.letter) return false; }
        if (!st.q) return true;
        var q = st.q.toLowerCase();
        return g.term.toLowerCase().indexOf(q) >= 0 || (g.expansion || '').toLowerCase().indexOf(q) >= 0 || (g.definition || '').toLowerCase().indexOf(q) >= 0;
      }
      function rank(g) { var q = st.q.toLowerCase(), t = g.term.toLowerCase(); return !q ? 0 : t === q ? 0 : t.indexOf(q) === 0 ? 1 : t.indexOf(q) >= 0 ? 2 : (g.expansion || '').toLowerCase().indexOf(q) >= 0 ? 3 : 4; }
      function paint() {
        list.innerHTML = '';
        var hits = all.filter(match); if (st.q) hits.sort(function (a, b) { return rank(a) - rank(b); });
        if (!hits.length) { list.appendChild(h('div.empty', {}, h('h3', {}, 'No match'), h('p', {}, 'Try fewer letters, or search the whole guide with the Search button at the top.'))); return; }
        hits.slice(0, st.limit).forEach(function (g) {
          list.appendChild(h('article.gl-item', { id: 'g-' + g.term.replace(/[^\w]/g, '') },
            h('div.gl-head', {}, h('h3', {}, g.term), g.expansion ? h('span.gl-exp', {}, g.expansion) : null),
            h('p', {}, g.definition),
            h('div.row.tight', {}, g.cat ? CORB.ui.badge('neutral', g.cat) : null, g.cite ? h('span.cite', {}, g.cite) : null, h('span.grow'),
              CORB.ui.listenBtn(g.term + '. ' + (g.expansion ? g.expansion + '. ' : '') + g.definition))));
        });
        if (hits.length > st.limit) list.appendChild(h('button.btn.block.mt-3', { type: 'button', onclick: function () { st.limit += 120; paint(); } }, 'Show more (' + (hits.length - st.limit) + ' left)'));
      }
      input.addEventListener('input', CORB.util.debounce(function () { st.q = input.value.trim(); st.limit = 80; paint(); }, 120));
      paintFilters(); paint();
      if (!st.q) setTimeout(function () { if (window.innerWidth > 860) input.focus(); }, 50);
    } });
})();
