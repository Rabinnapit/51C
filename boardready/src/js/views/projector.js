/* VIEW: projector — presenter view for the weekly 411th CSB warrant study group.
   Two phases in one view: a setup screen (source, count, agenda mode, answer handling, timer preset)
   and a full-width stage (very large type, one slide at a time, reveal-on-demand answers).
   Sources: a domain, bookmarked questions, a random mix, Korea items, or a pasted list of question ids.
   Agenda mode mirrors the real study-group deck: an opening "Board experience" slide, one scenario
   slide, then the Q&A slides generated from the bank.
   Data: CORB.data.questions / byId over CORB.DATA.questions; discussion prompts from
   CORB.DATA.rubric_board.board_guide.probes; the opening slide reads board_guide and CORB.DATA.meta;
   the scenario slide prefers CORB.DATA.korea_scenarios.cases and falls back to a scenario question.
   Every one of those is optional — each has an empty state or a fallback and none of them throw.
   Keyboard: arrows move, space reveals, r reads aloud, t runs the timer, f fullscreen, Esc leaves.
   Persists: progress.projector (source, ids, position, revealed slides, timer preset).
   Deviation from the usual view pattern: the stage does NOT use CORB.ui.questionCard. A card sized for
   reading at a desk is unreadable from the back of a conference room, so the slide renders the question
   at display scale and rebuilds the answer block (rich text, key points, cite line) from the same fields
   the card uses. Badges still come from CORB.ui.flagsFor / badge / classBadge so status never drifts. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, util = CORB.util;

  var KOREA_FLAG = 'korea-verify-cp';
  var KOREA_DOMAIN = 'Korea, LCS & SOFA';
  var COUNTS = [5, 8, 10, 12, 15, 20];
  var TIMERS = [1, 2, 3];
  var MAX_SLIDES = 40;
  var SOURCES = [
    ['domain', 'One domain', 'compass', 'Work a single area of the taxonomy end to end.'],
    ['mix', 'Random mix', 'shuffle', 'A spread across every domain in the active organization.'],
    ['bookmarked', 'Bookmarked', 'bookmark', 'The questions someone starred while studying.'],
    ['korea', 'Korea items', 'globe', 'LCS, SOFA and anything flagged for the 411th to confirm with C&P.'],
    ['ids', 'Pasted ids', 'note', 'Paste the ids C&P sent for this week, in order.']
  ];
  // Used only when the board guide carries no probes for a domain. Grounded in the board guide's
  // own advice: a good probe changes one fact and asks for the route, not the recital.
  var GENERIC_PROBES = [
    'Same scenario, but the value is ten times larger. What changes in your approach, your approvals and your file?',
    'Same scenario, but the money is LCS rather than O&M. Who awards, who manages, and what is your role?',
    'What is the first thing you would do, and who has to agree with you before the Government is bound?',
    'What would make this answer wrong? Name the fact you would have to learn to change your recommendation.'
  ];

  var S = null;          // live session: config + slides + position
  var R = null;          // DOM references for the current render
  var T = null;          // countdown timer state
  var keyHandler = null, fsHandler = null, unsub = [];

  // ------------------------------------------------------------------ helpers
  function safe(fn, fallback) { try { var v = fn(); return v == null ? fallback : v; } catch (e) { return fallback; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return v == null ? '' : String(v); }
  function lowerFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function bank() { return arr(safe(function () { return CORB.data.all(); }, [])); }
  function pool() { return arr(safe(function () { return CORB.data.questions({ anyClass: true }); }, [])); }   // a study group covers every class
  function domainsOf() { return arr(safe(function () { return CORB.data.DOMAINS; }, [])); }
  function meta() { return safe(function () { return CORB.DATA.meta; }, {}) || {}; }
  function guide() { return safe(function () { return CORB.DATA.rubric_board.board_guide; }, null); }
  function unitLabel() {
    var id = safe(function () { return CORB.unit(); }, 'all') || 'all';
    if (id === 'all') return 'All organizations';
    var name = safe(function () { return CORB.unitName(id); }, '');
    return name && name !== id ? name : str(id);
  }
  function speechOn() { return !!safe(function () { return CORB.speech && CORB.speech.available; }, false); }
  function isKorea(q) { return q && (q.domain === KOREA_DOMAIN || arr(q.flags).indexOf(KOREA_FLAG) >= 0); }

  function probesFor(domain) {
    var g = guide();
    var list = g && g.probes && Object.prototype.hasOwnProperty.call(g.probes, domain) ? arr(g.probes[domain]) : [];
    list = list.filter(function (p) { return str(p).trim(); });
    return list.length ? list : GENERIC_PROBES;
  }

  // ------------------------------------------------------------------- config
  function freshCfg() {
    return {
      source: 'mix', domain: '', ids: '', count: 10, agenda: true,
      hideAnswers: true, timerMin: 2, probes: true
    };
  }
  function loadCfg() {
    var saved = safe(function () { return CORB.get('progress.projector'); }, null);
    var c = freshCfg();
    if (!saved || typeof saved !== 'object') return c;
    if (typeof saved.source === 'string') c.source = saved.source;
    if (typeof saved.domain === 'string') c.domain = saved.domain;
    if (typeof saved.ids === 'string') c.ids = saved.ids;
    if (typeof saved.count === 'number' && saved.count > 0) c.count = util.clamp(Math.round(saved.count), 1, MAX_SLIDES);
    if (typeof saved.agenda === 'boolean') c.agenda = saved.agenda;
    if (typeof saved.hideAnswers === 'boolean') c.hideAnswers = saved.hideAnswers;
    if (typeof saved.probes === 'boolean') c.probes = saved.probes;
    if (typeof saved.timerMin === 'number' && saved.timerMin > 0) c.timerMin = util.clamp(Math.round(saved.timerMin), 1, 30);
    return c;
  }
  function savedSession() {
    var saved = safe(function () { return CORB.get('progress.projector'); }, null);
    if (!saved || typeof saved !== 'object') return null;
    var ids = arr(saved.qids).filter(function (id) { return typeof id === 'string' && id; });
    if (!ids.length) return null;
    var live = ids.filter(function (id) { return safe(function () { return CORB.data.byId(id); }, null); });
    if (!live.length) return null;
    return { qids: live, idx: typeof saved.idx === 'number' ? saved.idx : 0, revealed: saved.revealed && typeof saved.revealed === 'object' ? saved.revealed : {}, startedAt: str(saved.startedAt), scenarioId: str(saved.scenarioId) };
  }
  function saveSession() {
    if (!S) return;
    var rec = {
      v: 1, source: S.cfg.source, domain: S.cfg.domain, ids: S.cfg.ids, count: S.cfg.count,
      agenda: S.cfg.agenda, hideAnswers: S.cfg.hideAnswers, probes: S.cfg.probes, timerMin: S.cfg.timerMin,
      qids: S.qids.slice(), idx: S.idx, revealed: S.revealed, startedAt: S.startedAt, scenarioId: S.scenarioId
    };
    safe(function () { return CORB.set('progress.projector', rec); }, null);
  }
  function saveCfgOnly() {
    if (!S) return;
    if (S.phase === 'stage' && S.qids.length) { saveSession(); return; }
    var prev = safe(function () { return CORB.get('progress.projector'); }, null) || {};
    var rec = {
      v: 1, source: S.cfg.source, domain: S.cfg.domain, ids: S.cfg.ids, count: S.cfg.count,
      agenda: S.cfg.agenda, hideAnswers: S.cfg.hideAnswers, probes: S.cfg.probes, timerMin: S.cfg.timerMin,
      qids: arr(prev.qids), idx: typeof prev.idx === 'number' ? prev.idx : 0,
      revealed: prev.revealed && typeof prev.revealed === 'object' ? prev.revealed : {},
      startedAt: str(prev.startedAt), scenarioId: str(prev.scenarioId)
    };
    safe(function () { return CORB.set('progress.projector', rec); }, null);
  }

  // ------------------------------------------------------------ question pick
  function parseIds(text) {
    var seen = {}, out = [];
    str(text).toUpperCase().split(/[^A-Z0-9]+/).forEach(function (tok) {
      if (!tok || seen[tok]) return;
      seen[tok] = 1;
      var q = safe(function () { return CORB.data.byId(tok); }, null);
      if (q) out.push(q);
    });
    return out;
  }
  function candidates(cfg) {
    if (cfg.source === 'ids') return parseIds(cfg.ids);
    if (cfg.source === 'bookmarked') return arr(safe(function () { return CORB.data.questions({ bookmarked: true, anyClass: true }); }, []));
    if (cfg.source === 'korea') return pool().filter(isKorea);
    if (cfg.source === 'domain' && cfg.domain) return arr(safe(function () { return CORB.data.questions({ domain: cfg.domain, anyClass: true }); }, []));
    return pool();
  }
  function pickQuestions(cfg) {
    var list = candidates(cfg);
    if (cfg.source === 'ids') return list.slice(0, MAX_SLIDES);
    return util.shuffle(list).slice(0, util.clamp(cfg.count, 1, MAX_SLIDES));
  }
  function pickScenario(usedIds) {
    var cases = arr(safe(function () { return CORB.DATA.korea_scenarios.cases; }, []));
    var live = cases.filter(function (c) { return c && str(c.setup).trim(); });
    if (live.length) {
      var pick = util.shuffle(live)[0];
      return {
        kind: 'case', id: str(pick.id), title: str(pick.title) || 'Scenario',
        text: str(pick.setup), points: arr(pick.learning_points).map(str).filter(Boolean),
        citations: arr(pick.citations).map(str).filter(Boolean), classes: arr(pick.classes), korea: true
      };
    }
    var used = {}; arr(usedIds).forEach(function (id) { used[id] = 1; });
    var scen = pool().filter(function (q) { return q && q.kind === 'scenario' && !used[q.id] && str(q.question).trim(); });
    if (!scen.length) return null;
    var q = util.shuffle(scen)[0];
    return {
      kind: 'question', id: str(q.id), title: str(q.topic) || str(q.domain) || 'Scenario',
      text: str(q.question), answer: str(q.answer), status: str(q.answer_status),
      points: arr(q.key_points).map(str).filter(Boolean),
      citations: arr(q.citations_rfo).length ? arr(q.citations_rfo).map(str) : arr(q.citations).map(str),
      classes: arr(q.classes), domain: str(q.domain), korea: isKorea(q), ref: q
    };
  }

  // ------------------------------------------------------------------- slides
  function buildSlides() {
    var qs = S.qids.map(function (id) { return safe(function () { return CORB.data.byId(id); }, null); }).filter(Boolean);
    var slides = [];
    if (S.cfg.agenda) {
      slides.push({ type: 'opening', key: 'opening' });
      if (S.scenario) slides.push({ type: 'scenario', key: 'scenario:' + S.scenario.id });
    }
    qs.forEach(function (q, i) { slides.push({ type: 'qa', key: 'q:' + q.id, q: q, num: i + 1, of: qs.length }); });
    S.slides = slides;
    S.qaCount = qs.length;
    if (S.idx >= slides.length) S.idx = Math.max(0, slides.length - 1);
    if (S.idx < 0) S.idx = 0;
  }
  function slide() { return S && S.slides ? S.slides[S.idx] : null; }
  function needsReveal() {
    var s = slide();
    if (!s) return false;
    if (s.type === 'qa') return true;
    return !!(s.type === 'scenario' && S.scenario && (S.scenario.points.length || S.scenario.answer));
  }

  function startSession(cfg, resume) {
    var qs = resume ? resume.qids.map(function (id) { return safe(function () { return CORB.data.byId(id); }, null); }).filter(Boolean) : pickQuestions(cfg);
    if (!qs.length) return false;
    S.cfg = cfg;
    S.qids = qs.map(function (q) { return q.id; });
    S.revealed = resume ? (resume.revealed || {}) : {};
    S.idx = resume ? util.clamp(resume.idx || 0, 0, 999) : 0;
    S.startedAt = resume && resume.startedAt ? resume.startedAt : new Date().toISOString();
    S.scenario = cfg.agenda ? pickScenario(S.qids) : null;
    if (S.scenario && resume && resume.scenarioId && S.scenario.id !== resume.scenarioId) {
      var fixed = null;
      var cases = arr(safe(function () { return CORB.DATA.korea_scenarios.cases; }, []));
      cases.forEach(function (c) { if (c && str(c.id) === resume.scenarioId) fixed = c; });
      if (fixed) S.scenario = { kind: 'case', id: str(fixed.id), title: str(fixed.title) || 'Scenario', text: str(fixed.setup), points: arr(fixed.learning_points).map(str).filter(Boolean), citations: arr(fixed.citations).map(str).filter(Boolean), classes: arr(fixed.classes), korea: true };
    }
    S.scenarioId = S.scenario ? S.scenario.id : '';
    S.phase = 'stage';
    buildSlides();
    saveSession();
    return true;
  }

  // -------------------------------------------------------------------- timer
  function newTimer(min) { return { total: Math.max(1, Math.round(min * 60)), left: Math.max(1, Math.round(min * 60)), running: false, id: null, done: false }; }
  function timerStop() { if (T && T.id) { clearInterval(T.id); T.id = null; } if (T) T.running = false; }
  function timerReset(min) {
    timerStop();
    T = newTimer(min != null ? min : (S && S.cfg ? S.cfg.timerMin : 2));
    paintTimer();
  }
  function timerToggle() {
    if (!T) timerReset();
    if (T.running) { timerStop(); paintTimer(); return; }
    if (T.left <= 0) T = newTimer(S.cfg.timerMin);
    T.running = true; T.done = false;
    var end = Date.now() + T.left * 1000;
    T.id = setInterval(function () {
      T.left = Math.max(0, Math.round((end - Date.now()) / 1000));
      if (T.left <= 0) { timerStop(); T.done = true; ui.toast('Time is up — hand it back to the board', 'warn', 4000); }
      paintTimer();
    }, 250);
    paintTimer();
  }
  function timerPreset(min) {
    if (!S) return;
    S.cfg.timerMin = min;
    saveCfgOnly();
    timerReset(min);
    timerToggle();
  }
  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function paintTimer() {
    if (!R || !R.clock) return;
    var left = T ? T.left : (S && S.cfg ? S.cfg.timerMin * 60 : 120);
    R.clock.textContent = fmtClock(left);
    R.clock.classList.toggle('warn', !!T && T.left <= 30 && T.left > 10);
    R.clock.classList.toggle('danger', !!T && T.left <= 10);
    R.clock.classList.toggle('done', !!T && T.done);
    if (R.timerBtn) {
      R.timerBtn.innerHTML = '';
      R.timerBtn.appendChild(icon(T && T.running ? 'pause' : 'play'));
      R.timerBtn.setAttribute('aria-label', T && T.running ? 'Pause the countdown' : 'Start the countdown');
      R.timerBtn.setAttribute('data-tip', T && T.running ? 'Pause (t)' : 'Start (t)');
    }
    if (R.presetBtns) R.presetBtns.forEach(function (b) { b.classList.toggle('on', S && Number(b.getAttribute('data-min')) === S.cfg.timerMin); });
  }

  // --------------------------------------------------------------- fullscreen
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function fauxOn() { return !!(R && R.stage && R.stage.classList.contains('pj-faux')); }
  function enterFullscreen() {
    if (!R || !R.stage) return;
    var el = R.stage;
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      try {
        var p = req.call(el);
        if (p && p.catch) p.catch(function () { fauxToggle(true); });
        return;
      } catch (e) { /* falls through to the CSS fallback */ }
    }
    fauxToggle(true);
  }
  function exitFullscreen() {
    if (fsElement()) {
      var ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (ex) { try { var p = ex.call(document); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
      return;
    }
    if (fauxOn()) fauxToggle(false);
  }
  function fauxToggle(on) {
    if (!R || !R.stage) return;
    R.stage.classList.toggle('pj-faux', !!on);
    if (on) ui.toast('Full screen is not available here — the stage now fills the window. Press Esc or f to leave.', 'info', 4200);
    paintFsBtn();
  }
  function fullscreenToggle() { if (fsElement() || fauxOn()) exitFullscreen(); else enterFullscreen(); }
  function paintFsBtn() {
    if (!R || !R.fsBtn) return;
    var on = !!fsElement() || fauxOn();
    R.fsBtn.innerHTML = '';
    R.fsBtn.appendChild(icon(on ? 'x' : 'monitor'));
    R.fsBtn.appendChild(document.createTextNode(on ? ' Leave full screen' : ' Full screen'));
    R.fsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // ------------------------------------------------------------------ setup UI
  function emptyBank() {
    return h('div.empty.pj-empty', {},
      icon('book'),
      h('h3', {}, 'The question bank is not loaded'),
      h('p', {}, 'This copy of the app carries no questions, so there is nothing to put on the screen. Rebuild it with the question data, or open the original file the facilitator sent.'),
      h('button.btn.mt-4', { onclick: function () { CORB.go('dashboard'); } }, icon('arrow-left'), 'Back to the dashboard'));
  }
  function emptyPool() {
    return h('div.empty.pj-empty', {},
      icon('users'),
      h('h3', {}, 'No questions are tagged for ' + unitLabel()),
      h('p', {}, 'The repository holds questions from other organizations. Switch to all organizations in the top bar to build a session from the whole bank.'),
      h('button.btn.primary.mt-4', {
        onclick: function () {
          safe(function () { return CORB.set('profile.unit', 'all'); }, null);
          ui.toast('Showing all organizations', 'ok');
          safe(function () { return CORB.refresh(); }, null);
        }
      }, 'Show all organizations', icon('arrow-right')));
  }

  function setupHead() {
    var m = meta();
    var next = str(m.next_board);
    var days = next ? safe(function () { return util.daysUntil(next); }, null) : null;
    return h('div.page-head.pj-head', {},
      h('div.pj-head-copy', {},
        h('div.eyebrow', {}, 'Board room · presenter'),
        h('h1', {}, 'Study group projector'),
        h('p.lede', {}, 'Build this week’s deck from the bank, put it on the screen at the front of the room, and run it with the arrow keys. Answers stay hidden until you reveal them, so the room works the question first.')),
      h('div.pj-head-meta', {},
        h('div.pj-meta-item', {}, h('span.pj-meta-k', {}, 'Organization'), h('span.pj-meta-v', {}, unitLabel())),
        m.board_cadence ? h('div.pj-meta-item', {}, h('span.pj-meta-k', {}, 'Board cadence'), h('span.pj-meta-v', {}, str(m.board_cadence))) : null,
        next ? h('div.pj-meta-item', {}, h('span.pj-meta-k', {}, 'Next board'), h('span.pj-meta-v.num', {}, util.fmtDate(next) + (days != null && days >= 0 ? ' · in ' + util.plural(days, 'day') : ''))) : null));
  }

  function resumeCard(sess) {
    var n = sess.qids.length;
    var when = sess.startedAt ? util.fmtDateTime(sess.startedAt) : '';
    return h('div.pj-resume', {},
      h('div.pj-resume-icon', {}, icon('play')),
      h('div.pj-resume-copy', {},
        h('b', {}, 'A session is still open'),
        h('span', {}, util.plural(n, 'question') + ' · you stopped on slide ' + (Math.min(sess.idx, n) + 1) + (when ? ' · started ' + when : ''))),
      h('div.pj-resume-actions', {},
        h('button.btn.primary', { onclick: function () { if (startSession(loadCfg(), sess)) draw(); } }, icon('play'), 'Resume'),
        h('button.btn.ghost', {
          onclick: function () {
            ui.confirm('Discard the open session? The questions and reveal marks are cleared; your settings stay.').then(function (ok) {
              if (!ok) return;
              S.cfg = loadCfg();
              safe(function () { return CORB.set('progress.projector', { v: 1, source: S.cfg.source, domain: S.cfg.domain, ids: S.cfg.ids, count: S.cfg.count, agenda: S.cfg.agenda, hideAnswers: S.cfg.hideAnswers, probes: S.cfg.probes, timerMin: S.cfg.timerMin, qids: [], idx: 0, revealed: {}, startedAt: '', scenarioId: '' }); }, null);
              ui.toast('Session cleared');
              draw();
            });
          }
        }, 'Discard')));
  }

  function sourceCards() {
    var wrap = h('div.pj-sources', { role: 'radiogroup', 'aria-label': 'Where the questions come from' });
    SOURCES.forEach(function (sdef) {
      var on = S.cfg.source === sdef[0];
      var btn = h('button.pj-source' + (on ? '.on' : ''), {
        type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false',
        onclick: function () { S.cfg.source = sdef[0]; saveCfgOnly(); draw(); }
      }, h('span.pj-source-icon', {}, icon(sdef[2])),
        h('span.pj-source-name', {}, sdef[1]),
        h('span.pj-source-note', {}, sdef[3]));
      wrap.appendChild(btn);
    });
    return wrap;
  }

  function sourceDetail() {
    if (S.cfg.source === 'domain') {
      var doms = domainsOf();
      var counts = {};
      pool().forEach(function (q) { counts[q.domain] = (counts[q.domain] || 0) + 1; });
      var opts = doms.filter(function (d) { return counts[d]; });
      if (!opts.length) opts = Object.keys(counts);
      if (!S.cfg.domain || opts.indexOf(S.cfg.domain) < 0) S.cfg.domain = opts[0] || '';
      if (!opts.length) return h('p.pj-detail-note', {}, 'No domains are available in the active organization.');
      return h('div.field.pj-detail', {},
        h('label', { for: 'pj-domain' }, 'Domain'),
        h('select.select#pj-domain', {
          onchange: function (e) { S.cfg.domain = e.target.value; saveCfgOnly(); draw(); }
        }, opts.map(function (d) { return h('option', { value: d, selected: d === S.cfg.domain }, d + ' (' + counts[d] + ')'); })),
        h('div.hint', {}, 'One domain per week is how the study group covers the taxonomy without repeating itself.'));
    }
    if (S.cfg.source === 'ids') {
      var found = parseIds(S.cfg.ids);
      return h('div.field.pj-detail', {},
        h('label', { for: 'pj-ids' }, 'Question ids'),
        h('textarea.textarea#pj-ids', {
          rows: '3', placeholder: 'Q0007, Q0042, Q0113 — separated by commas, spaces or new lines',
          value: S.cfg.ids,
          oninput: function (e) { S.cfg.ids = e.target.value; saveCfgOnly(); paintPreview(); }
        }),
        h('div.hint', {}, 'Ids run in the order you paste them, so the deck matches the agenda C&P sent out. ' + (str(S.cfg.ids).trim() ? util.plural(found.length, 'id') + ' matched the bank.' : 'Ids that are not in this copy of the bank are skipped.')));
    }
    if (S.cfg.source === 'bookmarked') {
      var n = candidates(S.cfg).length;
      return h('p.pj-detail-note', {}, n ? util.plural(n, 'question') + ' bookmarked in this copy of the app.' : 'Nothing is bookmarked yet. Star questions in the library, or pick another source.');
    }
    if (S.cfg.source === 'korea') {
      return h('p.pj-detail-note', {}, 'Korea items carry the C&P verification flag. Say out loud that local procedure is confirmed with the Chief, C&P before anyone writes it down.');
    }
    return h('p.pj-detail-note', {}, 'A random mix pulls across every domain available to ' + unitLabel() + '.');
  }

  function countRow() {
    if (S.cfg.source === 'ids') return null;
    var row = h('div.pj-counts', { role: 'group', 'aria-label': 'How many questions' });
    COUNTS.forEach(function (n) {
      row.appendChild(h('button.chip' + (S.cfg.count === n ? '.on' : ''), {
        type: 'button', 'aria-pressed': S.cfg.count === n ? 'true' : 'false',
        onclick: function () { S.cfg.count = n; saveCfgOnly(); draw(); }
      }, String(n)));
    });
    return h('div.field.pj-field', {}, h('label', {}, 'Questions in the deck'), row,
      h('div.hint', {}, 'Ten questions with real discussion fills a sixty-minute study group. Twenty is a fast-fire review.'));
  }

  function toggleRow() {
    function sw(label, note, get, set) {
      var input = h('input', { type: 'checkbox', checked: get(), onchange: function (e) { set(!!e.target.checked); saveCfgOnly(); draw(); } });
      return h('label.pj-toggle', {}, h('span.switch', {}, input), h('span.pj-toggle-copy', {}, h('b', {}, label), h('span', {}, note)));
    }
    return h('div.pj-toggles', {},
      sw('Session agenda', 'Open with a Board experience slide and one scenario before the Q&A slides.', function () { return S.cfg.agenda; }, function (v) { S.cfg.agenda = v; }),
      sw('Hold answers back', 'Answers stay hidden on each slide until you press Reveal or the space bar.', function () { return S.cfg.hideAnswers; }, function (v) { S.cfg.hideAnswers = v; }),
      sw('Discussion prompt', 'Show a follow-up probe from the board guide under each question.', function () { return S.cfg.probes; }, function (v) { S.cfg.probes = v; }));
  }

  function timerRow() {
    var row = h('div.pj-timer-presets', { role: 'group', 'aria-label': 'Countdown preset' });
    TIMERS.forEach(function (m) {
      row.appendChild(h('button.chip' + (S.cfg.timerMin === m ? '.on' : ''), {
        type: 'button', 'aria-pressed': S.cfg.timerMin === m ? 'true' : 'false',
        onclick: function () { S.cfg.timerMin = m; saveCfgOnly(); draw(); }
      }, icon('clock'), util.plural(m, 'minute')));
    });
    return h('div.field.pj-field', {}, h('label', {}, 'Answer clock'), row,
      h('div.hint', {}, 'A board answer runs forty-five to ninety seconds. Two minutes is the usual study-group allowance before the probe.'));
  }

  function paintPreview() {
    if (!R || !R.preview) return;
    var list = candidates(S.cfg);
    var n = S.cfg.source === 'ids' ? list.length : Math.min(list.length, S.cfg.count);
    var doms = {};
    (S.cfg.source === 'ids' ? list : list.slice(0, 200)).forEach(function (q) { if (q && q.domain) doms[q.domain] = 1; });
    var domCount = Object.keys(doms).length;
    var slidesN = n + (S.cfg.agenda ? (S.scenarioAvailable ? 2 : 1) : 0);
    R.preview.innerHTML = '';
    if (!n) {
      R.preview.appendChild(h('div.pj-preview-empty', {}, icon('info'),
        h('span', {}, S.cfg.source === 'bookmarked' ? 'No bookmarked questions yet — bookmark a few in the library, or choose another source.'
          : S.cfg.source === 'ids' ? 'No pasted id matches this copy of the bank. Check the ids, or choose another source.'
            : S.cfg.source === 'korea' ? 'No Korea items are available in the active organization. Switch the organization in the top bar, or choose another source.'
              : 'Nothing matches this source in the active organization. Choose another source, or switch the organization in the top bar.')));
    } else {
      R.preview.appendChild(h('div.pj-preview-line', {},
        h('b.num', {}, String(slidesN)), h('span', {}, slidesN === 1 ? 'slide' : 'slides'),
        h('span.pj-preview-sep', {}, '·'),
        h('span', {}, util.plural(n, 'question')),
        domCount > 1 ? h('span.pj-preview-sep', {}, '·') : null,
        domCount > 1 ? h('span', {}, 'across ' + util.plural(domCount, 'domain')) : null));
      if (S.cfg.agenda) R.preview.appendChild(h('div.pj-preview-note', {}, S.scenarioAvailable ? 'Opens with Board experience, then one scenario, then the questions.' : 'Opens with Board experience, then the questions. No scenario case is loaded in this copy.'));
    }
    if (R.startBtn) R.startBtn.disabled = !n;
  }

  function renderSetup(root) {
    var all = bank();
    if (!all.length) { root.appendChild(emptyBank()); return; }
    var p = pool();
    root.appendChild(setupHead());
    if (!p.length && S.cfg.source !== 'ids') { root.appendChild(emptyPool()); return; }

    var sess = savedSession();
    if (sess) root.appendChild(resumeCard(sess));

    S.scenarioAvailable = !!pickScenario([]);

    R.preview = h('div.pj-preview', { 'aria-live': 'polite' });
    R.startBtn = h('button.btn.primary.lg.pj-start', {
      onclick: function () {
        if (!startSession(S.cfg, null)) { ui.toast('Nothing to present from that source', 'danger'); return; }
        draw();
      }
    }, icon('play'), 'Start the session');

    var setup = h('div.pj-setup', {},
      h('section.pj-panel', {},
        h('div.pj-panel-head', {}, h('span.pj-step', {}, '1'), h('h2', {}, 'Where the questions come from')),
        sourceCards(),
        sourceDetail()),
      h('section.pj-panel', {},
        h('div.pj-panel-head', {}, h('span.pj-step', {}, '2'), h('h2', {}, 'How the session runs')),
        h('div.pj-grid-2', {}, countRow(), timerRow()),
        toggleRow()),
      h('section.pj-panel.pj-launch', {},
        h('div.pj-panel-head', {}, h('span.pj-step', {}, '3'), h('h2', {}, 'Put it on the screen')),
        R.preview,
        h('div.pj-launch-actions', {},
          R.startBtn,
          h('button.btn.pj-projector-btn', {
            onclick: function () {
              var on = document.body.hasAttribute('data-projector');
              safe(function () { return CORB.toggleProjector(); }, null);
              if (document.body.hasAttribute('data-projector') === on) ui.toast('Projector type scale is unavailable in this build');
            }
          }, icon('monitor'), document.body.hasAttribute('data-projector') ? 'Projector type scale is on' : 'Bigger type everywhere')),
        h('div.pj-keys', {},
          h('span.pj-keys-lbl', {}, 'On the stage'),
          keyHint('←', 'Previous'), keyHint('→', 'Next'), keyHint('Space', 'Reveal'),
          keyHint('R', 'Read aloud'), keyHint('T', 'Timer'), keyHint('F', 'Full screen'), keyHint('Esc', 'Leave'))));

    root.appendChild(setup);
    paintPreview();
  }
  function keyHint(k, label) { return h('span.pj-key', {}, h('kbd', {}, k), h('span', {}, label)); }

  // ------------------------------------------------------------------ stage UI
  function slideLabel(s) {
    if (!s) return '';
    if (s.type === 'opening') return 'Opening · Board experience';
    if (s.type === 'scenario') return 'Scenario · ' + (S.scenario ? S.scenario.title : '');
    return 'Question ' + s.num + ' of ' + s.of;
  }

  function openingSlide() {
    var g = guide();
    var m = meta();
    var body = h('div.pj-open');
    var fw = g && g.answer_framework ? g.answer_framework : null;
    body.appendChild(h('h2.pj-open-title', {}, 'Board experience'));
    body.appendChild(h('p.pj-open-lede', {},
      'A warrant board is a conversation with the officials who will be accountable for what you sign. ' +
      (m.board_cadence ? 'The ' + (str(m.org) || 'brigade') + ' board sits the ' + lowerFirst(str(m.board_cadence)) + '. ' : '') +
      'Tonight we rehearse the part you can control: how the answer is built.'));

    if (fw && arr(fw.steps).length) {
      body.appendChild(h('div.pj-open-framework', {},
        h('div.pj-open-fw-name', {}, str(fw.name) || 'Answer framework'),
        fw.tagline ? h('div.pj-open-fw-tag', {}, str(fw.tagline)) : null,
        h('ol.pj-open-steps', {}, arr(fw.steps).slice(0, 5).map(function (stp) {
          var t = str(stp).replace(/\s+/g, ' ').trim();
          var lead = /^([A-Z][A-Z]{2,})\b[:\s]*/.exec(t);
          var head = lead ? lead[1] : t.split(' ').slice(0, 2).join(' ');
          var rest = lead ? t.slice(lead[0].length) : t;
          rest = rest.split(/\s(?:Example|For example)[:.]/)[0].trim();
          return h('li', {}, h('b', {}, head), h('span', {}, rest));
        }))));
    } else {
      body.appendChild(h('div.pj-open-framework', {},
        h('div.pj-open-fw-name', {}, 'How tonight runs'),
        h('div.pj-open-fw-tag', {}, 'One question at a time, out loud, then the room probes.'),
        h('ol.pj-open-steps', {},
          h('li', {}, h('b', {}, 'Answer'), h('span', {}, 'One volunteer answers on the clock, bottom line first, without notes.')),
          h('li', {}, h('b', {}, 'Probe'), h('span', {}, 'The room changes one fact and asks again.')),
          h('li', {}, h('b', {}, 'Compare'), h('span', {}, 'We reveal the repository answer and argue with it where it is thin.')))));
    }

    var tips = g ? arr(g.candidate_tips).map(str).filter(Boolean).slice(0, 3) : [];
    if (tips.length) {
      body.appendChild(h('div.pj-open-tips', {}, h('div.pj-open-tips-lbl', {}, 'Three things the board rewards'),
        h('ul', {}, tips.map(function (t) { return h('li', {}, t); }))));
    }

    var plan = [];
    plan.push(util.plural(S.qaCount, 'question'));
    if (S.scenario) plan.push('one scenario');
    plan.push(util.plural(S.cfg.timerMin, 'minute') + ' on the clock each');
    body.appendChild(h('div.pj-open-plan', {}, icon('clock'), h('span', {}, 'Tonight: ' + plan.join(' · '))));
    return body;
  }

  function scenarioSlide() {
    var sc = S.scenario;
    if (!sc) return h('div.pj-empty-slide', {}, 'No scenario is loaded.');
    var body = h('div.pj-scenario');
    body.appendChild(h('h2.pj-scenario-title', {}, sc.title));
    body.appendChild(ui.rich(sc.text, { cls: 'pj-scenario-text' }));
    return body;
  }
  function scenarioReveal() {
    var sc = S.scenario;
    if (!sc) return null;
    var box = h('div.pj-reveal');
    if (sc.answer) box.appendChild(ui.rich(sc.answer));
    if (sc.points.length) {
      box.appendChild(h('div.pj-points', {}, h('div.pj-points-lbl', {}, sc.kind === 'case' ? 'Learning points' : 'Key points'),
        h('ul', {}, sc.points.map(function (p) { return h('li', {}, p); }))));
    }
    if (sc.citations.length) box.appendChild(citeLine(sc.citations));
    if (!sc.answer && !sc.points.length && !sc.citations.length) box.appendChild(h('p.pj-reveal-none', {}, 'This case has no written school solution. Capture the room’s answer in the mock board notes instead.'));
    return box;
  }

  function citeLine(cites) {
    return h('div.pj-cite', {}, h('span.pj-cite-lbl', {}, 'Cite'),
      h('span.pj-cite-list', {}, cites.map(function (c) {
        var url = safe(function () { return CORB.data.citeUrl(c); }, null);
        return url ? h('a.cite', { href: url, target: '_blank', rel: 'noopener' }, c) : h('span.cite', {}, c);
      })));
  }

  function qaSlide(q) {
    var body = h('div.pj-qa');
    body.appendChild(h('div.pj-question', {}, str(q.question)));
    return body;
  }
  function qaReveal(q) {
    var box = h('div.pj-reveal');
    var status = str(q.answer_status);
    var text = status === 'open' ? '' : str(q.answer);
    if (status === 'ai-draft' && !safe(function () { return CORB.get('settings.showDrafts', true); }, true)) {
      box.appendChild(h('p.pj-reveal-none', {}, 'The drafted answer for this question is hidden by the app settings. Work it from first principles and check it against the regulation afterwards.'));
      return box;
    }
    if (text) box.appendChild(ui.rich(text));
    else box.appendChild(h('p.pj-reveal-none', {}, 'This question has no formal answer in the repository. That is the point of the study group — build one tonight and have a mentor check it.'));
    var pts = arr(q.key_points).map(str).filter(Boolean);
    if (pts.length) box.appendChild(h('div.pj-points', {}, h('div.pj-points-lbl', {}, 'Key points'), h('ul', {}, pts.map(function (p) { return h('li', {}, p); }))));
    var cites = arr(q.citations_rfo).length ? arr(q.citations_rfo).map(str) : arr(q.citations).map(str);
    cites = cites.filter(Boolean);
    if (cites.length) box.appendChild(citeLine(cites));
    return box;
  }

  function badgesFor(s) {
    var out = [];
    if (s.type === 'qa' && s.q) {
      safe(function () { return ui.flagsFor(s.q); }, []).forEach(function (f) { var b = safe(function () { return ui.badge(f); }, null); if (b) out.push(b); });
      arr(s.q.classes).forEach(function (c) { var b = safe(function () { return ui.classBadge(c); }, null); if (b) out.push(b); });
      if (s.q.domain) out.push(h('span.badge.neutral', {}, str(s.q.domain)));
    } else if (s.type === 'scenario' && S.scenario) {
      if (S.scenario.korea) { var kb = safe(function () { return ui.badge(KOREA_FLAG); }, null); if (kb) out.push(kb); }
      arr(S.scenario.classes).forEach(function (c) { var cb = safe(function () { return ui.classBadge(c); }, null); if (cb) out.push(cb); });
      if (S.scenario.domain) out.push(h('span.badge.neutral', {}, str(S.scenario.domain)));
      out.push(h('span.badge.neutral', {}, 'Scenario'));
    } else if (s.type === 'opening') {
      out.push(h('span.badge.neutral', {}, 'Agenda'));
    }
    return out;
  }

  function probeFor(s) {
    if (!S.cfg.probes) return null;
    var domain = s.type === 'qa' && s.q ? str(s.q.domain) : (S.scenario ? str(S.scenario.domain) : '');
    if (s.type === 'opening') return null;
    var list = probesFor(domain);
    if (!list.length) return null;
    var seed = s.type === 'qa' ? (s.num || 1) : 1;
    return list[(seed - 1) % list.length];
  }

  function drawSlide() {
    if (!R || !R.body) return;
    var s = slide();
    R.body.innerHTML = '';
    R.badges.innerHTML = '';
    if (!s) {
      R.body.appendChild(h('div.pj-empty-slide', {}, 'This session has no slides left. Build a new one from the setup screen.'));
      return;
    }
    R.stage.setAttribute('data-slide', s.type);
    R.counter.textContent = slideLabel(s);
    badgesFor(s).forEach(function (b) { R.badges.appendChild(b); });

    var main = h('div.pj-slide', {});
    if (s.type === 'opening') main.appendChild(openingSlide());
    else if (s.type === 'scenario') main.appendChild(scenarioSlide());
    else main.appendChild(qaSlide(s.q));

    var show = !S.cfg.hideAnswers || S.revealed[s.key];
    if (needsReveal()) {
      if (show) {
        var rev = s.type === 'qa' ? qaReveal(s.q) : scenarioReveal();
        if (rev) { rev.classList.add('pj-reveal-in'); main.appendChild(rev); }
      } else {
        main.appendChild(h('div.pj-veil', {}, icon('eye-off'),
          h('span', {}, 'Answer held back'),
          h('span.pj-veil-hint', {}, 'Work it in the room first, then press the space bar.')));
      }
    }

    var probe = probeFor(s);
    if (probe) {
      main.appendChild(h('div.pj-probe', {},
        h('span.pj-probe-lbl', {}, icon('chat'), 'Discussion prompt'),
        h('p', {}, probe)));
    }
    R.body.appendChild(main);
    try { R.body.scrollTop = 0; } catch (e) {}

    paintControls();
    paintRail();
  }

  function paintControls() {
    if (!R || !R.prevBtn) return;
    var s = slide();
    R.prevBtn.disabled = S.idx <= 0;
    R.nextBtn.disabled = S.idx >= S.slides.length - 1;
    var can = needsReveal();
    R.revealBtn.hidden = !can || !S.cfg.hideAnswers;
    if (can && S.cfg.hideAnswers) {
      var on = !!S.revealed[s.key];
      R.revealBtn.innerHTML = '';
      R.revealBtn.appendChild(icon(on ? 'eye-off' : 'eye'));
      R.revealBtn.appendChild(document.createTextNode(on ? ' Hide answer' : ' Reveal answer'));
      R.revealBtn.classList.toggle('primary', !on);
    }
    if (R.readBtn) {
      var speaking = !!safe(function () { return CORB.speech.speaking; }, false);
      R.readBtn.innerHTML = '';
      R.readBtn.appendChild(icon(speaking ? 'stop' : 'volume'));
      R.readBtn.appendChild(document.createTextNode(speaking ? ' Stop' : ' Read aloud'));
    }
  }

  function paintRail() {
    if (!R || !R.rail) return;
    R.rail.innerHTML = '';
    var n = S.slides.length;
    if (!n) return;
    if (n <= 24) {
      S.slides.forEach(function (s, i) {
        R.rail.appendChild(h('button.pj-dot' + (i === S.idx ? '.on' : '') + (S.revealed[s.key] ? '.seen' : ''), {
          type: 'button', 'aria-label': slideLabel(s), 'aria-current': i === S.idx ? 'true' : 'false',
          onclick: function () { goTo(i); }
        }));
      });
    } else {
      var pctDone = util.pct(S.idx + 1, n);
      R.rail.appendChild(h('div.pj-bar', {}, h('span', { style: { width: pctDone + '%' } })));
      R.rail.appendChild(h('span.pj-bar-num.num', {}, (S.idx + 1) + ' / ' + n));
    }
  }

  // -------------------------------------------------------------- stage actions
  function goTo(i) {
    if (!S || !S.slides.length) return;
    var next = util.clamp(i, 0, S.slides.length - 1);
    if (next === S.idx) return;
    S.idx = next;
    stopSpeech();
    saveSession();
    drawSlide();
  }
  function step(d) { goTo(S.idx + d); }
  function toggleReveal() {
    var s = slide();
    if (!s || !needsReveal() || !S.cfg.hideAnswers) return;
    if (S.revealed[s.key]) delete S.revealed[s.key];
    else {
      S.revealed[s.key] = true;
      if (s.type === 'qa' && s.q) safe(function () { return CORB.set('progress.seen.' + s.q.id, util.today(), { silent: true }); }, null);
    }
    saveSession();
    drawSlide();
  }
  function stopSpeech() { safe(function () { return CORB.speech.stop(); }, null); }
  function readAloud() {
    if (!speechOn()) { ui.toast('Read aloud is not available in this browser', 'danger'); return; }
    if (safe(function () { return CORB.speech.speaking; }, false)) { stopSpeech(); paintControls(); return; }
    var s = slide();
    if (!s) return;
    var text = '';
    if (s.type === 'qa' && s.q) {
      text = str(s.q.question);
      if (S.revealed[s.key] || !S.cfg.hideAnswers) text += '. Answer. ' + str(s.q.answer);
    } else if (s.type === 'scenario' && S.scenario) {
      text = S.scenario.title + '. ' + S.scenario.text;
    } else {
      text = 'Board experience. ' + util.plural(S.qaCount, 'question') + ' tonight, ' + util.plural(S.cfg.timerMin, 'minute') + ' on the clock for each answer.';
    }
    safe(function () { return CORB.speech.speak(text, { onend: function () { paintControls(); } }); }, null);
    paintControls();
  }
  function endSession() {
    exitFullscreen();
    timerStop();
    stopSpeech();
    S.phase = 'setup';
    saveSession();
    draw();
  }

  function renderStage(root) {
    R.counter = h('div.pj-counter', { 'aria-live': 'polite' });
    R.badges = h('div.pj-badges');
    R.rail = h('div.pj-rail', { 'aria-label': 'Slides' });
    R.body = h('div.pj-body', { tabindex: '-1' });

    R.clock = h('div.timer.pj-clock', { 'aria-live': 'off' }, fmtClock(T ? T.left : S.cfg.timerMin * 60));
    R.timerBtn = h('button.btn.sm.ghost.pj-timer-btn', { type: 'button', onclick: timerToggle });
    R.presetBtns = TIMERS.map(function (m) {
      return h('button.pj-preset', { type: 'button', 'data-min': String(m), 'aria-label': util.plural(m, 'minute') + ' countdown', onclick: function () { timerPreset(m); } }, String(m) + 'm');
    });
    R.fsBtn = h('button.btn.sm.ghost.pj-fs', { type: 'button', onclick: fullscreenToggle });

    R.prevBtn = h('button.btn.pj-nav', { type: 'button', onclick: function () { step(-1); } }, icon('arrow-left'), 'Previous');
    R.revealBtn = h('button.btn.primary.pj-reveal-btn', { type: 'button', onclick: toggleReveal });
    R.nextBtn = h('button.btn.pj-nav', { type: 'button', onclick: function () { step(1); } }, 'Next', icon('arrow-right'));
    R.readBtn = speechOn() ? h('button.btn.sm.ghost.pj-read', { type: 'button', onclick: readAloud }) : null;

    var top = h('header.pj-top', {},
      h('div.pj-top-left', {}, R.counter, R.badges),
      h('div.pj-top-right', {},
        h('div.pj-timer', {},
          R.clock,
          h('div.pj-timer-ctrl', {}, R.timerBtn,
            h('button.btn.sm.ghost.pj-timer-btn', { type: 'button', 'aria-label': 'Reset the countdown', 'data-tip': 'Reset', onclick: function () { timerReset(); } }, icon('refresh')),
            h('div.pj-presets', {}, R.presetBtns))),
        R.readBtn,
        R.fsBtn,
        h('button.btn.sm.ghost.pj-exit', { type: 'button', onclick: endSession }, icon('x'), 'End session')));

    var controls = h('footer.pj-controls', {},
      R.prevBtn, R.revealBtn, R.nextBtn,
      h('div.pj-controls-keys.hide-sm', {}, keyHint('← →', 'Move'), keyHint('Space', 'Reveal'), keyHint('R', 'Read'), keyHint('T', 'Timer'), keyHint('F', 'Full screen')));

    R.stage = h('section.pj-stage', { 'aria-label': 'Study group stage' }, top, R.rail, R.body, controls);
    root.appendChild(R.stage);

    if (!T) T = newTimer(S.cfg.timerMin);
    paintTimer();
    paintFsBtn();
    drawSlide();
    try { R.body.focus({ preventScroll: true }); } catch (e) { try { R.body.focus(); } catch (e2) {} }
  }

  // ------------------------------------------------------------------ keyboard
  function installKeys() {
    if (keyHandler) return;
    keyHandler = function (e) {
      if (!S || S.phase !== 'stage' || !R || !R.stage) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target || {};
      var tag = str(t.tagName).toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
      if (document.querySelector('.modal-scrim')) return;
      var k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); step(1); return; }
      if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); step(-1); return; }
      if (k === 'Home') { e.preventDefault(); goTo(0); return; }
      if (k === 'End') { e.preventDefault(); goTo(S.slides.length - 1); return; }
      if (k === ' ' || k === 'Spacebar') {
        if (tag === 'button' || tag === 'a') return;   // let the focused control take the space bar
        e.preventDefault(); toggleReveal(); return;
      }
      if (k === 'r' || k === 'R') { if (tag === 'button') return; e.preventDefault(); readAloud(); return; }
      if (k === 't' || k === 'T') { if (tag === 'button') return; e.preventDefault(); timerToggle(); return; }
      if (k === 'f' || k === 'F') { if (tag === 'button') return; e.preventDefault(); fullscreenToggle(); return; }
      if (k === 'Escape') {
        if (fsElement() || fauxOn()) { exitFullscreen(); return; }
        endSession();
      }
    };
    document.addEventListener('keydown', keyHandler);
  }
  function removeKeys() { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } }

  function installFs() {
    if (fsHandler) return;
    fsHandler = function () { paintFsBtn(); };
    document.addEventListener('fullscreenchange', fsHandler);
    document.addEventListener('webkitfullscreenchange', fsHandler);
  }
  function removeFs() {
    if (!fsHandler) return;
    document.removeEventListener('fullscreenchange', fsHandler);
    document.removeEventListener('webkitfullscreenchange', fsHandler);
    fsHandler = null;
  }

  // -------------------------------------------------------------------- render
  function draw() {
    if (!R || !R.root) return;
    var root = R.root;
    var keep = root;
    R = { root: keep };
    keep.innerHTML = '';
    if (S.phase === 'stage') { installKeys(); installFs(); renderStage(keep); }
    else { removeKeys(); renderSetup(keep); }
  }

  function leave() {
    timerStop();
    stopSpeech();
    if (fauxOn()) fauxToggle(false);
    if (fsElement()) exitFullscreen();
    removeKeys();
    removeFs();
    unsub.forEach(function (u) { try { u(); } catch (e) {} });
    unsub = [];
    R = null;
  }

  CORB.registerView({
    id: 'projector', title: 'Study group projector', icon: 'monitor', section: 'Board room', order: 220,
    nav: true, wide: true, short: 'Projector', roles: ['board', 'facilitator'],
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || {};
      var cfg = loadCfg();
      if (p.domain && domainsOf().indexOf(str(p.domain)) >= 0) { cfg.source = 'domain'; cfg.domain = str(p.domain); }
      if (p.source && ['domain', 'mix', 'bookmarked', 'korea', 'ids'].indexOf(str(p.source)) >= 0) cfg.source = str(p.source);
      if (p.count && !isNaN(Number(p.count))) cfg.count = util.clamp(Math.round(Number(p.count)), 1, MAX_SLIDES);
      if (p.ids) { cfg.source = 'ids'; cfg.ids = str(p.ids); }

      S = { cfg: cfg, phase: 'setup', slides: [], qids: [], revealed: {}, idx: 0, qaCount: 0, scenario: null, scenarioId: '', startedAt: '', scenarioAvailable: false };
      T = newTimer(cfg.timerMin);
      R = { root: root };

      if (str(p.start) === '1' || str(p.start) === 'true') {
        if (!startSession(cfg, null)) ui.toast('Nothing to present from that source', 'danger');
      }
      draw();
    },
    onLeave: leave
  });
})();
