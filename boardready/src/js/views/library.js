/* VIEW: library — browse, filter, search and print the question bank.
   Layout: page head with study hand-offs, optional opened-question panel (?id=), a filter rail (domain;
   class, kind, status and quick toggles under a collapsed "More filters") beside a toolbar (search, sort,
   show/hide all answers), one count line that names the organization, active-filter pills, paged question
   cards, print sheet.
   Data: CORB.data.questions(filter) over CORB.DATA.questions. Renders empty states when the bank
   is missing or the organization filter leaves nothing. Never throws on partial data.
   Params: domain, topic, id, q, flag, classes, kind, status, sort, bookmarked, unseen, korea.
   Persists: progress.seen (opened question), progress.bookmarks via the shared card. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, util = CORB.util;

  var PAGE = 60;
  var KOREA_FLAG = 'korea-verify-cp';
  var KINDS = [['', 'All'], ['knowledge', 'Knowledge'], ['scenario', 'Scenario'], ['leadership', 'Leadership']];
  var STATUSES = [['', 'Any'], ['official', 'Official'], ['ai-draft', 'AI draft'], ['open', 'Open']];
  var SORTS = [['id', 'Sort by ID'], ['domain', 'Sort by domain'], ['class', 'Sort by class']];
  var CLASS_RANK = { I: 0, II: 1, III: 2, IV: 3 };

  var S = null;          // filter state for the current render
  var R = null;          // live DOM references for the current render
  var last = null;       // state kept for the session so returning to the library restores it
  var lastSig = null;    // signature of the params the current state was built from
  var timer = null;      // search debounce
  var unsub = [];        // CORB.on unsubscribers

  // ---------------------------------------------------------------- helpers
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function classesOf() { return (CORB.data && CORB.data.CLASSES) || ['I', 'II', 'III', 'IV']; }
  function domainsOf() { return (CORB.data && CORB.data.DOMAINS) || []; }
  function bank() { return safe(function () { return CORB.data.all() || []; }, []); }
  function classLabel(c) { return 'Class ' + c; }
  function labelIn(list, key) { for (var i = 0; i < list.length; i++) { if (list[i][0] === key) return list[i][1]; } return key; }
  function unitId() { return safe(function () { return CORB.unit(); }, 'all') || 'all'; }
  function unitLabel(id) {
    id = id || unitId();
    var name = safe(function () { return CORB.unitName(id); }, '');
    if (!name || name === id) return id === 'all' ? 'All organizations' : String(id);
    return name;
  }
  // the short organization name the top bar shows ("411th CSB · Korea")
  function unitShort(id) {
    var u = safe(function () { return (CORB.DATA.units || []).filter(function (x) { return x.id === id; })[0]; }, null);
    return (u && u.short) || unitLabel(id);
  }
  function counts(list, fn) {
    var c = {};
    list.forEach(function (q) { var keys = fn(q); (Array.isArray(keys) ? keys : [keys]).forEach(function (k) { if (k == null || k === '') return; c[k] = (c[k] || 0) + 1; }); });
    return c;
  }
  function hideByDefault() { return !!CORB.get('settings.hideAnswersDefault', false); }

  function fresh() {
    return { q: '', domain: '', topic: '', classes: [], allClasses: false, kind: '', status: '', flag: '', bookmarked: false, unseen: false, korea: false, sort: 'id', showAnswers: !hideByDefault(), answersTouched: false, shown: PAGE, focusId: '' };
  }
  function fromParams(p) {
    var s = fresh();
    if (last && last.answersTouched) { s.showAnswers = last.showAnswers; s.answersTouched = true; }
    if (p.domain) s.domain = String(p.domain);
    if (p.topic) s.topic = String(p.topic);
    if (p.q) s.q = String(p.q).trim();
    if (p.id) s.focusId = String(p.id).trim();
    if (p.kind && labelIn(KINDS, p.kind) !== p.kind) s.kind = String(p.kind);
    if (p.status && labelIn(STATUSES, p.status) !== p.status) s.status = String(p.status);
    if (p.sort && labelIn(SORTS, p.sort) !== p.sort) s.sort = String(p.sort);
    if (p.classes) { var ok = classesOf(); s.classes = String(p.classes).split(/[,+|\s]+/).filter(function (c) { return ok.indexOf(c) >= 0; }); }
    if (p.flag) { if (p.flag === KOREA_FLAG) s.korea = true; else s.flag = String(p.flag); }
    if (p.korea === '1' || p.korea === 'true') s.korea = true;
    if (p.bookmarked === '1' || p.bookmarked === 'true') s.bookmarked = true;
    if (p.unseen === '1' || p.unseen === 'true') s.unseen = true;
    return s;
  }

  // ------------------------------------------------------------ querying
  function filterFor(s, omit) {
    omit = omit || {};
    var f = {};
    if (s.q && !omit.q) f.q = s.q;
    if (s.domain && !omit.domain) f.domain = s.domain;
    if (s.topic && !omit.topic) f.topic = s.topic;
    if (s.kind && !omit.kind) f.kind = s.kind;
    if (s.status && !omit.status) f.status = s.status;
    // Class chips name classes outright. With no chip on, the list follows the profile's warrant class unless the reader
    // chose "Show all classes"; the chip counts themselves always count every class.
    if (s.classes.length && !omit.classes) f.classes = s.classes.slice();
    else if (s.allClasses || omit.classes) f.anyClass = true;
    if (s.bookmarked && !omit.bookmarked) f.bookmarked = true;
    if (s.unseen && !omit.unseen) f.unseen = true;
    return f;
  }
  function extraFlags(s, omit) { omit = omit || {}; var fl = []; if (s.korea && !omit.korea) fl.push(KOREA_FLAG); if (s.flag && !omit.flag) fl.push(s.flag); return fl; }
  function run(s, omit, ignoreUnit) {
    var f = filterFor(s, omit); if (ignoreUnit) f.ignoreUnit = true;
    var fl = extraFlags(s, omit);
    var list = safe(function () { return CORB.data.questions(f) || []; }, []);
    if (fl.length) list = list.filter(function (q) { var qf = arr(q.flags); return fl.every(function (x) { return qf.indexOf(x) >= 0; }); });
    return list;
  }
  function sortList(list, sort) {
    var out = list.slice();
    var di = {}; domainsOf().forEach(function (d, i) { di[d] = i; });
    function idc(a, b) { return String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true }); }
    function rank(q) { var r = 99; arr(q.classes).forEach(function (c) { var v = CLASS_RANK[c]; if (v != null && v < r) r = v; }); return r; }
    if (sort === 'domain') out.sort(function (a, b) { var x = di[a.domain] == null ? 99 : di[a.domain], y = di[b.domain] == null ? 99 : di[b.domain]; return (x - y) || String(a.topic || '').localeCompare(String(b.topic || '')) || idc(a, b); });
    else if (sort === 'class') out.sort(function (a, b) { return (rank(a) - rank(b)) || idc(a, b); });
    else out.sort(idc);
    return out;
  }
  function activeCount() {
    return (S.q ? 1 : 0) + (S.domain ? 1 : 0) + (S.topic ? 1 : 0) + S.classes.length + (S.kind ? 1 : 0) + (S.status ? 1 : 0) + (S.bookmarked ? 1 : 0) + (S.unseen ? 1 : 0) + (S.korea ? 1 : 0) + (S.flag ? 1 : 0);
  }
  // a filter under "More filters" is on, so that section starts open
  function moreActive() { return !!(S.classes.length || S.kind || S.status || S.bookmarked || S.unseen || S.korea || S.flag); }
  function studyParams() {
    var p = {};
    if (S.domain) p.domain = S.domain;
    if (S.topic) p.topic = S.topic;
    if (S.classes.length) p.classes = S.classes.join(',');
    else if (S.allClasses) p.classes = classesOf().join(',');
    if (S.q) p.q = S.q;
    if (S.kind) p.kind = S.kind;
    if (S.status) p.status = S.status;
    if (S.korea) p.flag = KOREA_FLAG; else if (S.flag) p.flag = S.flag;
    if (S.bookmarked) p.bookmarked = '1';
    if (S.unseen) p.unseen = '1';
    if (S.sort && S.sort !== 'id') p.sort = S.sort;
    return p;
  }
  function filterSummary() {
    var parts = [];
    if (S.q) parts.push('search "' + S.q + '"');
    if (S.domain) parts.push('domain ' + S.domain);
    if (S.topic) parts.push('topic ' + S.topic);
    if (S.classes.length) parts.push(S.classes.map(classLabel).join(', '));
    if (S.kind) parts.push(labelIn(KINDS, S.kind).toLowerCase() + ' questions');
    if (S.status) parts.push(labelIn(STATUSES, S.status).toLowerCase() + ' answers');
    if (S.bookmarked) parts.push('bookmarked');
    if (S.unseen) parts.push('unseen');
    if (S.korea) parts.push('Korea procedures');
    if (S.flag) parts.push('flag ' + S.flag);
    return parts.length ? parts.join(' · ') : 'none';
  }

  // ------------------------------------------------------- state changes
  function setState(patch) {
    Object.assign(S, patch || {});
    S.shown = PAGE;
    if (!R || !R.rail) return;
    drawRail(); drawTopics(); drawResults(); updateFilterBtn();
  }
  function setDomain(d) { S.domain = d; S.topic = ''; setState({}); }
  function toggleClass(c) { var i = S.classes.indexOf(c); if (i >= 0) S.classes.splice(i, 1); else S.classes.push(c); setState({}); }
  function reset() {
    var keep = { sort: S.sort, showAnswers: S.showAnswers, answersTouched: S.answersTouched, focusId: S.focusId };
    Object.assign(S, fresh(), keep);
    if (R && R.input) { R.input.value = ''; R.clear.hidden = true; }
    setState({});
  }
  function switchAll() {
    CORB.set('profile.unit', 'all');
    var sel = document.querySelector('.topbar .unit-select'); if (sel) { try { sel.value = 'all'; } catch (e) {} }
    ui.toast('Showing all organizations', 'ok');
    CORB.refresh();
  }
  function scrollToList() {
    if (!R || !R.bar) return;
    try { var top = R.bar.getBoundingClientRect().top + window.pageYOffset - 76; if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: 'smooth' }); } catch (e) {}
  }

  // ---------------------------------------------------- mobile filter sheet
  function railOpen() { return !!(R && R.rail && R.rail.classList.contains('open')); }
  function openRail() {
    if (!R || !R.rail) return;
    R.rail.classList.add('open');
    if (R.scrim) R.scrim.hidden = false;
    if (R.filterBtn) R.filterBtn.setAttribute('aria-expanded', 'true');
    var first = R.rail.querySelector('button, input'); if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
  }
  function closeRail(refocus) {
    if (!R || !R.rail) return;
    R.rail.classList.remove('open');
    if (R.scrim) R.scrim.hidden = true;
    if (R.filterBtn) { R.filterBtn.setAttribute('aria-expanded', 'false'); if (refocus !== false) { try { R.filterBtn.focus({ preventScroll: true }); } catch (e) {} } }
  }

  // ----------------------------------------------------------- rendering
  function emptyBank() {
    return h('div.empty.lib-empty.lib-empty-bank', {},
      icon('book'),
      h('h3', {}, 'The question bank is not loaded'),
      h('p', {}, 'This copy of the app carries no questions, so there is nothing to browse yet. Rebuild it with the question data, or open the original file you were given.'),
      h('button.btn.mt-4', { onclick: function () { CORB.go('dashboard'); } }, icon('arrow-left'), 'Back to the dashboard'));
  }
  function emptyPool(label) {
    return h('div.empty.lib-empty', {},
      icon('users'),
      h('h3', {}, 'No questions are tagged for ' + label + ' yet'),
      h('p', {}, 'The repository has questions from other organizations. Switch to all organizations to see every item, or pick a different organization in the top bar.'),
      h('button.btn.primary.mt-4', { onclick: switchAll }, 'Show all organizations', icon('arrow-right')));
  }
  function emptyResults(hiddenHere) {
    var scoped = classScoped();
    return h('div.empty.lib-empty', {},
      icon('search'),
      h('h3', {}, 'No questions match'),
      h('p', {}, S.q ? 'Try fewer words, a topic name, or a citation such as "FAR 6.103". Search covers the question, its answer, topic, tags and citations.' : 'Loosen a filter or two. The count beside each filter shows how many questions remain available.'),
      h('div.lib-empty-actions', {},
        h('button.btn.primary', { onclick: reset }, 'Clear all filters'),
        scoped ? h('button.btn', { onclick: function () { setState({ allClasses: true }); } }, 'Show all classes') : null,
        hiddenHere ? h('button.btn', { onclick: switchAll }, 'Show all organizations (' + hiddenHere + ' match)') : null));
  }
  // the warrant class the list follows when no class chip is on
  function warrantNow() { return safe(function () { return CORB.warrantClass(); }, '') || ''; }
  function classScoped() { return !!warrantNow() && !S.classes.length && !S.allClasses; }
  function scopeLabel(cls) {
    var ko = ['I', 'II', 'III', 'IV'], i = ko.indexOf(cls);
    if (i < 0) return cls + ' track';
    return i === 0 ? 'Class I' : i === 1 ? 'Class I and II' : 'Class I to ' + cls;
  }

  function header() {
    var head = h('div.page-head.lib-head', {},
      h('div.lib-head-copy', {},
        h('h1', {}, 'Question library'),
        h('p.lede', {}, 'Browse board questions, then study the ones you pick.')),
      h('div.lib-head-actions', {},
        R.flash = h('button.btn.primary', { onclick: function () { CORB.go('flashcards', studyParams()); } }, icon('cards'), 'Study these as flashcards'),
        R.quiz = h('button.btn', { onclick: function () { CORB.go('quiz', studyParams()); } }, icon('quiz'), 'Quiz me on these'),
        R.printBtn = h('button.btn.sm.ghost.lib-print-btn', { onclick: openPrint }, icon('print'), 'Print / PDF')));
    return head;
  }

  // The shared card as is: the domain badge names the area, and the topic stays searchable and filterable.
  function card(q, i, forceShow) {
    var c;
    try { c = ui.questionCard(q, { showAnswer: !!forceShow || S.showAnswers }); }
    catch (e) { c = h('article.qcard', { tabindex: '0' }, h('div.q-text', {}, String((q && (q.question || q.id)) || 'Question'))); }
    c.classList.add('lib-card');
    c.style.animationDelay = (Math.min(i, 12) * 28) + 'ms';
    return c;
  }

  function focusPanel() {
    var id = S.focusId;
    var q = safe(function () { return CORB.data.byId(id); }, null);
    var bar = h('div.lib-focus-bar', {},
      h('a.lib-back', { href: '#/library', onclick: function (e) { e.preventDefault(); S.focusId = ''; CORB.go('library'); } }, icon('arrow-left'), 'Back to the library'));
    var body;
    if (!q) {
      body = h('div.callout.warn', {}, icon('alert'), h('div', {}, h('b', {}, 'Question ' + id + ' is not in this copy of the repository'), 'It may have been removed by a facilitator, or the link may be out of date. The full library is below.'));
    } else {
      var outside = !safe(function () { return CORB.data.unitAllows(q); }, true);
      var idx = -1; R.results.some(function (x, i) { if (x.id === q.id) { idx = i; return true; } return false; });
      if (idx >= 0) {
        var prev = R.results[idx - 1], next = R.results[idx + 1];
        bar.appendChild(h('div.lib-focus-nav', {},
          h('span.muted.small.num', {}, (idx + 1) + ' / ' + R.results.length),
          h('button.btn.sm.ghost', { disabled: !prev, 'aria-label': 'Previous question in this view', onclick: function () { if (prev) CORB.go('library', Object.assign(studyParams(), { id: prev.id })); } }, icon('arrow-left'), h('span.num', {}, prev ? prev.id : '—')),
          h('button.btn.sm.ghost', { disabled: !next, 'aria-label': 'Next question in this view', onclick: function () { if (next) CORB.go('library', Object.assign(studyParams(), { id: next.id })); } }, h('span.num', {}, next ? next.id : '—'), icon('arrow-right'))));
      }
      body = h('div', {},
        outside ? h('div.callout.info.mb-3', {}, icon('info'), h('div', {}, h('b', {}, 'Outside your organization filter'), 'This question is tagged ' + (q.unit || 'for another organization') + '. It is shown because you opened it directly.')) : null,
        card(q, 0, true));
      try { CORB.set('progress.seen.' + q.id, util.today()); } catch (e) {}
    }
    return h('section.lib-focus', { 'aria-label': 'Opened question' }, bar, body);
  }

  function drawRail() {
    var rail = R.rail; if (!rail) return;
    rail.innerHTML = '';
    var active = activeCount();
    var bm = CORB.get('progress.bookmarks', {}) || {}, seen = CORB.get('progress.seen', {}) || {};

    // domains: canonical order, only those present in the organization pool, faceted counts
    var poolDom = counts(R.pool, function (q) { return q.domain; });
    var domBase = run(S, { domain: 1, topic: 1 });
    var domCounts = counts(domBase, function (q) { return q.domain; });
    var order = domainsOf().slice(); Object.keys(poolDom).forEach(function (d) { if (order.indexOf(d) < 0) order.push(d); });
    var domRows = [facet('All domains', domBase.length, !S.domain, false, function () { setDomain(''); })].concat(order.filter(function (d) { return poolDom[d]; }).map(function (d) {
      var n = domCounts[d] || 0, on = S.domain === d;
      return facet(d, n, on, !on && !n, function () { setDomain(on ? '' : d); });
    }));

    // classes
    var clsCounts = counts(run(S, { classes: 1 }), function (q) { return arr(q.classes); });
    var classChips = classesOf().map(function (c) {
      var on = S.classes.indexOf(c) >= 0, n = clsCounts[c] || 0;
      return h('button.chip' + (on ? '.on' : ''), { type: 'button', disabled: !on && !n, 'aria-pressed': on ? 'true' : 'false', onclick: function () { toggleClass(c); } }, classLabel(c), h('span.count', {}, String(n)));
    });

    // kind / status
    var kindCounts = counts(run(S, { kind: 1 }), function (q) { return q.kind; });
    var statusCounts = counts(run(S, { status: 1 }), function (q) { return q.answer_status; });
    function seg(label, list, key, cnt) {
      return h('div.seg.lib-seg', { role: 'group', 'aria-label': label }, list.map(function (it) {
        var on = S[key] === it[0]; var n = it[0] ? (cnt[it[0]] || 0) : null;
        return h('button' + (on ? '.on' : ''), { type: 'button', 'aria-pressed': on ? 'true' : 'false', disabled: !on && n === 0, title: n == null ? '' : n + ' available', onclick: function () { var o = {}; o[key] = it[0]; setState(o); } }, it[1]);
      }));
    }

    // quick toggles
    var bmCount = run(S, { bookmarked: 1 }).filter(function (q) { return bm[q.id]; }).length;
    var unseenCount = run(S, { unseen: 1 }).filter(function (q) { return !seen[q.id]; }).length;
    var koreaCount = run(S, { korea: 1 }).filter(function (q) { return arr(q.flags).indexOf(KOREA_FLAG) >= 0; }).length;
    function toggle(key, label, n, ic) {
      return h('label.switch.lib-toggle', {},
        h('input', { type: 'checkbox', checked: !!S[key], onchange: function (e) { var o = {}; o[key] = !!e.target.checked; setState(o); } }),
        h('span.name', {}, ic ? icon(ic) : null, label),
        h('span.count', {}, String(n)));
    }

    rail.appendChild(h('div.lib-rail-head', {},
      h('h2', {}, icon('filter'), 'Filters'),
      h('button.btn.sm.ghost', { hidden: !active, onclick: reset }, icon('refresh'), 'Reset'),
      h('button.btn.icon.sm.ghost.lib-rail-close', { type: 'button', 'aria-label': 'Close filters', onclick: function () { closeRail(); } }, icon('x'))));
    rail.appendChild(h('div.lib-group', {}, h('div.lib-group-title', {}, 'Domain'), h('div.lib-facets', {}, domRows)));
    // Domain stays in view; the rest waits under "More filters", which remembers whether the reader opened it.
    var more = h('details.acc.lib-more-filters', { open: R.moreOpen, ontoggle: function () { R.moreOpen = more.open; } },
      h('summary', {}, 'More filters', icon('chevron', 'chev')),
      h('div.acc-body', {},
        h('div.lib-group', {}, h('div.lib-group-title', {}, 'Warrant class'), h('div.chips', {}, classChips)),
        h('div.lib-group', {}, h('div.lib-group-title', {}, 'Kind'), seg('Kind', KINDS, 'kind', kindCounts)),
        h('div.lib-group', {}, h('div.lib-group-title', {}, 'Answer status'), seg('Answer status', STATUSES, 'status', statusCounts)),
        h('div.lib-group', {}, h('div.lib-group-title', {}, 'Quick filters'),
          toggle('bookmarked', 'Bookmarked', bmCount, 'bookmark'),
          toggle('unseen', 'Not yet opened', unseenCount, 'eye-off'),
          toggle('korea', 'Korea procedures', koreaCount, 'globe')),
        S.flag ? h('div.lib-group', {}, h('div.lib-group-title', {}, 'Flag'), h('div.chips', {}, h('button.chip.on', { type: 'button', 'aria-pressed': 'true', onclick: function () { setState({ flag: '' }); } }, S.flag, icon('x')))) : null));
    rail.appendChild(more);
    var n = run(S).length;
    rail.appendChild(h('div.lib-rail-foot', {}, h('button.btn.primary.block', { type: 'button', onclick: function () { closeRail(); scrollToList(); } }, n ? 'Show ' + util.plural(n, 'question') : 'Nothing matches — adjust filters')));

    function facet(name, n, on, disabled, fn) {
      return h('button.lib-facet' + (on ? '.on' : ''), { type: 'button', disabled: !!disabled, 'aria-pressed': on ? 'true' : 'false', onclick: fn }, h('span.name', {}, name), h('span.count', {}, String(n)));
    }
  }

  function drawTopics() {
    var box = R.topics; if (!box) return;
    box.innerHTML = '';
    if (!S.domain) { box.hidden = true; return; }
    var tc = counts(run(S, { topic: 1 }), function (q) { return q.topic; });
    var names = Object.keys(tc).sort(function (a, b) { return a.localeCompare(b); });
    if (S.topic && names.indexOf(S.topic) < 0) names.push(S.topic);
    if (names.length < 2) { box.hidden = true; return; }
    box.hidden = false;
    box.appendChild(h('span.lib-topics-lbl', {}, 'Topics'));
    box.appendChild(h('button.chip' + (!S.topic ? '.on' : ''), { type: 'button', 'aria-pressed': !S.topic ? 'true' : 'false', onclick: function () { setState({ topic: '' }); } }, 'All', h('span.count', {}, String(run(S, { topic: 1 }).length))));
    names.forEach(function (t) {
      var on = S.topic === t, n = tc[t] || 0;
      box.appendChild(h('button.chip' + (on ? '.on' : ''), { type: 'button', 'aria-pressed': on ? 'true' : 'false', disabled: !on && !n, onclick: function () { setState({ topic: on ? '' : t }); } }, t, h('span.count', {}, String(n))));
    });
  }

  function pills() {
    var wrap = h('div.lib-pills');
    function pill(k, v, fn) { wrap.appendChild(h('button.lib-pill', { type: 'button', 'aria-label': 'Remove filter: ' + (k ? k + ' ' : '') + v, onclick: fn }, k ? h('span.k', {}, k) : null, h('span.v', {}, v), icon('x'))); }
    if (S.q) pill('Search', '“' + S.q + '”', function () { S.q = ''; if (R.input) { R.input.value = ''; R.clear.hidden = true; } setState({}); });
    if (S.domain) pill('Domain', S.domain, function () { setDomain(''); });
    if (S.topic) pill('Topic', S.topic, function () { setState({ topic: '' }); });
    S.classes.slice().forEach(function (c) { pill('', classLabel(c), function () { toggleClass(c); }); });
    if (S.kind) pill('Kind', labelIn(KINDS, S.kind), function () { setState({ kind: '' }); });
    if (S.status) pill('Status', labelIn(STATUSES, S.status), function () { setState({ status: '' }); });
    if (S.bookmarked) pill('', 'Bookmarked', function () { setState({ bookmarked: false }); });
    if (S.unseen) pill('', 'Not yet opened', function () { setState({ unseen: false }); });
    if (S.korea) pill('', 'Korea procedures', function () { setState({ korea: false }); });
    if (S.flag) pill('Flag', S.flag, function () { setState({ flag: '' }); });
    wrap.appendChild(h('button.lib-clear-all', { type: 'button', onclick: reset }, 'Clear all'));
    return wrap;
  }

  function drawResults() {
    if (!R || !R.list) return;
    var res = R.results = sortList(run(S), S.sort);
    var any = activeCount() > 0;
    var hiddenHere = unitId() === 'all' ? 0 : Math.max(0, run(S, {}, true).length - res.length);

    // One line: the count, the organization it covers, and quiet links to widen the set.
    var st = R.status; st.innerHTML = '';
    var cls = warrantNow(), scoped = classScoped(), unit = unitId();
    var line = h('div.lib-count', {},
      h('b', {}, String(res.length)),
      h('span', {}, (res.length === 1 ? 'question' : 'questions') + (any ? ' match' : '') + (scoped ? ' for ' + scopeLabel(cls) : '')));
    function part(node) { line.appendChild(h('span.lib-count-part', {}, h('span.lib-count-sep', { 'aria-hidden': 'true' }, '·'), node)); }
    if (unit !== 'all') part(h('span', {}, unitShort(unit)));
    if (hiddenHere) part(h('button.lib-count-link', { type: 'button', onclick: switchAll }, 'Show all organizations'));
    if (cls && !S.classes.length) part(h('button.lib-count-link', { type: 'button', onclick: function () { setState({ allClasses: !S.allClasses }); } }, S.allClasses ? 'Only ' + scopeLabel(cls) : 'Show all classes'));
    st.appendChild(line);
    if (any) st.appendChild(pills());

    var none = !res.length;
    if (R.flash) R.flash.disabled = none;
    if (R.quiz) R.quiz.disabled = none;
    if (R.printBtn) R.printBtn.disabled = none;

    R.list.innerHTML = '';
    R.more.innerHTML = '';
    if (none) { R.list.appendChild(emptyResults(hiddenHere)); return; }
    appendCards(0, Math.min(S.shown, res.length));
    drawMore();
  }
  function appendCards(from, to) {
    var frag = document.createDocumentFragment();
    for (var i = from; i < to; i++) frag.appendChild(card(R.results[i], i - from));
    R.list.appendChild(frag);
  }
  function drawMore() {
    R.more.innerHTML = '';
    var res = R.results, shown = Math.min(S.shown, res.length), remaining = res.length - shown;
    if (remaining > 0) {
      R.more.appendChild(h('button.btn.lg.lib-more-btn', { onclick: function () {
        var from = shown; S.shown = Math.min(res.length, S.shown + PAGE);
        appendCards(from, S.shown); drawMore();
        var first = R.list.children[from]; if (first && first.focus) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
      } }, icon('chevron'), 'Show ' + Math.min(PAGE, remaining) + ' more'));
      R.more.appendChild(h('span.muted.small.num', {}, shown + ' of ' + res.length + ' shown'));
    } else if (res.length > PAGE) {
      R.more.appendChild(h('span.muted.small', {}, 'All ' + res.length + ' shown'));
    }
  }
  function updateFilterBtn() {
    if (!R || !R.filterCount) return;
    var n = activeCount();
    R.filterCount.textContent = n ? String(n) : '';
    R.filterCount.hidden = !n;
  }
  function paintAnswersBtn() {
    var b = R.ansBtn; if (!b) return;
    b.innerHTML = '';
    b.appendChild(icon(S.showAnswers ? 'eye-off' : 'eye'));
    b.appendChild(h('span', {}, S.showAnswers ? 'Hide all answers' : 'Show all answers'));
    b.setAttribute('aria-pressed', S.showAnswers ? 'true' : 'false');
  }

  // --------------------------------------------------------------- search
  function applySearch(v) {
    var t = String(v || '').trim();
    if (t === S.q) return;
    S.q = t; setState({});
  }
  function onInput(e) {
    var v = e.target.value;
    if (R && R.clear) R.clear.hidden = !v;
    clearTimeout(timer);
    timer = setTimeout(function () { timer = null; applySearch(v); }, 180);
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.target.value = ''; clearTimeout(timer); timer = null; if (R && R.clear) R.clear.hidden = true; applySearch(''); }
    if (e.key === 'Enter') { clearTimeout(timer); timer = null; applySearch(e.target.value); }
  }

  // ---------------------------------------------------------------- print
  function openPrint() {
    var res = (R && R.results) || [];
    if (!res.length) { ui.toast('Nothing to print — no questions match', 'warn'); return; }
    var opts = { answers: true, notes: false };
    var body = h('div.stack', {},
      h('p', {}, 'Prints the ' + util.plural(res.length, 'question') + ' currently in view, in the current order, each with its verification status. Choose "Save as PDF" in the print dialog to keep a copy.'),
      h('label.switch', {}, h('input', { type: 'checkbox', checked: true, onchange: function (e) { opts.answers = !!e.target.checked; } }), 'Include answers, key points and citations'),
      h('label.switch', {}, h('input', { type: 'checkbox', checked: false, onchange: function (e) { opts.notes = !!e.target.checked; } }), 'Include my notes'),
      res.length > 150 ? h('div.callout.warn', {}, icon('alert'), h('div', {}, h('b', {}, 'Long document'), 'That is a lot of pages. Narrow the set with a domain or class filter for a shorter study sheet.')) : null,
      h('p.small.muted', {}, 'Filters: ' + filterSummary()));
    ui.modal({ title: 'Print or save as PDF', body: body, actions: [
      { label: 'Cancel' },
      { label: 'Print', primary: true, onClick: function () { buildPrint(opts); setTimeout(function () { try { window.print(); } catch (e) { ui.toast('Printing is not available in this browser', 'warn'); } }, 80); } }
    ] });
  }
  function buildPrint(opts) {
    if (!R || !R.print) return;
    opts = opts || R.printOpts || { answers: true, notes: false };
    R.printOpts = opts;
    var res = R.results || []; var meta = CORB.DATA.meta || {};
    var box = R.print; box.innerHTML = '';
    box.appendChild(h('div.lib-print-head', {},
      h('div.lib-print-kicker', {}, (meta.app_name || 'Signatory') + ' · Question library'),
      h('h1', {}, 'Question library'),
      h('div.lib-print-sub', {}, unitLabel() + ' · ' + util.plural(res.length, 'question') + ' · ' + (opts.answers ? 'with answers' : 'questions only') + ' · printed ' + util.fmtDate(new Date().toISOString())),
      h('div.lib-print-sub', {}, 'Filters: ' + filterSummary()),
      meta.disclaimer ? h('div.lib-print-disc', {}, meta.disclaimer) : null));
    var frag = document.createDocumentFragment();
    res.forEach(function (q, i) {
      var cls = arr(q.classes).map(classLabel).join(', ');
      var flags = safe(function () { return ui.flagsFor(q).map(function (f) { return ui.badge(f).textContent; }).join(' · '); }, '');
      var cites = arr(q.citations_rfo).length ? arr(q.citations_rfo) : arr(q.citations);
      var cw = arr(q.rfo && q.rfo.crosswalk);
      var kp = arr(q.key_points), mine = String(CORB.get('progress.notes.' + q.id, '') || '').trim();
      var item = h('article.lib-print-item', {},
        h('div.lib-print-meta', {}, [q.id, q.domain, q.topic, cls, q.unit && q.unit !== 'ACC-All' ? q.unit : ''].filter(Boolean).join(' · ')),
        h('div.lib-print-q', {}, h('span.n', {}, (i + 1) + '.'), ' ', q.question || ''),
        flags ? h('div.lib-print-flags', {}, flags) : null);
      if (opts.answers) {
        if (q.answer_status !== 'open' && q.answer) item.appendChild(h('div.lib-print-a', {}, ui.rich(q.answer)));
        else item.appendChild(h('div.lib-print-a.lib-print-open', {}, 'No formal answer in the repository. Write your own and check it with a mentor.'));
        if (kp.length) item.appendChild(h('ul.lib-print-kp', {}, kp.map(function (k) { return h('li', {}, String(k == null ? '' : k)); })));
        if (cites.length) item.appendChild(h('div.lib-print-cite', {}, 'Cite: ' + cites.join('; ')));
        if (cw.length) item.appendChild(h('div.lib-print-cite', {}, 'RFO crosswalk: ' + cw.map(function (c) { c = c || {}; return (c.old || '?') + ' → ' + (c.new || '?'); }).join(' · ')));
      }
      if (opts.notes && mine) item.appendChild(h('div.lib-print-notes', {}, h('div.lib-print-note', {}, h('div.lib-print-note-src', {}, 'My notes'), h('p', { style: { whiteSpace: 'pre-line' } }, mine))));
      frag.appendChild(item);
    });
    box.appendChild(frag);
    box.appendChild(h('div.lib-print-foot', {}, 'Training aid, not authoritative guidance. Verify every citation, threshold and local procedure against acquisition.gov, the Army Warranting Program Policy and your Contracting & Policy office before relying on it.'));
  }

  // ---------------------------------------------------------------- build
  function build(root) {
    var app = h('div.lib-app'); root.appendChild(app);
    R.print = h('div.lib-print', { 'aria-hidden': 'true' }); root.appendChild(R.print);

    var all = bank();
    if (!all.length) { app.appendChild(emptyBank()); return; }
    R.pool = safe(function () { return CORB.data.questions({ anyClass: true }) || []; }, []);   // the organization set, every class

    app.appendChild(header());
    R.results = sortList(run(S), S.sort);
    R.moreOpen = moreActive();
    if (S.focusId) app.appendChild(focusPanel());
    if (!R.pool.length) { app.appendChild(emptyPool(unitLabel())); return; }

    R.scrim = h('div.lib-rail-scrim', { hidden: true, onclick: function () { closeRail(); } });
    R.rail = h('aside.lib-rail#lib-rail', { 'aria-label': 'Filters', onkeydown: function (e) { if (e.key === 'Escape' && railOpen()) { e.stopPropagation(); closeRail(); } } });
    R.input = h('input.input', { type: 'search', value: S.q, placeholder: 'Search questions, answers, topics, citations…', 'aria-label': 'Search questions', autocomplete: 'off', spellcheck: 'false', oninput: onInput, onkeydown: onKey });
    R.clear = h('button.lib-clear', { type: 'button', 'aria-label': 'Clear search', hidden: !S.q, onclick: function () { R.input.value = ''; R.clear.hidden = true; clearTimeout(timer); timer = null; applySearch(''); R.input.focus(); } }, icon('x'));
    R.ansBtn = h('button.btn.lib-answers', { type: 'button', onclick: function () { S.showAnswers = !S.showAnswers; S.answersTouched = true; paintAnswersBtn(); drawResults(); } });
    paintAnswersBtn();
    R.filterCount = h('span.lib-filter-count', { hidden: true });
    R.filterBtn = h('button.btn.lib-filter-btn', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'lib-rail', onclick: function () { if (railOpen()) closeRail(); else openRail(); } }, icon('filter'), h('span', {}, 'Filters'), R.filterCount);
    R.bar = h('div.lib-bar', {},
      h('div.lib-search', {}, h('div.search', {}, icon('search'), R.input), R.clear),
      R.filterBtn,
      h('select.select.lib-sort', { 'aria-label': 'Sort order', onchange: function (e) { S.sort = e.target.value; S.shown = PAGE; drawResults(); } }, SORTS.map(function (s) { return h('option', { value: s[0], selected: S.sort === s[0] }, s[1]); })),
      R.ansBtn);
    R.topics = h('div.lib-topics', { hidden: true });
    R.status = h('div.lib-status', { 'aria-live': 'polite' });
    R.list = h('div.lib-list');
    R.more = h('div.lib-more');
    app.appendChild(h('div.lib-grid', {}, R.scrim, R.rail, h('div.lib-main', {}, R.bar, R.topics, R.status, R.list, R.more)));

    drawRail(); drawTopics(); drawResults(); updateFilterBtn();

    unsub.push(CORB.on('change', function (e) {
      if (!R || !R.rail || !e || !e.path) return;
      if (/^progress\.(bookmarks|seen)/.test(e.path)) drawRail();
    }));
    R.onBefore = function () { try { buildPrint(); } catch (e) {} };
    window.addEventListener('beforeprint', R.onBefore);
  }

  function leave() {
    clearTimeout(timer); timer = null;
    unsub.forEach(function (u) { try { u(); } catch (e) {} }); unsub = [];
    if (R && R.onBefore) { try { window.removeEventListener('beforeprint', R.onBefore); } catch (e) {} }
    last = S; R = null;
  }

  CORB.registerView({
    id: 'library', title: 'Question library', icon: 'book', section: 'Prepare', order: 30, nav: true, mobile: true, short: 'Library',
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || {};
      var sig = JSON.stringify(p);
      var hasParams = Object.keys(p).length > 0;
      if (last && sig === lastSig) S = last;
      else if (hasParams) S = fromParams(p);
      else if (last) { S = last; S.focusId = ''; }
      else S = fresh();
      S.shown = PAGE;
      if (!p.id) S.focusId = '';
      if (!S.answersTouched) S.showAnswers = !hideByDefault();
      lastSig = sig; last = S;
      R = {};
      build(root);
    },
    onLeave: leave
  });
})();
