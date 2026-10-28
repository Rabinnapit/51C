/* CORE-08-TOUR — the guided tour (same engine as Board Ready's). Offered once the first time the guide opens, and again
   from the ? button in the top bar, the ? key, Home and Settings & help. It visits each area of the guide, points at it
   and says in a sentence or two what it is for. Stores settings.tourSeen once the offer is answered. Never throws: a
   step whose target is missing is centered or skipped. */
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
  function phoneTab(view) { return q('.mobile-nav button[data-view="' + view + '"]'); }
  // On a phone the side menu is closed, so menu steps point at the phone bar or the menu button instead.
  function side(el, view) { return narrow() ? (view && phoneTab(view)) || q('.topbar .menu-btn') : el; }
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
  function homeTarget() { return q('.path-now') || q('.setup-card') || q('.home-head'); }
  function pageHead() { return q('.page-head'); }

  // About eighteen stops. For many people the tour is the only explanation of the guide they will ever see, so it says
  // what the guide is, opens the main pages (Certification 101, Official documents, Courses, Lessons, a lesson with its
  // pictures) and points at every other part of the menu and the top bar.
  function steps() {
    var ed = CORB.edition();
    var list = [
      { title: 'What B2B Guide is', view: 'home', target: homeTarget,
        text: 'A study and certification guide for new 51C Soldiers and 1102 civilians. It takes you to the DoW Contracting Professional certification: five courses, the CON 3990V exam and 12 months of experience. It works without internet; it is a training aid, not official guidance.' },
      { title: 'Your home page', view: 'home', target: homeTarget,
        text: 'Home opens with this week on your exam path and your next step. Until you build your plan, it asks three quick questions to set your dates.' },
      { title: 'Exam path', target: function () { return side(navItem('path'), 'path'); },
        text: '26 dated weeks to pass CON 3990V. Each week has a goal, lessons, a FAR reading, flashcards and a 10-question check, and each month ends with a timed checkpoint.' },
      { title: 'My plan', target: function () { return side(navItem('plan')); },
        text: 'Every step to certification with a date: your courses, the exam, 12 months of experience and the 36-month deadline. You can add the dates to your calendar.' },
      { title: 'Certification 101', view: 'cert', target: function () { return q('.v-cert .tabs') || pageHead(); },
        text: 'The rules in one place, explained with pictures: what certification takes, signing up for courses in AITAS, the exam step by step, retakes, the 36-month clock, life after certification and 21 questions answered. Each tab is one topic.' },
      { title: 'Official documents', view: 'official', target: function () { return q('.doc-grid') || pageHead(); },
        text: '26 real DoW and WarU documents behind the certification: the exam FAQ, roadmap and flowchart, policy memos, the career and competency models. Each has a Simple version in pictures and the real pages, which open even without internet.' },
      { title: 'Courses', view: 'courses', target: pageHead,
        text: 'Every course you need, in order: what it teaches, how to get ready, how long it runs and how to sign up. Set each one to Signed up or Done to track your progress.' },
      { title: 'Lessons', view: 'learn', target: function () { return q('.learn-top') || pageHead(); },
        text: '35 short lessons in plain English, in the same four areas as the exam. Each has an example, the common mistakes and a quick check at the end.' },
      { title: 'Pictures you can play', view: 'lesson', params: { id: 'L01' }, target: function () { return q('.lesson-figs'); },
        text: 'Every lesson starts with pictures. Press Play to see each part light up and hear it read aloud. In lessons with dollar rules, Try it tools answer for any amount you pick.' },
      { title: 'How-to guides', target: function () { return side(navItem('howto'), 'learn'); },
        text: '13 step-by-step checklists for real tasks: your first week, signing up for a course in AITAS, scheduling the exam, a simplified buy, a modification, closeout and more.' },
      { title: 'Practice', target: function () { return side(navGroup('Practice'), 'quiz'); },
        text: 'The practice test has 374 questions, each answer explained with where it is written. Practice by exam area, retry your misses, or take a timed simulator weighted like CON 3990V. Flashcards bring back what you miss.' },
      { title: 'Arcade', optional: true, target: function () { return narrow() ? null : navItem('arcade'); },
        text: 'Six games on the same facts: RPG battles, a supply convoy, artillery, a qualification range, a space shooter and a sorting yard. Pick a pace from Recruit to Elite; every run ends with a study list.' },
      { title: 'Look it up', target: function () { return side(navGroup('Look it up'), 'glossary'); },
        text: 'The glossary explains every acronym (tap any underlined acronym on a page to see it). FAR & key numbers lists the parts, thresholds and deadlines in FAR Overhaul numbering. Official links opens WarU, AITAS, Pearson and SAM.gov.' },
      { title: 'Search everything', target: function () { return q('.topbar .search-btn'); },
        text: 'Find any lesson, term, course or FAR part from any page. On a keyboard, press the / key.' },
      { title: 'Easier to read', target: function () { return narrow() ? q('.topbar .menu-btn') : [q('.topbar .text-btn'), q('.topbar .theme-btn')].filter(Boolean); },
        text: (narrow() ? 'Open the menu for a bigger text size and for day or night.' : 'Make the text bigger, or switch between day and night.') + ' Day is the default. Listen buttons read lessons aloud.' },
      { title: 'About and feedback', target: function () { return side(navItem('about')); },
        text: 'About tells you who builds this guide and how it stays current. Send feedback or report a problem from there.' },
      { title: 'Keep your progress', target: function () { return q('.topbar .save-btn') || side(navItem('settings')); },
        text: ed === 'offline' ? 'Your progress lives in this browser. Save progress stores it inside the B2B Guide file, so a restart or a cleared browser cannot erase it. Settings & help can also export it.'
          : ed === 'web' ? 'Your progress lives in this browser on this device. Settings & help can export it to a file and bring it back on another device.'
          : 'In this preview, progress stays in this browser only. Use the downloaded file or the website to keep it.' },
      { title: 'You are set', view: 'home', target: homeTarget,
        text: 'Start with this week\'s tasks. The ? button at the top of any page brings this tour back.' }
    ];
    return list.filter(function (s) { return !s.view || CORB.views[s.view]; });
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
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
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
      h('button.tour-x', { type: 'button', 'aria-label': 'Close the tour', onclick: function () { finish(); } }, icon('x'))));
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
          : h('button.btn.sm.ghost', { type: 'button', onclick: function () { finish(); } }, 'Skip tour'),
        T.nextBtn)));
    T.live.textContent = 'Step ' + (T.i + 1) + ' of ' + n + ': ' + s.title;
    try { T.nextBtn.focus({ preventScroll: true }); } catch (e) {}
  }

  // Put the highlight on the target and the card beside it: right, left, below, above, or the corner that covers least.
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
    if (i >= T.list.length) { finish(); return; }
    if (i < 0) i = 0;
    T.i = i;
    var s = T.list[i], token = ++T.token;
    var here = CORB.route() || {};
    var needRoute = !!(s.view && (here.id !== s.view || (s.params && (here.params || {}).id !== s.params.id)));
    if (needRoute) CORB.go(s.view, s.params || {});
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
      // pages that draw in two passes replace their elements a moment later
      setTimeout(function () { if (T && token === T.token) place(); }, 400);
      setTimeout(function () { if (T && token === T.token) place(); }, 1100);
    })();
  }
  function next() { if (!T) return; T.backward = false; show(T.i + 1); }
  function back() { if (!T || T.i === 0) return; T.backward = true; show(T.i - 1); }

  function finish() {
    if (!T) return;
    var t = T; T = null;
    document.removeEventListener('keydown', t.onKey, true);
    window.removeEventListener('resize', t.onMove);
    window.removeEventListener('scroll', t.onMove, true);
    if (t.raf) cancelAnimationFrame(t.raf);
    if (t.layer && t.layer.parentNode) t.layer.parentNode.removeChild(t.layer);
    try { CORB.set(SEEN, true); } catch (e) {}
    try { if (t.returnFocus && t.returnFocus.focus) t.returnFocus.focus({ preventScroll: true }); } catch (e) {}
  }

  var tour = CORB.tour = {};
  tour.running = function () { return !!T; };
  tour.start = function () {
    if (T) return;
    try { CORB.ui.closeModal(); } catch (e) {}
    try { var sc = document.getElementById('sideScrim'); if (sc) sc.click(); } catch (e) {}
    T = { i: 0, token: 0, list: steps(), returnFocus: document.activeElement };
    if (!T.list.length) { T = null; return; }
    build();
    show(0);
  };
  tour.stop = function () { finish(); };
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
          h('p', {}, 'New here? A three-minute tour shows what B2B Guide is, opens the main pages and shows what each part is for.'),
          h('p.muted.small', {}, 'The ? button at the top of the page starts it again any time.'))),
      sticky: true,
      actions: [
        { label: 'Not now', onClick: function () { CORB.set(SEEN, true); } },
        { label: 'Show me around', primary: true, onClick: function () { CORB.set(SEEN, true); setTimeout(tour.start, 40); } }
      ]
    });
  };
})();
