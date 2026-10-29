/* VIEW: quiz — multiple-choice practice with a reason for every option.
   Three phases in one view: setup (a summary line, the warrant class line and Start first; domain chips,
   length, timer and shuffle behind "Change settings"; the quiz record only once there are sessions),
   session (one item at a time, large option buttons, immediate feedback with the "why" for the
   chosen and the correct option, cite chips, "Explain more" modal over the source question),
   results (score, by-domain accuracy bars, missed list with a link into the library).
   Data: CORB.DATA.mcq [{qid, stem, options:[{text, correct, why}], difficulty, cite, domain}],
   plus any question in the bank that carries an inline `mcq` block (CONTRACT §3). Both are
   normalized defensively; a missing, empty or malformed module renders an empty state, never a throw.
   Warrant class: one setting everywhere, profile.targetClass (CORB.warrantClass()). An item is in play when
   CORB.data.classEligible(its source question, class) is true; an item with no source question always is.
   A session is drawn with CORB.data.byWarrant (Class III: Class III items plus the Class I and II
   fundamentals, about 60/40), then the domain filter and the length cut it. The class is changed with
   CORB.ui.classLine() (the top-bar class picker); this view never writes it.
   Params: domain (preselect a domain chip), start=1 (begin immediately).
   Persists: settings.quiz (setup preferences; the timer is off unless a saved choice turned it on), progress.seen.<qid>
   (silent), and each finished session through CORB.scoring.recordQuiz({domain, correct, total, items:[{qid, correct}]}).
   Keyboard: 1-9 pick an option, Enter advances. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, U = CORB.util;

  var PER_Q = 45;          // seconds per question when the timer is on
  var TICK = 200;          // timer repaint interval
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  var COUNTS = [10, 20, 0];  // 0 = every item in the selection
  var SEG_MAX = 40;          // above this many items the segment strip becomes a plain bar

  var view = null;         // survives navigation so a session resumes when you come back
  var R = null;            // live DOM references for the current render
  var timerId = null, raf = null, timeouts = [], keyOn = false, lastSig = null;

  // ------------------------------------------------------------------ utils
  function safe(fn, fb) { try { var v = fn(); return (v === undefined || v === null) ? fb : v; } catch (e) { return fb; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }
  function has(id) { return !!(CORB.views && CORB.views[id]); }
  function setVar(el, name, value) { try { el.style.setProperty(name, String(value)); } catch (e) {} return el; }
  function later(fn, ms) {
    var t = setTimeout(function () {
      for (var i = 0; i < timeouts.length; i++) { if (timeouts[i] === t) { timeouts.splice(i, 1); break; } }
      try { fn(); } catch (e) {}
    }, ms);
    timeouts.push(t); return t;
  }
  function calm() { return safe(function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }, false); }
  function go(id, params) { return function () { if (!has(id)) { ui.toast('That section is not in this build yet', 'warn'); return; } CORB.go(id, params || {}); }; }
  function fill(bar, pct) { var s = bar.firstChild; if (!s) return bar; s.style.width = '0%'; later(function () { if (document.body.contains(s)) s.style.width = U.clamp(Math.round(pct), 0, 100) + '%'; }, 40); return bar; }
  function bar(pct, cls) { return fill(h('div.bar' + (cls ? '.' + cls : ''), {}, h('span')), pct); }
  function citeChip(c) {
    var t = str(c).trim(); if (!t) return null;
    var url = safe(function () { return CORB.data && CORB.data.citeUrl ? CORB.data.citeUrl(t) : null; }, null);
    return url ? h('a.cite', { href: url, target: '_blank', rel: 'noopener' }, t) : h('span.cite', {}, t);
  }
  function sourceQ(qid) {
    var id = str(qid).trim(); if (!id) return null;
    var q = safe(function () { return CORB.data && CORB.data.byId ? CORB.data.byId(id) : null; }, null);
    return (q && typeof q.question === 'string') ? q : null;
  }

  // ------------------------------------------------------- pool construction
  function normalize(raw, key) {
    if (!raw || typeof raw !== 'object') return null;
    var options = [];
    arr(raw.options).forEach(function (o) {
      if (typeof o === 'string') { if (o.trim()) options.push({ text: o.trim(), correct: false, why: '' }); return; }
      if (!o || typeof o !== 'object') return;
      var text = str(o.text || o.label || o.option).trim();
      if (!text) return;
      options.push({ text: text, correct: !!o.correct, why: str(o.why || o.rationale || o.explanation).trim() });
    });
    if (options.length < 2) return null;
    var correctIndex = -1;
    for (var i = 0; i < options.length; i++) { if (options[i].correct) { correctIndex = i; break; } }
    if (correctIndex < 0) return null;                       // ungradable — leave it out rather than guess
    var q = sourceQ(raw.qid);
    var stem = str(raw.stem).trim() || (q ? q.question : '');
    if (!stem) return null;
    var cites = [];
    (arr(raw.cite).length ? arr(raw.cite) : (raw.cite ? [raw.cite] : (q ? arr(q.citations_rfo).concat(arr(q.citations)) : [])))
      .forEach(function (c) { var t = str(c).trim(); if (t && cites.indexOf(t) < 0 && cites.length < 3) cites.push(t); });
    var domain = str(raw.domain).trim() || (q ? str(q.domain).trim() : '') || 'General contracting';
    return {
      key: str(raw.id || raw.qid || ('mcq-' + key)),
      qid: q ? q.id : str(raw.qid).trim(),
      stem: stem, options: options, correctIndex: correctIndex,
      domain: domain, difficulty: str(raw.difficulty).trim(), cites: cites,
      classes: q ? arr(q.classes).map(str).filter(Boolean) : []   // the source question's classes weight the warrant draw
    };
  }

  // the organization picker applies by relevance (CORB.data.relevantTo): general items from every list, no other
  // organization's local procedures
  function relevant(q) { return !q || !!safe(function () { return CORB.data.relevantTo(q); }, true); }
  // the summary says whose questions these are, in the short name the top bar uses
  function orgShort() {
    var id = safe(function () { return CORB.unit(); }, 'all');
    if (id === 'all') return 'All organizations';
    var u = arr(safe(function () { return CORB.DATA.units; }, [])).filter(function (x) { return x && x.id === id; })[0];
    return (u && (u.short || u.name)) || id;
  }
  function buildPool() {
    var out = [], seen = {};
    arr(safe(function () { return CORB.DATA && CORB.DATA.mcq; }, [])).forEach(function (raw, i) {
      if (raw && raw.qid && !relevant(sourceQ(raw.qid))) return;
      var it = normalize(raw, i); if (!it) return;
      out.push(it); if (it.qid) seen[it.qid] = 1;
    });
    arr(safe(function () { return CORB.data && CORB.data.all ? CORB.data.all() : []; }, [])).forEach(function (q, i) {
      if (!q || !q.mcq || !q.id || seen[q.id] || !relevant(q)) return;
      var it = normalize({ qid: q.id, stem: q.mcq.stem, options: q.mcq.options, domain: q.domain, cite: q.citations, difficulty: q.mcq.difficulty }, 'q' + i);
      if (it) { out.push(it); seen[q.id] = 1; }
    });
    return out;
  }

  function domainCounts(pool) {
    var c = {};
    pool.forEach(function (it) { c[it.domain] = (c[it.domain] || 0) + 1; });
    var order = arr(safe(function () { return CORB.data && CORB.data.DOMAINS; }, []));
    return Object.keys(c).sort(function (a, b) {
      var x = order.indexOf(a), y = order.indexOf(b);
      if (x < 0) x = 99; if (y < 0) y = 99;
      return (x - y) || a.localeCompare(b);
    }).map(function (k) { return { name: k, count: c[k] }; });
  }
  function selection(pool, domains) {
    if (!domains.length) return pool.slice();
    return pool.filter(function (it) { return domains.indexOf(it.domain) >= 0; });
  }

  // ---------------------------------------------------------- warrant class
  // One setting everywhere: profile.targetClass. Contracting officer classes are cumulative (a Class III candidate
  // gets Class III items plus the Class I and II fundamentals, about 60/40), and '' means every item.
  function warrant() { return str(safe(function () { return CORB.warrantClass(); }, '')); }
  function classLabel(cls) { return str(safe(function () { return CORB.data.classLabel(cls); }, cls ? 'Class ' + cls : 'All classes')); }
  function eligible(pool, cls) {
    if (!cls) return pool.slice();
    return pool.filter(function (it) {
      var q = it.qid ? safe(function () { return CORB.data.byId(it.qid); }, null) : null;   // no source question: always in play
      return !!safe(function () { return CORB.data.classEligible(q, cls); }, true);
    });
  }
  function warrantOrder(list, cls) {
    var out = safe(function () { return CORB.data.byWarrant(list, cls); }, null);
    return Array.isArray(out) ? out : U.shuffle(list);
  }
  function lowerClasses(cls) {
    var ko = arr(safe(function () { return CORB.data.KO_CLASSES; }, []));
    var i = ko.indexOf(cls);
    return i > 0 ? ko.slice(0, i) : [];
  }

  // ------------------------------------------------------------------ state
  // The timer starts off for a new user (a clock on the first quiz is stressful); a saved "on" still wins.
  function freshSetup() {
    var saved = safe(function () { return CORB.get('settings.quiz', null); }, null);
    var s = { domains: [], count: 10, timer: false, shuffle: true };
    if (saved && typeof saved === 'object') {
      s.domains = arr(saved.domains).map(str).filter(Boolean);
      if (COUNTS.indexOf(saved.count) >= 0) s.count = saved.count;
      s.timer = saved.timer === true;
      s.shuffle = saved.shuffle !== false;
    }
    return s;
  }
  function saveSetup() { try { CORB.set('settings.quiz', { domains: view.setup.domains.slice(), count: view.setup.count, timer: !!view.setup.timer, shuffle: !!view.setup.shuffle }); } catch (e) {} }
  function ensure() { if (!view) view = { phase: 'setup', setup: freshSetup(), run: null, result: null }; return view; }
  function answered() { var r = view.run; return !!(r && r.answers[r.i]); }

  // ----------------------------------------------------------------- timers
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function leftMs() { var r = view.run; return (r && r.deadline) ? Math.max(0, r.deadline - Date.now()) : PER_Q * 1000; }
  function clock(ms) { var s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function paintTime() {
    if (!R || !R.timeNum || !document.body.contains(R.timeNum)) return;
    var ms = leftMs(), s = Math.ceil(ms / 1000);
    R.timeNum.textContent = clock(ms);
    if (R.timeWrap) { R.timeWrap.classList.toggle('warn', s <= 15 && s > 5); R.timeWrap.classList.toggle('danger', s <= 5); }
    if (R.timeFill) R.timeFill.style.width = U.clamp((ms / (PER_Q * 1000)) * 100, 0, 100) + '%';
  }
  function startTimer() {
    stopTimer();
    var r = view.run;
    if (!r || view.phase !== 'run' || !view.setup.timer || r.answers[r.i]) return;
    r.deadline = Date.now() + PER_Q * 1000;
    paintTime();
    timerId = setInterval(function () {
      if (!R || !R.root || !document.body.contains(R.root) || view.phase !== 'run' || !view.run || answered()) { stopTimer(); return; }
      paintTime();
      if (leftMs() <= 0) { stopTimer(); choose(null); }
    }, TICK);
  }

  // ------------------------------------------------------------- session ops
  function shuffledItem(it) {
    var opts = U.shuffle(it.options), ci = 0;
    for (var i = 0; i < opts.length; i++) { if (opts[i].correct) { ci = i; break; } }
    var copy = {}; Object.keys(it).forEach(function (k) { copy[k] = it[k]; });
    copy.options = opts; copy.correctIndex = ci;
    return copy;
  }
  function begin(items) {
    if (!items.length) { ui.toast('No quiz items in that selection', 'warn'); return; }
    view.run = { items: items, answers: new Array(items.length), i: 0, started: Date.now(), deadline: 0 };
    view.result = null; view.phase = 'run';
    paint(); startTimer(); focusStage();
  }
  function start() {
    var s = view.setup, cls = warrant();
    var pool = eligible(buildPool(), cls);
    // the warrant draw sets the order (Class III: about 60/40 over Class I and II), then the domains and the length cut it
    var picked = selection(warrantOrder(pool, cls), s.domains);
    if (!picked.length) { ui.toast(pool.length ? 'No quiz items in that selection' : 'No quiz items for ' + classLabel(cls) + ' yet', 'warn'); return; }
    var list = s.count ? picked.slice(0, Math.min(s.count, picked.length)) : picked;
    if (!s.shuffle) list.sort(function (a, b) { return pool.indexOf(a) - pool.indexOf(b); });   // "In order": the drawn items in bank order
    list = list.map(shuffledItem);   // answer choices are always mixed: most items are written with the right answer first
    saveSetup();
    begin(list);
  }
  function choose(idx) {
    var r = view.run; if (!r || view.phase !== 'run') return;
    var it = r.items[r.i]; if (!it || r.answers[r.i]) return;
    stopTimer();
    var picked = (idx == null) ? null : idx;
    r.answers[r.i] = { choice: picked, correct: picked != null && picked === it.correctIndex, timedOut: picked == null, left: Math.round(leftMs() / 1000) };
    if (it.qid) { try { CORB.set('progress.seen.' + it.qid, U.today(), { silent: true }); } catch (e) {} }
    paint();
  }
  function next() {
    var r = view.run; if (!r || !r.answers[r.i]) return;
    if (r.i >= r.items.length - 1) { finish(); return; }
    r.i++; paint(); startTimer(); focusStage();
  }
  function finish() {
    stopTimer();
    var r = view.run; if (!r) return;
    var res = { total: r.items.length, correct: 0, byDomain: {}, missed: [], ms: Date.now() - (r.started || Date.now()), timer: !!view.setup.timer };
    r.items.forEach(function (it, i) {
      var a = r.answers[i] || { choice: null, correct: false, timedOut: true };
      var d = res.byDomain[it.domain] = res.byDomain[it.domain] || { total: 0, correct: 0 };
      d.total++;
      if (a.correct) { res.correct++; d.correct++; } else res.missed.push({ item: it, answer: a });
    });
    res.pct = U.pct(res.correct, res.total);
    view.result = res; view.phase = 'done';
    record(res, r.items, r.answers);
    paint();
  }
  function record(res, items, answers) {
    if (res.recorded) return;
    res.recorded = true;
    var doms = Object.keys(res.byDomain);
    var domain = view.setup.domains.length === 1 ? view.setup.domains[0] : (doms.length === 1 ? doms[0] : 'Mixed');
    try {
      if (CORB.scoring && CORB.scoring.recordQuiz) {
        CORB.scoring.recordQuiz({
          domain: domain, correct: res.correct, total: res.total,
          items: items.map(function (it, i) { return { qid: it.qid || it.key, correct: !!(answers[i] && answers[i].correct) }; })
        });
      }
    } catch (e) {}
  }
  function endEarly() {
    var r = view.run; if (!r) return;
    var done = 0; for (var i = 0; i < r.answers.length; i++) { if (r.answers[i]) done++; }
    var msg = done ? 'End the quiz now? Your ' + U.plural(done, 'answer') + ' will still be scored.' : 'Leave this quiz? Nothing has been answered yet.';
    Promise.resolve(safe(function () { return ui.confirm(msg, { title: 'End quiz', ok: done ? 'End and score' : 'Leave quiz' }); }, Promise.resolve(false)))
      .then(function (ok) {
        if (!ok || !view.run) return;
        stopTimer();
        if (!done) { view.run = null; view.result = null; view.phase = 'setup'; paint(); return; }
        view.run.items = view.run.items.slice(0, done);
        view.run.answers = view.run.answers.slice(0, done);
        finish();
      });
  }
  function reset() { stopTimer(); view.run = null; view.result = null; view.phase = 'setup'; paint(); }
  function speakStem(it) {
    if (!CORB.speech || !CORB.speech.available) return;
    var text = it.stem + '. ' + it.options.map(function (o, i) { return LETTERS[i] + '. ' + o.text; }).join('. ');
    try { CORB.speech.speak(text); } catch (e) {}
  }

  // ------------------------------------------------------------------ modal
  function explain(it) {
    var q = sourceQ(it.qid);
    var actions = [{ label: 'Close' }];
    var body;
    if (q) {
      body = h('div.v-quiz', {}, h('div.qz-modal', {}, safe(function () { return ui.questionCard(q, { showAnswer: true, actions: false }); }, null) || h('p.muted', {}, 'This question could not be rendered.')));
      if (has('library')) actions.unshift({ label: 'Open in library', primary: true, onClick: function () { CORB.go('library', { id: q.id }); } });
    } else {
      var right = it.options[it.correctIndex] || { text: '', why: '' };
      body = h('div.v-quiz', {}, h('div.qz-modal', {},
        h('div.eyebrow', {}, it.domain),
        h('p.qz-modal-stem', {}, it.stem),
        h('div.panel-soft.mt-4', {},
          h('div.eyebrow', {}, 'Correct answer'),
          h('p.mt-2', {}, right.text),
          right.why ? ui.rich(right.why) : h('p.muted.small', {}, 'No written rationale ships with this item yet.')),
        realCites(it).length ? h('div.qz-cites.mt-4', {}, h('span.qz-cites-label', {}, 'Cite'), realCites(it).map(citeChip)) : null,
        h('p.muted.small.mt-4', {}, 'This item is not linked to a question in the bank, so there is no source card to open.')));
    }
    safe(function () { return ui.modal({ title: q ? 'Source question · ' + q.id : 'Explanation', body: body, wide: true, actions: actions }); }, null);
  }

  // ------------------------------------------------------------------ pieces
  function head(sub) {
    return h('header.page-head.qz-head', {},
      h('div.qz-head-copy', {},
        h('h1', {}, 'Quiz'),
        h('p.lede', {}, sub)));
  }

  function emptyPool() {
    return h('div.qz-empty', {},
      h('div.qz-empty-icon', {}, icon('quiz')),
      h('h3', {}, 'The quiz set is still being written'),
      h('p', {}, 'Every quiz item carries a stem, four options, and a written reason for each one — why the right answer is right and why each wrong answer fails. That takes verification against the RFO text, so the set is built and reviewed after the question bank. Until it lands, the bank itself is the better drill.'),
      h('p.muted.small', {}, 'Facilitators: items arrive with the mcq data module, or as an mcq block attached to individual questions in the bank. Rebuild the app and this page fills itself in.'),
      h('div.qz-empty-actions', {},
        has('library') ? h('button.btn.primary', { type: 'button', onclick: go('library') }, icon('book'), 'Study the question library') : null,
        has('flashcards') ? h('button.btn', { type: 'button', onclick: go('flashcards') }, icon('cards'), 'Run flashcards') : null,
        has('primers') ? h('button.btn', { type: 'button', onclick: go('primers') }, icon('layers'), 'Read the primers') : null));
  }

  // The bank has quiz items, but none for this warrant class: keep the class line in reach and offer the question bank.
  function classEmpty(cls, total) {
    var label = classLabel(cls), lower = lowerClasses(cls);
    var want = arr(safe(function () { return CORB.data.classesFor(cls); }, [])).join(',');
    var span = lower.length ? 'tagged Class ' + lower[0] + (lower.length === 1 ? ' or ' : ' to ') + cls : cls === 'I' ? 'tagged Class I' : 'on the ' + label + ' track';
    return h('div.qz-empty', {},
      h('div.qz-empty-icon', {}, icon('filter')),
      h('h3', {}, 'No quiz items for ' + label + ' yet'),
      h('p', {}, 'The quiz set has ' + U.plural(total, 'item') + ', but none of them comes from a question ' + span + '. Choose another warrant class, or work these questions as flashcards or in the library.'),
      h('div.qz-empty-class.mt-4', {}, safe(function () { return ui.classLine(); }, null)),
      h('div.qz-empty-actions', {},
        has('flashcards') ? h('button.btn.primary', { type: 'button', onclick: go('flashcards') }, icon('cards'), 'Study flashcards') : null,
        has('library') ? h('button.btn', { type: 'button', onclick: go('library', want ? { classes: want } : {}) }, icon('book'), 'Browse these in the library') : null));
  }

  // The quiz record appears once there is at least one finished session; before that there is nothing to show.
  function historyPanel() {
    var recs = arr(safe(function () { return CORB.get('progress.quiz', []); }, []));
    var clean = recs.filter(function (r) { return r && Number(r.total) > 0; });
    if (!clean.length) return null;
    var lifeC = 0, lifeT = 0;
    clean.forEach(function (r) { lifeC += Number(r.correct) || 0; lifeT += Number(r.total) || 0; });
    var recent = clean.slice(-5).reverse();
    return h('aside.qz-aside', {},
      h('div.card.qz-card-soft', {},
        h('div.qz-aside-head', {}, icon('bar-chart'), h('h2', {}, 'Your quiz record')),
        h('div.qz-life', {},
          h('div.qz-life-num', {}, U.pct(lifeC, lifeT) + '%'),
          h('div.qz-life-copy', {}, h('b', {}, 'lifetime accuracy'), h('span', {}, lifeC + ' of ' + lifeT + ' answers across ' + U.plural(clean.length, 'session') + '.'))),
        h('div.qz-hist', {}, recent.map(function (r) {
          var pct = U.pct(Number(r.correct) || 0, Number(r.total) || 0);
          return h('div.qz-hist-item', {},
            h('div.qz-hist-top', {},
              h('span.qz-hist-dom.truncate', {}, str(r.domain) || 'Mixed'),
              h('span.qz-hist-score.num', {}, (Number(r.correct) || 0) + '/' + (Number(r.total) || 0))),
            bar(pct, pct >= 80 ? 'ok' : pct >= 60 ? 'gold' : 'warn'),
            h('div.qz-hist-date', {}, r.ts ? U.fmtDate(str(r.ts).slice(0, 10)) : ''));
        }))));
  }
  function withAside(cls, main) {
    var aside = historyPanel();
    return h('div.' + cls + (aside ? '.has-aside' : ''), {}, main, aside);
  }

  function setupScreen() {
    var bank = buildPool();
    if (!bank.length) return withAside('qz-setup-empty', emptyPool());

    var cls = warrant();
    var pool = eligible(bank, cls);          // chips and the summary count only the items in play for the class
    if (!pool.length) return withAside('qz-setup-empty', classEmpty(cls, bank.length));

    var s = view.setup;
    var doms = domainCounts(pool);
    s.domains = s.domains.filter(function (d) { return doms.some(function (x) { return x.name === d; }); });
    var picked = selection(pool, s.domains);
    var runLen = s.count ? Math.min(s.count, picked.length) : picked.length;

    // the summary says what Start will run; the class sits on its own line under it, with its Change button
    var summary = h('div.qz-summary', { 'aria-live': 'polite' });
    var startBtn = h('button.btn.lg.primary.qz-go', { type: 'button', onclick: start }, icon('play'), 'Start quiz');
    function paintSummary() {
      picked = selection(pool, s.domains);
      runLen = s.count ? Math.min(s.count, picked.length) : picked.length;
      summary.innerHTML = '';
      summary.appendChild(h('b', {}, runLen ? U.plural(runLen, 'question') : 'Nothing selected'));
      summary.appendChild(h('span', {}, s.domains.length ? (s.domains.length === 1 ? s.domains[0] : s.domains.length + ' domains') : 'All domains'));
      summary.appendChild(h('span', {}, orgShort()));
      summary.appendChild(h('span', {}, s.timer ? PER_Q + ' seconds each' : 'Untimed'));
      summary.appendChild(h('span', {}, s.shuffle ? 'Shuffled' : 'In order'));
      startBtn.disabled = !runLen;
    }

    var chips = h('div.chips.qz-chips');
    function paintChips() {
      chips.innerHTML = '';
      chips.appendChild(h('button.chip' + (s.domains.length ? '' : '.on'), { type: 'button', 'aria-pressed': s.domains.length ? 'false' : 'true', onclick: function () { s.domains = []; paintChips(); paintSummary(); saveSetup(); } },
        icon('layers'), 'All domains', h('span.count', {}, String(pool.length))));
      doms.forEach(function (d) {
        var on = s.domains.indexOf(d.name) >= 0;
        chips.appendChild(h('button.chip' + (on ? '.on' : ''), { type: 'button', 'aria-pressed': on ? 'true' : 'false', title: d.name, onclick: function () {
          var i = s.domains.indexOf(d.name);
          if (i >= 0) s.domains.splice(i, 1); else s.domains.push(d.name);
          paintChips(); paintSummary(); saveSetup();
        } }, h('span.truncate', {}, d.name), h('span.count', {}, String(d.count))));
      });
    }
    paintChips();

    var seg = h('div.seg.qz-seg', { role: 'group', 'aria-label': 'Number of questions' });
    function paintSeg() {
      seg.innerHTML = '';
      COUNTS.forEach(function (c) {
        seg.appendChild(h('button' + (s.count === c ? '.on' : ''), { type: 'button', 'aria-pressed': s.count === c ? 'true' : 'false', onclick: function () { s.count = c; paintSeg(); paintSummary(); saveSetup(); } },
          c ? String(c) : 'All'));
      });
    }
    paintSeg();

    function toggle(key, iconName, label, hint) {
      var input = h('input', { type: 'checkbox', checked: !!s[key], onchange: function (e) { s[key] = !!e.target.checked; paintSummary(); saveSetup(); } });
      return h('label.qz-toggle', {},
        h('span.qz-toggle-icon', {}, icon(iconName)),
        h('span.qz-toggle-copy', {}, h('b', {}, label), h('span', {}, hint)),
        h('span.switch.qz-switch', {}, input));
    }

    paintSummary();

    // Start comes first; the settings the summary describes sit behind one collapsed "Change settings"
    var settings = h('details.acc.qz-settings', {},
      h('summary', {}, icon('settings'), 'Change settings', icon('chevron', 'chev')),
      h('div.acc-body', {},
        h('div.qz-block', {},
          h('div.qz-block-head', {}, h('h2', {}, 'Domains'), h('span.muted.small', {}, 'Pick as many as you want, or leave it on all.')),
          chips),
        h('div.qz-block.qz-block-split', {},
          h('div', {},
            h('div.qz-block-head', {}, h('h2', {}, 'Length')),
            seg),
          h('div', {},
            h('div.qz-block-head', {}, h('h2', {}, 'Conditions')),
            h('div.qz-toggles', {},
              toggle('timer', 'timer', 'Timer', PER_Q + ' seconds per question'),
              toggle('shuffle', 'shuffle', 'Shuffle', 'Mix the question order. Answer choices are always mixed.'))))));

    var main = h('div.card.qz-setup-card', {},
      h('div.qz-start', {},
        h('div.qz-start-copy', {}, summary, safe(function () { return ui.classLine(); }, null)),
        startBtn),
      settings);

    return withAside('qz-setup', main);
  }

  // ------------------------------------------------------------- run screen
  function progressStrip(r) {
    if (r.items.length > SEG_MAX) {
      var b = h('div.bar.qz-runbar-bar', {}, h('span'));
      b.firstChild.style.width = U.pct(r.i, r.items.length) + '%';
      return b;
    }
    return h('div.qz-segs', { 'aria-hidden': 'true' }, r.items.map(function (it, i) {
      var a = r.answers[i];
      var cls = a ? (a.correct ? '.ok' : '.bad') : (i === r.i ? '.on' : '');
      return h('span.qz-seg-pip' + cls);
    }));
  }

  function runScreen() {
    var r = view.run, it = r.items[r.i], a = r.answers[r.i];
    var reveal = !!a;

    R.timeWrap = null; R.timeNum = null; R.timeFill = null;
    var timeEl = null;
    if (view.setup.timer) {
      R.timeNum = h('span.qz-time-num.num', {}, reveal ? clock((a.left || 0) * 1000) : clock(leftMs()));
      R.timeWrap = h('div.qz-time' + (reveal ? '.done' : ''), { 'aria-label': 'Time remaining' }, icon('timer'), R.timeNum);
      timeEl = R.timeWrap;
    }

    var runbar = h('div.qz-runbar', {},
      h('div.qz-runbar-row', {},
        h('div.qz-runbar-left', {},
          h('span.qz-counter.num', { 'aria-live': 'polite' }, 'Question ' + (r.i + 1) + ' of ' + r.items.length),
          h('span.badge.neutral.qz-dombadge', {}, it.domain)),
        h('div.qz-runbar-right', {},
          timeEl,
          (CORB.speech && CORB.speech.available) ? h('button.btn.icon.sm.ghost', { type: 'button', 'aria-label': 'Read the question aloud', 'data-tip': 'Read aloud', onclick: function () { speakStem(it); } }, icon('volume')) : null,
          h('button.btn.sm.ghost.qz-end', { type: 'button', onclick: endEarly }, icon('x'), h('span.hide-sm', {}, 'End quiz')))),
      progressStrip(r));

    var opts = h('div.qz-opts', { role: 'group', 'aria-label': 'Answer options' }, it.options.map(function (o, i) {
      var cls = '';
      if (reveal) {
        if (i === it.correctIndex) cls = '.right';
        else if (a.choice === i) cls = '.wrong';
        else cls = '.dim';
      }
      return h('button.qz-opt' + cls, {
        type: 'button', disabled: reveal, 'aria-label': LETTERS[i] + '. ' + o.text,
        onclick: function () { choose(i); }
      },
        h('span.qz-key', {}, i < 9 ? String(i + 1) : LETTERS[i]),
        h('span.qz-otext', {}, o.text),
        h('span.qz-mark', {}, reveal ? (i === it.correctIndex ? icon('check') : (a.choice === i ? icon('x') : null)) : null));
    }));

    var card = h('article.qz-card' + (reveal ? '.revealed' : ''), { tabindex: '-1' },
      h('div.qz-stem', {}, it.stem),
      opts,
      reveal ? feedback(it, a) : h('p.qz-hint', {}, 'Pick the answer you would give a board. You will see why every option is right or wrong.'));
    R.card = card;

    return h('div.qz-run', {}, runbar, card);
  }

  // Some items carry a "cite" that only records that the source had none; that is not worth a row on screen.
  function realCites(it) { return arr(it && it.cites).filter(function (c) { return !/no regulatory cite/i.test(str(c)); }); }
  function feedback(it, a) {
    var right = it.options[it.correctIndex] || { text: '', why: '' };
    var mine = (a.choice != null) ? it.options[a.choice] : null;
    var ok = !!a.correct;
    var last = view.run.i >= view.run.items.length - 1;

    var rows = [];
    if (!ok && mine && mine.why) {
      rows.push(h('div.qz-fb-row.bad', {},
        h('div.qz-fb-label', {}, icon('x'), 'Why yours is wrong'),
        h('div.qz-fb-body', {}, ui.rich(mine.why))));
    }
    rows.push(h('div.qz-fb-row.good', {},
      h('div.qz-fb-label', {}, icon('check'), 'Why that is right'),
      h('div.qz-fb-body', {}, right.why ? ui.rich(right.why) : h('p.muted.small', {}, 'This item has no written reason yet. Open the source question for the full answer.'))));

    var nextBtn = h('button.btn.lg.primary.qz-next', { type: 'button', onclick: next }, last ? 'See results' : 'Next question', icon(last ? 'trophy' : 'arrow-right'));
    R.next = nextBtn;
    later(function () { if (R && R.next && document.body.contains(R.next)) try { R.next.focus({ preventScroll: true }); } catch (e) { R.next.focus(); } }, 30);

    return h('div.qz-fb' + (ok ? '.ok' : '.bad'), { 'aria-live': 'polite' },
      h('div.qz-fb-head', {},
        h('span.qz-verdict', {}, icon(ok ? 'check' : 'alert'), ok ? 'Correct' : (a.timedOut ? 'Out of time' : 'Not quite')),
        realCites(it).length ? h('div.qz-cites', {}, h('span.qz-cites-label', {}, 'Cite'), realCites(it).map(citeChip)) : null),
      h('div.qz-fb-rows', {}, rows),
      h('div.qz-foot', {},
        h('button.btn.qz-more', { type: 'button', onclick: function () { explain(it); } }, icon('book'), 'Explain more'),
        h('div.grow'),
        nextBtn));
  }

  // ---------------------------------------------------------- result screen
  function scoreRing(pct) {
    var span = h('span', {}, '0%');
    var ring = h('div.ring.qz-ring', {}, span);
    var target = U.clamp(Math.round(pct), 0, 100);
    ring.classList.add(target >= 80 ? 'good' : target >= 60 ? 'mid' : 'low');
    setVar(ring, '--size', '150px'); setVar(ring, '--p', 0);
    if (calm() || typeof window.requestAnimationFrame !== 'function') { setVar(ring, '--p', target); span.textContent = target + '%'; return ring; }
    var t0 = 0;
    function step(ts) {
      if (!document.body.contains(ring)) { raf = null; return; }
      if (!t0) t0 = ts;
      var k = U.clamp((ts - t0) / 850, 0, 1), e = 1 - Math.pow(1 - k, 3);
      var v = Math.round(target * e);
      setVar(ring, '--p', v); span.textContent = v + '%';
      raf = k < 1 ? window.requestAnimationFrame(step) : null;
    }
    raf = window.requestAnimationFrame(step);
    return ring;
  }

  function verdict(pct) {
    if (pct >= 90) return 'Board-ready on this set. Move to a domain you have not drilled.';
    if (pct >= 75) return 'Solid. Read the misses below and take the same set again cold tomorrow.';
    if (pct >= 50) return 'Half of these would have turned into follow-up probes. Work the missed domains next.';
    return 'This is the material to study first. Open the missed items and read the full answers.';
  }

  function resultScreen() {
    var res = view.result, r = view.run;
    var mins = Math.max(1, Math.round((res.ms || 0) / 60000));
    var doms = Object.keys(res.byDomain).sort(function (a, b) {
      return U.pct(res.byDomain[a].correct, res.byDomain[a].total) - U.pct(res.byDomain[b].correct, res.byDomain[b].total);
    });

    var score = h('div.card.qz-score', {},
      h('div.qz-score-ring', {}, scoreRing(res.pct)),
      h('div.qz-score-copy', {},
        h('div.eyebrow', {}, 'Session complete'),
        h('h2', {}, res.correct + ' of ' + res.total + ' correct'),
        h('p.qz-verdict-line', {}, verdict(res.pct)),
        h('div.qz-score-meta', {},
          h('span', {}, icon('clock'), U.plural(mins, 'minute')),
          h('span', {}, icon('timer'), res.timer ? PER_Q + 's per question' : 'Untimed'),
          h('span', {}, icon('layers'), doms.length === 1 ? doms[0] : U.plural(doms.length, 'domain')))));

    var byDomain = h('section.card.qz-doms', {},
      h('div.qz-aside-head', {}, icon('bar-chart'), h('h2', {}, 'Accuracy by domain')),
      h('div.qz-dom-list', {}, doms.map(function (name) {
        var d = res.byDomain[name], pct = U.pct(d.correct, d.total);
        return h('div.qz-dom-row', {},
          h('div.qz-dom-top', {},
            h('span.qz-dom-name.truncate', {}, name),
            h('span.qz-dom-num.num', {}, d.correct + '/' + d.total + ' · ' + pct + '%')),
          bar(pct, pct >= 80 ? 'ok' : pct >= 60 ? 'gold' : 'warn'),
          has('library') ? h('button.qz-dom-link', { type: 'button', onclick: go('library', { domain: name }) }, 'Study this domain', icon('arrow-right')) : null);
      })));

    var missed = res.missed.length ? h('section.card.qz-missed', {},
      h('div.qz-aside-head', {}, icon('flag'), h('h2', {}, U.plural(res.missed.length, 'missed question'))),
      h('div.qz-miss-list', {}, res.missed.map(function (m) {
        var it = m.item, right = it.options[it.correctIndex] || { text: '' };
        var mine = (m.answer.choice != null) ? it.options[m.answer.choice] : null;
        return h('article.qz-miss', {},
          h('div.qz-miss-head', {}, h('span.badge.neutral', {}, it.domain), it.cites.length ? citeChip(it.cites[0]) : null),
          h('p.qz-miss-stem', {}, it.stem),
          h('div.qz-miss-ans', {},
            h('div.qz-miss-line.bad', {}, icon('x'), h('span', {}, mine ? mine.text : 'No answer — time ran out')),
            h('div.qz-miss-line.good', {}, icon('check'), h('span', {}, right.text))),
          h('div.qz-miss-actions', {},
            h('button.btn.sm', { type: 'button', onclick: function () { explain(it); } }, icon('book'), 'Explain more'),
            (it.qid && has('library')) ? h('button.btn.sm.ghost', { type: 'button', onclick: go('library', { id: it.qid }) }, icon('external'), 'Review in library') : null));
      }))) : h('section.card.qz-clean', {}, icon('trophy'), h('div', {}, h('b', {}, 'Nothing missed.'), h('span', {}, 'Every item in this set was correct. Widen the domains or turn the timer on to raise the difficulty.')));

    var actions = h('div.qz-actions', {},
      res.missed.length ? h('button.btn.lg.primary', { type: 'button', onclick: function () {
        var items = res.missed.map(function (m) { return shuffledItem(m.item); });
        begin(items);
      } }, icon('refresh'), 'Retry the ' + res.missed.length + ' missed') : null,
      h('button.btn.lg' + (res.missed.length ? '' : '.primary'), { type: 'button', onclick: function () {
        if (r && r.items.length) { begin((view.setup.shuffle ? U.shuffle(r.items) : r.items.slice()).map(shuffledItem)); }
        else reset();
      } }, icon('play'), 'Run this set again'),
      h('button.btn.lg', { type: 'button', onclick: reset }, icon('filter'), 'New quiz'),
      has('dashboard') ? h('button.btn.lg.ghost', { type: 'button', onclick: go('dashboard') }, icon('dashboard'), 'Dashboard') : null);

    return h('div.qz-result', {}, score, h('div.qz-result-grid', {}, byDomain, missed), actions);
  }

  // ------------------------------------------------------------------ paint
  function focusStage() {
    later(function () { if (R && R.card && document.body.contains(R.card)) { try { R.card.focus({ preventScroll: true }); } catch (e) {} } }, 20);
  }
  function paint() {
    if (!R || !R.root || !document.body.contains(R.root)) return;
    stopTimer();
    R.card = null; R.next = null; R.timeNum = null; R.timeFill = null; R.timeWrap = null;
    R.root.innerHTML = '';
    var phase = view.phase;
    if (phase === 'run' && view.run && view.run.items.length) {
      R.root.appendChild(runScreen());
      return;
    }
    if (phase === 'done' && view.result) {
      R.root.appendChild(head('The questions you missed are your study list.'));
      R.root.appendChild(resultScreen());
      return;
    }
    view.phase = 'setup';
    R.root.appendChild(head('Pick an answer, then see why each option is right or wrong.'));
    R.root.appendChild(setupScreen());
  }

  // --------------------------------------------------------------- keyboard
  function onKey(e) {
    if (!R || !R.root || !document.body.contains(R.root)) return;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.modal-scrim')) return;
    var t = e.target, tag = (t && t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
    if (view.phase !== 'run' || !view.run) return;
    var r = view.run, it = r.items[r.i];
    if (!it) return;
    if (/^[1-9]$/.test(e.key)) {
      if (r.answers[r.i]) return;
      var idx = parseInt(e.key, 10) - 1;
      if (idx < it.options.length) { e.preventDefault(); choose(idx); }
      return;
    }
    if (e.key === 'Enter') {
      if (tag === 'button' || tag === 'a') return;   // let the focused control act
      if (r.answers[r.i]) { e.preventDefault(); next(); }
    }
  }
  function bindKeys() { if (keyOn) return; document.addEventListener('keydown', onKey); keyOn = true; }
  function unbindKeys() { if (!keyOn) return; document.removeEventListener('keydown', onKey); keyOn = false; }

  // ------------------------------------------------------------------ leave
  function leave() {
    stopTimer(); unbindKeys();
    if (raf && typeof window.cancelAnimationFrame === 'function') { try { window.cancelAnimationFrame(raf); } catch (e) {} }
    raf = null;
    timeouts.forEach(function (t) { clearTimeout(t); }); timeouts = [];
    if (CORB.speech && CORB.speech.available && CORB.speech.speaking) { try { CORB.speech.stop(); } catch (e) {} }
    R = null;
  }

  CORB.registerView({
    id: 'quiz', title: 'Quiz', icon: 'quiz', section: 'Practice', order: 120, nav: true, mobile: true, short: 'Quiz',
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || {};
      var sig = JSON.stringify(p);
      ensure();
      if (sig !== lastSig) {
        lastSig = sig;
        if (p.domain) {
          var name = str(p.domain).trim(), cls = warrant(), bank = buildPool();
          var isName = function (d) { return d.name === name; };
          var known = domainCounts(eligible(bank, cls)).some(isName);   // known for this warrant class
          stopTimer();
          view.run = null; view.result = null; view.phase = 'setup';
          view.setup.domains = known ? [name] : [];
          if (!known && name) {
            var otherClass = !!cls && domainCounts(bank).some(isName);
            ui.toast('No ' + (otherClass ? classLabel(cls) + ' ' : '') + 'quiz items in ' + name + ' yet — showing all domains', 'warn');
          }
        }
      }
      R = { root: h('div.qz') };
      root.appendChild(R.root);
      bindKeys();
      paint();
      if (view.phase === 'setup' && (p.start === '1' || p.start === 'true')) { start(); }
      else if (view.phase === 'run') { startTimer(); }
    },
    onLeave: leave
  });
})();
