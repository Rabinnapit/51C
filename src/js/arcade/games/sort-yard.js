/* GAME: sort-yard — a warehouse sorting line. Crates roll down the conveyor carrying a task, a purchase, a UCF section or a
   contract type; flip the diverter and drop each into the right bay before it reaches the end of the belt. Four shifts, one
   per sorting line (life-cycle phase, dollar thresholds, UCF parts, contract-type families), seven crates each. Five right in
   a row starts a Rush: a faster belt and double points until the next miss. A wrong bay costs a life. */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var CRATES = 7, ORDER = ['phase', 'dollars', 'ucf', 'types'];
  var BELT = [6.4, 5.6, 4.8];   // seconds from the top of the belt to the diverter, by question level

  function linesOf(D) { var ls = ((D && D.sorts) || []).filter(function (l) { return l && l.bins && l.bins.length >= 2 && l.items && l.items.length >= 6; }); return ls.sort(function (a, b) { var ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id); return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib); }); }

  function drawCrate(ctx, x, y, w, hh, text, fs, o) {
    o = o || {};
    ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.scale) ctx.scale(o.scale, o.scale);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; A.roundRect(ctx, -w / 2 + 5, -hh / 2 + 7, w, hh, 6); ctx.fill();
    var g = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2); g.addColorStop(0, o.tint || '#c99a62'); g.addColorStop(1, o.tint ? o.tint : '#a97a45'); ctx.fillStyle = g;
    A.roundRect(ctx, -w / 2, -hh / 2, w, hh, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(70,45,20,.55)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(230,205,160,.55)'; ctx.fillRect(-w / 2, -6, w, 12);
    ctx.fillStyle = 'rgba(60,40,20,.5)'; ctx.font = A.font(9, 'mono', 800); ctx.textAlign = 'left'; ctx.fillText(o.tag || 'B2B · HANDLE WITH CARE', -w / 2 + 8, -hh / 2 + 13);
    ctx.fillStyle = '#2f2112'; ctx.font = A.font(fs, 'body', 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var lines = A.wrap(ctx, text, w - 26), lh = fs * 1.2, y0 = -((lines.length - 1) * lh) / 2 + 6;
    lines.forEach(function (ln, k) { ctx.fillStyle = 'rgba(255,240,215,.55)'; ctx.fillRect(-ctx.measureText(ln).width / 2 - 4, y0 + k * lh - fs * 0.6, ctx.measureText(ln).width + 8, fs * 1.15); ctx.fillStyle = '#2f2112'; ctx.fillText(ln, 0, y0 + k * lh); });
    ctx.restore();
  }

  A.register({
    id: 'sort-yard', title: 'Sort Yard', icon: '📦', accent: '#e6b85a', genre: 'Sorting line', music: 'drive',
    tagline: 'Crates roll down the line. Flip the diverter and drop each one in the right bay before the next one comes.',
    drills: 'Life-cycle phases, dollar thresholds, UCF parts, contract-type families',
    controls: 'Left and right (or A and D) move the diverter; Down, Space or Enter drops the crate now for a speed bonus. Number keys 1 to 4 drop straight into that bay. Tap or click a bay to send the crate there. Five right in a row starts a Rush: faster belt, double points.',
    aspect: [0.55, 1.9], gateAt: 'middle',
    dataOk: function (D) { return linesOf(D).length >= 2; },
    thumb: function (ctx, w, h, t) {
      var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1d2428'); g.addColorStop(1, '#0d1114'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      var lg = ctx.createRadialGradient(w / 2, 0, 10, w / 2, 40, 200); lg.addColorStop(0, 'rgba(255,220,150,.3)'); lg.addColorStop(1, 'rgba(255,220,150,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2a3136'; ctx.fillRect(w / 2 - 90, 0, 180, h * 0.62);
      ctx.strokeStyle = '#3c454b'; ctx.lineWidth = 3; for (var y = (t * 60) % 18; y < h * 0.62; y += 18) { ctx.beginPath(); ctx.moveTo(w / 2 - 86, y); ctx.lineTo(w / 2 + 86, y); ctx.stroke(); }
      var cy = ((t * 0.45) % 1) * h * 0.5;
      drawCrate(ctx, w / 2, cy + 10, 150, 54, 'Debrief the offeror', 14, {});
      var cols = ['#82b6ef', '#f0b863', '#6fd3d9'], labs = ['Pre-Award', 'Award', 'Post-Award'], sel = Math.floor(t * 0.6) % 3;
      for (var i = 0; i < 3; i++) { var bx = w * (0.18 + i * 0.32); ctx.fillStyle = '#20282d'; A.roundRect(ctx, bx - 62, h * 0.72, 124, h * 0.25, 8); ctx.fill(); ctx.fillStyle = cols[i]; ctx.fillRect(bx - 62, h * 0.72, 124, 6); A.text(ctx, labs[i], bx, h * 0.86, { size: 15, weight: 800, color: i === sel ? '#fff' : '#a9b4ba', align: 'center' }); }
      ctx.save(); ctx.translate(w / 2, h * 0.64); ctx.rotate((sel - 1) * 0.6); ctx.fillStyle = '#e6b85a'; ctx.fillRect(-6, 0, 12, 40); ctx.restore();
    },
    create: function (api) {
      var W = api.W, H = api.H, tier = api.difficulty, lines = linesOf(api.data), t = 0;
      var shift = -1, line = null, k = 0, crate = null, sel = 1, armAng = 0, streak = 0, rush = false, flashBay = -1, flashT = 0, flashOk = false;
      var falling = [], sparks = [], phase = 'start', phaseT = 0.3, rollerT = 0, forkX = 0.2, forkDir = 1, sorted = 0;
      api.progress.configure({ perLevel: 5 });

      function bays() {
        var n = line ? line.bins.length : 3, gap = Math.max(8, W * 0.02), bw = (W - gap * (n + 1)) / n, top = H * 0.72, hh = H * 0.96 - top;
        var out = []; for (var i = 0; i < n; i++) out.push({ x: gap + i * (bw + gap), y: top, w: bw, h: hh, cx: gap + i * (bw + gap) + bw / 2 });
        return out;
      }
      function beltW() { return Math.min(W * 0.8, 560); }
      function junctionY() { return H * 0.6; }
      function crateSize(text) {
        var w = beltW() * 0.92, fs = api.clamp(Math.min(W / 30, 20), 14, 20), ctx = scratch();
        ctx.font = A.font(fs, 'body', 800); var n = A.wrap(ctx, text, w - 26).length;
        return { w: w, h: Math.max(64, n * fs * 1.2 + 34), fs: fs };
      }
      var scratchCtx = null; function scratch() { if (!scratchCtx) scratchCtx = document.createElement('canvas').getContext('2d'); return scratchCtx; }

      function nextShift() {
        shift++;
        if (shift >= lines.length) { finish(); return; }
        line = lines[shift]; k = 0; sel = Math.floor((line.bins.length - 1) / 2);
        api.hud.set({ banner: 'Shift ' + (shift + 1) + ': ' + line.title, sub: line.ask, color: '#e6b85a', bannerTime: 1.5 });
        api.audio.alarm();
        phase = 'gap'; phaseT = 1.4;
      }
      function nextCrate() {
        k++;
        if (k > CRATES) { nextShift(); return; }
        var it = api.progress.pick(line.items, function (x) { return x.id; }), sz = crateSize(it.text);
        var travel = BELT[Math.min(api.progress.level, 3) - 1] * (rush ? 0.8 : 1);
        crate = { it: it, y: sz.h / 2 + 6, y0: sz.h / 2 + 6, w: sz.w, h: sz.h, fs: sz.fs, t: 0, T: travel, pop: 0 };
        phase = 'belt';
        api.prompt.set({ kicker: 'Shift ' + (shift + 1) + ' of ' + lines.length + ' · ' + line.title + ' · crate ' + k + ' of ' + CRATES + (it.__via === 'review' ? ' · missed before' : ''), text: it.text, sub: line.ask, color: '#e6b85a' });
        api.ready({ text: it.text, delay: 0.25 });
      }
      function drop(bayIx, early) {
        if (phase !== 'belt' || !crate) return;
        if (bayIx != null) sel = bayIx;
        var b = bays()[sel], bin = line.bins[sel], it = crate.it, ok = bin.id === it.bin, right = line.bins.filter(function (x) { return x.id === it.bin; })[0];
        var frac = api.clamp(1 - crate.t / crate.T, 0, 1);
        falling.push({ x: W / 2, y: crate.y, tx: b.cx, ty: b.y + b.h * 0.45, t: 0, w: crate.w, h: crate.h, fs: crate.fs, text: it.text, ok: ok });
        api.audio.whoosh();
        api.review.add({ prompt: line.ask + ' ' + it.text, given: bin.label, correct: right ? right.label : it.bin, ok: ok, explanation: it.why, cite: it.cite, key: it.id });
        sorted++;
        if (ok) {
          streak++; var pts = Math.round((100 + (early ? frac * 120 : 0) + streak * 15) * (rush ? 2 : 1));
          api.score(pts); api.progress.correct();
          api.floaters.add('+' + pts, b.cx, b.y - 20, { size: 22, color: rush ? '#ff7ab6' : '#f6d991' });
          if (streak >= 5 && !rush) { rush = true; api.music.setIntense(true); api.hud.set({ banner: 'RUSH!', sub: 'Faster belt, double points until a miss.', color: '#ff7ab6', bannerTime: 1.6 }); api.audio.levelUp(); }
        } else {
          streak = 0; if (rush) { rush = false; api.music.setIntense(false); }
          api.hud.set({ banner: 'Wrong bay', sub: 'It goes to ' + (right ? right.label : it.bin), color: '#ff6b6b', bannerTime: 2 });
          api.life(-1);
        }
        flashBay = ok ? sel : line.bins.indexOf(right); flashOk = ok; flashT = ok ? 0.6 : 1.4;
        crate = null; phase = 'gap'; phaseT = ok ? 0.45 : 1.2;
      }
      function finish() {
        var right = api.progress.right, pct = sorted ? Math.round(right / sorted * 100) : 0, badge;
        if (pct >= 90) badge = { icon: '🏗️', name: 'Yard Boss', desc: right + ' of ' + sorted + ' crates in the right bay.', color: '#f6d991' };
        else if (pct >= 75) badge = { icon: '📦', name: 'Shift Lead', desc: right + ' of ' + sorted + ' right. 90% makes Yard Boss.', color: '#e6b85a' };
        else badge = { icon: '🦺', name: 'Sorter in training', desc: right + ' of ' + sorted + ' right. Study the list below, then run another shift.', color: '#c2cdc6' };
        api.end({ won: true, title: 'Shifts complete', message: 'You sorted ' + sorted + ' crates (' + pct + '% right).', badge: badge, xpBonus: Math.round(pct / 2) });
      }

      function update(dt) {
        t += dt; rollerT += dt * (rush ? 1.4 : 1); flashT = Math.max(0, flashT - dt);
        forkX += forkDir * dt * 0.05; if (forkX > 0.85 || forkX < 0.1) forkDir *= -1;
        var target = line ? (sel - (line.bins.length - 1) / 2) * 0.55 : 0; armAng = A.lerp(armAng, target, Math.min(1, dt * 14));
        if (phase === 'start') { phaseT -= dt; if (phaseT <= 0) nextShift(); }
        else if (phase === 'gap') { phaseT -= dt; if (phaseT <= 0) nextCrate(); }
        else if (phase === 'belt' && crate) {
          crate.t += dt; crate.pop = Math.min(1, crate.pop + dt * 5); crate.y = A.lerp(crate.y0, junctionY() - crate.h / 2 - 10, Math.min(1, crate.t / crate.T));
          if (crate.t >= crate.T) drop(null, false);
        }
        falling = falling.filter(function (f) {
          f.t += dt; var u = Math.min(1, f.t / 0.38);
          if (u >= 1 && !f.landed) {
            f.landed = true;
            if (f.ok) { api.particles.emit({ x: f.tx, y: f.ty, n: 26, color: ['#f6d991', '#5fd39a', '#fff', '#8cc8ff'], speed: 260, gravity: 420, life: 0.9, shape: 'square', size: 5 }); api.audio.correct(); api.audio.thud(); }
            else { api.particles.emit({ x: f.tx, y: f.ty, n: 22, color: ['#ffd166', '#ff8a3d', '#fff3c4'], speed: 300, gravity: 300, life: 0.5, shape: 'spark', size: 6 }); api.audio.wrong(); api.audio.clank(); api.shake(8); }
          }
          return f.t < (f.ok ? 0.55 : 0.9);
        });
      }

      function draw(ctx) {
        var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d2428'); g.addColorStop(1, '#0c1013'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#161c20'; for (var b = 0; b < 6; b++) ctx.fillRect(b * W / 5 - 8, 0, 16, H * 0.7);
        ctx.fillStyle = '#232b30'; ctx.fillRect(0, H * 0.18, W, 10);
        // forklift in the back
        var fx = forkX * W, fy = H * 0.5; ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#e6b85a'; ctx.fillRect(fx - 26, fy - 22, 40, 22); ctx.fillStyle = '#0c1013'; ctx.fillRect(fx - 18, fy - 40, 4, 18); ctx.fillRect(fx + 14 * forkDir, fy - 36, 4, 36); ctx.fillRect(fx + 14 * forkDir, fy - 2, 22 * forkDir, 3);
        ctx.beginPath(); ctx.arc(fx - 16, fy, 6, 0, Math.PI * 2); ctx.arc(fx + 8, fy, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        // lamps
        [0.2, 0.5, 0.8].forEach(function (lx) { var x = lx * W, lg = ctx.createRadialGradient(x, 0, 4, x, H * 0.25, H * 0.55); lg.addColorStop(0, rush ? 'rgba(255,122,182,.28)' : 'rgba(255,220,150,.22)'); lg.addColorStop(1, 'rgba(255,220,150,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x - 10, 0); ctx.lineTo(x + W * 0.16, H * 0.7); ctx.lineTo(x - W * 0.16, H * 0.7); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#3a4248'; ctx.fillRect(x - 12, 0, 24, 8); });
        // belt
        var bw = beltW(), jx = W / 2, jy = junctionY();
        ctx.fillStyle = '#2a3136'; ctx.fillRect(jx - bw / 2, 0, bw, jy); ctx.fillStyle = '#596269'; ctx.fillRect(jx - bw / 2 - 8, 0, 8, jy); ctx.fillRect(jx + bw / 2, 0, 8, jy);
        ctx.strokeStyle = '#3c454b'; ctx.lineWidth = 3; var step = 22, off = (rollerT * (rush ? 90 : 60)) % step;
        for (var y = off; y < jy; y += step) { ctx.beginPath(); ctx.moveTo(jx - bw / 2 + 4, y); ctx.lineTo(jx + bw / 2 - 4, y); ctx.stroke(); }
        ctx.fillStyle = 'rgba(230,184,90,.35)'; for (y = off * 2 % 60; y < jy; y += 60) { ctx.beginPath(); ctx.moveTo(jx - 14, y); ctx.lineTo(jx, y + 12); ctx.lineTo(jx + 14, y); ctx.lineTo(jx + 14, y + 6); ctx.lineTo(jx, y + 18); ctx.lineTo(jx - 14, y + 6); ctx.closePath(); ctx.fill(); }
        // hazard floor
        var bs = bays(), top = bs.length ? bs[0].y : H * 0.72;
        for (var x = -20; x < W + 20; x += 24) { ctx.fillStyle = ((x / 24) | 0) % 2 ? '#e6b85a' : '#1a1a1a'; ctx.beginPath(); ctx.moveTo(x, top - 16); ctx.lineTo(x + 12, top - 16); ctx.lineTo(x + 24, top - 6); ctx.lineTo(x + 12, top - 6); ctx.closePath(); ctx.fill(); }
        // bays
        if (line) bs.forEach(function (bb, i) {
          var bin = line.bins[i], on = i === sel && phase === 'belt', fl = flashT > 0 && flashBay === i;
          ctx.fillStyle = '#20282d'; A.roundRect(ctx, bb.x, bb.y, bb.w, bb.h, 10); ctx.fill();
          ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,.1)'; ctx.lineWidth = on ? 3 : 1; ctx.stroke();
          if (fl) { ctx.save(); ctx.globalAlpha = Math.min(1, flashT * 2); ctx.fillStyle = flashOk ? 'rgba(95,211,154,.35)' : 'rgba(95,211,154,.25)'; A.roundRect(ctx, bb.x, bb.y, bb.w, bb.h, 10); ctx.fill(); ctx.restore(); }
          ctx.save(); ctx.shadowColor = bin.color || '#e6b85a'; ctx.shadowBlur = on ? 18 : 6; ctx.fillStyle = bin.color || '#e6b85a'; A.roundRect(ctx, bb.x + 8, bb.y + 6, bb.w - 16, 6, 3); ctx.fill(); ctx.restore();
          var showSub = bin.sub && (line.id !== 'dollars' || api.progress.level <= 1);
          var fs = A.fitText(ctx, bin.label, bb.w - 16, bb.h * 0.5, { max: 19, min: 11, weight: 800, maxLines: 2 });
          A.text(ctx, bin.label, bb.cx, bb.y + bb.h * (showSub ? 0.42 : 0.52), { size: fs, weight: 800, color: on ? '#fff' : '#c9d2d7', align: 'center', maxWidth: bb.w - 16, vcenter: true, lineHeight: fs * 1.15 });
          if (showSub) A.text(ctx, bin.sub, bb.cx, bb.y + bb.h * 0.78, { size: api.clamp(fs * 0.72, 10, 14), weight: 700, color: '#8b978f', align: 'center', maxWidth: bb.w - 12 });
          A.text(ctx, String(i + 1), bb.x + 14, bb.y + bb.h - 10, { size: 11, fam: 'mono', weight: 800, color: 'rgba(255,255,255,.35)' });
        });
        // diverter
        ctx.save(); ctx.translate(jx, jy); ctx.rotate(armAng);
        ctx.fillStyle = '#3a4248'; A.roundRect(ctx, -bw * 0.18, -6, bw * 0.36, 12, 6); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.rect(-12, 0, 24, H * 0.1); ctx.clip(); for (var s2 = -2; s2 < 8; s2++) { ctx.fillStyle = s2 % 2 ? '#e6b85a' : '#1a1a1a'; ctx.beginPath(); ctx.moveTo(-12, s2 * 12); ctx.lineTo(12, s2 * 12 + 12); ctx.lineTo(12, s2 * 12 + 24); ctx.lineTo(-12, s2 * 12 + 12); ctx.closePath(); ctx.fill(); } ctx.restore();
        ctx.fillStyle = '#e6b85a'; ctx.beginPath(); ctx.moveTo(-10, H * 0.1); ctx.lineTo(0, H * 0.1 + 14); ctx.lineTo(10, H * 0.1); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#596269'; ctx.beginPath(); ctx.arc(jx, jy, 10, 0, Math.PI * 2); ctx.fill();
        // crate on the belt and crates in the air
        if (crate) { var tl = 1 - crate.t / crate.T; drawCrate(ctx, jx, crate.y, crate.w, crate.h, crate.it.text, crate.fs, { tag: 'CRATE ' + k + ' / ' + CRATES, tint: tl < 0.25 && Math.floor(t * 8) % 2 ? '#d98a5a' : null, scale: 1 + (1 - A.ease.outBack(crate.pop)) * 0.25 }); }
        falling.forEach(function (f) {
          var u = Math.min(1, f.t / 0.38), x = A.lerp(f.x, f.tx, u), y = A.lerp(f.y, f.ty, u) - Math.sin(u * Math.PI) * 60;
          var sc = A.lerp(1, 0.45, u), rot = (f.tx - f.x) / W * u * 0.8;
          if (f.landed && !f.ok) { var k2 = (f.t - 0.38) / 0.5; x = f.tx + k2 * 40; y = f.ty - Math.sin(k2 * Math.PI) * 70; rot = k2 * 3; sc = 0.45; }
          ctx.save(); ctx.globalAlpha = f.landed ? Math.max(0, 1 - (f.t - 0.38) / (f.ok ? 0.17 : 0.5)) : 1; drawCrate(ctx, x, y, f.w, f.h, f.text, f.fs, { scale: sc, rot: rot, tag: f.ok ? '✓ SORTED' : '✗ REJECTED' }); ctx.restore();
        });
        // scoreboard
        ctx.fillStyle = 'rgba(0,0,0,.45)'; A.roundRect(ctx, 10, 10, 150, 46, 10); ctx.fill();
        A.text(ctx, 'SHIFT ' + Math.max(1, shift + 1) + ' / ' + lines.length, 22, 30, { size: 13, fam: 'mono', weight: 800, color: '#f6d991' });
        A.text(ctx, 'SORTED ' + sorted + (streak >= 2 ? ' · ×' + streak : ''), 22, 47, { size: 11, fam: 'mono', weight: 800, color: '#dfe6e1' });
        if (rush) A.text(ctx, 'RUSH ×2', W - 14, 32, { size: 18, fam: 'display', weight: 900, color: Math.floor(t * 6) % 2 ? '#ff7ab6' : '#fff', align: 'right', stroke: 'rgba(0,0,0,.6)', strokeWidth: 4 });
      }

      function onKey(key, down) {
        if (!down || !line || phase !== 'belt') return;
        var n = line.bins.length;
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') { sel = Math.max(0, sel - 1); api.audio.tick(); }
        if (key === 'ArrowRight' || key === 'd' || key === 'D') { sel = Math.min(n - 1, sel + 1); api.audio.tick(); }
        if (key === 'ArrowDown' || key === 's' || key === 'S' || key === ' ' || key === 'Enter') drop(null, true);
        var num = '1234'.indexOf(key); if (num >= 0 && num < n) drop(num, true);
      }
      function onPointer(e) {
        if (!line || phase !== 'belt') return;
        var bs = bays();
        for (var i = 0; i < bs.length; i++) { var b = bs[i]; if (e.x >= b.x && e.x <= b.x + b.w && e.y >= b.y - 30) { if (e.type === 'move' && !e.touch) sel = i; if (e.type === 'up') drop(i, true); return; } }
        if (e.type === 'up' && crate && Math.abs(e.x - W / 2) < crate.w / 2 && Math.abs(e.y - crate.y) < crate.h / 2) drop(null, true);
      }

      return { update: update, draw: draw, onKey: onKey, onPointer: onPointer, resize: function (w, h) { W = w; H = h; if (crate) { var sz = crateSize(crate.it.text); crate.w = sz.w; crate.h = sz.h; crate.fs = sz.fs; } },
        debug: function () { return { phase: phase, line: line && line.id, crate: crate && crate.it, sel: sel, sorted: sorted, rush: rush }; } };
    }
  });
})();
