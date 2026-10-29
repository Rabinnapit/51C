/* VIEW: scenarios — the two ways a board tests judgment instead of recall.
   Tab 1 "Board scenarios": every kind === 'scenario' question in the bank (CORB.data.questions
   ({kind:'scenario'})), filterable by domain / Korea / practised, opened as a focused drill:
   the situation, a two-minute clock, a "Your answer" textarea persisted to progress.notes.<id>,
   "Reveal model answer" (CORB.ui.rich + key points + cites), then a 1-5
   self-rating written through CORB.scoring.srs.grade.
   Tab 2 "You're the KO": branching cases from CORB.DATA.games.branching.cases (falls back to
   CORB.DATA.scenarios.cases / CORB.DATA.korea_scenarios) played node by node — choice buttons,
   feedback with a score delta, a running total and decision trail, then a debrief with the
   outcome, learning points, citations and CORB.scoring.recordGame('branching:'+id, {score}).
   Cases are never hidden by the organization filter; the active organization's cases sort first.
   Every data module is optional: missing, empty or half-shaped data renders an honest empty
   state and never throws. Params: tab (board|ko), id (question id), case (case id), domain, q, korea. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, util = CORB.util;

  var PAGE = 60;
  var PRESETS = [60, 120, 180];
  var DEFAULT_SECONDS = 120;
  var KOREA_FLAG = 'korea-verify-cp';
  var KOREA_DOMAIN = 'Korea, LCS & SOFA';
  var MAX_STEPS = 40;
  var WPM = 135;
  var KNOWN_BADGES = { 'official': 1, 'ai-draft': 1, 'open': 1, 'verify-locally': 1, 'korea-verify-cp': 1, 'rfo-updated': 1, 'rfo-unverifiable': 1, 'pending': 1 };
  var RATINGS = [
    [1, 'Blanked', 'Could not answer it at all.'],
    [2, 'Shaky', 'Pieces of it, missed the rule.'],
    [3, 'Got there', 'Right answer, hesitant or no cite.'],
    [4, 'Solid', 'Rule, cite and application, small gaps.'],
    [5, 'Board-ready', 'Rule, cite, application, risk — calmly.']
  ];

  var S = null;          // view state for this session
  var last = null;       // remembered across navigations
  var lastSig = null;    // signature of the params that built S
  var R = null;          // live DOM references
  var clock = null;      // countdown state for the open scenario
  var searchTimer = null;
  var noteTimer = null, noteId = '', noteEl = null;
  var keyHandler = null;

  // ------------------------------------------------------------------ tiny helpers
  function safe(fn, fb) { try { var v = fn(); return v === undefined || v === null ? fb : v; } catch (e) { return fb; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function str(v) { return v === undefined || v === null ? '' : String(v); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function words(t) { var m = str(t).match(/\S+/g); return m ? m.length : 0; }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function signed(n) { return (n > 0 ? '+' : '') + n; }
  function focusSoon(el) { if (!el) return; setTimeout(function () { try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} } }, 40); }
  function scrollSoon(el) { if (!el) return; setTimeout(function () { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }, 30); }

  // ------------------------------------------------------------------ data access
  function rawScenarios() { return arr(CORB.DATA && CORB.DATA.questions).filter(function (q) { return q && q.id && q.kind === 'scenario'; }); }
  function scenarioPool(ignoreUnit) {
    if (!CORB.data || !CORB.data.questions) return rawScenarios();
    var f = { kind: 'scenario' };
    if (ignoreUnit) f.ignoreUnit = true;
    var list = safe(function () { return CORB.data.questions(f); }, null);
    if (!Array.isArray(list)) return rawScenarios();
    return list.filter(function (q) { return q && q.id; });
  }
  function byId(id) {
    var q = safe(function () { return CORB.data.byId(id); }, null);
    if (q) return q;
    var all = arr(CORB.DATA && CORB.DATA.questions);
    for (var i = 0; i < all.length; i++) { if (all[i] && all[i].id === id) return all[i]; }
    return null;
  }
  function isKorea(q) { return arr(q && q.flags).indexOf(KOREA_FLAG) >= 0 || str(q && q.domain) === KOREA_DOMAIN; }
  function unitId() { return safe(function () { return CORB.unit(); }, 'all') || 'all'; }
  function unitLabel(id) {
    id = id || unitId();
    var name = safe(function () { return CORB.unitName(id); }, '');
    if (!name || name === id) return id === 'all' ? 'All organizations' : str(id);
    return name;
  }
  function switchAll() {
    CORB.set('profile.unit', 'all');
    var sel = document.querySelector('.topbar .unit-select'); if (sel) { try { sel.value = 'all'; } catch (e) {} }
    ui.toast('Showing all organizations', 'ok');
    CORB.refresh();
  }

  function srsOf(id) {
    var s = safe(function () { return CORB.scoring.srs.get(id); }, null);
    return obj(s);
  }
  function practised(id) { return !!srsOf(id).last; }
  function masteryOf(id) { return num(safe(function () { return CORB.scoring.srs.mastery(id); }, 0)); }
  function isDue(id) { var s = srsOf(id); return !!(s.due && s.due <= util.today()); }

  // ------------------------------------------------------------------ branching cases
  function caseSource() {
    var D = obj(CORB.DATA), g = obj(D.games), b = g.branching;
    if (b && Array.isArray(b.cases)) return b.cases;
    if (Array.isArray(b)) return b;
    if (Array.isArray(g.cases)) return g.cases;
    var sc = D.scenarios;
    if (sc && Array.isArray(sc.cases)) return sc.cases;
    if (Array.isArray(sc)) return sc;
    var ks = D.korea_scenarios;
    if (ks && Array.isArray(ks.cases)) return ks.cases;
    if (Array.isArray(ks)) return ks;
    return [];
  }
  function cases() {
    var out = [];
    safe(function () { return caseSource(); }, []).forEach(function (c, i) {
      if (!c || typeof c !== 'object') return;
      var nodes = obj(c.nodes);
      var keys = Object.keys(nodes).filter(function (k) { return nodes[k] && typeof nodes[k] === 'object'; });
      if (!keys.length) return;
      var start = str(c.start);
      if (!start || !nodes[start]) start = keys[0];
      out.push({
        id: str(c.id) || ('case-' + (i + 1)),
        title: str(c.title) || ('Case ' + (i + 1)),
        unit: str(c.unit),
        classes: arr(c.classes).map(str).filter(Boolean),
        domain: str(c.domain),
        setup: str(c.setup),
        start: start,
        nodes: nodes,
        keys: keys,
        learning: arr(c.learning_points).map(str).filter(Boolean),
        cites: arr(c.citations).map(str).filter(Boolean),
        flags: arr(c.flags).map(str).filter(Boolean)
      });
    });
    var active = unitId();
    out.sort(function (a, b) {
      var ax = a.unit && a.unit === active ? 0 : 1, bx = b.unit && b.unit === active ? 0 : 1;
      return (ax - bx) || a.title.localeCompare(b.title);
    });
    return out;
  }
  function caseById(id) { var all = cases(); for (var i = 0; i < all.length; i++) { if (all[i].id === id) return all[i]; } return null; }
  function choicesOf(node) {
    return arr(node && node.choices).filter(function (c) { return c && typeof c === 'object' && (str(c.label) || str(c.text)); })
      .map(function (c) { return { label: str(c.label) || str(c.text), next: str(c.next), score: num(c.score), feedback: str(c.feedback) }; });
  }
  function decisionCount(cs) { var n = 0; cs.keys.forEach(function (k) { if (choicesOf(cs.nodes[k]).length) n++; }); return n; }
  function bestScore(cs) {
    var budget = 4000, ok = true;
    function walk(id, seen, d) {
      if (--budget <= 0) { ok = false; return 0; }
      if (!id || d > 24 || seen[id]) return 0;
      var node = cs.nodes[id]; if (!node) return 0;
      var ch = choicesOf(node); if (!ch.length) return 0;
      var next = {}; Object.keys(seen).forEach(function (k) { next[k] = 1; }); next[id] = 1;
      var best = null;
      for (var i = 0; i < ch.length; i++) {
        var v = ch[i].score + walk(ch[i].next, next, d + 1);
        if (best === null || v > best) best = v;
      }
      return best === null ? 0 : best;
    }
    var r = safe(function () { return walk(cs.start, {}, 0); }, null);
    return ok && r !== null ? r : null;
  }
  function gameKey(id) { return 'branching:' + id; }
  function gameStats(id) { return obj(safe(function () { return CORB.get('progress.games.' + gameKey(id), null); }, null)); }

  // ------------------------------------------------------------------ view state
  function fresh() {
    return { tab: 'board', tabTouched: false, q: '', domain: '', korea: false, unpractised: false, shown: PAGE, focusId: '', caseId: '', run: null, seconds: DEFAULT_SECONDS };
  }
  function fromParams(p) {
    var s = fresh();
    if (last) s.seconds = last.seconds || DEFAULT_SECONDS;
    var tab = str(p.tab).toLowerCase();
    if (tab === 'ko' || tab === 'branching' || tab === 'cases') { s.tab = 'ko'; s.tabTouched = true; }
    if (p.q) s.q = str(p.q).trim();
    if (p.domain) s.domain = str(p.domain);
    if (p.korea === '1' || p.korea === 'true') s.korea = true;
    return s;
  }
  function filtered(omit) {
    omit = omit || {};
    var q = str(S.q).toLowerCase().trim();
    var list = scenarioPool(false).filter(function (x) {
      if (!omit.domain && S.domain && str(x.domain) !== S.domain) return false;
      if (!omit.korea && S.korea && !isKorea(x)) return false;
      if (!omit.unpractised && S.unpractised && practised(x.id)) return false;
      if (!omit.q && q) {
        var hay = (str(x.question) + ' ' + str(x.answer) + ' ' + str(x.topic) + ' ' + arr(x.tags).join(' ') + ' ' + arr(x.citations).join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    list.sort(function (a, b) { return String(a.id).localeCompare(String(b.id), undefined, { numeric: true }); });
    return list;
  }
  function activeFilters() { return (S.q ? 1 : 0) + (S.domain ? 1 : 0) + (S.korea ? 1 : 0) + (S.unpractised ? 1 : 0); }
  function resetFilters() { S.q = ''; S.domain = ''; S.korea = false; S.unpractised = false; S.shown = PAGE; paint(); }

  // ------------------------------------------------------------------ notes (progress.notes.<id>)
  function queueNote(id, el) {
    noteId = id; noteEl = el;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { flushNote(true); }, 700);
  }
  function flushNote(fromTimer) {
    clearTimeout(noteTimer); noteTimer = null;
    if (!noteId || !noteEl) return;
    var id = noteId, value = noteEl.value;
    if (!fromTimer) { noteId = ''; noteEl = null; }
    safe(function () { return CORB.setNote(id, value); }, null);
    if (R && R.saved) {
      R.saved.textContent = value ? 'Saved' : 'Nothing written yet';
      R.saved.classList.remove('flash');
      if (value) { void R.saved.offsetWidth; R.saved.classList.add('flash'); }
    }
  }

  // ------------------------------------------------------------------ shared pieces
  function flagBadges(q) {
    var out = [];
    safe(function () { return ui.flagsFor(q); }, []).forEach(function (f) {
      if (KNOWN_BADGES[f]) out.push(ui.badge(f));
      else out.push(h('span.badge.neutral', {}, str(f).replace(/-/g, ' ')));
    });
    return out;
  }
  function classBadges(list) {
    return arr(list).slice(0, 4).map(function (c) { return safe(function () { return ui.classBadge(c); }, h('span.badge.neutral', {}, str(c))); });
  }
  function citeRow(list, label) {
    var cs = arr(list).map(str).filter(Boolean);
    if (!cs.length) return null;
    return h('div.sc-cites', {}, h('span.sc-cites-k', {}, label || 'Cite'),
      cs.map(function (c) {
        var u = safe(function () { return CORB.data.citeUrl(c); }, null);
        return u ? h('a.cite', { href: u, target: '_blank', rel: 'noopener' }, c) : h('span.cite', {}, c);
      }));
  }

  // ------------------------------------------------------------------ head, metrics, tabs
  function pageHead() {
    return h('header.sc-head', {},
      h('div.sc-head-copy', {},
        h('h1', {}, 'Scenarios'),
        h('p.lede.sc-lede', {}, 'A board rarely asks you to recite a rule. It hands you a situation and watches how you think. Work a scenario against the clock and write the answer you would say out loud — then take a branching case and live with every decision you make.')),
      h('div.sc-head-actions', {},
        h('button.btn.sc-random', { type: 'button', onclick: openRandom }, icon('shuffle'), 'Random scenario'),
        h('button.btn.ghost', { type: 'button', onclick: function () { CORB.go('mockboard'); } }, icon('mic'), 'Mock board')));
  }
  function openRandom() {
    var pool = filtered();
    if (!pool.length) pool = scenarioPool(false);
    if (!pool.length) { ui.toast('No scenario questions are loaded', 'warn'); return; }
    var pick = util.shuffle(pool)[0];
    S.tab = 'board'; S.tabTouched = true; S.focusId = pick.id;
    R.autofocus = true;
    paint();
  }

  function paintMetrics() {
    if (!R || !R.metrics) return;
    var pool = scenarioPool(false), total = scenarioPool(true), list = cases();
    var done = 0, due = 0;
    pool.forEach(function (q) { if (practised(q.id)) done++; if (isDue(q.id)) due++; });
    var plays = 0, best = 0;
    list.forEach(function (c) { var g = gameStats(c.id); plays += num(g.plays); best = Math.max(best, num(g.best)); });
    var hidden = Math.max(0, total.length - pool.length);

    R.metrics.innerHTML = '';
    if (!done && !plays) return;   // nothing to report yet, so the row stays away
    var parts = [];
    if (done) parts.push('Practised ' + done + ' of ' + pool.length);
    if (due) parts.push(util.plural(due, 'scenario') + ' due for review');
    if (plays) parts.push(util.plural(plays, 'case run') + (best ? ', best ' + best + ' points' : ''));
    R.metrics.appendChild(h('div.sc-metrics-line', {}, icon('bar-chart'), h('span', {}, parts.join(' · '))));
  }

  function tabsEl() {
    var el = h('div.tabs.sc-tabs', { role: 'tablist', 'aria-label': 'Scenario practice modes' });
    [['board', 'Board scenarios', 'target'], ['ko', "You're the KO", 'compass']].forEach(function (d) {
      var on = S.tab === d[0];
      el.appendChild(h('button' + (on ? '.on' : ''), {
        type: 'button', role: 'tab', id: 'sc-tab-' + d[0], 'aria-selected': on ? 'true' : 'false', 'aria-controls': 'sc-panel',
        dataset: { tab: d[0] },
        onclick: function () { if (S.tab === d[0]) return; S.tab = d[0]; S.tabTouched = true; R.autofocus = false; paint(); }
      }, icon(d[2]), h('span', {}, d[1]), h('span.sc-tab-n.num', {}, str(d[0] === 'board' ? scenarioPool(false).length : cases().length))));
    });
    return el;
  }
  function paintTabs() {
    if (!R || !R.tabs) return;
    Array.prototype.forEach.call(R.tabs.querySelectorAll('button'), function (b) {
      var on = b.getAttribute('data-tab') === S.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  // ------------------------------------------------------------------ tab 1: list
  function drawList() {
    var pool = scenarioPool(false), total = scenarioPool(true);
    if (!total.length) { R.body.appendChild(rawScenarios().length && warrantNow() ? emptyClass() : emptyBank()); return; }
    if (!pool.length) { R.body.appendChild(emptyUnit(total.length)); return; }

    var list = filtered();
    var domains = domainOptions();
    var hidden = Math.max(0, total.length - pool.length);

    var input = h('input.input', {
      type: 'search', value: S.q, placeholder: 'Search the situation, the model answer, a topic or a citation…',
      'aria-label': 'Search scenarios', autocomplete: 'off', spellcheck: 'false',
      oninput: function (e) {
        var v = e.target.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () { S.q = v; S.shown = PAGE; paint(); }, 220);
      },
      onkeydown: function (e) { if (e.key === 'Enter') { clearTimeout(searchTimer); S.q = e.target.value; S.shown = PAGE; paint(); } }
    });

    var bar2 = h('div.sc-bar', {},
      h('div.search.sc-search', {}, icon('search'), input),
      h('select.select.sc-domain', {
        'aria-label': 'Filter by domain',
        onchange: function (e) { S.domain = e.target.value; S.shown = PAGE; paint(); }
      }, [h('option', { value: '', selected: !S.domain }, 'Every domain (' + pool.length + ')')].concat(domains.map(function (d) {
        return h('option', { value: d.name, selected: S.domain === d.name }, d.name + ' (' + d.count + ')');
      }))),
      h('button.chip' + (S.korea ? '.on' : ''), { type: 'button', 'aria-pressed': S.korea ? 'true' : 'false', onclick: function () { S.korea = !S.korea; S.shown = PAGE; paint(); } }, icon('globe'), 'Korea'),
      h('button.chip' + (S.unpractised ? '.on' : ''), { type: 'button', 'aria-pressed': S.unpractised ? 'true' : 'false', onclick: function () { S.unpractised = !S.unpractised; S.shown = PAGE; paint(); } }, icon('star'), 'Not practised'),
      activeFilters() ? h('button.btn.sm.ghost', { type: 'button', onclick: resetFilters }, icon('x'), 'Clear') : null);

    R.body.appendChild(bar2);

    if (hidden) {
      R.body.appendChild(h('div.sc-unit', {},
        icon('users'),
        h('span.grow', {}, h('b', {}, unitLabel()), ' — ', util.plural(pool.length, 'scenario'), ' in this set, ', h('b', {}, str(hidden)), ' hidden by the organization filter.'),
        h('button.btn.sm.ghost', { type: 'button', onclick: switchAll }, 'Show all organizations', icon('arrow-right'))));
    }

    if (!list.length) {
      R.body.appendChild(h('div.empty.sc-empty', {}, icon('search'),
        h('h3', {}, 'No scenario matches those filters'),
        h('p', {}, S.q ? 'Try fewer words, a topic name, or a citation such as "FAR 6.103". The search covers the situation, the model answer, the topic, tags and citations.' : 'Loosen a filter — the domain list shows how many scenarios each domain holds.'),
        h('button.btn.primary.mt-4', { type: 'button', onclick: resetFilters }, 'Clear filters')));
      return;
    }

    var doneN = 0; list.forEach(function (q) { if (practised(q.id)) doneN++; });
    R.body.appendChild(h('div.sc-status', { 'aria-live': 'polite' },
      h('b', {}, util.plural(list.length, 'scenario')),
      h('span.muted', {}, doneN ? ' · ' + doneN + ' self-rated' : ' · none rated yet'),
      h('span.grow'),
      h('span.muted.small', {}, 'Two minutes each, said out loud')));

    var shown = Math.min(S.shown, list.length);
    var wrap = h('div.sc-list');
    for (var i = 0; i < shown; i++) wrap.appendChild(listItem(list[i], i));
    R.body.appendChild(wrap);

    if (shown < list.length) {
      R.body.appendChild(h('div.sc-more', {},
        h('button.btn', { type: 'button', onclick: function () { S.shown += PAGE; paint(); } }, 'Show ' + Math.min(PAGE, list.length - shown) + ' more'),
        h('span.muted.small', {}, shown + ' of ' + list.length + ' shown')));
    }
  }
  function domainOptions() {
    var c = {};
    filtered({ domain: true }).forEach(function (q) { var d = str(q.domain) || 'General contracting'; c[d] = (c[d] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); }).map(function (k) { return { name: k, count: c[k] }; });
  }
  function listItem(q, i) {
    var s = srsOf(q.id), rated = !!s.last, due = isDue(q.id);
    var badges = h('span.sc-item-badges', {},
      h('span.badge.neutral', {}, str(q.domain) || 'General contracting'),
      classBadges(q.classes),
      isKorea(q) ? ui.badge(KOREA_FLAG) : null,
      q.answer_status === 'open' ? ui.badge('open') : (q.answer_status === 'ai-draft' ? ui.badge('ai-draft') : null),
      due ? h('span.badge.gold', {}, 'Due') : null);
    var foot = h('span.sc-item-foot', {},
      q.topic ? h('span.sc-item-topic', {}, icon('target'), str(q.topic)) : null,
      rated ? h('span.sc-item-rated', {}, icon('star'), 'Rated ' + (s.lastGrade ? s.lastGrade + '/5' : 'earlier') + ' · ' + util.fmtDate(s.last)) : h('span.sc-item-new', {}, 'Not practised yet'),
      q.unit && q.unit !== 'ACC-All' ? h('span.sc-item-unit', {}, str(q.unit)) : null);
    return h('button.sc-item' + (rated ? '.done' : ''), {
      type: 'button', dataset: { id: q.id },
      onclick: function () { S.focusId = q.id; R.autofocus = true; paint(); }
    },
      h('span.sc-item-rail', {}, rated ? icon('check') : h('span.sc-item-n.num', {}, str(i + 1))),
      h('span.sc-item-main', {}, badges, h('span.sc-item-q', {}, str(q.question)), foot),
      h('span.sc-item-go', {}, icon('chevron-right')));
  }
  function emptyBank() {
    return h('div.empty.sc-empty', {}, icon('compass'),
      h('h3', {}, 'No scenario questions in this build'),
      h('p', {}, 'Scenario questions are the items in the question bank tagged kind "scenario". This copy of the app does not have any. The rest of the bank still works.'),
      h('div.sc-empty-actions', {},
        h('button.btn.primary', { type: 'button', onclick: function () { CORB.go('library'); } }, 'Open the question library', icon('arrow-right')),
        h('button.btn', { type: 'button', onclick: function () { S.tab = 'ko'; S.tabTouched = true; paint(); } }, "You're the KO")));
  }
  function warrantNow() { return safe(function () { return CORB.warrantClass(); }, '') || ''; }
  function emptyClass() {
    var label = safe(function () { return CORB.data.classLabel(warrantNow()); }, 'your class');
    return h('div.empty.sc-empty', {}, icon('award'),
      h('h3', {}, 'No scenarios for ' + label + ' here'),
      h('p', {}, 'Scenario questions follow your warrant class, and none are tagged for it in this organization. Change your class with the class button at the top of the page.'),
      h('button.btn.primary.mt-4', { type: 'button', onclick: function () { CORB.ui.classPicker(); } }, icon('award'), 'Change warrant class'));
  }
  function emptyUnit(total) {
    return h('div.empty.sc-empty', {}, icon('users'),
      h('h3', {}, 'No scenarios are tagged for ' + unitLabel()),
      h('p', {}, 'The bank holds ' + util.plural(total, 'scenario') + ' from other organizations. Judgment questions travel well between commands — switch to all organizations to work them.'),
      h('button.btn.primary.mt-4', { type: 'button', onclick: switchAll }, 'Show all organizations', icon('arrow-right')));
  }

  // ------------------------------------------------------------------ tab 1: focused drill
  function drawFocus() {
    var list = filtered(), idx = -1, q = null;
    for (var i = 0; i < list.length; i++) { if (list[i].id === S.focusId) { q = list[i]; idx = i; break; } }
    if (!q) q = byId(S.focusId);
    if (!q) {
      R.body.appendChild(h('div.empty.sc-empty', {}, icon('alert'),
        h('h3', {}, 'That scenario is not in this build'),
        h('p', {}, 'The id "' + str(S.focusId) + '" is not in the question bank, or it was removed by a facilitator edit.'),
        h('button.btn.primary.mt-4', { type: 'button', onclick: back }, 'Back to all scenarios')));
      return;
    }

    var wrap = h('div.sc-focus');
    var prev = idx > 0 ? list[idx - 1] : null, next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
    wrap.appendChild(h('div.sc-focus-top', {},
      h('button.sc-back', { type: 'button', onclick: back }, icon('arrow-left'), 'All scenarios'),
      h('span.grow'),
      idx >= 0 ? h('span.sc-counter.num', {}, (idx + 1) + ' / ' + list.length) : h('span.sc-counter.muted.small', {}, 'Outside the current filter'),
      h('button.btn.icon.sm.ghost', { type: 'button', 'aria-label': 'Previous scenario', 'data-tip': 'Previous', disabled: !prev, onclick: function () { if (prev) { S.focusId = prev.id; R.autofocus = true; paint(); } } }, icon('arrow-left')),
      h('button.btn.icon.sm.ghost', { type: 'button', 'aria-label': 'Next scenario', 'data-tip': 'Next', disabled: !next, onclick: function () { if (next) { S.focusId = next.id; R.autofocus = true; paint(); } } }, icon('arrow-right'))));

    R.revealed = false;
    R.revealHost = h('div.sc-reveal-host');
    R.rateHost = h('div.sc-rate-host');

    var main = h('div.sc-main', {}, promptCard(q), workCard(q), R.revealHost, R.rateHost);
    var rail = h('aside.sc-rail', {}, clockCard(), rubricCard(), metaCard(q));
    wrap.appendChild(h('div.sc-stage', {}, main, rail));
    R.body.appendChild(wrap);

    paintClock();
    if (R.autofocus) { focusSoon(R.promptHead); R.autofocus = false; }
  }
  function back() { S.focusId = ''; R.autofocus = false; paint(); }

  function promptCard(q) {
    R.promptHead = h('h2.sc-prompt-eyebrow', { tabindex: '-1' }, icon('compass'), 'The situation');
    return h('section.card.sc-prompt', {},
      h('div.sc-prompt-badges', {},
        h('span.badge.neutral', {}, str(q.domain) || 'General contracting'),
        classBadges(q.classes),
        flagBadges(q),
        h('span.grow'),
        h('span.sc-id.num.muted.small', {}, str(q.id))),
      R.promptHead,
      h('p.sc-prompt-text', {}, str(q.question)),
      h('div.sc-prompt-foot', {},
        q.topic ? h('span.sc-tag', {}, icon('target'), str(q.topic)) : null,
        q.unit ? h('span.sc-tag', {}, icon('users'), str(q.unit)) : null,
        h('span.grow'),
        CORB.speech && CORB.speech.available ? h('button.btn.sm.ghost', { type: 'button', 'data-tip': 'Read the situation aloud', onclick: function () { safe(function () { return CORB.speech.speak(str(q.question)); }, null); } }, icon('volume'), 'Read aloud') : null,
        h('button.btn.sm.ghost' + (CORB.get('progress.bookmarks.' + q.id) ? '.on' : ''), {
          type: 'button', 'data-tip': 'Bookmark',
          onclick: function () { var v = !CORB.get('progress.bookmarks.' + q.id); CORB.set('progress.bookmarks.' + q.id, v); this.classList.toggle('on', v); ui.toast(v ? 'Bookmarked' : 'Bookmark removed'); }
        }, icon('bookmark'))));
  }

  function workCard(q) {
    var stored = str(CORB.get('progress.notes.' + q.id, ''));
    var ta = h('textarea.textarea.sc-answer', {
      value: stored, spellcheck: 'true',
      'aria-label': 'Your answer to this scenario',
      placeholder: 'Rule. Citation. How it applies to these facts. The risk. Who you coordinate with before you sign.',
      oninput: function () { queueNote(q.id, ta); paintCount(); },
      onblur: function () { flushNote(); }
    });
    R.saved = h('span.sc-saved', {}, stored ? 'Saved' : 'Nothing written yet');
    R.count = h('span.sc-count.muted.small');
    R.revealBtn = h('button.btn.primary.sc-reveal-btn', { type: 'button', onclick: function () { reveal(q); } }, icon('eye'), 'Reveal model answer');

    function paintCount() {
      var w = words(ta.value);
      R.count.textContent = w ? util.plural(w, 'word') + ' · about ' + mmss(Math.round(w / WPM * 60)) + ' spoken' : 'Aim for 45 to 90 seconds out loud';
    }
    paintCount();

    var storageOff = CORB.store && CORB.store.available === false;
    return h('section.card.sc-work', {},
      h('div.sc-work-head', {},
        h('h2', {}, icon('note'), 'Your answer'),
        h('span.grow'),
        R.saved),
      h('p.sc-work-hint', {}, 'Write it the way you would say it at the board. The board is listening for the rule, the citation, how it applies to these facts, the risk you accept, and who you coordinate with before you sign.'),
      ta,
      storageOff ? h('div.callout.warn.mt-3', {}, icon('alert'), h('div', {}, h('b', {}, 'Browser storage is off'), 'Your answer stays for this session only. Export your progress from Settings if you want to keep it.')) : null,
      h('div.sc-work-foot', {}, R.count, h('span.grow'), R.revealBtn));
  }

  function reveal(q) {
    if (R.revealed) { scrollSoon(R.answerCard); return; }
    R.revealed = true;
    flushNote();
    if (clock && clock.running) { stopClock(); paintClock(); }
    safe(function () { return CORB.set('progress.seen.' + q.id, util.today()); }, null);
    R.answerCard = answerCard(q);
    R.revealHost.appendChild(R.answerCard);
    R.rateHost.appendChild(rateCard(q));
    R.revealBtn.classList.remove('primary');
    R.revealBtn.textContent = '';
    R.revealBtn.appendChild(icon('arrow-right'));
    R.revealBtn.appendChild(document.createTextNode(' Jump to the model answer'));
    scrollSoon(R.answerCard);
    focusSoon(R.answerCard);
  }

  function answerCard(q) {
    var card = h('section.card.sc-answer-card', { tabindex: '-1' });
    card.appendChild(h('div.sc-answer-head', {},
      h('h2', {}, icon('check'), 'Model answer'),
      h('span.grow'),
      flagBadges(q)));

    var st = str(q.answer_status), text = st === 'open' ? '' : str(q.answer);
    if (st === 'ai-draft' && !CORB.get('settings.showDrafts', true)) {
      card.appendChild(h('div.callout.warn.mt-4', {}, icon('spark'), h('div', {}, h('b', {}, 'AI-drafted answers are hidden'), 'Turn them back on in Settings if you want to read this one — and verify every citation before you rely on it.')));
    } else if (!text) {
      card.appendChild(h('div.callout.info.mt-4', {}, icon('info'), h('div', {},
        h('b', {}, 'No repository answer for this one'),
        'This scenario is in the bank as an open question. Your written answer above is the draft — take it to a mentor, and record what they tell you.')));
      card.appendChild(h('div.sc-answer-actions', {},
        h('button.btn.sm', { type: 'button', onclick: function () { CORB.go('mentor', { critique: q.id }); } }, icon('chat'), 'Ask the mentor to critique it'),
        h('button.btn.sm.ghost', { type: 'button', onclick: function () { CORB.go('library', { domain: q.domain }); } }, icon('book'), 'Related questions')));
    } else {
      card.appendChild(safe(function () { return ui.rich(text); }, h('p.pre', {}, text)));
    }

    var kp = arr(q.key_points).map(str).filter(Boolean);
    if (kp.length) {
      card.appendChild(h('div.panel-soft.sc-keypoints', {}, h('div.eyebrow', {}, 'What the board is listening for'),
        h('ul.mt-2', {}, kp.map(function (k) { return h('li', {}, k); }))));
    }
    var outline = arr(q.model_answer_outline).map(str).filter(Boolean);
    if (outline.length) {
      card.appendChild(h('div.panel-soft.sc-keypoints', {}, h('div.eyebrow', {}, 'Answer outline'),
        h('ol.mt-2', {}, outline.map(function (k) { return h('li', {}, k); }))));
    }

    var alts = arr(q.alt_answers).filter(function (d) { return d && str(d.text); });
    if (alts.length) {
      card.appendChild(h('details.acc.mt-3', {},
        h('summary', {}, icon('scale'), 'Another version of this answer (' + alts.length + ')', icon('chevron', 'chev')),
        h('div.acc-body', {}, alts.map(function (d) { return h('div.sc-deck', {}, h('div.eyebrow', {}, str(d.src) || 'Alternate source'), safe(function () { return ui.rich(str(d.text)); }, h('p.pre', {}, str(d.text)))); }))));
    }

    var cites = arr(q.citations_rfo).length ? q.citations_rfo : q.citations;
    var row = citeRow(cites, 'Cite');
    if (row) card.appendChild(row);
    var cw = arr(q.rfo && q.rfo.crosswalk).filter(function (c) { return c && (c.old || c.new); });
    if (cw.length) {
      card.appendChild(h('div.muted.small.mt-2', {}, 'RFO crosswalk: ' + cw.map(function (c) { return str(c.old) + ' → ' + str(c.new); }).join(' · ')));
    }
    return card;
  }

  function rateCard(q) {
    var card = h('section.card.sc-rate');
    var body = h('div.sc-rate-body');
    function paintRate() {
      body.innerHTML = '';
      var s = srsOf(q.id);
      var today = util.today();
      body.appendChild(h('div.sc-rate-row', {}, RATINGS.map(function (r) {
        var on = s.last === today && num(s.lastGrade) === r[0];
        return h('button.sc-rate-btn' + (on ? '.on' : ''), {
          type: 'button', 'aria-label': r[0] + ' — ' + r[1] + '. ' + r[2], 'aria-pressed': on ? 'true' : 'false',
          onclick: function () { grade(q, r[0], paintRate); }
        }, h('b.num', {}, str(r[0])), h('span.sc-rate-name', {}, r[1]), h('span.sc-rate-hint', {}, r[2]));
      })));
      if (s.last) {
        body.appendChild(h('div.sc-rate-state', {}, icon('clock'),
          h('span', {}, 'Last rated ' + (s.lastGrade ? s.lastGrade + '/5' : '') + ' on ' + util.fmtDate(s.last) +
            (s.due ? ' · back in your flashcards ' + util.fmtDate(s.due) : '') + ' · mastery ' + masteryOf(q.id) + '%'),
          h('span.grow'),
          h('button.btn.sm.ghost', { type: 'button', onclick: function () { CORB.go('flashcards'); } }, 'Flashcards', icon('arrow-right'))));
      }
    }
    paintRate();
    card.appendChild(h('div.sc-rate-head', {},
      h('h2', {}, icon('star'), 'How did that go?'),
      h('span.grow'),
      h('span.muted.small', {}, 'Feeds spaced repetition and your readiness score')));
    card.appendChild(body);
    return card;
  }
  function grade(q, n, done) {
    var s = safe(function () { return CORB.scoring.srs.grade(q.id, n); }, null);
    if (!s) { ui.toast('That rating could not be saved', 'danger'); return; }
    var days = num(s.interval) || 1;
    ui.toast(n >= 4 ? 'Logged — next review in ' + util.plural(days, 'day') : 'Logged — this one comes back in ' + util.plural(days, 'day'), 'ok');
    paintMetrics();
    if (done) done();
  }

  function rubricCard() {
    var r = obj(safe(function () { return CORB.scoring.rubric(); }, null));
    var dims = arr(r.dimensions).filter(function (d) { return d && (d.name || d.id); }).slice(0, 4);
    if (!dims.length) return null;
    return h('details.acc.sc-side-acc', {},
      h('summary', {}, icon('award'), 'How a board scores this', icon('chevron', 'chev')),
      h('div.acc-body', {},
        h('ul.sc-rubric', {}, dims.map(function (d) {
          return h('li', {}, h('b', {}, str(d.name) || str(d.id)), h('span', {}, str(d.description) || str(obj(d.anchors)['5']) || ''));
        })),
        r.numeric_guide ? h('p.muted.small.mt-3', {}, str(r.numeric_guide)) : null));
  }
  function metaCard(q) {
    return h('section.card.sc-side', {},
      h('div.sc-side-actions', {},
        h('button.btn.sm.block', { type: 'button', onclick: function () { CORB.go('mentor', { critique: q.id }); } }, icon('chat'), 'Ask the mentor to critique'),
        h('button.btn.sm.ghost.block', { type: 'button', onclick: function () { CORB.go('library', { id: q.id }); } }, icon('book'), 'Open in the library')));
  }

  // ------------------------------------------------------------------ the clock
  function clockCard() {
    clock = { total: S.seconds || DEFAULT_SECONDS, left: S.seconds || DEFAULT_SECONDS, running: false, expired: false, id: null };
    R.clockRing = h('div.sc-ring', { role: 'timer', 'aria-label': 'Answer timer' }, h('span.sc-ring-time.num'));
    R.clockState = h('div.sc-clock-state');
    R.clockBtn = h('button.btn.primary.block', { type: 'button', onclick: toggleClock });
    var presets = h('div.sc-presets', {}, PRESETS.map(function (p) {
      return h('button.chip' + (clock.total === p ? '.on' : ''), {
        type: 'button', 'aria-pressed': clock.total === p ? 'true' : 'false',
        onclick: function () {
          S.seconds = p; stopClock();
          clock.total = p; clock.left = p; clock.expired = false;
          Array.prototype.forEach.call(presets.querySelectorAll('.chip'), function (c) { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); });
          this.classList.add('on'); this.setAttribute('aria-pressed', 'true');
          paintClock();
        }
      }, mmss(p));
    }));
    return h('section.card.sc-clock', {},
      h('div.eyebrow', {}, 'On the clock'),
      R.clockRing,
      R.clockState,
      R.clockBtn,
      h('button.btn.sm.ghost.block.mt-2', { type: 'button', onclick: function () { stopClock(); clock.left = clock.total; clock.expired = false; paintClock(); } }, icon('refresh'), 'Reset'),
      presets,
      h('p.sc-clock-note', {}, 'Boards give you room to think, then expect a clean answer. Two minutes is a generous ceiling — most good answers land inside ninety seconds.'));
  }
  function toggleClock() {
    if (!clock) return;
    if (clock.running) { stopClock(); paintClock(); return; }
    if (clock.expired || clock.left <= 0) { clock.left = clock.total; clock.expired = false; }
    clock.running = true;
    clock.id = setInterval(tickClock, 1000);
    paintClock();
  }
  function tickClock() {
    if (!clock) return;
    clock.left = clock.left - 1;
    if (clock.left <= 0) {
      clock.left = 0; clock.expired = true;
      stopClock();
      ui.toast('Time. Land the answer, then reveal the model.', 'warn');
    }
    paintClock();
  }
  function stopClock() {
    if (!clock) return;
    if (clock.id) { clearInterval(clock.id); clock.id = null; }
    clock.running = false;
  }
  function paintClock() {
    if (!clock || !R || !R.clockRing) return;
    var time = R.clockRing.querySelector('.sc-ring-time');
    if (time) time.textContent = mmss(clock.left);
    var p = clock.total ? (clock.left / clock.total) * 100 : 0;
    try { R.clockRing.style.setProperty('--p', p.toFixed(2)); } catch (e) {}
    R.clockRing.classList.toggle('warn', clock.left <= 30 && clock.left > 10);
    R.clockRing.classList.toggle('danger', clock.left <= 10);
    if (R.clockState) R.clockState.textContent = clock.expired ? 'Time — wrap it up' : clock.running ? 'Running' : (clock.left === clock.total ? 'Ready when you are' : 'Paused');
    if (R.clockBtn) {
      R.clockBtn.textContent = '';
      R.clockBtn.appendChild(icon(clock.running ? 'pause' : 'play'));
      R.clockBtn.appendChild(document.createTextNode(clock.running ? ' Pause' : (clock.expired || clock.left === clock.total ? ' Start ' + mmss(clock.total) : ' Resume')));
    }
  }

  // ------------------------------------------------------------------ tab 2: case index
  function drawCaseIndex() {
    var list = cases();
    if (!list.length) { R.body.appendChild(emptyCases()); return; }

    R.body.appendChild(h('section.card.sc-ko-intro', {},
      h('div.sc-ko-intro-copy', {},
        h('div.eyebrow', {}, "You're the KO"),
        h('h2', {}, 'Decisions, not definitions.'),
        h('p.muted', {}, 'Each case drops you into a live acquisition. Every choice moves your score and comes back with the rule behind it. Reach the end and you get the outcome, the learning points and the citations — then run it again and take the better road.')),
      h('ul.sc-ko-rules', {},
        h('li', {}, icon('hand'), 'Choose the way you actually would, not the way that scores well.'),
        h('li', {}, icon('scale'), 'Feedback names the rule and the risk behind the choice.'),
        h('li', {}, icon('shield'), 'Scores stay on this device. Nothing is reported anywhere.'))));

    var grid = h('div.sc-cases');
    list.forEach(function (c) { grid.appendChild(caseCard(c)); });
    R.body.appendChild(grid);
  }
  function caseCard(c) {
    var g = gameStats(c.id), plays = num(g.plays);
    var decisions = decisionCount(c);
    return h('button.card.lift.interactive.sc-case', {
      type: 'button',
      onclick: function () { startCase(c.id, false); }
    },
      h('div.sc-case-badges', {},
        c.unit ? h('span.badge.neutral', {}, c.unit) : null,
        classBadges(c.classes),
        c.flags.indexOf(KOREA_FLAG) >= 0 ? ui.badge(KOREA_FLAG) : null,
        c.flags.indexOf('ai-drafted') >= 0 ? ui.badge('ai-draft') : null),
      h('h3.sc-case-title', {}, c.title),
      c.setup ? h('p.sc-case-setup.clamp-3', {}, c.setup) : h('p.sc-case-setup.muted', {}, 'Open the case to read the situation.'),
      h('div.sc-case-foot', {},
        h('span', {}, icon('map'), util.plural(decisions, 'decision')),
        c.learning.length ? h('span', {}, icon('layers'), util.plural(c.learning.length, 'learning point')) : null,
        plays ? h('span.sc-case-best', {}, icon('trophy'), 'Best ' + num(g.best) + ' · ' + util.plural(plays, 'run')) : h('span.sc-case-new', {}, 'Not played yet')),
      h('span.sc-case-go', {}, 'Take the case', icon('arrow-right')));
  }
  function emptyCases() {
    var pool = scenarioPool(false);
    return h('div.empty.sc-empty', {}, icon('compass'),
      h('h3', {}, 'Branching cases are not in this build'),
      h('p', {}, 'The "You\'re the KO" cases live in the games module (games.branching.cases). This copy of the app does not carry any. Everything else on this page still works.'),
      h('div.sc-empty-actions', {},
        pool.length ? h('button.btn.primary', { type: 'button', onclick: function () { S.tab = 'board'; S.tabTouched = true; paint(); } }, 'Work the ' + util.plural(pool.length, 'board scenario'), icon('arrow-right')) : null,
        h('button.btn', { type: 'button', onclick: function () { CORB.go('library', { kind: 'scenario' }); } }, icon('book'), 'Scenario questions in the library'),
        h('button.btn.ghost', { type: 'button', onclick: function () { CORB.go('mockboard'); } }, icon('mic'), 'Mock board')));
  }

  // ------------------------------------------------------------------ tab 2: play
  function startCase(id, replay) {
    var cs = caseById(id);
    if (!cs) { ui.toast('That case is not in this build', 'warn'); S.caseId = ''; S.run = null; paint(); return; }
    S.caseId = cs.id;
    S.run = { caseId: cs.id, nodeId: cs.start, score: 0, path: [], pending: null, done: false, recorded: false, steps: 0 };
    R.autofocus = !!replay;
    paint();
  }
  function currentCase() { return caseById(S.caseId || (S.run && S.run.caseId) || ''); }
  function currentNode() {
    var cs = currentCase(); if (!cs || !S.run) return null;
    return cs.nodes[S.run.nodeId] || null;
  }
  function choose(c) {
    var run = S.run; if (!run || run.pending || run.done) return;
    run.score += c.score;
    run.path.push({ node: run.nodeId, label: c.label, score: c.score, feedback: c.feedback });
    run.pending = c;
    R.autofocus = true;
    paint();
  }
  function advance() {
    var run = S.run, cs = currentCase();
    if (!run || !run.pending || !cs) return;
    var nextId = run.pending.next;
    run.pending = null;
    run.steps++;
    if (nextId && cs.nodes[nextId] && run.steps < MAX_STEPS) run.nodeId = nextId;
    else run.done = true;
    R.autofocus = true;
    paint();
  }

  function drawCase() {
    var cs = currentCase();
    if (!cs) { S.caseId = ''; S.run = null; drawCaseIndex(); return; }
    if (!S.run || S.run.caseId !== cs.id) S.run = { caseId: cs.id, nodeId: cs.start, score: 0, path: [], pending: null, done: false, recorded: false, steps: 0 };
    var run = S.run;
    var node = cs.nodes[run.nodeId] || null;
    var choices = run.pending ? [] : choicesOf(node);
    var terminal = run.done || !node || !choices.length;

    var wrap = h('div.sc-play');
    wrap.appendChild(h('div.sc-play-top', {},
      h('button.sc-back', { type: 'button', onclick: function () { S.caseId = ''; S.run = null; R.autofocus = false; paint(); } }, icon('arrow-left'), 'All cases'),
      h('span.grow'),
      h('span.sc-score-chip', {}, icon('target'), h('b.num', {}, signed(run.score)), h('span', {}, 'pts')),
      h('button.btn.sm.ghost', { type: 'button', onclick: function () { startCase(cs.id, true); } }, icon('refresh'), 'Restart')));

    wrap.appendChild(h('div.sc-play-title', {},
      h('h2', {}, cs.title),
      h('div.sc-play-badges', {},
        cs.unit ? h('span.badge.neutral', {}, cs.unit) : null,
        classBadges(cs.classes),
        cs.flags.indexOf(KOREA_FLAG) >= 0 ? ui.badge(KOREA_FLAG) : null,
        cs.flags.indexOf('ai-drafted') >= 0 ? ui.badge('ai-draft') : null)));

    if (cs.setup) {
      var open = run.path.length === 0;
      wrap.appendChild(h('details.acc.sc-brief', { open: open },
        h('summary', {}, icon('map'), 'The situation', icon('chevron', 'chev')),
        h('div.acc-body', {}, safe(function () { return ui.rich(cs.setup); }, h('p.pre', {}, cs.setup)))));
    }

    if (!terminal) {
      wrap.appendChild(nodeCard(node, choices, run));
    } else if (run.pending) {
      wrap.appendChild(nodeCard(node, [], run));
    }
    if (run.pending) wrap.appendChild(feedbackCard(run.pending));
    if (terminal && !run.pending) wrap.appendChild(debrief(cs, run, node));
    if (run.path.length) wrap.appendChild(trail(run, terminal && !run.pending));

    R.body.appendChild(wrap);
    if (R.autofocus) { focusSoon(R.focusTarget); R.autofocus = false; }
  }

  function nodeCard(node, choices, run) {
    var card = h('section.card.sc-node');
    card.appendChild(h('div.sc-node-head', {},
      h('div.eyebrow', {}, run.path.length ? 'Decision ' + (run.path.length + (run.pending ? 0 : 1)) : 'First decision'),
      h('span.grow'),
      choices.length ? h('span.muted.small', {}, 'Press 1–' + choices.length + ' or click') : null));
    var text = str(node && node.text);
    card.appendChild(text ? safe(function () { return ui.rich(text, { cls: 'sc-node-text' }); }, h('p.pre.sc-node-text', {}, text)) : h('p.muted', {}, 'This step has no text in the data.'));
    if (choices.length) {
      var list = h('div.sc-choices', {}, choices.map(function (c, i) {
        var b = h('button.sc-choice', { type: 'button', onclick: function () { choose(c); } },
          h('span.sc-choice-key.num', {}, str(i + 1)),
          h('span.sc-choice-label', {}, c.label),
          h('span.sc-choice-go', {}, icon('arrow-right')));
        if (i === 0) R.focusTarget = b;
        return b;
      }));
      card.appendChild(list);
    }
    return card;
  }

  function feedbackCard(c) {
    var d = num(c.score);
    var tone = d > 0 ? 'ok' : d < 0 ? 'warn' : 'info';
    var btn = h('button.btn.primary.sc-continue', { type: 'button', onclick: advance }, 'Continue', icon('arrow-right'));
    R.focusTarget = btn;
    return h('section.card.sc-feedback.' + tone, {},
      h('div.sc-feedback-head', {},
        icon(tone === 'ok' ? 'check' : tone === 'warn' ? 'alert' : 'info'),
        h('div.grow', {}, h('div.eyebrow', {}, 'You chose'), h('b', {}, c.label)),
        h('span.sc-delta' + (d > 0 ? '.up' : d < 0 ? '.down' : ''), {}, d === 0 ? 'no change' : signed(d) + ' pts')),
      c.feedback ? safe(function () { return ui.rich(c.feedback); }, h('p.pre', {}, c.feedback)) : h('p.muted', {}, 'No feedback was written for this choice.'),
      h('div.sc-feedback-foot', {}, btn, h('span.muted.small', {}, 'Enter continues')));
  }

  function bandFor(score, max) {
    if (max === null || max <= 0) return score > 0 ? ['Run complete', 'ok'] : ['Run complete', 'info'];
    var p = score / max;
    if (p >= 0.85) return ['Board-ready judgment', 'ok'];
    if (p >= 0.6) return ['Workable, with risk', 'warn'];
    return ['Rework this one', 'danger'];
  }
  function debrief(cs, run, node) {
    var max = bestScore(cs);
    if (!run.recorded) {
      run.recorded = true;
      safe(function () { return CORB.scoring.recordGame(gameKey(cs.id), { score: run.score, max: max, decisions: run.path.length, title: cs.title }); }, null);
      paintMetrics();
    }
    var g = gameStats(cs.id);
    var band = bandFor(run.score, max);
    var card = h('section.card.sc-debrief');
    var head = h('div.sc-debrief-top', { tabindex: '-1' },
      h('div.sc-debrief-score.' + band[1], {},
        h('b.num', {}, signed(run.score)),
        h('span', {}, max === null ? 'points' : 'of ' + max + ' possible')),
      h('div.sc-debrief-copy', {},
        h('div.eyebrow', {}, band[0]),
        h('h2', {}, 'Debrief'),
        h('p.muted.small', {}, util.plural(run.path.length, 'decision') + ' · ' + cs.title +
          (num(g.plays) > 1 ? ' · best so far ' + num(g.best) + ' over ' + util.plural(num(g.plays), 'run') : ''))));
    R.focusTarget = head;
    card.appendChild(head);

    var outcome = str(node && node.text);
    if (outcome) card.appendChild(h('div.sc-debrief-outcome', {}, safe(function () { return ui.rich(outcome); }, h('p.pre', {}, outcome))));
    else card.appendChild(h('p.muted.mt-4', {}, 'The case ends here — the data has no closing text for this branch.'));

    if (cs.learning.length) {
      card.appendChild(h('div.panel-soft.sc-learning', {},
        h('div.eyebrow', {}, 'Learning points'),
        h('ul.mt-2', {}, cs.learning.map(function (l) { return h('li', {}, l); }))));
    }
    var row = citeRow(cs.cites, 'Cite');
    if (row) card.appendChild(row);
    if (cs.flags.indexOf(KOREA_FLAG) >= 0) {
      card.appendChild(h('div.callout.warn.mt-4', {}, icon('globe'), h('div', {},
        h('b', {}, 'Korea specifics change locally'),
        'Confirm the current approval levels and local procedure with your Contracting & Policy office before you apply this at work.')));
    }

    var all = cases();
    var idx = -1;
    for (var i = 0; i < all.length; i++) { if (all[i].id === cs.id) { idx = i; break; } }
    var next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
    card.appendChild(h('div.sc-debrief-actions', {},
      h('button.btn.primary', { type: 'button', onclick: function () { startCase(cs.id, true); } }, icon('refresh'), 'Play again'),
      next ? h('button.btn', { type: 'button', onclick: function () { startCase(next.id, true); } }, 'Next case', icon('arrow-right')) : null,
      h('button.btn.ghost', { type: 'button', onclick: function () { S.caseId = ''; S.run = null; paint(); } }, 'All cases'),
      h('button.btn.ghost', { type: 'button', onclick: function () { S.tab = 'board'; S.tabTouched = true; S.caseId = ''; S.run = null; paint(); } }, icon('target'), 'Board scenarios')));
    return card;
  }

  function trail(run, open) {
    return h('details.acc.sc-trail', { open: !!open },
      h('summary', {}, icon('process'), 'Your decisions (' + run.path.length + ')', icon('chevron', 'chev')),
      h('div.acc-body', {}, h('ol.sc-trail-list', {}, run.path.map(function (p) {
        var d = num(p.score);
        return h('li', {},
          h('div.sc-trail-head', {}, h('b', {}, str(p.label)), h('span.sc-delta' + (d > 0 ? '.up' : d < 0 ? '.down' : ''), {}, d === 0 ? 'no change' : signed(d))),
          p.feedback ? h('p.sc-trail-fb', {}, str(p.feedback)) : null);
      }))));
  }

  // ------------------------------------------------------------------ paint / build / leave
  function paint() {
    if (!R || !R.body) return;
    flushNote();
    stopClock();
    clock = null;
    R.saved = null; R.count = null; R.revealBtn = null; R.clockRing = null; R.clockState = null; R.clockBtn = null;
    R.focusTarget = null;
    R.body.innerHTML = '';
    R.body.setAttribute('aria-labelledby', 'sc-tab-' + S.tab);
    paintTabs();
    if (S.tab === 'ko') {
      if (S.caseId || S.run) drawCase(); else drawCaseIndex();
    } else {
      if (S.focusId) drawFocus(); else drawList();
    }
  }

  function build(root) {
    R.root = root;
    root.appendChild(pageHead());
    R.metrics = h('div.sc-metrics');
    root.appendChild(R.metrics);
    paintMetrics();
    R.tabs = tabsEl();
    root.appendChild(R.tabs);
    R.body = h('div.sc-body#sc-panel', { role: 'tabpanel', 'aria-labelledby': 'sc-tab-' + S.tab });
    root.appendChild(R.body);

    keyHandler = function (e) {
      if (!R || !R.body || S.tab !== 'ko' || !S.run || S.run.done) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target, tag = str(t && t.tagName).toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
      if (S.run.pending) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
        return;
      }
      var n = parseInt(e.key, 10);
      if (!(n >= 1 && n <= 9)) return;
      var ch = choicesOf(currentNode());
      if (ch[n - 1]) { e.preventDefault(); choose(ch[n - 1]); }
    };
    document.addEventListener('keydown', keyHandler);

    paint();
  }

  function leave() {
    flushNote();
    stopClock();
    clock = null;
    clearTimeout(searchTimer); searchTimer = null;
    clearTimeout(noteTimer); noteTimer = null;
    noteId = ''; noteEl = null;
    if (keyHandler) { try { document.removeEventListener('keydown', keyHandler); } catch (e) {} keyHandler = null; }
    if (S) last = S;
    R = null;
  }

  CORB.registerView({
    id: 'scenarios', title: 'Scenarios', icon: 'compass', section: 'Practice', order: 130, nav: true, short: 'Scenarios',
    render: function (root, ctx) {
      leave();
      var p = obj(ctx && ctx.params);
      var sig = JSON.stringify(p);
      var hasParams = Object.keys(p).length > 0;
      if (last && sig === lastSig) S = last;
      else if (hasParams) S = fromParams(p);
      else if (last) S = last;
      else S = fresh();

      if (p.id) { S.tab = 'board'; S.tabTouched = true; S.focusId = str(p.id).trim(); }
      if (p['case']) {
        var cid = str(p['case']).trim();
        S.tab = 'ko'; S.tabTouched = true;
        if (S.caseId !== cid) { S.caseId = cid; S.run = null; }
      }
      if (!S.tabTouched && !scenarioPool(false).length && cases().length) S.tab = 'ko';
      S.shown = Math.max(PAGE, num(S.shown));
      lastSig = sig; last = S;
      R = { autofocus: false };
      build(root);
    },
    onLeave: leave
  });
})();
