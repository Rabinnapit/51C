/* CORE-09-PWA (web edition only; tools/build.py leaves this file out of the offline and preview editions)
   1. The install page. Anyone who opens the website in a browser (most often from the QR code, which carries
      "?install=1") sees nothing but the install page until the app is on their device or they ask for the website.
      What its one button does depends on the device, because only two paths end in a real app with its own icon
      and no warning:
        Android: Chrome's own install box (Google signs the package). Samsung Internet and the other Android browsers
                 build their own package, which Google Play Protect blocks on Android 14 and later ("built for an
                 older version of Android"; Samsung support issue 123, open since April 2026), so the button hands
                 the page to Chrome. Chromium makes every hand-off from one browser to another go through a short list
                 (Chrome, or the browser you are in; ExternalNavigationHandler.isInsecureIntentToOtherBrowser), so the
                 page says to choose Chrome. If the reader picks the current browser instead, Chromium reloads the
                 hand-off address here: it carries "?install=chrome", and the page then explains instead of looping.
        iPhone/iPad: Share > Add to Home Screen. Apple allows no install button on a website, so the page shows the
                 three taps and points at the Share button; browsers inside other apps hand the page to Safari.
      "?install=1" in the address shows the page even if the reader chose the website before (3-day snooze).
   2. Updates. The service worker serves the newest page whenever the reader is online and the saved copy when they
      are offline. If a newer build exists, a bar offers to reload. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var pwa = CORB.pwa = { canInstall: false, installed: false, deferred: null };
  var ASKED = 'b2b.installAsked';   // this device's last "Not now": the install page then waits 3 days
  var PLAY_CHROME = 'https://play.google.com/store/apps/details?id=com.android.chrome';
  // "?install=1" (the QR code, Settings & help) or "?install=chrome" (the Chrome hand-off came back to this browser)
  var ARMED = (function () { var m = /[?&]install=([^&#]*)/.exec(location.search); return m ? m[1] : ''; })();

  // ---- a newer build ----
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

  // ---- the browser's own install box (Chrome on Android; Edge and Chrome on computers) ----
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); pwa.deferred = e; pwa.canInstall = true; CORB.emit('change', { path: 'pwa' });
    if (page && state === 'ask') draw();
  });
  window.addEventListener('appinstalled', function () {
    pwa.installed = true; pwa.canInstall = false; pwa.deferred = null;
    if (page) { state = 'done'; draw(); } else CORB.ui.toast('B2B Exam Prep is installed. Find it with your other apps.', 'ok', 4500);
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
    var samsung = /SamsungBrowser/.test(ua);
    return {
      ios: ios, ipad: ios && (/iPad/.test(ua) || /Macintosh/.test(ua)), android: android, inApp: inApp, samsung: samsung,
      chrome: android && /Chrome\//.test(ua) && !other && !inApp,                                   // Google Chrome itself
      safari: ios && !inApp && /Version\/[\d.]+.*Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPT\/|DuckDuckGo|Brave/.test(ua),
      desktop: !ios && !android,
      // what to call the browser the reader is in (Android, not Chrome)
      name: samsung ? 'Samsung Internet' : /EdgA\//.test(ua) ? 'Edge' : /Firefox/.test(ua) ? 'Firefox' : /OPR\/|Opera/.test(ua) ? 'Opera' : inApp ? 'this app\'s browser' : 'this browser'
    };
  };
  function here(flag) { return location.host + location.pathname + (flag ? '?install=' + flag : ''); }
  function scheme() { return location.protocol.replace(':', ''); }
  function armedUrl() { return location.origin + location.pathname + '?install=next'; }   // copied to another browser: no second intro there
  // Android: open this page in Chrome. An Android intent link naming Chrome's package; the Play Store page for Chrome
  // if Chrome is missing. Chromium-based browsers (Samsung Internet included) answer it with a two-entry list,
  // Chrome or themselves; "?install=chrome" tells the page which choice brought it back.
  function chromeLink() { return 'intent://' + here('chrome') + '#Intent;scheme=' + scheme() + ';package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(PLAY_CHROME) + ';end'; }
  // iPhone: open this page in Safari (x-safari- works on iOS 15, 17 and 18, not 16; the page copes when it does not)
  function safariLink() { return 'x-safari-' + scheme() + '://' + here('safari'); }
  function keyIcon(svg) { return CORB.ui.h('span.inst-key', { html: '<svg viewBox="0 0 24 24" aria-hidden="true">' + svg + '</svg>' }); }
  function shareIcon() { return keyIcon('<path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'); }
  function addIcon() { return keyIcon('<rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'); }
  function chromeIcon() { return keyIcon('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v5.8M4.2 7.5l5 2.9M19.8 7.5l-5 2.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'); }
  function downArrow() { return CORB.ui.h('span', { html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' }); }

  // ---- the install page ----
  var page = null, firstThen = null, state = 'ask', checkedInstalled = false;
  function shouldShow() {
    if (pwa.isStandalone() || !/^https?:$/.test(location.protocol)) return false;
    if (ARMED) { try { history.replaceState(null, '', location.pathname + (location.hash || '#/home')); } catch (e) {} return true; }
    // A computer is not where this app gets installed first, and a browser that cannot install it showed only "Open the
    // website": no full-page stop there. The top bar offers Install when the browser can; the QR code and ?install=1
    // (above) still open this page on any device.
    if (pwa.platform().desktop) return false;
    try { if (Date.now() - (+localStorage.getItem(ASKED) || 0) < 3 * 864e5) return false; } catch (e) {}
    return true;
  }
  function close(snooze) {
    if (!page) return;
    if (snooze) { try { localStorage.setItem(ASKED, String(Date.now())); } catch (e) {} }
    page.remove(); page = null; document.body.style.overflow = '';
    var app = document.getElementById('app'); if (app) app.removeAttribute('inert');
    var t = firstThen; firstThen = null; if (t) setTimeout(t, 250);
  }
  pwa.showInstall = function () { state = 'ask'; draw(); };   // Settings & help: "Install the app"
  pwa.howTo = pwa.showInstall;
  // the router calls this once the page has drawn; `then` goes on to the terms of use and the tour offer
  pwa.first = function (then) { if (page) firstThen = then || null; else if (then) then(); };

  function draw() {
    var h = CORB.ui.h, icon = CORB.ui.icon, p = pwa.platform();
    if (!page) {
      page = h('div.inst-page', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Install B2B Exam Prep' });
      document.body.appendChild(page); document.body.style.overflow = 'hidden';
      page.addEventListener('scroll', arrowFit, { passive: true });
      var app = document.getElementById('app'); if (app) app.setAttribute('inert', '');
    }
    var body = h('div.inst-body'), foot = h('div.inst-foot');
    var skip = h('button.linkish.inst-skip', { type: 'button', onclick: function () { close(true); } }, 'Not now, use the website in this browser');
    function big(label, ic, onClick) { return h('button.btn.primary.inst-big', { type: 'button', onclick: onClick }, icon(ic), label); }
    function li(ic, text) { return h('li', {}, ic, h('span', {}, text)); }
    function copyBtn() { return h('button.btn.sm', { type: 'button', onclick: function () { CORB.ui.copyText(armedUrl()); } }, icon('copy'), 'Copy the link'); }
    function again() { location.href = location.pathname + '?install=1' + (location.hash || ''); }
    function toChrome() { state = 'opening-chrome'; draw(); location.href = chromeLink(); }
    function toSafari() { state = 'opening-safari'; draw(); location.href = safariLink(); }
    // why the page does not simply install from Samsung Internet (and the others)
    function whyChrome() {
      return h('details.inst-more', {}, h('summary', {}, 'Why Chrome?'),
        h('p', {}, p.inApp ? 'The browser inside this app cannot install apps. Chrome can: its copy of the app is signed by Google and installs clean, with its own icon.'
          : p.name.charAt(0).toUpperCase() + p.name.slice(1) + ' can install web apps too, but it builds its own copy of the app, and Google Play Protect blocks that copy on newer phones ("built for an older version of Android"). Chrome\'s copy is signed by Google and installs clean, with its own icon. Checked October 2026.'));
    }
    function notOpened(app2) {
      return h('details.inst-more', {}, h('summary', {}, app2 + ' did not open?'),
        h('ol.inst-steps.mt-2', {}, li(icon('copy'), 'Tap "Copy the link" below.'), li(icon('globe'), 'Open ' + app2 + ' and paste the link in the address bar.'),
          li(icon('download'), app2 === 'Chrome' ? 'Tap "Install app" there.' : 'Tap Share, then "Add to Home Screen".')),
        h('div.row.mt-3', {}, copyBtn(),
          app2 === 'Chrome' ? h('a.btn.sm', { href: PLAY_CHROME, target: '_blank', rel: 'noopener' }, icon('external'), 'Get Chrome') : null,
          h('button.linkish', { type: 'button', onclick: function () { state = 'ask'; draw(); } }, 'Try again')));
    }
    page.innerHTML = '';
    page.appendChild(h('div.inst-card', {},
      h('div.inst-head', {}, h('img.install-icon', { src: 'icons/icon-192.png', alt: '' }),
        h('div', {}, h('h1', {}, 'B2B Exam Prep'), h('p', {}, 'Free app for the DoW Contracting Professional certification.'))),
      h('div.inst-chips', {}, ['Works with no signal', 'Keeps your progress', 'No ads, no cost'].map(function (t) { return h('span.inst-chip', {}, icon('check'), t); })),
      body, foot));

    if (state === 'done' || state === 'have') {
      body.appendChild(h('div.inst-done', {}, h('span.inst-tick', {}, icon('check')), h('h2', {}, state === 'done' ? 'Installed!' : 'Already installed'),
        h('p', {}, 'Open B2B Prep from your home screen or your app list. You can close this tab.')));
      foot.appendChild(h('button.linkish.inst-skip', { type: 'button', onclick: function () { close(true); } }, 'Keep using the website here'));
      return;
    }
    if (state === 'opening-chrome' || state === 'opening-safari') {
      var to = state === 'opening-chrome' ? 'Chrome' : 'Safari';
      body.appendChild(h('p.inst-wait', {}, icon('refresh'), 'Opening ' + to + '…'));
      if (to === 'Chrome') {
        body.appendChild(h('ol.inst-steps', {}, li(chromeIcon(), 'If a list asks which app to open, choose Chrome.'), li(icon('download'), 'Chrome opens on this page: tap "Install app", then "Install".')));
      } else body.appendChild(h('p.inst-note', {}, 'Safari opens on this page and shows the three taps.'));
      body.appendChild(notOpened(to));
      foot.appendChild(skip);
      return;
    }
    if (state === 'chrome-steps') {
      body.appendChild(h('h2.inst-h2', {}, 'Install from the Chrome menu'));
      body.appendChild(h('ol.inst-steps', {}, li(icon('menu'), 'Tap ⋮ at the top right of Chrome.'), li(addIcon(), 'Tap "Install app" (or "Add to Home screen", then "Install").'),
        li(icon('check'), 'Tap "Install". Then open B2B Prep from its new icon.')));
      body.appendChild(h('p.inst-note', {}, 'If that menu shows "Open in Chrome" instead, this page is inside another app: tap it, and Chrome opens on this page with one button.'));
      body.appendChild(h('button.linkish.mt-3', { type: 'button', onclick: again }, 'Try the one-tap install again'));
      foot.appendChild(skip);
      return;
    }
    // state 'ask' (or 'picked-self': the Chrome hand-off came back to this browser): the one button for this device
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
      // already on this phone? then say so instead of offering the button
      if (!checkedInstalled) { checkedInstalled = true; alreadyInstalled().then(function (yes) { if (yes && page && state === 'ask') { state = 'have'; draw(); } }); }
    } else if (p.android) {
      var who = p.name.charAt(0).toUpperCase() + p.name.slice(1);
      if (state === 'picked-self') {
        body.appendChild(h('h2.inst-h2', {}, 'Still in ' + who));
        body.appendChild(h('ol.inst-steps', {}, li(icon('download'), 'Tap "Install app" below once more.'),
          li(chromeIcon(), 'In the list that opens, choose Chrome, not ' + who + '.'),
          li(icon('check'), 'In Chrome, tap "Install app", then "Install".')));
        body.appendChild(h('div.mt-3', {}, big('Install app', 'download', toChrome)));
      } else {
        body.appendChild(big('Install app', 'download', toChrome));
        body.appendChild(h('p.inst-note', {}, 'Chrome does the install and puts the app with your other apps. If a list asks which app to open, choose Chrome.'));
      }
      body.appendChild(whyChrome());
    } else if (p.ios && !p.inApp) {
      body.appendChild(h('h2.inst-h2', {}, 'Three taps to install'));
      body.appendChild(h('ol.inst-steps', {},
        li(shareIcon(), p.safari ? (p.ipad ? 'Tap Share at the top right.' : 'Tap Share in the bar at the bottom. If that bar shows ⋯ instead, tap ⋯, then Share.') : 'Tap Share (the square with an arrow).'),
        li(addIcon(), 'Scroll down the list and tap "Add to Home Screen".'),
        li(icon('check'), 'Tap "Add" at the top right. Then open B2B Prep from its new icon.')));
      body.appendChild(h('p.inst-note', {}, 'Apple allows no install button on a website: these three taps are the only way, in Safari or any iPhone browser.'));
      body.appendChild(h('details.inst-more', {}, h('summary', {}, 'No "Add to Home Screen" in the list?'),
        h('p', {}, p.safari ? 'Then this page is open inside another app, not in Safari itself. Open it in Safari:' : 'Older iPhones allow it in Safari only. Open this page in Safari:'),
        h('div.row', {}, h('a.btn.sm', { href: safariLink(), onclick: function () { state = 'opening-safari'; draw(); } }, icon('external'), 'Open in Safari'), copyBtn()),
        h('p', {}, 'If Safari does not open: copy the link, open Safari, paste it in the address bar.')));
      if (p.safari && !p.ipad) page.appendChild(h('div.inst-arrow', { 'aria-hidden': 'true' }, h('span', {}, 'Share is down here'), downArrow()));
    } else if (p.ios) {
      body.appendChild(big('Open in Safari', 'external', toSafari));
      body.appendChild(h('p.inst-note', {}, 'This page is inside another app, which cannot install it. Safari opens on this page and shows the three taps (Apple allows no install button on a website).'));
    } else {   // a computer
      if (pwa.canInstall) {
        body.appendChild(big('Install app', 'download', function () { pwa.install().then(function (ok) { if (page && ok) { state = 'done'; draw(); } }); }));
        body.appendChild(h('p.inst-note', {}, 'Puts it in your Start menu or Dock, like any program.'));
      } else body.appendChild(big('Open the website', 'arrow-right', function () { close(true); }));
      body.appendChild(h('p.inst-note', {}, 'On a phone, scan the QR code on the About page: the app installs there.'));
    }
    // on an iPhone in Safari the arrow to Share sits at the bottom of the screen, so "Not now" moves to the top right,
    // where the arrow can never cover it
    var arrowUp = state === 'ask' && p.ios && !p.inApp && p.safari && !p.ipad;
    if (arrowUp) { skip.textContent = 'Not now'; skip.classList.add('inst-skip-top'); page.insertBefore(skip, page.firstChild); }
    else if (!(p.desktop && !pwa.canInstall)) foot.appendChild(skip);
    if (arrowUp) { arrowFit(); requestAnimationFrame(arrowFit); setTimeout(arrowFit, 400); }
    // keyboard and screen readers start on the page's own button (not while the intro is still on top)
    setTimeout(function () {
      if (!page || document.querySelector('.intro-layer') || page.contains(document.activeElement)) return;
      var b = page.querySelector('.inst-big') || page.querySelector('.inst-card button'); if (b) { try { b.focus({ preventScroll: true }); } catch (e) {} }
    }, 80);
  }
  // the arrow to Safari's Share button shows only while it covers nothing: on a short screen it waits until the reader
  // has scrolled the steps clear of it
  function arrowFit() {
    var a = page && page.querySelector('.inst-arrow'), card = page && page.querySelector('.inst-card'); if (!a || !card) return;
    var clear = card.getBoundingClientRect().bottom <= window.innerHeight - a.offsetHeight + 6;
    a.classList.toggle('inst-arrow-off', !clear);
  }
  window.addEventListener('resize', arrowFit);
  // a hand-off that worked hides this tab; when the reader comes back, offer the button again
  document.addEventListener('visibilitychange', function () {
    if (page && document.visibilityState === 'visible' && /^opening-/.test(state)) { state = 'ask'; draw(); }
  });

  CORB.on('boot', function () {
    if (shouldShow()) {
      var p = pwa.platform();
      state = (ARMED === 'chrome' && p.android && !p.chrome) ? 'picked-self' : 'ask';
      draw();
    }
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
