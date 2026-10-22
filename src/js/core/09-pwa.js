/* CORE-09-PWA (web edition only; tools/build.py leaves this file out of the offline and preview editions)
   Makes the GitHub Pages site installable and keeps it current: the service worker serves the newest page whenever the
   reader is online and the saved copy when they are offline. If a newer build exists, a bar offers to reload. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var pwa = CORB.pwa = { canInstall: false, installed: false, deferred: null };

  function bar(text, btnLabel, onClick) {
    var slot = document.querySelector('.update-slot'); if (!slot || slot.firstChild) return;
    var h = CORB.ui.h;
    slot.appendChild(h('div.update-bar', { role: 'status' }, CORB.ui.icon('refresh'), h('span.grow', {}, text),
      h('button.btn.sm', { type: 'button', onclick: onClick }, btnLabel),
      h('button.btn.sm.ghost', { type: 'button', 'aria-label': 'Dismiss', style: { color: 'inherit' }, onclick: function () { slot.innerHTML = ''; } }, CORB.ui.icon('x'))));
  }
  pwa.offerReload = function () { bar('A newer version of B2B Guide is ready.', 'Reload now', function () { location.reload(); }); };

  function checkVersion() {
    if (!navigator.onLine) return;
    fetch('version.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (v && v.build_id && v.build_id !== CORB.meta().build_id) pwa.offerReload();
    }).catch(function () {});
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); pwa.deferred = e; pwa.canInstall = true; CORB.emit('change', { path: 'pwa' }); });
  window.addEventListener('appinstalled', function () { pwa.installed = true; pwa.canInstall = false; CORB.ui.toast('B2B Guide is installed. Find it with your other apps.', 'ok', 4500); });
  pwa.install = function () {
    if (!pwa.deferred) return Promise.resolve(false);
    pwa.deferred.prompt();
    return pwa.deferred.userChoice.then(function (c) { pwa.deferred = null; pwa.canInstall = false; return c && c.outcome === 'accepted'; });
  };
  pwa.isStandalone = function () { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; };

  CORB.on('boot', function () {
    // tell the reader once when the guide has been updated since their last visit
    try {
      var last = localStorage.getItem('b2b.lastBuild'), now = CORB.meta().build_id;
      if (last && now && last !== now) { var ch = (CORB.data.updates().guide_changes || [])[0]; CORB.ui.toast('B2B Guide was updated' + (ch && ch.title ? ': ' + ch.title : '.'), 'ok', 6000); }
      if (now) localStorage.setItem('b2b.lastBuild', now);
    } catch (e) {}
    if (!('serviceWorker' in navigator) || !/^https:$|^http:$/.test(location.protocol)) return;
    if (location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', function () { if (nw.state === 'installed' && navigator.serviceWorker.controller) pwa.offerReload(); });
      });
      setInterval(function () { reg.update().catch(function () {}); }, 60 * 60 * 1000);
    }).catch(function (e) { console.warn('[B2B] service worker not registered', e); });
    setTimeout(checkVersion, 2500);
  });
})();
