/* CORE-13-INTRO (web edition only; tools/build.py leaves this file out of the offline and preview editions)
   The two-minute intro video (teaser/, published as intro.mp4 next to the page).
   1. First visit in a browser (the QR code, or a link someone shared): the website opens on the video, above the
      install page, and tries to start it with the voice. Phones refuse sound before the first tap (Apple and Google both
      do, on a site a phone has not seen), so there it plays silently with its captions in the picture and its words under
      it, under a big "Tap for sound": one tap anywhere on the video plays it from the top with the voice (the owner asked
      for sound on a first visit; this is as close as a web page can get). Skip, Escape or the end of the video go on to
      the install page. Never in the installed app, and only once on a device (b2b.introSeen);
      "?intro=1" in the address shows it again.
   2. "Watch the intro" (Home, About, Settings & help) plays it any time, in any browser or in the installed app.
   With Data Saver on, or when the browser refuses to start a muted video, it waits on the poster with a Play button.
   3. A phone held upright plays the phone-sized cut (meta.intro.tall, intro-tall.mp4: the same film on the same
      timeline, shot at a phone's size so its words can be read). Turned on its side, the wide cut takes over at the
      same second; the captions file is shared.
   The video streams from the site; the service worker leaves it alone (src/web/sw.js). */
(function () {
  'use strict';
  var CORB = window.CORB;
  var SEEN = 'b2b.introSeen';
  var intro = CORB.intro = {};
  var layer = null, firstThen = null, video = null, prevFocus = null, keyH = null, madeInert = [], barBefore = null, turnMq = null, turnH = null;
  var UPRIGHT = '(orientation: portrait) and (max-width: 640px)';

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
  // the phone-sized cut, for a phone held upright
  function upright(c) { try { return !!(c && c.tall && c.tall.src && window.matchMedia(UPRIGHT).matches); } catch (e) { return false; } }
  function cut(c, tall) { return tall ? { src: c.tall.src, poster: c.tall.poster || c.poster || '' } : { src: c.src, poster: c.poster || '' }; }
  intro.cut = function () { return layer ? (layer.classList.contains('tall') ? 'tall' : 'wide') : ''; };

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
    if (turnMq && turnH) { try { turnMq.removeEventListener('change', turnH); document.removeEventListener('fullscreenchange', turnH); } catch (e) {} } turnMq = null; turnH = null;
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
    var h = CORB.ui.h, icon = CORB.ui.icon, replay = !!opts.replay, tall = upright(c), film = cut(c, tall);
    prevFocus = document.activeElement;
    var words = h('p.intro-words', { 'aria-live': 'off' });
    var soundBtn = h('button.intro-sound', { type: 'button', hidden: true, onclick: function () { sound(); } }, icon('volume'), 'Sound on');
    // the whole picture is the sound button while the phone keeps it silent: the first tap anywhere brings the voice in
    var tapEl = h('button.intro-tap', { type: 'button', hidden: true, 'aria-label': 'Tap for sound: the intro starts again with the voice', onclick: function () { sound(); } },
      h('span.intro-tap-pill', {}, icon('volume'), 'Tap for sound'));
    var playBtn = h('button.intro-play', { type: 'button', hidden: true, 'aria-label': 'Play the intro', onclick: function () { start(true); } }, h('span', { html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>' }), 'Play the ' + intro.minutes() + '-minute intro');
    video = h('video.intro-video', { playsinline: '', 'webkit-playsinline': '', preload: saveData() && !replay ? 'none' : 'auto', poster: film.poster, controls: '' });
    video.muted = !replay; video.defaultMuted = !replay; if (!replay) video.setAttribute('muted', '');
    if (c.captions) { var tr = h('track', { kind: 'captions', srclang: 'en', label: 'English', src: c.captions }); video.appendChild(tr); }
    video.src = film.src;
    var skip = h('button.btn.primary.intro-skip', { type: 'button', onclick: function () { close(replay ? 'replay' : 'skip'); } }, replay ? 'Close' : 'Skip the intro', icon(replay ? 'x' : 'arrow-right'));
    layer = h('div.intro-layer' + (tall ? '.tall' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': (CORB.meta().app_name || 'The app') + ' in ' + intro.minutes() + ' minutes' },
      h('div.intro-box', {},
        h('div.intro-head', {}, h('img.intro-icon', { src: 'icons/icon-192.png', alt: '' }), h('div', {}, h('b', {}, (CORB.meta().app_name || '') + ' in ' + intro.minutes() + ' minutes'), h('small', {}, 'What it does for a new 51C or 1102')), replay ? null : soundBtn),
        h('div.intro-frame', {}, video, tapEl, playBtn),
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
      words.textContent = 'The intro needs an internet connection. Try again when you are online.'; soundBtn.hidden = true; tapEl.hidden = true; playBtn.hidden = true;
    });
    video.addEventListener('volumechange', function () { if (video && !video.muted) { soundBtn.hidden = true; tapEl.hidden = true; } });
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
    // the phone was turned: the other cut takes over at the same second (both cuts share one timeline and one captions file)
    if (c.tall && c.tall.src) {
      try {
        turnMq = window.matchMedia(UPRIGHT);
        turnH = function () {
          if (!video || !layer) return;
          // in full screen the picture is left alone; this runs again when full screen ends
          if (document.fullscreenElement || video.webkitDisplayingFullscreen) return;
          var now = upright(c); if (now === tall) return;
          var at = video.currentTime || 0, going = !video.paused && !video.ended, muted = video.muted;
          tall = now; film = cut(c, tall); layer.classList.toggle('tall', tall);
          var again = function () {
            if (!video) return; video.removeEventListener('loadedmetadata', again);
            try { video.currentTime = at; } catch (e) {}
            if (going) { var p; try { p = video.play(); } catch (e) { p = null; } if (p && p.catch) p.catch(function () { if (video) playBtn.hidden = false; }); }
          };
          video.addEventListener('loadedmetadata', again);
          video.poster = film.poster; video.src = film.src; video.muted = muted;
        };
        turnMq.addEventListener('change', turnH);
        document.addEventListener('fullscreenchange', turnH); video.addEventListener('webkitendfullscreen', turnH);
      } catch (e) { turnMq = null; turnH = null; }
    }
    function start(withSound) {
      if (!video) return;
      if (withSound) { video.muted = false; soundBtn.hidden = true; tapEl.hidden = true; }
      playBtn.hidden = true;
      var pr; try { pr = video.play(); } catch (e) { pr = null; }
      if (pr && pr.catch) pr.catch(function () { if (playBtn) playBtn.hidden = false; });
    }
    // sound on: the voice from the top (the words ran silently until now)
    function sound() { if (!video) return; video.muted = false; soundBtn.hidden = true; tapEl.hidden = true; try { video.currentTime = 0; } catch (e) {} start(true); try { skip.focus({ preventScroll: true }); } catch (e) {} }
    // a first visit asks for sound first; where the browser refuses (every phone, before a tap), it plays silently under
    // "Tap for sound", and if even a silent start is refused, it waits on the poster with Play
    function begin() {
      if (!video) return;
      video.muted = false; video.defaultMuted = false; video.removeAttribute('muted');
      var pr; try { pr = video.play(); } catch (e) { pr = null; }
      function silent() {
        if (!video) return;
        video.muted = true; video.defaultMuted = true; video.setAttribute('muted', ''); tapEl.hidden = false;
        var p2; try { p2 = video.play(); } catch (e) { p2 = null; }
        if (p2 && p2.catch) p2.catch(function () { if (!video) return; tapEl.hidden = true; playBtn.hidden = false; });
      }
      if (pr && pr.then) pr.then(function () { tapEl.hidden = true; }, silent); else silent();
    }
    if (saveData() && !replay) { playBtn.hidden = false; soundBtn.hidden = true; } else if (replay) start(true); else begin();
    setTimeout(function () { try { skip.focus({ preventScroll: true }); } catch (e) {} }, 60);
  };

  CORB.on('boot', function () {
    if (!intro.available()) return;
    if (forced()) { try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])intro=1(&|$)/, '$1').replace(/[?&]$/, '') + (location.hash || '')); } catch (e) {} }
    if (HANDOFF && !forced()) { markSeen(); return; }
    if (forced() || (!standalone() && !seen())) intro.play();
  });
})();
