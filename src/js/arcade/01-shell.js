/* ARCADE-01-SHELL — lobby (rank, pace, sound, the campaign, game cabinets), play screen (HUD bar, prompt panel, fluid
   canvas stage, answer panel, the Master Gunner's bubble), reading pause, pause menu, and results with XP, rank, the
   campaign card and a study list. */
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
  function appName() { return meta().app_name || 'B2B Exam Prep'; }
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
    var read = t.read === 'hold' ? 'Each question waits until you press Go.' : t.read === 'long' ? 'A long pause to read each question; it goes on by itself.' : t.read === 'brief' ? 'A short pause to read each question.' : 'No pause to read.';
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
        h('p.ar-lede', {}, 'Seven games built on the guide\'s checked question bank, key numbers, FAR parts, forms and glossary, five of them in real 3D, and a twelve-chapter campaign briefed by your Master Gunner. Every miss lands on a study list with the answer, the reason and the FAR cite.')),
      rankCard(rk)));
    // how the Arcade works, in three steps that jump to their section (a tester could not tell how the months open)
    function jump(sel) { var el = screen.querySelector(sel); if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); } } }
    var how = [A.daily ? ['🎯', 'Range card', 'Three short missions a day. Close the card to keep your streak.', '#ar-daily'] : null,
      A.campaign ? ['🗓️', 'Campaign', 'One month at a time: pass a month\'s three missions to open the next.', '#ar-camp'] : null,
      ['🎮', 'Any game', 'Any game below, any time, or the game at the end of a lesson.', '.ar-cabinets']].filter(Boolean);
    screen.appendChild(h('nav.ar-how', { 'aria-label': 'How the Arcade works' }, how.map(function (s, i) {
      return h('button.ar-how-step', { type: 'button', onclick: function () { jump(s[3]); } }, h('span.ar-how-n', {}, String(i + 1)), h('span.ar-how-copy', {}, h('b', {}, s[0] + ' ' + s[1]), h('small', {}, s[2])));
    })));
    screen.appendChild(h('div.ar-setup', {},
      h('div.ar-pace-row', {}, h('span.ar-pace-label', {}, 'Pace'), h('div.ar-paces', { role: 'radiogroup', 'aria-label': 'Pace' }, A.TIERS.map(function (t, ti) {
        var on = t.id === tier.id;
        return h('button.ar-pace' + (on ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', title: t.badge + ': ' + t.desc, style: { '--tc': t.color }, onclick: function () { var y = window.scrollY; A.setTier(t.id); showLobby(); window.scrollTo(0, y); } },
          h('span.ar-tier-dots', {}, [0, 1, 2, 3].map(function (k) { return h('i' + (k <= ti ? '.on' : '')); })), h('b', {}, t.name), h('small', {}, t.badge));
      }))),
      h('div.ar-sound', {}, soundButtons()),
      h('p.ar-pace-line', {}, h('b', { style: { '--tc': tier.color } }, tier.name + ': '), paceLine(tier), ' ', h('span', {}, 'New here? Start at Recruit.'))));
    var grid = h('div.ar-cabinets'), thumbs = [];
    if (A.daily) { try { screen.appendChild(A.daily.section()); screen.appendChild(A.table.section()); } catch (e) { console.error('[arcade] daily', e); } }
    if (A.campaign && A.mentor) { try { screen.appendChild(A.campaign.section(thumbs)); } catch (e) { console.error('[arcade] campaign', e); } }
    screen.appendChild(h('h2.ar-h2', {}, 'All games'));
    A.order.forEach(function (id, i) {
      var def = A.games[id], ok = A.canRun(id), twin = ok ? null : A.runAs(id);   // Range Day without 3D: its cabinet starts Qual Range
      var best = A.best.get(id, tier.id), any = A.best.any(id);
      var cv = h('canvas', { width: '480', height: '240', 'aria-hidden': 'true' });
      if (def.thumb) thumbs.push({ cv: cv, def: def });
      grid.appendChild(h('button.ar-cab' + (ok || twin ? '' : '.off'), { type: 'button', style: { '--accent': def.accent || A.C.gold, animationDelay: (i * 70) + 'ms' }, disabled: !ok && !twin, onclick: function () { if (ok) startGame(id); else if (twin) startGame(twin); } },
        h('div.ar-cab-art', {}, def.thumb ? cv : h('span.ar-cab-ico', {}, def.icon || '🎮'), h('span.ar-genre', {}, (A.GL && A.GL.ok() ? def.genre : String(def.genre || '').replace(/\s*·\s*real 3D/i, '')) || 'Arcade')),
        h('div.ar-cab-body', {},
          h('h3', {}, h('span.ar-cab-emoji', { 'aria-hidden': 'true' }, def.icon || ''), def.title),
          h('p.tag', {}, def.tagline || ''),
          h('div.drills', {}, def.drills ? 'Drills · ' + def.drills : ''),
          h('div.foot', {}, best && best.plays ? h('span', {}, 'Best ', h('b', {}, fmt(best.best)), ' at ' + tier.name) : any ? h('span', {}, h('b', {}, String(any.plays)), any.plays === 1 ? ' play' : ' plays', ' · not yet at ' + tier.name) : h('span', {}, ok ? 'Not played yet' : twin ? 'This phone cannot draw its 3D, so it plays as ' + A.games[twin].title + ', the same drill in 2D.' : def.needs3D && !(A.GL && A.GL.ok()) ? 'Needs 3D graphics. Qual Range is the same drill in 2D.' : 'Needs content'),
            h('span.go', {}, ok ? 'Play ▶' : twin ? 'Play in 2D ▶' : 'Locked')))));
    });
    screen.appendChild(grid);
    var quick = A.DATA.quick || [];
    if (quick.length) screen.appendChild(h('section.ar-quick', {}, h('h2', {}, 'Quick drills'), h('p', {}, 'The same facts without the action: tap-to-answer rounds that work with a screen reader.'),
      h('div.ar-quick-row', {}, quick.map(function (q) { return h('a.ar-quick-item', { href: q.href }, h('b', {}, q.title), h('span', {}, q.sub || '')); }))));
    screen.appendChild(h('div.ar-note', {}, h('span', { 'aria-hidden': 'true' }, '🎓'), h('div', {}, h('b', {}, 'Training aid, not official guidance. '),
      'Game content comes from this guide\'s checked data (content checked ' + (meta().content_verified_on || '2026') + ', FAR Overhaul numbering). Scores, XP and missed questions stay in your progress and are saved with it; nothing is sent anywhere.',
      h('span.ar-keys', {}, ' Keyboard: arrows or WASD move, Space or Enter acts, 1 to 4 answer, P pauses, M mutes.'))));
    if (A.GL && A.GL.selfTest) screen.appendChild(phoneCheck());
    setView(screen);
    runLobby(thumbs);
  }
  // "Game screen blank or stuck?": a 3D test on this device and a report the player can copy and send
  function phoneCheck() {
    var out = h('pre.ar-check-out', { hidden: true }), text = '', copyBtn, mailBtn, who = (meta().maintainer || {}).email || '';
    var touch = false; try { touch = window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
    var dev = touch ? 'phone' : 'device';
    function fmtReport(r) {
      var lines = ['B2B Exam Prep ' + (meta().version || '') + ' · Arcade phone check · ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
        '3D: ' + r.result + (r.testMs != null ? ' (' + r.testMs + ' ms)' : ''),
        'Graphics: ' + r.webgl + (r.gpu ? ' · ' + r.gpu : '') + (r.maxTex ? ' · textures up to ' + r.maxTex : ''),
        'Background shader compile: ' + (r.parallel ? 'yes' : 'no') + ' · HDR targets: ' + (r.float ? 'yes' : 'no'),
        'Last 3D game load: ' + (r.warmMs != null ? (r.warmMs / 1000).toFixed(1) + ' s' : 'none yet'),
        'Screen: ' + window.innerWidth + ' × ' + window.innerHeight + ' · pixel ratio ' + (window.devicePixelRatio || 1),
        'Browser: ' + navigator.userAgent];
      (r.notes || []).forEach(function (n) { lines.push('Note ' + n.at + ' ' + n.kind + ': ' + n.msg); });
      return lines.join('\n');
    }
    function test() {
      out.hidden = false; out.textContent = 'Testing…'; copyBtn.hidden = true; mailBtn.hidden = true;
      setTimeout(function () {
        var coarse = false; try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
        var r; try { r = A.GL.selfTest(coarse); } catch (e) { r = { result: 'test failed: ' + (e && e.message), webgl: '?', notes: [] }; }
        text = fmtReport(r); out.textContent = text; copyBtn.hidden = false; copyBtn.textContent = 'Copy the result';
        if (who) { mailBtn.href = 'mailto:' + who + '?subject=' + encodeURIComponent(appName() + ': Arcade phone check') + '&body=' + encodeURIComponent('What happened (which game, what you saw):\r\n\r\n\r\n' + text.replace(/\n/g, '\r\n')); mailBtn.hidden = false; }
      }, 60);
    }
    function copy() {
      function done() { copyBtn.textContent = 'Copied'; }
      function fallback() { try { var rg = document.createRange(); rg.selectNodeContents(out); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rg); document.execCommand('copy'); done(); } catch (e) {} }
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback(); } catch (e) { fallback(); }
    }
    copyBtn = h('button.ar-btn', { type: 'button', hidden: true, onclick: copy }, 'Copy the result');
    mailBtn = h('a.ar-btn', { href: '#', hidden: true }, 'Email it to the developer');
    return h('details.ar-check', {}, h('summary', {}, 'Game screen blank or stuck? Check this ' + dev),
      h('p', {}, 'A quick 3D test on this ' + dev + '. The games pick simpler drawing by themselves when a ' + dev + ' needs it. If a game still will not show, send the result to the developer.'),
      h('div.ar-row', {}, h('button.ar-btn.gold', { type: 'button', onclick: test }, '▶ Run the 3D test'), copyBtn, mailBtn), out);
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
        thumbs.forEach(function (th) { try { th.ctx.setTransform(1, 0, 0, 1, 0, 0); th.ctx.clearRect(0, 0, th.cv.width, th.cv.height); th.def.thumb(th.ctx, th.cv.width, th.cv.height, t); } catch (e) {} });
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
      h('button.ar-btn.sm', { type: 'button', title: 'Back to the game list', onclick: function () { if (state.ended || !state.review.length || lostEl) showLobby(); else togglePause(true); } }, '← ', h('span.ar-hide-xs', {}, 'Games')),
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
    var mentorCv = h('canvas', { width: '88', height: '88', 'aria-hidden': 'true' }), mentorP = h('p'), mentorEl = h('div.ar-mentor', { hidden: true, role: 'status' }, mentorCv, h('div.ar-mentor-t', {}, h('b', {}, A.mentor ? A.mentor.name : ''), mentorP));
    var mentor = { on: false, left: 0, mood: 'pleased', t0: 0 };
    if (A.mentor) box.appendChild(mentorEl);
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
      box.classList.toggle('ar-tight', bh < 360);   // a short stage (a small phone held upright): the pause cards tighten
      var k = Math.max(bw / 960, bh / 900, 1); if (bw / k < 360) k = bw / 360;
      var W = Math.round(bw / k), H = Math.round(bh / k), dpr = Math.min(2, window.devicePixelRatio || 1);
      var cw = Math.max(1, Math.round(bw * dpr)), ch = Math.max(1, Math.round(bh * dpr)), resized = canvas.width !== cw || canvas.height !== ch;
      if (resized) { canvas.width = cw; canvas.height = ch; }   // setting the size clears the canvas, even to the same size
      var changed = W !== state.W || H !== state.H;
      state.W = W; state.H = H; state.scale = canvas.width / W;
      try { ctx.letterSpacing = '0.01px'; } catch (e) {}
      if (changed && inst && inst.resize) safe(function () { inst.resize(W, H); });
      if (resized && state.waitLoad) { try { drawLoading(); } catch (e) {} }   // the card stays on while the stage changes size
      else if (resized && state.paintFrame) { try { state.paintFrame(); } catch (e) {} }   // a running game redraws at once: no blank frame
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

    // a run that ends out of lives still landed what it landed: a game with a mission count sets api.partial
    function partial() { try { return typeof api.partial === 'function' ? api.partial() : undefined; } catch (e) { return undefined; } }

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
      life: function (n) { state.lives = A.clamp(state.lives + (n || 0), 0, 9); drawLives(); if (n < 0) { playEl.classList.remove('ar-hurt'); void playEl.offsetWidth; playEl.classList.add('ar-hurt'); } if (state.lives <= 0) setTimeout(function () { if (!state.ended) finish(false, { title: def.outTitle || 'Out of lives', campaign: partial() }); }, 650); return state.lives; },
      xp: function (n) { state.xp += Math.max(0, n || 0); return state.xp; },
      // r: { prompt, given, correct, ok, explanation, cite, lesson, qid, key }
      review: { add: function (r) {
        if (!r) return; state.review.push(r); noteResult(r); if (r.ok) state.xp += 10; if (r.qid && host('onAnswer')) { try { host('onAnswer')(r.qid, !!r.ok); } catch (e) {} }
        // every answer fires one target on this week's qualification table
        if (A.table) { try { var tr = A.table.record(!!r.ok); if (tr && tr.justFired) { api.hud.set({ banner: 'Table fired: ' + tr.badgeName, sub: tr.hits + ' of 40 hits this week', color: '#f6d991', bannerTime: 3.2 }); A.audio.fanfare(); } } catch (e) {} }
      } },
      // a new question became active: Recruit freezes until Go, Regular gives a reading window, Veteran and Elite do nothing
      ready: function (o) {
        if (tier.read === 'off') return false;
        if (typeof o === 'string') o = { text: o };
        o = o || {};
        // the reading window ends by itself: Recruit's ('long') is about half again as long as Regular's
        var words = String(o.text || pT.textContent || '').split(/\s+/).filter(Boolean).length, long = tier.read === 'long';
        var left = long ? A.clamp(2.5 + words * 0.45, 4, 14) : A.clamp(1.2 + words * 0.3, 2.5, 9);
        if (gate && gate.armed) { gateEl.hidden = true; box.classList.remove('is-reading'); }
        gate = { mode: long ? 'brief' : tier.read, delay: o.delay != null ? o.delay : 0.35, armed: false, left: left, total: left };
        return true;
      },
      get reading() { return !!(gate && gate.armed); },
      end: function (o) { finish(!!(o && o.won), o); },
      shake: function (px) { state.shake = Math.max(state.shake, px || 8); },
      // the Master Gunner's bubble over the stage: say(mood, text, seconds); mood pleased | hint | worried | proud | brief
      mentor: {
        say: function (mood, text, secs) { if (!A.mentor || !text) return; mentor.on = true; mentor.mood = mood || 'pleased'; mentor.left = secs || A.clamp(1.6 + String(text).split(/\s+/).length * 0.32, 2.6, 7); mentor.t0 = performance.now(); mentorP.textContent = text; mentorEl.className = 'ar-mentor ' + mentor.mood; mentorEl.hidden = false; },
        hide: function () { mentor.on = false; mentorEl.hidden = true; },
        get showing() { return mentor.on; }
      },
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
    // the game is built on the third frame, after the loading card has reached the screen: a 3D scene takes a moment to
    // build on a phone, and its shaders longer to compile (inst.loading() is true until they are ready)
    var built = false;
    inst = { loading: function () { return true; }, update: function () {}, draw: function () {} };
    function failedInst(e) {
      var msg = String((e && e.message) || e || ''), gl = /3D|WebGL|webgl|three/i.test(msg) || /3D/.test(def.genre || '');
      return { noCount: true, update: function () {}, draw: function (c) {
        var W = state.W, H = state.H; c.fillStyle = A.C.bg; c.fillRect(0, 0, W, H);
        A.text(c, 'This game could not start on this device.', W / 2, H / 2 - 34, { size: 18, weight: 800, align: 'center', color: '#f6d991', maxWidth: W - 40 });
        A.text(c, gl ? 'It needs 3D graphics, and this browser could not draw them. Contract Quest and Qual Range need no 3D.' : 'Go back and try again, or pick another game.', W / 2, H / 2, { size: 14, align: 'center', color: '#c2cdc6', maxWidth: W - 48 });
        A.text(c, msg.slice(0, 140), W / 2, H / 2 + 70, { size: 11, align: 'center', color: '#8a958f', maxWidth: W - 48 });
      } };
    }
    function build() {
      if (built || run !== state) return; built = true;
      try { inst = def.create(api); } catch (e) { console.error('[arcade] create failed', e); if (A.GL && A.GL.note) A.GL.note('start', def.title + ': ' + (e && e.message)); inst = failedInst(e); }
      state.inst = inst;
      if (inst.resize) safe(function () { inst.resize(state.W, state.H); });
    }
    state.build = build; state.inst = inst;
    function isLoading() { if (!built) return true; if (!inst.loading) return false; try { return !!inst.loading(); } catch (e) { return false; } }
    if (def.music) A.music.play(def.music);

    // ---- countdown ----
    var cd = 0, countEl = null, counting = false, countLater = false;
    function countdown() {
      if (def.countdown === false || (inst && inst.noCount)) return;   // a game that could not start shows why, with no 3-2-1 over it
      var count = (performance.now() - loadStart) / 1000 > 1.5 ? 1 : 3; countEl = h('div.ar-count', {}, String(count)); box.appendChild(countEl); state.paused = true; counting = true;   // one beat when the load already took a while
      cd = setInterval(function () { count--; if (count > 0) { countEl.textContent = String(count); countEl.style.animation = 'none'; void countEl.offsetWidth; countEl.style.animation = ''; A.audio.tick(); } else { clearInterval(cd); counting = false; countEl.remove(); if (!pauseEl && !lostEl) { state.paused = false; A.audio.powerup(); } } }, 650);   // a pause card that came up during 3-2-1 keeps the clock held
    }
    var loadStart = performance.now();   // real time: the game clock is capped per frame and would hide a long build
    state.waitLoad = true; state.loadT = 0;
    state.skipCountdown = function () { build(); state.waitLoad = false; clearInterval(cd); counting = false; if (countEl && countEl.parentNode) countEl.remove(); state.paused = false; };
    // while the game loads: no clock, no input, a card with the game's name and a moving bar
    var loadFrames = 0;
    function waitLoading(dt) {
      state.loadT += dt; loadFrames++;
      if (!built && loadFrames >= 3) build();
      if (!isLoading()) { state.waitLoad = false; if (!state.paused) countdown(); else countLater = true; return false; }
      try { drawLoading(); } catch (e) {}
      return true;
    }
    function drawLoading() {
      var W = state.W, H = state.H, t = (performance.now() - loadStart) / 1000, cx = W / 2, cy = H / 2;
      ctx.save(); ctx.setTransform(state.scale, 0, 0, state.scale, 0, 0);
      ctx.fillStyle = A.C.bg; ctx.fillRect(-2, -2, W + 4, H + 4);
      A.text(ctx, (def.icon ? def.icon + '  ' : '') + def.title, cx, cy - 26, { size: 22, weight: 800, align: 'center', color: '#f6d991', maxWidth: W - 32 });
      A.text(ctx, built ? 'Building the 3D scene' : 'Loading', cx, cy + 2, { size: 15, align: 'center', color: '#c2cdc6' });
      var bw = Math.min(240, W - 80), bx = cx - bw / 2, by = cy + 20, seg = bw * 0.32, x = bx - seg + (bw + seg) * ((t * 0.7) % 1);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; A.roundRect(ctx, bx, by, bw, 6, 3); ctx.fill();
      ctx.save(); A.roundRect(ctx, bx, by, bw, 6, 3); ctx.clip(); ctx.fillStyle = '#e6b85a'; ctx.fillRect(x, by, seg, 6); ctx.restore();
      if (t > 5) A.text(ctx, 'The first start takes the longest. Later starts are quicker.', cx, by + 34, { size: 12, align: 'center', color: '#8f9b95', maxWidth: W - 48 });
      ctx.restore();
    }
    // the phone took the 3D view back: say so and offer a restart instead of leaving a frozen or black stage
    var lostEl = null;
    function onLost() {
      if (run !== state || lostEl || state.ended) return;
      clearInterval(cd); counting = false; if (countEl && countEl.parentNode) countEl.remove();
      if (pauseEl) { pauseEl.remove(); pauseEl = null; }
      try { A.music.stop(); } catch (e) {}
      lostEl = h('div.ar-pause.ar-lost', { role: 'alertdialog', 'aria-label': 'The 3D view stopped' }, h('div.ar-pause-box', {},
        h('h3', {}, 'The 3D view stopped'),
        h('p.ar-howto', {}, 'The device took the graphics back, usually to save memory or after the app sat in the background. Restart the game to carry on.'),
        h('div.ar-row', {}, h('button.ar-btn.gold.lg', { type: 'button', onclick: function () { startGame(id, opts); } }, '↻ Restart the game'),
          h('button.ar-btn.lg', { type: 'button', onclick: function () { showLobby(); } }, 'All games'))));
      box.appendChild(lostEl); state.paused = true;
      var rb = lostEl.querySelector('button'); if (rb) { try { rb.focus({ preventScroll: true }); } catch (e) {} }
    }
    if (A.GL) A.GL.onLost = onLost;
    function onFail() {
      if (run !== state || state.ended || state.failed3D) return; state.failed3D = true;
      // a game with no 2D version (Range Day) ends here and keeps the answers given; the others start again in 2D
      if (def.needs3D) {
        setTimeout(function () { if (run === state && !state.ended) finish(false, A.no3D(def, A.GL && A.GL.tooSlow ? 'This device became too slow for the 3D range, so the Arcade has moved its games to 2D until the page is reloaded.' : 'The 3D view stopped working on this device.', partial())); }, 0);
        return;
      }
      setTimeout(function () { if (run === state && !state.ended) startGame(id, opts); }, 0);   // not from inside the draw call that found it
    }
    if (A.GL) A.GL.onFail = onFail;

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
      if (state.paused || state.waitLoad) return;
      if (gate && gate.armed) { if (k === ' ' || k === 'Enter' || k === 'g' || k === 'G') { if (!e.repeat) releaseGate(); return; } if (e.repeat) return; releaseGate(); }
      if (contCb && (k === 'Enter' || k === ' ')) { if (!e.repeat) doContinue(); return; }
      if (choiceCb && !e.repeat) {
        var idx = '123456789'.indexOf(k); if (idx < 0 && def.letterKeys) idx = 'abcd'.indexOf(k.toLowerCase());
        if (idx >= 0) { var b = optsEl.querySelector('.ar-opt[data-i="' + idx + '"]'); if (b && !b.disabled) { b.click(); return; } }
      }
      if (!state.keys.has(k)) { state.keys.add(k); if (inst.onKey) safe(function () { inst.onKey(k, true, e.repeat); }); }
    }
    function onKeyUp(e) { if (typing(e)) return; state.keys.delete(e.key); if (!state.paused && !state.waitLoad && inst.onKey) safe(function () { inst.onKey(e.key, false); }); }
    function onPointer(type) {
      return function (e) {
        if (state.ended) return;
        if (!state.paused && type === 'down' && gate && gate.armed) { e.preventDefault(); A.audio.resume(); swallowPointer = e.pointerId; releaseGate(); return; }
        if (type === 'up' && swallowPointer != null && swallowPointer === e.pointerId) { swallowPointer = null; e.preventDefault(); return; }
        if (type === 'down') { A.audio.resume(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {} }
        var p = toLogical(e), dx = p.x - state.pointer.x, dy = p.y - state.pointer.y;
        state.pointer.x = p.x; state.pointer.y = p.y; if (type === 'down') state.pointer.down = true; if (type === 'up') state.pointer.down = false;
        state.pointer.type = e.pointerType || 'mouse';
        if (!state.paused && !state.waitLoad && inst.onPointer) safe(function () { inst.onPointer({ type: type, x: p.x, y: p.y, dx: type === 'move' ? dx : 0, dy: type === 'move' ? dy : 0, touch: e.pointerType === 'touch' || e.pointerType === 'pen' }); });
        if (type !== 'move') e.preventDefault();
      };
    }
    document.addEventListener('keydown', onKeyDown, true); document.addEventListener('keyup', onKeyUp, true);
    var pd = onPointer('down'), pm = onPointer('move'), pu = onPointer('up');
    canvas.addEventListener('pointerdown', pd); canvas.addEventListener('pointermove', pm); canvas.addEventListener('pointerup', pu); canvas.addEventListener('pointercancel', pu);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // ---- pause ----
    var pauseEl = null;
    // brief: a card in place of Paused before a lesson's game starts (the lesson, its topics, Start); the scene loads behind it
    function togglePause(force, brief) {
      if (state.ended || lostEl) return;   // the "3D view stopped" card is already up: restart is the only way on
      var was = counting ? !!pauseEl : state.paused;   // during 3-2-1 the clock is held anyway, so the card is what toggles
      var to = force != null ? force : !was; if (to === was && (pauseEl || !to)) return;
      state.paused = to || counting; pauseBtn.textContent = to ? '▶' : '⏸';
      if (to) {
        A.music.stop();
        if (brief) pauseEl = h('div.ar-pause.ar-brief', { role: 'dialog', 'aria-label': brief.title }, h('div.ar-pause-box', {},
          h('div.ar-kicker', {}, h('i'), brief.kicker), h('h3', {}, brief.title), h('p.ar-howto', {}, brief.text),
          h('div.ar-row', {}, h('button.ar-btn.gold.lg', { type: 'button', onclick: function () { togglePause(false); } }, 'Start ▶'),
            brief.back ? h('a.ar-btn.lg', { href: brief.back }, '← Back to the lesson') : h('button.ar-btn.lg', { type: 'button', onclick: function () { showLobby(); } }, 'All games'))));
        else pauseEl = h('div.ar-pause', { role: 'dialog', 'aria-label': 'Paused' }, h('div.ar-pause-box', {}, h('h3', {}, 'Paused'),
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
        if (countLater) { countLater = false; countdown(); }   // the game loaded while paused: count it in now
        if (def.music) A.music.play(A.music.track || def.music);
        try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
      }
    }
    function onVis() { if (document.hidden && !state.ended) togglePause(true); }
    document.addEventListener('visibilitychange', onVis);

    // ---- loop ----
    var last = performance.now(), raf = 0;
    function frameLoop(t) { if (state.ended) return; var dt = Math.max(0, Math.min(.05, (t - last) / 1000)); last = t; tick(dt); if (!state.ended) raf = requestAnimationFrame(frameLoop); }
    state.tick = tick;
    function tick(dt) {
      if (state.ended) return;
      if (state.waitLoad && waitLoading(dt)) return;
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
        if (mentor.on) { mentor.left -= dt; if (mentor.left <= 0) api.mentor.hide(); else { var mt = (performance.now() - mentor.t0) / 1000; try { A.mentor.draw(mentorCv.getContext('2d'), 88, mentor.mood, mt, { talk: mt < 1.1 }); } catch (e) {} } }
      }
      ctx.save(); ctx.setTransform(state.scale, 0, 0, state.scale, 0, 0);
      if (state.shake > 0) { ctx.translate(A.rand(-state.shake, state.shake), A.rand(-state.shake, state.shake)); state.shake = Math.max(0, state.shake - dt * 38); }
      ctx.fillStyle = A.C.bg; ctx.fillRect(-30, -30, state.W + 60, state.H + 60);
      safe(function () { inst.draw(ctx); });
      particles.draw(ctx); floaters.draw(ctx);
      if (inst.drawTop) safe(function () { inst.drawTop(ctx); });
      ctx.restore();
    }
    // one frame drawn outside the loop (after the stage changes size, which clears the canvas)
    state.paintFrame = function () {
      if (state.ended || state.waitLoad) return;
      ctx.save(); ctx.setTransform(state.scale, 0, 0, state.scale, 0, 0);
      ctx.fillStyle = A.C.bg; ctx.fillRect(-30, -30, state.W + 60, state.H + 60);
      safe(function () { inst.draw(ctx); });
      particles.draw(ctx); floaters.draw(ctx);
      if (inst.drawTop) safe(function () { inst.drawTop(ctx); });
      ctx.restore();
    };
    raf = requestAnimationFrame(frameLoop);
    // a game started from a lesson opens on the lesson: what this round asks and its topics, then Start
    if (opts && opts.lesson) { var L = opts.lesson, back = host('lessonHref') && host('lessonHref')(L.id);
      togglePause(true, { kicker: 'From your lesson', title: 'Lesson ' + L.n + ' · ' + L.title,
        text: (L.what ? L.what + ' ' : '') + (L.topics && L.topics.length ? 'Topics: ' + L.topics.join(' · ') + '.' : ''), back: back ? back.href : '' }); }

    function safe(fn) { try { fn(); } catch (e) { console.error('[arcade] ' + id, e); } }
    state.cleanup = function () {
      state.ended = true; cancelAnimationFrame(raf); clearInterval(cd); clearTimeout(hint._t);
      document.removeEventListener('keydown', onKeyDown, true); document.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('resize', fit); document.removeEventListener('visibilitychange', onVis); if (ro) ro.disconnect();
      try { inst.destroy && inst.destroy(); } catch (e) {}
      if (A.GL && A.GL.onLost === onLost) A.GL.onLost = null;
      if (A.GL && A.GL.onFail === onFail) A.GL.onFail = null;
      A.music.stop(); A.music.setIntense(false);
      if (host('stopSpeak')) host('stopSpeak')();
      if (playEl.parentNode) playEl.parentNode.removeChild(playEl);
      document.documentElement.classList.remove('ar-playing');
      if (host('playing')) host('playing')(false);
    };
    function finish(won, o) { if (state.ended) return; o = o || {}; state.cleanup(); run = null; if (o.quiet) { record(state, won, o); return; } showResults(state, won, o); }
  }
  function endRun() { if (run && run.cleanup) run.cleanup(); run = null; }
  // what this device can run: a 3D-only game (Range Day) with a 2D twin runs as the twin (Qual Range) where 3D cannot be
  // drawn, with the same mission settings, so no campaign month or range card is ever blocked by the phone's graphics
  A.canRun = function (id) { var d = A.games[id]; if (!d) return false; try { return !d.dataOk || !!d.dataOk(A.DATA); } catch (e) { return false; } };
  A.runAs = function (id) { if (A.canRun(id)) return id; var d = A.games[id]; return d && d.alt2D && A.canRun(d.alt2D) ? d.alt2D : null; };
  // the end of a 3D-only game on a device that cannot draw it, or became too slow to: the results offer its 2D twin
  A.no3D = function (def, why, campaign) {
    var alt = def && def.alt2D && A.games[def.alt2D];
    return { won: false, title: '3D not available', message: why + (alt ? ' ' + alt.title + ' is the same drill in 2D.' : ''), campaign: campaign, alt: alt ? { id: def.alt2D, label: 'Play ' + alt.title } : null };
  };

  // ---------- results ----------
  function record(state, won, o) {
    var rec = A.best.record(state.id, Math.round(state.score), null, state.tier.id);
    var right = state.review.filter(function (r) { return r.ok; }).length, total = state.review.length;
    var bonus = won ? 50 : 0, xp = A.addXp(state.xp + bonus + (o.xpBonus || 0));
    var summary = { game: state.id, score: Math.round(state.score), right: right, total: total, pct: total ? Math.round(right / total * 100) : 0, won: !!won, tier: state.tier.id, record: rec.record, path: params.path || '' };
    if (A.campaign && state.opts && state.opts.campaign) { try { state.campaignResult = A.campaign.onRunEnd(state, won, o); } catch (e) { console.error('[arcade] campaign', e); } }
    if (A.daily && state.opts && state.opts.daily) { try { state.dailyResult = A.daily.onRunEnd(state, won, o); } catch (e) { console.error('[arcade] daily', e); } }
    // the XP line counts what the campaign and the range card added too, and announces a promotion they brought
    var extra = (state.campaignResult && state.campaignResult.xp || 0) + (state.dailyResult && state.dailyResult.xp || 0);
    if (extra > 0) { var now = A.rank(); xp = { gained: xp.gained + extra, before: xp.before, after: now, up: now.level > xp.before.level }; }
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
    var lessonBack = state.opts && state.opts.lesson && host('lessonHref') ? host('lessonHref')(state.opts.lesson.id) : null;
    var pathBtn = lessonBack ? h('a.ar-btn.lg', { href: lessonBack.href }, '← Back to the lesson') : params.path && host('pathHref') ? h('a.ar-btn.lg', { href: host('pathHref')() }, '← My exam path') : null;
    var screen = h('div.ar-results');
    screen.appendChild(h('div.ar-res-hero', {},
      h('div.ar-res-card.main', {},
        h('div.ar-kicker', {}, h('i'), (def.icon ? def.icon + ' ' : '') + def.title + ' · ' + tier.name + (state.opts && state.opts.campaign ? ' · ' + state.opts.campaign.title : '') + (state.opts && state.opts.daily ? ' · ' + state.opts.daily.title : '') + (state.opts && state.opts.lesson ? ' · Lesson ' + state.opts.lesson.n : '')),
        h('h2', {}, o.title || (won ? 'Mission complete' : 'Run over')),
        h('div.ar-big', {}, fmt(state.score)),
        h('div.ar-sub', {}, o.message || (acc == null ? 'No questions answered this run.' : 'You answered ' + right + ' of ' + total + ' correctly (' + acc + '%).')),
        o.badge ? h('div.ar-badge', { style: { '--bc': o.badge.color || A.C.gold } }, h('span.ar-badge-ico', { 'aria-hidden': 'true' }, o.badge.icon || '🏅'), h('div', {}, h('b', {}, o.badge.name), h('small', {}, o.badge.desc || ''))) : null,
        state.campaignResult && A.campaign ? A.campaign.card(state) : null,
        state.dailyResult && A.daily ? A.daily.card(state) : null,
        rec.record && state.score > 0 ? h('div.ar-record', {}, '🏆 New personal best at ' + tier.name) : h('div.ar-sub', {}, 'Best at ' + tier.name + ': ' + fmt(rec.entry.best) + ' · plays: ' + rec.entry.plays),
        h('div.ar-xpline' + (xp.up ? '.up' : ''), {}, h('b', {}, '+' + fmt(xp.gained) + ' XP'),
          h('span', {}, xp.up ? 'Promoted to ' + rk.name + ' (level ' + rk.level + ')!' : rk.name + ' · ' + fmt(rk.to - rk.xp) + ' XP to ' + rk.next),
          h('div.ar-xpbar', {}, h('span', { style: { width: Math.round(rk.pct * 100) + '%' } }))),
        h('div.ar-res-actions', {}, o.alt ? h('button.ar-btn.gold.lg', { type: 'button', onclick: function () { startGame(o.alt.id, {}); } }, o.alt.label + ' ▶')
          : h('button.ar-btn.gold.lg', { type: 'button', onclick: function () { startGame(state.id, state.opts); } }, '↻ Play again'), h('button.ar-btn.lg', { type: 'button', onclick: function () { showLobby(); } }, 'All games'), pathBtn),
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
    play: function (id, opts) { startGame(id, opts); if (run && run.build) run.build(); return !!run; }
  };

  // ---------- mount inside B2B Exam Prep ----------
  A.mount = function (container, p) {
    A.unmount();
    params = p || {};
    root = container; root.classList.add('arcade-root');
    A.rotation.reset();
    if (params.tier) A.setTier(params.tier);
    if (!A.order.length) { setView(h('div.ar-lobby', {}, h('h1.ar-h1', {}, 'No games registered'))); return; }
    showLobby();
    if (params.campaign && A.campaign) {
      var ch = A.campaign.byN(params.campaign);
      if (ch && A.campaign.unlocked(ch)) { A.campaign.sel = ch; var m = params.mission ? ch.missions[+params.mission - 1] : null; if (m) A.campaign.start(ch, m); else A.lobby('campaign'); }
      return;
    }
    if (params.daily && A.daily) { var dm = A.daily.today().missions[+params.daily - 1]; if (dm) A.daily.start(dm.def); else A.lobby('daily'); return; }
    // a lesson's game (#/arcade?lesson=L05): the lesson's own questions or words, as its 2D twin where 3D cannot be drawn
    if (params.lesson && host('lessonGame')) { var lg = host('lessonGame')(params.lesson); if (lg) { startGame(A.runAs(lg.game) || lg.game, lg.opts); return; } }
    if (params.game && A.games[params.game]) startGame(params.game, { realm: params.realm || '', mission: params.mission || '' });
  };
  A.start = function (id, opts) { if (root) startGame(id, opts); };
  A.unmount = function () { endRun(); stopLobby(); A.music.stop(); viewEl = null; root = null; };
  A.lobby = function (at) { if (!root) return; showLobby(); var sel = at === 'campaign' ? '#ar-camp' : at === 'daily' ? '#ar-daily' : at === 'week' ? '#ar-week' : ''; if (sel) { var el = viewEl && viewEl.querySelector(sel); if (el) { try { el.scrollIntoView({ block: 'start' }); } catch (e) {} } } };
})();
