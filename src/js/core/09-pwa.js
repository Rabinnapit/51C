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
  pwa.offerReload = function () { bar('A newer version of B2B Exam Prep is ready.', 'Reload now', function () { location.reload(); }); };

  function checkVersion() {
    if (!navigator.onLine) return;
    fetch('version.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (v && v.build_id && v.build_id !== CORB.meta().build_id) pwa.offerReload();
    }).catch(function () {});
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); pwa.deferred = e; pwa.canInstall = true; CORB.emit('change', { path: 'pwa' });
    if (firstThen && document.querySelector('.inst-first')) firstModal();   // the browser can install after all: swap the steps for the button
  });
  window.addEventListener('appinstalled', function () { pwa.installed = true; pwa.canInstall = false; CORB.ui.toast('B2B Exam Prep is installed. Find it with your other apps.', 'ok', 4500); });
  pwa.install = function () {
    if (!pwa.deferred) return Promise.resolve(false);
    pwa.deferred.prompt();
    return pwa.deferred.userChoice.then(function (c) { pwa.deferred = null; pwa.canInstall = false; return c && c.outcome === 'accepted'; });
  };
  pwa.isStandalone = function () { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; };

  // ---- getting the app onto the phone: readers who scan the QR code land in a browser, so say how to install ----
  var ASKED = 'b2b.installAsked';   // this device's last "Continue in the browser": the install ask then waits 3 days
  pwa.platform = function () {
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    return { ios: ios, safari: ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA\//.test(ua), android: /Android/.test(ua),
      // browsers inside other apps (QR scanners, Google app, social apps) cannot install web apps
      inApp: /FBAN|FBAV|Instagram|KAKAOTALK|NAVER|Line\/|GSA\/|; wv\)/.test(ua) };
  };
  function shareIcon() { return CORB.ui.h('span.inst-key', { html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' }); }
  function addIcon() { return CORB.ui.h('span.inst-key', { html: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' }); }
  function steps(p) {
    if (p.inApp) return [[CORB.ui.icon('external'), 'Open this page in ' + (p.ios ? 'Safari' : 'Chrome') + ': tap the menu (⋯ or ⋮), then "Open in browser".'], [CORB.ui.icon('arrow-right'), 'There, follow the steps that appear.']];
    if (p.ios) return [[shareIcon(), p.safari ? 'Tap Share at the bottom of Safari (top right on an iPad).' : 'Tap Share in the address bar.'], [addIcon(), 'Scroll down and tap "Add to Home Screen".'], [CORB.ui.icon('check'), 'Tap "Add" at the top right.']];
    return [[CORB.ui.icon('menu'), 'Tap the browser menu (⋮ at the top right).'], [addIcon(), 'Tap "Install app" or "Add to Home screen".'], [CORB.ui.icon('check'), 'Tap "Install".']];
  }
  function stepList(h, p) { return h('ol.inst-steps', {}, steps(p).map(function (s) { return h('li', {}, s[0], h('span', {}, s[1])); })); }
  var NOTE = 'Then open B2B Exam Prep from its new icon. It runs full screen like any app, works with no signal, and keeps your progress on this phone. New versions arrive by themselves.';
  pwa.howTo = function () {
    var h = CORB.ui.h;
    CORB.ui.modal({ title: 'Put B2B Exam Prep on your home screen', body: h('div.inst', {}, stepList(h, pwa.platform()), h('p.inst-note', {}, NOTE)),
      actions: [{ label: 'Got it', primary: true }] });
  };

  // Install first: anyone who opens the website in a browser (most often from the QR code) is asked to install the app
  // before anything else. "Continue in the browser" goes on to the terms and the tour, and the ask then waits 3 days.
  var firstThen = null;
  function firstModal() {
    var h = CORB.ui.h, one = pwa.canInstall;
    function go() { var t = firstThen; firstThen = null; CORB.ui.closeModal(); if (t) setTimeout(t, 250); }
    CORB.ui.modal({ title: false, sticky: true, body: h('div.inst.inst-first', {},
        h('div.inst-head', {}, h('img.install-icon', { src: 'icons/icon-192.png', alt: '' }),
          h('div', {}, h('h2', {}, 'Install B2B Exam Prep first'), h('p', {}, 'Free app. Works with no signal. Keeps your progress.'))),
        one ? h('p.inst-note', {}, 'One tap puts it on this device with its own icon, like any other app. Then open it from that icon.') : stepList(h, pwa.platform()),
        one ? null : h('p.inst-note', {}, NOTE)),
      actions: [
        { label: 'Continue in the browser', onClick: function () { try { localStorage.setItem(ASKED, String(Date.now())); } catch (e) {} go(); return false; } },
        one ? { label: 'Install the app', primary: true, onClick: function () {
          pwa.install().then(function (ok) { if (ok) { CORB.ui.toast('Installed. Open B2B Exam Prep from your home screen.', 'ok', 6000); go(); } else firstModal(); });
          return false; } } : null
      ].filter(Boolean) });
  }
  // called once the page has drawn; `then` goes on to the terms of use and the tour offer
  pwa.first = function (then) {
    var ask = !pwa.isStandalone() && !pwa.installed && /^https?:$/.test(location.protocol);
    try { if (Date.now() - (+localStorage.getItem(ASKED) || 0) < 3 * 864e5) ask = false; } catch (e) {}
    if (!ask) { if (then) then(); return; }
    firstThen = then || null;
    firstModal();
  };

  CORB.on('boot', function () {
    // tell the reader once when the guide has been updated since their last visit
    try {
      var last = localStorage.getItem('b2b.lastBuild'), now = CORB.meta().build_id;
      if (last && now && last !== now) { var ch = (CORB.data.updates().guide_changes || [])[0]; CORB.ui.toast('B2B Exam Prep was updated' + (ch && ch.title ? ': ' + ch.title : '.'), 'ok', 6000); }
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
