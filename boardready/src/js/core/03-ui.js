/* CORE-03-UI — DOM helpers, icons, badges, rich text, modal, toast, palette, role picker */
(function () {
  'use strict';
  var CORB = window.CORB;
  var ui = CORB.ui = {};

  ui.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  ui.h = function (tag, attrs) {
    var m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag || 'div');
    var el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) m[2].match(/[.#][\w-]+/g).forEach(function (t) { if (t[0] === '.') el.classList.add(t.slice(1)); else el.id = t.slice(1); });
    var children = Array.prototype.slice.call(arguments, 2);
    if (attrs && (attrs instanceof Node || typeof attrs !== 'object' || Array.isArray(attrs))) { children.unshift(attrs); attrs = null; }
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class' || k === 'className') { String(v).split(/\s+/).filter(Boolean).forEach(function (c) { el.classList.add(c); }); }
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
      else if (k === 'html') el.innerHTML = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' && 'value' in el) el.value = v;
      else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'open') { if (v) el.setAttribute(k, ''); el[k] = !!v; }
      else el.setAttribute(k, v === true ? '' : v);
    });
    (function add(c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      if (c instanceof Node) { el.appendChild(c); return; }
      el.appendChild(document.createTextNode(String(c)));
    })(children);
    return el;
  };
  ui.mount = function (root, nodes) { root.innerHTML = ''; (Array.isArray(nodes) ? nodes : [nodes]).forEach(function (n) { if (n) root.appendChild(n); }); return root; };
  ui.delegate = function (root, evt, sel, fn) { root.addEventListener(evt, function (e) { var t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); }); };

  // ---- icons (inline SVG, 24 viewBox, stroke) ----
  var P = {
    dot: '<circle cx="12" cy="12" r="3"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', home: '<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
    dashboard: '<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/>',
    process: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="12" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.5 6h4a3 3 0 0 1 3 3v0M8.5 18h4a3 3 0 0 0 3-3v0"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    cards: '<rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>', quiz: '<path d="M9 11l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="3"/>',
    board: '<path d="M3 5h18v11H3z"/><path d="M8 21h8M12 16v5"/>', mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>', spark: '<path d="M12 2l2.2 6.4L21 11l-6.8 2.6L12 20l-2.2-6.4L3 11l6.8-2.6z"/>',
    gamepad: '<rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 11v4M5 13h4M15 12h.01M18 14h.01"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15 15.5a5 5 0 0 1 6.5 4.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', glossary: '<path d="M4 6h16M4 12h10M4 18h7"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    play: '<path d="M6 4l14 8-14 8z"/>', pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z"/>', stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>', volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"/>',
    check: '<path d="M5 12l4 4L19 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', chevron: '<path d="M6 9l6 6 6-6"/>', 'chevron-right': '<path d="M9 6l6 6-6 6"/>', 'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>', 'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    flag: '<path d="M5 22V4a1 1 0 0 1 1-1h11l-2 4 2 4H6"/>', star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3.5 9.6l6.2-.9z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    download: '<path d="M12 3v12M6 11l6 6 6-6M4 21h16"/>', upload: '<path d="M12 21V9M6 13l6-6 6 6M4 3h16"/>', print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
    shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17h.01"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>', plus: '<path d="M12 5v14M5 12h14"/>', edit: '<path d="M4 20h4l11-11-4-4L4 16z"/><path d="M13 7l4 4"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 'eye-off': '<path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 13.4 13.4M9.9 5.1A10 10 0 0 1 22 12a17 17 0 0 1-3.2 3.7M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4.4-1"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>', layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/>', compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7"/>', 'bar-chart': '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>', note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>', save: '<path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>', scale: '<path d="M12 3v18M3 7h18M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
    map: '<path d="M9 4l6 2 6-2v14l-6 2-6-2-6 2V6z"/><path d="M9 4v14M15 6v14"/>', key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l2 2M14 9l2 2"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.3 2.3c-.6.3-.9.8-.9 1.5v.5M12 17h.01"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', hand: '<path d="M8 12V6a2 2 0 1 1 4 0v5M12 11V4a2 2 0 1 1 4 0v7M16 11V7a2 2 0 1 1 4 0v8a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.4-3.4L4.5 14a2 2 0 0 1 3.5-2l1 1.5"/>', zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', message: '<path d="M4 4h16v12H8l-4 4z"/>', grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'
  };
  ui.icon = function (name, cls) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('data-icon', name); if (cls) s.setAttribute('class', cls); s.innerHTML = P[name] || P.dot; return s; };
  ui.iconNames = Object.keys(P);
  // the app's QR code (meta.app_qr, rows of 0 and 1 from tools/make_handout.py) as an SVG string; black on white so cameras read it
  ui.qrSvg = function (rows, label) {
    rows = Array.isArray(rows) ? rows : []; var n = rows.length; if (!n) return '';
    var d = '';
    rows.forEach(function (r, y) { var re = /1+/g, run; while ((run = re.exec(String(r)))) d += 'M' + (run.index + 4) + ' ' + (y + 4) + 'h' + run[0].length + 'v1h-' + run[0].length + 'z'; });
    return '<svg viewBox="0 0 ' + (n + 8) + ' ' + (n + 8) + '" shape-rendering="crispEdges" role="img" aria-label="' + ui.esc(label || 'QR code') + '">' +
      '<rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="' + d + '"/></svg>';
  };
  // copy text to the clipboard (the install page's "Copy the link"); falls back to a selected text box on older browsers
  ui.copyText = function (text) {
    text = String(text == null ? '' : text);
    function done() { ui.toast('Copied', 'ok'); return true; }
    function fallback() {
      try { var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); ta.remove(); if (ok) return done(); } catch (e) {}
      ui.toast('Could not copy. Select the address bar and copy it yourself.', 'warn'); return false;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(done, fallback);
    return Promise.resolve(fallback());
  };

  // ---- badges ----
  // One badge per meaning, so a card carries at most three: the answer's status, "Verify locally" (a local or Korea
  // procedure: confirm it with C&P) and "Check the cite". An RFO cite that is up to date needs no badge.
  var BADGES = { official: ['Official answer', 'check'], 'ai-draft': ['AI draft · verify', 'spark'], open: ['Open · write your own', 'edit'], 'verify-locally': ['Verify locally', 'flag'], 'korea-verify-cp': ['Verify locally', 'flag'], 'rfo-updated': ['RFO cites', 'refresh'], 'rfo-unverifiable': ['Check the cite', 'alert'], 'ai-drafted': ['AI draft · verify', 'spark'], pending: ['Check the cite', 'alert'] };
  var BADGE_LOOK = { 'korea-verify-cp': 'verify-locally', pending: 'rfo-unverifiable', 'ai-drafted': 'ai-draft' };
  var BADGE_TIP = {
    'verify-locally': 'Local procedure: confirm it with your Contracting & Policy (C&P) office before you rely on it',
    'korea-verify-cp': 'Korea procedure: confirm it with the 411th Contracting & Policy (C&P) office before you rely on it',
    'rfo-unverifiable': 'This citation could not be matched to the RFO text. Check it before you use it',
    pending: 'The citation review is not finished. Check it before you use it',
    'ai-draft': 'Drafted with AI from the source lists. Verify it before you rely on it'
  };
  ui.badge = function (status, label) {
    var b = BADGES[status] || [label || status, null];
    var el = ui.h('span.badge.' + (BADGE_LOOK[status] || status).replace(/[^\w-]/g, ''), BADGE_TIP[status] && !label ? { title: BADGE_TIP[status] } : {}, b[1] ? ui.icon(b[1]) : null, label || b[0]);
    return el;
  };
  ui.classBadge = function (c) { return ui.h('span.badge.class', {}, 'Class ' + c); };
  // One badge for a question's classes: "Class II", "Class II–IV" for a run, "Class I, III" otherwise.
  ui.classBadges = function (classes) {
    var order = (CORB.data && CORB.data.KO_CLASSES) || ['I', 'II', 'III', 'IV'];
    var idx = (classes || []).map(function (c) { return order.indexOf(c); }).filter(function (i) { return i >= 0; })
      .sort(function (a, b) { return a - b; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (!idx.length) return null;
    var run = idx[idx.length - 1] - idx[0] === idx.length - 1;
    var text = idx.length === 1 ? order[idx[0]] : run ? order[idx[0]] + '–' + order[idx[idx.length - 1]] : idx.map(function (i) { return order[i]; }).join(', ');
    return ui.h('span.badge.class', {}, 'Class ' + text);
  };
  // The one place a page shows the warrant class: the class and a Change button that opens the class picker.
  ui.classLine = function (o) {
    o = o || {};
    var cls = CORB.warrantClass ? CORB.warrantClass() : '';
    return ui.h('div.class-line', {},
      ui.icon('award'),
      ui.h('span', {}, o.label || 'Warrant class', ': ', ui.h('b', {}, CORB.data.classLabel(cls))),
      o.note ? ui.h('span.muted.small.class-line-note', {}, o.note) : null,
      ui.h('button.btn.sm.ghost.class-line-btn', { type: 'button', onclick: function () { ui.classPicker(); } }, 'Change'));
  };
  // ---- source labels and alternate answers (different answers the source lists give for the same question) ----
  ui.srcLabel = function (src) {
    var s = String(src || '');
    if (s === 'pam-xlsx-2026-01') return 'PAM Warrant Board Q&A list (January 2026)';
    if (s === 'pam-csv-legacy') return 'Legacy WarrantQA list (CSV)';
    if (/^deck-/.test(s)) return '411th study group, ' + s.slice(5);
    return s || 'Source list';
  };
  function wordSet(t) { var out = {}; String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).forEach(function (w) { if (w.length > 2) out[w] = 1; }); return out; }
  function overlap(a, b) { var A = wordSet(a), B = wordSet(b), inter = 0, uni = 0, k; for (k in A) { uni++; if (B[k]) inter++; } for (k in B) if (!A[k]) uni++; return uni ? inter / uni : 1; }
  ui.distinctAlts = function (q) {
    var out = [];
    (q && q.alt_answers || []).forEach(function (a) {
      if (!a || !a.text || String(a.text).trim().length < 8) return;
      if (overlap(a.text, q.answer) >= 0.8) return;                                   // same answer, different formatting or citations
      if (out.some(function (o) { return overlap(o.text, a.text) >= 0.8; })) return;   // already listed
      out.push(a);
    });
    return out;
  };

  ui.flagsFor = function (q) {
    var out = [];
    if (!q) return out;
    if (q.answer_status === 'ai-draft') out.push('ai-draft'); else if (q.answer_status === 'open') out.push('open'); else out.push('official');
    (q.flags || []).forEach(function (f) {
      f = f === 'korea-verify-cp' ? 'verify-locally' : f === 'pending' ? 'rfo-unverifiable' : f;
      if (f !== 'ai-drafted' && f !== 'rfo-updated' && out.indexOf(f) < 0) out.push(f);
    });
    if (q.rfo && q.rfo.status === 'unverifiable' && out.indexOf('rfo-unverifiable') < 0) out.push('rfo-unverifiable');
    return out;
  };

  // ---- rich text: plain text -> safe HTML with paragraphs, bullets and citation links ----
  var CITE_RE = /\b((?:RFO\s+)?(?:DFARS\s+PGI|AFARS\s+PGI|PGI|FAR|DFARS|AFARS)\s+(?:Part\s+|Subpart\s+)?\d{1,4}(?:\.\d{1,4})?(?:-\d{1,3})*(?:\([a-zA-Z0-9]{1,3}\))*|\d{1,2}\s+U\.?S\.?C\.?\s+(?:§\s*)?\d{3,5}[a-z]?|\d{1,2}\s+C\.?F\.?R\.?\s+(?:§\s*)?\d{1,4}(?:\.\d+)?)/g;
  ui.linkCites = function (escaped) {
    return escaped.replace(CITE_RE, function (m) {
      var url = CORB.data && CORB.data.citeUrl ? CORB.data.citeUrl(m) : null;
      return url ? '<a class="cite" href="' + ui.esc(url) + '" target="_blank" rel="noopener">' + m + '</a>' : '<span class="cite">' + m + '</span>';
    });
  };
  ui.rich = function (text, opts) {
    opts = opts || {};
    var t = String(text == null ? '' : text).replace(/\r/g, '');
    var blocks = t.split(/\n\s*\n/);
    var html = blocks.map(function (b) {
      var lines = b.split('\n').filter(function (l) { return l.trim().length; });
      if (!lines.length) return '';
      var isList = lines.every(function (l) { return /^\s*(?:[-•*]|\d+[.)])\s+/.test(l); });
      if (isList) {
        var ordered = /^\s*\d+[.)]/.test(lines[0]);
        return '<' + (ordered ? 'ol' : 'ul') + '>' + lines.map(function (l) { return '<li>' + ui.linkCites(ui.esc(l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, ''))) + '</li>'; }).join('') + '</' + (ordered ? 'ol' : 'ul') + '>';
      }
      var inner = lines.map(function (l) {
        var e = ui.esc(l);
        if (/^\s*(?:[-•*])\s+/.test(l)) return '<span class="li">' + ui.linkCites(e.replace(/^\s*(?:[-•*])\s+/, '• ')) + '</span>';
        if (/^cite[s]?:/i.test(l.trim())) return '<span class="citeline">' + ui.linkCites(e) + '</span>';
        return ui.linkCites(e);
      }).join('<br>');
      return '<p>' + inner + '</p>';
    }).join('');
    var el = ui.h('div.rich' + (opts.cls ? '.' + opts.cls : ''), { html: html });
    return el;
  };

  // ---- toast ----
  ui.toast = function (msg, kind, ms) {
    var host = document.getElementById('toasts'); if (!host) return;
    var t = ui.h('div.toast' + (kind ? '.' + kind : ''), {}, kind === 'ok' ? ui.icon('check') : kind === 'danger' ? ui.icon('alert') : ui.icon('info'), ui.h('span', {}, msg));
    host.appendChild(t); setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 320); }, ms || 2600);
  };

  // ---- modal ----
  var modalEl = null;
  ui.closeModal = function () { if (modalEl) { modalEl.remove(); modalEl = null; } };
  ui.modal = function (o) {
    ui.closeModal();
    var body = typeof o.body === 'string' ? ui.h('div', { html: o.body }) : o.body;
    var box = ui.h('div.modal' + (o.wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Dialog' },
      o.title !== false ? ui.h('div.modal-head', {}, ui.h('h3', {}, o.title || ''), ui.h('button.btn.icon.sm.ghost', { 'aria-label': 'Close', onclick: ui.closeModal }, ui.icon('x'))) : null,
      ui.h('div.modal-body', {}, body),
      o.actions && o.actions.length ? ui.h('div.modal-foot', {}, o.actions.map(function (a) { return ui.h('button.btn' + (a.primary ? '.primary' : '') + (a.danger ? '.danger' : ''), { onclick: function () { var r = a.onClick && a.onClick(); if (r !== false && !a.keepOpen) ui.closeModal(); } }, a.label); })) : null);
    modalEl = ui.h('div.modal-scrim', { onclick: function (e) { if (e.target === modalEl && !o.sticky) ui.closeModal(); } }, box);
    document.body.appendChild(modalEl);
    var f = box.querySelector('input, textarea, select, button.primary, button'); if (f) setTimeout(function () { f.focus(); }, 30);
    return box;
  };
  ui.confirm = function (msg, opts) { opts = opts || {}; return new Promise(function (res) { ui.modal({ title: opts.title || 'Please confirm', body: ui.h('p', {}, msg), sticky: true, actions: [{ label: opts.cancel || 'Cancel', onClick: function () { res(false); } }, { label: opts.ok || 'Confirm', primary: !opts.danger, danger: !!opts.danger, onClick: function () { res(true); } }] }); }); };
  ui.prompt = function (o) { return new Promise(function (res) { var inp = ui.h('input.input', { type: o.type || 'text', value: o.value || '', placeholder: o.placeholder || '' }); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { res(inp.value); ui.closeModal(); } }); ui.modal({ title: o.title || '', body: ui.h('div.field', {}, o.label ? ui.h('label', {}, o.label) : null, inp, o.hint ? ui.h('div.hint', {}, o.hint) : null), sticky: true, actions: [{ label: 'Cancel', onClick: function () { res(null); } }, { label: o.ok || 'OK', primary: true, onClick: function () { res(inp.value); } }] }); }); };

  // ---- role picker ----
  ui.rolePicker = function () {
    var roles = [['candidate', 'Candidate', 'Study, practice, mock boards, track readiness.', 'user'], ['board', 'Board member', 'Pick questions, take notes, score during a board.', 'users'], ['facilitator', 'Facilitator', 'Run study groups, edit content, save a new copy of the app.', 'settings']];
    var body = ui.h('div.grid', {}, roles.map(function (r) { return ui.h('button.card.lift.interactive.role-card', { onclick: function () { ui.closeModal(); CORB.setRole(r[0]); } }, ui.h('div.row', {}, ui.icon(r[3]), ui.h('h3', {}, r[1])), ui.h('p.muted.small.mt-2', {}, r[2])); }));
    ui.modal({ title: 'Who are you today?', body: body });
  };

  // ---- warrant class picker (the class chip in the top bar) ----
  var CLASS_PICK_HINT = { '': 'Every question, every class', I: 'Up to the simplified acquisition threshold', II: '$500K · $1M · $5M · SaP', III: '$10M · $25M · $50M · $100M', IV: '$250M · $500M · Unlimited' };
  ui.classPicker = function () {
    var cur = CORB.warrantClass ? CORB.warrantClass() : '';
    var list = [''].concat((CORB.data && CORB.data.CLASSES) || ['I', 'II', 'III', 'IV']);
    var grid = ui.h('div.class-pick', { role: 'radiogroup', 'aria-label': 'Warrant class' }, list.map(function (c) {
      var on = c === cur;
      return ui.h('button.class-pick-item' + (on ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false',
        onclick: function () { ui.closeModal(); if (CORB.setWarrantClass) CORB.setWarrantClass(c); } },
        ui.h('b', {}, CORB.data.classLabel(c)), ui.h('span', {}, CLASS_PICK_HINT[c] || ''));
    }));
    ui.modal({ title: 'Your warrant class', body: ui.h('div', {},
      ui.h('p.muted.small', {}, 'Every page follows this choice. You get the questions for this class and the lower classes.'),
      grid) });
  };

  // ---- global search palette ----
  ui.palette = function () {
    var input = ui.h('input.input', { placeholder: 'Search questions, primers, glossary, process… (Esc to close)', 'aria-label': 'Search' });
    var results = ui.h('div.palette-results');
    var box = ui.modal({ title: false, body: ui.h('div.palette', {}, ui.h('div.search', {}, ui.icon('search'), input), results), wide: true });
    var sel = 0, items = [];
    function draw() {
      results.innerHTML = '';
      if (!items.length) { results.appendChild(ui.h('div.empty', {}, input.value ? 'No matches' : 'Type to search across everything in the app')); return; }
      items.forEach(function (it, i) {
        results.appendChild(ui.h('button.palette-item' + (i === sel ? '.on' : ''), { onclick: function () { go(it); } }, ui.h('span.badge.neutral', {}, it.type), ui.h('span.grow.truncate', {}, it.title), ui.h('span.muted.small.truncate.hide-sm', {}, it.sub || '')));
      });
    }
    function go(it) { ui.closeModal(); CORB.go(it.view, it.params); }
    input.addEventListener('input', function () { items = CORB.data.search(input.value, { limit: 12 }); sel = 0; draw(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault(); } if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); } if (e.key === 'Enter' && items[sel]) go(items[sel]); });
    draw();
    setTimeout(function () { input.focus(); }, 20);
    return box;
  };

  // ---- shared: question card ----
  ui.questionCard = function (q, o) {
    o = o || {};
    var show = o.showAnswer;
    var card = ui.h('article.qcard', { 'data-id': q.id, tabindex: '0' });
    var meta = ui.h('div.q-meta', {}, ui.flagsFor(q).map(function (f) { return ui.badge(f); }), ui.classBadges(q.classes), ui.h('span.badge.neutral', {}, q.domain), ui.h('span.muted.small.num.grow', { style: { textAlign: 'right' } }, q.id));
    card.appendChild(meta);
    card.appendChild(ui.h('div.q-text', {}, q.question));
    var ansWrap = ui.h('div.q-answer-wrap');
    function renderAnswer() {
      ansWrap.innerHTML = '';
      if (!show) return;
      var text = q.answer_status === 'open' ? '' : q.answer;
      var status = q.answer_status;
      if (status === 'ai-draft' && !CORB.get('settings.showDrafts', true)) { ansWrap.appendChild(ui.h('div.q-answer', {}, ui.h('em.muted', {}, 'AI-drafted answer hidden by your settings.'))); return; }
      var kp = text && q.key_points && q.key_points.length ? q.key_points : null;
      var cross = q.rfo && q.rfo.crosswalk && q.rfo.crosswalk.length ? ui.h('div.muted.small.mt-2', {}, 'RFO crosswalk: ', q.rfo.crosswalk.map(function (c) { return c.old + ' → ' + c.new; }).join(' · ')) : null;
      if (!text) { ansWrap.appendChild(ui.h('div.q-answer', {}, ui.h('em.muted', {}, 'This question has no formal answer in the repository. Draft your own in Notes, then check it with a mentor.'))); }
      else if (kp) {
        ansWrap.appendChild(ui.h('div.panel-soft.q-keypoints', {}, ui.h('div.eyebrow', {}, 'Key points'), ui.h('ul.mt-2', {}, kp.map(function (k) { return ui.h('li', {}, k); }))));
        ansWrap.appendChild(ui.h('details.acc.mt-3.q-full', {}, ui.h('summary', {}, ui.icon('book'), 'Full answer', ui.icon('chevron', 'chev')), ui.h('div.acc-body', {}, ui.h('div.q-answer', {}, ui.rich(text)), cross)));
        cross = null;
      }
      else { var a = ui.h('div.q-answer', {}, ui.rich(text)); ansWrap.appendChild(a); }
      var mine = String(CORB.get('progress.notes.' + q.id, '') || '');
      if (mine.trim()) ansWrap.appendChild(ui.h('div.q-mynote.mt-3', {}, ui.h('div.q-mynote-head', {}, ui.icon('note'), ui.h('b', {}, 'My notes'), ui.h('button.btn.sm.ghost', { type: 'button', onclick: function () { ui.noteEditor(q); } }, ui.icon('edit'), 'Edit')), ui.h('p.q-mynote-text', {}, mine)));
      var alts = ui.distinctAlts(q);
      if (alts.length) ansWrap.appendChild(ui.h('details.acc.mt-3', {}, ui.h('summary', {}, ui.icon('book'), 'Other answers in the source lists (' + alts.length + ')', ui.icon('chevron', 'chev')), ui.h('div.acc-body', {}, ui.h('p.muted.small', {}, 'Shown exactly as written in the source list. Citations and dollar figures may predate the FAR Overhaul; the answer above is the one kept current.'), alts.map(function (a) { return ui.h('div.mb-3', {}, ui.h('div.eyebrow', {}, ui.srcLabel(a.src)), ui.rich(a.text)); }))));
      var cites = (q.citations_rfo && q.citations_rfo.length) ? q.citations_rfo : (q.citations || []);
      if (cites.length) ansWrap.appendChild(ui.h('div.q-cite', {}, 'Cite: ', cites.map(function (c) { var u = CORB.data.citeUrl(c); return u ? ui.h('a.cite', { href: u, target: '_blank', rel: 'noopener' }, c) : ui.h('span.cite', {}, c); })));
      if (cross) ansWrap.appendChild(cross);
    }
    renderAnswer();
    card.renderAnswer = renderAnswer;   // the notes window repaints the card after a save
    card.appendChild(ansWrap);
    if (o.actions !== false) {
      var seen = CORB.get('progress.seen.' + q.id); var bm = CORB.get('progress.bookmarks.' + q.id);
      var actions = ui.h('div.q-actions', {},
        ui.h('button.btn.sm', { onclick: function () { show = !show; renderAnswer(); this.textContent = ''; this.appendChild(ui.icon(show ? 'eye-off' : 'eye')); this.appendChild(document.createTextNode(show ? ' Hide answer' : ' Show answer')); if (show) CORB.set('progress.seen.' + q.id, CORB.util.today()); } }, ui.icon(show ? 'eye-off' : 'eye'), show ? ' Hide answer' : ' Show answer'),
        CORB.speech && CORB.speech.available ? ui.h('button.btn.sm.ghost', { onclick: function () { CORB.speech.speak(q.question); }, 'data-tip': 'Read aloud' }, ui.icon('volume')) : null,
        ui.h('button.btn.sm.ghost' + (bm ? '.on' : ''), { onclick: function () { var v = !CORB.get('progress.bookmarks.' + q.id); CORB.set('progress.bookmarks.' + q.id, v); this.classList.toggle('on', v); ui.toast(v ? 'Bookmarked' : 'Bookmark removed'); }, 'data-tip': 'Bookmark' }, ui.icon('bookmark')),
        ui.h('button.btn.sm.ghost', { onclick: function () { ui.noteEditor(q); }, 'data-tip': 'My notes' }, ui.icon('note')),
        ui.h('button.btn.sm.ghost', { onclick: function () { CORB.go('mentor', { q: q.question.slice(0, 200) }); }, 'data-tip': 'Ask the mentor' }, ui.icon('chat')),
        seen ? ui.h('span.muted.small.grow', { style: { textAlign: 'right' } }, 'seen ' + seen) : null);
      card.appendChild(actions);
    }
    return card;
  };
  ui.noteEditor = function (q) {
    var ta = ui.h('textarea.textarea', { value: CORB.get('progress.notes.' + q.id, ''), placeholder: 'Your own answer, reminders, mentor feedback…' });
    function keep() {
      if (ta.value !== CORB.get('progress.notes.' + q.id, '')) CORB.setNote(q.id, ta.value);
      document.querySelectorAll('article.qcard').forEach(function (c) { if (c.getAttribute('data-id') === q.id && c.renderAnswer) c.renderAnswer(); });
    }
    ui.modal({ title: 'My notes · ' + q.id, body: ui.h('div', {}, ui.h('p.small.muted', {}, q.question), ta,
      ui.h('p.small.muted.mt-2', {}, 'Save note keeps it in this browser. Save to file also writes your notes into the Board Ready file, so they are still there after a restart.')),
      actions: [{ label: 'Cancel' }, { label: 'Save to file', onClick: function () { keep(); ui.saveNotesToFile(); } }, { label: 'Save note', primary: true, onClick: function () { keep(); ui.toast('Note saved in this browser', 'ok'); } }] });
  };
  // Writes every note into this HTML file (CORB.store.saveNotesToFile) and says where they went.
  ui.saveNotesToFile = function () {
    var p; try { p = CORB.store.saveNotesToFile(); } catch (e) { p = Promise.reject(e); }
    return p.then(function (r) {
      if (!r || r.how === 'cancel') return r;
      var what = CORB.util.plural(r.count, 'note');
      if (r.how === 'file') ui.toast(what + ' saved into ' + r.name + '. Open that file next time.', 'ok', 5200);
      else ui.modal({ title: 'Your notes are in a new copy of the app', body: ui.h('div.stack', {},
        ui.h('p', {}, 'This browser does not let the app write to its own file, so it downloaded a copy named ', ui.h('b', {}, r.name), ' with ' + what + ' inside.'),
        ui.h('p', {}, 'Move that copy to where you keep Board Ready (Documents or OneDrive), replace the old file with it, and open it from there next time. Your notes come back even if the browser was cleared.')),
        actions: [{ label: 'Got it', primary: true }] });
      return r;
    }).catch(function (e) { ui.toast('Notes were not saved into the file: ' + ((e && e.message) || e), 'danger', 6000); });
  };
  // ---- developer and maintainer contact (meta.maintainer) ----
  // ui.maintainer() -> { role, name, email } or null.
  // ui.maintainerMailto(page) -> a mailto that opens a problem report; page defaults to the current screen, '' leaves it blank.
  ui.maintainer = function () {
    var m = (CORB.DATA && CORB.DATA.meta && CORB.DATA.meta.maintainer) || null;
    if (!m || !m.email) return null;
    return { role: String(m.role || 'Developer and maintainer'), name: String(m.name || m.email), email: String(m.email) };
  };
  ui.maintainerMailto = function (page) {
    var who = ui.maintainer(); if (!who) return '';
    var meta = (CORB.DATA && CORB.DATA.meta) || {}, app = meta.app_name || 'Board Ready';
    if (page == null) { var r = (CORB.route && CORB.route()) || {}; page = (CORB.views && CORB.views[r.id] && CORB.views[r.id].title) || ''; }
    var words = who.name.split(/\s+/);
    var greeting = words.length > 2 ? words[0] + ' ' + words[words.length - 1] : who.name;
    var body = [
      greeting + ',', '',
      'I ran into a problem with ' + app + '.', '',
      'What happened:', '', '',
      'Where it happened (page, question ID, or game):', page || '', '',
      'What I expected to happen:', '', '',
      'Device and browser (for example, NIPR laptop with Edge):', '', '',
      app + ' version ' + (meta.version || CORB.VERSION || '') + (meta.content_verified_on ? ', content verified ' + meta.content_verified_on : ''), '',
      'V/R,', '', '[Rank and name]', '[Unit and phone]'
    ].join('\r\n');
    return 'mailto:' + who.email + '?subject=' + encodeURIComponent(app + ': problem report' + (page ? ' (' + page + ')' : '')) + '&body=' + encodeURIComponent(body);
  };
})();
