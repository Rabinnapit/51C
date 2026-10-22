/* VIEW games — four short games: FAR Part Match, Which phase?, Threshold check, Who carries the risk? */
(function () {
  'use strict';
  var CORB = window.CORB;
  var GAMES = [
    { id: 'farmatch', title: 'FAR Part Match', sub: 'Match part numbers to their titles against the clock. The exam expects you to know 20 of them.', icon: 'scale' },
    { id: 'phase', title: 'Which phase?', sub: 'Pre-award, award or post-award? Sort real tasks into the contract life cycle.', icon: 'layers' },
    { id: 'threshold', title: 'Threshold check', sub: 'A buy lands on your desk. Which rules apply at that dollar value?', icon: 'target' },
    { id: 'risk', title: 'Who carries the risk?', sub: 'Put contract types in order, from the contractor carrying the cost risk to the Government carrying it.', icon: 'scale' }
  ];
  var timer = null;
  function best(id) { return CORB.get('progress.games.' + id) || { plays: 0, best: null }; }
  function record(id, score, lowerIsBetter) {
    var g = best(id); g.plays = (g.plays || 0) + 1; g.last = score;
    if (g.best == null || (lowerIsBetter ? score < g.best : score > g.best)) { g.best = score; g.newBest = true; } else g.newBest = false;
    CORB.set('progress.games.' + id, g); CORB.touch('game-' + id); return g;
  }
  function header(h, icon, g, extra) { return h('div.row.between.mb-3', {}, h('a.back-link', { href: '#/games' }, icon('arrow-left'), 'All games'), extra || null); }

  // ---- FAR Part Match ----
  function farmatch(root, h, icon) {
    var parts = CORB.util.shuffle(CORB.data.examParts()).slice(0, 6), left = CORB.util.shuffle(parts), right = CORB.util.shuffle(parts);
    var pickL = null, matched = 0, misses = 0, t0 = Date.now();
    var clock = h('span.num.g-clock', {}, '0:00');
    root.appendChild(header(h, icon, null, h('div.row.tight', {}, icon('clock'), clock)));
    root.appendChild(h('h1.g-title', {}, 'FAR Part Match'));
    root.appendChild(h('p.muted', {}, 'Tap a part number, then its title. Six pairs per round.'));
    var colL = h('div.match-col'), colR = h('div.match-col.titles');
    var bl = left.map(function (p) { var b = h('button.match', { type: 'button', 'data-n': String(p.n) }, 'Part ' + p.n); b.addEventListener('click', function () { if (b.classList.contains('ok')) return; bl.forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); pickL = p.n; }); return b; });
    var br = right.map(function (p) { var b = h('button.match', { type: 'button' }, p.title); b.addEventListener('click', function () {
      if (b.classList.contains('ok') || pickL == null) { if (pickL == null) CORB.ui.toast('Pick a part number first'); return; }
      var lb = bl.filter(function (x) { return x.getAttribute('data-n') === String(pickL); })[0];
      if (pickL === p.n) { b.classList.add('ok'); lb.classList.remove('sel'); lb.classList.add('ok'); matched++; pickL = null; if (matched === parts.length) done(); }
      else { misses++; b.classList.add('bad'); setTimeout(function () { b.classList.remove('bad'); }, 400); }
    }); return b; });
    bl.forEach(function (b) { colL.appendChild(b); }); br.forEach(function (b) { colR.appendChild(b); });
    root.appendChild(h('div.match-board', {}, colL, colR));
    var out = h('div.mt-4'); root.appendChild(out);
    clearInterval(timer); timer = setInterval(function () { var s = Math.round((Date.now() - t0) / 1000); clock.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }, 500);
    function done() {
      clearInterval(timer);
      var secs = Math.round((Date.now() - t0) / 1000) + misses * 5, g = record('farmatch', secs, true);
      out.appendChild(CORB.ui.callout('ok', 'trophy', (g.newBest ? 'New best! ' : '') + secs + ' seconds', (misses ? 'Includes 5 extra seconds for each miss (' + CORB.util.plural(misses, 'miss', 'misses') + '). ' : 'No misses. ') + 'Your best: ' + g.best + ' seconds.'));
      out.appendChild(h('div.row.mt-3', {}, h('button.btn.primary', { type: 'button', onclick: function () { CORB.render(); } }, icon('refresh'), 'Play again'), h('a.btn', { href: '#/cards?deck=far-exam' }, icon('cards'), 'Flashcards for these titles')));
    }
  }

  // ---- generic multiple choice round (Which phase? and Threshold check) ----
  function mcRound(root, h, icon, id, title, intro, items, choicesFor) {
    var round = CORB.util.shuffle(items).slice(0, 10), i = 0, right = 0;
    root.appendChild(header(h, icon));
    root.appendChild(h('h1.g-title', {}, title)); root.appendChild(h('p.muted', {}, intro));
    var stage = h('div.card.raised.mt-3'); root.appendChild(stage);
    function show() {
      stage.innerHTML = '';
      if (i >= round.length) {
        var g = record(id, right);
        stage.appendChild(h('div.center', {}, CORB.ui.ring(CORB.util.pct(right, round.length), right + '/' + round.length, right / round.length >= 0.7 ? 'var(--ok)' : 'var(--accent-2)', 110),
          h('h2.mt-3', {}, right === round.length ? 'Perfect round' : right / round.length >= 0.7 ? 'Solid' : 'Keep at it'), h('p.muted', {}, 'Best: ' + g.best + ' of ' + round.length),
          h('div.row.mt-4', { style: { justifyContent: 'center' } }, h('button.btn.primary', { type: 'button', onclick: function () { CORB.render(); } }, icon('refresh'), 'Play again'), h('a.btn', { href: '#/games' }, 'Other games'))));
        return;
      }
      var it = round[i], choices = choicesFor(it), answered = false;
      stage.appendChild(h('div.row.between', {}, h('span.small.muted', {}, (i + 1) + ' of ' + round.length), h('span.small.muted', {}, right + ' right')));
      stage.appendChild(h('div.g-prompt', {}, it.prompt || it.task || it.scenario));
      var fb = h('div.mt-3');
      var btns = choices.map(function (c) {
        var b = h('button.opt', { type: 'button' }, c.dot ? h('span.phase-dot.ph-' + c.dot) : null, h('span', {}, c.label));
        b.addEventListener('click', function () {
          if (answered) return; answered = true; var ok = c.value === it.answer; if (ok) right++;
          btns.forEach(function (x, xi) { x.disabled = true; if (choices[xi].value === it.answer) x.classList.add('right'); }); if (!ok) b.classList.add('wrong');
          fb.appendChild(CORB.ui.callout(ok ? 'ok' : 'warn', ok ? 'check' : 'info', ok ? 'Right.' : 'Not quite.', CORB.ui.rich(it.why + (it.cite ? '\nCite: ' + it.cite : ''))));
          fb.appendChild(h('button.btn.primary.mt-3', { type: 'button', onclick: function () { i++; show(); } }, i + 1 < round.length ? 'Next' : 'See score', icon('arrow-right')));
        });
        return b;
      });
      stage.appendChild(h('div.opts', {}, btns)); stage.appendChild(fb);
    }
    show();
  }

  // ---- Who carries the risk? ----
  function risk(root, h, icon) {
    var G = (CORB.DATA.games || {}).risk_order || [];
    var order = G.slice(), shuffled = CORB.util.shuffle(G), next = 0, misses = 0;
    root.appendChild(header(h, icon)); root.appendChild(h('h1.g-title', {}, 'Who carries the risk?'));
    root.appendChild(h('p.muted', {}, 'Tap the contract types in order: first the one where the contractor carries the most cost risk, last the one where the Government carries the most.'));
    var placed = h('ol.risk-placed'), pool = h('div.risk-pool'), out = h('div.mt-4');
    root.appendChild(h('div.risk-scale', {}, h('span', {}, 'Contractor carries the risk'), h('span', {}, 'Government carries the risk')));
    root.appendChild(placed); root.appendChild(pool); root.appendChild(out);
    shuffled.forEach(function (c) {
      var b = h('button.chip.risk-chip', { type: 'button' }, c.label);
      b.addEventListener('click', function () {
        if (c.label === order[next].label) { b.remove(); placed.appendChild(h('li', {}, h('b', {}, c.label), h('span.small.muted', {}, c.why))); next++; if (next === order.length) finishRisk(); }
        else { misses++; b.classList.add('bad'); setTimeout(function () { b.classList.remove('bad'); }, 400); }
      });
      pool.appendChild(b);
    });
    function finishRisk() {
      var g = record('risk', misses, true);
      out.appendChild(CORB.ui.callout(misses ? 'info' : 'ok', 'trophy', misses ? 'Done with ' + CORB.util.plural(misses, 'miss', 'misses') : 'Perfect order', 'Fixed-price types put cost risk on the contractor; cost-reimbursement types put it on the Government. Time-and-materials gives the contractor no incentive to control cost, so the Government must watch it closely. Cite: FAR 16.101, 16.601.'));
      out.appendChild(h('div.row.mt-3', {}, h('button.btn.primary', { type: 'button', onclick: function () { CORB.render(); } }, icon('refresh'), 'Play again'), h('a.btn', { href: '#/lesson?id=' + ((CORB.DATA.games || {}).risk_lesson || 'L15') }, icon('book'), 'Contract types lesson')));
      if (g.newBest && g.plays > 1) CORB.ui.toast('New best', 'ok');
    }
  }

  CORB.registerView({ id: 'games', mobileAs: 'quiz', title: 'Games', section: 'Practice', icon: 'gamepad', nav: true, order: 90,
    blurb: 'Quick games for FAR titles, phases, thresholds and risk', keywords: 'game match FAR part titles phase sort thresholds contract type risk',
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon, G = CORB.DATA.games || {}, id = ctx.params.game;
      clearInterval(timer);
      if (id === 'farmatch') { farmatch(root, h, icon); return; }
      if (id === 'phase') {
        var ph = CORB.data.phases();
        mcRound(root, h, icon, 'phase', 'Which phase?', 'Which part of the contract life cycle does this task belong to?', G.phase_sort || [], function () { return ph.map(function (p) { return { label: p.name, value: p.id, dot: p.id }; }); });
        return;
      }
      if (id === 'threshold') { mcRound(root, h, icon, 'threshold', 'Threshold check', 'Pick the rule that applies. Dollar values are the ones in force for DoW in ' + new Date().getFullYear() + '; they are checked in FAR & key numbers.', G.threshold || [], function (it) { return CORB.util.shuffle(it.choices.map(function (c) { return { label: c, value: c }; })); }); return; }
      if (id === 'risk') { risk(root, h, icon); return; }
      root.appendChild(CORB.ui.pageHead({ title: 'Games', lede: 'Five-minute games that make the hard-to-memorize parts stick. Play them on a phone while you wait.' }));
      root.appendChild(h('div.grid.cols-2', {}, GAMES.map(function (g) {
        var b = best(g.id);
        var bestTxt = b.best == null ? 'Not played yet' : g.id === 'farmatch' ? 'Best: ' + b.best + ' s' : g.id === 'risk' ? 'Best: ' + b.best + ' misses' : 'Best: ' + b.best + ' of 10';
        return h('a.card.lift.game-tile', { href: '#/games?game=' + g.id }, h('div.game-icon', {}, icon(g.icon)), h('b', {}, g.title), h('span.small.muted', {}, g.sub), h('span.tiny.game-best', {}, bestTxt));
      })));
    },
    onLeave: function () { clearInterval(timer); } });
})();
