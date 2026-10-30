/* ARCADE GAME supply-line — Supply Line: a story convoy for B2B Exam Prep. Lead two trucks from the Ops Center to the FOB
   through five checkpoints, one for each part of the contract life cycle (the FOB gate mixes them all). At each stop a
   contact sets the scene and six crates wait: a right answer loads one, a wrong answer costs fuel and the explanation
   comes over the radio. Load all six for the gold challenge coin. Original game; questions come from the guide's bank.
   Drawn in real 3D (A.GL.RoadScene: the road from dawn at the Ops Center to night at the FOB) where WebGL works; the
   canvas-2D drawing below is the fallback for anything older, and still paints the route map, the coins and the HUD. */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var CPS = [
    { id: 'gp', n: 1, name: 'Ops Center', sub: 'Guiding Principles', code: '1.0', color: '#a3a9f2', who: 'Chief of Contracting', kind: 'ops',
      line: 'Welcome to the team. Before we roll, show me you know the rules of the road: authority, ethics and good records.',
      radio: 'Convoy, this is Chief. Roll out to the Ops Center.',
      sky: ['#1b1440', '#5b3d7a', '#e59a7f'], hills: ['#3d3263', '#2c2550'], ground: '#4a4262', light: 'dawn' },
    { id: 'pre', n: 2, name: 'Market Square', sub: 'Pre-Award', code: '2.0', color: '#82b6ef', who: 'Supply officer (S4)', kind: 'market',
      line: 'We need generators, water and parts. Help me turn that into a requirement the market can bid on.',
      radio: 'A good requirement says what you need, not who should sell it.',
      sky: ['#0f3558', '#3f86b8', '#b9dff2'], hills: ['#4a7a5e', '#335a45'], ground: '#7c6c4a', light: 'day' },
    { id: 'awd', n: 3, name: 'River Bridge', sub: 'Award', code: '3.0', color: '#f0b863', who: 'Pricing analyst', kind: 'bridge',
      line: 'Three offers came in. Cross this bridge with a fair price and a winner you can defend.',
      radio: 'Price analysis compares prices. Cost analysis looks inside the price.',
      sky: ['#3a1d0a', '#b0612a', '#f6c37c'], hills: ['#7a5430', '#5a3c22'], ground: '#8a6a3c', light: 'gold' },
    { id: 'post', n: 4, name: 'Supply Depot', sub: 'Post-Award', code: '4.0', color: '#6fd3d9', who: 'Contracting officer\'s representative (COR)', kind: 'depot',
      line: 'The contract is signed. Now we make sure we get what we paid for, on time.',
      radio: 'Only a contracting officer can change the contract. Not the COR, not the commander.',
      sky: ['#062a33', '#167487', '#7fd0d6'], hills: ['#245a60', '#173f44'], ground: '#55635a', light: 'dusk' },
    { id: 'all', n: 5, name: 'FOB Gate', sub: 'All four exam areas', code: 'FOB', color: '#e6b85a', who: 'Base commander', kind: 'fob', night: true,
      line: 'Last checkpoint. Everything you learned on the road, one more time, and the FOB is yours.',
      radio: 'Read every word. NOT and EXCEPT decide many answers.',
      sky: ['#05091a', '#16204a', '#34457e'], hills: ['#18203e', '#10162c'], ground: '#2a2f45', light: 'night' }
  ];
  var CRATES = [{ label: 'WATER', color: '#3f93cf' }, { label: 'FUEL', color: '#c9473f' }, { label: 'MRE', color: '#8f7a46' },
    { label: 'MED', color: '#eeeeee', ink: '#c0392b' }, { label: 'COMMS', color: '#5e7f36' }, { label: 'PARTS', color: '#7d838c' }];
  var PER_CP = 6;
  var COIN = { 2: { name: 'Gold', a: '#fff1b8', b: '#e6b85a', c: '#9a6d1c' }, 1: { name: 'Silver', a: '#ffffff', b: '#c7ced6', c: '#7d8792' } };

  function bankOf(D) { return ((D && D.bank) || []).filter(function (q) { return q && q.stem && q.options && q.options.length === 4 && q.options.some(function (o) { return o.correct; }); }); }
  // a checkpoint's questions: its exam area; a campaign mission narrows them to the month's lessons when enough exist
  function poolFor(D, cp, lessons) {
    var b = bankOf(D);
    if (lessons && lessons.length) { var l = b.filter(function (q) { return lessons.indexOf(q.lesson) >= 0; }); if (l.length >= PER_CP * 2) return l; }
    return cp.id === 'all' ? b.filter(function (q) { return q.phase !== 'job'; }) : b.filter(function (q) { return q.phase === cp.id; });
  }
  function coinOf(missed) { return missed === 0 ? 2 : missed <= 2 ? 1 : 0; }

  // ---- drawing: vehicles, crates, people, coins and the five checkpoints ----
  function wheel(ctx, x, y, r, spin) {
    ctx.fillStyle = '#17191b'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4f555b'; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#25282b'; ctx.lineWidth = Math.max(1, r * 0.16);
    for (var i = 0; i < 3; i++) { var a = spin + i * 2.094; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); ctx.stroke(); }
  }
  // lead vehicle (an armored truck), x = rear, y = road, facing right
  function leadTruck(ctx, x, y, s, spin, bob, night) {
    var L = 128 * s, wr = 15 * s, base = y - wr * 1.15 + bob;
    if (night) { var g = ctx.createLinearGradient(x + L, 0, x + L + 190 * s, 0); g.addColorStop(0, 'rgba(255,236,170,.42)'); g.addColorStop(1, 'rgba(255,236,170,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + L, base - 22 * s); ctx.lineTo(x + L + 190 * s, base - 46 * s); ctx.lineTo(x + L + 190 * s, base + 18 * s); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#9c8656'; ctx.beginPath(); ctx.moveTo(x + 6 * s, base); ctx.lineTo(x + L - 6 * s, base); ctx.lineTo(x + L - 22 * s, base + 9 * s); ctx.lineTo(x + 22 * s, base + 9 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#bba374'; A.roundRect(ctx, x, base - 30 * s, L * 0.6, 32 * s, 3 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + L * 0.58, base + 2 * s); ctx.lineTo(x + L * 0.58, base - 46 * s); ctx.lineTo(x + L * 0.86, base - 46 * s); ctx.lineTo(x + L, base - 20 * s); ctx.lineTo(x + L, base + 2 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = night ? '#9fc3d6' : '#2f3f4a'; ctx.beginPath(); ctx.moveTo(x + L * 0.64, base - 40 * s); ctx.lineTo(x + L * 0.84, base - 40 * s); ctx.lineTo(x + L * 0.95, base - 22 * s); ctx.lineTo(x + L * 0.64, base - 22 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a7449'; ctx.fillRect(x + 8 * s, base - 22 * s, L * 0.48, 3 * s); ctx.fillRect(x + L * 0.2, base - 40 * s, 22 * s, 10 * s);
    ctx.strokeStyle = '#2d2a22'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(x + 12 * s, base - 30 * s); ctx.lineTo(x + 4 * s, base - 78 * s); ctx.stroke();
    ctx.fillStyle = night ? '#ff4d4d' : '#3a332a'; ctx.beginPath(); ctx.arc(x + 4 * s, base - 79 * s, 2.2 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe9a6'; ctx.fillRect(x + L - 5 * s, base - 14 * s, 5 * s, 6 * s);
    wheel(ctx, x + L * 0.22, y - wr + bob * 0.3, wr, spin); wheel(ctx, x + L * 0.78, y - wr + bob * 0.3, wr, spin);
  }
  // cargo truck, x = rear; crates fill a 3 x 2 bed (bottom row first). Returns the bed slot positions.
  function slots(x, y, s) {
    var L = 150 * s, wr = 13 * s, deck = y - wr * 1.7, cw = 27 * s, out = [];
    for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) out.push({ x: x + 10 * s + c * (cw + 6 * s), y: deck - cw - r * (cw + 2 * s), w: cw });
    return out;
  }
  function cargoTruck(ctx, x, y, s, spin, bob, load, night) {
    var L = 150 * s, wr = 13 * s, deck = y - wr * 1.7 + bob;
    ctx.fillStyle = '#4c5537'; ctx.fillRect(x, deck, L * 0.68, 8 * s);
    ctx.fillStyle = '#3c442b'; ctx.fillRect(x, deck - 6 * s, 4 * s, 6 * s); ctx.fillRect(x + L * 0.68 - 4 * s, deck - 6 * s, 4 * s, 6 * s);
    ctx.fillStyle = '#5b6641'; ctx.beginPath(); ctx.moveTo(x + L * 0.7, deck + 8 * s); ctx.lineTo(x + L * 0.7, deck - 40 * s); ctx.lineTo(x + L * 0.9, deck - 40 * s); ctx.lineTo(x + L, deck - 16 * s); ctx.lineTo(x + L, deck + 8 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = night ? '#9fc3d6' : '#2f3f4a'; ctx.beginPath(); ctx.moveTo(x + L * 0.75, deck - 34 * s); ctx.lineTo(x + L * 0.88, deck - 34 * s); ctx.lineTo(x + L * 0.96, deck - 18 * s); ctx.lineTo(x + L * 0.75, deck - 18 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe9a6'; ctx.fillRect(x + L - 4 * s, deck - 8 * s, 4 * s, 5 * s);
    var sl = slots(x, y, s);
    for (var i = 0; i < Math.min(load.length, 6); i++) crate(ctx, sl[i].x, sl[i].y + bob, sl[i].w, load[i]);
    wheel(ctx, x + L * 0.13, y - wr + bob * 0.3, wr, spin); wheel(ctx, x + L * 0.31, y - wr + bob * 0.3, wr, spin); wheel(ctx, x + L * 0.85, y - wr + bob * 0.3, wr, spin);
  }
  function crate(ctx, x, y, w, c, mark) {
    ctx.fillStyle = '#b4874a'; ctx.fillRect(x, y, w, w);
    ctx.strokeStyle = '#7c5a2c'; ctx.lineWidth = Math.max(1, w * 0.06); ctx.strokeRect(x, y, w, w);
    ctx.beginPath(); ctx.moveTo(x, y + w * 0.33); ctx.lineTo(x + w, y + w * 0.33); ctx.moveTo(x, y + w * 0.67); ctx.lineTo(x + w, y + w * 0.67); ctx.stroke();
    ctx.fillStyle = c.color; ctx.fillRect(x + w * 0.08, y + w * 0.36, w * 0.84, w * 0.28);
    ctx.fillStyle = c.ink || '#ffffff'; ctx.font = A.font(Math.max(6, w * 0.2), 'mono', 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.label, x + w / 2, y + w / 2 + 0.5);
    if (mark === 'left') { ctx.strokeStyle = '#ff5b5b'; ctx.lineWidth = Math.max(2, w * 0.1); ctx.beginPath(); ctx.moveTo(x + w * 0.15, y + w * 0.15); ctx.lineTo(x + w * 0.85, y + w * 0.85); ctx.moveTo(x + w * 0.85, y + w * 0.15); ctx.lineTo(x + w * 0.15, y + w * 0.85); ctx.stroke(); }
  }
  function person(ctx, x, y, s, uniform, t, wave) {
    ctx.fillStyle = '#2f3328'; ctx.fillRect(x - 6 * s, y - 22 * s, 5 * s, 22 * s); ctx.fillRect(x + 1 * s, y - 22 * s, 5 * s, 22 * s);
    ctx.fillStyle = uniform; A.roundRect(ctx, x - 9 * s, y - 50 * s, 18 * s, 30 * s, 4 * s); ctx.fill();
    ctx.strokeStyle = uniform; ctx.lineWidth = 5 * s; ctx.lineCap = 'round'; ctx.beginPath();
    var wv = wave ? Math.sin(t * 7) * 0.5 : 0;
    ctx.moveTo(x + 8 * s, y - 46 * s); ctx.lineTo(x + 8 * s + Math.cos(-1.2 + wv) * 18 * s, y - 46 * s + Math.sin(-1.2 + wv) * 18 * s);
    ctx.moveTo(x - 8 * s, y - 46 * s); ctx.lineTo(x - 11 * s, y - 28 * s); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = '#c69c76'; ctx.beginPath(); ctx.arc(x, y - 58 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = A.shade(uniform, -0.2); ctx.fillRect(x - 9 * s, y - 67 * s, 18 * s, 6 * s); ctx.fillRect(x - 2 * s, y - 63 * s, 13 * s, 3 * s);
  }
  function coin(ctx, x, y, r, t, grade, code) {
    var C = COIN[grade] || COIN[1], k = Math.cos(t * 2.6), sx = Math.max(0.08, Math.abs(k));
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, C.a); g.addColorStop(0.6, C.b); g.addColorStop(1, C.c);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.c; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2); ctx.stroke();
    if (k > 0) {
      ctx.fillStyle = C.c; A.star(ctx, 0, -r * 0.18, r * 0.34, 5, 0.45); ctx.fill();
      ctx.font = A.font(r * 0.3, 'display', 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(code, 0, r * 0.38);
    } else {
      ctx.fillStyle = C.c; ctx.font = A.font(r * 0.2, 'display', 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SUPPLY', 0, -r * 0.12); ctx.fillText('LINE', 0, r * 0.16);
    }
    ctx.restore();
  }
  function sign(ctx, x, y, s, text, bg) {
    if (s < 0.75) return;
    ctx.fillStyle = '#4a3a26'; ctx.fillRect(x - 2 * s, y, 4 * s, 34 * s);
    ctx.font = A.font(11 * s, 'mono', 800); var w = ctx.measureText(text).width + 14 * s;
    ctx.fillStyle = bg || '#e8dcc0'; A.roundRect(ctx, x - w / 2, y - 18 * s, w, 20 * s, 3 * s); ctx.fill();
    ctx.fillStyle = '#2a2318'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - 7.5 * s);
  }
  // a checkpoint drawn from x (left edge) on road level y
  function place(ctx, kind, x, y, s, t, o) {
    o = o || {};
    if (kind === 'ops') {
      [[0, 1], [120, 0.85]].forEach(function (p) {
        var px = x + p[0] * s, w = 104 * s * p[1], hh = 58 * s * p[1];
        ctx.fillStyle = '#5c6a3a'; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y - hh * 0.55); ctx.quadraticCurveTo(px + w / 2, y - hh * 1.25, px + w, y - hh * 0.55); ctx.lineTo(px + w, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#323a20'; ctx.fillRect(px + w * 0.4, y - hh * 0.5, w * 0.2, hh * 0.5);
      });
      ctx.strokeStyle = '#8b9096'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x + 250 * s, y); ctx.lineTo(x + 250 * s, y - 120 * s); ctx.stroke();
      for (var i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + 244 * s, y - i * 20 * s); ctx.lineTo(x + 256 * s, y - i * 20 * s - 6 * s); ctx.stroke(); }
      ctx.fillStyle = Math.sin(t * 4) > 0 ? '#ff4d4d' : '#5a1d1d'; ctx.beginPath(); ctx.arc(x + 250 * s, y - 122 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
      sign(ctx, x - 16 * s, y - 34 * s, s, 'OPS');
    } else if (kind === 'market') {
      ['#c0392b', '#2d7fb8', '#d9a23a'].forEach(function (c, i) {
        var px = x + i * 92 * s;
        ctx.fillStyle = '#6b4f2e'; ctx.fillRect(px + 4 * s, y - 62 * s, 4 * s, 62 * s); ctx.fillRect(px + 76 * s, y - 62 * s, 4 * s, 62 * s);
        for (var k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#f4efe4' : c; ctx.fillRect(px + k * 14 * s, y - 72 * s, 14 * s, 14 * s); }
        ctx.fillStyle = '#8a6a40'; ctx.fillRect(px + 6 * s, y - 26 * s, 72 * s, 8 * s);
        for (var j = 0; j < 4; j++) { ctx.fillStyle = ['#e2b04a', '#7fb24a', '#d65a3a', '#c9c3b5'][(i + j) % 4]; ctx.beginPath(); ctx.arc(px + 18 * s + j * 16 * s, y - 31 * s, 6 * s, 0, Math.PI * 2); ctx.fill(); }
      });
      sign(ctx, x - 16 * s, y - 34 * s, s, 'MARKET');
    } else if (kind === 'bridge') {
      var bw = 300 * s;
      ctx.fillStyle = '#2f6f8f'; ctx.fillRect(x, y + 6 * s, bw, 400 * s);
      ctx.strokeStyle = 'rgba(200,235,255,.5)'; ctx.lineWidth = 2 * s;
      for (var r = 0; r < 4; r++) { ctx.beginPath(); for (var wx = 0; wx <= bw; wx += 8 * s) ctx.lineTo(x + wx, y + 26 * s + r * 22 * s + Math.sin(wx * 0.05 / s + t * 2 + r) * 3 * s); ctx.stroke(); }
      ctx.fillStyle = '#5a5f66'; ctx.fillRect(x - 6 * s, y - 4 * s, bw + 12 * s, 12 * s);
      ctx.strokeStyle = '#8a9099'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x, y - 4 * s); ctx.lineTo(x, y - 60 * s); ctx.lineTo(x + bw, y - 60 * s); ctx.lineTo(x + bw, y - 4 * s);
      for (var b = 0; b < 6; b++) { ctx.moveTo(x + b * bw / 6, y - 4 * s); ctx.lineTo(x + (b + 1) * bw / 6, y - 60 * s); }
      ctx.stroke();
      sign(ctx, x - 22 * s, y - 34 * s, s, 'BRIDGE 30T');
    } else if (kind === 'depot') {
      ctx.fillStyle = '#6d7a86'; ctx.fillRect(x, y - 92 * s, 230 * s, 92 * s);
      ctx.fillStyle = '#56616b'; ctx.beginPath(); ctx.moveTo(x - 8 * s, y - 92 * s); ctx.lineTo(x + 115 * s, y - 118 * s); ctx.lineTo(x + 238 * s, y - 92 * s); ctx.closePath(); ctx.fill();
      for (var d = 0; d < 3; d++) { ctx.fillStyle = '#3d454d'; ctx.fillRect(x + 16 * s + d * 72 * s, y - 62 * s, 54 * s, 62 * s); ctx.strokeStyle = '#59636d'; ctx.lineWidth = 1.5 * s; for (var l = 1; l < 8; l++) { ctx.beginPath(); ctx.moveTo(x + 16 * s + d * 72 * s, y - 62 * s + l * 7.5 * s); ctx.lineTo(x + 70 * s + d * 72 * s, y - 62 * s + l * 7.5 * s); ctx.stroke(); } }
      ctx.fillStyle = '#d9a23a'; ctx.fillRect(x + 250 * s, y - 30 * s, 34 * s, 18 * s); ctx.fillRect(x + 276 * s, y - 52 * s, 4 * s, 40 * s);
      wheel(ctx, x + 258 * s, y - 6 * s, 6 * s, 0); wheel(ctx, x + 280 * s, y - 6 * s, 6 * s, 0);
      sign(ctx, x - 16 * s, y - 34 * s, s, 'DEPOT');
    } else if (kind === 'fob') {
      var open = o.open || 0;
      for (var hb = 0; hb < 6; hb++) {
        var hx = x + 50 * s + hb * 30 * s; if (hb === 1) continue;
        ctx.fillStyle = '#b8a476'; ctx.fillRect(hx, y - 42 * s, 28 * s, 42 * s);
        ctx.strokeStyle = 'rgba(70,60,40,.45)'; ctx.lineWidth = 1; for (var m = 1; m < 4; m++) { ctx.beginPath(); ctx.moveTo(hx + m * 7 * s, y - 42 * s); ctx.lineTo(hx + m * 7 * s, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(hx, y - m * 10.5 * s); ctx.lineTo(hx + 28 * s, y - m * 10.5 * s); ctx.stroke(); }
      }
      ctx.fillStyle = '#6b5434'; ctx.fillRect(x + 228 * s, y - 112 * s, 5 * s, 112 * s); ctx.fillRect(x + 260 * s, y - 112 * s, 5 * s, 112 * s);
      ctx.fillStyle = '#8a6c43'; ctx.fillRect(x + 222 * s, y - 124 * s, 48 * s, 24 * s);
      ctx.fillStyle = '#4b3b25'; ctx.beginPath(); ctx.moveTo(x + 216 * s, y - 124 * s); ctx.lineTo(x + 246 * s, y - 140 * s); ctx.lineTo(x + 276 * s, y - 124 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,180,' + (0.55 + 0.25 * Math.sin(t * 3)) + ')'; ctx.beginPath(); ctx.arc(x + 246 * s, y - 112 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x + 264 * s, y - 140 * s); ctx.lineTo(x + 264 * s, y - 176 * s); ctx.stroke();
      ctx.fillStyle = '#3e6a96'; ctx.fillRect(x + 264 * s, y - 176 * s, 20 * s, 12 * s); ctx.fillStyle = '#b8322c'; ctx.fillRect(x + 264 * s, y - 169 * s, 20 * s, 3 * s);
      ctx.save(); ctx.translate(x + 54 * s, y - 28 * s); ctx.rotate(-open * 1.35);
      for (var st = 0; st < 6; st++) { ctx.fillStyle = st % 2 ? '#f2f2f2' : '#c0392b'; ctx.fillRect(st * 9.5 * s, -3 * s, 9.5 * s, 6 * s); }
      ctx.restore(); ctx.fillStyle = '#555'; ctx.fillRect(x + 48 * s, y - 32 * s, 8 * s, 32 * s);
      sign(ctx, x - 26 * s, y - 34 * s, s, 'FOB KEYSTONE');
    }
  }
  function sky(ctx, cp, W, H, gy, t, scroll) {
    var g = ctx.createLinearGradient(0, 0, 0, gy); g.addColorStop(0, cp.sky[0]); g.addColorStop(0.6, cp.sky[1]); g.addColorStop(1, cp.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, gy + 2);
    if (cp.night) { for (var i = 0; i < 40; i++) { var sx = (i * 97.3) % W, sy = (i * 53.7) % (gy * 0.7); ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.35 * Math.sin(t * 2 + i)) + ')'; ctx.fillRect(sx, sy, 2, 2); } ctx.fillStyle = '#f4f1dc'; ctx.beginPath(); ctx.arc(W * 0.82, gy * 0.22, 16, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(255,240,200,.85)'; ctx.beginPath(); ctx.arc(W * 0.8, gy * 0.3, Math.min(W, H) * 0.05, 0, Math.PI * 2); ctx.fill(); }
    [0.25, 0.5].forEach(function (par, k) {
      ctx.fillStyle = cp.hills[k]; ctx.beginPath(); ctx.moveTo(0, gy);
      for (var x = 0; x <= W + 20; x += 16) { var wx = x + scroll * par; ctx.lineTo(x, gy - (k ? 34 : 64) - Math.sin(wx * 0.006 + k * 2) * (k ? 14 : 26) - Math.sin(wx * 0.017) * 8); }
      ctx.lineTo(W, gy); ctx.closePath(); ctx.fill();
    });
  }
  function road(ctx, cp, W, H, gy, scroll, s) {
    ctx.fillStyle = cp.ground; ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, gy, W, 26 * s);
    ctx.fillStyle = 'rgba(255,230,160,.55)'; var dash = 40 * s, off = scroll % (dash * 2);
    for (var x = -off; x < W; x += dash * 2) ctx.fillRect(x, gy + 11 * s, dash, 3 * s);
  }

  A.register({
    id: 'supply-line', title: 'Supply Line', icon: '🚚', accent: '#e6b85a', genre: 'Story convoy · real 3D', music: 'drive',
    tagline: 'Lead a supply convoy to the FOB in real 3D, from dawn at the Ops Center to night at the gate. Five checkpoints, one for each part of the contract life cycle: right answers load the cargo, clean runs earn challenge coins.',
    drills: 'Bank questions by exam area, explained after every answer',
    controls: 'Answer with 1 to 4, A to D, or a tap; Enter continues. Each right answer loads a crate. A wrong answer costs fuel, and the radio explains the right answer. Load all 6 crates at a checkpoint for its gold challenge coin (4 or 5 earns silver). Run one checkpoint or the full mission.',
    aspect: [0.95, 2.3], countdown: false, letterKeys: true, outTitle: 'Out of fuel',
    dataOk: function (D) { return bankOf(D).length >= 40; },
    thumb: function (ctx, w, h, t) {
      var cp = CPS[2], gy = h * 0.78, s = 0.62, scroll = t * 120;
      sky(ctx, cp, w, h, gy, t, scroll); road(ctx, cp, w, h, gy, scroll, s);
      var bob = Math.sin(t * 9) * 1.2;
      cargoTruck(ctx, w * 0.12, gy + 8, s, -t * 9, bob, CRATES.slice(0, 4), false); leadTruck(ctx, w * 0.12 + 112, gy + 8, s, -t * 9, -bob, false);
      coin(ctx, w * 0.82, h * 0.34, 26, t, 2, '3.0');
      if (A.GL && A.GL.ok()) A.pill(ctx, 'REAL 3D', 14, 22, { size: 12, bg: 'rgba(0,0,0,.55)', color: '#f6d991', stroke: '#e6b85a' });
    },
    create: function (api) {
      var W = api.W, H = api.H, t = 0, tier = api.difficulty, feel = A.feel, opts = api.opts || {};
      var coarse = false; try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
      // the 3D road where WebGL works; otherwise the 2D drawing below
      var scene = null; if (A.GL && A.GL.ok()) { try { scene = new A.GL.RoadScene({ mobile: coarse, reduce: feel.reduce, width: 640, height: 400 }); } catch (e) { console.error('[supply-line] 3D failed, drawing in 2D', e); scene = null; } }
      var LEG = 40, LEG1 = 30, PLACE3 = 21, OFF_M = 36, frames = 0, slow = 0, scale = 1, glW = 0, glH = 0;   // meters along the road
      function PX() { return W / 32; }   // pixels per meter in the 2D drawing
      var mode = 'map', mission = [], leg = 0, cp = CPS[0], pool = [], q = null, order = [], answered = false;
      var asked = 0, loaded = 0, missed = 0, bay = [], streak = 0, limit = 0, timer = 0, anim = null, pending = null;
      var scroll = 0, drive = null, places = [], gateOpen = 0, coinShow = null, totals = { crates: 0, asked: 0, gold: 0, silver: 0 }, mapSel = 0, mapHover = -1;
      var roll = 0, rollAt = 0, off = 0, carry = [], endT = 0, ended = false;
      var rec = A.save.get('supply', {}); if (!rec || typeof rec !== 'object') rec = {};
      function sc() { return api.clamp(Math.min(W / 640, H / 430), 0.5, 1.35); }
      function gy() { return H * 0.8; }
      // left to right: the convoy (about 290 units long), the crate pallet, the contact, then the checkpoint
      function convoyX() { return Math.min(W * 0.08, 60); }
      function bayX() { return Math.max(W * 0.44, convoyX() + 300 * sc()); }
      function placeX() { return Math.max(W * 0.66, bayX() + 150 * sc()); }

      // ---- route map ----
      function nodes() { var out = []; for (var i = 0; i < CPS.length; i++) out.push({ x: W * (0.1 + 0.8 * i / (CPS.length - 1)), y: H * (0.46 + 0.16 * Math.sin(i * 1.9 + 0.6)) }); return out; }
      function showMap() {
        mode = 'map'; api.music.play('drive'); api.choices.tools(null);
        api.prompt.set({ kicker: 'Supply Line · plan the route', text: 'Run the full mission, or train at one checkpoint.', sub: 'Each checkpoint is one part of the contract life cycle. Six crates wait at every stop.', color: '#e6b85a' });
        api.choices.set([{ text: 'Full mission: all 5 checkpoints to the FOB', tag: '1' }].concat(CPS.map(function (c, i) { return { text: 'CP' + c.n + ' ' + c.name + ' · ' + c.sub + coinLabel(c.id), tag: String(i + 2) }; })), function (i) { start(i === 0 ? [0, 1, 2, 3, 4] : [i - 1]); }, { cols: 1 });
      }
      function coinLabel(id) { var g = rec[id] || 0; return g === 2 ? '   ● gold coin' : g === 1 ? '   ● silver coin' : ''; }
      function start(list) {
        mission = list; leg = 0; totals = { crates: 0, asked: 0, gold: 0, silver: 0 }; streak = 0;
        api.choices.clear(); api.prompt.clear(); api.audio.select();
        places = []; scroll = 0; gateOpen = 0; coinShow = null; off = 0; carry = []; endT = 0; ended = false;
        if (scene) { scene.clearPlaces(); scene.clearBed(); scene.clearBay(); scene.setContact(null); scene.gate(0); scene.scroll = 0; scene.off = 0; }
        go(CPS[mission[0]], true);
      }
      // drive to the next checkpoint: the scenery scrolls and the stop slides in from the right
      function go(next, first) {
        cp = next; pool = poolFor(api.data, cp, opts.lessons); if (pool.length < PER_CP) pool = bankOf(api.data);
        var dist = first ? LEG1 : LEG;
        drive = { t: 0, len: first ? 2.2 : 3.2, from: scroll, to: scroll + dist };
        places.push({ kind: cp.kind, wx: drive.to + (scene ? PLACE3 : placeX() / PX()), cp: cp });
        if (places.length > 2) places.shift();
        if (scene) { scene.place(cp.kind, drive.to + PLACE3); scene.clearBay(); scene.setContact(null); if (first) scene.setLight(cp.light || 'day'); else scene.driveLight(cp.light || 'day', drive.len * 0.85); }
        bay = []; asked = 0; loaded = 0; missed = 0; mode = 'drive';
        api.prompt.set({ kicker: 'Radio · Chief of Contracting', text: cp.radio, sub: 'Next stop: CP' + cp.n + ' ' + cp.name + ' (' + cp.sub + ')', color: cp.color });
        api.choices.clear(); api.audio.whoosh();
      }
      function arrive() {
        mode = 'brief'; drive = null; api.audio.thud();
        for (var i = 0; i < PER_CP; i++) bay.push({ c: CRATES[i], state: 'wait', fly: 0 });
        if (scene) { var here = places[places.length - 1]; scene.clearBed(); scene.setBay(CRATES.slice(0, PER_CP), here.wx); scene.setContact(cp.kind, here.wx); scene.wave(true); scene.dustAt(scene.point('lead'), 6); feel.buzz(10); }
        api.prompt.set({ kicker: 'CP' + cp.n + ' ' + cp.name + ' · ' + cp.who, text: '“' + cp.line + '”', sub: 'Six crates to load: ' + cp.sub + ' questions. A wrong answer costs fuel.', color: cp.color, big: true });
        api.choices.set([{ text: 'Start loading ▶', tag: '1' }], function () { ask(); }, { cols: 1 });
      }

      // ---- questions ----
      function ask() {
        q = api.progress.pick(pool, function (x) { return x.id; });
        order = api.shuffle([0, 1, 2, 3]); answered = false;
        var words = (q.stem + ' ' + q.options.map(function (o) { return o.text; }).join(' ')).split(/\s+/).length;
        limit = tier.limit ? api.clamp(12 + words * 0.5, 20, 60) * tier.limit : 0; timer = limit;
        var ph = cp.id === 'all' ? A.data.phase(q.phase) : null;
        api.prompt.set({ kicker: 'CP' + cp.n + ' ' + cp.name + ' · crate ' + (asked + 1) + ' of ' + PER_CP + ' (' + bay[asked].c.label + ')' + (ph ? ' · ' + ph.name : '') + (q.__via === 'review' ? ' · missed before' : ''), text: q.stem, color: ph ? ph.color : cp.color });
        api.choices.set(order.map(function (k) { return { text: q.options[k].text }; }), pick);
        api.choices.timer(limit ? 1 : null);
        mode = 'ask'; if (scene) scene.wave(false);
      }
      function pick(i) { if (mode !== 'ask' || answered) return; answered = true; resolve(q.options[order[i]], i); }
      function fuelPoint() { if (scene) { var p = scene.project(scene.point('cargo')); return { x: p.x * W, y: p.y * H }; } return { x: convoyX() + 140 * sc(), y: gy() - 110 * sc() }; }
      function resolve(opt, i) {
        var right = null, ri = -1;
        order.forEach(function (k, j) { if (q.options[k].correct) { right = q.options[k]; ri = j; } });
        var ok = !!(opt && opt.correct), box = bay[asked];
        api.choices.lock(); api.choices.mark(ri, 'right'); if (!ok && i >= 0) api.choices.mark(i, 'wrong'); api.choices.timer(null);
        api.review.add({ prompt: q.stem, given: opt ? opt.text : '(no answer: time ran out)', correct: right.text, ok: ok, explanation: right.why, cite: q.cite, lesson: q.lesson, qid: q.id, key: q.id });
        asked++; totals.asked++;
        var title, body;
        if (ok) {
          streak++; loaded++; totals.crates++;
          var fast = limit && timer > limit * 0.6;
          api.score(100 + 20 * Math.min(streak, 10) + (fast ? 60 : 0)); api.progress.correct(); api.audio.correct();
          box.state = 'fly'; box.fly = 0; anim = { type: 'load', box: box, slot: loaded - 1, t: 0 };
          if (scene) scene.load(asked - 1, loaded - 1);
          feel.buzz(8);
          if (streak === 3 || streak === 5) api.mentor.say('pleased', A.mentor.LINES.streak[streak === 3 ? 0 : 1]);
          title = (streak >= 3 ? 'Loaded! ' + streak + ' in a row.' : 'Loaded!') + (fast ? ' Fast.' : '');
          body = opt.why;
        } else {
          streak = 0; missed++; box.state = 'left';
          api.audio.wrong(); api.shake(6); api.life(-1); anim = { type: 'miss', t: 0 };
          if (scene) scene.reject(asked - 1);
          feel.buzz([30, 40, 30]);
          var fp = fuelPoint(); api.floaters.add('−1 fuel', fp.x, fp.y, { color: '#ff8a80', size: 22 });
          if (api.hud && tier.lives && api.life(0) === 1) api.mentor.say('worried', A.mentor.line('low'), 4);
          title = opt ? 'Radio: not that one.' : 'Radio: time ran out.';
          body = (opt ? 'Your answer: ' + opt.text + '. ' + (opt.why || '') + ' ' : '') + 'Right answer: ' + right.text + '. ' + (right.why || '');
        }
        mode = 'anim';
        api.choices.feedback({ ok: ok, title: title, body: body, cite: q.cite, auto: ok && tier.read === 'off' ? 3 : 0 }, function () { if (anim) pending = advance; else advance(); });
      }
      function timeout() { if (answered) return; answered = true; api.audio.alarm(); resolve(null, -1); }
      function advance() {
        pending = null;
        if (asked < PER_CP) { ask(); return; }
        done();
      }

      // ---- checkpoint result, the next leg, and the delivery ----
      function done() {
        var grade = coinOf(missed);
        if (grade === 2) totals.gold++; else if (grade === 1) totals.silver++;
        if (grade > (rec[cp.id] || 0)) { rec[cp.id] = grade; A.save.set('supply', rec); }
        coinShow = grade ? { grade: grade, t: 0, code: cp.code } : null;
        mode = 'coin'; api.choices.clear();
        if (grade) { api.audio.fanfare(); api.particles.emit({ x: W / 2, y: H * 0.36, n: 40, color: [COIN[grade].a, COIN[grade].b, '#ffffff'], speed: 260, gravity: 120, life: 1.2, shape: 'square', size: 7 }); api.score(grade === 2 ? 500 : 200); feel.buzz(grade === 2 ? [20, 30, 40] : 20); }
        if (grade === 2) api.mentor.say('proud', A.mentor.line('proud') + ' All six, gold coin.', 4); else if (!grade) api.mentor.say('worried', 'No coin this time. The radio told you why; the study list will too.', 4);
        var last = leg >= mission.length - 1;
        api.prompt.set({ kicker: 'CP' + cp.n + ' ' + cp.name + ' · cleared', text: grade === 2 ? 'Gold challenge coin: all 6 crates loaded.' : grade === 1 ? 'Silver challenge coin: ' + loaded + ' of 6 crates loaded.' : loaded + ' of 6 crates loaded. No coin this time.', sub: grade === 2 ? 'Clean run.' : 'Load all 6 for the gold coin. Your misses are on the study list at the end.', color: grade ? COIN[grade].b : cp.color, big: true });
        api.choices.set([{ text: last ? (mission.length > 1 ? 'Open the gate ▶' : 'Finish ▶') : 'Drive to CP' + CPS[mission[leg + 1]].n + ' ' + CPS[mission[leg + 1]].name + ' ▶', tag: '1' }], function () { next(); }, { cols: 1 });
      }
      function next() {
        api.choices.clear(); coinShow = null;
        carry = onBed();
        if (leg < mission.length - 1) { leg++; go(CPS[mission[leg]]); return; }
        if (mission.length > 1) { mode = 'deliver'; drive = { t: 0, len: 3.4, from: scroll, to: scroll }; api.audio.powerup(); api.prompt.set({ kicker: 'FOB Keystone', text: 'Gate open. Bring them in.', color: '#e6b85a' }); return; }
        finish();
      }
      function finish() {
        var full = mission.length > 1, coins = totals.gold + totals.silver;
        var title = full ? 'Mission complete: ' + totals.crates + ' of ' + totals.asked + ' crates delivered' : cp.name + ' cleared';
        api.end({ won: true, title: title, message: totals.gold + ' gold and ' + totals.silver + ' silver challenge coins.', xpBonus: (full ? 120 : 40) + totals.gold * 30 + totals.silver * 12, campaign: { value: full ? totals.crates : loaded, of: full ? totals.asked : PER_CP },
          badge: { icon: totals.gold === mission.length ? '🎖️' : '🪙', name: full ? (totals.gold === 5 ? 'Five gold coins' : coins + ' coins earned') : (COIN[rec[cp.id]] ? COIN[rec[cp.id]].name + ' coin, ' + cp.name : cp.name), desc: full ? 'You delivered the FOB\'s supplies through the whole contract life cycle.' : 'Load all 6 crates for the gold coin.', color: '#e6b85a' } });
      }

      function update(dt, rdt) {
        t += dt; rdt = rdt || dt;
        if (mode === 'ask' && limit && !answered) { timer -= dt; api.choices.timer(timer / limit); if (timer <= 0) timeout(); }
        if (drive) {
          drive.t += dt; var k = api.clamp(drive.t / drive.len, 0, 1);
          scroll = api.lerp(drive.from, drive.to, api.ease.inOutQuad(k));
          if (mode === 'deliver') { gateOpen = Math.min(1, gateOpen + dt * 1.4); off = api.ease.inCubic(api.clamp((drive.t - 0.6) / (drive.len - 0.6), 0, 1)) * OFF_M; }
          if (k >= 1) {
            if (mode === 'drive') arrive();
            else if (mode === 'deliver') { drive = null; mode = 'end'; api.audio.levelUp(); for (var f = 0; f < 4; f++) api.particles.emit({ x: W * (0.3 + f * 0.15), y: H * 0.25, n: 26, color: ['#ffd76a', '#ff7ab6', '#8cc8ff', '#ffffff'], speed: 220, gravity: 90, life: 1.4, shape: 'spark', size: 6 }); }
          }
        }
        if (mode === 'end' && !ended) { endT += dt; if (endT > 1.5) { ended = true; finish(); } }
        var pos = (scroll + off) * PX(); roll -= (pos - rollAt) / (14 * sc()); rollAt = pos;
        if (scene) {
          scene.scroll = scroll; scene.off = off; scene.gate(gateOpen); scene.update(rdt, feel.hitstop.frozen());
          // adaptive quality: if frames run slow for a while, render smaller and drop the multisampling
          frames++; if (rdt > 0.026) slow++; if (frames >= 90) { if (slow > 45 && scale > 0.6) { scale = scale > 0.8 ? 0.75 : 0.6; scene.setQuality(scale > 0.7 ? 1 : 0); } frames = 0; slow = 0; }
        }
        if (anim) {
          anim.t += dt;
          if (anim.type === 'load') { anim.box.fly = Math.min(1, anim.t / 0.7); if (anim.t >= 0.7) { anim.box.state = 'on'; api.audio.clank(); anim = null; } }
          else if (anim.t > 0.5) anim = null;
          if (!anim && pending) pending();
        }
        if (coinShow) coinShow.t += dt;
      }

      function draw(ctx) {
        if (mode === 'map') { drawMap(ctx); return; }
        if (scene) {
          var cw = ctx.canvas.width, ch = ctx.canvas.height, dpr = Math.min(2, window.devicePixelRatio || 1), kq = Math.min(1, (coarse ? 1.5 : 2) / dpr) * scale;
          var gw = Math.round(cw * kq), gh = Math.round(ch * kq);
          if (gw !== glW || gh !== glH) { glW = gw; glH = gh; scene.resize(gw, gh); }
          scene.render(); ctx.drawImage(scene.canvas, 0, 0, W, H);
          drawHud(ctx, sc()); return;
        }
        var s = sc(), y = gy(), moving = !!drive, spin = roll, bob = moving ? Math.sin(t * 16) * 1.4 * s : 0, sp = scroll * PX();
        sky(ctx, cp, W, H, y, t, sp); road(ctx, cp, W, H, y, sp, s);
        places.forEach(function (p) { var px = p.wx * PX() - sp; if (px > -420 * s && px < W + 40) place(ctx, p.kind, px, y, s, t, { open: p.kind === 'fob' ? gateOpen : 0 }); });
        var cx = convoyX() + off * PX(), travel = mode === 'drive' || mode === 'deliver' || mode === 'end';
        if (mode === 'brief' || mode === 'ask' || mode === 'anim' || mode === 'coin') person(ctx, bayX() + 124 * s, y + 4 * s, s, cp.kind === 'market' ? '#7d6a52' : '#55603d', t, mode === 'brief');
        if (!travel) drawBay(ctx, s, y);
        cargoTruck(ctx, cx, y + 8 * s, s, spin, bob, travel ? carry : onBed(), cp.night);
        leadTruck(ctx, cx + 162 * s, y + 8 * s, s, spin, -bob, cp.night);
        bay.forEach(function (b) { if (b.state === 'fly') drawFly(ctx, b, s, y); });
        drawHud(ctx, s);
      }
      function onBed() { return bay.filter(function (b) { return b.state === 'on'; }).map(function (b) { return b.c; }); }
      function bayPos(i, s, y) { var cw = 30 * s; return { x: bayX() + (i % 3) * (cw + 8 * s), y: y + 4 * s - cw - Math.floor(i / 3) * (cw + 3 * s), w: cw }; }
      function drawBay(ctx, s, y) {
        ctx.fillStyle = '#6b5232'; ctx.fillRect(bayX() - 6 * s, y + 4 * s, 3 * (30 * s + 8 * s) + 4 * s, 5 * s);
        bay.forEach(function (b, i) { if (b.state === 'wait' || b.state === 'left') { var p = bayPos(i, s, y), sh = b.state === 'left' && anim && anim.type === 'miss' && i === asked - 1 ? Math.sin(t * 60) * 3 : 0; crate(ctx, p.x + sh, p.y, p.w, b.c, b.state === 'left' ? 'left' : ''); } });
      }
      function drawFly(ctx, b, s, y) {
        var i = bay.indexOf(b), from = bayPos(i, s, y), sl = slots(convoyX(), y + 8 * s, s)[anim && anim.slot != null ? anim.slot : 0], k = api.ease.inOutQuad(b.fly);
        var x = api.lerp(from.x, sl.x, k), yy = api.lerp(from.y, sl.y, k) - Math.sin(k * Math.PI) * 90 * s;
        crate(ctx, x, yy, api.lerp(from.w, sl.w, k), b.c);
      }
      function drawHud(ctx, s) {
        var pad = 12, sz = Math.round(api.clamp(13 * s + 2, 11, 17));
        A.pill(ctx, 'CP' + cp.n + '/5 · ' + cp.name.toUpperCase(), pad, pad + 12, { size: sz - 2, bg: 'rgba(0,0,0,.55)', color: cp.color });
        if (mode !== 'drive' && mode !== 'deliver' && mode !== 'end') {
          for (var i = 0; i < PER_CP; i++) { var b = bay[i], x = pad + i * (sz + 8), y0 = pad + 34; ctx.fillStyle = !b || b.state === 'wait' ? 'rgba(255,255,255,.18)' : b.state === 'left' ? '#ff6b6b' : '#5fd39a'; A.roundRect(ctx, x, y0, sz, sz, 3); ctx.fill(); }
        }
        if (mission.length > 1) A.pill(ctx, 'Cargo ' + totals.crates + ' · Coins ' + (totals.gold + totals.silver), W - pad, pad + 12, { size: sz - 2, align: 'right', bg: 'rgba(0,0,0,.55)', color: '#f6d991' });
        if (coinShow) { var r = Math.min(W, H) * 0.13, k = api.clamp(coinShow.t / 0.5, 0, 1); coin(ctx, W / 2, H * 0.36, r * api.ease.outBack(k), t, coinShow.grade, coinShow.code); }
      }
      function drawMap(ctx) {
        var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#20261b'); g.addColorStop(1, '#151a12'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(220,230,190,.07)'; ctx.lineWidth = 1; var step = Math.max(40, W / 16);
        for (var gx = 0; gx < W; gx += step) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
        for (var gy0 = 0; gy0 < H; gy0 += step) { ctx.beginPath(); ctx.moveTo(0, gy0); ctx.lineTo(W, gy0); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(150,170,110,.16)'; ctx.lineWidth = 1.5;
        for (var c = 0; c < 5; c++) { ctx.beginPath(); ctx.ellipse(W * 0.3, H * 0.3, 60 + c * 30, 30 + c * 18, 0.4, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(W * 0.72, H * 0.78, 50 + c * 26, 22 + c * 14, -0.3, 0, Math.PI * 2); ctx.stroke(); }
        var n = nodes(), s = api.clamp(Math.min(W / 760, H / 420), 0.7, 1.4);
        ctx.strokeStyle = '#d9c38a'; ctx.lineWidth = 5 * s; ctx.setLineDash([14 * s, 10 * s]); ctx.lineDashOffset = -t * 30;
        ctx.beginPath(); ctx.moveTo(n[0].x, n[0].y); for (var i = 1; i < n.length; i++) { var m = n[i - 1]; ctx.quadraticCurveTo((m.x + n[i].x) / 2, m.y - 40 * s * (i % 2 ? 1 : -1), n[i].x, n[i].y); } ctx.stroke(); ctx.setLineDash([]);
        A.text(ctx, 'MAIN SUPPLY ROUTE', W * 0.5, H * 0.13, { size: 13 * s, fam: 'mono', color: 'rgba(230,220,180,.7)', align: 'center' });
        n.forEach(function (p, k) {
          var c = CPS[k], grade = rec[c.id] || 0, on = k === mapHover || (mapHover < 0 && k === mapSel), r = (on ? 30 : 26) * s;
          if (grade) { ctx.strokeStyle = COIN[grade].b; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.arc(p.x, p.y, r + 7 * s, 0, Math.PI * 2); ctx.stroke(); }
          ctx.fillStyle = on ? c.color : '#2c3324'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = c.color; ctx.lineWidth = 3 * s; ctx.stroke();
          A.text(ctx, 'CP' + c.n, p.x, p.y + 5 * s, { size: 15 * s, fam: 'display', color: on ? '#10140c' : c.color, align: 'center' });
          A.text(ctx, c.name, p.x, p.y + r + 22 * s, { size: 13 * s, fam: 'display', color: '#efe8d0', align: 'center' });
          A.text(ctx, c.sub, p.x, p.y + r + 38 * s, { size: 11 * s, color: 'rgba(239,232,208,.7)', align: 'center' });
        });
        ctx.save(); ctx.translate(W - 46 * s, 46 * s); ctx.fillStyle = 'rgba(230,220,180,.8)'; ctx.beginPath(); ctx.moveTo(0, -22 * s); ctx.lineTo(7 * s, 0); ctx.lineTo(0, 22 * s); ctx.lineTo(-7 * s, 0); ctx.closePath(); ctx.fill();
        A.text(ctx, 'N', 0, -28 * s, { size: 12 * s, fam: 'mono', color: 'rgba(230,220,180,.8)', align: 'center' }); ctx.restore();
      }

      function onPointer(e) {
        if (mode !== 'map') return;
        var n = nodes(), s = api.clamp(Math.min(W / 760, H / 420), 0.7, 1.4), hit = -1;
        n.forEach(function (p, k) { if (api.dist(e.x, e.y, p.x, p.y) < 34 * s) hit = k; });
        if (e.type === 'move') mapHover = hit;
        if (e.type === 'up' && hit >= 0) start([hit]);
      }
      function onKey(k, down) {
        if (!down || mode !== 'map') return;
        if (k === 'ArrowRight' || k === 'ArrowDown') { mapSel = (mapSel + 1) % CPS.length; mapHover = -1; api.audio.blip(); }
        if (k === 'ArrowLeft' || k === 'ArrowUp') { mapSel = (mapSel + CPS.length - 1) % CPS.length; mapHover = -1; api.audio.blip(); }
        if (k === 'Enter') start([mapSel]);
      }

      var want = opts.realm, ix = -1;
      CPS.forEach(function (c, i) { if (c.id === want) ix = i; });
      if (want === 'mission' || opts.mission === 'full') start([0, 1, 2, 3, 4]); else if (ix >= 0) start([ix]); else showMap();
      return {
        update: update, draw: draw, onPointer: onPointer, onKey: onKey, resize: function (w, h) { W = w; H = h; },
        destroy: function () { if (scene) scene.dispose(); },
        stats: function () { return { gl: !!scene, scene: scene, tri: scene && scene.tri, calls: scene && scene.calls, light: scene && scene.light, mode: mode, cp: cp.id, scroll: Math.round(scroll), loaded: loaded, missed: missed, scale: scale }; }
      };
    }
  });
})();
