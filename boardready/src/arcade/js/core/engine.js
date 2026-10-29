/* ARCADE-ENGINE — shared helpers for the Board Ready Arcade games */
(function () {
  'use strict';
  var A = window.ARCADE = window.ARCADE || {};
  A.VERSION = '1.0.0';
  A.DATA = window.ARCADE_DATA || {};
  A.games = {}; A.order = [];
  // The Arcade home lists the car race and Deadline Dash first (user request, 17 Sep 2026); a game not named here goes last.
  var LIST_ORDER = ['threshold-run', 'deadline-dash', 'drop-zone', 'cite-express', 'fiscal-asteroids', 'clause-catcher', 'rfo-warp', 'boss-board'];
  function listRank(id) { var i = LIST_ORDER.indexOf(id); return i < 0 ? LIST_ORDER.length : i; }
  A.register = function (def) {
    if (!def || !def.id) throw new Error('register needs an id');
    A.games[def.id] = def;
    if (A.order.indexOf(def.id) < 0) { A.order.push(def.id); A.order.sort(function (a, b) { return listRank(a) - listRank(b); }); }
  };

  // ---- palette ----
  A.C = { bg: '#070b13', bg2: '#0c1322', panel: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.12)', ink: '#f2f4f8', ink2: '#c3cad6', muted: '#7f8898', gold: '#e2b657', gold2: '#f3d58c', sky: '#8fc6ff', green: '#5fd39a', red: '#ff6b6b', purple: '#b78bff', orange: '#ffa552', teal: '#4fd1c5', white: '#ffffff' };

  // ---- storage (may throw on locked-down networks) ----
  A.store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };
  var BEST_KEY = 'boardready.arcade.v1';
  function bestKey(id, tier) { return tier ? id + '@' + tier : id; }
  A.best = {
    all: function () { try { return JSON.parse(A.store.get(BEST_KEY) || '{}') || {}; } catch (e) { return {}; } },
    // best scores are kept per difficulty level; scores recorded before levels existed count as Veteran
    get: function (id, tier) { var all = A.best.all(); return all[bestKey(id, tier)] || (tier === 'veteran' ? all[id] || null : null); },
    record: function (id, score, extra, tier) {
      var all = A.best.all(); var key = bestKey(id, tier); var cur = all[key] || { best: 0, plays: 0 };
      var isRecord = score > (cur.best || 0);
      cur.best = Math.max(cur.best || 0, score); cur.plays = (cur.plays || 0) + 1; cur.last = score; cur.lastAt = new Date().toISOString();
      if (extra) Object.keys(extra).forEach(function (k) { cur[k] = extra[k]; });
      all[key] = cur; A.store.set(BEST_KEY, JSON.stringify(all));
      return { record: isRecord, entry: cur };
    }
  };

  // ---- difficulty levels (Recruit is the default on a first visit) ----
  // timeScale slows or speeds the whole game clock; read: 'hold' waits for Go on each new question,
  // 'brief' pauses for a reading window then starts by itself, 'off' never pauses.
  A.TIERS = [
    { id: 'recruit', name: 'Recruit', badge: 'Easy', color: A.C.green, timeScale: 0.6, lives: 5, read: 'hold', desc: 'Slow motion and 5 lives. Every new question waits until you press Go, so you can read each word first.' },
    { id: 'regular', name: 'Regular', badge: 'Medium', color: A.C.sky, timeScale: 0.8, lives: 4, read: 'brief', desc: 'A bit slower than full speed and 4 lives. A short reading pause before each question, then it starts by itself.' },
    { id: 'veteran', name: 'Veteran', badge: 'Hard', color: A.C.orange, timeScale: 1, lives: 3, read: 'off', desc: 'Full speed and 3 lives. No reading pause: you read while it moves.' },
    { id: 'elite', name: 'Elite', badge: 'Expert', color: A.C.red, timeScale: 1.25, lives: 2, read: 'off', desc: 'Faster than full speed with only 2 lives. Board-week pressure.' }
  ];
  var TIER_KEY = 'boardready.arcade.tier';
  A.tier = function (id) {
    var want = id || A.store.get(TIER_KEY) || 'recruit';
    for (var i = 0; i < A.TIERS.length; i++) if (A.TIERS[i].id === want) return A.TIERS[i];
    return A.TIERS[0];
  };
  A.setTier = function (id) { var t = A.tier(id); A.store.set(TIER_KEY, t.id); return t; };

  // ---- warrant class: which questions a player gets (their class plus the classes below it) ----
  var CLASS_ORDER = ['I', 'II', 'III', 'IV'];
  A.WARRANTS = [
    { id: 'I', name: 'Class I', range: 'Up to the SAT', desc: 'Class I questions.' },
    { id: 'II', name: 'Class II', range: '$500K to $5M, SaP', desc: 'Mostly Class II, with Class I basics.' },
    { id: 'III', name: 'Class III', range: '$10M to $100M', desc: 'Mostly Class III, with Class I and II basics.' },
    { id: 'IV', name: 'Class IV', range: '$250M to unlimited', desc: 'Mostly Class IV, with every lower class.' },
    { id: 'all', name: 'All classes', range: 'Every question', desc: 'Every question, evenly mixed.' }
  ];
  var WARRANT_KEY = 'boardready.arcade.warrant';
  A.normClass = function (c) { var s = String(c == null ? '' : c).replace(/^\s*class\s*/i, '').trim().toUpperCase(); return CLASS_ORDER.indexOf(s) >= 0 ? s : ''; };
  A.warrant = function (id) {
    var want = String(id || A.store.get(WARRANT_KEY) || 'all');
    var n = A.normClass(want) || (want.toLowerCase() === 'all' ? 'all' : '');
    for (var i = 0; i < A.WARRANTS.length; i++) if (A.WARRANTS[i].id === n) return A.WARRANTS[i];
    return A.WARRANTS[A.WARRANTS.length - 1];
  };
  A.setWarrant = function (id) { var w = A.warrant(id); A.store.set(WARRANT_KEY, w.id); return w; };
  A.itemClasses = function (item) {
    var raw = item && (item.classes || item.warrant_classes || item.warrant);
    var list = Array.isArray(raw) ? raw : (raw ? String(raw).split(/[;,#\s]+/) : []);
    var out = [];
    list.forEach(function (c) { var n = A.normClass(c); if (n && out.indexOf(n) < 0) out.push(n); });
    return out;
  };
  // 'at' = tagged for the chosen class, 'lower' = tagged only for lower classes (or untagged), 'none' = only higher classes
  A.classFit = function (item, wid) {
    if (!wid || wid === 'all') return 'at';
    var cls = A.itemClasses(item);
    if (!cls.length) return 'lower';
    if (cls.indexOf(wid) >= 0) return 'at';
    var rank = CLASS_ORDER.indexOf(wid);
    for (var i = 0; i < cls.length; i++) if (CLASS_ORDER.indexOf(cls[i]) < rank) return 'lower';
    return 'none';
  };

  // ---- memory across runs: questions seen and questions missed, per game and warrant class ----
  A.hash = function (s) { s = String(s == null ? '' : s); var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  var ROT_KEY = 'boardready.arcade.rotation.v1', rotMem = null;
  function trimKeys(obj, max) { var keys = Object.keys(obj || {}); if (keys.length > max) keys.slice(0, keys.length - max).forEach(function (k) { delete obj[k]; }); }
  A.rotation = {
    all: function () { if (!rotMem) { try { rotMem = JSON.parse(A.store.get(ROT_KEY) || '{}') || {}; } catch (e) { rotMem = {}; } } return rotMem; },
    bucket: function (key) {
      var all = A.rotation.all(), b = all[key];
      if (!b || typeof b !== 'object') b = all[key] = {};
      if (!b.seen || typeof b.seen !== 'object') b.seen = {};
      if (!b.missed || typeof b.missed !== 'object') b.missed = {};
      return b;
    },
    save: function () { var all = A.rotation.all(); Object.keys(all).forEach(function (k) { trimKeys(all[k].seen, 1500); trimKeys(all[k].missed, 300); }); A.store.set(ROT_KEY, JSON.stringify(all)); },
    clear: function (key) { var all = A.rotation.all(); if (key) delete all[key]; else Object.keys(all).forEach(function (k) { delete all[k]; }); A.store.set(ROT_KEY, JSON.stringify(all)); }
  };

  // ---- randomness & math ----
  A.rand = function (a, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); };
  A.randInt = function (a, b) { return Math.floor(A.rand(a, b + 1)); };
  A.pick = function (arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined; };
  A.shuffle = function (arr) { var a = (arr || []).slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  A.clamp = function (n, lo, hi) { return Math.max(lo, Math.min(hi, n)); };
  A.lerp = function (a, b, t) { return a + (b - a) * t; };
  A.ease = {
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOutQuad: function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    outBack: function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outElastic: function (t) { return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1; }
  };
  A.money = function (n) { if (n == null || isNaN(n)) return ''; var abs = Math.abs(n); if (abs >= 1e9) return '$' + +(n / 1e9).toFixed(2) + 'B'; if (abs >= 1e6) return '$' + +(n / 1e6).toFixed(2) + 'M'; if (abs >= 1e3) return '$' + +(n / 1e3).toFixed(0) + 'K'; return '$' + n; };

  // ---- text & shapes ----
  var FAM = { display: '"Instrument Serif", "Iowan Old Style", Georgia, serif', body: '"Manrope", "Segoe UI", system-ui, sans-serif', mono: '"JetBrains Mono", "Cascadia Code", Consolas, monospace' };
  A.font = function (px, fam, weight) { return (weight || (fam === 'display' ? 400 : 700)) + ' ' + px + 'px ' + (FAM[fam || 'body'] || FAM.body); };
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
    var lh = o.lineHeight || Math.round((o.size || 18) * 1.25);
    for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y + i * lh);
    ctx.restore(); return lines.length;
  };
  A.roundRect = function (ctx, x, y, w, h, r) { r = Math.min(r || 0, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  A.glow = function (ctx, color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur || 18; };
  A.noGlow = function (ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; };
  A.pill = function (ctx, label, x, y, o) { o = o || {}; ctx.save(); ctx.font = A.font(o.size || 14, o.fam || 'mono', 600); var w = ctx.measureText(label).width + (o.pad || 22); var h = (o.size || 14) * 1.9; A.roundRect(ctx, x - (o.align === 'center' ? w / 2 : 0), y - h / 2, w, h, h / 2); ctx.fillStyle = o.bg || 'rgba(0,0,0,.45)'; ctx.fill(); if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lineWidth || 1.5; ctx.stroke(); } ctx.fillStyle = o.color || A.C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + (o.align === 'center' ? 0 : w / 2), y + 1); ctx.restore(); return w; };

  // ---- particles ----
  function Particles() { this.list = []; }
  Particles.prototype.emit = function (o) {
    o = o || {}; var n = o.n || 14;
    for (var i = 0; i < n; i++) {
      var ang = o.angle != null ? o.angle + A.rand(-(o.spread || Math.PI), (o.spread || Math.PI)) : A.rand(0, Math.PI * 2);
      var sp = A.rand((o.speed || 220) * .3, o.speed || 220);
      this.list.push({ x: o.x || 0, y: o.y || 0, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: A.rand((o.life || .7) * .5, o.life || .7), t: 0, size: A.rand((o.size || 5) * .5, o.size || 5), color: Array.isArray(o.color) ? A.pick(o.color) : (o.color || A.C.gold), gravity: o.gravity == null ? 260 : o.gravity, shape: o.shape || 'circle', drag: o.drag == null ? .98 : o.drag });
    }
    if (this.list.length > 900) this.list.splice(0, this.list.length - 900);
  };
  Particles.prototype.update = function (dt) { for (var i = this.list.length - 1; i >= 0; i--) { var p = this.list[i]; p.t += dt; if (p.t >= p.life) { this.list.splice(i, 1); continue; } p.vy += p.gravity * dt; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx * dt; p.y += p.vy * dt; } };
  Particles.prototype.draw = function (ctx) { ctx.save(); for (var i = 0; i < this.list.length; i++) { var p = this.list[i]; var a = 1 - p.t / p.life; ctx.globalAlpha = a; ctx.fillStyle = p.color; var s = p.size * (0.5 + a * 0.5); if (p.shape === 'square') ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); else if (p.shape === 'spark') { ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s / 3); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2); ctx.fill(); } } ctx.restore(); };
  Particles.prototype.clear = function () { this.list.length = 0; };
  A.Particles = Particles;

  // ---- audio (synthesized; no assets) ----
  var AC = null;
  var audio = A.audio = { muted: A.store.get('boardready.arcade.mute') === '1' };
  function ac() { if (AC) return AC; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } return AC; }
  audio.resume = function () { var c = ac(); if (c && c.state === 'suspended') c.resume(); };
  audio.setMuted = function (m) { audio.muted = !!m; A.store.set('boardready.arcade.mute', m ? '1' : '0'); };
  audio.tone = function (freq, dur, type, gain, slide) {
    if (audio.muted) return; var c = ac(); if (!c) return;
    try { var o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), c.currentTime + dur); g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(gain || .12, c.currentTime + .01); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur + .02); } catch (e) {}
  };
  audio.blip = function () { audio.tone(660, .06, 'square', .05); };
  audio.tick = function () { audio.tone(1200, .03, 'square', .03); };
  audio.correct = function () { audio.tone(523, .09, 'triangle', .1); setTimeout(function () { audio.tone(784, .12, 'triangle', .1); }, 70); };
  audio.wrong = function () { audio.tone(220, .18, 'sawtooth', .09, 110); };
  audio.boom = function () { audio.tone(90, .35, 'sawtooth', .16, 30); audio.tone(60, .4, 'square', .08, 20); };
  audio.whoosh = function () { audio.tone(300, .18, 'sine', .05, 900); };
  audio.fanfare = function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { audio.tone(f, .16, 'triangle', .1); }, i * 110); }); };
  audio.powerup = function () { audio.tone(400, .2, 'sine', .08, 1200); };

  // ---- data conveniences for games ----
  A.data = {
    ladder: function () { return ((A.DATA.games || {}).threshold_ladder || []).filter(function (x) { return x && x.correct_class && x.label; }); },
    fiscal: function () { return ((A.DATA.games || {}).fiscal_sort || []).filter(function (x) { return x && x.statement && x.bucket; }); },
    clock: function () { return ((A.DATA.games || {}).protest_clock || []).filter(function (x) { return x && x.event && x.days != null; }); },
    clauses: function () { return ((A.DATA.games || {}).clause_match || []).filter(function (x) { return x && x.clause && x.title; }); },
    mcq: function () { return (A.DATA.mcq || []).filter(function (x) { return x && x.stem && x.options && x.options.length === 4; }); },
    questions: function () { return (A.DATA.questions || []).filter(function (x) { return x && x.id && x.question; }); },
    crosswalk: function () { return (A.DATA.crosswalk || []).filter(function (x) { return x && x.old && x.new && x.old !== x.new; }); },
    thresholds: function () { return A.DATA.thresholds || []; }
  };
})();
