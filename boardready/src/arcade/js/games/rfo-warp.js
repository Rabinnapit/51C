/* GAME: rfo-warp — fly the corridor and warp through the portal carrying the post-Overhaul citation */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  // ---------------------------------------------------------------- text utils
  function tidy(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function norm(s) { return tidy(s).toLowerCase(); }
  function clip(s, n) {
    var v = tidy(s);
    if (!v || v.length <= n) return v;
    return v.slice(0, Math.max(1, n - 1)).replace(/[\s,;:.–—-]+$/, '') + '…';
  }
  function sentence(s, n) {
    var v = tidy(s);
    if (!v || v.length <= n) return v;
    var cut = v.lastIndexOf('. ', n);
    if (cut > Math.min(70, n * 0.45)) return v.slice(0, cut + 1);
    return clip(v, n);
  }

  // A citation is usable as a portal label only when it is one short cite.
  function usableCite(v) {
    var s = tidy(v);
    if (!s || s.length > 24) return false;
    if (s.indexOf(';') >= 0 || s.indexOf(',') >= 0) return false;
    var l = s.toLowerCase();
    return l.indexOf(' through ') < 0 && l.indexOf(' et seq') < 0 && l.indexOf(' see ') < 0 && l.indexOf(' or ') < 0;
  }

  // "FAR 6.103-1" -> "FAR 6" · "DFARS 215.202-71" -> "DFARS 215" · "10 U.S.C. 4022" -> "10 U.S.C. 4022"
  function partKey(v) {
    var s = tidy(v), m;
    m = /^(\d+\s+U\.?\s?S\.?\s?C\.?)\s*§?\s*(\d+)/i.exec(s);
    if (m) return m[1].toUpperCase().replace(/\s+/g, ' ') + ' ' + m[2];
    m = /^([A-Za-z][A-Za-z ]*?)\s+(\d+)/.exec(s);
    if (m) return m[1].toUpperCase().replace(/\s+/g, ' ') + ' ' + m[2];
    return s.toUpperCase().slice(0, 8);
  }
  function famKey(v) { var k = partKey(v), i = k.lastIndexOf(' '); return i > 0 ? k.slice(0, i) : k; }

  // "FAR 6.103-1(d)" -> "far 6.103-1": the section or subsection a paragraph cite sits in
  function rootCite(v) { return norm(v).replace(/\s*\(.*$/, ''); }
  // true when one cite is the other, a paragraph of it, or a subsection under it ("FAR 15.404" / "FAR 15.404-1")
  function nested(a, b) {
    var x = rootCite(a), y = rootCite(b);
    return !!x && !!y && (x === y || x.indexOf(y + '-') === 0 || y.indexOf(x + '-') === 0);
  }
  // leading characters two cites share: how alike they look at a glance
  function likeness(a, b) {
    var x = norm(a), y = norm(b), n = Math.min(x.length, y.length), i = 0;
    while (i < n && x.charAt(i) === y.charAt(i)) i++;
    return i;
  }
  function keyOf(p) { return p.key; }

  function pairsFrom(D) {
    var raw = ((D || {}).crosswalk) || [];
    var out = [], seen = {}, i;
    for (i = 0; i < raw.length; i++) {
      var it = raw[i];
      if (!it) continue;
      var o = tidy(it.old), n = tidy(it['new']);
      if (!o || !n || norm(o) === norm(n)) continue;
      if (o.length > 22 || !usableCite(n)) continue;
      var k = norm(o) + '→' + norm(n);
      if (seen[k]) continue;
      seen[k] = 1;
      // difficulty from the build: 1 same section, 2 renumbered in the same part, 3 moved parts (missing counts as 2)
      out.push({ key: k, old: o, neu: n, title: clip(it.title, 118), note: tidy(it.note), difficulty: it.difficulty, classes: it.classes });
    }
    return out;
  }

  // ---------------------------------------------------------------- color utils
  function rgbOf(hex) {
    var h = String(hex == null ? '' : hex).replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    if (isNaN(n)) n = 0xffffff;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(c, a) { a = a < 0 ? 0 : a > 1 ? 1 : a; return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }
  function mix(a, b, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  }

  A.register({
    id: 'rfo-warp',
    title: 'RFO Warp',
    tagline: 'Steer into the portal holding the citation that replaced it.',
    blurb: 'A pre-Overhaul FAR citation rides the cockpit panel while three labelled portals rush out of the warp corridor. Fly through the one carrying the current number — a miss costs hull and shows you where the rule actually lives now.',
    controls: '← → or A/D steer · 1 2 3 jump to a portal · tap or drag the left, middle or right third · P pauses',
    icon: '🌀',
    accent: A.C.teal,
    drills: 'Old-to-new FAR citations after the Overhaul',
    dataOk: function (D) { return pairsFrom(D).length >= 10; },

    create: function (api) {
      var W = api.W, H = api.H, C = api.C;

      // ---- round rules ----
      // Levels are harder crosswalk pairs, never a faster corridor: the shell raises the question level every
      // 5 correct warps and slows its own clock at levels 2 and 3. Nothing below ramps during a run.
      api.progress.configure({ perLevel: 5 });
      var MAX_PAIRS = 20, MAX_HULL = (api.difficulty && api.difficulty.lives) || 3;   // hull comes from the chosen level
      var APPROACH = 162;                                    // corridor units per second: about 4.7 s from spawn to the gate
      var DUR = 150;                                         // backstop clock; 20 pairs at this pace take roughly 110-120 s
      var SECTOR_NAMES = ['EASY', 'MEDIUM', 'HARD'];

      // ---- layout ----
      var PX = 20, PY = 10, PW = W - 40, PH = 132;          // cockpit reference panel
      var FIELD_TOP = PY + PH + 6;                           // 148
      var FIELD_BOT = 490;                                   // console starts here
      var CONSOLE_Y = 512;                                   // console chip centre line

      // ---- pseudo-3D corridor ----
      var VPX = W / 2, VPY = 292, FOCAL = 300;
      var Z_GATE = 118, Z_SPAWN = 880, Z_GONE = 52;
      var S_GATE = FOCAL / Z_GATE;
      var SHIP_Y = 432;
      var CAMY = (SHIP_Y - VPY) / S_GATE;                    // camera rides above the corridor axis
      var LANE_PX = 210;                                     // lane spacing at the gate plane
      var LW = LANE_PX / S_GATE;                             // lane offset in corridor units
      var R = 90 / S_GATE;                                   // portal radius in corridor units
      var SLOT_OFF = [-1, 0, 1];
      var SLOT_X = [VPX - LANE_PX, VPX, VPX + LANE_PX];      // 270 / 480 / 690
      var CHIP_X = [160, W / 2, W - 160];                    // console chips, evenly spread
      var WALL = 300, SIDES = 10;                            // corridor wall radius / ring shape

      function sAt(z) { return FOCAL / (z < 16 ? 16 : z); }
      function pxAt(wx, s) { return VPX + wx * s; }
      function pyAt(wy, s) { return VPY + (wy + CAMY) * s; }

      // ---- palette triples ----
      var T_TEAL = rgbOf(C.teal), T_SKY = rgbOf(C.sky), T_PURPLE = rgbOf(C.purple),
          T_GREEN = rgbOf(C.green), T_RED = rgbOf(C.red), T_GOLD = rgbOf(C.gold),
          T_WHITE = rgbOf(C.white), T_INK = rgbOf(C.ink2);

      // ---- content ----
      var all = pairsFrom(api.data);                         // api.progress.pick chooses from these by difficulty
      var pool = [], byPart = {}, oldsOf = Object.create(null);
      (function () {
        var seen = {}, i;
        for (i = 0; i < all.length; i++) {
          var n = all[i].neu, k = norm(n);
          (oldsOf[k] = oldsOf[k] || []).push(all[i].old);   // every old cite that now lives at this new cite
          if (seen[k]) continue;
          seen[k] = 1;
          pool.push(n);
          var p = partKey(n);
          if (!byPart[p]) byPart[p] = [];
          byPart[p].push(n);
        }
      })();

      // ---- run state ----
      var group = null, phase = 'idle';
      var answered = 0, right = 0, streak = 0, bestStreak = 0;
      var combo = 1, hull = MAX_HULL, dying = false;
      var timeLeft = DUR, shownTime = -1, over = false, t = 0, hint = 3.4;
      var gap = 0, verdict = null, warpBoost = 0, hitFlash = 0, corridorHue = 0;
      var fxRings = [], sfxQ = [];
      var ship = { x: SLOT_X[1], tx: SLOT_X[1], slot: 1, roll: 0 };
      var stars = [], rings = [], dash = 0;

      api.hud.set({ score: 0, lives: MAX_HULL, maxLives: MAX_HULL, combo: 1, level: api.progress.level, time: DUR, progress: 0 });

      // ---- starfield in corridor space ----
      (function () {
        for (var i = 0; i < 118; i++) {
          stars.push({ a: api.rand(0, Math.PI * 2), r: api.rand(120, 560), z: api.rand(Z_GONE, 2600), c: i % 7 === 0 ? T_TEAL : (i % 5 === 0 ? T_SKY : T_WHITE) });
        }
        for (var j = 0; j < 18; j++) rings.push({ z: 60 + j * 150 });
      })();

      // ---- deferred sound so whoosh lands before the chime, with no stray timers ----
      function later(sec, fn) { sfxQ.push({ t: sec, fn: fn }); }

      // ---------------------------------------------------------------- flow
      function flowSpeed() { return APPROACH * (1 + warpBoost * 1.9); }   // the warp surge is scenery only; portals keep APPROACH

      function slotOf(i, n) { return n >= 3 ? i : (n === 2 ? (i === 0 ? 0 : 2) : 1); }

      // Wrong portals carry other verified post-Overhaul cites, never one nested with the answer and never the
      // new home of a rule nested with the one asked, so no wrong portal can be defended as right.
      // Sector 1: cites from other parts, so the part number points the way. Sector 2: one same-part look-alike.
      // Sector 3: the closest same-part look-alikes and, when the rule changed parts, a decoy from the part it left.
      function buildOptions(item, lvl) {
        var used = {}, picks = [];
        used[norm(item.neu)] = 1;
        used[norm(item.old)] = 1;
        var newPart = partKey(item.neu), oldPart = partKey(item.old), fam = famKey(item.neu);
        function fair(v) {
          if (nested(v, item.neu)) return false;
          var olds = oldsOf[norm(v)] || [];
          for (var j = 0; j < olds.length; j++) if (nested(olds[j], item.old)) return false;
          return true;
        }
        function take(list, max, like) {
          var s = api.shuffle(list || []), i;
          if (like) s.sort(function (a, b) { return likeness(b, like) - likeness(a, like); });   // stable sort: ties stay shuffled
          for (i = 0; i < s.length && picks.length < max; i++) {
            var v = s[i], k = norm(v);
            if (used[k] || !fair(v)) continue;
            used[k] = 1;
            picks.push(v);
          }
        }
        var sameFam = pool.filter(function (v) { return famKey(v) === fam; });
        var elsewhere = pool.filter(function (v) { var p = partKey(v); return p !== newPart && p !== oldPart; });
        var elsewhereFam = elsewhere.filter(function (v) { return famKey(v) === fam; });
        if (lvl <= 1) {
          take(elsewhereFam, 2);                                           // same regulation, another part
          take(elsewhere, 2);
        } else if (lvl === 2) {
          take(byPart[newPart], 1);                                        // one look-alike from the same part
          take(elsewhereFam, 2);
        } else {
          if (oldPart !== newPart) take(byPart[oldPart], 1, item.old);     // it moved: tempt with the part it left
          take(byPart[newPart], 2, item.neu);                              // nearest numbers in the same part
          take(sameFam, 2, item.neu);
        }
        take(sameFam, 2);                                                  // then the same regulation family
        take(pool, 2);                                                     // then anything verified
        return api.shuffle([item.neu].concat(picks));
      }

      function nextPair() {
        if (over) return;
        if (answered >= MAX_PAIRS) { finishRound(true, 'Corridor cleared'); return; }
        if (answered >= all.length) { finishRound(true, 'Every crosswalk flown'); return; }
        var lvl = api.progress.level;
        var item = api.progress.pick(all, keyOf);            // a pair matched to the current question level
        if (!item) { finishRound(right > answered - right, 'Every crosswalk flown'); return; }
        group = { item: item, lvl: lvl, opts: buildOptions(item, lvl), z: Z_SPAWN, spin: api.rand(0, Math.PI * 2), lines: null };
        phase = 'approach';
        verdict = null;
        api.audio.blip();
        if (api.ready) api.ready((item.old || '') + ' ' + (item.title || '') + ' ' + group.opts.join(' '));   // reading pause on easier levels
      }

      function laneHit(g) {
        var s = sAt(Z_GATE), r = R * s * 0.92, best = -1, bd = 1e9, i;
        for (i = 0; i < g.opts.length; i++) {
          var cx = pxAt(SLOT_OFF[slotOf(i, g.opts.length)] * LW, s);
          var d = Math.abs(ship.x - cx);
          if (d <= r && d < bd) { bd = d; best = i; }
        }
        return best;
      }

      function resolve() {
        if (over || !group) return;
        var g = group, item = g.item;
        var s = sAt(Z_GATE);
        var idx = laneHit(g);
        var given = idx < 0 ? 'Flew past every portal' : g.opts[idx];
        var ok = idx >= 0 && norm(given) === norm(item.neu);
        var shot = { opts: g.opts, given: idx };
        var cx = idx < 0 ? ship.x : pxAt(SLOT_OFF[slotOf(idx, g.opts.length)] * LW, s);
        var cy = pyAt(0, s);

        api.review.add({
          prompt: item.old + (item.title ? ' — ' + item.title : ''),
          correct: item.neu,
          given: given,
          ok: ok,
          explanation: item.note,
          cite: item.neu
        });
        answered++;
        api.hud.set({ progress: answered / MAX_PAIRS });
        group = null;
        phase = 'resolve';

        if (ok) {
          right++;
          streak++;
          if (streak > bestStreak) bestStreak = streak;
          var pts = Math.round((100 + (g.lvl || 1) * 12) * combo);   // scored at the level the pair was asked at
          api.score(pts);
          var up = api.progress.correct();                    // every 5th correct raises the question level (shell banner + fanfare)
          api.audio.whoosh();
          if (!up) later(0.14, function () { api.audio.correct(); });
          warpBoost = 1;
          api.flash('rgba(79,209,197,.26)');
          fxRings.push({ x: cx, y: cy, r: 30, max: 620, t: 0, life: 0.7, c: T_TEAL, lw: 7 });
          fxRings.push({ x: cx, y: cy, r: 10, max: 340, t: 0, life: 0.45, c: T_WHITE, lw: 4 });
          api.particles.emit({ x: cx, y: cy, n: 34, color: [C.teal, C.sky, C.white], speed: 430, life: 0.6, size: 5, gravity: 0, shape: 'spark' });
          api.particles.emit({ x: cx, y: cy, n: 20, color: [C.teal, C.white], speed: 240, life: 0.8, size: 5, gravity: 0 });
          verdict = { ok: true, cite: item.neu, note: item.note, item: item, lines: null, tlines: null, shot: shot };
          combo = combo < 8 ? combo + 1 : 8;
          api.hud.set({ combo: combo });
          if (up) { sectorUp(); gap = 1.8; }                  // an extra beat to read the level banner before a harder pair
          else {
            gap = 0.85;
            api.hud.set({ banner: '+' + pts + (combo > 2 ? '  ×' + (combo - 1) : ''), sub: item.old + '  →  ' + item.neu, bannerTime: 1.0 });
          }
        } else {
          streak = 0;
          combo = 1;
          hull--;
          api.audio.wrong();
          api.shake(15);
          api.flash('rgba(255,107,107,.30)');
          hitFlash = 1;
          fxRings.push({ x: ship.x, y: SHIP_Y, r: 14, max: 200, t: 0, life: 0.55, c: T_RED, lw: 5 });
          api.particles.emit({ x: ship.x, y: SHIP_Y, n: 26, color: [C.red, C.orange, C.gold], speed: 300, life: 0.7, size: 5, gravity: 120 });
          verdict = { ok: false, cite: item.neu, note: item.note, item: item, lines: null, tlines: null, shot: shot };
          api.hud.set({ combo: 1, banner: 'Now ' + item.neu, sub: sentence(item.note, 190) || (item.old + ' moved in the Revolutionary FAR Overhaul.'), bannerTime: 2.4 });
          if (hull > 0) { api.life(-1); gap = 2.1; }
          else { api.hud.set({ lives: 0 }); dying = true; gap = 2.1; }
        }
      }

      // New sector = harder questions only. The shell has already set the HUD level, shown its banner and played the fanfare.
      function sectorUp() {
        corridorHue = (api.progress.level - 1) * 0.16;
        fxRings.push({ x: VPX, y: VPY, r: 20, max: 900, t: 0, life: 1.0, c: T_GOLD, lw: 4 });
      }

      function finishRound(won, title) {
        if (over) return;
        over = true;
        group = null;
        var bonus = Math.max(0, hull) * 120;
        if (bonus > 0) api.score(bonus);
        api.end({
          won: !!won,
          title: title || 'Run over',
          message: right + ' of ' + answered + ' citations matched · best streak ' + bestStreak +
            ' · sector ' + api.progress.level + (bonus ? ' · +' + bonus + ' hull bonus' : '')
        });
      }

      // ---------------------------------------------------------------- input
      function setSlot(n) {
        if (over) return;
        n = n < 0 ? 0 : n > 2 ? 2 : n;
        if (n === ship.slot) return;
        ship.slot = n;
        ship.tx = SLOT_X[n];
        api.audio.tick();
      }
      function slotFromX(x) { return x < W / 3 ? 0 : (x < W * 2 / 3 ? 1 : 2); }

      // ---------------------------------------------------------------- drawing
      function drawBackdrop(ctx) {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#050a14');
        g.addColorStop(0.5, '#08111f');
        g.addColorStop(1, '#04070e');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        var hx = VPX + Math.sin(t * 0.21) * 26, hy = VPY + Math.cos(t * 0.17) * 14;
        var n1 = ctx.createRadialGradient(hx, hy, 6, hx, hy, 340);
        n1.addColorStop(0, rgba(mix(T_TEAL, T_PURPLE, corridorHue), 0.16));
        n1.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = n1;
        ctx.fillRect(0, 0, W, H);
        if (hull <= 1 && !over) {
          var pulse = 0.06 + Math.abs(Math.sin(t * 2.6)) * 0.07;
          var warn = ctx.createLinearGradient(0, H, 0, H * 0.45);
          warn.addColorStop(0, rgba(T_RED, pulse));
          warn.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = warn;
          ctx.fillRect(0, 0, W, H);
        }
      }

      function drawStars(ctx) {
        var trail = 34 + flowSpeed() * 0.16;
        ctx.save();
        ctx.lineCap = 'round';
        for (var i = 0; i < stars.length; i++) {
          var st = stars[i];
          var s1 = sAt(st.z), s2 = sAt(st.z + trail);
          if (s1 < 0.1) continue;
          var ca = Math.cos(st.a) * st.r, sa = Math.sin(st.a) * st.r;
          var x1 = pxAt(ca, s1), y1 = pyAt(sa, s1);
          var x2 = pxAt(ca, s2), y2 = pyAt(sa, s2);
          var a = s1 * 0.9;
          if (a > 1) a = 1;
          ctx.strokeStyle = rgba(st.c, a * 0.85);
          ctx.lineWidth = Math.max(0.7, Math.min(3.4, s1 * 1.5));
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();
      }

      function ringPath(ctx, z) {
        var s = sAt(z), cx = pxAt(0, s), cy = pyAt(0, s), rr = WALL * s;
        ctx.beginPath();
        for (var k = 0; k <= SIDES; k++) {
          var ang = (k / SIDES) * Math.PI * 2 + Math.PI / SIDES;
          var x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      }

      function drawCorridor(ctx) {
        var i, k;
        // longitudinal ribs: straight in world space, therefore straight on screen
        var sN = sAt(70), sF = sAt(2300);
        ctx.save();
        if (ctx.setLineDash) { ctx.setLineDash([16, 26]); ctx.lineDashOffset = -dash; }
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = rgba(mix(T_TEAL, T_PURPLE, corridorHue), 0.20);
        for (k = 0; k < SIDES; k++) {
          var ang = (k / SIDES) * Math.PI * 2 + Math.PI / SIDES;
          var wx = Math.cos(ang) * WALL, wy = Math.sin(ang) * WALL;
          ctx.beginPath();
          ctx.moveTo(pxAt(wx, sF), pyAt(wy, sF));
          ctx.lineTo(pxAt(wx, sN), pyAt(wy, sN));
          ctx.stroke();
        }
        if (ctx.setLineDash) ctx.setLineDash([]);
        ctx.restore();

        // rings
        for (i = 0; i < rings.length; i++) {
          var z = rings[i].z, s = sAt(z);
          var far = (2700 - z) / 1400;
          far = far < 0 ? 0 : far > 1 ? 1 : far;
          var near = z / 230;
          near = near < 0.1 ? 0.1 : near > 1 ? 1 : near;
          var a = Math.min(1, s * 2.2) * far * near * 0.62;
          if (a < 0.02) continue;
          var bright = (i % 3 === 0);
          var col = mix(mix(T_TEAL, T_SKY, 0.35), T_PURPLE, Math.min(1, corridorHue + z / 3400));
          if (hull <= 1) col = mix(col, T_RED, 0.45);            // the corridor goes red on the last hull point
          ctx.save();
          ringPath(ctx, z);
          ctx.lineWidth = bright ? Math.max(1.4, 3.4 * s) : Math.max(0.9, 1.6 * s);
          ctx.strokeStyle = rgba(col, a * (bright ? 1 : 0.55));
          if (bright && s > 0.8) api.glow(ctx, rgba(col, 0.8), 14);
          ctx.stroke();
          api.noGlow(ctx);
          ctx.restore();
        }
      }

      // rounded label plate, kept at a readable size at every depth
      function tag(ctx, label, x, y, o) {
        o = o || {};
        var size = o.size || 16;
        ctx.save();
        ctx.font = api.font(size, 'mono', 700);
        var w = ctx.measureText(label).width + (o.pad || 22);
        var h = Math.round(size * 1.9);
        var left = o.align === 'center' ? x - w / 2 : (o.align === 'right' ? x - w : x);
        if (left < 6) left = 6;
        if (left + w > W - 6) left = W - 6 - w;
        ctx.globalAlpha = o.alpha == null ? 1 : Math.max(0, Math.min(1, o.alpha));
        api.roundRect(ctx, left, y - h / 2, w, h, h / 2);
        ctx.fillStyle = o.bg || 'rgba(4,9,18,.86)';
        ctx.fill();
        if (o.stroke) {
          if (o.glow) api.glow(ctx, o.stroke, 14);
          ctx.strokeStyle = o.stroke;
          ctx.lineWidth = o.lineWidth || 1.6;
          ctx.stroke();
          api.noGlow(ctx);
        }
        ctx.fillStyle = o.color || C.ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, left + w / 2, y + 1);
        ctx.restore();
        return w;
      }

      function drawPortals(ctx) {
        if (!group) return;
        var g = group, n = g.opts.length, s = sAt(g.z);
        var cy = pyAt(0, s), rr = R * s;
        var fade = (Z_SPAWN - g.z) / 90;
        fade = fade < 0 ? 0 : fade > 1 ? 1 : fade;
        var labA = (740 - g.z) / 180;
        labA = labA < 0 ? 0 : labA > 1 ? 1 : labA;
        var labSize = 16 + (s - 1) * 5;
        labSize = labSize < 16 ? 16 : labSize > 22 ? 22 : labSize;

        for (var i = 0; i < n; i++) {
          var slot = slotOf(i, n);
          var cx = pxAt(SLOT_OFF[slot] * LW, s);
          var sel = slot === ship.slot;
          var col = sel ? T_TEAL : T_SKY;

          ctx.save();
          ctx.globalAlpha = fade;

          // throat
          var grd = ctx.createRadialGradient(cx, cy, rr * 0.05, cx, cy, rr);
          grd.addColorStop(0, rgba(col, 0.30));
          grd.addColorStop(0.55, rgba(col, 0.10));
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.fill();

          // rim
          api.glow(ctx, rgba(col, 0.9), sel ? 26 : 14);
          ctx.strokeStyle = rgba(col, sel ? 0.98 : 0.7);
          ctx.lineWidth = Math.max(1.6, rr * (sel ? 0.11 : 0.075));
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.stroke();
          api.noGlow(ctx);

          // rotating energy arcs
          if (rr > 8) {
            ctx.strokeStyle = rgba(T_WHITE, sel ? 0.65 : 0.38);
            ctx.lineWidth = Math.max(1, rr * 0.05);
            for (var k = 0; k < 6; k++) {
              var a0 = g.spin * (sel ? 1.9 : 1.2) + k * Math.PI / 3;
              ctx.beginPath();
              ctx.arc(cx, cy, rr * 0.78, a0, a0 + 0.34);
              ctx.stroke();
            }
            ctx.strokeStyle = rgba(col, 0.45);
            ctx.lineWidth = Math.max(0.8, rr * 0.03);
            ctx.beginPath();
            ctx.arc(cx, cy, rr * 0.44, -g.spin * 2.4, -g.spin * 2.4 + 4.4);
            ctx.stroke();
          }

          // lock-on brackets on the targeted portal
          if (sel && rr > 14) {
            ctx.strokeStyle = rgba(T_TEAL, 0.85);
            ctx.lineWidth = 2.2;
            var b = rr * 1.22, arm = rr * 0.34;
            for (var q = 0; q < 4; q++) {
              var sx = q < 2 ? -1 : 1, sy = q % 2 === 0 ? -1 : 1;
              ctx.beginPath();
              ctx.moveTo(cx + sx * b, cy + sy * b - sy * arm);
              ctx.lineTo(cx + sx * b, cy + sy * b);
              ctx.lineTo(cx + sx * b - sx * arm, cy + sy * b);
              ctx.stroke();
            }
          }
          ctx.restore();

          // label: sides anchored outward, centre anchored above — never collides
          if (labA > 0.02) {
            var lab = g.opts[i];
            var o = { size: labSize, alpha: labA * fade, color: sel ? C.ink : C.ink2, stroke: sel ? C.teal : 'rgba(255,255,255,.22)', lineWidth: sel ? 2 : 1.4, glow: sel };
            if (slot === 0) { o.align = 'right'; tag(ctx, lab, cx - rr - 10, cy, o); }
            else if (slot === 2) { o.align = 'left'; tag(ctx, lab, cx + rr + 10, cy, o); }
            else { o.align = 'center'; tag(ctx, lab, cx, cy - rr - 20, o); }
          }
        }
      }

      function drawFx(ctx) {
        for (var i = 0; i < fxRings.length; i++) {
          var f = fxRings[i], p = f.t / f.life;
          if (p > 1) continue;
          ctx.save();
          ctx.globalAlpha = (1 - p) * 0.9;
          ctx.strokeStyle = rgba(f.c, 1);
          ctx.lineWidth = f.lw * (1 - p) + 0.8;
          api.glow(ctx, rgba(f.c, 0.8), 20);
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r + (f.max - f.r) * api.ease.outCubic(p), 0, Math.PI * 2);
          ctx.stroke();
          api.noGlow(ctx);
          ctx.restore();
        }
      }

      function drawShip(ctx) {
        var bob = Math.sin(t * 3.2) * 2.0;
        ctx.save();
        ctx.translate(ship.x, SHIP_Y + bob);

        // wake lines toward the vanishing point
        ctx.save();
        ctx.globalAlpha = 0.28 + warpBoost * 0.4;
        ctx.strokeStyle = rgba(T_TEAL, 0.8);
        ctx.lineWidth = 1.4;
        for (var s2 = -1; s2 <= 1; s2 += 2) {
          ctx.beginPath();
          ctx.moveTo(s2 * 27, 12);
          ctx.lineTo((VPX - ship.x) * 0.55 + s2 * 6, (VPY - SHIP_Y) * 0.55 + 4);
          ctx.stroke();
        }
        ctx.restore();

        ctx.rotate(ship.roll);
        var flame = 15 + Math.abs(Math.sin(t * 34)) * 7 + warpBoost * 30;

        // plumes
        api.glow(ctx, C.teal, 22);
        ctx.fillStyle = rgba(T_TEAL, 0.85);
        ctx.beginPath(); ctx.moveTo(-13, 13); ctx.lineTo(-5, 13); ctx.lineTo(-9, 13 + flame); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(5, 13); ctx.lineTo(13, 13); ctx.lineTo(9, 13 + flame); ctx.closePath(); ctx.fill();
        ctx.fillStyle = rgba(T_WHITE, 0.9);
        ctx.beginPath(); ctx.moveTo(-11, 13); ctx.lineTo(-7, 13); ctx.lineTo(-9, 13 + flame * 0.55); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(7, 13); ctx.lineTo(11, 13); ctx.lineTo(9, 13 + flame * 0.55); ctx.closePath(); ctx.fill();
        api.noGlow(ctx);

        // hull
        api.glow(ctx, hitFlash > 0 ? C.red : C.teal, 20);
        ctx.beginPath();
        ctx.moveTo(0, -26);
        ctx.lineTo(9, -4);
        ctx.lineTo(27, 13);
        ctx.lineTo(13, 13);
        ctx.lineTo(6, 6);
        ctx.lineTo(-6, 6);
        ctx.lineTo(-13, 13);
        ctx.lineTo(-27, 13);
        ctx.lineTo(-9, -4);
        ctx.closePath();
        ctx.fillStyle = hitFlash > 0 ? 'rgba(60,16,22,.95)' : 'rgba(9,22,34,.95)';
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = hitFlash > 0 ? C.red : C.teal;
        ctx.stroke();
        api.noGlow(ctx);

        // canopy
        ctx.fillStyle = rgba(T_SKY, 0.85);
        ctx.beginPath();
        ctx.ellipse(0, -9, 4.2, 8.4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (hitFlash > 0) {
          ctx.globalAlpha = hitFlash;
          api.glow(ctx, C.red, 26);
          ctx.strokeStyle = C.red;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, -2, 30 + (1 - hitFlash) * 30, 0, Math.PI * 2);
          ctx.stroke();
          api.noGlow(ctx);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }

      function panelLines(ctx, str, width, size, weight) {
        ctx.save();
        ctx.font = api.font(size, 'body', weight || 600);
        var lines = api.wrap(ctx, str, width);
        ctx.restore();
        return lines;
      }

      function drawPanel(ctx) {
        var accent = verdict ? (verdict.ok ? C.green : C.red) : C.teal;
        var aT = verdict ? (verdict.ok ? T_GREEN : T_RED) : T_TEAL;

        ctx.save();
        api.roundRect(ctx, PX, PY, PW, PH, 16);
        ctx.fillStyle = 'rgba(6,12,22,.88)';
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = rgba(aT, verdict ? 0.75 : 0.4);
        ctx.stroke();
        api.roundRect(ctx, PX + 11, PY + 15, 5, PH - 30, 3);
        ctx.fillStyle = accent;
        ctx.fill();
        ctx.restore();

        // question level, straight from the shell
        var lv = api.progress.level;
        tag(ctx, 'SECTOR ' + lv + ' · ' + (SECTOR_NAMES[lv - 1] || 'HARD'), PX + PW - 16, PY + 30, { align: 'right', size: 16, color: C.gold2, stroke: 'rgba(226,182,87,.45)', lineWidth: 1.4 });

        if (verdict) {
          var item = verdict.item;
          // left: what it used to be
          api.text(ctx, 'BEFORE THE OVERHAUL', PX + 30, PY + 32, { size: 16, color: C.muted, weight: 700 });
          api.text(ctx, item.old, PX + 30, PY + 70, { size: 26, fam: 'mono', color: C.ink2 });
          if (verdict.tlines === null) verdict.tlines = item.title ? panelLines(ctx, item.title, 372, 16) : [];
          for (var i = 0; i < verdict.tlines.length && i < 2; i++) api.text(ctx, verdict.tlines[i], PX + 30, PY + 96 + i * 19, { size: 16, color: C.muted });
          // arrow
          api.text(ctx, '→', PX + 432, PY + 70, { size: 30, color: accent, align: 'center', weight: 700 });
          // right: what it is now
          api.text(ctx, verdict.ok ? 'WARPED — CORRECT' : 'IT IS NOW', PX + 472, PY + 32, { size: 16, color: accent, weight: 700 });
          ctx.save();
          api.glow(ctx, accent, 16);
          api.text(ctx, verdict.cite, PX + 472, PY + 70, { size: 26, fam: 'mono', color: accent });
          api.noGlow(ctx);
          ctx.restore();
          if (verdict.lines === null) verdict.lines = panelLines(ctx, sentence(verdict.note, 200) || 'Renumbered by the Revolutionary FAR Overhaul.', 428, 16);
          for (var j = 0; j < verdict.lines.length && j < 2; j++) {
            api.text(ctx, verdict.lines[j], PX + 472, PY + 96 + j * 19, { size: 16, color: C.ink2 });
          }
          return;
        }

        if (!group) {
          api.text(ctx, 'STANDING BY', PX + 30, PY + 32, { size: 16, color: C.muted, weight: 700 });
          api.text(ctx, 'Warp corridor clear', PX + 30, PY + 70, { size: 26, fam: 'mono', color: C.ink2 });
          return;
        }

        var g = group;
        api.text(ctx, 'BEFORE THE OVERHAUL', PX + 30, PY + 32, { size: 16, color: C.teal, weight: 700 });
        ctx.save();
        api.glow(ctx, C.teal, 16);
        api.text(ctx, g.item.old, PX + 30, PY + 78, { size: 32, fam: 'mono', color: C.ink });
        api.noGlow(ctx);
        ctx.restore();
        if (g.lines === null) g.lines = g.item.title ? panelLines(ctx, g.item.title, PW - 60, 17) : [];
        for (var k = 0; k < g.lines.length && k < 2; k++) {
          api.text(ctx, g.lines[k], PX + 30, PY + 104 + k * 21, { size: 17, color: C.ink2 });
        }
      }

      function drawConsole(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(4,8,16,.94)';
        ctx.fillRect(0, FIELD_BOT, W, H - FIELD_BOT);
        ctx.strokeStyle = 'rgba(79,209,197,.22)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, FIELD_BOT + 0.5);
        ctx.lineTo(W, FIELD_BOT + 0.5);
        ctx.stroke();
        ctx.restore();

        var src = group ? group : (verdict ? verdict.shot : null);
        var n = src ? src.opts.length : 0;
        for (var slot = 0; slot < 3; slot++) {
          var label = null, sel = slot === ship.slot, isRight = false, wasGiven = false;
          for (var i = 0; i < n; i++) {
            if (slotOf(i, n) !== slot) continue;
            label = src.opts[i];
            if (verdict && src.given === i) wasGiven = true;
            break;
          }
          var cx = CHIP_X[slot];
          if (label === null) {
            ctx.save();
            ctx.globalAlpha = 0.4;
            tag(ctx, slot === 0 ? '◀' : (slot === 2 ? '▶' : '●'), cx, CONSOLE_Y, { align: 'center', size: 16, color: sel ? C.teal : C.muted, stroke: sel ? C.teal : 'rgba(255,255,255,.14)' });
            ctx.restore();
            continue;
          }
          if (verdict && norm(label) === norm(verdict.cite)) isRight = true;
          var bad = !!verdict && wasGiven && !isRight;
          tag(ctx, label, cx, CONSOLE_Y, {
            align: 'center', size: 16,
            color: isRight ? C.ink : (bad ? C.ink2 : (sel && !verdict ? C.ink : C.ink2)),
            bg: isRight ? 'rgba(95,211,154,.18)' : (bad ? 'rgba(255,107,107,.16)' : (sel && !verdict ? 'rgba(79,209,197,.16)' : 'rgba(10,17,30,.92)')),
            stroke: isRight ? C.green : (bad ? C.red : (sel && !verdict ? C.teal : 'rgba(255,255,255,.16)')),
            lineWidth: isRight || bad || sel ? 2 : 1.3,
            glow: isRight || bad || (sel && !verdict)
          });
          if (sel && !verdict) {
            ctx.save();
            ctx.strokeStyle = rgba(T_TEAL, 0.5);
            ctx.lineWidth = 1.4;
            if (ctx.setLineDash) ctx.setLineDash([4, 5]);
            ctx.beginPath();
            ctx.moveTo(SLOT_X[slot], FIELD_BOT - 6);
            ctx.lineTo(cx, CONSOLE_Y - 17);
            ctx.stroke();
            if (ctx.setLineDash) ctx.setLineDash([]);
            ctx.restore();
          }
        }
      }

      function drawHint(ctx) {
        if (hint <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, hint / 0.8);
        var msg = 'Fly through the portal holding the citation that replaced it';
        var sub = '← →  or  A / D  ·  1 2 3  ·  tap or drag a third of the screen';
        var y = FIELD_TOP + 34;
        ctx.font = api.font(17, 'body', 700);
        var w = ctx.measureText(msg).width;
        ctx.font = api.font(16, 'mono', 700);
        w = Math.max(w, ctx.measureText(sub).width) + 40;
        if (w > W - 32) w = W - 32;
        api.roundRect(ctx, (W - w) / 2, y - 26, w, 66, 14);
        ctx.fillStyle = 'rgba(4,9,18,.82)';
        ctx.fill();
        ctx.strokeStyle = rgba(T_TEAL, 0.4);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        api.text(ctx, msg, W / 2, y, { size: 17, align: 'center', color: C.ink, weight: 700 });
        api.text(ctx, sub, W / 2, y + 26, { size: 16, align: 'center', color: C.muted, fam: 'mono' });
        ctx.restore();
      }

      function drawFade(ctx) {
        var f = ctx.createLinearGradient(0, FIELD_TOP, 0, FIELD_TOP + 50);
        f.addColorStop(0, 'rgba(4,8,16,.9)');
        f.addColorStop(1, 'rgba(4,8,16,0)');
        ctx.fillStyle = f;
        ctx.fillRect(0, FIELD_TOP, W, 50);
      }

      // ---------------------------------------------------------------- instance
      if (!all.length) {
        return {
          update: function () { if (!over) finishRound(false, 'No crosswalk pairs available'); },
          draw: function (ctx) {
            drawBackdrop(ctx);
            api.text(ctx, 'No verified crosswalk pairs are loaded.', W / 2, H / 2, { size: 20, align: 'center', color: C.ink2 });
          },
          onKey: function () {}, onPointer: function () {}, destroy: function () {}
        };
      }

      nextPair();

      return {
        update: function (dt) {
          if (over) return;
          t += dt;
          if (hint > 0) hint -= dt;
          if (warpBoost > 0) warpBoost = Math.max(0, warpBoost - dt * 1.5);
          if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - dt * 1.6);

          // deferred sounds
          for (var q = sfxQ.length - 1; q >= 0; q--) {
            sfxQ[q].t -= dt;
            if (sfxQ[q].t <= 0) { var fn = sfxQ[q].fn; sfxQ.splice(q, 1); try { fn(); } catch (e) {} }
          }

          // clock
          timeLeft -= dt;
          var shown = Math.max(0, Math.ceil(timeLeft));
          if (shown !== shownTime) {
            shownTime = shown;
            api.hud.set({ time: shown });
            if (shown > 0 && shown <= 5) api.audio.tick();
          }
          if (timeLeft <= 0) { finishRound(right > answered - right, 'Out of time'); return; }

          // steering (lane changes fire on keydown; the hull eases across)
          ship.x += (ship.tx - ship.x) * Math.min(1, dt * 13);
          var drift = (ship.tx - ship.x) / LANE_PX;
          ship.roll += (drift * 0.42 - ship.roll) * Math.min(1, dt * 9);

          // corridor flow
          var fs = flowSpeed();
          dash += fs * dt * 0.7;
          var i;
          for (i = 0; i < stars.length; i++) {
            var st = stars[i];
            st.z -= fs * dt * 1.25;
            if (st.z <= Z_GONE) { st.z += 2600; st.a = api.rand(0, Math.PI * 2); st.r = api.rand(120, 560); }
          }
          for (i = 0; i < rings.length; i++) {
            rings[i].z -= fs * dt;
            if (rings[i].z <= 55) rings[i].z += rings.length * 150;
          }
          for (i = fxRings.length - 1; i >= 0; i--) {
            fxRings[i].t += dt;
            if (fxRings[i].t >= fxRings[i].life) fxRings.splice(i, 1);
          }

          if (phase === 'approach' && group) {
            group.spin += dt * 1.5;
            group.z -= APPROACH * dt;                        // fixed approach in every sector
            if (group.z <= Z_GATE) resolve();
          } else if (phase === 'resolve') {
            gap -= dt;
            if (gap <= 0) {
              if (dying) { finishRound(false, 'Hull breach'); return; }
              verdict = null;
              nextPair();
            }
          }
        },

        draw: function (ctx) {
          drawBackdrop(ctx);

          ctx.save();
          ctx.beginPath();
          ctx.rect(0, FIELD_TOP, W, FIELD_BOT - FIELD_TOP);
          ctx.clip();
          drawCorridor(ctx);
          drawStars(ctx);
          drawPortals(ctx);
          drawFx(ctx);
          drawShip(ctx);
          ctx.restore();

          drawFade(ctx);
          drawPanel(ctx);
          drawConsole(ctx);
          drawHint(ctx);
        },

        onKey: function (k, down) {
          if (!down || over) return;
          if (k === 'ArrowLeft' || k === 'a' || k === 'A') setSlot(ship.slot - 1);
          else if (k === 'ArrowRight' || k === 'd' || k === 'D') setSlot(ship.slot + 1);
          else if (k === '1') setSlot(0);
          else if (k === '2') setSlot(1);
          else if (k === '3') setSlot(2);
        },

        onPointer: function (p) {
          if (over) return;
          if (p.type === 'down') { hint = Math.min(hint, 0.4); setSlot(slotFromX(p.x)); }
          else if (p.type === 'move' && api.input.pointer.down) setSlot(slotFromX(p.x));
        },

        destroy: function () {
          over = true;
          group = null;
          verdict = null;
          stars.length = 0;
          rings.length = 0;
          fxRings.length = 0;
          sfxQ.length = 0;
          all.length = 0;
          pool.length = 0;
          byPart = {};
          oldsOf = Object.create(null);
        }
      };
    }
  });
})();
