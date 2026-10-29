/* CORE-03-UI — DOM helpers, icons, badges, rich text with citation and glossary links, modal, toast, search palette */
(function () {
  'use strict';
  var CORB = window.CORB;
  var ui = CORB.ui = {};

  ui.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // hyperscript: h('div.card#id', {attrs}, ...children). Strings are text (escaped).
  ui.h = function (tag, attrs) {
    var m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag || 'div');
    var el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) m[2].match(/[.#][\w-]+/g).forEach(function (t) { if (t[0] === '.') el.classList.add(t.slice(1)); else el.id = t.slice(1); });
    var children = Array.prototype.slice.call(arguments, 2);
    if (attrs && (attrs instanceof Node || typeof attrs !== 'object' || Array.isArray(attrs))) { children.unshift(attrs); attrs = null; }
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class' || k === 'className') String(v).split(/\s+/).filter(Boolean).forEach(function (c) { el.classList.add(c); });
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (p) { if (p.indexOf('--') === 0) el.style.setProperty(p, v[p]); else el.style[p] = v[p]; });
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
  var h = ui.h;
  ui.mount = function (root, nodes) { root.innerHTML = ''; (Array.isArray(nodes) ? nodes : [nodes]).forEach(function (n) { if (n) root.appendChild(n); }); return root; };

  // ---- icons (inline SVG, 24 viewBox, stroke) ----
  var P = {
    dot: '<circle cx="12" cy="12" r="3"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', home: '<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>',
    school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6"/>',
    certificate: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 8h10M7 11h6"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M15 19.5V23l1.5-1 1.5 1v-3.5"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    steps: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    quiz: '<path d="M9 11l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="3"/>',
    cards: '<rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>',
    gamepad: '<rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 11v4M5 13h4M15 12h.01M18 14h.01"/>',
    glossary: '<path d="M4 6h16M4 12h10M4 18h7"/><path d="M17 15l4 4M19 13a3 3 0 1 1-3 3"/>',
    scale: '<path d="M12 3v18M5 21h14M3 7h18M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', text: '<path d="M3 19l5-14 5 14M5 14h6"/><path d="M15 19l3.5-9 3.5 9M16.2 16h4.6"/>',
    play: '<path d="M6 4l14 8-14 8z"/>', stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>', volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"/>',
    check: '<path d="M5 12l4 4L19 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', chevron: '<path d="M6 9l6 6 6-6"/>', 'chevron-right': '<path d="M9 6l6 6-6 6"/>', 'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>', 'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    flag: '<path d="M5 22V4a1 1 0 0 1 1-1h11l-2 4 2 4H6"/>', star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3.5 9.6l6.2-.9z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    download: '<path d="M12 3v12M6 11l6 6 6-6M4 21h16"/>', upload: '<path d="M12 21V9M6 13l6-6 6 6M4 3h16"/>', print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
    shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17h.01"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>', plus: '<path d="M12 5v14M5 12h14"/>', edit: '<path d="M4 20h4l11-11-4-4L4 16z"/><path d="M13 7l4 4"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', external: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/>', compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7"/>', 'bar-chart': '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>', note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>', save: '<path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
    map: '<path d="M9 4l6 2 6-2v14l-6 2-6-2-6 2V6z"/><path d="M9 4v14M15 6v14"/>', key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l2 2M14 9l2 2"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15 15.5a5 5 0 0 1 6.5 4.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.3 2.3c-.6.3-.9.8-.9 1.5v.5M12 17h.01"/>', zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    message: '<path d="M4 4h16v12H8l-4 4z"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>', filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>', bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    puzzle: '<path d="M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3h7z"/>', phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
    hand: '<path d="M8 12V6a2 2 0 1 1 4 0v5M12 11V4a2 2 0 1 1 4 0v7M16 11V7a2 2 0 1 1 4 0v8a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.4-3.4L4.5 14a2 2 0 0 1 3.5-2l1 1.5"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>', repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    'eye-off': '<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17.4 17.4 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7a9.6 9.6 0 0 0 4.3-1"/>',
    dollar: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', truck: '<path d="M1 4h14v12H1zM15 8h4l4 4v4h-8z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>', briefcase: '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 13h20"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>', pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    landmark: '<path d="M3 21h18M4 10h16M12 3l8 5H4z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/>', trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'
  };
  ui.icon = function (name, cls) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('data-icon', name); if (cls) s.setAttribute('class', cls); s.innerHTML = P[name] || P.dot; return s; };

  // ---- badges ----
  ui.badge = function (kind, label, iconName) { return h('span.badge.' + kind, {}, iconName ? ui.icon(iconName) : null, label); };
  ui.verifyBadge = function (tip) { var b = ui.badge('verify', 'Verify locally', 'flag'); b.title = tip || 'Confirm this with your supervisor, your KMG or the policy office before you rely on it.'; return b; };
  ui.phaseBadge = function (id, short) { var p = CORB.data.phase(id); if (!p) return null; return h('span.badge.ph-' + p.id, { title: p.code + ' ' + p.name }, h('span.phase-dot.ph-' + p.id), short ? p.short : (p.code ? p.code + ' ' : '') + p.name); };

  // ---- rich text: plain text -> safe HTML with paragraphs, lists, **bold**, citation links and glossary terms ----
  var CITE_RE = /\b((?:DFARS\s+PGI|AFARS\s+PGI|PGI|FAR|DFARS|AFARS)\s+(?:Part\s+|Subpart\s+)?\d{1,4}(?:\.\d{1,4})?(?:-\d{1,3})*(?:\([a-zA-Z0-9]{1,4}\))*|\d{1,2}\s+U\.S\.C\.\s+(?:§\s*)?\d{3,5}[a-z]?|\d{1,2}\s+CFR\s+(?:§\s*)?\d{1,4}(?:\.\d+)?|DoDI\s+\d{4}\.\d{2,3})/g;
  ui.linkCites = function (escaped) {
    return escaped.replace(CITE_RE, function (m) {
      var url = CORB.data && CORB.data.citeUrl ? CORB.data.citeUrl(m) : null;
      return url ? '<a class="cite" href="' + ui.esc(url) + '" target="_blank" rel="noopener" title="Open on the official site">' + m + '</a>' : '<span class="cite">' + m + '</span>';
    });
  };
  // Wraps known acronyms (the glossary) in a dotted underline the reader can tap for the meaning. First use per block only.
  ui.linkTerms = function (html, used) {
    if (!CORB.get('settings.glossaryLinks', true) || !CORB.data || !CORB.data.termRegex) return html;
    var re = CORB.data.termRegex(); if (!re) return html;
    var depth = 0;
    return html.split(/(<[^>]+>)/).map(function (seg) {
      if (seg.charAt(0) === '<') { if (/^<a[\s>]/i.test(seg) || /^<span class="cite"/.test(seg)) depth++; else if (/^<\/a>/i.test(seg) || (depth && /^<\/span>/.test(seg))) depth = Math.max(0, depth - 1); return seg; }
      if (depth) return seg;
      return seg.replace(re, function (m) { if (used[m]) return m; used[m] = 1; return '<abbr class="gl" tabindex="0" role="button" data-term="' + ui.esc(m.replace(/&amp;/g, '&')) + '">' + m + '</abbr>'; });
    }).join('');
  };
  ui.escText = function (s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
  function inline(s, used) {
    var e = ui.escText(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    return ui.linkTerms(ui.linkCites(e), used);
  }
  ui.inline = function (s) { return inline(s, {}); };
  ui.rich = function (text, opts) {
    opts = opts || {};
    var used = {};
    var t = String(text == null ? '' : text).replace(/\r/g, '');
    var LIST = /^\s*(?:[-•*]|\d+[.)])\s+/;
    // A block may mix sentences and list lines ("Ask three questions:" then "- ..."): runs of list lines become a list.
    var html = t.split(/\n\s*\n/).map(function (b) {
      var lines = b.split('\n').filter(function (l) { return l.trim().length; });
      var out = '', para = [], list = [];
      function flushPara() { if (para.length) { out += '<p>' + para.map(function (l) { return /^(cite|source)s?:/i.test(l.trim()) ? '<span class="citeline">' + inline(l, used) + '</span>' : inline(l, used); }).join('<br>') + '</p>'; para = []; } }
      function flushList() { if (list.length) { var ordered = /^\s*\d+[.)]/.test(list[0]); out += '<' + (ordered ? 'ol' : 'ul') + '>' + list.map(function (l) { return '<li>' + inline(l.replace(LIST, ''), used) + '</li>'; }).join('') + '</' + (ordered ? 'ol' : 'ul') + '>'; list = []; } }
      lines.forEach(function (l) { if (LIST.test(l)) { flushPara(); list.push(l); } else { flushList(); para.push(l); } });
      flushPara(); flushList();
      return out;
    }).join('');
    return h('div.rich' + (opts.cls ? '.' + opts.cls : ''), { html: html });
  };

  // ---- glossary popover (any .gl element, anywhere) ----
  var pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  ui.closeTermPopover = closePop;
  ui.showTerm = function (term, anchor) {
    closePop();
    var g = CORB.data.term(term); if (!g) return;
    pop = h('div.gl-pop', { role: 'dialog', 'aria-label': g.term },
      h('div.gl-term', {}, g.term), g.expansion ? h('div.gl-exp', {}, g.expansion) : null,
      h('p', {}, g.definition),
      h('div.row.tight', {},
        CORB.speech && CORB.speech.available ? h('button.btn.sm', { type: 'button', onclick: function () { CORB.speech.speak(g.term + '. ' + (g.expansion || '') + '. ' + g.definition); } }, ui.icon('volume'), 'Listen') : null,
        h('button.btn.sm', { type: 'button', onclick: function () { closePop(); CORB.go('glossary', { q: g.term }); } }, ui.icon('glossary'), 'Glossary'),
        h('button.btn.sm.ghost', { type: 'button', onclick: closePop, 'aria-label': 'Close' }, ui.icon('x'))));
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = Math.min(Math.max(12, r.left + window.scrollX), window.scrollX + document.documentElement.clientWidth - pw - 12);
    var top = r.bottom + window.scrollY + 8;
    if (r.bottom + ph + 16 > window.innerHeight && r.top > ph + 16) top = r.top + window.scrollY - ph - 8;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.gl');
    if (t) { e.preventDefault(); ui.showTerm(t.getAttribute('data-term'), t); return; }
    if (pop && !pop.contains(e.target)) closePop();
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('gl')) { e.preventDefault(); ui.showTerm(e.target.getAttribute('data-term'), e.target); }
    if (e.key === 'Escape') closePop();
  });
  window.addEventListener('hashchange', closePop);

  // ---- toast ----
  ui.toast = function (msg, kind, ms) {
    var host = document.getElementById('toasts'); if (!host) return;
    var t = h('div.toast' + (kind ? '.' + kind : ''), {}, ui.icon(kind === 'ok' ? 'check' : kind === 'danger' || kind === 'warn' ? 'alert' : 'info'), h('span', {}, msg));
    host.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, ms || 2800);
  };

  // ---- modal ----
  var modalEl = null, lastFocus = null;
  ui.closeModal = function () { if (modalEl) { modalEl.remove(); modalEl = null; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} } };
  ui.modal = function (o) {
    ui.closeModal(); lastFocus = document.activeElement;
    var body = typeof o.body === 'string' ? h('div', { html: o.body }) : o.body;
    var box = h('div.modal' + (o.wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Dialog' },
      o.title !== false ? h('div.modal-head', {}, h('h3', {}, o.title || ''), h('button.btn.icon.sm.ghost', { type: 'button', 'aria-label': 'Close', onclick: ui.closeModal }, ui.icon('x'))) : null,
      h('div.modal-body', {}, body),
      o.actions && o.actions.length ? h('div.modal-foot', {}, o.actions.map(function (a) { return h('button.btn' + (a.primary ? '.primary' : '') + (a.danger ? '.danger' : ''), { type: 'button', onclick: function () { var r = a.onClick && a.onClick(); if (r !== false && !a.keepOpen) ui.closeModal(); } }, a.icon ? ui.icon(a.icon) : null, a.label); })) : null);
    modalEl = h('div.modal-scrim', { onclick: function (e) { if (e.target === modalEl && !o.sticky) ui.closeModal(); } }, box);
    document.body.appendChild(modalEl); document.body.style.overflow = 'hidden';
    var f = box.querySelector('input, textarea, select, .modal-foot button.primary, .modal-body button, button'); if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 30);
    return box;
  };
  ui.confirm = function (msg, opts) { opts = opts || {}; return new Promise(function (res) { ui.modal({ title: opts.title || 'Please confirm', body: h('p', {}, msg), sticky: true, actions: [{ label: opts.cancel || 'Cancel', onClick: function () { res(false); } }, { label: opts.ok || 'Confirm', primary: !opts.danger, danger: !!opts.danger, onClick: function () { res(true); } }] }); }); };

  // ---- small building blocks ----
  ui.pageHead = function (o) {
    return h('header.page-head', {}, o.back ? h('a.back-link', { href: '#/' + o.back.view + (o.back.query || '') }, ui.icon('arrow-left'), o.back.label) : null,
      o.eyebrow ? h('div.eyebrow', {}, o.eyebrow) : null, h('h1', {}, o.title), o.lede ? h('p.lede', {}, o.lede) : null, o.meta ? h('div.meta-row', {}, o.meta) : null);
  };
  ui.bar = function (pct, cls) { return h('div.bar' + (cls ? '.' + cls : ''), { role: 'progressbar', 'aria-valuenow': String(Math.round(pct)), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('span', { style: { width: CORB.util.clamp(pct, 0, 100) + '%' } })); };
  ui.ring = function (pct, label, color, size) { return h('div.ring', { style: { '--p': String(CORB.util.clamp(Math.round(pct), 0, 100)), '--ring': color || 'var(--accent)', '--size': (size || 88) + 'px' }, role: 'img', 'aria-label': label || (Math.round(pct) + ' percent') }, h('span', {}, (label != null ? label : Math.round(pct) + '%'))); };
  ui.callout = function (kind, iconName, title, body) { return h('div.callout.' + kind, {}, ui.icon(iconName || 'info'), h('div', {}, title ? h('b', {}, title) : null, typeof body === 'string' ? h('span', {}, body) : body)); };
  ui.checkItem = function (o) {
    var input = h('input', { type: 'checkbox', checked: !!o.checked, 'aria-label': o.title });
    var row = h('label.check' + (o.checked ? '.done' : ''), {}, input, h('div.check-body', {}, h('div.check-title', {}, o.title), o.sub ? (typeof o.sub === 'string' ? h('div.check-sub', {}, o.sub) : o.sub) : null), o.aside || null);
    input.addEventListener('change', function () { row.classList.toggle('done', input.checked); if (o.onChange) o.onChange(input.checked); });
    return row;
  };
  ui.listenBtn = function (getText, label) {
    if (!CORB.speech || !CORB.speech.available) return null;
    var b = h('button.btn.sm', { type: 'button', 'aria-label': 'Listen' }, ui.icon('volume'), label || 'Listen');
    b.addEventListener('click', function () {
      if (b.classList.contains('speaking')) { CORB.speech.stop(); return; }
      document.querySelectorAll('.speaking').forEach(function (x) { x.classList.remove('speaking'); });
      b.classList.add('speaking'); b.lastChild.textContent = 'Stop';
      CORB.speech.speak(typeof getText === 'function' ? getText() : getText, { onend: function () { b.classList.remove('speaking'); b.lastChild.textContent = label || 'Listen'; } });
    });
    return b;
  };
  ui.extLink = function (url, label, cls) { return h('a' + (cls || ''), { href: url, target: '_blank', rel: 'noopener' }, label || url, ui.icon('external')); };
  ui.copyText = function (text) {
    function fallback() { var ta = h('textarea', { style: { position: 'fixed', top: '-1000px' } }); ta.value = text; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); ui.toast(ok ? 'Copied' : 'Select the text and copy it with Ctrl+C', ok ? 'ok' : 'warn'); }
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { ui.toast('Copied', 'ok'); }, fallback); return; } } catch (e) {}
    fallback();
  };

  // ---- search palette (press / anywhere) ----
  ui.palette = function (initial) {
    var input = h('input.input', { placeholder: 'Search lessons, terms, courses, how-to guides…', 'aria-label': 'Search', value: initial || '' });
    var results = h('div.palette-results', { role: 'listbox' });
    ui.modal({ title: false, body: h('div.palette', {}, h('div.search', {}, ui.icon('search'), input), results), wide: true });
    var sel = 0, items = [];
    function draw() {
      results.innerHTML = '';
      if (!items.length) { results.appendChild(h('div.empty', {}, input.value ? 'Nothing matches. Try a shorter word, or an acronym like KO or PWS.' : 'Type a word. Try “price analysis”, “COR”, “CON 1300V” or “protest”.')); return; }
      items.forEach(function (it, i) {
        results.appendChild(h('button.palette-item' + (i === sel ? '.on' : ''), { type: 'button', role: 'option', onclick: function () { go(it); } }, h('span.badge.neutral', {}, it.type), h('span.grow', {}, h('span.truncate', { style: { display: 'block' } }, it.title), it.sub ? h('span.sub.truncate', { style: { display: 'block' } }, it.sub) : null)));
      });
    }
    function go(it) { ui.closeModal(); CORB.go(it.view, it.params); }
    function run() { items = CORB.data.search(input.value, { limit: 14 }); sel = 0; draw(); }
    input.addEventListener('input', CORB.util.debounce(run, 80));
    input.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault(); } if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); } if (e.key === 'Enter' && items[sel]) go(items[sel]); });
    run();
  };

  // ---- developer and maintainer contact (meta.maintainer) ----
  ui.maintainer = function () { var m = CORB.meta().maintainer; return m && m.email ? m : null; };
  ui.feedbackMailto = function (kind) {
    var who = ui.maintainer(); if (!who) return '';
    var meta = CORB.meta(), r = CORB.route ? CORB.route() : {}, page = (CORB.views[r.id] && CORB.views[r.id].title) || '';
    var track = { '51c': '51C Soldier', '1102': '1102 civilian', mentor: 'Supervisor or mentor' }[CORB.get('profile.track')] || '';
    var body = kind === 'problem' ? [
      'What happened:', '', '', 'Where (page, lesson or question number): ' + page, '', 'What I expected:', '', '',
      'Device and browser (for example NIPR laptop with Edge):', '', '',
      meta.app_name + ' ' + (meta.version || '') + ' (' + CORB.edition() + ' edition, build ' + (meta.build_id || '') + ')'
    ] : [
      'B2B Exam Prep tester feedback', '', 'I am: ' + (track || '51C / 1102 / supervisor'), '',
      '1. What helped you most?', '', '', '2. What was confusing or hard to find?', '', '',
      '3. Anything wrong or out of date? (page and what it should say)', '', '',
      '4. What is missing for a brand-new 51C or 1102?', '', '', '5. Device and browser:', '', '',
      meta.app_name + ' ' + (meta.version || '') + ' (' + CORB.edition() + ' edition, build ' + (meta.build_id || '') + ')'
    ];
    return 'mailto:' + who.email + '?subject=' + encodeURIComponent(meta.app_name + (kind === 'problem' ? ': problem report' : ': tester feedback')) + '&body=' + encodeURIComponent(body.join('\r\n'));
  };
})();
