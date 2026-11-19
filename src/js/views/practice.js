/* VIEW practice — the Practice tab of the phone's bar (0.35.0): four ways to practice, one tap each. Quick 10 is the
   page's one highlighted tile, unless a quiz is in progress: then Resume is. On a computer the side menu lists the three
   pages themselves, so this page is not on it (search still finds it). */
(function () {
  'use strict';
  var CORB = window.CORB;

  CORB.registerView({ id: 'practice', title: 'Practice', section: 'Practice', icon: 'quiz', nav: false, order: 65, mobile: true, short: 'Practice',
    blurb: 'Quick 10, the practice test, flashcards and the Arcade', keywords: 'practice quiz test flashcards cards arcade games quick 10 drill',
    render: function (root) {
      var h = CORB.ui.h, icon = CORB.ui.icon;
      var going = CORB.quiz && CORB.quiz.going ? CORB.quiz.going() : null;
      var due = CORB.views.cards && CORB.views.cards.badge ? CORB.views.cards.badge() : 0;
      var bank = CORB.data.questions().length, AR = CORB.arcadeReady && CORB.arcadeReady(), ds = null;
      try { ds = AR ? AR.daily.summary() : null; } catch (e) { ds = null; }
      function tile(o) {
        return h('a.card.lift.p-tile' + (o.main ? '.main' : ''), { href: o.href, 'data-tile': o.id },
          h('span.tile-icon', {}, icon(o.icon)), h('b', {}, o.title), h('span.muted.small', {}, o.sub),
          h('span.p-status', {}, o.badge || h('span.tiny.muted', {}, o.note || '')));
      }
      root.appendChild(CORB.ui.pageHead({ title: 'Practice' }));
      root.appendChild(h('section.practice-grid', {},
        tile({ id: 'quick', main: !going, href: '#/quiz?start=quick', icon: 'zap', title: 'Quick 10', sub: '10 mixed questions', note: 'About 5 minutes' }),
        tile({ id: 'quiz', main: !!going, href: going ? '#/quiz?run=1' : '#/quiz', icon: 'quiz', title: 'Practice test', sub: 'By area, your misses, or timed',
          badge: going ? CORB.ui.badge('brass', 'Resume: ' + (going.i + 1) + ' of ' + going.n, 'play') : null, note: bank + ' questions' }),
        tile({ id: 'cards', href: '#/cards', icon: 'cards', title: 'Flashcards', sub: 'FAR parts and key numbers',
          badge: due ? CORB.ui.badge('brass', due + ' due', 'clock') : null, note: 'None due now' }),
        CORB.views.arcade ? tile({ id: 'arcade', href: ds && !ds.closed && ds.next ? '#/arcade?daily=' + (ds.nextN || ds.done + 1) : '#/arcade', icon: 'gamepad', title: 'Arcade', sub: 'Seven games, same facts',
          badge: ds ? CORB.ui.badge(ds.closed ? 'ok' : 'neutral', ds.closed ? 'Card closed' : 'Card · ' + ds.done + ' of 3', ds.closed ? 'check' : 'target') : null, note: 'Play to remember' }) : null));
      var rd = CORB.scoring.readiness();
      if (rd.overall != null) root.appendChild(h('section.card.p-ready', {}, CORB.ui.ring(rd.overall, rd.overall + '%', rd.overall >= 70 ? 'var(--ok)' : 'var(--accent-2)', 56),
        h('div', {}, h('b', {}, 'Exam readiness'), h('div.muted.small', {}, 'Your recent answers that were right. You need 70% to pass.'))));
    } });
})();
