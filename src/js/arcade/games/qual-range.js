/* GAME: qual-range — a pop-up target range for the glossary. The tower reads a clue (an expansion on level 1, a definition
   with the term blanked on levels 2 and 3); three or four silhouettes pop up downrange carrying terms. Engage the one that
   matches before they drop. 20 exposures and 30 rounds a table. Hits are scored like a rifle table scaled to 20 targets:
   18 Expert, 15 Sharpshooter, 12 Marksman. */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var EXPOSURES = 20, AMMO = 30;
  var EXPOSE = { recruit: 16, regular: 12, veteran: 9, elite: 7 };
  var SWAY = { recruit: 0, regular: 0, veteran: 5, elite: 9 };
  var ROWS = [{ z: 0.12, m: 50 }, { z: 0.3, m: 100 }, { z: 0.48, m: 150 }, { z: 0.66, m: 200 }, { z: 0.84, m: 300 }];

  function termsOf(D) { return ((D && D.terms) || []).filter(function (t) { return t && t.term && t.clue; }); }
  function badgeFor(hits) {
    if (hits >= 18) return { icon: '🏅', name: 'Expert', desc: hits + ' of ' + EXPOSURES + ' hits. Expert is 18 or more (36 of 40 on a rifle table).', color: '#f6d991' };
    if (hits >= 15) return { icon: '🥈', name: 'Sharpshooter', desc: hits + ' of ' + EXPOSURES + ' hits. 18 makes Expert.', color: '#c9d6e3' };
    if (hits >= 12) return { icon: '🥉', name: 'Marksman', desc: hits + ' of ' + EXPOSURES + ' hits. 15 makes Sharpshooter.', color: '#e0a36b' };
    return { icon: '🔁', name: 'Unqualified: re-fire', desc: hits + ' of ' + EXPOSURES + ' hits. 12 qualifies. Study the list below and re-fire.', color: '#ff9c9c' };
  }
  function drawSil(ctx, x, y, sc, up, color, outline) {
    // an E-type silhouette hinged at its base; up = 0 (down) .. 1 (up)
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc * Math.max(0.02, up));
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(-26, 0); ctx.lineTo(-26, -40); ctx.quadraticCurveTo(-24, -54, -10, -58); ctx.lineTo(-8, -62);
    ctx.arc(0, -72, 11, Math.PI * 0.72, Math.PI * 2.28); ctx.lineTo(10, -58); ctx.quadraticCurveTo(24, -54, 26, -40); ctx.lineTo(26, 0); ctx.closePath(); ctx.fill();
    if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 3 / sc; ctx.stroke(); }
    ctx.restore();
  }

  A.register({
    id: 'qual-range', title: 'Qual Range', icon: '🎯', accent: '#5fd39a', genre: 'Pop-up range', music: 'tense',
    tagline: 'Targets pop up carrying contracting terms. Read the clue from the tower and engage the right one before it drops.',
    drills: 'The 243-term glossary: acronyms and definitions',
    controls: 'Aim with the mouse and click to fire, or tap a target on a touch screen. Keyboard: left and right move between targets, Space or Enter fires. 20 exposures and 30 rounds: 18 hits for Expert, 15 Sharpshooter, 12 Marksman. On Veteran and Elite the sight sways, so time your shot.',
    aspect: [0.62, 2.3], gateAt: 'top', noLives: true, livesLabel: 'Rounds', outTitle: 'Out of ammunition',
    livesText: function (st) { return st.inst && st.inst.ammoText ? st.inst.ammoText() : ''; },
    dataOk: function (D) { return termsOf(D).length >= 20; },
    thumb: function (ctx, w, h, t) {
      var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7fb8dc'); g.addColorStop(0.42, '#d9eef6'); g.addColorStop(0.43, '#55803e'); g.addColorStop(1, '#2d4a22'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2f5a2f'; for (var i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc(i * 34, h * 0.42, 22 + (i % 3) * 6, Math.PI, 0); ctx.fill(); }
      var labs = ['BPA', 'IDIQ', 'COR'];
      labs.forEach(function (lab, k) {
        var x = w * (0.25 + k * 0.25), y = h * (0.62 + (k % 2) * 0.16), up = Math.max(0, Math.min(1, Math.sin(t * 1.4 + k * 1.3) * 1.6));
        ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.ellipse(x, y + 4, 44, 9, 0, 0, Math.PI * 2); ctx.fill();
        drawSil(ctx, x, y, 0.8, up, '#4b5320');
        if (up > 0.8) { ctx.fillStyle = '#fff'; A.roundRect(ctx, x - 30, y + 8, 60, 22, 4); ctx.fill(); A.text(ctx, lab, x, y + 24, { size: 15, fam: 'mono', weight: 800, color: '#1d2a15', align: 'center' }); }
      });
      var cx = w * 0.5 + Math.sin(t * 0.9) * w * 0.25, cy = h * 0.55 + Math.cos(t * 1.3) * 18;
      ctx.strokeStyle = '#ff5d5d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.moveTo(cx - 24, cy); ctx.lineTo(cx - 8, cy); ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 24, cy); ctx.moveTo(cx, cy - 24); ctx.lineTo(cx, cy - 8); ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 24); ctx.stroke();
    },
    create: function (api) {
      var W = api.W, H = api.H, tier = api.difficulty, terms = termsOf(api.data), t = 0;
      var n = 0, ammo = AMMO, hits = 0, streak = 0, targets = [], cur = null, phase = 'wait', phaseT = 0.2, expose = 0, exposeMax = 1;
      var aim = { x: W / 2, y: H * 0.6 }, focus = -1, kick = 0, muzzle = 0, tracer = null, lastTouch = false, flagT = 0, dust = [];
      var sway = SWAY[tier.id] || 0, first = true, lastCtx = null;
      api.progress.configure({ perLevel: 5 });

      function horizon() { return H * 0.36; }
      function rowY(z) { return horizon() + (H * 0.88 - horizon()) * Math.pow(1 - z, 1.35); }
      function rowScale(z) { return api.clamp(Math.min(W / 700, H / 520), 0.7, 1.5) * (1.2 - z * 0.72); }
      function laneX(lane, z) { var spread = W * (0.86 - z * 0.32); return W / 2 + (lane - 2) * spread / 4.4; }

      function pickDecoys(term, k) {
        var others = terms.filter(function (x) { return x.id !== term.id && x.term.toLowerCase() !== term.term.toLowerCase(); });
        var same = A.shuffle(others.filter(function (x) { return x.cat === term.cat && x.acronym === term.acronym; }));
        var like = A.shuffle(others.filter(function (x) { return x.acronym === term.acronym && same.indexOf(x) < 0; }));
        return same.concat(like, A.shuffle(others)).filter(function (x, i, arr) { return arr.indexOf(x) === i; }).slice(0, k);
      }
      function newExposure() {
        n++;
        if (n > EXPOSURES || ammo <= 0) { finish(); return; }
        var lvl = api.progress.level, pool = lvl <= 1 ? terms.filter(function (x) { return x.acronym && x.expansion; }) : terms;
        if (pool.length < 12) pool = terms;
        var term = api.progress.pick(pool, function (x) { return x.id; });
        var mode = lvl <= 1 && term.acronym && term.expansion ? 'exp' : 'def';
        var opts = A.shuffle([term].concat(pickDecoys(term, lvl >= 3 ? 3 : 2)));
        var lanes = A.shuffle([0, 1, 2, 3, 4]).slice(0, opts.length);
        var rows = lvl <= 1 ? [0, 1, 2] : lvl === 2 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
        targets = opts.map(function (o, i) { var row = ROWS[A.pick(rows)]; return { term: o, ok: o === term, lane: lanes[i], z: row.z, m: row.m, up: 0, state: 'rise', delay: i * 0.12, fall: 0, mark: '' }; });
        targets.sort(function (a, b) { return b.z - a.z; });
        cur = { term: term, mode: mode, text: mode === 'exp' ? term.expansion : term.clue };
        exposeMax = (EXPOSE[tier.id] || 11) + (mode === 'def' ? Math.min(6, cur.text.split(/\s+/).length * 0.12) : 0); expose = exposeMax;
        focus = -1; phase = 'up';
        api.prompt.set({ kicker: 'Tower · exposure ' + n + ' of ' + EXPOSURES + (term.__via === 'review' ? ' · missed before' : ''), text: cur.text, sub: mode === 'exp' ? 'Engage the target with the acronym for this.' : 'Engage the target with the term for this definition.' + (term.cat ? ' (' + term.cat + ')' : ''), color: '#5fd39a' });
        api.ready({ text: cur.text });
        api.audio.clank();
      }
      function finish() {
        var b = badgeFor(hits);
        api.end({ won: hits >= 12, title: b.name, message: 'You hit ' + hits + ' of ' + EXPOSURES + ' targets with ' + (AMMO - ammo) + ' rounds.', badge: b, xpBonus: hits * 4 + (hits >= 18 ? 60 : 0) });
      }
      function tPos(tg) { var sc = rowScale(tg.z); return { x: laneX(tg.lane, tg.z), y: rowY(tg.z), sc: sc }; }
      function placard(ctx, tg, p, draw) {
        var fs = api.clamp(15 * p.sc, 12, 22), label = tg.term.term;
        ctx.font = A.font(fs, 'mono', 800);
        var lane = W * (0.86 - tg.z * 0.32) / 4.4, w = Math.min(ctx.measureText(label).width + 16, Math.max(110 * p.sc, 96), Math.max(64, lane * 0.96)), lines = A.wrap(ctx, label, w - 12), hh = lines.length * fs * 1.15 + 10;
        var box = { x: p.x - w / 2, y: p.y + 6 * p.sc, w: w, h: hh };
        if (draw) {
          var col = tg.mark === 'ok' ? '#d8f7e6' : tg.mark === 'no' ? '#ffd6d6' : '#ffffff';
          ctx.save(); ctx.globalAlpha = Math.min(1, tg.up * 1.4);
          A.roundRect(ctx, box.x, box.y, box.w, box.h, 5); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = tg.mark === 'ok' ? '#2e9e66' : tg.mark === 'no' ? '#c0392b' : 'rgba(0,0,0,.4)'; ctx.lineWidth = tg.mark ? 3 : 1.5; ctx.stroke();
          ctx.fillStyle = '#16200f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          lines.forEach(function (ln, k) { ctx.fillText(ln, p.x, box.y + 5 + fs * 0.58 + k * fs * 1.15); });
          ctx.restore();
        }
        return box;
      }
      function hitTest(x, y) {
        var ctx = lastCtx, best = null;
        for (var i = targets.length - 1; i >= 0; i--) {
          var tg = targets[i]; if (tg.state !== 'up' || tg.up < 0.6) continue;
          var p = tPos(tg), sx = 28 * p.sc, top = p.y - 84 * p.sc;
          var inSil = x >= p.x - sx && x <= p.x + sx && y >= top && y <= p.y;
          var bx = ctx ? placard(ctx, tg, p, false) : null, inBox = bx && x >= bx.x - 4 && x <= bx.x + bx.w + 4 && y >= bx.y - 4 && y <= bx.y + bx.h + 4;
          if (inSil || inBox) { best = tg; break; }
        }
        return best;
      }
      function swayOff() { return sway && !lastTouch ? { x: Math.sin(t * 1.3) * sway + Math.sin(t * 3.1) * sway * 0.3, y: Math.cos(t * 1.7) * sway * 0.8 } : { x: 0, y: 0 }; }
      function shoot(px, py) {
        if (phase !== 'up' || ammo <= 0 || api.reading) return;
        var o = swayOff(), x = px + o.x, y = py + o.y;
        ammo--; api.hud.refreshLives(); kick = 1; muzzle = 0.08; tracer = { x: x, y: y, t: 0.12 };
        api.audio.shot();
        var tg = hitTest(x, y), term = cur.term;
        if (!tg) {
          api.audio.pop(); dust.push({ x: x, y: y, t: 0 });
          api.particles.emit({ x: x, y: y, n: 8, color: ['#8a6a48', '#b08a62'], speed: 90, gravity: 300, life: 0.5, size: 4 });
          api.floaters.add('MISS', x, y - 16, { size: 14, color: '#fff', life: 0.6 });
          if (ammo <= 0) { endExposure(null); }
          return;
        }
        tg.state = 'fall'; tg.mark = tg.ok ? 'ok' : 'no';
        var p = tPos(tg);
        api.particles.emit({ x: x, y: y, n: 14, color: ['#3d4420', '#6b7432', '#cfd8a0'], speed: 160, gravity: 260, life: 0.5, shape: 'square', size: 4 });
        if (tg.ok) {
          hits++; streak++; var pts = 100 + Math.round(expose / exposeMax * 100) + streak * 20 + (p.z > 0.6 ? 50 : 0);
          api.score(pts); api.progress.correct(); api.audio.correct();
          api.floaters.add('HIT +' + pts, p.x, p.y - 100 * p.sc, { size: 20, color: '#8ff0bd' });
          api.review.add({ prompt: cur.text, given: term.term, correct: term.term + (term.expansion ? ' (' + term.expansion + ')' : ''), ok: true, explanation: '', key: term.id });
          endExposure(true);
        } else {
          streak = 0; api.audio.wrong();
          api.floaters.add('WRONG TARGET', p.x, p.y - 100 * p.sc, { size: 18, color: '#ff9c9c' });
          targets.forEach(function (x2) { if (x2.ok) x2.mark = 'ok'; });
          api.review.add({ prompt: cur.text, given: tg.term.term, correct: term.term + (term.expansion ? ' (' + term.expansion + ')' : ''), ok: false, explanation: (tg.term.expansion ? tg.term.term + ' is ' + tg.term.expansion + '. ' : '') + 'The answer was ' + term.term + '.', key: term.id });
          endExposure(false);
        }
      }
      function endExposure(ok) {
        if (phase !== 'up') return;
        phase = 'down'; phaseT = ok ? 0.9 : 1.8;
        if (ok === null) {
          streak = 0; targets.forEach(function (x) { if (x.ok) x.mark = 'ok'; });
          var term = cur.term;
          api.review.add({ prompt: cur.text, given: '(no hit)', correct: term.term + (term.expansion ? ' (' + term.expansion + ')' : ''), ok: false, explanation: '', key: term.id });
          api.hud.set({ banner: ammo <= 0 ? 'Out of ammunition' : 'Targets down', sub: 'It was ' + term.term, color: '#ffa552', bannerTime: 1.6 });
        }
        targets.forEach(function (x) { if (x.state === 'up' || x.state === 'rise') { x.state = 'fall'; x.delay = x.ok && ok === false ? 0.6 : 0.15; } });
      }

      function update(dt) {
        t += dt; kick = Math.max(0, kick - dt * 5); muzzle = Math.max(0, muzzle - dt); flagT += dt;
        if (first) { first = false; api.hud.refreshLives(); }
        if (tracer) { tracer.t -= dt; if (tracer.t <= 0) tracer = null; }
        dust = dust.filter(function (d) { d.t += dt; return d.t < 0.6; });
        targets.forEach(function (tg) {
          if (tg.delay > 0) { tg.delay -= dt; return; }
          if (tg.state === 'rise') { tg.up = Math.min(1, tg.up + dt * 4.5); if (tg.up >= 1) tg.state = 'up'; }
          else if (tg.state === 'fall') { tg.up = Math.max(0, tg.up - dt * 3.2); }
        });
        if (phase === 'up') {
          expose -= dt;
          if (expose <= 0) endExposure(null);
          if (focus >= 0) { var live = targets.filter(function (x) { return x.state === 'up' || x.state === 'rise'; }).sort(function (a, b) { return tPos(a).x - tPos(b).x; }); var ft = live[Math.min(focus, live.length - 1)]; if (ft) { var p = tPos(ft); aim.x = A.lerp(aim.x, p.x, Math.min(1, dt * 14)); aim.y = A.lerp(aim.y, p.y - 44 * p.sc, Math.min(1, dt * 14)); } }
        } else if (phase === 'down') { phaseT -= dt; if (phaseT <= 0) newExposure(); }
        else if (phase === 'wait') { phaseT -= dt; if (phaseT <= 0) newExposure(); }
      }

      function draw(ctx) {
        lastCtx = ctx;
        var hz = horizon(), g = ctx.createLinearGradient(0, 0, 0, hz);
        g.addColorStop(0, '#78b3d9'); g.addColorStop(1, '#dceff7'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 2);
        ctx.fillStyle = 'rgba(255,255,255,.75)'; [[0.2, 0.12, 60], [0.55, 0.08, 80], [0.82, 0.16, 50]].forEach(function (c) { var cx = ((c[0] + t * 0.004) % 1.2) * W; ctx.beginPath(); ctx.ellipse(cx, c[1] * H, c[2], c[2] * 0.3, 0, 0, Math.PI * 2); ctx.ellipse(cx + c[2] * 0.6, c[1] * H - c[2] * 0.1, c[2] * 0.6, c[2] * 0.28, 0, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = '#2f5a2f'; for (var i = 0; i < W / 26 + 2; i++) { ctx.beginPath(); ctx.arc(i * 26, hz, 16 + (i * 7 % 3) * 6, Math.PI, 0); ctx.fill(); }
        ctx.fillStyle = '#244a26'; for (i = 0; i < W / 40 + 2; i++) { ctx.beginPath(); ctx.arc(i * 40 + 13, hz + 2, 12 + (i * 5 % 4) * 4, Math.PI, 0); ctx.fill(); }
        var fg = ctx.createLinearGradient(0, hz, 0, H); fg.addColorStop(0, '#5f8a45'); fg.addColorStop(1, '#2c4a20'); ctx.fillStyle = fg; ctx.fillRect(0, hz, W, H - hz);
        // lane bands converging on the horizon
        for (var l = 0; l <= 5; l++) {
          var xTop = W / 2 + (l - 2.5) * W * 0.54 / 4.4, xBot = W / 2 + (l - 2.5) * W * 1.06 / 4.4;
          ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xTop, hz); ctx.lineTo(xBot, H); ctx.stroke();
        }
        ROWS.forEach(function (r) {
          var y = rowY(r.z), sc = rowScale(r.z);
          ctx.fillStyle = 'rgba(122,90,58,.85)'; ctx.beginPath(); ctx.ellipse(W / 2, y + 6 * sc, W * (0.5 - r.z * 0.18), 7 * sc, 0, 0, Math.PI * 2); ctx.fill();
          A.text(ctx, r.m + ' m', 10, y + 4, { size: api.clamp(11 * sc, 10, 14), weight: 800, color: 'rgba(255,255,255,.75)' });
        });
        // range flag
        var fx = W - 30, fy = hz - 30; ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, hz + 30); ctx.stroke();
        ctx.fillStyle = '#e03b3b'; ctx.beginPath(); ctx.moveTo(fx, fy); for (var k = 0; k <= 6; k++) ctx.lineTo(fx - k * 5, fy + 3 + Math.sin(flagT * 6 + k) * 2); for (k = 6; k >= 0; k--) ctx.lineTo(fx - k * 5, fy + 15 + Math.sin(flagT * 6 + k) * 2); ctx.closePath(); ctx.fill();
        dust.forEach(function (d) { ctx.fillStyle = 'rgba(160,130,95,' + (0.6 - d.t) + ')'; ctx.beginPath(); ctx.arc(d.x, d.y, 4 + d.t * 20, 0, Math.PI * 2); ctx.fill(); });
        // targets, far to near
        targets.forEach(function (tg) {
          if (tg.up <= 0.01) return;
          var p = tPos(tg), focused = false;
          if (phase === 'up' && focus >= 0) { var live = targets.filter(function (x) { return x.state === 'up' || x.state === 'rise'; }).sort(function (a, b) { return tPos(a).x - tPos(b).x; }); focused = live[Math.min(focus, live.length - 1)] === tg; }
          var col = tg.mark === 'ok' ? '#2e9e66' : tg.mark === 'no' ? '#a33' : '#4b5320';
          drawSil(ctx, p.x, p.y, p.sc, A.ease.outBack(Math.min(1, tg.up)), col, focused ? '#fff' : (tg.mark === 'ok' && tg.state !== 'fall' ? '#bff7da' : null));
          placard(ctx, tg, p, true);
        });
        // expose timer
        if (phase === 'up') { var tw = Math.min(260, W * 0.4), frac = Math.max(0, expose / exposeMax); ctx.fillStyle = 'rgba(0,0,0,.35)'; A.roundRect(ctx, W / 2 - tw / 2, 10, tw, 8, 4); ctx.fill(); ctx.fillStyle = frac < 0.25 ? '#ff6b6b' : '#5fd39a'; A.roundRect(ctx, W / 2 - tw / 2, 10, tw * frac, 8, 4); ctx.fill(); }
        // scorecard
        ctx.fillStyle = 'rgba(0,0,0,.45)'; A.roundRect(ctx, 10, 10, 148, 50, 10); ctx.fill();
        A.text(ctx, 'HITS ' + hits + ' / ' + EXPOSURES, 22, 31, { size: 14, fam: 'mono', weight: 800, color: '#8ff0bd' });
        A.text(ctx, 'TARGET ' + Math.min(n, EXPOSURES) + ' · ' + ammo + ' RDS', 22, 50, { size: 11, fam: 'mono', weight: 700, color: '#dfe6e1' });
        if (streak >= 3) A.text(ctx, 'STREAK ×' + streak, W - 16, 31, { size: 14, fam: 'mono', weight: 800, color: '#f6d991', align: 'right', stroke: 'rgba(0,0,0,.5)', strokeWidth: 3 });
        // tracer and muzzle flash
        if (tracer) { ctx.save(); ctx.globalAlpha = tracer.t / 0.12; ctx.strokeStyle = '#fff6c4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2, H); ctx.lineTo(tracer.x, tracer.y); ctx.stroke(); ctx.restore(); }
        if (muzzle > 0) { var mg = ctx.createRadialGradient(W / 2, H, 4, W / 2, H, 120); mg.addColorStop(0, 'rgba(255,240,180,.9)'); mg.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = mg; ctx.fillRect(W / 2 - 120, H - 120, 240, 120); }
        // sight
        if (phase === 'up' && !api.reading && (!lastTouch || focus >= 0)) {
          var o = swayOff(), cx = aim.x + o.x, cy = aim.y + o.y - kick * 14;
          ctx.save(); ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2.5; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.moveTo(cx - 24, cy); ctx.lineTo(cx - 7, cy); ctx.moveTo(cx + 7, cy); ctx.lineTo(cx + 24, cy); ctx.moveTo(cx, cy - 24); ctx.lineTo(cx, cy - 7); ctx.moveTo(cx, cy + 7); ctx.lineTo(cx, cy + 24); ctx.stroke();
          ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }

      function onPointer(e) {
        lastTouch = !!e.touch;
        if (e.type === 'move' && !e.touch) { aim.x = e.x; aim.y = e.y; focus = -1; }
        if (e.type === 'down') { aim.x = e.x; aim.y = e.y; focus = -1; shoot(e.x, e.y); }
      }
      // keyboard: left and right step the sight between targets (left to right), Space fires at the one in the sight
      function onKey(k, down) {
        if (!down || phase !== 'up') return;
        var live = targets.filter(function (x) { return x.state === 'up' || x.state === 'rise'; }).sort(function (a, b) { return tPos(a).x - tPos(b).x; });
        if (!live.length) return;
        if (k === 'ArrowRight' || k === 'd' || k === 'D') { lastTouch = false; focus = focus < 0 ? 0 : (focus + 1) % live.length; api.audio.tick(); }
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') { lastTouch = false; focus = focus < 0 ? live.length - 1 : (focus + live.length - 1) % live.length; api.audio.tick(); }
        if (k === ' ' || k === 'Enter') {
          lastTouch = false; if (focus < 0) focus = 0;
          var p = tPos(live[Math.min(focus, live.length - 1)]); aim.x = p.x; aim.y = p.y - 44 * p.sc; shoot(aim.x, aim.y);
        }
      }

      return {
        update: update, draw: draw, onPointer: onPointer, onKey: onKey,
        resize: function (w, h) { W = w; H = h; },
        ammoText: function () { return ammo + ' / ' + AMMO; }
      };
    }
  });
})();
