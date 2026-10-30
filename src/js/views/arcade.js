/* VIEW arcade — the B2B Arcade: seven games on the guide's own content (five in real 3D) and the campaign, opened inside the app.
   The engine and games live in src/js/arcade/ (tools/build.py inlines them after the views). This view builds ARCADE.DATA
   from CORB_DATA (question bank, key numbers, deadlines, forms, FAR parts, UCF, PIID letters, glossary, sorting sets),
   points the Arcade's storage at the reader's progress (progress.arcade, saved into the file like everything else),
   records missed bank questions for Practice test, and ticks Exam path game tasks. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var PHASE_COLORS = { gp: '#a3a9f2', pre: '#82b6ef', awd: '#f0b863', post: '#6fd3d9', job: '#d1bfa6' };
  var SETTINGS = ['tier', 'mute', 'music'];
  var built = null, builtFor = '';

  function tidy(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function deck(id) { return ((CORB.DATA.cards || []).filter(function (d) { return d.id === id; })[0] || { cards: [] }).cards || []; }
  function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ---- facts: a short prompt and a short answer label, with decoys drawn from the same family ----
  var DOLLAR_D = { mpt: 1, sat: 1, sap: 2, notice: 2, 'tina-far': 2, announce: 2, 'mpt-cus': 2, 'mpt-cos': 2, 'claim-cert': 2, 'tina-dow': 3, 'sat-cus': 3, 'sat-cos': 3, 'subk-plan': 3, 'order-protest': 3 };
  var DAYS_D = { 'protest-sol': 1, 'protest-10': 1, 'gao-decide': 1, cure: 1, 'claim-submit': 1, 'prompt-pay': 1, 'cert-grace': 1, 'protest-5': 2, 'agency-protest': 2, 'award-notice': 2, 'debrief-req': 2, 'debrief-hold': 2, 'stop-work': 2, 'changes-assert': 2, 'claim-decide': 2, 'appeal-board': 2, 'appeal-cofc': 2, 'close-ffp': 2, 'exam-window': 2, 'close-rates': 3, 'close-other': 3 };
  var FORM_D = { sf26: 1, sf30: 1, sf33: 1, sf1449: 1, sf44: 1, sf1442: 2, sf1409: 2, sf1402: 2, dd1155: 2, dd254: 2, dd1547: 3, dd1861: 3, dd1597: 3, dd1594: 3 };
  var UCF_D = { b: 1, c: 1, i: 1, l: 1, m: 1, a: 2, e: 2, f: 2, h: 2, k: 2, d: 3, g: 3, j: 3 };
  var PIID_D = { pa: 1, pc: 1, pd: 1, pf: 1, pp: 1, pb: 2, pq: 2, pr: 2, pg: 3, ph: 3, pl: 3, py: 3 };
  var TYPE_FAMILY = { FFP: 'fp', 'FP-EPA': 'fp', FPIF: 'fp', CPFF: 'cr', CPAF: 'cr', CPIF: 'cr', IDIQ: 'id', 'Requirements contract': 'id', 'T&M': 'other', 'Letter contract': 'other' };
  var TYPE_D = { FFP: 1, CPFF: 1, 'T&M': 1, IDIQ: 1, BPA: 2, 'FP-EPA': 2, FPIF: 2, CPAF: 2, CPIF: 2, 'Requirements contract': 2, 'Letter contract': 2 };
  var TYPE_WHY = { fp: 'a fixed-price type: the contractor carries most of the cost risk', cr: 'a cost-reimbursement type: the Government pays allowable costs, so it carries more of the cost risk',
    id: 'an indefinite-delivery type: orders are placed as the needs arise', other: 'neither fixed-price nor cost-reimbursement: hourly rates plus materials, used only with a ceiling price',
    letter: 'a preliminary instrument that lets work start before the terms are agreed; it must be definitized' };

  function cap(s) { s = tidy(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  // "Negotiated awards ... (15.207-1)." -> FAR 15.207-1; "FAR 1.403-2." -> FAR 1.403-2
  function citeIn(s, fallback) {
    var m = /\bFAR\s+(\d+\.[\d\-]+(?:\([a-z0-9]+\))*)/i.exec(s || '') || /\((\d+\.\d+[\d\-]*(?:\([a-z0-9]+\))*)\)/i.exec(s || '');
    return m ? 'FAR ' + m[1] : fallback;
  }

  function facts() {
    var F = CORB.DATA.far || {}, out = [];
    (F.numbers || []).forEach(function (n) {
      if (/^ja-/.test(n.id)) {
        var who = tidy(String(n.name).replace(/^J&A approval:\s*/i, '').replace(/\s*\(DoW\)\s*$/i, '')), v = tidy(n.value);
        out.push({ id: 'ja:' + n.id, fam: 'ja', prompt: 'Who approves a DoW J&A for ' + v.charAt(0).toLowerCase() + v.slice(1) + '?', answer: cap(who), why: tidy(n.plain || ''), cite: n.cite || '', d: n.id === 'ja-ko' ? 1 : 2 });
        return;
      }
      var m = /\$[\d.,]+(?:\s*(?:million|billion))?/i.exec(n.value || '');
      if (!m || !DOLLAR_D[n.id]) return;
      out.push({ id: 'usd:' + n.id, fam: 'dollars', prompt: tidy(n.q || n.name), answer: m[0], full: n.value, why: tidy(n.plain || ''), cite: n.cite || '', d: DOLLAR_D[n.id] });
    });
    (F.deadlines || []).forEach(function (n) {
      if (!DAYS_D[n.id]) return;
      var label = tidy(String(n.value || '').replace(/^(at least|up to)\s+/i, ''));
      out.push({ id: 'day:' + n.id, fam: 'days', prompt: tidy(n.q || n.name), answer: cap(label), full: n.value, why: tidy(n.plain || ''), cite: n.cite || '', d: DAYS_D[n.id] });
    });
    deck('b2b-forms').forEach(function (c) { if (FORM_D[c.id]) out.push({ id: 'form:' + c.id, fam: 'form', prompt: tidy(c.back), answer: tidy(c.front), why: tidy(c.front) + ' is the ' + tidy(c.back) + '. ' + tidy(c.more || ''), cite: citeIn(c.more, 'FAR Part 53'), d: FORM_D[c.id] }); });
    deck('b2b-ucf').forEach(function (c) { if (UCF_D[c.id]) out.push({ id: 'ucf:' + c.id, fam: 'ucf', prompt: tidy(c.back), answer: c.id.toUpperCase(), sub: tidy(c.more || ''), why: 'Section ' + c.id.toUpperCase() + ' is ' + tidy(c.back).toLowerCase() + '. ' + tidy(c.more || ''), cite: 'FAR 15.109', d: UCF_D[c.id] }); });
    deck('b2b-piid').forEach(function (c) { if (PIID_D[c.id]) out.push({ id: 'piid:' + c.id, fam: 'piid', prompt: tidy(c.back), answer: c.id.slice(1).toUpperCase(), why: 'Position 9 of a PIID is ' + c.id.slice(1).toUpperCase() + ' for ' + tidy(c.back).toLowerCase() + '. ' + tidy(c.more || ''), cite: 'FAR 4.201', d: PIID_D[c.id] }); });
    deck('contract-types').forEach(function (c) {
      var back = tidy(c.back), m = /\(([A-Z][A-Z&-]+)\)/.exec(back), label = m ? m[1] : tidy(back.replace(/\s*\(.*$/, ''));
      if (!TYPE_D[label]) return;
      out.push({ id: 'type:' + c.id, fam: 'type', prompt: tidy(c.front), answer: label, full: back, why: back + '. ' + tidy(c.more || ''), cite: 'FAR Part 16', d: TYPE_D[label], family: TYPE_FAMILY[label] || '' });
    });
    (F.parts || []).forEach(function (p) { if (!/^reserved$/i.test(tidy(p.title))) out.push({ id: 'part:' + p.n, fam: 'part', prompt: tidy(p.title), answer: 'Part ' + p.n, n: p.n, why: tidy(p.plain || ''), cite: 'FAR Part ' + p.n, d: p.exam ? 1 : 3, exam: !!p.exam }); });
    return out;
  }

  // ---- glossary terms with the term hidden in its own definition ----
  function terms() {
    return CORB.data.glossary().map(function (g) {
      var term = tidy(g.term), exp = tidy(g.expansion || ''), def = tidy(g.definition || ''), clue = def;
      [term, exp].concat(g.alias || []).filter(function (w) { return w && w.length > 1; }).sort(function (a, b) { return b.length - a.length; }).forEach(function (w) {
        clue = clue.replace(new RegExp('(^|[^\\w])' + esc(w) + '(?=$|[^\\w])', 'gi'), '$1____');
      });
      var acronym = /^[A-Z0-9&().\/-]{2,10}$/.test(term) && /[A-Z]/.test(term);
      var d = acronym && exp ? 1 : /^(Systems|Contingency|Pricing|Training and career)$/.test(g.cat || '') ? 3 : 2;
      return { id: 'term:' + term, term: term, expansion: exp, clue: clue, cat: g.cat || '', d: d, acronym: acronym };
    }).filter(function (t) { return t.clue.length >= 30 && t.term.length <= 34; });
  }

  // ---- sorting lines for Sort Yard ----
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function dollarItems(mpt, sat) {
    var buys = ['toner cartridges', 'folding tables', 'safety boots', 'laptop docks', 'generator parts', 'office chairs', 'barracks mattresses', 'radio batteries', 'vehicle tires', 'training ammunition cans', 'portable latrines rental', 'copier lease', 'tactical flashlights', 'shelving units', 'conference room displays', 'water purification filters'];
    var out = [], b = A_shuffle(buys);
    function add(v, d, i) {
      var bin = v <= mpt ? 'mp' : v <= sat ? 'sap' : 'above';
      var why = bin === 'mp' ? money(v) + ' does not exceed the ' + money(mpt) + ' micro-purchase threshold.' : bin === 'sap' ? money(v) + ' is above the ' + money(mpt) + ' micro-purchase threshold and at or below the ' + money(sat) + ' SAT.' : money(v) + ' is above the ' + money(sat) + ' simplified acquisition threshold.';
      out.push({ id: 'usd-' + v, text: cap(b[i % b.length]) + ' · ' + money(v), bin: bin, why: why, cite: 'FAR 2.101', d: d });
    }
    [2480, 7350, 11900, 640].forEach(function (v, i) { add(v, 1, i); });
    [48200, 126000, 212500, 31800].forEach(function (v, i) { add(v, 1, i + 4); });
    [880000, 2400000, 615000, 5100000].forEach(function (v, i) { add(v, 1, i + 8); });
    [mpt, mpt + 1, sat, sat + 1, mpt - 1, sat - 1].forEach(function (v, i) { add(v, 3, i + 12); });
    return out;
  }
  function A_shuffle(a) { return CORB.util.shuffle(a); }
  function sorts() {
    var G = CORB.DATA.games || {}, F = CORB.DATA.far || {}, num = {};
    (F.numbers || []).forEach(function (n) { var m = /\$([\d,]+)(?!\s*million)/.exec(n.value || ''); if (m) num[n.id] = +m[1].replace(/,/g, ''); });
    var mpt = num.mpt || 15000, sat = num.sat || 350000, ph = {};
    CORB.data.phases().forEach(function (p) { ph[p.id] = p; });
    var lines = [];
    lines.push({ id: 'phase', title: 'Contract life cycle', ask: 'Which phase does this task belong to?', bins: ['pre', 'awd', 'post'].map(function (id) { return { id: id, label: (ph[id] || {}).name || id, color: PHASE_COLORS[id] }; }),
      items: (G.phase_sort || []).map(function (t, i) { return { id: 'ph-' + i, text: tidy(t.task), bin: t.answer, why: tidy(t.why || ''), cite: '', d: 1 }; }) });
    lines.push({ id: 'dollars', title: 'Dollar thresholds', ask: 'Which buying lane does this purchase of supplies fall in?', bins: [{ id: 'mp', label: 'Micro-purchase', sub: 'up to ' + money(mpt), color: '#5fd39a' }, { id: 'sap', label: 'Simplified', sub: 'up to ' + money(sat), color: '#8cc8ff' }, { id: 'above', label: 'Above the SAT', sub: 'over ' + money(sat), color: '#ffa552' }], items: dollarItems(mpt, sat) });
    var ucfBin = { a: 'I', b: 'I', c: 'I', d: 'I', e: 'I', f: 'I', g: 'I', h: 'I', i: 'II', j: 'III', k: 'IV', l: 'IV', m: 'IV' };
    lines.push({ id: 'ucf', title: 'Uniform Contract Format', ask: 'Which part of the UCF holds this section?', bins: [{ id: 'I', label: 'Part I', sub: 'The Schedule', color: '#e6b85a' }, { id: 'II', label: 'Part II', sub: 'Clauses', color: '#82b6ef' }, { id: 'III', label: 'Part III', sub: 'Attachments', color: '#b98cff' }, { id: 'IV', label: 'Part IV', sub: 'Reps & instructions', color: '#6fd3d9' }],
      items: deck('b2b-ucf').filter(function (c) { return ucfBin[c.id]; }).map(function (c) { var L = c.id.toUpperCase(), bin = ucfBin[c.id]; return { id: 'ucf-' + c.id, text: tidy(c.back), bin: bin, why: 'Section ' + L + ' (' + tidy(c.back) + ') is in Part ' + bin + '. ' + tidy(c.more || ''), cite: 'FAR 15.109', d: UCF_D[c.id] }; }) });
    lines.push({ id: 'types', title: 'Contract types', ask: 'Which family does this contract type belong to?', bins: [{ id: 'fp', label: 'Fixed-price', color: '#5fd39a' }, { id: 'cr', label: 'Cost-reimbursement', color: '#ffa552' }, { id: 'id', label: 'Indefinite delivery', color: '#8cc8ff' }, { id: 'other', label: 'T&M or letter', color: '#ff7ab6' }],
      items: facts().filter(function (f) { return f.fam === 'type' && f.family; }).map(function (f) { return { id: 'ty-' + f.id, text: f.prompt, bin: f.family, why: f.full + ' is ' + TYPE_WHY[f.answer === 'Letter contract' ? 'letter' : f.family] + '.', cite: 'FAR Part 16', d: f.d }; }) });
    return lines.filter(function (l) { return l.items.length >= 6; });
  }

  function buildData() {
    var meta = CORB.meta();
    var key = (meta.build_id || '') + ':' + CORB.data.questions().length;
    if (built && builtFor === key) return built;
    var phases = CORB.data.phases().map(function (p) { return { id: p.id, name: p.name, short: p.short || p.name, color: PHASE_COLORS[p.id] }; });
    phases.push({ id: 'job', name: 'On the job', short: 'On the job', color: PHASE_COLORS.job });
    built = {
      meta: { app_name: CORB.appName(), version: meta.version, content_verified_on: meta.content_verified_on },
      bank: CORB.data.questions().map(function (q) { return { id: q.id, phase: q.phase, lesson: q.lesson, d: q.d || 2, stem: q.stem, cite: q.cite || '', options: (q.options || []).map(function (o) { return { text: o.text, correct: !!o.correct, why: o.why || '' }; }) }; }),
      phases: phases, facts: facts(), terms: terms(), sorts: sorts(),
      quick: [
        { title: 'FAR Part Match', sub: 'Part numbers to titles', href: '#/games?game=farmatch' },
        { title: 'Which phase?', sub: 'Tasks to the life cycle', href: '#/games?game=phase' },
        { title: 'Threshold check', sub: 'Which rules apply', href: '#/games?game=threshold' },
        { title: 'Who carries the risk?', sub: 'Contract types in order', href: '#/games?game=risk' }
      ]
    };
    builtFor = key;
    return built;
  }

  function path(k) { return (SETTINGS.indexOf(k) >= 0 ? 'settings.arcade.' : 'progress.arcade.') + k; }
  function connect(A) {
    A.host = {
      get: function (k) { return CORB.get(path(k)); },
      set: function (k, v, quiet) { CORB.set(path(k), v, quiet ? { silent: true } : undefined); },
      speak: CORB.speech && CORB.speech.available ? function (t) { CORB.speech.speak(t); } : null,
      stopSpeak: function () { if (CORB.speech && CORB.speech.speaking) CORB.speech.stop(); },
      onAnswer: function (qid, ok) { if (CORB.data.question(qid)) CORB.scoring.recordAnswer(qid, ok); },
      onRunEnd: function (s) {
        var g = CORB.get('progress.games.' + s.game) || { plays: 0, best: null };
        g.plays = (g.plays || 0) + 1; g.last = s.score; if (g.best == null || s.score > g.best) g.best = s.score;
        CORB.set('progress.games.' + s.game, g); CORB.touch('arcade-' + s.game);
        if (s.path && s.total >= 3) CORB.emit('path-quiz', { id: s.path, pct: s.pct });
      },
      lessonHref: function (id) { var l = CORB.data.lesson(id); return l ? { href: '#/lesson?id=' + encodeURIComponent(id), title: l.title } : null; },
      pathHref: function () { return '#/path'; },
      playing: function () {}
    };
  }

  CORB.registerView({
    id: 'arcade', title: 'Arcade', section: 'Practice', icon: 'gamepad', nav: true, order: 90, full: true, mobileAs: 'quiz',
    blurb: 'Seven games, five in real 3D: a rifle range, a supply convoy, artillery, a space shooter, a dispatch yard, RPG boss battles and a pop-up range, plus the twelve-chapter campaign Your first year as a 51C',
    keywords: 'game games arcade play quest battle boss supply line convoy checkpoint challenge coin fire mission artillery range qualification shooter sort yard dispatch FAR parts thresholds glossary campaign chapter master gunner mentor',
    render: function (root, ctx) {
      var A = window.ARCADE, h = CORB.ui.h;
      if (!A || typeof A.mount !== 'function') {
        root.appendChild(h('div.empty', {}, h('h3', {}, 'The Arcade did not load in this copy'), h('p', {}, 'Every other part of the guide still works.'), h('a.btn.primary.mt-4', { href: '#/games' }, 'Quick drills')));
        return;
      }
      A.DATA = buildData();
      connect(A);
      A.mount(root, (ctx && ctx.params) || {});
      CORB.touch('arcade');
    },
    onLeave: function () { if (window.ARCADE && typeof window.ARCADE.unmount === 'function') window.ARCADE.unmount(); }
  });
})();
