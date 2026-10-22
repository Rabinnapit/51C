/* CORE-02-ROUTER — hash routing, the app shell (side menu, top bar, phone bar), theme and text size, boot */
(function () {
  'use strict';
  var CORB = window.CORB;
  var SECTIONS = ['Start', 'Get certified', 'Learn', 'Practice', 'Look it up', 'Help'];
  var current = { id: null, params: {} };
  var shell = null;

  function parseHash() {
    var hsh = (location.hash || '#/home').replace(/^#\/?/, '');
    var q = hsh.split('?'), id = q[0] || 'home', params = {};
    if (q[1]) q[1].split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); });
    return { id: id, params: params };
  }
  CORB.route = function () { return current; };
  CORB.go = function (id, params) {
    var qs = params && Object.keys(params).length ? '?' + Object.keys(params).filter(function (k) { return params[k] != null && params[k] !== ''; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&') : '';
    var target = '#/' + id + qs;
    if (location.hash === target) render(); else location.hash = target;
  };

  function navDefs() { return CORB.viewOrder.map(function (id) { return CORB.views[id]; }).filter(function (d) { return d.nav; }).sort(function (a, b) { return (a.order || 99) - (b.order || 99); }); }
  function isDark() { var t = document.documentElement.getAttribute('data-theme'); if (t) return t === 'dark'; return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  CORB.setTheme = function (t) {
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
    CORB.set('profile.theme', t || ''); paintTools();
  };
  CORB.toggleTheme = function () { CORB.setTheme(isDark() ? 'light' : 'dark'); CORB.ui.toast(isDark() ? 'Night mode on' : 'Day mode on'); };
  CORB.setTextSize = function (n) {
    n = CORB.util.clamp(+n || 0, 0, 3);
    if (n) document.documentElement.setAttribute('data-text', String(n)); else document.documentElement.removeAttribute('data-text');
    CORB.set('profile.textSize', n);
  };
  CORB.cycleTextSize = function () { var n = ((+CORB.get('profile.textSize', 0) || 0) + 1) % 4; CORB.setTextSize(n); CORB.ui.toast('Text size: ' + ['Normal', 'Large', 'Larger', 'Largest'][n]); };
  CORB.setMotion = function (m) { if (m === 'reduce') document.documentElement.setAttribute('data-motion', 'reduce'); else document.documentElement.removeAttribute('data-motion'); CORB.set('settings.motion', m || ''); };

  // ---- shell ----
  function buildShell() {
    var h = CORB.ui.h, icon = CORB.ui.icon, meta = CORB.meta();
    var app = document.getElementById('app');
    var groups = {};
    navDefs().forEach(function (d) { (groups[d.section || 'Start'] = groups[d.section || 'Start'] || []).push(d); });
    var maint = CORB.ui.maintainer();

    var side = h('aside.side', { 'aria-label': 'Main menu' },
      h('a.brand', { href: '#/home', onclick: closeSide }, h('div.mark', {}, 'B2B'), h('div', {}, h('b', {}, CORB.appName()), h('small', {}, meta.tagline_short || 'Contracting certification, step by step'))),
      h('nav', { 'aria-label': 'Sections' }, SECTIONS.filter(function (s) { return groups[s]; }).map(function (s) {
        return h('div.nav-group', {}, h('div.nav-label', {}, s), groups[s].map(function (d) {
          return h('button.nav', { type: 'button', 'data-view': d.id, onclick: function () { CORB.go(d.id); closeSide(); } }, icon(d.icon || 'dot'), h('span', {}, d.title), d.badge ? h('span.count', { 'data-badge': d.id }) : null);
        }));
      })),
      h('div.side-tools', {},
        h('button.btn.sm', { type: 'button', onclick: function () { CORB.toggleTheme(); } }, icon('moon'), 'Day / night'),
        h('button.btn.sm', { type: 'button', onclick: function () { CORB.cycleTextSize(); } }, icon('text'), 'Text size')),
      h('div.side-foot', {},
        h('div', {}, 'Unofficial training aid. Not endorsed by the Army, DoW or WarU.'),
        h('div.mt-2', {}, 'v' + (meta.version || '') + ' · content checked ' + CORB.util.fmtDate(meta.content_verified_on || '')),
        CORB.edition() === 'preview' ? h('div.mt-2', {}, 'Preview copy: file downloads and printing are off.') : null,
        maint ? h('div.mt-2', {}, h('a', { href: CORB.ui.feedbackMailto('feedback') || '#', onclick: function (e) { e.currentTarget.href = CORB.ui.feedbackMailto('feedback'); } }, 'Send feedback')) : null)
    );

    var top = h('header.topbar', {},
      h('button.btn.icon.ghost.menu-btn', { type: 'button', 'aria-label': 'Open menu', onclick: openSide }, icon('menu')),
      h('div.top-title.grow', {}, h('span.top-eyebrow', {}, ''), h('strong.top-heading', {}, '')),
      h('button.btn.sm.ghost.search-btn', { type: 'button', onclick: function () { CORB.ui.palette(); }, 'aria-label': 'Search', title: 'Search (press /)' }, icon('search'), h('span.hide-sm', {}, 'Search'), h('kbd.hide-sm', {}, '/')),
      h('button.btn.sm.save-btn', { type: 'button', hidden: true, onclick: saveToFile, title: 'Your progress is only in this browser. Save it into the B2B Guide file so a restart cannot erase it.' }, icon('save'), h('span.hide-sm', {}, 'Save progress')),
      h('button.btn.icon.sm.ghost.hide-sm', { type: 'button', 'aria-label': 'Text size', 'data-tip': 'Text size', onclick: function () { CORB.cycleTextSize(); } }, icon('text')),
      h('button.btn.icon.sm.ghost.hide-sm.theme-btn', { type: 'button', 'aria-label': 'Day or night mode', 'data-tip': 'Day / night', onclick: function () { CORB.toggleTheme(); } }, icon('moon')),
      h('button.btn.icon.sm.ghost', { type: 'button', 'aria-label': 'Help', 'data-tip': 'Help', onclick: function () { CORB.go('settings', { tab: 'help' }); } }, icon('help'))
    );
    var mobileItems = navDefs().filter(function (d) { return d.mobile; }).slice(0, 5);
    var mobile = h('nav.mobile-nav', { 'aria-label': 'Quick menu' }, mobileItems.map(function (d) { return h('button', { type: 'button', 'data-view': d.id, onclick: function () { CORB.go(d.id); } }, icon(d.icon || 'dot'), h('span', {}, d.short || d.title)); }));
    var main = h('main.main', {}, h('div.update-slot'), top, h('div.content#content', { tabindex: '-1' }), mobile);
    shell = h('div.shell', {}, side, main);
    app.innerHTML = ''; app.appendChild(shell);
    paintTools(); paintBadges();
  }
  function paintTools() {
    if (!shell) return;
    var tb = shell.querySelector('.theme-btn'); if (tb) { tb.innerHTML = ''; tb.appendChild(CORB.ui.icon(isDark() ? 'sun' : 'moon')); }
    var sb = shell.querySelector('.save-btn'); if (sb) sb.hidden = !(CORB.store.unsaved && CORB.store.unsaved());
  }
  function paintBadges() {
    if (!shell) return;
    shell.querySelectorAll('[data-badge]').forEach(function (el) { var d = CORB.views[el.getAttribute('data-badge')]; var n = d && d.badge ? d.badge() : 0; el.textContent = n ? String(n) : ''; el.hidden = !n; });
  }
  CORB.on('change', CORB.util.debounce(function () { paintTools(); paintBadges(); }, 120));
  function saveToFile() { CORB.saveProgressToFile(); }
  CORB.saveProgressToFile = function () {
    var p; try { p = CORB.store.saveProgressToFile(); } catch (e) { p = Promise.reject(e); }
    return p.then(function (r) {
      if (!r || r.how === 'cancel') return r;
      if (r.how === 'file') CORB.ui.toast('Progress saved into ' + r.name + '. Open that file next time.', 'ok', 5000);
      else CORB.ui.modal({ title: 'Your progress is in a new copy of the guide', body: CORB.ui.h('div.stack', {},
        CORB.ui.h('p', {}, 'This browser does not let the guide write to its own file, so it downloaded a copy named ', CORB.ui.h('b', {}, r.name), ' with your progress inside.'),
        CORB.ui.h('p', {}, 'Move that copy to where you keep B2B Guide (Documents or OneDrive), replace the old file with it, and open it from there next time. Your progress comes back even if the browser was cleared.')),
        actions: [{ label: 'Got it', primary: true }] });
      paintTools(); return r;
    }).catch(function (e) { CORB.ui.toast('Progress was not saved into the file: ' + ((e && e.message) || e), 'danger', 6000); });
  };
  function openSide() { var s = shell && shell.querySelector('.side'); if (!s) return; s.classList.add('open'); var scrim = CORB.ui.h('div.side-scrim', { onclick: closeSide }); scrim.id = 'sideScrim'; document.body.appendChild(scrim); var f = s.querySelector('.nav.active, .nav'); if (f) f.focus(); }
  function closeSide() { var s = shell && shell.querySelector('.side'); if (s) s.classList.remove('open'); var sc = document.getElementById('sideScrim'); if (sc) sc.remove(); }

  // ---- render ----
  var leaveFn = null;
  function render() {
    var r = parseHash(), def = CORB.views[r.id] || CORB.views.home;
    if (!def) { document.getElementById('app').innerHTML = '<div class="content"><div class="empty"><h3>Nothing to show</h3></div></div>'; return; }
    if (leaveFn) { try { leaveFn(); } catch (e) {} leaveFn = null; }
    current = { id: def.id, params: r.params };
    if (!shell || !document.body.contains(shell)) buildShell();
    var navId = def.navAs || def.id, mobId = def.mobileAs || navId;
    shell.querySelectorAll('.nav').forEach(function (b) { var on = b.getAttribute('data-view') === navId; b.classList.toggle('active', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    shell.querySelectorAll('.mobile-nav button').forEach(function (b) { var on = b.getAttribute('data-view') === mobId; b.classList.toggle('active', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    var navDef = CORB.views[navId] || def;
    shell.querySelector('.top-eyebrow').textContent = navDef.section || '';
    shell.querySelector('.top-heading').textContent = def.topTitle ? def.topTitle(r.params) : def.title || '';
    document.title = (def.title ? def.title + ' · ' : '') + CORB.appName();
    var content = shell.querySelector('#content'); content.innerHTML = '';
    content.className = 'content' + (def.wide ? ' wide' : '');
    var view = CORB.ui.h('div.view.view-enter.v-' + def.id); content.appendChild(view);
    try { def.render(view, { params: r.params }); }
    catch (e) { console.error('[B2B] view error', def.id, e); view.appendChild(CORB.ui.callout('danger', 'alert', 'This page hit an error', String(e && e.message || e))); }
    leaveFn = def.onLeave || null;
    window.scrollTo(0, 0);
    CORB.ui.closeTermPopover();
    CORB.emit('route', current);
  }
  CORB.render = render;
  CORB.refresh = function () { render(); };

  // ---- keyboard ----
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); CORB.ui.palette(); }
    if (e.key === 'Escape') { CORB.ui.closeModal(); closeSide(); }
  });

  // ---- boot ----
  CORB.boot = function () {
    CORB.store.load();
    var th = CORB.get('profile.theme'); if (th === 'dark' || th === 'light') document.documentElement.setAttribute('data-theme', th);
    var tx = +CORB.get('profile.textSize', 0) || 0; if (tx) document.documentElement.setAttribute('data-text', String(tx)); else document.documentElement.removeAttribute('data-text');
    if (CORB.get('settings.motion') === 'reduce') document.documentElement.setAttribute('data-motion', 'reduce');
    window.addEventListener('hashchange', render);
    if (!location.hash || location.hash === '#') { try { history.replaceState(null, '', '#/home'); } catch (e) { location.hash = '#/home'; } }
    render();
    CORB.emit('boot');
  };
})();
