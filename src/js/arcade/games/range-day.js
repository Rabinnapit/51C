/* GAME: range-day — the qualification range in real 3D. The tower (the prompt panel) reads a clue: an expansion on level 1,
   a definition with the term blanked on levels 2 and 3. Three target boards pop up downrange carrying terms; fire the
   M4A1 at the one that matches before they drop. 20 exposures and 30 rounds a table: 18 hits Expert, 15 Sharpshooter,
   12 Marksman, like a rifle table scaled to 20 targets. The scene (A.GL.RangeScene) draws the range, the rifle and the
   effects; this file owns the clock, the questions, the scoring and the 2D overlay (sight, timer, scorecard). */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var EXPOSURES = 20, AMMO = 30, FULL = 20;
  var EXPOSE = { recruit: 16, regular: 12, veteran: 9, elite: 7 };
  var SWAY = { recruit: 0, regular: 0, veteran: 0.012, elite: 0.022 };   // sight drift as a fraction of the screen, mouse and keyboard only
  var LANES = [-1.55, 0, 1.55], ROWS = [{ z: -5.5, m: 25 }, { z: -8.5, m: 50 }, { z: -12, m: 75 }];

  function termsOf(D) { return ((D && D.terms) || []).filter(function (t) { return t && t.term && t.clue; }); }
  // the rifle standard scaled to the table: Expert 36 of 40, Sharpshooter 30, Marksman 23 (18, 15 and 12 of 20)
  function badgeFor(hits) {
    var ex = Math.ceil(EXPOSURES * 0.9), sh = Math.ceil(EXPOSURES * 0.75), mk = Math.ceil(EXPOSURES * 0.6);
    if (hits >= ex) return { icon: '🏅', name: 'Expert', desc: hits + ' of ' + EXPOSURES + ' hits. Expert is ' + ex + ' or more (36 of 40 on a rifle table).', color: '#f6d991' };
    if (hits >= sh) return { icon: '🥈', name: 'Sharpshooter', desc: hits + ' of ' + EXPOSURES + ' hits. ' + ex + ' makes Expert.', color: '#c9d6e3' };
    if (hits >= mk) return { icon: '🥉', name: 'Marksman', desc: hits + ' of ' + EXPOSURES + ' hits. ' + sh + ' makes Sharpshooter.', color: '#e0a36b' };
    return { icon: '🔁', name: 'Unqualified: re-fire', desc: hits + ' of ' + EXPOSURES + ' hits. ' + mk + ' qualifies. Study the list below and re-fire.', color: '#ff9c9c' };
  }

  A.register({
    id: 'range-day', title: 'Range Day', icon: '🎯', accent: '#e6b85a', genre: 'Rifle range · real 3D', music: 'tense',
    tagline: 'The qualification range in real 3D. The tower reads a clue, three targets pop up carrying terms, and you fire the M4A1 at the right one before they drop.',
    drills: 'The 243-term glossary: acronyms and definitions',
    controls: 'Tap or click a target to fire. Keyboard: left and right move the sight between targets, Space or Enter fires. 20 exposures and 30 rounds: 18 hits for Expert, 15 Sharpshooter, 12 Marksman (a campaign table is 10 targets and 15 rounds). On Veteran and Elite the sight sways, so time your shot.',
    aspect: [0.5, 2.3], gateAt: 'top', noLives: true, livesLabel: 'Rounds', outTitle: 'Out of ammunition',
    livesText: function (st) { return st.inst && st.inst.ammoText ? st.inst.ammoText() : ''; },
    dataOk: function (D) { return termsOf(D).length >= 20 && !!(A.GL && A.GL.ok()); },
    thumb: function (ctx, w, h, t) {
      var hz = h * 0.46, g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#2d5f9a'); g.addColorStop(1, '#a9c9e6'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz);
      ctx.fillStyle = '#ffd980'; ctx.beginPath(); ctx.arc(w * 0.78, hz * 0.42, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a7a63'; ctx.beginPath(); ctx.moveTo(0, hz); for (var i = 0; i <= 10; i++) ctx.lineTo(i / 10 * w, hz - 14 - Math.abs(Math.sin(i * 1.7)) * 26); ctx.lineTo(w, hz); ctx.closePath(); ctx.fill();
      var fg = ctx.createLinearGradient(0, hz, 0, h); fg.addColorStop(0, '#9c8459'); fg.addColorStop(1, '#c9ad7a'); ctx.fillStyle = fg; ctx.fillRect(0, hz, w, h - hz);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; [-1.5, -0.5, 0.5, 1.5].forEach(function (l) { ctx.beginPath(); ctx.moveTo(w / 2 + l * w * 0.12, hz); ctx.lineTo(w / 2 + l * w * 0.5, h); ctx.stroke(); });
      ['BPA', 'IDIQ', 'COR'].forEach(function (lab, k) {
        var up = Math.max(0, Math.min(1, Math.sin(t * 1.4 + k * 1.3) * 1.6)), x = w * (0.26 + k * 0.24), y = hz + 20 + (k % 2) * 22, bw = 74, bh = 44 * up;
        ctx.fillStyle = '#3a3f45'; ctx.fillRect(x - 22, y + 8, 4, 36); ctx.fillRect(x + 18, y + 8, 4, 36);
        if (bh > 2) { ctx.fillStyle = '#f1e9d6'; ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 2; A.roundRect(ctx, x - bw / 2, y + 8 - bh, bw, bh, 4); ctx.fill(); ctx.stroke(); if (up > 0.8) A.text(ctx, lab, x, y - 10, { size: 16, fam: 'mono', weight: 800, color: '#1d2a15', align: 'center' }); }
      });
      // the rifle, bottom right
      ctx.save(); ctx.translate(w * 0.74, h * 0.98); ctx.rotate(-0.55); ctx.fillStyle = '#1c1f22'; ctx.fillRect(-18, -14, 140, 26); ctx.fillStyle = '#a98e62'; ctx.fillRect(40, -18, 46, 12); ctx.fillStyle = '#3a3f45'; ctx.fillRect(110, -8, 60, 12); ctx.fillStyle = '#1c1f22'; ctx.fillRect(-10, 10, 18, 40); ctx.restore();
      var cx = w * 0.5 + Math.sin(t * 0.9) * w * 0.22, cy = h * 0.5 + Math.cos(t * 1.3) * 14;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx - 22, cy); ctx.lineTo(cx - 8, cy); ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 22, cy); ctx.moveTo(cx, cy - 22); ctx.lineTo(cx, cy - 8); ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 22); ctx.stroke();
      A.pill(ctx, 'REAL 3D', 14, 22, { size: 12, bg: 'rgba(0,0,0,.55)', color: '#f6d991', stroke: '#e6b85a' });
    },
    create: function (api) {
      var W = api.W, H = api.H, tier = api.difficulty, terms = termsOf(api.data), t = 0, feel = A.feel, opts = api.opts || {};
      // a campaign mission narrows the terms to the month's glossary categories and shortens the table
      if (opts.cats && opts.cats.length) { var sub = terms.filter(function (x) { return opts.cats.indexOf(x.cat) >= 0; }); if (sub.length >= 12) terms = sub; }
      if (opts.exposures > 0) { EXPOSURES = opts.exposures; AMMO = Math.round(EXPOSURES * 1.5); }
      var coarse = false; try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
      var scene = null, glError = null;
      try { scene = new A.GL.RangeScene({ mobile: coarse, reduce: feel.reduce, width: 640, height: 400 }); } catch (e) { glError = e; }
      if (!scene) {
        setTimeout(function () { api.end({ won: false, title: '3D not available', message: 'This device could not start the 3D range' + (glError && glError.message ? ' (' + glError.message + ')' : '') + '. Qual Range is the same drill in 2D.' }); }, 2200);
        return { update: function () {}, draw: function (ctx) { A.text(ctx, 'Starting the 3D range failed on this device. Qual Range is the same drill in 2D.', 30, 60, { size: 18, color: A.C.ink, maxWidth: W - 60 }); } };
      }
      var n = 0, ammo = AMMO, hits = 0, streak = 0, targets = [], cur = null, phase = 'wait', phaseT = 0.6, expose = 0, exposeMax = 1;
      var aim = { x: W / 2, y: H * 0.55 }, focus = -1, lastTouch = coarse, kick = 0, hitMark = 0, first = true, frames = 0, slow = 0, scale = coarse ? 1 : 1, glW = 0, glH = 0;
      var sway = SWAY[tier.id] || 0;
      api.progress.configure({ perLevel: 5 });

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
        var opts = A.shuffle([term].concat(pickDecoys(term, 2)));
        var rows = A.shuffle(lvl <= 1 ? [0, 1, 1, 0] : lvl === 2 ? [0, 1, 2] : [1, 2, 2]).slice(0, 3);
        var list = opts.map(function (o, i) { var row = ROWS[rows[i]]; return { letter: 'ABC'[i], text: o.term, data: o, x: LANES[i] * Math.pow(-row.z / 5.5, 0.9), z: row.z, delay: i * 0.09 + (feel.reduce() ? 0 : 0.15), m: row.m }; });
        targets = scene.setBoards(list).map(function (b, i) { b.term = list[i].data; b.ok = b.term === term; b.m = list[i].m; b.state = 'rise'; return b; });
        cur = { term: term, mode: mode, text: mode === 'exp' ? term.expansion : term.clue };
        exposeMax = (EXPOSE[tier.id] || 11) + (mode === 'def' ? Math.min(6, cur.text.split(/\s+/).length * 0.12) : 0); expose = exposeMax;
        focus = -1; phase = 'up'; hitMark = 0;
        api.prompt.set({ kicker: 'Tower · exposure ' + n + ' of ' + EXPOSURES + (term.__via === 'review' ? ' · missed before' : ''), text: cur.text, sub: mode === 'exp' ? 'Fire at the target with the acronym for this.' : 'Fire at the target with the term for this definition.' + (term.cat ? ' (' + term.cat + ')' : ''), color: '#e6b85a' });
        api.ready({ text: cur.text });
        api.audio.clank();
      }
      function finish() {
        var b = badgeFor(hits);
        api.end({ won: hits >= Math.ceil(EXPOSURES * 0.6), title: b.name, message: 'You hit ' + hits + ' of ' + EXPOSURES + ' targets with ' + (AMMO - ammo) + ' rounds.', badge: b, xpBonus: hits * 4 + (hits >= Math.ceil(EXPOSURES * 0.9) ? 60 : 0), campaign: { value: hits, of: EXPOSURES } });
      }
      function screenOf(b) { var p = scene.project(b); return { x: p.x * W, y: p.y * H }; }
      function live() { return targets.filter(function (b) { return b.fall < 0; }).sort(function (a, b) { return screenOf(a).x - screenOf(b).x; }); }
      function swayOff() { return sway && !lastTouch ? { x: (Math.sin(t * 1.3) + Math.sin(t * 3.1) * 0.3) * sway * W, y: Math.cos(t * 1.7) * sway * 0.8 * H } : { x: 0, y: 0 }; }
      function shoot(px, py) {
        if (phase !== 'up' || ammo <= 0 || api.reading) return;
        var o = swayOff(), x = px + o.x, y = py + o.y;
        ammo--; api.hud.refreshLives(); kick = 1;
        feel.sfx.rifle(); api.shake(feel.reduce() ? 0 : 7); feel.buzz(8);
        var r = scene.shoot(x / W * 2 - 1, -(y / H) * 2 + 1), tg = r.board, term = cur.term;
        if (!tg) {
          scene.dustAt(r.point); feel.sfx.pop();
          api.floaters.add('MISS', x, y - 16, { size: 14, color: '#fff', life: 0.6 });
          if (ammo === Math.ceil(AMMO * 0.2)) api.mentor.say('worried', 'Rounds are running low. Pick your target before you fire.', 3.5);
          if (ammo <= 0) endExposure(null);
          return;
        }
        var base = { x: tg.x, y: 0, z: tg.z }, p = screenOf(tg);
        scene.bulletHole(tg, r.point); scene.hitFx(r.point, base, tg.ok);
        if (tg.ok) {
          hits++; streak++; var pts = 100 + Math.round(expose / exposeMax * 100) + streak * 20 + (tg.m >= 75 ? 50 : tg.m >= 50 ? 25 : 0);
          api.score(pts); api.progress.correct(); feel.sfx.ping(); if (streak >= 3) feel.sfx.combo(streak - 1); feel.hitstop.hit(60); feel.buzz(12); hitMark = 1;
          if (!feel.reduce()) api.flash('rgba(255,245,220,.16)');
          scene.mark(tg, 'ok'); scene.fall(tg, 0.05);
          api.floaters.add('HIT +' + pts, p.x, p.y - 40, { size: 22, color: '#8ff0bd' });
          if (streak === 3 || streak === 5 || streak === 7) api.mentor.say('pleased', A.mentor.LINES.streak[streak === 3 ? 0 : streak === 5 ? 1 : 2], 3);
          api.review.add({ prompt: cur.text, given: term.term, correct: term.term + (term.expansion ? ' (' + term.expansion + ')' : ''), ok: true, explanation: '', key: term.id });
          endExposure(true);
        } else {
          streak = 0; feel.sfx.miss(); feel.buzz([30, 40, 30]);
          scene.mark(tg, 'no'); scene.fall(tg, 0.1);
          targets.forEach(function (x2) { if (x2.ok) scene.mark(x2, 'ok'); });
          api.floaters.add('WRONG TARGET', p.x, p.y - 40, { size: 18, color: '#ff9c9c' });
          api.mentor.say('hint', A.mentor.line('hint') + ' ' + (tg.term.expansion ? tg.term.term + ' is ' + tg.term.expansion + '. ' : '') + term.term + ' was the target.', 5);
          api.review.add({ prompt: cur.text, given: tg.term.term, correct: term.term + (term.expansion ? ' (' + term.expansion + ')' : ''), ok: false, explanation: (tg.term.expansion ? tg.term.term + ' is ' + tg.term.expansion + '. ' : '') + 'The answer was ' + term.term + '.', key: term.id });
          endExposure(false);
        }
      }
      function endExposure(ok) {
        if (phase !== 'up') return;
        phase = 'down'; phaseT = ok ? 1.0 : 1.9;
        if (ok === null) {
          streak = 0; targets.forEach(function (x) { if (x.ok) scene.mark(x, 'ok'); });
          var term = cur.term; feel.sfx.timeout();
          api.review.add({ prompt: cur.text, given: '(no hit)', correct: term.term + (term.expansion ? ' (' + term.expansion + ')' : ''), ok: false, explanation: '', key: term.id });
          api.hud.set({ banner: ammo <= 0 ? 'Out of ammunition' : 'Targets down', sub: 'It was ' + term.term, color: '#ffa552', bannerTime: 1.6 });
        }
        targets.forEach(function (x) { scene.fall(x, x.ok && ok === false ? 0.9 : x.ok && ok === null ? 0.7 : 0.2); });
      }

      function update(gdt, dt) {
        t += dt; kick = Math.max(0, kick - dt * 5); hitMark = Math.max(0, hitMark - dt * 2.5);
        if (first) { first = false; api.hud.refreshLives(); }
        scene.update(dt, feel.hitstop.frozen());
        if (phase === 'up') {
          expose -= gdt;
          if (expose <= 0) endExposure(null);
          if (focus >= 0) { var lv = live(), ft = lv[Math.min(focus, lv.length - 1)]; if (ft) { var p = screenOf(ft); aim.x = A.lerp(aim.x, p.x, Math.min(1, dt * 14)); aim.y = A.lerp(aim.y, p.y, Math.min(1, dt * 14)); } }
        } else if (phase === 'down' || phase === 'wait') { phaseT -= gdt; if (phaseT <= 0) newExposure(); }
        // adaptive quality: if frames run slow for a while, render smaller and drop the multisampling
        frames++; if (dt > 0.026) slow++; if (frames >= 90) { if (slow > 45 && scale > 0.6) { scale = scale > 0.8 ? 0.75 : 0.6; scene.setQuality(scale > 0.7 ? 1 : 0); } frames = 0; slow = 0; }
      }
      function draw(ctx) {
        var cw = ctx.canvas.width, ch = ctx.canvas.height, dpr = Math.min(2, window.devicePixelRatio || 1), k = Math.min(1, (coarse ? 1.5 : 2) / dpr) * scale;
        var gw = Math.round(cw * k), gh = Math.round(ch * k);
        if (gw !== glW || gh !== glH) { glW = gw; glH = gh; scene.resize(gw, gh); }
        scene.render();
        ctx.drawImage(scene.canvas, 0, 0, W, H);
        // overlay: exposure timer, scorecard, streak, the sight
        if (phase === 'up') { var tw = Math.min(260, W * 0.4), frac = Math.max(0, expose / exposeMax); ctx.fillStyle = 'rgba(0,0,0,.35)'; A.roundRect(ctx, W / 2 - tw / 2, 10, tw, 8, 4); ctx.fill(); ctx.fillStyle = frac < 0.25 ? '#ff6b6b' : '#5fd39a'; A.roundRect(ctx, W / 2 - tw / 2, 10, tw * frac, 8, 4); ctx.fill(); }
        ctx.fillStyle = 'rgba(0,0,0,.45)'; A.roundRect(ctx, 10, 10, 152, 50, 10); ctx.fill();
        A.text(ctx, 'HITS ' + hits + ' / ' + EXPOSURES, 22, 31, { size: 14, fam: 'mono', weight: 800, color: '#8ff0bd' });
        A.text(ctx, 'TARGET ' + Math.min(n, EXPOSURES) + ' · ' + ammo + ' RDS', 22, 50, { size: 11, fam: 'mono', weight: 700, color: '#dfe6e1' });
        if (streak >= 3) A.text(ctx, 'STREAK ×' + streak, W - 16, 31, { size: 14, fam: 'mono', weight: 800, color: '#f6d991', align: 'right', stroke: 'rgba(0,0,0,.5)', strokeWidth: 3 });
        if (phase === 'up' && !api.reading && (!lastTouch || focus >= 0)) {
          var o = swayOff(), cx = aim.x + o.x, cy = aim.y + o.y - kick * 10, gap = 7 + kick * 10;
          ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.moveTo(cx - gap - 12, cy); ctx.lineTo(cx - gap, cy); ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + gap + 12, cy); ctx.moveTo(cx, cy - gap - 12); ctx.lineTo(cx, cy - gap); ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + gap + 12); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        if (hitMark > 0) { var hx = aim.x, hy = aim.y, m = 10 + (1 - hitMark) * 10; ctx.save(); ctx.globalAlpha = hitMark; ctx.strokeStyle = '#f6d991'; ctx.lineWidth = 3; ctx.beginPath(); [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (d) { ctx.moveTo(hx + d[0] * m * 0.5, hy + d[1] * m * 0.5); ctx.lineTo(hx + d[0] * m * 1.5, hy + d[1] * m * 1.5); }); ctx.stroke(); ctx.restore(); }
      }
      function onPointer(e) {
        lastTouch = !!e.touch;
        if (e.type === 'move' && !e.touch) { aim.x = e.x; aim.y = e.y; focus = -1; }
        if (e.type === 'down') { aim.x = e.x; aim.y = e.y; focus = -1; shoot(e.x, e.y); }
      }
      function onKey(k, down) {
        if (!down || phase !== 'up') return;
        var lv = live(); if (!lv.length) return;
        if (k === 'ArrowRight' || k === 'd' || k === 'D') { lastTouch = false; focus = focus < 0 ? 0 : (focus + 1) % lv.length; api.audio.tick(); }
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') { lastTouch = false; focus = focus < 0 ? lv.length - 1 : (focus + lv.length - 1) % lv.length; api.audio.tick(); }
        if (k === ' ' || k === 'Enter') { lastTouch = false; if (focus < 0) focus = 0; var p = screenOf(lv[Math.min(focus, lv.length - 1)]); aim.x = p.x; aim.y = p.y; shoot(aim.x, aim.y); }
      }
      return {
        update: update, draw: draw, onPointer: onPointer, onKey: onKey,
        resize: function (w, h) { W = w; H = h; },
        destroy: function () { scene.dispose(); },
        ammoText: function () { return ammo + ' / ' + AMMO; },
        stats: function () { return { tri: scene.tri, calls: scene.calls, gl2: scene.gl2, hdr: scene.hdr, scale: scale, gl: [glW, glH], phase: phase, n: n, hits: hits, ammo: ammo, targets: targets.map(function (b) { var p = screenOf(b); return { ok: b.ok, text: b.text, x: Math.round(p.x), y: Math.round(p.y), fall: b.fall }; }) }; }
      };
    }
  });
})();
