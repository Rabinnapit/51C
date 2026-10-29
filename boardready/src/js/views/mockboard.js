/* VIEW: mockboard — a timed oral-board simulator.
   Three phases in one view: setup (warrant class, domains, length, clock, options),
   session (one question at a time, countdown ring, optional read-aloud and dictation,
   model answer, rubric scoring, notes), and summary (dimension averages, per-question
   scores, weakest domain, pass indicator, export/print, mentor hand-off).

   Data: CORB.data.questions() for the draw, CORB.scoring.rubric() for the dimensions and
   pass rule, CORB.DATA.rubric_board.board_guide (optional) for the answer framework, class
   focus and follow-up probes. Every one of those may be missing or half-shaped; nothing here
   throws on absent data and each block renders an honest empty state instead.

   Warrant class: one setting everywhere, profile.targetClass (CORB.warrantClass()). The class chip
   defaults to it and choosing a chip saves it. The pool is cumulative: CORB.data.questions({})
   filtered by CORB.data.classEligible, so a Class III board draws on Class I to III questions, and
   CORB.data.byWarrant sets the mix so about 60% of the questions asked are tagged Class III.

   Why not CORB.ui.questionCard on the stage: the board screen needs the question alone in
   large type with a clock, and the model answer revealed later in its own panel. The shared
   card renders question + answer + actions together, which is the opposite of the exercise.
   The summary links back to the library, which does use the shared card.

   Persists: settings.mockboard (setup choices), progress.mockboard (the in-progress session,
   so a refresh or a detour to another view does not lose it), progress.boards via
   CORB.scoring.recordBoard, progress.seen for every question asked.
   Params: class|cls, domain, n, seconds, start=1. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, util = CORB.util;

  var COUNTS = [5, 8, 12];
  var TIMES = [60, 90, 120];
  var KOREA_DOMAIN = 'Korea, LCS & SOFA';
  var KOREA_FLAG = 'korea-verify-cp';
  var SAVE = 'progress.mockboard';
  var CFG = 'settings.mockboard';
  var RING_R = 52, RING_C = 2 * Math.PI * RING_R;
  var KINDS = { knowledge: 'Knowledge', scenario: 'Scenario', leadership: 'Leadership' };
  var FALLBACK_DIMS = [
    { id: 'knowledge', name: 'Regulatory knowledge', description: 'The right rule, the right citation, the right threshold.', anchors: { '1': 'Wrong rule, or no rule at all.', '3': 'Correct rule and a usable cite, with minor gaps.', '5': 'Correct, current and layered, with the exceptions named unprompted.' } },
    { id: 'judgment', name: 'Judgment and risk awareness', description: 'Applies the rule to the facts, names the risk and the approval path.', anchors: { '1': 'Recites without applying, or would act outside the warrant.', '3': 'Applies the rule, names the main risk and who must approve.', '5': 'Weighs alternatives, names second-order risk, knows when to stop and ask.' } },
    { id: 'communication', name: 'Communication', description: 'Structured, concise, bottom line first.', anchors: { '1': 'Rambling; the board cannot find the answer in it.', '3': 'Clear but unstructured.', '5': 'Rule, cite, application, risk, route — inside two minutes.' } },
    { id: 'composure', name: 'Composure and professionalism', description: 'Handles probes and gaps without bluffing.', anchors: { '1': 'Freezes, argues, or invents an answer.', '3': 'Recovers with a prompt.', '5': 'Calm, clarifies the question, owns the gap and says how it would be closed.' } }
  ];

  var cfg = null;            // setup configuration (mirrored into settings.mockboard)
  var sess = null;           // the live session object
  var phase = 'setup';       // 'setup' | 'run' | 'done'
  var R = {};                // live DOM references for the current paint
  var tickId = null;         // clock interval
  var unsub = [];            // CORB.on unsubscribers
  var recog = null;          // active SpeechRecognition instance
  var keyFn = null;          // document keydown handler
  var confirming = false;    // an end-early confirm is open

  // ------------------------------------------------------------------ helpers
  function safe(fn, fb) { try { return fn(); } catch (e) { return fb; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function txt(v) { return v == null ? '' : String(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v) && v > 0; }
  function classLabel(c) { return c ? 'Class ' + c : 'All classes'; }
  function kindLabel(k) { return KINDS[k] || (k ? txt(k) : ''); }
  function mmss(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function classesOf() { return (CORB.data && arr(CORB.data.CLASSES).length) ? CORB.data.CLASSES : ['I', 'II', 'III', 'IV']; }
  function ttsOn() { return !!safe(function () { return CORB.get('settings.tts', true); }, true); }
  function speechOk() { return !!(CORB.speech && CORB.speech.available); }
  function recogOk() { return !!(CORB.speech && CORB.speech.recognitionAvailable); }
  function modalOpen() { return !!document.querySelector('.modal-scrim'); }
  function unitLabel() {
    var id = safe(function () { return CORB.unit(); }, 'all') || 'all';
    var name = safe(function () { return CORB.unitName(id); }, '');
    if (!name || name === id) return id === 'all' ? 'All organizations' : txt(id);
    return name;
  }
  function meta() { return safe(function () { return CORB.DATA.meta || {}; }, {}) || {}; }
  function boardGuide() { return safe(function () { return (CORB.DATA.rubric_board || {}).board_guide || {}; }, {}) || {}; }

  function rubric() {
    var r = safe(function () { return CORB.scoring.rubric(); }, null) || {};
    var dims = arr(r.dimensions).filter(function (d) { return d && d.id && d.name; });
    if (!dims.length) dims = FALLBACK_DIMS;
    return {
      scale: txt(r.scale), dimensions: dims, pass_rule: txt(r.pass_rule),
      pass_rule_detail: txt(r.pass_rule_detail), numeric_guide: txt(r.numeric_guide),
      note: txt(r.note),
      weights: (r.weights && typeof r.weights === 'object' && !Array.isArray(r.weights)) ? r.weights : null
    };
  }
  function dimWeight(rb, id) { var w = rb.weights ? rb.weights[id] : null; return isNum(w) ? w : 1; }
  function heavyDims(rb) {
    return rb.dimensions.slice().sort(function (a, b) { return dimWeight(rb, b.id) - dimWeight(rb, a.id); }).slice(0, 2).map(function (d) { return d.id; });
  }

  function isKorea(q) {
    if (!q) return false;
    if (q.domain === KOREA_DOMAIN) return true;
    if (arr(q.tags).indexOf('Korea') >= 0) return true;
    if (arr(q.flags).indexOf(KOREA_FLAG) >= 0) return true;
    return false;
  }

  // ------------------------------------------------------------------ config
  // One warrant setting everywhere: the profile's class wins, and the last board's class only fills in when none is set.
  function warrant() {
    var target = txt(safe(function () { return CORB.warrantClass(); }, ''));
    return classesOf().indexOf(target) >= 0 ? target : '';
  }
  function defaults() {
    return { cls: warrant(), domains: [], count: 8, seconds: 90, aloud: speechOk(), scenarios: true, korea: true };
  }
  function loadCfg() {
    var c = defaults();
    var saved = safe(function () { return CORB.get(CFG, null); }, null);
    if (saved && typeof saved === 'object') {
      if (COUNTS.indexOf(saved.count) >= 0) c.count = saved.count;
      if (TIMES.indexOf(saved.seconds) >= 0) c.seconds = saved.seconds;
      // a domain selection belongs to the class it was made for; another class starts from every domain
      if (Array.isArray(saved.domains) && saved.cls === c.cls) c.domains = saved.domains.filter(function (d) { return typeof d === 'string' && d; });
      if (typeof saved.scenarios === 'boolean') c.scenarios = saved.scenarios;
      if (typeof saved.korea === 'boolean') c.korea = saved.korea;
      if (typeof saved.aloud === 'boolean') c.aloud = saved.aloud;
    }
    if (!speechOk()) c.aloud = false;
    return c;
  }
  function saveCfg() { safe(function () { CORB.set(CFG, util.deepClone(cfg)); }); }

  function fromParams(p) {
    if (!p) return;
    var cls = txt(p.cls || p['class']);
    if (cls && classesOf().indexOf(cls) >= 0) cfg.cls = cls;
    var dom = txt(p.domain);
    if (dom) cfg.domains = [dom];
    var n = parseInt(p.n, 10); if (COUNTS.indexOf(n) >= 0) cfg.count = n;
    var s = parseInt(p.seconds, 10); if (TIMES.indexOf(s) >= 0) cfg.seconds = s;
  }

  // ------------------------------------------------------------------ the draw
  function bank() { return arr(safe(function () { return CORB.data.all(); }, [])); }
  function unitPool() { return arr(safe(function () { return CORB.data.questions({ anyClass: true }); }, [])); }   // this view applies its own class
  /* The warrant pool is cumulative: a Class III board draws on Class I to III questions. Pass the organization pool in
     when it is already to hand. */
  function classPool(cls, from) {
    return arr(from || unitPool()).filter(function (q) {
      return !!q && !!safe(function () { return CORB.data.classEligible(q, cls); }, arr(q.classes).indexOf(cls) >= 0);
    });
  }
  function atClass(q, cls) { return arr(q && q.classes).indexOf(cls) >= 0; }
  function lowerClasses(cls) {
    var ko = arr(safe(function () { return CORB.data.KO_CLASSES; }, null));
    if (!ko.length) ko = ['I', 'II', 'III', 'IV'];
    var i = ko.indexOf(cls);
    return i > 0 ? ko.slice(0, i) : [];
  }
  function joinClasses(list) { return 'Class ' + (list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list.join('')); }
  // "Class I to III" for the classes a board draws on; Class I is its own label
  function rangeLabel(cls) {
    var lower = lowerClasses(cls);
    if (!lower.length) return classLabel(cls);
    return lower.length === 1 ? joinClasses(lower.concat([cls])) : 'Class ' + lower[0] + ' to ' + cls;
  }
  function togglePool(list, c) {
    return list.filter(function (q) {
      if (!q) return false;
      if (!c.scenarios && q.kind === 'scenario') return false;
      if (!c.korea && isKorea(q)) return false;
      return true;
    });
  }
  function matchPool(list, c) {
    var picked = c.domains.length ? c.domains : null;
    return togglePool(list, c).filter(function (q) { return !picked || picked.indexOf(q.domain) >= 0; });
  }
  function domainCounts(list) {
    var c = {}, order = [];
    list.forEach(function (q) { var d = txt(q && q.domain) || 'Unfiled'; if (c[d] == null) { c[d] = 0; order.push(d); } c[d]++; });
    return order.sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); }).map(function (d) { return { name: d, count: c[d] }; });
  }
  /* A real board rotates across domains rather than drilling one, and asks mostly at the class requested.
     CORB.data.byWarrant orders the pool so about 60% of it is tagged for the class (the rest from the classes
     below), and the first n of that order fix how many of each the board asks. Then group by domain in that
     order, put questions that have a model answer first inside each group, and deal round-robin, taking from
     each domain the next question that still fits the mix. */
  function draw(list, n, cls) {
    var seq = safe(function () { return CORB.data.byWarrant(list, cls); }, null);
    if (!Array.isArray(seq)) seq = util.shuffle(list);
    seq = seq.filter(Boolean);
    n = Math.min(n, seq.length);
    var want = { at: 0, below: 0 };
    seq.slice(0, n).forEach(function (q) { want[atClass(q, cls) ? 'at' : 'below']++; });
    var groups = {}, order = [];
    seq.forEach(function (q) {
      var d = txt(q.domain) || 'Unfiled';
      if (!groups[d]) { groups[d] = []; order.push(d); }
      groups[d].push(q);
    });
    order.forEach(function (d) {
      groups[d].sort(function (a, b) {   // a stable sort, so the warrant order holds inside each band
        var av = (a.answer_status === 'open' || !txt(a.answer)) ? 1 : 0;
        var bv = (b.answer_status === 'open' || !txt(b.answer)) ? 1 : 0;
        return av - bv;
      });
    });
    var out = [], guard = 0;
    while (out.length < n && guard < 600) {
      var moved = false;
      for (var i = 0; i < order.length && out.length < n; i++) {
        var g = groups[order[i]];
        for (var j = 0; j < g.length; j++) {
          var k = atClass(g[j], cls) ? 'at' : 'below';
          if (want[k] > 0) { want[k]--; out.push(g.splice(j, 1)[0]); moved = true; break; }
        }
      }
      if (!moved) break;
      guard++;
    }
    return out;
  }

  function makeSession(c) {
    var picks = draw(matchPool(classPool(c.cls), c), c.count, c.cls);
    if (!picks.length) return null;
    return {
      id: 'mb-' + util.uid(), started: new Date().toISOString(), i: 0, done: false, finished: '',
      cfg: { cls: c.cls, count: c.count, seconds: c.seconds, domains: c.domains.slice(), scenarios: c.scenarios, korea: c.korea, aloud: c.aloud },
      unit: unitLabel(),
      items: picks.map(function (q) {
        return {
          id: txt(q.id), question: txt(q.question), domain: txt(q.domain), topic: txt(q.topic), kind: txt(q.kind),
          scores: {}, notes: '', answer: '', used: 0, revealed: false, remain: null, deadline: 0, spoke: false
        };
      })
    };
  }

  // ------------------------------------------------------------------ session storage
  function validSession(s) {
    if (!s || typeof s !== 'object') return null;
    if (!Array.isArray(s.items) || !s.items.length) return null;
    if (!s.cfg || typeof s.cfg !== 'object') return null;
    if (!isNum(s.cfg.seconds)) s.cfg.seconds = 90;
    s.i = Math.max(0, Math.min(s.items.length - 1, parseInt(s.i, 10) || 0));
    s.items = s.items.map(function (it) {
      it = (it && typeof it === 'object') ? it : {};
      return {
        id: txt(it.id), question: txt(it.question), domain: txt(it.domain), topic: txt(it.topic), kind: txt(it.kind),
        scores: (it.scores && typeof it.scores === 'object') ? it.scores : {},
        notes: txt(it.notes), answer: txt(it.answer), used: isNum(it.used) ? it.used : 0,
        revealed: !!it.revealed, remain: isNum(it.remain) ? it.remain : (it.remain === 0 ? 0 : null), deadline: 0, spoke: true
      };
    });
    if (s.done) return null;
    return s;
  }
  function loadSaved() { return validSession(safe(function () { return CORB.get(SAVE, null); }, null)); }
  function persist() { if (!sess || sess.done) return; safe(function () { CORB.set(SAVE, util.deepClone(sess), { silent: true }); }); }
  var persistSoon = util.debounce(persist, 600);
  function clearSaved() { safe(function () { CORB.set(SAVE, null, { silent: true }); }); }

  // ------------------------------------------------------------------ paint plumbing
  function repaint(focusKey) {
    if (!R.root || !document.body.contains(R.root)) return;
    build(R.root);
    if (focusKey) {
      var el = R.root.querySelector('[data-fk="' + focusKey.replace(/"/g, '') + '"]');
      if (el && el.focus) safe(function () { el.focus(); });
    }
  }
  function build(root) {
    teardownTransient();
    R = { root: root };
    root.innerHTML = '';
    if (phase === 'run' && sess && sess.items.length) { root.appendChild(runScreen()); return; }
    if (phase === 'done' && sess && sess.items.length) { root.appendChild(doneScreen()); root.appendChild(printSheet()); return; }
    phase = 'setup';
    root.appendChild(setupScreen());
  }
  function teardownTransient() {
    stopClock(); stopSpeak(); stopRecog();
    unsub.forEach(function (u) { safe(function () { u(); }); });
    unsub = [];
  }

  // ==================================================================
  // SETUP
  // ==================================================================
  function setupScreen() {
    var wrap = h('div.mb-setup');
    wrap.appendChild(h('header.mb-head', {},
      h('h1', {}, 'Mock board'),
      h('p.lede', {}, 'One question at a time, on a clock. Answer out loud, then score yourself against the model answer.')));

    var all = bank();
    if (!all.length) {
      wrap.appendChild(h('div.empty.mb-empty', {},
        h('h3', {}, 'The question bank is not loaded'),
        h('p', {}, 'This build has no questions embedded, so there is nothing to ask. Rebuild the app with the question data, or open the question library to confirm what loaded.'),
        h('button.btn.mt-4', { onclick: function () { CORB.go('library'); } }, icon('book'), 'Open the question library')));
      return wrap;
    }

    var pool = unitPool();
    if (!pool.length) {
      wrap.appendChild(h('div.empty.mb-empty', {},
        h('h3', {}, 'Nothing in ' + unitLabel()),
        h('p', {}, 'The organization filter in the top bar is hiding every question. Switch it to another organization, or to all organizations, and the board can be drawn.')));
      return wrap;
    }

    // each chip counts the pool that board draws on, so Class II to IV include the classes below them
    var clsCounts = {};
    classesOf().forEach(function (c) { clsCounts[c] = classPool(c, pool).length; });
    if (cfg.cls && !clsCounts[cfg.cls]) {
      var firstWithItems = classesOf().filter(function (c) { return clsCounts[c]; })[0];
      if (firstWithItems) cfg.cls = firstWithItems;
    }
    // the profile's class has nothing in this organization, so the board fell back to another class
    var profileCls = warrant();
    var missing = (profileCls && profileCls !== cfg.cls && !clsCounts[profileCls]) ? profileCls : '';

    var clsList = classPool(cfg.cls, pool);
    var afterToggles = togglePool(clsList, cfg);
    var doms = domainCounts(afterToggles);
    var domNames = doms.map(function (d) { return d.name; });
    var matched = matchPool(clsList, cfg);

    var saved = loadSaved();
    if (saved) wrap.appendChild(resumeCard(saved));

    wrap.appendChild(h('div.mb-grid', {},
      h('div.mb-form', {},
        startBar(matched, clsList, afterToggles),
        h('details.acc.mb-settings', {},
          h('summary', {}, icon('settings'), 'Change settings', icon('chevron', 'chev')),
          h('div.acc-body', {},
            card_class(clsCounts, clsList, missing),
            card_domains(doms, domNames),
            card_shape(),
            card_options()))),
      rail()));
    return wrap;
  }

  function resumeCard(s) {
    return h('div.mb-resume', {},
      h('span.mb-resume-icon', {}, icon('refresh')),
      h('div.grow', {},
        h('b', {}, 'You have a board in progress'),
        h('div.small.muted', {}, classLabel(s.cfg.cls) + ' · question ' + (s.i + 1) + ' of ' + s.items.length + (s.started ? ' · started ' + util.fmtDateTime(s.started) : '')),
        h('button.btn.sm.ghost.mb-discard', {
          onclick: function () {
            ui.confirm('Discard the board you started? The questions and any scores in it are lost.', { ok: 'Discard', danger: true }).then(function (yes) {
              if (!yes) return; clearSaved(); ui.toast('Discarded'); repaint();
            });
          }
        }, 'Discard it')),
      h('button.btn.sm.primary', {
        onclick: function () { sess = s; phase = 'run'; repaint(); }
      }, icon('play'), 'Resume'));
  }

  function block(title, hint, body) {
    return h('section.mb-block', {},
      h('div.mb-block-head', {}, h('h2', {}, title), hint ? h('p.mb-block-hint', {}, hint) : null),
      body);
  }

  function card_class(counts, list, missing) {
    var notes = [];
    if (missing) notes.push(h('div.mb-note', {}, icon('info'), h('span', {}, 'Your warrant class is ' + classLabel(missing) + ', but ' + unitLabel() + ' has no ' + classLabel(missing) + ' board questions, so this board is set to ' + classLabel(cfg.cls) + '. Pick a chip to change your warrant class.')));
    var mix = mixCopy(list);
    if (mix) notes.push(h('div.mb-note', {}, icon('layers'), h('span', {}, mix)));
    return block('Warrant class', 'A board asks at your class and mixes in the fundamentals below it.',
      h('div', {}, safe(function () { return ui.classLine(); }, null), notes.length ? h('div.mt-3', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, notes) : null));
  }
  // What the chosen class's pool holds: the questions tagged for the class and the fundamentals below it.
  function mixCopy(list) {
    var cls = cfg.cls, lower = lowerClasses(cls);
    if (!list.length) return '';
    if (!cls) return 'With no warrant class chosen, this board draws on all ' + util.plural(list.length, 'question') + ' in your organization, from every class.';
    var at = list.filter(function (q) { return atClass(q, cls); }).length, rest = list.length - at;
    if (lower.length) return 'A ' + classLabel(cls) + ' board draws on ' + util.plural(list.length, 'question') + ': ' + at + ' tagged ' + classLabel(cls) + ' and ' + rest + ' from ' + joinClasses(lower) + '. The draw leans about 60/40 toward ' + classLabel(cls) + '.';
    return 'This board draws on ' + util.plural(list.length, 'question') + ' tagged ' + classLabel(cls) + (rest ? ', plus ' + rest + ' with no class tag' : '') + '.';
  }

  function card_domains(doms, domNames) {
    if (!doms.length) {
      return block('Domains', null, h('div.callout.warn', {}, icon('alert'), h('div', {}, h('b', {}, 'No domains left in this set'), 'Turn scenarios or Korea items back on below, or pick another warrant class.')));
    }
    var picked = cfg.domains.length ? cfg.domains : domNames;
    var chips = doms.map(function (d) {
      var on = picked.indexOf(d.name) >= 0;
      return h('button.chip.mb-chip' + (on ? '.on' : ''), {
        type: 'button', 'data-fk': 'dom-' + d.name, 'aria-pressed': on ? 'true' : 'false',
        onclick: function () {
          var cur = cfg.domains.length ? cfg.domains.slice() : domNames.slice();
          var at = cur.indexOf(d.name);
          if (at >= 0) cur.splice(at, 1); else cur.push(d.name);
          if (!cur.length) { ui.toast('Keep at least one domain', 'warn'); return; }
          cfg.domains = (cur.length === domNames.length) ? [] : cur;
          saveCfg(); repaint('dom-' + d.name);
        }
      }, d.name, h('span.count', {}, String(d.count)));
    });
    var head = h('div.mb-dom-actions', {},
      h('button.btn.sm.ghost', { type: 'button', disabled: !cfg.domains.length, onclick: function () { cfg.domains = []; saveCfg(); repaint(); } }, 'Select all'),
      h('span.muted.small', {}, (cfg.domains.length ? cfg.domains.length : doms.length) + ' of ' + doms.length + ' selected'));
    return block('Domains', 'Boards spread questions across domains. The draw rotates through the ones you leave on, so a wider selection gives a more realistic mix.',
      h('div', {}, head, h('div.chips.mt-3', {}, chips)));
  }

  function card_shape() {
    var counts = h('div.seg.mb-seg', {}, COUNTS.map(function (n) {
      return h('button' + (cfg.count === n ? '.on' : ''), {
        type: 'button', 'data-fk': 'n-' + n, 'aria-pressed': cfg.count === n ? 'true' : 'false',
        onclick: function () { cfg.count = n; saveCfg(); repaint('n-' + n); }
      }, String(n) + ' questions');
    }));
    var times = h('div.seg.mb-seg', {}, TIMES.map(function (s) {
      return h('button' + (cfg.seconds === s ? '.on' : ''), {
        type: 'button', 'data-fk': 's-' + s, 'aria-pressed': cfg.seconds === s ? 'true' : 'false',
        onclick: function () { cfg.seconds = s; saveCfg(); repaint('s-' + s); }
      }, s + 's');
    }));
    return block('Length and clock', 'A real member expects a complete answer in about ninety seconds: rule, cite, application, risk, route.',
      h('div.mb-shape', {},
        h('div.field', {}, h('label', {}, 'Questions'), counts),
        h('div.field', {}, h('label', {}, 'Time per answer'), times)));
  }

  function card_options() {
    var rows = [];
    rows.push(toggleRow('aloud', 'Read questions aloud',
      'The app reads each question the way a board member would, then starts your clock.',
      !speechOk(), 'This browser has no speech synthesis, so questions stay on screen only.'));
    if (speechOk() && cfg.aloud && !ttsOn()) {
      rows.push(h('div.mb-note', {}, icon('info'), h('span', {}, 'Text-to-speech is switched off in Settings, so nothing will be spoken until you turn it back on.')));
    }
    rows.push(toggleRow('scenarios', 'Include scenarios',
      'Situational "you are the KO" questions alongside straight knowledge questions.', false, ''));
    rows.push(toggleRow('korea', 'Include Korea items',
      'LCS, SOFA Invited Contractor and 411th-specific questions. Their answers are flagged to confirm with C&P.', false, ''));
    return block('Options', null, h('div.mb-toggles', {}, rows));
  }

  function toggleRow(key, label, hint, disabled, dhint) {
    var input = h('input', {
      type: 'checkbox', checked: !!cfg[key], disabled: !!disabled, 'data-fk': 't-' + key,
      onchange: function (e) { cfg[key] = !!e.target.checked; saveCfg(); repaint('t-' + key); }
    });
    return h('label.switch.mb-toggle' + (disabled ? '.off' : ''), {}, input,
      h('span.mb-toggle-copy', {}, h('b', {}, label), h('small', {}, disabled ? (dhint || hint) : hint)));
  }

  function startBar(matched, clsList, afterToggles) {
    var n = Math.min(cfg.count, matched.length);
    var domsInDraw = {};
    matched.forEach(function (q) { domsInDraw[txt(q.domain)] = 1; });
    var lower = lowerClasses(cfg.cls);
    var lines = [];
    if (!clsList.length) {
      lines.push(h('div.callout.warn', {}, icon('alert'), h('div', {},
        h('b', {}, 'No questions for this ' + classLabel(cfg.cls) + ' board in ' + unitLabel()),
        (lower.length ? 'A ' + classLabel(cfg.cls) + ' board draws on ' + rangeLabel(cfg.cls) + ' questions, and there are none here. ' : '') +
        'Pick another warrant class, or change the organization filter in the top bar.')));
    } else if (!matched.length) {
      lines.push(h('div.callout.warn', {}, icon('alert'), h('div', {},
        h('b', {}, 'Nothing matches these options'),
        'Add domains back, or turn scenarios and Korea items on, until at least one question is in the set.')));
    } else {
      // the set is cumulative, so say what it holds and which way the draw leans
      var at = matched.filter(function (q) { return atClass(q, cfg.cls); }).length;
      var mix = !lower.length ? ''
        : at ? 'From ' + rangeLabel(cfg.cls) + ', ' + at + ' of them tagged ' + classLabel(cfg.cls) + '; the draw leans about 60/40 toward those. '
        : 'None of them is tagged ' + classLabel(cfg.cls) + ', so this board asks ' + joinClasses(lower) + ' questions only. ';
      lines.push(h('div.mb-start-copy', {},
        h('b', {}, classLabel(cfg.cls) + ' · ' + util.plural(matched.length, 'question') + ' in the set'),
        h('span', {}, mix + 'Your board draws ' + n + ' of them across ' + util.plural(Object.keys(domsInDraw).length, 'domain') + ', at ' + cfg.seconds + ' seconds each — about ' + Math.max(1, Math.round(n * (cfg.seconds + 45) / 60)) + ' minutes with scoring.')));
      if (matched.length < cfg.count) {
        lines.push(h('div.mb-note', {}, icon('info'), h('span', {}, 'Only ' + util.plural(matched.length, 'question') + ' match, so the board will run ' + n + '.')));
      }
      if (afterToggles.length && matched.length < afterToggles.length) {
        var outside = afterToggles.length - matched.length;
        lines.push(h('div.mb-note', {}, icon('filter'), h('span', {}, util.plural(outside, 'more ' + rangeLabel(cfg.cls) + ' question') + ' ' + (outside === 1 ? 'is' : 'are') + ' outside the domains you selected.')));
      }
    }
    return h('div.mb-start', {},
      h('div.grow', {}, lines),
      h('button.btn.lg.primary.mb-go', { disabled: !matched.length, onclick: start }, icon('mic'), 'Start the board'));
  }

  function start() {
    var s = makeSession(cfg);
    if (!s) { ui.toast('Nothing matches those options', 'warn'); return; }
    sess = s; phase = 'run';
    persist();
    repaint();
    if (R.stage && R.stage.focus) safe(function () { R.stage.focus(); });
  }

  // ---- setup rail ----------------------------------------------------------
  function rail() {
    var rb = rubric(), bg = boardGuide();
    var side = h('aside.mb-rail');

    // the four names and their weights are enough while you practise; what each one means waits behind a toggle
    var dims = h('div.mb-rail-dims', {}, rb.dimensions.map(function (d) {
      var w = rb.weights && isNum(rb.weights[d.id]) ? Math.round(rb.weights[d.id] * 100) : null;
      return h('div.mb-rail-dim-head', {}, h('b', {}, txt(d.name)), w != null ? h('span.badge.neutral', {}, w + '%') : null);
    }));
    var dimDetail = h('details.acc.mb-acc', {},
      h('summary', {}, icon('info'), 'What each one means', icon('chevron', 'chev')),
      h('div.acc-body', {}, rb.dimensions.map(function (d) {
        return h('div.mb-rail-dim', {}, h('b', {}, txt(d.name)), h('p', {}, txt(d.description) || 'Scored 1 to 5.'));
      })));
    side.appendChild(h('section.card.mb-rail-card', {},
      h('div.eyebrow', {}, 'How you will be scored'),
      h('h3.mt-2', {}, util.plural(rb.dimensions.length, 'dimension') + ', 1 to 5'),
      dims,
      dimDetail,
      rb.pass_rule ? h('div.mb-rail-pass', {}, icon('shield'), h('span', {}, 'Pass rule: ', h('b', {}, rb.pass_rule))) : null));

    var af = bg.answer_framework;
    if (af && (af.name || arr(af.steps).length)) {
      side.appendChild(h('details.acc.mb-acc', {},
        h('summary', {}, icon('target'), txt(af.name) || 'Answer framework', icon('chevron', 'chev')),
        h('div.acc-body', {},
          af.tagline ? h('p.muted.small', {}, txt(af.tagline)) : null,
          arr(af.steps).length ? h('ol.mb-steps', {}, arr(af.steps).map(function (s) { return h('li', {}, txt(s)); })) : null)));
    }

    var focus = (bg.class_focus && typeof bg.class_focus === 'object') ? txt(bg.class_focus[cfg.cls]) : '';
    if (focus) {
      side.appendChild(h('details.acc.mb-acc', {},
        h('summary', {}, icon('compass'), 'What a ' + classLabel(cfg.cls) + ' board probes', icon('chevron', 'chev')),
        h('div.acc-body', {}, ui.rich(focus))));
    }

    var boards = arr(safe(function () { return CORB.get('progress.boards', []); }, [])).filter(function (b) { return b && b.source === 'mockboard'; });
    if (boards.length) {
      var recent = boards.slice(-3).reverse();
      side.appendChild(h('section.card.mb-rail-card', {},
        h('div.eyebrow', {}, 'Your last boards'),
        h('div.mb-recent', {}, recent.map(function (b) {
          return h('div.mb-recent-row', {},
            h('span.mb-recent-score.num', {}, isNum(b.overall) ? b.overall.toFixed(1) : '—'),
            h('span.grow', {}, h('b', {}, classLabel(txt(b.cls) || '—')), h('small', {}, (b.ts ? util.fmtDate(b.ts) : '') + ' · ' + util.plural(arr(b.questions).length, 'question'))));
        })),
        h('button.btn.sm.ghost.mt-3', { onclick: function () { CORB.go('dashboard'); } }, icon('bar-chart'), 'Readiness')));
    }

    side.appendChild(h('p.mb-rail-foot', {}, 'This rubric is a training aid. The official CORB cover sheet and scoring sheet are prepared by the C&P branch for each board and replace it. Nothing you type here leaves this device.'));
    return side;
  }

  // ==================================================================
  // SESSION
  // ==================================================================
  function cur() { return sess.items[sess.i]; }
  function qOf(it) { return it ? safe(function () { return CORB.data.byId(it.id); }, null) : null; }
  function scoredAny(it) { return !!(it && it.scores && Object.keys(it.scores).length); }
  function scoredCount(it, rb) { return rb.dimensions.filter(function (d) { return isNum(it.scores[d.id]); }).length; }

  function runScreen() {
    var it = cur(), q = qOf(it), rb = rubric();
    var stage = h('section.mb-stage', { tabindex: '-1', 'aria-label': 'Mock board, question ' + (sess.i + 1) });
    R.stage = stage;
    R.live = h('div.sr-only', { 'aria-live': 'polite' });
    stage.appendChild(R.live);

    stage.appendChild(h('div.mb-top', {},
      h('div.mb-count', {}, h('b', {}, 'Question ' + (sess.i + 1)), h('span', {}, 'of ' + sess.items.length)),
      pips(),
      h('div.grow'),
      h('button.btn.sm.ghost.mb-end', { onclick: endEarly }, icon('x'), 'End early')));

    stage.appendChild(clockBlock(it));

    // a board member does not read you the tags: the domain stays, the rest waits for the model answer
    var badges = h('div.mb-badges', {});
    if (it.domain) badges.appendChild(h('span.badge.neutral', {}, it.domain));
    if (it.id) badges.appendChild(h('span.mb-qid.num', {}, it.id));
    R.badges = h('div.mb-badges.mb-badges-after', { hidden: true });
    if (q) ui.flagsFor(q).forEach(function (f) { R.badges.appendChild(ui.badge(f)); });
    var clsBadge = safe(function () { return ui.classBadges(q ? q.classes : null); }, null);
    if (clsBadge) R.badges.appendChild(clsBadge);
    if (it.kind) R.badges.appendChild(h('span.badge.neutral', {}, kindLabel(it.kind)));

    stage.appendChild(h('div.mb-question', {}, badges, h('h2.mb-q', {}, it.question || (q ? txt(q.question) : '') || 'This question is no longer in the repository.'), R.badges));

    stage.appendChild(workBlock(it));

    R.after = h('div.mb-after');
    stage.appendChild(R.after);
    R.foot = h('div.mb-foot');
    stage.appendChild(R.foot);
    paintFoot();

    if (it.revealed) fillAfter(it, q, rb, true);

    if (speechOk()) unsub.push(CORB.on('speech', paintSpeakBtn));

    if (!it.revealed) {
      if (it.remain == null) startClock();
      else paintClock();
    } else {
      paintClock();
    }

    if (!it.revealed && !it.spoke && cfg.aloud && speechOk() && ttsOn()) {
      it.spoke = true;
      setTimeout(function () { if (R.stage === stage && !it.revealed) speakQuestion(); }, 320);
    }
    return stage;
  }

  function pips() {
    return h('div.mb-pips', { 'aria-hidden': 'true' }, sess.items.map(function (it, i) {
      var cls = i < sess.i ? '.done' : (i === sess.i ? '.now' : '');
      if (i < sess.i && !scoredAny(it)) cls = '.skipped';
      return h('span.mb-pip' + cls);
    }));
  }

  // ---- clock ---------------------------------------------------------------
  function totalMs() { return (isNum(sess.cfg.seconds) ? sess.cfg.seconds : 90) * 1000; }
  function remainMs(it) {
    if (it.deadline) return it.deadline - Date.now();
    if (it.remain != null) return it.remain;
    return totalMs();
  }
  function usedSeconds(it) { return Math.max(0, Math.round((totalMs() - remainMs(it)) / 1000)); }

  function clockBlock(it) {
    var ring = h('div.mb-ring', {
      html: '<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
        '<circle class="mb-ring-bg" cx="60" cy="60" r="' + RING_R + '"></circle>' +
        '<circle class="mb-ring-fg" cx="60" cy="60" r="' + RING_R + '"></circle></svg>'
    });
    R.ringFg = ring.querySelector('.mb-ring-fg');
    if (R.ringFg) {
      R.ringFg.setAttribute('stroke-dasharray', String(RING_C));
      R.ringFg.setAttribute('stroke-dashoffset', '0');
    }
    R.time = h('div.mb-time.num', {}, mmss(totalMs() / 1000));
    R.state = h('div.mb-state', {}, '');
    R.dial = h('div.mb-dial', {}, ring, h('div.mb-face', {}, R.time, R.state));

    R.speakBtn = h('button.btn.sm', { onclick: onSpeakClick, 'data-fk': 'speak' }, icon('volume'), 'Read aloud');
    paintSpeakBtn();
    R.pauseBtn = h('button.btn.sm.ghost', { onclick: togglePause }, icon('pause'), 'Pause');
    var restart = h('button.btn.sm.ghost', {
      onclick: function () { var c = cur(); if (c.revealed) return; c.remain = null; c.deadline = 0; startClock(); ui.toast('Clock reset'); }
    }, icon('refresh'), 'Reset clock');

    var controls = h('div.mb-controls', {}, R.speakBtn, R.pauseBtn, restart);
    return h('div.mb-clock', {}, R.dial,
      h('div.mb-clock-copy', {},
        h('div.eyebrow', {}, 'Answer aloud'),
        h('p', {}, 'Say it the way you would say it to the board: the rule in one sentence, the citation, how it applies to these facts, the risk, and who has to approve. Stop when you are done — do not fill the clock.'),
        controls));
  }

  function startClock() {
    var it = cur();
    if (!it || it.revealed) { stopClock(); paintClock(); return; }
    stopClock();
    it.deadline = Date.now() + (it.remain != null ? it.remain : totalMs());
    tickId = setInterval(paintClock, 200);
    paintClock();
  }
  function stopClock() { if (tickId) { clearInterval(tickId); tickId = null; } }
  function holdClock() {
    var it = sess && sess.items[sess.i];
    if (!it) return;
    if (it.deadline) { it.remain = it.deadline - Date.now(); it.deadline = 0; }
    stopClock();
  }
  function togglePause() {
    var it = cur();
    if (it.revealed) return;
    if (it.deadline) { holdClock(); paintClock(); }
    else { startClock(); }
  }
  function paintClock() {
    if (!R.time || !sess) return;
    var it = cur();
    if (!it) return;
    var ms = remainMs(it), total = totalMs();
    var over = ms <= 0;
    var secs = Math.ceil(Math.abs(ms) / 1000);
    R.time.textContent = (over && secs > 0 ? '+' : '') + mmss(secs);
    var ratio = util.clamp(ms / total, 0, 1);
    if (R.ringFg) R.ringFg.setAttribute('stroke-dashoffset', String(RING_C * (1 - ratio)));
    var warn = !over && ms <= 20000;
    if (R.dial) {
      R.dial.classList.toggle('warn', warn);
      R.dial.classList.toggle('over', over);
      R.dial.classList.toggle('paused', !it.deadline && !it.revealed && !over);
      R.dial.classList.toggle('stopped', !!it.revealed);
    }
    var label = '';
    if (it.revealed) label = 'Answered in ' + mmss(it.used);
    else if (over) label = 'Time called';
    else if (!it.deadline) label = it.remain == null ? 'Ready' : 'Paused';
    else if (warn) label = 'Land the answer';
    else label = 'Answering';
    if (R.state) R.state.textContent = label;
    if (R.pauseBtn && !it.revealed) {
      R.pauseBtn.textContent = '';
      R.pauseBtn.appendChild(icon(it.deadline ? 'pause' : 'play'));
      R.pauseBtn.appendChild(document.createTextNode(it.deadline ? ' Pause' : ' Resume'));
    }
    if (!it.revealed && R.live) {
      if (warn && !it._w20) { it._w20 = true; R.live.textContent = 'Twenty seconds left.'; }
      if (over && !it._w0) { it._w0 = true; R.live.textContent = 'Time called. Finish your thought.'; stopClock(); tickId = setInterval(paintClock, 500); }
    }
  }

  // ---- speech --------------------------------------------------------------
  function paintSpeakBtn() {
    if (!R.speakBtn) return;
    var on = !!(CORB.speech && CORB.speech.speaking);
    R.speakBtn.textContent = '';
    R.speakBtn.appendChild(icon(on ? 'stop' : 'volume'));
    R.speakBtn.appendChild(document.createTextNode(on ? ' Stop reading' : ' Read aloud'));
    R.speakBtn.classList.toggle('on', on);
  }
  function onSpeakClick() {
    if (!speechOk()) { ui.toast('This browser has no speech synthesis', 'warn'); return; }
    if (!ttsOn()) { ui.toast('Read-aloud is switched off in Settings', 'warn'); return; }
    if (CORB.speech.speaking) { stopSpeak(); paintSpeakBtn(); return; }
    speakQuestion();
  }
  function speakQuestion() {
    var it = sess && sess.items[sess.i];
    if (!it || !speechOk() || !ttsOn()) return;
    safe(function () { CORB.speech.speak(it.question || ''); });
    paintSpeakBtn();
  }
  function stopSpeak() { safe(function () { if (CORB.speech && CORB.speech.stop) CORB.speech.stop(); }); }

  function workBlock(it) {
    R.ta = h('textarea.textarea.mb-ta', {
      value: it.answer, 'aria-label': 'Your answer',
      placeholder: 'Optional — type the bones of your answer as you say it: rule, cite, how it applies, the risk, who approves.',
      oninput: function (e) { it.answer = e.target.value; persistSoon(); }
    });
    var rows = [h('div.mb-work-head', {}, h('div.eyebrow', {}, 'Your answer'), h('span.muted.small', {}, 'Optional — nothing here is graded automatically')), R.ta];

    if (recogOk()) {
      R.recBtn = h('button.btn.sm.mb-rec', { onclick: toggleRecog }, icon('mic'), 'Record via speech recognition');
      R.recNote = h('div.mb-note', {}, icon('alert'), h('span', {}, 'Speech recognition in this browser sends audio to the vendor’s servers. It needs internet, so it will not work on NIPR or an air-gapped machine. Everything else in this app runs offline.'));
      rows.push(h('div.mb-work-foot', {}, R.recBtn, R.recNote));
    }
    return h('div.mb-work', {}, rows);
  }

  function toggleRecog() {
    if (recog) { stopRecog(); return; }
    if (!recogOk() || !R.ta) { ui.toast('Speech recognition is not available here', 'warn'); return; }
    var base = R.ta.value ? R.ta.value.replace(/\s*$/, '') + '\n' : '';
    var started = safe(function () {
      return CORB.speech.listen(function (finalText, interim) {
        if (!R.ta) return;
        R.ta.value = base + txt(finalText) + txt(interim);
        var c = sess && sess.items[sess.i];
        if (c) { c.answer = R.ta.value; persistSoon(); }
      }, function (err) {
        recog = null; paintRecBtn();
        if (err) ui.toast('Recording stopped: ' + txt(err.message || err), 'warn');
      });
    }, null);
    if (!started) { ui.toast('Could not start recording — it needs internet and microphone permission', 'danger'); return; }
    recog = started; paintRecBtn();
    ui.toast('Recording — speak normally', 'ok');
  }
  function stopRecog() {
    if (!recog) return;
    safe(function () { recog.stop(); });
    recog = null;
    paintRecBtn();
  }
  function paintRecBtn() {
    if (!R.recBtn) return;
    var on = !!recog;
    R.recBtn.textContent = '';
    R.recBtn.appendChild(icon(on ? 'stop' : 'mic'));
    R.recBtn.appendChild(document.createTextNode(on ? ' Stop recording' : ' Record via speech recognition'));
    R.recBtn.classList.toggle('on', on);
  }

  // ---- reveal --------------------------------------------------------------
  function reveal() {
    if (R.badges) R.badges.hidden = false;
    var it = cur();
    if (!it || it.revealed) return;
    it.used = usedSeconds(it);
    holdClock();
    it.revealed = true;
    stopSpeak();
    paintClock();
    var rb = rubric();
    fillAfter(it, qOf(it), rb, false);
    paintFoot();
    persist();
    if (R.live) R.live.textContent = 'Model answer revealed. Score the ' + util.plural(rb.dimensions.length, 'dimension') + '.';
  }

  function fillAfter(it, q, rb, silentMount) {
    if (!R.after) return;
    R.after.innerHTML = '';
    var model = modelPanel(it, q);
    var score = rubricPanel(it, rb);
    if (!silentMount) { model.classList.add('rise'); score.classList.add('rise'); score.classList.add('rise-2'); }
    R.after.appendChild(model);
    R.after.appendChild(score);
    if (!silentMount) {
      var head = model.querySelector('.mb-model-head');
      if (head && head.focus) safe(function () { head.focus(); });
    }
  }

  function modelPanel(it, q) {
    var box = h('section.mb-model', {});
    box.appendChild(h('div.mb-model-head', { tabindex: '-1' }, icon('check'), h('b', {}, 'Model answer'), h('div.grow'),
      h('span.muted.small', {}, it.used ? 'You took ' + mmss(it.used) : '')));

    if (!q) {
      box.appendChild(h('div.callout.info', {}, icon('info'), h('div', {},
        h('b', {}, 'This question is not in the current bank'),
        'It was drawn from an earlier session or a different organization filter. Score what you said from memory, or skip it.')));
      return box;
    }

    var status = txt(q.answer_status), answer = txt(q.answer);
    if (status === 'ai-draft' && !safe(function () { return CORB.get('settings.showDrafts', true); }, true)) {
      box.appendChild(h('div.mb-model-body', {}, h('em.muted', {}, 'The drafted answer for this question is hidden by your settings. Turn drafts back on in Settings to compare against it.')));
    } else if (!answer || status === 'open') {
      box.appendChild(h('div.callout.info', {}, icon('edit'), h('div', {},
        h('b', {}, 'No formal answer in the repository'),
        'This one is deliberately open. Write what you said in the notes below, then check it with a mentor before the real board.')));
    } else {
      box.appendChild(h('div.mb-model-body', {}, ui.rich(answer)));
    }

    var kp = arr(q.key_points).filter(Boolean);
    if (kp.length) {
      box.appendChild(h('div.panel-soft.mt-4', {}, h('div.eyebrow', {}, 'Key points the board listens for'),
        h('ul.mb-kp', {}, kp.map(function (k) { return h('li', {}, txt(k)); }))));
    }

    var outline = arr(q.model_answer_outline).filter(Boolean);
    if (outline.length) {
      box.appendChild(h('div.panel-soft.mt-3', {}, h('div.eyebrow', {}, 'Answer outline'),
        h('ol.mb-kp', {}, outline.map(function (k) { return h('li', {}, txt(k)); }))));
    }

    var cites = arr(q.citations_rfo).length ? arr(q.citations_rfo) : arr(q.citations);
    cites = cites.filter(Boolean);
    if (cites.length) {
      box.appendChild(h('div.mb-cites', {}, 'Cite: ', cites.map(function (c) {
        var u = safe(function () { return CORB.data.citeUrl(c); }, null);
        return u ? h('a.cite', { href: u, target: '_blank', rel: 'noopener' }, txt(c)) : h('span.cite', {}, txt(c));
      })));
    }
    var cw = arr(q.rfo && q.rfo.crosswalk).filter(Boolean);
    if (cw.length) {
      box.appendChild(h('div.muted.small.mt-2', {}, 'RFO crosswalk: ' + cw.map(function (c) { return txt(c.old || '?') + ' → ' + txt(c.new || '?'); }).join(' · ')));
    }

    var probes = safe(function () { return arr((boardGuide().probes || {})[it.domain]); }, []);
    if (probes.length) {
      box.appendChild(h('div.mb-probes', {}, h('div.eyebrow', {}, 'Expect a follow-up'),
        h('ul', {}, probes.slice(0, 3).map(function (p) { return h('li', {}, txt(p)); }))));
    }
    return box;
  }

  // ---- rubric --------------------------------------------------------------
  function rubricPanel(it, rb) {
    var box = h('section.mb-rubric', {});
    box.appendChild(h('div.mb-rubric-head', {},
      h('div', {}, h('div.eyebrow', {}, 'Score yourself'), h('h3', {}, 'What a member would write down')),
      h('div.grow'),
      R.scoreTally = h('span.badge.neutral', {}, scoredCount(it, rb) + '/' + rb.dimensions.length + ' scored')));

    if (rb.scale) {
      box.appendChild(h('details.acc.mb-acc', {}, h('summary', {}, icon('scale'), 'How the 1 to 5 scale works', icon('chevron', 'chev')),
        h('div.acc-body', {}, h('p.small', {}, rb.scale))));
    }

    rb.dimensions.forEach(function (d) {
      var anchor = h('div.mb-anchor', { 'aria-live': 'polite' });
      var buttons = [];
      function anchorText(n) {
        var a = (d.anchors && typeof d.anchors === 'object') ? d.anchors : {};
        var t = txt(a[n] || a[String(n)]);
        if (t) return { n: n, text: t };
        return { n: n, text: txt(d.description) || 'No anchor was written for this level.' };
      }
      function showAnchor(n) {
        anchor.innerHTML = '';
        if (n == null) {
          anchor.appendChild(h('span.mb-anchor-hint', {}, txt(d.description) || 'Hover or tap a number to read its anchor.'));
          return;
        }
        var a = anchorText(n);
        anchor.appendChild(h('b', {}, String(a.n)));
        anchor.appendChild(h('span', {}, a.text));
      }
      function paintButtons() {
        buttons.forEach(function (b, idx) {
          var on = it.scores[d.id] === (idx + 1);
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        if (R.scoreTally) R.scoreTally.textContent = scoredCount(it, rb) + '/' + rb.dimensions.length + ' scored';
        row.classList.toggle('scored', isNum(it.scores[d.id]));
      }
      for (var n = 1; n <= 5; n++) {
        (function (v) {
          var b = h('button', {
            type: 'button', 'data-fk': 'sc-' + d.id + '-' + v, 'aria-label': txt(d.name) + ': ' + v + ' of 5',
            onclick: function () {
              if (it.scores[d.id] === v) delete it.scores[d.id]; else it.scores[d.id] = v;
              paintButtons(); showAnchor(isNum(it.scores[d.id]) ? it.scores[d.id] : v); persistSoon(); paintFoot();
            },
            onmouseenter: function () { showAnchor(v); },
            onfocus: function () { showAnchor(v); },
            onmouseleave: function () { showAnchor(isNum(it.scores[d.id]) ? it.scores[d.id] : null); }
          }, String(v));
          buttons.push(b);
        })(n);
      }
      var row = h('div.mb-dim', {},
        h('div.mb-dim-head', {},
          h('div.mb-dim-name', {}, h('b', {}, txt(d.name)), h('span.muted.small', {}, txt(d.description))),
          h('div.rate.mb-rate', {}, buttons)),
        anchor);
      showAnchor(isNum(it.scores[d.id]) ? it.scores[d.id] : null);
      paintButtons();
      box.appendChild(row);
    });

    R.notes = h('textarea.textarea.mb-notes', {
      value: it.notes, 'aria-label': 'Notes on this question',
      placeholder: 'What you missed, the cite you could not produce, the follow-up you would expect next time…',
      oninput: function (e) { it.notes = e.target.value; persistSoon(); }
    });
    box.appendChild(h('div.mb-notes-wrap', {}, h('div.eyebrow', {}, 'Note to self'), R.notes));
    return box;
  }

  // ---- footer --------------------------------------------------------------
  function paintFoot() {
    if (!R.foot || !sess) return;
    var it = cur(), rb = rubric();
    var last = sess.i >= sess.items.length - 1;
    R.foot.innerHTML = '';
    if (!it.revealed) {
      R.foot.appendChild(h('div.mb-foot-hint', {}, h('kbd', {}, 'Space'), h('span', {}, 'reveal'), h('kbd', {}, 'Enter'), h('span', {}, last ? 'finish' : 'next'), h('kbd', {}, 'Esc'), h('span', {}, 'end')));
      R.foot.appendChild(h('div.grow'));
      R.foot.appendChild(h('button.btn.ghost', { onclick: next }, last ? 'Finish without the answer' : 'Skip to next'));
      R.foot.appendChild(h('button.btn.lg.primary', { 'data-fk': 'reveal', onclick: reveal }, icon('eye'), 'Show model answer'));
      return;
    }
    var n = scoredCount(it, rb);
    R.foot.appendChild(h('div.mb-foot-hint', {}, n === rb.dimensions.length
      ? h('span.mb-foot-ok', {}, icon('check'), 'All ' + util.plural(rb.dimensions.length, 'dimension') + ' scored')
      : h('span', {}, 'Score all ' + rb.dimensions.length + ' dimensions for a usable average — ' + n + ' so far')));
    R.foot.appendChild(h('div.grow'));
    R.foot.appendChild(h('button.btn.lg.primary', { 'data-fk': 'next', onclick: next },
      last ? icon('check') : icon('arrow-right'), last ? 'Finish and score' : 'Next question'));
  }

  // ---- advance / end -------------------------------------------------------
  function next() {
    if (!sess) return;
    var it = cur();
    stopSpeak(); stopRecog();
    if (!it.revealed) it.used = usedSeconds(it);
    holdClock();
    if (sess.i >= sess.items.length - 1) { finish(); return; }
    sess.i++;
    persist();
    repaint();
    if (R.stage && R.stage.focus) safe(function () { R.stage.focus(); });
    safe(function () { window.scrollTo(0, 0); });
  }

  function endEarly() {
    if (!sess || phase !== 'run') return;
    if (confirming) return;
    var wasRunning = !!cur().deadline;
    holdClock();
    confirming = true;
    ui.confirm('End this board now? Questions you have already answered keep their scores and go into your summary; the rest are dropped.', { ok: 'End the board', danger: true })
      .then(function (yes) {
        confirming = false;
        if (!yes) { if (wasRunning) startClock(); else paintClock(); return; }
        var keep = sess.items.slice(0, sess.i + 1).filter(function (it, idx) {
          if (idx < sess.i) return true;
          return it.revealed || scoredAny(it) || it.used > 0 || !!txt(it.answer);
        });
        if (!keep.length) {
          sess = null; phase = 'setup'; clearSaved(); repaint();
          ui.toast('Board ended — nothing to score');
          return;
        }
        sess.items = keep;
        sess.i = keep.length - 1;
        sess.ended_early = true;
        finish();
      });
  }

  function finish() {
    if (!sess) return;
    stopClock(); stopSpeak(); stopRecog();
    sess.done = true;
    sess.finished = new Date().toISOString();
    var rb = rubric(), res = results(rb);
    var rec = {
      id: sess.id, source: 'mockboard', mode: 'self-scored', cls: sess.cfg.cls,
      unit: txt(sess.unit), ended_early: !!sess.ended_early,
      settings: { count: sess.items.length, seconds: sess.cfg.seconds, domains: arr(sess.cfg.domains), scenarios: !!sess.cfg.scenarios, korea: !!sess.cfg.korea },
      questions: sess.items.map(function (it) {
        return { id: it.id, domain: it.domain, scores: util.deepClone(it.scores || {}), notes: txt(it.notes), answer: txt(it.answer), seconds: it.used };
      }),
      dimensions: res.dimAvg, indicator: res.indicator.key, overall: res.overall
    };
    safe(function () { CORB.scoring.recordBoard(rec); });
    sess.items.forEach(function (it) { if (it.id) safe(function () { CORB.set('progress.seen.' + it.id, util.today(), { silent: true }); }); });
    clearSaved();
    phase = 'done';
    repaint();
    safe(function () { window.scrollTo(0, 0); });
  }

  // ==================================================================
  // SUMMARY
  // ==================================================================
  function results(rb) {
    var dims = rb.dimensions;
    var dimAvg = {}, dimN = {};
    dims.forEach(function (d) {
      var vals = sess.items.map(function (it) { return it.scores[d.id]; }).filter(isNum);
      dimN[d.id] = vals.length;
      dimAvg[d.id] = vals.length ? Math.round((vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) * 10) / 10 : null;
    });
    var perQ = sess.items.map(function (it, i) {
      var vals = dims.map(function (d) { return it.scores[d.id]; }).filter(isNum);
      return { n: i + 1, it: it, count: vals.length, avg: vals.length ? Math.round((vals.reduce(function (a, b) { return a + b; }, 0) / vals.length) * 10) / 10 : null };
    });
    var scoredQ = perQ.filter(function (p) { return p.avg != null; });

    var wn = 0, wd = 0;
    dims.forEach(function (d) { if (dimAvg[d.id] != null) { var w = dimWeight(rb, d.id); wn += dimAvg[d.id] * w; wd += w; } });
    var overall = wd ? Math.round((wn / wd) * 10) / 10 : null;

    var byDomain = {};
    scoredQ.forEach(function (p) {
      var d = p.it.domain || 'Unfiled';
      byDomain[d] = byDomain[d] || { name: d, vals: [] };
      byDomain[d].vals.push(p.avg);
    });
    var domains = Object.keys(byDomain).map(function (k) {
      var v = byDomain[k].vals;
      return { name: k, n: v.length, avg: Math.round((v.reduce(function (a, b) { return a + b; }, 0) / v.length) * 10) / 10 };
    }).sort(function (a, b) { return a.avg - b.avg || a.name.localeCompare(b.name); });

    var indicator = { key: 'unscored', label: 'Not scored', tone: 'neutral', text: 'Nothing was scored in this board, so there is no average to read. Run it again and score all four dimensions on each question.' };
    if (scoredQ.length) {
      var avgs = dims.map(function (d) { return dimAvg[d.id]; }).filter(function (v) { return v != null; });
      var min = avgs.length ? Math.min.apply(null, avgs) : 0;
      var heavy = heavyDims(rb);
      var hardFail = sess.items.some(function (it) { return heavy.some(function (id) { return it.scores[id] === 1; }); });
      if (min >= 3 && !hardFail) indicator = { key: 'ready', label: 'On track for a recommendation', tone: 'ok', text: 'Every dimension averaged 3.0 or better and no question bottomed out on the two heaviest dimensions. That is the shape of a board that goes your way — keep the weakest domain warm.' };
      else if (min >= 2.5 && !hardFail) indicator = { key: 'borderline', label: 'Borderline — a board might recommend a lower class', tone: 'warn', text: 'One dimension is sitting between 2.5 and 3.0. Boards that see this pattern often recommend a lower warrant class or a re-board. Fix the weakest dimension before you sit.' };
      else indicator = { key: 'work', label: 'Not yet — rebuild the weak dimension first', tone: 'danger', text: hardFail ? 'At least one question scored a 1 on a heavily weighted dimension. A single answer like that in a real board can end it.' : 'A dimension averaged below 2.5. Work that dimension specifically rather than reading more questions.' };
    }
    var seconds = sess.items.reduce(function (a, it) { return a + (isNum(it.used) ? it.used : 0); }, 0);
    return { dims: dims, dimAvg: dimAvg, dimN: dimN, perQ: perQ, scoredQ: scoredQ, overall: overall, domains: domains, indicator: indicator, seconds: seconds };
  }

  function doneScreen() {
    var rb = rubric(), res = results(rb);
    var wrap = h('div.mb-done.mb-app');

    wrap.appendChild(h('header.mb-head', {},
      h('div.eyebrow', {}, 'Practice · oral board'),
      h('h1', {}, sess.ended_early ? 'Board ended early' : 'Board complete'),
      h('p.lede', {}, classLabel(sess.cfg.cls) + ' board · ' + util.plural(sess.items.length, 'question') + ' · ' + mmss(res.seconds) + ' of answering · ' + util.fmtDate(sess.finished || new Date().toISOString()))));

    // result hero
    var dialPct = res.overall != null ? util.clamp(res.overall / 5, 0, 1) : 0;
    var ring = h('div.mb-ring', {
      html: '<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
        '<circle class="mb-ring-bg" cx="60" cy="60" r="' + RING_R + '"></circle>' +
        '<circle class="mb-ring-fg" cx="60" cy="60" r="' + RING_R + '"></circle></svg>'
    });
    var fg = ring.querySelector('.mb-ring-fg');
    if (fg) { fg.setAttribute('stroke-dasharray', String(RING_C)); fg.setAttribute('stroke-dashoffset', String(RING_C * (1 - dialPct))); }
    var hero = h('section.card.mb-hero.' + res.indicator.tone, {},
      h('div.mb-dial.result.' + res.indicator.tone, {}, ring, h('div.mb-face', {},
        h('div.mb-time.num', {}, res.overall != null ? res.overall.toFixed(1) : '—'),
        h('div.mb-state', {}, 'of 5'))),
      h('div.mb-hero-copy', {},
        h('span.badge.' + (res.indicator.tone === 'ok' ? 'official' : res.indicator.tone === 'warn' ? 'ai-draft' : res.indicator.tone === 'danger' ? 'rfo-unverifiable' : 'neutral'), {}, res.indicator.label),
        h('p.mt-3', {}, res.indicator.text),
        rb.pass_rule ? h('p.small.muted.mt-3', {}, 'The real vote is ', h('b', {}, rb.pass_rule), '. This number is your own scoring of your own answers — useful as a trend, not as a prediction.') : null));
    wrap.appendChild(hero);

    // dimension averages
    var dimRows = res.dims.map(function (d) {
      var v = res.dimAvg[d.id];
      var w = rb.weights && isNum(rb.weights[d.id]) ? Math.round(rb.weights[d.id] * 100) : null;
      var tone = v == null ? '' : (v >= 3.5 ? '.ok' : v >= 3 ? '' : v >= 2.5 ? '.warn' : '.danger');
      return h('div.mb-dimrow' + tone, {},
        h('div.mb-dimrow-head', {},
          h('b', {}, txt(d.name)),
          w != null ? h('span.badge.neutral', {}, w + '%') : null,
          h('div.grow'),
          h('span.mb-dimrow-val.num', {}, v == null ? 'not scored' : v.toFixed(1))),
        h('div.bar', {}, h('span', { style: { width: (v == null ? 0 : util.clamp(v / 5, 0, 1) * 100) + '%' } })),
        h('div.mb-dimrow-note', {}, res.dimN[d.id] ? util.plural(res.dimN[d.id], 'question') + ' scored' : 'Not scored on any question'));
    });
    wrap.appendChild(h('section.card', {},
      h('div.card-head', {}, h('h3', {}, 'Dimension averages'), h('span.muted.small', {}, 'Weighted average shown above')),
      h('div.mb-dimrows', {}, dimRows)));

    // domains
    if (res.domains.length) {
      var weakest = res.domains[0], strongest = res.domains[res.domains.length - 1];
      var cards = [h('div.mb-dom-card.weak', {},
        h('div.eyebrow', {}, 'Weakest domain'),
        h('h3', {}, weakest.name),
        h('p', {}, 'Averaged ' + weakest.avg.toFixed(1) + ' across ' + util.plural(weakest.n, 'question') + '. Study this one before the next board.'),
        h('div.row.mt-3', {},
          h('button.btn.sm', { onclick: function () { CORB.go('library', { domain: weakest.name }); } }, icon('book'), 'Open in the library'),
          h('button.btn.sm.ghost', { onclick: function () { cfg.domains = [weakest.name]; saveCfg(); sess = null; phase = 'setup'; repaint(); } }, icon('refresh'), 'Board me on it')))];
      if (res.domains.length > 1) {
        cards.push(h('div.mb-dom-card.strong', {},
          h('div.eyebrow', {}, 'Strongest domain'),
          h('h3', {}, strongest.name),
          h('p', {}, 'Averaged ' + strongest.avg.toFixed(1) + ' across ' + util.plural(strongest.n, 'question') + '. Hold it there — boards probe what you sound confident about.')));
      }
      wrap.appendChild(h('div.mb-doms', {}, cards));
    }

    // per-question table
    var head = h('tr', {}, h('th', {}, '#'), h('th', {}, 'Question'),
      res.dims.map(function (d) { return h('th.mb-th-dim', { title: txt(d.name) }, txt(d.name).split(' ')[0]); }),
      h('th', {}, 'Avg'), h('th', {}, 'Time'), h('th', {}, ''));
    var rows = res.perQ.map(function (p) {
      var it = p.it;
      return h('tr', {},
        h('td.num', {}, String(p.n)),
        h('td', {}, h('div.mb-tq', {}, it.question || '—'), h('div.muted.small', {}, [it.id, it.domain].filter(Boolean).join(' · '))),
        res.dims.map(function (d) {
          var v = it.scores[d.id];
          return h('td.center', {}, isNum(v) ? h('span.mb-score.s' + v, {}, String(v)) : h('span.muted', {}, '–'));
        }),
        h('td.num', {}, p.avg == null ? '–' : p.avg.toFixed(1)),
        h('td.num', {}, it.used ? mmss(it.used) : '–'),
        h('td', {}, it.id ? h('button.btn.sm.ghost', { onclick: function () { CORB.go('library', { id: it.id }); } }, 'Review') : null));
    });
    wrap.appendChild(h('section.card.flush.mb-table-card', {},
      h('div.card-head.mb-table-head', {}, h('h3', {}, 'Question by question'), h('span.muted.small', {}, 'Scores you gave yourself')),
      h('div.scroll-x', {}, h('table.table.mb-table', {}, h('thead', {}, head), h('tbody', {}, rows)))));

    // notes recap
    var withNotes = sess.items.filter(function (it) { return txt(it.notes) || txt(it.answer); });
    if (withNotes.length) {
      wrap.appendChild(h('details.acc.mb-acc', {},
        h('summary', {}, icon('note'), 'What you wrote (' + withNotes.length + ')', icon('chevron', 'chev')),
        h('div.acc-body', {}, withNotes.map(function (it) {
          return h('div.mb-recap', {},
            h('div.eyebrow', {}, [it.id, it.domain].filter(Boolean).join(' · ')),
            h('div.mb-recap-q', {}, it.question),
            txt(it.answer) ? h('div.mb-recap-block', {}, h('span.eyebrow', {}, 'Your answer'), h('p.pre', {}, it.answer)) : null,
            txt(it.notes) ? h('div.mb-recap-block', {}, h('span.eyebrow', {}, 'Note to self'), h('p.pre', {}, it.notes)) : null);
        }))));
    }

    // guidance
    if (rb.numeric_guide || rb.pass_rule_detail || rb.note) {
      wrap.appendChild(h('details.acc.mb-acc', {},
        h('summary', {}, icon('scale'), 'How this indicator was worked out', icon('chevron', 'chev')),
        h('div.acc-body', {},
          rb.numeric_guide ? h('div.mb-guide', {}, h('div.eyebrow', {}, 'Numeric guide'), ui.rich(rb.numeric_guide)) : null,
          rb.pass_rule_detail ? h('div.mb-guide', {}, h('div.eyebrow', {}, 'Pass rule'), ui.rich(rb.pass_rule_detail)) : null,
          rb.note ? h('div.callout.warn.mt-3', {}, icon('alert'), h('div', {}, rb.note)) : null)));
    }

    // actions
    wrap.appendChild(h('div.mb-actions', {},
      h('button.btn.primary', { onclick: critique }, icon('chat'), 'Ask the mentor to critique'),
      h('button.btn', { onclick: exportJson }, icon('download'), 'Export session'),
      h('button.btn', { onclick: printSummary }, icon('print'), 'Print / PDF'),
      h('div.grow'),
      h('button.btn.ghost', { onclick: function () { CORB.go('dashboard'); } }, icon('bar-chart'), 'Readiness'),
      h('button.btn.gold', { onclick: function () { sess = null; phase = 'setup'; repaint(); } }, icon('refresh'), 'Run another board')));

    wrap.appendChild(h('p.mb-rail-foot.mt-5', {}, 'Recorded in your progress as a mock board. Export it to keep a copy outside this browser — storage can be wiped or switched off. No names, no PII: keep it that way if you share the file.'));
    return wrap;
  }

  function critique() {
    if (!sess) return;
    if (!CORB.views || !CORB.views.mentor) { ui.toast('The mentor is not part of this build yet', 'warn'); return; }
    CORB.go('mentor', { critique: sess.id });
  }

  function printSummary() {
    var ok = true;
    try { window.print(); } catch (e) { ok = false; }
    if (!ok) ui.toast('This browser would not open the print dialog', 'warn');
  }

  function exportJson() {
    if (!sess) return;
    var rb = rubric(), res = results(rb), m = meta();
    var payload = {
      app: txt(m.app_name) || 'Signatory', version: txt(m.version) || CORB.VERSION, kind: 'corb-mock-board', format: 'mockboard-1',
      id: sess.id, started: sess.started, finished: sess.finished, ended_early: !!sess.ended_early,
      organization: txt(sess.unit), warrant_class: sess.cfg.cls,
      settings: { questions: sess.items.length, seconds_per_answer: sess.cfg.seconds, domains: arr(sess.cfg.domains), scenarios: !!sess.cfg.scenarios, korea_items: !!sess.cfg.korea },
      rubric: { dimensions: rb.dimensions.map(function (d) { return { id: d.id, name: d.name, weight: dimWeight(rb, d.id) }; }), pass_rule: rb.pass_rule, numeric_guide: rb.numeric_guide },
      dimension_averages: res.dimAvg, overall: res.overall, indicator: res.indicator.key, indicator_label: res.indicator.label,
      domains: res.domains,
      questions: res.perQ.map(function (p) {
        return { n: p.n, id: p.it.id, domain: p.it.domain, topic: p.it.topic, kind: p.it.kind, question: p.it.question, scores: p.it.scores, average: p.avg, seconds: p.it.used, my_answer: p.it.answer, notes: p.it.notes };
      }),
      disclaimer: txt(m.disclaimer) || 'Training aid, not authoritative guidance. Self-scored practice, not a board result.'
    };
    var name = 'CORB-mockboard_class-' + String(sess.cfg.cls).replace(/[^\w-]+/g, '') + '_' + util.stamp() + '.json';
    var ok = safe(function () { return CORB.store.download(name, JSON.stringify(payload, null, 1), 'application/json'); }, false);
    ui.toast(ok ? 'Saved ' + name : 'This browser blocked the download', ok ? 'ok' : 'danger');
  }

  // ---- print sheet ---------------------------------------------------------
  function printSheet() {
    var rb = rubric(), res = results(rb), m = meta();
    var sheet = h('div.mb-print', { 'aria-hidden': 'true' });
    sheet.appendChild(h('div.mb-print-head', {},
      h('div.mb-print-kicker', {}, (txt(m.app_name) || 'Signatory') + ' · Mock board'),
      h('h1', {}, classLabel(sess.cfg.cls) + ' practice board'),
      h('div.mb-print-sub', {}, txt(sess.unit) + ' · ' + util.plural(sess.items.length, 'question') + ' · ' + sess.cfg.seconds + 's per answer · ' + util.fmtDate(sess.finished || new Date().toISOString())),
      h('div.mb-print-sub', {}, 'Self-scored. Overall ' + (res.overall == null ? 'not scored' : res.overall.toFixed(1) + ' of 5') + ' · ' + res.indicator.label)));

    sheet.appendChild(h('table.mb-print-table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Dimension'), h('th', {}, 'Average'), h('th', {}, 'Scored'))),
      h('tbody', {}, rb.dimensions.map(function (d) {
        return h('tr', {}, h('td', {}, txt(d.name)), h('td', {}, res.dimAvg[d.id] == null ? '–' : res.dimAvg[d.id].toFixed(1)), h('td', {}, String(res.dimN[d.id] || 0)));
      }))));

    res.perQ.forEach(function (p) {
      var it = p.it;
      var line = rb.dimensions.map(function (d) { return txt(d.name).split(' ')[0] + ' ' + (isNum(it.scores[d.id]) ? it.scores[d.id] : '–'); }).join(' · ');
      sheet.appendChild(h('div.mb-print-item', {},
        h('div.mb-print-meta', {}, [String(p.n), it.id, it.domain, it.topic].filter(Boolean).join(' · ')),
        h('div.mb-print-q', {}, it.question),
        h('div.mb-print-scores', {}, line + ' · average ' + (p.avg == null ? '–' : p.avg.toFixed(1)) + (it.used ? ' · ' + mmss(it.used) : '')),
        txt(it.notes) ? h('div.mb-print-note', {}, 'Note: ' + it.notes) : null));
    });
    sheet.appendChild(h('div.mb-print-foot', {}, txt(m.disclaimer) || 'Training aid, not authoritative guidance. Self-scored practice, not a board result.'));
    return sheet;
  }

  // ==================================================================
  // keyboard
  // ==================================================================
  function onKey(e) {
    if (!R.root || !document.body.contains(R.root)) return;
    if (phase !== 'run' || !sess) return;
    if (confirming) { if (!modalOpen()) confirming = false; return; }
    if (modalOpen()) return;
    var t = e.target, tag = txt(t && t.tagName).toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || !!(t && t.isContentEditable);
    if (e.key === 'Escape') { e.preventDefault(); if (typing && t.blur) t.blur(); endEarly(); return; }
    if (typing) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); next(); }
      return;
    }
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Space') {
      if (!cur().revealed) { e.preventDefault(); reveal(); }
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); next(); }
  }

  // ==================================================================
  // registration
  // ==================================================================
  CORB.registerView({
    id: 'mockboard', title: 'Mock board', icon: 'mic', section: 'Practice', order: 140, nav: true, mobile: true, short: 'Board',
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || {};
      cfg = loadCfg();
      if (phase !== 'run' && phase !== 'done') fromParams(p);
      if (phase === 'setup' && !sess) {
        var saved = loadSaved();
        if (saved && (p.resume === '1' || p.resume === 'true')) { sess = saved; phase = 'run'; }
      }
      build(root);
      if (phase === 'setup' && (p.start === '1' || p.start === 'true')) start();
      if (!keyFn) { keyFn = onKey; document.addEventListener('keydown', keyFn); }
    },
    onLeave: function () {
      holdClock();
      teardownTransient();
      persist();
      if (keyFn) { document.removeEventListener('keydown', keyFn); keyFn = null; }
      confirming = false;
      R = {};
    }
  });
})();
