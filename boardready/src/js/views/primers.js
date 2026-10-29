/* VIEW: primers — Study primers.
   Index: cards grouped by domain with read-state, read-time, confidence and flag badges.
   Reader (?id=): sticky table of contents, sections via CORB.ui.rich, key cites as link chips,
   board angles as a Q → ideal-answer accordion, related questions as compact question cards,
   mark-as-read, prev/next, quiz and mentor hand-offs.
   Data: CORB.DATA.primers (CONTRACT.md §3). Tolerates draft shapes; renders an empty state when absent.
   Persists: progress.path.primersRead (map id → date), progress.path.primersLast (id), settings.primers.filter. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon;
  var WPM = 200, PAGE = 60, RELATED_FIRST = 4, RELATED_MAX = 12;
  var KNOWN = { official: 1, 'ai-draft': 1, open: 1, 'verify-locally': 1, 'korea-verify-cp': 1, 'rfo-updated': 1, 'rfo-unverifiable': 1, pending: 1 };
  var cleanups = [];
  function later(fn) { cleanups.push(fn); }
  function leave() { var fns = cleanups.splice(0); fns.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  /* ---------- tolerant readers over the data module ---------- */
  function str(v) { return v == null ? '' : String(v); }
  function arr(v) { return Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]); }
  function text(v) {
    if (v == null) return '';
    if (Array.isArray(v)) return v.map(text).filter(Boolean).join('\n\n');
    if (typeof v === 'object') return text(v.body || v.text || v.content);
    return String(v);
  }
  function words(t) { var m = str(t).match(/\S+/g); return m ? m.length : 0; }
  function domainRank(d) { var i = (CORB.data && CORB.data.DOMAINS || []).indexOf(d); return i < 0 ? 999 : i; }
  function fmtDay(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
    var d = new Date(v + 'T00:00:00'); if (isNaN(d)) return v;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function sections(p) {
    return arr(p.sections).map(function (s, i) {
      if (s == null) return null;
      if (typeof s === 'string') return s.trim() ? { heading: 'Section ' + (i + 1), body: s } : null;
      var body = text(s.body || s.text || s.content);
      var heading = str(s.heading || s.title || s.name).trim() || ('Section ' + (i + 1));
      return body.trim() || (s.heading || s.title) ? { heading: heading, body: body } : null;
    }).filter(Boolean);
  }
  function cites(p) {
    var seen = {};
    return arr(p.key_cites || p.cites || p.citations).map(function (c) {
      if (c == null) return null;
      var obj = typeof c === 'object' ? c : null;
      var ref = (obj ? str(obj.ref || obj.cite || obj.citation || obj.title || obj.name) : str(c)).trim();
      if (!ref || seen[ref]) return null; seen[ref] = 1;
      var url = obj && obj.url ? str(obj.url) : '';
      if (!url && CORB.data && CORB.data.citeUrl) { try { url = str(CORB.data.citeUrl(ref)); } catch (e) { url = ''; } }
      if (!/^https?:\/\//i.test(url)) url = '';
      var note = obj ? str(obj.note || obj.why || obj.summary || (obj.title && obj.title !== ref ? obj.title : '')).trim() : '';
      return { ref: ref, url: url, note: note };
    }).filter(Boolean);
  }
  function parseAngle(s) {
    var m = /^\s*(?:Q\s*:\s*)?([\s\S]*?)\s*(?:\n+\s*(?:A|Answer|Ideal answer)\s*:\s*|\s+A:\s+)([\s\S]+)$/.exec(s);
    return m ? { q: m[1].trim(), a: m[2].trim() } : { q: s.trim(), a: '' };
  }
  function angles(p) {
    return arr(p.board_angles || p.angles || p.probes).map(function (a) {
      if (a == null) return null;
      var out;
      if (typeof a === 'string') { out = parseAngle(a); out.cite = ''; out.tip = ''; }
      else {
        out = {
          q: text(a.question || a.q || a.probe || a.prompt || a.angle || a.ask || a.title).trim(),
          a: text(a.ideal_answer || a.answer || a.a || a.ideal || a.response || a.model_answer || a.what_good_looks_like).trim(),
          cite: arr(a.cite || a.cites || a.citation || a.citations).map(text).filter(Boolean).join('; '),
          tip: text(a.tip || a.board_tip || a.why).trim()
        };
      }
      return out.q ? out : null;
    }).filter(Boolean);
  }
  function flags(p) {
    var out = [];
    arr(p.flags).forEach(function (f) { f = str(f).trim(); if (!f) return; if (f === 'ai-drafted') f = 'ai-draft'; if (out.indexOf(f) < 0) out.push(f); });
    return out;
  }
  function confidence(p) {
    var c = p.confidence, level = '', reason = str(p.confidence_reason || p.confidence_note).trim();
    if (c && typeof c === 'object') { level = str(c.level || c.value || c.rating); reason = reason || str(c.reason || c.why || c.note).trim(); }
    else level = str(c);
    level = level.toLowerCase();
    if (/high|verified/.test(level)) level = 'high'; else if (/med/.test(level)) level = 'medium'; else if (/low|unver/.test(level)) level = 'low'; else level = '';
    return { level: level, reason: reason };
  }
  function minutes(e) {
    var n = words(e.summary);
    e.sections.forEach(function (s) { n += words(s.heading) + words(s.body); });
    e.angles.forEach(function (a) { n += words(a.q) + words(a.a); });
    return Math.max(1, Math.round(n / WPM));
  }

  function entries() {
    var raw = CORB.DATA && CORB.DATA.primers;
    if (raw && !Array.isArray(raw) && typeof raw === 'object') raw = raw.primers || raw.items || raw.list || null; // tolerate a wrapped draft module
    if (!Array.isArray(raw)) return [];
    var seen = {};
    var out = [];
    raw.forEach(function (p, i) {
      if (!p || typeof p !== 'object' || !(p.title || p.id)) return;
      var id = str(p.id).trim() || ('primer-' + (i + 1));
      while (seen[id]) id += '-' + (i + 1);
      seen[id] = 1;
      var e = { id: id, p: p, i: i, domain: str(p.domain).trim() || 'General Contracting', title: str(p.title).trim() || ('Primer ' + (i + 1)), summary: text(p.summary).trim(), sections: sections(p), cites: cites(p), angles: angles(p), flags: flags(p), confidence: confidence(p) };
      out.push(e);
    });
    out.sort(function (a, b) { return (domainRank(a.domain) - domainRank(b.domain)) || a.domain.localeCompare(b.domain) || (a.i - b.i); });
    out.forEach(function (e, n) { e.n = n; e.minutes = minutes(e); });
    return out;
  }

  function related(e) {
    var out = [], seen = {};
    arr(e.p.related_questions || e.p.related || e.p.question_ids).forEach(function (r) {
      var id = typeof r === 'string' ? r : str(r && (r.id || r.qid || r.question_id));
      id = id.trim(); if (!id || seen[id]) return;
      var q = null; try { q = CORB.data && CORB.data.byId ? CORB.data.byId(id) : null; } catch (err) { q = null; }
      if (q && q.id) { seen[id] = 1; out.push(q); }
    });
    var explicit = out.length;
    if (out.length < 3 && CORB.data && CORB.data.search) {
      try {
        var hits = CORB.data.search(e.title + ' ' + e.title + ' ' + e.summary.slice(0, 240), { types: ['Question'], limit: 16 });
        var same = hits.filter(function (x) { return x.ref && x.ref.domain === e.domain; }), other = hits.filter(function (x) { return !(x.ref && x.ref.domain === e.domain); });
        same.concat(other).forEach(function (x) { var q = x.ref; if (out.length >= RELATED_MAX || !q || !q.id || seen[q.id]) return; seen[q.id] = 1; out.push(q); });
      } catch (err) {}
    }
    return { items: out, explicit: explicit };
  }

  /* ---------- read state ---------- */
  function readMap() { var m = CORB.get('progress.path.primersRead'); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; }
  function isRead(id) { return !!readMap()[id]; }
  function setRead(id, on) { var m = Object.assign({}, readMap()); if (on) m[id] = CORB.util.today(); else delete m[id]; CORB.set('progress.path.primersRead', m); return on; }

  /* ---------- navigation ---------- */
  function has(view) { return !!(CORB.views && CORB.views[view]); }
  function open(id) { CORB.go('primers', { id: id }); }
  function goQuiz(domain) {
    if (has('quiz')) return CORB.go('quiz', { domain: domain, n: 10 });
    ui.toast('Quiz mode is not in this copy yet. Opening the library for ' + domain + '.');
    goLibrary({ domain: domain });
  }
  function goMentor(e) {
    var q = ('Coach me on "' + e.title + '" (' + e.domain + '). What will the board probe, and how should I answer?').slice(0, 200);
    if (has('mentor')) return CORB.go('mentor', { q: q });
    ui.toast('The mentor is not in this copy yet.', 'warn');
  }
  function goLibrary(params) { if (has('library')) CORB.go('library', params || {}); else ui.toast('The question library is not in this copy yet.', 'warn'); }

  /* ---------- shared pieces ---------- */
  // opts.confidence: false hides the confidence badge (the index cards drop it; the reader keeps it).
  // opts.aiDraftNoted: true drops the ai-draft flag badge because a page-level note already said it once.
  function badges(e, opts) {
    opts = opts || {};
    var flags = opts.aiDraftNoted ? e.flags.filter(function (f) { return f !== 'ai-draft'; }) : e.flags;
    var out = flags.map(function (f) { var b = KNOWN[f] ? ui.badge(f) : ui.badge(f, f.replace(/[-_]+/g, ' ')); if (!KNOWN[f]) b.classList.add('neutral'); return b; });
    if (opts.confidence !== false && e.confidence.level) {
      var c = ui.badge('confidence-' + e.confidence.level, 'Confidence · ' + e.confidence.level);
      c.classList.add('p-conf'); if (e.confidence.reason) c.title = e.confidence.reason;
      out.push(c);
    }
    return out;
  }
  function timeTag(e) { return h('span.p-time', {}, icon('clock'), e.minutes + ' min read'); }
  function spokenText(e) {
    return [e.title, e.summary].concat(e.sections.map(function (s) { return s.heading + '. ' + s.body; })).filter(Boolean).join('. ');
  }

  /* ---------- empty states ---------- */
  function renderEmpty(root) {
    root.appendChild(h('div.p-empty-wrap', {},
      h('header.page-head', {}, h('div.eyebrow', {}, 'Prepare'), h('h1', {}, 'Study primers')),
      h('div.empty.p-empty', {},
        h('div.p-empty-icon', {}, icon('layers')),
        h('h3', {}, 'No study primers in this copy yet'),
        h('p', {}, 'Primers are mentor-voice explainers, one per topic, grouped by domain with the citations and board angles that matter. This build shipped without the primers module, or the facilitator has not added any. The question library, flashcards and mentor still work.'),
        h('div.row.p-empty-actions', {},
          h('button.btn.primary', { onclick: function () { goLibrary({}); } }, icon('book'), 'Open the question library'),
          h('button.btn', { onclick: function () { if (has('mentor')) CORB.go('mentor'); else ui.toast('The mentor is not in this copy yet.', 'warn'); } }, icon('chat'), 'Ask the mentor')))));
  }
  function renderMissing(root, id, all) {
    root.appendChild(h('div.p-empty-wrap', {},
      h('div.empty.p-empty', {},
        h('div.p-empty-icon', {}, icon('search')),
        h('h3', {}, 'That primer is not in this copy'),
        h('p', {}, 'Nothing matches the id "' + id + '". It may have been renamed or removed when this file was rebuilt.'),
        h('div.row.p-empty-actions', {},
          h('button.btn.primary', { onclick: function () { CORB.go('primers'); } }, icon('layers'), 'All primers'),
          all[0] ? h('button.btn', { onclick: function () { open(all[0].id); } }, 'Open the first primer', icon('arrow-right')) : null))));
  }

  /* ---------- index ---------- */
  function renderIndex(root, all, params) {
    var state = { q: str(params.q), filter: str(CORB.get('settings.primers.filter')) || 'all', domain: str(params.domain), showAll: false };
    if (['all', 'unread', 'read'].indexOf(state.filter) < 0) state.filter = 'all';
    var domains = []; all.forEach(function (e) { if (domains.indexOf(e.domain) < 0) domains.push(e.domain); });
    if (state.domain && domains.indexOf(state.domain) < 0) state.domain = '';

    var allDraft = all.length > 0 && all.every(function (e) { return e.flags.indexOf('ai-draft') >= 0; });

    var head = h('header.page-head', {},
      h('div.eyebrow', {}, 'Prepare · ' + CORB.util.plural(all.length, 'primer') + ' · ' + CORB.util.plural(domains.length, 'domain')),
      h('h1', {}, 'Study primers'),
      h('p.lede', {}, 'Mentor-voice explainers for the topics boards actually probe.'),
      allDraft ? h('div.callout.warn.p-alldraft', {}, icon('spark'), h('div', {}, h('b', {}, 'AI draft · verify'), ' Every primer here is an unverified AI draft. Check citations and thresholds before you rely on one.')) : null);

    // progress hero — nothing to show off until at least one primer is read
    var read = readMap();
    var readN = all.filter(function (e) { return read[e.id]; }).length;
    var last = str(CORB.get('progress.path.primersLast'));
    var nextUp = all.filter(function (e) { return e.id === last && !read[e.id]; })[0] || all.filter(function (e) { return !read[e.id]; })[0] || null;
    var domainsRead = {}; all.forEach(function (e) { if (read[e.id]) domainsRead[e.domain] = 1; });
    var hero;
    if (!readN) {
      hero = h('section.p-hero.p-hero-start', { 'aria-label': 'Start reading' },
        h('div.p-hero-copy', {},
          h('p.muted', {}, CORB.util.plural(all.length, 'primer') + ' across ' + CORB.util.plural(domains.length, 'domain') + '.')),
        h('button.btn.primary.lg', { onclick: function () { open((nextUp || all[0]).id); } }, icon('zap'), 'Start with the first primer'));
    } else {
      var pct = CORB.util.pct(readN, all.length);
      var ring = h('div.ring.p-ring', { role: 'img', 'aria-label': pct + '% of primers read' }, h('span', {}, pct + '%'));
      ring.style.setProperty('--p', String(pct));
      hero = h('section.p-hero', { 'aria-label': 'Reading progress' },
        ring,
        h('div.p-hero-copy', {},
          h('div.eyebrow', {}, 'Your reading'),
          h('h2.p-hero-title', {}, readN === all.length ? 'Every primer read.' : readN + ' of ' + all.length + ' primers read'),
          h('p.muted', {}, readN === all.length
            ? 'Reread anything that still feels shaky, then move on to flashcards and the mock board.'
            : Object.keys(domainsRead).length + ' of ' + domains.length + ' domains touched. Mark each primer as read to keep your place and track what you have covered.')),
        h('div.p-hero-cta', {}, nextUp
          ? [h('button.btn.primary.lg', { onclick: function () { open(nextUp.id); } }, icon('play'), 'Continue reading'),
             h('div.p-hero-next', {}, h('span.muted.small', {}, 'Next up'), h('b', {}, nextUp.title), h('span.muted.small', {}, nextUp.domain + ' · ' + nextUp.minutes + ' min'))]
          : h('button.btn.lg', { onclick: function () { open(all[0].id); } }, icon('refresh'), 'Review from the top')));
    }

    // toolbar
    var search = h('input.input', { type: 'search', placeholder: 'Search primers by title, summary or cite…', value: state.q, 'aria-label': 'Search primers', oninput: CORB.util.debounce(function (ev) { state.q = ev.target.value; draw(); }, 120) });
    var seg = h('div.seg', { role: 'group', 'aria-label': 'Filter by reading status' }, [['all', 'All'], ['unread', 'Unread'], ['read', 'Read']].map(function (o) {
      return h('button', { 'data-f': o[0], onclick: function () { setFilter(o[0]); draw(); } }, o[1]);
    }));
    function setFilter(f) {
      state.filter = f; CORB.set('settings.primers.filter', f, { silent: true });
      seg.querySelectorAll('button').forEach(function (b) { var on = b.getAttribute('data-f') === f; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }
    setFilter(state.filter);
    var domSel = h('select.select.p-domain-select', { 'aria-label': 'Filter by domain', onchange: function (ev) { state.domain = ev.target.value; draw(); } },
      h('option', { value: '' }, 'All domains'), domains.map(function (d) { return h('option', { value: d, selected: d === state.domain }, d); }));
    var toolbar = h('div.toolbar.p-toolbar', {}, h('div.search.grow', {}, icon('search'), search), seg, domSel);

    var list = h('div.p-groups', { 'aria-live': 'polite' });

    function visible(rm) {
      var q = state.q.toLowerCase().trim();
      return all.filter(function (e) {
        if (state.domain && e.domain !== state.domain) return false;
        if (state.filter === 'read' && !rm[e.id]) return false;
        if (state.filter === 'unread' && rm[e.id]) return false;
        if (q) {
          var hay = (e.title + ' ' + e.summary + ' ' + e.domain + ' ' + e.sections.map(function (s) { return s.heading; }).join(' ') + ' ' + e.cites.map(function (c) { return c.ref; }).join(' ')).toLowerCase();
          if (hay.indexOf(q) < 0) return false;
        }
        return true;
      });
    }
    function card(e, k, rm) {
      var on = !!rm[e.id];
      var a = h('a.p-card' + (on ? '.is-read' : ''), { href: '#/primers?id=' + encodeURIComponent(e.id), style: { animationDelay: Math.min(k, 14) * 35 + 'ms' } },
        h('div.p-card-top', {},
          h('span.p-check' + (on ? '.on' : ''), { title: on ? 'Read ' + (fmtDay(rm[e.id]) || '') : 'Not read yet', 'aria-hidden': 'true' }, icon('check')),
          h('span.sr-only', {}, on ? 'Read. ' : 'Unread. '),
          timeTag(e)),
        h('h3.p-card-title', {}, e.title),
        e.summary ? h('p.p-card-sum', {}, e.summary) : h('p.p-card-sum.muted', {}, 'No summary yet — open the primer to read the sections.'),
        h('div.p-card-foot', {}, h('div.p-card-badges', {}, badges(e, { confidence: false, aiDraftNoted: allDraft }))),
        h('span.p-card-go', { 'aria-hidden': 'true' }, icon('arrow-right')));
      return a;
    }
    function draw() {
      var rm = readMap();
      var vis = visible(rm);
      list.innerHTML = '';
      if (!vis.length) {
        list.appendChild(h('div.empty.p-none', {}, h('h3', {}, 'No primers match'), h('p', {}, 'Try another word, or clear the filters.'),
          h('button.btn.mt-3', { onclick: function () { state.q = ''; search.value = ''; state.domain = ''; domSel.value = ''; setFilter('all'); draw(); } }, icon('x'), 'Clear filters')));
        return;
      }
      var cap = state.showAll ? vis.length : Math.min(vis.length, PAGE);
      var groups = [];
      vis.slice(0, cap).forEach(function (e) { var g = groups[groups.length - 1]; if (!g || g.domain !== e.domain) { g = { domain: e.domain, items: [] }; groups.push(g); } g.items.push(e); });
      var k = 0;
      groups.forEach(function (g) {
        var total = all.filter(function (e) { return e.domain === g.domain; });
        var done = total.filter(function (e) { return rm[e.id]; }).length;
        // an empty bar has nothing to show yet — skip it until at least one primer in the domain is read
        var bar = done ? h('div.bar.p-group-bar' + (done === total.length ? '.ok' : ''), { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total.length), 'aria-valuenow': String(done), 'aria-label': g.domain + ' primers read' }, h('span', { style: { width: CORB.util.pct(done, total.length) + '%' } })) : null;
        list.appendChild(h('section.p-group', { 'aria-label': g.domain },
          h('div.p-group-head', {},
            h('div', {}, h('h2', {}, g.domain), h('div.muted.small', {}, CORB.util.plural(total.length, 'primer') + ' · ' + done + ' read')),
            bar,
            h('button.btn.sm.ghost', { onclick: function () { goQuiz(g.domain); } }, icon('quiz'), 'Quiz this domain')),
          h('div.p-cards', {}, g.items.map(function (e) { return card(e, k++, rm); }))));
      });
      if (cap < vis.length) list.appendChild(h('div.center.mt-5', {}, h('button.btn', { onclick: function () { state.showAll = true; draw(); } }, 'Show all ' + vis.length + ' primers')));
    }

    root.appendChild(head); root.appendChild(hero); root.appendChild(toolbar); root.appendChild(list);
    draw();
  }

  /* ---------- reader ---------- */
  function renderReader(root, e, all) {
    CORB.set('progress.path.primersLast', e.id, { silent: true });
    var prev = all[e.n - 1] || null, next = all[e.n + 1] || null;
    var rel = related(e);
    var toc = [], tocItems = [], syncs = [];
    function sync() { syncs.forEach(function (fn) { fn(); }); }
    function toggleRead() { var on = !isRead(e.id); setRead(e.id, on); sync(); ui.toast(on ? 'Marked as read' : 'Marked as unread', on ? 'ok' : undefined); }
    function readControl(variant) {
      var b = h('button.btn.p-read' + (variant === 'lg' ? '' : '.sm'), { onclick: toggleRead });
      function paint() {
        var on = isRead(e.id);
        b.classList.toggle('on', on); b.classList.toggle('primary', !on && variant === 'lg');
        b.innerHTML = ''; b.appendChild(icon('check'));
        b.appendChild(document.createTextNode(on ? (variant === 'lg' ? 'Read' + (fmtDay(readMap()[e.id]) ? ' · ' + fmtDay(readMap()[e.id]) : '') : 'Read') : 'Mark as read'));
        b.title = on ? 'Marked as read. Select again to mark unread.' : 'Track this primer as read';
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      paint(); syncs.push(paint); return b;
    }

    // crumbs
    var crumbs = h('nav.p-crumbs', { 'aria-label': 'Primer navigation' },
      h('button.btn.sm.ghost', { onclick: function () { CORB.go('primers'); } }, icon('arrow-left'), 'All primers'),
      h('button.badge.neutral.p-domain-link', { onclick: function () { CORB.go('primers', { domain: e.domain }); }, title: 'See every primer in this domain' }, e.domain),
      h('span.p-pos', {}, (e.n + 1) + ' / ' + all.length),
      h('div.grow'),
      h('button.btn.icon.sm.ghost', { disabled: !prev, 'aria-label': prev ? 'Previous primer: ' + prev.title : 'No previous primer', 'data-tip': prev ? 'Previous' : null, onclick: function () { if (prev) open(prev.id); } }, icon('arrow-left')),
      h('button.btn.icon.sm.ghost', { disabled: !next, 'aria-label': next ? 'Next primer: ' + next.title : 'No next primer', 'data-tip': next ? 'Next' : null, onclick: function () { if (next) open(next.id); } }, icon('arrow-right')));

    // header
    var readOn = h('span.p-readon');
    function paintReadOn() { var v = readMap()[e.id]; readOn.innerHTML = ''; readOn.hidden = !v; if (v) { readOn.appendChild(icon('check')); readOn.appendChild(document.createTextNode('Read' + (fmtDay(v) ? ' ' + fmtDay(v) : ''))); } }
    paintReadOn(); syncs.push(paintReadOn);
    var speechBtn = null, startedHere = false;
    if (CORB.speech && CORB.speech.available) {
      speechBtn = h('button.btn.ghost.p-listen', { 'aria-label': 'Read this primer aloud', onclick: function () {
        if (CORB.speech.speaking && startedHere) { CORB.speech.stop(); return; }
        startedHere = true;
        if (!CORB.speech.speak(spokenText(e))) { startedHere = false; ui.toast('Text-to-speech is turned off in Settings.'); }
      } }, icon('volume'), 'Listen');
      later(CORB.on('speech', function (s) {
        var on = !!(s && s.speaking) && startedHere; if (!(s && s.speaking)) startedHere = false;
        speechBtn.innerHTML = ''; speechBtn.appendChild(icon(on ? 'stop' : 'volume')); speechBtn.appendChild(document.createTextNode(on ? 'Stop' : 'Listen')); speechBtn.classList.toggle('on', on);
      }));
      later(function () { if (startedHere) CORB.speech.stop(); });
    }
    var headEl = h('header.p-head', {},
      h('h1.p-title', {}, e.title),
      e.summary ? h('p.lede', {}, e.summary) : null,
      h('div.p-meta', {}, timeTag(e), badges(e), readOn),
      h('div.p-actions', {},
        readControl('lg'),
        h('button.btn', { onclick: function () { goQuiz(e.domain); } }, icon('quiz'), 'Quiz me on this domain'),
        h('button.btn', { onclick: function () { goMentor(e); } }, icon('chat'), 'Ask the mentor about this'),
        speechBtn));

    var callout = null;
    if (e.flags.indexOf('ai-draft') >= 0 || e.confidence.reason) {
      callout = h('div.callout.warn.p-callout', {}, icon('spark'), h('div', {},
        h('b', {}, e.flags.indexOf('ai-draft') >= 0 ? 'AI-drafted primer — verify before you rely on it' : 'Confidence note'),
        e.confidence.reason || 'Check every cite and threshold against acquisition.gov and current Army policy before you use it at the board.'));
    }

    // sections
    var secWrap = h('div.p-sections');
    if (e.sections.length) {
      e.sections.forEach(function (s, i) {
        var n = String(i + 1).padStart(2, '0');
        var sec = h('section.p-section', { id: 'p-sec-' + (i + 1) }, h('h2.p-h2', { tabindex: '-1' }, h('span.p-num', {}, n), s.heading), s.body ? ui.rich(s.body, { cls: 'p-body' }) : h('p.muted.small', {}, 'No text in this section yet.'));
        toc.push({ label: s.heading, n: n, el: sec });
        secWrap.appendChild(sec);
      });
    } else {
      secWrap.appendChild(h('div.callout.info', {}, icon('info'), h('div', {}, h('b', {}, 'This primer has no sections yet'), 'Use the board angles and related questions below, and ask the mentor for the explanation.')));
    }

    // key cites
    var citesBlock = null;
    if (e.cites.length) {
      citesBlock = h('section.p-block#p-cites', {},
        h('div.p-block-head', {}, h('div', {}, h('h2.p-h2', { tabindex: '-1' }, 'Key citations'), h('p.muted.small', {}, 'Open the current text on acquisition.gov or eCFR. RFO numbering unless marked otherwise.'))),
        h('div.chips.p-cite-list', {}, e.cites.map(function (c) {
          var inner = [icon(c.url ? 'external' : 'book'), h('span.p-cite-ref', {}, c.ref), c.note ? h('span.p-cite-note', {}, c.note) : null];
          return c.url
            ? h('a.chip.p-cite', { href: c.url, target: '_blank', rel: 'noopener', title: (c.note ? c.note + ' · ' : '') + 'Opens in a new tab' }, inner)
            : h('span.chip.p-cite.off', { title: 'No link resolved for this citation' }, inner);
        })));
      toc.push({ label: 'Key citations', icon: 'link', el: citesBlock });
    }

    // board angles
    var anglesBlock = null;
    if (e.angles.length) {
      var angleEls = e.angles.map(function (a, i) {
        var body = [];
        if (a.a) body.push(h('div.eyebrow.p-ideal', {}, 'Ideal answer'), ui.rich(a.a, { cls: 'p-angle-a' }));
        else body.push(h('p.muted.small', {}, 'No model answer supplied. Say yours aloud, then check it against the sections above.'));
        if (a.cite) body.push(h('div.p-angle-cite', { html: 'Cite: ' + ui.linkCites(ui.esc(a.cite)) }));
        if (a.tip) body.push(h('div.callout.info.mt-3', {}, icon('spark'), h('div', {}, h('b', {}, 'Board tip'), a.tip)));
        return h('details.acc.p-angle', {}, h('summary', {}, h('span.p-qmark', {}, 'Q' + (i + 1)), h('span.p-angle-q', {}, a.q), icon('chevron', 'chev')), h('div.acc-body', {}, body));
      });
      var allOpen = false;
      var toggleAll = h('button.btn.sm.ghost', { onclick: function () { allOpen = !allOpen; angleEls.forEach(function (d) { d.open = allOpen; }); toggleAll.innerHTML = ''; toggleAll.appendChild(icon(allOpen ? 'eye-off' : 'eye')); toggleAll.appendChild(document.createTextNode(allOpen ? 'Collapse all' : 'Expand all')); } }, icon('eye'), 'Expand all');
      anglesBlock = h('section.p-block#p-angles', {},
        h('div.p-block-head', {}, h('div', {}, h('h2.p-h2', { tabindex: '-1' }, 'Board angles'), h('p.muted.small', {}, 'How a board member turns this topic into a question. Answer each one aloud in under 90 seconds before you open the ideal answer.')), toggleAll),
        h('div.p-angle-list', {}, angleEls));
      toc.push({ label: 'Board angles', icon: 'users', el: anglesBlock });
    }

    // related questions
    var relatedBlock = null;
    if (rel.items.length) {
      var relList = h('div.p-related-list');
      function drawRel(n) {
        relList.innerHTML = '';
        rel.items.slice(0, n).forEach(function (q) {
          var c;
          try { c = ui.questionCard(q, { showAnswer: false, showDeck: false }); }
          catch (err) { c = h('article.qcard', { tabindex: '0' }, h('div.q-text', {}, str(q.question || q.id || 'Question'))); }
          relList.appendChild(c);
        });
        if (n < rel.items.length) relList.appendChild(h('div.center.mt-2', {}, h('button.btn.sm', { onclick: function () { drawRel(rel.items.length); } }, 'Show ' + (rel.items.length - n) + ' more')));
      }
      drawRel(RELATED_FIRST);
      var domainCount = 0; try { domainCount = CORB.data.questions({ domain: e.domain }).length; } catch (err) {}
      relatedBlock = h('section.p-block.p-related#p-related', {},
        h('div.p-block-head', {}, h('div', {}, h('h2.p-h2', { tabindex: '-1' }, 'Related board questions'), h('p.muted.small', {}, rel.explicit ? 'Hand-picked from the question bank for this primer.' : 'Matched from the question bank by topic.'))),
        relList,
        h('div.p-related-foot', {}, h('button.btn.sm', { onclick: function () { goLibrary({ domain: e.domain }); } }, icon('book'), domainCount ? 'All ' + CORB.util.plural(domainCount, 'question') + ' in ' + e.domain : 'Browse the library for ' + e.domain, icon('arrow-right'))));
      toc.push({ label: 'Related questions', icon: 'book', el: relatedBlock });
    }

    // finish + pager
    var finish = h('section.p-finish', {},
      h('div.p-finish-copy', {}, h('div.eyebrow', {}, 'Wrap up'), h('h2.p-h2', { tabindex: '-1' }, 'Finished this primer?'), h('p.muted', {}, 'Mark it read to keep your place, then test the domain while it is fresh.')),
      h('div.p-finish-actions', {},
        readControl('lg'),
        next ? h('button.btn', { onclick: function () { if (!isRead(e.id)) setRead(e.id, true); open(next.id); } }, 'Mark read & continue', icon('arrow-right')) : null,
        h('button.btn', { onclick: function () { goQuiz(e.domain); } }, icon('quiz'), 'Quiz me on this domain')));
    function pagerLink(t, dir) {
      if (!t && dir === 'prev') return h('div.p-pager-link.empty', {}, h('span.p-pager-label', {}, icon('arrow-left'), 'Previous'), h('b', {}, 'This is the first primer'));
      if (!t) return h('a.p-pager-link.next', { href: '#/primers' }, h('span.p-pager-label', {}, 'Next', icon('arrow-right')), h('b', {}, 'Back to all primers'), h('span.muted.small', {}, 'You have reached the last primer'));
      return h('a.p-pager-link.' + dir, { href: '#/primers?id=' + encodeURIComponent(t.id) },
        h('span.p-pager-label', {}, dir === 'prev' ? [icon('arrow-left'), 'Previous'] : ['Next', icon('arrow-right')]),
        h('b', {}, t.title),
        h('span.muted.small', {}, t.domain + ' · ' + t.minutes + ' min' + (isRead(t.id) ? ' · read' : '')));
    }
    var pager = h('nav.p-pager', { 'aria-label': 'Previous and next primer' }, pagerLink(prev, 'prev'), pagerLink(next, 'next'));

    // table of contents
    function jump(i) {
      var t = toc[i]; if (!t) return;
      try { t.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (err) { t.el.scrollIntoView(); }
      var hd = t.el.querySelector('h2'); if (hd) { try { hd.focus({ preventScroll: true }); } catch (err2) { hd.focus(); } }
    }
    var tocList = h('ol.p-toc-list', {}, toc.map(function (t, i) {
      var b = h('button.p-toc-item', { onclick: function () { jump(i); } }, h('span.p-toc-n', {}, t.icon ? icon(t.icon) : t.n), h('span.p-toc-label', {}, t.label));
      tocItems.push(b); return h('li', {}, b);
    }));
    var aside = h('aside.p-aside', { 'aria-label': 'On this page' },
      h('div.p-toc', {},
        h('div.p-toc-head', {}, h('span.eyebrow', {}, 'On this page'), h('span.muted.small.p-toc-time', {}, icon('clock'), e.minutes + ' min')),
        toc.length ? tocList : h('p.muted.small', {}, 'Nothing to navigate yet.'),
        h('div.p-toc-foot', {}, readControl('sm'), h('button.btn.sm.ghost', { onclick: function () { goMentor(e); } }, icon('chat'), 'Ask mentor'))));

    // assemble
    var bar = h('div.p-progress', { 'aria-hidden': 'true' }, h('span'));
    var article = h('article.p-article', {}, headEl, callout, secWrap, citesBlock, anglesBlock, relatedBlock, finish, pager);
    root.appendChild(h('div.p-reader', {}, bar, crumbs, h('div.p-layout', {}, article, aside)));

    // scroll spy + reading progress
    var ticking = false, lastActive = -1;
    function spy() {
      if (ticking) return; ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        if (!document.body.contains(article)) return;
        var r = article.getBoundingClientRect(), vh = window.innerHeight || 1;
        var total = r.height - vh; var done = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
        bar.firstChild.style.width = Math.round(done * 100) + '%';
        var strip = window.matchMedia && window.matchMedia('(max-width: 1000px)').matches;
        var line = 60 + (strip ? aside.offsetHeight : 0) + 28;
        var active = 0;
        for (var i = 0; i < toc.length; i++) { if (toc[i].el.getBoundingClientRect().top <= line) active = i; }
        if (active !== lastActive) {
          lastActive = active;
          tocItems.forEach(function (b, i) { b.classList.toggle('on', i === active); if (i === active) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
        }
      });
    }
    window.addEventListener('scroll', spy, { passive: true });
    window.addEventListener('resize', spy);
    later(function () { window.removeEventListener('scroll', spy); window.removeEventListener('resize', spy); });
    var t0 = setTimeout(spy, 60); later(function () { clearTimeout(t0); });
  }

  CORB.registerView({
    id: 'primers', title: 'Study primers', icon: 'layers', section: 'Prepare', order: 40, nav: true, short: 'Primers',
    render: function (root, ctx) {
      leave();
      var params = (ctx && ctx.params) || {};
      var all = entries();
      if (!all.length) return renderEmpty(root);
      var id = str(params.id);
      if (id) { var e = all.filter(function (x) { return x.id === id; })[0]; return e ? renderReader(root, e, all) : renderMissing(root, id, all); }
      renderIndex(root, all, params);
    },
    onLeave: leave
  });
})();
