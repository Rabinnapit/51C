/* VIEW: glossary — the acronym and term reference for the board.
   Layout: page head with "Study 10 at random", toolbar (search + topic drop-down), a sticky A–Z jump bar,
   then the terms grouped by first letter in two columns on desktop. Each entry carries the term,
   its expansion, the definition, and one foot line with its citations (linked through CORB.data.citeUrl
   when the citation resolves) and a hand-off to the question library filtered on that term.
   "Random 10 terms" turns the list into a flashcard-lite deck (reveal, next, previous, keyboard).
   Data: CORB.DATA.glossary — [{term, expansion, definition, domain, cite}]. Renders an empty
   state when the module is missing or empty, and tolerates partially shaped rows.
   Params: q (prefills the search box), domain.
   Persists: nothing. The view is read-only and works with storage disabled. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, util = CORB.util;

  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var DECK_N = 10;

  var S = null;      // view state for the current render
  var R = null;      // live DOM references for the current render
  var last = null;   // kept for the session so returning to the glossary restores the search
  var lastSig = null;
  var timer = null;  // search debounce
  var keyHandler = null;

  // ---------------------------------------------------------------- helpers
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return v == null ? '' : String(v); }

  function allTerms() {
    var raw = arr(safe(function () { return CORB.DATA && CORB.DATA.glossary; }, []));
    var out = [];
    raw.forEach(function (t, i) {
      if (!t || typeof t !== 'object') return;
      var term = str(t.term).trim(), expansion = str(t.expansion).trim(), def = str(t.definition).trim();
      if (!term && !expansion && !def) return;
      out.push({
        i: i,
        term: term || expansion || 'Term ' + (i + 1),
        expansion: expansion,
        definition: def,
        domain: str(t.domain).trim(),
        cites: splitCites(t.cite),
        hay: (term + ' ' + expansion + ' ' + def + ' ' + str(t.domain)).toLowerCase()
      });
    });
    out.sort(function (a, b) { return a.term.localeCompare(b.term, undefined, { sensitivity: 'base', numeric: true }); });
    return out;
  }
  function splitCites(cite) {
    return str(cite).split(/\s*;\s*/).map(function (c) { return c.trim(); }).filter(Boolean);
  }
  function letterOf(t) {
    var m = /[A-Za-z]/.exec(t.term.charAt(0)) ? t.term.charAt(0).toUpperCase() : null;
    return m || '#';
  }
  function countBy(list, fn) {
    var c = {};
    list.forEach(function (x) { var k = fn(x); if (k) c[k] = (c[k] || 0) + 1; });
    return c;
  }
  function fresh() { return { q: '', domain: '', deck: null, di: 0, revealed: false }; }
  function fromParams(p) {
    var s = fresh();
    if (p.q) s.q = str(p.q).trim();
    if (p.domain) s.domain = str(p.domain);
    return s;
  }

  function matches(list) {
    var q = S.q.toLowerCase();
    return list.filter(function (t) {
      if (S.domain && t.domain !== S.domain) return false;
      if (q && t.hay.indexOf(q) < 0) return false;
      return true;
    });
  }

  // ------------------------------------------------------------- structure
  function header() {
    return h('div.page-head.gl-head', {},
      h('div.gl-head-copy', {},
        h('h1', {}, 'Glossary'),
        h('p.lede', {}, 'Acronyms and terms the board uses, spelled out, with the citation.')),
      h('div.gl-head-actions', {},
        R.deckBtn = h('button.btn.ghost', { type: 'button', onclick: startDeck }, icon('shuffle'), 'Study ' + DECK_N + ' at random')));
  }

  function emptyModule() {
    return h('div.empty.gl-empty', {},
      icon('glossary'),
      h('h3', {}, 'The glossary is not loaded in this copy'),
      h('p', {}, 'This build carries no glossary data, so there are no terms to look up yet. Rebuild the app with the glossary module, or open the original file you were given. The question library and the regulation explorer still work.'),
      h('div.gl-empty-actions', {},
        h('button.btn.primary', { type: 'button', onclick: function () { CORB.go('library'); } }, icon('book'), 'Go to the question library'),
        h('button.btn', { type: 'button', onclick: function () { CORB.go('regulations'); } }, icon('scale'), 'Regulation explorer')));
  }

  function emptyResults() {
    return h('div.empty.gl-empty', {},
      icon('search'),
      h('h3', {}, 'No term matches'),
      h('p', {}, S.q
        ? 'Nothing in the glossary contains “' + S.q + '”. Try the acronym on its own (LCS, SAT, J&A), part of the spelled-out name, or a word from the definition.'
        : 'That domain has no terms in this build. Pick another domain, or show every term.'),
      h('div.gl-empty-actions', {},
        h('button.btn.primary', { type: 'button', onclick: resetFilters }, 'Show every term'),
        S.q ? h('button.btn', { type: 'button', onclick: function () { CORB.go('library', { q: S.q }); } }, 'Search the question bank for “' + S.q + '”', icon('arrow-right')) : null));
  }

  // -------------------------------------------------------------- toolbar
  function toolbar(list) {
    R.input = h('input.input', {
      type: 'search', value: S.q, placeholder: 'Search a term, its expansion or its definition…',
      'aria-label': 'Search the glossary', autocomplete: 'off', spellcheck: 'false',
      oninput: onInput, onkeydown: onSearchKey
    });
    R.clear = h('button.gl-clear', {
      type: 'button', 'aria-label': 'Clear search', hidden: !S.q,
      onclick: function () { R.input.value = ''; R.clear.hidden = true; clearTimeout(timer); timer = null; applySearch(''); R.input.focus(); }
    }, icon('x'));

    R.domains = h('select.select.gl-domain-select', { 'aria-label': 'Topic', onchange: function (e) { setState({ domain: e.target.value }); } });
    drawDomains(list);

    return h('div.gl-toolbar', {},
      h('div.gl-search', {}, h('div.search', {}, icon('search'), R.input), R.clear),
      R.domains);
  }
  function drawDomains(list) {
    var box = R.domains; if (!box) return;
    box.innerHTML = '';
    var counts = countBy(list, function (t) { return t.domain; });
    var canon = arr(safe(function () { return CORB.data && CORB.data.DOMAINS; }, []));
    var order = canon.filter(function (d) { return counts[d]; });
    Object.keys(counts).sort().forEach(function (d) { if (order.indexOf(d) < 0) order.push(d); });
    if (!order.length) { box.hidden = true; return; }
    box.hidden = false;
    box.appendChild(h('option', { value: '', selected: !S.domain }, 'All topics (' + list.length + ')'));
    order.forEach(function (d) {
      box.appendChild(h('option', { value: d, selected: S.domain === d }, d + ' (' + (counts[d] || 0) + ')'));
    });
  }

  function jumpBar() {
    R.jump = h('nav.gl-jump', { 'aria-label': 'Jump to a letter' });
    return R.jump;
  }
  function drawJump(present) {
    var bar = R.jump; if (!bar) return;
    bar.innerHTML = '';
    var keys = (present['#'] ? ['#'] : []).concat(LETTERS);
    keys.forEach(function (L) {
      var n = present[L] || 0;
      bar.appendChild(h('button.gl-jump-btn' + (n ? '' : '.off'), {
        type: 'button', disabled: !n, 'aria-label': n ? (L === '#' ? 'Numbers and symbols' : 'Letter ' + L) + ' · ' + util.plural(n, 'term') : L + ' — no terms',
        onclick: function () { scrollToLetter(L); }
      }, L));
    });
  }
  function scrollToLetter(L) {
    var el = R.list && R.list.querySelector('[data-letter="' + (L === '#' ? 'num' : L) + '"]');
    if (!el) return;
    try {
      var top = el.getBoundingClientRect().top + window.pageYOffset - 150;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } catch (e) { try { el.scrollIntoView(); } catch (e2) {} }
    var head = el.querySelector('.gl-letter-mark');
    if (head) { head.classList.remove('flash'); void head.offsetWidth; head.classList.add('flash'); }
  }

  // ----------------------------------------------------------- term cards
  function citeChips(t) {
    if (!t.cites.length) return null;
    return h('div.gl-cites', {}, t.cites.map(function (c) {
      var url = safe(function () { return CORB.data && CORB.data.citeUrl ? CORB.data.citeUrl(c) : null; }, null);
      return url
        ? h('a.cite.gl-cite', { href: url, target: '_blank', rel: 'noopener', title: 'Open ' + c + ' on acquisition.gov' }, c, icon('external'))
        : h('span.cite.gl-cite', { title: c }, c);
    }));
  }
  function termCard(t, i) {
    var card = h('article.gl-term', { id: 'gl-t' + t.i, tabindex: '0' },
      h('div.gl-term-head', {},
        h('h3.gl-term-name', {}, t.term)),
      t.expansion && t.expansion.toLowerCase() !== t.term.toLowerCase() ? h('div.gl-term-exp', {}, t.expansion) : null,
      t.definition ? h('p.gl-term-def', {}, t.definition) : h('p.gl-term-def.gl-term-nodef', {}, 'No definition is recorded for this term in this build.'),
      h('div.gl-term-foot', {},
        citeChips(t),
        h('button.gl-related', { type: 'button', onclick: function () { CORB.go('library', { q: t.term }); } },
          'Related questions', icon('arrow-right'))));
    card.style.animationDelay = (Math.min(i, 14) * 22) + 'ms';
    return card;
  }

  function drawList() {
    if (!R || !R.list) return;
    var list = matches(R.all);
    var present = {};
    list.forEach(function (t) { var L = letterOf(t); present[L] = (present[L] || 0) + 1; });
    drawJump(present);

    if (R.count) {
      R.count.innerHTML = '';
      R.count.appendChild(h('b', {}, String(list.length)));
      R.count.appendChild(h('span', {}, list.length === 1 ? 'term' : 'terms'));
      if (S.domain) R.count.appendChild(h('span.gl-count-sub', {}, 'in ' + S.domain));
      else if (S.q) R.count.appendChild(h('span.gl-count-sub', {}, 'matching “' + S.q + '”'));
      if (S.q || S.domain) R.count.appendChild(h('button.gl-clear-all', { type: 'button', onclick: resetFilters }, 'Clear'));
    }

    R.list.innerHTML = '';
    if (!list.length) { R.list.appendChild(emptyResults()); return; }

    var groups = {}, order = [];
    list.forEach(function (t) { var L = letterOf(t); if (!groups[L]) { groups[L] = []; order.push(L); } groups[L].push(t); });
    order.sort(function (a, b) { if (a === '#') return -1; if (b === '#') return 1; return a < b ? -1 : a > b ? 1 : 0; });

    var frag = document.createDocumentFragment();
    var n = 0;
    order.forEach(function (L) {
      var sec = h('section.gl-letter', { 'data-letter': L === '#' ? 'num' : L, 'aria-label': (L === '#' ? 'Numbers and symbols' : 'Letter ' + L) },
        h('div.gl-letter-head', {},
          h('span.gl-letter-mark', {}, L),
          h('button.gl-letter-top', { type: 'button', 'aria-label': 'Back to the top of the glossary', onclick: function () { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } } }, icon('chevron'), 'Top')),
        h('div.gl-letter-grid', {}, groups[L].map(function (t) { return termCard(t, n++); })));
      frag.appendChild(sec);
    });
    R.list.appendChild(frag);
  }

  // ---------------------------------------------------- flashcard-lite deck
  function startDeck() {
    var pool = matches(R.all);
    if (pool.length < 3) pool = R.all;
    if (!pool.length) { ui.toast('No terms to study yet', 'warn'); return; }
    S.deck = util.shuffle(pool).slice(0, Math.min(DECK_N, pool.length));
    S.di = 0; S.revealed = false;
    drawBody();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
  }
  function endDeck() {
    S.deck = null; S.di = 0; S.revealed = false;
    drawBody();
    if (R && R.deckBtn) { try { R.deckBtn.focus({ preventScroll: true }); } catch (e) {} }
  }
  function deckStep(n) {
    if (!S.deck) return;
    var next = S.di + n;
    if (next < 0 || next >= S.deck.length) return;
    S.di = next; S.revealed = false;
    drawDeck();
  }
  function deckReveal() { if (!S.deck) return; S.revealed = !S.revealed; drawDeck(); }

  function drawDeck() {
    var box = R.deck; if (!box || !S.deck) return;
    box.innerHTML = '';
    var t = S.deck[S.di], n = S.deck.length;
    var pct = util.pct(S.di + (S.revealed ? 1 : 0), n);

    box.appendChild(h('div.gl-deck-bar', {},
      h('span.eyebrow', {}, 'Flashcard-lite'),
      h('span.gl-deck-pos.num', {}, (S.di + 1) + ' / ' + n),
      h('div.bar.gl-deck-progress', { 'aria-hidden': 'true' }, h('span', { style: { width: pct + '%' } })),
      h('button.btn.sm.ghost', { type: 'button', onclick: startDeck }, icon('shuffle'), 'New ten'),
      h('button.btn.sm', { type: 'button', onclick: endDeck }, icon('x'), 'Back to the list')));

    var face = h('div.gl-card-face', {},
      t.domain ? h('span.badge.neutral', {}, t.domain) : null,
      h('div.gl-card-term', {}, t.term),
      S.revealed
        ? h('div.gl-card-back', {},
            t.expansion ? h('div.gl-card-exp', {}, t.expansion) : null,
            h('p.gl-card-def', {}, t.definition || 'No definition is recorded for this term.'),
            citeChips(t))
        : h('div.gl-card-prompt', {}, h('p', {}, 'Say the expansion and one sentence of definition out loud, the way you would to a board member. Then reveal.'),
            h('button.btn.primary.lg', { type: 'button', onclick: deckReveal }, icon('eye'), 'Reveal the answer')));
    box.appendChild(h('div.gl-card', { tabindex: '-1' }, face));

    box.appendChild(h('div.gl-deck-nav', {},
      h('button.btn', { type: 'button', disabled: S.di === 0, onclick: function () { deckStep(-1); } }, icon('arrow-left'), 'Previous'),
      S.revealed ? h('button.btn.ghost', { type: 'button', onclick: deckReveal }, icon('eye-off'), 'Hide') : null,
      CORB.speech && CORB.speech.available ? h('button.btn.ghost', { type: 'button', 'data-tip': 'Read aloud', onclick: function () { safe(function () { return CORB.speech.speak(t.term + '. ' + (S.revealed ? (t.expansion ? t.expansion + '. ' : '') + t.definition : '')); }, null); } }, icon('volume'), 'Read aloud') : null,
      h('button.btn.ghost', { type: 'button', onclick: function () { CORB.go('library', { q: t.term }); } }, icon('book'), 'Questions on this'),
      S.di < n - 1
        ? h('button.btn.primary', { type: 'button', onclick: function () { deckStep(1); } }, 'Next term', icon('arrow-right'))
        : h('button.btn.primary', { type: 'button', onclick: startDeck }, icon('refresh'), 'Another ten')));

    box.appendChild(h('div.gl-deck-hint.muted.small', {}, 'Keyboard: ', h('kbd', {}, 'Space'), ' reveal · ', h('kbd', {}, '←'), ' ', h('kbd', {}, '→'), ' move · ', h('kbd', {}, 'Esc'), ' back to the list'));

    var card = box.querySelector('.gl-card');
    if (card) { try { card.focus({ preventScroll: true }); } catch (e) {} }
  }

  function drawBody() {
    if (!R || !R.body) return;
    R.body.innerHTML = '';
    if (S.deck) {
      R.deck = h('section.gl-deck', { 'aria-label': 'Random term flashcards' });
      R.body.appendChild(R.deck);
      R.list = null; R.count = null; R.jump = null;
      drawDeck();
      return;
    }
    R.deck = null;
    R.count = h('div.gl-count', { 'aria-live': 'polite' });
    R.jump = jumpBar();
    R.list = h('div.gl-list');
    R.body.appendChild(h('div.gl-sticky', {}, R.jump, R.count));
    R.body.appendChild(R.list);
    drawList();
  }

  // -------------------------------------------------------- state + search
  function setState(patch) {
    Object.assign(S, patch || {});
    if (!R) return;
    // searching or picking a domain while a deck is open returns you to the list
    if (S.deck) { S.deck = null; S.di = 0; S.revealed = false; }
    if (!R.list) drawBody(); else { drawDomains(R.all); drawList(); }
  }
  function resetFilters() {
    S.q = ''; S.domain = '';
    if (R && R.input) { R.input.value = ''; if (R.clear) R.clear.hidden = true; }
    setState({});
  }
  function applySearch(v) {
    var t = str(v).trim();
    if (t === S.q) return;
    S.q = t;
    setState({});
  }
  function onInput(e) {
    var v = e.target.value;
    if (R && R.clear) R.clear.hidden = !v;
    clearTimeout(timer);
    timer = setTimeout(function () { timer = null; applySearch(v); }, 160);
  }
  function onSearchKey(e) {
    if (e.key === 'Escape') { e.target.value = ''; clearTimeout(timer); timer = null; if (R && R.clear) R.clear.hidden = true; applySearch(''); }
    if (e.key === 'Enter') { clearTimeout(timer); timer = null; applySearch(e.target.value); }
  }

  // ---------------------------------------------------------------- build
  function build(root) {
    var app = h('div.gl-app'); root.appendChild(app);
    R.all = allTerms();
    if (!R.all.length) { app.appendChild(emptyModule()); return; }

    app.appendChild(header());
    app.appendChild(toolbar(R.all));
    R.body = h('div.gl-body');
    app.appendChild(R.body);
    drawBody();

    keyHandler = function (e) {
      if (!S || !S.deck) return;
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); deckStep(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); deckStep(-1); }
      else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); deckReveal(); }
      else if (e.key === 'Escape') { endDeck(); }
    };
    document.addEventListener('keydown', keyHandler);
  }

  function leave() {
    clearTimeout(timer); timer = null;
    if (keyHandler) { try { document.removeEventListener('keydown', keyHandler); } catch (e) {} keyHandler = null; }
    safe(function () { if (CORB.speech && CORB.speech.stop) CORB.speech.stop(); }, null);
    if (S) { S.deck = null; S.di = 0; S.revealed = false; }
    last = S; R = null;
  }

  CORB.registerView({
    id: 'glossary', title: 'Glossary', icon: 'glossary', section: 'Reference', order: 310, nav: true, short: 'Terms',
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || {};
      var sig = JSON.stringify(p);
      var hasParams = Object.keys(p).length > 0;
      if (last && sig === lastSig) S = last;
      else if (hasParams) S = fromParams(p);
      else if (last) { S = last; S.deck = null; }
      else S = fresh();
      S.deck = null; S.di = 0; S.revealed = false;
      lastSig = sig; last = S;
      R = {};
      build(root);
    },
    onLeave: leave
  });
})();
