/* CORE-04-DATA — query API over CORB_DATA with overrides, unit filter, tf-idf search, citation URLs */
(function () {
  'use strict';
  var CORB = window.CORB;
  var data = CORB.data = {};
  var cacheAll = null, index = null;

  data.init = function () { cacheAll = null; index = null; CORB.on('change', function (e) { if (e && e.path && e.path.indexOf('overrides') === 0) { cacheAll = null; index = null; } }); };

  data.all = function () {
    if (cacheAll) return cacheAll;
    var base = (CORB.DATA.questions || []).slice();
    var ov = CORB.get('overrides.questions', {}) || {}; var removed = CORB.get('overrides.removed', {}) || {}; var added = CORB.get('overrides.added', []) || [];
    var out = base.filter(function (q) { return !removed[q.id]; }).map(function (q) { return ov[q.id] ? Object.assign({}, q, ov[q.id]) : q; });
    added.forEach(function (q) { if (q && q.id && !removed[q.id]) out.push(q); });
    cacheAll = out.map(koClasses).filter(Boolean);
    return cacheAll;
  };
  // Korea has no Grants or Agreements officers, so a question carries contracting officer classes only. One tagged just
  // for those tracks (an older saved edit or an imported row) is left out; a mixed tag keeps its Class I to IV part.
  function koClasses(q) {
    var c = q.classes;
    if (!c || !c.length) return q;
    var ko = c.filter(function (x) { return data.KO_CLASSES.indexOf(x) >= 0; });
    if (ko.length === c.length) return q;
    return ko.length ? Object.assign({}, q, { classes: ko }) : null;
  }
  data.byId = function (id) { return data.all().filter(function (q) { return q.id === id; })[0] || null; };

  data.unitAllows = function (q, unit) {
    unit = unit || CORB.unit();
    if (unit === 'all') return true;
    if (unit === '411th CSB' && q.domain === 'Grants & Agreements') return false;   // Korea has no Grants or Agreements officers
    var units = q.units || [q.unit];
    return units.indexOf(unit) >= 0 || units.indexOf('ACC-All') >= 0;
  };

  // Practice (the Quiz and every Arcade game) follows the organization picker by relevance, not by list: a general
  // contracting question from any organization's list applies everywhere, but another organization's local procedures do
  // not. Korea is the 411th CSB list and the Korea, LCS & SOFA topic; Germany is the 409th CSB list and the ABG-75 topic.
  // Korea has no Grants or Agreements officers, so grants, cooperative agreements and other transactions are left out for
  // the 411th CSB (user decisions, 16 and 17 Sep 2026). 'all' keeps everything.
  var LOCAL_TOPIC = { '411th CSB': 'Korea, LCS & SOFA', '409th CSB': 'Germany ABG-75' };
  data.relevantTo = function (q, unit) {
    if (!q) return false;
    unit = unit || CORB.unit();
    if (unit === 'all') return true;
    var units = q.units || [q.unit];
    if (unit === '411th CSB' && q.domain === 'Grants & Agreements') return false;
    if (units.indexOf(unit) >= 0) return true;
    for (var org in LOCAL_TOPIC) {
      if (org !== unit && (units.indexOf(org) >= 0 || q.domain === LOCAL_TOPIC[org])) return false;
    }
    return true;
  };
  // A game card flagged korea-verify-cp (the Fiscal Asteroids Logistics Cost Sharing statements) is Korea procedure.
  data.cardRelevantTo = function (card, unit) {
    unit = unit || CORB.unit();
    return unit === 'all' || unit === '411th CSB' || ((card && card.flags) || []).indexOf('korea-verify-cp') < 0;
  };

  // Every question list follows the profile's warrant class (that class and the classes below it), so readiness,
  // the library, flashcards, scenarios and the mentor all match what the candidate is boarding for. A caller opts out
  // by naming classes itself (f.classes), by naming another class to apply (f.warrant), or with f.anyClass.
  function classScope(f) {
    if (f.anyClass || (f.classes && f.classes.length)) return null;
    var want = data.classesFor(f.warrant != null ? f.warrant : null);
    return want.length ? want : null;
  }
  data.questions = function (f) {
    f = f || {};
    var unit = f.unit || CORB.unit();
    var q = f.q ? String(f.q).toLowerCase().trim() : '';
    var bm = CORB.get('progress.bookmarks', {}) || {}, seen = CORB.get('progress.seen', {}) || {};
    var scope = classScope(f);
    return data.all().filter(function (x) {
      if (!f.ignoreUnit && !data.unitAllows(x, unit)) return false;
      if (scope) { var qc = x.classes || []; if (qc.length && !qc.some(function (c) { return scope.indexOf(c) >= 0; })) return false; }
      if (f.ids && f.ids.indexOf(x.id) < 0) return false;
      if (f.domain && x.domain !== f.domain) return false;
      if (f.topic && x.topic !== f.topic) return false;
      if (f.kind && x.kind !== f.kind) return false;
      if (f.status && x.answer_status !== f.status) return false;
      if (f.flag && (x.flags || []).indexOf(f.flag) < 0) return false;
      if (f.classes && f.classes.length && !f.classes.some(function (c) { return (x.classes || []).indexOf(c) >= 0; })) return false;
      if (f.bookmarked && !bm[x.id]) return false;
      if (f.unseen && seen[x.id]) return false;
      if (f.answered && x.answer_status === 'open') return false;
      if (q) { var hay = (x.question + ' ' + (x.answer || '') + ' ' + x.topic + ' ' + (x.tags || []).join(' ') + ' ' + (x.citations || []).join(' ')).toLowerCase(); if (hay.indexOf(q) < 0) return false; }
      return true;
    });
  };
  data.random = function (f, n) { return CORB.util.shuffle(data.questions(f)).slice(0, n || 1); };
  data.domains = function (f) { var c = {}; data.questions(f).forEach(function (q) { c[q.domain] = (c[q.domain] || 0) + 1; }); return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).map(function (k) { return { name: k, count: c[k] }; }); };
  data.topics = function (f) { var c = {}; data.questions(f).forEach(function (q) { c[q.topic] = (c[q.topic] || 0) + 1; }); return Object.keys(c).sort().map(function (k) { return { name: k, count: c[k] }; }); };
  data.DOMAINS = ['Fiscal Law & Funding', 'Competition & Market Research', 'Acquisition Planning & Contract Types', 'Source Selection & Evaluation', 'Pricing, Cost & Payment', 'Contract Administration', 'Terminations & Remedies', 'Protests, Claims & Disputes', 'Responsibility & Exclusions', 'Property, Security & Special Provisions', 'Authority, Ethics & Leadership', 'Small Business & Socioeconomic', 'Grants & Agreements', 'Korea, LCS & SOFA', 'Germany ABG-75', 'General Contracting'];
  data.KO_CLASSES = ['I', 'II', 'III', 'IV'];
  data.CLASSES = data.KO_CLASSES.slice();

  // ---- search index (tf-idf, bag of words) ----
  var STOP = {}; 'a an the and or of to in for on at by with from as is are be this that it its what when how why which who do does your you we our their there these those into under over than then can may must shall should would will not no if any all some more most'.split(' ').forEach(function (w) { STOP[w] = 1; });
  function tokens(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9§.\-\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1 && !STOP[w]; }).map(function (w) { return w.replace(/(ing|ed|es|s)$/, function (m, g, off) { return w.length - m.length >= 4 ? '' : m; }); }); }
  data.tokens = tokens;
  function buildIndex() {
    var docs = [];
    data.all().forEach(function (q) { docs.push({ type: 'Question', id: q.id, title: q.question.slice(0, 140), sub: q.domain + ' · ' + q.topic, text: q.question + ' ' + q.question + ' ' + (q.answer || '') + ' ' + q.topic + ' ' + (q.tags || []).join(' ') + ' ' + (q.key_points || []).join(' '), view: 'library', params: { id: q.id }, ref: q }); });
    (CORB.DATA.primers || []).forEach(function (p) { docs.push({ type: 'Primer', id: p.id, title: p.title, sub: p.domain, text: p.title + ' ' + p.title + ' ' + p.summary + ' ' + (p.sections || []).map(function (s) { return s.heading + ' ' + s.body; }).join(' '), view: 'primers', params: { id: p.id }, ref: p }); });
    (CORB.DATA.glossary || []).forEach(function (g, i) { docs.push({ type: 'Glossary', id: 'g' + i, title: g.term + (g.expansion ? ' — ' + g.expansion : ''), sub: g.domain || '', text: g.term + ' ' + g.term + ' ' + (g.expansion || '') + ' ' + g.definition, view: 'glossary', params: { q: g.term }, ref: g }); });
    var proc = CORB.DATA.process || {};
    (proc.steps || []).forEach(function (s) { docs.push({ type: 'Process', id: 'step' + s.n, title: 'Step ' + s.n + ': ' + (s.what || '').slice(0, 100), sub: s.who || '', text: (s.who || '') + ' ' + (s.what || '') + ' ' + (s.routing || '') + ' ' + (s.checklist || []).map(function (c) { return c.text; }).join(' '), view: 'process', params: { step: s.n }, ref: s }); });
    (proc.vce_howto || []).forEach(function (s, i) { docs.push({ type: 'VCE how-to', id: 'vce' + i, title: s.title, sub: 'VCE-Warrants', text: s.title + ' ' + (s.steps || []).join(' '), view: 'process', params: { tab: 'vce' }, ref: s }); });
    var regs = CORB.DATA.regulations || {};
    (regs.frameworks || []).forEach(function (fw) { (fw.parts || []).forEach(function (p) { docs.push({ type: 'Regulation', id: fw.id + p.num, title: fw.name + ' Part ' + p.num + ': ' + p.title, sub: p.summary ? p.summary.slice(0, 90) : '', text: fw.name + ' part ' + p.num + ' ' + p.title + ' ' + (p.summary || '') + ' ' + (p.key_sections || []).map(function (k) { return k.ref + ' ' + k.title + ' ' + (k.note || ''); }).join(' '), view: 'regulations', params: { fw: fw.id, part: p.num }, ref: p }); }); });
    (regs.thresholds || []).forEach(function (t) { docs.push({ type: 'Threshold', id: t.id, title: t.name + ' — ' + t.value, sub: t.cite || '', text: t.name + ' ' + t.value + ' ' + (t.notes || '') + ' ' + (t.cite || '') + ' threshold', view: 'regulations', params: { tab: 'thresholds' }, ref: t }); });
    var df = {}, N = docs.length;
    docs.forEach(function (d) { var tf = {}; tokens(d.text).forEach(function (w) { tf[w] = (tf[w] || 0) + 1; }); d.tf = tf; Object.keys(tf).forEach(function (w) { df[w] = (df[w] || 0) + 1; }); });
    var idf = {}; Object.keys(df).forEach(function (w) { idf[w] = Math.log(1 + N / df[w]); });
    index = { docs: docs, idf: idf };
  }
  data.search = function (query, opts) {
    opts = opts || {}; if (!index) buildIndex();
    var qt = tokens(query); if (!qt.length) return [];
    var ql = String(query).toLowerCase();
    var scored = index.docs.map(function (d) {
      var s = 0; qt.forEach(function (w) { if (d.tf[w]) s += (1 + Math.log(d.tf[w])) * (index.idf[w] || 1); });
      if (s && d.title.toLowerCase().indexOf(ql) >= 0) s *= 1.6;
      if (opts.types && opts.types.indexOf(d.type) < 0) s = 0;
      if (d.type === 'Question' && !opts.ignoreUnit && !data.unitAllows(d.ref)) s = 0;
      if (s && d.type === 'Question' && !opts.anyClass && !data.classEligible(d.ref)) s *= 0.35;   // questions for other classes still show, after your own
      return { item: d, score: s };
    }).filter(function (r) { return r.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, opts.limit || 20);
    return scored.map(function (r) { return { type: r.item.type, id: r.item.id, title: r.item.title, sub: r.item.sub, view: r.item.view, params: r.item.params, ref: r.item.ref, score: r.score }; });
  };

  // ---- citation resolution ----
  var cwCache = null;
  function crosswalk() { if (cwCache) return cwCache; cwCache = {}; ((CORB.DATA.regulations || {}).crosswalk || []).forEach(function (c) { if (c.old && c.new) cwCache[c.old.replace(/\s+/g, ' ').toUpperCase()] = c; }); return cwCache; }
  data.rfoFor = function (ref) { var c = crosswalk()[String(ref).replace(/^RFO\s+/i, '').replace(/\s+/g, ' ').toUpperCase()]; return c ? c.new : null; };
  data.citeUrl = function (ref) {
    var regs = CORB.DATA.regulations || {}; var r = String(ref).replace(/^RFO\s+/i, '').replace(/\s+/g, ' ');
    var m = /^(DFARS PGI|AFARS PGI|PGI|FAR|DFARS|AFARS)\s+(?:Part\s+|Subpart\s+)?(\d{1,4})(?:\.(\d{1,4}))?(?:-(\d{1,3}))?/i.exec(r);
    if (m) {
      var fwId = { 'FAR': 'far', 'DFARS': 'dfars', 'DFARS PGI': 'pgi', 'PGI': 'pgi', 'AFARS PGI': 'afars', 'AFARS': 'afars' }[m[1].toUpperCase()];
      var fw = (regs.frameworks || []).filter(function (f) { return f.id === fwId; })[0];
      var partNum = m[2]; if (fwId === 'dfars' || fwId === 'pgi') partNum = String(parseInt(partNum, 10)); // 201 -> 1? keep as given below
      var part = fw && (fw.parts || []).filter(function (p) { return String(p.num) === String(m[2]) || String(p.num) === String(parseInt(m[2], 10)); })[0];
      if (part) {
        if (m[3]) { var sec = (part.key_sections || []).filter(function (k) { return k.ref && k.ref.replace(/\s+/g, ' ').toUpperCase().indexOf((m[1] + ' ' + m[2] + '.' + m[3]).toUpperCase()) >= 0 && k.url; })[0]; if (sec) return sec.url; }
        return part.url || (fw && fw.url) || null;
      }
      if (fw && fw.url) return fw.url;
      if (fwId === 'far') return 'https://www.acquisition.gov/far/part-' + m[2];
      if (fwId === 'dfars') return 'https://www.acquisition.gov/dfars/part-' + m[2];
      if (fwId === 'afars') return 'https://www.acquisition.gov/afars';
      return null;
    }
    var u = /^(\d{1,2})\s+U\.?S\.?C\.?\s+(?:§\s*)?(\d{3,5}[a-z]?)/i.exec(r); if (u) return 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title' + u[1] + '-section' + u[2] + '&num=0&edition=prelim';
    var c = /^(\d{1,2})\s+C\.?F\.?R\.?\s+(?:§\s*)?(\d{1,4})(?:\.(\d+))?/i.exec(r); if (c) return 'https://www.ecfr.gov/current/title-' + c[1] + '/part-' + c[2] + (c[3] ? '/section-' + c[2] + '.' + c[3] : '');
    return null;
  };

  // ---- warrant class: the class a candidate is boarding for (profile.targetClass) ----
  // Contracting officer classes are cumulative: a Class III candidate sees Class III questions and the Class I and II
  // fundamentals below them. No choice means every question.
  CORB.warrantClass = function () { var c = String(CORB.get('profile.targetClass', '') || ''); return data.CLASSES.indexOf(c) >= 0 ? c : ''; };
  data.classesFor = function (cls) {
    cls = cls == null ? CORB.warrantClass() : cls;
    var i = data.KO_CLASSES.indexOf(cls);
    return i >= 0 ? data.KO_CLASSES.slice(0, i + 1) : [];
  };
  data.classEligible = function (q, cls) {
    var want = data.classesFor(cls);
    if (!want.length) return true;
    var qc = (q && q.classes) || [];
    if (!qc.length) return true;
    return qc.some(function (c) { return want.indexOf(c) >= 0; });
  };
  // Eligible items, shuffled so about 60% of the order is tagged for the chosen class and the rest come from below it.
  data.byWarrant = function (list, cls) {
    cls = cls == null ? CORB.warrantClass() : cls;
    var pool = (list || []).filter(function (q) { return data.classEligible(q, cls); });
    if (data.KO_CLASSES.indexOf(cls) < 0) return CORB.util.shuffle(pool);
    var at = CORB.util.shuffle(pool.filter(function (q) { return (q.classes || []).indexOf(cls) >= 0; }));
    var below = CORB.util.shuffle(pool.filter(function (q) { return (q.classes || []).indexOf(cls) < 0; }));
    var out = [];
    while (at.length || below.length) out.push(at.length && (!below.length || Math.random() < 0.6) ? at.shift() : below.shift());
    return out;
  };
  data.classLabel = function (cls) { return cls ? 'Class ' + cls : 'All classes'; };

  // ---- readiness helpers over questions ----
  data.coverage = function (unit) {
    var seen = CORB.get('progress.seen', {}) || {}; var out = {};
    data.questions({ unit: unit }).forEach(function (q) { var d = out[q.domain] = out[q.domain] || { total: 0, seen: 0 }; d.total++; if (seen[q.id]) d.seen++; });
    return out;
  };
})();
