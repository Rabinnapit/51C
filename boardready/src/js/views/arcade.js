/* VIEW: arcade — the Board Ready Arcade, opened full screen inside the app.
   The Arcade engine and games live in src/arcade/ and are inlined into the same file by tools/build.py.
   This view builds ARCADE.DATA from CORB_DATA (so facilitator edits carry into the games), makes the Arcade share
   the profile's warrant class with every other practice mode, and mounts or unmounts the Arcade shell. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var KO = ['I', 'II', 'III', 'IV'];
  var TRUNC = /^(DFARS|PGI|AFARS)\s+\d{1,2}$/i;
  var CITE = /^(?:RFO\s+)?(DFARS PGI|AFARS PGI|PGI|FAR|DFARS|AFARS)\s+(?:Part\s+|Subpart\s+)?(\d+)(?:\.(\d+))?(.*)$/i;

  function parseCite(c) {
    var m = CITE.exec(String(c == null ? '' : c).trim());
    return m ? { fw: m[1].toUpperCase(), part: m[2], sec: m[3] || '', rest: String(m[4] || '').replace(/\(.*$/, '').trim() } : null;
  }
  // 1: same section or subpart (a small renumber); 2: another subpart of the same part with the same numbering
  // pattern; 3: a new numbering pattern, another part, or a statute
  function crosswalkDifficulty(oldCite, newCite) {
    var a = parseCite(oldCite), b = parseCite(newCite);
    if (!a || !b || a.fw !== b.fw || a.part !== b.part) return 3;
    if (!a.sec || !b.sec || a.sec === b.sec || a.sec.charAt(0) === b.sec.charAt(0)) return 1;
    return a.rest === b.rest ? 2 : 3;
  }

  // Warrant classes for a citation pair, by the part it sits in. Simplified acquisition is Class I and II work; sealed
  // bidding and negotiation start above the SAT; multiyear, cost accounting standards, major systems and subcontracting
  // system reviews sit with the larger warrants. Every other part applies to every class, so those pairs stay untagged.
  var PART_CLASSES = { 13: ['I', 'II'], 14: ['II', 'III', 'IV'], 15: ['II', 'III', 'IV'], 30: ['III', 'IV'], 34: ['III', 'IV'], 44: ['III', 'IV'] };
  function crosswalkClasses(oldCite, newCite) {
    var c = parseCite(newCite) || parseCite(oldCite);
    if (!c) return null;
    var part = Number(c.part);
    if (c.fw.indexOf('AFARS') === 0) part -= 5100;
    else if (c.fw.indexOf('DFARS') === 0 || c.fw === 'PGI') part -= 200;
    if (part === 17 && c.sec.charAt(0) === '1') return ['III', 'IV'];     // subpart 17.1, multiyear contracting
    return PART_CLASSES[part] || null;
  }

  function arcadeData() {
    var D = CORB.DATA || {}, meta = D.meta || {}, regs = D.regulations || {};
    var questions = (CORB.data && typeof CORB.data.all === 'function') ? CORB.data.all() : (D.questions || []);
    // Every game follows the organization picker by relevance (CORB.data.relevantTo): general questions from any list,
    // never another organization's local procedures.
    var unit = 'all';
    try { unit = CORB.unit(); } catch (e) {}
    var relevant = function (q) { return !(CORB.data && typeof CORB.data.relevantTo === 'function') || CORB.data.relevantTo(q, unit); };
    var cardFits = function (c) { return !(CORB.data && typeof CORB.data.cardRelevantTo === 'function') || CORB.data.cardRelevantTo(c, unit); };
    var byId = {};
    questions.forEach(function (q) { if (q && q.id) byId[q.id] = q; });
    var games = {}, gk;
    for (gk in (D.games || {})) if (Object.prototype.hasOwnProperty.call(D.games, gk)) games[gk] = Array.isArray(D.games[gk]) ? D.games[gk].filter(cardFits) : D.games[gk];
    var qclass = {};
    questions.forEach(function (q) {
      if (!q || !q.id) return;
      var all = q.classes || [];
      qclass[q.id] = { ko: KO.filter(function (c) { return all.indexOf(c) >= 0; }) };
    });
    var mcq = [];
    (D.mcq || []).forEach(function (m) {
      if (!m) return;
      if (m.qid && byId[m.qid] && !relevant(byId[m.qid])) return;
      var info = qclass[m.qid];
      var it = {}, k;
      for (k in m) if (Object.prototype.hasOwnProperty.call(m, k)) it[k] = m[k];
      if (info && info.ko.length) it.classes = info.ko;
      mcq.push(it);
    });
    var crosswalk = (regs.crosswalk || []).filter(function (e) {
      return e && e.confidence === 'verified' && e.old && e['new'] && !TRUNC.test(String(e.old).trim()) && String(e.old).indexOf('52-245') < 0;
    }).map(function (e) {
      var pair = { old: e.old, 'new': e['new'], title: e.title || '', note: String(e.note || '').slice(0, 220), difficulty: crosswalkDifficulty(e.old, e['new']) };
      var cls = crosswalkClasses(e.old, e['new']);
      if (cls) pair.classes = cls;
      return pair;
    });
    var thresholds = (regs.thresholds || []).map(function (t) { return { id: t.id, name: t.name, value: t.value, value_number: t.value_number, applies: t.applies, cite: t.cite }; });
    // The question bank itself, for games that play the board questions and their answers (Drop Zone, Cite Express).
    var bank = questions.filter(function (q) { return q && q.id && q.question && relevant(q); }).map(function (q) {
      return { id: q.id, question: q.question, answer: q.answer || '', status: q.answer_status || '', key_points: (q.key_points || []).slice(),
        cites: ((q.citations_rfo && q.citations_rfo.length) ? q.citations_rfo : (q.citations || [])).slice(), domain: q.domain || '', topic: q.topic || '',
        kind: q.kind || 'knowledge', classes: (q.classes || []).slice(), difficulty: q.difficulty, flags: (q.flags || []).slice() };
    });
    return {
      meta: { app_name: meta.app_name, version: meta.version, built_on: meta.built_on, content_verified_on: meta.content_verified_on,
        unit: unit, unit_name: unit === 'all' ? 'All organizations' : ((D.units || []).filter(function (u) { return u && u.id === unit; }).map(function (u) { return u.short || u.name; })[0] || unit) },
      games: games, mcq: mcq, crosswalk: crosswalk, thresholds: thresholds, questions: bank
    };
  }
  CORB.arcadeData = arcadeData;

  // One warrant setting everywhere: the Arcade reads and writes profile.targetClass.
  function bridgeWarrant(A) {
    if (A.__profileWarrant) return;
    A.__profileWarrant = true;
    var base = A.warrant;
    A.warrant = function (id) {
      if (id) return base(id);
      var pc = CORB.warrantClass ? CORB.warrantClass() : '';
      return base(KO.indexOf(pc) >= 0 ? pc : 'all');
    };
    A.setWarrant = function (id) {
      var w = base(id || 'all');
      var pc = CORB.warrantClass ? CORB.warrantClass() : '';
      if (w.id === 'all') { if (KO.indexOf(pc) >= 0) CORB.set('profile.targetClass', ''); }
      else CORB.set('profile.targetClass', w.id);
      return w;
    };
  }

  CORB.registerView({
    id: 'arcade', title: 'Arcade', icon: 'gamepad', section: 'Practice', order: 160, nav: true, short: 'Arcade',
    layout: 'full', surface: 'arcade',
    render: function (root, ctx) {
      var A = window.ARCADE, h = CORB.ui.h;
      if (!A || typeof A.mount !== 'function') {
        root.appendChild(h('div.content', {}, h('div.empty', {},
          h('h3', {}, 'The Arcade did not load in this copy'),
          h('p', {}, 'Every other part of the app still works.'),
          h('button.btn.primary.mt-4', { onclick: function () { CORB.go('dashboard'); } }, 'Back to the dashboard'))));
        return;
      }
      A.DATA = arcadeData();
      bridgeWarrant(A);
      document.title = 'Arcade · ' + CORB.appName();
      A.mount(root, (ctx && ctx.params) || {});
    },
    onLeave: function () { if (window.ARCADE && typeof window.ARCADE.unmount === 'function') window.ARCADE.unmount(); }
  });

  // The old Games page became the Arcade; Board Jeopardy moved to the Board room.
  CORB.registerView({
    id: 'games', title: 'Arcade', nav: false,
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || {};
      // replace, not push, so the browser Back button does not bounce into the redirect again
      location.replace('#/' + (String(p.g || '') === 'jeopardy' && CORB.views.jeopardy ? 'jeopardy' : 'arcade'));
    }
  });
})();
