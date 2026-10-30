/* ARCADE-03d-GL-PATROL — PatrolScene on A.GL.Stage: Part Patrol's space over a planet. The game keeps its whole
   simulation in the 2D canvas's own pixels (the ship, carriers, drones, bullets, the Dreadnought); every frame it hands
   the scene a snapshot and the scene places lit models on a tilted field, with a planet below, a nebula, stars and
   explosions. toLogical() maps a screen point back to the field so the ship can follow a finger. */
(function () {
  'use strict';
  var A = window.ARCADE; if (!A || !A.GL) return;
  var GL = A.GL, THREE = window.THREE, hash = GL.hash, clamp = GL.clamp, fbm = GL.fbm;
  var SPACE = { top: 0x02030a, horizon: 0x0e1836, bot: 0x05060c, sunDir: [0.55, 0.55, -0.35], sunColor: 0xdfe8ff, sun: 2.2, haze: 0.04, fog: 0x05060c, fogD: 0.0, hemiSky: 0x2a3a6a, hemiGround: 0x101420, hemi: 0.55, night: 1, exposure: 1.1 };

  GL.PatrolScene = function (opts) {
    opts = opts || {};
    var reduce = opts.reduce || function () { return false; };
    var St = GL.Stage({ mobile: opts.mobile, reduce: reduce, fov: 40, far: 1500, shadow: { l: -20, r: 20, t: 40, b: -10, far: 200 }, light: SPACE });
    var K = GL.kit(St), scene = St.scene, camera = St.camera, X = St.X, std = St.std, fx = K.fx, i;
    St.renderer.shadowMap.enabled = false;
    var S = { t: 0, w: 4, h: 4, tri: 0, calls: 0, gl2: St.gl2, hdr: St.hdr, canvas: St.canvas, camera: camera, scene: scene, W: 520, H: 640, k: 24 / 520, zNear: 2 };
    S.toWorld = function (x, y, out) { out = out || new THREE.Vector3(); out.set((x - S.W / 2) * S.k, 0, (y - S.H) * S.k + S.zNear); return out; };
    // the camera frames the field: 24 m wide, as deep as the canvas is tall; farther back when the field is deep or the screen narrow
    S.field = function (W, H) { if (W === S.W && H === S.H && S.framed) return; S.W = W; S.H = H; S.k = 24 / W; S.framed = true; var depth = H * S.k, zc = S.zNear - depth / 2, aspect = S.w / S.h, d = Math.max(depth * 1.3, 30.6 / aspect); camLook.set(0, 0, zc); camBase.set(0, 0.883 * d, zc + 0.47 * d); };

    // ---- space: stars, a nebula, a planet below the field ----
    var starGeo = new THREE.BufferGeometry(), starPos = new Float32Array(420 * 3), starCol = new Float32Array(420 * 3);
    for (i = 0; i < 420; i++) { var th = hash(i, 3) * Math.PI * 2, ph = Math.acos(hash(i, 5) * 1.6 - 0.6), r = 520; starPos[i * 3] = Math.sin(ph) * Math.cos(th) * r; starPos[i * 3 + 1] = Math.cos(ph) * r; starPos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r; var b = 1 + hash(i, 7) * 2.2; starCol[i * 3] = b; starCol[i * 3 + 1] = b * (0.9 + hash(i, 9) * 0.2); starCol[i * 3 + 2] = b * (0.9 + hash(i, 11) * 0.4); }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3)); starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ vertexColors: true, size: 2.2, sizeAttenuation: true, map: X.soft, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    [[-120, 60, -300, 260, 0x7a4cff], [160, 30, -340, 220, 0xff5aa0], [40, -40, -380, 300, 0x3a6bff]].forEach(function (n) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.cloud, color: n[4], transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.set(n[0], n[1], n[2]); sp.scale.setScalar(n[3]); scene.add(sp); });
    var planetTex = GL.texFrom(256, (function () { var land = fbm(256, 21, 5, 0.55), cl = fbm(256, 23, 4, 0.5); return function (i) { var l = land[i], c = cl[i], p = l > 0.55 ? [86 + (l - 0.55) * 300, 120 + (l - 0.55) * 160, 60] : [24 + l * 40, 70 + l * 80, 150 + l * 60]; if (l > 0.78) p = [200, 200, 205]; if (c > 0.72) p = [p[0] * 0.5 + 120, p[1] * 0.5 + 120, p[2] * 0.5 + 125]; return p; }; })(), true);
    var planet = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 32), std({ map: planetTex, roughness: 0.9 })); planet.position.set(40, -64, -122); scene.add(planet);
    var atmo = new THREE.Mesh(new THREE.SphereGeometry(31.6, 48, 32), new THREE.MeshBasicMaterial({ color: 0x6fb3ff, transparent: true, opacity: 0.14, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending })); atmo.position.copy(planet.position); scene.add(atmo);
    var warp = []; for (i = 0; i < 40; i++) { var ws = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.soft, color: 0xcfe8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); ws.scale.set(0.08, 2.6, 1); ws.position.set((hash(i, 31) - 0.5) * 40, -2, -40 + hash(i, 33) * 60); scene.add(ws); warp.push(ws); }

    // ---- models ----
    var shipMat = std({ color: 0x9fb4c9, metalness: 0.55, roughness: 0.35, normalMap: X.metalN }), ship2Mat = std({ color: 0x4a5f78, metalness: 0.6, roughness: 0.3 }), glassMat = std({ color: 0x7ee0ff, emissive: 0x2a8fb0, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.1 });
    var carrierMat = std({ color: 0x56657a, metalness: 0.5, roughness: 0.45, normalMap: X.metalN }), carrier2 = std({ color: 0x3d4a5c, metalness: 0.5, roughness: 0.5 }), droneMat = std({ color: 0xff6b4a, metalness: 0.3, roughness: 0.5 }), droneCore = std({ color: 0xffd166, emissive: 0xffd166, emissiveIntensity: 2 });
    var flashMat = std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 }), bossMat = std({ color: 0x4a5468, metalness: 0.6, roughness: 0.4, normalMap: X.metalN }), plateMat = std({ color: 0xc9a24a, metalness: 0.8, roughness: 0.35 }), plateDark = std({ color: 0x3a2a20, roughness: 0.8 }), turretMat = std({ color: 0x3b4458, metalness: 0.6, roughness: 0.4 }), turretOk = std({ color: 0x2e5e44, emissive: 0x1f7f50, emissiveIntensity: 0.6, roughness: 0.6 });
    function ship() {
      var g = new THREE.Group();
      var body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.6, 8), shipMat); body.rotation.x = -Math.PI / 2; body.position.z = -0.2; g.add(body);
      var wing = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 1.1), ship2Mat); wing.position.set(0, -0.05, 0.45); g.add(wing);
      [-1, 1].forEach(function (s) { var tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.7), shipMat); tip.position.set(s * 1.55, 0, 0.6); tip.rotation.y = -s * 0.35; g.add(tip); var fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.6), ship2Mat); fin.position.set(s * 0.5, 0.3, 0.8); g.add(fin); });
      var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), glassMat); canopy.scale.set(1, 0.7, 1.6); canopy.position.set(0, 0.22, -0.1); g.add(canopy);
      var flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.flash, color: new THREE.Color(4, 2.4, 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); flame.position.set(0, 0, 1.3); flame.scale.set(0.6, 1.4, 1); g.add(flame); g.userData.flame = flame;
      [-1, 1].forEach(function (s) { var l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), std({ color: s < 0 ? 0xff5d5d : 0x5fd39a, emissive: s < 0 ? 0xff5d5d : 0x5fd39a, emissiveIntensity: 3 })); l.position.set(s * 1.5, 0.02, 0.6); g.add(l); });
      var shield = new THREE.Mesh(new THREE.SphereGeometry(1.9, 20, 14), new THREE.MeshBasicMaterial({ color: 0x7ee0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(shield); g.userData.shield = shield;
      return g;
    }
    var labelCache = {};
    function labelTex(text, glow) { var key = text + (glow ? '!' : ''); if (labelCache[key]) return labelCache[key]; var t = St.label(text, { w: 512, h: 128, size: 72, bg: glow ? '#0f3d27' : '#0d1424', ink: glow ? '#8ff0bd' : '#cfe8ff', fam: 'mono', border: false }); return labelCache[key] = t; }
    function carrier(label, wm) {
      var g = new THREE.Group(), hull = new THREE.Mesh(new THREE.BoxGeometry(wm, 0.9, 2.2), carrierMat); hull.position.y = 0.45; g.add(hull);
      var nose = new THREE.Mesh(new THREE.BoxGeometry(wm * 0.6, 0.6, 1.0), carrier2); nose.position.set(0, 0.4, -1.5); g.add(nose);
      var board = new THREE.Mesh(new THREE.PlaneGeometry(wm * 0.92, wm * 0.23), new THREE.MeshBasicMaterial({ map: labelTex(label, false) })); board.position.set(0, 1.0, 0.1); board.rotation.x = -0.95; g.add(board); g.userData.board = board; g.userData.label = label;
      [-1, 1].forEach(function (s) { var e = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.flash, color: new THREE.Color(3, 1.8, 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); e.position.set(s * wm * 0.3, 0.3, 1.3); e.scale.set(0.5, 0.9, 1); g.add(e); var l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), std({ color: 0xff5d5d, emissive: 0xff2020, emissiveIntensity: 3 })); l.position.set(s * wm * 0.46, 0.95, 0); g.add(l); g.userData['lamp' + (s + 1)] = l; });
      var bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0x8cc8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); bubble.scale.set(wm * 0.62, 1.3, 1.8); bubble.position.y = 0.4; g.add(bubble); g.userData.bubble = bubble;
      var pips = []; for (var k = 0; k < 8; k++) { var p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.12), std({ color: 0x8cc8ff, emissive: 0x8cc8ff, emissiveIntensity: 1.5 })); p.position.set(-1.3 + k * 0.37, 0.95, 1.2); g.add(p); pips.push(p); } g.userData.pips = pips;
      return g;
    }
    function drone() { var g = new THREE.Group(); for (var k = 0; k < 4; k++) { var b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.9), droneMat); b.rotation.y = k * Math.PI / 2; b.position.set(Math.sin(k * Math.PI / 2) * 0.45, 0, Math.cos(k * Math.PI / 2) * 0.45); g.add(b); } var core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), droneCore); g.add(core); var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.flash, color: new THREE.Color(2.5, 1.8, 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(0.9); g.add(glow); return g; }
    function powerup(k, color) { var g = new THREE.Group(), m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), std({ color: color, emissive: color, emissiveIntensity: 1.2, metalness: 0.3, roughness: 0.3 })); g.add(m); g.userData.core = m; var lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: St.label(k, { w: 64, h: 64, size: 44, bg: 'rgba(0,0,0,0)', ink: '#ffffff', border: false }), transparent: true, depthWrite: false })); lab.position.y = 0.9; lab.scale.setScalar(0.8); g.add(lab); return g; }
    function dreadnought(width) {
      var g = new THREE.Group(), w = width;
      var hull = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, 5), bossMat); hull.position.y = 0.8; g.add(hull);
      var prow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.2, 2.4), bossMat); prow.position.set(0, 0.7, -3.4); g.add(prow);
      var bridge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 1.0, 1.8), bossMat); bridge.position.set(0, 1.9, -1.6); g.add(bridge);
      var core = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.flash, color: new THREE.Color(6, 2, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); core.position.set(0, 1.8, -0.6); core.scale.setScalar(2.4); g.add(core); g.userData.core = core;
      g.userData.plates = []; g.userData.turrets = [];
      return g;
    }

    // ---- pools keyed by the game's own objects ----
    var shipG = ship(); scene.add(shipG);
    var pools = { carriers: new Map(), drones: [], powers: new Map(), bullets: [], eb: [] }, bossG = null, bossW = 0;
    for (i = 0; i < 70; i++) { var bs = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.flash, color: new THREE.Color(1.2, 3.5, 4.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); bs.scale.set(0.22, 1.1, 1); bs.visible = false; scene.add(bs); pools.bullets.push(bs); }
    for (i = 0; i < 60; i++) { var es = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.soft, color: new THREE.Color(4, 1.5, 2.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); es.scale.setScalar(0.55); es.visible = false; scene.add(es); pools.eb.push(es); }
    for (i = 0; i < 14; i++) { var dg = drone(); dg.visible = false; scene.add(dg); pools.drones.push(dg); }
    var tmp = new THREE.Vector3();
    S.boom = function (x, y, big, color) { S.toWorld(x, y, tmp); tmp.y = 0.4; fx.explosion(tmp, big ? 0.9 : 0.35); if (color != null) fx.flash(tmp, big ? 4 : 1.6, new THREE.Color(color).multiplyScalar(3)); };
    S.sparks = function (x, y, n) { S.toWorld(x, y, tmp); tmp.y = 0.5; fx.sparks(tmp, n || 6, 4); };
    S.flashAt = function (x, y, scale, color) { S.toWorld(x, y, tmp); tmp.y = 0.5; fx.flash(tmp, scale || 1.5, color); };

    // the game's snapshot, once a frame
    S.sync = function (st) {
      var k = S.k;
      // ship
      S.toWorld(st.ship.x, st.ship.y, shipG.position); shipG.position.y = 0.6 + Math.sin(S.t * 2) * 0.05;
      shipG.rotation.z += ((-(st.ship.vx || 0) * 0.0025) - shipG.rotation.z) * 0.15; shipG.rotation.x = (st.ship.vy || 0) * 0.001;
      shipG.visible = !st.ship.hidden; shipG.userData.flame.scale.set(0.5 + Math.random() * 0.2, 1.2 + Math.random() * 0.5, 1);
      shipG.userData.shield.material.opacity = st.ship.inv > 0 ? 0.18 + Math.sin(S.t * 14) * 0.06 : 0;
      shipG.children[0].material = st.ship.flash > 0 ? flashMat : shipMat;
      // bullets
      var n = 0; st.bullets.forEach(function (b) { if (n >= pools.bullets.length) return; var sp = pools.bullets[n++]; S.toWorld(b.x, b.y, sp.position); sp.position.y = 0.5; sp.visible = true; }); for (; n < pools.bullets.length; n++) pools.bullets[n].visible = false;
      n = 0; st.eb.forEach(function (b) { if (n >= pools.eb.length) return; var sp = pools.eb[n++]; S.toWorld(b.x, b.y, sp.position); sp.position.y = 0.5; sp.visible = true; }); for (; n < pools.eb.length; n++) pools.eb[n].visible = false;
      // drones
      n = 0; st.drones.forEach(function (d) { if (n >= pools.drones.length) return; var g = pools.drones[n++]; S.toWorld(d.x, d.y, g.position); g.position.y = 0.7; g.rotation.y = S.t * 6 + d.seed; g.visible = true; g.children[5].material.opacity = d.flash > 0 ? 1 : 0.7; }); for (; n < pools.drones.length; n++) pools.drones[n].visible = false;
      // carriers: one group per game object, made on first sight and removed when gone
      var seen = new Set();
      st.carriers.forEach(function (c) {
        seen.add(c); var g = pools.carriers.get(c), wm = Math.max(3.2, c.w * k);
        if (!g) { g = carrier(c.label, wm); scene.add(g); pools.carriers.set(c, g); }
        S.toWorld(c.x, c.y, g.position); g.position.y = 0.2 + Math.sin(S.t * 1.3 + c.ph) * 0.12; g.rotation.z = Math.sin(S.t * 0.9 + c.ph) * 0.05;
        var glow = c.reveal > 0; if (g.userData.glow !== glow) { g.userData.glow = glow; g.userData.board.material.map = labelTex(c.label, glow); g.userData.board.material.needsUpdate = true; }
        g.userData.bubble.material.opacity = c.alive && !c.warp && (c.enter < 1 || c.shield > 0) ? 0.12 + (c.bubble > 0 ? 0.3 : 0) + Math.sin(S.t * 8) * 0.04 : 0;
        var on = Math.sin(S.t * 6 + c.ph) > 0; g.userData.lamp0.material.emissiveIntensity = on ? 3 : 0.3; g.userData.lamp2.material.emissiveIntensity = on ? 3 : 0.3;
        g.userData.pips.forEach(function (p, j) { p.visible = j < c.max; p.material.emissiveIntensity = j < c.hp ? 1.5 : 0.05; p.material.color.set(j < c.hp ? 0x8cc8ff : 0x334455); });
        g.children[0].material = c.flash > 0 ? flashMat : carrierMat;
        g.visible = c.alive || !!c.warp; if (c.warp) g.scale.set(1, 1, 1 + c.warp * 2);
      });
      pools.carriers.forEach(function (g, c) { if (!seen.has(c)) { scene.remove(g); pools.carriers.delete(c); } });
      // power-ups
      var seenP = new Set();
      st.powers.forEach(function (p) { seenP.add(p); var g = pools.powers.get(p); if (!g) { g = powerup(p.k, p.color); scene.add(g); pools.powers.set(p, g); } S.toWorld(p.x, p.y, g.position); g.position.y = 0.6; g.userData.core.rotation.y = S.t * 3; g.userData.core.rotation.x = S.t * 1.5; });
      pools.powers.forEach(function (g, p) { if (!seenP.has(p)) { scene.remove(g); pools.powers.delete(p); } });
      // the boss
      if (st.boss) {
        var b = st.boss, bw = b.width * k;
        if (!bossG || Math.abs(bossW - bw) > 0.5) { if (bossG) scene.remove(bossG); bossG = dreadnought(bw); bossW = bw; scene.add(bossG);
          for (var q = 0; q < b.max; q++) { var pl = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 1.2), plateMat); pl.position.set(-(b.max - 1) * 1.4 + q * 2.8, 1.75, -0.2); bossG.add(pl); bossG.userData.plates.push(pl); }
          b.turrets.forEach(function (tu) { var tg = new THREE.Group(), base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.7, 16), turretMat); base.position.y = 0.35; tg.add(base); var gun = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8), turretMat); gun.rotation.x = Math.PI / 2; gun.position.set(0, 0.5, 1.0); tg.add(gun); var face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: St.label(tu.letter, { w: 128, h: 128, size: 92, bg: '#1a2030', ink: '#ffffff', border: false }), transparent: true })); face.rotation.x = -Math.PI / 2 + 0.6; face.position.set(0, 0.85, 0.2); tg.add(face); tg.userData.base = base; tg.userData.face = face; tg.position.set(tu.fx * bw * 0.38, 1.6, 1.9); bossG.add(tg); bossG.userData.turrets.push(tg); }); }
        S.toWorld(b.x, b.y, bossG.position); bossG.position.y = 0.3; bossG.visible = true; bossG.rotation.z = Math.sin(S.t * 0.5) * 0.03;
        bossG.userData.core.scale.setScalar(2.2 + Math.sin(S.t * 5) * 0.3); bossG.userData.core.material.opacity = b.dying ? Math.max(0, 1 - b.dying / 2.4) : 1;
        bossG.userData.plates.forEach(function (pl, q) { pl.material = q < b.plates ? plateMat : plateDark; });
        bossG.userData.turrets.forEach(function (tg, q) { var tu = b.turrets[q]; if (!tu) { tg.visible = false; return; } tg.visible = tu.alive || tu.reveal > 0; tg.userData.base.material = !tu.alive ? turretOk : tu.flash > 0 ? plateMat : turretMat; if (tu.reveal > 0) { tg.userData.base.material = turretOk; tg.userData.face.material.color.set(0x8ff0bd); } else tg.userData.face.material.color.set(0xffffff); });
        if (b.dying) { bossG.position.y = 0.3 - b.dying * 0.6; bossG.rotation.x = b.dying * 0.2; }
        bossG.children[0].material = b.flash > 0 ? plateMat : bossMat;
      } else if (bossG) { scene.remove(bossG); bossG = null; }
      // the warp between sectors
      var w = st.between ? 1 : 0; warp.forEach(function (ws, j) { ws.material.opacity = w * 0.5; if (w) { ws.position.z += 70 * S.dt; if (ws.position.z > 30) ws.position.z = -60; } });
    };

    // the field point under a screen point (nx, ny in -1..1), in the game's pixels
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
    S.toLogical = function (nx, ny) { ndc.set(nx, ny); ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(plane, hit)) return null; return { x: hit.x / S.k + S.W / 2, y: (hit.z - S.zNear) / S.k + S.H }; };
    S.project = function (x, y) { var v = S.toWorld(x, y, new THREE.Vector3()); v.y = 0.6; v.project(camera); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }; };

    // ---- camera: above and behind the field, a narrower lens when the screen is wide ----
    var camBase = new THREE.Vector3(0, 40, 12), camLook = new THREE.Vector3(0, 0, -13);
    S.resize = function (w, h) { if (!St.resize(w, h)) return; S.w = St.w; S.h = St.h; camera.fov = 46; camera.updateProjectionMatrix(); S.framed = false; S.field(S.W, S.H); };
    S.dt = 0.016;
    S.update = function (dt, frozen) { S.t += dt; S.dt = dt; if (!frozen) fx.step(dt); planet.rotation.y += dt * 0.01; camera.position.set(camBase.x + Math.sin(S.t * 0.3) * 0.3, camBase.y, camBase.z); camera.lookAt(camLook); };
    S.render = function () { St.render(S.t); S.tri = St.tri; S.calls = St.calls; };
    S.setQuality = function (q) { St.setQuality(q); };
    S.dispose = function () { St.dispose(); };
    S.resize(opts.width || 520, opts.height || 640);
    return S;
  };
})();
