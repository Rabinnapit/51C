/* ARCADE-05-CAMPAIGN — "Your first year as a 51C": twelve chapters, one a month, briefed by the Master Gunner. Each
   chapter is three short missions across the games with the questions that month would really throw at you. Chapters 1
   to 4 follow the four exam areas in the order of the 6-month exam path (a range table, a convoy stop, a boss fight);
   5 and 6 are the review and the exam; 7 to 12 are the rest of the first year on the job (contingency, the systems, price
   and cost, sources and small business, changes and closeout, and the whole life cycle in one sitting), spread over every
   game. Progress is saved with the rest of the Arcade's (progress.arcade.campaign). The shell draws the lobby section and
   the results card from here. */
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
      ] },
    { id: 'ch5', n: 5, month: 'Month 5', title: 'Review', sub: 'Close the gaps', phase: 'mix', color: '#e6b85a', icon: '✔',
      brief: 'Your class practice exam is marked and the RFO changes are fresh in your head. Month five is review: the key numbers, the deadlines, where every task sits in the life cycle and which dollar lane a buy falls in. Missions: Fire Mission on the numbers and deadlines, Dispatch on the life cycle and the dollar lanes, and the Gatekeeper at the Exam Citadel, who asks from every area at once.',
      clear: 'The gaps are closed. Numbers, deadlines, the life cycle and the lanes: you answer them without thinking now, which is the point.',
      missions: [
        { id: 'm1', game: 'fire-mission', title: 'Numbers and deadlines', what: 'Eight fire missions on the dollar thresholds and the time limits.', pass: 5, of: 8, unit: 'targets', opts: { fams: ['dollars', 'days'], missions: 8 } },
        { id: 'm2', game: 'sort-yard', title: 'Life cycle and lanes', what: 'Two shifts at the yard: which phase a task belongs to, and which buying lane a purchase falls in.', pass: 9, of: 12, unit: 'crates', opts: { lines: ['phase', 'dollars'], crates: 6 } },
        { id: 'm3', game: 'contract-quest', title: 'The Gatekeeper', what: 'A boss fight at the Exam Citadel. It asks from every area, and hides a NOT in half its questions.', pass: 1, of: 1, unit: 'boss', opts: { boss: 'gate' } }
      ] },
    { id: 'ch6', n: 6, month: 'Month 6', title: 'Test-ready', sub: 'Exam week', phase: 'mix', color: '#f6d991', icon: '★',
      brief: 'Exam week. 150 questions, three hours, 70 percent to pass, closed book. Month six is the full rehearsal with every area in play. Missions: Part Patrol on the FAR part titles, the UCF and the PIID, a twenty-target table across the whole glossary, and the FOB Gate, where every area is asked at once.',
      clear: 'Certified. That is the first year\'s biggest day, and you earned it. Now the real work starts.',
      missions: [
        { id: 'm1', game: 'part-patrol', title: 'Parts, sections and letters', what: 'One sector: three carriers to shoot down (FAR parts, UCF sections, PIID letters) and the Audit Dreadnought.', pass: 4, of: 5, unit: 'hits', opts: { fams: ['part', 'ucf', 'piid'], sectors: 1 } },
        { id: 'm2', game: 'range-day', title: 'The full table', what: 'A twenty-target table across every glossary term: the qualification standard.', pass: 12, of: 20, unit: 'hits', opts: { exposures: 20 } },
        { id: 'm3', game: 'supply-line', title: 'FOB Gate', what: 'Six crates at CP5 with questions from all four exam areas, at night.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'all' } }
      ] },
    { id: 'ch7', n: 7, month: 'Month 7', title: 'Downrange', sub: 'Contingency contracting', phase: 'job', color: '#d1bfa6', icon: '7',
      brief: 'Certified, and now the unit deploys. Month seven is contingency contracting: the raised thresholds, the field ordering officer and the SF 44, the contingency contracting officer, SPOT, and the rules that change when the shooting starts. Missions: the range on contingency terms, Fire Mission on the thresholds and the forms, and the FOB Gate with the deployed rules in play.',
      clear: 'You know what changes downrange and what never does: the authority still has to be in writing, and the file still has to be kept.',
      missions: [
        { id: 'm1', game: 'range-day', title: 'Words from downrange', what: 'A ten-target table on contingency and roles terms.', pass: 6, of: 10, unit: 'hits', opts: { cats: ['Contingency', 'Roles'], exposures: 10 } },
        { id: 'm2', game: 'fire-mission', title: 'Thresholds and forms', what: 'Eight fire missions on the dollar thresholds, contingency ones included, and the forms.', pass: 5, of: 8, unit: 'targets', opts: { fams: ['dollars', 'form'], missions: 8 } },
        { id: 'm3', game: 'supply-line', title: 'FOB Gate, deployed', what: 'Six crates at CP5 on contingency contracting, buying methods, the money rules and authority.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'all', lessons: ['L33', 'L16', 'L05', 'L02'] } }
      ] },
    { id: 'ch8', n: 8, month: 'Month 8', title: 'The systems', sub: 'What you log into', phase: 'job', color: '#8cc8ff', icon: '8',
      brief: 'Month eight is the systems: SAM, PIEE and WAWF, FPDS, CPARS, EDA, GFEBS, the GPE and the rest. Every one has an acronym and a job, and every one asks for a role you had to request. Missions: the range on the systems terms, Part Patrol on PIID letters and UCF sections, and Dispatch on the Uniform Contract Format.',
      clear: 'Every system has a name and a job in your head now. The PIID tells you the instrument, the UCF tells you where to look.',
      missions: [
        { id: 'm1', game: 'range-day', title: 'The systems', what: 'A ten-target table on the systems terms.', pass: 6, of: 10, unit: 'hits', opts: { cats: ['Systems', 'Administration'], exposures: 10 } },
        { id: 'm2', game: 'part-patrol', title: 'Letters and sections', what: 'One sector on PIID letters and UCF sections, then the Audit Dreadnought.', pass: 4, of: 5, unit: 'hits', opts: { fams: ['piid', 'ucf'], sectors: 1 } },
        { id: 'm3', game: 'sort-yard', title: 'The UCF', what: 'One shift at the yard: which part of the Uniform Contract Format each section sits in.', pass: 5, of: 7, unit: 'crates', opts: { lines: ['ucf'], crates: 7 } }
      ] },
    { id: 'ch9', n: 9, month: 'Month 9', title: 'Price and cost', sub: 'The numbers behind the price', phase: 'awd', color: '#f0b863', icon: '9',
      brief: 'Month nine goes back to the money with sharper tools: price analysis, cost analysis, certified cost or pricing data and the TINA threshold, indirect costs, and a fair and reasonable price you can defend. Missions: the range on pricing and money terms, Fire Mission on the dollar thresholds and contract types, and the Audit, who knows every number.',
      clear: 'Price analysis compares prices; cost analysis looks inside them. You know which one the regulation wants, and when certified data is required.',
      missions: [
        { id: 'm1', game: 'range-day', title: 'Pricing words', what: 'A ten-target table on pricing, money and contract-type terms.', pass: 6, of: 10, unit: 'hits', opts: { cats: ['Pricing', 'Money', 'Contract types'], exposures: 10 } },
        { id: 'm2', game: 'fire-mission', title: 'Thresholds and types', what: 'Eight fire missions on the dollar thresholds and the contract types.', pass: 5, of: 8, unit: 'targets', opts: { fams: ['dollars', 'type'], missions: 8 } },
        { id: 'm3', game: 'contract-quest', title: 'The Audit, again', what: 'A boss fight on price and cost analysis, contract types and the money rules.', pass: 1, of: 1, unit: 'boss', opts: { boss: 'audit', lessons: ['L20', 'L21', 'L15', 'L05'] } }
      ] },
    { id: 'ch10', n: 10, month: 'Month 10', title: 'Sources', sub: 'Small business and required sources', phase: 'pre', color: '#82b6ef', icon: '10',
      brief: 'Month ten is who you buy from: the required sources, AbilityOne and Federal Prison Industries, the small business programs, set-asides and the rule of two, and the Federal Supply Schedules. Missions: the range on small business and planning terms, Market Square on sources and competition, and Part Patrol on the FAR parts.',
      clear: 'You check the required sources first, you know when a set-aside is required, and you can name the FAR part for each of them.',
      missions: [
        { id: 'm1', game: 'range-day', title: 'Sources and set-asides', what: 'A ten-target table on small business, planning and competition terms.', pass: 6, of: 10, unit: 'hits', opts: { cats: ['Small business', 'Planning', 'Competition'], exposures: 10 } },
        { id: 'm2', game: 'supply-line', title: 'Market Square, sources', what: 'Six crates at CP2 on market research, required sources, small business, competition and commercial buys.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'pre', lessons: ['L10', 'L11', 'L12', 'L13', 'L17'] } },
        { id: 'm3', game: 'part-patrol', title: 'The FAR parts', what: 'One sector on the FAR part titles, then the Audit Dreadnought.', pass: 4, of: 5, unit: 'hits', opts: { fams: ['part'], sectors: 1 } }
      ] },
    { id: 'ch11', n: 11, month: 'Month 11', title: 'Changes and closeout', sub: 'The end of the contract', phase: 'post', color: '#6fd3d9', icon: '11',
      brief: 'Month eleven is the end of the contract: changes only a contracting officer can sign, constructive changes, requests for equitable adjustment and claims, the deadlines that run in days and years, terminations and closeout. Missions: the range on changes and disputes terms, Fire Mission on the deadlines and the forms, and the Supply Depot on post-award.',
      clear: 'Every change signed by a CO, every claim answered on time, every file closed on schedule. That is how a contract ends well.',
      missions: [
        { id: 'm1', game: 'range-day', title: 'Changes and claims', what: 'A ten-target table on changes, disputes and administration terms.', pass: 6, of: 10, unit: 'hits', opts: { cats: ['Changes and disputes', 'Administration'], exposures: 10 } },
        { id: 'm2', game: 'fire-mission', title: 'Deadlines and forms', what: 'Eight fire missions on the time limits and the forms.', pass: 5, of: 8, unit: 'targets', opts: { fams: ['days', 'form'], missions: 8 } },
        { id: 'm3', game: 'supply-line', title: 'Supply Depot, the end of the contract', what: 'Six crates at CP4 on changes, disputes, terminations, closeout and administration.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'post', lessons: ['L29', 'L30', 'L31', 'L32', 'L26'] } }
      ] },
    { id: 'ch12', n: 12, month: 'Month 12', title: 'The whole life cycle', sub: 'One year in', phase: 'mix', color: '#3fbf8a', icon: '12',
      brief: 'A year in. Month twelve runs the whole life cycle in one sitting: the full convoy from the Ops Center to the FOB, a twenty-target table on every term, and the Exam Citadel with everything you have. Missions: Supply Line, the full mission; Range Day, twenty targets; the Citadel, two monsters and the Gatekeeper.',
      clear: 'Twelve months, every chapter cleared. You ran the whole life cycle on the road and in the file. Welcome to the shop: you are no longer the new one.',
      missions: [
        { id: 'm1', game: 'supply-line', title: 'The full mission', what: 'All five checkpoints, Ops Center to FOB Gate, thirty crates.', pass: 20, of: 30, unit: 'crates', opts: { mission: 'full' } },
        { id: 'm2', game: 'range-day', title: 'Twenty targets', what: 'A full twenty-target table across every glossary term.', pass: 12, of: 20, unit: 'hits', opts: { exposures: 20 } },
        { id: 'm3', game: 'contract-quest', title: 'The Exam Citadel', what: 'The whole realm: the Distractor Drone, the Trick-Question Troll and the Gatekeeper, questions from every area.', pass: 1, of: 1, unit: 'boss', opts: { realm: 'all' } }
      ] }
  ];
  C.GAME = { 'range-day': { icon: '🎯', name: 'Range Day' }, 'supply-line': { icon: '🚚', name: 'Supply Line' }, 'contract-quest': { icon: '⚔️', name: 'Contract Quest' }, 'fire-mission': { icon: '💥', name: 'Fire Mission' }, 'part-patrol': { icon: '🚀', name: 'Part Patrol' }, 'sort-yard': { icon: '📦', name: 'Dispatch' } };

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
  function passText(m) { return m.unit === 'boss' ? (m.opts && m.opts.realm ? 'Pass: clear the realm' : 'Pass: bring the boss down') : 'Pass: ' + m.pass + ' of ' + m.of + ' ' + m.unit; }

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
        h('p', {}, 'Twelve chapters, one a month, briefed by your Master Gunner: the four exam areas, the review and the exam, then the first year on the job. Each is three short missions across the games with the questions that month would throw at you; pass all three to open the next chapter.')));
      var strip = h('div.ar-chapters', { role: 'tablist', 'aria-label': 'Chapters' });
      C.CHAPTERS.forEach(function (c) {
        var un = C.unlocked(c), cl = C.cleared(c), on = c === ch;
        strip.appendChild(h('button.ar-chapter' + (on ? '.on' : '') + (cl ? '.cleared' : '') + (un ? '' : '.locked'), { type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false', disabled: !un, style: { '--cc': c.color }, title: un ? c.month + ': ' + c.title : 'Clear chapter ' + (c.n - 1) + ' first', onclick: function () { C.sel = c; render(); } },
          h('span.n', {}, cl ? '✓' : un ? String(c.n) : '🔒'), h('span.t', {}, h('b', {}, c.month), h('small', {}, c.title))));
      });
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
