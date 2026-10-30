/* ARCADE-03c-GL-GUN — GunScene on A.GL.Stage: Fire Mission's gun line. An M777-style howitzer on a plateau fires across
   a valley at trucks parked on the far slope, each under a sign board that carries an answer. The scene owns the
   terrain (an analytic height field, so the shell, the aim marker and the targets all agree with the ground), the gun,
   the shell's flight, the explosions and the wrecks; the game owns the questions, the rounds and the scoring. */
(function () {
  'use strict';
  var A = window.ARCADE; if (!A || !A.GL) return;
  var GL = A.GL, THREE = window.THREE, hash = GL.hash, clamp = GL.clamp, fbm = GL.fbm;

  GL.GunScene = function (opts) {
    opts = opts || {};
    var reduce = opts.reduce || function () { return false; };
    var St = GL.Stage({ mobile: opts.mobile, reduce: reduce, fov: 50, far: 1200, shadow: { l: -45, r: 45, t: 60, b: -30, far: 320 }, light: 'day' });
    St.post.u.exposure.value = 0.92;
    var K = GL.kit(St), scene = St.scene, camera = St.camera, X = St.X, std = St.std, fx = K.fx, mobile = St.mobile, i;
    St.sun.target.position.set(0, 0, -30); St.push();
    var S = { t: 0, w: 4, h: 4, tri: 0, calls: 0, gl2: St.gl2, hdr: St.hdr, canvas: St.canvas, camera: camera, scene: scene, light: 'day', recoil: 0, flashT: 0, aimOn: false, wind: 0, targets: [], shell: null, trauma: 0, punch: 0 };   // flashT starts at 0: a NaN light intensity would black out the whole frame
    var G = 22;   // a heavier gravity than Earth's keeps the arc tall and the flight short

    // ---- terrain: an analytic height field with the same noise the mesh was built from ----
    var hf = fbm(128, 11, 5, 0.55);
    function noise(x, z) { var u = (((x + 640) / 80) % 1) * 127, v = (((z + 640) / 80) % 1) * 127, x0 = Math.floor(u), y0 = Math.floor(v), tx = u - x0, ty = v - y0, x1 = (x0 + 1) % 128, y1 = (y0 + 1) % 128; return (hf[y0 * 128 + x0] * (1 - tx) + hf[y0 * 128 + x1] * tx) * (1 - ty) + (hf[y1 * 128 + x0] * (1 - tx) + hf[y1 * 128 + x1] * tx) * ty; }
    function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
    function hAt(x, z) {
      var base = z > -8 ? 0 : z > -20 ? -1.2 * smooth((-8 - z) / 12) : -1.2 + Math.pow((-20 - z) / 30, 1.15) * 11;
      var n = (noise(x, z) - 0.5) * (z > -8 ? 0.25 : 2.2 + Math.max(0, -20 - z) * 0.07);
      var sides = Math.pow(Math.abs(x) / 70, 2) * 12 * (z < -10 ? 1 : 0.15);
      return base + n * smooth((-4 - z) / 6) + sides;
    }
    S.hAt = hAt;
    var terrGeo = new THREE.PlaneGeometry(360, 360, 150, 150); terrGeo.rotateX(-Math.PI / 2); terrGeo.translate(0, 0, -140);
    (function () { var pos = terrGeo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
      for (var k = 0; k < pos.count; k++) { var x = pos.getX(k), z = pos.getZ(k), y = hAt(x, z); pos.setY(k, y); var g = clamp((y - 1) / 10, 0, 1), rock = clamp((y - 14) / 12, 0, 1), flat = z > -9 ? 0.4 : 0; c.setRGB(0.50, 0.42, 0.28).lerp(new THREE.Color(0.24, 0.38, 0.18), g * 0.9).lerp(new THREE.Color(0.42, 0.40, 0.37), rock).lerp(new THREE.Color(0.52, 0.46, 0.34), flat); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
      terrGeo.computeVertexNormals(); terrGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); })();
    var terrN = K.tex(X.dirtN, 36, 36), terrain = new THREE.Mesh(terrGeo, std({ vertexColors: true, roughness: 0.96, normalMap: terrN })); terrain.receiveShadow = true; scene.add(terrain);
    K.hills(scene, { len: 1400, depth: 300, segs: 180, xc: 0, zc: -420, amp: 70, seed: 13, near: -290, far: -380 });
    var pad = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24), std({ map: K.tex(X.dirt, 3, 3), normalMap: K.tex(X.dirtN, 3, 3), roughness: 0.98 })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; pad.receiveShadow = true; scene.add(pad);
    K.sandbags(scene, 0, 0, 14, 4.9);
    for (i = 0; i < 3; i++) { var cr = K.crate({ label: 'HE', color: '#4f5a3c' }, 0.8); cr.position.set(3.3 + (i % 2) * 0.9, 0.4 + Math.floor(i / 2) * 0.8, 2.2 + (i % 2) * 0.1); cr.rotation.y = 0.2 * i; scene.add(cr); }
    for (i = 0; i < 26; i++) { var tr = K.tree(i), tx = (hash(i, 67) - 0.5) * 140, tz = -48 - hash(i, 71) * 110; if (Math.abs(tx) < 14 && tz > -75) tx += 20; tr.position.set(tx, hAt(tx, tz) - 0.3, tz); scene.add(tr); }
    for (i = 0; i < 20; i++) { var rk = K.rock(i), rx = (hash(i, 45) - 0.5) * 120, rz = -14 - hash(i, 47) * 100; rk.position.set(rx, hAt(rx, rz) + rk.position.y, rz); scene.add(rk); }
    for (i = 0; i < 16; i++) { var bs = K.bush(i), bx = (hash(i, 55) - 0.5) * 60, bz = -9 - hash(i, 57) * 40; bs.position.set(bx, hAt(bx, bz) + bs.position.y, bz); scene.add(bs); }

    // ---- the gun: an M777-style howitzer at the origin, firing toward -z ----
    var gun = new THREE.Group(); scene.add(gun);
    [-1, 1].forEach(function (s) { var trail = K.box(gun, 0.24, 0.2, 4.4, s * 1.25, 0.28, 2.3, K.mat.olive); trail.rotation.y = -s * 0.3; var spade = K.box(gun, 0.5, 0.35, 0.25, s * 1.95, 0.2, 4.35, K.mat.steel); spade.rotation.y = -s * 0.3; });
    K.box(gun, 2.2, 0.34, 0.9, 0, 0.45, 0.2, K.mat.olive); K.box(gun, 0.7, 0.55, 1.6, 0, 0.85, 0.1, K.mat.olive);
    [-1, 1].forEach(function (s) { var geo = new THREE.CylinderGeometry(0.58, 0.58, 0.3, 18); geo.rotateZ(Math.PI / 2); var w = new THREE.Mesh(geo, K.mat.tire); w.position.set(s * 1.1, 0.58, 0.35); w.castShadow = true; gun.add(w); var hg = new THREE.CylinderGeometry(0.3, 0.3, 0.32, 12); hg.rotateZ(Math.PI / 2); w.add(new THREE.Mesh(hg, K.mat.hub)); });
    var elev = new THREE.Group(); elev.position.set(0, 1.12, 0.1); gun.add(elev);
    var barrel = new THREE.Group(); elev.add(barrel);
    K.tube(barrel, 0.09, 4.6, 0, 0, -2.2, K.mat.steel, 'z', 0.11); K.box(barrel, 0.3, 0.3, 0.55, 0, 0, -4.45, K.mat.dark); K.box(barrel, 0.34, 0.1, 0.35, 0, 0, -4.4, K.mat.steel);
    K.box(barrel, 0.42, 0.44, 0.7, 0, 0.02, 0.5, K.mat.dark); K.box(barrel, 0.12, 0.12, 0.3, 0.3, 0.08, 0.55, K.mat.steel);
    [-1, 1].forEach(function (s) { K.tube(elev, 0.05, 1.5, s * 0.16, 0.24, -0.4, K.mat.steel, 'z'); });
    K.box(elev, 0.9, 0.12, 0.5, 0, -0.1, 0.1, K.mat.olive);
    var muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -4.75); barrel.add(muzzle);
    var flashLight = new THREE.PointLight(0xffd090, 0, 30, 2); flashLight.position.set(0, 1.6, -5.2); scene.add(flashLight);
    var muzzleW = new THREE.Vector3();
    S.angle = 0.34;
    function muzzleWorld() { muzzle.getWorldPosition(muzzleW); return muzzleW; }

    // ---- targets: trucks under sign boards on the far slope ----
    var boardGeo = new THREE.BoxGeometry(6, 2.5, 0.12), hitGeo = new THREE.BoxGeometry(7, 7, 5), hitMat = new THREE.MeshBasicMaterial({ visible: false });
    function boardTexture(tg) {
      var c = document.createElement('canvas'); c.width = 768; c.height = 320; var g = c.getContext('2d');
      g.fillStyle = tg.mark === 'no' ? '#5a2a2a' : tg.mark === 'ok' ? '#d8f7e6' : '#f4ead2'; g.fillRect(0, 0, 768, 320); g.strokeStyle = tg.mark === 'ok' ? '#3fbf8a' : '#2a2420'; g.lineWidth = 16; g.strokeRect(0, 0, 768, 320);
      g.fillStyle = tg.mark === 'ok' ? '#3fbf8a' : tg.mark === 'no' ? '#ff5c5c' : '#e6b85a'; g.beginPath(); g.arc(80, 80, 52, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b1407'; g.font = A.font(66, 'display', 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tg.letter, 80, 84);
      g.fillStyle = tg.mark === 'no' ? '#ffb3b3' : '#1c1a16'; var sizes = [96, 80, 66, 54, 46], fs = 96, lines = [tg.text];
      for (var s = 0; s < sizes.length; s++) { fs = sizes[s]; g.font = A.font(fs, 'mono', 800); lines = A.wrap(g, tg.text, 600); if (lines.length <= (fs <= 54 ? 3 : 2)) break; }
      var y0 = 176 - (lines.length - 1) * fs * 0.6; lines.forEach(function (ln, k) { g.fillText(ln, 410, y0 + k * fs * 1.2); });
      if (tg.mark === 'ok') { g.fillStyle = '#1f7f50'; g.font = A.font(90, 'display', 900); g.fillText('✓', 700, 70); }
      var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
    }
    S.setTargets = function (list) {
      S.targets.forEach(function (tg) { scene.remove(tg.g); if (tg.board.material.map) tg.board.material.map.dispose(); tg.board.material.dispose(); });
      S.targets = list.map(function (o, k) {
        var g = new THREE.Group(), y = hAt(o.x, o.z); g.position.set(o.x, y, o.z);
        var truck = K.truck(null, { mat: k % 2 ? K.mat.green : K.mat.tan, canvas: k % 3 === 0 }); truck.scale.setScalar(0.9); truck.rotation.y = (hash(k, 7) - 0.5) * 0.8 + (o.x > 0 ? 0.3 : -0.3); g.add(truck);
        var tg = { letter: o.letter, text: o.text, data: o.data, x: o.x, z: o.z, y: y, g: g, truck: truck, alive: true, wreck: 0, mark: '', reveal: 0, smokeT: 0 };
        var post = K.box(g, 0.16, 3.4, 0.16, 0, 1.7, 1.4, K.mat.wood), post2 = K.box(g, 0.16, 3.4, 0.16, -2.6, 1.7, 1.4, K.mat.wood), post3 = K.box(g, 0.16, 3.4, 0.16, 2.6, 1.7, 1.4, K.mat.wood);
        var board = new THREE.Mesh(boardGeo, std({ map: boardTexture(tg), roughness: 0.75 })); board.position.set(0, 4.55, 1.4); board.castShadow = true; g.add(board);
        var hit = new THREE.Mesh(hitGeo, hitMat); hit.position.set(0, 3, 0.6); hit.userData.target = tg; g.add(hit);
        tg.board = board; tg.hit = hit; tg.posts = [post, post2, post3]; scene.add(g); return tg;
      });
      return S.targets;
    };
    S.mark = function (tg, mark) { tg.mark = mark; if (tg.board.material.map) tg.board.material.map.dispose(); tg.board.material.map = boardTexture(tg); tg.board.material.emissive = new THREE.Color(mark === 'ok' ? 0x1f7f50 : 0x000000); tg.board.material.emissiveIntensity = 0.4; tg.board.material.needsUpdate = true; if (mark === 'ok') tg.reveal = 3; };
    S.wreck = function (tg) {
      if (!tg.alive) return; tg.alive = false; tg.wreck = 0.001;
      tg.truck.traverse(function (o) { if (o.isMesh && o.material !== K.mat.tire) o.material = K.mat.wreck; });
      tg.truck.rotation.z = (hash(tg.x, 3) - 0.5) * 0.5; tg.truck.rotation.x = 0.12; tg.truck.position.y = 0.15;
      var p = new THREE.Vector3(tg.x, tg.y + 1.5, tg.z); fx.fire(p, 4); fx.fire(new THREE.Vector3(tg.x + 1.2, tg.y + 1.6, tg.z - 0.4), 3.2);
    };
    S.targetPoint = function (tg) { return new THREE.Vector3(tg.x, tg.y + 1.2, tg.z); };
    S.project = function (v) { var p = v.clone().project(camera); return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 }; };

    // ---- aiming: the marker on the ground and the preview arc ----
    var aim = new THREE.Vector3(0, 0, -36), aimG = new THREE.Group(); scene.add(aimG);
    var ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; aimG.add(ring);
    var dot = new THREE.Mesh(new THREE.CircleGeometry(0.25, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })); dot.rotation.x = -Math.PI / 2; dot.position.y = 0.02; aimG.add(dot);
    var arcN = 26, arcGeo = new THREE.BufferGeometry(), arcPos = new Float32Array(arcN * 3); arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3));
    var arc = new THREE.Points(arcGeo, new THREE.PointsMaterial({ color: new THREE.Color(2, 2, 2), size: 0.35, sizeAttenuation: true, map: X.soft, transparent: true, depthWrite: false, opacity: 0.8 })); arc.frustumCulled = false; scene.add(arc); arc.visible = false;
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    // what lies under a screen point (nx, ny in -1..1): a target, or the ground
    S.pick = function (nx, ny) {
      ndc.set(nx, ny); ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(S.targets.filter(function (t) { return t.alive; }).map(function (t) { return t.hit; }), false);
      if (hits.length) { var tg = hits[0].object.userData.target; return { target: tg, point: new THREE.Vector3(tg.x, tg.y, tg.z) }; }
      var th = ray.intersectObject(terrain, false); if (th.length) return { target: null, point: th[0].point };
      return { target: null, point: ray.ray.at(60, new THREE.Vector3()) };
    };
    S.setAim = function (p) { aim.copy(p); aim.y = hAt(p.x, p.z); aim.z = Math.min(aim.z, -9); S.aimOn = true; };
    S.aimPoint = function () { return aim.clone(); };
    // the launch that lands at `to` in still air after T seconds
    function launch(to) { var from = muzzleWorld().clone(), d = from.distanceTo(to), T = 1.15 + d / 70, v = to.clone().sub(from).multiplyScalar(1 / T); v.y += 0.5 * G * T; return { from: from, v: v, T: T }; }
    S.showArc = function (frac) {
      if (!S.aimOn || frac <= 0) { arc.visible = false; return; }
      var L = launch(aim), n = Math.max(3, Math.round(arcN * frac)), p = L.from.clone(), v = L.v.clone(), h = L.T / (arcN - 1);
      for (var k = 0; k < arcN; k++) { var vis = k < n; arcPos[k * 3] = vis ? p.x : 0; arcPos[k * 3 + 1] = vis ? p.y : -200; arcPos[k * 3 + 2] = vis ? p.z : 0; v.y -= G * h; p.addScaledVector(v, h); }
      arcGeo.attributes.position.needsUpdate = true; arc.visible = true;
    };
    S.hideAim = function () { S.aimOn = false; arc.visible = false; };

    // ---- the shot ----
    var shellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), std({ color: 0x3a3a3a, emissive: 0xff8030, emissiveIntensity: 1.2, roughness: 0.5 })); shellMesh.visible = false; scene.add(shellMesh);
    var shellGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.flash, color: new THREE.Color(3, 2, 1), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); shellGlow.scale.setScalar(0.9); scene.add(shellGlow);
    S.fire = function () {
      if (S.shell) return null;
      var L = launch(aim); S.shell = { p: L.from.clone(), v: L.v, t: 0, puff: 0 };
      S.recoil = 1; S.flashT = 1; S.trauma = Math.min(1, S.trauma + 0.55); S.punch = 1; St.aberr = reduce() ? 0 : 0.008; St.white = reduce() ? 0 : 0.1;
      var m = muzzleWorld(); fx.flash(m, 6, new THREE.Color(9, 6, 2.5)); fx.flash(new THREE.Vector3(m.x, m.y, m.z - 2), 4, new THREE.Color(6, 3, 1)); fx.light(new THREE.Vector3(m.x, m.y - 1, m.z - 1), 150, 0.3);
      fx.smoke(new THREE.Vector3(m.x, m.y, m.z - 1), 5, 3, { x: 0, z: -2 }); fx.dust(new THREE.Vector3(0, 0, -3.5), 8, true);
      shellMesh.visible = true; return S.shell;
    };
    // step the shell; returns 'flying' | {hit: target|null, point} when it lands
    function stepShell(dt) {
      var sh = S.shell, steps = 4, h = dt / steps;
      for (var k = 0; k < steps; k++) {
        sh.v.y -= G * h; sh.v.x += S.wind * 2.4 * h; sh.p.addScaledVector(sh.v, h); sh.t += h;
        for (var n = 0; n < S.targets.length; n++) { var tg = S.targets[n]; if (!tg.alive) continue; var dx = sh.p.x - tg.x, dy = sh.p.y - (tg.y + 2.2), dz = sh.p.z - tg.z; if (dx * dx + dy * dy * 0.35 + dz * dz < 3.4 * 3.4) return { hit: tg, point: new THREE.Vector3(tg.x, tg.y + 0.3, tg.z), direct: true }; }
        var gy = hAt(sh.p.x, sh.p.z); if (sh.p.y <= gy) return { hit: null, point: new THREE.Vector3(sh.p.x, gy, sh.p.z), direct: false };
        if (sh.p.z < -300 || Math.abs(sh.p.x) > 200) return { hit: null, point: sh.p.clone(), lost: true };
      }
      sh.puff += dt; if (sh.puff > 0.05) { sh.puff = 0; fx.smoke(sh.p, 1, 0.9); }
      return 'flying';
    }
    S.impact = function (p, big) { S.shell = null; shellMesh.visible = false; shellGlow.material.opacity = 0; fx.explosion(p, big ? 1.4 : 1); fx.scorch(p, big ? 3.2 : 2.4); S.trauma = Math.min(1, S.trauma + (big ? 0.8 : 0.5)); if (!reduce()) { St.white = 0.12; St.aberr = 0.008; } };

    // ---- camera and update ----
    var camBase = new THREE.Vector3(2.6, 2.5, 5.4), camLook = new THREE.Vector3(0, 2.4, -36), portrait = false, baseFov = 50;
    S.resize = function (w, h) { if (!St.resize(w, h)) return; S.w = St.w; S.h = St.h; portrait = S.w / S.h < 1.2; baseFov = portrait ? 64 : 50; camera.fov = baseFov; camera.updateProjectionMatrix(); camBase.set(portrait ? 1.6 : 2.6, portrait ? 2.8 : 2.5, portrait ? 4.2 : 5.4); camLook.set(0, portrait ? 3.4 : 2.4, -36); };
    S.setLight = function (name) { St.setLight(name, name); St.refreshEnv(); S.light = name; };
    S.update = function (dt, frozen) {
      S.t += dt; var res = 'flying';
      if (!frozen) {
        if (S.shell) { res = stepShell(dt); if (res === 'flying') { shellMesh.position.copy(S.shell.p); shellGlow.position.copy(S.shell.p); shellGlow.material.opacity = 0.9; } }
        S.targets.forEach(function (tg) {
          if (tg.wreck) { tg.wreck += dt; tg.smokeT += dt; if (tg.wreck < 6 && tg.smokeT > 0.35) { tg.smokeT = 0; fx.smoke(new THREE.Vector3(tg.x, tg.y + 1.8, tg.z), 1, 2.2, { x: 0.3, z: 0.2 }); if (tg.wreck < 3.5 && Math.random() < 0.6) fx.fire(new THREE.Vector3(tg.x + (Math.random() - 0.5) * 2, tg.y + 1.4, tg.z), 0.9); } if (tg.wreck < 1.2) { tg.board.rotation.x = Math.min(1.3, tg.board.rotation.x + dt * 2.2); tg.board.position.y = Math.max(2.2, tg.board.position.y - dt * 2); } }
          if (tg.reveal > 0) { tg.reveal -= dt; tg.board.material.emissiveIntensity = 0.3 + Math.sin(S.t * 9) * 0.25; }
        });
        fx.step(dt);
      }
      S.recoil = Math.max(0, S.recoil - dt / 0.9); S.flashT = Math.max(0, S.flashT - dt / 0.1); S.trauma = Math.max(0, S.trauma - dt * 1.6); S.punch = Math.max(0, S.punch - dt * 2.5); St.aberr = Math.max(0, St.aberr - dt * 0.05); St.white = Math.max(0, St.white - dt * 0.7);
      var r = S.recoil < 0.15 ? S.recoil / 0.15 : 1 - (S.recoil - 0.15) / 0.85;
      barrel.position.z = r * 0.75; elev.rotation.x += (S.angle - elev.rotation.x) * Math.min(1, dt * 4);
      flashLight.intensity = S.flashT * 40;
      aimG.visible = S.aimOn && !S.shell; if (S.aimOn) { aimG.position.set(aim.x, aim.y + 0.05, aim.z); ring.scale.setScalar(1 + Math.sin(S.t * 5) * 0.08); }
      var sh = reduce() ? 0 : S.trauma * S.trauma;
      camera.position.set(camBase.x + Math.sin(S.t * 0.6) * 0.04 + (Math.random() - 0.5) * sh * 0.5, camBase.y + Math.sin(S.t * 0.9) * 0.03 + (Math.random() - 0.5) * sh * 0.4, camBase.z + (Math.random() - 0.5) * sh * 0.3);
      camera.lookAt(camLook.x + Math.sin(S.t * 0.4) * 0.3, camLook.y, camLook.z);
      var fov = baseFov - S.punch * 3; if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      return res;
    };
    S.render = function () { St.render(S.t); S.tri = St.tri; S.calls = St.calls; };
    S.setQuality = function (q) { St.setQuality(q); };
    S.dispose = function () { St.dispose(); };
    S.resize(opts.width || 640, opts.height || 400);
    return S;
  };
})();
