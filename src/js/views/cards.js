/* VIEW cards — flashcards with spaced repetition: FAR part titles, acronyms, terms, key numbers, deadlines, courses */
(function () {
  'use strict';
  var CORB = window.CORB;
  var session = null;

  function decks() {
    var D = CORB.DATA, far = (D.far || {}), gl = CORB.data.glossary();
    var isAcr = function (t) { return /^[A-Z0-9][A-Z0-9&()/.-]{1,11}$/.test(t) && /[A-Z]/.test(t); };
    var out = [
      { id: 'far-exam', title: 'FAR part titles on the exam', sub: 'The 20 titles the exam says to know', icon: 'scale',
        cards: CORB.data.examParts().map(function (p) { return { id: 'far-' + p.n, front: 'FAR Part ' + p.n, back: p.title, more: p.plain }; }) },
      { id: 'far-all', title: 'Every FAR part', sub: 'All 53 parts, RFO titles', icon: 'layers',
        cards: CORB.data.farParts().filter(function (p) { return !/reserved/i.test(p.title); }).map(function (p) { return { id: 'farall-' + p.n, front: 'FAR Part ' + p.n, back: p.title, more: p.plain }; }) },
      { id: 'acronyms', title: 'Acronyms', sub: 'KO, PWS, IGCE and the rest', icon: 'glossary',
        cards: gl.filter(function (g) { return isAcr(g.term); }).map(function (g) { return { id: 'gl-' + g.term, front: g.term, back: g.expansion || g.term, more: g.definition }; }) },
      { id: 'terms', title: 'Key terms', sub: 'Words that are not acronyms', icon: 'book',
        cards: gl.filter(function (g) { return !isAcr(g.term); }).map(function (g) { return { id: 'gl-' + g.term, front: g.term, back: g.definition }; }) },
      { id: 'numbers', title: 'Key numbers', sub: 'Thresholds every new specialist uses', icon: 'target',
        cards: (far.numbers || []).filter(function (n) { return n.card !== false; }).map(function (n) { return { id: 'num-' + n.id, front: n.q || n.name, back: n.value, more: n.plain + (n.cite ? ' (' + n.cite + ')' : '') }; }) },
      { id: 'deadlines', title: 'Deadlines and time limits', sub: 'Protests, claims, closeout, debriefings', icon: 'clock',
        cards: (far.deadlines || []).map(function (n) { return { id: 'dl-' + n.id, front: n.q || n.name, back: n.value, more: n.plain + (n.cite ? ' (' + n.cite + ')' : '') }; }) },
      { id: 'courses', title: 'Your courses', sub: 'Course numbers and what they cover', icon: 'school',
        cards: CORB.data.courses().filter(function (c) { return c.group === 'required' || c.group === 'exam'; }).map(function (c) { return { id: 'crs-' + c.id, front: c.code, back: c.title, more: c.short_about || '' }; }) }
    ];
    (D.cards || []).forEach(function (dk) { out.push({ id: dk.id, title: dk.title, sub: dk.sub, icon: dk.icon || 'cards', cards: (dk.cards || []).map(function (c, i) { return { id: dk.id + '-' + (c.id || i), front: c.front, back: c.back, more: c.more }; }) }); });
    return out.filter(function (d) { return d.cards.length; });
  }
  CORB.decks = decks;   // the About page counts them
  function counts(dk) {
    var n = 0, due = 0, known = 0;
    dk.cards.forEach(function (c) { var s = CORB.scoring.srs.get(c.id); if (!s) n++; else { if (s.due <= CORB.util.today()) due++; if (s.reps >= 2) known++; } });
    return { fresh: n, due: due, known: known };
  }

  function begin(dk, reverse) {
    var due = dk.cards.filter(function (c) { return CORB.scoring.srs.isDue(c.id); });
    var fresh = CORB.util.shuffle(dk.cards.filter(function (c) { return CORB.scoring.srs.isNew(c.id); })).slice(0, Math.max(0, 20 - due.length));
    var queue = CORB.util.shuffle(due).concat(fresh);
    if (!queue.length) queue = CORB.util.shuffle(dk.cards).slice(0, 20);
    session = { deck: dk.id, title: dk.title, queue: queue, reverse: !!reverse, flipped: false, seen: 0, got: 0 };
    CORB.go('cards', { deck: dk.id, study: '1' });
  }

  function study(root, h, icon) {
    if (!session) { CORB.go('cards'); return; }
    var c = session.queue[0];
    if (!c) {
      root.appendChild(h('div.card.raised.center.cards-done', {}, icon('trophy'), h('h2', {}, 'Deck done for now'), h('p.muted', {}, session.got + ' of ' + session.seen + ' marked "Got it". Cards you missed come back sooner; the ones you know come back in a few days.'),
        h('div.row.mt-4', { style: { justifyContent: 'center' } }, h('a.btn.primary', { href: '#/cards' }, 'Pick another deck'), h('a.btn', { href: '#/quiz?start=quick' }, icon('zap'), 'Quick 10 quiz'))));
      session = null; return;
    }
    var front = session.reverse ? c.back : c.front, back = session.reverse ? c.front : c.back;
    root.appendChild(h('div.row.between.mb-3', {}, h('a.back-link', { href: '#/cards' }, icon('arrow-left'), session.title), h('span.small.muted', {}, session.queue.length + ' left')));
    var face = h('div.fc-face', {}, h('div.fc-label', {}, session.flipped ? 'Answer' : 'Question'), h('div.fc-text' + (front.length < 40 ? '.big' : ''), {}, session.flipped ? back : front),
      session.flipped && c.more && !session.reverse ? h('div.fc-more', {}, CORB.ui.rich(c.more)) : null,
      session.flipped && session.reverse ? h('div.fc-more', {}, h('p', {}, c.back)) : null);
    var card = h('button.fc' + (session.flipped ? '.flipped' : ''), { type: 'button', 'aria-label': session.flipped ? 'Answer shown' : 'Show the answer', onclick: flip }, face);
    function flip() { if (session.flipped) return; session.flipped = true; CORB.render(); }
    function grade(g) { CORB.scoring.srs.grade(c.id, g); session.seen++; if (g >= 5) session.got++; var cur = session.queue.shift(); if (g < 3) session.queue.splice(Math.min(3, session.queue.length), 0, cur); session.flipped = false; CORB.render(); }
    root.appendChild(card);
    root.appendChild(session.flipped
      ? h('div.fc-grade', {}, h('button.btn.lg.again', { type: 'button', onclick: function () { grade(1); } }, 'Again', h('kbd.hide-sm', {}, '1')), h('button.btn.lg.almost', { type: 'button', onclick: function () { grade(3); } }, 'Almost', h('kbd.hide-sm', {}, '2')), h('button.btn.lg.primary', { type: 'button', onclick: function () { grade(5); } }, 'Got it', h('kbd.hide-sm', {}, '3')))
      : h('div.fc-grade', {}, h('button.btn.lg.primary.block', { type: 'button', onclick: flip }, 'Show the answer', h('kbd.hide-sm', {}, 'Space'))));
    root.appendChild(h('div.row.tight.mt-3', { style: { justifyContent: 'center' } }, CORB.ui.listenBtn(function () { return session && session.flipped ? front + '\n' + back + '\n' + (c.more || '') : front; })));
    keyHandler = function (e) {
      var tag = (e.target && e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea') return;
      if (!session) return;
      if (!session.flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flip(); }
      else if (session.flipped && (e.key === '1' || e.key === '2' || e.key === '3')) { e.preventDefault(); grade({ '1': 1, '2': 3, '3': 5 }[e.key]); }
    };
    document.addEventListener('keydown', keyHandler);
  }
  var keyHandler = null;

  CORB.registerView({ id: 'cards', mobileAs: 'quiz', title: 'Flashcards', section: 'Practice', icon: 'cards', nav: true, order: 80,
    blurb: 'FAR part titles, acronyms and key numbers', keywords: 'flashcards memorize FAR part titles acronyms thresholds spaced repetition',
    badge: function () { try { return decks().reduce(function (a, d) { return a + counts(d).due; }, 0); } catch (e) { return 0; } },
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon, p = ctx.params;
      if (p.study) { study(root, h, icon); return; }
      var all = decks();
      if (p.deck && !p.study) { var dk0 = all.filter(function (d) { return d.id === p.deck; })[0]; if (dk0 && p.go) { begin(dk0); return; } }
      root.appendChild(CORB.ui.pageHead({ title: 'Flashcards', lede: 'Look at the card, say the answer out loud, then flip it. Mark how well you knew it: cards you miss come back soon, cards you know come back days later.' }));
      root.appendChild(h('div.grid.auto.decks', {}, all.map(function (dk) {
        var c = counts(dk), hl = p.deck === dk.id;
        return h('div.card.deck' + (hl ? '.hl' : ''), {}, h('div.row.between', {}, h('div.deck-icon', {}, icon(dk.icon)), c.due ? CORB.ui.badge('brass', c.due + ' due') : null),
          h('b.deck-title', {}, dk.title), h('span.small.muted', {}, dk.sub),
          h('div.deck-stats.tiny.muted', {}, dk.cards.length + ' cards · ' + c.known + ' known · ' + c.fresh + ' new'),
          CORB.ui.bar(CORB.util.pct(c.known, dk.cards.length), 'ok'),
          h('div.row.tight.mt-2', {}, h('button.btn.primary.sm', { type: 'button', onclick: function () { begin(dk, false); } }, icon('play'), c.due ? 'Review due cards' : 'Study'),
            /^far-/.test(dk.id) ? h('button.btn.sm', { type: 'button', onclick: function () { begin(dk, true); } }, icon('repeat'), 'Title first') : null));
      })));
      root.appendChild(h('p.muted.small.mt-5', {}, 'Keys: Space flips the card; 1, 2 and 3 grade it. Progress stays on this device.'));
    },
    onLeave: function () { if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } } });
})();
