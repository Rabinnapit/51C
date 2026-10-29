/* VIEW: process — Warrant process guide (Prepare)
   Reads CORB.DATA.process (policy summary, classes, steps, board, packet checklist, VCE how-to,
   reciprocity, suspension/termination) and CORB.DATA.meta. Checklist state persists under
   progress.path.process.<checklist id>. Route params: tab=<overview|classes|steps|board|packet|vce|reciprocity>,
   step=<n> (opens the Steps tab and scrolls to that step). Renders a helpful empty state when the
   module is missing and tolerates partially shaped data. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon;

  var TABS = [
    { id: 'steps', label: 'Steps', icon: 'process' },
    { id: 'overview', label: 'Overview', icon: 'compass' },
    { id: 'classes', label: 'Classes', icon: 'layers' },
    { id: 'board', label: 'Board', icon: 'users' },
    { id: 'packet', label: 'Packet checklist', icon: 'quiz' },
    { id: 'vce', label: 'VCE how-to', icon: 'monitor' },
    { id: 'reciprocity', label: 'Reciprocity & termination', icon: 'shuffle' }
  ];
  var PROG = 'progress.path.process';
  var CHAIN_HINTS = {
    'ASA(ALT)': 'Holds Army procurement authority',
    'DASA(P)': 'Delegates warrant-granting authority',
    'HCA': 'Issues warrants; may delegate KO appointments',
    'SCO/CoCO': 'Lowest delegated level; appoints in VCE-Warrants'
  };
  var URL_RE = /(https?:\/\/[^\s)]+)/g;

  var state = { tab: 'steps', root: null, params: {}, calc: null, offChange: null, printBound: false, printRestore: null, printAll: false };

  // ---------- small helpers ----------
  function data() { var d = CORB.DATA && CORB.DATA.process; return d && typeof d === 'object' && !Array.isArray(d) ? d : null; }
  function meta() { return (CORB.DATA && CORB.DATA.meta) || {}; }
  function str(v) { return v == null ? '' : String(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function objs(v) { return arr(v).filter(function (x) { return x != null && x !== ''; }); }
  function has(v) { if (v == null) return false; if (typeof v === 'string') return v.trim().length > 0; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }
  function txt(v) { if (v == null) return ''; if (Array.isArray(v)) return objs(v).map(function (x) { return '- ' + txt(x); }).join('\n'); if (typeof v === 'object') return txt(v.text || v.body || v.note || ''); return String(v); }
  function rich(v) { return ui.rich(txt(v)); }
  function key(id) { return str(id).replace(/[^\w-]/g, '_'); }
  function stepKey(s, i) { return key(s && s.n != null ? s.n : (i + 1)); }
  function isDone(id) { return !!CORB.get(PROG + '.' + key(id)); }
  function setDone(id, v) { CORB.set(PROG + '.' + key(id), v ? CORB.util.today() : false); }
  function setVar(el, name, val) { try { el.style.setProperty(name, String(val)); } catch (e) {} return el; }
  function fmtMoney(n) { if (n === Infinity) return 'Unlimited'; if (n == null || isNaN(n)) return '—'; return '$' + Math.round(n).toLocaleString('en-US'); }
  function parseMoney(s) {
    s = str(s).trim().toLowerCase().replace(/[$,\s_]/g, '');
    if (!s) return 0;
    var m = /^(-?\d*\.?\d+)([kmb])?$/.exec(s);
    if (!m) return NaN;
    return parseFloat(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1);
  }
  function parseThreshold(label, refs) {
    var t = str(label).trim();
    if (/^unlimited$/i.test(t)) return Infinity;
    if (/^sat$/i.test(t)) return refs.sat > 0 ? refs.sat : null;
    if (/^sap$/i.test(t)) return refs.sap > 0 ? refs.sap : null;
    var n = parseMoney(t);
    return isNaN(n) || n <= 0 ? null : n;
  }
  function linky(text) {
    return str(text).split(URL_RE).map(function (p, i) { return i % 2 ? h('a', { href: p, target: '_blank', rel: 'noopener' }, p) : p; });
  }
  function preview(text, max) {
    var t = str(text).replace(/\s+/g, ' ').trim(); max = max || 150;
    var m = /^(.{24,}?[.;])\s/.exec(t);
    var out = m ? m[1] : t;
    return out.length > max ? out.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : out;
  }
  function scrollTo(el) { if (!el) return; try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); } }

  function section(o, body) {
    return h('section.p-section' + (o.cls ? '.' + o.cls : ''), { id: o.id || null },
      h('div.p-section-head', {},
        h('div', {}, o.eyebrow ? h('div.eyebrow', {}, o.eyebrow) : null, h('h2', {}, o.title), o.sub ? h('p.p-section-sub', {}, o.sub) : null),
        o.actions || null),
      body);
  }
  function source(text) { return has(text) ? h('div.p-source', {}, icon('book'), h('span', {}, 'Source: ' + txt(text))) : null; }
  function missing(label) { return h('div.p-missing', {}, icon('info'), h('span', {}, 'The ' + label + ' section is not in this build yet. It appears here once the process module is merged.')); }
  function kv(label, value, o) { return has(value) ? h('div.p-kv' + (o && o.cls ? '.' + o.cls : ''), {}, h('div.label', {}, label), rich(value)) : null; }
  function panel(id, children) { return h('div.p-panel', { id: 'p-panel-' + id, role: 'tabpanel', 'aria-labelledby': 'p-tab-' + id }, children); }
  function stagger(el, i) { el.classList.add('p-rise'); return setVar(el, '--i', i); }
  function reqBadge(required) { return required ? h('span.badge.p-req', {}, icon('flag'), 'Required') : h('span.badge.neutral', {}, 'If applicable'); }
  function noteCard(title, iconName, body, i) { return stagger(h('div.card.p-note', {}, h('div.p-note-head', {}, h('span.p-note-icon', {}, icon(iconName)), h('h3', {}, title)), rich(body)), i || 0); }

  // ---------- progress ----------
  function stepList(d) { return objs(d && d.steps).filter(function (s) { return typeof s === 'object'; }).map(function (s, i) { return s.n == null ? Object.assign({ n: i + 1 }, s) : s; }); }
  function stepItems(d) { var out = []; stepList(d).forEach(function (s) { checkItems(s).forEach(function (c) { out.push({ n: s.n, id: c.id, required: !!c.required }); }); }); return out; }
  function packetItems(d) { return objs(d && d.packet_checklist).filter(function (c) { return typeof c === 'object' && c.id; }); }
  function checkItems(s) { return objs(s && s.checklist).filter(function (c) { return typeof c === 'object' && c.id; }); }
  function progressOf(items) { var done = items.filter(function (i) { return isDone(i.id); }).length; return { done: done, total: items.length, pct: CORB.util.pct(done, items.length) }; }
  function stepComplete(s) {
    var items = checkItems(s); if (!items.length) return false;
    var req = items.filter(function (c) { return c.required; });
    return (req.length ? req : items).every(function (c) { return isDone(c.id); });
  }
  function meterEl(pr, o) {
    o = o || {};
    var bar = h('div.bar' + (pr.pct >= 100 ? '.ok' : ''), { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pr.pct), 'aria-label': o.label || 'Progress' }, h('span', { style: { width: pr.pct + '%' } }));
    return h('div.p-meter' + (o.cls ? '.' + o.cls : ''), { 'data-prog': o.key || null }, bar, h('span.p-meter-text.num', {}, o.text || (pr.done + '/' + pr.total)));
  }
  function updateMeter(el, pr, text) {
    if (!el) return;
    var bar = el.querySelector('.bar'), span = el.querySelector('.bar > span'), t = el.querySelector('.p-meter-text');
    if (span) span.style.width = pr.pct + '%';
    if (bar) { bar.classList.toggle('ok', pr.pct >= 100); bar.setAttribute('aria-valuenow', String(pr.pct)); }
    if (t) t.textContent = text;
  }
  function updateProgressUI() {
    var d = data(), root = state.root; if (!d || !root) return;
    var sp = progressOf(stepItems(d)), pp = progressOf(packetItems(d)), rp = progressOf(packetItems(d).filter(function (c) { return c.required; }));
    root.querySelectorAll('[data-prog="steps"]').forEach(function (el) { updateMeter(el, sp, sp.done + ' of ' + sp.total + ' items · ' + sp.pct + '%'); });
    root.querySelectorAll('[data-prog="packet"]').forEach(function (el) { updateMeter(el, pp, pp.done + ' of ' + pp.total + ' items · ' + rp.done + '/' + rp.total + ' required'); });
    var strip = root.querySelector('[data-strip="checklist"]');
    if (strip) { var v = strip.querySelector('.value'), s = strip.querySelector('.sub'); if (v) v.textContent = sp.pct + '%'; if (s) s.textContent = sp.done + ' of ' + sp.total + ' step items'; }
    stepList(d).forEach(function (s) {
      var pr = progressOf(checkItems(s)), done = stepComplete(s), n = stepKey(s);
      root.querySelectorAll('[data-step-meter="' + n + '"]').forEach(function (el) { updateMeter(el, pr, pr.done + '/' + pr.total); });
      root.querySelectorAll('#p-step-' + n + ', [data-jump="' + n + '"]').forEach(function (el) { el.classList.toggle('done', done); });
    });
    root.querySelectorAll('.p-packet-group').forEach(function (g) {
      var its = Array.prototype.map.call(g.querySelectorAll('.p-check[data-id]'), function (l) { return { id: l.getAttribute('data-id') }; });
      var gp = progressOf(its); var c = g.querySelector('.p-packet-count'); if (c) c.textContent = gp.done + '/' + gp.total;
      g.classList.toggle('done', gp.total > 0 && gp.done === gp.total);
    });
  }

  function checkItem(c, o) {
    o = o || {};
    var done = isDone(c.id);
    var input = h('input', { type: 'checkbox', checked: done, 'aria-label': str(c.text) });
    var wrap = h('label.p-check' + (done ? '.done' : '') + (c.pii ? '.pii' : ''), { 'data-id': key(c.id) },
      h('span.p-check-box', {}, input, h('span.p-check-mark', { 'aria-hidden': 'true' }, icon('check'))),
      h('span.p-check-main', {},
        h('span.p-check-text', {}, str(c.text)),
        h('span.p-check-badges', {}, reqBadge(!!c.required), o.who !== false && has(c.who) ? h('span.badge.neutral', {}, str(c.who)) : null, c.pii ? h('span.badge.p-pii', {}, icon('alert'), 'PII · e-mail only') : null)));
    input.addEventListener('change', function () { setDone(c.id, input.checked); wrap.classList.toggle('done', input.checked); updateProgressUI(); });
    return wrap;
  }

  // ---------- header ----------
  function header(d) {
    var m = meta(), b = (d && d.board) || {};
    var days = m.next_board ? CORB.util.daysUntil(m.next_board) : null;
    var nextSub = days == null ? 'Confirm the date with C&P' : days === 0 ? 'Today' : days > 0 ? 'in ' + CORB.util.plural(days, 'day') : CORB.util.plural(-days, 'day') + ' ago';
    return h('div.page-head.p-head', {},
      h('div.p-head-top', {},
        h('div.p-head-copy', {},
          h('h1', {}, 'Warrant process'),
          h('p.lede', {}, 'From the VCE-Warrants application to the signed certificate: who does what, in what order, and what the packet needs.')),
        h('div.p-head-actions.no-print', {},
          d ? h('button.btn.sm', { type: 'button', onclick: printGuide, 'data-tip': 'Print the whole guide' }, icon('print'), 'Print guide') : null)),
      d ? h('div.p-boardline', {}, icon('calendar'),
        h('span', {}, 'Board: ' + str(b.cadence || m.board_cadence || 'ask C&P') + (m.next_board ? ' · next ' + CORB.util.fmtDate(m.next_board) + ' (' + nextSub + ')' : '')))
      : null,
      h('div.p-print-only', {}, str(m.app_name || 'Signatory') + ' · Warrant process guide · printed ' + CORB.util.today() + ' · training aid, not authoritative guidance.'));
  }

  // ---------- tabs ----------
  function tabBar() {
    var bar = h('div.tabs.p-tabs.no-print', { role: 'tablist', 'aria-label': 'Warrant process sections' });
    TABS.forEach(function (t) {
      var on = t.id === state.tab;
      bar.appendChild(h('button' + (on ? '.on' : ''), { type: 'button', role: 'tab', id: 'p-tab-' + t.id, 'aria-selected': on ? 'true' : 'false', 'aria-controls': 'p-panel-' + t.id, tabindex: on ? '0' : '-1', 'data-tab': t.id, onclick: function () { setTab(t.id); }, onkeydown: tabKeys }, icon(t.icon), h('span', {}, t.label)));
    });
    return bar;
  }
  function tabKeys(e) {
    var btns = Array.prototype.slice.call(e.currentTarget.parentNode.querySelectorAll('[role="tab"]'));
    var i = btns.indexOf(e.currentTarget), n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % btns.length; else if (e.key === 'ArrowLeft') n = (i - 1 + btns.length) % btns.length; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = btns.length - 1;
    if (n == null) return;
    e.preventDefault(); setTab(btns[n].getAttribute('data-tab')); btns[n].focus();
  }
  function validTab(id) { return TABS.some(function (t) { return t.id === id; }) ? id : 'steps'; }
  function setTab(id) {
    id = validTab(id); state.tab = id; state.printAll = false;
    var root = state.root; if (!root) return;
    try { history.replaceState(null, '', '#/process?tab=' + encodeURIComponent(id)); } catch (e) {}
    root.querySelectorAll('.p-tabs [role="tab"]').forEach(function (b) { var on = b.getAttribute('data-tab') === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.setAttribute('tabindex', on ? '0' : '-1'); });
    var host = root.querySelector('.p-panel-host'); if (!host) return;
    host.innerHTML = ''; host.appendChild(renderTab(id));
    var on = root.querySelector('.p-tabs .on'); if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} }
  }
  function renderTab(id) {
    var d = data() || {};
    try {
      switch (id) {
        case 'classes': return tabClasses(d);
        case 'steps': return tabSteps(d);
        case 'board': return tabBoard(d);
        case 'packet': return tabPacket(d);
        case 'vce': return tabVce(d);
        case 'reciprocity': return tabReciprocity(d);
        case 'overview': return tabOverview(d);
        default: return tabSteps(d);
      }
    } catch (e) {
      console.error('[CORB] process tab error', id, e);
      return h('div.callout.danger', {}, icon('alert'), h('div', {}, h('b', {}, 'This section hit an error'), String(e && e.message || e)));
    }
  }

  // ---------- Overview ----------
  function tabOverview(d) {
    var ps = (d.policy_summary && typeof d.policy_summary === 'object') ? d.policy_summary : {};
    var out = [];
    if (!has(ps)) out.push(missing('policy summary'));
    if (has(ps.purpose)) out.push(section({ eyebrow: 'Purpose & authority', title: 'What a warrant is, and who grants it' }, stagger(h('div.card.p-purpose', {}, rich(ps.purpose)), 0)));

    var chain = objs(ps.authority_chain).map(str);
    if (chain.length) {
      var nodes = [];
      chain.forEach(function (name, i) {
        var node = h('div.p-chain-node' + (i === chain.length - 1 ? '.is-last' : ''), { role: 'listitem' }, h('span.p-chain-idx', {}, String(i + 1).padStart(2, '0')), h('b', {}, name), CHAIN_HINTS[name] ? h('small', {}, CHAIN_HINTS[name]) : null);
        nodes.push(setVar(node, '--i', i));
        if (i < chain.length - 1) nodes.push(h('div.p-chain-arrow', { 'aria-hidden': 'true' }, icon('arrow-right')));
      });
      out.push(section({ eyebrow: 'Authority chain', title: 'How signatory authority flows down', sub: 'Read left to right: each office delegates to the next. The last node is where the 411th appointment is actually made.' },
        h('div', {}, h('div.p-chain', { role: 'list', 'aria-label': 'Authority chain' }, nodes), has(ps.authority_chain_note) ? h('div.p-chain-note', {}, rich(ps.authority_chain_note)) : null)));
    }

    // Korea has no Grants or Agreements officers, so the guide covers the contracting officer (KO) warrant only.
    var ko = objs(ps.warrant_types).filter(function (t) { return typeof t === 'object' && str(t.type).toUpperCase() === 'KO'; })[0] || null;
    var q = (ps.qualifications && typeof ps.qualifications === 'object') ? ps.qualifications : {};
    if (ko || has(q.ko) || has(q.readiness)) {
      out.push(section({ eyebrow: 'Warrant and qualifications', title: 'What you must bring before the board' },
        h('div', {},
          has(q.readiness) ? h('div.callout.info.mb-4', {}, icon('shield'), h('div', {}, h('b', {}, 'Readiness'), rich(q.readiness))) : null,
          h('div.grid.cols-2.p-quals', {},
            ko ? stagger(h('div.card.p-type', {}, h('div.p-type-tag', {}, str(ko.type)), h('h3', {}, str(ko.expansion || ko.name || 'Contracting Officer')), kv('Defined in', ko.basis || ko.defined_in), kv('Board', ko.board), has(ko.note) ? rich(ko.note) : null), 0) : null,
            has(q.ko) ? stagger(h('div.card.tight.p-qual', {}, h('div.eyebrow', {}, 'Qualifications'), h('h3', {}, 'Contracting Officer (KO)'), h('ul.p-list', {}, objs(q.ko).map(function (x) { return h('li', {}, icon('check'), rich(x)); }))), 1) : null))));
    }

    var notes = [['waivers', 'Waivers', 'shield'], ['legacy_warrants', 'Legacy warrants', 'clock'], ['multiple_warrants', 'Multiple warrants', 'layers'], ['unlimited_warrants', 'Unlimited warrants', 'award'], ['certificate_and_letter', 'Certificate and appointment letter', 'note']].filter(function (n) { return has(ps[n[0]]); });
    if (notes.length) {
      out.push(section({ eyebrow: 'Policy notes', title: 'Rules candidates get asked about' },
        h('div.grid.cols-2.p-notes', {}, notes.map(function (n, i) { return noteCard(n[1], n[2], ps[n[0]], i); }))));
    }
    if (has(ps.source)) out.push(source(ps.source));

    var sources = objs(d.sources).filter(function (s) { return typeof s === 'object'; });
    if (sources.length) {
      out.push(h('details.acc.mt-5', {}, h('summary', {}, icon('book'), 'Where this guide comes from (' + sources.length + ')', icon('chevron', 'chev')), h('div.acc-body', {},
        h('p.muted.small', {}, 'Local routing and calendar details come from the 411th workflow. Confirm current practice with C&P.'),
        h('div.p-sources', {}, sources.map(function (s, i) {
          var note = has(s.note) ? s.note : s.used_for;
          return stagger(h('div.p-src', {}, h('div', {}, h('b', {}, str(s.title || s.id || 'Source')), has(s.date) ? h('span.muted.small.num', {}, ' · ' + str(s.date)) : null, has(note) ? h('div.muted.small.mt-2', {}, txt(note)) : null), h('div.p-src-meta', {}, s.access ? h('span.badge.neutral', {}, s.access === 'cac' ? 'CAC' : s.access === 'public' ? 'Public' : 'Local file') : null, s.url ? h('a.btn.sm.ghost', { href: str(s.url), target: '_blank', rel: 'noopener' }, icon('external'), 'Open') : null)), i);
        })))));
    }
    if (d.meta && has(d.meta.disclaimer)) out.push(h('div.callout.warn.mt-5', {}, icon('alert'), h('div', {}, h('b', {}, 'Training aid'), str(d.meta.disclaimer))));
    return panel('overview', out);
  }

  // ---------- Classes ----------
  function refThresholds() {
    var regs = (CORB.DATA && CORB.DATA.regulations) || {}; var th = objs(regs.thresholds).filter(function (t) { return typeof t === 'object'; });
    var sat = th.filter(function (t) { return t.id === 'sat'; })[0] || null;
    var sap = th.filter(function (t) { return /^sap/i.test(str(t.id)); })[0] || null;
    return { sat: sat && sat.value_number > 0 ? sat.value_number : null, sap: sap && sap.value_number > 0 ? sap.value_number : null, satStatus: sat ? sat.status : null, sapStatus: sap ? sap.status : null, available: !!(sat || sap) };
  }
  function classList(d) { return objs(d.warrant_classes).filter(function (c) { return typeof c === 'object' && has(c.cls); }); }
  function buildRungs(classes, refs) {
    var rungs = [];
    classes.forEach(function (c) { objs(c.thresholds).forEach(function (t) { var v = parseThreshold(t, refs); rungs.push({ label: str(t), cls: str(c.cls), value: v }); }); });
    var known = rungs.filter(function (r) { return r.value != null; }).sort(function (a, b) { return a.value - b.value; });
    return { all: rungs, known: known, unknown: rungs.filter(function (r) { return r.value == null; }) };
  }
  function tabClasses(d) {
    var classes = classList(d), rules = (d.warrant_class_rules && typeof d.warrant_class_rules === 'object') ? d.warrant_class_rules : {};
    var out = [];
    if (has(rules.calculating_value) || has(rules.fixed_thresholds)) {
      out.push(section({ eyebrow: 'The rule', title: 'Your warrant must cover the cumulative instrument value' },
        h('div', {},
          h('div.p-formula', { 'aria-label': 'Cumulative value formula' }, ['Base value', '+', 'All options', '+', 'Ceiling', '+', '| Modification |', '≤', 'Warrant'].map(function (t, i) { return (i % 2) ? h('span.p-formula-op', {}, t) : stagger(h('span.p-formula-term' + (t === 'Warrant' ? '.is-result' : ''), {}, t), i / 2); })),
          h('div.grid.cols-2.mt-4', {}, has(rules.calculating_value) ? h('div.card.tight.p-rule', {}, h('div.eyebrow', {}, 'Calculating value'), rich(rules.calculating_value)) : null, has(rules.fixed_thresholds) ? h('div.card.tight.p-rule', {}, h('div.eyebrow', {}, 'Fixed thresholds'), rich(rules.fixed_thresholds)) : null),
          source(rules.source))));
    }

    if (!classes.length) out.push(missing('warrant classes'));
    else {
      var ladder = classes.slice().reverse();
      out.push(section({ eyebrow: 'Table 1 · Policy v12', title: 'The warrant ladder', sub: 'Highest authority at the top. Every warrant is granted at one of these fixed thresholds and stays valid until suspended or terminated.' },
        h('div.p-ladder', {},
          h('div.p-ladder-head', { 'aria-hidden': 'true' }, h('span', {}, 'Class'), h('span', {}, 'Thresholds'), h('span', {}, 'Who it is for'), h('span', {}, 'Roles, focus and notes')),
          ladder.map(function (c, i) {
            var rung = h('div.p-rung' + (i === 0 ? '.is-top' : ''), { 'data-cls': str(c.cls) },
              h('div.p-rung-cls', {}, h('small', {}, 'Class'), h('span', {}, str(c.cls))),
              h('div.p-rung-thr', {}, objs(c.thresholds).length ? objs(c.thresholds).map(function (t) { return h('span.p-thr', { 'data-cls': str(c.cls), 'data-thr': str(t) }, str(t)); }) : h('span.muted.small', {}, 'No thresholds listed')),
              h('div.p-rung-col', {}, h('div.label', {}, 'Who it is for'), has(c.who) ? rich(c.who) : h('span.muted', {}, '—')),
              h('div.p-rung-col', {},
                has(c.typical_roles) ? h('div', {}, h('div.label', {}, 'Typical roles'), h('div.p-roles', {}, objs(c.typical_roles).map(function (r) { return h('span.p-role', {}, str(r)); }))) : null,
                has(c.board_focus) ? h('div.mt-3', {}, h('div.label', {}, 'Board focus'), h('div.small.muted', {}, str(c.board_focus))) : null,
                has(c.note) ? h('div.p-rung-note', {}, icon('info'), h('span', {}, str(c.note))) : null,
                source(c.source)));
            setVar(rung, '--lvl', ladder.length - 1 - i);
            return stagger(rung, i);
          }),
          has(d.warrant_classes_legacy_note) ? h('div.callout.info.mt-4', {}, icon('clock'), h('div', {}, h('b', {}, 'Older tables you may still see'), rich(d.warrant_classes_legacy_note))) : null)));
      out.push(section({ eyebrow: 'Calculator', title: 'Which class does this instrument need?', sub: 'Type dollar amounts (500k, 2.5M and $1,000,000 all work). The result is the lowest fixed threshold that covers the cumulative value.' }, calculator(classes)));
    }
    return panel('classes', out);
  }
  function calculator(classes) {
    var refs = refThresholds();
    var c = state.calc || (state.calc = { base: '', options: '', ceiling: '', mod: '', sat: refs.sat ? String(refs.sat) : '', sap: refs.sap ? String(refs.sap) : '' });
    var out = h('div.p-calc-out', { 'aria-live': 'polite' });
    function field(label, k, hint, cls) {
      var inp = h('input.input', { type: 'text', inputmode: 'decimal', value: c[k], placeholder: '$0', autocomplete: 'off', 'aria-label': label, oninput: function () { c[k] = inp.value; compute(); } });
      return h('div.field' + (cls ? '.' + cls : ''), {}, h('label', {}, label), inp, hint ? h('div.hint', {}, hint) : null);
    }
    function refHint(status) { if (!refs.available) return 'Not in this build — enter the current value'; return status === 'verified' ? 'Verified value from the Regulation explorer' : 'From the Regulation explorer · status: ' + (status || 'verify'); }
    function compute() {
      var base = parseMoney(c.base), opts = parseMoney(c.options), ceil = parseMoney(c.ceiling), mod = Math.abs(parseMoney(c.mod));
      var bad = [base, opts, ceil, mod].some(function (n) { return isNaN(n); });
      var total = bad ? NaN : base + opts + ceil + mod;
      var r = buildRungs(classes, { sat: parseMoney(c.sat), sap: parseMoney(c.sap) });
      var pick = (!bad && total > 0) ? r.known.filter(function (x) { return x.value >= total; })[0] || null : null;
      out.innerHTML = '';
      out.appendChild(h('div.p-calc-label', {}, 'Cumulative instrument value'));
      out.appendChild(h('div.p-calc-total.num', {}, bad ? 'Check your numbers' : fmtMoney(total)));
      out.appendChild(h('div.p-calc-parts.num', {}, bad ? 'Use digits with an optional k, M or B suffix.' : fmtMoney(base) + ' + ' + fmtMoney(opts) + ' + ' + fmtMoney(ceil) + ' + |' + fmtMoney(mod) + '|'));
      var verdict;
      if (bad || !(total > 0)) verdict = h('div.p-calc-verdict.is-idle', {}, icon('target'), h('span', {}, 'Enter the base, options, ceiling and modification to see the minimum warrant.'));
      else if (!pick) verdict = h('div.p-calc-verdict.is-over', {}, icon('alert'), h('span', {}, 'Above every fixed threshold in the table. Confirm the appropriate authority with C&P.'));
      else verdict = h('div.p-calc-verdict.is-hit', {}, icon(pick.value === Infinity ? 'award' : 'check'), h('div', {}, h('div', {}, 'Minimum warrant: ', h('b', {}, pick.label)), h('div.p-calc-verdict-row', {}, ui.classBadge(pick.cls), pick.value === Infinity ? h('span.small', {}, 'Unlimited: the board cannot be waived') : h('span.small', {}, 'headroom ' + fmtMoney(pick.value - total)))));
      out.appendChild(verdict);
      if (r.known.length) out.appendChild(h('div.p-mini-ladder', { 'aria-label': 'Fixed thresholds' }, r.known.map(function (x) { return h('span.p-thr' + (pick && x === pick ? '.hit' : '') + (!bad && total > 0 && x.value < total ? '.below' : ''), { title: 'Class ' + x.cls }, x.label); })));
      if (r.unknown.length) out.appendChild(h('div.p-calc-warn', {}, icon('info'), h('span', {}, r.unknown.map(function (x) { return x.label; }).join(' and ') + ' not placed: enter the current value in the reference fields.')));
      out.appendChild(h('div.p-calc-foot', {}, 'Training aid. Confirm thresholds and the class for your role with C&P before relying on this.'));
      if (state.root) state.root.querySelectorAll('.p-ladder .p-thr').forEach(function (el) { el.classList.toggle('hit', !!pick && el.getAttribute('data-cls') === pick.cls && el.getAttribute('data-thr') === pick.label); });
    }
    var el = h('div.p-calc', {},
      h('div.card.p-calc-in', {},
        h('div.p-calc-inputs', {},
          field('Base value', 'base', 'The base contract or order amount'),
          field('All options', 'options', 'Every option period or quantity, exercised or not'),
          field('Ceiling', 'ceiling', 'Anticipated or actual ceiling (IDIQ, BPA)'),
          field('Modification', 'mod', 'Absolute value: a $2M decrease counts as $2M')),
        h('div.p-calc-refs', {},
          h('div.p-calc-refs-head', {}, icon('map'), h('span', {}, 'Reference thresholds'), CORB.views.regulations ? h('button.btn.sm.ghost', { type: 'button', onclick: function () { CORB.go('regulations', { tab: 'thresholds' }); } }, 'Regulation explorer', icon('arrow-right')) : null),
          h('div.p-calc-inputs', {}, field('SAT', 'sat', refHint(refs.satStatus)), field('SaP ceiling', 'sap', refHint(refs.sapStatus))))),
      out);
    compute();
    setTimeout(compute, 0); // the ladder above is in the DOM by then, so the matching rung lights up
    return el;
  }

  // ---------- Steps ----------
  function tabSteps(d) {
    var steps = stepList(d).sort(function (a, b) { return (Number(a.n) || 0) - (Number(b.n) || 0); });
    if (!steps.length) return panel('steps', missing('steps'));
    var target = state.printAll ? '' : key(state.params.step);
    if (target && !steps.some(function (s) { return stepKey(s) === target; })) target = '';
    var firstOpen = steps.filter(function (s) { return !stepComplete(s); })[0] || steps[0];
    var pr = progressOf(stepItems(d));

    var toolbar = h('div.card.p-steps-top', {},
      h('div.p-steps-top-main', {},
        h('div.eyebrow', {}, 'Whole packet'),
        h('div.p-steps-top-title', {}, 'Every checklist item across all ' + steps.length + ' steps'),
        meterEl(pr, { key: 'steps', text: pr.done + ' of ' + pr.total + ' items · ' + pr.pct + '%', cls: 'big', label: 'Whole packet progress' })),
      h('div.p-steps-top-actions.no-print', {},
        h('button.btn.sm', { type: 'button', onclick: function () { openAll(true); } }, icon('chevron'), 'Expand all'),
        h('button.btn.sm', { type: 'button', onclick: function () { openAll(false); } }, 'Collapse all'),
        h('button.btn.sm.ghost.danger', { type: 'button', onclick: resetChecklists }, icon('trash'), 'Clear checklists')));

    var jump = h('nav.p-jump.no-print', { 'aria-label': 'Jump to step' }, steps.map(function (s) {
      var n = stepKey(s);
      return h('button.p-jump-btn' + (stepComplete(s) ? '.done' : ''), { type: 'button', 'data-jump': n, 'data-tip': 'Step ' + s.n + ': ' + preview(s.who || s.what, 60), 'aria-label': 'Step ' + s.n + ': ' + str(s.who || s.what), onclick: function () { revealStep(n, true); } }, String(s.n));
    }));

    var list = h('ol.p-timeline', {}, steps.map(function (s, i) {
      var items = checkItems(s), n = stepKey(s);
      var spr = progressOf(items);
      var open = target ? n === target : s === firstOpen;
      var det = h('details.p-step-card', { open: open },
        h('summary', {},
          h('div.p-step-sum', {}, h('div.eyebrow', {}, 'Step ' + s.n), h('div.p-step-title', {}, str(s.who) || 'Step ' + s.n), has(s.what) ? h('div.p-step-sub', {}, preview(s.what)) : null),
          h('div.p-step-side', {}, items.length ? meterEl(spr, { text: spr.done + '/' + spr.total, label: 'Step ' + s.n + ' checklist' }) : null, icon('chevron', 'chev'))),
        h('div.p-step-body', {},
          has(s.what) ? h('div.p-step-what', {}, rich(s.what)) : null,
          (has(s.routing) || has(s.timeline)) ? h('div.p-step-grid', {}, kv('Routing', s.routing), kv('Timeline', s.timeline)) : null,
          items.length ? h('div.p-step-check', {}, h('div.p-step-check-head', {}, h('div.eyebrow', {}, 'Checklist'), h('span.muted.small', {}, CORB.util.plural(items.filter(function (c) { return c.required; }).length, 'required item'))), h('div.p-checklist', {}, items.map(function (c) { return checkItem(c); }))) : null,
          has(s.tips) ? h('div.p-tips', {}, h('div.eyebrow', {}, 'Tips'), h('ul.p-list', {}, objs(s.tips).map(function (t) { return h('li', {}, icon('zap'), rich(t)); }))) : null,
          source(s.source)));
      var m = det.querySelector('.p-step-side .p-meter'); if (m) m.setAttribute('data-step-meter', n);
      var li = h('li.p-step' + (stepComplete(s) ? '.done' : ''), { id: 'p-step-' + n }, h('div.p-step-dot', { 'aria-hidden': 'true' }, h('span.p-step-num', {}, String(s.n)), h('span.p-step-tick', {}, icon('check'))), det);
      return stagger(li, Math.min(i, 8));
    }));

    var p = panel('steps', [toolbar, jump, list, h('div.callout.info.mt-5', {}, icon('info'), h('div', {}, h('b', {}, 'Timelines'), 'Where the source does not state a timeline, the step says so. Urgent applications are worked faster based on mission requirements. Confirm current routing with C&P.'))]);
    if (target) setTimeout(function () { revealStep(target, true); }, 80);
    return p;
  }
  function revealStep(n, highlight) {
    var root = state.root; if (!root) return;
    var li = root.querySelector('#p-step-' + key(n)); if (!li) return;
    var det = li.querySelector('details'); if (det) det.open = true;
    if (highlight) { li.classList.remove('is-target'); void li.offsetWidth; li.classList.add('is-target'); setTimeout(function () { li.classList.remove('is-target'); }, 2400); }
    scrollTo(li);
    var sum = det && det.querySelector('summary'); if (sum) { try { sum.focus({ preventScroll: true }); } catch (e) {} }
  }
  function openAll(open) { if (state.root) state.root.querySelectorAll('.p-panel details').forEach(function (d) { d.open = open; }); }
  function resetChecklists() {
    ui.confirm('Clear every checkbox in the steps and packet checklists? Your other progress is untouched.', { title: 'Clear checklists', ok: 'Clear', danger: true }).then(function (ok) {
      if (!ok) return;
      CORB.set(PROG, {});
      setTab(state.tab); updateProgressUI(); ui.toast('Checklists cleared');
    });
  }

  // ---------- Board ----------
  function tabBoard(d) {
    var b = (d.board && typeof d.board === 'object') ? d.board : {}, m = meta();
    if (!has(b)) return panel('board', missing('board'));
    var out = [];
    var role = CORB.role();
    var rule = str(b.decision_rule);
    out.push(h('div.p-board-hero', {},
      stagger(h('div.p-decision', {}, h('div.eyebrow', {}, 'Decision rule'), h('b', {}, rule ? rule.charAt(0).toUpperCase() + rule.slice(1) : 'Not stated in the sources'), h('div.p-decision-sub', {}, /unanim/i.test(rule) ? 'One "no" is a "not yet". Prepare for every voting member, not just the chair.' : 'Confirm the decision rule with C&P before the board.')), 0),
      stagger(h('div.card.p-cadence', {},
        h('div.eyebrow', {}, 'Cadence'),
        h('div.p-cadence-value', {}, str(b.cadence || m.board_cadence || '—')),
        m.next_board ? h('div.p-cadence-next', {}, icon('calendar'), h('span', {}, 'Next: ' + CORB.util.fmtDate(m.next_board))) : null,
        has(b.chair) ? h('div.muted.small.mt-3', {}, 'Chair: ' + str(b.chair)) : null), 1)));

    var voting = objs(b.voting).map(str);
    out.push(section({ eyebrow: 'Composition', title: 'Who sits on the board' },
      h('div', {},
        (voting.length || has(b.facilitator)) ? h('div.p-members', {}, voting.map(function (v, i) { return stagger(h('span.p-member' + (/chair/i.test(v) ? '.chair' : ''), {}, icon(/chair/i.test(v) ? 'award' : 'user'), v), i); }).concat(has(b.facilitator) ? [stagger(h('span.p-member.facilitator', {}, icon('settings'), str(b.facilitator)), voting.length)] : [])) : null,
        has(b.composition) ? h('div.card.mt-4', {}, rich(b.composition)) : null)));

    var cards = [['format', 'Format', 'mic'], ['scoring_note', 'Scoring', 'bar-chart'], ['waiver', 'Waivers', 'shield'], ['question_repository', 'Question repository', 'book']].filter(function (c) { return has(b[c[0]]); });
    if (cards.length) out.push(section({ eyebrow: 'How it runs', title: 'Format, scoring and waivers' }, h('div.grid.cols-2.p-notes', {}, cards.map(function (c, i) { return noteCard(c[1], c[2], b[c[0]], i); }))));

    var artifacts = objs(b.prep_artifacts).map(str);
    if (artifacts.length) out.push(section({ eyebrow: 'Before the board', title: 'What C&P prepares', sub: 'These artifacts exist before you walk in. Knowing them tells you what the board is working from.' },
      h('div.p-artifacts', {}, artifacts.map(function (a, i) { return stagger(h('div.p-artifact', {}, h('span.p-artifact-idx.num', {}, String(i + 1).padStart(2, '0')), icon('note'), h('span', {}, a)), i); }))));

    var ctas = [];
    if (CORB.views.mockboard) ctas.push(h('button.btn.primary', { type: 'button', onclick: function () { CORB.go('mockboard'); } }, icon('mic'), 'Practice with a mock board'));
    if (CORB.views.library) ctas.push(h('button.btn', { type: 'button', onclick: function () { CORB.go('library'); } }, icon('book'), 'Browse board questions'));
    if (CORB.views.board && role !== 'candidate') ctas.push(h('button.btn', { type: 'button', onclick: function () { CORB.go('board'); } }, icon('users'), 'Board console'));
    if (ctas.length) out.push(h('div.p-cta.no-print', {}, ctas));
    out.push(source(b.source));
    return panel('board', out);
  }

  // ---------- Packet checklist ----------
  function tabPacket(d) {
    var items = packetItems(d);
    if (!items.length) return panel('packet', missing('packet checklist'));
    var pp = progressOf(items), rp = progressOf(items.filter(function (c) { return c.required; }));
    var groups = [];
    items.forEach(function (c) { var who = has(c.who) ? str(c.who) : 'Other'; var g = groups.filter(function (x) { return x.who === who; })[0]; if (!g) { g = { who: who, items: [] }; groups.push(g); } g.items.push(c); });
    var pii = items.filter(function (c) { return c.pii; });
    var mode = 'all';
    var listHost = h('div.p-packet-groups');
    function groupIcon(who) { return /candidate/i.test(who) ? 'user' : /supervisor/i.test(who) ? 'users' : /sco/i.test(who) ? 'award' : 'settings'; }
    function draw() {
      listHost.innerHTML = '';
      var shown = 0;
      groups.forEach(function (g, gi) {
        var its = g.items.filter(function (c) { return mode === 'all' || c.required; });
        if (!its.length) return;
        shown++;
        var gp = progressOf(its);
        listHost.appendChild(stagger(h('div.p-packet-group' + (gp.total && gp.done === gp.total ? '.done' : ''), {},
          h('div.p-packet-group-head', {}, h('h3', {}, h('span.p-packet-icon', {}, icon(groupIcon(g.who))), g.who), h('span.p-packet-count.num', {}, gp.done + '/' + gp.total)),
          h('div.p-checklist', {}, its.map(function (c) { return checkItem(c, { who: false }); }))), gi));
      });
      if (!shown) listHost.appendChild(h('div.empty', {}, h('h3', {}, 'No required items'), h('p', {}, 'Nothing in this packet is marked required. Switch back to all items.')));
    }
    var seg = h('div.seg.no-print', { role: 'group', 'aria-label': 'Filter packet items' },
      h('button.on', { type: 'button', 'aria-pressed': 'true', onclick: function (e) { mode = 'all'; toggle(e.currentTarget); } }, 'All items'),
      h('button', { type: 'button', 'aria-pressed': 'false', onclick: function (e) { mode = 'required'; toggle(e.currentTarget); } }, 'Required only'));
    function toggle(btn) { seg.querySelectorAll('button').forEach(function (b) { var on = b === btn; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); draw(); }
    draw();
    var out = [
      h('div.card.p-steps-top', {},
        h('div.p-steps-top-main', {}, h('div.eyebrow', {}, 'Packet'), h('div.p-steps-top-title', {}, items.length + ' items · ' + items.filter(function (c) { return c.required; }).length + ' required'), meterEl(pp, { key: 'packet', text: pp.done + ' of ' + pp.total + ' items · ' + rp.done + '/' + rp.total + ' required', cls: 'big', label: 'Packet progress' })),
        h('div.p-steps-top-actions', {}, seg)),
      (pii.length || has(d.packet_checklist_note)) ? h('div.callout.danger.p-pii-callout', {}, icon('alert'), h('div', {}, h('b', {}, 'PII never goes into VCE-Warrants'),
        pii.length ? h('p', {}, CORB.util.plural(pii.length, 'item') + ' marked PII ' + (pii.length === 1 ? 'goes' : 'go') + ' to your supervisor by e-mail only.') : null,
        has(d.packet_checklist_note) ? rich(d.packet_checklist_note) : h('p', {}, 'Documents containing PII are removed from VCE-Warrants without notification.'))) : null,
      listHost,
      source(d.packet_checklist_source)
    ];
    return panel('packet', out);
  }

  // ---------- VCE how-to ----------
  function tabVce(d) {
    var howto = objs(d.vce_howto).filter(function (x) { return typeof x === 'object' && has(x.title); });
    if (!howto.length) return panel('vce', missing('VCE how-to'));
    var out = [
      h('div.p-vce-intro', {},
        h('div.callout.info', {}, icon('key'), h('div', {}, h('b', {}, 'VCE-Warrants is the system of record'), 'CAC required. Everything below describes the buttons and fields in the VCE-Warrants module; local routing choices (who reviews next) come from the 411th workflow. Confirm with C&P if the screen you see differs.')),
        h('div.row.no-print', {}, h('button.btn.sm', { type: 'button', onclick: function () { openAll(true); } }, icon('chevron'), 'Expand all'), h('button.btn.sm', { type: 'button', onclick: function () { openAll(false); } }, 'Collapse all'))),
      h('div.p-vce', {}, howto.map(function (x, i) {
        var steps = objs(x.steps);
        return stagger(h('details.acc.p-vce-item', { open: i === 0 },
          h('summary', {}, h('span.p-vce-num.num', {}, String(i + 1).padStart(2, '0')), h('span.grow', {}, str(x.title)), h('span.muted.small.num', {}, CORB.util.plural(steps.length, 'step')), icon('chevron', 'chev')),
          h('div.acc-body', {}, steps.length ? h('ol.p-vce-steps', {}, steps.map(function (s) { return h('li', {}, h('span', {}, linky(txt(s)))); })) : h('p.muted.small', {}, 'No steps recorded for this task yet.'), source(x.source))), i);
      }))
    ];
    return panel('vce', out);
  }

  // ---------- Reciprocity & termination ----------
  function tabReciprocity(d) {
    var r = (d.reciprocity && typeof d.reciprocity === 'object') ? d.reciprocity : {};
    var st = (d.suspension_termination && typeof d.suspension_termination === 'object') ? d.suspension_termination : {};
    var after = objs(d.after_appointment);
    var out = [];
    var parts = [['p-recip', 'Reciprocity', 'shuffle', has(r)], ['p-susp', 'Suspension & termination', 'stop', has(st)], ['p-after', 'After appointment', 'award', after.length > 0]].filter(function (p) { return p[3]; });
    if (parts.length > 1) out.push(h('nav.p-subnav.no-print', { 'aria-label': 'On this tab' }, parts.map(function (s) {
      return h('button.chip', { type: 'button', onclick: function () { scrollTo(state.root && state.root.querySelector('#' + s[0])); } }, icon(s[2]), s[1]);
    })));

    if (has(r)) {
      var systems = objs(r.systems).map(str);
      out.push(section({ id: 'p-recip', eyebrow: 'Reciprocity', title: 'Recognition, transfer and warrants from outside ACC' },
        h('div', {},
          has(r.policy_basis) ? h('div.callout.info.mb-4', {}, icon('book'), h('div', {}, h('b', {}, 'Policy basis'), rich(r.policy_basis))) : null,
          (has(r.recognition) || has(r.transfer)) ? h('div.p-compare', {},
            has(r.recognition) ? stagger(h('div.card.p-cmp.is-keep', {}, h('div.p-note-head', {}, h('span.p-note-icon', {}, icon('check')), h('h3', {}, 'Recognition')), h('div.p-cmp-tag', {}, 'No new warrant · same SCO organization or OPCON'), rich(r.recognition)), 0) : null,
            has(r.transfer) ? stagger(h('div.card.p-cmp.is-move', {}, h('div.p-note-head', {}, h('span.p-note-icon', {}, icon('shuffle')), h('h3', {}, 'Transfer')), h('div.p-cmp-tag', {}, 'Old warrant terminated · new warrant issued · permanent reassignment only'), rich(r.transfer)), 1) : null) : null,
          (has(r.external) || has(r.reinstating_inactive)) ? h('div.grid.cols-2.mt-4.p-notes', {},
            has(r.external) ? noteCard('Warrants from outside ACC', 'globe', r.external, 2) : null,
            has(r.reinstating_inactive) ? noteCard('Arriving without an active warrant', 'refresh', r.reinstating_inactive, 3) : null) : null,
          systems.length ? h('div.mt-4', {}, h('div.eyebrow.mb-3', {}, 'System access under reciprocity'), h('div.p-systems', {}, systems.map(function (s, i) { var m = /^([A-Z]{3,6}):\s*(.*)$/.exec(s); return stagger(h('div.p-system', {}, h('b', {}, m ? m[1] : 'System'), h('span', {}, m ? m[2] : s)), i); }))) : null,
          source(r.source))));
    } else out.push(missing('reciprocity'));

    if (has(st)) {
      var susp = objs(st.suspension_reasons).map(str), term = objs(st.termination_reasons).map(str);
      out.push(section({ id: 'p-susp', eyebrow: 'Suspension & termination', title: 'When a warrant pauses, and when it ends' },
        h('div', {},
          (susp.length || term.length) ? h('div.p-reasons', {},
            susp.length ? stagger(h('div.card.tight.p-reason.warn', {}, h('h3', {}, icon('pause'), 'Suspend when'), h('ul.p-reason-list', {}, susp.map(function (x) { return h('li', {}, icon('chevron-right'), x); }))), 0) : null,
            term.length ? stagger(h('div.card.tight.p-reason.danger', {}, h('h3', {}, icon('stop'), 'Terminate when'), h('ul.p-reason-list', {}, term.map(function (x) { return h('li', {}, icon('chevron-right'), x); }))), 1) : null) : null,
          h('div.grid.cols-2.mt-4.p-notes', {}, [['suspension_mechanics', 'How a suspension is recorded', 'pause'], ['termination_mechanics', 'How a termination is recorded', 'stop'], ['after_termination', 'After termination', 'x'], ['reinstatement', 'Reinstatement', 'refresh'], ['unapprove', 'Unapprove (corrections)', 'edit'], ['retention', 'Record retention', 'clock']].filter(function (c) { return has(st[c[0]]); }).map(function (c, i) { return noteCard(c[1], c[2], st[c[0]], i); })),
          source(st.source))));
    } else out.push(missing('suspension and termination'));

    if (after.length) {
      out.push(section({ id: 'p-after', eyebrow: 'After appointment', title: 'Life with a warrant', sub: 'What changes once the SCO approves, and what to do when your situation changes.' },
        h('ol.p-after', {}, after.map(function (a, i) { var t = typeof a === 'object' ? a : { text: a }; return stagger(h('li', {}, h('div', {}, rich(t.text), has(t.source) ? h('div.p-source', {}, icon('book'), h('span', {}, 'Source: ' + txt(t.source))) : null)), i); }))));
    } else out.push(missing('after-appointment'));
    return panel('reciprocity', out);
  }

  // ---------- print ----------
  function printGuide() {
    var root = state.root; if (!root) return;
    var host = root.querySelector('.p-panel-host'); if (!host) return;
    state.printAll = true;
    host.innerHTML = '';
    host.appendChild(h('div.p-print-all', {}, TABS.map(function (t) { return h('section.p-print-part', {}, h('h2.p-print-part-title', {}, t.label), renderTab(t.id)); })));
    openAll(true);
    setTimeout(function () {
      try { window.print(); } catch (e) { ui.toast('Printing is not available here'); }
      setTimeout(restoreAfterPrint, 500); // fallback when afterprint does not fire
    }, 80);
  }
  function restoreAfterPrint() { if (!state.printAll) return; state.printAll = false; state.printRestore = null; if (state.root) setTab(state.tab); }
  function rememberOpen() { if (!state.root) return; state.printRestore = Array.prototype.map.call(state.root.querySelectorAll('.p-panel details'), function (d) { return d.open; }); }
  function onBeforePrint() { if (state.printAll) return; if (!state.printRestore) rememberOpen(); openAll(true); }
  function onAfterPrint() {
    if (state.printAll) { restoreAfterPrint(); return; }
    if (!state.root || !state.printRestore) { state.printRestore = null; return; }
    var dets = state.root.querySelectorAll('.p-panel details'); state.printRestore.forEach(function (o, i) { if (dets[i]) dets[i].open = o; }); state.printRestore = null;
  }

  // ---------- empty state ----------
  function emptyState() {
    return h('div.empty.p-empty', {},
      h('div.p-empty-icon', {}, icon('process')),
      h('h3', {}, 'The warrant process guide is not in this build yet'),
      h('p', {}, 'This page reads the process module (policy summary, warrant classes, the numbered 411th steps, board composition, packet checklist, VCE how-to and reciprocity guidance). It appears here as soon as that module is merged into the app data.'),
      h('div.p-empty-actions', {},
        CORB.views.library ? h('button.btn.primary', { type: 'button', onclick: function () { CORB.go('library'); } }, icon('book'), 'Study the question library') : null,
        CORB.views.regulations ? h('button.btn', { type: 'button', onclick: function () { CORB.go('regulations'); } }, icon('map'), 'Regulation explorer') : null));
  }

  // ---------- register ----------
  CORB.registerView({
    id: 'process', title: 'Warrant process', icon: 'process', section: 'Prepare', order: 20, nav: true, short: 'Process',
    render: function (root, ctx) {
      var params = (ctx && ctx.params) || {};
      state.root = root; state.params = params; state.printAll = false; state.printRestore = null;
      var d = data();
      state.tab = params.step ? 'steps' : validTab(params.tab);
      root.appendChild(header(d));
      if (!d) { root.appendChild(emptyState()); return; }
      root.appendChild(tabBar());
      var host = h('div.p-panel-host', {}); root.appendChild(host);
      host.appendChild(renderTab(state.tab));
      if (state.offChange) { try { state.offChange(); } catch (e) {} }
      state.offChange = CORB.on('change', function (e) { if (e && e.path === '*' && state.root) { setTab(state.tab); updateProgressUI(); } });
      if (!state.printBound) { window.addEventListener('beforeprint', onBeforePrint); window.addEventListener('afterprint', onAfterPrint); state.printBound = true; }
    },
    onLeave: function () {
      if (state.offChange) { try { state.offChange(); } catch (e) {} state.offChange = null; }
      if (state.printBound) { window.removeEventListener('beforeprint', onBeforePrint); window.removeEventListener('afterprint', onAfterPrint); state.printBound = false; }
      state.root = null; state.printRestore = null; state.printAll = false;
    }
  });
})();
