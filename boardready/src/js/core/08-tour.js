/* CORE-08-TOUR — the guided tour. Offered the first time the app opens, and again from the ? button in the top bar
   or the ? key. It visits each area of the app, points at it, and says in a sentence or two what it is for.
   Stores settings.tourSeen once the offer is answered. Never throws: a step whose target is missing is centered or
   skipped. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var SEEN = 'settings.tourSeen';
  var T = null;            // the running tour

  function h() { return CORB.ui.h.apply(null, arguments); }
  function icon(n) { return CORB.ui.icon(n); }
  function q(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }
  function narrow() { try { return window.matchMedia('(max-width: 860px)').matches; } catch (e) { return window.innerWidth <= 860; } }
  function shown(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var st = window.getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none';
  }
  function navGroup(label) {
    var groups = document.querySelectorAll('.side .nav-group');
    for (var i = 0; i < groups.length; i++) {
      var l = groups[i].querySelector('.nav-label');
      if (l && l.textContent.trim() === label) return groups[i];
    }
    return null;
  }
  function navItem(view) { return q('.side .nav[data-view="' + view + '"]'); }
  // On a phone the sidebar is closed, so side-menu steps point at the menu button instead.
  function side(el) { return narrow() ? q('.topbar .menu-btn') : el; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  // a step may point at several elements at once; the highlight covers all of them
  function unionRect(els) {
    var out = null;
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (!out) out = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      else { out.left = Math.min(out.left, r.left); out.top = Math.min(out.top, r.top); out.right = Math.max(out.right, r.right); out.bottom = Math.max(out.bottom, r.bottom); }
    });
    out.width = out.right - out.left; out.height = out.bottom - out.top;
    return out;
  }
  function resolve(found) {
    var list = (Array.isArray(found) ? found : [found]).filter(shown);
    return list.length ? (Array.isArray(found) ? list : list[0]) : null;
  }

  // Eight stops for a candidate (the full edition adds its role, board room and editor stops). Each one points at a
  // control or a menu group; the pages themselves are left to explain their own screens.
  // Eight stops for a candidate (the full edition adds its role, board room and editor stops). Each one points at a
  // control or a menu group; the pages themselves are left to explain their own screens.
  function steps() {
    var cand = CORB.isCandidateEdition();
    var list = [
      { title: 'Your class and organization', view: 'dashboard',
        target: function () { return narrow() ? q('.topbar .class-chip') : [q('.topbar .class-chip'), q('.topbar .unit-select')].filter(Boolean); },
        text: 'Pick the class you are boarding for and your organization. Every page follows them: you get the questions for this class and the lower classes.' },
      cand ? null : { title: 'Your role', target: function () { return q('.topbar .role-chip'); },
        text: 'Candidates study and practice. Board members and facilitators also get the board room, and facilitators get the content editor.' },
      { title: 'Start here', view: 'dashboard', target: function () { return q('.db-start') || q('.db-continue') || q('.db-hero'); },
        text: 'The dashboard opens with your next steps, in order. Below them are your weakest topics and a study plan.' },
      { title: 'Prepare', target: function () { return side(navGroup('Prepare')); },
        text: 'Learn the material: the warrant process from application to appointment, every board question with its answer, and short study primers.' },
      { title: 'Practice', target: function () { return narrow() ? (q('.mobile-nav') || q('.topbar .menu-btn')) : navGroup('Practice'); },
        text: 'Rehearse the way the board tests you: flashcards, a quiz, board scenarios, a timed mock board, the mentor and the Arcade games.' },
      { title: 'Reference', target: function () { return side(navGroup('Reference')); },
        text: 'Look things up: the regulation explorer with old-to-new FAR numbers and dollar thresholds, the glossary and useful links.' },
      cand ? null : { title: 'Board room', target: function () { return side(navGroup('Board room')) || q('.topbar .role-chip'); },
        text: 'For board members and facilitators: the board console for a live board, the study group projector, and Board Jeopardy. Switch your role to open it.' },
      cand ? null : { title: 'Content editor', optional: true, target: function () { return narrow() ? null : navItem('editor'); },
        text: 'Facilitators fix or add questions here, then save a new copy of the app to share.' },
      { title: 'Search everything', target: function () { return q('.topbar .search-btn'); },
        text: 'Find any question, primer, term or threshold from any page. On a keyboard, press the / key.' },
      { title: 'Settings', view: 'settings', target: function () { return q('.set-nav') || q('.set-head'); },
        text: 'Read aloud, whether answers stay hidden until you ask, and your data. Save your notes into the Board Ready file here so a restart cannot lose them.' },
      { title: 'You are set', view: 'dashboard', target: function () { return q('.db-start') || q('.db-continue'); },
        text: 'Start with step 1 on your dashboard. The ? button at the top of any page brings this tour back.' }
    ];
    return list.filter(Boolean).filter(function (s) { return !s.view || CORB.views[s.view]; });
  }

  // ---------------------------------------------------------------- layer
  function build() {
    T.spot = h('div.tour-spot', { 'aria-hidden': 'true' });
    T.card = h('div.tour-card', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tour-title', 'aria-describedby': 'tour-text' });
    T.live = h('div.sr-only', { 'aria-live': 'polite' });
    T.layer = h('div.tour-layer', {}, T.spot, T.card, T.live);
    document.body.appendChild(T.layer);
    // capture phase: the tour owns the keyboard while it is open, so page shortcuts never fire underneath it
    T.onKey = function (e) {
      if (!T) return;
      if (e.key === 'Tab') return;
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    document.addEventListener('keydown', T.onKey, true);
    T.onMove = function () { if (T && !T.raf) T.raf = requestAnimationFrame(function () { if (T) { T.raf = 0; place(); } }); };
    window.addEventListener('resize', T.onMove);
    window.addEventListener('scroll', T.onMove, true);
  }

  function paint() {
    var s = T.list[T.i], n = T.list.length, last = T.i === n - 1;
    var card = T.card;
    card.innerHTML = '';
    card.appendChild(h('div.tour-top', {},
      h('span.tour-step', {}, 'Step ' + (T.i + 1) + ' of ' + n),
      h('button.tour-x', { type: 'button', 'aria-label': 'Close the tour', onclick: function () { finish(false); } }, icon('x'))));
    card.appendChild(h('h3#tour-title', {}, s.title));
    card.appendChild(h('p.tour-text#tour-text', {}, s.text));
    var dots = [];
    for (var i = 0; i < n; i++) dots.push(h('i' + (i === T.i ? '.on' : '')));
    T.nextBtn = h('button.btn.sm.primary', { type: 'button', onclick: next }, last ? 'Finish' : 'Next', icon(last ? 'check' : 'arrow-right'));
    card.appendChild(h('div.tour-foot', {},
      h('div.tour-dots', { 'aria-hidden': 'true' }, dots),
      h('div.tour-actions', {},
        T.i > 0
          ? h('button.btn.sm.ghost', { type: 'button', onclick: back }, icon('arrow-left'), 'Back')
          : h('button.btn.sm.ghost', { type: 'button', onclick: function () { finish(false); } }, 'Skip tour'),
        T.nextBtn)));
    T.live.textContent = 'Step ' + (T.i + 1) + ' of ' + n + ': ' + s.title;
    try { T.nextBtn.focus({ preventScroll: true }); } catch (e) {}
  }

  // Put the highlight on the target and the card beside it: right, left, below, above, or docked at the bottom.
  function place() {
    if (!T || !T.card) return;
    var vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
    var card = T.card, spot = T.spot, m = 12, gap = 14, pad = 6;
    var cw = Math.min(380, vw - 2 * m);
    card.style.width = cw + 'px';
    var ch = card.offsetHeight;
    var els = (Array.isArray(T.el) ? T.el : [T.el]).filter(function (x) { return x && document.body.contains(x); });
    var step = T.list[T.i];
    if (!els.length && T.el && step && step.target) {
      // the page redrew itself after the tour found its target: find it again
      var again = null;
      try { again = resolve(step.target()); } catch (e) { again = null; }
      if (again) {
        T.el = again; els = Array.isArray(again) ? again : [again];
        var ar = unionRect(els);
        if (ar.top < 70 || ar.bottom > vh - 20) { try { els[0].scrollIntoView({ block: ar.height > vh * 0.6 ? 'start' : 'center' }); } catch (e) {} }
      }
    }
    var el = els.length ? els[0] : null;
    if (!el) {
      spot.classList.remove('on');
      spot.style.left = (vw / 2) + 'px'; spot.style.top = (vh / 2) + 'px'; spot.style.width = '0px'; spot.style.height = '0px';
      card.style.left = Math.round((vw - cw) / 2) + 'px';
      card.style.top = Math.round(clamp((vh - ch) / 2, m, vh - ch - m)) + 'px';
      return;
    }
    var r = unionRect(els);
    var x = clamp(r.left - pad, 4, vw - 8), y = clamp(r.top - pad, 4, vh - 8);
    var w = clamp(r.right + pad, 8, vw - 4) - x, hh = clamp(r.bottom + pad, 8, vh - 4) - y;
    spot.classList.add('on');
    spot.style.left = x + 'px'; spot.style.top = y + 'px'; spot.style.width = Math.max(0, w) + 'px'; spot.style.height = Math.max(0, hh) + 'px';
    var left, top;
    if (x + w + gap + cw <= vw - m) { left = x + w + gap; top = clamp(y, m, vh - ch - m); }
    else if (x - gap - cw >= m) { left = x - gap - cw; top = clamp(y, m, vh - ch - m); }
    else if (y + hh + gap + ch <= vh - m) { top = y + hh + gap; left = clamp(x, m, vw - cw - m); }
    else if (y - gap - ch >= m) { top = y - gap - ch; left = clamp(x, m, vw - cw - m); }
    else {
      // no free side: use the corner that covers the least of the highlight
      var corners = [[vw - cw - m, vh - ch - m], [m, vh - ch - m], [vw - cw - m, m], [m, m]], best = null, bestArea = Infinity;
      corners.forEach(function (c) {
        var ox = Math.max(0, Math.min(c[0] + cw, x + w) - Math.max(c[0], x));
        var oy = Math.max(0, Math.min(c[1] + ch, y + hh) - Math.max(c[1], y));
        if (ox * oy < bestArea) { bestArea = ox * oy; best = c; }
      });
      left = best[0]; top = best[1];
    }
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
  }

  function show(i) {
    if (!T) return;
    if (i >= T.list.length) { finish(true); return; }
    if (i < 0) i = 0;
    T.i = i;
    var s = T.list[i], token = ++T.token;
    var needRoute = !!(s.view && CORB.route().id !== s.view);
    if (needRoute) CORB.go(s.view);
    var started = Date.now(), wait = needRoute ? 1800 : 300;
    (function poll() {
      if (!T || token !== T.token) return;
      var el = null;
      if (s.target) { try { el = resolve(s.target()); } catch (e) { el = null; } }
      if (s.target && !el && Date.now() - started < wait) { setTimeout(poll, 90); return; }
      if (s.target && !el && s.optional) { show(T.i + (T.backward ? -1 : 1)); return; }
      T.el = el;
      if (el) {
        var first = Array.isArray(el) ? el[0] : el;
        var r = Array.isArray(el) ? unionRect(el) : first.getBoundingClientRect();
        if (r.top < 70 || r.bottom > window.innerHeight - 20) { try { first.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? 'start' : 'center' }); } catch (e) {} }
      } else if (needRoute) {
        try { window.scrollTo(0, 0); } catch (e) {}
      }
      paint();
      place();
      requestAnimationFrame(place);
      // pages that draw in two passes (quiz, mock board, mentor) replace their elements a moment later
      setTimeout(function () { if (T && token === T.token) place(); }, 400);
      setTimeout(function () { if (T && token === T.token) place(); }, 1100);
    })();
  }
  function next() { if (!T) return; T.backward = false; show(T.i + 1); }
  function back() { if (!T || T.i === 0) return; T.backward = true; show(T.i - 1); }

  function finish(completed) {
    if (!T) return;
    var t = T; T = null;
    document.removeEventListener('keydown', t.onKey, true);
    window.removeEventListener('resize', t.onMove);
    window.removeEventListener('scroll', t.onMove, true);
    if (t.raf) cancelAnimationFrame(t.raf);
    if (t.layer && t.layer.parentNode) t.layer.parentNode.removeChild(t.layer);
    try { CORB.set(SEEN, true); } catch (e) {}
    // the tour visits pages; do not let it change what the dashboard offers to continue
    try { CORB.set('progress.lastView', t.lastView || null, { silent: true }); } catch (e) {}
    try { if (t.returnFocus && t.returnFocus.focus) t.returnFocus.focus({ preventScroll: true }); } catch (e) {}
  }

  var tour = CORB.tour = {};
  tour.running = function () { return !!T; };
  tour.start = function () {
    if (T) return;
    try { CORB.ui.closeModal(); } catch (e) {}
    T = { i: 0, token: 0, list: steps(), lastView: CORB.get('progress.lastView', null), returnFocus: document.activeElement };
    if (!T.list.length) { T = null; return; }
    build();
    show(0);
  };
  tour.stop = function () { finish(false); };
  // First open: ask once. Either answer counts as seen; closing the dialog with X asks again next time.
  tour.offer = function () {
    if (T || CORB.get(SEEN)) return;
    if (q('.modal-scrim')) return;
    var r = CORB.route ? CORB.route() : null;
    if (r && r.id === 'arcade') return;
    CORB.ui.modal({
      title: 'Welcome to ' + CORB.appName(),
      body: h('div.tour-offer', {},
        h('div.tour-offer-icon', {}, icon('help')),
        h('div', {},
          h('p', {}, (((CORB.DATA || {}).meta || {}).owner ? CORB.appName() + ' is the work of ' + CORB.DATA.meta.owner + '. ' : '') + 'New here? A short tour shows what each part of the app is for.'),
          h('p.muted.small', {}, 'The ? button at the top of the page starts it again any time.'))),
      sticky: true,
      actions: [
        { label: 'Not now', onClick: function () { CORB.set(SEEN, true); } },
        { label: 'Show me around', primary: true, onClick: function () { CORB.set(SEEN, true); setTimeout(tour.start, 40); } }
      ]
    });
  };
})();
