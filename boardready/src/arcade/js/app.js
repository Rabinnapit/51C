/* ARCADE-APP — shell: title screen, play screen (canvas + HUD), pause, results with review */
(function () {
  'use strict';
  var A = window.ARCADE;
  var W = 960, H = 540;
  var root, viewEl, bgCanvas, bgCtx, stars = [], bgRaf = 0, bgResize = null, embedded = false, prevScrollBehavior = null;
  var run = null;            // active run state

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
  function appName() { return meta().app_name || 'Board Ready'; }
  function mainFile() { return (meta().main_file) || 'BoardReady.html'; }
  // Inside Board Ready the way back is a route; the standalone development copy links to the file instead.
  function goHome(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (embedded && window.CORB && typeof window.CORB.go === 'function') window.CORB.go('dashboard');
    else location.href = mainFile();
  }
  function mono() { var w = appName().split(/\s+/); return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 1)).toUpperCase(); }

  // ---------- background starfield ----------
  // one persistent background and one view container; screens replace only the view
  function setView() { if (!viewEl) { viewEl = h('div.ar-view'); root.appendChild(viewEl); } viewEl.innerHTML = ''; for (var i = 0; i < arguments.length; i++) if (arguments[i]) viewEl.appendChild(arguments[i]); }
  function initBg() {
    if (bgCanvas) return;
    var wrap = h('div.ar-bg'); bgCanvas = h('canvas'); wrap.appendChild(bgCanvas); root.appendChild(wrap); bgCtx = bgCanvas.getContext('2d');
    function size() { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; stars = []; for (var i = 0; i < 160; i++) stars.push({ x: Math.random() * bgCanvas.width, y: Math.random() * bgCanvas.height, r: Math.random() * 1.6 + .3, s: Math.random() * 14 + 4, a: Math.random() }); }
    size(); bgResize = size; window.addEventListener('resize', size);
    var cv = bgCanvas;
    var last = performance.now();
    (function loop(t) { if (bgCanvas !== cv) return; var dt = Math.min(.05, (t - last) / 1000); last = t; bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height); bgCtx.fillStyle = '#fff'; for (var i = 0; i < stars.length; i++) { var s = stars[i]; s.y += s.s * dt; if (s.y > bgCanvas.height) { s.y = -2; s.x = Math.random() * bgCanvas.width; } s.a += dt * .8; bgCtx.globalAlpha = .25 + Math.abs(Math.sin(s.a)) * .5; bgCtx.beginPath(); bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2); bgCtx.fill(); } bgCtx.globalAlpha = 1; if (bgCanvas === cv) bgRaf = requestAnimationFrame(loop); })(last);
  }

  // ---------- top bar ----------
  // danger (e.g. End run) sits by itself, next to the brand; returns (before, then the Board Ready link) stay
  // grouped together at the far side of the grow gap, so a thumb reaching for a return button cannot also hit danger.
  function topbar(danger, before) {
    var muteBtn = h('button.ar-btn.icon', { 'aria-label': 'Mute', title: 'Mute (M)', onclick: function () { A.audio.setMuted(!A.audio.muted); muteBtn.textContent = A.audio.muted ? '🔇' : '🔊'; } }, A.audio.muted ? '🔇' : '🔊');
    return h('header.ar-top', {},
      h('a.ar-brand', { href: '#', onclick: function (e) { e.preventDefault(); showTitle(); } }, h('span.ar-mark', {}, mono()), h('span', {}, appName() + ' Arcade', h('small', {}, 'CORB prep · 411th CSB'))),
      danger || null,
      h('div.grow'), muteBtn, before || null,
      embedded ? h('button.ar-btn', { type: 'button', onclick: goHome, title: 'Back to ' + appName() }, '← ' + appName()) : h('a.ar-btn', { href: mainFile(), title: 'Open the main app (same folder)' }, '← ' + appName()));
  }

  // ---------- title screen ----------
  // One short line for the chosen pace, built from the level's own settings so it always matches how the game plays.
  function paceLine(t) {
    var speed = t.timeScale < 0.7 ? 'Slow motion' : t.timeScale < 1 ? 'A bit slower than full speed' : t.timeScale === 1 ? 'Full speed' : 'Faster than full speed';
    var read = t.read === 'hold' ? 'Each question waits until you press Go.' : t.read === 'brief' ? 'A short pause to read each question.' : 'No pause to read.';
    return speed + ' and ' + t.lives + ' lives. ' + read;
  }
  // Inside Board Ready, Change opens the app's class picker. Picking a class re-renders the route, so the address loses
  // ?game, ?tier and ?class first: the list then comes back with the new class instead of restarting a game.
  function hostClassPicker() { return embedded && window.CORB && window.CORB.ui && typeof window.CORB.ui.classPicker === 'function'; }
  function changeClass(cards) {
    if (!hostClassPicker()) { cards.hidden = !cards.hidden; return; }   // the standalone copy shows its own class cards
    if (location.hash.indexOf('?') >= 0) { try { history.replaceState(null, '', location.href.split('#')[0] + '#/arcade'); } catch (e) {} }
    window.CORB.ui.classPicker();
  }
  function showTitle() {
    if (run) endRun(true);
    document.title = appName() + ' Arcade';
    var screen = h('div.ar-title');
    var tier = A.tier(), warrant = A.warrant();
    screen.appendChild(h('h1.ar-h1', {}, 'Drill the facts. ', h('em', {}, 'At your pace.')));
    // Settings in one slim strip: the warrant class on one line, the pace as four buttons and one line about the chosen pace.
    var classCards = h('div.ar-warrants', { role: 'radiogroup', 'aria-label': 'Warrant class', hidden: true }, A.WARRANTS.map(function (w) {
      var on = w.id === warrant.id;
      return h('button.ar-warrant' + (on ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', onclick: function () { var y = window.scrollY; A.setWarrant(w.id); showTitle(); window.scrollTo(0, y); } },
        h('b', {}, w.name), h('span', {}, w.range));
    }));
    screen.appendChild(h('div.ar-setup', {},
      h('div.ar-class-line', {}, h('span', {}, 'Warrant class: ', h('b', {}, warrant.name)),
        h('button.ar-btn.sm', { type: 'button', 'aria-label': 'Change warrant class', onclick: function () { changeClass(classCards); } }, 'Change')),
      h('div.ar-pace-row', {}, h('span.ar-pace-label', {}, 'Pace:'), h('div.ar-paces', { role: 'radiogroup', 'aria-label': 'Pace' }, A.TIERS.map(function (t, ti) {
        var on = t.id === tier.id;
        return h('button.ar-pace' + (on ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', title: t.badge + ': ' + t.desc, style: { '--tc': t.color }, onclick: function () { var y = window.scrollY; A.setTier(t.id); showTitle(); window.scrollTo(0, y); } },
          h('span.ar-tier-dots', {}, [0, 1, 2, 3].map(function (k) { return h('i' + (k <= ti ? '.on' : '')); })), h('b', {}, t.name));
      }))),
      h('p.ar-pace-line', {}, h('b', { style: { '--tc': tier.color } }, tier.name + ': '), paceLine(tier), ' ', h('span', {}, 'New here? Start at Recruit.')),
      h('div.ar-tier-head', {}, h('small', {}, 'Questions come from your class and the classes below it'
        + (meta().unit_name ? (meta().unit === 'all' ? ', from every organization' : ', for ' + meta().unit_name) : '') + '.')),
      classCards));
    var grid = h('div.ar-cabinets');
    A.order.forEach(function (id, i) {
      var def = A.games[id]; var ok = true; try { ok = !def.dataOk || !!def.dataOk(A.DATA); } catch (e) { ok = false; }
      var best = A.best.get(id, tier.id);
      var card = h('button.ar-cab' + (ok ? '' : '.off'), { style: { '--accent': def.accent || A.C.gold, animationDelay: (i * 60) + 'ms' }, disabled: !ok, onclick: function () { if (ok) startGame(id); } },
        best && best.best ? h('span.badge.rec', {}, 'Best ' + best.best) : ok ? null : h('span.badge', {}, 'Needs content'),
        h('div.ico', {}, def.icon || '🎮'),
        h('h3', {}, def.title),
        h('div.tag', {}, def.tagline || ''),
        h('div.drills', {}, def.drills ? 'Drills · ' + def.drills : ''),
        h('div.foot', {}, best ? h('span', {}, h('b', {}, String(best.plays || 0)), best.plays === 1 ? ' play · last ' : ' plays · last ', h('b', {}, String(best.last || 0))) : null, h('span.go', {}, ok ? 'Play →' : 'Locked')));
      grid.appendChild(card);
    });
    screen.appendChild(grid);
    screen.appendChild(h('div.ar-note', {}, h('span', {}, '🎓'), h('div', {}, h('b', {}, 'Training aid, not authoritative guidance. '),
      'Game text comes from the verified repository (content verified ' + (meta().content_verified_on || '2026') + '). Thresholds and citations follow the Revolutionary FAR Overhaul numbering in effect since 1 February 2026. Confirm anything you rely on with your Contracting & Policy office.',
      h('span.ar-keys', {}, ' Keyboard: arrows or WASD move, Space or Enter acts, P pauses, M mutes.'))));
    setView(topbar(), screen);
    window.scrollTo(0, 0);
  }

  // ---------- play ----------
  function startGame(id) {
    var def = A.games[id]; if (!def) return;
    var tier = A.tier(), warrant = A.warrant();
    A.audio.resume();
    document.title = def.title + ' · ' + appName() + ' Arcade';
    var frame = h('div.ar-frame'); var stageWrap = h('div.ar-canvas-wrap'); var canvas = h('canvas'); stageWrap.appendChild(canvas);
    var hud = h('div.ar-hud');
    var hudTop = h('div.hud-top');
    var hudScore = h('div.hud-item', {}, h('small', {}, 'Score'), h('b', {}, '0'));
    var hudBest = h('div.hud-item', {}, h('small', {}, 'Best'), h('b', {}, String((A.best.get(id, tier.id) || {}).best || 0)));
    var hudCombo = h('div.hud-item.combo', {}, h('small', {}, 'Combo'), h('b', {}, '×1'));
    var hudLevel = h('div.hud-item', {}, h('small', {}, 'Level'), h('b', {}, '1'));
    var hudTime = h('div.hud-item.time', {}, h('small', {}, 'Time'), h('b', {}, ''));
    var hudLives = h('div.hud-item', {}, h('small', {}, 'Lives'), h('div.lives'));
    var gateTitle = h('b', {}, ''), gateSub = h('small', {}, ''), gateBar = h('span'), gateBarWrap = h('div.gate-bar', {}, gateBar);
    var gateGo = h('button.gate-go', { type: 'button', onclick: function () { releaseGate(); } }, '▶ Go');
    var hudGate = h('div.hud-gate', { hidden: true, role: 'status', 'aria-live': 'polite' }, h('div.gate-copy', {}, gateTitle, gateSub), gateBarWrap, gateGo);
    hudTop.appendChild(hudScore); hudTop.appendChild(hudBest); hudTop.appendChild(hudCombo); hudTop.appendChild(hudLevel); hudTop.appendChild(hudTime); hudTop.appendChild(h('div', { style: { flex: 1 } })); hudTop.appendChild(hudGate); hudTop.appendChild(hudLives);
    var hudProg = h('div.hud-progress', {}, h('span')); var hudBanner = h('div.hud-banner'); var hudFlash = h('div.hud-flash');
    hud.appendChild(hudBanner); hud.appendChild(hudProg); hud.appendChild(hudFlash); stageWrap.appendChild(hud);
    frame.appendChild(hudTop); frame.appendChild(stageWrap);

    var stage = h('div.ar-stage', {}, frame);
    var pauseBtn = h('button.ar-btn', { onclick: function () { togglePause(); } }, '⏸ Pause');
    var toList = h('button.ar-btn.ar-to-list', { type: 'button', title: 'Back to the game list', onclick: function () { if (state.ended || !state.review.length || confirm('Leave this run for the game list? This run is not scored.')) showTitle(); } }, h('span.ar-long', {}, '← All games'), h('span.ar-short', {}, '← Games'));
    var dangerBtn = h('button.ar-btn.danger', { onclick: function () { if (confirm('End this run? Your score so far will still be recorded.')) finish(false); } }, 'End run');
    // The controls text also appears once as a brief on-canvas hint at the start of every game (and in full on the
    // Pause screen below), so it is not repeated here in the bar that stays on screen the whole run.
    var turnHint = h('div.ar-turn', {}, 'Turn your phone sideways for a bigger view.');
    var play = h('div.ar-play', {}, topbar(dangerBtn, toList), turnHint,
      h('div.ar-playbar', {}, h('h2', {}, def.icon + ' ' + def.title), h('span.ar-tier-chip', { style: { '--tc': A.C.gold2 }, title: warrant.desc }, warrant.name), h('span.ar-tier-chip', { style: { '--tc': tier.color }, title: tier.desc }, tier.name), h('div', { style: { flex: 1 } }), pauseBtn),
      stage);
    setView(play);

    var ctx = canvas.getContext('2d');
    var particles = new A.Particles();
    var state = { id: id, def: def, tier: tier, warrant: warrant, score: 0, lives: tier.lives, maxLives: tier.lives, combo: 1, level: 1, time: null, elapsed: 0, gameTime: 0, review: [], ended: false, paused: false, shake: 0, bannerTimer: 0, keys: new Set(), pointer: { x: 0, y: 0, down: false } };
    run = state;
    var gate = null, swallowPointer = null;

    // ---- question memory across runs (per game and warrant class) ----
    var runId = String(Date.now()), recent = [], rotKey = id + '@' + warrant.id;
    function rotation() { return A.rotation.bucket(rotKey); }
    function saveRotation() { A.rotation.save(); }
    function normText(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
    function defaultKey(it) { return String(it.id || it.qid || it.statement || it.event || it.clause || it.old || it.label || it.stem || JSON.stringify(it).slice(0, 120)); }
    function isGen(it) { return !!(it && (it.gen || it.generated || /^gen/i.test(String(it.id || '')))); }
    function fingerprint(it) { return normText(it && (it.stem || it.statement || it.event || it.title || it.old || it.label || it.question || it.clause)).slice(0, 40); }
    function nearest(list, want, diffOf) {
      var best = [], bestDist = 9;
      list.forEach(function (it) { var dist = Math.abs(diffOf(it) - want); if (dist < bestDist) { bestDist = dist; best = [it]; } else if (dist === bestDist) best.push(it); });
      return best;
    }
    function preferClass(list, wid) {
      if (wid === 'all') return list;
      var at = list.filter(function (it) { return A.classFit(it, wid) === 'at'; });
      var rest = list.filter(function (it) { return A.classFit(it, wid) !== 'at'; });
      if (at.length && (!rest.length || Math.random() < 0.6)) return at;
      return rest.length ? rest : list;
    }
    // A review entry is matched to the question it answers by text, so the right question is remembered as seen or missed.
    function noteResult(r) {
      var prompt = normText(r && r.prompt), match = null, i;
      if (prompt) {
        for (i = recent.length - 1; i >= 0; i--) if (!recent[i].done && recent[i].text && prompt.indexOf(recent[i].text) >= 0) { match = recent[i]; break; }
        if (!match) for (i = recent.length - 1; i >= 0; i--) if (recent[i].text && prompt.indexOf(recent[i].text) >= 0) { match = recent[i]; break; }
      }
      if (!match) return;
      match.done = true;
      if (!match.key) return;
      var b = rotation();
      b.seen[match.key] = 1;
      if (r.ok) delete b.missed[match.key]; else b.missed[match.key] = runId;
      saveRotation();
    }

    // Resizing a canvas resets its drawing state, so fit() also restores the letter spacing that keeps canvas text from
    // using the font's ligatures ("(c)" would be drawn as a copyright sign in citations).
    function fit() { var r = stageWrap.getBoundingClientRect(); var dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr)); state.scale = { x: canvas.width / W, y: canvas.height / H, dpr: dpr }; try { canvas.getContext('2d').letterSpacing = '0.01px'; } catch (e) {} }
    fit(); window.addEventListener('resize', fit);

    var api = {
      W: W, H: H, data: A.DATA, C: A.C, rand: A.rand, randInt: A.randInt, pick: A.pick, shuffle: A.shuffle, clamp: A.clamp, lerp: A.lerp, ease: A.ease, money: A.money,
      font: A.font, text: A.text, wrap: A.wrap, roundRect: A.roundRect, glow: A.glow, noGlow: A.noGlow, pill: A.pill, particles: particles, audio: A.audio,
      input: { keys: state.keys, pointer: state.pointer }, get paused() { return state.paused; }, get elapsed() { return state.gameTime; }, bestScore: (A.best.get(id, tier.id) || {}).best || 0,
      difficulty: { id: tier.id, name: tier.name, timeScale: tier.timeScale, lives: tier.lives, read: tier.read },
      warrant: { id: warrant.id, name: warrant.name },
      // In-run question levels: start with easy questions, move up every perLevel correct answers,
      // and slow the game clock at each level so harder questions get more thinking time.
      progress: (function () {
        var p = {
          level: 1, maxLevel: 3, perLevel: 5, right: 0, sinceUp: 0, used: {}, poolAll: {},
          names: ['Easy questions', 'Medium questions', 'Hard questions'],
          configure: function (o) { o = o || {}; if (o.perLevel > 0) p.perLevel = o.perLevel; if (o.maxLevel > 0) p.maxLevel = Math.min(3, o.maxLevel); return p; },
          difficultyOf: function (item) { var d = Math.round(Number(item && (item.difficulty != null ? item.difficulty : item.level))); return d >= 1 && d <= 3 ? d : 2; },
          // Picks the next question: the player's warrant class and lower classes, no repeats inside a run, missed
          // questions from earlier runs about a third of the time, otherwise questions not seen in earlier runs at
          // this level's difficulty, weighted toward the chosen class. A new shuffle starts once the whole set is seen.
          pick: function (pool, keyOf) {
            pool = (pool || []).filter(Boolean);
            if (!pool.length) return null;
            keyOf = keyOf || defaultKey;
            // A one-item pool is a forced re-ask (a missed item coming back later in the same run). It is not
            // remembered across runs and does not change the set size shown on the results screen.
            var single = pool.length === 1;
            var wid = warrant.id, want = Math.min(p.level, 3);
            var eligible = pool.filter(function (it) { return A.classFit(it, wid) !== 'none'; });
            if (!eligible.length) eligible = pool;
            var keys = eligible.filter(function (it) { return !isGen(it); }).map(function (it) { return A.hash(keyOf(it)); });
            if (!single) { p.poolKeys = keys; keys.forEach(function (k) { p.poolAll[k] = 1; }); }
            var open = eligible.filter(function (it) { return !p.used[keyOf(it)]; });
            if (!open.length) { p.used = {}; open = eligible.slice(); }
            var bucket = rotation(), chosen = null, via = 'fresh';
            var missed = open.filter(function (it) { if (isGen(it)) return false; var m = bucket.missed[A.hash(keyOf(it))]; return !!m && m !== runId; });
            if (missed.length && Math.random() < 0.34) { chosen = A.pick(nearest(missed, want, p.difficultyOf)); via = 'review'; }
            if (!chosen) {
              var fresh = open.filter(function (it) { return isGen(it) || !bucket.seen[A.hash(keyOf(it))]; });
              if (!fresh.length) {
                keys.forEach(function (k) { delete bucket.seen[k]; });
                saveRotation();
                fresh = open;
                if (!single) {
                  p.rotations = (p.rotations || 0) + 1;
                  api.hud.set({ banner: 'Full set played', sub: 'You have seen every ' + (wid === 'all' ? '' : warrant.name + ' ') + 'question in this game. Starting a new shuffle.', bannerTime: 2.2 });
                }
              }
              chosen = A.pick(preferClass(nearest(fresh, want, p.difficultyOf), wid));
            }
            p.used[keyOf(chosen)] = 1;
            recent.push({ key: (single || isGen(chosen)) ? '' : A.hash(keyOf(chosen)), text: fingerprint(chosen), done: false, via: via });
            if (recent.length > 8) recent.shift();
            return chosen;
          },
          correct: function () {
            p.right++; p.sinceUp++;
            if (p.sinceUp >= p.perLevel && p.level < p.maxLevel) {
              p.level++; p.sinceUp = 0;
              api.hud.set({ level: p.level, banner: 'Level ' + p.level + ' · ' + p.names[p.level - 1], sub: 'Harder questions. The game slows down so you have more time to think.', bannerTime: 2.4 });
              A.audio.fanfare();
              return true;
            }
            return false;
          },
          clock: function () { return [1, 0.88, 0.78][Math.min(p.level, 3) - 1]; }
        };
        return p;
      })(),
      hud: { set: function (o) { o = o || {};
        if (o.score != null) { state.score = o.score; hudScore.lastChild.textContent = String(Math.round(o.score)); }
        if (o.lives != null) { state.lives = o.lives; drawLives(); }
        if (o.maxLives != null) { state.maxLives = o.maxLives; drawLives(); }
        if (o.combo != null) { state.combo = o.combo; hudCombo.lastChild.textContent = '×' + o.combo; hudCombo.style.opacity = o.combo > 1 ? 1 : .6; }
        if (o.level != null) { state.level = o.level; hudLevel.lastChild.textContent = String(o.level); }
        if (o.time !== undefined) { state.time = o.time; hudTime.lastChild.textContent = o.time == null ? '' : (Math.ceil(o.time) + 's'); hudTime.classList.toggle('low', o.time != null && o.time <= 10); hudTime.style.display = o.time == null ? 'none' : ''; }
        if (o.progress != null) hudProg.firstChild.style.width = (A.clamp(o.progress, 0, 1) * 100) + '%';
        if (o.banner !== undefined) { if (o.banner) { hudBanner.innerHTML = ''; hudBanner.appendChild(document.createTextNode(o.banner)); if (o.sub) hudBanner.appendChild(h('small', {}, o.sub)); hudBanner.classList.add('on'); state.bannerTimer = o.bannerTime || 1.4; } else { hudBanner.classList.remove('on'); } }
      } },
      score: function (n) { state.score = Math.max(0, state.score + (n || 0)); hudScore.lastChild.textContent = String(Math.round(state.score)); if (state.score > api.bestScore) hudBest.lastChild.textContent = String(Math.round(state.score)); return state.score; },
      life: function (n) { state.lives = A.clamp(state.lives + (n || 0), 0, 9); drawLives(); if (state.lives <= 0) setTimeout(function () { if (!state.ended) finish(false, { title: 'Out of lives' }); }, 350); return state.lives; },
      review: { add: function (item) { if (!item) return; state.review.push(item); noteResult(item); } },
      // Call when a new question or prompt becomes active. On Recruit the game freezes until the player presses Go;
      // on Regular it freezes for a reading window sized to the text; on Veteran and Elite it does nothing.
      ready: function (o) {
        if (tier.read === 'off') return false;
        if (typeof o === 'string') o = { text: o };
        o = o || {};
        var words = String(o.text || '').split(/\s+/).filter(Boolean).length;
        var left = A.clamp(1.2 + words * 0.3, 2.5, 9);
        if (gate && gate.armed) { hudGate.hidden = true; frame.classList.remove('is-reading'); }
        gate = { mode: tier.read, delay: o.delay != null ? o.delay : (state.gameTime < 0.05 ? 0 : 0.5), armed: false, left: left, total: left };   // the first question pauses as soon as the countdown ends
        return true;
      },
      end: function (o) { finish(!!(o && o.won), o); },
      shake: function (px) { state.shake = Math.max(state.shake, px || 8); },
      flash: function (color) { hudFlash.style.background = color || 'rgba(255,255,255,.6)'; hudFlash.style.transition = 'none'; hudFlash.style.opacity = '1'; requestAnimationFrame(function () { hudFlash.style.transition = 'opacity .45s'; hudFlash.style.opacity = '0'; }); }
    };
    function drawLives() { var box = hudLives.lastChild; box.innerHTML = ''; for (var i = 0; i < state.maxLives; i++) box.appendChild(h('i' + (i < state.lives ? '' : '.off'))); }
    function armGate() {
      if (!gate) return;
      gate.armed = true;
      var hold = gate.mode === 'hold';
      gateTitle.textContent = hold ? 'Take your time' : 'Reading time';
      gateSub.textContent = hold ? 'Nothing moves until you press Go (Space, Enter or tap)' : 'Starts by itself. Space skips.';
      gateGo.textContent = hold ? '▶ Go' : 'Skip ▶';
      gateBarWrap.hidden = hold; gateBar.style.width = '0%';
      hudGate.hidden = false; frame.classList.add('is-reading');
    }
    function releaseGate() {
      if (!gate) return;
      gate = null; hudGate.hidden = true; frame.classList.remove('is-reading');
      A.audio.blip();
    }
    state.gateInfo = function () { return gate ? { mode: gate.mode, armed: gate.armed, left: Math.round(gate.left * 10) / 10 } : null; };
    drawLives(); api.hud.set({ time: null });
    state.progress = api.progress; state.rotKey = rotKey;

    var inst;
    try { inst = def.create(api); } catch (e) { console.error('[arcade] create failed', e); inst = { update: function () {}, draw: function (c) { A.text(c, 'This game hit an error: ' + (e && e.message), 40, 80, { size: 20, color: A.C.red, maxWidth: W - 80 }); } }; }
    state.inst = inst;

    // countdown
    var count = 3; var countEl = h('div.ar-countdown', {}, '3'); stageWrap.appendChild(countEl); state.paused = true;
    var cd = setInterval(function () { count--; if (count > 0) { countEl.textContent = String(count); countEl.style.animation = 'none'; void countEl.offsetWidth; countEl.style.animation = ''; A.audio.tick(); } else { clearInterval(cd); countEl.remove(); state.paused = false; A.audio.powerup(); } }, 700);
    state.skipCountdown = function () { clearInterval(cd); if (countEl.parentNode) countEl.remove(); state.paused = false; };

    // input
    function toLogical(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
    function onKeyDown(e) {
      var k = e.key;
      if (k === 'm' || k === 'M') { A.audio.setMuted(!A.audio.muted); return; }
      if (k === 'p' || k === 'P' || k === 'Escape') { togglePause(); e.preventDefault(); return; }
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(k) >= 0) e.preventDefault();
      if (gate && gate.armed && !state.paused) {
        if (k === ' ' || k === 'Enter' || k === 'g' || k === 'G') { e.preventDefault(); if (!e.repeat) releaseGate(); return; }
        if (e.repeat) return;
        releaseGate();                                  // any other key starts the question and still acts
      }
      if (!state.keys.has(k)) { state.keys.add(k); if (!state.paused && inst.onKey) safe(function () { inst.onKey(k, true); }); }
    }
    function onKeyUp(e) { state.keys.delete(e.key); if (!state.paused && inst.onKey) safe(function () { inst.onKey(e.key, false); }); }
    function onPointer(type) { return function (e) { if (!state.paused && type === 'down' && gate && gate.armed) { e.preventDefault(); A.audio.resume(); swallowPointer = e.pointerId; releaseGate(); return; } if (type === 'up' && swallowPointer != null && swallowPointer === e.pointerId) { swallowPointer = null; e.preventDefault(); return; } if (type === 'down') { A.audio.resume(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {} } var p = toLogical(e); var dx = p.x - state.pointer.x, dy = p.y - state.pointer.y; state.pointer.x = p.x; state.pointer.y = p.y; if (type === 'down') state.pointer.down = true; if (type === 'up') state.pointer.down = false; if (!state.paused && inst.onPointer) safe(function () { inst.onPointer({ type: type, x: p.x, y: p.y, dx: type === 'move' ? dx : 0, dy: type === 'move' ? dy : 0 }); }); if (type !== 'move') e.preventDefault(); }; }
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointer('down')); canvas.addEventListener('pointermove', onPointer('move')); canvas.addEventListener('pointerup', onPointer('up')); canvas.addEventListener('pointercancel', onPointer('up'));
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    var pauseOverlay = null;
    function togglePause(force) {
      if (state.ended) return; var to = force != null ? force : !state.paused; if (to === state.paused && pauseOverlay) return;
      state.paused = to; pauseBtn.textContent = to ? '▶ Resume' : '⏸ Pause';
      if (to) { pauseOverlay = h('div.ar-overlay', {}, h('div.box', {}, h('h3', {}, 'Paused'), h('p', {}, def.controls || ''), h('div.row', {}, h('button.ar-btn.gold', { onclick: function () { togglePause(false); } }, 'Resume'), h('button.ar-btn', { onclick: function () { finish(false); } }, 'End run'), h('button.ar-btn', { onclick: function () { showTitle(); } }, 'All games')), h('div.ar-levels', {}, h('small', {}, 'Restart at another pace'), h('div.row', {}, A.TIERS.map(function (t) { return h('button.ar-btn' + (t.id === tier.id ? '.on' : ''), { style: { '--tc': t.color }, onclick: function () { A.setTier(t.id); if (state.cleanup) state.cleanup(); startGame(id); } }, t.name); }))), h('div.ar-levels', {}, h('small', {}, 'Restart with another warrant'), h('div.row', {}, A.WARRANTS.map(function (w) { return h('button.ar-btn' + (w.id === warrant.id ? '.on' : ''), { style: { '--tc': A.C.gold2 }, onclick: function () { A.setWarrant(w.id); if (state.cleanup) state.cleanup(); startGame(id); } }, w.name); }))))); stageWrap.appendChild(pauseOverlay); }
      else if (pauseOverlay) { pauseOverlay.remove(); pauseOverlay = null; state.keys.clear(); }
    }
    function onVis() { if (document.hidden && !state.ended) togglePause(true); }
    document.addEventListener('visibilitychange', onVis);

    // loop
    var last = performance.now(), raf;
    function frameLoop(t) {
      if (state.ended) return;
      var dt = Math.min(.05, (t - last) / 1000); last = t;
      tick(dt);
      if (!state.ended) raf = requestAnimationFrame(frameLoop);
    }
    state.tick = tick;                                   // also driven by ARCADE._debug.step for automated checks
    function tick(dt) {
      if (state.ended) return;
      if (!state.paused) {
        state.elapsed += dt;
        if (gate && gate.armed) {                      // reading pause: the scene stays drawn but nothing moves
          if (gate.mode === 'brief') { gate.left -= dt; gateBar.style.width = Math.min(100, 100 * (1 - Math.max(0, gate.left) / gate.total)) + '%'; if (gate.left <= 0) releaseGate(); }
        } else {
          var gdt = dt * tier.timeScale * api.progress.clock();   // difficulty pace, slowed further at harder question levels
          state.gameTime += gdt;
          safe(function () { inst.update(gdt); });
          if (state.ended) return;                     // the game ended itself inside update; never draw against torn-down state
          particles.update(gdt);
          if (gate && !gate.armed) { gate.delay -= gdt; if (gate.delay <= 0) armGate(); }
        }
        if (state.bannerTimer > 0) { state.bannerTimer -= dt; if (state.bannerTimer <= 0) hudBanner.classList.remove('on'); }
      }
      ctx.save(); ctx.setTransform(state.scale.x, 0, 0, state.scale.y, 0, 0);
      if (state.shake > 0) { ctx.translate(A.rand(-state.shake, state.shake), A.rand(-state.shake, state.shake)); state.shake = Math.max(0, state.shake - dt * 40); }
      ctx.fillStyle = '#050810'; ctx.fillRect(-20, -20, W + 40, H + 40);
      safe(function () { inst.draw(ctx); });
      particles.draw(ctx);
      ctx.restore();
    }
    raf = requestAnimationFrame(frameLoop);

    function safe(fn) { try { fn(); } catch (e) { console.error('[arcade] ' + id, e); } }
    state.cleanup = function () { state.ended = true; cancelAnimationFrame(raf); clearInterval(cd); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('resize', fit); document.removeEventListener('visibilitychange', onVis); try { inst.destroy && inst.destroy(); } catch (e) {} };
    function finish(won, o) { if (state.ended) return; state.cleanup(); showResults(state, won, o || {}); }
  }
  function endRun(silent) { if (run && run.cleanup) run.cleanup(); run = null; }

  // ---------- results ----------
  function showResults(state, won, o) {
    var def = state.def; var tier = state.tier || A.tier(); var rec = A.best.record(state.id, Math.round(state.score), null, tier.id);
    var right = state.review.filter(function (r) { return r.ok; }).length, total = state.review.length;
    var acc = total ? Math.round(right / total * 100) : null;
    var rotLine = null, wr = state.warrant || A.warrant();
    if (state.progress && state.rotKey) {
      var rb = A.rotation.bucket(state.rotKey), pk = Object.keys(state.progress.poolAll || {});   // every question offered this run, across all picks
      if (!pk.length) pk = state.progress.poolKeys || [];
      var playedN = pk.filter(function (k) { return rb.seen[k]; }).length, backN = pk.filter(function (k) { return rb.missed[k]; }).length;
      if (pk.length) rotLine = h('div.sub', { style: { marginTop: '10px' } }, 'You have played ' + playedN + ' of ' + pk.length + (wr.id === 'all' ? '' : ' ' + wr.name) + ' questions in this game.' + (backN ? ' ' + backN + ' missed ' + (backN === 1 ? 'question comes' : 'questions come') + ' back in your next runs.' : ' Next run starts with questions you have not seen.'));
    }
    var tIdx = A.TIERS.indexOf(tier), up = A.TIERS[tIdx + 1], down = tIdx > 0 ? A.TIERS[tIdx - 1] : null, nudge = null;
    if (up && total >= 5 && acc >= 85) nudge = h('div.ar-nudge', {}, h('b', {}, 'Ready for more?'), h('span', {}, acc + '% at ' + tier.name + '.'), h('button.ar-btn.gold', { onclick: function () { A.setTier(up.id); startGame(state.id); } }, 'Try ' + up.name));
    else if (down && total >= 4 && acc != null && acc < 50) nudge = h('div.ar-nudge.down', {}, h('b', {}, 'Too fast to read?'), h('span', {}, 'Drop a level; the questions stay the same.'), h('button.ar-btn', { onclick: function () { A.setTier(down.id); startGame(state.id); } }, 'Play at ' + down.name));
    if (rec.record && state.score > 0) A.audio.fanfare(); else if (won) A.audio.correct(); else A.audio.wrong();
    document.title = 'Results · ' + def.title;
    var screen = h('div.ar-results');
    screen.appendChild(h('div.ar-res-hero', {},
      h('div.ar-res-card', {}, h('div.ar-kicker', {}, h('i'), def.icon + ' ' + def.title + ' · ' + (state.warrant ? state.warrant.name + ' · ' : '') + tier.name), h('h2', {}, o.title || (won ? 'Cleared' : 'Run over')), h('div.big', {}, String(Math.round(state.score))),
        h('div.sub', {}, o.message || (acc == null ? 'No questions answered this run.' : 'You answered ' + right + ' of ' + total + ' correctly.')),
        rec.record && state.score > 0 ? h('div.ar-record', { style: { marginTop: '12px' } }, '🏆 New personal best') : h('div.sub', { style: { marginTop: '12px' } }, 'Best: ' + rec.entry.best + ' · plays: ' + rec.entry.plays),
        h('div.ar-res-actions', {}, h('button.ar-btn.gold.lg', { onclick: function () { startGame(state.id); } }, '↻ Play again'), h('button.ar-btn.lg', { onclick: function () { showTitle(); } }, 'All games'), (embedded ? h('button.ar-btn.lg', { type: 'button', onclick: goHome }, 'Back to ' + appName()) : h('a.ar-btn.lg', { href: mainFile() }, 'Open ' + appName()))), rotLine, nudge),
      h('div.ar-res-card', {}, h('div.ar-kicker', {}, h('i'), 'This run'), h('div.ar-res-grid', {},
        h('div', {}, h('small', {}, 'Accuracy'), h('b', {}, acc == null ? '—' : acc + '%')), h('div', {}, h('small', {}, 'Answered'), h('b', {}, String(total))), h('div', {}, h('small', {}, 'Level'), h('b', {}, String(state.level))),
        h('div', {}, h('small', {}, 'Time'), h('b', {}, Math.round(state.elapsed) + 's')), h('div', {}, h('small', {}, 'Lives left'), h('b', {}, String(Math.max(0, state.lives)))), h('div', {}, h('small', {}, 'Drills'), h('b', { style: { fontSize: '13px', fontFamily: 'var(--font-body)' } }, def.drills || ''))),
        h('p', { style: { marginTop: '14px', color: 'var(--muted)', fontSize: '12.5px' } }, 'Scores are kept in this browser only. Nothing is sent anywhere.'))));
    var missed = state.review.filter(function (r) { return !r.ok; });
    var review = h('div.ar-review');
    review.appendChild(h('h3', {}, missed.length ? 'What to study (' + missed.length + ' missed)' : (total ? 'Perfect run — every answer correct' : 'Answer questions during the run to build your study list')));
    var shown = 0;
    state.review.slice().sort(function (a, b) { return (a.ok ? 1 : 0) - (b.ok ? 1 : 0); }).forEach(function (r) {
      if (shown >= 40) return; shown++;
      review.appendChild(h('div.ar-rev-item' + (r.ok ? '.ok' : ''), {}, h('div.q', {}, r.prompt || ''),
        h('div.a', {}, r.ok ? h('span', {}, '✓ ', h('b', {}, r.correct || '')) : h('span', {}, r.given ? h('span.no', {}, r.given) : null, r.given ? ' → ' : '', h('b', {}, r.correct || '')), r.explanation ? h('div', { style: { marginTop: '4px' } }, r.explanation) : null),
        r.cite ? h('div.cite', {}, 'Cite: ' + r.cite) : null));
    });
    screen.appendChild(review);
    setView(topbar(), screen); window.scrollTo(0, 0);
    run = null;
  }

  // ---------- automated-check hooks (no UI) ----------
  A._debug = {
    run: function () { return run; },
    start: function () { if (run && run.skipCountdown) run.skipCountdown(); return !!run; },
    step: function (sec) { var r = run; if (!r || !r.tick) return false; var n = Math.max(1, Math.round((sec || 0) / 0.05)); for (var i = 0; i < n && !r.ended; i++) r.tick(0.05); return true; }
  };

  // ---------- boot ----------
  // ---------- mount inside Board Ready (one file) ----------
  A.mount = function (container, params) {
    A.unmount();
    params = params || {};
    embedded = true;
    root = container;
    root.classList.add('arcade-root');
    // the host page scrolls smoothly; the Arcade jumps (it re-renders the title screen and restores the scroll position)
    prevScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    initBg();
    if (params.tier) A.setTier(params.tier);
    if (params['class']) A.setWarrant(params['class']);
    if (!A.order.length) { setView(h('div.ar-title', {}, h('h1.ar-h1', {}, 'No games registered'))); return; }
    showTitle();
    if (params.game && A.games[params.game]) startGame(params.game);
  };
  A.unmount = function () {
    if (run && run.cleanup) run.cleanup();
    run = null;
    if (bgRaf) cancelAnimationFrame(bgRaf);
    if (bgResize) window.removeEventListener('resize', bgResize);
    bgRaf = 0; bgResize = null; bgCanvas = null; bgCtx = null; viewEl = null; root = null;
    if (prevScrollBehavior !== null) { document.documentElement.style.scrollBehavior = prevScrollBehavior; prevScrollBehavior = null; }
  };

  // ---------- standalone development copy ----------
  A.boot = function () {
    root = document.getElementById('arcade');
    root.classList.add('arcade-root');
    initBg();
    var tm = /[#?&]tier=(\w+)/.exec(location.hash + location.search); if (tm) A.setTier(tm[1]);
    var cm = /[#?&]class=(\w+)/i.exec(location.hash + location.search); if (cm) A.setWarrant(cm[1]);   // the main app opens the Arcade at the candidate's warrant class
    if (!A.order.length) { setView(h('div.ar-title', {}, h('h1.ar-h1', {}, 'No games registered'))); return; }
    showTitle();
    var m = /[#?]game=([\w-]+)/.exec(location.hash + location.search); if (m && A.games[m[1]]) startGame(m[1]);
  };
})();
