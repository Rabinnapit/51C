/* CORE-09-PWA (web edition only; tools/build.py leaves this file out of the single-file editions)
   1. The install page. Anyone who opens the website in a browser sees the install page until the app is on their
      device or they ask for the website. What its one button does depends on the device, because only two paths end
      in a real app with its own icon and no warning:
        Android: Chrome's own install box (Google signs the package). Samsung Internet and other browsers build their
                 own package, which Google Play Protect blocks as "unsafe", so the button hands the page to Chrome.
        iPhone/iPad: Safari's Share > Add to Home Screen. Apple allows no install button on a website, so the page
                 shows the three taps and points at the Share button; other browsers hand the page to Safari.
      "?install=1" in the address (added by the hand-offs) shows the page even if the reader chose the website before.
   2. Updates. The service worker serves the newest page whenever the reader is online and the saved copy when they
      are offline. If a newer build exists, a bar offers to reload.
   Adapted from B2B Exam Prep's core/09-pwa.js. Storage keys start with "corb." so the two apps never collide. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var pwa = CORB.pwa = { canInstall: false, installed: false, deferred: null };
  var ASKED = 'corb.installAsked';   // this device's last "Not now": the install page then waits 3 days
  var LAST_BUILD = 'corb.lastBuild';
  function meta() { return (CORB.DATA && CORB.DATA.meta) || {}; }
  function appName() { return CORB.appName ? CORB.appName() : 'Board Ready'; }

  // ---- a newer build ----
  function bar(text, btnLabel, onClick) {
    var slot = document.querySelector('.update-slot'); if (!slot || slot.firstChild) return;
    var h = CORB.ui.h;
    slot.appendChild(h('div.update-bar', { role: 'status' }, CORB.ui.icon('refresh'), h('span.grow', {}, text),
      h('button.btn.sm', { type: 'button', onclick: onClick }, btnLabel),
      h('button.btn.sm.ghost', { type: 'button', 'aria-label': 'Dismiss', style: { color: 'inherit' }, onclick: function () { slot.innerHTML = ''; } }, CORB.ui.icon('x'))));
  }
  pwa.offerReload = function () { bar('A newer version of ' + appName() + ' is ready.', 'Reload now', function () { location.reload(); }); };
  function checkVersion() {
    if (!navigator.onLine) return;
    fetch('version.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (v && v.build_id && v.build_id !== meta().build_id) pwa.offerReload();
    }).catch(function () {});
  }

  // ---- the browser's own install box (Chrome on Android; Edge and Chrome on computers) ----
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); pwa.deferred = e; pwa.canInstall = true; CORB.emit('change', { path: 'pwa' });
    if (page && state === 'ask') draw();
  });
  window.addEventListener('appinstalled', function () {
    pwa.installed = true; pwa.canInstall = false; pwa.deferred = null;
    if (page) { state = 'done'; draw(); } else CORB.ui.toast(appName() + ' is installed. Find it with your other apps.', 'ok', 4500);
  });
  pwa.install = function () {
    var ev = pwa.deferred;
    if (!ev) return Promise.resolve(false);
    pwa.deferred = null; pwa.canInstall = false;
    try { ev.prompt(); } catch (e) { return Promise.resolve(false); }
    return ev.userChoice.then(function (c) { return !!c && c.outcome === 'accepted'; }, function () { return false; });
  };
  // the event often arrives just after the first tap on the page: wait up to 3 s for it before giving up
  function installSoon() {
    if (pwa.deferred) return pwa.install();
    return new Promise(function (resolve) {
      var done = false, t = setTimeout(function () { finish(false); }, 3000);
      function finish(ok) { if (done) return; done = true; clearTimeout(t); window.removeEventListener('beforeinstallprompt', go); resolve(ok); }
      function go() { finish(pwa.install()); }
      window.addEventListener('beforeinstallprompt', go);
    });
  }
  pwa.isStandalone = function () { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; };
  // Chrome on Android can tell whether this app is already installed (the manifest's related_applications)
  function alreadyInstalled() {
    if (!navigator.getInstalledRelatedApps) return Promise.resolve(false);
    try { return navigator.getInstalledRelatedApps().then(function (apps) { return apps.some(function (a) { return a.platform === 'webapp'; }); }, function () { return false; }); } catch (e) { return Promise.resolve(false); }
  }

  // ---- which device and browser ----
  pwa.platform = function () {
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var android = !ios && /Android/.test(ua);
    // browsers inside other apps (QR scanners, the Google app, social apps) cannot install web apps; on iOS they lack "Safari/"
    var inApp = /FBAN|FBAV|Instagram|KAKAOTALK|NAVER|Line\/|GSA\/|Snapchat|TikTok|musical_ly|; wv\)/.test(ua) || (ios && !/Safari\//.test(ua));
    var other = /SamsungBrowser|EdgA\/|OPR\/|Opera|Firefox|FxiOS|DuckDuckGo|YaBrowser|Vivaldi|MiuiBrowser|HuaweiBrowser|UCBrowser|Whale\/|Puffin|Silk\/|Kiwi/.test(ua) || !!navigator.brave;
    return {
      ios: ios, ipad: ios && (/iPad/.test(ua) || /Macintosh/.test(ua)), android: android, inApp: inApp, samsung: /SamsungBrowser/.test(ua),
      chrome: android && /Chrome\//.test(ua) && !other && !inApp,                                   // Google Chrome itself
      safari: ios && !inApp && /Version\/[\d.]+.*Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPT\/|DuckDuckGo|Brave/.test(ua),
      desktop: !ios && !android
    };
  };
  function here(flag) { return location.host + location.pathname + (flag ? '?install=1' : ''); }
  function scheme() { return location.protocol.replace(':', ''); }
  // Android: open this page in Chrome (an Android intent link; the Play Store page for Chrome if it is missing)
  function chromeLink() { return 'intent://' + here(true) + '#Intent;scheme=' + scheme() + ';package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent('https://play.google.com/store/apps/details?id=com.android.chrome') + ';end'; }
  // iPhone: open this page in Safari (x-safari- works on iOS 15, 17 and 18, not 16; the page copes when it does not)
  function safariLink() { return 'x-safari-' + scheme() + '://' + here(true); }
  function keyIcon(svg) { return CORB.ui.h('span.inst-key', { html: '<svg viewBox="0 0 24 24" aria-hidden="true">' + svg + '</svg>' }); }
  function shareIcon() { return keyIcon('<path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'); }
  function addIcon() { return keyIcon('<rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'); }
  function downArrow() { return CORB.ui.h('span', { html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' }); }

  // ---- the install page ----
  var page = null, firstThen = null, state = 'ask', timer = 0;
  function shouldShow() {
    if (pwa.isStandalone() || !/^https?:$/.test(location.protocol)) return false;
    if (/[?&]install=1/.test(location.search)) { try { history.replaceState(null, '', location.pathname + (location.hash || '#/home')); } catch (e) {} return true; }
    try { if (Date.now() - (+localStorage.getItem(ASKED) || 0) < 3 * 864e5) return false; } catch (e) {}
    return true;
  }
  function close(snooze) {
    if (!page) return;
    if (snooze) { try { localStorage.setItem(ASKED, String(Date.now())); } catch (e) {} }
    clearTimeout(timer);
    page.remove(); page = null; document.body.style.overflow = '';
    var app = document.getElementById('app'); if (app) app.removeAttribute('inert');
    var t = firstThen; firstThen = null; if (t) setTimeout(t, 250);
  }
  pwa.showInstall = function () { state = 'ask'; draw(); };   // Settings: "Install the app"
  pwa.howTo = pwa.showInstall;
  // the router calls this once the page has drawn; `then` goes on to the tour offer
  pwa.first = function (then) { if (page) firstThen = then || null; else if (then) then(); };

  function draw() {
    var h = CORB.ui.h, icon = CORB.ui.icon, p = pwa.platform();
    if (!page) {
      page = h('div.inst-page', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Install ' + appName() });
      document.body.appendChild(page); document.body.style.overflow = 'hidden';
      var app = document.getElementById('app'); if (app) app.setAttribute('inert', '');
    }
    var body = h('div.inst-body'), foot = h('div.inst-foot');
    var skip = h('button.linkish.inst-skip', { type: 'button', onclick: function () { close(true); } }, 'Not now, use the website in this browser');
    function big(label, ic, onClick) { return h('button.btn.primary.inst-big', { type: 'button', onclick: onClick }, icon(ic), label); }
    function li(ic, text) { return h('li', {}, ic, h('span', {}, text)); }
    function copyBtn() { return h('button.btn.sm', { type: 'button', onclick: function () { CORB.ui.copyText(location.origin + location.pathname); } }, icon('copy'), 'Copy the link'); }
    function again() { location.href = location.pathname + '?install=1' + (location.hash || ''); }
    page.innerHTML = '';
    page.appendChild(h('div.inst-card', {},
      h('div.inst-head', {}, h('img.install-icon', { src: 'icons/icon-192.png', alt: '' }),
        h('div', {}, h('h1', {}, appName()), h('p', {}, 'Free study app for the Army contracting officer warrant board.'))),
      h('div.inst-chips', {}, ['Works with no signal', 'Keeps your progress', 'No ads, no cost'].map(function (t) { return h('span.inst-chip', {}, icon('check'), t); })),
      body, foot));

    if (state === 'done' || state === 'have') {
      body.appendChild(h('div.inst-done', {}, h('span.inst-tick', {}, icon('check')), h('h2', {}, state === 'done' ? 'Installed!' : 'Already installed'),
        h('p', {}, 'Open ' + appName() + ' from your home screen or your app list. You can close this tab.')));
      foot.appendChild(h('button.linkish.inst-skip', { type: 'button', onclick: function () { close(true); } }, 'Keep using the website here'));
      return;
    }
    if (state === 'opening-chrome' || state === 'opening-safari') {
      var to = state === 'opening-chrome' ? 'Chrome' : 'Safari';
      body.appendChild(h('p.inst-wait', {}, icon('refresh'), 'Opening ' + to + '…'));
      body.appendChild(h('p.inst-note', {}, to === 'Chrome' ? 'Chrome opens on this page with one button: tap it.' : 'Safari opens on this page and shows the three taps.'));
      foot.appendChild(skip);
      clearTimeout(timer);
      timer = setTimeout(function () { if (page && document.visibilityState === 'visible') { state = to === 'Chrome' ? 'copy-chrome' : 'copy-safari'; draw(); } }, 2500);
      return;
    }
    if (state === 'copy-chrome' || state === 'copy-safari') {
      var app2 = state === 'copy-chrome' ? 'Chrome' : 'Safari';
      body.appendChild(h('h2.inst-h2', {}, app2 + ' did not open?'));
      body.appendChild(h('ol.inst-steps', {}, li(icon('copy'), 'Tap "Copy the link" below.'), li(icon('globe'), 'Open ' + app2 + ' and paste the link in the address bar.'),
        li(icon('download'), app2 === 'Chrome' ? 'Tap "Install app" there.' : 'Tap Share, then "Add to Home Screen".')));
      body.appendChild(h('div.row.mt-3', {}, copyBtn(), h('button.linkish', { type: 'button', onclick: function () { state = 'ask'; draw(); } }, 'Try again')));
      foot.appendChild(skip);
      return;
    }
    if (state === 'chrome-steps') {
      body.appendChild(h('h2.inst-h2', {}, 'Install from the Chrome menu'));
      body.appendChild(h('ol.inst-steps', {}, li(icon('menu'), 'Tap ⋮ at the top right of Chrome.'), li(addIcon(), 'Tap "Install app" (or "Add to Home screen", then "Install").'),
        li(icon('check'), 'Tap "Install". Then open ' + appName() + ' from its new icon.')));
      body.appendChild(h('button.linkish.mt-3', { type: 'button', onclick: again }, 'Try the one-tap install again'));
      foot.appendChild(skip);
      return;
    }
    // state 'ask': the one button for this device
    if (p.android && p.chrome) {
      var btn = big('Install app', 'download', function () {
        btn.disabled = true; btn.replaceChildren(icon('refresh'), 'Opening the install box…');
        installSoon().then(function (ok) {
          if (!page) return;
          if (ok) { state = 'done'; draw(); return; }
          alreadyInstalled().then(function (yes) { if (!page) return; state = yes ? 'have' : 'chrome-steps'; draw(); });
        });
      });
      body.appendChild(btn);
      body.appendChild(h('p.inst-note', {}, 'One tap. Chrome puts it with your other apps, with its own icon.'));
    } else if (p.android) {
      body.appendChild(big('Install with Chrome', 'external', function () { state = 'opening-chrome'; draw(); location.href = chromeLink(); }));
      body.appendChild(h('p.inst-note', {}, (p.samsung ? 'Samsung Internet' : p.inApp ? 'The browser inside this app' : 'This browser') +
        ' can only make a shortcut, or shows an "unsafe app" warning. Chrome installs the real app, with its own icon. It opens on this page with one button.'));
    } else if (p.ios && p.safari) {
      body.appendChild(h('h2.inst-h2', {}, 'Three taps to install'));
      body.appendChild(h('ol.inst-steps', {},
        li(shareIcon(), p.ipad ? 'Tap Share at the top right.' : 'Tap Share in the bar at the bottom. If that bar shows ⋯ instead, tap ⋯, then Share.'),
        li(addIcon(), 'Scroll down the list and tap "Add to Home Screen".'),
        li(icon('check'), 'Tap "Add" at the top right. Then open ' + appName() + ' from its new icon.')));
      body.appendChild(h('p.inst-note', {}, 'Apple lets a website install an app only this way: there is no install button on an iPhone.'));
      body.appendChild(h('details.inst-more', {}, h('summary', {}, 'No "Add to Home Screen" in the list?'),
        h('p', {}, 'Then this page is open inside another app, not in Safari itself. Open it in Safari:'),
        h('div.row', {}, h('a.btn.sm', { href: safariLink() }, icon('external'), 'Open in Safari'), copyBtn()),
        h('p', {}, 'If Safari does not open: copy the link, open Safari, paste it in the address bar.')));
      if (!p.ipad) page.appendChild(h('div.inst-arrow', { 'aria-hidden': 'true' }, h('span', {}, 'Share is down here'), downArrow()));
    } else if (p.ios) {
      body.appendChild(big('Open in Safari', 'external', function () { state = 'opening-safari'; draw(); location.href = safariLink(); }));
      body.appendChild(h('p.inst-note', {}, 'On an iPhone only Safari can install the app (Apple\'s rule). Safari opens on this page and shows the three taps.'));
    } else {   // a computer
      if (pwa.canInstall) {
        body.appendChild(big('Install app', 'download', function () { pwa.install().then(function (ok) { if (page && ok) { state = 'done'; draw(); } }); }));
        body.appendChild(h('p.inst-note', {}, 'Puts it in your Start menu or Dock, like any program.'));
      } else body.appendChild(big('Open the website', 'arrow-right', function () { close(true); }));
      var rows = meta().app_qr;
      if (rows && rows.length && CORB.ui.qrSvg) body.appendChild(h('div.inst-qr', { html: CORB.ui.qrSvg(rows, 'QR code for ' + location.origin + location.pathname) }));
      body.appendChild(h('p.inst-note', {}, rows && rows.length ? 'On a phone, scan this code with the camera: the app installs there.' : 'On a phone, open this same address: the app installs there.'));
    }
    if (!(p.desktop && !pwa.canInstall)) foot.appendChild(skip);
  }
  // a hand-off that worked hides this tab; when the reader comes back, offer the button again
  document.addEventListener('visibilitychange', function () {
    if (!page) return;
    if (document.visibilityState === 'hidden') clearTimeout(timer);
    else if (/^opening-/.test(state)) { state = 'ask'; draw(); }
  });

  CORB.on('boot', function () {
    if (shouldShow()) { state = 'ask'; draw(); }
    // tell the reader once when the app has been updated since their last visit
    try {
      var last = localStorage.getItem(LAST_BUILD), now = meta().build_id;
      if (last && now && last !== now) CORB.ui.toast(appName() + ' was updated to version ' + (meta().version || '') + '.', 'ok', 6000);
      if (now) localStorage.setItem(LAST_BUILD, now);
    } catch (e) {}
    if (!('serviceWorker' in navigator) || !/^https:$|^http:$/.test(location.protocol)) return;
    if (location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', function () { if (nw.state === 'installed' && navigator.serviceWorker.controller) pwa.offerReload(); });
      });
      setInterval(function () { reg.update().catch(function () {}); }, 60 * 60 * 1000);
    }).catch(function (e) { console.warn('[CORB] service worker not registered', e); });
    setTimeout(checkVersion, 2500);
  });
})();
