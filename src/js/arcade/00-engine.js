/* ARCADE-00-ENGINE — shared helpers for the B2B Arcade games.
   Same shape as the Board Ready Arcade engine (window.ARCADE, A.register, def.create(api)) so the two arcades can merge when
   the apps are fused. Differences: the canvas is fluid (api.W and api.H follow the screen, so games also fit a phone held
   upright), progress lives in the B2B state (saved into the file), and there is XP with ranks, music and a noise synth. */
(function () {
  'use strict';
  var A = window.ARCADE = window.ARCADE || {};
  A.VERSION = '1.0.0';
  A.DATA = A.DATA || {};
  A.games = {}; A.order = [];
  var LIST_ORDER = ['contract-quest', 'supply-line', 'fire-mission', 'qual-range', 'part-patrol', 'sort-yard'];
  function listRank(id) { var i = LIST_ORDER.indexOf(id); return i < 0 ? LIST_ORDER.length : i; }
  A.register = function (def) {
    if (!def || !def.id) throw new Error('register needs an id');
    A.games[def.id] = def;
    if (A.order.indexOf(def.id) < 0) { A.order.push(def.id); A.order.sort(function (a, b) { return listRank(a) - listRank(b); }); }
  };

  // ---- palette (the Arcade is always dark) ----
  A.C = { bg: '#060b0d', bg2: '#0b1418', panel: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.12)', ink: '#f1f5f2', ink2: '#c2cdc6', muted: '#7f8c85',
    gold: '#e6b85a', gold2: '#f6d991', pine: '#3fbf8a', pine2: '#8be0b9', sky: '#8cc8ff', green: '#5fd39a', red: '#ff6b6b', purple: '#b98cff', orange: '#ffa552',
    teal: '#4fd1c5', pink: '#ff7ab6', white: '#ffffff', gp: '#a3a9f2', pre: '#82b6ef', awd: '#f0b863', post: '#6fd3d9', job: '#d1bfa6' };

  // ---- storage. Inside B2B Exam Prep the view sets A.host, so scores, XP and question memory go into the reader's progress
  //      (exported, and saved into the HTML file). The standalone copy falls back to this browser's storage. ----
  A.host = null;
  A.save = {
    get: function (k, fb) {
      if (A.host) { try { var hv = A.host.get(k); return hv === undefined || hv === null ? fb : hv; } catch (e) { return fb; } }
      try { var v = localStorage.getItem('b2b.arcade.' + k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; }
    },
    set: function (k, v, quiet) {
      if (A.host) { try { A.host.set(k, v, quiet); } catch (e) {} return; }
      try { localStorage.setItem('b2b.arcade.' + k, JSON.stringify(v)); } catch (e) {}
    }
  };

  function bestKey(id, tier) { return tier ? id + '@' + tier : id; }
  A.best = {
    all: function () { var b = A.save.get('best', {}); return b && typeof b === 'object' ? b : {}; },
    get: function (id, tier) { return A.best.all()[bestKey(id, tier)] || null; },
    any: function (id) { var all = A.best.all(), out = null; Object.keys(all).forEach(function (k) { if (k === id || k.indexOf(id + '@') === 0) { var e = all[k]; if (!out) out = { best: 0, plays: 0 }; out.best = Math.max(out.best, e.best || 0); out.plays += e.plays || 0; if (!out.lastAt || (e.lastAt || '') > out.lastAt) { out.lastAt = e.lastAt; out.last = e.last; } } }); return out; },
    record: function (id, score, extra, tier) {
      var all = A.best.all(), key = bestKey(id, tier), cur = all[key] || { best: 0, plays: 0 };
      var isRecord = score > (cur.best || 0);
      cur.best = Math.max(cur.best || 0, score); cur.plays = (cur.plays || 0) + 1; cur.last = score; cur.lastAt = new Date().toISOString();
      if (extra) Object.keys(extra).forEach(function (k) { cur[k] = extra[k]; });
      all[key] = cur; A.save.set('best', all);
      return { record: isRecord, entry: cur };
    }
  };

  // ---- pace levels (Recruit is the default on a first visit). timeScale slows or speeds the game clock; read: 'hold' waits
  //      for Go on each new question, 'brief' pauses for a reading window, 'off' never pauses; limit scales question timers ----
  A.TIERS = [
    { id: 'recruit', name: 'Recruit', badge: 'Easy', color: A.C.green, timeScale: 0.62, lives: 5, read: 'hold', limit: 0, desc: 'Slow motion, 5 lives and no question timer. Each new question waits until you press Go.' },
    { id: 'regular', name: 'Regular', badge: 'Medium', color: A.C.sky, timeScale: 0.8, lives: 4, read: 'brief', limit: 1.4, desc: 'A bit slower than full speed and 4 lives. A short reading pause before each question.' },
    { id: 'veteran', name: 'Veteran', badge: 'Hard', color: A.C.orange, timeScale: 1, lives: 3, read: 'off', limit: 1, desc: 'Full speed and 3 lives. No reading pause: you read while it moves.' },
    { id: 'elite', name: 'Elite', badge: 'Expert', color: A.C.red, timeScale: 1.22, lives: 2, read: 'off', limit: 0.7, desc: 'Faster than full speed, short timers and only 2 lives. Exam-day pressure.' }
  ];
  A.tier = function (id) {
    var want = id || A.save.get('tier', '') || 'recruit';
    for (var i = 0; i < A.TIERS.length; i++) if (A.TIERS[i].id === want) return A.TIERS[i];
    return A.TIERS[0];
  };
  A.setTier = function (id) { var t = A.tier(id); A.save.set('tier', t.id, true); return t; };

  // ---- XP and ranks: 10 XP a right answer plus bonuses; one total across every game ----
  A.RANKS = [
    { xp: 0, name: 'Trainee' }, { xp: 200, name: 'Apprentice Buyer' }, { xp: 500, name: 'Contract Specialist' }, { xp: 900, name: 'Senior Specialist' },
    { xp: 1400, name: 'Team Lead' }, { xp: 2000, name: 'Warrant Candidate' }, { xp: 2800, name: 'Contracting Officer' }, { xp: 3800, name: 'Senior Contracting Officer' },
    { xp: 5000, name: 'Chief of Contracting' }, { xp: 6500, name: 'Contracting Legend' }
  ];
  A.xp = function () { return +A.save.get('xp', 0) || 0; };
  // past the last rank, every 1,500 XP adds a star: Contracting Legend ★2, ★3 ...
  A.rank = function (xp) {
    if (xp == null) xp = A.xp();
    var i = 0; while (i + 1 < A.RANKS.length && xp >= A.RANKS[i + 1].xp) i++;
    var cur = A.RANKS[i], nxt = A.RANKS[i + 1];
    if (nxt) return { level: i + 1, name: cur.name, xp: xp, from: cur.xp, to: nxt.xp, next: nxt.name, pct: (xp - cur.xp) / (nxt.xp - cur.xp) };
    var extra = Math.floor((xp - cur.xp) / 1500), from = cur.xp + extra * 1500;
    return { level: i + 1 + extra, name: cur.name + (extra ? ' ★' + (extra + 1) : ''), xp: xp, from: from, to: from + 1500, next: cur.name + ' ★' + (extra + 2), pct: (xp - from) / 1500 };
  };
  A.addXp = function (n) { var before = A.rank(), xp = A.xp() + Math.max(0, Math.round(n || 0)); A.save.set('xp', xp); var after = A.rank(xp); return { gained: Math.round(n || 0), before: before, after: after, up: after.level > before.level }; };

  // ---- memory across runs: questions seen and missed, per game ----
  A.hash = function (s) { s = String(s == null ? '' : s); var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  var rotMem = null;
  function trimKeys(obj, max) { var keys = Object.keys(obj || {}); if (keys.length > max) keys.slice(0, keys.length - max).forEach(function (k) { delete obj[k]; }); }
  A.rotation = {
    all: function () { if (!rotMem) { var r = A.save.get('rot', {}); rotMem = r && typeof r === 'object' ? r : {}; } return rotMem; },
    bucket: function (key) {
      var all = A.rotation.all(), b = all[key];
      if (!b || typeof b !== 'object') b = all[key] = {};
      if (!b.seen || typeof b.seen !== 'object') b.seen = {};
      if (!b.missed || typeof b.missed !== 'object') b.missed = {};
      return b;
    },
    save: function () { var all = A.rotation.all(); Object.keys(all).forEach(function (k) { trimKeys(all[k].seen, 700); trimKeys(all[k].missed, 200); }); A.save.set('rot', all, true); },
    reset: function () { rotMem = null; }
  };

  // ---- randomness and math ----
  A.rand = function (a, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); };
  A.randInt = function (a, b) { return Math.floor(A.rand(a, b + 1)); };
  A.pick = function (arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined; };
  A.shuffle = function (arr) { var a = (arr || []).slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  A.clamp = function (n, lo, hi) { return Math.max(lo, Math.min(hi, n)); };
  A.lerp = function (a, b, t) { return a + (b - a) * t; };
  A.dist = function (x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); };
  A.ease = {
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inCubic: function (t) { return t * t * t; },
    inOutQuad: function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    outBack: function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outElastic: function (t) { return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1; }
  };
  A.hexA = function (hex, a) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex; var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
  A.shade = function (hex, f) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex; var n = parseInt(m[1], 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; function c(v) { return Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f); } return 'rgb(' + c(r) + ',' + c(g) + ',' + c(b) + ')'; };

  // ---- text and shapes ----
  var FAM = { display: '"Archivo", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif', body: '"Manrope", "Segoe UI", system-ui, sans-serif', mono: '"JetBrains Mono", "Cascadia Code", Consolas, monospace' };
  A.font = function (px, fam, weight) { return (weight || (fam === 'display' ? 800 : 700)) + ' ' + Math.round(px) + 'px ' + (FAM[fam || 'body'] || FAM.body); };
  A.wrap = function (ctx, text, maxWidth) {
    var words = String(text == null ? '' : text).split(/\s+/), lines = [], line = '';
    for (var i = 0; i < words.length; i++) { var test = line ? line + ' ' + words[i] : words[i]; if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = words[i]; } else line = test; }
    if (line) lines.push(line); return lines;
  };
  A.text = function (ctx, str, x, y, o) {
    o = o || {}; ctx.save();
    ctx.font = A.font(o.size || 18, o.fam || 'body', o.weight); ctx.fillStyle = o.color || A.C.ink; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.baseline || 'alphabetic';
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.shadow) { ctx.shadowColor = typeof o.shadow === 'string' ? o.shadow : 'rgba(0,0,0,.6)'; ctx.shadowBlur = o.shadowBlur || 12; ctx.shadowOffsetY = 2; }
    var lines = o.maxWidth ? A.wrap(ctx, str, o.maxWidth) : [String(str == null ? '' : str)];
    if (o.maxLines && lines.length > o.maxLines) { lines = lines.slice(0, o.maxLines); lines[o.maxLines - 1] = lines[o.maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
    var lh = o.lineHeight || Math.round((o.size || 18) * 1.22);
    var y0 = o.vcenter ? y - (lines.length - 1) * lh / 2 : y;
    if (o.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeWidth || 4; for (var j = 0; j < lines.length; j++) ctx.strokeText(lines[j], x, y0 + j * lh); }
    for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y0 + i * lh);
    ctx.restore(); return lines.length;
  };
  // largest size from max down to min at which text fits w x h in at most maxLines lines
  A.fitText = function (ctx, str, w, h, o) {
    o = o || {}; var size = o.max || 28, min = o.min || 11, fam = o.fam || 'body', lines;
    for (; size >= min; size -= 1) { ctx.font = A.font(size, fam, o.weight); lines = A.wrap(ctx, str, w); if (lines.length <= (o.maxLines || 3) && lines.length * size * 1.18 <= h) break; }
    return Math.max(size, min);
  };
  A.roundRect = function (ctx, x, y, w, h, r) { r = Math.max(0, Math.min(r || 0, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  A.glow = function (ctx, color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur || 18; };
  A.noGlow = function (ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; };
  A.pill = function (ctx, label, x, y, o) { o = o || {}; ctx.save(); ctx.font = A.font(o.size || 14, o.fam || 'mono', o.weight || 700); var w = ctx.measureText(label).width + (o.pad || 22); var hh = (o.size || 14) * 1.9; var x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x; A.roundRect(ctx, x0, y - hh / 2, w, hh, hh / 2); ctx.fillStyle = o.bg || 'rgba(0,0,0,.5)'; ctx.fill(); if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lineWidth || 1.5; ctx.stroke(); } ctx.fillStyle = o.color || A.C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x0 + w / 2, y + 1); ctx.restore(); return w; };
  A.star = function (ctx, x, y, r, n, inset) { n = n || 5; inset = inset || .5; ctx.beginPath(); for (var i = 0; i < n * 2; i++) { var a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * inset : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); };

  // ---- particles: circle, square, spark, ring (shockwave), streak ----
  function Particles() { this.list = []; }
  Particles.prototype.emit = function (o) {
    o = o || {}; var n = o.n || 14;
    for (var i = 0; i < n; i++) {
      var ang = o.angle != null ? o.angle + A.rand(-(o.spread || Math.PI), (o.spread || Math.PI)) : A.rand(0, Math.PI * 2);
      var sp = A.rand((o.speed || 220) * (o.minSpeed != null ? o.minSpeed : .3), o.speed || 220);
      this.list.push({ x: (o.x || 0) + A.rand(-(o.jitter || 0), o.jitter || 0), y: (o.y || 0) + A.rand(-(o.jitter || 0), o.jitter || 0), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: A.rand((o.life || .7) * .5, o.life || .7), t: 0, size: A.rand((o.size || 5) * .5, o.size || 5), color: Array.isArray(o.color) ? A.pick(o.color) : (o.color || A.C.gold), gravity: o.gravity == null ? 260 : o.gravity, shape: o.shape || 'circle', drag: o.drag == null ? .98 : o.drag, grow: o.grow || 0, spin: A.rand(-6, 6), rot: A.rand(0, 6.3) });
    }
    if (this.list.length > 1200) this.list.splice(0, this.list.length - 1200);
  };
  Particles.prototype.ring = function (x, y, o) { o = o || {}; this.list.push({ x: x, y: y, vx: 0, vy: 0, life: o.life || .5, t: 0, size: o.size || 10, grow: o.grow || 260, color: o.color || '#fff', gravity: 0, shape: 'ring', drag: 1, width: o.width || 4, rot: 0, spin: 0 }); };
  Particles.prototype.update = function (dt) { for (var i = this.list.length - 1; i >= 0; i--) { var p = this.list[i]; p.t += dt; if (p.t >= p.life) { this.list.splice(i, 1); continue; } p.vy += p.gravity * dt; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx * dt; p.y += p.vy * dt; p.size += p.grow * dt; p.rot += p.spin * dt; } };
  Particles.prototype.draw = function (ctx) {
    ctx.save();
    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i], a = 1 - p.t / p.life; ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = p.color; var s = p.shape === 'ring' ? p.size : p.size * (0.5 + a * 0.5);
      if (p.shape === 'square') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); }
      else if (p.shape === 'spark') { ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s / 3); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .04, p.y - p.vy * .04); ctx.stroke(); }
      else if (p.shape === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = (p.width || 4) * a; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, s), 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, s / 2), 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  };
  Particles.prototype.clear = function () { this.list.length = 0; };
  A.Particles = Particles;

  // ---- floating text: damage numbers, "+300", "COMBO x3" ----
  function Floaters() { this.list = []; }
  Floaters.prototype.add = function (text, x, y, o) { o = o || {}; this.list.push({ text: String(text), x: x, y: y, vy: o.vy != null ? o.vy : -70, life: o.life || 1, t: 0, size: o.size || 22, color: o.color || A.C.gold2, fam: o.fam || 'display', pop: o.pop !== false }); };
  Floaters.prototype.update = function (dt) { for (var i = this.list.length - 1; i >= 0; i--) { var f = this.list[i]; f.t += dt; f.y += f.vy * dt; f.vy *= 0.97; if (f.t >= f.life) this.list.splice(i, 1); } };
  Floaters.prototype.draw = function (ctx) {
    for (var i = 0; i < this.list.length; i++) {
      var f = this.list[i], k = f.t / f.life, sc = f.pop ? (k < .15 ? A.ease.outBack(k / .15) : 1) : 1;
      ctx.save(); ctx.globalAlpha = k > .7 ? 1 - (k - .7) / .3 : 1; ctx.translate(f.x, f.y); ctx.scale(sc, sc);
      ctx.font = A.font(f.size, f.fam, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = Math.max(3, f.size / 5); ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0); ctx.restore();
    }
  };
  Floaters.prototype.clear = function () { this.list.length = 0; };
  A.Floaters = Floaters;

  // ---- audio: synthesized, no sound files. Sound effects default on, music default off (offices) ----
  var AC = null, master = null, noiseBuf = null;
  var audio = A.audio = { muted: !!A.save.get('mute', false) };
  function ac() {
    if (AC) return AC;
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination); } catch (e) { AC = null; }
    return AC;
  }
  function out() { return master || (AC && AC.destination); }
  audio.resume = function () { var c = ac(); if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} } };
  audio.setMuted = function (m) { audio.muted = !!m; A.save.set('mute', !!m, true); if (m) A.music.stop(); else if (A.music.on && A.music.track) A.music.play(A.music.track); };
  audio.tone = function (freq, dur, type, gain, slide, delay) {
    if (audio.muted) return; var c = ac(); if (!c) return;
    try {
      var t0 = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain || .12, t0 + .01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(out()); o.start(t0); o.stop(t0 + dur + .03);
    } catch (e) {}
  };
  function noise() { var c = ac(); if (!c) return null; if (noiseBuf) return noiseBuf; var len = c.sampleRate * 1.2; noiseBuf = c.createBuffer(1, len, c.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return noiseBuf; }
  // filtered noise burst: explosions (lowpass), gunshots (bandpass), hiss (highpass)
  audio.noise = function (dur, gain, freq, ftype, delay, sweepTo) {
    if (audio.muted) return; var c = ac(); if (!c) return;
    try {
      var t0 = c.currentTime + (delay || 0), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = noise(); f.type = ftype || 'lowpass'; f.frequency.setValueAtTime(freq || 800, t0); if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t0 + dur);
      g.gain.setValueAtTime(gain || .3, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(out()); src.start(t0, Math.random() * 0.4); src.stop(t0 + dur + .05);
    } catch (e) {}
  };
  audio.blip = function () { audio.tone(660, .06, 'square', .05); };
  audio.tick = function () { audio.tone(1200, .03, 'square', .03); };
  audio.select = function () { audio.tone(520, .05, 'triangle', .07); audio.tone(780, .06, 'triangle', .06, 0, .04); };
  audio.correct = function () { audio.tone(523, .09, 'triangle', .1); audio.tone(784, .14, 'triangle', .1, 0, .07); };
  audio.wrong = function () { audio.tone(220, .2, 'sawtooth', .09, 110); audio.noise(.12, .05, 900, 'bandpass'); };
  audio.boom = function () { audio.noise(.7, .45, 700, 'lowpass', 0, 60); audio.tone(80, .45, 'sine', .25, 30); };
  audio.bigBoom = function () { audio.noise(1.4, .6, 900, 'lowpass', 0, 40); audio.tone(60, .9, 'sine', .32, 24); audio.noise(.5, .25, 3000, 'highpass', .05); };
  audio.pop = function () { audio.noise(.08, .18, 2400, 'bandpass'); audio.tone(300, .06, 'square', .04, 140); };
  audio.shot = function () { audio.noise(.16, .32, 1800, 'bandpass', 0, 500); audio.tone(140, .08, 'square', .06, 60); };
  audio.cannon = function () { audio.noise(.9, .55, 500, 'lowpass', 0, 50); audio.tone(55, .6, 'sine', .35, 28); audio.noise(.25, .25, 2500, 'bandpass'); };
  audio.laser = function () { audio.tone(1400, .09, 'square', .035, 380); };
  audio.hit = function () { audio.noise(.06, .14, 3000, 'highpass'); audio.tone(240, .05, 'square', .04, 120); };
  audio.whoosh = function () { audio.noise(.28, .12, 600, 'bandpass', 0, 2600); };
  audio.slash = function () { audio.noise(.18, .2, 1200, 'highpass', 0, 5000); audio.tone(900, .12, 'sawtooth', .04, 300); };
  audio.hurt = function () { audio.tone(180, .25, 'sawtooth', .1, 70); audio.noise(.2, .16, 500, 'lowpass'); };
  audio.coin = function () { audio.tone(988, .07, 'square', .05); audio.tone(1319, .16, 'square', .05, 0, .07); };
  audio.fanfare = function () { [523, 659, 784, 1046].forEach(function (f, i) { audio.tone(f, .18, 'triangle', .1, 0, i * .11); }); };
  audio.levelUp = function () { [392, 523, 659, 784, 1046, 1319].forEach(function (f, i) { audio.tone(f, .16, 'square', .05, 0, i * .07); audio.tone(f / 2, .2, 'triangle', .08, 0, i * .07); }); };
  audio.powerup = function () { audio.tone(400, .22, 'sine', .08, 1200); audio.tone(600, .2, 'triangle', .05, 1800, .05); };
  audio.alarm = function () { audio.tone(880, .12, 'square', .05); audio.tone(660, .12, 'square', .05, 0, .14); };
  audio.thud = function () { audio.noise(.14, .3, 300, 'lowpass'); audio.tone(110, .12, 'sine', .14, 60); };
  audio.clank = function () { audio.tone(1800, .05, 'square', .03); audio.tone(2600, .08, 'triangle', .03, 0, .02); audio.noise(.05, .08, 4000, 'highpass'); };

  // ---- music: a small step sequencer (bass, arpeggio, drums). Tracks are original 8-step patterns ----
  var TRACKS = {
    quest: { bpm: 112, bass: [45, 45, 52, 52, 48, 48, 50, 52], arp: [69, 72, 76, 72, 67, 71, 74, 71], lead: 'triangle', kick: [1, 0, 0, 0, 1, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 1] },
    battle: { bpm: 138, bass: [40, 40, 47, 40, 43, 43, 45, 47], arp: [64, 67, 71, 74, 67, 71, 74, 79], lead: 'square', kick: [1, 0, 1, 0, 1, 0, 1, 0], hat: [0, 1, 0, 1, 0, 1, 1, 1] },
    drive: { bpm: 126, bass: [38, 38, 45, 38, 41, 41, 43, 45], arp: [62, 69, 74, 69, 65, 72, 77, 72], lead: 'sawtooth', kick: [1, 0, 0, 1, 1, 0, 0, 0], hat: [1, 1, 1, 1, 1, 1, 1, 1] },
    space: { bpm: 132, bass: [36, 36, 43, 36, 39, 39, 41, 43], arp: [60, 67, 72, 75, 63, 70, 75, 79], lead: 'square', kick: [1, 0, 0, 0, 1, 0, 1, 0], hat: [0, 1, 1, 1, 0, 1, 1, 1] },
    tense: { bpm: 100, bass: [41, 41, 41, 44, 39, 39, 39, 43], arp: [65, 0, 68, 0, 63, 0, 67, 0], lead: 'triangle', kick: [1, 0, 0, 0, 0, 0, 1, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0] }
  };
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  var mus = A.music = { on: !!A.save.get('music', false), track: '', timer: 0, step: 0, next: 0, intense: 0 };
  mus.set = function (on) { mus.on = !!on; A.save.set('music', !!on, true); if (on && mus.track) mus.play(mus.track); else if (!on) mus.stop(true); };
  mus.play = function (name) {
    mus.track = name; if (!mus.on || audio.muted) return; var c = ac(); if (!c || !TRACKS[name]) return;
    clearInterval(mus.timer); mus.step = 0; mus.next = c.currentTime + 0.08;
    mus.timer = setInterval(function () {
      var t = TRACKS[mus.track]; if (!t || !AC) return; var spb = 60 / t.bpm / 2 / (mus.intense ? 1.08 : 1);
      while (mus.next < AC.currentTime + 0.12) {
        var s = mus.step % 8, bar = Math.floor(mus.step / 8) % 4, dl = mus.next - AC.currentTime, shift = bar === 3 ? 2 : bar === 2 ? -2 : 0;
        if (s % 2 === 0) audio.tone(midi(t.bass[s] + shift), spb * 1.7, 'triangle', .07, 0, dl);
        if (t.arp[s] && (mus.intense || s % 2 === 0 || bar % 2)) audio.tone(midi(t.arp[s] + shift), spb * .9, t.lead, .022, 0, dl);
        if (t.kick[s]) { audio.tone(110, .12, 'sine', .14, 40, dl); }
        if (t.hat[s]) audio.noise(.04, mus.intense ? .05 : .03, 7000, 'highpass', dl);
        if (mus.intense && s === 4) audio.noise(.12, .07, 1800, 'bandpass', dl);
        mus.step++; mus.next += spb;
      }
    }, 30);
  };
  mus.stop = function (forget) { clearInterval(mus.timer); mus.timer = 0; if (forget) mus.track = ''; };
  mus.setIntense = function (on) { mus.intense = on ? 1 : 0; };

  // ---- data conveniences (A.DATA is built by the B2B view from the guide's own content) ----
  A.data = {
    bank: function () { return (A.DATA.bank || []).filter(function (q) { return q && q.stem && q.options && q.options.length === 4; }); },
    facts: function (fams) { var f = A.DATA.facts || []; return fams ? f.filter(function (x) { return fams.indexOf(x.fam) >= 0; }) : f.slice(); },
    terms: function () { return (A.DATA.terms || []).filter(function (t) { return t && t.term && t.clue; }); },
    sorts: function () { return A.DATA.sorts || []; },
    phase: function (id) { return (A.DATA.phases || []).filter(function (p) { return p.id === id; })[0] || null; }
  };
})();
