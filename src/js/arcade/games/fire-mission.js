/* GAME: fire-mission — artillery. A call for fire names a fact (a dollar threshold, a deadline, a form, a J&A approver or a
   contract type); three or four targets on the ridge carry answer signs. Lay the howitzer (elevation and charge; wind on
   harder levels) and fire. Hitting the right target scores, more on the first round; hitting a wrong target costs a life and
   shows the right one; three misses abort the mission with no life lost. The observer calls ADD or DROP after a miss.
   Twelve missions a run, then a battery rating. */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var FAMS = ['dollars', 'days', 'form', 'ja', 'type'];
  var FAM_NAME = { dollars: 'Dollar threshold', days: 'Deadline', form: 'Form', ja: 'J&A approval', type: 'Contract type' };
  var FAM_HINT = { dollars: 'Hit the target with the right amount.', days: 'Hit the target with the right time limit.', form: 'Hit the target with the right form.', ja: 'Hit the target with the right approver.', type: 'Hit the target with the right contract type.' };
  var MISSIONS = 12, ROUNDS = 3, STEP = 4;
  var SKIES = [['#1b2a4a', '#c8714a', '#f3c07a'], ['#0f2747', '#3f78b5', '#a9d2f0'], ['#2b1e3f', '#d46a5a', '#ffcf8a'], ['#090d1f', '#26285a', '#6d4f8a']];

  function factsOf(D) { return ((D && D.facts) || []).filter(function (f) { return f && FAMS.indexOf(f.fam) >= 0 && f.prompt && f.answer; }); }
  function magnitude(f) {
    var s = String(f.answer).toLowerCase(), m = /([\d.,]+)\s*(million|billion|days?|months?|years?|hours?)?/.exec(s);
    if (!m) return null; var n = parseFloat(m[1].replace(/,/g, '')), u = m[2] || '';
    if (/million/.test(u)) n *= 1e6; else if (/billion/.test(u)) n *= 1e9; else if (/month/.test(u)) n *= 30; else if (/year/.test(u)) n *= 365;
    return isFinite(n) ? n : null;
  }
  function decoys(all, f, n, level) {
    var seen = {}; seen[f.answer] = 1;
    var same = all.filter(function (x) { if (x.fam !== f.fam || seen[x.answer]) return false; seen[x.answer] = 1; return true; });
    var m = magnitude(f);
    if (level >= 3 && m != null) {
      var lm = Math.log(m + 1);
      same.sort(function (a, b) { var ma = magnitude(a), mb = magnitude(b); return (ma == null ? 99 : Math.abs(Math.log(ma + 1) - lm)) - (mb == null ? 99 : Math.abs(Math.log(mb + 1) - lm)); });
      return A.shuffle(same.slice(0, n + 1)).slice(0, n);
    }
    return A.shuffle(same).slice(0, n);
  }
  function rng(seed) { seed = Math.max(1, Math.floor(seed) % 2147483646); return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  function drawGun(ctx, x, y, s, angle, recoil, flash) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#2b3324'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4 * s, -10 * s); ctx.lineTo(-40 * s, 0); ctx.moveTo(-4 * s, -10 * s); ctx.lineTo(-34 * s, -2 * s); ctx.stroke();
    ctx.save(); ctx.translate(2 * s, -16 * s); ctx.rotate(-angle * Math.PI / 180);
    var rx = -recoil * 10 * s;
    ctx.fillStyle = '#3d4a31'; A.roundRect(ctx, rx - 10 * s, -5 * s, 58 * s, 10 * s, 4 * s); ctx.fill();
    ctx.fillStyle = '#2e3826'; ctx.fillRect(rx + 44 * s, -6 * s, 9 * s, 12 * s);
    if (flash > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, flash * 6); ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 30 * s; ctx.fillStyle = '#fff1b8';
      ctx.beginPath(); ctx.moveTo(rx + 53 * s, -7 * s); ctx.lineTo(rx + 92 * s, 0); ctx.lineTo(rx + 53 * s, 7 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(rx + 60 * s, 0, 10 * s, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = '#4a5a3a'; ctx.beginPath(); ctx.moveTo(-12 * s, -26 * s); ctx.lineTo(10 * s, -30 * s); ctx.lineTo(14 * s, -8 * s); ctx.lineTo(-14 * s, -6 * s); ctx.closePath(); ctx.fill();
    [-8, 9].forEach(function (wx) { ctx.fillStyle = '#1d211a'; ctx.beginPath(); ctx.arc(wx * s, -7 * s, 8 * s, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#56604a'; ctx.beginPath(); ctx.arc(wx * s, -7 * s, 3 * s, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }
  function drawTruck(ctx, x, y, s, wreck, t) {
    ctx.save(); ctx.translate(x, y);
    if (wreck) { ctx.rotate(0.12); ctx.fillStyle = '#1b1a18'; }
    ctx.fillStyle = wreck ? '#22201c' : '#6b6f4a'; A.roundRect(ctx, -26 * s, -26 * s, 34 * s, 20 * s, 3 * s); ctx.fill();
    ctx.fillStyle = wreck ? '#1a1916' : '#5a5e3e'; A.roundRect(ctx, 8 * s, -21 * s, 18 * s, 15 * s, 3 * s); ctx.fill();
    if (!wreck) { ctx.fillStyle = '#9fc3d6'; ctx.fillRect(14 * s, -19 * s, 9 * s, 6 * s); }
    ctx.fillStyle = '#151515'; [-16, 0, 17].forEach(function (wx) { ctx.beginPath(); ctx.arc(wx * s, -5 * s, 5.5 * s, 0, Math.PI * 2); ctx.fill(); });
    if (wreck) {
      for (var i = 0; i < 3; i++) { var fy = -26 * s - Math.abs(Math.sin(t * 9 + i * 2)) * 10 * s; ctx.fillStyle = i % 2 ? '#ff8a3d' : '#ffd166'; ctx.beginPath(); ctx.moveTo((-14 + i * 10) * s, -24 * s); ctx.quadraticCurveTo((-10 + i * 10) * s, fy, (-6 + i * 10) * s, -24 * s); ctx.fill(); }
    }
    ctx.restore();
  }

  A.register({
    id: 'fire-mission', title: 'Fire Mission', icon: '💥', accent: '#ffa552', genre: 'Artillery', music: 'drive',
    tagline: 'Read the call for fire, lay the howitzer and drop a round on the target that carries the right number, deadline or form.',
    drills: 'Dollar thresholds, deadlines, forms, J&A approvals, contract types',
    controls: 'Mouse or touch: point at the spot where the round should land and click or tap to fire (on a touch screen you can drag to adjust, then let go). Keyboard: up and down set elevation, left and right set the charge, Space or Enter fires. The dotted arc shows the shot on easier paces; on harder levels wind pushes the round, so aim upwind. Three rounds per mission; a wrong target costs a life.',
    aspect: [1.0, 2.3], orient: 'landscape',
    dataOk: function (D) { return factsOf(D).length >= 12; },
    thumb: function (ctx, w, h, t) {
      var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b2a4a'); g.addColorStop(0.65, '#c8714a'); g.addColorStop(1, '#f3c07a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3b2f3f'; ctx.beginPath(); ctx.moveTo(0, h); for (var x = 0; x <= w; x += 10) ctx.lineTo(x, h * 0.62 - 20 * Math.sin(x * 0.015) - 10 * Math.sin(x * 0.04)); ctx.lineTo(w, h); ctx.fill();
      ctx.fillStyle = '#2c3a24'; ctx.beginPath(); ctx.moveTo(0, h); for (x = 0; x <= w; x += 10) ctx.lineTo(x, h * 0.8 - 12 * Math.sin(x * 0.02 + 1)); ctx.lineTo(w, h); ctx.fill();
      drawGun(ctx, 50, h * 0.8 + 2, 0.9, 42, 0, (t % 2.4) < 0.08 ? 0.1 : 0);
      [[w * 0.6, '$15,000'], [w * 0.85, '$350,000']].forEach(function (p, i) {
        var ty = h * 0.8 - 12 * Math.sin(p[0] * 0.02 + 1);
        drawTruck(ctx, p[0], ty, 0.9, i === 1 && (t % 2.4) > 1.6, t);
        ctx.fillStyle = '#5b4a3a'; ctx.fillRect(p[0] - 2, ty - 70, 4, 44); ctx.fillStyle = '#f4ead2'; A.roundRect(ctx, p[0] - 46, ty - 96, 92, 30, 6); ctx.fill();
        A.text(ctx, p[1], p[0], ty - 76, { size: 17, fam: 'mono', weight: 800, color: '#2a2016', align: 'center' });
      });
      var k = (t % 2.4) / 1.6;
      if (k <= 1) { var sx = 80 + k * (w * 0.85 - 80), sy = h * 0.72 - Math.sin(k * Math.PI) * h * 0.55 + k * 10; ctx.fillStyle = '#fff3c4'; ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
      else { var e = (k - 1) * 2; ctx.globalAlpha = Math.max(0, 1 - e); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(w * 0.85, h * 0.72, 10 + e * 50, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    },
    create: function (api) {
      var W = api.W, H = api.H, tier = api.difficulty, all = factsOf(api.data), t = 0;
      var ground = [], targets = [], shell = null, mission = null, missionNo = 0, rounds = ROUNDS, streak = 0;
      var angle = 45, charge = 0.62, recoil = 0, flashT = 0, trail = [], clouds = [], phase = 'aim', phaseT = 0;
      var timer = 0, limit = 0, note = '', noteT = 0, gunX = 0, gunY = 0, g = 0, vmax = 0, wind = 0, reveal = 0;
      var tierIx = Math.max(0, ['recruit', 'regular', 'veteran', 'elite'].indexOf(tier.id));
      var previewFrac = [1, 0.5, 0.22, 0][tierIx];
      api.progress.configure({ perLevel: 4 });
      for (var c = 0; c < 6; c++) clouds.push({ x: Math.random(), y: Math.random() * 0.35 + 0.05, w: Math.random() * 0.12 + 0.08, sp: Math.random() * 0.01 + 0.004 });

      function sc() { return api.clamp(Math.min(W / 900, H / 480), 0.62, 1.45); }
      function heightAt(x) { var f = x / STEP, i = Math.floor(f); if (!ground.length) return H * 0.8; if (i < 0) return ground[0]; if (i >= ground.length - 1) return ground[ground.length - 1]; return A.lerp(ground[i], ground[i + 1], f - i); }
      function flatten(x, half) {
        var h = heightAt(x), i0 = Math.max(0, Math.floor((x - half * 2) / STEP)), i1 = Math.min(ground.length - 1, Math.ceil((x + half * 2) / STEP));
        for (var i = i0; i <= i1; i++) { var d = Math.abs(i * STEP - x), k = d < half ? 1 : 1 - (d - half) / half; if (k > 0) ground[i] = A.lerp(ground[i], h, Math.min(1, k)); }
      }
      // terrain and positions come from the mission's seed and fractions, so a resize rebuilds the same field
      function build() {
        W = api.W; H = api.H; var s = sc(), r = rng(mission ? mission.seed : 7), p1 = r() * 6, p2 = r() * 6, p3 = r() * 6, n = Math.ceil(W / STEP) + 2;
        ground = new Array(n);
        for (var i = 0; i < n; i++) { var u = i * STEP / W; ground[i] = H * 0.8 - H * 0.09 * (0.6 * Math.sin(u * 7 + p1) + 0.3 * Math.sin(u * 13 + p2) + 0.15 * Math.sin(u * 29 + p3)) - H * 0.06 * u; }
        gunX = Math.max(46 * s, W * 0.07); flatten(gunX, 40 * s); gunY = heightAt(gunX);
        targets.forEach(function (tg) { tg.x = W * tg.fx; flatten(tg.x, 30 * s); });
        targets.forEach(function (tg) { tg.y = heightAt(tg.x); });
        g = W * 0.62; vmax = Math.sqrt(g * (W * 0.97 - gunX) * 1.08);
      }
      function newMission() {
        missionNo++;
        if (missionNo > MISSIONS) { finish(); return; }
        var lvl = api.progress.level, f = api.progress.pick(all, function (x) { return x.id; });
        var opts = A.shuffle([f].concat(decoys(all, f, lvl >= 3 ? 3 : 2, lvl)));
        var n = opts.length, lo = 0.34, hi = 0.95, slot = (hi - lo) / n, r = rng(Date.now() % 100000 + missionNo * 97);
        mission = { f: f, seed: Math.floor(r() * 1e6) + 1, sky: SKIES[(missionNo - 1) % SKIES.length] };
        targets = opts.map(function (o, i) { return { label: o.answer, ok: o === f, fx: lo + (i + 0.5) * slot + (r() - 0.5) * slot * 0.3, alive: true, wreck: 0, sway: r() * 6 }; });
        wind = lvl <= 1 ? 0 : (r() < 0.5 ? -1 : 1) * (lvl === 2 ? 0.25 + r() * 0.3 : 0.5 + r() * 0.5);
        rounds = ROUNDS; shell = null; trail = []; note = ''; reveal = 0; phase = 'aim'; phaseT = 0;
        limit = tier.limit ? 32 * tier.limit : 0; timer = limit; api.hud.set({ time: limit ? limit : null });
        build();
        api.prompt.set({ kicker: 'Fire mission ' + missionNo + ' of ' + MISSIONS + ' · ' + FAM_NAME[f.fam] + (f.__via === 'review' ? ' · missed before' : ''), text: f.prompt, sub: FAM_HINT[f.fam] + (wind ? ' Watch the wind.' : ''), color: '#ffa552' });
        api.ready({ text: f.prompt });
      }
      function fire() {
        if (phase !== 'aim' || shell || rounds <= 0 || api.reading) return;
        var a = angle * Math.PI / 180, v = vmax * charge * (1 + A.rand(-0.008, 0.008)), s = sc(), mx = gunX + 2 * s + Math.cos(a) * 54 * s, my = gunY - 16 * s - Math.sin(a) * 54 * s;
        shell = { x: mx, y: my, vx: Math.cos(a) * v, vy: -Math.sin(a) * v, tt: 0 }; trail = [];
        rounds--; recoil = 1; flashT = 0.12; phase = 'flight';
        api.audio.cannon(); api.shake(5);
        api.particles.emit({ x: mx, y: my, n: 18, color: ['#d9d2c5', '#a8a196', '#fff'], speed: 120, gravity: -40, life: 1.1, size: 12, angle: -a, spread: 0.7, drag: 0.94 });
      }
      function impact(x, y, onTarget) {
        var s = sc(), blast = 40 * s, hit = null, best = 1e9;
        targets.forEach(function (tg) { if (!tg.alive) return; var d = A.dist(x, y, tg.x, tg.y - 12 * s); if (d < blast && d < best) { best = d; hit = tg; } });
        if (onTarget && !hit) hit = onTarget;
        api.audio.boom(); api.shake(hit ? 10 : 7); shell = null;
        api.particles.emit({ x: x, y: y, n: 46, color: ['#ffd166', '#ff8a3d', '#ff5d3d', '#fff3c4'], speed: 360, gravity: 420, life: 0.9, size: 7 });
        api.particles.emit({ x: x, y: y, n: 22, color: ['#5b4a3a', '#3d3226', '#7a6650'], speed: 260, gravity: 520, life: 1.2, shape: 'square', size: 6 });
        api.particles.emit({ x: x, y: y - 10, n: 14, color: ['#8a8378', '#5f5a52'], speed: 70, gravity: -50, life: 1.6, size: 16, drag: 0.96 });
        api.particles.ring(x, y, { color: '#fff1c4', grow: 280, life: 0.45, width: 5 });
        for (var i = 0; i < ground.length; i++) { var dx = i * STEP - x; if (Math.abs(dx) < blast * 0.75) ground[i] = Math.min(H - 6, Math.max(ground[i], y + Math.sqrt(blast * blast * 0.56 - dx * dx) * 0.42)); }
        var f = mission.f;
        if (hit && hit.ok) {
          hit.alive = false; hit.wreck = 0.001; streak++;
          var used = ROUNDS - rounds, direct = best < 12 * s, pts = [300, 200, 120][Math.min(2, used - 1)] + (direct ? 100 : 0) + streak * 40 + (limit ? Math.round(timer / limit * 100) : 0);
          api.score(pts); api.progress.correct();
          api.floaters.add(direct ? 'DIRECT HIT +' + pts : 'TARGET DESTROYED +' + pts, hit.x, hit.y - 110 * s, { size: 22, color: '#f6d991', life: 1.4 });
          api.audio.correct(); api.flash('rgba(255,210,122,.3)');
          api.review.add({ prompt: f.prompt, given: hit.label, correct: f.answer, ok: true, explanation: f.why, cite: f.cite, key: f.id });
          phase = 'result'; phaseT = 1.7;
        } else if (hit) {
          hit.alive = false; hit.wreck = 0.001; streak = 0; reveal = 2.4;
          api.floaters.add('WRONG TARGET', hit.x, hit.y - 110 * s, { size: 22, color: '#ff8080', life: 1.6 });
          api.hud.set({ banner: 'Check fire!', sub: 'Right target: ' + f.answer, color: '#ff6b6b', bannerTime: 2.2 });
          api.audio.wrong();
          api.review.add({ prompt: f.prompt, given: hit.label, correct: f.answer, ok: false, explanation: f.why, cite: f.cite, key: f.id });
          api.life(-1); phase = 'result'; phaseT = 2.6;
        } else {
          var near = null, nd = 1e9; targets.forEach(function (tg) { if (tg.alive && Math.abs(tg.x - x) < nd) { nd = Math.abs(tg.x - x); near = tg; } });
          var meters = Math.max(10, Math.round(nd / (4 * s) / 10) * 10);
          if (rounds > 0) { note = (near && x > near.x ? 'DROP ' : 'ADD ') + meters; noteT = 2.6; api.floaters.add('SPLASH · ' + note, x, Math.max(60, y - 60 * s), { size: 16, color: '#fff', life: 1.5 }); phase = 'aim'; }
          else abort('Out of rounds');
        }
      }
      function abort(why) {
        var f = mission.f; streak = 0; reveal = 2.4; note = '';
        api.hud.set({ banner: why, sub: 'Right target: ' + f.answer, color: '#ffa552', bannerTime: 2.2 });
        api.review.add({ prompt: f.prompt, given: '(no hit)', correct: f.answer, ok: false, explanation: f.why, cite: f.cite, key: f.id });
        api.audio.wrong(); phase = 'result'; phaseT = 2.6; shell = null;
      }
      function finish() {
        var right = api.progress.right, pct = Math.round(right / MISSIONS * 100), badge;
        if (pct >= 90) badge = { icon: '🎖️', name: 'King of Battle', desc: right + ' of ' + MISSIONS + ' missions on target.', color: '#f6d991' };
        else if (pct >= 75) badge = { icon: '💥', name: 'Steel on target', desc: right + ' of ' + MISSIONS + ' missions on target. 11 or more makes King of Battle.', color: '#ffa552' };
        else if (pct >= 50) badge = { icon: '🎯', name: 'Adjusting fire', desc: right + ' of ' + MISSIONS + ' on target. Review the misses below, then fire again.', color: '#8cc8ff' };
        else badge = { icon: '📋', name: 'Back to the FDC', desc: right + ' of ' + MISSIONS + ' on target. Study the list below and try again.', color: '#c2cdc6' };
        api.end({ won: true, title: 'Fire missions complete', message: 'You hit ' + right + ' of ' + MISSIONS + ' targets.', badge: badge, xpBonus: right * 5 });
      }

      function trajectory(n, chg, w) {
        var a = angle * Math.PI / 180, v = vmax * (chg == null ? charge : chg), s = sc(), x = gunX + 2 * s + Math.cos(a) * 54 * s, y = gunY - 16 * s - Math.sin(a) * 54 * s, vx = Math.cos(a) * v, vy = -Math.sin(a) * v, pts = [], dt = 0.03, ax = (w == null ? wind : w) * g * 0.08;
        for (var i = 0; i < n; i++) { vy += g * dt; vx += ax * dt; x += vx * dt; y += vy * dt; pts.push([x, y]); if (y > heightAt(x) || x > W + 40 || x < -40) break; }
        return pts;
      }
      // pointer aiming: point where the round should land; the charge that lands it there in still air is worked out for the
      // current elevation. Wind still pushes the round, so on windy levels aim upwind (the dotted arc shows it on easier paces).
      function aimAt(px) {
        var x = api.clamp(px, gunX + 40, W - 4), lo = 0.12, hi = 1;
        for (var i = 0; i < 18; i++) { var mid = (lo + hi) / 2, pts = trajectory(400, mid, 0), end = pts[pts.length - 1]; if (end[0] < x) lo = mid; else hi = mid; }
        charge = api.clamp((lo + hi) / 2, 0.12, 1);
      }

      function update(dt) {
        t += dt; recoil = Math.max(0, recoil - dt * 3); flashT = Math.max(0, flashT - dt); noteT = Math.max(0, noteT - dt); reveal = Math.max(0, reveal - dt);
        clouds.forEach(function (c) { c.x += (c.sp + wind * 0.01) * dt; if (c.x > 1.2) c.x = -0.25; if (c.x < -0.3) c.x = 1.15; });
        targets.forEach(function (tg) { if (!tg.wreck) return; tg.wreck += dt; if (tg.wreck < 4 && Math.random() < 0.3) api.particles.emit({ x: tg.x + A.rand(-10, 10) * sc(), y: tg.y - 24 * sc(), n: 1, color: ['#4a4540', '#6a6560'], speed: 20, gravity: -60, life: 1.6, size: 14, drag: 0.97 }); });
        if (!mission) return;
        var K = api.input.keys;
        if (phase === 'aim') {
          if (K.has('ArrowUp') || K.has('w') || K.has('W')) angle = Math.min(82, angle + 38 * dt);
          if (K.has('ArrowDown') || K.has('s') || K.has('S')) angle = Math.max(8, angle - 38 * dt);
          if (K.has('ArrowRight') || K.has('d') || K.has('D')) charge = Math.min(1, charge + 0.32 * dt);
          if (K.has('ArrowLeft') || K.has('a') || K.has('A')) charge = Math.max(0.12, charge - 0.32 * dt);
          if (limit) { timer -= dt; api.hud.set({ time: Math.max(0, timer) }); if (timer <= 0) abort('Mission aborted: time'); }
        }
        if (shell) {
          var ax = wind * g * 0.08, steps = 4, h = dt / steps;
          for (var i = 0; i < steps && shell; i++) {
            shell.vy += g * h; shell.vx += ax * h; shell.x += shell.vx * h; shell.y += shell.vy * h; shell.tt += h;
            if (shell.x > W + 60 || shell.x < -60) { var sx = shell.x; shell = null; if (rounds > 0) { note = 'LOST · ' + (sx > W ? 'DROP' : 'ADD') + ' a lot'; noteT = 2.6; phase = 'aim'; api.audio.whoosh(); } else abort('Out of rounds'); break; }
            var s = sc(), onT = null;
            targets.forEach(function (tg) { if (tg.alive && A.dist(shell.x, shell.y, tg.x, tg.y - 14 * s) < 20 * s) onT = tg; });
            if (onT) { impact(shell.x, shell.y, onT); break; }
            if (shell.y >= heightAt(shell.x)) { impact(shell.x, heightAt(shell.x), null); break; }
          }
          if (shell && (trail.length === 0 || shell.tt - trail[trail.length - 1][2] > 0.02)) { trail.push([shell.x, shell.y, shell.tt]); if (trail.length > 60) trail.shift(); }
        }
        if (phase === 'result') { phaseT -= dt; if (phaseT <= 0) newMission(); }
      }

      function draw(ctx) {
        if (!mission) return;
        var s = sc(), sky = mission.sky, gr = ctx.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, sky[0]); gr.addColorStop(0.62, sky[1]); gr.addColorStop(1, sky[2]); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
        var night = sky === SKIES[3], sx = W * 0.78, sy = H * (night ? 0.18 : 0.5);
        ctx.save(); ctx.shadowColor = night ? '#e8e6ff' : '#ffd9a0'; ctx.shadowBlur = 40; ctx.fillStyle = night ? '#efeefe' : '#ffe2a8'; ctx.beginPath(); ctx.arc(sx, sy, Math.min(W, H) * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        if (night) { ctx.fillStyle = 'rgba(255,255,255,.7)'; for (var st = 0; st < 40; st++) ctx.fillRect((st * 97.3 % 1) * W, (st * 41.7 % 1) * H * 0.5, 1.5, 1.5); }
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        clouds.forEach(function (c) { var cx = c.x * W, cy = c.y * H, cw = c.w * W; ctx.beginPath(); ctx.ellipse(cx, cy, cw, cw * 0.22, 0, 0, Math.PI * 2); ctx.ellipse(cx + cw * 0.4, cy - cw * 0.08, cw * 0.5, cw * 0.2, 0, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = A.hexA(sky[0], 0.55); ctx.beginPath(); ctx.moveTo(0, H); for (var x = 0; x <= W + 10; x += 10) ctx.lineTo(x, H * 0.6 - H * 0.08 * Math.sin(x * 0.006 + mission.seed % 7) - H * 0.04 * Math.sin(x * 0.017)); ctx.lineTo(W, H); ctx.fill();
        var tg2 = ctx.createLinearGradient(0, H * 0.6, 0, H); tg2.addColorStop(0, '#4c6a35'); tg2.addColorStop(1, '#1d2a15'); ctx.fillStyle = tg2;
        ctx.beginPath(); ctx.moveTo(0, H + 10); for (var i = 0; i < ground.length; i++) ctx.lineTo(i * STEP, ground[i]); ctx.lineTo(W + 10, H + 10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#7fa35a'; ctx.lineWidth = 3; ctx.beginPath(); for (i = 0; i < ground.length; i++) { if (i) ctx.lineTo(i * STEP, ground[i]); else ctx.moveTo(0, ground[0]); } ctx.stroke();
        // targets and their signs
        // signs never wider than about one and a half target slots; on a narrow screen every other sign stands taller
        var slotW = W * 0.61 / Math.max(1, targets.length), signW = Math.min(api.clamp(W * 0.17, 104, 170), slotW * 1.55), stagger = signW > slotW * 0.96;
        targets.forEach(function (tg, ti) {
          var sway = tg.alive ? Math.sin(t * 1.5 + tg.sway) * 1.5 : 0;
          drawTruck(ctx, tg.x, tg.y, s, !tg.alive, t);
          var sw = signW, lines, fs = A.fitText(ctx, tg.label, sw - 14, 44 * s + 8, { max: 19, min: 10, fam: 'mono', weight: 800, maxLines: 3 });
          ctx.font = A.font(fs, 'mono', 800); lines = A.wrap(ctx, tg.label, sw - 14);
          var shh = lines.length * fs * 1.2 + 14, lift = stagger && ti % 2 ? 58 * s : 0, top = tg.y - 52 * s - shh - lift;
          ctx.fillStyle = '#5b4a3a'; ctx.fillRect(tg.x - 2, top + shh, 4, 24 * s + lift);
          ctx.save(); ctx.translate(sway, 0);
          var good = reveal > 0 && tg.ok, bad = !tg.alive && !tg.ok;
          if (good) { ctx.shadowColor = '#5fd39a'; ctx.shadowBlur = 24 + Math.sin(t * 10) * 8; }
          A.roundRect(ctx, tg.x - sw / 2, top, sw, shh, 7); ctx.fillStyle = good ? '#d8f7e6' : bad ? '#5a2a2a' : '#f4ead2'; ctx.fill(); ctx.shadowBlur = 0;
          ctx.strokeStyle = good ? '#5fd39a' : 'rgba(0,0,0,.35)'; ctx.lineWidth = good ? 3 : 1.5; ctx.stroke();
          ctx.fillStyle = bad ? '#ffb3b3' : '#2a2016'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          lines.forEach(function (ln, k) { ctx.fillText(ln, tg.x, top + 7 + fs * 0.6 + k * fs * 1.2); });
          if (good) A.text(ctx, '✓', tg.x + sw / 2 - 4, top - 4, { size: 22, weight: 900, color: '#5fd39a', align: 'center' });
          ctx.restore();
        });
        // trajectory preview
        if (phase === 'aim' && !api.reading) {
          var pts = trajectory(140), n = previewFrac ? Math.max(4, Math.floor(pts.length * previewFrac)) : 4;
          ctx.fillStyle = 'rgba(255,255,255,.75)';
          for (var p = 0; p < Math.min(n, pts.length); p += 2) { ctx.globalAlpha = previewFrac ? 0.85 * (1 - p / Math.max(1, pts.length)) + 0.15 : 0.6; ctx.beginPath(); ctx.arc(pts[p][0], pts[p][1], 2.4, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1;
        }
        drawGun(ctx, gunX, gunY, s, angle, recoil, flashT);
        // shell and trail
        trail.forEach(function (p, k) { ctx.fillStyle = 'rgba(230,225,215,' + (k / trail.length * 0.5) + ')'; ctx.beginPath(); ctx.arc(p[0], p[1], 2 + k / trail.length * 2, 0, Math.PI * 2); ctx.fill(); });
        if (shell) {
          ctx.save(); ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 14; ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(shell.x, Math.max(6, shell.y), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          if (shell.y < 0) A.text(ctx, '▲ ' + Math.round(-shell.y / (4 * s)) + ' m', shell.x, 18, { size: 12, weight: 800, color: '#fff', align: 'center' });
        }
        // aiming panel by the gun
        var px = 12, py = 14, pw = 170, ph2 = 66;
        ctx.fillStyle = 'rgba(0,0,0,.45)'; A.roundRect(ctx, px, py, pw, ph2, 10); ctx.fill();
        A.text(ctx, 'ELEV ' + Math.round(angle) + '°', px + 12, py + 22, { size: 14, fam: 'mono', weight: 800, color: '#f6d991' });
        A.text(ctx, 'CHG', px + 12, py + 46, { size: 12, fam: 'mono', weight: 800, color: '#c2cdc6' });
        ctx.fillStyle = 'rgba(255,255,255,.15)'; A.roundRect(ctx, px + 46, py + 37, 82, 10, 5); ctx.fill();
        ctx.fillStyle = charge > 0.85 ? '#ff8a3d' : '#ffd166'; A.roundRect(ctx, px + 46, py + 37, 82 * charge, 10, 5); ctx.fill();
        for (var rr = 0; rr < ROUNDS; rr++) { ctx.fillStyle = rr < rounds ? '#e6b85a' : 'rgba(255,255,255,.2)'; A.roundRect(ctx, px + 136 + rr * 10, py + 30, 6, 20, 3); ctx.fill(); }
        A.text(ctx, 'RDS', px + 136, py + 22, { size: 10, fam: 'mono', weight: 800, color: '#c2cdc6' });
        // wind sock
        var wx = W - 70, wy = 30;
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx, wy - 12); ctx.lineTo(wx, wy + 26); ctx.stroke();
        var wl = 10 + Math.abs(wind) * 34, dir = wind >= 0 ? 1 : -1, flap = Math.sin(t * 8) * 3 * (Math.abs(wind) + 0.2);
        ctx.fillStyle = wind ? '#ff8a3d' : '#9aa'; ctx.beginPath(); ctx.moveTo(wx, wy - 12); ctx.lineTo(wx + dir * wl, wy - 7 + flap); ctx.lineTo(wx + dir * wl, wy - 1 + flap); ctx.lineTo(wx, wy + 2); ctx.closePath(); ctx.fill();
        A.text(ctx, wind ? 'WIND ' + (wind > 0 ? '→ ' : '← ') + Math.round(Math.abs(wind) * 12) + ' kt' : 'CALM', wx, wy + 44, { size: 12, fam: 'mono', weight: 800, color: '#fff', align: 'center', stroke: 'rgba(0,0,0,.5)', strokeWidth: 3 });
        if (noteT > 0) A.text(ctx, 'OBSERVER: ' + note, W / 2, 26, { size: 15, fam: 'mono', weight: 800, color: '#fff3c4', align: 'center', stroke: 'rgba(0,0,0,.6)', strokeWidth: 4, alpha: Math.min(1, noteT) });
      }

      function onKey(k, down) { if (down && (k === ' ' || k === 'Enter')) fire(); }
      function onPointer(e) {
        if (phase !== 'aim' || shell) return;
        if (e.type === 'move' && (!e.touch || api.input.pointer.down)) aimAt(e.x);
        if (e.type === 'down') aimAt(e.x);
        if (e.type === 'up') { aimAt(e.x); fire(); }
      }

      newMission();
      return {
        update: update, draw: draw, onKey: onKey, onPointer: onPointer,
        resize: function () { if (shell) return; var old = targets.map(function (tg) { return tg.alive; }); build(); targets.forEach(function (tg, i) { tg.alive = old[i]; }); }
      };
    }
  });
})();
