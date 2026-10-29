/* ARCADE-05-CAMPAIGN — "Your first year as a 51C": a campaign of chapters, one a month, briefed by the Master Gunner.
   Each chapter is three short missions across the games with the questions that month would really throw at you: a
   range table on the month's terms, a convoy stop on its lessons and a boss fight against one of the four things that end
   careers (the Unauthorized Commitment, the Bid Bust, the Audit, the Protest). Chapters 1 to 4 follow the four exam areas
   in the order of the 6-month exam path; 5 to 12 come in a later update. Progress is saved with the rest of the Arcade's
   (progress.arcade.campaign). The shell draws the lobby section and the results card from here. */
(function () {
  'use strict';
  var A = window.ARCADE; if (!A) return;
  var C = A.campaign = {};
  function L(a, b) { var out = []; for (var i = a; i <= b; i++) out.push('L' + (i < 10 ? '0' : '') + i); return out; }
  C.CHAPTERS = [
    { id: 'ch1', n: 1, month: 'Month 1', title: 'Foundation', sub: 'The rules of the road', phase: 'gp', color: '#a3a9f2', icon: '1.0',
      brief: 'Welcome to the shop. Month one is the rules of the road: who can bind the Government, how the FAR is built, what makes a contract, the money rules, ethics and the file. Nothing in this job works without them. Three missions: a table on the range, a stop at the Ops Center, and a boss who promised work he had no authority to promise.',
      clear: 'Chapter one is in the file. You know who signs and why it matters. Next month we buy something.',
      missions: [
        { id: 'm1', game: 'range-day', title: 'Terms of the trade', what: 'A ten-target table on the words of month one: roles, the regulations, ethics, money and your career.', pass: 6, of: 10, unit: 'hits', opts: { cats: ['Roles', 'Regulations', 'Ethics', 'Money', 'Training and career'], exposures: 10 } },
        { id: 'm2', game: 'supply-line', title: 'Ops Center', what: 'Six crates at CP1 on the Guiding Principles: authority, the contract, the money rules, ethics and the file.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'gp', lessons: L(1, 8).concat(['L35']) } },
        { id: 'm3', game: 'contract-quest', title: 'The Unauthorized Commitment', what: 'A boss fight. It feeds on promises made without a warrant: authority, what makes a contract, the money rules and the file.', pass: 1, of: 1, unit: 'boss', opts: { boss: 'uc', lessons: ['L02', 'L04', 'L05', 'L07', 'L08'] } }
      ] },
    { id: 'ch2', n: 2, month: 'Month 2', title: 'Pre-award', sub: 'Your first requirement', phase: 'pre', color: '#82b6ef', icon: '2.0',
      brief: 'The S4 needs generators, water and parts. Month two is everything before award: describing the need, market research, required sources, small business, competition, contract types, how to buy and how to publicize. Missions: the range on planning and competition terms, Market Square, and the Bid Bust, who lives on vague requirements and botched solicitations.',
      clear: 'A clear requirement, real competition and the right contract type. That is the heart of this job, and you just ran it.',
      missions: [
        { id: 'm1', game: 'range-day', title: 'Words before award', what: 'A ten-target table on planning, small business, competition and contract-type terms.', pass: 6, of: 10, unit: 'hits', opts: { cats: ['Planning', 'Small business', 'Competition', 'Contract types'], exposures: 10 } },
        { id: 'm2', game: 'supply-line', title: 'Market Square', what: 'Six crates at CP2 on pre-award: the requirement, market research, sources, competition, types and publicizing.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'pre', lessons: L(9, 19) } },
        { id: 'm3', game: 'contract-quest', title: 'The Bid Bust', what: 'A boss fight. It feeds on competition done wrong: sole-source without a justification, the wrong method, a solicitation nobody could answer.', pass: 1, of: 1, unit: 'boss', opts: { boss: 'bust', lessons: ['L13', 'L16', 'L18', 'L17', 'L12'] } }
      ] },
    { id: 'ch3', n: 3, month: 'Month 3', title: 'Post-award, then pricing', sub: 'Running the contract', phase: 'post', color: '#6fd3d9', icon: '4.0',
      brief: 'The contract is signed and the real work starts: administration, quality, subcontracts, changes, disputes, terminations and closeout, then a first look at price and cost analysis. Missions: the range on administration and disputes terms, the Supply Depot, and the Audit, who reads every invoice and every file.',
      clear: 'The file is clean, every change is signed by a CO and the invoices match the work. An audit holds no fear for you.',
      missions: [
        { id: 'm1', game: 'range-day', title: 'Words after award', what: 'A ten-target table on administration, changes and disputes, pricing and the systems.', pass: 6, of: 10, unit: 'hits', opts: { cats: ['Administration', 'Changes and disputes', 'Pricing', 'Systems'], exposures: 10 } },
        { id: 'm2', game: 'supply-line', title: 'Supply Depot', what: 'Six crates at CP4 on post-award: administration, quality, subcontracts, changes, disputes, terminations and closeout.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'post', lessons: L(26, 32) } },
        { id: 'm3', game: 'contract-quest', title: 'The Audit', what: 'A boss fight. It feeds on files that do not match the work: quality, changes without a CO, claims, closeout and cost data.', pass: 1, of: 1, unit: 'boss', opts: { boss: 'audit', lessons: ['L26', 'L27', 'L29', 'L30', 'L32', 'L21', 'L20'] } }
      ] },
    { id: 'ch4', n: 4, month: 'Month 4', title: 'Award', sub: 'Choosing the winner', phase: 'awd', color: '#f0b863', icon: '3.0',
      brief: 'Three offers are in. Month four is award: price and cost analysis, negotiation, source selection, the award itself, notices, debriefings and protests. Missions: the range on award terms, River Bridge, and the Protest, who feeds on an evaluation nobody wrote down.',
      clear: 'Documented, debriefed, defended. Four months in and you have run the whole life cycle. Chapters five to twelve are on the way.',
      missions: [
        { id: 'm1', game: 'range-day', title: 'Words of award', what: 'A ten-target table on award, pricing and competition terms.', pass: 6, of: 10, unit: 'hits', opts: { cats: ['Award', 'Pricing', 'Competition'], exposures: 10 } },
        { id: 'm2', game: 'supply-line', title: 'River Bridge', what: 'Six crates at CP3 on award: price and cost analysis, negotiation, source selection, notices, debriefings and protests.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'awd', lessons: L(20, 25) } },
        { id: 'm3', game: 'contract-quest', title: 'The Protest', what: 'A boss fight. It feeds on source selections nobody documented: evaluation, award notices, debriefings and the protest clock.', pass: 1, of: 1, unit: 'boss', opts: { boss: 'protest', lessons: ['L23', 'L24', 'L25', 'L22'] } }
      ] }
  ];
  C.LOCKED = { title: 'Chapters 5 to 12', text: 'The exam, contingency contracting, the systems you will use and the rest of your first year. Coming in a later update.' };
  C.GAME = { 'range-day': { icon: '🎯', name: 'Range Day' }, 'supply-line': { icon: '🚚', name: 'Supply Line' }, 'contract-quest': { icon: '⚔️', name: 'Contract Quest' } };

  function today() { return new Date().toISOString().slice(0, 10); }
  function all() { var p = A.save.get('campaign', {}); return p && typeof p === 'object' ? p : {}; }
  C.byId = function (id) { return C.CHAPTERS.filter(function (c) { return c.id === id; })[0] || null; };
  C.byN = function (n) { return C.CHAPTERS.filter(function (c) { return c.n === +n; })[0] || null; };
  C.record = function (ch) { return all()[ch.id] || {}; };
  C.missionRec = function (ch, m) { return C.record(ch)[m.id] || null; };
  C.cleared = function (ch) { return !!C.record(ch).cleared; };
  C.unlocked = function (ch) { var i = C.CHAPTERS.indexOf(ch); return i <= 0 || C.cleared(C.CHAPTERS[i - 1]); };
  C.passedCount = function (ch) { return ch.missions.filter(function (m) { var r = C.missionRec(ch, m); return r && r.passed; }).length; };
  C.nextMission = function (ch) { return ch.missions.filter(function (m) { var r = C.missionRec(ch, m); return !(r && r.passed); })[0] || null; };
  C.current = function () { for (var i = 0; i < C.CHAPTERS.length; i++) if (!C.cleared(C.CHAPTERS[i])) return C.CHAPTERS[i]; return C.CHAPTERS[C.CHAPTERS.length - 1]; };
  C.sel = null;
  C.opts = function (ch, m) {
    var o = {}; Object.keys(m.opts || {}).forEach(function (k) { o[k] = m.opts[k]; });
    o.campaign = { ch: ch.id, m: m.id, n: ch.n, k: ch.missions.indexOf(m) + 1, title: 'Chapter ' + ch.n + ' · ' + m.title, pass: m.pass, of: m.of, unit: m.unit, color: ch.color };
    return o;
  };
  C.start = function (ch, m) { if (A.start) A.start(m.game, C.opts(ch, m)); };
  function passText(m) { return m.unit === 'boss' ? 'Pass: bring the boss down' : 'Pass: ' + m.pass + ' of ' + m.of + ' ' + m.unit; }

  // the shell calls this when a campaign run ends (o.campaign = { value, of } from the game); returns what the card shows
  C.onRunEnd = function (state, won, o) {
    var cp = state.opts && state.opts.campaign, ch = cp && C.byId(cp.ch), m = ch && ch.missions.filter(function (x) { return x.id === cp.m; })[0];
    if (!ch || !m) return null;
    var v = o && o.campaign && o.campaign.value != null ? o.campaign.value : (won ? m.pass : 0), passed = v >= m.pass;
    var p = all(), rec = p[ch.id] = p[ch.id] || {}, mr = rec[m.id] = rec[m.id] || { best: 0, plays: 0, passed: false };
    mr.plays = (mr.plays || 0) + 1; mr.best = Math.max(mr.best || 0, v); mr.last = v; mr.at = today(); if (passed) mr.passed = true;
    var clearedNow = false;
    if (!rec.cleared && ch.missions.every(function (x) { return rec[x.id] && rec[x.id].passed; })) { rec.cleared = today(); clearedNow = true; }
    A.save.set('campaign', p);
    var xp = 0; if (clearedNow) { xp = 150; A.addXp(xp); }
    var nextCh = clearedNow ? C.CHAPTERS[C.CHAPTERS.indexOf(ch) + 1] || null : null;
    return { ch: ch, m: m, value: v, passed: passed, clearedNow: clearedNow, xp: xp, next: C.nextMission(ch), nextCh: nextCh, cleared: !!rec.cleared };
  };
  function portrait(size, mood, anim) {
    var cv = A.h('canvas.ar-mentor-cv', { width: String(size), height: String(size), 'aria-hidden': 'true' });
    var ctx = cv.getContext('2d'), t0 = performance.now();
    function paint(t) { A.mentor.draw(ctx, size, mood, t); }
    paint(0);
    if (anim) anim.push({ cv: cv, def: { thumb: function (c, w, hh, t) { A.mentor.draw(ctx, size, mood, t); } } });
    else if (!A.feel || !A.feel.reduce()) { (function loop() { if (!cv.isConnected && performance.now() - t0 > 3000) return; paint((performance.now() - t0) / 1000); requestAnimationFrame(loop); })(); }
    return cv;
  }
  // the card on the results screen
  C.card = function (state) {
    var r = state.campaignResult, h = A.h; if (!r) return null;
    var cp = state.opts.campaign, mood = r.clearedNow ? 'proud' : r.passed ? 'pleased' : 'hint';
    var line = r.clearedNow ? r.ch.clear : r.passed ? A.mentor.line('pleased') + ' Mission ' + cp.k + ' of 3 is in the file.' : (r.m.unit === 'boss' ? 'The boss is still standing. Study the misses below and go again.' : 'You landed ' + r.value + ' of ' + r.m.of + ' ' + r.m.unit + '; the mission takes ' + r.m.pass + '. Study the misses below and go again.');
    var actions = [];
    if (r.clearedNow && r.nextCh) actions.push(h('button.ar-btn.gold', { type: 'button', onclick: function () { C.sel = r.nextCh; A.lobby('campaign'); } }, 'Chapter ' + r.nextCh.n + ': ' + r.nextCh.title + ' ▶'));
    else if (r.passed && r.next) actions.push(h('button.ar-btn.gold', { type: 'button', onclick: function () { C.start(r.ch, r.next); } }, 'Next mission: ' + r.next.title + ' ▶'));
    else if (!r.passed) actions.push(h('button.ar-btn.gold', { type: 'button', onclick: function () { C.start(r.ch, r.m); } }, '↻ Try the mission again'));
    actions.push(h('button.ar-btn', { type: 'button', onclick: function () { C.sel = r.ch; A.lobby('campaign'); } }, 'Campaign'));
    return h('div.ar-camp-card' + (r.clearedNow ? '.cleared' : r.passed ? '.passed' : '.failed'), { style: { '--cc': r.ch.color } },
      portrait(72, mood, null),
      h('div.ar-camp-card-copy', {},
        h('div.ar-kicker', {}, h('i'), 'Campaign · Chapter ' + r.ch.n + ' · Mission ' + cp.k + ' of 3'),
        h('b', {}, r.clearedNow ? 'Chapter ' + r.ch.n + ' cleared: ' + r.ch.title : r.passed ? 'Mission complete: ' + r.m.title : 'Not yet: ' + r.m.title),
        h('p', {}, line),
        r.clearedNow ? h('small', {}, '+' + r.xp + ' XP chapter bonus') : h('small', {}, passText(r.m) + (r.m.unit !== 'boss' ? ' · this run: ' + r.value : '')),
        h('div.ar-row', {}, actions)));
  };
  // the lobby section: the Master Gunner's brief, the chapter strip and the three missions of the selected chapter
  C.section = function (anim) {
    var h = A.h, wrap = h('section.ar-camp', { id: 'ar-camp' });
    if (!C.sel || !C.unlocked(C.sel)) C.sel = C.current();
    function render() {
      wrap.innerHTML = '';
      var ch = C.sel, done = C.passedCount(ch), cleared = C.cleared(ch), next = C.nextMission(ch);
      wrap.style.setProperty('--cc', ch.color);
      wrap.appendChild(h('div.ar-camp-head', {}, h('div.ar-kicker', {}, h('i'), 'Campaign'), h('h2', {}, 'Your first year as a 51C'),
        h('p', {}, 'Twelve chapters, one a month, briefed by your Master Gunner. Four are open. Each is three short missions across the games with the questions that month would throw at you; pass all three to open the next chapter.')));
      var strip = h('div.ar-chapters', { role: 'tablist', 'aria-label': 'Chapters' });
      C.CHAPTERS.forEach(function (c) {
        var un = C.unlocked(c), cl = C.cleared(c), on = c === ch;
        strip.appendChild(h('button.ar-chapter' + (on ? '.on' : '') + (cl ? '.cleared' : '') + (un ? '' : '.locked'), { type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false', disabled: !un, style: { '--cc': c.color }, title: un ? c.month + ': ' + c.title : 'Clear chapter ' + (c.n - 1) + ' first', onclick: function () { C.sel = c; render(); } },
          h('span.n', {}, cl ? '✓' : un ? String(c.n) : '🔒'), h('span.t', {}, h('b', {}, c.month), h('small', {}, c.title))));
      });
      strip.appendChild(h('div.ar-chapter.locked.more', { title: C.LOCKED.text }, h('span.n', {}, '🔒'), h('span.t', {}, h('b', {}, '5 to 12'), h('small', {}, 'Later update'))));
      var mentor = h('div.ar-camp-mentor', {}, portrait(112, cleared ? 'proud' : 'brief', anim),
        h('div.ar-camp-bubble', {}, h('b', {}, A.mentor.name), h('small', {}, A.mentor.title), h('p', {}, cleared ? ch.clear : ch.brief)));
      var list = h('div.ar-missions');
      ch.missions.forEach(function (m, i) {
        var r = C.missionRec(ch, m), g = C.GAME[m.game] || { icon: '🎮', name: m.game }, ok = !!(r && r.passed), isNext = m === next, def = A.games[m.game], can = def && (!def.dataOk || def.dataOk(A.DATA));
        var status = ok ? 'Passed' + (m.unit !== 'boss' ? ' · best ' + r.best + ' of ' + m.of : '') : r ? 'Best ' + r.best + ' of ' + m.of + ' · ' + passText(m).replace('Pass: ', 'needs ') : passText(m);
        list.appendChild(h('button.ar-mission' + (ok ? '.ok' : '') + (isNext ? '.next' : ''), { type: 'button', disabled: !can, onclick: function () { C.start(ch, m); } },
          h('span.ar-mission-n', {}, ok ? '✓' : String(i + 1)),
          h('span.ar-mission-copy', {}, h('b', {}, g.icon + ' ' + g.name + ' · ' + m.title), h('span', {}, m.what), h('small', {}, can ? status : 'Not available on this device')),
          h('span.ar-mission-go', {}, ok ? 'Again ↻' : isNext ? 'Play ▶' : 'Play')));
      });
      wrap.appendChild(h('div.ar-camp-grid', {}, mentor, h('div.ar-camp-body', {}, strip, h('div.ar-camp-sub', {}, h('b', {}, 'Chapter ' + ch.n + ' · ' + ch.title + ': ' + ch.sub), h('span', {}, cleared ? 'Cleared. Play any mission again for a better score.' : done + ' of 3 missions passed.')), list)));
    }
    render();
    return wrap;
  };
})();
