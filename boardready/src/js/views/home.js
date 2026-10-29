/* VIEW: home — the landing page (dark cinematic surface).
   One screen: the title lines, one sentence, the start button, an "At a glance" panel and the training-aid footer.
   After the first visit the file opens on the dashboard instead (core/02-router.js boot). */
(function () {
  'use strict';
  var CORB = window.CORB, h = CORB.ui.h, icon = CORB.ui.icon;

  function enter(role, view) {
    Promise.resolve(CORB.setRole(role)).then(function (ok) { if (ok !== false) CORB.go(view || 'dashboard'); });
  }
  function startTour() { if (CORB.tour) CORB.tour.start(); }

  CORB.registerView({
    id: 'home', title: 'Home', layout: 'full', surface: 'landing', nav: false,
    render: function (root) {
      var meta = CORB.DATA.meta || {}, U = CORB.util;
      var days = meta.next_board ? U.daysUntil(meta.next_board) : null;
      var when = days == null || isNaN(days) ? '' : days > 0 ? ' · in ' + U.plural(days, 'day') : days === 0 ? ' · today' : ' · ' + U.plural(-days, 'day') + ' ago';
      var cand = CORB.isCandidateEdition();

      var page = h('div.landing', {},
        h('div.l-bg', { 'aria-hidden': 'true' }, h('div.l-orb.l-orb-1'), h('div.l-orb.l-orb-2'), h('div.l-orb.l-orb-3'), h('div.l-grid'), h('div.l-grain')),
        h('header.l-nav', {},
          h('a.l-brand', { href: '#/home' }, h('span.l-mark' + (CORB.monogram().length > 1 ? '.two' : ''), {}, CORB.monogram()), h('span', {}, CORB.appName())),
          h('div.l-nav-cta', {}, h('button.btn.sm.l-ghost', { type: 'button', onclick: startTour }, icon('help'), 'Guided tour'))
        ),
        h('section.l-hero', {},
          h('div.l-hero-copy', {},
            h('div.l-eyebrow.rise', {}, h('span.l-pip'), meta.org || '411th Contracting Support Brigade'),
            h('h1.l-title.rise.rise-1', {}, 'Prepare the packet.', h('br'), 'Master the board.', h('br'), h('em', {}, 'Sign with authority.')),
            h('p.l-lede.rise.rise-2', {}, 'Board questions, practice and the warrant process in one file that works offline.'),
            h('div.l-cta.rise.rise-3', {},
              h('button.btn.lg.gold', { onclick: function () { enter('candidate', 'dashboard'); } }, icon('zap'), cand ? 'Start studying' : 'Start as a candidate'),
              cand ? null : h('button.btn.lg.l-ghost', { onclick: function () { enter('board', 'board'); } }, icon('users'), 'Board room'),
              cand ? null : h('button.btn.lg.l-ghost', { onclick: function () { enter('facilitator', 'dashboard'); } }, icon('settings'), 'Facilitator')),
            h('div.l-trust.rise.rise-4', {}, icon('shield'), h('span', {}, 'No account needed. Nothing to install.'))
          ),
          h('div.l-hero-panel.rise.rise-3', {},
            h('div.l-panel-head', {}, h('span.l-pip'), 'At a glance'),
            h('div.l-panel-row', {}, h('span', {}, 'Next CORB'), h('b', {}, meta.next_board ? U.fmtDate(meta.next_board + 'T00:00:00') + when : '—')),
            h('div.l-panel-row', {}, h('span', {}, 'Content verified'), h('b', {}, meta.content_verified_on || '—')),
            h('div.l-panel-row', {}, h('span', {}, 'Regulation baseline'), h('b', {}, 'RFO FAR · effective 1 Feb 2026'))
          )
        ),
        h('footer.l-foot', {},
          h('div.l-foot-main', {},
            h('p.l-muted', {}, meta.disclaimer || 'Training aid, not authoritative guidance.'),
            h('div.l-foot-btns', {},
              h('button.btn.sm.l-ghost', { onclick: function () { CORB.go('settings'); } }, icon('settings'), 'Settings'),
              h('button.btn.sm.l-ghost', { onclick: function () { CORB.go('about'); } }, icon('info'), cand ? 'About' : 'About & names'))),
          h('div.l-foot-bar', {}, h('span', {}, CORB.appName() + ' · v' + (meta.version || '1.0') + (meta.built_on ? ' · built ' + meta.built_on : '')), h('span', {}, 'Not an official Army product. No official seals used.'))
        )
      );
      root.appendChild(page);
    }
  });
})();
