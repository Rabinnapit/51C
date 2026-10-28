/* CORE-04-DATA — query API over CORB_DATA: phases, lessons, questions, glossary, courses, search, citation links */
(function () {
  'use strict';
  var CORB = window.CORB, D = CORB.DATA;
  var data = CORB.data = {};
  function arr(x) { return Array.isArray(x) ? x : []; }

  // ---- contract life cycle phases = the four exam blueprint areas, plus "On the job" for lessons outside the exam ----
  var JOB = { id: 'job', code: '', name: 'On the job', short: 'On the job', qs: 0, plain: 'Things you will do at work that the exam does not test directly.' };
  data.phases = function () { return arr((D.cert || {}).phases); };
  data.phase = function (id) { if (id === 'job') return JOB; return data.phases().filter(function (p) { return p.id === id; })[0] || null; };
  data.phaseColor = function (id) { return 'var(--ph-' + (id || 'job') + ')'; };

  // ---- lessons ----
  data.lessons = function () { return arr(D.lessons); };
  data.lesson = function (id) { return data.lessons().filter(function (l) { return l.id === id; })[0] || null; };
  data.lessonsIn = function (phase) { return data.lessons().filter(function (l) { return l.phase === phase; }); };
  data.lessonDone = function (id) { return !!CORB.get('progress.lessons.' + id); };
  data.nextLesson = function () { return data.lessons().filter(function (l) { return !data.lessonDone(l.id); })[0] || null; };

  // ---- practice questions ----
  data.questions = function () { return arr(D.quiz); };
  data.question = function (id) { return data.questions().filter(function (q) { return q.id === id; })[0] || null; };
  data.questionsFor = function (lessonId) { return data.questions().filter(function (q) { return q.lesson === lessonId; }); };

  // ---- glossary (acronyms in running text link to it) ----
  var gIndex = null, gRe;
  data.glossary = function () { return arr(D.glossary); };
  function buildIndex() {
    gIndex = {};
    data.glossary().forEach(function (g) { gIndex[g.term.toLowerCase()] = g; if (g.alias) arr(g.alias).forEach(function (a) { gIndex[String(a).toLowerCase()] = g; }); });
    var acr = data.glossary().map(function (g) { return g.term; }).filter(function (t) { return /^[A-Z][A-Z0-9&/-]{1,9}$/.test(t) && /[A-Z].*[A-Z]|[A-Z]\d/.test(t); });
    acr.sort(function (a, b) { return b.length - a.length; });
    // rich text is matched after HTML escaping, so "J&A" appears as "J&amp;A"
    gRe = acr.length ? new RegExp('(?<![\\w/&;-])(' + acr.map(function (t) { return t.replace(/&/g, '&amp;').replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&'); }).join('|') + ')(?![\\w/&-])', 'g') : null;
  }
  data.term = function (t) { if (!gIndex) buildIndex(); return gIndex[String(t || '').toLowerCase()] || null; };
  data.termRegex = function () { if (!gIndex) buildIndex(); if (gRe) gRe.lastIndex = 0; return gRe; };

  // ---- certification content ----
  data.courses = function () { return arr(D.courses); };
  data.course = function (id) { return data.courses().filter(function (c) { return c.id === id; })[0] || null; };
  data.requiredCourses = function () { return data.courses().filter(function (c) { return c.group === 'required'; }); };
  data.courseDone = function (id) { return (CORB.get('progress.courses.' + id) || {}).status === 'done'; };
  data.howtos = function () { return arr(D.howto); };
  data.howto = function (id) { return data.howtos().filter(function (x) { return x.id === id; })[0] || null; };
  data.farParts = function () { return arr((D.far || {}).parts); };
  data.examParts = function () { return data.farParts().filter(function (p) { return p.exam; }); };
  data.links = function () { return arr(D.links); };
  data.updates = function () { return D.updates || { far_updates: [], guide_changes: [] }; };

  // ---- search across everything (palette and the glossary box) ----
  var idx = null;
  function words(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9.\- ]+/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1; }); }
  function buildSearch() {
    idx = [];
    function add(type, title, sub, text, view, params) { idx.push({ type: type, title: title, sub: sub, view: view, params: params, t: words(title).join(' '), x: ' ' + words(text).join(' ') + ' ' }); }
    data.lessons().forEach(function (l) { add('Lesson', l.title, l.summary, [l.summary, l.why, arr(l.sections).map(function (s) { return s.h + ' ' + s.body; }).join(' '), arr(l.terms).join(' ')].join(' '), 'lesson', { id: l.id }); });
    data.glossary().forEach(function (g) { add('Term', g.term + (g.expansion ? ' (' + g.expansion + ')' : ''), g.definition, g.term + ' ' + (g.expansion || '') + ' ' + g.definition, 'glossary', { q: g.term }); });
    data.courses().forEach(function (c) { add('Course', c.code + ' ' + c.title, c.about, [c.code, c.title, c.about, arr(c.learn).join(' ')].join(' '), 'courses', { id: c.id }); });
    data.howtos().forEach(function (x) { add('How-to', x.title, x.when, [x.title, x.when, arr(x.steps).map(function (s) { return s.t + ' ' + (s.d || ''); }).join(' ')].join(' '), 'howto', { id: x.id }); });
    data.farParts().forEach(function (p) { add('FAR part', 'FAR Part ' + p.n + ': ' + p.title, p.plain, 'far part ' + p.n + ' ' + p.title + ' ' + p.plain, 'far', { tab: 'parts', q: String(p.n) }); });
    arr((D.cert || {}).faq).forEach(function (f, i) { add('FAQ', f.q, '', f.q + ' ' + f.a, 'cert', { tab: 'faq', open: String(i) }); });
    arr((D.official || {}).docs).forEach(function (d) { add('Official document', d.title, d.summary, [d.title, d.who, d.date, d.summary].join(' '), 'official', { doc: d.id }); });
    Object.keys(CORB.views).forEach(function (k) { var v = CORB.views[k]; if (v.nav) add('Page', v.title, v.blurb || '', v.title + ' ' + (v.blurb || '') + ' ' + (v.keywords || ''), v.id, {}); });
  }
  data.search = function (q, opts) {
    opts = opts || {}; if (!idx) buildSearch();
    var terms = words(q); if (!terms.length) return [];
    var whole = String(q).toLowerCase().trim();
    return idx.map(function (it) {
      var s = 0;
      terms.forEach(function (w) {
        if ((' ' + it.t + ' ').indexOf(' ' + w + ' ') >= 0) s += 6; else if (it.t.indexOf(w) >= 0) s += 3;
        if (it.x.indexOf(' ' + w + ' ') >= 0) s += 2; else if (it.x.indexOf(w) >= 0) s += 0.5;
      });
      if (it.t.indexOf(whole) === 0) s += 8; else if (it.t.indexOf(whole) >= 0) s += 3;
      return { it: it, s: s };
    }).filter(function (r) { return r.s >= terms.length * 2; }).sort(function (a, b) { return b.s - a.s; }).slice(0, opts.limit || 20).map(function (r) { return r.it; });
  };
  data.invalidate = function () { idx = null; gIndex = null; };

  // ---- citation links. FAR cites use RFO numbering, so they open the RFO part page (the codified FAR still shows old numbers) ----
  data.citeUrl = function (ref) {
    var r = String(ref).replace(/^RFO\s+/i, '').replace(/\s+/g, ' ');
    var m = /^(DFARS PGI|AFARS PGI|PGI|FAR|DFARS|AFARS)\s+(?:Part\s+|Subpart\s+)?(\d{1,4})/i.exec(r);
    if (m) {
      var fw = m[1].toUpperCase(), n = parseInt(m[2], 10);
      if (fw === 'FAR') return n >= 1 && n <= 53 ? 'https://www.acquisition.gov/far-overhaul/far-part-deviation-guide/far-overhaul-part-' + n : 'https://www.acquisition.gov/far-overhaul';
      if (fw === 'DFARS' || fw === 'PGI' || fw === 'DFARS PGI') return 'https://www.acq.osd.mil/dpap/dars/dfars_far_overhaul_class_deviations.html';
      return 'https://www.acquisition.gov/afars';
    }
    var u = /^(\d{1,2}) U\.S\.C\. (?:§\s*)?(\d{3,5}[a-z]?)/i.exec(r); if (u) return 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title' + u[1] + '-section' + u[2] + '&num=0&edition=prelim';
    var c = /^(\d{1,2}) CFR (?:§\s*)?(\d{1,4})(?:\.(\d+))?/i.exec(r); if (c) return 'https://www.ecfr.gov/current/title-' + c[1] + '/part-' + c[2] + (c[3] ? '/section-' + c[2] + '.' + c[3] : '');
    if (/^DoDI 5000\.66/i.test(r)) return 'https://www.esd.whs.mil/Directives/issuances/dodi/';
    return null;
  };
})();
