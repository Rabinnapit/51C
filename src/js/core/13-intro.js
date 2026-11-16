/* CORE-13-INTRO (web edition only; tools/build.py leaves this file out of the offline and preview editions)
   The two-minute intro video (teaser/, published as intro.mp4 next to the page).
   1. First visit in a browser (the QR code, or a link someone shared): the website opens on the video, above the
      install page. It starts muted, because browsers only let a page start a video without sound; its captions are in
      the picture and its words run under it. "Sound on" plays it from the top with the voice. Skip, Escape or the end
      of the video go on to the install page. Never in the installed app, and only once on a device (b2b.introSeen);
      "?intro=1" in the address shows it again.
   2. "Watch the intro" (Home, About, Settings & help) plays it any time, in any browser or in the installed app.
   With Data Saver on, or when the browser refuses to start a muted video, it waits on the poster with a Play button.
   The video streams from the site; the service worker leaves it alone (src/web/sw.js). */
(function () {
  'use strict';
  var CORB = window.CORB;
  var SEEN = 'b2b.introSeen';
  var intro = CORB.intro = {};
  var layer = null, firstThen = null, video = null, prevFocus = null, keyH = null, madeInert = [], barBefore = null;

  function cfg() { var m = CORB.meta() || {}; return m.intro && m.intro.src ? m.intro : null; }
  intro.available = function () { return !!cfg() && CORB.edition() === 'web' && /^https?:$/.test(location.protocol); };
  intro.minutes = function () { var c = cfg(); return c && c.minutes ? c.minutes : 2; };
  // read before boot: the install page's own boot step tidies the address (core/09-pwa.js)
  var FORCED = /[?&]intro=1(&|$)/.test(location.search);
  // the install page handed this page over from another browser (Samsung Internet to Chrome, an app's browser to
  // Safari, a copied link): the reader met the intro there, so this browser goes straight to the install button
  var HANDOFF = /[?&]install=(chrome|safari|next)(&|$)/.test(location.search);
  function forced() { return FORCED; }
  function seen() { try { return !!localStorage.getItem(SEEN); } catch (e) { return true; } }
  function markSeen() { try { localStorage.setItem(SEEN, String(Date.now())); } catch (e) {} }
  function standalone() { return !!(CORB.pwa && CORB.pwa.isStandalone && CORB.pwa.isStandalone()); }
  function saveData() { try { return !!(navigator.connection && navigator.connection.saveData); } catch (e) { return false; } }

  // the router calls this once the page has drawn; `then` goes on to the install page, the terms and the tour offer
  intro.first = function (then) { if (layer) firstThen = then || null; else if (then) then(); };

  // the words under the video, cue by cue, from the captions file (they help readers whose first language is not English)
  function cueLine(track, out) {
    try {
      track.mode = 'hidden';
      var paint = function () { var c = track.activeCues && track.activeCues[0]; out.textContent = c ? c.text.replace(/<[^>]+>/g, '') : ''; };
      track.addEventListener('cuechange', paint);
    } catch (e) {}
  }

  function close(reason) {
    if (!layer) return;
    try { if (video) { video.pause(); video.removeAttribute('src'); video.load(); } } catch (e) {}
    if (keyH) document.removeEventListener('keydown', keyH, true);
    layer.remove(); layer = null; video = null; keyH = null;
    madeInert.forEach(function (el) { el.removeAttribute('inert'); }); madeInert = [];
    var bar = document.querySelector('meta[name="theme-color"]'); if (CORB.syncBar) CORB.syncBar(); else if (bar && barBefore) bar.setAttribute('content', barBefore);
    var inst = document.querySelector('.inst-page');
    document.body.style.overflow = inst ? 'hidden' : '';
    if (reason !== 'replay') markSeen();
    // focus goes to the install page's button when it is next, otherwise back where it was
    var next = inst ? (inst.querySelector('.inst-big') || inst.querySelector('button')) : prevFocus;
    try { if (next && next.focus) next.focus({ preventScroll: true }); } catch (e) {}
    var t = firstThen; firstThen = null; if (t) setTimeout(t, 200);
  }

  // opts.replay: from a "Watch the intro" button (starts with sound, since a tap started it)
  intro.play = function (opts) {
    opts = opts || {}; var c = cfg(); if (!c || layer) return;
    var h = CORB.ui.h, icon = CORB.ui.icon, replay = !!opts.replay;
    prevFocus = document.activeElement;
    var words = h('p.intro-words', { 'aria-live': 'off' });
    var soundBtn = h('button.intro-sound', { type: 'button', onclick: function () { sound(); } }, icon('volume'), 'Sound on');
    var playBtn = h('button.intro-play', { type: 'button', hidden: true, 'aria-label': 'Play the intro', onclick: function () { start(true); } }, h('span', { html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>' }), 'Play the ' + intro.minutes() + '-minute intro');
    video = h('video.intro-video', { playsinline: '', 'webkit-playsinline': '', preload: saveData() && !replay ? 'none' : 'auto', poster: c.poster || '', controls: '' });
    video.muted = !replay; video.defaultMuted = !replay; if (!replay) video.setAttribute('muted', '');
    if (c.captions) { var tr = h('track', { kind: 'captions', srclang: 'en', label: 'English', src: c.captions }); video.appendChild(tr); }
    video.src = c.src;
    var skip = h('button.btn.primary.intro-skip', { type: 'button', onclick: function () { close(replay ? 'replay' : 'skip'); } }, replay ? 'Close' : 'Skip the intro', icon(replay ? 'x' : 'arrow-right'));
    layer = h('div.intro-layer', { role: 'dialog', 'aria-modal': 'true', 'aria-label': (CORB.meta().app_name || 'The app') + ' in ' + intro.minutes() + ' minutes' },
      h('div.intro-box', {},
        h('div.intro-head', {}, h('img.intro-icon', { src: 'icons/icon-192.png', alt: '' }), h('div', {}, h('b', {}, (CORB.meta().app_name || '') + ' in ' + intro.minutes() + ' minutes'), h('small', {}, 'What it does for a new 51C or 1102')), replay ? null : soundBtn),
        h('div.intro-frame', {}, video, playBtn),
        words,
        h('div.intro-foot', {}, skip, replay ? null : h('p.intro-later', {}, 'Watch it any time: ', h('b', {}, 'Settings & help'), ' or ', h('b', {}, 'About'), ', "Watch the intro".'))));
    document.body.appendChild(layer); document.body.style.overflow = 'hidden';
    // what is behind the layer cannot take focus or taps; the phone's own bar turns dark with it
    [document.getElementById('app'), document.querySelector('.inst-page')].forEach(function (el) { if (el && !el.hasAttribute('inert')) { el.setAttribute('inert', ''); madeInert.push(el); } });
    var bar = document.querySelector('meta[name="theme-color"]'); if (bar) { barBefore = bar.getAttribute('content'); bar.setAttribute('content', '#0b100e'); }
    if (video.textTracks && video.textTracks.length) cueLine(video.textTracks[0], words);
    else video.addEventListener('loadedmetadata', function () { if (video && video.textTracks && video.textTracks[0]) cueLine(video.textTracks[0], words); });
    video.addEventListener('ended', function () { setTimeout(function () { close(replay ? 'replay' : 'ended'); }, 700); });
    // the video could not load (no signal, a missing file): the first visit goes straight on; a replay says why
    video.addEventListener('error', function () {
      if (!replay) { close('skip'); return; }
      words.textContent = 'The intro needs an internet connection. Try again when you are online.'; soundBtn.hidden = true; playBtn.hidden = true;
    });
    video.addEventListener('volumechange', function () { if (video && !video.muted) soundBtn.hidden = true; });
    keyH = function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(replay ? 'replay' : 'skip'); return; }
      if (e.key === 'Tab' && layer) {   // Tab stays inside the intro
        var f = Array.prototype.filter.call(layer.querySelectorAll('button, video[controls], a[href]'), function (el) { return !el.hidden && el.offsetParent !== null; });
        if (!f.length) return;
        var at = f.indexOf(document.activeElement);
        if (e.shiftKey && at <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (at === -1 || at === f.length - 1)) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', keyH, true);
    function start(withSound) {
      if (!video) return;
      if (withSound) { video.muted = false; soundBtn.hidden = true; }
      playBtn.hidden = true;
      var pr; try { pr = video.play(); } catch (e) { pr = null; }
      if (pr && pr.catch) pr.catch(function () { if (playBtn) playBtn.hidden = false; });
    }
    // sound on: the voice from the top (the words ran silently until now)
    function sound() { if (!video) return; video.muted = false; soundBtn.hidden = true; try { video.currentTime = 0; } catch (e) {} start(true); try { skip.focus({ preventScroll: true }); } catch (e) {} }
    if (saveData() && !replay) { playBtn.hidden = false; soundBtn.hidden = true; } else start(replay);
    setTimeout(function () { try { skip.focus({ preventScroll: true }); } catch (e) {} }, 60);
  };

  CORB.on('boot', function () {
    if (!intro.available()) return;
    if (forced()) { try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])intro=1(&|$)/, '$1').replace(/[?&]$/, '') + (location.hash || '')); } catch (e) {} }
    if (HANDOFF && !forced()) { markSeen(); return; }
    if (forced() || (!standalone() && !seen())) intro.play();
  });
})();
