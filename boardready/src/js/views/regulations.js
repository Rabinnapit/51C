/* VIEW: regulations — Regulation explorer: RFO FAR map, old→new citation crosswalk, current thresholds, Army warrant classes.
   Data: CORB.DATA.regulations { frameworks, crosswalk, thresholds, verified_on } (+ CORB.DATA.process.warrant_classes when present).
   Tolerates draft shapes: crosswalk may be an array or { entries, unchanged }, thresholds may be an array or { thresholds, verified_on }.
   Route params: tab=map|crosswalk|thresholds|classes, fw=<framework id>, part=<part num>, q=<search text>. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, esc = ui.esc, util = CORB.util;

  var TABS = [
    { id: 'map', label: 'Map', icon: 'map' },
    { id: 'crosswalk', label: 'Crosswalk', icon: 'refresh' },
    { id: 'thresholds', label: 'Thresholds', icon: 'scale' },
    { id: 'classes', label: 'Warrant classes', icon: 'award' }
  ];
  var PAGE = 60;
  var FW_ABBR = { far: 'FAR', dfars: 'DFARS', pgi: 'DFARS PGI', afars: 'AFARS' };
  var CONF = { verified: ['check', 'Verified'], probable: ['info', 'Probable'], unverified: ['alert', 'Unverified'] };
  var CLASS_ORDER = { I: 1, II: 2, III: 3, IV: 4 };
  var HUB_URL = 'https://www.acquisition.gov/far-overhaul';

  // Army Warranting Program Policy v12 (MAR 2026) Table 1 — used only when the process module is not in the build.
  var CLASS_FALLBACK = [
    { cls: 'I', thresholds: ['SAT'], who: 'Authority at or below the simplified acquisition threshold. Below-SAT candidates follow the same training requirements as above-SAT contracting officers.', source: 'Army Warranting Program Policy v12 (MAR 2026) Table 1' },
    { cls: 'II', thresholds: ['$500K', '$1M', '$5M', 'SaP'], who: 'Above the SAT up to the simplified-procedures ceiling for commercial products and services (SaP). Candidates must meet 10 U.S.C. 1724 and DFARS 201.403 and be in an AT&L position.', source: 'Army Warranting Program Policy v12 (MAR 2026) Table 1' },
    { cls: 'III', thresholds: ['$10M', '$25M', '$50M', '$100M'], who: 'Large-dollar instruments. Moving up a class requires a new board and reappointment; increases within the same class do not.', source: 'Army Warranting Program Policy v12 (MAR 2026) Table 1' },
    { cls: 'IV', thresholds: ['$250M', '$500M', 'Unlimited'], who: 'Senior authority. An unlimited warrant requires the HCA to attest to superior judgment and a review board that cannot be waived.', source: 'Army Warranting Program Policy v12 (MAR 2026) Table 1' }
  ];
  var RULE_FALLBACK = 'The warrant must be greater than or equal to the cumulative instrument value: base value plus all options plus the anticipated or actual ceiling plus the absolute value of a modification, regardless of when funds are obligated. For a modification the warrant must equal or exceed the cumulative contract value including the modification.';

  var cur = null; // per-visit state

  // ---------------------------------------------------------------- helpers
  function norm(s) { return String(s == null ? '' : s).replace(/^\s*RFO\s+/i, '').replace(/\s+/g, ' ').trim(); }
  function ckey(s) { return norm(s).toUpperCase(); }
  function isHttp(u) { return /^https?:\/\//i.test(String(u || '')); }
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function hostOf(u) { var m = /^https?:\/\/([^\/?#]+)/i.exec(String(u || '')); return m ? m[1].replace(/^www\./, '') : ''; }
  function abbr(fw) { return (fw && (fw.abbr || fw.short)) || FW_ABBR[fw && fw.id] || String(fw && (fw.id || '')).toUpperCase(); }
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function arr(x) { return Array.isArray(x) ? x : []; }
  // YYYY-MM-DD strings parse as UTC midnight in Date(); pin them to local time so the day never shifts.
  function fmtDay(iso) { var s = String(iso || ''); if (!s) return ''; return util.fmtDate(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00' : s); }
  function citeRe(abbrText, num) { var pre = /PGI/i.test(abbrText) && !/AFARS/i.test(abbrText) ? '(?:DFARS\\s+PGI|PGI)' : escRe(abbrText); return new RegExp('^(?:RFO\\s+)?' + pre + '\\s+(?:Part\\s+|Subpart\\s+)?' + escRe(String(num)) + '(?![0-9])', 'i'); }
  function mostCommon(list) { var c = {}, best = null; list.forEach(function (x) { if (!x) return; c[x] = (c[x] || 0) + 1; if (best == null || c[x] > c[best]) best = x; }); return best; }
  // ui.rich / ui.linkCites resolve citation links through CORB.data.citeUrl, which walks the framework list; a malformed
  // framework entry must not take the whole pane down, so fall back to plain text.
  var richFn = ui.rich, linkFn = ui.linkCites;
  function rich(text, opts) { return safe(function () { return richFn.call(ui, text, opts); }, null) || h('div.rich' + (opts && opts.cls ? '.' + opts.cls : ''), {}, h('p.pre', {}, String(text == null ? '' : text))); }
  function linkCites(escaped) { return safe(function () { return linkFn.call(ui, escaped); }, escaped); }
  function fmtMoney(n) { if (n == null || isNaN(n)) return ''; if (!isFinite(n)) return 'Unlimited'; try { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); } catch (e) { return '$' + Math.round(n); } }
  function parseMoney(s) {
    var t = String(s == null ? '' : s).trim().toLowerCase().replace(/[$,\s_]/g, '');
    if (!t) return 0;
    var m = /^(\d*\.?\d+)([kmb])?$/.exec(t);
    if (!m) return NaN;
    var v = parseFloat(m[1]); if (isNaN(v)) return NaN;
    return v * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1);
  }
  function ext(url, label, cls, iconName) {
    if (!isHttp(url)) return null;
    return h('a', { class: cls || 'rg-ext', href: url, target: '_blank', rel: 'noopener noreferrer' }, label, icon(iconName || 'external'));
  }
  function confBadge(c) {
    var k = String(c || 'unverified').toLowerCase().replace(/[^\w-]/g, '');
    var m = CONF[k] || ['alert', k];
    return h('span.badge.rg-conf.rg-conf-' + k, {}, icon(m[0]), m[1]);
  }
  function statusBadge(s) {
    if (!s) return null;
    var t = String(s), kind = /reserv|remov|delet|withdrawn/i.test(t) ? 'muted' : /pend|draft|not yet|planned|unverified/i.test(t) ? 'warn' : /issued|updated|final|effective|verified|current/i.test(t) ? 'ok' : 'neutral';
    return h('span.badge.rg-st.rg-st-' + kind, {}, t);
  }
  function pill(iconName, text, kind) { return h('span.rg-pill' + (kind ? '.' + kind : ''), {}, icon(iconName), h('span', {}, text)); }
  function emptyState(iconName, title, text, action) { return h('div.empty.rg-empty', {}, h('div.rg-empty-icon', {}, icon(iconName)), h('h3', {}, title), h('p', {}, text), action || null); }
  function copyText(t, onDone) {
    var ok = function () { ui.toast('Copied ' + t, 'ok'); if (onDone) onDone(true); };
    var fail = function () { ui.toast('Copy is blocked here — select the text instead', 'warn'); if (onDone) onDone(false); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(ok, function () { legacy(); }); return; } } catch (e) {}
    legacy();
    function legacy() { try { var ta = h('textarea', { style: { position: 'fixed', opacity: '0', top: '0', left: '0' } }); ta.value = t; document.body.appendChild(ta); ta.select(); var r = document.execCommand('copy'); ta.remove(); r ? ok() : fail(); } catch (e2) { fail(); } }
  }
  function partCiteRe(fw, num) {
    var pre = fw.id === 'pgi' ? '(?:DFARS\\s+PGI|PGI)' : escRe(abbr(fw));
    var n = String(num), alts = [escRe(n)];
    if ((fw.id === 'dfars' || fw.id === 'pgi') && n.length < 3 && /^\d+$/.test(n)) alts.push('2' + ('00' + n).slice(-2));
    return new RegExp('^(?:RFO\\s+)?' + pre + '\\s+(?:Part\\s+|Subpart\\s+)?(?:' + alts.join('|') + ')(?![0-9])', 'i');
  }

  // ---------------------------------------------------------------- data
  function loadData() {
    var regs = CORB.DATA.regulations, has = !!(regs && typeof regs === 'object');
    regs = has ? regs : {};
    var frameworks = (Array.isArray(regs.frameworks) ? regs.frameworks : []).filter(function (f) { return f && f.id; });
    var cwRaw = regs.crosswalk;
    var crosswalk = (Array.isArray(cwRaw) ? cwRaw : (cwRaw && Array.isArray(cwRaw.entries) ? cwRaw.entries : [])).filter(function (e) { return e && (e.old || e.new); });
    var unchanged = (Array.isArray(regs.unchanged) ? regs.unchanged : (cwRaw && Array.isArray(cwRaw.unchanged) ? cwRaw.unchanged : [])).filter(function (u) { return u != null && String(u).trim() !== ''; });
    var thRaw = regs.thresholds;
    var thresholds = (Array.isArray(thRaw) ? thRaw : (thRaw && Array.isArray(thRaw.thresholds) ? thRaw.thresholds : [])).filter(function (t) { return t && t.name; }).map(function (t, i) { return Object.assign({}, t, { id: String(t.id || ('t' + i)), key: String(t.id || ('t' + i)).replace(/[^\w-]/g, '_') }); });
    var verifiedOn = regs.verified_on || (thRaw && !Array.isArray(thRaw) && thRaw.verified_on) || (cwRaw && !Array.isArray(cwRaw) && cwRaw.verified_on) || '';
    var partCount = frameworks.reduce(function (n, f) { return n + arr(f.parts).length; }, 0);
    return { has: has, frameworks: frameworks, crosswalk: crosswalk, unchanged: unchanged, thresholds: thresholds, verifiedOn: verifiedOn, partCount: partCount, derived: deriveParts(crosswalk) };
  }
  // When no framework catalogue is loaded, group the crosswalk by the part its RFO cite lands in so the map still has something true to show.
  function deriveParts(crosswalk) {
    var groups = {}, order = [];
    crosswalk.forEach(function (e) {
      var target = norm(e.new) || norm(e.old);
      var m = /^(DFARS PGI|AFARS PGI|PGI|FAR|DFARS|AFARS)\s+(?:Part\s+|Subpart\s+)?(\d{1,3})(?![0-9])/i.exec(target);
      var key, g;
      if (m) { key = m[1].toUpperCase() + ' ' + m[2]; if (!groups[key]) { groups[key] = { key: key, abbr: m[1].toUpperCase(), num: m[2], statute: false, title: '', pairs: [], urls: [] }; order.push(key); } }
      else if (/^\d{1,2}\s+U\.?S\.?C\b/i.test(target)) { key = 'USC'; if (!groups[key]) { groups[key] = { key: key, abbr: 'U.S.C.', num: '', statute: true, title: 'Statutes cited by the crosswalk', pairs: [], urls: [] }; order.push(key); } }
      else return;
      g = groups[key];
      g.pairs.push(e);
      if (isHttp(e.source_url)) g.urls.push(e.source_url);
      if (m && !g.title && norm(e.new).toUpperCase() === key && e.title) g.title = String(e.title).replace(/\s*\((?:part|part page)\)\s*$/i, '');
    });
    var rank = { FAR: 1, DFARS: 2, PGI: 3, 'DFARS PGI': 3, AFARS: 4, 'AFARS PGI': 5, 'U.S.C.': 9 };
    return order.map(function (k) { var g = groups[k]; g.url = mostCommon(g.urls); g.renumbered = g.pairs.filter(function (e) { return ckey(e.old) !== ckey(e.new); }).length; g.re = g.statute ? null : citeRe(g.abbr, g.num); return g; })
      .sort(function (a, b) { return (rank[a.abbr] || 8) - (rank[b.abbr] || 8) || (parseInt(a.num, 10) || 0) - (parseInt(b.num, 10) || 0); });
  }
  function findTh(D, id) { return D.thresholds.filter(function (t) { return t.id === id; })[0] || null; }

  function syncHash(st) {
    var params = { tab: st.tab };
    if (st.tab === 'map') { if (st.fw) params.fw = st.fw; if (st.part) params.part = st.part; }
    var qs = Object.keys(params).filter(function (k) { return params[k] != null && params[k] !== ''; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    try { history.replaceState(null, '', '#/regulations' + (qs ? '?' + qs : '')); } catch (e) {}
  }

  // ---------------------------------------------------------------- tabs
  function tabBar(st, D, onSelect) {
    var counts = { map: D.partCount || D.derived.length, crosswalk: D.crosswalk.length, thresholds: D.thresholds.length, classes: 0 };
    var bar = h('div.rg-tabs', { role: 'tablist', 'aria-label': 'Regulation explorer sections' });
    TABS.forEach(function (t, i) {
      var on = st.tab === t.id;
      bar.appendChild(h('button.rg-tab' + (on ? '.on' : ''), {
        role: 'tab', id: 'rg-tab-' + t.id, type: 'button', 'aria-selected': on ? 'true' : 'false', 'aria-controls': 'rg-pane-' + t.id, tabindex: on ? '0' : '-1',
        onclick: function () { onSelect(t.id); },
        onkeydown: function (e) {
          var j = i;
          if (e.key === 'ArrowRight') j = (i + 1) % TABS.length; else if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length; else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = TABS.length - 1; else return;
          e.preventDefault(); var btns = bar.querySelectorAll('.rg-tab'); if (btns[j]) { btns[j].focus(); onSelect(TABS[j].id); }
        }
      }, icon(t.icon), h('span.rg-tab-label', {}, t.label), counts[t.id] ? h('span.rg-count', {}, String(counts[t.id])) : null));
    });
    bar.sync = function () { bar.querySelectorAll('.rg-tab').forEach(function (b, i) { var on = TABS[i].id === st.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.setAttribute('tabindex', on ? '0' : '-1'); }); };
    return bar;
  }

  // ---------------------------------------------------------------- MAP
  function renderMap(pane, D, st) {
    if (!D.frameworks.length) { renderDerivedMap(pane, D, st); return; }
    var fw = D.frameworks.filter(function (f) { return f.id === st.fw; })[0] || D.frameworks[0];
    st.fw = fw.id;
    var parts = arr(fw.parts).filter(function (p) { return p && typeof p === 'object' && p.num != null; });
    var selected = parts.filter(function (p) { return String(p.num) === String(st.part); })[0] || null;
    if (!selected) st.part = '';

    var picker = h('div.rg-fw-picker', { role: 'group', 'aria-label': 'Framework' }, D.frameworks.map(function (f) {
      var on = f.id === fw.id;
      return h('button.rg-fw' + (on ? '.on' : ''), { type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: function () { if (f.id === st.fw) return; st.fw = f.id; st.part = ''; CORB.set('settings.regs.fw', f.id, { silent: true }); syncHash(st); pane.innerHTML = ''; renderMap(pane, D, st); } },
        h('span.rg-fw-abbr', {}, abbr(f)), h('span.rg-fw-name', {}, f.name || f.id), h('span.rg-fw-meta', {}, util.plural(arr(f.parts).length, 'part')));
    }));

    var intro = h('div.rg-fw-intro', {},
      h('div.grow', {}, h('h2.rg-fw-title', {}, fw.name || abbr(fw)), fw.description ? h('p.muted.rg-fw-desc', {}, fw.description) : null),
      ext(fw.url, 'Open ' + abbr(fw) + ' on ' + (hostOf(fw.url) || 'the web'), 'btn sm'));

    var grid = h('div.rg-parts');
    var detail = h('aside.rg-detail', { 'aria-live': 'polite', 'aria-label': 'Part detail' });
    var filter = h('input.input', { type: 'search', placeholder: 'Filter parts by number or title…', 'aria-label': 'Filter parts' });
    var filterCount = h('span.muted.small', {}, util.plural(parts.length, 'part'));

    function pick(p) {
      st.part = p ? String(p.num) : '';
      syncHash(st);
      grid.querySelectorAll('.rg-part').forEach(function (b) { var on = !!p && b.getAttribute('data-num') === st.part; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      drawDetail(p);
      if (p && window.innerWidth < 900) { try { detail.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }
    }
    function drawDetail(p) { detail.innerHTML = ''; detail.appendChild(p ? partDetail(fw, p, D, st, pick) : detailHint(fw, parts.length)); }

    parts.forEach(function (p, i) { grid.appendChild(partCard(fw, p, p === selected, pick, i)); });
    if (!parts.length) grid.appendChild(emptyState('layers', 'No parts catalogued for ' + abbr(fw), 'This framework is listed without parts. Use the framework link above to read it at the source.'));

    filter.addEventListener('input', util.debounce(function () {
      var t = filter.value.trim().toLowerCase(), n = 0;
      grid.querySelectorAll('.rg-part').forEach(function (b) { var hit = !t || (b.getAttribute('data-search') || '').indexOf(t) >= 0; b.hidden = !hit; if (hit) n++; });
      filterCount.textContent = t ? n + ' of ' + util.plural(parts.length, 'part') : util.plural(parts.length, 'part');
    }, 80));

    drawDetail(selected);
    pane.appendChild(picker);
    pane.appendChild(intro);
    pane.appendChild(h('div.rg-map-split', {},
      h('div.rg-map-main', {},
        h('div.rg-parts-head', {}, h('div.search.grow', {}, icon('search'), filter), filterCount),
        grid),
      detail));
  }

  // ---- derived map (no framework catalogue loaded): one card per part the crosswalk touches
  function renderDerivedMap(pane, D, st) {
    if (!D.derived.length) {
      pane.appendChild(emptyState('map', 'No regulation map in this build', 'Frameworks and parts appear here once the regulations module is merged. Until then the FAR Overhaul hub on acquisition.gov is the authoritative map of the renumbered FAR.', ext(HUB_URL, 'Open the FAR Overhaul hub', 'btn sm mt-4')));
      return;
    }
    var fws = []; D.derived.forEach(function (g) { if (fws.indexOf(g.abbr) < 0) fws.push(g.abbr); });
    var fwSel = fws.indexOf(st.fw && st.fw.toUpperCase()) >= 0 ? st.fw.toUpperCase() : fws[0];
    st.fw = fwSel.toLowerCase();
    var groups = D.derived.filter(function (g) { return g.abbr === fwSel; });
    var picker = h('div.rg-fw-picker', { role: 'group', 'aria-label': 'Framework' }, fws.map(function (a) {
      var on = a === fwSel, n = D.derived.filter(function (g) { return g.abbr === a; }).length;
      return h('button.rg-fw' + (on ? '.on' : ''), { type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: function () { if (a === fwSel) return; st.fw = a.toLowerCase(); st.part = ''; CORB.set('settings.regs.fw', st.fw, { silent: true }); syncHash(st); pane.innerHTML = ''; renderDerivedMap(pane, D, st); } },
        h('span.rg-fw-abbr', {}, a), h('span.rg-fw-name', {}, a === 'U.S.C.' ? 'United States Code' : a === 'FAR' ? 'Federal Acquisition Regulation (RFO)' : a === 'DFARS' ? 'Defense FAR Supplement' : a === 'AFARS' ? 'Army FAR Supplement' : a + ' guidance'), h('span.rg-fw-meta', {}, util.plural(n, 'part')));
    }));
    pane.appendChild(picker);
    pane.appendChild(h('div.callout.info.rg-derived-note', {}, icon('info'), h('div', {}, h('b', {}, 'Map built from the crosswalk'), 'No framework catalogue is loaded in this build, so each card below is a part that the ' + util.plural(D.crosswalk.length, 'verified citation pair') + ' land in. Open a card to see its pairs; the source link is the page those pairs were checked against.')));
    var grid = h('div.rg-parts.rg-derived');
    groups.forEach(function (g, i) {
      var top = g.pairs.filter(function (e) { return ckey(e.old) !== ckey(e.new); }).slice(0, 3);
      if (!top.length) top = g.pairs.slice(0, 3);
      grid.appendChild(h('div.rg-part.rg-dpart', { style: { animationDelay: (Math.min(i, 24) * 30) + 'ms' } },
        h('div.rg-part-top', {}, h('span.rg-part-num', {}, g.statute ? 'Statutes' : g.abbr + ' Part ' + g.num), h('span.badge.neutral', {}, util.plural(g.pairs.length, 'pair'))),
        h('div.rg-part-title', {}, g.title || (g.statute ? 'Not renumbered by the RFO' : 'Sections mapped by the crosswalk')),
        h('ul.rg-dpart-list', {}, top.map(function (e) { return h('li', {}, h('span.rg-old', {}, norm(e.old)), ckey(e.old) !== ckey(e.new) ? [icon('arrow-right'), h('span.rg-new', {}, norm(e.new))] : h('span.rg-same-tag', {}, 'unchanged')); })),
        h('div.rg-part-foot', {},
          h('button.btn.sm', { type: 'button', onclick: function () { st.select('crosswalk', g.statute ? { q: 'U.S.C.' } : { part: { abbr: g.abbr, num: g.num, label: g.abbr + ' Part ' + g.num } }); } }, icon('refresh'), g.renumbered ? util.plural(g.renumbered, 'renumbered cite') : 'See the pairs'),
          ext(g.url, 'Source', 'btn sm ghost'))));
    });
    pane.appendChild(grid);
  }

  function partCard(fw, p, on, pick, i) {
    return h('button.rg-part' + (on ? '.on' : ''), { type: 'button', 'data-num': String(p.num), 'data-search': (abbr(fw) + ' ' + p.num + ' ' + (p.title || '') + ' ' + (p.summary || '')).toLowerCase(), 'aria-pressed': on ? 'true' : 'false', style: { animationDelay: (Math.min(i, 24) * 30) + 'ms' }, onclick: function () { pick(p); } },
      h('div.rg-part-top', {}, h('span.rg-part-num', {}, 'Part ' + p.num), /^overhauled$/i.test(String(p.status || '')) ? null : statusBadge(p.status), icon('arrow-right')),
      h('div.rg-part-title', {}, p.title || 'Untitled part'));
  }

  function detailHint(fw, n) {
    return h('div.rg-detail-empty', {}, h('div.rg-detail-empty-icon', {}, icon('map')), h('b', {}, 'Pick a part'), h('span', {}, n ? 'Select any of the ' + n + ' ' + abbr(fw) + ' parts to see its key sections, notes and source links.' : 'No parts are catalogued for this framework yet.'));
  }

  function partDetail(fw, p, D, st, pick) {
    var ks = arr(p.key_sections).filter(function (k) { return k && typeof k === 'object'; }), pre = abbr(fw), re = partCiteRe(fw, p.num);
    var qCount = safe(function () { return CORB.data.questions({}).filter(function (q) { return (q.citations || []).some(function (c) { return re.test(norm(c)); }); }).length; }, 0);
    var cwCount = D.crosswalk.filter(function (e) { return re.test(norm(e.new)) || re.test(norm(e.old)); }).length;
    var libQuery = pre + ' ' + p.num + '.';
    return h('div.rg-detail-inner', {},
      h('div.rg-detail-head', {},
        h('div', {}, h('div.eyebrow', {}, fw.name || pre), h('h3.rg-detail-num', {}, pre + ' Part ' + p.num), h('div.rg-detail-title', {}, p.title || '')),
        h('button.btn.icon.sm.ghost', { type: 'button', 'aria-label': 'Close part detail', onclick: function () { pick(null); } }, icon('x'))),
      h('div.row.rg-detail-meta', {}, statusBadge(p.status), h('span.muted.small', {}, util.plural(ks.length, 'key section')), qCount ? h('span.muted.small', {}, '· cited by ' + util.plural(qCount, 'board question')) : null),
      p.summary ? rich(p.summary, { cls: 'rg-detail-sum' }) : null,
      h('div.rg-detail-actions', {},
        ext(p.url || fw.url, 'Read Part ' + p.num, 'btn sm primary'),
        qCount ? h('button.btn.sm', { type: 'button', onclick: function () { CORB.go('library', { q: libQuery }); } }, icon('book'), 'Questions citing it') : null,
        cwCount ? h('button.btn.sm', { type: 'button', onclick: function () { st.select('crosswalk', { part: { abbr: pre, num: String(p.num), label: pre + ' Part ' + p.num, re: re } }); } }, icon('refresh'), util.plural(cwCount, 'crosswalk pair')) : null),
      ks.length
        ? h('div.rg-secs', {}, h('div.eyebrow', {}, 'Key sections'), ks.map(secRow))
        : h('div.panel-soft.small.muted.mt-4', {}, 'No key sections have been catalogued for this part yet. Read it at the source link above.'),
      p.notes ? h('div.rg-detail-notes', {}, h('div.eyebrow', {}, 'Notes'), rich(p.notes)) : null);
  }

  function secRow(k) {
    var refEl = isHttp(k.url) ? h('a.cite.rg-sec-ref', { href: k.url, target: '_blank', rel: 'noopener noreferrer' }, k.ref || 'Section', icon('external')) : h('span.cite.rg-sec-ref', {}, k.ref || 'Section');
    return h('div.rg-sec', {}, refEl, h('div.rg-sec-body', {}, h('div.rg-sec-title', {}, k.title || ''), k.note ? h('div.rg-sec-note', {}, k.note) : null));
  }

  // ---------------------------------------------------------------- CROSSWALK
  function mapCite(text, byOld, byNew) {
    var raw = norm(text); if (!raw) return null;
    var k = ckey(raw);
    if (/^\d{1,2}\s+U\.?S\.?C\b/i.test(raw) || /^\d{1,2}\s+C\.?F\.?R\b/i.test(raw) || /^(?:Pub\.?\s*L\.?|Public Law)/i.test(raw)) return { kind: 'statute', input: raw };
    // the core resolver first (same table, shared with citation links everywhere), then this view's index for title, note and confidence
    var core = safe(function () { return CORB.data.rfoFor(raw); }, null);
    if (core) return { kind: 'exact', entry: byOld[k] || { old: raw, new: core, confidence: 'unverified', title: '' }, input: raw };
    if (byOld[k]) return { kind: 'exact', entry: byOld[k], input: raw };
    if (byNew[k]) return { kind: 'already', entry: byNew[k], input: raw };
    var cand = k, steps = 0;
    while (cand && steps < 8) {
      var next = cand.replace(/\s*\([A-Z0-9]{1,3}\)$/, '');
      if (next === cand) next = cand.replace(/-\d{1,3}$/, '');
      if (next === cand) next = cand.replace(/\.\d{1,4}$/, '');
      if (next === cand) break;
      cand = next.trim(); steps++;
      if (byOld[cand]) return { kind: 'parent', entry: byOld[cand], input: raw, matched: cand };
      if (byNew[cand]) return { kind: 'parent-already', entry: byNew[cand], input: raw, matched: cand };
    }
    return { kind: 'none', input: raw };
  }

  function resultCard(r) {
    if (!r) return null;
    if (r.kind === 'statute') return h('div.callout.info.rg-result-card', {}, icon('info'), h('div', {}, h('b', {}, r.input + ' is not renumbered'), 'Statutes (U.S.C.), the CFR and public laws are unchanged by the RFO. Cite them exactly as written; the DoDGARs in 2 CFR and 32 CFR still govern grants and agreements.'));
    if (r.kind === 'none') return h('div.callout.warn.rg-result-card', {}, icon('alert'), h('div', {}, h('b', {}, 'No mapping for ' + r.input), 'It is not in this crosswalk table. Search the table below, or check the part on acquisition.gov and record the pair once you confirm it.', h('div.mt-2', {}, ext(HUB_URL, 'Open the FAR Overhaul hub', 'rg-ext'))));
    var e = r.entry, same = ckey(e.old) === ckey(e.new);
    var head = r.kind === 'already' || r.kind === 'parent-already' ? 'Already RFO numbering' : same ? 'Number unchanged in the RFO' : 'Renumbered by the RFO';
    var lead = r.kind === 'parent' || r.kind === 'parent-already' ? h('p.small.muted.rg-result-note', {}, 'No entry for the exact paragraph ' + r.input + '. Nearest match: ' + norm(r.matched) + '. Carry the paragraph letter across only after reading the new section.') : null;
    return h('div.rg-result-card.rg-result-map', {},
      h('div.rg-result-head', {}, h('div.eyebrow', {}, head), confBadge(e.confidence)),
      h('div.rg-arrow', {},
        h('div.rg-arrow-cell', {}, h('span.rg-arrow-label', {}, 'Pre-RFO'), h('span.rg-old', {}, norm(e.old) || '—')),
        h('div.rg-arrow-mid', {}, icon('arrow-right')),
        h('div.rg-arrow-cell.to', {}, h('span.rg-arrow-label', {}, 'RFO'), h('span.rg-new', {}, norm(e.new) || '—'))),
      e.title ? h('div.rg-result-title', {}, e.title) : null,
      lead,
      e.note ? rich(e.note, { cls: 'rg-result-body' }) : null,
      h('div.rg-result-actions', {},
        h('button.btn.sm', { type: 'button', onclick: function () { copyText(norm(e.new)); } }, icon('note'), 'Copy new cite'),
        ext(e.source_url, 'Source · ' + (hostOf(e.source_url) || 'link'), 'btn sm ghost'),
        h('button.btn.sm.ghost', { type: 'button', onclick: function () { CORB.go('library', { q: norm(e.new) }); } }, icon('book'), 'Questions citing it')));
  }

  function renderCrosswalk(pane, D, st) {
    if (!D.crosswalk.length) {
      pane.appendChild(emptyState('refresh', 'No crosswalk pairs in this build', 'Old-to-new citation pairs appear here once the regulations module is merged. Acquisition.gov publishes no official crosswalk table; each RFO Practitioner Album carries only a line-out of deleted text, so the pairs here are hand-verified against the part pages.', ext(HUB_URL, 'Open the FAR Overhaul hub', 'btn sm mt-4')));
      return;
    }
    var byOld = {}, byNew = {};
    D.crosswalk.forEach(function (e) { var ko = ckey(e.old), kn = ckey(e.new); if (ko && !byOld[ko]) byOld[ko] = e; if (kn && !byNew[kn]) byNew[kn] = e; });

    // ---- paste a citation
    var input = h('input.input', { type: 'text', placeholder: 'Paste a pre-RFO cite, e.g. FAR 6.302-1', 'aria-label': 'Citation to map', value: CORB.get('settings.regs.cite', '') || '', autocomplete: 'off', spellcheck: 'false' });
    var result = h('div.rg-result', { 'aria-live': 'polite' });
    function run() { var v = input.value.trim(); CORB.set('settings.regs.cite', v, { silent: true }); result.innerHTML = ''; if (!v) return; var card = resultCard(mapCite(v, byOld, byNew)); if (card) result.appendChild(card); }
    var form = h('form.rg-paste-form', { onsubmit: function (e) { e.preventDefault(); run(); } },
      h('div.search.grow', {}, icon('search'), input),
      h('button.btn.primary', { type: 'submit' }, 'Map it', icon('arrow-right')));
    var samples = D.crosswalk.filter(function (e) { return e.old && ckey(e.old) !== ckey(e.new); }).slice(0, 4).map(function (e) { return norm(e.old); });
    var examples = samples.length ? h('div.rg-examples', {}, h('span.muted.small', {}, 'Try'), samples.map(function (x) { return h('button.chip', { type: 'button', onclick: function () { input.value = x; run(); input.focus(); } }, x); })) : null;
    pane.appendChild(h('section.rg-paste', {},
      h('div.rg-paste-copy', {}, h('div.eyebrow', {}, 'Paste a citation'), h('h2', {}, 'Where did it go?'), h('p.muted', {}, 'Type a pre-RFO FAR cite and get the RFO number, its confidence and the page it was verified on. Statutes and the CFR were not renumbered.')),
      form, examples, result));
    if (input.value) run();

    // ---- searchable table
    var search = h('input.input', { type: 'search', placeholder: 'Search old or new number, heading, note…', value: st.q || '', 'aria-label': 'Search the crosswalk' });
    var confs = ['all', 'verified', 'probable', 'unverified'];
    function confCount(c) { return c === 'all' ? D.crosswalk.length : D.crosswalk.filter(function (e) { return String(e.confidence || 'unverified').toLowerCase() === c; }).length; }
    var chips = h('div.chips.rg-chips', { role: 'group', 'aria-label': 'Filter by confidence' }, confs.map(function (c) {
      var n = confCount(c); if (c !== 'all' && !n) return null;
      return h('button.chip' + (st.cwConf === c ? '.on' : ''), { type: 'button', 'data-conf': c, 'aria-pressed': st.cwConf === c ? 'true' : 'false', onclick: function () { st.cwConf = c; st.cwShown = PAGE; chips.querySelectorAll('.chip').forEach(function (b) { var on = b.getAttribute('data-conf') === c; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); drawTable(); } },
        c === 'all' ? 'All' : (CONF[c] ? CONF[c][1] : c), h('span.count', {}, String(n)));
    }));
    var countEl = h('span.muted.small.rg-table-count');
    var wrap = h('div.rg-table-wrap.scroll-x');
    var more = h('div.rg-showmore');
    var partChip = h('div.rg-part-filter');
    function drawPartChip() {
      partChip.innerHTML = '';
      if (!st.cwPart) return;
      partChip.appendChild(h('span.rg-part-filter-chip', {}, icon('filter'), h('span', {}, 'Only ' + (st.cwPart.label || 'this part')), h('button.rg-part-filter-x', { type: 'button', 'aria-label': 'Clear the part filter', onclick: function () { st.cwPart = null; st.cwShown = PAGE; drawPartChip(); drawTable(); } }, icon('x'))));
    }

    function filtered() {
      var t = search.value.trim().toLowerCase();
      var pre = st.cwPart && st.cwPart.re;
      return D.crosswalk.filter(function (e) {
        if (st.cwConf !== 'all' && String(e.confidence || 'unverified').toLowerCase() !== st.cwConf) return false;
        if (pre && !(pre.test(norm(e.old)) || pre.test(norm(e.new)))) return false;
        if (!t) return true;
        return (norm(e.old) + ' ' + norm(e.new) + ' ' + (e.title || '') + ' ' + (e.note || '')).toLowerCase().indexOf(t) >= 0;
      });
    }
    function drawTable() {
      var list = filtered(), rows = list.slice(0, st.cwShown);
      wrap.innerHTML = ''; more.innerHTML = '';
      countEl.textContent = list.length === D.crosswalk.length ? util.plural(list.length, 'pair') : list.length + ' of ' + util.plural(D.crosswalk.length, 'pair');
      if (!list.length) { wrap.appendChild(h('div.empty', {}, h('h3', {}, 'No pairs match'), h('p', {}, st.cwPart ? 'Nothing in ' + (st.cwPart.label || 'this part') + ' matches. Clear the part filter or try the section number alone.' : 'Try the section number alone, or clear the confidence filter.'))); return; }
      wrap.appendChild(h('table.table.rg-table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Pre-RFO'), h('th', {}, 'RFO'), h('th', {}, 'Section'), h('th', {}, 'Confidence'), h('th', {}, 'Source'))),
        h('tbody', {}, rows.map(cwRow))));
      if (list.length > rows.length) more.appendChild(h('button.btn', { type: 'button', onclick: function () { st.cwShown += PAGE; drawTable(); } }, 'Show ' + Math.min(PAGE, list.length - rows.length) + ' more', icon('chevron')));
    }
    search.addEventListener('input', util.debounce(function () { st.q = search.value; st.cwShown = PAGE; drawTable(); }, 120));
    drawPartChip();
    drawTable();

    pane.appendChild(h('div.section-head', {}, h('h2', {}, 'Old number, new number'), countEl));
    pane.appendChild(h('div.toolbar.rg-toolbar', {}, h('div.search.grow', {}, icon('search'), search), partChip, chips));
    pane.appendChild(wrap);
    pane.appendChild(more);

    if (D.unchanged.length) {
      pane.appendChild(h('details.acc.rg-unchanged', {},
        h('summary', {}, icon('shield'), 'Statutes and CFR cites unchanged by the RFO (' + D.unchanged.length + ')', icon('chevron', 'chev')),
        h('div.acc-body', {}, h('p.small.muted', {}, 'The RFO rewrote the FAR only. These authorities keep their numbers; cite them as written.'), h('div.chips', {}, D.unchanged.map(function (u) { var url = safe(function () { return CORB.data.citeUrl(u); }, null); return isHttp(url) ? h('a.chip', { href: url, target: '_blank', rel: 'noopener noreferrer' }, String(u), icon('external')) : h('span.chip', {}, String(u)); })))));
    }
  }

  function cwRow(e) {
    var same = ckey(e.old) === ckey(e.new);
    var noteEl = e.note ? h('div.rg-note.clamp', {}, e.note) : null;
    var toggle = e.note && e.note.length > 150 ? h('button.rg-more', { type: 'button', 'aria-expanded': 'false', onclick: function () { var open = noteEl.classList.toggle('open'); this.setAttribute('aria-expanded', open ? 'true' : 'false'); this.textContent = open ? 'Less' : 'More'; } }, 'More') : null;
    return h('tr', {},
      h('td.rg-td-old', { 'data-label': 'Pre-RFO' }, h('span.rg-old', {}, norm(e.old) || '—')),
      h('td.rg-td-new', { 'data-label': 'RFO' }, h('span.rg-new', {}, norm(e.new) || '—'), same ? h('span.badge.neutral.rg-same', {}, 'unchanged') : null),
      h('td.rg-td-title', { 'data-label': 'Section' }, h('div.rg-title', {}, e.title || ''), noteEl, toggle),
      h('td.rg-td-conf', { 'data-label': 'Confidence' }, confBadge(e.confidence)),
      h('td.rg-td-src', { 'data-label': 'Source' }, ext(e.source_url, hostOf(e.source_url) || 'link', 'rg-src') || h('span.muted.small', {}, 'No link recorded')));
  }

  // ---------------------------------------------------------------- THRESHOLDS
  var TH_CHIPS = [
    { id: 'all', label: 'All' },
    { id: 'simplified', label: 'MPT & SAT', re: /micro-purchase|simplified acquisition threshold|\bSAT\b|\bMPT\b|simplified procedures|purchase card/i },
    { id: 'competition', label: 'Justifications', re: /justification|competition advocate|J&A|other than full and open|8\(a\)|set-aside/i },
    { id: 'pricing', label: 'Pricing & CAS', re: /cost or pricing|TINA|cost accounting|\bCAS\b/i },
    { id: 'orders', label: 'Orders & protests', re: /protest|task.?order|delivery.?order|fair opportunity|debrief/i },
    { id: 'disputes', label: 'Claims & payment', re: /\bclaim|dispute|prompt payment|interest/i },
    { id: 'warrant', label: 'Warrant classes', re: /warrant/i },
    { id: 'contingency', label: 'Contingency', re: /contingency|emergency|disaster|humanitarian/i },
    { id: 'korea', label: 'Korea-relevant', re: /korea|OCONUS|outside the United States|SOFA/i }
  ];
  function thText(t) { return [t.name, t.value, t.applies, t.cite, t.notes, arr(t.flags).join(' ')].join(' '); }

  function renderThresholds(pane, D, st) {
    if (!D.thresholds.length) {
      pane.appendChild(emptyState('scale', 'No thresholds in this build', 'The threshold table appears here once the regulations module is merged. Until then read the definitions in FAR 2.101 and the DoD class deviations directly, and never quote a figure from memory in a board.', ext(HUB_URL, 'Open the FAR Overhaul hub', 'btn sm mt-4')));
      return;
    }
    var checked = CORB.get('progress.regs.checked', {}) || {};
    var total = D.thresholds.length;
    function doneCount() { var c = CORB.get('progress.regs.checked', {}) || {}; return D.thresholds.filter(function (t) { return c[t.key]; }).length; }
    var progText = h('div.rg-verify-count');
    var progBar = h('div.bar.gold', {}, h('span'));
    function updateProgress() { var n = doneCount(); progText.innerHTML = ''; progText.appendChild(h('b', {}, String(n))); progText.appendChild(document.createTextNode(' of ' + total + ' confirmed by you')); progBar.firstChild.style.width = util.pct(n, total) + '%'; }
    updateProgress();

    pane.appendChild(h('section.rg-verify', {},
      h('div.rg-verify-main', {},
        h('div.rg-verify-icon', {}, icon('shield')),
        h('div', {},
          h('div.eyebrow', {}, 'Figures verified on'),
          h('div.rg-verify-date', {}, D.verifiedOn ? fmtDay(D.verifiedOn) : 'Date not recorded'),
          h('p.rg-verify-text', {}, 'Every value below was read from its cited source on that date. Thresholds move: statutory inflation adjustments every five years, NDAA changes, and DoD class deviations. Confirm each figure against its cite before you rely on it in a board answer or a contract action. Rows stay marked “Verify” until you have done that yourself.'))),
      h('div.rg-verify-side', {},
        h('div.eyebrow', {}, 'Your checks'),
        progText, progBar,
        h('p.small.muted', {}, 'Ticking a row records the date you confirmed it. It lives in your own progress, never in the source data.'))));

    var search = h('input.input', { type: 'search', placeholder: 'Filter by keyword: SAT, protest, contingency, DFARS…', value: st.q || '', 'aria-label': 'Filter thresholds' });
    function chipCount(c) { return c.re ? D.thresholds.filter(function (t) { return c.re.test(thText(t)); }).length : total; }
    var chips = h('div.chips.rg-chips', { role: 'group', 'aria-label': 'Quick filters' }, TH_CHIPS.map(function (c) {
      var n = chipCount(c); if (!n) return null;
      return h('button.chip' + (st.thChip === c.id ? '.on' : ''), { type: 'button', 'data-chip': c.id, 'aria-pressed': st.thChip === c.id ? 'true' : 'false', onclick: function () { st.thChip = c.id; st.thShown = PAGE; chips.querySelectorAll('.chip').forEach(function (b) { var on = b.getAttribute('data-chip') === c.id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); drawTable(); } }, c.label, h('span.count', {}, String(n)));
    }));
    var countEl = h('span.muted.small.rg-table-count');
    var wrap = h('div.rg-table-wrap.scroll-x');
    var more = h('div.rg-showmore');

    function filtered() {
      var t = search.value.trim().toLowerCase();
      var chip = TH_CHIPS.filter(function (c) { return c.id === st.thChip; })[0];
      return D.thresholds.filter(function (x) {
        if (chip && chip.re && !chip.re.test(thText(x))) return false;
        return !t || thText(x).toLowerCase().indexOf(t) >= 0;
      });
    }
    function drawTable() {
      var list = filtered(), rows = list.slice(0, st.thShown);
      wrap.innerHTML = ''; more.innerHTML = '';
      countEl.textContent = list.length === total ? util.plural(total, 'threshold') : list.length + ' of ' + util.plural(total, 'threshold');
      if (!list.length) { wrap.appendChild(h('div.empty', {}, h('h3', {}, 'Nothing matches'), h('p', {}, 'Try a shorter keyword or switch the quick filter back to All.'))); return; }
      var body = h('tbody');
      rows.forEach(function (t) { thRows(t, checked, updateProgress).forEach(function (r) { body.appendChild(r); }); });
      wrap.appendChild(h('table.table.rg-table.rg-th-table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Threshold'), h('th', {}, 'Value'), h('th', {}, 'Applies'), h('th', {}, 'Cite'), h('th', {}, 'Confidence'), h('th', {}, 'Status'), h('th', {}, 'Checked'))),
        body));
      if (list.length > rows.length) more.appendChild(h('button.btn', { type: 'button', onclick: function () { st.thShown += PAGE; drawTable(); } }, 'Show ' + Math.min(PAGE, list.length - rows.length) + ' more', icon('chevron')));
    }
    search.addEventListener('input', util.debounce(function () { st.q = search.value; st.thShown = PAGE; drawTable(); }, 120));
    drawTable();

    pane.appendChild(h('div.section-head', {}, h('h2', {}, 'Current figures'), countEl));
    pane.appendChild(h('div.toolbar.rg-toolbar', {}, h('div.search.grow', {}, icon('search'), search), chips));
    pane.appendChild(wrap);
    pane.appendChild(more);
    pane.appendChild(h('div.callout.warn.mt-5', {}, icon('alert'), h('div', {}, h('b', {}, 'Training aid, not authority'), 'Quote a threshold in a board only with its cite and its date. Korea and 411th local practice is never stated here; confirm it with C&P.')));
  }

  function thRows(t, checked, updateProgress) {
    var isChecked = !!checked[t.key];
    var korea = arr(t.flags).indexOf('korea-verify-cp') >= 0 || /korea-verify-cp/i.test(String(t.notes || ''));
    var notesRow = t.notes ? h('tr.rg-notes-row', { hidden: true }, h('td', { colspan: '7' }, h('div.rg-notes', {}, h('div.eyebrow', {}, 'Verification notes'), rich(t.notes)))) : null;
    var notesBtn = notesRow ? h('button.rg-more', { type: 'button', 'aria-expanded': 'false', onclick: function () { var open = notesRow.hidden; notesRow.hidden = !open; this.setAttribute('aria-expanded', open ? 'true' : 'false'); this.innerHTML = ''; this.appendChild(icon(open ? 'chevron' : 'chevron-right')); this.appendChild(document.createTextNode(open ? 'Hide notes' : 'Notes')); } }, icon('chevron-right'), 'Notes') : null;
    var stamp = h('span.rg-check-stamp', {}, isChecked ? 'by me · ' + fmtDay(checked[t.key]) : '');
    var row = h('tr.rg-th-row' + (isChecked ? '.checked' : ''), {});
    var cb = h('input', { type: 'checkbox', checked: isChecked, 'aria-label': 'I confirmed: ' + t.name, onchange: function () {
      var v = this.checked ? util.today() : null;
      CORB.set('progress.regs.checked.' + t.key, v);
      checked[t.key] = v;
      row.classList.toggle('checked', !!v);
      stamp.textContent = v ? 'by me · ' + fmtDay(v) : '';
      updateProgress();
    } });
    var source = isHttp(t.url) ? ext(t.url, hostOf(t.url), 'rg-src') : (t.url ? h('span.rg-src-local', { title: String(t.url) }, icon('note'), 'Local source') : null);
    row.appendChild(h('td.rg-td-name', { 'data-label': 'Threshold' }, h('div.rg-th-name', {}, t.name), notesBtn));
    row.appendChild(h('td.rg-td-val', { 'data-label': 'Value' }, h('span.rg-val', {}, t.value || (t.value_number != null ? fmtMoney(Number(t.value_number)) : '') || '—')));
    row.appendChild(h('td.rg-td-app', { 'data-label': 'Applies' }, t.applies || '—'));
    row.appendChild(h('td.rg-td-cite', { 'data-label': 'Cite' }, h('div.rg-cite', { html: linkCites(esc(t.cite || '—')) }), source));
    row.appendChild(h('td.rg-td-conf', { 'data-label': 'Confidence' }, confBadge(t.confidence)));
    row.appendChild(h('td.rg-td-status', { 'data-label': 'Status' }, h('div.rg-status-badges', {}, t.status === 'verified' ? ui.badge('official', 'Verified') : ui.badge('verify-locally', 'Verify'), korea ? ui.badge('korea-verify-cp') : null)));
    row.appendChild(h('td.rg-td-check', { 'data-label': 'Checked' }, h('label.rg-check', {}, cb, h('span', {}, 'Confirmed')), stamp));
    return notesRow ? [row, notesRow] : [row];
  }

  // ---------------------------------------------------------------- WARRANT CLASSES
  function renderClasses(pane, D, st) {
    var proc = CORB.DATA.process || {};
    var fromPolicy = Array.isArray(proc.warrant_classes) && proc.warrant_classes.length > 0;
    var classes = (fromPolicy ? proc.warrant_classes : CLASS_FALLBACK).filter(function (c) { return c && c.cls; });
    var rules = proc.warrant_class_rules || {};
    var sat = findTh(D, 'sat'), sap = findTh(D, 'sap_commercial_ceiling');
    var resolve = { SAT: sat, SAP: sap };
    function resolved(label) { return resolve[String(label).toUpperCase()] || null; }
    function rungValue(label) { var r = resolved(label); if (r && r.value_number != null) return Number(r.value_number); if (/unlimited/i.test(label)) return Infinity; return parseMoney(label); }

    var ordered = classes.slice().sort(function (a, b) { return (CLASS_ORDER[b.cls] || 0) - (CLASS_ORDER[a.cls] || 0); });
    var ladder = h('div.rg-ladder', {}, ordered.map(function (c, i) {
      return h('article.rg-rung', { style: { animationDelay: (i * 70) + 'ms' } },
        h('div.rg-rung-cls', {}, ui.classBadge(c.cls), h('span.rg-rung-n', {}, String(c.cls))),
        h('div.rg-rung-body', {},
          h('div.rg-rung-vals', {}, arr(c.thresholds).map(function (v) { var r = resolved(v); return h('span.rg-val-chip' + (r ? '.resolved' : ''), { title: r ? r.name : null }, h('b', {}, String(v)), r ? h('span', {}, r.value_number != null ? fmtMoney(r.value_number) : r.value) : null); })),
          c.who ? h('p.rg-rung-who', {}, c.who) : null,
          arr(c.typical_roles).length ? h('div.rg-rung-roles', {}, arr(c.typical_roles).map(function (r) { return h('span.badge.neutral', {}, String(r)); })) : null,
          c.board_focus ? h('details.rg-rung-more', {}, h('summary', {}, icon('target'), 'Board focus', icon('chevron', 'chev')), h('p.small', {}, c.board_focus)) : null,
          c.note ? h('p.small.muted.rg-rung-note', {}, c.note) : null,
          c.source ? h('div.rg-rung-src', {}, c.source) : null));
    }));

    pane.appendChild(h('div.rg-classes-head', {},
      h('div', {}, h('div.eyebrow', {}, 'Army Warranting Program Policy v12 · March 2026'), h('h2', {}, 'Table 1 — standard warrant thresholds'), h('p.muted', {}, rules.fixed_thresholds || 'Every warrant is granted at one of these fixed values and stays valid until suspended or terminated. The limit applies to FAR-based and non-FAR-based instruments alike, and to their modifications. Writing “SAT” or “SaP” instead of a dollar figure means the warrant need not be reissued when those values change.')),
      h('div.rg-classes-src', {}, fromPolicy ? pill('check', 'Loaded from the warrant process module', 'ok') : pill('info', 'Built-in Table 1; process module not loaded'), sat ? pill('scale', 'SAT and SaP resolved from the thresholds table') : pill('alert', 'SAT and SaP values not loaded', 'warn'))));
    pane.appendChild(ladder);

    // ---- instrument value rule + calculator
    var saved = CORB.get('progress.regs.calc', {}) || {};
    var fields = [['base', 'Base value'], ['options', 'All options'], ['ceiling', 'Anticipated or actual ceiling'], ['mod', 'Modification (absolute value)']].map(function (f) {
      return { id: f[0], label: f[1], input: h('input.input.num', { type: 'text', inputmode: 'decimal', placeholder: '0', value: saved[f[0]] || '', 'aria-label': f[1], autocomplete: 'off' }) };
    });
    var out = h('div.rg-calc-out', { 'aria-live': 'polite' });
    var rungs = [];
    classes.forEach(function (c) { arr(c.thresholds).forEach(function (v) { var val = rungValue(v); if (!isNaN(val)) rungs.push({ cls: c.cls, label: String(v), value: val, resolved: !!resolved(v) }); }); });
    rungs.sort(function (a, b) { return a.value - b.value; });
    var skipped = [];
    classes.forEach(function (c) { arr(c.thresholds).forEach(function (v) { if (isNaN(rungValue(v))) skipped.push(String(v)); }); });

    function compute() {
      var vals = {}, bad = false, total = 0;
      fields.forEach(function (f) { var n = parseMoney(f.input.value); vals[f.id] = f.input.value; if (isNaN(n)) bad = true; else total += Math.abs(n); });
      CORB.set('progress.regs.calc', vals, { silent: true });
      out.innerHTML = '';
      if (bad) { out.appendChild(h('div.rg-calc-hint', {}, icon('info'), 'Enter dollar amounts like 1,250,000 or 1.25M.')); return; }
      if (!total) { out.appendChild(h('div.rg-calc-hint', {}, icon('info'), 'Enter the instrument figures to see the lowest Table 1 warrant that covers it.')); return; }
      var fit = rungs.filter(function (r) { return total <= r.value; })[0];
      out.appendChild(h('div.rg-calc-total', {}, h('span.rg-calc-label', {}, 'Cumulative instrument value'), h('span.rg-calc-value', {}, fmtMoney(total))));
      out.appendChild(fit
        ? h('div.rg-calc-verdict', {}, h('span.rg-calc-label', {}, 'Lowest warrant that covers it'), h('div.rg-calc-fit', {}, ui.classBadge(fit.cls), h('b', {}, fit.label), isFinite(fit.value) ? h('span.muted', {}, fmtMoney(fit.value)) : null), fit.resolved ? h('span.small.muted', {}, 'Dollar value from the thresholds table — confirm before relying on it.') : null)
        : h('div.rg-calc-verdict', {}, h('span.rg-calc-label', {}, 'Lowest warrant that covers it'), h('div.rg-calc-fit', {}, h('b', {}, 'Above every fixed rung loaded'))));
    }
    fields.forEach(function (f) { f.input.addEventListener('input', util.debounce(compute, 120)); });

    pane.appendChild(h('section.rg-rule', {},
      h('div.rg-rule-copy', {},
        h('div.eyebrow', {}, 'Instrument value rule · Policy v12 §4.2'),
        h('h2', {}, 'Your warrant must cover the whole instrument'),
        h('div.rg-formula', { 'aria-label': 'Warrant is greater than or equal to base plus all options plus ceiling plus the absolute value of the modification' },
          h('span.rg-f-k', {}, 'Warrant'), h('span.rg-f-op', {}, '≥'), h('span.rg-f-t', {}, 'base'), h('span.rg-f-op', {}, '+'), h('span.rg-f-t', {}, 'all options'), h('span.rg-f-op', {}, '+'), h('span.rg-f-t', {}, 'ceiling'), h('span.rg-f-op', {}, '+'), h('span.rg-f-t', {}, '|modification|')),
        h('p', {}, rules.calculating_value || RULE_FALLBACK),
        h('p.small.muted', {}, 'Regardless of when funds are obligated. Moving up a class needs a new board and reappointment; increases within a class do not.'),
        h('div.row.mt-4', {},
          h('button.btn.sm', { type: 'button', onclick: function () { CORB.go('process'); } }, icon('process'), 'Warrant process guide'),
          h('button.btn.sm.ghost', { type: 'button', onclick: function () { st.select('thresholds', { q: 'warrant' }); } }, icon('scale'), 'Threshold sources'))),
      h('div.rg-calc', {},
        h('div.eyebrow', {}, 'Instrument value check'),
        h('div.rg-calc-grid', {}, fields.map(function (f) { return h('label.field', {}, h('span', {}, f.label), f.input); })),
        out,
        skipped.length ? h('p.small.muted', {}, 'Rungs skipped because their dollar value is not loaded: ' + skipped.join(', ') + '.') : null,
        h('p.small.muted', {}, 'A study aid for the §4.2 arithmetic, not a determination. Your appointing official decides the warrant.'))));
    compute();
  }

  // ---------------------------------------------------------------- register
  var RENDER = { map: renderMap, crosswalk: renderCrosswalk, thresholds: renderThresholds, classes: renderClasses };

  CORB.registerView({
    id: 'regulations', title: 'Regulation explorer', icon: 'map', section: 'Reference', order: 60, nav: true, short: 'Regs',
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || {};
      var D = loadData();
      var saved = CORB.get('settings.regs', {}) || {};
      var validTab = function (t) { return TABS.some(function (x) { return x.id === t; }); };
      var tab = validTab(p.tab) ? p.tab : ((p.fw || p.part) ? 'map' : (validTab(saved.tab) ? saved.tab : 'map'));
      var st = cur = { tab: tab, fw: p.fw || saved.fw || '', part: p.part || '', q: p.q || '', cwConf: 'all', cwPart: null, cwShown: PAGE, thChip: 'all', thShown: PAGE, select: null };

      // the tabs carry the counts, so the head says what the page is and when it was checked
      root.appendChild(h('div.page-head.rg-head', {},
        h('h1', {}, 'Regulation explorer'),
        h('p.lede', {}, 'The renumbered FAR (the RFO, in effect since 1 February 2026), old-to-new citations, dollar thresholds and warrant classes.'),
        h('div.rg-status', {},
          pill('calendar', D.verifiedOn ? 'Verified ' + fmtDay(D.verifiedOn) : 'Verification date not recorded', D.verifiedOn ? 'gold' : 'warn'))));

      // dated notes on what changed since the content was verified (regulations.updates), newest first
      var ups = arr(CORB.DATA.regulations && CORB.DATA.regulations.updates).filter(function (u) { return u && u.title; });
      if (ups.length) {
        ups = ups.slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
        root.appendChild(h('details.card.rg-updates', { open: !CORB.get('settings.regs.updatesSeen') },
          h('summary', {}, icon('refresh'), h('span', {}, 'What changed, checked ' + fmtDay(ups[0].date || D.verifiedOn))),
          h('div.rg-updates-list', {}, ups.map(function (u) {
            return h('div.rg-update', {},
              h('div.rg-update-head', {}, h('b', {}, u.title), u.date ? h('span.muted', {}, fmtDay(u.date)) : null, u.status === 'verified' ? ui.badge('official', 'Verified') : ui.badge('verify-locally', 'Verify')),
              h('p', {}, u.text || ''),
              h('div.rg-update-foot', {}, u.url ? ext(u.url, 'Source', 'btn sm ghost') : null, u.source ? h('span.small.muted', {}, u.source) : null));
          }))));
        root.querySelector('.rg-updates').addEventListener('toggle', function (e) { CORB.set('settings.regs.updatesSeen', !e.target.open, { silent: true }); });
      }

      if (!D.has) root.appendChild(h('div.callout.info.rg-missing', {}, icon('info'), h('div', {}, h('b', {}, 'Regulation data is not in this build yet'), 'The map, crosswalk and thresholds fill in when the regulations module is merged. The warrant class table is built in and works now.')));

      var panel = h('div.rg-panel');
      var tabs = tabBar(st, D, select);
      function select(id, opts) {
        if (!validTab(id)) return;
        st.tab = id; st.q = (opts && opts.q) || ''; st.cwShown = PAGE; st.thShown = PAGE;
        st.cwPart = opts && opts.part ? opts.part : null;
        if (st.cwPart && !st.cwPart.re) st.cwPart.re = citeRe(st.cwPart.abbr || 'FAR', st.cwPart.num || '');
        CORB.set('settings.regs.tab', id, { silent: true });
        syncHash(st); tabs.sync(); draw();
      }
      st.select = select;
      function draw() {
        panel.innerHTML = '';
        var pane = h('div.rg-pane', { role: 'tabpanel', id: 'rg-pane-' + st.tab, 'aria-labelledby': 'rg-tab-' + st.tab, tabindex: '-1' });
        panel.appendChild(pane);
        try { RENDER[st.tab](pane, D, st); }
        catch (e) { console.error('[CORB] regulations tab error', st.tab, e); pane.appendChild(h('div.callout.danger', {}, icon('alert'), h('div', {}, h('b', {}, 'This section hit an error'), String(e && e.message || e)))); }
      }
      root.appendChild(tabs);
      root.appendChild(panel);
      draw();
    },
    onLeave: function () { cur = null; }
  });
})();
