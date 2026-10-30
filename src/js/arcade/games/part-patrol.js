/* GAME: part-patrol — a vertical space shooter. Each wave's briefing names a FAR part title, a UCF section or a PIID
   instrument; three or four carriers fly in carrying labels (Part 19, Section E, Letter F). Shoot down the carrier that
   matches; destroying a wrong one or letting the right one escape costs a life. Drones swoop and shoot; power-ups give
   spread shot, rapid fire, a shield refill or slow time. Each sector ends with the Audit Dreadnought: a bank question
   with four turrets lettered A to D. Shoot the turret with the right answer to break an armor plate. Three sectors.
   The simulation lives in the canvas's own pixels; where WebGL works, A.GL.PatrolScene draws it in real 3D (a lit fighter
   over a planet, carriers with lit label boards, the Dreadnought with real turrets), and the canvas-2D drawing below is
   the fallback. A campaign mission (api.opts) can limit the fact families and the sectors. */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var FAMS = ['part', 'ucf', 'piid'], THREE = window.THREE;
  var KICK = { part: 'FAR part', ucf: 'UCF section', piid: 'PIID letter' };
  var SUB = { part: 'Shoot down the carrier with its FAR part number. Leave the others.', ucf: 'Shoot down the carrier with its UCF section letter. Leave the others.', piid: 'Shoot down the carrier with its PIID letter (position 9). Leave the others.' };
  var SECTORS = 3, WAVES = 3, PLATES = [2, 2, 3];
  var POWERS = { S: { color: '#ffd166', name: 'SPREAD' }, R: { color: '#ff7ab6', name: 'RAPID' }, '+': { color: '#5fd39a', name: 'SHIELD' }, T: { color: '#8cc8ff', name: 'SLOW TIME' } };

  function factsOf(D) { return ((D && D.facts) || []).filter(function (f) { return f && FAMS.indexOf(f.fam) >= 0 && f.prompt && f.answer; }); }
  function bossBank(D) { return ((D && D.bank) || []).filter(function (q) { return q && q.options && q.options.length === 4 && q.stem.length <= 170 && q.options.reduce(function (s, o) { return s + o.text.length; }, 0) <= 230 && q.options.some(function (o) { return o.correct; }); }); }
  function label(f) { return f.fam === 'part' ? f.answer : f.fam === 'ucf' ? 'Section ' + f.answer : 'Letter ' + f.answer; }
  function decoys(all, f, n, level) {
    var same = all.filter(function (x) { return x.fam === f.fam && x.answer !== f.answer; }), seen = {};
    same = same.filter(function (x) { if (seen[x.answer]) return false; seen[x.answer] = 1; return true; });
    if (f.fam === 'part') {
      var num = f.n || parseInt(String(f.answer).replace(/\D+/g, ''), 10);
      if (level <= 1) { var ex = same.filter(function (x) { return x.exam; }); if (ex.length >= n) same = ex; }
      if (level >= 3) same.sort(function (a, b) { return Math.abs(a.n - num) - Math.abs(b.n - num); });
      else return A.shuffle(same).slice(0, n);
      return A.shuffle(same.slice(0, n + 2)).slice(0, n);
    }
    if (level >= 3) { var c = f.answer.charCodeAt(0); same.sort(function (a, b) { return Math.abs(a.answer.charCodeAt(0) - c) - Math.abs(b.answer.charCodeAt(0) - c); }); return A.shuffle(same.slice(0, n + 1)).slice(0, n); }
    return A.shuffle(same).slice(0, n);
  }

  function drawShip(ctx, x, y, s, t, o) {
    o = o || {};
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    var fl = 10 + Math.sin(t * 40) * 4;
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(-6, 16); ctx.lineTo(0, 16 + fl + 6); ctx.lineTo(6, 16); ctx.fill();
    ctx.fillStyle = '#fff2c4'; ctx.beginPath(); ctx.moveTo(-3, 16); ctx.lineTo(0, 16 + fl); ctx.lineTo(3, 16); ctx.fill();
    ctx.fillStyle = o.flash ? '#fff' : '#9fb4c9'; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(7, -6); ctx.lineTo(22, 10); ctx.lineTo(20, 16); ctx.lineTo(6, 12); ctx.lineTo(0, 18); ctx.lineTo(-6, 12); ctx.lineTo(-20, 16); ctx.lineTo(-22, 10); ctx.lineTo(-7, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = o.flash ? '#fff' : '#61788f'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, 8); ctx.lineTo(0, 13); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7ee0ff'; ctx.beginPath(); ctx.ellipse(0, -8, 3.4, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5d5d'; ctx.fillRect(-21, 9, 3, 3); ctx.fillStyle = '#5fd39a'; ctx.fillRect(18, 9, 3, 3);
    ctx.restore();
  }
  function drawDrone(ctx, d, t) {
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(t * 3 + d.seed);
    ctx.fillStyle = d.flash > 0 ? '#fff' : '#ff6b4a';
    for (var i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(4, -6); ctx.lineTo(-4, -6); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.translate(d.x, d.y); ctx.fillStyle = d.flash > 0 ? '#fff' : '#8a2b2b'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd166'; ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  A.register({
    id: 'part-patrol', title: 'Part Patrol', icon: '🚀', accent: '#8cc8ff', genre: 'Space shooter · real 3D', music: 'space',
    tagline: 'Fly the patrol over a planet in real 3D, shoot down the carrier that answers the briefing, then beat the Audit Dreadnought.',
    drills: 'FAR part titles, UCF sections, PIID letters; boss fights use bank questions',
    controls: 'Move with the arrow keys or WASD; on a touch screen drag anywhere to fly; with a mouse the ship follows the pointer. You fire on your own. Shoot down only the carrier whose label answers the briefing; destroying a wrong carrier, or letting the right one escape, costs a life. Bullets and drones drain your shield. Boss: shoot the turret lettered with the right answer.',
    aspect: [0.46, 1.5], orient: 'portrait',
    dataOk: function (D) { return factsOf(D).length >= 12 && bossBank(D).length >= 10; },
    thumb: function (ctx, w, h, t) {
      var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#05060f'); g.addColorStop(1, '#131a3d'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      var ng = ctx.createRadialGradient(w * 0.75, h * 0.3, 10, w * 0.75, h * 0.3, 160); ng.addColorStop(0, 'rgba(185,140,255,.35)'); ng.addColorStop(1, 'rgba(185,140,255,0)'); ctx.fillStyle = ng; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff'; for (var i = 0; i < 60; i++) { var sy = (i * 53.7 + t * (20 + (i % 3) * 30)) % h; ctx.globalAlpha = 0.3 + (i % 3) * 0.25; ctx.fillRect((i * 97.3) % w, sy, 1.5, 1.5); } ctx.globalAlpha = 1;
      var cx = w * 0.5 + Math.sin(t * 0.8) * 60;
      ctx.fillStyle = '#56657a'; A.roundRect(ctx, cx - 60, 40, 120, 40, 10); ctx.fill(); ctx.fillStyle = '#0d1424'; A.roundRect(ctx, cx - 44, 48, 88, 24, 6); ctx.fill();
      A.text(ctx, 'Part 19', cx, 66, { size: 16, fam: 'mono', weight: 800, color: '#cfe8ff', align: 'center' });
      var sx = w * 0.5 + Math.sin(t * 1.3) * 80;
      for (var b = 0; b < 5; b++) { var by = (h * 0.75 - ((t * 400 + b * 40) % 160)); ctx.fillStyle = '#7ee0ff'; ctx.fillRect(sx - 1.5, by, 3, 12); }
      drawShip(ctx, sx, h * 0.8, 1.3, t, {});
      drawDrone(ctx, { x: w * 0.2 + Math.sin(t * 2) * 30, y: h * 0.45, seed: 1, flash: 0 }, t);
      drawDrone(ctx, { x: w * 0.82, y: h * 0.52 + Math.cos(t * 2) * 20, seed: 2, flash: 0 }, t);
      if (A.GL && A.GL.ok()) A.pill(ctx, 'REAL 3D', 14, 22, { size: 12, bg: 'rgba(0,0,0,.55)', color: '#f6d991', stroke: '#e6b85a' });
    },
    create: function (api) {
      var W = api.W, H = api.H, tier = api.difficulty, all = factsOf(api.data), bank = bossBank(api.data), t = 0, feel = A.feel, opts = api.opts || {};
      if (opts.fams && opts.fams.length) { var subF = all.filter(function (f) { return opts.fams.indexOf(f.fam) >= 0; }); if (subF.length >= 10) all = subF; }
      var SEC = opts.sectors > 0 ? Math.min(SECTORS, opts.sectors) : SECTORS, wavesRight = 0, platesBroken = 0;
      var coarse = false; try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
      var scene = null; if (A.GL && A.GL.ok() && A.GL.PatrolScene) { try { scene = new A.GL.PatrolScene({ mobile: coarse, reduce: feel.reduce, width: 520, height: 640 }); } catch (e) { console.error('[part-patrol] 3D failed, drawing in 2D', e); scene = null; } }
      var frames = 0, slow = 0, scale = 1, glW = 0, glH = 0;
      var ti = Math.max(0, ['recruit', 'regular', 'veteran', 'elite'].indexOf(tier.id));
      var ship = { x: W / 2, y: H * 0.82, shield: 3, inv: 0, fireT: 0, flash: 0, tx: null, ty: null };
      var bullets = [], eb = [], drones = [], carriers = [], powers = [], stars = [], boss = null;
      var sector = 1, wave = 0, phase = 'start', phaseT = 0.4, cur = null, streak = 0, droneT = 1.5;
      var spread = 0, rapid = 0, slow = 0, keysDrag = null;
      var DRONE_GAP = [3.2, 2.4, 1.8, 1.4][ti], SHOOT = [0, 0.15, 0.4, 0.6][ti], EB_SPEED = [130, 160, 200, 240][ti];
      api.progress.configure({ perLevel: 4 });
      for (var i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random(), l: i % 3 });

      function S() { return api.clamp(Math.min(W / 520, H / 640), 0.75, 1.35); }
      function slowK() { return slow > 0 ? 0.5 : 1; }

      // ---- waves ----
      function nextWave() {
        wave++;
        if (wave > WAVES) { startBoss(); return; }
        var lvl = api.progress.level, f = api.progress.pick(all, function (x) { return x.id; });
        var opts = A.shuffle([f].concat(decoys(all, f, lvl >= 3 ? 3 : 2, lvl))), n = opts.length, cw = api.clamp(W / (n + 0.6), 84, 150);
        carriers = opts.map(function (o, k) { return { label: label(o), ok: o === f, x: (k + 0.5) * W / n, y: -60, y0: -60, yt: H * 0.1 + (k % 2) * 26 * S(), enter: 0, shield: 1.8, hp: 8, max: 8, flash: 0, warned: false, alive: true, w: cw * 0.9, h: 46 * S(), ph: Math.random() * 6, warp: 0 }; });
        cur = { f: f };
        phase = 'wave';
        api.prompt.set({ kicker: 'Sector ' + sector + ' · wave ' + wave + ' of ' + WAVES + ' · ' + KICK[f.fam] + (f.__via === 'review' ? ' · missed before' : ''), text: f.prompt, sub: SUB[f.fam], color: '#8cc8ff', big: f.prompt.length < 40 });
        api.choices.clear();
        api.ready({ text: f.prompt, delay: 0.75 });
      }
      function waveDone(ok, given) {
        var f = cur.f; if (ok) wavesRight++;
        api.review.add({ prompt: KICK[f.fam] + ': ' + f.prompt, given: given, correct: label(f), ok: ok, explanation: f.why, cite: f.cite, key: f.id });
        carriers.forEach(function (c) { if (c.alive) c.warp = 0.001; if (c.ok && !ok) c.reveal = 2; });
        phase = 'between'; phaseT = ok ? 1.3 : 2.2;
      }
      function startBoss() {
        var plates = PLATES[sector - 1] || 3;
        boss = { x: W / 2, y: -H * 0.3, ty: H * 0.2, plates: plates, max: plates, enter: 0, t: 0, fireT: 2.5, flash: 0, turrets: [], q: null, order: null, dying: 0 };
        phase = 'boss'; api.audio.bigBoom(); api.shake(10);
        api.hud.set({ banner: 'WARNING · AUDIT DREADNOUGHT', sub: 'Shoot the turret lettered with the right answer.', color: '#ff6b6b', bannerTime: 2.6 });
        api.music.setIntense(true);
        bossQuestion();
      }
      function bossQuestion() {
        var q = api.progress.pick(bank, function (x) { return x.id; }), order = A.shuffle([0, 1, 2, 3]);
        boss.q = q; boss.order = order;
        boss.turrets = order.map(function (k, j) { return { letter: 'ABCD'[j], ok: !!q.options[k].correct, hp: 5, alive: true, flash: 0, fx: (j - 1.5) / 1.5, reveal: 0 }; });
        api.prompt.set({ kicker: 'Boss · Audit Dreadnought · armor ' + boss.plates + ' of ' + boss.max, text: q.stem, sub: 'Shoot the turret with the right answer letter.', color: '#ff8a8a' });
        api.choices.set(order.map(function (k, j) { return { text: q.options[k].text, tag: 'ABCD'[j] }; }), null, { readOnly: true });
        api.ready({ text: q.stem + ' ' + q.options.map(function (o) { return o.text; }).join(' '), delay: boss.enter < 1 ? 1.2 : 0.4 });
      }
      function turretPos(tu) { var bw = Math.min(W * 0.86, 560 * S()); return { x: boss.x + tu.fx * bw * 0.38, y: boss.y + 34 * S() }; }
      function bossAnswer(tu) {
        var q = boss.q, right = null; boss.order.forEach(function (k) { if (q.options[k].correct) right = q.options[k]; });
        var given = q.options[boss.order['ABCD'.indexOf(tu.letter)]];
        api.review.add({ prompt: q.stem, given: tu.letter + ': ' + given.text, correct: right.text, ok: tu.ok, explanation: right.why, cite: q.cite, lesson: q.lesson, qid: q.id, key: q.id });
        if (tu.ok) {
          boss.plates--; boss.flash = 0.3; streak++; platesBroken++; api.score(600 + streak * 50); api.progress.correct(); feel.buzz([20, 30, 50]);
          api.audio.bigBoom(); api.shake(12); api.flash('rgba(255,210,122,.4)');
          api.floaters.add('ARMOR BROKEN', boss.x, boss.y + 70 * S(), { size: 24, color: '#f6d991', life: 1.4 });
          if (boss.plates <= 0) { boss.dying = 0.001; api.choices.clear(); api.hud.set({ banner: 'DREADNOUGHT DESTROYED', sub: sector < SECTORS ? 'Sector ' + sector + ' clear' : 'Patrol complete', color: '#f6d991', bannerTime: 2.4 }); api.score(1500); return; }
        } else {
          streak = 0; api.audio.wrong(); boss.turrets.forEach(function (x) { if (x.ok) x.reveal = 2; });
          api.floaters.add('WRONG TURRET', boss.x, boss.y + 70 * S(), { size: 22, color: '#ff9c9c', life: 1.4 });
          api.life(-1); bossBarrage(14);
        }
        boss.next = tu.ok ? 1.2 : 2.2; boss.turrets.forEach(function (x) { x.alive = false; });
      }
      function bossBarrage(n) { for (var k = 0; k < n; k++) { var a = Math.PI / 2 + (k - (n - 1) / 2) * 0.14; eb.push({ x: boss.x, y: boss.y + 30 * S(), vx: Math.cos(a) * EB_SPEED * 1.1, vy: Math.sin(a) * EB_SPEED * 1.1, r: 5 }); } api.audio.laser(); }

      // ---- combat ----
      function hurt() {
        if (ship.inv > 0) return;
        ship.shield--; ship.inv = 1.1; ship.flash = 0.2; api.audio.hurt(); api.shake(feel.reduce() ? 0 : 6); feel.buzz([30, 40, 30]); if (scene) scene.flashAt(ship.x, ship.y, 2, new THREE.Color(2, 4, 5));
        api.particles.emit({ x: ship.x, y: ship.y, n: 16, color: ['#7ee0ff', '#fff'], speed: 220, gravity: 0, life: 0.5 });
        if (ship.shield < 0) { ship.shield = 3; ship.inv = 2.2; api.floaters.add('-1 ♥', ship.x, ship.y - 40, { size: 22, color: '#ff6b6b' }); api.life(-1); }
      }
      function boom(x, y, big, color) {
        if (scene) { scene.boom(x, y, big, color); if (big) feel.hitstop.hit(50); }
        api.particles.emit({ x: x, y: y, n: scene ? (big ? 24 : 6) : (big ? 70 : 18), color: [color || '#ffb347', '#fff3c4', '#ff6b4a'], speed: big ? 420 : 220, gravity: 0, life: big ? 1 : 0.5, size: big ? 7 : 4, drag: 0.95 });
        api.particles.ring(x, y, { color: color || '#ffd27a', grow: big ? 420 : 200, life: big ? 0.6 : 0.35, width: big ? 6 : 3 });
        if (big) api.audio.bigBoom(); else api.audio.pop();
        if (big) feel.buzz(30);
      }
      function killDrone(d, chain) {
        d.dead = true; api.score(15); boom(d.x, d.y, false);
        if (!chain && Math.random() < 0.12) { var keys = Object.keys(POWERS); powers.push({ x: d.x, y: d.y, k: keys[Math.floor(Math.random() * keys.length)], t: 0 }); }
      }

      function update(dt, rdt) {
        t += dt; var s = S(), K = api.input.keys, sk = slowK(); rdt = rdt || dt;
        if (scene) { shipVx = (ship.x - lastSx) / Math.max(0.001, dt); shipVy = (ship.y - lastSy) / Math.max(0.001, dt); lastSx = ship.x; lastSy = ship.y; scene.update(rdt, feel.hitstop.frozen()); frames++; if (rdt > 0.026) slow++; if (frames >= 90) { if (slow > 45 && scale > 0.6) { scale = scale > 0.8 ? 0.75 : 0.6; scene.setQuality(scale > 0.7 ? 1 : 0); } frames = 0; slow = 0; } }
        stars.forEach(function (st) { st.y += dt * (0.02 + st.l * 0.05) * (phase === 'between' ? 3 : 1); if (st.y > 1) { st.y -= 1; st.x = Math.random(); } });
        spread = Math.max(0, spread - dt); rapid = Math.max(0, rapid - dt); slow = Math.max(0, slow - dt);
        ship.inv = Math.max(0, ship.inv - dt); ship.flash = Math.max(0, ship.flash - dt);
        // move
        var mx = (K.has('ArrowRight') || K.has('d') || K.has('D') ? 1 : 0) - (K.has('ArrowLeft') || K.has('a') || K.has('A') ? 1 : 0);
        var my = (K.has('ArrowDown') || K.has('s') || K.has('S') ? 1 : 0) - (K.has('ArrowUp') || K.has('w') || K.has('W') ? 1 : 0);
        if (mx || my) { ship.tx = null; ship.x += mx * 380 * dt; ship.y += my * 340 * dt; }
        else if (ship.tx != null) { ship.x = A.lerp(ship.x, ship.tx, Math.min(1, dt * 12)); ship.y = A.lerp(ship.y, ship.ty, Math.min(1, dt * 12)); }
        ship.x = api.clamp(ship.x, 22, W - 22); ship.y = api.clamp(ship.y, H * 0.42, H - 26);
        // fire
        ship.fireT -= dt;
        if (ship.fireT <= 0 && phase !== 'start') {
          ship.fireT = rapid > 0 ? 0.09 : 0.17;
          var angs = spread > 0 ? [-0.2, 0, 0.2] : [0];
          angs.forEach(function (a) { bullets.push({ x: ship.x, y: ship.y - 22 * s, vx: Math.sin(a) * 640, vy: -Math.cos(a) * 640 }); });
          if (Math.random() < 0.5) api.audio.laser();
        }
        bullets.forEach(function (b) { b.x += b.vx * dt; b.y += b.vy * dt; });
        bullets = bullets.filter(function (b) { return b.y > -20 && b.x > -20 && b.x < W + 20 && !b.dead; });
        // drones
        if (phase === 'wave' || phase === 'boss') {
          droneT -= dt * sk;
          if (droneT <= 0) { droneT = DRONE_GAP * (0.7 + Math.random() * 0.6); var side = Math.random() < 0.5; drones.push({ x: Math.random() * W, y: -20, bx: Math.random() * W, amp: 40 + Math.random() * 90, sp: 70 + Math.random() * 60 + sector * 12, t: 0, seed: Math.random() * 6, flash: 0, fire: 1 + Math.random() * 2, swoop: side }); }
        }
        drones.forEach(function (d) {
          d.t += dt * sk; d.y += d.sp * dt * sk; d.x = d.bx + Math.sin(d.t * (d.swoop ? 2.2 : 1.3) + d.seed) * d.amp; d.flash = Math.max(0, d.flash - dt);
          d.fire -= dt * sk;
          if (d.fire <= 0) { d.fire = 2.2 + Math.random() * 2; if (Math.random() < SHOOT && d.y < ship.y - 80) { var a = Math.atan2(ship.y - d.y, ship.x - d.x); eb.push({ x: d.x, y: d.y, vx: Math.cos(a) * EB_SPEED, vy: Math.sin(a) * EB_SPEED, r: 4 }); } }
          if (A.dist(d.x, d.y, ship.x, ship.y) < 20 * s) { killDrone(d, true); hurt(); }
        });
        drones = drones.filter(function (d) { return !d.dead && d.y < H + 30; });
        eb.forEach(function (b) { b.x += b.vx * dt * sk; b.y += b.vy * dt * sk; if (A.dist(b.x, b.y, ship.x, ship.y) < b.r + 10 * s) { b.dead = true; hurt(); } });
        eb = eb.filter(function (b) { return !b.dead && b.y < H + 20 && b.y > -40 && b.x > -40 && b.x < W + 40; });
        // power-ups
        powers.forEach(function (p) { p.t += dt; p.y += 70 * dt; if (A.dist(p.x, p.y, ship.x, ship.y) < 24 * s) { p.dead = true; api.audio.powerup(); api.floaters.add(POWERS[p.k].name, p.x, p.y - 20, { size: 16, color: POWERS[p.k].color });
          if (p.k === 'S') spread = 10; else if (p.k === 'R') rapid = 10; else if (p.k === 'T') slow = 6; else ship.shield = 3; } });
        powers = powers.filter(function (p) { return !p.dead && p.y < H + 20; });
        // bullets vs drones
        bullets.forEach(function (b) { drones.forEach(function (d) { if (!d.dead && !b.dead && A.dist(b.x, b.y, d.x, d.y) < 14) { b.dead = true; d.flash = 0.08; killDrone(d, false); } }); });
        // carriers
        if (phase === 'wave' || phase === 'between') {
          var spd = H / 19 * (1 + (sector - 1) * 0.12);
          carriers.forEach(function (c, k) {
            c.flash = Math.max(0, c.flash - dt); c.bubble = Math.max(0, (c.bubble || 0) - dt); if (c.reveal) c.reveal = Math.max(0, c.reveal - dt);
            if (c.warp) { c.warp += dt; c.y -= 600 * dt * c.warp; return; }
            if (!c.alive) return;
            if (c.enter < 1) { c.enter = Math.min(1, c.enter + dt * 1.5); c.y = A.lerp(c.y0, c.yt, A.ease.outCubic(c.enter)); }   // fly in to where the labels can be read, then descend
            else { c.y += spd * dt * sk; c.shield = Math.max(0, c.shield - dt); }
            c.x += Math.sin(t * 0.9 + c.ph) * 18 * dt;
            c.x = api.clamp(c.x, c.w / 2 + 4, W - c.w / 2 - 4);
            if (phase === 'wave') {
              bullets.forEach(function (b) {
                if (b.dead || !c.alive || Math.abs(b.x - c.x) > c.w / 2 || Math.abs(b.y - c.y) > c.h / 2) return;
                b.dead = true;
                if (c.enter < 1 || c.shield > 0) { c.bubble = 0.15; api.particles.emit({ x: b.x, y: b.y, n: 3, color: ['#8cc8ff'], speed: 90, gravity: 0, life: 0.2, size: 3 }); return; }   // shielded while it flies in: read the labels first
                c.hp--; c.flash = 0.1; api.audio.hit(); if (scene) scene.sparks(b.x, b.y, 5);
                api.particles.emit({ x: b.x, y: b.y, n: scene ? 2 : 5, color: ['#cfe8ff', '#fff'], speed: 120, gravity: 0, life: 0.3, size: 3 });
                if (!c.ok && !c.warned) { c.warned = true; api.floaters.add('✗ NOT THIS ONE', c.x, c.y - c.h, { size: 15, color: '#ff9c9c', life: 1 }); }
                if (c.hp <= 0) {
                  c.alive = false; boom(c.x, c.y, true, c.ok ? '#5fd39a' : '#ff6b6b');
                  if (c.ok) {
                    streak++; var pts = 250 + streak * 50; api.score(pts); api.progress.correct(); api.audio.correct();
                    api.floaters.add('TARGET DOWN +' + pts, c.x, c.y - 30, { size: 22, color: '#f6d991', life: 1.3 });
                    drones.forEach(function (d) { killDrone(d, true); });
                    waveDone(true, c.label);
                  } else {
                    streak = 0; api.audio.wrong(); api.floaters.add('WRONG TARGET', c.x, c.y - 30, { size: 20, color: '#ff9c9c', life: 1.3 });
                    api.life(-1); waveDone(false, c.label);
                  }
                }
              });
              if (c.ok && c.y - c.h / 2 > H) { api.audio.alarm(); api.hud.set({ banner: 'TARGET ESCAPED', sub: 'It was ' + c.label, color: '#ffa552', bannerTime: 1.8 }); c.alive = false; streak = 0; api.life(-1); waveDone(false, '(escaped)'); }
            }
          });
          carriers = carriers.filter(function (c) { return c.alive || (c.warp && c.y > -120); });
        }
        // boss
        if (boss) {
          boss.t += dt; boss.flash = Math.max(0, boss.flash - dt);
          if (boss.enter < 1) { boss.enter = Math.min(1, boss.enter + dt * 0.5); boss.y = A.lerp(-H * 0.3, boss.ty, A.ease.outCubic(boss.enter)); }
          boss.x = W / 2 + Math.sin(boss.t * 0.5) * W * 0.06;
          if (boss.dying) {
            boss.dying += dt;
            if (Math.random() < 0.35) boom(boss.x + A.rand(-1, 1) * W * 0.3, boss.y + A.rand(-30, 40), Math.random() < 0.3, '#ffb347');
            if (boss.dying > 2.4) {
              boss = null; eb = []; api.music.setIntense(false);
              if (sector >= SEC) { finish(true); return; }
              sector++; wave = 0; phase = 'between'; phaseT = 1.2;
              api.hud.set({ banner: 'SECTOR ' + sector, sub: 'Faster drones, closer decoys.', color: '#8cc8ff', bannerTime: 2 });
            }
          } else if (boss.enter >= 1) {
            boss.fireT -= dt * sk;
            if (boss.fireT <= 0) { boss.fireT = [3.6, 2.8, 2.2, 1.7][ti]; bossBarrage(ti >= 2 ? 7 : 5); }
            if (boss.next) { boss.next -= dt; if (boss.next <= 0) { boss.next = 0; bossQuestion(); } }
            boss.turrets.forEach(function (tu) {
              tu.flash = Math.max(0, tu.flash - dt); tu.reveal = Math.max(0, tu.reveal - dt);
              if (!tu.alive) return; var p = turretPos(tu);
              bullets.forEach(function (b) {
                if (b.dead || !tu.alive || A.dist(b.x, b.y, p.x, p.y) > 24 * s) return;
                b.dead = true; tu.hp--; tu.flash = 0.08; api.audio.hit();
                if (tu.hp <= 0) { tu.alive = false; boom(p.x, p.y, true, tu.ok ? '#5fd39a' : '#ff6b6b'); bossAnswer(tu); }
              });
            });
          }
        }
        if (phase === 'between') { phaseT -= dt; if (phaseT <= 0 && !boss) nextWave(); }
        if (phase === 'start') { phaseT -= dt; if (phaseT <= 0) nextWave(); }
      }
      function finish(won) {
        api.end({ won: won, title: won ? 'Patrol complete' : 'Patrol over', message: 'You cleared ' + (won ? SEC : sector - 1) + ' of ' + SEC + ' sectors.', xpBonus: won ? 40 * SEC : 0, campaign: { value: wavesRight + platesBroken, of: SEC * WAVES + PLATES.slice(0, SEC).reduce(function (a, b) { return a + b; }, 0) },
          badge: won ? { icon: '🚀', name: 'Ace of the patrol', desc: (SEC === 1 ? 'The Audit Dreadnought is down.' : SEC + ' Audit Dreadnoughts down.'), color: '#8cc8ff' } : null });
      }

      function drawCarrier(ctx, c) {
        ctx.save(); ctx.translate(c.x, c.y);
        var w = c.w, hh = c.h, glow = c.reveal > 0;
        if (glow) { ctx.shadowColor = '#5fd39a'; ctx.shadowBlur = 26; }
        ctx.fillStyle = c.flash > 0 ? (c.ok ? '#fff' : '#ffb3b3') : '#56657a';
        ctx.beginPath(); ctx.moveTo(-w / 2, -hh * 0.2); ctx.lineTo(-w / 2 + 14, -hh / 2); ctx.lineTo(w / 2 - 14, -hh / 2); ctx.lineTo(w / 2, -hh * 0.2); ctx.lineTo(w / 2 - 8, hh / 2); ctx.lineTo(-w / 2 + 8, hh / 2); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#3d4a5c'; ctx.fillRect(-w / 2 + 4, hh * 0.18, w - 8, hh * 0.12);
        ctx.fillStyle = (Math.sin(t * 6 + c.ph) > 0) ? '#ff5d5d' : '#5c2020'; ctx.fillRect(-w / 2 + 6, -hh * 0.12, 4, 4); ctx.fillRect(w / 2 - 10, -hh * 0.12, 4, 4);
        ctx.fillStyle = glow ? '#0f3d27' : '#0d1424'; A.roundRect(ctx, -w / 2 + 12, -hh * 0.36, w - 24, hh * 0.56, 6); ctx.fill();
        var fs = A.fitText(ctx, c.label, w - 30, hh * 0.5, { max: 19, min: 11, fam: 'mono', weight: 800, maxLines: 1 });
        A.text(ctx, c.label, 0, -hh * 0.08, { size: fs, fam: 'mono', weight: 800, color: glow ? '#8ff0bd' : '#cfe8ff', align: 'center', baseline: 'middle' });
        for (var k = 0; k < c.max; k++) { ctx.fillStyle = k < c.hp ? '#8cc8ff' : 'rgba(255,255,255,.15)'; ctx.fillRect(-c.max * 4 + k * 8, hh / 2 + 4, 6, 3); }
        ctx.restore();
        if (c.alive && !c.warp && (c.enter < 1 || c.shield > 0)) { ctx.save(); ctx.globalAlpha = 0.35 + (c.bubble > 0 ? 0.4 : 0) + Math.sin(t * 8) * 0.08; ctx.strokeStyle = '#8cc8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w * 0.62, c.h * 0.95, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
        ctx.fillStyle = 'rgba(255,170,90,.8)'; ctx.beginPath(); ctx.moveTo(c.x - 10, c.y - c.h / 2); ctx.lineTo(c.x, c.y - c.h / 2 - 8 - Math.sin(t * 30) * 3); ctx.lineTo(c.x + 10, c.y - c.h / 2); ctx.fill();
      }
      function drawBoss(ctx) {
        var s = S(), bw = Math.min(W * 0.86, 560 * s), x = boss.x, y = boss.y;
        ctx.save(); if (boss.dying) ctx.globalAlpha = Math.max(0, 1 - boss.dying / 2.4);
        var hg = ctx.createLinearGradient(0, y - 60 * s, 0, y + 50 * s); hg.addColorStop(0, boss.flash > 0 ? '#fff' : '#4a5468'); hg.addColorStop(1, boss.flash > 0 ? '#fff' : '#252b3a'); ctx.fillStyle = hg;
        ctx.beginPath(); ctx.moveTo(x - bw / 2, y); ctx.lineTo(x - bw * 0.36, y - 50 * s); ctx.lineTo(x + bw * 0.36, y - 50 * s); ctx.lineTo(x + bw / 2, y); ctx.lineTo(x + bw * 0.4, y + 46 * s); ctx.lineTo(x - bw * 0.4, y + 46 * s); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(140,200,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
        for (var k = 0; k < boss.max; k++) { var px = x - (boss.max - 1) * 30 * s + k * 60 * s; ctx.fillStyle = k < boss.plates ? '#c9a24a' : '#3a2a20'; A.roundRect(ctx, px - 24 * s, y - 38 * s, 48 * s, 16 * s, 4); ctx.fill(); }
        var core = ctx.createRadialGradient(x, y - 4 * s, 2, x, y - 4 * s, 26 * s); core.addColorStop(0, '#fff'); core.addColorStop(0.4, '#ff6b4a'); core.addColorStop(1, 'rgba(255,107,74,0)'); ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y - 4 * s, 26 * s * (1 + Math.sin(boss.t * 5) * 0.08), 0, Math.PI * 2); ctx.fill();
        A.text(ctx, 'AUDIT DREADNOUGHT', x, y - 58 * s, { size: 12 * s, fam: 'mono', weight: 800, color: '#ffb3b3', align: 'center' });
        boss.turrets.forEach(function (tu) {
          var p = turretPos(tu); if (!tu.alive && !tu.reveal) return;
          ctx.save(); if (tu.reveal > 0) { ctx.shadowColor = '#5fd39a'; ctx.shadowBlur = 24; }
          ctx.fillStyle = !tu.alive ? '#2e5e44' : tu.flash > 0 ? '#fff' : '#3b4458'; ctx.beginPath(); ctx.arc(p.x, p.y, 22 * s, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = tu.reveal > 0 ? '#5fd39a' : '#8cc8ff'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
          if (tu.alive) { ctx.fillStyle = '#20263a'; ctx.fillRect(p.x - 3 * s, p.y + 16 * s, 6 * s, 14 * s); }
          A.text(ctx, tu.letter, p.x, p.y + 1, { size: 22 * s, fam: 'display', weight: 900, color: tu.reveal > 0 ? '#8ff0bd' : '#fff', align: 'center', baseline: 'middle' });
          if (tu.alive) for (var h2 = 0; h2 < 5; h2++) { ctx.fillStyle = h2 < tu.hp ? '#ff8a8a' : 'rgba(255,255,255,.15)'; ctx.fillRect(p.x - 15 * s + h2 * 6.4 * s, p.y - 32 * s, 4.6 * s, 3); }
        });
        ctx.restore();
      }

      function draw3D(ctx) {
        var cw = ctx.canvas.width, ch = ctx.canvas.height, dpr = Math.min(2, window.devicePixelRatio || 1), kq = Math.min(1, (coarse ? 1.5 : 2) / dpr) * scale;
        var gw = Math.round(cw * kq), gh = Math.round(ch * kq);
        if (gw !== glW || gh !== glH) { glW = gw; glH = gh; scene.resize(gw, gh); }
        scene.field(W, H);
        var bossW = Math.min(W * 0.86, 560 * S());
        scene.sync({ ship: { x: ship.x, y: ship.y, vx: shipVx, vy: shipVy, inv: ship.inv, flash: ship.flash, hidden: ship.inv > 0 && Math.floor(t * 16) % 2 === 1 }, bullets: bullets, eb: eb, drones: drones, carriers: carriers, powers: powers.map(function (p) { p.color = POWERS[p.k].color; return p; }), boss: boss ? { x: boss.x, y: boss.y, width: bossW, plates: boss.plates, max: boss.max, turrets: boss.turrets, flash: boss.flash, dying: boss.dying, enter: boss.enter } : null, between: phase === 'between' });
        scene.render(); ctx.drawImage(scene.canvas, 0, 0, W, H);
        hud(ctx);
      }
      var shipVx = 0, shipVy = 0, lastSx = 0, lastSy = 0;
      function hud(ctx) {
        for (var k = 0; k < 3; k++) { ctx.fillStyle = k < ship.shield ? '#7ee0ff' : 'rgba(255,255,255,.15)'; ctx.fillRect(12 + k * 16, H - 16, 12, 6); }
        A.text(ctx, 'SHIELD', 12, H - 22, { size: 10, fam: 'mono', weight: 800, color: '#9fb4c9' });
        var tags = []; if (spread > 0) tags.push('SPREAD ' + Math.ceil(spread)); if (rapid > 0) tags.push('RAPID ' + Math.ceil(rapid)); if (slow > 0) tags.push('SLOW ' + Math.ceil(slow));
        if (tags.length) A.text(ctx, tags.join(' · '), W - 12, H - 14, { size: 11, fam: 'mono', weight: 800, color: '#ffd166', align: 'right' });
        A.text(ctx, 'SECTOR ' + sector + (boss ? ' · BOSS' : ' · WAVE ' + Math.max(1, Math.min(wave, WAVES))), 12, 20, { size: 11, fam: 'mono', weight: 800, color: '#9fb4c9' });
        if (streak >= 2) A.text(ctx, 'STREAK ×' + streak, W - 12, 20, { size: 12, fam: 'mono', weight: 800, color: '#f6d991', align: 'right' });
        if (slow > 0) { ctx.fillStyle = 'rgba(140,200,255,.06)'; ctx.fillRect(0, 0, W, H); }
      }
      function draw(ctx) {
        if (scene) { draw3D(ctx); return; }
        var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#04050d'); g.addColorStop(1, '#10173a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        var nx = W * (0.7 + Math.sin(t * 0.05) * 0.1), ny = H * ((t * 0.01) % 1.4 - 0.2), ng = ctx.createRadialGradient(nx, ny, 10, nx, ny, W * 0.6);
        ng.addColorStop(0, 'rgba(185,140,255,.22)'); ng.addColorStop(1, 'rgba(185,140,255,0)'); ctx.fillStyle = ng; ctx.fillRect(0, 0, W, H);
        stars.forEach(function (st) { ctx.fillStyle = st.l === 2 ? '#fff' : st.l === 1 ? '#b8c6ff' : '#6d7aa8'; var sz = st.l + 1; ctx.fillRect(st.x * W, st.y * H, sz, sz * (phase === 'between' ? 4 : 1)); });
        if (slow > 0) { ctx.fillStyle = 'rgba(140,200,255,.06)'; ctx.fillRect(0, 0, W, H); }
        powers.forEach(function (p) { var c = POWERS[p.k]; ctx.save(); ctx.shadowColor = c.color; ctx.shadowBlur = 14; ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.restore(); A.text(ctx, p.k, p.x, p.y + 1, { size: 14, fam: 'display', weight: 900, color: '#10131c', align: 'center', baseline: 'middle' }); });
        carriers.forEach(function (c) { drawCarrier(ctx, c); });
        if (boss) drawBoss(ctx);
        drones.forEach(function (d) { drawDrone(ctx, d, t); });
        ctx.fillStyle = '#7ee0ff'; bullets.forEach(function (b) { ctx.fillRect(b.x - 1.5, b.y - 7, 3, 12); });
        eb.forEach(function (b) { ctx.save(); ctx.shadowColor = '#ff7ab6'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffb3d6'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
        var s = S();
        if (!(ship.inv > 0 && Math.floor(t * 16) % 2)) drawShip(ctx, ship.x, ship.y, s, t, { flash: ship.flash > 0 });
        if (ship.inv > 0) { ctx.strokeStyle = 'rgba(126,224,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ship.x, ship.y, 30 * s, 0, Math.PI * 2); ctx.stroke(); }
        for (var k = 0; k < 3; k++) { ctx.fillStyle = k < ship.shield ? '#7ee0ff' : 'rgba(255,255,255,.15)'; ctx.fillRect(12 + k * 16, H - 16, 12, 6); }
        A.text(ctx, 'SHIELD', 12, H - 22, { size: 10, fam: 'mono', weight: 800, color: '#9fb4c9' });
        var tags = []; if (spread > 0) tags.push('SPREAD ' + Math.ceil(spread)); if (rapid > 0) tags.push('RAPID ' + Math.ceil(rapid)); if (slow > 0) tags.push('SLOW ' + Math.ceil(slow));
        if (tags.length) A.text(ctx, tags.join(' · '), W - 12, H - 14, { size: 11, fam: 'mono', weight: 800, color: '#ffd166', align: 'right' });
        A.text(ctx, 'SECTOR ' + sector + (boss ? ' · BOSS' : ' · WAVE ' + Math.max(1, Math.min(wave, WAVES))), 12, 20, { size: 11, fam: 'mono', weight: 800, color: '#9fb4c9' });
        if (streak >= 2) A.text(ctx, 'STREAK ×' + streak, W - 12, 20, { size: 12, fam: 'mono', weight: 800, color: '#f6d991', align: 'right' });
      }

      function onPointer(e) {
        if (scene) { var lp = scene.toLogical(e.x / W * 2 - 1, -(e.y / H) * 2 + 1); if (lp) { e = { type: e.type, x: lp.x, y: lp.y, touch: e.touch }; } }
        if (e.touch) {
          if (e.type === 'down') keysDrag = { x: e.x, y: e.y, sx: ship.x, sy: ship.y };
          else if (e.type === 'move' && keysDrag) { ship.tx = keysDrag.sx + (e.x - keysDrag.x) * 1.3; ship.ty = keysDrag.sy + (e.y - keysDrag.y) * 1.3; }
          else if (e.type === 'up') keysDrag = null;
        } else if (e.type === 'move' || e.type === 'down') { ship.tx = e.x; ship.ty = Math.max(H * 0.42, e.y); }
      }

      return { update: update, draw: draw, onPointer: onPointer, resize: function (w, h) { var fx = ship.x / W, fy = ship.y / H; W = w; H = h; ship.x = fx * W; ship.y = fy * H; },
        destroy: function () { if (scene) scene.dispose(); },
        debug: function () { return { phase: phase, sector: sector, wave: wave, ship: ship, carriers: carriers, boss: boss }; },
        stats: function () { return { gl: !!scene, scene: scene, tri: scene && scene.tri, calls: scene && scene.calls, phase: phase, sector: sector, wave: wave, ship: [Math.round(ship.x), Math.round(ship.y)], carriers: carriers.map(function (c) { return { label: c.label, ok: c.ok, x: Math.round(c.x), y: Math.round(c.y), alive: c.alive, hp: c.hp }; }), boss: boss && { plates: boss.plates, turrets: boss.turrets.map(function (tu) { return [tu.letter, tu.ok, tu.alive]; }) }, wavesRight: wavesRight, platesBroken: platesBroken }; } };
    }
  });
})();
