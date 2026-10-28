/* HELPER explain — picture-first versions of the official documents (exam journey, retakes, grace period, CON 7300V,
   career model, continuous learning, reciprocity, OJT tool, warrants). Content lives in official.json "explain";
   Certification 101 and Official documents both draw from here. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var X = CORB.explain = {};
  function E() { return (CORB.DATA.official || {}).explain || {}; }
  function h() { return CORB.ui.h.apply(null, arguments); }
  function icon(n, c) { return CORB.ui.icon(n, c); }

  // ---- pictograms: 64-unit drawings. s = ink outline, w = paper fill, f = owner colour, o = owner-colour line,
  //      k = light line on owner colour, t / tk = dark / light text. The owner colour comes from an .own-* class. ----
  var PIC = {
    ready: '<circle class="f" cx="26" cy="20" r="9"/><path class="f" d="M10 52c0-10 7-17 16-17s16 7 16 17z"/><circle class="w s" cx="45" cy="42" r="10"/><path class="o" d="M40.5 42l3.2 3.2 6-6"/>',
    apply: '<rect class="w s" x="11" y="12" width="42" height="29" rx="3"/><path class="w s" d="M6 48h52l-5-7H11z"/><path class="s" d="M18 20h20M18 26h26M18 32h14"/><rect class="f" x="38" y="30" width="10" height="6" rx="2"/>',
    approve: '<rect class="w s" x="12" y="7" width="30" height="42" rx="3"/><path class="s" d="M18 16h18M18 23h18M18 30h10"/><circle class="f" cx="44" cy="44" r="11"/><path class="k" d="M39 44l3.5 3.5 6.5-6.5"/>',
    sync: '<rect class="w s" x="7" y="12" width="19" height="40" rx="3"/><rect class="w s" x="38" y="12" width="19" height="40" rx="3"/><path class="s" d="M12 20h9M12 27h9M43 20h9M43 27h9"/><path class="o" d="M28 36h8m-3-3l3 3-3 3M36 46h-8m3-3l-3 3 3 3"/>',
    mail24: '<rect class="w s" x="6" y="14" width="40" height="28" rx="3"/><path class="s" d="M6 17l20 14 20-14"/><circle class="f" cx="46" cy="44" r="12"/><path class="k" d="M46 37v7l4.5 2.5"/>',
    book: '<rect class="w s" x="9" y="12" width="46" height="42" rx="4"/><path class="f" d="M9 16a4 4 0 0 1 4-4h38a4 4 0 0 1 4 4v8H9z"/><path class="s" d="M20 7v9M44 7v9"/><text class="t" x="32" y="47">90</text>',
    center: '<path class="w s" d="M9 54V25l23-13 23 13v29z"/><path class="s" d="M17 54V33M25 54V33M39 54V33M47 54V33M6 54h52"/><rect class="f" x="28" y="40" width="8" height="14"/><path class="s" d="M32 12V4"/><path class="f" d="M32 4h11l-3 3.5 3 3.5H32z"/>',
    online: '<rect class="w s" x="9" y="10" width="46" height="32" rx="3"/><circle class="f" cx="32" cy="23" r="5.5"/><path class="f" d="M22 40c0-6.5 4.5-10 10-10s10 3.5 10 10z"/><circle class="s" cx="32" cy="13.5" r="1"/><path class="w s" d="M5 49h54l-4-7H9z"/>',
    confirm: '<rect class="w s" x="6" y="14" width="40" height="28" rx="3"/><path class="s" d="M6 17l20 14 20-14"/><circle class="f" cx="46" cy="44" r="12"/><path class="k" d="M40.5 44l3.7 3.7 7-7"/>',
    remind: '<path class="w s" d="M18 42V29a13 13 0 0 1 26 0v13l5 6H13z"/><path class="s" d="M26 52a5 5 0 0 0 10 0"/><circle class="f" cx="47" cy="17" r="10"/><text class="tk" x="47" y="22">2</text>',
    testday: '<rect class="w s" x="10" y="7" width="32" height="46" rx="3"/><circle class="s" cx="18" cy="17" r="2.5"/><circle class="f" cx="18" cy="26" r="3"/><circle class="s" cx="18" cy="35" r="2.5"/><path class="s" d="M25 17h11M25 26h11M25 35h11"/><circle class="w s" cx="45" cy="45" r="12"/><path class="o" d="M45 38v7l4.5 3"/>',
    score: '<rect class="w s" x="9" y="6" width="46" height="52" rx="3"/><path class="s" d="M16 14h20"/><rect class="f" x="16" y="21" width="26" height="6" rx="2"/><rect class="f" x="16" y="30" width="33" height="6" rx="2"/><rect class="f" x="16" y="39" width="27" height="6" rx="2"/><rect class="f" x="16" y="48" width="24" height="6" rx="2"/>',
    records: '<path class="w s" d="M8 15v30c0 3 6 5.5 14 5.5s14-2.5 14-5.5V15"/><path class="s" d="M8 30c0 3 6 5.5 14 5.5S36 33 36 30"/><ellipse class="w s" cx="22" cy="15" rx="14" ry="5"/><path class="o" d="M40 32h14m-4-4l4 4-4 4"/>',
    pass: '<rect class="w s" x="10" y="7" width="34" height="46" rx="3"/><path class="s" d="M17 17h20M17 24h20M17 31h13"/><circle class="f" cx="44" cy="44" r="12"/><path class="k" d="M38.5 44l3.7 3.7 7-7"/>',
    fail: '<rect class="w s" x="8" y="10" width="32" height="42" rx="3"/><path class="s" d="M14 20h20M14 27h20M14 34h12"/><circle class="f" cx="45" cy="43" r="13"/><text class="tk" x="45" y="48">30</text>',
    help: '<path class="w s" d="M7 10h50v32H27l-11 10V42H7z"/><text class="t" x="32" y="33">@</text>',
    idcard: '<rect class="w s" x="5" y="13" width="54" height="38" rx="4"/><circle class="f" cx="21" cy="28" r="6"/><path class="f" d="M11 44c0-6.5 4.5-9.5 10-9.5s10 3 10 9.5z"/><path class="s" d="M37 25h15M37 32h15M37 39h10"/>',
    h48: '<circle class="w s" cx="32" cy="32" r="24"/><path class="o" d="M32 12v4M32 48v4M12 32h4M48 32h4"/><text class="t" x="32" y="37">48h</text>',
    cancel: '<rect class="w s" x="9" y="12" width="46" height="42" rx="4"/><path class="f" d="M9 16a4 4 0 0 1 4-4h38a4 4 0 0 1 4 4v8H9z"/><path class="s" d="M20 7v9M44 7v9"/><path class="o" d="M26 32l12 12M38 32L26 44"/>',
    hand: '<circle class="f" cx="28" cy="18" r="8"/><path class="f" d="M12 52c0-9 7-15 16-15s16 6 16 15z"/><circle class="w s" cx="47" cy="42" r="10"/><path class="o" d="M42 42h10M47 37v10"/>'
  };
  X.pic = function (name, cls) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 64 64'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = PIC[name] || '';
    return h('span.pic' + (cls ? '.' + cls : ''), {}, s);
  };
  function chip(c) { return h('span.xchip', {}, icon(c[0]), c[1]); }
  function chips(list) { return list && list.length ? h('div.xchips', {}, list.map(chip)) : null; }
  function tiles(list, cls) { return h('div.xtiles' + (cls ? '.' + cls : ''), {}, (list || []).map(function (t) { return h('div.xtile', {}, h('span.xtile-ic', {}, icon(t[0])), h('b', {}, t[1]), h('span', {}, t[2])); })); }
  function owner(id) { var o = (E().owners || []).filter(function (w) { return w.id === id; })[0]; return o ? o.label : id; }
  function ref(n) { return n ? h('span.stop-ref', { title: 'The step number in the official roadmap and flowchart' }, 'Official step ' + n) : null; }

  // a button that opens an official document's real pages (or its page when it is not stored in the file)
  X.docButton = function (id, label) {
    var d = CORB.official && CORB.official.doc(id); if (!d) return null;
    var n = CORB.official.pageCount(id);
    return h('a.btn.sm.doc-btn', { href: '#/official?doc=' + id + '&show=official' }, icon('file'), label || d.title, n ? h('span.doc-btn-n', {}, n + (n > 1 ? ' pages' : ' page')) : null);
  };

  // ---- the CON 3990V roadmap and flowchart as a picture road ----
  X.legend = function () { return h('div.own-legend', {}, (E().owners || []).map(function (w) { return h('span.own-key.own-' + w.id, {}, h('i'), w.label); })); };
  X.journey = function () {
    var J = E().journey || {};
    var say = (J.steps || []).map(function (s) { return 'Step ' + s.n + '. ' + s.title + '. ' + s.line; }).join(' ');
    var road = h('ol.road', {}, (J.steps || []).map(function (s) {
      return h('li.stop.own-' + s.owner, {}, X.pic(s.pic),
        h('div.stop-body', {},
          h('div.stop-top', {}, h('span.stop-n', {}, String(s.n)), h('h3', {}, s.title), h('span.stop-who', {}, owner(s.owner))),
          h('p', {}, s.line), chips(s.chips),
          s.choice ? h('div.jchoice', {}, (J.choice || []).map(function (c, i) {
            return h('div.jchoice-card' + (i ? '' : '.best'), {}, X.pic(c.pic, i ? 'own-pearson' : 'own-ok'), h('div', {}, h('div.row.tight', {}, h('b', {}, c.title), CORB.ui.badge(i ? 'warn' : 'ok', c.tag)), h('p', {}, c.line)));
          })) : null,
          s.no ? h('div.stop-no', {}, icon('x'), h('span', {}, s.no)) : null,
          ref(s.official)));
    }));
    function end(c, cls) { return c ? h('div.end.' + cls, {}, X.pic(c.pic, cls), h('div', {}, h('h3', {}, c.title), h('ul.end-list', {}, (c.lines || []).map(function (l) { return h('li', {}, l); })), ref(c.official))) : null; }
    return h('div.journey', {},
      h('div.journey-head', {}, X.legend(), CORB.ui.listenBtn(function () { return say; }, 'Listen')),
      road,
      h('div.fork', { role: 'group', 'aria-label': 'After the result' }, end(J.pass, 'own-ok'), end(J.fail, 'own-bad')),
      end(J.help, 'own-info'));
  };
  X.flow = function () {
    var f = (E().journey || {}).flow || [];
    function row(label, list, note) { return h('div.dflow-row', {}, h('span.dflow-label', {}, label), h('div.dflow-chain', {}, list.map(function (n, i) { return [i ? icon('arrow-right') : null, h('span.dnode', {}, n)]; })), h('span.dflow-note', {}, note)); }
    return h('div.dflow', {}, row('Your request', f, 'daily'), row('Your result', f.slice().reverse(), 'daily and nightly'));
  };
  X.rules = function () {
    var K = { ok: 'check', warn: 'alert', danger: 'x' };
    return h('div.rules', {}, ((E().journey || {}).rules || []).map(function (r) {
      return h('div.rule', {}, X.pic(r.pic, 'own-rule'), h('div', {}, h('h4', {}, r.title), r.line ? h('p', {}, r.line) : null,
        r.items ? h('ul.rule-items', {}, r.items.map(function (it) { return h('li.ri-' + it[0], {}, icon(K[it[0]] || 'dot'), h('span', {}, it[1])); })) : null));
    }));
  };

  // ---- the exam at a glance (cert.json exam.facts) and the 150 questions as one bar ----
  X.examFacts = function () {
    var F = ((CORB.DATA.cert || {}).exam || {}).facts || [];
    return h('div.bigfacts', {}, F.map(function (f) { return h('div.bigfact', {}, h('span.bf-ic', {}, icon(f.icon || 'info')), h('div.bf-v', {}, f.v), h('div.bf-k', {}, f.k), f.note ? h('div.bf-n', {}, f.note) : null); }));
  };
  X.blueprint = function () {
    var P = CORB.data.phases(), total = P.reduce(function (a, p) { return a + (p.qs || 0); }, 0);
    return h('div.bpx', {},
      h('div.bpx-bar', { role: 'img', 'aria-label': P.map(function (p) { return p.name + ' ' + p.qs + ' questions'; }).join(', ') }, P.map(function (p) {
        return h('span.ph-' + p.id, { style: { flexGrow: String(p.qs) } }, h('b', {}, String(p.qs)), h('em', {}, p.short));
      })),
      h('div.bpx-total.small.muted', {}, total + ' questions · each phase\'s share of the exam'),
      h('div.bpx-cols', {}, P.map(function (p) {
        return h('div.bpx-col', {}, h('div.bpx-h', {}, h('span.phase-dot.ph-' + p.id), p.code + ' ' + p.name),
          (p.items || []).map(function (it) { return h('div.bpx-it', {}, h('i.ph-' + p.id, { style: { width: Math.round(it.qs / 18 * 100) + '%' } }), h('span', {}, it.name), h('b.num', {}, String(it.qs))); }));
      })));
  };

  // ---- retakes ----
  X.attempts = function () {
    var A = E().attempts || {};
    return h('div.attempts', {}, chips(A.chips),
      h('div.att-rows', {}, (A.rows || []).map(function (r) {
        var four = r.kind === 'next';
        return h('div.att.att-' + r.kind, {}, h('div.att-try', {}, icon(four ? 'refresh' : 'x'), h('b', {}, four ? 'Try 4?' : 'Failed try ' + r.try)),
          h('div.att-body', {}, r.must ? h('div.att-line.must', {}, h('em', {}, 'Must'), h('span', {}, r.must)) : null,
            r.should ? h('div.att-line', {}, h('em', {}, four ? 'When' : 'Should'), h('span', {}, r.should)) : null));
      })),
      A.note ? h('p.small.muted.mt-3', {}, A.note) : null);
  };

  // ---- the 36-month grace period ----
  X.grace = function () {
    var G = E().grace || {}, n = G.months || 36, goal = G.goal || 6;
    function at(m) { return (m / n * 100) + '%'; }
    return h('div.grace', {},
      h('div.grace-ends', {}, h('span', {}, icon('flag'), G.start), h('span', {}, G.end, icon('certificate'))),
      h('div.grace-bar', { role: 'img', 'aria-label': n + ' months. Unit goal: month ' + goal + '. Experience: 12 months.' },
        h('span.gb-goal', { style: { width: at(goal) } }), h('span.gb-exp', { style: { left: at(goal), width: at(12 - goal) } }),
        h('span.gb-mark', { style: { left: at(goal) } }), h('span.gb-mark', { style: { left: at(12) } })),
      h('div.grace-ticks', {}, [0, goal, 12, 24, n].map(function (m) { return h('span', { style: { left: at(m) } }, m ? m + ' mo' : 'Day 1'); })),
      h('div.grace-key', {}, h('span', {}, h('i.k-goal'), G.goalLabel), h('span', {}, h('i.k-exp'), '12 months of experience'), h('span', {}, h('i.k-all'), 'Deadline: month ' + n)),
      h('div.grace-cards', {}, (G.cards || []).map(function (c) { return h('div.gcard.k-' + c.kind, {}, icon(c.icon), h('div', {}, h('b', {}, c.title), h('span', {}, c.line))); })));
  };

  // ---- CON 7300V (FY27 change) ----
  X.fy27 = function () {
    var F = E().fy27 || {}, chain = F.chain || [];
    return h('div.fy27', {},
      h('div.xchain', {}, chain.map(function (c, i) { return [i ? icon('arrow-right', 'xchain-arrow') : null, h('span.xnode' + (i === 1 ? '.new' : ''), {}, i === 1 ? h('em', {}, 'New') : null, h('b', {}, c))]; })),
      tiles(F.tiles), tiles(F.cases, 'soft'));
  };

  // ---- what certification takes (iCatalog standard) ----
  X.requirements = function () {
    var R = E().requirements || {};
    return h('div', {}, tiles(R.tiles, 'big'), h('div.card.flow-card.mt-4', {}, CORB.courseFlow ? CORB.courseFlow() : null));
  };

  // ---- the competency model as one picture ----
  X.competency = function () {
    var P = CORB.data.phases(), gp = P.filter(function (p) { return p.id === 'gp'; })[0], life = P.filter(function (p) { return p.id !== 'gp'; });
    return h('div.compx', {},
      gp ? h('div.compx-roof.ph-' + gp.id, {}, h('b', {}, gp.code + ' ' + gp.name), h('span', {}, 'Apply in every phase'), h('div.compx-items', {}, (gp.items || []).map(function (it) { return h('span', {}, it.code + ' ' + it.name); }))) : null,
      h('div.compx-phases', {}, life.map(function (p, i) {
        return [i ? icon('arrow-right', 'compx-arrow') : null, h('div.compx-ph.ph-' + p.id, {}, h('b', {}, p.code + ' ' + p.name), h('div.compx-items', {}, (p.items || []).map(function (it) { return h('span', {}, it.code + ' ' + it.name); })))];
      })),
      h('p.small.muted.mt-3', {}, 'Each competency breaks into job tasks, for example 2.1.1.2 Conduct Market Research. The official table lists them all.'));
  };

  // ---- the Career Field Model ----
  X.career = function () {
    var C = E().career || {};
    return h('div.careerx', {},
      h('div.chevrons', {}, (C.stages || []).map(function (s, i) { return h('div.chev.chev-' + i, {}, h('b', {}, s.title), h('ul', {}, s.jobs.map(function (j) { return h('li', {}, j); }))); }),
        C.top ? h('div.chev-top', {}, icon('star'), h('b', {}, C.top)) : null),
      h('div.careerx-cap.small.muted', {}, icon('arrow-right'), 'More responsibility over your career'),
      tiles(C.rails, 'soft'));
  };

  // ---- continuous learning ----
  X.cl = function () {
    var L = E().cl || {};
    return h('div.clx', {},
      h('div.clx-top', {},
        h('div.clx-ring', { role: 'img', 'aria-label': L.total + ' hours every ' + L.years + ' years, at least ' + L.contracting + ' on contracting' }, h('b', {}, String(L.total)), h('span', {}, 'hours every ' + L.years + ' years'), h('em', {}, L.goal)),
        h('div.clx-facts', {}, (L.facts || []).map(function (f) { return h('div.clx-fact', {}, icon(f[0]), h('div', {}, h('b', {}, f[1]), h('span', {}, f[2]))); }))),
      h('h4.mt-4', {}, 'What counts, and the limits in each 2 years'),
      h('div.clx-kinds', {}, (L.kinds || []).map(function (k) { return h('div.clx-kind', {}, h('div.row.between', {}, h('b', {}, k.title), h('span.badge.brass', {}, k.rule)), h('div.clx-bar', {}, h('i', { style: { width: k.pct + '%' } })), h('p.small.muted', {}, k.eg)); })),
      h('h4.mt-4', {}, 'Points your certification courses earn'),
      h('div.xchips', {}, (L.courses || []).map(function (c) { return h('span.xchip.pts', {}, h('b.mono', {}, c[0]), h('span.num', {}, c[1] + ' pts')); })),
      L.source ? h('p.tiny.muted.mt-3', {}, L.source) : null);
  };

  // ---- reciprocity, the OJT tool and warrants ----
  X.reciprocity = function () {
    var R = E().reciprocity || {};
    return h('div', {}, h('div.recip', {}, h('span.recip-side', {}, icon('shield'), R.left), h('span.recip-mid', {}, icon('repeat'), h('em', {}, R.middle)), h('span.recip-side', {}, icon('globe'), R.right)), tiles(R.facts, 'soft'));
  };
  X.ojt = function () {
    return h('div', {}, tiles((E().ojt || {}).facts, 'soft'),
      h('div.ojt-scale', { role: 'img', 'aria-label': 'Rating scale 1 to 3' }, ['1 New to it', '2 Can do it with help', '3 Can do it alone'].map(function (t, i) { return h('span.ojt-' + (i + 1), {}, h('b', {}, String(i + 1)), t.slice(2)); })));
  };
  X.warrant = function () {
    var W = E().warrant || {};
    return h('div', {}, h('div.xchain.wide', {}, (W.steps || []).map(function (s, i) { return [i ? icon('arrow-right', 'xchain-arrow') : null, h('div.xnode.big', {}, icon(s[0]), h('b', {}, s[1]), h('span', {}, s[2]))]; })),
      W.baseline ? CORB.ui.callout('info', 'shield', 'Baseline in the model', W.baseline) : null);
  };

  X.TITLES = { journey: 'The exam, step by step', examfacts: 'The exam at a glance', blueprint: 'What the 150 questions cover', attempts: 'If you do not pass', grace: 'Your 36 months',
    fy27: 'What changed in October 2026', requirements: 'What certification takes', competency: 'The competency model in one picture', career: 'Your career path', cl: 'Continuous learning (CL)',
    reciprocity: 'DoW and civilian certifications', ojt: 'How the OJT tool works', warrant: 'How warrants work' };
  X.render = function (key) {
    switch (key) {
      case 'journey': return h('div', {}, X.journey(), h('h3.mt-5', {}, 'Behind the scenes'), X.flow(), h('h3.mt-5', {}, 'The fine print'), X.rules());
      case 'examfacts': return X.examFacts();
      case 'blueprint': return X.blueprint();
      case 'attempts': return X.attempts();
      case 'grace': return X.grace();
      case 'fy27': return X.fy27();
      case 'requirements': return X.requirements();
      case 'competency': return X.competency();
      case 'career': return X.career();
      case 'cl': return X.cl();
      case 'reciprocity': return X.reciprocity();
      case 'ojt': return X.ojt();
      case 'warrant': return X.warrant();
    }
    return null;
  };
})();
