/* VIEW: board — the board console used by members and the facilitator during a live CORB.

   Three phases inside one view:
     setup    candidate alias (never a real name), warrant class, organization, board date,
              target question count. Resumes an interrupted session when one is saved.
     session  sticky header (elapsed clock, per-question clock, running average, recommendation
              toggle) over a two-column body: the ordered session list on the left and the
              question bank panel on the right (domain / class / kind / Korea / search filters,
              add one random from a domain, build a balanced set of N, manual add, custom question).
              Each session item expands to the full question, a "Reveal answer to me" toggle that
              starts hidden, follow-up probes for the domain, a notes box and a 1-5 rubric row per
              dimension from CORB.scoring.rubric().
     history  past sessions: reopen read-only, export, delete.

   Data: CORB.data.questions()/all() for the bank, CORB.scoring.rubric() for the dimensions,
   CORB.DATA.rubric_board.board_guide.probes[domain] for the probes, CORB.DATA.rubric_board
   .rubric.pass_rule_text for the vote note. Every one of those may be absent or half-shaped;
   nothing here throws on missing data and each block renders an honest empty state instead.

   Why not CORB.ui.questionCard for the session list: the card renders question, answer and study
   actions together. In a live board the answer must stay hidden until a member chooses to look,
   and the row carries a clock, an asked flag, notes and scoring instead of bookmark/mentor actions.

   Persists: progress.boards_live (the running session, so a refresh or a detour does not lose it),
   progress.boards via CORB.scoring.recordBoard on finish, settings.board (last organization and
   class used in setup). No candidate identity beyond the alias the member types is ever stored.
   Params: tab=live|history, alias, cls, n (the last three prefill the setup form). */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, util = CORB.util;

  var BANK_PAGE = 40;
  var KOREA_FLAG = 'korea-verify-cp';
  var ETHICS_DOMAIN = 'Authority, Ethics & Leadership';
  var KINDS = [['', 'Any kind'], ['knowledge', 'Knowledge'], ['scenario', 'Scenario'], ['leadership', 'Leadership']];
  var RECS = [
    ['recommend', 'Recommend', 'ok'],
    ['undecided', 'Undecided', 'warn'],
    ['no', 'Do not recommend', 'danger']
  ];
  var PASS_NOTE = 'The SCO appoints on a unanimous recommendation of the board.';

  var S = null;        // { tab, sess, bank filters, expanded map, reveal map, historyOpen }
  var R = null;        // live DOM references
  var tick = null;     // 1s clock interval
  var ticks = 0;
  var printFn = null;

  // ------------------------------------------------------------------ helpers
  function safe(fn, fallback) { try { var v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function txt(v) { return v == null ? '' : String(v); }
  function num(v, d) { var n = parseInt(v, 10); return isNaN(n) ? d : n; }
  function domainsOf() { return arr(safe(function () { return CORB.data.DOMAINS; }, [])); }
  function classesOf() { return arr(safe(function () { return CORB.data.CLASSES; }, ['I', 'II', 'III', 'IV'])); }
  function classLabel(c) { return 'Class ' + c; }
  function bank() { return arr(safe(function () { return CORB.data.all(); }, [])); }
  function unitId() { return safe(function () { return CORB.unit(); }, 'all') || 'all'; }
  function unitLabel(id) {
    id = id || unitId();
    var name = safe(function () { return CORB.unitName(id); }, '');
    if (!name || name === id) return id === 'all' ? 'All organizations' : txt(id);
    return name;
  }
  function slug(s) { return txt(s).replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'candidate'; }
  function clock(ms) {
    var t = Math.max(0, Math.round((ms || 0) / 1000));
    var m = Math.floor(t / 60), s = t % 60;
    if (m >= 60) return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  function rubric() {
    var r = safe(function () { return CORB.scoring.rubric(); }, null) || {};
    var dims = arr(r.dimensions).filter(function (d) { return d && d.id; });
    return { dimensions: dims, weights: (r.weights && typeof r.weights === 'object') ? r.weights : null, pass_rule_text: txt(r.pass_rule_text), numeric_guide: txt(r.numeric_guide), scale: txt(r.scale) };
  }
  function probesFor(domain) {
    var g = safe(function () { return CORB.DATA.rubric_board.board_guide.probes; }, null);
    if (!g || typeof g !== 'object') return [];
    return arr(g[domain]).filter(function (p) { return typeof p === 'string' && p.trim(); });
  }
  function classFocus(cls) {
    var f = safe(function () { return CORB.DATA.rubric_board.board_guide.class_focus; }, null);
    if (!f || typeof f !== 'object') return '';
    return txt(f[cls]);
  }

  // ------------------------------------------------------------------ session model
  function newSession(cfg) {
    return {
      id: 'B' + util.uid(),
      alias: cfg.alias, cls: cfg.cls, org: cfg.org, date: cfg.date, target: cfg.target,
      startedAt: new Date().toISOString(),
      elapsedMs: 0, running: true, resumedAt: Date.now(),
      activeId: '', activeSince: 0,
      items: [], recommendation: 'undecided', boardNotes: ''
    };
  }
  function normalize(s) {
    if (!s || typeof s !== 'object' || !s.id) return null;
    s.alias = txt(s.alias) || 'Candidate A';
    s.cls = txt(s.cls); s.org = txt(s.org); s.date = txt(s.date) || util.today();
    s.target = num(s.target, 8);
    s.elapsedMs = Math.max(0, num(s.elapsedMs, 0));
    s.running = !!s.running;
    s.resumedAt = Date.now();
    s.activeId = txt(s.activeId);
    s.activeSince = Date.now();
    s.recommendation = ['recommend', 'no', 'undecided'].indexOf(s.recommendation) >= 0 ? s.recommendation : 'undecided';
    s.boardNotes = txt(s.boardNotes);
    s.items = arr(s.items).filter(function (it) { return it && it.key; }).map(function (it) {
      return {
        key: txt(it.key), id: txt(it.id), custom: !!it.custom,
        question: txt(it.question), answer: txt(it.answer),
        domain: txt(it.domain), kind: txt(it.kind),
        asked: !!it.asked, notes: txt(it.notes),
        scores: (it.scores && typeof it.scores === 'object') ? it.scores : {},
        timeMs: Math.max(0, num(it.timeMs, 0))
      };
    });
    return s;
  }
  function loadLive() { return normalize(safe(function () { return CORB.get('progress.boards_live'); }, null)); }
  function persistLive() {
    if (!S || !S.sess) return;
    commitClocks();
    var copy = safe(function () { return util.deepClone(S.sess); }, null);
    if (!copy) return;
    delete copy.resumedAt; delete copy.activeSince;
    safe(function () { CORB.set('progress.boards_live', copy, { silent: true }); });
  }
  function clearLive() { safe(function () { CORB.set('progress.boards_live', null, { silent: true }); }); }

  function itemFromQuestion(q) {
    return {
      key: 'k' + util.uid(), id: txt(q.id), custom: false,
      question: txt(q.question), answer: q.answer_status === 'open' ? '' : txt(q.answer),
      domain: txt(q.domain), kind: txt(q.kind),
      asked: false, notes: '', scores: {}, timeMs: 0
    };
  }
  function fullQuestion(it) { return it && it.id ? safe(function () { return CORB.data.byId(it.id); }, null) : null; }
  function hasItem(id) { return !!(S.sess && S.sess.items.filter(function (it) { return it.id && it.id === id; })[0]); }

  // ------------------------------------------------------------------ clocks
  function elapsedMs() {
    var s = S.sess; if (!s) return 0;
    return s.elapsedMs + (s.running ? Math.max(0, Date.now() - s.resumedAt) : 0);
  }
  function itemMs(it) {
    var s = S.sess; if (!s || !it) return 0;
    var live = (s.running && s.activeId === it.key) ? Math.max(0, Date.now() - s.activeSince) : 0;
    return it.timeMs + live;
  }
  function commitClocks() {
    var s = S.sess; if (!s) return;
    var now = Date.now();
    if (s.running) {
      s.elapsedMs += Math.max(0, now - s.resumedAt);
      s.resumedAt = now;
      var act = itemByKey(s.activeId);
      if (act) { act.timeMs += Math.max(0, now - s.activeSince); }
      s.activeSince = now;
    } else { s.resumedAt = now; s.activeSince = now; }
  }
  function itemByKey(key) { if (!S.sess || !key) return null; return S.sess.items.filter(function (it) { return it.key === key; })[0] || null; }
  function setActive(key) {
    var s = S.sess; if (!s) return;
    commitClocks();
    s.activeId = (s.activeId === key) ? '' : key;
    s.activeSince = Date.now();
    if (s.activeId && !s.running) { s.running = true; s.resumedAt = Date.now(); }
    persistLive();
    paintHeader(); paintList();
  }
  function startTick() { if (tick) return; ticks = 0; tick = setInterval(onTick, 1000); }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
  function onTick() {
    if (!S || !S.sess || !R || !R.root || !document.body.contains(R.root)) { stopTick(); return; }
    paintClocks();
    ticks++;
    if (ticks % 15 === 0 && S.sess.running) persistLive();
  }

  // ------------------------------------------------------------------ scoring
  function itemAvg(it) {
    var dims = rubric().dimensions, vals = [];
    dims.forEach(function (d) { var v = it.scores && it.scores[d.id]; if (typeof v === 'number' && v > 0) vals.push(v); });
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }
  function dimAverages() {
    var dims = rubric().dimensions, out = {};
    dims.forEach(function (d) {
      var vals = [];
      arr(S.sess && S.sess.items).forEach(function (it) { var v = it.scores && it.scores[d.id]; if (typeof v === 'number' && v > 0) vals.push(v); });
      out[d.id] = vals.length ? Math.round((vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) * 10) / 10 : null;
    });
    return out;
  }
  function overallAvg() {
    var vals = [];
    arr(S.sess && S.sess.items).forEach(function (it) { var a = itemAvg(it); if (a != null) vals.push(a); });
    if (!vals.length) return null;
    return Math.round((vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) * 10) / 10;
  }
  function scoredCount() { return arr(S.sess && S.sess.items).filter(function (it) { return itemAvg(it) != null; }).length; }
  function askedCount() { return arr(S.sess && S.sess.items).filter(function (it) { return it.asked; }).length; }

  // ------------------------------------------------------------------ bank queries
  function bankFilter() {
    var f = { anyClass: true };   // board members see every class; the class filter below narrows it
    if (S.f.domain) f.domain = S.f.domain;
    if (S.f.kind) f.kind = S.f.kind;
    if (S.f.cls) f.classes = [S.f.cls];
    if (S.f.korea) f.flag = KOREA_FLAG;
    if (S.f.q) f.q = S.f.q;
    return f;
  }
  function bankResults() {
    var list = arr(safe(function () { return CORB.data.questions(bankFilter()); }, []));
    return list;
  }
  function poolFor(extra) {
    var f = { anyClass: true };
    if (S.f.cls) f.classes = [S.f.cls];
    if (S.f.korea) f.flag = KOREA_FLAG;
    if (extra) Object.keys(extra).forEach(function (k) { f[k] = extra[k]; });
    return arr(safe(function () { return CORB.data.questions(f); }, [])).filter(function (q) { return q && q.id && !hasItem(q.id); });
  }

  function addQuestion(q, quiet) {
    if (!q || !q.id) return false;
    if (hasItem(q.id)) { if (!quiet) ui.toast('Already in this session', 'warn'); return false; }
    S.sess.items.push(itemFromQuestion(q));
    if (!quiet) { persistLive(); paintHeader(); paintList(); paintBank(); ui.toast('Added to the session', 'ok'); }
    return true;
  }

  function addRandomFromDomain() {
    var dom = S.f.domain;
    var pool = poolFor(dom ? { domain: dom } : {});
    if (!pool.length) { ui.toast(dom ? 'No unused questions left in ' + dom : 'No unused questions match these filters', 'warn'); return; }
    var pick = util.shuffle(pool)[0];
    if (addQuestion(pick, true)) {
      persistLive(); paintHeader(); paintList(); paintBank();
      ui.toast('Added ' + (pick.id || 'a question') + ' · ' + (pick.domain || 'question bank'), 'ok');
    }
  }

  function buildBalanced(n) {
    n = util.clamp(num(n, 8), 1, 30);
    var pool = poolFor({});
    if (!pool.length) { ui.toast('No unused questions match these filters', 'warn'); return; }
    var chosen = [], used = {};
    function take(q) { if (!q || used[q.id]) return false; used[q.id] = 1; chosen.push(q); return true; }

    // required: one scenario, one ethics/authority or leadership item
    var scenarios = util.shuffle(pool.filter(function (q) { return q.kind === 'scenario'; }));
    if (scenarios.length) take(scenarios[0]);
    var ethics = util.shuffle(pool.filter(function (q) { return q.domain === ETHICS_DOMAIN || q.kind === 'leadership'; }));
    for (var e = 0; e < ethics.length && chosen.length < n; e++) { if (take(ethics[e])) break; }

    // spread the rest round-robin across the domains present in the pool
    var byDomain = {};
    pool.forEach(function (q) { (byDomain[q.domain || 'General Contracting'] = byDomain[q.domain || 'General Contracting'] || []).push(q); });
    var domains = util.shuffle(Object.keys(byDomain));
    domains.sort(function (a, b) {
      var ca = chosen.filter(function (q) { return q.domain === a; }).length;
      var cb = chosen.filter(function (q) { return q.domain === b; }).length;
      return ca - cb;
    });
    domains.forEach(function (d) { byDomain[d] = util.shuffle(byDomain[d]); });
    var guard = 0;
    while (chosen.length < n && guard < 4000) {
      var progressed = false;
      for (var i = 0; i < domains.length && chosen.length < n; i++) {
        var list = byDomain[domains[i]];
        while (list.length) { var q = list.shift(); if (take(q)) { progressed = true; break; } }
      }
      if (!progressed) break;
      guard++;
    }
    if (!chosen.length) { ui.toast('No unused questions match these filters', 'warn'); return; }
    chosen.forEach(function (q) { S.sess.items.push(itemFromQuestion(q)); });
    persistLive(); paintHeader(); paintList(); paintBank();
    var doms = {}; chosen.forEach(function (q) { doms[q.domain] = 1; });
    var short = chosen.length < n;
    ui.toast('Added ' + util.plural(chosen.length, 'question') + ' across ' + util.plural(Object.keys(doms).length, 'domain') + (short ? ' — the filtered bank ran out' : ''), short ? 'warn' : 'ok');
  }

  function customQuestionModal() {
    var qta = h('textarea.textarea', { placeholder: 'Type the question exactly as you will ask it.', 'aria-label': 'Custom question' });
    var ata = h('textarea.textarea', { style: { minHeight: '130px' }, placeholder: 'Optional: the model answer or the key points you expect to hear.', 'aria-label': 'Model answer (optional)' });
    ui.modal({
      title: 'Add a custom question',
      body: h('div.stack', {},
        h('p.small.muted', {}, 'This question lives in this session only. It is not written to the question bank and it is not shared with the candidate’s app.'),
        h('div.field', {}, h('label', {}, 'Question'), qta),
        h('div.field', {}, h('label', {}, 'Model answer (optional)'), ata),
        h('p.small.muted', {}, 'Keep it free of names, contract numbers and anything else that identifies a real person or action.')),
      actions: [
        { label: 'Cancel' },
        { label: 'Add to session', primary: true, onClick: function () {
          var qt = txt(qta.value).trim();
          if (!qt) { ui.toast('Type the question first', 'warn'); return false; }
          S.sess.items.push({ key: 'k' + util.uid(), id: '', custom: true, question: qt, answer: txt(ata.value).trim(), domain: 'Custom question', kind: 'knowledge', asked: false, notes: '', scores: {}, timeMs: 0 });
          persistLive(); paintHeader(); paintList();
          ui.toast('Custom question added', 'ok');
        } }
      ]
    });
  }

  // ------------------------------------------------------------------ header
  function paintClocks() {
    if (!R) return;
    if (R.elapsed) R.elapsed.textContent = clock(elapsedMs());
    var act = itemByKey(S.sess && S.sess.activeId);
    if (R.qclock) R.qclock.textContent = act ? clock(itemMs(act)) : '--:--';
    if (R.qclockLbl) R.qclockLbl.textContent = act ? ('On question ' + (S.sess.items.indexOf(act) + 1)) : 'No question running';
    arr(R.itemClocks).forEach(function (rec) { if (rec && rec.el) rec.el.textContent = clock(itemMs(rec.item)); });
  }
  function paintHeader() {
    if (!R || !R.header) return;
    ui.mount(R.header, headerInner());
    paintClocks();
  }
  function headerInner() {
    var s = S.sess, avg = overallAvg();
    var meta = h('div.bd-hd-id', {},
      h('div.bd-hd-alias', {}, icon('user'), h('b', {}, s.alias)),
      h('div.bd-hd-facts', {},
        s.cls ? ui.classBadge(s.cls) : null,
        s.org ? h('span.badge.neutral', {}, s.org) : null,
        h('span.muted.small', {}, util.fmtDate(s.date) || s.date),
        h('span.muted.small.num', {}, askedCount() + '/' + s.items.length + ' asked'),
        s.target ? h('span.muted.small', {}, 'target ' + s.target) : null));

    var clocks = h('div.bd-hd-clocks', {},
      h('div.bd-clock', {},
        h('div.bd-clock-lbl', {}, icon('clock'), 'Board elapsed'),
        R.elapsed = h('div.timer.bd-clock-val', {}, clock(elapsedMs()))),
      h('div.bd-clock', {},
        R.qclockLbl = h('div.bd-clock-lbl', {}, icon('timer'), 'No question running'),
        R.qclock = h('div.timer.bd-clock-val', {}, '--:--')),
      h('div.bd-clock.bd-clock-avg', {},
        h('div.bd-clock-lbl', {}, icon('scale'), 'Overall average'),
        h('div.bd-clock-val.bd-avg', {}, avg == null ? h('span.bd-avg-empty', {}, 'not scored') : [h('b', {}, avg.toFixed(1)), h('span.bd-avg-of', {}, '/ 5')]),
        h('div.bd-clock-sub', {}, scoredCount() ? util.plural(scoredCount(), 'question') + ' scored' : 'score as you go')));

    var rec = h('div.bd-rec', {},
      h('div.bd-rec-lbl', {}, 'My recommendation'),
      h('div.seg.bd-rec-seg', { role: 'group', 'aria-label': 'My recommendation' }, RECS.map(function (r) {
        return h('button' + (s.recommendation === r[0] ? '.on' : '') + '.bd-rec-' + r[2], {
          type: 'button', 'aria-pressed': s.recommendation === r[0] ? 'true' : 'false',
          onclick: function () { s.recommendation = r[0]; persistLive(); paintHeader(); }
        }, r[1]);
      })),
      h('div.bd-rec-note', {}, icon('info'), PASS_NOTE));

    var controls = h('div.bd-hd-actions', {},
      h('button.btn.sm' + (s.running ? '' : '.primary'), { type: 'button', onclick: toggleRun }, icon(s.running ? 'pause' : 'play'), s.running ? 'Pause' : 'Resume'),
      h('button.btn.sm.primary', { type: 'button', onclick: finishSession }, icon('check'), 'Finish session'),
      h('button.btn.sm.ghost', { type: 'button', 'data-tip': 'Print the board sheet', onclick: function () { doPrint(); } }, icon('print')),
      h('button.btn.sm.ghost.danger', { type: 'button', onclick: discardSession }, icon('trash'), h('span.hide-sm', {}, 'Discard')));

    return h('div.bd-hd-inner', {}, meta, clocks, rec, controls);
  }
  function toggleRun() {
    var s = S.sess;
    commitClocks();
    s.running = !s.running;
    s.resumedAt = Date.now(); s.activeSince = Date.now();
    persistLive(); paintHeader(); paintList();
    ui.toast(s.running ? 'Clock running' : 'Clock paused');
  }

  // ------------------------------------------------------------------ session list
  function paintList() {
    if (!R || !R.list) return;
    R.itemClocks = [];
    var s = S.sess;
    if (!s.items.length) {
      ui.mount(R.list, h('div.empty.bd-empty', {},
        icon('layers'),
        h('h3', {}, 'No questions selected yet'),
        h('p', {}, 'Build the set from the bank on the right: add one at random from a domain, build a balanced set, or write a question of your own. Questions stay in the order you add them and you can reorder them at any time.'),
        h('div.bd-empty-actions', {},
          h('button.btn.primary', { type: 'button', onclick: function () { buildBalanced(S.sess.target || 8); } }, icon('layers'), 'Build a balanced set of ' + (S.sess.target || 8)),
          h('button.btn', { type: 'button', onclick: customQuestionModal }, icon('plus'), 'Add a custom question'))));
      paintClocks();
      return;
    }
    var frag = document.createDocumentFragment();
    s.items.forEach(function (it, i) { frag.appendChild(itemCard(it, i)); });
    R.list.innerHTML = '';
    R.list.appendChild(frag);
    paintClocks();
  }

  function itemCard(it, i) {
    var s = S.sess;
    var open = !!S.open[it.key];
    var active = s.activeId === it.key;
    var q = fullQuestion(it);
    var ctx = {};
    var clockEl = h('span.bd-item-clock.num', {}, clock(itemMs(it)));
    R.itemClocks.push({ item: it, el: clockEl });
    ctx.avgSlot = h('span.bd-item-avg-slot');
    ctx.paintAvg = function () {
      var a = itemAvg(it);
      ctx.avgSlot.innerHTML = '';
      if (a != null) ctx.avgSlot.appendChild(h('span.bd-item-avg', { 'data-tip': 'Average of the dimensions you scored' }, a.toFixed(1)));
    };
    ctx.paintAvg();

    var head = h('div.bd-item-head', {},
      h('button.bd-item-toggle', {
        type: 'button', 'aria-expanded': open ? 'true' : 'false',
        onclick: function () { S.open[it.key] = !open; paintList(); }
      },
        h('span.bd-item-n.num', {}, String(i + 1)),
        h('span.bd-item-q' + (open ? '' : '.clamp-2'), {}, it.question || '(no question text)'),
        icon('chevron', 'bd-item-chev')),
      h('div.bd-item-side', {},
        ctx.avgSlot,
        clockEl,
        h('button.btn.icon.sm.ghost.bd-item-run' + (active ? '.on' : ''), {
          type: 'button', 'aria-label': active ? 'Stop the clock on this question' : 'Start the clock on this question',
          'data-tip': active ? 'Stop this clock' : 'Start this clock',
          onclick: function () { setActive(it.key); }
        }, icon(active ? 'pause' : 'play'))));

    var meta = h('div.bd-item-meta', {},
      it.custom ? h('span.badge.neutral', {}, 'Custom · session only') : null,
      q ? ui.flagsFor(q).map(function (f) { return ui.badge(f); }) : null,
      q ? arr(q.classes).map(ui.classBadge) : null,
      it.domain ? h('span.badge.neutral', {}, it.domain) : null,
      it.kind && it.kind !== 'knowledge' ? h('span.badge.neutral', {}, it.kind) : null,
      it.id ? h('span.muted.small.num', {}, it.id) : null,
      h('span.grow'),
      h('label.switch.bd-asked', {},
        ctx.askedInput = h('input', { type: 'checkbox', checked: it.asked, onchange: function (e) { it.asked = !!e.target.checked; if (ctx.card) ctx.card.classList.toggle('asked', it.asked); persistLive(); paintHeader(); } }),
        h('span', {}, 'Asked')),
      h('div.bd-item-move', {},
        h('button.btn.icon.sm.ghost', { type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: function () { move(i, -1); } }, icon('chevron', 'bd-up')),
        h('button.btn.icon.sm.ghost', { type: 'button', 'aria-label': 'Move down', disabled: i === s.items.length - 1, onclick: function () { move(i, 1); } }, icon('chevron')),
        h('button.btn.icon.sm.ghost.bd-remove', { type: 'button', 'aria-label': 'Remove from session', onclick: function () { removeItem(it); } }, icon('x'))));

    var card = h('article.bd-item' + (open ? '.open' : '') + (active ? '.active' : '') + (it.asked ? '.asked' : ''), { 'data-key': it.key }, head, meta);
    ctx.card = card;
    if (open) card.appendChild(itemBody(it, q, ctx));
    return card;
  }

  function itemBody(it, q, ctx) {
    var body = h('div.bd-item-body');
    body.appendChild(h('div.bd-item-full', {}, ui.rich(it.question)));

    // reveal answer (hidden by default, per member, never persisted)
    var ansWrap = h('div.bd-answer-wrap');
    function drawAnswer() {
      ansWrap.innerHTML = '';
      var shown = !!S.reveal[it.key];
      var btn = h('button.btn.sm.bd-reveal' + (shown ? '.on' : ''), {
        type: 'button', 'aria-expanded': shown ? 'true' : 'false',
        onclick: function () { S.reveal[it.key] = !shown; drawAnswer(); }
      }, icon(shown ? 'eye-off' : 'eye'), shown ? 'Hide the answer again' : 'Reveal answer to me');
      ansWrap.appendChild(h('div.bd-reveal-row', {}, btn, h('span.muted.small', {}, shown ? 'Visible on your screen only — mind the projector.' : 'Stays hidden until you ask for it.')));
      if (!shown) return;
      var panel = h('div.bd-answer');
      var text = it.custom ? it.answer : (q ? (q.answer_status === 'open' ? '' : txt(q.answer)) : it.answer);
      if (text) panel.appendChild(ui.rich(text));
      else panel.appendChild(h('p.muted', {}, it.custom ? 'You did not record a model answer for this custom question. Score what you hear against the rubric.' : 'The repository has no formal answer for this question. Score the reasoning, not a script.'));
      if (q && arr(q.key_points).length) panel.appendChild(h('div.panel-soft.mt-3', {}, h('div.eyebrow', {}, 'Key points'), h('ul.mt-2', {}, arr(q.key_points).map(function (k) { return h('li', {}, txt(k)); }))));
      var cites = q ? (arr(q.citations_rfo).length ? arr(q.citations_rfo) : arr(q.citations)) : [];
      if (cites.length) panel.appendChild(h('div.bd-answer-cite', {}, 'Cite: ', cites.map(function (c) {
        var u = safe(function () { return CORB.data.citeUrl(c); }, null);
        return u ? h('a.cite', { href: u, target: '_blank', rel: 'noopener' }, txt(c)) : h('span.cite', {}, txt(c));
      })));
      ansWrap.appendChild(panel);
    }
    drawAnswer();
    body.appendChild(ansWrap);

    // probes
    var probes = probesFor(it.domain);
    if (probes.length) {
      body.appendChild(h('details.acc.bd-probes', {},
        h('summary', {}, icon('spark'), 'Follow-up probes · ' + it.domain, h('span.badge.neutral', {}, String(probes.length)), icon('chevron', 'chev')),
        h('div.acc-body', {}, h('ul.bd-probe-list', {}, probes.map(function (p) { return h('li', {}, p); })),
          h('p.small.muted.mt-2', {}, 'Probes follow the candidate’s answer; they are not a new topic. Verify anything Korea-specific with C&P before you rely on it.'))));
    }

    // notes
    var ta = h('textarea.textarea.bd-notes', {
      value: it.notes, placeholder: 'What the candidate actually said, gaps, what you probed, anything the board should hear in deliberation.',
      'aria-label': 'Notes for question ' + (S.sess.items.indexOf(it) + 1),
      oninput: function (e) { it.notes = e.target.value; queueSave(); }
    });
    body.appendChild(h('div.field.bd-notes-field', {}, h('label', {}, 'My notes'), ta));

    // rubric
    body.appendChild(rubricBlock(it, ctx));
    return body;
  }

  function rubricBlock(it, ctx) {
    var rb = rubric();
    if (!rb.dimensions.length) {
      return h('div.callout.info.bd-rubric-empty', {}, icon('info'),
        h('div', {}, h('b', {}, 'No scoring rubric is loaded'), 'Score on your own sheet and record what you heard in the notes above. The board rubric module is empty in this copy of the app.'));
    }
    var wrap = h('div.bd-rubric', {}, h('div.bd-rubric-head', {}, h('span.eyebrow', {}, 'Score this answer'), h('span.muted.small', {}, '1 unacceptable · 3 meets the class requested · 5 clearly exceeds')));
    rb.dimensions.forEach(function (d) {
      var cur = it.scores && it.scores[d.id];
      var anchorEl = h('div.bd-dim-anchor', {}, anchorText(d, cur));
      var btns = [1, 2, 3, 4, 5].map(function (n) {
        return h('button' + (cur === n ? '.on' : ''), {
          type: 'button', 'aria-pressed': cur === n ? 'true' : 'false',
          title: anchorFor(d, n) || ('Score ' + n),
          onclick: function () {
            if (!it.scores || typeof it.scores !== 'object') it.scores = {};
            if (it.scores[d.id] === n) delete it.scores[d.id]; else it.scores[d.id] = n;
            var v = it.scores[d.id];
            btns.forEach(function (b, i) { var on = v === i + 1; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
            anchorEl.textContent = anchorText(d, v);
            if (v && !it.asked) { it.asked = true; if (ctx && ctx.askedInput) ctx.askedInput.checked = true; if (ctx && ctx.card) ctx.card.classList.add('asked'); }
            if (ctx && ctx.paintAvg) ctx.paintAvg();
            persistLive(); paintHeader();
          }
        }, String(n));
      });
      wrap.appendChild(h('div.bd-dim', {},
        h('div.bd-dim-copy', {},
          h('div.bd-dim-name', {}, d.name || d.id, d.description ? h('span.bd-dim-tip', { 'data-tip': txt(d.description).slice(0, 160) }, icon('info')) : null),
          anchorEl),
        h('div.rate.bd-rate', { role: 'group', 'aria-label': (d.name || d.id) + ' score' }, btns)));
    });
    return wrap;
  }
  function anchorFor(d, n) {
    var a = d && d.anchors;
    if (!a || typeof a !== 'object') return '';
    return txt(a[String(n)] || a[n]);
  }
  function anchorText(d, cur) {
    if (cur) { var t = anchorFor(d, cur); return t ? t.slice(0, 220) : 'Scored ' + cur + ' of 5.'; }
    return txt(d && d.description).slice(0, 180) || 'Not scored yet.';
  }

  function move(i, dir) {
    var items = S.sess.items, j = i + dir;
    if (j < 0 || j >= items.length) return;
    var t = items[i]; items[i] = items[j]; items[j] = t;
    persistLive(); paintList();
  }
  function removeItem(it) {
    var idx = S.sess.items.indexOf(it);
    if (idx < 0) return;
    var scored = itemAvg(it) != null || txt(it.notes).trim();
    function drop() {
      if (S.sess.activeId === it.key) { commitClocks(); S.sess.activeId = ''; }
      S.sess.items.splice(idx, 1);
      delete S.open[it.key]; delete S.reveal[it.key];
      persistLive(); paintHeader(); paintList(); paintBank();
    }
    if (!scored) { drop(); return; }
    ui.confirm('Remove this question? Your notes and scores for it are deleted with it.', { ok: 'Remove', danger: true }).then(function (ok) { if (ok) drop(); });
  }

  var saveTimer = null;
  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { persistLive(); }, 700); }

  // ------------------------------------------------------------------ bank panel
  function paintBank() {
    if (!R || !R.bank) return;
    ui.mount(R.bank, bankInner());
  }
  function bankInner() {
    var total = bank().length;
    var wrap = h('div.bd-bank-inner', {});
    wrap.appendChild(h('div.bd-bank-head', {}, h('h2', {}, icon('book'), 'Question bank'), h('span.muted.small.num', {}, total ? total + ' items' : '')));

    if (!total) {
      wrap.appendChild(h('div.empty.bd-bank-empty', {},
        icon('book'),
        h('h3', {}, 'The question bank is empty'),
        h('p', {}, 'This copy of the app was built without questions, or your organization filter hides every item. You can still run the board on custom questions typed here.'),
        h('button.btn.primary.mt-4', { type: 'button', onclick: customQuestionModal }, icon('plus'), 'Add a custom question')));
      return wrap;
    }

    var f = S.f;
    var domSel = h('select.select', { 'aria-label': 'Domain', onchange: function (e) { f.domain = e.target.value; S.shown = BANK_PAGE; paintBank(); } },
      [h('option', { value: '' }, 'All domains')].concat(domainsOf().map(function (d) { return h('option', { value: d, selected: f.domain === d }, d); })));
    var clsSel = h('select.select', { 'aria-label': 'Warrant class', onchange: function (e) { f.cls = e.target.value; S.shown = BANK_PAGE; paintBank(); } },
      [h('option', { value: '' }, 'All classes')].concat(classesOf().map(function (c) { return h('option', { value: c, selected: f.cls === c }, classLabel(c)); })));
    var kindSel = h('select.select', { 'aria-label': 'Question kind', onchange: function (e) { f.kind = e.target.value; S.shown = BANK_PAGE; paintBank(); } },
      KINDS.map(function (k) { return h('option', { value: k[0], selected: f.kind === k[0] }, k[1]); }));
    var search = h('input.input', { type: 'search', value: f.q, placeholder: 'Search the bank…', 'aria-label': 'Search the question bank', autocomplete: 'off', spellcheck: 'false',
      oninput: function (e) { var v = e.target.value; clearTimeout(R.searchTimer); R.searchTimer = setTimeout(function () { f.q = v.trim(); S.shown = BANK_PAGE; paintBank(); var el = R.bank.querySelector('.bd-bank-search input'); if (el) { el.focus(); var n = el.value.length; try { el.setSelectionRange(n, n); } catch (err) {} } }, 260); } });
    var korea = h('label.switch.bd-korea', {},
      h('input', { type: 'checkbox', checked: !!f.korea, onchange: function (e) { f.korea = !!e.target.checked; S.shown = BANK_PAGE; paintBank(); } }),
      h('span', {}, 'Korea items only'));

    wrap.appendChild(h('div.bd-bank-filters', {}, domSel, clsSel, kindSel,
      h('div.search.bd-bank-search', {}, icon('search'), search), korea));

    var nInput = h('input.input.bd-n', { type: 'number', min: '1', max: '30', value: String(S.sess.target || 8), 'aria-label': 'How many questions in the balanced set' });
    wrap.appendChild(h('div.bd-bank-build', {},
      h('button.btn.sm.block', { type: 'button', onclick: addRandomFromDomain }, icon('shuffle'), f.domain ? 'Add 1 random from ' + shortDomain(f.domain) : 'Add 1 random question'),
      h('div.bd-build-row', {}, nInput,
        h('button.btn.sm.primary.grow', { type: 'button', onclick: function () { buildBalanced(nInput.value); } }, icon('layers'), 'Build a balanced set')),
      h('p.bd-build-note', {}, 'A balanced set spreads across the domains left by your filters and always includes a scenario and an ethics or authority item when the bank has them.'),
      h('button.btn.sm.block', { type: 'button', onclick: customQuestionModal }, icon('plus'), 'Add a custom question')));

    var res = bankResults();
    wrap.appendChild(h('div.bd-bank-count', {}, h('b', {}, String(res.length)), ' match ', h('span.muted', {}, '· ' + unitLabel())));

    if (!res.length) {
      wrap.appendChild(h('div.empty.bd-bank-none', {},
        h('h3', {}, 'Nothing matches'),
        h('p', {}, 'Widen the filters, clear the search, or switch the organization in the top bar.'),
        h('button.btn.sm.mt-4', { type: 'button', onclick: function () { S.f = freshFilters(); S.shown = BANK_PAGE; paintBank(); } }, icon('refresh'), 'Clear filters')));
      return wrap;
    }

    var shown = Math.min(S.shown, res.length);
    var list = h('div.bd-bank-list');
    res.slice(0, shown).forEach(function (q) { list.appendChild(bankRow(q)); });
    wrap.appendChild(list);
    if (shown < res.length) {
      wrap.appendChild(h('button.btn.sm.block.mt-3', { type: 'button', onclick: function () { S.shown += BANK_PAGE; paintBank(); } },
        icon('chevron'), 'Show ' + Math.min(BANK_PAGE, res.length - shown) + ' more'));
    }
    return wrap;
  }
  function shortDomain(d) { return txt(d).split(/\s*[&,]\s*/)[0] || d; }
  function bankRow(q) {
    var inSet = hasItem(q.id);
    return h('div.bd-bank-row' + (inSet ? '.in' : ''), {},
      h('div.bd-bank-copy', {},
        h('div.bd-bank-q.clamp-3', {}, txt(q.question)),
        h('div.bd-bank-tags', {},
          q.kind === 'scenario' ? h('span.badge.neutral', {}, 'Scenario') : null,
          q.kind === 'leadership' ? h('span.badge.neutral', {}, 'Leadership') : null,
          arr(q.flags).indexOf(KOREA_FLAG) >= 0 ? ui.badge(KOREA_FLAG) : null,
          h('span.muted.small', {}, txt(q.topic) || txt(q.domain)),
          h('span.muted.small.num', {}, txt(q.id)))),
      h('button.btn.icon.sm' + (inSet ? '.ghost' : '.primary'), {
        type: 'button', disabled: inSet,
        'aria-label': inSet ? 'Already in the session' : 'Add to the session',
        'data-tip': inSet ? 'Already added' : 'Add',
        onclick: function () { addQuestion(q); }
      }, icon(inSet ? 'check' : 'plus')));
  }
  function freshFilters() { return { domain: '', cls: '', kind: '', korea: false, q: '' }; }

  // ------------------------------------------------------------------ finish / export
  function buildRecord() {
    commitClocks();
    var s = S.sess, rb = rubric();
    return {
      id: s.id, source: 'board-console', mode: 'live-board',
      ts: new Date().toISOString(),
      alias: s.alias, cls: s.cls, org: s.org, date: s.date,
      unit: unitLabel(),
      started: s.startedAt, elapsed_seconds: Math.round(s.elapsedMs / 1000),
      recommendation: s.recommendation,
      pass_rule: PASS_NOTE,
      board_notes: txt(s.boardNotes),
      overall: overallAvg(),
      dimensions: dimAverages(),
      dimension_names: rb.dimensions.map(function (d) { return { id: d.id, name: d.name || d.id }; }),
      questions: s.items.map(function (it) {
        return {
          id: it.id || ('CUSTOM-' + it.key), custom: !!it.custom, question: it.question,
          domain: it.domain, kind: it.kind, asked: !!it.asked, notes: txt(it.notes),
          scores: safe(function () { return util.deepClone(it.scores || {}); }, {}),
          average: itemAvg(it), seconds: Math.round(itemMs(it) / 1000)
        };
      })
    };
  }
  function finishSession() {
    var s = S.sess;
    var unasked = s.items.length - askedCount();
    var msg = 'Finish this board for ' + s.alias + '? The session is filed in your history and the live console is cleared.'
      + (unasked > 0 ? ' ' + util.plural(unasked, 'question') + ' still marked not asked.' : '')
      + (s.recommendation === 'undecided' ? ' Your recommendation is still Undecided.' : '');
    ui.confirm(msg, { ok: 'Finish session', title: 'Finish the board' }).then(function (ok) {
      if (!ok) return;
      var rec = buildRecord();
      safe(function () { CORB.scoring.recordBoard(rec); });
      s.items.forEach(function (it) { if (it.id) safe(function () { CORB.set('progress.seen.' + it.id, util.today(), { silent: true }); }); });
      clearLive();
      S.sess = null; S.open = {}; S.reveal = {};
      stopTick();
      build(R.root);
      finishedModal(rec);
    });
  }
  function finishedModal(rec) {
    var dims = arr(rec.dimension_names);
    var body = h('div.stack', {},
      h('p', {}, 'Filed ', h('b', {}, rec.alias), rec.cls ? [' · ', classLabel(rec.cls)] : '', ' · ', util.fmtDate(rec.date) || rec.date, '.'),
      h('div.grid.cols-3', {},
        h('div.stat', {}, h('div.label', {}, 'Overall'), h('div.value', {}, rec.overall == null ? '—' : rec.overall.toFixed(1)), h('div.delta', {}, rec.overall == null ? 'no scores recorded' : 'average of 5')),
        h('div.stat', {}, h('div.label', {}, 'Questions'), h('div.value', {}, String(arr(rec.questions).length)), h('div.delta', {}, arr(rec.questions).filter(function (q) { return q.asked; }).length + ' asked')),
        h('div.stat', {}, h('div.label', {}, 'Elapsed'), h('div.value', {}, clock((rec.elapsed_seconds || 0) * 1000)), h('div.delta', {}, 'board clock'))),
      dims.length ? h('div.list', {}, dims.map(function (d) {
        var v = rec.dimensions ? rec.dimensions[d.id] : null;
        return h('div.list-item', {}, h('span.grow.small.muted', {}, d.name), h('b.num', {}, v == null ? '—' : v.toFixed(1)));
      })) : null,
      h('div.callout.info', {}, icon('info'), h('div', {}, h('b', {}, recLabel(rec.recommendation)), PASS_NOTE + ' Your vote is recorded here for your own recall; it is not a board decision.')),
      h('p.small.muted', {}, 'The export carries the alias you typed and nothing else about the candidate. Handle it the way you handle the paper scoring sheet.'));
    ui.modal({
      title: 'Board session filed', body: body,
      actions: [
        { label: 'Close' },
        { label: 'Print sheet', onClick: function () { printRecord(rec); } },
        { label: 'Export JSON', primary: true, onClick: function () { exportRecord(rec); return false; }, keepOpen: true }
      ]
    });
  }
  function recLabel(r) { for (var i = 0; i < RECS.length; i++) { if (RECS[i][0] === r) return RECS[i][1]; } return 'Undecided'; }
  function exportRecord(rec) {
    var name = 'CORB-board_' + slug(rec.alias) + '_' + util.stamp() + '.json';
    var ok = safe(function () { return CORB.store.download(name, JSON.stringify(rec, null, 1), 'application/json'); }, false);
    ui.toast(ok ? 'Saved ' + name : 'This browser blocked the download', ok ? 'ok' : 'danger');
  }
  function discardSession() {
    ui.confirm('Discard this session? Every question, note and score in it is deleted and nothing is filed in history.', { ok: 'Discard', danger: true, title: 'Discard the session' }).then(function (ok) {
      if (!ok) return;
      clearLive(); S.sess = null; S.open = {}; S.reveal = {}; stopTick();
      build(R.root); ui.toast('Session discarded');
    });
  }

  // ------------------------------------------------------------------ print
  function printRecord(rec) {
    if (!R || !R.print) { safe(function () { window.print(); }); return; }
    ui.mount(R.print, printSheet(rec));
    R.printPinned = true;
    setTimeout(function () {
      safe(function () { window.print(); });
      setTimeout(function () { if (R) R.printPinned = false; }, 600);
    }, 60);
  }
  function doPrint() {
    var rec = S.sess ? buildRecord() : null;
    if (!rec) { ui.toast('Nothing to print yet', 'warn'); return; }
    printRecord(rec);
  }
  function printSheet(rec) {
    var meta = CORB.DATA && CORB.DATA.meta ? CORB.DATA.meta : {};
    var dims = arr(rec.dimension_names);
    return h('div.bd-print-sheet', {},
      h('div.bd-print-head', {},
        h('div.bd-print-kicker', {}, 'Contracting Officer Review Board · board member sheet'),
        h('h1', {}, rec.alias),
        h('div.bd-print-sub', {}, [rec.cls ? classLabel(rec.cls) : '', rec.org || '', util.fmtDate(rec.date) || rec.date, rec.unit || ''].filter(Boolean).join(' · ')),
        h('div.bd-print-sub', {}, 'Recommendation: ' + recLabel(rec.recommendation) + ' · Overall ' + (rec.overall == null ? 'not scored' : rec.overall.toFixed(1) + ' of 5') + ' · Elapsed ' + clock((rec.elapsed_seconds || 0) * 1000)),
        h('div.bd-print-disc', {}, PASS_NOTE + ' ' + txt(meta.disclaimer || 'Training aid — not authoritative guidance. Alias only; no candidate identity is recorded here.'))),
      dims.length ? h('div.bd-print-dims', {}, dims.map(function (d) {
        var v = rec.dimensions ? rec.dimensions[d.id] : null;
        return h('span', {}, d.name + ': ' + (v == null ? '—' : v.toFixed(1)));
      })) : null,
      arr(rec.questions).map(function (q, i) {
        return h('div.bd-print-item', {},
          h('div.bd-print-meta', {}, [(i + 1) + '.', q.id, q.domain, q.asked ? 'asked' : 'not asked', clock((q.seconds || 0) * 1000)].filter(Boolean).join(' · ')),
          h('div.bd-print-q', {}, q.question),
          dims.length ? h('div.bd-print-scores', {}, dims.map(function (d) { return h('span', {}, d.name + ': ' + (q.scores && q.scores[d.id] ? q.scores[d.id] : '—')); })) : null,
          q.notes ? h('div.bd-print-notes', {}, q.notes) : h('div.bd-print-notes.bd-print-blank', {}, '(no notes)'));
      }),
      h('div.bd-print-foot', {}, 'Printed ' + util.fmtDateTime(new Date().toISOString()) + ' · ' + txt(meta.app_name || 'CORB prep app')));
  }

  // ------------------------------------------------------------------ history
  function historyRecords() {
    var list = arr(safe(function () { return CORB.get('progress.boards', []); }, []));
    return list.map(function (r, i) { return { rec: r, idx: i }; })
      .filter(function (x) { return x.rec && typeof x.rec === 'object'; })
      .sort(function (a, b) { return txt(b.rec.ts).localeCompare(txt(a.rec.ts)); });
  }
  function paintHistory() {
    if (!R || !R.history) return;
    ui.mount(R.history, historyInner());
  }
  function historyInner() {
    var rows = historyRecords();
    var wrap = h('div.bd-hist', {});
    if (!rows.length) {
      wrap.appendChild(h('div.empty.bd-empty', {}, icon('clock'),
        h('h3', {}, 'No boards filed yet'),
        h('p', {}, 'Sessions you finish in the console land here, newest first, with their questions, notes and scores. Mock boards run from the Practice section appear here too.')));
      return wrap;
    }
    wrap.appendChild(h('p.small.muted.mb-4', {}, 'Stored in this browser only, on this device. Export anything you need to keep; clearing site data removes it.'));
    rows.forEach(function (x) { wrap.appendChild(historyRow(x)); });
    return wrap;
  }
  function historyRow(x) {
    var rec = x.rec;
    var live = rec.source === 'board-console';
    var qs = arr(rec.questions);
    var open = S.historyOpen === rec.id;
    var head = h('div.bd-hist-head', {},
      h('button.bd-hist-toggle', { type: 'button', 'aria-expanded': open ? 'true' : 'false', onclick: function () { S.historyOpen = open ? '' : rec.id; paintHistory(); } },
        h('span.bd-hist-when.num', {}, util.fmtDate(txt(rec.ts).slice(0, 10)) || txt(rec.ts).slice(0, 10)),
        h('span.bd-hist-alias', {}, txt(rec.alias) || (live ? 'Unnamed candidate' : 'Mock board')),
        h('span.grow'),
        rec.cls ? ui.classBadge(rec.cls) : null,
        h('span.badge.neutral', {}, live ? 'Live board' : 'Mock board'),
        rec.recommendation ? h('span.badge.' + recTone(rec.recommendation), {}, recLabel(rec.recommendation)) : null,
        h('span.bd-hist-avg.num', {}, rec.overall == null ? '—' : Number(rec.overall).toFixed(1)),
        icon('chevron', 'bd-item-chev')),
      h('div.bd-hist-actions', {},
        h('button.btn.icon.sm.ghost', { type: 'button', 'aria-label': 'Export this session', 'data-tip': 'Export JSON', onclick: function () { exportRecord(rec); } }, icon('download')),
        h('button.btn.icon.sm.ghost', { type: 'button', 'aria-label': 'Print this session', 'data-tip': 'Print', onclick: function () { printRecord(printable(rec)); } }, icon('print')),
        h('button.btn.icon.sm.ghost.bd-remove', { type: 'button', 'aria-label': 'Delete this session', 'data-tip': 'Delete', onclick: function () { deleteRecord(x); } }, icon('trash'))));
    var card = h('article.bd-hist-card' + (open ? '.open' : ''), {}, head);
    if (open) card.appendChild(historyBody(rec, qs));
    return card;
  }
  function recTone(r) { return r === 'recommend' ? 'official' : r === 'no' ? 'rfo-unverifiable' : 'ai-draft'; }
  function printable(rec) {
    var r = safe(function () { return util.deepClone(rec); }, null) || {};
    if (!arr(r.dimension_names).length) r.dimension_names = rubric().dimensions.map(function (d) { return { id: d.id, name: d.name || d.id }; });
    if (!r.alias) r.alias = 'Mock board';
    if (!r.date) r.date = txt(r.ts).slice(0, 10);
    return r;
  }
  function historyBody(rec, qs) {
    var dims = arr(rec.dimension_names).length ? arr(rec.dimension_names) : rubric().dimensions.map(function (d) { return { id: d.id, name: d.name || d.id }; });
    var body = h('div.bd-hist-body', {});
    body.appendChild(h('div.bd-hist-facts', {},
      rec.org ? h('span', {}, rec.org) : null,
      rec.unit ? h('span', {}, rec.unit) : null,
      h('span', {}, util.plural(qs.length, 'question')),
      h('span', {}, qs.filter(function (q) { return q.asked; }).length + ' asked'),
      rec.elapsed_seconds ? h('span', {}, clock(rec.elapsed_seconds * 1000) + ' elapsed') : null,
      h('span.bd-hist-ro', {}, icon('eye'), 'Read-only')));
    if (dims.length) {
      body.appendChild(h('div.bd-hist-dims', {}, dims.map(function (d) {
        var v = rec.dimensions ? rec.dimensions[d.id] : null;
        return h('div.bd-hist-dim', {}, h('span.grow', {}, d.name), h('b.num', {}, v == null ? '—' : Number(v).toFixed(1)));
      })));
    }
    if (!qs.length) { body.appendChild(h('p.muted.small', {}, 'This record has no question detail.')); return body; }
    qs.forEach(function (q, i) {
      body.appendChild(h('div.bd-hist-q', {},
        h('div.bd-hist-q-meta', {}, h('span.num', {}, String(i + 1)), h('span.grow', {}, txt(q.domain)), q.asked ? null : h('span.badge.neutral', {}, 'not asked'), q.seconds ? h('span.muted.small.num', {}, clock(q.seconds * 1000)) : null),
        h('div.bd-hist-q-text', {}, txt(q.question) || (q.id ? questionTextById(q.id) : '') || '(question text not recorded)'),
        dims.length ? h('div.bd-hist-q-scores', {}, dims.map(function (d) {
          var v = q.scores ? q.scores[d.id] : null;
          return h('span.bd-hist-chip' + (v ? '.on' : ''), {}, (d.name || d.id).split(' ')[0] + ' ' + (v || '—'));
        })) : null,
        txt(q.notes) ? h('div.bd-hist-q-notes', {}, txt(q.notes)) : null));
    });
    return body;
  }
  function questionTextById(id) { var q = safe(function () { return CORB.data.byId(id); }, null); return q ? txt(q.question) : ''; }
  function deleteRecord(x) {
    ui.confirm('Delete this filed board? It cannot be recovered unless you exported it.', { ok: 'Delete', danger: true }).then(function (ok) {
      if (!ok) return;
      var list = arr(safe(function () { return CORB.get('progress.boards', []); }, []));
      if (x.idx >= 0 && x.idx < list.length) { list.splice(x.idx, 1); safe(function () { CORB.set('progress.boards', list); }); }
      S.historyOpen = '';
      paintHistory(); paintTabs();
      ui.toast('Session deleted');
    });
  }

  // ------------------------------------------------------------------ setup
  function setupPanel() {
    var saved = safe(function () { return CORB.get('settings.board', {}); }, {}) || {};
    var pre = S.pre || {};
    var preCls = pre.cls && classesOf().indexOf(pre.cls) >= 0 ? pre.cls : txt(saved.cls);
    var alias = h('input.input', { value: txt(pre.alias) || 'Candidate A', placeholder: 'Candidate A', 'aria-label': 'Candidate alias', maxlength: '60' });
    var cls = h('select.select', { 'aria-label': 'Warrant class' }, [h('option', { value: '' }, 'Not specified')].concat(classesOf().map(function (c) { return h('option', { value: c, selected: preCls === c }, classLabel(c)); })));
    var org = h('input.input', { value: txt(saved.org) || unitLabel(), placeholder: 'Contracting office or division', 'aria-label': 'Organization', maxlength: '80' });
    var date = h('input.input', { type: 'date', value: util.today(), 'aria-label': 'Board date' });
    var target = h('input.input', { type: 'number', min: '1', max: '30', value: String(util.clamp(num(pre.n, num(saved.target, 8)), 1, 30)), 'aria-label': 'Target question count' });

    var focusBox = h('div.bd-setup-focus', { hidden: true });
    function paintFocus() {
      var t = classFocus(cls.value);
      focusBox.hidden = !t;
      if (!t) return;
      ui.mount(focusBox, [h('div.eyebrow', {}, 'What the board looks for at ' + classLabel(cls.value)), h('p.small', {}, t)]);
    }
    cls.addEventListener('change', paintFocus);
    paintFocus();

    function start() {
      var a = txt(alias.value).trim() || 'Candidate A';
      if (/@/.test(a)) { ui.toast('Use an alias, not an email address', 'danger'); alias.focus(); return; }
      S.sess = newSession({ alias: a, cls: cls.value, org: txt(org.value).trim(), date: txt(date.value) || util.today(), target: util.clamp(num(target.value, 8), 1, 30) });
      safe(function () { CORB.set('settings.board', { org: txt(org.value).trim(), cls: cls.value, target: util.clamp(num(target.value, 8), 1, 30) }); });
      persistLive();
      build(R.root);
      ui.toast('Board session started · clock running', 'ok');
    }

    var card = h('div.card.bd-setup', {},
      h('div.bd-setup-head', {},
        h('span.eyebrow', {}, 'Set up the session'),
        h('h2', {}, 'Who is in the chair today?'),
        h('p.lede.small', {}, 'The console keeps the clock, the question set, your notes and your scores for one candidate. Nothing here leaves this device unless you export it.')),
      h('div.bd-setup-grid', {},
        h('div.field', {}, h('label', {}, 'Candidate alias'), alias, h('div.hint', {}, 'An alias only — "Candidate A", "Chair 2". Never a real name.')),
        h('div.field', {}, h('label', {}, 'Warrant class requested'), cls, h('div.hint', {}, 'Drives what the board is checking for.')),
        h('div.field', {}, h('label', {}, 'Organization'), org, h('div.hint', {}, 'The office the candidate will sign for.')),
        h('div.field', {}, h('label', {}, 'Board date'), date, h('div.hint', {}, 'Defaults to today.')),
        h('div.field', {}, h('label', {}, 'Target question count'), target, h('div.hint', {}, 'Used by the balanced-set builder. You can go over or under.'))),
      focusBox,
      h('div.bd-setup-actions', {},
        h('button.btn.lg.primary', { type: 'button', onclick: start }, icon('play'), 'Start the session'),
        h('button.btn.lg', { type: 'button', onclick: function () { S.tab = 'history'; build(R.root); } }, icon('clock'), 'Open history')));
    return card;
  }

  function resumeCard(saved) {
    var when = util.fmtDateTime(saved.startedAt) || '';
    return h('div.callout.info.bd-resume', {}, icon('refresh'),
      h('div.grow', {},
        h('b', {}, 'A session for ' + saved.alias + ' is still open'),
        h('div.small', {}, [util.plural(arr(saved.items).length, 'question'), clock(saved.elapsedMs) + ' on the clock', when ? 'started ' + when : ''].filter(Boolean).join(' · '))),
      h('div.bd-resume-actions', {},
        h('button.btn.sm.primary', { type: 'button', onclick: function () { S.sess = saved; S.sess.running = false; commitClocks(); persistLive(); build(R.root); } }, icon('play'), 'Resume'),
        h('button.btn.sm.ghost.danger', { type: 'button', onclick: function () {
          ui.confirm('Discard the open session for ' + saved.alias + '? Its questions, notes and scores are deleted.', { ok: 'Discard', danger: true }).then(function (ok) { if (ok) { clearLive(); build(R.root); ui.toast('Session discarded'); } });
        } }, icon('trash'), 'Discard')));
  }

  // ------------------------------------------------------------------ shell
  function paintTabs() {
    if (!R || !R.tabs) return;
    var n = historyRecords().length;
    ui.mount(R.tabs, [
      h('button' + (S.tab === 'live' ? '.on' : ''), { type: 'button', 'aria-pressed': S.tab === 'live' ? 'true' : 'false', onclick: function () { if (S.tab !== 'live') { S.tab = 'live'; build(R.root); } } }, 'Live session'),
      h('button' + (S.tab === 'history' ? '.on' : ''), { type: 'button', 'aria-pressed': S.tab === 'history' ? 'true' : 'false', onclick: function () { if (S.tab !== 'history') { S.tab = 'history'; build(R.root); } } }, 'History', n ? h('span.badge.neutral', {}, String(n)) : null)
    ]);
  }

  function build(root) {
    stopTick();
    R = R || {};
    R.root = root;
    R.itemClocks = [];
    R.header = null; R.list = null; R.bank = null; R.history = null;
    R.elapsed = null; R.qclock = null; R.qclockLbl = null;
    root.innerHTML = '';

    root.appendChild(h('div.bd-pii', {}, icon('shield'),
      h('div', {},
        h('b', {}, 'Alias only — no candidate identity in this app.'),
        h('span', {}, ' Use "Candidate A" or a seat number. No names, emails, DoDIDs, contract numbers or unit rosters in any field, including notes. Everything you type stays in this browser on this device until you export it, and an export is a working file, not a board record.'))));

    root.appendChild(h('div.page-head.bd-head', {},
      h('span.eyebrow', {}, 'Board room'),
      h('h1', {}, 'Board console'),
      h('p.lede', {}, 'Build the question set, keep the clock, take notes and score against the rubric while the candidate is in the room. ' + PASS_NOTE)));

    R.tabs = h('div.tabs.bd-tabs', { role: 'group', 'aria-label': 'Board console sections' });
    root.appendChild(R.tabs);
    paintTabs();

    R.print = h('div.bd-print', { 'aria-hidden': 'true' });
    root.appendChild(R.print);

    if (S.tab === 'history') {
      R.history = h('div.bd-hist-wrap');
      root.appendChild(R.history);
      paintHistory();
      return;
    }

    if (!S.sess) {
      var saved = loadLive();
      if (saved) root.appendChild(resumeCard(saved));
      root.appendChild(setupPanel());
      return;
    }

    R.header = h('header.bd-hd', {});
    root.appendChild(R.header);
    paintHeader();

    R.list = h('div.bd-list');
    R.bank = h('aside.bd-bank', { 'aria-label': 'Question bank' });
    root.appendChild(h('div.bd-grid', {},
      h('div.bd-main', {}, sessionNotes(), R.list),
      R.bank));
    paintList();
    paintBank();

    if (!printFn) { printFn = function () { safe(function () { if (S && S.sess && R && R.print && !R.printPinned) ui.mount(R.print, printSheet(buildRecord())); }); }; window.addEventListener('beforeprint', printFn); }
    startTick();
  }

  function sessionNotes() {
    var s = S.sess;
    var ta = h('textarea.textarea.bd-board-notes', {
      value: s.boardNotes, placeholder: 'Deliberation notes for the whole board: themes across answers, what you would tell the candidate, conditions you would put on a recommendation.',
      'aria-label': 'Session notes', oninput: function (e) { s.boardNotes = e.target.value; queueSave(); }
    });
    return h('details.acc.bd-session-notes', {},
      h('summary', {}, icon('note'), 'Session notes', icon('chevron', 'chev')),
      h('div.acc-body', {}, ta, rubricGuide()));
  }
  function rubricGuide() {
    var rb = rubric();
    var g = rb.numeric_guide || rb.pass_rule_text;
    if (!g) return null;
    return h('div.panel-soft.mt-3.bd-guide', {}, h('div.eyebrow', {}, 'How the numbers read'), h('p.small.mt-2', {}, g.slice(0, 700)));
  }

  // ------------------------------------------------------------------ registration
  function leave() {
    clearTimeout(saveTimer); saveTimer = null;
    if (R && R.searchTimer) { clearTimeout(R.searchTimer); R.searchTimer = null; }
    stopTick();
    if (S && S.sess) persistLive();
    if (printFn) { safe(function () { window.removeEventListener('beforeprint', printFn); }); printFn = null; }
    R = null;
  }

  CORB.registerView({
    id: 'board', title: 'Board console', icon: 'users', section: 'Board room', order: 210,
    nav: true, mobile: true, short: 'Console', roles: ['board', 'facilitator'], wide: true,
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || {};
      if (!S) S = { tab: 'live', sess: null, f: freshFilters(), open: {}, reveal: {}, shown: BANK_PAGE, historyOpen: '', pre: {} };
      if (p.tab === 'history' || p.tab === 'live') S.tab = p.tab;
      S.pre = { alias: txt(p.alias).slice(0, 60), cls: txt(p.cls), n: p.n };
      S.shown = BANK_PAGE;
      R = {};
      build(root);
    },
    onLeave: leave
  });
})();
