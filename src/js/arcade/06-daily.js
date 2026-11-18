/* ARCADE-06-DAILY — the come-back layer: the daily range card (three five-minute missions a day, a streak you can repair
   once a week), the weekly 40-target qualification table (every answer in any game fires one target; 23 of 40 Marksman,
   30 Sharpshooter, 36 Expert, the Army rifle standard) and the seasons (fiscal-year quarters, each with a range skin:
   desert, Korea winter, forest, high summer; cosmetics only). Everything lives in the reader's Arcade progress
   (progress.arcade.daily / table / skin). The shell draws the lobby sections and the results card from here; Home shows
   a summary through CORB.arcadeReady(). */
(function () {
  'use strict';
  var A = window.ARCADE; if (!A) return;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(key, n) { var p = key.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return dayKey(d); }
  function weekKey(d) { d = d || new Date(); var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), dow = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dow); var y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7); return y + '-W' + pad(w); }
  function seed(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(s) { s = s || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function fmtDay(key) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }

  // ---- seasons: fiscal-year quarters, each with a skin ----
  var season = A.season = {};
  season.SKINS = [
    { id: 'desert', name: 'Desert', sub: 'The qualification range as it is' },
    { id: 'winter', name: 'Korea winter', sub: 'Snow on the hills, a cold sky' },
    { id: 'forest', name: 'Forest', sub: 'Green slopes and more trees' },
    { id: 'summer', name: 'High summer', sub: 'Golden light and haze' }
  ];
  season.current = function (d) {
    d = d || new Date(); var m = d.getMonth(), fy = d.getFullYear() + (m >= 9 ? 1 : 0), q = m >= 9 ? 1 : m >= 6 ? 4 : m >= 3 ? 3 : 2;
    return { id: 'FY' + String(fy).slice(2) + 'Q' + q, name: 'FY' + String(fy).slice(2) + ' · Quarter ' + q, skin: ['desert', 'winter', 'forest', 'summer'][q - 1], months: ['October to December', 'January to March', 'April to June', 'July to September'][q - 1] };
  };
  season.chosen = function () { return A.save.get('skin', '') || ''; };
  season.skin = function () { var c = season.chosen(); return season.SKINS.some(function (s) { return s.id === c; }) ? c : season.current().skin; };
  season.setSkin = function (id) { A.save.set('skin', season.SKINS.some(function (s) { return s.id === id; }) ? id : '', true); };
  season.skinName = function (id) { var s = season.SKINS.filter(function (x) { return x.id === (id || season.skin()); })[0]; return s ? s.name : 'Desert'; };

  // ---- the daily range card ----
  var daily = A.daily = {};
  daily.POOL = [
    { id: 'range', game: 'range-day', title: 'Ten targets', what: 'A ten-target table on the glossary.', pass: 6, of: 10, unit: 'hits', opts: { exposures: 10 } },
    { id: 'range-roles', game: 'range-day', title: 'Roles and rules', what: 'Ten targets on roles, regulations and ethics terms.', pass: 6, of: 10, unit: 'hits', opts: { cats: ['Roles', 'Regulations', 'Ethics', 'Money'], exposures: 10 } },
    { id: 'range-award', game: 'range-day', title: 'Award and pricing', what: 'Ten targets on award, pricing and competition terms.', pass: 6, of: 10, unit: 'hits', opts: { cats: ['Award', 'Pricing', 'Competition', 'Contract types'], exposures: 10 } },
    { id: 'convoy-gp', game: 'supply-line', title: 'Ops Center', what: 'Six crates on the Guiding Principles.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'gp' } },
    { id: 'convoy-pre', game: 'supply-line', title: 'Market Square', what: 'Six crates on pre-award.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'pre' } },
    { id: 'convoy-awd', game: 'supply-line', title: 'River Bridge', what: 'Six crates on award.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'awd' } },
    { id: 'convoy-post', game: 'supply-line', title: 'Supply Depot', what: 'Six crates on post-award.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'post' } },
    { id: 'convoy-all', game: 'supply-line', title: 'FOB Gate', what: 'Six crates from every area, at night.', pass: 4, of: 6, unit: 'crates', opts: { realm: 'all' } },
    { id: 'fire', game: 'fire-mission', title: 'Six fire missions', what: 'Thresholds, deadlines, forms, approvals and types.', pass: 4, of: 6, unit: 'targets', opts: { missions: 6 } },
    { id: 'fire-money', game: 'fire-mission', title: 'Dollars and days', what: 'Six fire missions on thresholds and deadlines.', pass: 4, of: 6, unit: 'targets', opts: { fams: ['dollars', 'days'], missions: 6 } },
    { id: 'patrol', game: 'part-patrol', title: 'One sector', what: 'Three carriers and the Audit Dreadnought.', pass: 4, of: 5, unit: 'hits', opts: { sectors: 1 } },
    { id: 'dispatch-phase', game: 'sort-yard', title: 'Life-cycle shift', what: 'Seven crates: which phase does each task belong to?', pass: 5, of: 7, unit: 'crates', opts: { lines: ['phase'], crates: 7 } },
    { id: 'dispatch-dollars', game: 'sort-yard', title: 'Dollar-lane shift', what: 'Seven crates: which buying lane is each purchase in?', pass: 5, of: 7, unit: 'crates', opts: { lines: ['dollars'], crates: 7 } },
    { id: 'dispatch-types', game: 'sort-yard', title: 'Contract-type shift', what: 'Seven crates: which family is each contract type?', pass: 5, of: 7, unit: 'crates', opts: { lines: ['types'], crates: 7 } },
    { id: 'boss-uc', game: 'contract-quest', title: 'The Unauthorized Commitment', what: 'A boss fight on authority, the contract and the file.', pass: 1, of: 1, unit: 'boss', opts: { boss: 'uc' } },
    { id: 'boss-bust', game: 'contract-quest', title: 'The Bid Bust', what: 'A boss fight on competition and solicitations.', pass: 1, of: 1, unit: 'boss', opts: { boss: 'bust' } },
    { id: 'boss-audit', game: 'contract-quest', title: 'The Audit', what: 'A boss fight on administration, changes and cost.', pass: 1, of: 1, unit: 'boss', opts: { boss: 'audit' } },
    { id: 'boss-protest', game: 'contract-quest', title: 'The Protest', what: 'A boss fight on source selection and the protest clock.', pass: 1, of: 1, unit: 'boss', opts: { boss: 'protest' } }
  ];
  function all() { var d = A.save.get('daily', {}); return d && typeof d === 'object' ? d : {}; }
  function save(d) { var keys = Object.keys(d.days || {}).sort(); while (keys.length > 100) delete d.days[keys.shift()]; A.save.set('daily', d); }
  // a mission stays on the card on any device: Range Day's run as Qual Range, its 2D twin, where 3D cannot be drawn
  function available(m) { return A.runAs ? !!A.runAs(m.game) : !!A.games[m.game]; }
  // the three missions of a day: seeded by the date, three different games, only games this copy can run
  daily.missions = function (key) {
    key = key || dayKey(); var r = rng(seed(key)), pool = daily.POOL.filter(available), out = [], games = {};
    var order = pool.slice().sort(function (a, b) { return seed(key + a.id) - seed(key + b.id); });
    order.forEach(function (m) { if (out.length < 3 && !games[m.game]) { games[m.game] = 1; out.push(m); } });
    void r; return out;
  };
  daily.record = function (key) { var d = all(); return (d.days || {})[key || dayKey()] || { m: {}, closed: '' }; };
  daily.today = function () {
    var key = dayKey(), rec = daily.record(key), d = all(), ms = daily.missions(key).map(function (m) { var r = rec.m[m.id]; return { def: m, value: r ? r.value : null, passed: !!(r && r.passed), plays: r ? r.plays : 0 }; });
    return { key: key, label: fmtDay(key), missions: ms, done: ms.filter(function (x) { return x.passed; }).length, closed: !!rec.closed, streak: d.streak || 0, best: d.best || 0, repairAt: d.repairAt || '', lastClosed: d.lastClosed || '', next: ms.filter(function (x) { return !x.passed; })[0] || null };
  };
  daily.opts = function (m) {
    var o = {}; Object.keys(m.opts || {}).forEach(function (k) { o[k] = m.opts[k]; });
    o.daily = { date: dayKey(), id: m.id, title: 'Range card · ' + m.title, pass: m.pass, of: m.of, unit: m.unit };
    return o;
  };
  daily.start = function (m) {
    if (!daily.missions().some(function (x) { return x.id === m.id; })) { if (A.lobby) A.lobby('daily'); return; }   // a new day: today's card instead
    if (A.start) A.start((A.runAs && A.runAs(m.game)) || m.game, daily.opts(m));
  };
  function repairFree(d, today) { return !d.repairAt || addDays(d.repairAt, 7) <= today; }
  // called by the shell when a range-card run ends; closes the card and moves the streak when all three are passed
  daily.onRunEnd = function (state, won, o) {
    var dp = state.opts && state.opts.daily, m = dp && daily.POOL.filter(function (x) { return x.id === dp.id; })[0];
    if (!m) return null;
    var today = dayKey(), stale = dp.date !== today;
    var v = o && o.campaign && o.campaign.value != null ? o.campaign.value : (won ? m.pass : 0), passed = v >= m.pass;
    var d = all(); d.days = d.days || {}; var rec = d.days[dp.date] = d.days[dp.date] || { m: {}, closed: '' }, mr = rec.m[m.id] = rec.m[m.id] || { value: 0, passed: false, plays: 0 };
    mr.plays++; mr.value = Math.max(mr.value || 0, v); if (passed) mr.passed = true;
    var out = { m: m, value: v, passed: passed, stale: stale, closedNow: false, repaired: false, xp: passed ? 20 : 0 };
    if (passed) A.addXp(20);
    var ms = daily.missions(dp.date), allDone = ms.length && ms.every(function (x) { return rec.m[x.id] && rec.m[x.id].passed; });
    if (allDone && !rec.closed && !stale) {
      rec.closed = today; out.closedNow = true; out.xp += 50; A.addXp(50);
      var last = d.lastClosed || '';
      if (last === addDays(today, -1)) d.streak = (d.streak || 0) + 1;
      else if (last === addDays(today, -2) && repairFree(d, today)) { d.streak = (d.streak || 0) + 1; d.repairAt = today; out.repaired = true; }
      else d.streak = 1;
      d.lastClosed = today; d.best = Math.max(d.best || 0, d.streak);
    }
    save(d);
    out.today = daily.today(); return out;
  };
  // the streak as it stands: it survives today until midnight, dies after a day with no card unless a repair is still free
  daily.streakNow = function () {
    var d = all(), today = dayKey(), last = d.lastClosed || '', s = d.streak || 0;
    if (!s || last === today || last === addDays(today, -1)) return { streak: s, atRisk: last !== today && s > 0, repairFree: repairFree(d, today) };
    if (last === addDays(today, -2) && repairFree(d, today)) return { streak: s, atRisk: true, repairable: true, repairFree: true };
    return { streak: 0, lost: s, repairFree: repairFree(d, today) };
  };
  daily.seasonCards = function () { var d = all(), s = season.current(), n = 0; Object.keys(d.days || {}).forEach(function (k) { if (d.days[k].closed && season.current(new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10))).id === s.id) n++; }); return n; };

  // ---- the weekly qualification table ----
  var table = A.table = {};
  table.SIZE = 40;
  table.badgeOf = function (hits, fired) { if (fired < table.SIZE) return ''; return hits >= 36 ? 'expert' : hits >= 30 ? 'sharpshooter' : hits >= 23 ? 'marksman' : 'unqualified'; };
  table.NAMES = { expert: 'Expert', sharpshooter: 'Sharpshooter', marksman: 'Marksman', unqualified: 'Unqualified', '': 'Not yet fired' };
  table.ICONS = { expert: '🏅', sharpshooter: '🥈', marksman: '🥉', unqualified: '🔁', '': '🎯' };
  function tableAll() { var t = A.save.get('table', {}); if (!t || typeof t !== 'object') t = {}; t.history = t.history || {}; return t; }
  function rollWeek(t) {
    var wk = weekKey();
    if (t.week && t.week !== wk) { if (t.fired) t.history[t.week] = { fired: t.fired, hits: t.hits, badge: table.badgeOf(t.hits, t.fired), shots: t.shots || '' }; var keys = Object.keys(t.history).sort(); while (keys.length > 26) delete t.history[keys.shift()]; t.week = wk; t.fired = 0; t.hits = 0; t.shots = ''; }
    if (!t.week) { t.week = wk; t.fired = 0; t.hits = 0; t.shots = ''; }
    return t;
  }
  // one target per answer in any game, until the week's 40 are fired
  table.record = function (ok) {
    var t = rollWeek(tableAll());
    if (t.fired >= table.SIZE) return { fired: t.fired, hits: t.hits, badge: table.badgeOf(t.hits, t.fired), justFired: false };
    t.fired++; if (ok) t.hits++; t.shots = (t.shots || '') + (ok ? '1' : '0');
    var just = t.fired === table.SIZE, badge = table.badgeOf(t.hits, t.fired);
    A.save.set('table', t, !just);
    return { fired: t.fired, hits: t.hits, badge: badge, badgeName: table.NAMES[badge], justFired: just };
  };
  // read only: the week rolls over in memory; record() saves it with the next answer (a write here, on every Home or
  // lobby draw, made the account sync see this device as newer than the account and ask which copy to keep)
  table.week = function () { var t = rollWeek(tableAll()); var badge = table.badgeOf(t.hits, t.fired), need = t.hits >= 36 ? null : t.hits >= 30 ? ['Expert', 36] : t.hits >= 23 ? ['Sharpshooter', 30] : ['Marksman', 23]; return { week: t.week, fired: t.fired, hits: t.hits, shots: t.shots || '', badge: badge, badgeName: table.NAMES[badge], icon: table.ICONS[badge], need: need, history: t.history }; };

  // ---- lobby sections and the results card ----
  function passText(m) { return m.unit === 'boss' ? 'Pass: bring the boss down' : 'Pass: ' + m.pass + ' of ' + m.of + ' ' + m.unit; }
  daily.section = function () {
    var h = A.h, t = daily.today(), sn = daily.streakNow(), G = (A.campaign && A.campaign.GAME) || {};
    var wrap = h('section.ar-daily', { id: 'ar-daily' });
    var streakChip = sn.streak ? h('span.ar-streak' + (sn.atRisk ? '.risk' : ''), { title: sn.atRisk ? 'Close today\'s card to keep it' : 'Days in a row with a closed card' }, '🔥 ' + sn.streak + (sn.streak === 1 ? ' day' : ' days')) : (sn.lost ? h('span.ar-streak.lost', { title: 'The streak ended' }, 'Streak ended at ' + sn.lost + '. Start a new one today.') : h('span.ar-streak.none', {}, 'No streak yet'));
    wrap.appendChild(h('div.ar-daily-head', {}, h('div', {}, h('div.ar-kicker', {}, h('i'), 'Today\'s range card · ' + t.label), h('h2', {}, t.closed ? 'Card closed for today' : t.done + ' of 3 missions passed')), streakChip));
    var list = h('div.ar-missions');
    t.missions.forEach(function (x, i) {
      var m = x.def, g = G[m.game] || { icon: '🎮', name: m.game }, isNext = t.next && t.next.def === m, run = A.runAs ? A.runAs(m.game) : m.game, in2D = run && run !== m.game ? ' · in 2D here: ' + A.games[run].title : '';
      list.appendChild(h('button.ar-mission' + (x.passed ? '.ok' : '') + (isNext ? '.next' : ''), { type: 'button', onclick: function () { daily.start(m); } },
        h('span.ar-mission-n', {}, x.passed ? '✓' : String(i + 1)),
        h('span.ar-mission-copy', {}, h('b', {}, g.icon + ' ' + g.name + ' · ' + m.title), h('span', {}, m.what), h('small', {}, (x.passed ? 'Passed' + (m.unit !== 'boss' ? ' · best ' + x.value + ' of ' + m.of : '') : x.plays ? 'Best ' + x.value + ' of ' + m.of + ' · ' + passText(m).replace('Pass: ', 'needs ') : passText(m)) + in2D)),
        h('span.ar-mission-go', {}, x.passed ? 'Again ↻' : isNext ? 'Play ▶' : 'Play')));
    });
    wrap.appendChild(list);
    wrap.appendChild(h('p.ar-daily-foot', {}, 'Three five-minute missions a day, picked for the date. Pass all three to close the card and keep your streak. Miss a day? One repair a week keeps the streak alive' + (sn.repairFree ? '.' : ' (used this week).') + (t.best > 1 ? ' Best streak: ' + t.best + ' days.' : '')));
    return wrap;
  };
  table.section = function () {
    var h = A.h, w = table.week(), s = season.current(), cards = daily.seasonCards();
    var cells = h('div.ar-table-grid', { role: 'img', 'aria-label': w.fired + ' of 40 targets fired, ' + w.hits + ' hits' });
    for (var i = 0; i < table.SIZE; i++) { var c = w.shots[i]; cells.appendChild(h('i' + (c === '1' ? '.hit' : c === '0' ? '.miss' : ''))); }
    var hist = Object.keys(w.history).sort().slice(-6).map(function (k) { var e = w.history[k]; return h('span.ar-chip-badge', { title: k + ': ' + e.hits + ' of ' + e.fired }, table.ICONS[e.badge] + ' ' + table.NAMES[e.badge]); });
    var tbl = h('div.ar-week-card', {}, h('div.ar-kicker', {}, h('i'), 'This week\'s qualification table'),
      h('h3', {}, w.badge ? w.icon + ' ' + w.badgeName + ' · ' + w.hits + ' of 40' : w.fired ? w.hits + ' hits of ' + w.fired + ' fired' : 'Not fired yet'),
      cells,
      h('p', {}, w.badge ? (w.badge === 'expert' ? 'The best there is. The table resets on Monday.' : 'The table resets on Monday; the badge stays on Home until then.') : 'Every answer in any game fires one target, right or wrong, until 40 are fired. Marksman is 23 hits, Sharpshooter 30, Expert 36: the Army rifle standard.' + (w.need && w.fired ? ' You need ' + w.need[1] + ' for ' + w.need[0] + '.' : '')),
      hist.length ? h('div.ar-chips', {}, hist) : null);
    var skinSeg = h('div.ar-skins', { role: 'radiogroup', 'aria-label': 'Range skin' });
    function paintSkins() { skinSeg.innerHTML = ''; var chosen = season.chosen(); [{ id: '', name: 'Follow the season' }].concat(season.SKINS).forEach(function (sk) { var on = sk.id === chosen; skinSeg.appendChild(h('button.ar-skin' + (on ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', title: sk.sub || 'The skin of the current season', onclick: function () { season.setSkin(sk.id); paintSkins(); } }, sk.name + (sk.id === s.skin && sk.id ? ' · now' : ''))); }); }
    paintSkins();
    var sea = h('div.ar-week-card.ar-season', {}, h('div.ar-kicker', {}, h('i'), 'Season'),
      h('h3', {}, s.name + ' · ' + season.skinName(s.skin)),
      h('p', {}, s.months + '. ' + cards + (cards === 1 ? ' card closed' : ' cards closed') + ' this season. Each quarter brings a range skin for Range Day and Fire Mission; pick any one, cosmetics only.'),
      skinSeg);
    return h('section.ar-week', { id: 'ar-week' }, tbl, sea);
  };
  daily.card = function (state) {
    var r = state.dailyResult, h = A.h; if (!r) return null;
    var t = r.today, line = r.stale ? 'That card was for ' + fmtDay(state.opts.daily.date) + '; today has a new one.' : r.closedNow ? (r.repaired ? 'Card closed, and the streak was repaired (one repair a week): ' + t.streak + ' days.' : 'Card closed. Streak: ' + t.streak + (t.streak === 1 ? ' day.' : ' days.')) : r.passed ? 'Mission passed. ' + (3 - t.done) + ' to go on today\'s card.' : (r.m.unit === 'boss' ? 'The boss is still standing; the card stays open.' : r.value + ' of ' + r.m.of + ' ' + r.m.unit + '; the mission takes ' + r.m.pass + '.');
    var actions = [];
    // a mission not passed, and next on the card anyway: the button says so (it said "Next on the card: <this one>")
    var again = !r.stale && !r.passed && !t.closed && (!t.next || t.next.def.id === r.m.id);
    if (again) actions.push(h('button.ar-btn.gold', { type: 'button', onclick: function () { daily.start(r.m); } }, '↻ Try again'));
    else if (!r.stale && t.next && !t.closed) actions.push(h('button.ar-btn.gold', { type: 'button', onclick: function () { daily.start(t.next.def); } }, 'Next on the card: ' + t.next.def.title + ' ▶'));
    actions.push(h('button.ar-btn', { type: 'button', onclick: function () { A.lobby('daily'); } }, 'Range card'));
    return h('div.ar-camp-card' + (r.closedNow ? '.cleared' : r.passed ? '.passed' : '.failed'), { style: { '--cc': '#e6b85a' } },
      h('div.ar-camp-card-copy', {},
        h('div.ar-kicker', {}, h('i'), 'Range card · ' + fmtDay(state.opts.daily.date)),
        h('b', {}, r.closedNow ? '🔥 Card closed' : r.passed ? 'Mission passed: ' + r.m.title : 'Not yet: ' + r.m.title),
        h('p', {}, line),
        r.xp ? h('small', {}, '+' + r.xp + ' XP' + (r.closedNow ? ' (20 for the mission, 50 for the card)' : ' for the mission')) : h('small', {}, passText(r.m)),
        h('div.ar-row', {}, actions)));
  };
  // for Home: a short summary of the card, the streak and the table
  daily.summary = function () { var t = daily.today(), sn = daily.streakNow(), w = table.week(); return { date: t.label, done: t.done, closed: t.closed, next: t.next ? t.next.def : null, nextN: t.next ? t.missions.indexOf(t.next) + 1 : 0, streak: sn.streak, lost: sn.lost || 0, atRisk: !!sn.atRisk, table: w, season: season.current() }; };
})();
