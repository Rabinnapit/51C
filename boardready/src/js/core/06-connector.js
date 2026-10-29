/* CORE-06-CONNECTOR — the mentor's offline retrieval (RAG over the embedded corpus). The optional AI endpoint lives in
   06b-connector-network.js; the offline candidate edition leaves that file out, so it makes no network requests at all. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var cx = CORB.connector = {};

  cx.online = false;   // set by 06b-connector-network.js when the AI endpoint code is part of this file
  cx.settings = function () { return CORB.get('settings.connector', {}) || {}; };
  cx.configured = function () { var s = cx.settings(); return !!(cx.online && s.baseUrl && s.model && (s.apiKey || s.noKey)); };

  cx.grounding = function (query, k) {
    var hits = CORB.data.search(query, { limit: k || 6 });
    return hits.map(function (h) {
      var r = h.ref; var body = '';
      if (h.type === 'Question') body = 'Q: ' + r.question + '\nA: ' + (r.answer || '(no formal answer)') + (r.citations && r.citations.length ? '\nCite: ' + r.citations.join('; ') : '');
      else if (h.type === 'Primer') body = r.title + ': ' + r.summary + '\n' + (r.sections || []).slice(0, 3).map(function (s) { return s.heading + ': ' + s.body; }).join('\n');
      else if (h.type === 'Glossary') body = r.term + (r.expansion ? ' (' + r.expansion + ')' : '') + ': ' + r.definition;
      else if (h.type === 'Threshold') body = r.name + ' = ' + r.value + ' (' + (r.cite || '') + ')';
      else if (h.type === 'Regulation') body = h.title + ': ' + (r.summary || '');
      else body = h.title + ': ' + (r.what || r.definition || '');
      return { type: h.type, title: h.title, body: body.slice(0, 1400), view: h.view, params: h.params, id: h.id };
    });
  };

  // ---- offline mentor: retrieval-composed answer, no model ----
  cx.offlineAnswer = function (question) {
    var g = cx.grounding(question, 8);
    var qs = g.filter(function (x) { return x.type === 'Question'; }).slice(0, 3);
    var primers = g.filter(function (x) { return x.type === 'Primer'; }).slice(0, 2);
    var terms = g.filter(function (x) { return x.type === 'Glossary'; }).slice(0, 3);
    var thr = g.filter(function (x) { return x.type === 'Threshold'; }).slice(0, 2);
    var parts = [];
    if (!g.length) parts.push('I could not find anything in the repository that matches that. Try different words, a topic name, or a citation like "FAR 6.103".');
    if (qs.length) parts.push('Closest board questions and their answers:\n\n' + qs.map(function (x, i) { return x.body; }).join('\n\n— — —\n\n'));
    if (primers.length) parts.push('From the study primers:\n\n' + primers.map(function (x) { return x.body; }).join('\n\n'));
    if (thr.length) parts.push('Thresholds mentioned: ' + thr.map(function (x) { return x.body; }).join('; '));
    if (terms.length) parts.push('Terms: ' + terms.map(function (x) { return x.body; }).join(' | '));
    parts.push('Offline mentor: this is retrieved from the embedded repository, not generated.' + (cx.online ? ' Connect an AI endpoint in Settings for coached explanations and mock-board feedback.' : ''));
    return { text: parts.join('\n\n'), sources: g, mode: 'offline' };
  };
})();
