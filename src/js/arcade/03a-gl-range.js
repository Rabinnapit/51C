/* ARCADE-03a-GL-RANGE — RangeScene on A.GL.Stage: the desert qualification range with target boards, the M4A1, muzzle
   flash, smoke, brass, splinters, sparks, dust and bullet holes. Range Day owns the clock, the questions and the HUD. */
(function () {
  'use strict';
  var A = window.ARCADE; if (!A || !A.GL) return;
  var GL = A.GL, THREE = window.THREE, hash = GL.hash, clamp = GL.clamp, fbm = GL.fbm, normalFrom = GL.normalFrom;
  // ---- the range ----
  GL.RangeScene = function (opts) {
    opts = opts || {};
    var reduce = opts.reduce || function () { return false; };
    var St = GL.Stage({ mobile: opts.mobile, fov: 58, far: 700, shadow: { l: -30, r: 30, t: 30, b: -30, far: 220 }, light: 'day' });
    var scene = St.scene, camera = St.camera, X = St.X, std = St.std, mobile = St.mobile, sun = St.sun;
    sun.target.position.set(0, 0, -12); St.push();
    var S = { t: 0, boards: [], recoil: 0, flashT: 0, aberr: 0, white: 0, yaw: 0, pitch: 0, w: 4, h: 4, tri: 0, calls: 0, quality: 2 };
    var sandMat = std({ map: X.sand, normalMap: X.sandN, roughness: 0.95 }), dirtMat = std({ map: X.dirt, normalMap: X.dirtN, roughness: 0.98 }), woodMat = std({ map: X.wood, normalMap: X.woodN, roughness: 0.8 });
    var steelMat = std({ map: X.metal, roughnessMap: X.metalR, normalMap: X.metalN, metalness: 0.9, roughness: 0.5, color: 0x8a8f96 }), rockMat = std({ map: X.rock, roughness: 0.92 });
    var fineN = normalFrom(256, X.fineH, 0.8); fineN.repeat.set(4, 4); var concMat = std({ color: 0x9a9890, roughness: 0.9, normalMap: fineN });
    var bagTex = X.dirt.clone(); bagTex.repeat.set(2, 1); bagTex.needsUpdate = true; var bagMat = std({ map: bagTex, roughness: 0.95, color: 0xc9b58a });

    // ground, firing line, terrain, berm, rocks, trees, tower, signs, flag, clouds
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), sandMat); ground.rotation.x = -Math.PI / 2; ground.position.z = -80; ground.receiveShadow = true; scene.add(ground);
    var lineMat = std({ color: 0xf2efe4, roughness: 0.9 }); [-3.9, -1.3, 1.3, 3.9].forEach(function (x) { var l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.01, 26), lineMat); l.position.set(x, 0.006, -13); l.receiveShadow = true; scene.add(l); });
    var pad = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 2.4), concMat); pad.position.set(0.6, -0.04, -0.9); pad.receiveShadow = true; scene.add(pad);
    for (var i = 0; i < 9; i++) { var row = i < 5 ? 0 : 1, k = row ? i - 5 : i, bg = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 10), bagMat); bg.rotation.z = Math.PI / 2; bg.rotation.y = (hash(i, 21) - 0.5) * 0.4; bg.position.set(-3.9 + k * 0.72 + row * 0.36, 0.2 + row * 0.36, -2.6 + (hash(i, 23) - 0.5) * 0.1); bg.castShadow = bg.receiveShadow = true; scene.add(bg); }
    var terrGeo = new THREE.PlaneGeometry(700, 460, 110, 72); terrGeo.rotateX(-Math.PI / 2); terrGeo.translate(0, 0, -250);
    (function () { var pos = terrGeo.attributes.position, hf = fbm(128, 5, 5, 0.55), col = new Float32Array(pos.count * 3), c = new THREE.Color();
      for (var i = 0; i < pos.count; i++) { var x = pos.getX(i), z = pos.getZ(i), u = Math.floor((x + 350) / 700 * 127), v = Math.floor((z + 480) / 460 * 127), hgt = hf[v * 128 + u], dist = -z - 28, kk = clamp(dist / 50, 0, 1), y = Math.pow(hgt, 1.7) * 75 * kk - 0.6;
        pos.setY(i, y); var g = clamp((y - 6) / 30, 0, 1), rock = clamp((y - 30) / 30, 0, 1); c.setRGB(0.72, 0.62, 0.42).lerp(new THREE.Color(0.33, 0.45, 0.24), g).lerp(new THREE.Color(0.5, 0.47, 0.44), rock); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      terrGeo.computeVertexNormals(); terrGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); })();
    var terrN = X.dirtN.clone(); terrN.repeat.set(70, 46); terrN.needsUpdate = true; var terrain = new THREE.Mesh(terrGeo, std({ vertexColors: true, roughness: 0.96, normalMap: terrN })); terrain.receiveShadow = true; scene.add(terrain);
    function jitter(geo, ax, ay, az, seed) { var p = geo.attributes.position; for (var i = 0; i < p.count; i++) { var key = Math.round(p.getX(i) * 97) * 3 + Math.round(p.getY(i) * 89) * 7 + Math.round(p.getZ(i) * 83) * 11, j = hash(key, seed) - 0.5; p.setXYZ(i, p.getX(i) * (1 + j * ax), p.getY(i) * (1 + j * ay), p.getZ(i) * (1 + j * az)); } geo.computeVertexNormals(); }
    var berm = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 18), dirtMat); jitter(berm.geometry, 0.05, 0.12, 0.08, 31); berm.scale.set(36, 3.4, 6.5); berm.position.set(0, -0.7, -27); berm.receiveShadow = berm.castShadow = true; scene.add(berm);
    for (i = 0; i < 26; i++) { var rg = new THREE.IcosahedronGeometry(1, 1); jitter(rg, 0.5, 0.6, 0.5, 100 + i); var rk = new THREE.Mesh(rg, rockMat), sc = 0.4 + hash(i, 41) * 1.6, side = hash(i, 43) > 0.5 ? 1 : -1; rk.scale.setScalar(sc); rk.position.set(side * (7 + hash(i, 45) * 40), sc * 0.4 - 0.2, -14 - hash(i, 47) * 100); rk.rotation.y = hash(i, 49) * 6; rk.castShadow = rk.receiveShadow = true; scene.add(rk); }
    var trunkMat = std({ map: X.wood, roughness: 0.9, color: 0x8a6a48 }), leafMat = std({ color: 0x2f5a2a, roughness: 0.9 });
    for (i = 0; i < 18; i++) { var tr = new THREE.Group(), th = 5 + hash(i, 61) * 4, trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, th, 8), trunkMat); trunk.position.y = th / 2; trunk.castShadow = true; tr.add(trunk);
      for (var j = 0; j < 3; j++) { var fg = new THREE.IcosahedronGeometry(1, 1); jitter(fg, 0.35, 0.35, 0.35, 200 + i * 3 + j); var fol = new THREE.Mesh(fg, leafMat), fs = 2.2 + hash(i + j, 63) * 2; fol.scale.setScalar(fs); fol.position.set((hash(i, j + 70) - 0.5) * 2.2, th - 1 + j * 1.6, (hash(i, j + 80) - 0.5) * 2.2); fol.castShadow = true; tr.add(fol); }
      tr.position.set((hash(i, 67) > 0.5 ? 1 : -1) * (16 + hash(i, 69) * 70), -0.2, -45 - hash(i, 71) * 110); scene.add(tr); }
    var tower = new THREE.Group(); [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(function (p) { var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 6, 8), steelMat); leg.position.set(p[0], 3, p[1]); leg.castShadow = true; tower.add(leg); });
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 3.4), std({ color: 0x5c6b4a, roughness: 0.85 })); cabin.position.y = 7.2; cabin.castShadow = true; tower.add(cabin);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 4), std({ color: 0x3a3f36, roughness: 0.8 })); roof.position.y = 8.5; tower.add(roof);
    var win = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.9, 3.45), std({ color: 0x1b2a3a, metalness: 0.6, roughness: 0.15 })); win.position.y = 7.4; tower.add(win); tower.position.set(-15, 0, -40); scene.add(tower);
    function signTexture(txt) { var c = document.createElement('canvas'); c.width = 128; c.height = 64; var g = c.getContext('2d'); g.fillStyle = '#f4ead6'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#1c1a16'; g.lineWidth = 6; g.strokeRect(0, 0, 128, 64); g.fillStyle = '#1c1a16'; g.font = A.font(40, 'display', 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 64, 34); var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
    // distance signs sit left of each row's outer lane (the lanes widen with distance; see range-day.js LANES)
    [[-5.5, '25', -4.4], [-8.5, '50', -5.8], [-12, '75', -8.2]].forEach(function (s) { var p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), woodMat); p.position.set(s[2], 0.5, s[0]); p.castShadow = true; scene.add(p); var b = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), std({ map: signTexture(s[1] + ' m'), roughness: 0.7 })); b.position.set(s[2], 1.1, s[0] + 0.04); scene.add(b); });
    var flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.8, 8), steelMat); flagPole.position.set(7.2, 1.4, -12); flagPole.castShadow = true; scene.add(flagPole);
    var flagGeo = new THREE.PlaneGeometry(1.1, 0.5, 8, 2), flag = new THREE.Mesh(flagGeo, std({ color: 0xe6b85a, roughness: 0.8, side: THREE.DoubleSide })); flag.position.set(7.2 + 0.56, 2.5, -12); flag.castShadow = true; scene.add(flag); var flagBase = flagGeo.attributes.position.array.slice();
    var clouds = new THREE.Group();
    for (i = 0; i < 7; i++) { var cg = new THREE.Group(), cs = 9 + hash(i, 11) * 9; [[0, 0, 1], [1.1, 0.12, 0.8], [-1.1, 0.08, 0.75], [0.3, 0.5, 0.65], [-0.4, 0.45, 0.6]].forEach(function (q) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.cloud, transparent: true, depthWrite: false, opacity: 0.92 })); sp.position.set(q[0] * cs, q[1] * cs, 0); sp.scale.setScalar(q[2] * cs * 1.6); cg.add(sp); }); cg.position.set(-180 + i * 62 + hash(i, 13) * 30, 45 + hash(i, 17) * 25, -260 - hash(i, 19) * 120); clouds.add(cg); } scene.add(clouds);
    var moteGeo = new THREE.BufferGeometry(), motePos = new Float32Array(90 * 3); for (i = 0; i < 90; i++) { motePos[i * 3] = (Math.random() - 0.5) * 8; motePos[i * 3 + 1] = Math.random() * 3; motePos[i * 3 + 2] = -Math.random() * 10; } moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    scene.add(new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: new THREE.Color(1.6, 1.4, 1.0), size: 0.02, sizeAttenuation: true, transparent: true, opacity: 0.6, depthWrite: false })));

    // targets: plywood boards with a paper face on steel legs
    var boardGeo = new THREE.BoxGeometry(2.2, 1.35, 0.05), hitGeo = new THREE.BoxGeometry(2.6, 1.8, 0.5), hitMat = new THREE.MeshBasicMaterial({ visible: false });
    var plyMat = std({ map: X.wood, normalMap: X.woodN, roughness: 0.75, color: 0xd9c3a0 });
    function faceTexture(b) {
      var c = document.createElement('canvas'); c.width = 512; c.height = 320; var g = c.getContext('2d');
      g.drawImage(X.paper.image, 0, 0, 128, 128, 0, 0, 512, 320); g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 300, 512, 20);
      g.fillStyle = b.mark === 'ok' ? '#3fbf8a' : b.mark === 'no' ? '#ff5c5c' : '#e6b85a'; g.beginPath(); g.arc(60, 60, 44, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b1407'; g.font = A.font(56, 'display', 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.letter, 60, 64);
      g.strokeStyle = '#2a2420'; g.lineWidth = 5; g.globalAlpha = 0.5; g.beginPath(); g.arc(452, 60, 34, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(452, 60, 12, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = '#1c1a16'; var sizes = [66, 56, 48, 40, 34], fs = 66, lines = [b.text];
      for (var s = 0; s < sizes.length; s++) { fs = sizes[s]; g.font = A.font(fs, 'body', 700); lines = A.wrap(g, b.text, 440); if (lines.length <= (fs <= 48 ? 4 : 3)) break; }
      var y0 = 200 - (lines.length - 1) * fs * 0.6; lines.forEach(function (ln, i) { g.fillText(ln, 256, y0 + i * fs * 1.2); });
      if (b.mark === 'no') { g.strokeStyle = 'rgba(255,60,60,.85)'; g.lineWidth = 14; g.beginPath(); g.moveTo(40, 40); g.lineTo(472, 280); g.moveTo(472, 40); g.lineTo(40, 280); g.stroke(); }
      var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
    }
    var holeMat = new THREE.MeshBasicMaterial({ color: 0x0a0806, polygonOffset: true, polygonOffsetFactor: -2 }), ringMat = new THREE.MeshBasicMaterial({ color: 0xe8e0d0, transparent: true, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -1 });
    S.setBoards = function (list) {
      S.boards.forEach(function (b) { scene.remove(b.g); if (b.face.material.map) b.face.material.map.dispose(); b.face.material.dispose(); });
      S.boards = list.map(function (b) {
        var g = new THREE.Group(); g.position.set(b.x, 0, b.z);
        [-0.85, 0.85].forEach(function (x) { var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.05, 8), steelMat); leg.position.set(x, 0.52, 0); leg.castShadow = true; g.add(leg); });
        var bar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.05), steelMat); bar.position.set(0, 1.0, 0); bar.castShadow = true; g.add(bar);
        var box = new THREE.Mesh(boardGeo, plyMat); box.position.set(0, 1.675, 0); box.castShadow = box.receiveShadow = true; g.add(box);
        var face = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.27), std({ map: faceTexture(b), roughness: 0.85 })); face.position.set(0, 1.675, 0.03); face.receiveShadow = true; g.add(face);
        var hit = new THREE.Mesh(hitGeo, hitMat); hit.position.set(0, 1.675, 0); g.add(hit);
        g.rotation.x = -Math.PI / 2; scene.add(g);
        var o = { x: b.x, z: b.z, letter: b.letter, text: b.text, data: b.data, g: g, box: box, face: face, hit: hit, pop: 0, delay: b.delay || 0, fall: -1, fallDelay: 0, mark: '' };
        hit.userData.board = o; return o;
      });
      return S.boards;
    };
    S.mark = function (b, mark) { b.mark = mark; if (b.face.material.map) b.face.material.map.dispose(); b.face.material.map = faceTexture(b); b.face.material.emissive = new THREE.Color(mark === 'ok' ? 0x1f7f50 : mark === 'no' ? 0x7f1f1f : 0x000000); b.face.material.emissiveIntensity = 0.35; b.face.material.needsUpdate = true; };
    S.fall = function (b, delay) { if (b.fall < 0) { b.fall = 0; b.fallDelay = delay || 0; } };
    S.bulletHole = function (b, point) { var local = b.g.worldToLocal(point.clone()); var h = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), holeMat); h.position.set(local.x, local.y, 0.062); b.g.add(h); var r = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.07, 12), ringMat); r.position.set(local.x, local.y, 0.061); b.g.add(r); };

    // the rifle under the camera: an M4A1 carbine
    var rifle = new THREE.Group(); camera.add(rifle); scene.add(camera);
    var gunMat = std({ color: 0x1c1f22, roughness: 0.6, metalness: 0.08, normalMap: X.metalN }), gun2Mat = std({ color: 0xa98e62, roughness: 0.85, normalMap: X.metalN }), gun3Mat = std({ map: X.metal, roughnessMap: X.metalR, normalMap: X.metalN, metalness: 0.88, roughness: 0.45, color: 0xb9bec4 }), lensMat = std({ color: 0x0b1a33, metalness: 1, roughness: 0.08 });
    function box(w, h, d, x, y, z, m, rx) { var p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || gunMat); p.position.set(x, y, z); if (rx) p.rotation.x = rx; rifle.add(p); return p; }
    function tube(r, len, x, y, z, m) { var g = new THREE.CylinderGeometry(r, r, len, 14); g.rotateX(Math.PI / 2); var p = new THREE.Mesh(g, m || gunMat); p.position.set(x, y, z); rifle.add(p); return p; }
    box(0.074, 0.058, 0.20, 0, -0.03, -0.10); box(0.022, 0.012, 0.20, 0, 0.004, -0.10, gun3Mat);
    for (var kk = 0; kk < 7; kk++) box(0.024, 0.004, 0.006, 0, 0.012, -0.03 - kk * 0.025, gun3Mat);
    box(0.034, 0.014, 0.034, 0, -0.002, 0.012); box(0.07, 0.044, 0.16, 0, -0.082, -0.08); box(0.072, 0.034, 0.07, 0, -0.112, -0.135);
    box(0.03, 0.09, 0.044, 0, -0.14, -0.035, gunMat, -0.35); box(0.006, 0.022, 0.005, 0, -0.118, -0.075, gun3Mat);
    var tg = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0025, 6, 14), gun3Mat); tg.position.set(0, -0.116, -0.078); tg.rotation.y = Math.PI / 2; rifle.add(tg);
    box(0.004, 0.009, 0.016, -0.039, -0.066, -0.055, gun3Mat); box(0.025, 0.09, 0.06, 0, -0.17, -0.133); box(0.025, 0.095, 0.06, 0, -0.255, -0.118, gunMat, -0.22); box(0.028, 0.005, 0.064, 0, -0.306, -0.106, gun3Mat, -0.22);
    tube(0.016, 0.16, 0, -0.012, 0.09, gun3Mat); box(0.04, 0.062, 0.1, 0, -0.03, 0.15); tube(0.024, 0.02, 0, -0.03, -0.21, gun3Mat); box(0.044, 0.044, 0.17, 0, -0.03, -0.305);
    [[0, 0.026], [0, -0.026], [0.026, 0], [-0.026, 0]].forEach(function (o) { box(o[0] ? 0.008 : 0.02, o[0] ? 0.02 : 0.008, 0.17, o[0], -0.03 + o[1], -0.305, gun3Mat); });
    [[0.031, -0.03], [-0.031, -0.03], [0, -0.061]].forEach(function (o) { box(o[1] === -0.061 ? 0.03 : 0.01, o[1] === -0.061 ? 0.01 : 0.03, 0.12, o[0], o[1], -0.3, gun2Mat); });
    box(0.04, 0.03, 0.085, 0, 0.012, -0.31, gun2Mat); tube(0.006, 0.01, 0.012, 0.012, -0.356, lensMat); tube(0.006, 0.01, -0.012, 0.012, -0.356, lensMat); box(0.03, 0.07, 0.03, 0, -0.095, -0.34, gun2Mat);
    box(0.02, 0.05, 0.03, 0, 0.0, -0.397, gun3Mat); box(0.004, 0.02, 0.004, 0, 0.036, -0.397, gun3Mat); box(0.004, 0.02, 0.01, 0.009, 0.03, -0.397, gun3Mat); box(0.004, 0.02, 0.01, -0.009, 0.03, -0.397, gun3Mat);
    tube(0.0095, 0.19, 0, -0.03, -0.485, gun3Mat); tube(0.011, 0.055, 0, -0.03, -0.6, gun3Mat); box(0.024, 0.022, 0.06, 0, 0.026, -0.08, gun3Mat); tube(0.016, 0.12, 0, 0.05, -0.08);
    tube(0.019, 0.012, 0, 0.05, -0.145, gun3Mat); tube(0.019, 0.012, 0, 0.05, -0.015, gun3Mat); tube(0.013, 0.004, 0, 0.05, -0.152, lensMat); box(0.03, 0.016, 0.03, 0, 0.018, -0.02, gun3Mat);
    rifle.position.set(0.21, -0.235, -0.42); rifle.rotation.set(0, -0.09, 0.04);
    rifle.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    var flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.flash, color: new THREE.Color(7, 5, 2.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); flashSprite.position.set(0, -0.03, -0.655); flashSprite.scale.setScalar(0.001); rifle.add(flashSprite);
    var flashLight = new THREE.PointLight(0xffd090, 0, 10, 2); flashLight.position.set(0, 0.0, -0.66); rifle.add(flashLight);
    var smokes = [], casings = [], tmp = new THREE.Vector3();
    for (i = 0; i < 4; i++) { var sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.smoke, color: 0xd0d0d0, transparent: true, depthWrite: false, opacity: 0 })); sm.userData.life = 0; scene.add(sm); smokes.push(sm); }
    var brassMat = std({ color: 0xc9a24a, metalness: 0.95, roughness: 0.25 });
    for (i = 0; i < 6; i++) { var cs2 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.0045, 0.045, 8), brassMat); cs2.visible = false; cs2.userData = { life: 0, v: new THREE.Vector3(), av: new THREE.Vector3() }; scene.add(cs2); casings.push(cs2); }
    function ejectBrass() { if (reduce()) return; var c = casings.filter(function (x) { return x.userData.life <= 0; })[0]; if (!c) return; rifle.localToWorld(tmp.set(0.045, -0.015, -0.12)); c.position.copy(tmp); c.visible = true; c.userData.life = 1.3; var right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), back = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion); c.userData.v.copy(right).multiplyScalar(1.6 + Math.random()).add(new THREE.Vector3(0, 1.4 + Math.random() * 0.6, 0)).add(back.multiplyScalar(0.4)); c.userData.av.set(Math.random() * 20, Math.random() * 20, Math.random() * 20); }
    function puffSmoke() { if (reduce()) return; var sm = smokes.filter(function (x) { return x.userData.life <= 0; })[0]; if (!sm) return; rifle.localToWorld(tmp.set(0, -0.03, -0.7)); sm.position.copy(tmp); sm.userData.life = 0.7; sm.userData.max = 0.7; sm.scale.setScalar(0.15); sm.material.opacity = 0.4; }

    // particles: sparks (additive, bloom), splinters, dust sprites
    function pointsSet(n, color, size, additive) { var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [], life = new Float32Array(n); for (var i = 0; i < n; i++) { pos[i * 3 + 1] = -100; vel.push(new THREE.Vector3()); } geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); var mat = new THREE.PointsMaterial({ color: color, size: size, sizeAttenuation: true, map: X.soft, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, transparent: true }); var pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts); return { geo: geo, pos: pos, vel: vel, life: life, n: n, g: additive ? 12 : 9.8 }; }
    var sparks = pointsSet(60, new THREE.Color(5, 3, 1.2), 0.05, true), splinters = pointsSet(60, 0xd8c39a, 0.045, false);
    function emit(set, p, n, strength) { if (reduce()) return; var k = 0; for (var i = 0; i < set.n && k < n; i++) { if (set.life[i] > 0) continue; set.life[i] = 0.3 + Math.random() * 0.4; set.pos[i * 3] = p.x; set.pos[i * 3 + 1] = p.y; set.pos[i * 3 + 2] = p.z; set.vel[i].set((Math.random() - 0.5) * strength, Math.random() * strength * 0.7 + 0.5, (Math.random() - 0.2) * strength); k++; } }
    function stepPoints(set, dt) { for (var i = 0; i < set.n; i++) { if (set.life[i] <= 0) continue; set.life[i] -= dt; set.vel[i].y -= set.g * dt; set.pos[i * 3] += set.vel[i].x * dt; set.pos[i * 3 + 1] += set.vel[i].y * dt; set.pos[i * 3 + 2] += set.vel[i].z * dt; if (set.life[i] <= 0) set.pos[i * 3 + 1] = -100; } set.geo.attributes.position.needsUpdate = true; }
    var dusts = [];
    for (i = 0; i < 14; i++) { var d = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.dust, transparent: true, depthWrite: false, opacity: 0 })); d.userData.life = 0; scene.add(d); dusts.push(d); }
    function emitDust(p, n) { if (reduce()) return; var k = 0; dusts.forEach(function (d) { if (k >= n || d.userData.life > 0) return; d.userData.life = 0.7 + Math.random() * 0.4; d.userData.max = d.userData.life; d.position.set(p.x + (Math.random() - 0.5) * 0.8, p.y + 0.1, p.z + (Math.random() - 0.5) * 0.4); d.userData.vy = 0.6 + Math.random() * 0.6; d.userData.vx = (Math.random() - 0.5) * 0.8; d.scale.setScalar(0.3); k++; }); }

    // shooting
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    S.aim = function (nx, ny) { ndc.set(nx, ny); ray.setFromCamera(ndc, camera); var hits = ray.intersectObjects(S.boards.filter(function (b) { return b.fall < 0; }).map(function (b) { return b.hit; }), false); return hits.length ? { board: hits[0].object.userData.board, point: hits[0].point } : { board: null, point: ray.ray.at(14, new THREE.Vector3()) }; };
    S.shoot = function (nx, ny) { S.recoil = 1; S.flashT = 1; if (!reduce()) { S.aberr = 0.006; S.white = 0.06; } ejectBrass(); puffSmoke(); return S.aim(nx, ny); };
    S.hitFx = function (point, base, ok) { emit(splinters, point, ok ? 26 : 12, ok ? 3.2 : 2.5); if (ok) emit(sparks, point, 10, 4); if (base) emitDust(base, 6); };
    S.dustAt = function (p) { emitDust(p, 4); };
    S.project = function (b) { var v = new THREE.Vector3(); b.hit.getWorldPosition(v); v.project(camera); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }; };

    // update and render
    var baseFov = 58, baseCam = new THREE.Vector3(0, 1.55, 0);
    S.update = function (dt, frozen) {
      S.t += dt;
      if (!frozen) S.boards.forEach(function (b) {
        if (b.pop < 1) { if (b.delay > 0) b.delay -= dt; else b.pop = Math.min(1, b.pop + dt / 0.45); b.g.rotation.x = -Math.PI / 2 * (1 - A.ease.outBack(b.pop)); if (b.pop >= 1 && !b.done) { b.done = true; emitDust(new THREE.Vector3(b.x, 0, b.z), 2); } }
        if (b.fall >= 0 && b.fall < 1) { if (b.fallDelay > 0) { b.fallDelay -= dt; return; } b.fall = Math.min(1, b.fall + dt / (reduce() ? 0.2 : 0.55)); b.g.rotation.x = -Math.PI / 2 * A.ease.outCubic(b.fall); }
      });
      stepPoints(sparks, dt); stepPoints(splinters, dt);
      dusts.forEach(function (d) { if (d.userData.life <= 0) { d.material.opacity = 0; return; } d.userData.life -= dt; var a = d.userData.life / d.userData.max; d.position.y += d.userData.vy * dt; d.position.x += d.userData.vx * dt; d.scale.setScalar(0.3 + (1 - a) * 1.4); d.material.opacity = a * 0.5; });
      smokes.forEach(function (sm) { if (sm.userData.life <= 0) { sm.material.opacity = 0; return; } sm.userData.life -= dt; var a = sm.userData.life / sm.userData.max; sm.position.y += 0.5 * dt; sm.position.add(tmp.set(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(0.8 * dt)); sm.scale.setScalar(0.15 + (1 - a) * 0.6); sm.material.opacity = a * 0.35; });
      casings.forEach(function (c) { if (c.userData.life <= 0) { c.visible = false; return; } c.userData.life -= dt; c.userData.v.y -= 9.8 * dt; c.position.addScaledVector(c.userData.v, dt); c.rotation.x += c.userData.av.x * dt; c.rotation.z += c.userData.av.z * dt; if (c.position.y < 0.01) { c.position.y = 0.01; c.userData.v.multiplyScalar(0.3); c.userData.v.y = Math.abs(c.userData.v.y) * 0.4; } });
      S.recoil = Math.max(0, S.recoil - dt / 0.18); S.flashT = Math.max(0, S.flashT - dt / 0.08); S.aberr = Math.max(0, S.aberr - dt * 0.05); S.white = Math.max(0, S.white - dt * 0.6);
      var r = A.ease.outCubic(S.recoil);
      rifle.position.set(0.21 + r * 0.008, -0.235 + Math.sin(S.t * 1.3) * 0.004 - r * 0.012, -0.42 + r * 0.06); rifle.rotation.set(r * 0.08 + Math.sin(S.t * 0.9) * 0.003, -0.09 + Math.sin(S.t * 0.7) * 0.002, 0.04);
      flashSprite.scale.setScalar(S.flashT > 0 ? 0.3 + S.flashT * 0.3 : 0.001); flashSprite.material.rotation = S.t * 9; flashLight.intensity = S.flashT * 14;
      camera.position.copy(baseCam); camera.rotation.set(S.pitch - r * 0.025 + Math.sin(S.t * 0.6) * 0.002, S.yaw + Math.sin(S.t * 0.5) * 0.002, 0);
      var fov = baseFov - r * 2; if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      var fp = flagGeo.attributes.position.array; for (var i = 0; i < fp.length; i += 3) { var u = (flagBase[i] + 0.55) / 1.1; fp[i + 2] = Math.sin(S.t * 6 + u * 5) * 0.08 * u; } flagGeo.attributes.position.needsUpdate = true;
      clouds.position.x = Math.sin(S.t * 0.02) * 6;
      var mp = moteGeo.attributes.position.array; for (i = 0; i < mp.length; i += 3) { mp[i + 1] += Math.sin(S.t * 0.8 + i) * 0.002; mp[i] += 0.03 * dt; if (mp[i] > 4) mp[i] = -4; } moteGeo.attributes.position.needsUpdate = true;
    };
    S.resize = function (w, h) { if (!St.resize(w, h)) return; S.w = St.w; S.h = St.h; baseFov = S.h > S.w ? 66 : 56; camera.fov = baseFov; camera.updateProjectionMatrix(); };
    S.render = function () { St.aberr = S.aberr; St.white = S.white; St.render(S.t); S.tri = St.tri; S.calls = St.calls; };
    S.setQuality = function (q) { St.setQuality(q); S.quality = St.quality; };
    S.dispose = function () { St.dispose(); };
    S.canvas = St.canvas; S.camera = camera; S.scene = scene; S.hdr = St.hdr; S.gl2 = St.gl2;
    S.resize(opts.width || 640, opts.height || 400);
    return S;
  };
})();
