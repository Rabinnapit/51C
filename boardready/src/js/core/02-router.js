/* CORE-02-ROUTER — hash routing, shell layout, role gating, global search palette */
(function () {
  'use strict';
  var CORB = window.CORB;
  var SECTIONS = ['Prepare', 'Practice', 'Board room', 'Reference', 'System'];
  var current = { id: null, params: {} };
  var shell = null;

  function parseHash() {
    var h = (location.hash || '#/home').replace(/^#\/?/, '');
    var q = h.split('?'); var id = q[0] || 'home'; var params = {};
    if (q[1]) q[1].split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); });
    return { id: id, params: params };
  }
  CORB.route = function () { return current; };
  CORB.go = function (id, params) {
    var qs = params && Object.keys(params).length ? '?' + Object.keys(params).filter(function (k) { return params[k] != null && params[k] !== ''; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&') : '';
    var target = '#/' + id + qs;
    if (location.hash === target) render(); else location.hash = target;
  };
  // The candidate edition has one role. It never writes profile.role, because a full copy opened in the same browser
  // shares this storage and must keep its own role.
  CORB.role = function () { return CORB.isCandidateEdition() ? 'candidate' : (CORB.get('profile.role') || 'candidate'); };
  CORB.unit = function () { return CORB.get('profile.unit') || (CORB.DATA.units || []).filter(function (u) { return u.default; }).map(function (u) { return u.id; })[0] || 'all'; };

  // One warrant class for the whole app (profile.targetClass). The class chip, Settings and the practice pages set it.
  CORB.setWarrantClass = function (cls) {
    cls = cls || '';
    CORB.set('profile.targetClass', cls);
    var D = CORB.data, i = D.KO_CLASSES.indexOf(cls);
    CORB.ui.toast(!cls ? 'All classes: every page now shows every question'
      : i > 0 ? D.classLabel(cls) + ': every page now shows Class I to ' + cls
      : D.classLabel(cls) + ': every page now follows this class', 'ok');
    render();
  };
  function classChipText(cls) {
    return cls ? ['Class ' + cls, cls] : ['All classes', 'All'];
  }
  function paintClassChip() {
    var chip = shell && shell.querySelector('.class-chip'); if (!chip) return;
    var t = classChipText(CORB.warrantClass());
    chip.querySelector('.long').textContent = t[0];
    chip.querySelector('.short').textContent = t[1];
    chip.setAttribute('aria-label', 'Warrant class: ' + t[0] + '. Change it');
  }
  CORB.on('change', function (e) { if (e && (e.path === 'profile.targetClass' || e.path === '*')) paintClassChip(); });
  CORB.on('change', function (e) { if (e && (e.path === '*' || String(e.path).indexOf('progress.notes') === 0)) paintNotesBtn(); });

  CORB.setRole = function (role) {
    if (CORB.isCandidateEdition()) return Promise.resolve(role === 'candidate');
    var pass = CORB.get('settings.boardPasscode') || '';
    if ((role === 'board' || role === 'facilitator') && pass) {
      return CORB.ui.prompt({ title: 'Board room passcode', label: 'Enter the passcode set by your facilitator', type: 'password' }).then(function (v) {
        if (v === null) return false;
        if (v !== pass) { CORB.ui.toast('Incorrect passcode', 'danger'); return false; }
        CORB.set('profile.role', role); CORB.ui.toast('Role set: ' + roleLabel(role), 'ok'); buildShell(); render(); return true;
      });
    }
    CORB.set('profile.role', role); buildShell(); render(); return Promise.resolve(true);
  };
  function roleLabel(r) { return { candidate: 'Candidate', board: 'Board member', facilitator: 'Facilitator' }[r] || 'Candidate'; }
  CORB.roleLabel = roleLabel;

  function visible(def) {
    if (!def.nav) return false;
    if (def.roles && def.roles.indexOf(CORB.role()) < 0) return false;
    return true;
  }
  function navDefs() {
    return CORB.viewOrder.map(function (id) { return CORB.views[id]; }).filter(visible).sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
  }

  // ---- shell ----
  function buildShell() {
    var h = CORB.ui.h, icon = CORB.ui.icon;
    var app = document.getElementById('app');
    var meta = CORB.DATA.meta || {};
    var maint = CORB.ui.maintainer ? CORB.ui.maintainer() : null;
    var cand = CORB.isCandidateEdition();
    var groups = {};
    navDefs().forEach(function (d) { (groups[d.section || 'Prepare'] = groups[d.section || 'Prepare'] || []).push(d); });

    var side = h('aside.side', { role: 'navigation', 'aria-label': 'Main' },
      h('a.brand', { href: '#/home', onclick: function () { closeSide(); } },
        h('div.mark' + (CORB.monogram().length > 1 ? '.two' : ''), {}, CORB.monogram()),
        h('div', {}, h('b', {}, CORB.appName()), h('small', {}, cand ? 'Candidate edition' : (meta.org_short || 'CORB prep · 411th CSB')))),
      SECTIONS.filter(function (s) { return groups[s]; }).map(function (s) {
        return h('div.nav-group', {}, h('div.nav-label', {}, s), groups[s].map(function (d) {
          return h('button.nav', { type: 'button', 'data-view': d.id, 'data-mini-tip': d.title, onclick: function () { sideTip(null); CORB.go(d.id); closeSide(); },
            onmouseenter: function (e) { sideTip(e.currentTarget); }, onmouseleave: function () { sideTip(null); }, onfocus: function (e) { sideTip(e.currentTarget); }, onblur: function () { sideTip(null); } },
            icon(d.icon || 'dot'), h('span', {}, d.title));
        }));
      }),
      h('div.side-tools', {},
        unitSelect(''),
        h('button.btn.sm.ghost.theme-btn', { type: 'button', onclick: function () { toggleTheme(); } }, icon(isDark() ? 'sun' : 'moon'), 'Day / night'),
        h('button.btn.sm.ghost', { type: 'button', onclick: function () { CORB.cycleTextSize(); } }, icon('text'), 'Text size'),
        h('button.btn.sm.ghost', { type: 'button', onclick: function () { closeSide(); if (CORB.tour) CORB.tour.start(); } }, icon('help'), 'Guided tour')),
      h('button.side-collapse', { type: 'button', 'aria-label': 'Collapse the menu', onclick: function () { CORB.setSideMini(!isMini()); } }, icon('arrow-left'), h('span', {}, 'Collapse menu')),
      h('div.side-foot', {}, h('div', {}, 'Training aid · not authoritative guidance'), h('div.mt-2', {}, 'Content verified ', h('span.num', {}, meta.content_verified_on || '—'), ' · v', CORB.VERSION),
        meta.copyright ? h('div.mt-2', {}, meta.copyright + ' ', h('a', { href: '#', onclick: function (e) { e.preventDefault(); closeSide(); if (CORB.terms) CORB.terms.show(); } }, 'Terms of use')) : null,
        maint ? h('div.mt-2.side-maint', {}, maint.role + ': ', h('a', { href: CORB.ui.maintainerMailto(), title: 'Email ' + maint.name + ' about a problem on this page', onclick: function (e) { e.currentTarget.href = CORB.ui.maintainerMailto(); } }, maint.name)) : null)
    );

    function unitSelect(cls) {
      return h('select.select.unit-select' + (cls || ''), { 'aria-label': 'Organization', onchange: function (e) { CORB.set('profile.unit', e.target.value); CORB.ui.toast('Showing ' + (unitName(e.target.value)), 'ok'); render(); } },
        (CORB.DATA.units || []).map(function (u) { return h('option', { value: u.id, selected: u.id === CORB.unit() }, u.short || u.name); }));
    }
    var unitSel = unitSelect('.hide-sm');

    var top = h('header.topbar', {},
      h('button.btn.icon.ghost.menu-btn', { type: 'button', 'aria-label': 'Menu', 'data-tip': 'Collapse the menu', onclick: menuButton }, icon('menu')),
      h('div.top-title', {}, h('span.eyebrow.top-eyebrow', {}, ''), h('strong.top-heading', {}, '')),
      h('div.grow'),
      h('button.btn.sm.ghost.search-btn', { onclick: function () { CORB.ui.palette(); }, 'aria-label': 'Search', title: 'Search (press /)' }, icon('search'), h('span.hide-sm', {}, 'Search')),
      unitSel,
      h('button.btn.sm.class-chip', { type: 'button', onclick: function () { CORB.ui.classPicker(); }, title: 'Your warrant class. Every page follows it.' }, icon('award'), h('span.long', {}, ''), h('span.short', {}, '')),
      cand ? null : h('button.btn.sm.role-chip', { onclick: function () { CORB.ui.rolePicker(); }, title: 'Switch role' }, icon(CORB.role() === 'candidate' ? 'user' : 'users'), h('span', {}, roleLabel(CORB.role()))),
      h('button.btn.sm.notes-btn', { type: 'button', hidden: true, onclick: function () { CORB.ui.saveNotesToFile(); }, title: 'Some of your notes are only in this browser. Save them into the Board Ready file so a restart cannot lose them.' }, icon('save'), h('span.hide-sm', {}, 'Save notes')),
      h('button.btn.icon.sm.ghost.hide-sm.text-btn', { type: 'button', 'aria-label': 'Text size', 'data-tip': 'Text size', onclick: function () { CORB.cycleTextSize(); } }, icon('text')),
      h('button.btn.icon.sm.ghost.theme-btn.hide-sm', { type: 'button', 'aria-label': 'Day or night mode', onclick: toggleTheme, 'data-tip': 'Day / night' }, icon(isDark() ? 'sun' : 'moon')),
      h('button.btn.icon.sm.ghost.help-btn.hide-sm', { 'aria-label': 'Guided tour', onclick: function () { if (CORB.tour) CORB.tour.start(); }, 'data-tip': 'Guided tour' }, icon('help')),
      cand ? null : h('button.btn.icon.sm.ghost.hide-sm.projector-btn', { 'aria-label': 'Projector mode', onclick: toggleProjector, 'data-tip': 'Projector mode' }, icon('monitor'))
    );

    var mobileItems = navDefs().filter(function (d) { return d.mobile; }).slice(0, 5);
    var mobile = h('nav.mobile-nav', {}, mobileItems.map(function (d) { return h('button', { 'data-view': d.id, onclick: function () { CORB.go(d.id); } }, icon(d.icon || 'dot'), h('span', {}, d.short || d.title)); }));

    var main = h('main.main', {}, h('div.update-slot'), top, h('div.content#content', { tabindex: '-1' }), mobile);
    shell = h('div.shell', {}, side, main);
    app.innerHTML = '';
    app.appendChild(shell);
    paintClassChip();
    paintNotesBtn();
    paintSide();
  }
  // Shown only while some note is not yet saved into the file (CORB.store.saveNotesToFile).
  function paintNotesBtn() {
    var b = shell && shell.querySelector('.notes-btn'); if (!b) return;
    var n = CORB.store && CORB.store.unsavedNotes ? CORB.store.unsavedNotes() : 0;
    b.hidden = !n;
    b.setAttribute('aria-label', 'Save notes into the app file (' + n + ' not saved yet)');
  }
  function unitName(id) { var u = (CORB.DATA.units || []).filter(function (x) { return x.id === id; })[0]; return u ? u.name : id; }
  CORB.unitName = unitName;
  function openSide() { var s = shell && shell.querySelector('.side'); if (!s) return; s.classList.add('open'); var scrim = CORB.ui.h('div.side-scrim', { onclick: closeSide }); scrim.id = 'sideScrim'; document.body.appendChild(scrim); }
  function closeSide() { var s = shell && shell.querySelector('.side'); if (s) s.classList.remove('open'); var sc = document.getElementById('sideScrim'); if (sc) sc.remove(); }
  // Day is the default. 'dark' is night; 'system' follows the device's own light or dark setting.
  function isDark() { var t = document.documentElement.getAttribute('data-theme'); if (t) return t === 'dark'; return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  function applyTheme(t) { var d = document.documentElement; if (t === 'dark') d.setAttribute('data-theme', 'dark'); else if (t === 'system') d.removeAttribute('data-theme'); else d.setAttribute('data-theme', 'light'); }
  CORB.setTheme = function (t) { t = t === 'dark' || t === 'system' ? t : 'light'; applyTheme(t); CORB.set('profile.theme', t); paintTools(); };
  function toggleTheme() { CORB.setTheme(isDark() ? 'light' : 'dark'); CORB.ui.toast(isDark() ? 'Night mode on' : 'Day mode on'); }
  function paintTools() {
    if (!shell) return;
    shell.querySelectorAll('.theme-btn').forEach(function (b) { var svg = b.querySelector('svg'); if (svg) b.replaceChild(CORB.ui.icon(isDark() ? 'sun' : 'moon'), svg); });
  }
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintTools); } catch (e) {}
  // ---- the side menu can shrink to a rail of icons on a wide screen (remembered in this browser) ----
  function narrow() { try { return window.matchMedia('(max-width: 860px)').matches; } catch (e) { return window.innerWidth <= 860; } }
  function isMini() { return document.documentElement.getAttribute('data-side') === 'mini'; }
  CORB.setSideMini = function (on) {
    if (on) document.documentElement.setAttribute('data-side', 'mini'); else document.documentElement.removeAttribute('data-side');
    CORB.store.safeSet('corb.side', on ? 'mini' : '');
    sideTip(null); paintSide();
  };
  function paintSide() {
    sideTip(null);
    if (!shell) return;
    var mini = isMini(), mb = shell.querySelector('.topbar .menu-btn'), cb = shell.querySelector('.side-collapse');
    if (mb) { mb.setAttribute('aria-expanded', narrow() ? 'false' : String(!mini)); mb.setAttribute('data-tip', mini ? 'Show the menu' : 'Collapse the menu'); }
    if (cb) { cb.setAttribute('aria-label', mini ? 'Expand the menu' : 'Collapse the menu'); cb.lastChild.textContent = mini ? 'Expand' : 'Collapse menu'; }
  }
  function menuButton() { if (narrow()) openSide(); else CORB.setSideMini(!isMini()); }
  // In the rail the labels are hidden, so hovering or focusing an icon shows its name beside it. The side menu scrolls, which
  // would clip a CSS tooltip, so this one floats on the page.
  var tipEl = null;
  function sideTip(btn) {
    if (!btn || !isMini() || narrow()) { if (tipEl) tipEl.hidden = true; return; }
    if (!tipEl) { tipEl = CORB.ui.h('div.side-tip', { role: 'tooltip' }); document.body.appendChild(tipEl); }
    var r = btn.getBoundingClientRect();
    tipEl.textContent = btn.getAttribute('data-mini-tip') || ''; tipEl.hidden = false;
    tipEl.style.left = Math.round(r.right + 10) + 'px'; tipEl.style.top = Math.round(r.top + r.height / 2) + 'px';
  }
  // ---- four text sizes (html[data-text], 01-tokens.css) ----
  CORB.setTextSize = function (n) {
    n = CORB.util.clamp(+n || 0, 0, 3);
    if (n) document.documentElement.setAttribute('data-text', String(n)); else document.documentElement.removeAttribute('data-text');
    CORB.set('profile.textSize', n);
  };
  CORB.cycleTextSize = function () { var n = ((+CORB.get('profile.textSize', 0) || 0) + 1) % 4; CORB.setTextSize(n); CORB.ui.toast('Text size: ' + ['Normal', 'Large', 'Larger', 'Largest'][n]); };
  function toggleProjector() { var on = !document.body.hasAttribute('data-projector'); if (on) document.body.setAttribute('data-projector', '1'); else document.body.removeAttribute('data-projector'); CORB.set('settings.projector', on); CORB.ui.toast(on ? 'Projector mode on' : 'Projector mode off'); }
  CORB.toggleTheme = toggleTheme; CORB.toggleProjector = toggleProjector;

  // ---- render ----
  var leaveFn = null, lastId = null;
  function render() {
    var r = parseHash(); var def = CORB.views[r.id] || CORB.views.home;
    if (!def) { document.getElementById('app').innerHTML = '<div class="content"><div class="empty"><h3>No views registered</h3></div></div>'; return; }
    if (leaveFn) { try { leaveFn(); } catch (e) {} leaveFn = null; }
    if (def.roles && def.roles.indexOf(CORB.role()) < 0) { def = gateView(def); }
    current = { id: def.id, params: r.params };
    if (def.layout === 'full') {
      document.body.setAttribute('data-surface', def.surface || 'landing');
      var app = document.getElementById('app'); app.innerHTML = ''; shell = null;
      var root = CORB.ui.h('div.view.v-' + def.id, {}); app.appendChild(root);
      def.render(root, { params: r.params });
      leaveFn = def.onLeave || null; window.scrollTo(0, 0); CORB.emit('route', current); return;
    }
    document.body.removeAttribute('data-surface');
    if (!shell || !document.body.contains(shell)) buildShell();
    shell.querySelectorAll('.nav, .mobile-nav button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === def.id); });
    var eyebrow = shell.querySelector('.top-eyebrow'), heading = shell.querySelector('.top-heading');
    if (eyebrow) eyebrow.textContent = def.section || ''; if (heading) heading.textContent = def.title || '';
    document.title = (def.title ? def.title + ' · ' : '') + CORB.appName();
    var content = shell.querySelector('#content'); content.innerHTML = '';
    content.className = 'content' + (def.wide ? ' wide' : '');
    var view = CORB.ui.h('div.view.view-enter.v-' + def.id, {}); content.appendChild(view);
    try { def.render(view, { params: r.params }); } catch (e) { console.error('[CORB] view error', def.id, e); view.appendChild(CORB.ui.h('div.callout.danger', {}, CORB.ui.icon('alert'), CORB.ui.h('div', {}, CORB.ui.h('b', {}, 'This page hit an error'), String(e && e.message || e)))); }
    leaveFn = def.onLeave || null;
    window.scrollTo(0, 0);
    if (lastId && lastId !== def.id) { try { content.focus({ preventScroll: true }); } catch (e) {} }   // a screen reader reads the new page
    lastId = def.id;
    CORB.emit('route', current);
  }
  function gateView(def) {
    return { id: def.id, title: def.title, section: def.section, render: function (root) {
      var h = CORB.ui.h;
      root.appendChild(h('div.empty', {}, h('h3', {}, def.title + ' is for board members and facilitators'), h('p', {}, 'Switch your role to continue. A passcode may be required.'), h('button.btn.primary.mt-4', { onclick: function () { CORB.ui.rolePicker(); } }, 'Switch role')));
    } };
  }
  CORB.render = render;
  CORB.refresh = function () { render(); };

  // ---- keyboard ----
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
    if (document.body.getAttribute('data-surface') === 'arcade') return;   // the Arcade owns the keyboard while it is open
    if (e.key === '/' ) { e.preventDefault(); CORB.ui.palette(); }
    if (e.key === '?') { e.preventDefault(); CORB.ui.closeModal(); if (CORB.tour) CORB.tour.start(); }
    if (e.key === 'Escape') { CORB.ui.closeModal(); closeSide(); }
  });

  // ---- boot ----
  // Has this browser used the app before? Then the file opens on the dashboard instead of the landing page.
  function returning() {
    if (CORB.get('settings.tourSeen') || String(CORB.get('profile.name') || '').trim()) return true;
    var p = CORB.get('progress', {}) || {};
    return Object.keys(p).some(function (k) {
      var v = p[k];
      return Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v).length > 0 : !!v;
    });
  }
  CORB.boot = function () {
    CORB.store.load();
    applyTheme(CORB.get('profile.theme') || 'light');
    var tx = +CORB.get('profile.textSize', 0) || 0; if (tx) document.documentElement.setAttribute('data-text', String(tx));
    if (CORB.DATA.meta) CORB.DATA.meta.next_board = CORB.util.nextBoard(CORB.DATA.meta);   // never a board date in the past
    if (!CORB.isCandidateEdition() && CORB.get('settings.projector')) document.body.setAttribute('data-projector', '1');
    if (CORB.data && CORB.data.init) CORB.data.init();
    window.addEventListener('hashchange', render);
    if (!location.hash) {
      var start = returning() ? '#/dashboard' : '#/home';
      // replaceState adds no history entry, so Back does not return to the bare file address
      try { history.replaceState(null, '', start); } catch (e) { /* set below */ }
      if (location.hash !== start) location.hash = start;
    }
    render();
    CORB.emit('boot');
    var offer = function () { if (CORB.tour && CORB.tour.offer) setTimeout(function () { try { CORB.tour.offer(); } catch (e) {} }, 900); };   // first open: offer the guided tour
    var terms = function () { if (CORB.terms && CORB.terms.require) CORB.terms.require(offer); else offer(); };   // the owner notice and terms, once
    if (CORB.pwa && CORB.pwa.first) CORB.pwa.first(terms); else terms();   // the web edition shows its install page first
  };
})();
