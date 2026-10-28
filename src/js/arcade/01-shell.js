/* ARCADE-01-SHELL — lobby (rank, pace, sound, game cabinets), play screen (HUD bar, prompt panel, fluid canvas stage,
   answer panel), reading pause, pause menu, and results with XP, rank and a study list. */
(function () {
  'use strict';
  var A = window.ARCADE;
  var root = null, viewEl = null, run = null, lobbyRaf = 0, params = {};

  function h(tag, attrs) {
    var m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag || 'div'); var el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) m[2].match(/[.#][\w-]+/g).forEach(function (t) { if (t[0] === '.') el.classList.add(t.slice(1)); else el.id = t.slice(1); });
    var kids = Array.prototype.slice.call(arguments, 2);
    if (attrs && (attrs instanceof Node || typeof attrs !== 'object' || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    if (attrs) Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v == null || v === false) return; if (k === 'class') el.className = v; else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (sk) { if (sk.indexOf('--') === 0) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; }); else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v); else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v === true ? '' : v); });
    (function add(c) { if (c == null || c === false) return; if (Array.isArray(c)) { c.forEach(add); return; } if (c instanceof Node) { el.appendChild(c); return; } el.appendChild(document.createTextNode(String(c))); })(kids);
    return el;
  }
  A.h = h;
  function meta() { return A.DATA.meta || {}; }
  function appName() { return meta().app_name || 'B2B Guide'; }
  function fmt(n) { return Math.round(n || 0).toLocaleString('en-US'); }
  function host(fn) { return A.host && typeof A.host[fn] === 'function' ? A.host[fn] : null; }
  function setView() { if (!viewEl) { viewEl = h('div.ar-view'); root.appendChild(viewEl); } viewEl.innerHTML = ''; for (var i = 0; i < arguments.length; i++) if (arguments[i]) viewEl.appendChild(arguments[i]); }
  function scrollTop() { try { window.scrollTo(0, 0); } catch (e) {} }

  function soundButtons() {
    var fx = h('button.ar-btn.sm.ar-tog', { type: 'button', 'aria-pressed': A.audio.muted ? 'false' : 'true', title: 'Sound effects (M)', onclick: function () { A.audio.setMuted(!A.audio.muted); paint(); } });
    var mu = h('button.ar-btn.sm.ar-tog', { type: 'button', 'aria-pressed': A.music.on ? 'true' : 'false', title: 'Music', onclick: function () { A.music.set(!A.music.on); paint(); } });
    function paint() { fx.textContent = (A.audio.muted ? '🔇' : '🔊') + ' Sound ' + (A.audio.muted ? 'off' : 'on'); fx.setAttribute('aria-pressed', A.audio.muted ? 'false' : 'true'); mu.textContent = '🎵 Music ' + (A.music.on ? 'on' : 'off'); mu.setAttribute('aria-pressed', A.music.on ? 'true' : 'false'); mu.disabled = A.audio.muted; }
    paint(); return [fx, mu];
  }

  // ---------- lobby ----------
  function paceLine(t) {
    var speed = t.timeScale < 0.7 ? 'Slow motion' : t.timeScale < 1 ? 'A bit slower than full speed' : t.timeScale === 1 ? 'Full speed' : 'Faster than full speed';
    var read = t.read === 'hold' ? 'Each question waits until you press Go.' : t.read === 'brief' ? 'A short pause to read each question.' : 'No pause to read.';
    return speed + ' and ' + t.lives + ' lives. ' + read;
  }
  function rankCard(rk) {
    return h('div.ar-rank', {},
      h('div.ar-rank-badge', { 'aria-hidden': 'true' }, h('b', {}, String(rk.level))),
      h('div.ar-rank-copy', {}, h('small', {}, 'Your rank · level ' + rk.level), h('strong', {}, rk.name),
        h('div.ar-xpbar', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(rk.pct * 100)), 'aria-label': 'XP to the next rank' }, h('span', { style: { width: Math.round(rk.pct * 100) + '%' } })),
        h('small', {}, fmt(rk.xp) + ' XP · ' + fmt(rk.to - rk.xp) + ' to ' + rk.next)));
  }
  function showLobby() {
    if (run) endRun();
    stopLobby(); A.music.stop();
    document.title = 'Arcade · ' + appName();
    var tier = A.tier(), rk = A.rank();
    var screen = h('div.ar-lobby');
    screen.appendChild(h('header.ar-hero', {},
      h('div.ar-hero-copy', {}, h('div.ar-kicker', {}, h('i'), 'B2B Arcade'),
        h('h1.ar-h1', {}, 'Play your way ', h('em', {}, 'to the exam.')),
        h('p.ar-lede', {}, 'Five action games built on the guide\'s checked question bank, key numbers, FAR parts, forms and glossary. Every miss lands on a study list with the answer, the reason and the FAR cite.')),
      rankCard(rk)));
    screen.appendChild(h('div.ar-setup', {},
      h('div.ar-pace-row', {}, h('span.ar-pace-label', {}, 'Pace'), h('div.ar-paces', { role: 'radiogroup', 'aria-label': 'Pace' }, A.TIERS.map(function (t, ti) {
        var on = t.id === tier.id;
        return h('button.ar-pace' + (on ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', title: t.badge + ': ' + t.desc, style: { '--tc': t.color }, onclick: function () { var y = window.scrollY; A.setTier(t.id); showLobby(); window.scrollTo(0, y); } },
          h('span.ar-tier-dots', {}, [0, 1, 2, 3].map(function (k) { return h('i' + (k <= ti ? '.on' : '')); })), h('b', {}, t.name), h('small', {}, t.badge));
      }))),
      h('div.ar-sound', {}, soundButtons()),
      h('p.ar-pace-line', {}, h('b', { style: { '--tc': tier.color } }, tier.name + ': '), paceLine(tier), ' ', h('span', {}, 'New here? Start at Recruit.'))));
    var grid = h('div.ar-cabinets'), thumbs = [];
    A.order.forEach(function (id, i) {
      var def = A.games[id], ok = true; try { ok = !def.dataOk || !!def.dataOk(A.DATA); } catch (e) { ok = false; }
      var best = A.best.get(id, tier.id), any = A.best.any(id);
      var cv = h('canvas', { width: '480', height: '240', 'aria-hidden': 'true' });
      if (def.thumb) thumbs.push({ cv: cv, def: def });
      grid.appendChild(h('button.ar-cab' + (ok ? '' : '.off'), { type: 'button', style: { '--accent': def.accent || A.C.gold, animationDelay: (i * 70) + 'ms' }, disabled: !ok, onclick: function () { if (ok) startGame(id); } },
        h('div.ar-cab-art', {}, def.thumb ? cv : h('span.ar-cab-ico', {}, def.icon || '🎮'), h('span.ar-genre', {}, def.genre || 'Arcade')),
        h('div.ar-cab-body', {},
          h('h3', {}, h('span.ar-cab-emoji', { 'aria-hidden': 'true' }, def.icon || ''), def.title),
          h('p.tag', {}, def.tagline || ''),
          h('div.drills', {}, def.drills ? 'Drills · ' + def.drills : ''),
          h('div.foot', {}, best && best.plays ? h('span', {}, 'Best ', h('b', {}, fmt(best.best)), ' at ' + tier.name) : any ? h('span', {}, h('b', {}, String(any.plays)), any.plays === 1 ? ' play' : ' plays', ' · not yet at ' + tier.name) : h('span', {}, ok ? 'Not played yet' : 'Needs content'),
            h('span.go', {}, ok ? 'Play ▶' : 'Locked')))));
    });
    screen.appendChild(grid);
    var quick = A.DATA.quick || [];
    if (quick.length) screen.appendChild(h('section.ar-quick', {}, h('h2', {}, 'Quick drills'), h('p', {}, 'The same facts without the action: tap-to-answer rounds that work with a screen reader.'),
      h('div.ar-quick-row', {}, quick.map(function (q) { return h('a.ar-quick-item', { href: q.href }, h('b', {}, q.title), h('span', {}, q.sub || '')); }))));
    screen.appendChild(h('div.ar-note', {}, h('span', { 'aria-hidden': 'true' }, '🎓'), h('div', {}, h('b', {}, 'Training aid, not official guidance. '),
      'Game content comes from this guide\'s checked data (content checked ' + (meta().content_verified_on || '2026') + ', FAR Overhaul numbering). Scores, XP and missed questions stay in your progress and are saved with it; nothing is sent anywhere.',
      h('span.ar-keys', {}, ' Keyboard: arrows or WASD move, Space or Enter acts, 1 to 4 answer, P pauses, M mutes.'))));
    setView(screen);
    runLobby(thumbs);
  }
  // the cabinets play a small attract-mode animation, about 30 frames a second
  function runLobby(thumbs) {
    if (!thumbs.length) return;
    var t0 = performance.now(), last = 0, token = {};
    lobbyRaf = token;
    thumbs.forEach(function (t) { t.ctx = t.cv.getContext('2d'); });
    function step(now) {
      if (lobbyRaf !== token) return;
      if (now - last > 33) {
        last = now; var t = (now - t0) / 1000;
        thumbs.forEach(function (th) { try { th.ctx.setTransform(1, 0, 0, 1, 0, 0); th.ctx.clearRect(0, 0, 480, 240); th.def.thumb(th.ctx, 480, 240, t); } catch (e) {} });
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function stopLobby() { lobbyRaf = 0; }

  // ---------- play ----------
  function startGame(id, opts) {
    var def = A.games[id]; if (!def) return;
    opts = opts || {};
    stopLobby();
    if (run) endRun();
    var tier = A.tier();
    A.audio.resume();
    document.title = def.title + ' · Arcade';
    if (host('playing')) host('playing')(true);

    // ---- DOM ----
    var hudScore = h('b', {}, '0'), hudBest = h('b', {}, fmt((A.best.get(id, tier.id) || {}).best || 0)), hudLevel = h('b', {}, '1'), hudTime = h('b', {}, ''), hudLives = h('span.ar-lives', { 'aria-label': 'Lives' });
    var timeItem = h('div.ar-hud-i.time', { hidden: true }, h('small', {}, 'Time'), hudTime);
    var pauseBtn = h('button.ar-btn.sm', { type: 'button', title: 'Pause (P)', 'aria-label': 'Pause', onclick: function () { togglePause(); } }, '⏸');
    var muteBtn = h('button.ar-btn.sm.ar-hide-xs', { type: 'button', title: 'Sound (M)', 'aria-label': 'Sound', onclick: function () { A.audio.setMuted(!A.audio.muted); muteBtn.textContent = A.audio.muted ? '🔇' : '🔊'; } }, A.audio.muted ? '🔇' : '🔊');
    var bar = h('header.ar-bar', {},
      h('button.ar-btn.sm', { type: 'button', title: 'Back to the game list', onclick: function () { if (state.ended || !state.review.length) showLobby(); else togglePause(true); } }, '← ', h('span.ar-hide-xs', {}, 'Games')),
      h('div.ar-bar-title', {}, h('b', {}, (def.icon ? def.icon + ' ' : '') + def.title), h('span.ar-chip', { style: { '--tc': tier.color } }, tier.name)),
      h('div.ar-hud', {}, h('div.ar-hud-i', {}, h('small', {}, 'Score'), hudScore), h('div.ar-hud-i.ar-hide-sm', {}, h('small', {}, 'Best'), hudBest), h('div.ar-hud-i.ar-hide-xs', {}, h('small', {}, 'Level'), hudLevel), timeItem, h('div.ar-hud-i', {}, h('small', {}, def.livesLabel || 'Lives'), hudLives)),
      muteBtn, pauseBtn);
    var pK = h('div.ar-prompt-k'), pT = h('div.ar-prompt-t'), pS = h('div.ar-prompt-s');
    var listen = host('speak') ? h('button.ar-listen', { type: 'button', title: 'Read aloud', 'aria-label': 'Read the question aloud', onclick: function () { host('speak')(pT.textContent + '. ' + pS.textContent); } }, '🔊') : null;
    var promptEl = h('section.ar-prompt', { hidden: true, 'aria-live': 'polite' }, h('div.ar-prompt-copy', {}, pK, pT, pS), listen);
    var canvas = h('canvas.ar-canvas'), box = h('div.ar-box', {}, canvas), stage = h('div.ar-stage', {}, box);
    var banner = h('div.ar-banner'), flashEl = h('div.ar-flash'), hint = h('div.ar-hint', { hidden: true });
    var gateTitle = h('b', {}, ''), gateSub = h('small', {}, ''), gateBar = h('span'), gateBarWrap = h('div.ar-gate-bar', {}, gateBar);
    var gateGo = h('button.ar-gate-go', { type: 'button', onclick: function () { releaseGate(); } }, '▶ Go');
    var gateEl = h('div.ar-gate', { hidden: true, role: 'status' }, h('div.ar-gate-copy', {}, gateTitle, gateSub), gateBarWrap, gateGo);
    box.appendChild(banner); box.appendChild(flashEl); box.appendChild(hint); box.appendChild(gateEl);
    if (def.gateAt) box.classList.add('gate-' + def.gateAt);   // where the reading-pause box hides the least of this game's scene
    var toolsEl = h('div.ar-tools', { hidden: true }), timerEl = h('div.ar-qtimer', { hidden: true }, h('span')), optsEl = h('div.ar-opts'), fbEl = h('div.ar-fb', { hidden: true });
    var choicesEl = h('section.ar-choices', { hidden: true }, toolsEl, timerEl, optsEl);
    box.appendChild(fbEl);   // the explanation is a text box over the bottom of the scene, so the stage never jumps in size
    var playEl = h('div.ar-play', { 'data-game': id }, bar, promptEl, stage, choicesEl);
    // on the body, not in the view: the view's entry animation (a transform) would turn position: fixed into a box inside the page
    document.body.appendChild(playEl);
    document.documentElement.classList.add('ar-playing');
    scrollTop();

    // ---- state ----
    var ctx = canvas.getContext('2d');
    var particles = new A.Particles(), floaters = new A.Floaters();
    var state = { id: id, def: def, tier: tier, score: 0, lives: tier.lives, maxLives: tier.lives, level: 1, elapsed: 0, gameTime: 0, review: [], ended: false, paused: false, shake: 0, bannerTimer: 0, keys: new Set(), pointer: { x: 0, y: 0, down: false }, xp: 0, W: 960, H: 540, scale: 1, opts: opts };
    run = state;
    var gate = null, swallowPointer = null, inst = null, choiceCb = null, contCb = null, contTimer = 0;

    // ---- question memory across runs ----
    var runId = String(Date.now()), recent = [], rotKey = id;
    function rotation() { return A.rotation.bucket(rotKey); }
    function normText(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
    function defaultKey(it) { return String(it.id || it.stem || it.prompt || it.term || JSON.stringify(it).slice(0, 120)); }
    function fingerprint(it) { return normText(it && (it.stem || it.prompt || it.clue || it.term || it.text)).slice(0, 40); }
    function nearest(list, want, diffOf) { var best = [], bestDist = 9; list.forEach(function (it) { var d = Math.abs(diffOf(it) - want); if (d < bestDist) { bestDist = d; best = [it]; } else if (d === bestDist) best.push(it); }); return best; }
    function noteResult(r) {
      var key = r && r.key ? A.hash(r.key) : '', match = null, i, prompt = normText(r && r.prompt);
      if (!key && prompt) for (i = recent.length - 1; i >= 0; i--) if (recent[i].text && prompt.indexOf(recent[i].text) >= 0) { match = recent[i]; break; }
      if (match) key = match.key;
      if (!key) return;
      var b = rotation(); b.seen[key] = 1;
      if (r.ok) delete b.missed[key]; else b.missed[key] = runId;
      A.rotation.save();
    }

    // ---- fluid stage: the box keeps the game's aspect range; logical px = CSS px up to 960 x 900, then the scene scales up ----
    function fit() {
      var r = stage.getBoundingClientRect(), aw = Math.max(80, r.width), ah = Math.max(80, r.height);
      var asp = def.aspect || [0.42, 2.2], hi = asp[1], lo = asp[0];
      if (!def.aspect && ah >= 520) hi = Math.min(hi, 1.9);
      var bw = aw, bh = ah;
      if (bw / bh > hi) bw = bh * hi; else if (bw / bh < lo) bh = bw / lo;
      box.style.width = Math.floor(bw) + 'px'; box.style.height = Math.floor(bh) + 'px';
      var k = Math.max(bw / 960, bh / 900, 1); if (bw / k < 360) k = bw / 360;
      var W = Math.round(bw / k), H = Math.round(bh / k), dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(bw * dpr)); canvas.height = Math.max(1, Math.round(bh * dpr));
      var changed = W !== state.W || H !== state.H;
      state.W = W; state.H = H; state.scale = canvas.width / W;
      try { ctx.letterSpacing = '0.01px'; } catch (e) {}
      if (changed && inst && inst.resize) safe(function () { inst.resize(W, H); });
      var portrait = bw / bh < 1;
      var coarse = false; try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
      if (def.orient && coarse && ((def.orient === 'landscape' && portrait) || (def.orient === 'portrait' && aw / ah > 1.25))) {
        hint.textContent = def.orient === 'landscape' ? 'Turn your phone sideways for a bigger view.' : 'Hold your phone upright for a bigger view.'; hint.hidden = false;
        clearTimeout(hint._t); hint._t = setTimeout(function () { hint.hidden = true; }, 4200);
      } else hint.hidden = true;
    }
    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { fit(); }); ro.observe(stage); }
    window.addEventListener('resize', fit);

    // ---- the api a game sees ----
    var api = {
      get W() { return state.W; }, get H() { return state.H; }, data: A.DATA, C: A.C,
      rand: A.rand, randInt: A.randInt, pick: A.pick, shuffle: A.shuffle, clamp: A.clamp, lerp: A.lerp, dist: A.dist, ease: A.ease, hexA: A.hexA, shade: A.shade,
      font: A.font, text: A.text, wrap: A.wrap, fitText: A.fitText, roundRect: A.roundRect, glow: A.glow, noGlow: A.noGlow, pill: A.pill, star: A.star,
      particles: particles, floaters: floaters, audio: A.audio, music: A.music,
      input: { keys: state.keys, pointer: state.pointer }, get paused() { return state.paused; }, get elapsed() { return state.gameTime; }, get realTime() { return state.elapsed; },
      bestScore: (A.best.get(id, tier.id) || {}).best || 0,
      difficulty: { id: tier.id, name: tier.name, timeScale: tier.timeScale, lives: tier.lives, read: tier.read, limit: tier.limit },
      opts: opts,
      // In-run question levels: easy questions first, harder ones every perLevel right answers; the clock slows at each level.
      progress: (function () {
        var p = {
          level: 1, maxLevel: 3, perLevel: 5, right: 0, sinceUp: 0, used: {}, poolAll: {}, names: ['Easy questions', 'Medium questions', 'Hard questions'], slow: true,
          configure: function (o) { o = o || {}; if (o.perLevel > 0) p.perLevel = o.perLevel; if (o.maxLevel > 0) p.maxLevel = Math.min(3, o.maxLevel); if (o.names) p.names = o.names; if (o.slow === false) p.slow = false; return p; },
          difficultyOf: function (item) { var d = Math.round(Number(item && (item.d != null ? item.d : item.difficulty))); return d >= 1 && d <= 3 ? d : 2; },
          // the next item: no repeats in a run; missed items from earlier runs about a third of the time; otherwise items not
          // seen in earlier runs at this level's difficulty. A new shuffle starts once the whole set has been seen.
          pick: function (pool, keyOf) {
            pool = (pool || []).filter(Boolean); if (!pool.length) return null;
            keyOf = keyOf || defaultKey;
            var want = Math.min(p.level, 3), keys = pool.map(function (it) { return A.hash(keyOf(it)); });
            keys.forEach(function (k) { p.poolAll[k] = 1; });
            var open = pool.filter(function (it) { return !p.used[keyOf(it)]; });
            if (!open.length) { p.used = {}; open = pool.slice(); }
            var bucket = rotation(), chosen = null, via = 'fresh';
            var missed = open.filter(function (it) { var m = bucket.missed[A.hash(keyOf(it))]; return !!m && m !== runId; });
            if (missed.length && Math.random() < 0.34) { chosen = A.pick(nearest(missed, want, p.difficultyOf)); via = 'review'; }
            if (!chosen) {
              var fresh = open.filter(function (it) { return !bucket.seen[A.hash(keyOf(it))]; });
              if (!fresh.length) { keys.forEach(function (k) { delete bucket.seen[k]; }); A.rotation.save(); fresh = open; }
              chosen = A.pick(nearest(fresh, want, p.difficultyOf));
            }
            p.used[keyOf(chosen)] = 1;
            recent.push({ key: A.hash(keyOf(chosen)), text: fingerprint(chosen), via: via }); if (recent.length > 10) recent.shift();
            chosen.__via = via;
            return chosen;
          },
          correct: function () {
            p.right++; p.sinceUp++;
            if (p.sinceUp >= p.perLevel && p.level < p.maxLevel) {
              p.level++; p.sinceUp = 0;
              api.hud.set({ level: p.level, banner: 'Level ' + p.level + ' · ' + p.names[p.level - 1], sub: p.slow ? 'Harder questions. The game slows a little so you have time to think.' : 'Harder questions.', bannerTime: 2.4 });
              A.audio.levelUp();
              return true;
            }
            return false;
          },
          clock: function () { return p.slow ? [1, 0.9, 0.82][Math.min(p.level, 3) - 1] : 1; }
        };
        return p;
      })(),
      hud: { set: function (o) {
        o = o || {};
        if (o.score != null) { state.score = o.score; hudScore.textContent = fmt(o.score); }
        if (o.lives != null) { state.lives = o.lives; drawLives(); }
        if (o.maxLives != null) { state.maxLives = o.maxLives; drawLives(); }
        if (o.level != null) { state.level = o.level; hudLevel.textContent = String(o.level); }
        if (o.time !== undefined) { timeItem.hidden = o.time == null; hudTime.textContent = o.time == null ? '' : Math.ceil(o.time) + 's'; timeItem.classList.toggle('low', o.time != null && o.time <= 5); }
        if (o.banner !== undefined) { if (o.banner) { banner.innerHTML = ''; banner.appendChild(h('b', {}, o.banner)); if (o.sub) banner.appendChild(h('small', {}, o.sub)); banner.style.setProperty('--bc', o.color || A.C.gold); banner.classList.add('on'); state.bannerTimer = o.bannerTime || 1.6; } else banner.classList.remove('on'); }
      } },
      score: function (n) { state.score = Math.max(0, state.score + (n || 0)); hudScore.textContent = fmt(state.score); if (state.score > api.bestScore) hudBest.textContent = fmt(state.score); return state.score; },
      life: function (n) { state.lives = A.clamp(state.lives + (n || 0), 0, 9); drawLives(); if (n < 0) { playEl.classList.remove('ar-hurt'); void playEl.offsetWidth; playEl.classList.add('ar-hurt'); } if (state.lives <= 0) setTimeout(function () { if (!state.ended) finish(false, { title: def.outTitle || 'Out of lives' }); }, 650); return state.lives; },
      xp: function (n) { state.xp += Math.max(0, n || 0); return state.xp; },
      // r: { prompt, given, correct, ok, explanation, cite, lesson, qid, key }
      review: { add: function (r) { if (!r) return; state.review.push(r); noteResult(r); if (r.ok) state.xp += 10; if (r.qid && host('onAnswer')) { try { host('onAnswer')(r.qid, !!r.ok); } catch (e) {} } } },
      // a new question became active: Recruit freezes until Go, Regular gives a reading window, Veteran and Elite do nothing
      ready: function (o) {
        if (tier.read === 'off') return false;
        if (typeof o === 'string') o = { text: o };
        o = o || {};
        var words = String(o.text || pT.textContent || '').split(/\s+/).filter(Boolean).length, left = A.clamp(1.2 + words * 0.3, 2.5, 9);
        if (gate && gate.armed) { gateEl.hidden = true; box.classList.remove('is-reading'); }
        gate = { mode: tier.read, delay: o.delay != null ? o.delay : 0.35, armed: false, left: left, total: left };
        return true;
      },
      get reading() { return !!(gate && gate.armed); },
      end: function (o) { finish(!!(o && o.won), o); },
      shake: function (px) { state.shake = Math.max(state.shake, px || 8); },
      flash: function (color) { flashEl.style.background = color || 'rgba(255,255,255,.6)'; flashEl.style.transition = 'none'; flashEl.style.opacity = '1'; requestAnimationFrame(function () { flashEl.style.transition = 'opacity .45s'; flashEl.style.opacity = '0'; }); },
      prompt: {
        set: function (o) { o = o || {}; pK.textContent = o.kicker || ''; pT.textContent = o.text || ''; pS.textContent = o.sub || ''; pS.hidden = !o.sub; promptEl.style.setProperty('--pc', o.color || A.C.gold); promptEl.classList.toggle('big', !!o.big); promptEl.hidden = false; requestAnimationFrame(fit); },
        clear: function () { promptEl.hidden = true; requestAnimationFrame(fit); }
      },
      // answer buttons below the stage. items: [{ text, tag }]; onPick(index). Keys 1-4 (and A-D when def.letterKeys).
      choices: {
        set: function (items, onPick, o) {
          o = o || {}; optsEl.innerHTML = ''; fbEl.hidden = true; fbEl.innerHTML = ''; box.classList.remove('has-fb'); contCb = null; choiceCb = o.readOnly ? null : onPick || null;
          optsEl.className = 'ar-opts' + (o.cols ? ' cols-' + o.cols : '');
          items.forEach(function (it, i) {
            var b = h('button.ar-opt' + (o.readOnly ? '.ro' : ''), { type: 'button', 'data-i': String(i), tabindex: o.readOnly ? '-1' : null, onclick: function () { if (!b.disabled && choiceCb) { var cb = choiceCb; cb(i); } } }, h('span.ar-opt-k', {}, it.tag || (def.letterKeys ? 'ABCD'[i] : String(i + 1))), h('span.ar-opt-t', {}, it.text));
            optsEl.appendChild(b);
          });
          choicesEl.hidden = false; requestAnimationFrame(fit);
        },
        lock: function () { choiceCb = null; optsEl.querySelectorAll('.ar-opt').forEach(function (b) { b.disabled = true; }); },
        mark: function (i, cls) { var b = optsEl.querySelector('.ar-opt[data-i="' + i + '"]'); if (b) b.classList.add(cls); },
        disable: function (i) { var b = optsEl.querySelector('.ar-opt[data-i="' + i + '"]'); if (b) { b.disabled = true; b.classList.add('gone'); } },
        // feedback under the answers; onContinue runs on the button, Enter or Space (or after o.auto seconds of game time)
        feedback: function (o, onContinue) {
          o = o || {}; fbEl.innerHTML = '';
          fbEl.className = 'ar-fb ' + (o.ok ? 'ok' : 'no');
          fbEl.appendChild(h('div.ar-fb-copy', {}, h('b', {}, o.title || (o.ok ? 'Right.' : 'Not quite.')), o.body ? h('p', {}, o.body) : null,
            o.cite ? h('div.ar-fb-meta', {}, h('span', {}, 'Cite: ' + o.cite)) : null));
          var cont = h('button.ar-btn.gold.ar-fb-go', { type: 'button', onclick: function () { doContinue(); } }, o.cta || 'Continue ▶');
          fbEl.appendChild(cont); fbEl.hidden = false; box.classList.add('has-fb'); contCb = onContinue || null; contTimer = o.auto || 0;
          requestAnimationFrame(function () { fit(); try { cont.focus({ preventScroll: true }); } catch (e) {} });
        },
        tools: function (list) { toolsEl.innerHTML = ''; (list || []).forEach(function (t) { toolsEl.appendChild(h('button.ar-tool' + (t.on ? '.on' : ''), { type: 'button', disabled: !!t.disabled, title: t.title || '', onclick: function () { if (t.onClick) t.onClick(); } }, h('span', { 'aria-hidden': 'true' }, t.icon || ''), h('b', {}, t.label), t.count != null ? h('i', {}, '×' + t.count) : null)); }); toolsEl.hidden = !(list && list.length); },
        timer: function (frac) { if (frac == null) { timerEl.hidden = true; return; } timerEl.hidden = false; timerEl.firstChild.style.width = (A.clamp(frac, 0, 1) * 100) + '%'; timerEl.classList.toggle('low', frac < 0.25); },
        clear: function () { choicesEl.hidden = true; optsEl.innerHTML = ''; fbEl.innerHTML = ''; fbEl.hidden = true; box.classList.remove('has-fb'); choiceCb = null; contCb = null; timerEl.hidden = true; requestAnimationFrame(fit); },
        get open() { return !choicesEl.hidden; }
      }
    };
    function doContinue() { if (!contCb) return; var cb = contCb; contCb = null; contTimer = 0; A.audio.blip(); cb(); }
    function drawLives() { hudLives.innerHTML = ''; if (def.noLives) { hudLives.textContent = def.livesText ? def.livesText(state) : ''; return; } for (var i = 0; i < state.maxLives; i++) hudLives.appendChild(h('i' + (i < state.lives ? '' : '.off'))); }
    api.hud.refreshLives = drawLives;
    function armGate() {
      if (!gate) return;
      gate.armed = true; var hold = gate.mode === 'hold';
      gateTitle.textContent = hold ? 'Take your time' : 'Reading time';
      gateSub.textContent = hold ? 'Nothing moves until you press Go (Space, Enter or tap)' : 'Starts by itself. Space skips.';
      gateGo.textContent = hold ? '▶ Go' : 'Skip ▶'; gateBarWrap.hidden = hold; gateBar.style.width = '0%';
      gateEl.hidden = false; box.classList.add('is-reading');
    }
    function releaseGate() { if (!gate) return; gate = null; gateEl.hidden = true; box.classList.remove('is-reading'); A.audio.blip(); }
    state.gateInfo = function () { return gate ? { mode: gate.mode, armed: gate.armed } : null; };
    drawLives();
    state.progress = api.progress;

    fit();
    try { inst = def.create(api); } catch (e) { console.error('[arcade] create failed', e); inst = { update: function () {}, draw: function (c) { A.text(c, 'This game hit an error: ' + (e && e.message), 30, 60, { size: 18, color: A.C.red, maxWidth: state.W - 60 }); } }; }
    state.inst = inst;
    if (inst.resize) safe(function () { inst.resize(state.W, state.H); });
    if (def.music) A.music.play(def.music);

    // ---- countdown ----
    var cd = 0, countEl = null;
    if (def.countdown !== false) {
      var count = 3; countEl = h('div.ar-count', {}, '3'); box.appendChild(countEl); state.paused = true;
      cd = setInterval(function () { count--; if (count > 0) { countEl.textContent = String(count); countEl.style.animation = 'none'; void countEl.offsetWidth; countEl.style.animation = ''; A.audio.tick(); } else { clearInterval(cd); countEl.remove(); state.paused = false; A.audio.powerup(); } }, 650);
    }
    state.skipCountdown = function () { clearInterval(cd); if (countEl && countEl.parentNode) countEl.remove(); state.paused = false; };

    // ---- input. Captured on the document while playing so the guide's own shortcuts (/, Escape) stay out of the game ----
    function toLogical(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * state.W, y: (e.clientY - r.top) / r.height * state.H }; }
    function typing(e) { var t = e.target && e.target.tagName; return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT'; }
    function onKeyDown(e) {
      if (state.ended || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key; e.stopPropagation();
      // a focused button or link keeps Enter and Space (Tab to an answer, then Enter)
      var onCtl = e.target && e.target.closest && e.target.closest('.ar-play button, .ar-play a');
      if (onCtl && (k === 'Enter' || k === ' ')) return;
      if (k === 'm' || k === 'M') { A.audio.setMuted(!A.audio.muted); muteBtn.textContent = A.audio.muted ? '🔇' : '🔊'; return; }
      if (k === 'p' || k === 'P' || k === 'Escape') { togglePause(); e.preventDefault(); return; }
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].indexOf(k) >= 0 && !(e.target && e.target.closest && e.target.closest('.ar-pause'))) e.preventDefault();
      if (state.paused) return;
      if (gate && gate.armed) { if (k === ' ' || k === 'Enter' || k === 'g' || k === 'G') { if (!e.repeat) releaseGate(); return; } if (e.repeat) return; releaseGate(); }
      if (contCb && (k === 'Enter' || k === ' ')) { if (!e.repeat) doContinue(); return; }
      if (choiceCb && !e.repeat) {
        var idx = '123456789'.indexOf(k); if (idx < 0 && def.letterKeys) idx = 'abcd'.indexOf(k.toLowerCase());
        if (idx >= 0) { var b = optsEl.querySelector('.ar-opt[data-i="' + idx + '"]'); if (b && !b.disabled) { b.click(); return; } }
      }
      if (!state.keys.has(k)) { state.keys.add(k); if (inst.onKey) safe(function () { inst.onKey(k, true, e.repeat); }); }
    }
    function onKeyUp(e) { if (typing(e)) return; state.keys.delete(e.key); if (!state.paused && inst.onKey) safe(function () { inst.onKey(e.key, false); }); }
    function onPointer(type) {
      return function (e) {
        if (state.ended) return;
        if (!state.paused && type === 'down' && gate && gate.armed) { e.preventDefault(); A.audio.resume(); swallowPointer = e.pointerId; releaseGate(); return; }
        if (type === 'up' && swallowPointer != null && swallowPointer === e.pointerId) { swallowPointer = null; e.preventDefault(); return; }
        if (type === 'down') { A.audio.resume(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {} }
        var p = toLogical(e), dx = p.x - state.pointer.x, dy = p.y - state.pointer.y;
        state.pointer.x = p.x; state.pointer.y = p.y; if (type === 'down') state.pointer.down = true; if (type === 'up') state.pointer.down = false;
        state.pointer.type = e.pointerType || 'mouse';
        if (!state.paused && inst.onPointer) safe(function () { inst.onPointer({ type: type, x: p.x, y: p.y, dx: type === 'move' ? dx : 0, dy: type === 'move' ? dy : 0, touch: e.pointerType === 'touch' || e.pointerType === 'pen' }); });
        if (type !== 'move') e.preventDefault();
      };
    }
    document.addEventListener('keydown', onKeyDown, true); document.addEventListener('keyup', onKeyUp, true);
    var pd = onPointer('down'), pm = onPointer('move'), pu = onPointer('up');
    canvas.addEventListener('pointerdown', pd); canvas.addEventListener('pointermove', pm); canvas.addEventListener('pointerup', pu); canvas.addEventListener('pointercancel', pu);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // ---- pause ----
    var pauseEl = null;
    function togglePause(force) {
      if (state.ended) return;
      var to = force != null ? force : !state.paused; if (to === state.paused && (pauseEl || !to)) return;
      state.paused = to; pauseBtn.textContent = to ? '▶' : '⏸';
      if (to) {
        A.music.stop();
        pauseEl = h('div.ar-pause', { role: 'dialog', 'aria-label': 'Paused' }, h('div.ar-pause-box', {}, h('h3', {}, 'Paused'),
          h('p.ar-howto', {}, def.controls || ''),
          h('div.ar-row', {}, h('button.ar-btn.gold.lg', { type: 'button', onclick: function () { togglePause(false); } }, '▶ Resume'),
            h('button.ar-btn.lg', { type: 'button', onclick: function () { finish(false, { title: 'Run ended' }); } }, 'End run'),
            h('button.ar-btn.lg', { type: 'button', onclick: function () { showLobby(); } }, 'All games')),
          h('div.ar-levels', {}, h('small', {}, 'Restart at another pace'), h('div.ar-row', {}, A.TIERS.map(function (t) {
            return h('button.ar-btn' + (t.id === tier.id ? '.on' : ''), { type: 'button', style: { '--tc': t.color }, onclick: function () { A.setTier(t.id); startGame(id, opts); } }, t.name);
          })))));
        box.appendChild(pauseEl);
        var first = pauseEl.querySelector('button'); if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
      } else {
        if (pauseEl) { pauseEl.remove(); pauseEl = null; } state.keys.clear();
        if (def.music) A.music.play(A.music.track || def.music);
        try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
      }
    }
    function onVis() { if (document.hidden && !state.ended) togglePause(true); }
    document.addEventListener('visibilitychange', onVis);

    // ---- loop ----
    var last = performance.now(), raf = 0;
    function frameLoop(t) { if (state.ended) return; var dt = Math.min(.05, (t - last) / 1000); last = t; tick(dt); if (!state.ended) raf = requestAnimationFrame(frameLoop); }
    state.tick = tick;
    function tick(dt) {
      if (state.ended) return;
      if (!state.paused) {
        state.elapsed += dt;
        if (gate && gate.armed) {
          if (gate.mode === 'brief') { gate.left -= dt; gateBar.style.width = Math.min(100, 100 * (1 - Math.max(0, gate.left) / gate.total)) + '%'; if (gate.left <= 0) releaseGate(); }
        } else {
          var gdt = dt * tier.timeScale * api.progress.clock();
          state.gameTime += gdt;
          safe(function () { inst.update(gdt, dt); });
          if (state.ended) return;
          particles.update(gdt); floaters.update(dt);
          if (gate && !gate.armed) { gate.delay -= gdt; if (gate.delay <= 0) armGate(); }
          if (contCb && contTimer > 0) { contTimer -= dt; if (contTimer <= 0) doContinue(); }
        }
        if (state.bannerTimer > 0) { state.bannerTimer -= dt; if (state.bannerTimer <= 0) banner.classList.remove('on'); }
      }
      ctx.save(); ctx.setTransform(state.scale, 0, 0, state.scale, 0, 0);
      if (state.shake > 0) { ctx.translate(A.rand(-state.shake, state.shake), A.rand(-state.shake, state.shake)); state.shake = Math.max(0, state.shake - dt * 38); }
      ctx.fillStyle = A.C.bg; ctx.fillRect(-30, -30, state.W + 60, state.H + 60);
      safe(function () { inst.draw(ctx); });
      particles.draw(ctx); floaters.draw(ctx);
      if (inst.drawTop) safe(function () { inst.drawTop(ctx); });
      ctx.restore();
    }
    raf = requestAnimationFrame(frameLoop);

    function safe(fn) { try { fn(); } catch (e) { console.error('[arcade] ' + id, e); } }
    state.cleanup = function () {
      state.ended = true; cancelAnimationFrame(raf); clearInterval(cd); clearTimeout(hint._t);
      document.removeEventListener('keydown', onKeyDown, true); document.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('resize', fit); document.removeEventListener('visibilitychange', onVis); if (ro) ro.disconnect();
      try { inst.destroy && inst.destroy(); } catch (e) {}
      A.music.stop(); A.music.setIntense(false);
      if (host('stopSpeak')) host('stopSpeak')();
      if (playEl.parentNode) playEl.parentNode.removeChild(playEl);
      document.documentElement.classList.remove('ar-playing');
      if (host('playing')) host('playing')(false);
    };
    function finish(won, o) { if (state.ended) return; o = o || {}; state.cleanup(); run = null; if (o.quiet) { record(state, won, o); return; } showResults(state, won, o); }
  }
  function endRun() { if (run && run.cleanup) run.cleanup(); run = null; }

  // ---------- results ----------
  function record(state, won, o) {
    var rec = A.best.record(state.id, Math.round(state.score), null, state.tier.id);
    var right = state.review.filter(function (r) { return r.ok; }).length, total = state.review.length;
    var bonus = won ? 50 : 0, xp = A.addXp(state.xp + bonus + (o.xpBonus || 0));
    var summary = { game: state.id, score: Math.round(state.score), right: right, total: total, pct: total ? Math.round(right / total * 100) : 0, won: !!won, tier: state.tier.id, record: rec.record, path: params.path || '' };
    if (host('onRunEnd')) { try { host('onRunEnd')(summary); } catch (e) {} }
    return { rec: rec, xp: xp, right: right, total: total, summary: summary };
  }
  function showResults(state, won, o) {
    var def = state.def, tier = state.tier, r = record(state, won, o), rec = r.rec, xp = r.xp, right = r.right, total = r.total;
    var acc = total ? Math.round(right / total * 100) : null;
    if (xp.up) A.audio.levelUp(); else if (rec.record && state.score > 0) A.audio.fanfare(); else if (won) A.audio.correct(); else A.audio.wrong();
    document.title = 'Results · ' + def.title;
    var tIdx = A.TIERS.indexOf(tier), up = A.TIERS[tIdx + 1], down = tIdx > 0 ? A.TIERS[tIdx - 1] : null, nudge = null;
    if (up && total >= 5 && acc >= 85) nudge = h('div.ar-nudge', {}, h('b', {}, 'Ready for more?'), h('span', {}, acc + '% at ' + tier.name + '.'), h('button.ar-btn.gold', { type: 'button', onclick: function () { A.setTier(up.id); startGame(state.id, state.opts); } }, 'Try ' + up.name));
    else if (down && total >= 4 && acc != null && acc < 50) nudge = h('div.ar-nudge.down', {}, h('b', {}, 'Too fast?'), h('span', {}, 'Drop a pace; the questions stay the same.'), h('button.ar-btn', { type: 'button', onclick: function () { A.setTier(down.id); startGame(state.id, state.opts); } }, 'Play at ' + down.name));
    var rk = xp.after;
    var pathBtn = params.path && host('pathHref') ? h('a.ar-btn.lg', { href: host('pathHref')() }, '← My exam path') : null;
    var screen = h('div.ar-results');
    screen.appendChild(h('div.ar-res-hero', {},
      h('div.ar-res-card.main', {},
        h('div.ar-kicker', {}, h('i'), (def.icon ? def.icon + ' ' : '') + def.title + ' · ' + tier.name),
        h('h2', {}, o.title || (won ? 'Mission complete' : 'Run over')),
        h('div.ar-big', {}, fmt(state.score)),
        h('div.ar-sub', {}, o.message || (acc == null ? 'No questions answered this run.' : 'You answered ' + right + ' of ' + total + ' correctly (' + acc + '%).')),
        o.badge ? h('div.ar-badge', { style: { '--bc': o.badge.color || A.C.gold } }, h('span.ar-badge-ico', { 'aria-hidden': 'true' }, o.badge.icon || '🏅'), h('div', {}, h('b', {}, o.badge.name), h('small', {}, o.badge.desc || ''))) : null,
        rec.record && state.score > 0 ? h('div.ar-record', {}, '🏆 New personal best at ' + tier.name) : h('div.ar-sub', {}, 'Best at ' + tier.name + ': ' + fmt(rec.entry.best) + ' · plays: ' + rec.entry.plays),
        h('div.ar-xpline' + (xp.up ? '.up' : ''), {}, h('b', {}, '+' + fmt(xp.gained) + ' XP'),
          h('span', {}, xp.up ? 'Promoted to ' + rk.name + ' (level ' + rk.level + ')!' : rk.name + ' · ' + fmt(rk.to - rk.xp) + ' XP to ' + rk.next),
          h('div.ar-xpbar', {}, h('span', { style: { width: Math.round(rk.pct * 100) + '%' } }))),
        h('div.ar-res-actions', {}, h('button.ar-btn.gold.lg', { type: 'button', onclick: function () { startGame(state.id, state.opts); } }, '↻ Play again'), h('button.ar-btn.lg', { type: 'button', onclick: function () { showLobby(); } }, 'All games'), pathBtn),
        nudge),
      h('div.ar-res-card', {}, h('div.ar-kicker', {}, h('i'), 'This run'), h('div.ar-res-grid', {},
        h('div', {}, h('small', {}, 'Accuracy'), h('b', {}, acc == null ? '—' : acc + '%')), h('div', {}, h('small', {}, 'Answered'), h('b', {}, String(total))), h('div', {}, h('small', {}, 'Level'), h('b', {}, String(state.level))),
        h('div', {}, h('small', {}, 'Time'), h('b', {}, Math.round(state.elapsed) + 's')), h('div', {}, h('small', {}, def.noLives ? (def.livesLabel || 'Left') : 'Lives left'), h('b', {}, def.noLives && def.livesText ? def.livesText(state) : String(Math.max(0, state.lives)))), h('div', {}, h('small', {}, 'Drills'), h('b.ar-small', {}, def.drills || ''))),
        h('p.ar-fine', {}, 'Missed bank questions also go to Practice test → Missed questions.'))));
    var missed = state.review.filter(function (x) { return !x.ok; });
    var review = h('section.ar-review', {}, h('h3', {}, missed.length ? 'What to study (' + missed.length + ' missed)' : (total ? 'Perfect run: every answer right' : 'Answer questions during a run to build your study list')));
    state.review.slice().sort(function (a, b) { return (a.ok ? 1 : 0) - (b.ok ? 1 : 0); }).slice(0, 40).forEach(function (x) {
      var lesson = x.lesson && host('lessonHref') ? host('lessonHref')(x.lesson) : null;
      review.appendChild(h('div.ar-rev' + (x.ok ? '.ok' : ''), {}, h('div.q', {}, x.prompt || ''),
        h('div.a', {}, x.ok ? h('span', {}, '✓ ', h('b', {}, x.correct || '')) : h('span', {}, x.given ? h('s.no', {}, x.given) : null, x.given ? ' → ' : '', h('b', {}, x.correct || ''))),
        x.explanation ? h('div.why', {}, x.explanation) : null,
        x.cite || lesson ? h('div.cite', {}, x.cite ? 'Cite: ' + x.cite : '', lesson ? h('a', { href: lesson.href }, (x.cite ? ' · ' : '') + 'Lesson: ' + lesson.title) : null) : null));
    });
    screen.appendChild(review);
    setView(screen); scrollTop();
  }

  // ---------- automated-check hooks (no UI) ----------
  A._debug = {
    run: function () { return run; },
    start: function () { if (run && run.skipCountdown) run.skipCountdown(); return !!run; },
    step: function (sec) { var r = run; if (!r || !r.tick) return false; var n = Math.max(1, Math.round((sec || 0) / 0.05)); for (var i = 0; i < n && !r.ended; i++) r.tick(0.05); return true; },
    play: function (id, opts) { startGame(id, opts); return !!run; }
  };

  // ---------- mount inside B2B Guide ----------
  A.mount = function (container, p) {
    A.unmount();
    params = p || {};
    root = container; root.classList.add('arcade-root');
    A.rotation.reset();
    if (params.tier) A.setTier(params.tier);
    if (!A.order.length) { setView(h('div.ar-lobby', {}, h('h1.ar-h1', {}, 'No games registered'))); return; }
    showLobby();
    if (params.game && A.games[params.game]) startGame(params.game, { realm: params.realm || '' });
  };
  A.unmount = function () { endRun(); stopLobby(); A.music.stop(); viewEl = null; root = null; };
  A.lobby = function () { if (root) showLobby(); };
})();
