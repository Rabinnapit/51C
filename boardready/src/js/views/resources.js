/* VIEW: resources — the vetted link list behind everything else in the app.
   Layout: page head, a one-line callout (links need a network, CAC links need the Army network, when the links
   were checked), a search box, then the links grouped by kind. Each row is the external link, its note, a badge
   only when access is not the public web (CAC required, local share) and a "Copy link" button that uses
   navigator.clipboard with a textarea fallback.
   Ends with a static "Where to get help at the 411th" panel that names roles only — no names,
   no emails, ever.
   Data: CORB.DATA.resources — [{title, url, kind, note, access, status, checked_on}]. Renders an
   empty state when the module is missing or empty, and tolerates partially shaped rows.
   Params: q (prefills the search box), kind.
   Persists: nothing. Works with storage disabled. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, util = CORB.util;

  var KINDS = {
    regulation: { label: 'Regulations and the FAR overhaul', icon: 'scale', blurb: 'The rule text itself. Check the citation here before you say it out loud at the board.' },
    policy: { label: 'Army and ACC policy', icon: 'shield', blurb: 'Warranting policy, contracting notes and the memoranda that set what a warrant class means.' },
    training: { label: 'Training and courses', icon: 'cards', blurb: 'Structured learning: practitioner albums, DAU (WARU) Acquipedia and course catalogs.' },
    reference: { label: 'Reference and lookup', icon: 'book', blurb: 'Day-to-day lookups: thresholds, clause matrices, crosswalks and dictionaries.' },
    system: { label: 'Systems and tools', icon: 'grid', blurb: 'The systems you will be asked about or need to touch. Most require CAC on the Army network.' },
    korea: { label: 'Korea, USFK and SOFA', icon: 'globe', blurb: 'Theater-specific sources for LCS, SOFA and Invited Contractor questions. Confirm local procedure with C&P.' }
  };
  var KIND_ORDER = ['regulation', 'policy', 'korea', 'reference', 'training', 'system'];

  var ACCESS = {
    public: { label: 'Public web', cls: 'res-ok', icon: 'globe', tip: 'Opens from any network, including a personal laptop.' },
    cac: { label: 'CAC required', cls: 'res-gold', icon: 'key', tip: 'Needs a CAC and, usually, the Army network.' },
    local: { label: 'Local / shared drive', cls: 'res-neutral', icon: 'layers', tip: 'Lives on a unit share, not the public web.' }
  };
  var STATUS = {
    ok: { label: 'Link checked', cls: 'res-ok', icon: 'check' },
    redirect: { label: 'Redirects', cls: 'res-info', icon: 'refresh' },
    unreachable: { label: 'Unreachable when checked', cls: 'res-warn', icon: 'alert' },
    'not-checked': { label: 'Not checked', cls: 'res-neutral', icon: 'clock' }
  };

  var HELP = [
    { role: 'Chief, Contracting & Policy (C&P)', what: 'Owns local policy, thresholds and the warrant file. Every "confirm with C&P" flag in this app ends here — ask before you quote a local number at the board.', icon: 'shield' },
    { role: 'CONOPS warrant program coordinator', what: 'Runs the warrant packet through VCE-Warrants, tracks the board calendar and tells you what is still missing from your packet.', icon: 'process' },
    { role: 'Your supervisor', what: 'Signs the recommendation, sets your target warrant class and clears the time you need to prepare. Start the conversation early, not the week of the board.', icon: 'user' },
    { role: 'KO mentors', what: 'Sitting contracting officers who take practice questions, correct your citations and tell you how an answer lands from the other side of the table.', icon: 'users' }
  ];

  var S = null, R = null, last = null, lastSig = null, timer = null;

  // ---------------------------------------------------------------- helpers
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return v == null ? '' : String(v); }
  function kindMeta(k) { return KINDS[k] || { label: k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Other links', icon: 'link', blurb: 'Other sources collected for the board.' }; }
  function safeUrl(u) { return /^https?:\/\//i.test(str(u).trim()) ? str(u).trim() : ''; }
  function hostOf(u) { var m = /^https?:\/\/([^/?#]+)/i.exec(u); return m ? m[1].replace(/^www\./i, '') : ''; }

  function allLinks() {
    var raw = arr(safe(function () { return CORB.DATA && CORB.DATA.resources; }, []));
    var out = [];
    raw.forEach(function (r, i) {
      if (!r || typeof r !== 'object') return;
      var title = str(r.title).trim(), url = safeUrl(r.url);
      if (!title && !url) return;
      var kind = str(r.kind).trim().toLowerCase() || 'reference';
      var access = str(r.access).trim().toLowerCase();
      var status = str(r.status).trim().toLowerCase();
      out.push({
        i: i,
        title: title || url,
        url: url,
        rawUrl: str(r.url).trim(),
        kind: kind,
        note: str(r.note).trim(),
        access: ACCESS[access] ? access : (access ? 'local' : 'public'),
        status: STATUS[status] ? status : 'not-checked',
        checked_on: str(r.checked_on).trim(),
        hay: (title + ' ' + str(r.note) + ' ' + str(r.url) + ' ' + kind).toLowerCase()
      });
    });
    return out;
  }
  function matches(list) {
    var q = S.q.toLowerCase();
    return list.filter(function (r) {
      if (S.kind && r.kind !== S.kind) return false;
      if (q && r.hay.indexOf(q) < 0) return false;
      return true;
    });
  }
  function groupOrder(list) {
    var seen = {}, order = [];
    KIND_ORDER.forEach(function (k) { if (list.some(function (r) { return r.kind === k; })) { order.push(k); seen[k] = 1; } });
    list.forEach(function (r) { if (!seen[r.kind]) { seen[r.kind] = 1; order.push(r.kind); } });
    return order;
  }
  function fresh() { return { q: '', kind: '' }; }
  function fromParams(p) {
    var s = fresh();
    if (p.q) s.q = str(p.q).trim();
    if (p.kind) s.kind = str(p.kind).trim().toLowerCase();
    return s;
  }

  // ------------------------------------------------------------- copy link
  function copyLink(url, btn) {
    function done(ok) {
      ui.toast(ok ? 'Link copied to the clipboard' : 'Could not copy — the link is selected, press Ctrl+C', ok ? 'ok' : 'warn');
      if (btn && ok) {
        btn.classList.add('copied');
        setTimeout(function () { try { btn.classList.remove('copied'); } catch (e) {} }, 1400);
      }
    }
    var nav = safe(function () { return navigator.clipboard; }, null);
    if (nav && nav.writeText) {
      try {
        nav.writeText(url).then(function () { done(true); }, function () { fallback(url, done); });
        return;
      } catch (e) { /* fall through */ }
    }
    fallback(url, done);
  }
  function fallback(url, done) {
    var ta = null;
    try {
      ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, url.length);
      var ok = false;
      try { ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta); ta = null;
      if (ok) { done(true); return; }
    } catch (e) { if (ta && ta.parentNode) { try { ta.parentNode.removeChild(ta); } catch (e2) {} } }
    showLink(url);
    done(false);
  }
  function showLink(url) {
    var inp = h('input.input', { value: url, readonly: true, 'aria-label': 'Link address' });
    ui.modal({
      title: 'Copy this link',
      body: h('div.stack', {}, h('p.small.muted', {}, 'This browser blocked the clipboard. Select the address below and copy it by hand.'), inp),
      actions: [{ label: 'Done', primary: true }]
    });
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) {} }, 40);
  }

  // -------------------------------------------------------------- pieces
  function header() {
    return h('div.page-head.res-head', {},
      h('div.res-head-copy', {},
        h('h1', {}, 'Resources'),
        h('p.lede', {}, 'Links to the rule text, Army policy, systems and Korea references.')));
  }

  // the latest check date across the links, said once for the page
  function checkedOn(list) {
    var d = list.map(function (r) { return r.checked_on; }).filter(function (x) { return /^\d{4}-\d{2}-\d{2}/.test(x); }).sort().pop();
    return d ? (util.fmtDate(d) || d) : '';
  }
  function callout(list) {
    var when = checkedOn(list || []);
    return h('div.callout.info.res-callout', {}, icon('external'),
      h('div', {},
        h('span', {}, 'Links open in your browser and need a network. Links marked '),
        h('span.badge.res-badge.res-gold.res-inline', {}, icon('key'), 'CAC required'),
        h('span', {}, ' also need your CAC and usually the Army network.' + (when ? ' Links were last checked ' + when + '.' : ''))));
  }

  function toolbar(list) {
    R.input = h('input.input', {
      type: 'search', value: S.q, placeholder: 'Search titles, notes and addresses…',
      'aria-label': 'Search resources', autocomplete: 'off', spellcheck: 'false',
      oninput: onInput, onkeydown: onSearchKey
    });
    R.clear = h('button.res-clear', {
      type: 'button', 'aria-label': 'Clear search', hidden: !S.q,
      onclick: function () { R.input.value = ''; R.clear.hidden = true; clearTimeout(timer); timer = null; applySearch(''); R.input.focus(); }
    }, icon('x'));
    R.kinds = h('div.chips.res-kinds', { role: 'group', 'aria-label': 'Filter by kind' });
    drawKinds(list);
    return h('div.res-toolbar', {},
      h('div.res-search', {}, h('div.search', {}, icon('search'), R.input), R.clear),
      R.kinds);
  }
  function drawKinds(list) {
    var box = R.kinds; if (!box) return;
    box.innerHTML = '';
    var counts = {};
    list.forEach(function (r) { counts[r.kind] = (counts[r.kind] || 0) + 1; });
    var order = groupOrder(list);
    if (!order.length) { box.hidden = true; return; }
    box.hidden = false;
    box.appendChild(h('button.chip' + (!S.kind ? '.on' : ''), {
      type: 'button', 'aria-pressed': !S.kind ? 'true' : 'false',
      onclick: function () { setState({ kind: '' }); }
    }, 'All', h('span.count', {}, String(list.length))));
    order.forEach(function (k) {
      var on = S.kind === k, meta = kindMeta(k);
      box.appendChild(h('button.chip' + (on ? '.on' : ''), {
        type: 'button', 'aria-pressed': on ? 'true' : 'false',
        onclick: function () { setState({ kind: on ? '' : k }); }
      }, icon(meta.icon), meta.label, h('span.count', {}, String(counts[k] || 0))));
    });
  }

  function badge(cfg, text) {
    return h('span.badge.res-badge.' + cfg.cls, cfg.tip ? { title: cfg.tip } : {}, icon(cfg.icon), text || cfg.label);
  }

  function row(r, i) {
    var titleEl = r.url
      ? h('a.res-title', { href: r.url, target: '_blank', rel: 'noopener', title: r.url }, r.title, icon('external'))
      : h('span.res-title.res-title-plain', {}, r.title);
    var item = h('article.res-item', {},
      h('div.res-item-main', {},
        titleEl,
        r.url ? h('div.res-host.num', {}, hostOf(r.url) || r.url) : (r.rawUrl ? h('div.res-host.num', {}, r.rawUrl) : null),
        r.note ? h('p.res-note', {}, r.note) : null,
        r.access !== 'public' ? h('div.res-badges', {}, badge(ACCESS[r.access] || ACCESS.local)) : null),
      h('div.res-item-actions', {},
        r.url ? h('button.btn.sm.ghost.res-copy', { type: 'button', 'aria-label': 'Copy the link to ' + r.title, onclick: function () { copyLink(r.url, this); } }, icon('link'), h('span.res-copy-label', {}, 'Copy link')) : null));
    item.style.animationDelay = (Math.min(i, 12) * 20) + 'ms';
    return item;
  }

  function group(kind, rows, n) {
    var meta = kindMeta(kind);
    return h('section.res-group', { 'aria-label': meta.label },
      h('div.res-group-head', {},
        h('span.res-group-icon', {}, icon(meta.icon)),
        h('div.res-group-copy', {},
          h('h2', {}, meta.label),
          h('p.res-group-blurb', {}, meta.blurb)),
        h('span.res-group-count.num', {}, util.plural(rows.length, 'link'))),
      h('div.res-rows', {}, rows.map(function (r) { return row(r, n++); })));
  }

  function helpPanel() {
    return h('section.res-help', { 'aria-label': 'Where to get help at the 411th' },
      h('div.res-help-head', {},
        h('h2', {}, 'Where to get help at the 411th'),
        h('p.muted', {}, 'No link settles a local question. Ask these roles, in this order.')),
      h('div.res-help-grid', {}, HELP.map(function (x, i) {
        return h('div.res-help-card', {},
          h('span.res-help-icon', {}, icon(x.icon)),
          h('div', {},
            h('h3', {}, x.role),
            h('p', {}, x.what)));
      })),
      h('div.res-help-foot', {}, icon('info'),
        h('span', {}, 'Training aid, not authoritative guidance. Confirm local thresholds, approval levels and Korea procedures with Contracting & Policy.')));
  }

  // ------------------------------------------------------------- rendering
  function emptyModule() {
    return h('div.empty.res-empty', {},
      icon('link'),
      h('h3', {}, 'No resources are loaded in this copy'),
      h('p', {}, 'This build carries no link list. Rebuild the app with the resources module, or open the original file you were given. Everything else in the app works offline without it — and the help roles below still apply.'),
      h('div.res-empty-actions', {},
        h('button.btn.primary', { type: 'button', onclick: function () { CORB.go('regulations'); } }, icon('scale'), 'Regulation explorer'),
        h('button.btn', { type: 'button', onclick: function () { CORB.go('process'); } }, icon('process'), 'Warrant process')));
  }
  function emptyResults() {
    return h('div.empty.res-empty', {},
      icon('search'),
      h('h3', {}, 'No resource matches'),
      h('p', {}, S.q
        ? 'Nothing here contains “' + S.q + '”. Try a shorter word, a system name (VCE, PIEE, SAM), or clear the search and browse the groups.'
        : 'That group is empty in this build. Pick another group, or show every link.'),
      h('div.res-empty-actions', {},
        h('button.btn.primary', { type: 'button', onclick: resetFilters }, 'Show every link')));
  }

  function drawList() {
    if (!R || !R.list) return;
    var list = matches(R.all);
    if (R.count) {
      R.count.innerHTML = '';
      R.count.appendChild(h('b', {}, String(list.length)));
      R.count.appendChild(h('span', {}, list.length === 1 ? 'link' : 'links'));
      if (S.kind) R.count.appendChild(h('span.res-count-sub', {}, 'in ' + kindMeta(S.kind).label.toLowerCase()));
      else if (S.q) R.count.appendChild(h('span.res-count-sub', {}, 'matching “' + S.q + '”'));
      if (S.q || S.kind) R.count.appendChild(h('button.res-clear-all', { type: 'button', onclick: resetFilters }, 'Clear'));
    }
    R.list.innerHTML = '';
    if (!list.length) { R.list.appendChild(emptyResults()); return; }
    var frag = document.createDocumentFragment();
    var n = 0;
    groupOrder(list).forEach(function (k) {
      var rows = list.filter(function (r) { return r.kind === k; });
      if (!rows.length) return;
      frag.appendChild(group(k, rows, n));
      n += rows.length;
    });
    R.list.appendChild(frag);
  }

  // -------------------------------------------------------- state + search
  function setState(patch) {
    Object.assign(S, patch || {});
    if (!R || !R.list) return;
    drawKinds(R.all); drawList();
  }
  function resetFilters() {
    S.q = ''; S.kind = '';
    if (R && R.input) { R.input.value = ''; if (R.clear) R.clear.hidden = true; }
    setState({});
  }
  function applySearch(v) {
    var t = str(v).trim();
    if (t === S.q) return;
    S.q = t; setState({});
  }
  function onInput(e) {
    var v = e.target.value;
    if (R && R.clear) R.clear.hidden = !v;
    clearTimeout(timer);
    timer = setTimeout(function () { timer = null; applySearch(v); }, 160);
  }
  function onSearchKey(e) {
    if (e.key === 'Escape') { e.target.value = ''; clearTimeout(timer); timer = null; if (R && R.clear) R.clear.hidden = true; applySearch(''); }
    if (e.key === 'Enter') { clearTimeout(timer); timer = null; applySearch(e.target.value); }
  }

  // ---------------------------------------------------------------- build
  function build(root) {
    var app = h('div.res-app'); root.appendChild(app);
    R.all = allLinks();
    app.appendChild(header());
    app.appendChild(callout(R.all));
    if (!R.all.length) {
      app.appendChild(emptyModule());
      app.appendChild(helpPanel());
      return;
    }
    app.appendChild(toolbar(R.all));
    R.count = h('div.res-count', { 'aria-live': 'polite' });
    R.list = h('div.res-list');
    app.appendChild(R.count);
    app.appendChild(R.list);
    drawList();
    app.appendChild(helpPanel());
  }

  function leave() {
    clearTimeout(timer); timer = null;
    last = S; R = null;
  }

  CORB.registerView({
    id: 'resources', title: 'Resources', icon: 'link', section: 'Reference', order: 320, nav: true, short: 'Links',
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || {};
      var sig = JSON.stringify(p);
      var hasParams = Object.keys(p).length > 0;
      if (last && sig === lastSig) S = last;
      else if (hasParams) S = fromParams(p);
      else if (last) S = last;
      else S = fresh();
      lastSig = sig; last = S;
      R = {};
      build(root);
    },
    onLeave: leave
  });
})();
