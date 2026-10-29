/* VIEW: flashcards — spaced repetition over the question bank.
   Three stages in one view: a setup panel (mode, scope, deck size), a one-card-at-a-time
   session with a 3D flip, and a session summary. Grades run through CORB.scoring.srs.grade
   (SM-2 lite), which also stamps progress.seen, so flashcard work feeds dashboard readiness.
   Modes: Due today (srs.due), New cards (srs.newCards), Mixed, Bookmarked, and — when the
   library or dashboard hands over a filter — everything in that scope.
   Params accepted (matches library.studyParams): domain, topic, classes (comma list), kind,
   status, flag, q, bookmarked, unseen, plus mode and count.
   Warrant class: one setting everywhere, profile.targetClass (CORB.warrantClass()). With no explicit
   classes param every card in the set (due, new, reviews, bookmarks) comes from class-eligible
   questions (CORB.data.classEligible), and new cards are ordered by CORB.data.byWarrant, so a Class III
   deck leans about 60/40 toward Class III over the Class I and II fundamentals. An explicit classes
   param (the library's "Study these as flashcards") wins over the profile. The setup select writes it.
   Safe with zero SRS history, a missing/partial question bank, and storage disabled.
   Persists: progress.srs + progress.seen (via scoring), progress.bookmarks, progress.notes
   (shared note editor), progress.flashcards.sessions, settings.flashcards, profile.targetClass. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, util = CORB.util;

  var COUNTS = [10, 20, 40];
  var GRADES = [
    { g: 1, key: '1', label: 'Again', sub: 'Blanked or wrong', cls: 'again' },
    { g: 3, key: '2', label: 'Hard', sub: 'Right, but slow', cls: 'hard' },
    { g: 4, key: '3', label: 'Good', sub: 'Solid answer', cls: 'good' },
    { g: 5, key: '4', label: 'Easy', sub: 'Instant recall', cls: 'easy' }
  ];
  var MODE_IDS = ['due', 'new', 'mixed', 'bookmarked', 'scope'];
  var KINDS = { knowledge: 'Knowledge', scenario: 'Scenario', leadership: 'Leadership' };
  var STATUSES = { official: 'Official answers', 'ai-draft': 'AI drafts', open: 'Open questions' };
  var MASTERED_AT = 60;
  var FLIP_MS = 620, FEEDBACK_MS = 540;

  var S = null;          // stage/session state — survives navigation so a session can be resumed
  var R = {};            // live DOM refs for the current draw
  var rootEl = null;     // the view root the router handed us
  var offs = [];         // teardown callbacks
  var timers = [];
  var keyFn = null;
  var spoke = false;     // this view started the current utterance

  // ------------------------------------------------------------------ helpers
  function safe(fn, fb) { try { var v = fn(); return v === undefined || v === null ? fb : v; } catch (e) { return fb; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return v == null ? '' : String(v); }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function later(fn) { if (typeof fn === 'function') offs.push(fn); }
  function wait(ms, fn) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function reduced() { return safe(function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }, false); }
  function flipMs() { return reduced() ? 0 : FLIP_MS; }
  function feedbackMs() { return reduced() ? 80 : FEEDBACK_MS; }
  function classLabel(c) { return 'Class ' + c; }
  function goto(id, params) { return function () { safe(function () { CORB.go(id, params); }); }; }

  function teardown() {
    timers.forEach(function (t) { clearTimeout(t); }); timers = [];
    offs.forEach(function (f) { try { f(); } catch (e) {} }); offs = [];
    if (keyFn) { document.removeEventListener('keydown', keyFn); keyFn = null; }
    if (spoke) { safe(function () { if (CORB.speech && CORB.speech.stop) CORB.speech.stop(); }); spoke = false; }
    R = {};
  }

  // ------------------------------------------------------------------ srs helpers
  function srsMap() { return obj(CORB.get('progress.srs', {})); }
  function srsFor(id, map) {
    var raw = obj(map || srsMap())[id];
    var s = obj(raw);
    return {
      known: !!raw,
      ef: typeof s.ef === 'number' ? s.ef : 2.5,
      interval: typeof s.interval === 'number' ? s.interval : 0,
      reps: typeof s.reps === 'number' ? s.reps : 0,
      due: str(s.due), last: str(s.last)
    };
  }
  function mastery(id) { return safe(function () { return CORB.scoring.srs.mastery(id) || 0; }, 0); }
  function gradeNow(id, g) { return safe(function () { return CORB.scoring.srs.grade(id, g); }, null); }
  function nextInterval(id, g) {
    var s = srsFor(id);
    if (g < 3) return 1;
    if (!s.known || s.reps === 0) return 1;
    if (s.reps === 1) return 3;
    return Math.max(1, Math.round((s.interval || 1) * s.ef));
  }
  function dayLabel(n) {
    n = Math.max(1, Math.round(n || 1));
    if (n === 1) return 'tomorrow';
    if (n < 30) return 'in ' + n + ' days';
    if (n < 330) return 'in about ' + Math.round(n / 30) + ' months';
    return 'in about ' + (Math.round(n / 36.5) / 10) + ' years';
  }
  function fmtTime(secs) {
    secs = Math.max(0, Math.round(secs || 0));
    if (secs < 60) return secs + 's';
    var m = Math.floor(secs / 60), s = secs % 60;
    return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
  }

  // ------------------------------------------------------------------ scope + pools
  function bankSize() { return safe(function () { return arr(CORB.data.all()).length; }, 0); }
  function classList() { return safe(function () { return arr(CORB.data.CLASSES); }, []).length ? CORB.data.CLASSES : ['I', 'II', 'III', 'IV']; }

  function scopeOf(p) {
    p = obj(p);
    var f = {}, bits = [];
    var domain = str(p.domain).trim(); if (domain) { f.domain = domain; bits.push(domain); }
    var topic = str(p.topic).trim(); if (topic) { f.topic = topic; bits.push(topic); }
    var valid = classList();
    var classes = str(p.classes || p.cls || '').split(',').map(function (x) { return x.trim(); })
      .filter(function (x) { return x && valid.indexOf(x) >= 0; });
    if (classes.length) { f.classes = classes; bits.push(classes.map(classLabel).join(' · ')); }
    var kind = str(p.kind).trim(); if (KINDS[kind]) { f.kind = kind; bits.push(KINDS[kind]); }
    var status = str(p.status).trim(); if (STATUSES[status]) { f.status = status; bits.push(STATUSES[status]); }
    var flag = str(p.flag).trim();
    if (flag) { f.flag = flag; bits.push(flag === 'korea-verify-cp' ? 'Korea procedures' : flag); }
    var q = str(p.q).trim(); if (q) { f.q = q; bits.push('matching "' + q + '"'); }
    if (str(p.bookmarked) === '1' || p.bookmarked === true) { f.bookmarked = true; bits.push('Bookmarked'); }
    if (str(p.unseen) === '1' || p.unseen === true) { f.unseen = true; bits.push('Not yet opened'); }
    return { filter: f, bits: bits, active: bits.length > 0 };
  }

  // ------------------------------------------------------------------ warrant class
  // One setting everywhere: profile.targetClass. Contracting officer classes are cumulative (Class III studies
  // Class I to III), and '' means every question.
  // An explicit classes param wins: when the scope names classes, the profile is not applied.
  function warrant() { return str(safe(function () { return CORB.warrantClass(); }, '')); }
  function warrantFor(filter) { return arr(obj(filter).classes).length ? '' : warrant(); }
  function warrantLabel(cls) { return str(safe(function () { return CORB.data.classLabel(cls); }, cls ? classLabel(cls) : 'All classes')); }
  function eligibleFor(cls) {
    return function (q) { return !cls || !!safe(function () { return CORB.data.classEligible(q, cls); }, true); };
  }
  function lowerClasses(cls) {
    var ko = safe(function () { return arr(CORB.data.KO_CLASSES); }, []);
    var i = ko.indexOf(cls);
    return i > 0 ? ko.slice(0, i) : [];
  }
  function joinClasses(list) { return 'Class ' + (list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list.join('')); }
  // "Class I to III" for the classes a deck draws on; Class I is its own label
  function rangeLabel(cls) {
    var lower = lowerClasses(cls);
    if (!lower.length) return warrantLabel(cls);
    return lower.length === 1 ? joinClasses(lower.concat([cls])) : 'Class ' + lower[0] + ' to ' + cls;
  }

  function partition(filter) {
    filter = obj(filter);
    var cls = warrantFor(filter), keep = eligibleFor(cls);
    var all = safe(function () { return arr(CORB.data.questions(filter)); }, []).filter(keep);
    var map = srsMap(), today = util.today();

    var due = safe(function () { return CORB.scoring.srs.due(filter); }, null);
    if (!Array.isArray(due)) due = all.filter(function (q) { var s = obj(map[q.id]); return !!(s.due && s.due <= today); });
    due = due.filter(Boolean).filter(keep).sort(function (a, b) {
      var sa = srsFor(a.id, map), sb = srsFor(b.id, map);
      if (sa.due !== sb.due) return sa.due < sb.due ? -1 : 1;
      return sa.ef - sb.ef;
    });

    // new cards: class-eligible only, in warrant order (about 60/40 toward the chosen class)
    var fresh = safe(function () { return CORB.scoring.srs.newCards(filter, 9999); }, null);
    if (!Array.isArray(fresh)) fresh = safe(function () { return util.shuffle(all.filter(function (q) { return !map[q.id]; })); }, []);
    fresh = fresh.filter(Boolean).filter(keep);
    if (cls) fresh = safe(function () { return arr(CORB.data.byWarrant(fresh, cls)); }, fresh);

    var taken = {};
    due.forEach(function (q) { taken[q.id] = 1; });
    fresh.forEach(function (q) { taken[q.id] = 1; });
    var rest = all.filter(function (q) { return !taken[q.id]; }).sort(function (a, b) { return mastery(a.id) - mastery(b.id); });

    var mastered = 0, started = 0;
    all.forEach(function (q) { if (map[q.id]) started++; if (mastery(q.id) >= MASTERED_AT) mastered++; });
    return { all: all, due: due, fresh: fresh, rest: rest, mastered: mastered, started: started, cls: cls };
  }

  function buildDeck(mode, count, filter) {
    var f = Object.assign({}, obj(filter));
    if (mode === 'bookmarked') f.bookmarked = true;
    var p = partition(f);
    var deck = [], seen = {};
    function add(list) {
      for (var i = 0; i < list.length && deck.length < count; i++) {
        var q = list[i];
        if (!q || !q.id || seen[q.id]) continue;
        seen[q.id] = 1; deck.push(q);
      }
    }
    if (mode === 'due') add(p.due);
    else if (mode === 'new') add(p.fresh);
    else if (mode === 'mixed') {
      var share = Math.min(p.due.length, Math.max(1, Math.ceil(count * 0.6)));
      add(p.due.slice(0, share)); add(p.fresh); add(p.due); add(p.rest);
      deck = safe(function () { return util.shuffle(deck); }, deck);
    } else { add(p.due); add(p.fresh); add(p.rest); }
    return deck;
  }

  // Bookmarks follow the warrant class too; say so when that hides some of them.
  function bookmarkDesc(bm, scope) {
    var hidden = 0;
    if (bm.cls) {
      var total = safe(function () { return arr(CORB.data.questions(Object.assign({}, obj(scope.filter), { bookmarked: true, anyClass: true }))).length; }, 0);
      hidden = Math.max(0, total - bm.all.length);
    }
    if (bm.all.length) return 'The questions you starred in the library.' + (hidden ? ' ' + util.plural(hidden, 'more starred question') + ' outside your warrant class ' + (hidden === 1 ? 'is' : 'are') + ' not shown.' : '');
    if (hidden) return (hidden === 1 ? 'Your starred question is' : 'All ' + hidden + ' of your starred questions are') + ' outside your warrant class. Switch the class above to study ' + (hidden === 1 ? 'it.' : 'them.');
    return 'Bookmark questions in the library and they land here.';
  }

  function modeCards(scope) {
    var base = partition(scope.filter);
    var bm = partition(Object.assign({}, scope.filter, { bookmarked: true }));
    var list = [
      { id: 'due', label: 'Due today', icon: 'clock', n: base.due.length,
        desc: base.due.length ? 'Cards the schedule says you are closest to forgetting.' : 'Nothing is scheduled for today — start a new batch instead.' },
      { id: 'new', label: 'New cards', icon: 'plus', n: base.fresh.length,
        desc: base.fresh.length
          ? 'Questions you have never graded, ' + (lowerClasses(base.cls).length ? 'weighted toward ' + warrantLabel(base.cls) + '.' : 'drawn at random.')
          : 'Every question in this set is already in the schedule.' },
      { id: 'mixed', label: 'Mixed', icon: 'shuffle', n: base.all.length,
        desc: 'Everything due, blended with new cards and your weakest reviews.' },
      { id: 'bookmarked', label: 'Bookmarked', icon: 'bookmark', n: bm.all.length,
        desc: bookmarkDesc(bm, scope) }
    ];
    if (scope.active) list.push({ id: 'scope', label: 'Everything in scope', icon: 'filter', n: base.all.length, desc: scope.bits.join(' · ') });
    return { list: list, base: base, bm: bm };
  }
  function modeMeta(id) {
    var known = { due: ['Due today', 'clock'], 'new': ['New cards', 'plus'], mixed: ['Mixed', 'shuffle'], bookmarked: ['Bookmarked', 'bookmark'], scope: ['In scope', 'filter'] };
    return known[id] || known.mixed;
  }

  // ------------------------------------------------------------------ session state
  function freshState(scope, sig, params) {
    var saved = obj(CORB.get('settings.flashcards', {}));
    var mode = str(params.mode) || str(saved.mode) || 'due';
    if (MODE_IDS.indexOf(mode) < 0) mode = 'due';
    if (mode === 'scope' && !scope.active) mode = 'mixed';
    var count = parseInt(str(params.count) || str(saved.count), 10);
    if (COUNTS.indexOf(count) < 0) count = 10;
    return {
      stage: 'setup', mode: mode, count: count, scope: scope, sig: sig,
      deck: [], i: 0, flipped: false, steps: [], locked: false,
      startedAt: 0, endedAt: 0, recorded: false
    };
  }
  function startSession(deck) {
    if (!deck.length) { ui.toast('Nothing to study in that selection yet.', 'warn'); return; }
    S.deck = deck; S.i = 0; S.flipped = false; S.steps = []; S.locked = false;
    S.startedAt = Date.now(); S.endedAt = 0; S.recorded = false; S.stage = 'session';
    safe(function () { CORB.set('settings.flashcards', { mode: S.mode, count: S.count }); });
    draw();
  }
  function startFromIds(ids) {
    var deck = arr(ids).map(function (id) { return safe(function () { return CORB.data.byId(id); }, null); }).filter(Boolean);
    if (!deck.length) { ui.toast('Those cards are no longer in this set.', 'warn'); return; }
    startSession(deck);
  }

  // ------------------------------------------------------------------ draw
  function draw() {
    if (!rootEl) return;
    teardown();
    rootEl.innerHTML = '';
    if (!bankSize()) return renderNoBank(rootEl);
    if (!S) return;
    if (S.stage === 'session') renderSession(rootEl);
    else if (S.stage === 'summary') renderSummary(rootEl);
    else renderSetup(rootEl);
  }

  // ------------------------------------------------------------------ empty states
  function renderNoBank(root) {
    root.appendChild(h('div.fc-void', {},
      h('div.fc-void-icon', {}, icon('cards')),
      h('h1', {}, 'Flashcards need the question bank'),
      h('p.lede', {}, 'This copy of the app did not load any questions, so there is nothing to schedule. The warrant process guide, the regulation explorer and the glossary do not depend on the bank and still work.'),
      h('div.fc-void-actions', {},
        h('button.btn.primary', { onclick: goto('process') }, icon('process'), 'Warrant process guide'),
        h('button.btn', { onclick: goto('regulations') }, icon('map'), 'Regulation explorer'),
        h('button.btn.ghost', { onclick: goto('dashboard') }, icon('dashboard'), 'Dashboard'))));
  }

  function renderScopeEmpty(root, scope) {
    var unit = safe(function () { return CORB.unitName(CORB.unit()); }, '') || 'your organization';
    var cls = warrantFor(scope.filter);
    // empty because of the warrant class (the same scope has questions in other classes)?
    var byClass = !!cls && safe(function () { return arr(CORB.data.questions(Object.assign({}, obj(scope.filter), { anyClass: true }))).length; }, 0) > 0;
    root.appendChild(setupHead(scope, warrantRow(scope)));
    root.appendChild(h('div.fc-void.fc-void-inline', {},
      h('div.fc-void-icon', {}, icon('filter')),
      h('h2', {}, byClass ? 'No cards for ' + warrantLabel(cls) + ' here' : 'No cards match this filter'),
      h('p.lede', {}, byClass
        ? 'Nothing in ' + unit + (scope.active ? ' that matches ' + scope.bits.join(' · ') : '') + ' is ' +
          (lowerClasses(cls).length || cls === 'I' ? 'tagged ' + rangeLabel(cls) : 'on the ' + warrantLabel(cls) + ' track') +
          '. Pick another warrant class above' + (scope.active ? ', clear the filter,' : '') + ' or switch the organization filter at the top of the screen.'
        : scope.active
          ? 'Nothing in ' + unit + ' matches ' + scope.bits.join(' · ') + '. Clear the filter to study the whole set, or widen it in the library.'
          : 'The organization filter at the top of the screen is hiding every question. Switch it to another organization or to all of them.'),
      h('div.fc-void-actions', {},
        scope.active ? h('button.btn.primary', { onclick: goto('flashcards') }, icon('refresh'), 'Clear the filter') : null,
        h('button.btn', { onclick: goto('library') }, icon('book'), 'Open the library'),
        h('button.btn.ghost', { onclick: goto('dashboard') }, icon('dashboard'), 'Dashboard'))));
  }

  // ------------------------------------------------------------------ setup
  function setupHead(scope, extra) {
    return h('header.fc-head', {},
      h('h1', {}, 'Flashcards'),
      h('p.lede', {}, 'One question at a time — grade yourself honestly and it returns before you forget it.'),
      scope && scope.active ? h('div.fc-scope', {},
        h('span.fc-scope-icon', {}, icon('filter')),
        h('div.fc-scope-copy', {},
          h('span.fc-scope-label', {}, 'Studying a filtered set'),
          h('span.fc-scope-bits', {}, scope.bits.join(' · '))),
        h('button.btn.sm.ghost', { onclick: goto('flashcards') }, icon('x'), 'Clear')) : null,
      extra || null);
  }

  // The warrant control: one shared line and Change button (ui.classLine), same as every other page.
  function warrantNote(scope) {
    var cls = warrant(), lower = lowerClasses(cls);
    var named = arr(obj(scope && scope.filter).classes);
    if (named.length) return 'This set was opened for ' + named.map(classLabel).join(' · ') + ', which takes the place of your warrant class here. Clear the filter to study by warrant class.';
    if (!cls) return 'Due and new cards come from every class.';
    if (lower.length) return 'Due and new cards come only from ' + rangeLabel(cls) + ', and new cards lean about 60/40 toward ' + warrantLabel(cls) + ' over the ' + joinClasses(lower) + ' fundamentals.';
    return 'Due and new cards come only from ' + (cls === 'I' ? 'questions tagged Class I.' : 'the ' + warrantLabel(cls) + ' track.');
  }
  function warrantRow(scope) { return ui.classLine({ note: warrantNote(scope) }); }

  function statTile(label, value, sub, tone) {
    return h('div.fc-stat' + (tone ? '.' + tone : ''), {},
      h('span.fc-stat-label', {}, label),
      h('span.fc-stat-value.num', {}, str(value)),
      h('span.fc-stat-sub', {}, sub));
  }

  function studiedToday() {
    var hist = CORB.get('progress.flashcards.sessions', []);
    if (!Array.isArray(hist)) return null;
    var today = util.today(), cards = 0, runs = 0;
    hist.forEach(function (r) {
      if (!r || str(r.ts).slice(0, 10) !== today) return;
      runs++; cards += (typeof r.graded === 'number' ? r.graded : 0);
    });
    return runs ? { runs: runs, cards: cards } : null;
  }

  // singular noun for the one-line summary ("10 new cards"); util.plural appends "s" except where overridden
  var MODE_NOUN = { due: 'due card', 'new': 'new card', mixed: 'mixed card', bookmarked: 'bookmarked card', scope: 'card in scope' };
  var MODE_NOUN_PL = { scope: 'cards in scope' };

  function renderSetup(root) {
    var scope = S.scope;
    var m = modeCards(scope);
    var base = m.base;
    if (!base.all.length && !m.bm.all.length) return renderScopeEmpty(root, scope);

    var sel = m.list.filter(function (x) { return x.id === S.mode; })[0];
    if (!sel || !sel.n) {
      var alt = m.list.filter(function (x) { return x.n > 0; })[0];
      if (alt) { S.mode = alt.id; sel = alt; }
    }
    if (!sel) sel = m.list[0];

    var page = h('div.fc-setup', {});
    page.appendChild(setupHead(scope));

    var today = studiedToday();
    if (today) page.appendChild(h('p.fc-today', {}, icon('check'),
      h('span', {}, util.plural(today.cards, 'card') + ' graded today across ' + util.plural(today.runs, 'session') + '. Keep going or come back tomorrow — the schedule holds either way.')));

    // ---- start first (D3): one-line summary, then the button ----
    var planned = Math.min(S.count, sel.n || 0);
    var summary = (planned ? util.plural(planned, MODE_NOUN[S.mode] || 'card', MODE_NOUN_PL[S.mode]) : 'Nothing to study yet')
      + (base.cls ? ' · ' + warrantLabel(base.cls) : '') + (scope.active ? ' · ' + scope.bits.join(' · ') : '');
    page.appendChild(h('div.fc-launch', {},
      h('div.fc-launch-copy', {},
        h('span.fc-launch-label', {}, 'Ready'),
        h('span.fc-launch-line', {}, summary)),
      h('button.btn.lg.primary.fc-launch-btn', {
        disabled: !planned,
        onclick: function () { startSession(buildDeck(S.mode, S.count, scope.filter)); }
      }, icon('play'), planned ? 'Start studying' : 'Nothing to study')));

    // ---- everything else, collapsed behind one "Change settings" (D3) ----
    var modeGrid = h('div.fc-modes', {}, m.list.filter(function (x) { return x.n > 0; }).map(function (x) {
      var on = x.id === S.mode;
      return h('button.fc-mode' + (on ? '.on' : ''), {
        'aria-pressed': on ? 'true' : 'false',
        onclick: function () { S.mode = x.id; draw(); }
      },
        h('span.fc-mode-icon', {}, icon(x.icon)),
        h('span.fc-mode-top', {}, h('b', {}, x.label), h('span.fc-mode-n.num', {}, str(x.n))),
        h('span.fc-mode-desc', {}, x.desc));
    }));
    var sizeSeg = h('div.seg.fc-seg', {}, COUNTS.map(function (n) {
      return h('button' + (n === S.count ? '.on' : ''), { 'aria-pressed': n === S.count ? 'true' : 'false', onclick: function () { S.count = n; draw(); } }, str(n) + ' cards');
    }));
    var sizeNote = sel.n && S.count > sel.n ? ('Only ' + util.plural(sel.n, 'card') + ' available right now.') : '';
    page.appendChild(h('details.acc.fc-settings', {},
      h('summary', {}, icon('settings'), 'Change settings', icon('chevron', 'chev')),
      h('div.acc-body', {},
        warrantRow(scope),
        h('div.fc-block', {},
          h('div.fc-block-head', {}, h('h2', {}, 'What should the deck be?'), h('p', {}, 'Due cards first is the honest default. New cards build coverage; mixed does both.')),
          modeGrid),
        h('div.fc-block', {},
          h('div.fc-block-head', {}, h('h2', {}, 'How many this sitting?'), h('p', {}, 'Ten is a coffee break. Forty is a long study block.')),
          h('div.fc-size-row', {}, sizeSeg, sizeNote ? h('span.fc-size-note', {}, sizeNote) : null)))));

    // class changes made from the picker (opened via the line above) redraw this panel
    later(CORB.on('change', function (e) { if (e && (e.path === 'profile.targetClass' || e.path === '*')) draw(); }));

    page.appendChild(h('details.acc.fc-how', {},
      h('summary', {}, icon('info'), 'How it works', icon('chevron', 'chev')),
      h('div.acc-body', {},
        h('p', {}, 'Every grade updates when the card comes back. ',
          h('b', {}, 'Again'), ' resets it to tomorrow. ',
          h('b', {}, 'Hard'), ', ', h('b', {}, 'Good'), ' and ', h('b', {}, 'Easy'),
          ' stretch the gap further each time — one day, then three, then longer. Mastery on the dashboard is 30 percent of your readiness score.'),
        h('div.fc-keys', {},
          keyHint('Space', 'flip'), keyHint('1–4', 'grade'), keyHint('N', 'skip'), keyHint('B', 'bookmark'),
          CORB.speech && CORB.speech.available ? keyHint('R', 'read aloud') : null))));

    root.appendChild(page);
  }
  function keyHint(k, label) { return h('span.fc-key', {}, h('kbd', {}, k), h('span', {}, label)); }

  // ------------------------------------------------------------------ session
  function renderSession(root) {
    var deck = arr(S.deck);
    if (!deck.length) { S.stage = 'setup'; return renderSetup(root); }
    if (S.i >= deck.length) { S.stage = 'summary'; return renderSummary(root); }

    var meta = modeMeta(S.mode);
    R.counter = h('span.fc-counter.num', { 'aria-live': 'polite' }, '');
    R.fill = h('span', { style: { width: '0%' } });
    R.undo = h('button.btn.sm.ghost.fc-undo', { onclick: undo }, icon('arrow-left'), 'Undo');
    R.undo.hidden = true;

    var bar = h('header.fc-topbar', {},
      h('div.fc-topbar-left', {},
        h('span.fc-chip', {}, icon(meta[1]), meta[0]),
        S.scope.active ? h('span.fc-chip.soft.truncate', { title: S.scope.bits.join(' · ') }, icon('filter'), S.scope.bits.join(' · ')) : null),
      h('div.fc-topbar-right', {}, R.counter, R.undo,
        h('button.btn.sm.ghost', { onclick: endEarly }, icon('x'), 'End session')));

    var progress = h('div.bar.fc-progress', {}, R.fill);

    R.stage = h('div.fc-stage', {});
    R.dock = h('div.fc-dock', {});

    root.appendChild(h('div.fc-session', {}, bar, progress, R.stage, R.dock,
      h('div.fc-keys.fc-keys-session', {},
        keyHint('Space', 'flip'), keyHint('1–4', 'grade'), keyHint('N', 'skip'), keyHint('B', 'bookmark'),
        CORB.speech && CORB.speech.available ? keyHint('R', 'read aloud') : null)));

    bindKeys();
    if (CORB.speech && CORB.speech.available) {
      later(CORB.on('speech', function (ev) {
        var on = !!(ev && ev.speaking) && spoke;
        if (!(ev && ev.speaking)) spoke = false;
        if (R.tts) { ui.mount(R.tts, [icon(on ? 'stop' : 'volume')]); R.tts.classList.toggle('on', on); }
      }));
    }
    mountCard();
  }

  function mountCard() {
    if (!R.stage || !S) return;
    var q = S.deck[S.i];
    if (!q) return finish();
    if (spoke) { safe(function () { CORB.speech.stop(); }); spoke = false; }

    R.flash = h('div.fc-flash', {});
    var front = h('div.fc-face.fc-front', {}, frontFace(q));
    var back = h('div.fc-face.fc-back', {}, backFace(q));
    var card = h('div.fc-card', { onclick: function (e) {
      if (S.flipped || S.locked) return;
      var t = e.target;
      if (t && t.closest && t.closest('button, a, summary, input, textarea, select')) return;
      setFlip(true);
    } }, front, back);

    R.card = card; R.front = front; R.back = back;
    ui.mount(R.stage, [h('div.fc-stage-inner', {}, card, R.flash)]);

    S.flipped = false;
    card.classList.remove('is-flipped', 'is-graded');
    back.style.visibility = 'hidden';
    front.style.visibility = '';
    paintDock();
    paintProgress();
  }

  function frontFace(q) {
    var classes = arr(q.classes);
    var s = srsFor(q.id);
    var m = mastery(q.id);
    var state = !s.known ? 'New card' : m >= MASTERED_AT ? 'Mastered' : 'Learning';
    var tools = h('div.fc-face-tools', {}, ttsButton(), bmButton(q));
    return [
      h('div.fc-face-top', {},
        h('div.fc-tags', {},
          safe(function () { return ui.classBadges(classes); }, null),
          q.domain ? h('span.badge.neutral', {}, str(q.domain)) : null,
          q.topic ? h('span.fc-topic', {}, str(q.topic)) : null),
        tools),
      h('div.fc-q', {}, h('p.fc-q-text', {}, str(q.question) || 'This card has no question text.')),
      h('div.fc-face-foot', {},
        h('div.fc-mastery', {},
          h('span.fc-mastery-label', {}, state),
          h('span.fc-mastery-bar', {}, h('span', { style: { width: Math.max(3, m) + '%' } })),
          h('span.fc-mastery-num.num', {}, m + '%')),
        h('span.fc-reveal-hint', {}, 'Tap the card or press Space to reveal'),
        h('span.fc-id.num', {}, str(q.id)))
    ];
  }

  function backFace(q) {
    var nodes = [];
    var flags = safe(function () { return arr(ui.flagsFor(q)); }, []);
    nodes.push(h('div.fc-face-top', {},
      h('div.fc-tags', {}, flags.map(function (f) { return safe(function () { return ui.badge(f); }, null); })),
      h('span.fc-id.num', {}, str(q.id))));
    nodes.push(h('p.fc-back-q', {}, str(q.question)));

    var status = str(q.answer_status);
    var text = status === 'open' ? '' : str(q.answer);
    var draftHidden = status === 'ai-draft' && !CORB.get('settings.showDrafts', true);
    var keys = !draftHidden && text ? arr(q.key_points).filter(Boolean) : [];
    var cross = arr(obj(q.rfo).crosswalk).filter(function (c) { return c && c.old && c.new; });
    var crossNode = cross.length ? h('p.fc-crosswalk.small.muted', {}, 'RFO crosswalk: ' + cross.map(function (c) { return c.old + ' → ' + c.new; }).join(' · ')) : null;

    // lead with "Say these" — the key points come before the full write-up
    if (keys.length) nodes.push(h('div.fc-keypoints', {},
      h('div.eyebrow', {}, 'Say these'),
      h('ul', {}, keys.map(function (k) { return h('li', {}, str(k)); }))));

    if (draftHidden) {
      nodes.push(h('div.fc-a', {}, h('p.muted', {}, 'The AI-drafted answer is hidden by your settings. Turn drafts back on in Settings to study it.')));
    } else if (!text) {
      nodes.push(h('div.fc-a.fc-a-open', {},
        h('p', {}, 'The repository has no formal answer for this one. Say your answer out loud, then write it down and check it with a mentor.'),
        h('button.btn.sm.mt-3', { onclick: function () { safe(function () { ui.noteEditor(q); }); } }, icon('note'), 'Write my answer')));
    } else if (keys.length) {
      // the write-up (and the RFO crosswalk) sit behind one collapsed "Full answer"
      nodes.push(h('details.acc.mt-1.fc-full', {},
        h('summary', {}, icon('book'), 'Full answer', icon('chevron', 'chev')),
        h('div.acc-body', {}, h('div.fc-a', {}, safe(function () { return ui.rich(text); }, h('p', {}, text))), crossNode)));
      crossNode = null;
    } else {
      nodes.push(h('div.fc-a', {}, safe(function () { return ui.rich(text); }, h('p', {}, text))));
    }

    var note = str(CORB.get('progress.notes.' + q.id, ''));
    if (note) nodes.push(h('div.fc-note', {}, h('div.eyebrow', {}, 'My notes'), h('p', {}, note)));

    var alts = arr(q.alt_answers).filter(function (d) { return d && str(d.text); });
    if (alts.length) nodes.push(h('details.acc.fc-acc', {},
      h('summary', {}, icon('message'), 'Another way to say it (' + alts.length + ')', icon('chevron', 'chev')),
      h('div.acc-body', {}, alts.map(function (d) {
        return h('div.fc-deck-note', {}, h('div.eyebrow', {}, str(d.src) || 'Alternate'), safe(function () { return ui.rich(str(d.text)); }, h('p', {}, str(d.text))));
      }))));

    // one cite list, built from the structured citation fields (not parsed out of the prose above)
    var cites = arr(q.citations_rfo).length ? arr(q.citations_rfo) : arr(q.citations);
    cites = cites.filter(Boolean);
    if (cites.length) nodes.push(h('div.fc-cites', {}, h('span.fc-cites-label', {}, 'Cite'),
      cites.map(function (c) {
        var u = safe(function () { return CORB.data.citeUrl(c); }, null);
        return u ? h('a.cite', { href: u, target: '_blank', rel: 'noopener' }, str(c)) : h('span.cite', {}, str(c));
      })));

    if (crossNode) nodes.push(crossNode);

    nodes.push(h('div.fc-back-tools', {},
      h('button.btn.sm.ghost', { onclick: function () { safe(function () { ui.noteEditor(q); }); } }, icon('note'), 'Notes'),
      h('button.btn.sm.ghost', { onclick: goto('library', { id: q.id }) }, icon('book'), 'Open in library'),
      h('button.btn.sm.ghost', { onclick: goto('mentor', { q: str(q.question).slice(0, 200) }) }, icon('chat'), 'Ask the mentor')));
    return nodes;
  }

  function ttsButton() {
    if (!(CORB.speech && CORB.speech.available)) return null;
    var b = h('button.btn.icon.sm.ghost.fc-tts', {
      'aria-label': 'Read this card aloud', 'data-tip': 'Read aloud (R)',
      onclick: function (e) { e.stopPropagation(); readAloud(); }
    }, icon('volume'));
    R.tts = b;
    return b;
  }
  function readAloud() {
    if (!(CORB.speech && CORB.speech.available) || !S) return;
    var q = S.deck[S.i]; if (!q) return;
    if (CORB.speech.speaking && spoke) { safe(function () { CORB.speech.stop(); }); spoke = false; return; }
    var text = S.flipped ? (str(q.answer) || str(q.question)) : str(q.question);
    if (!text) return;
    spoke = true;
    var ok = safe(function () { return CORB.speech.speak(text); }, false);
    if (!ok) { spoke = false; ui.toast('Read-aloud is switched off in Settings.'); }
  }

  function bmButton(q) {
    var on = !!CORB.get('progress.bookmarks.' + q.id);
    var b = h('button.btn.icon.sm.ghost.fc-bm' + (on ? '.on' : ''), {
      'aria-label': 'Bookmark this question', 'aria-pressed': on ? 'true' : 'false', 'data-tip': 'Bookmark (B)',
      onclick: function (e) { e.stopPropagation(); toggleBookmark(); }
    }, icon('bookmark'));
    R.bm = b;
    return b;
  }
  function toggleBookmark() {
    if (!S) return;
    var q = S.deck[S.i]; if (!q) return;
    var v = !CORB.get('progress.bookmarks.' + q.id);
    safe(function () { CORB.set('progress.bookmarks.' + q.id, v); });
    if (R.bm) { R.bm.classList.toggle('on', v); R.bm.setAttribute('aria-pressed', v ? 'true' : 'false'); }
    ui.toast(v ? 'Bookmarked' : 'Bookmark removed');
  }

  function setFlip(v) {
    if (!R.card || !S) return;
    S.flipped = !!v;
    R.card.classList.toggle('is-flipped', S.flipped);
    R.front.style.visibility = ''; R.back.style.visibility = '';
    var hide = S.flipped ? R.front : R.back;
    wait(flipMs(), function () { if (hide && hide.parentNode) hide.style.visibility = 'hidden'; });
    if (S.flipped) {
      var q = S.deck[S.i];
      if (q) safe(function () { CORB.set('progress.seen.' + q.id, util.today(), { silent: true }); });
    }
    paintDock();
  }
  function toggleFlip() { if (!S.locked) setFlip(!S.flipped); }

  function dockNodes() {
    var q = S.deck[S.i];
    if (!q) return [];
    if (!S.flipped) {
      return [h('div.fc-dock-reveal', {},
        h('button.btn.lg.primary.fc-reveal', { onclick: function () { setFlip(true); } }, icon('eye'), 'Show answer', h('kbd', {}, 'Space')),
        h('button.btn.lg.fc-skip', { onclick: skip }, 'Skip', icon('arrow-right')))];
    }
    return [
      h('div.fc-grades', {}, GRADES.map(function (g) {
        var n = nextInterval(q.id, g.g);
        return h('button.fc-grade.' + g.cls, {
          'aria-label': g.label + ' — next review ' + dayLabel(n),
          onclick: function () { grade(g.g); }
        },
          h('span.fc-grade-key.num', {}, g.key),
          h('span.fc-grade-label', {}, g.label),
          h('span.fc-grade-sub', {}, g.sub));
      })),
      h('div.fc-dock-foot', {},
        h('button.btn.sm.ghost', { onclick: function () { setFlip(false); } }, icon('refresh'), 'Flip back'),
        h('button.btn.sm.ghost', { onclick: skip }, icon('arrow-right'), 'Skip without grading'))
    ];
  }
  function paintDock() {
    if (!R.dock) return;
    var had = R.dock.contains(document.activeElement);
    ui.mount(R.dock, dockNodes());
    if (had) { var b = R.dock.querySelector('button'); if (b) b.focus(); }
  }
  function paintProgress() {
    var total = arr(S.deck).length || 1;
    var done = Math.min(S.i, total);
    if (R.fill) R.fill.style.width = util.pct(done, total) + '%';
    if (R.counter) R.counter.textContent = 'Card ' + Math.min(S.i + 1, total) + ' of ' + total;
    if (R.undo) R.undo.hidden = !arr(S.steps).length;
  }

  function grade(g) {
    if (!S || S.stage !== 'session' || S.locked) return;
    var q = S.deck[S.i]; if (!q) return;
    S.locked = true;
    var map = srsMap();
    var before = map[q.id] ? safe(function () { return util.deepClone(map[q.id]); }, null) : undefined;
    var planned = nextInterval(q.id, g);
    var mB = mastery(q.id);
    var res = gradeNow(q.id, g);
    var mA = mastery(q.id);
    var interval = res && typeof res.interval === 'number' ? res.interval : planned;
    S.steps.push({ id: q.id, kind: 'grade', grade: g, before: before, interval: interval, due: res ? str(res.due) : '', mB: mB, mA: mA, domain: str(q.domain), question: str(q.question) });
    flashFeedback(g, interval);
    wait(feedbackMs(), function () { S.locked = false; S.i++; S.flipped = false; mountCard(); });
  }
  function flashFeedback(g, n) {
    var meta = GRADES.filter(function (x) { return x.g === g; })[0] || GRADES[2];
    if (R.card) R.card.classList.add('is-graded');
    if (!R.flash) return;
    R.flash.className = 'fc-flash on ' + meta.cls;
    ui.mount(R.flash, [icon(g < 3 ? 'refresh' : 'check'), h('span', {}, meta.label + ' · back ' + dayLabel(n))]);
  }
  function skip() {
    if (!S || S.locked) return;
    var q = S.deck[S.i]; if (!q) return;
    S.steps.push({ id: q.id, kind: 'skip', domain: str(q.domain), question: str(q.question) });
    S.i++; S.flipped = false; mountCard();
  }
  function undo() {
    if (!S || !arr(S.steps).length || S.locked) return;
    var last = S.steps.pop();
    if (last.kind === 'grade') safe(function () {
      if (last.before) { CORB.set('progress.srs.' + last.id, last.before); return; }
      var map = srsMap(); delete map[last.id]; CORB.set('progress.srs', map);
    });
    S.i = Math.max(0, S.i - 1);
    mountCard();
    if (last.kind === 'grade') { setFlip(true); ui.toast('Grade undone'); }
  }
  function endEarly() {
    if (!S) return;
    if (!arr(S.steps).length) { S.stage = 'setup'; draw(); return; }
    safe(function () {
      ui.confirm('End this session now? Everything you already graded is saved.', { ok: 'End session', title: 'End session' })
        .then(function (yes) { if (yes) finish(); });
    });
  }
  function finish() {
    if (!S) return;
    S.stage = 'summary';
    S.endedAt = Date.now();
    recordSession();
    draw();
  }

  function recordSession() {
    if (!S || S.recorded) return;
    var steps = arr(S.steps);
    if (!steps.length) { S.recorded = true; return; }
    var graded = steps.filter(function (s) { return s.kind === 'grade'; });
    var g = { again: 0, hard: 0, good: 0, easy: 0 };
    graded.forEach(function (s) { g[s.grade < 3 ? 'again' : s.grade === 3 ? 'hard' : s.grade === 4 ? 'good' : 'easy']++; });
    var rec = {
      ts: new Date().toISOString(), mode: S.mode, planned: arr(S.deck).length,
      graded: graded.length, skipped: steps.length - graded.length, grades: g,
      seconds: Math.max(0, Math.round(((S.endedAt || Date.now()) - (S.startedAt || Date.now())) / 1000))
    };
    var hist = CORB.get('progress.flashcards.sessions', []);
    if (!Array.isArray(hist)) hist = [];
    hist.push(rec);
    safe(function () { CORB.set('progress.flashcards.sessions', hist.slice(-40)); });
    S.recorded = true;
  }

  // ------------------------------------------------------------------ keyboard
  function bindKeys() {
    if (keyFn) return;
    keyFn = function (e) {
      if (!S || S.stage !== 'session' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      var tag = str(t && t.tagName).toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
      if (document.querySelector('.modal-scrim')) return;
      var k = e.key;
      if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
        if (tag === 'button' || tag === 'a' || tag === 'summary') return;   // let the control handle it
        e.preventDefault(); toggleFlip(); return;
      }
      if (k === 'n' || k === 'N' || k === 'ArrowRight') { e.preventDefault(); skip(); return; }
      if (k === 'b' || k === 'B') { e.preventDefault(); toggleBookmark(); return; }
      if (k === 'r' || k === 'R') { e.preventDefault(); readAloud(); return; }
      var i = ['1', '2', '3', '4'].indexOf(k);
      if (i >= 0) {
        e.preventDefault();
        if (!S.flipped) { setFlip(true); return; }
        grade(GRADES[i].g);
      }
    };
    document.addEventListener('keydown', keyFn);
  }

  // ------------------------------------------------------------------ summary
  function renderSummary(root) {
    var steps = arr(S.steps);
    var graded = steps.filter(function (s) { return s.kind === 'grade'; });
    var skipped = steps.length - graded.length;
    var secs = Math.max(0, Math.round(((S.endedAt || Date.now()) - (S.startedAt || Date.now())) / 1000));
    var counts = {};
    GRADES.forEach(function (g) { counts[g.g] = 0; });
    graded.forEach(function (s) { counts[s.grade] = (counts[s.grade] || 0) + 1; });
    var mB = 0, mA = 0;
    graded.forEach(function (s) { mB += s.mB || 0; mA += s.mA || 0; });
    var avgB = graded.length ? Math.round(mB / graded.length) : 0;
    var avgA = graded.length ? Math.round(mA / graded.length) : 0;
    var delta = avgA - avgB;
    var again = graded.filter(function (s) { return s.grade < 3; });
    var dueLeft = partition(S.scope.filter).due.length;
    var meta = modeMeta(S.mode);

    var page = h('div.fc-summary', {});
    page.appendChild(h('header.fc-sum-head', {},
      h('div.fc-sum-mark', {}, icon(graded.length ? 'trophy' : 'cards')),
      h('div', {},
        h('div.eyebrow', {}, meta[0] + (S.scope.active ? ' · ' + S.scope.bits.join(' · ') : '')),
        h('h1', {}, graded.length ? 'Session complete' : 'Session ended'),
        h('p.lede', {}, graded.length
          ? util.plural(graded.length, 'card') + ' graded in ' + fmtTime(secs) + '. Each one is now scheduled to come back on its own day.'
          : 'Nothing was graded this time, so the schedule is unchanged. Come back when you have ten quiet minutes.'))));

    page.appendChild(h('div.fc-stats', {},
      statTile('Cards graded', graded.length, skipped ? util.plural(skipped, 'card') + ' skipped' : 'none skipped'),
      statTile('Time', fmtTime(secs), graded.length ? Math.max(1, Math.round(secs / graded.length)) + 's per card' : 'this sitting'),
      statTile('Mastery', (delta >= 0 ? '+' : '') + delta, avgB + '% → ' + avgA + '% average', delta > 0 ? 'good' : delta < 0 ? 'hot' : ''),
      statTile('Still due', dueLeft, dueLeft ? 'cards in this set' : 'you are clear for today', dueLeft ? 'hot' : 'good')));

    if (graded.length) {
      page.appendChild(h('section.fc-block', {},
        h('div.fc-block-head', {}, h('h2', {}, 'How you graded yourself'), h('p', {}, 'Honest "Again" grades are what make the schedule work.')),
        h('div.fc-breakdown', {}, GRADES.map(function (g) {
          var n = counts[g.g] || 0;
          return h('div.fc-break-row.' + g.cls, {},
            h('span.fc-break-label', {}, g.label),
            h('span.fc-break-bar', {}, h('span', { style: { width: util.pct(n, graded.length) + '%' } })),
            h('span.fc-break-n.num', {}, str(n)));
        }))));
    }

    if (again.length) {
      page.appendChild(h('section.fc-block', {},
        h('div.fc-block-head', {}, h('h2', {}, 'Back tomorrow'), h('p', {}, util.plural(again.length, 'card') + ' reset to a one-day interval. These are the ones to read again tonight.')),
        h('ul.fc-again', {}, again.slice(0, 6).map(function (s) {
          return h('li', {},
            h('button.fc-again-item', { onclick: goto('library', { id: s.id }) },
              h('span.fc-again-q.clamp-2', {}, s.question || s.id),
              h('span.fc-again-meta', {}, h('span.num', {}, s.id), s.domain ? ' · ' + s.domain : '')),
            null);
        }))));
    }

    page.appendChild(h('div.fc-sum-actions', {},
      h('button.btn.lg.primary', { onclick: function () { startSession(buildDeck(S.mode, S.count, S.scope.filter)); } }, icon('refresh'), 'Study again'),
      again.length ? h('button.btn.lg', { onclick: function () { startFromIds(again.map(function (s) { return s.id; })); } }, icon('target'), 'Drill the ' + again.length + ' I missed') : null,
      h('button.btn.lg', { onclick: function () { S.stage = 'setup'; draw(); } }, icon('cards'), 'Change the deck'),
      h('button.btn.lg.ghost', { onclick: goto('dashboard') }, icon('dashboard'), 'Back to dashboard')));

    root.appendChild(page);
  }

  // ------------------------------------------------------------------ register
  CORB.registerView({
    id: 'flashcards', title: 'Flashcards', icon: 'cards', section: 'Practice', order: 110,
    nav: true, mobile: true, short: 'Cards',
    render: function (root, ctx) {
      rootEl = root;
      var params = obj(ctx && ctx.params);
      var scope = scopeOf(params);
      var sig = JSON.stringify(scope.filter);
      if (!S || S.sig !== sig) S = freshState(scope, sig, params);
      else S.scope = scope;
      draw();
    },
    onLeave: function () { teardown(); rootEl = null; }
  });
})();
