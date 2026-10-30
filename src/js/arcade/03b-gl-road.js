/* ARCADE-03b-GL-ROAD — RoadScene on A.GL.Stage: Supply Line's convoy stage. The trucks stand still in front of the camera
   and the world slides past (checkpoints, roadside, hills at two parallax depths). Meters everywhere; the game owns the
   clock, the questions and the HUD and only tells the scene what to show. */
(function () {
  'use strict';
  var A = window.ARCADE; if (!A || !A.GL) return;
  var GL = A.GL, THREE = window.THREE, hash = GL.hash, clamp = GL.clamp, fbm = GL.fbm, normalFrom = GL.normalFrom;
  // ---- the road: Supply Line's convoy stage. The trucks stand still in front of the camera and the world slides past
  //      (checkpoints, roadside, hills at two parallax depths). Meters everywhere; the game owns the clock, the questions
  //      and the HUD and only tells the scene what to show. ----
  GL.RoadScene = function (opts) {
    opts = opts || {};
    var reduce = opts.reduce || function () { return false; };
    var St = GL.Stage({ mobile: opts.mobile, fov: 50, far: 900, shadow: { l: -16, r: 36, t: 24, b: -24, far: 260 }, light: 'dawn' });
    var scene = St.scene, camera = St.camera, X = St.X, std = St.std, mobile = St.mobile, i, j;
    St.sun.target.position.set(12, 0, -4);
    var S = { t: 0, scroll: 0, off: 0, driving: false, speed: 0, w: 4, h: 4, tri: 0, calls: 0, gl2: St.gl2, hdr: St.hdr, canvas: St.canvas, camera: camera, scene: scene, light: 'dawn', punch: 0, gateOpen: 0 };
    var world = new THREE.Group(), far = new THREE.Group(), mid = new THREE.Group(); scene.add(world); scene.add(far); scene.add(mid);
    function tex(t, rx, ry) { var c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; }
    var sandMat = std({ map: tex(X.sand, 220, 70), normalMap: tex(X.sandN, 220, 70), roughness: 0.95 });
    var roadMat = std({ map: tex(X.road, 180, 1), normalMap: tex(X.sandN, 180, 1), normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.92, color: 0xd9d9d9 });
    var dirtMat = std({ map: tex(X.dirt, 14, 2), normalMap: tex(X.dirtN, 14, 2), roughness: 0.98 }), woodMat = std({ map: X.wood, normalMap: X.woodN, roughness: 0.8 });
    var steelMat = std({ map: X.metal, roughnessMap: X.metalR, normalMap: X.metalN, metalness: 0.9, roughness: 0.5, color: 0x8a8f96 }), rockMat = std({ map: X.rock, roughness: 0.92 });
    var fineN = normalFrom(256, X.fineH, 0.8); fineN.repeat.set(4, 4); var concMat = std({ color: 0x9a9890, roughness: 0.9, normalMap: fineN });
    var bagMat = std({ map: tex(X.dirt, 2, 1), roughness: 0.95, color: 0xc9b58a }), leafMat = std({ color: 0x2f5a2a, roughness: 0.9 }), bushMat = std({ color: 0x5a6a3a, roughness: 0.95 }), trunkMat = std({ map: X.wood, roughness: 0.9, color: 0x8a6a48 });
    var tanMat = std({ color: 0xa8976a, roughness: 0.62, metalness: 0.1, normalMap: X.metalN }), greenMat = std({ color: 0x5b6641, roughness: 0.62, metalness: 0.1, normalMap: X.metalN }), tireMat = std({ color: 0x1b1d1f, roughness: 0.95 }), hubMat = std({ color: 0x8a8060, roughness: 0.5, metalness: 0.4 });
    var glassMat = std({ color: 0x14202c, metalness: 0.7, roughness: 0.12 }), lampMat = std({ color: 0xfff1c0, emissive: 0xfff1c0, emissiveIntensity: 0.1, roughness: 0.3 }), tailMat = std({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 0.3, roughness: 0.4 });
    var darkMat = std({ color: 0x2c2f33, roughness: 0.75, metalness: 0.2 });

    // ground, the road and the hills. All of it long enough that nothing needs to wrap in one mission.
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 520), sandMat); ground.rotation.x = -Math.PI / 2; ground.position.set(500, -0.02, -60); ground.receiveShadow = true; world.add(ground);
    var road = new THREE.Mesh(new THREE.PlaneGeometry(1600, 8), roadMat); road.rotation.x = -Math.PI / 2; road.position.set(500, 0.005, 0); road.receiveShadow = true; world.add(road);
    function hills(group, len, depth, segs, zc, amp, seed, near, farZ) {
      var geo = new THREE.PlaneGeometry(len, depth, segs, Math.max(8, Math.round(segs * depth / len * 2))); geo.rotateX(-Math.PI / 2); geo.translate(len / 2 - 200, 0, zc);
      var pos = geo.attributes.position, hf = fbm(128, seed, 5, 0.55), col = new Float32Array(pos.count * 3), c = new THREE.Color();
      for (var k = 0; k < pos.count; k++) {
        var x = pos.getX(k), z = pos.getZ(k), u = Math.floor(((x + 200) / len * 4) % 1 * 127), v = Math.floor(clamp((z - (zc - depth / 2)) / depth, 0, 0.999) * 127);
        var hgt = hf[v * 128 + u], kk = clamp((near - z) / (near - farZ), 0, 1), y = Math.pow(hgt, 1.6) * amp * kk - 0.4;
        pos.setY(k, y); var g = clamp((y - amp * 0.12) / (amp * 0.5), 0, 1), rock = clamp((y - amp * 0.55) / (amp * 0.4), 0, 1);
        c.setRGB(0.72, 0.62, 0.42).lerp(new THREE.Color(0.33, 0.45, 0.24), g).lerp(new THREE.Color(0.5, 0.47, 0.44), rock); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
      geo.computeVertexNormals(); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      var m = new THREE.Mesh(geo, std({ vertexColors: true, roughness: 0.96, normalMap: tex(X.dirtN, len / 10, depth / 10) })); m.receiveShadow = true; group.add(m); return m;
    }
    hills(far, 1800, 170, 240, -115, 34, 7, -32, -90); hills(mid, 1500, 64, 200, -44, 9, 9, -13, -40);

    // roadside props that recycle ahead of the convoy: trees, rocks, bushes, poles
    var props = [];
    function prop(mesh, wx, z, span) { mesh.position.set(wx, mesh.position.y, z); world.add(mesh); props.push({ m: mesh, wx: wx, span: span || 200 }); return mesh; }
    function tree(seed) { var g = new THREE.Group(), th = 4.5 + hash(seed, 61) * 3.5, trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, th, 7), trunkMat); trunk.position.y = th / 2; trunk.castShadow = true; g.add(trunk); for (var k = 0; k < 3; k++) { var fol = new THREE.Mesh(St.jitter(new THREE.IcosahedronGeometry(1, 1), 0.35, 0.35, 0.35, 200 + seed * 3 + k), leafMat), fs = 1.9 + hash(seed + k, 63) * 1.6; fol.scale.setScalar(fs); fol.position.set((hash(seed, k + 70) - 0.5) * 1.8, th - 0.8 + k * 1.3, (hash(seed, k + 80) - 0.5) * 1.8); fol.castShadow = true; g.add(fol); } return g; }
    for (i = 0; i < 14; i++) prop(tree(i), -30 + i * 14.3 + hash(i, 91) * 8, -19 - hash(i, 93) * 10, 200);
    for (i = 0; i < 16; i++) { var rk = new THREE.Mesh(St.jitter(new THREE.IcosahedronGeometry(1, 1), 0.5, 0.6, 0.5, 100 + i), rockMat), rs = 0.3 + hash(i, 41) * 1.1, near = hash(i, 43) > 0.6; if (near) rs *= 0.45; rk.scale.setScalar(rs); rk.position.y = rs * 0.35 - 0.1; rk.rotation.y = hash(i, 49) * 6; rk.castShadow = rk.receiveShadow = true; prop(rk, -30 + i * 12.5 + hash(i, 45) * 6, near ? 4.8 + hash(i, 47) * 1.4 : -16 - hash(i, 47) * 6, 200); }
    for (i = 0; i < 14; i++) { var bs = new THREE.Mesh(St.jitter(new THREE.IcosahedronGeometry(1, 1), 0.4, 0.3, 0.4, 300 + i), bushMat), bsc = 0.35 + hash(i, 51) * 0.5, nearB = hash(i, 53) > 0.5; bs.scale.set(bsc * 1.3, bsc, bsc * 1.3); bs.position.y = bsc * 0.5; bs.castShadow = true; prop(bs, -25 + i * 14.2 + hash(i, 55) * 7, nearB ? 4.0 + hash(i, 57) * 0.6 : -5.6 - hash(i, 57) * 1.2, 200); }
    for (i = 0; i < 9; i++) { var pg = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7.5, 7), trunkMat); pole.position.y = 3.75; pole.castShadow = true; pg.add(pole); var bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.6), trunkMat); bar.position.y = 6.9; pg.add(bar); prop(pg, -20 + i * 23, -4.7, 207); }

    // the convoy: an armored lead truck and an FMTV-style cargo truck, built from boxes and cylinders
    var convoy = new THREE.Group(); scene.add(convoy); var wheels = [], headlights = [], lamps = [], glows = [];
    function box(g, w, h, d, x, y, z, m, ry) { var p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); p.position.set(x, y, z); if (ry) p.rotation.y = ry; p.castShadow = p.receiveShadow = true; g.add(p); return p; }
    function wheel(g, x, z, r, wdt) { var geo = new THREE.CylinderGeometry(r, r, wdt, 18); geo.rotateX(Math.PI / 2); var w = new THREE.Mesh(geo, tireMat); w.position.set(x, r, z); w.castShadow = true; g.add(w); var hg = new THREE.CylinderGeometry(r * 0.55, r * 0.55, wdt + 0.02, 12); hg.rotateX(Math.PI / 2); var hub = new THREE.Mesh(hg, hubMat); w.add(hub); wheels.push({ m: w, r: r }); return w; }
    function lamp(g, x, y, z, w, h, mat) { var l = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, w), mat.clone()); l.position.set(x, y, z); g.add(l); lamps.push(l); return l; }
    function buildCargo() {
      var g = new THREE.Group();
      box(g, 7.0, 0.3, 2.0, 0, 0.95, 0, darkMat);                                   // frame
      box(g, 2.1, 2.1, 2.3, 2.55, 1.95, 0, greenMat);                                // cab (cab-over)
      box(g, 0.1, 0.8, 2.0, 3.62, 2.25, 0, glassMat); box(g, 1.2, 0.6, 0.06, 2.6, 2.2, 1.17, glassMat); box(g, 1.2, 0.6, 0.06, 2.6, 2.2, -1.17, glassMat);
      box(g, 0.3, 0.4, 2.4, 3.75, 0.9, 0, darkMat);                                  // bumper
      box(g, 0.1, 0.5, 1.4, 3.64, 1.35, 0, darkMat);                                 // grille
      lamp(g, 3.78, 1.2, 0.85, 0.3, 0.2, lampMat); lamp(g, 3.78, 1.2, -0.85, 0.3, 0.2, lampMat); lamp(g, -3.52, 1.05, 0.85, 0.25, 0.15, tailMat); lamp(g, -3.52, 1.05, -0.85, 0.25, 0.15, tailMat);
      box(g, 0.08, 0.5, 0.06, 1.5, 3.3, 0, darkMat); var stack = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8), steelMat); stack.position.set(1.45, 3.4, -1.0); g.add(stack);
      box(g, 0.06, 0.3, 0.3, 3.0, 2.4, 1.3, darkMat); box(g, 0.06, 0.3, 0.3, 3.0, 2.4, -1.3, darkMat);   // mirrors
      box(g, 4.4, 0.12, 2.3, -0.9, 1.16, 0, woodMat);                                 // bed floor
      box(g, 4.4, 0.55, 0.06, -0.9, 1.5, 1.15, woodMat); box(g, 4.4, 0.55, 0.06, -0.9, 1.5, -1.15, woodMat); box(g, 0.06, 0.9, 2.3, 1.28, 1.67, 0, woodMat); box(g, 0.06, 0.5, 2.3, -3.1, 1.47, 0, woodMat);
      [[-2.6, 1.2], [-2.6, -1.2], [-1.4, 1.2], [-1.4, -1.2], [2.5, 1.2], [2.5, -1.2]].forEach(function (p) { wheel(g, p[0], p[1], 0.55, 0.38); });
      g.userData.slots = []; for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) g.userData.slots.push(new THREE.Vector3(-2.2 + c * 1.08, 1.22 + 0.5 + r * 1.01, 0));
      return g;
    }
    function buildLead() {
      var g = new THREE.Group();
      box(g, 5.2, 1.5, 2.4, 0, 1.55, 0, tanMat);                                     // hull
      var hood = box(g, 1.5, 1.0, 2.3, 2.9, 1.25, 0, tanMat); hood.rotation.z = -0.28;
      box(g, 2.6, 0.9, 2.2, -0.3, 2.65, 0, tanMat);                                  // cab roof
      box(g, 0.1, 0.6, 1.9, 1.0, 2.55, 0, glassMat); box(g, 0.9, 0.5, 0.06, -0.4, 2.55, 1.13, glassMat); box(g, 0.9, 0.5, 0.06, -0.4, 2.55, -1.13, glassMat); box(g, 0.9, 0.5, 0.06, -1.5, 2.55, 1.13, glassMat); box(g, 0.9, 0.5, 0.06, -1.5, 2.55, -1.13, glassMat);
      var ring = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.25, 16), tanMat); ring.position.set(-0.2, 3.2, 0); ring.castShadow = true; g.add(ring);
      box(g, 0.7, 0.6, 1.1, -0.2, 3.6, 0, tanMat); var gun = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), steelMat); gun.rotation.z = Math.PI / 2; gun.position.set(0.7, 3.55, 0); g.add(gun);
      box(g, 0.4, 0.5, 2.6, 3.6, 1.0, 0, darkMat); box(g, 0.4, 0.4, 2.5, -2.75, 1.0, 0, darkMat);   // bumpers
      lamp(g, 3.82, 1.2, 0.9, 0.3, 0.22, lampMat); lamp(g, 3.82, 1.2, -0.9, 0.3, 0.22, lampMat); lamp(g, -2.97, 1.1, 0.9, 0.25, 0.15, tailMat); lamp(g, -2.97, 1.1, -0.9, 0.25, 0.15, tailMat);
      var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 2.6, 6), darkMat); ant.position.set(-2.3, 3.9, -1.0); ant.rotation.z = 0.12; g.add(ant); g.userData.ant = ant;
      [0.9, -0.9].forEach(function (z) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.flash, color: 0xfff0c8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); sp.position.set(3.95, 1.2, z); sp.scale.setScalar(1.1); g.add(sp); glows.push(sp); });
      box(g, 0.06, 0.3, 0.3, 1.2, 2.5, 1.3, darkMat); box(g, 0.06, 0.3, 0.3, 1.2, 2.5, -1.3, darkMat);
      [[1.9, 1.25], [1.9, -1.25], [-1.8, 1.25], [-1.8, -1.25]].forEach(function (p) { wheel(g, p[0], p[1], 0.65, 0.45); });
      [[0.9, 1], [-0.9, 1], [0.9, -1], [-0.9, -1]].forEach(function (p) { var sp = new THREE.SpotLight(0xfff0c8, 0, 40, p[1] > 0 ? 0.42 : 0.42, 0.55, 1.6); sp.position.set(3.9, 1.2, p[0]); sp.target.position.set(22, 0, p[0] * 0.6); g.add(sp); g.add(sp.target); if (p[1] > 0) headlights.push(sp); else { sp.visible = false; } });
      return g;
    }
    var cargo = buildCargo(), lead = buildLead(); cargo.position.set(5.6, 0, 0.5); lead.position.set(12.9, 0, 0.5); convoy.add(cargo); convoy.add(lead);

    // crates: a wooden box with a coloured label band, one material per label
    var crateGeo = new THREE.BoxGeometry(1, 1, 1), crateMats = {}, xTex = null;
    function crateMat(c) {
      var key = c.label + c.color; if (crateMats[key]) return crateMats[key];
      var cv = document.createElement('canvas'); cv.width = cv.height = 256; var g = cv.getContext('2d');
      g.drawImage(X.wood.image, 0, 0, 256, 256); g.fillStyle = 'rgba(0,0,0,.18)'; [84, 170].forEach(function (y) { g.fillRect(0, y, 256, 4); }); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 8; g.strokeRect(0, 0, 256, 256);
      g.fillStyle = c.color; g.fillRect(16, 96, 224, 64); g.fillStyle = c.ink || '#ffffff'; g.font = A.font(44, 'mono', 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.label, 128, 130);
      var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return crateMats[key] = std({ map: t, roughness: 0.8 });
    }
    function xMark() { if (xTex) return xTex; var cv = document.createElement('canvas'); cv.width = cv.height = 128; var g = cv.getContext('2d'); g.strokeStyle = '#ff4040'; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.moveTo(22, 22); g.lineTo(106, 106); g.moveTo(106, 22); g.lineTo(22, 106); g.stroke(); xTex = new THREE.CanvasTexture(cv); xTex.colorSpace = THREE.SRGBColorSpace; return xTex; }
    var crates = [], pallet = null, tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
    S.setBay = function (list, wx) {
      S.clearBay();
      if (!pallet) { pallet = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 1.5), woodMat); pallet.castShadow = pallet.receiveShadow = true; world.add(pallet); }
      pallet.visible = true; pallet.position.set(wx - 2.8, 0.07, -3.6);
      crates = list.map(function (c, k) { var m = new THREE.Mesh(crateGeo, crateMat(c)); var row = Math.floor(k / 3), col = k % 3; m.position.set(wx - 3.9 + col * 1.1, 0.14 + 0.5 + row * 1.01, -3.6 - row * 0.02); m.rotation.y = (hash(k, 5) - 0.5) * 0.1; m.castShadow = m.receiveShadow = true; world.add(m); return { m: m, state: 'wait', fly: 0, from: m.position.clone(), to: null, shake: 0 }; });
      return crates;
    };
    S.load = function (k, slot) { var c = crates[k]; if (!c) return; c.m.getWorldPosition(tmp); world.remove(c.m); scene.add(c.m); c.m.position.copy(tmp); c.from = tmp.clone(); c.state = 'fly'; c.fly = 0; c.slot = slot; };
    S.reject = function (k) { var c = crates[k]; if (!c) return; c.state = 'left'; c.shake = 0.5; var xm = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: xMark(), transparent: true })); xm.position.z = 0.505; c.m.add(xm); var xm2 = xm.clone(); xm2.position.set(0.505, 0, 0); xm2.rotation.y = Math.PI / 2; c.m.add(xm2); };
    S.clearBay = function () { crates.forEach(function (c) { if (c.state !== 'on') { if (c.m.parent) c.m.parent.remove(c.m); } }); crates = crates.filter(function (c) { return c.state === 'on'; }); if (pallet) pallet.visible = false; };
    S.clearBed = function () { crates.forEach(function (c) { if (c.m.parent) c.m.parent.remove(c.m); }); crates = []; };
    S.bedCount = function () { return crates.filter(function (c) { return c.state === 'on'; }).length; };

    // the contact at the pallet: a Soldier (or a civilian at the market) who waves during the brief
    var person = null, skinMat = std({ color: 0xc69c76, roughness: 0.7 });
    function buildPerson(civ) {
      var g = new THREE.Group(), uni = std({ color: civ ? 0x7d6a52 : 0x6b6a4e, roughness: 0.85 }), pants = std({ color: civ ? 0x3a4a6a : 0x5f5e45, roughness: 0.85 });
      [-0.12, 0.12].forEach(function (z) { var leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 3, 8), pants); leg.position.set(0, 0.42, z); leg.castShadow = true; g.add(leg); });
      var torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 3, 10), uni); torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
      var armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 3, 8), uni); armL.position.set(0, 0.95, -0.3); armL.rotation.x = 0.15; g.add(armL);
      var armR = new THREE.Group(); armR.position.set(0, 1.28, 0.28); var ar = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 3, 8), uni); ar.position.y = -0.28; armR.add(ar); g.add(armR); g.userData.arm = armR;
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skinMat); head.position.y = 1.55; head.castShadow = true; g.add(head);
      if (civ) { var hat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12), std({ color: 0x3a3a3a, roughness: 0.9 })); hat.position.y = 1.68; g.add(hat); var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 12), std({ color: 0x3a3a3a, roughness: 0.9 })); brim.position.y = 1.64; g.add(brim); }
      else { var helm = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), uni); helm.position.y = 1.56; helm.castShadow = true; g.add(helm); }
      return g;
    }
    S.setContact = function (kind, wx) { if (person) { world.remove(person); person = null; } if (!kind) return; person = buildPerson(kind === 'market'); person.position.set(wx - 0.4, 0, -3.2); person.rotation.y = -0.9; person.userData.wave = 0; world.add(person); };
    S.wave = function (on) { if (person) person.userData.wave = on ? 1 : 0; };

    // checkpoints, built once each and parked until their stop comes
    var places = {}, shown = [];
    function signAt(g, text, x, z, w, h) { var post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), woodMat); post.position.set(x, 1.1, z); post.castShadow = true; g.add(post); var b = new THREE.Mesh(new THREE.BoxGeometry(w || 2.2, h || 0.8, 0.06), std({ map: St.label(text, { w: 512, h: 160, size: 92 }), roughness: 0.7 })); b.position.set(x, 2.2, z + 0.06); b.castShadow = true; g.add(b); return b; }
    function stripeMat(c1, c2) { var cv = document.createElement('canvas'); cv.width = 128; cv.height = 32; var g = cv.getContext('2d'); for (var k = 0; k < 8; k++) { g.fillStyle = k % 2 ? c2 : c1; g.fillRect(k * 16, 0, 16, 32); } var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); return std({ map: t, roughness: 0.85, side: THREE.DoubleSide }); }
    function halfTube(r, len, mat) { var geo = new THREE.CylinderGeometry(r, r, len, 18, 1, true, Math.PI / 2, Math.PI); geo.rotateX(Math.PI / 2); geo.rotateY(Math.PI / 2); var m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; }
    function sandbags(g, cx, cz, n, rad, seed) { for (var k = 0; k < n; k++) { var a = k / n * Math.PI * 2, bg = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.45, 4, 8), bagMat); bg.rotation.z = Math.PI / 2; bg.rotation.y = a + Math.PI / 2; bg.position.set(cx + Math.cos(a) * rad, 0.18 + (k % 2) * 0.3, cz + Math.sin(a) * rad); bg.castShadow = bg.receiveShadow = true; g.add(bg); } }
    function buildPlace(kind) {
      var g = new THREE.Group(), o = { kind: kind, g: g, wx: 0, parts: {} }, k;
      if (kind === 'ops') {
        var tentMat = std({ color: 0x5c6a3a, roughness: 0.95, side: THREE.DoubleSide }), capMat = std({ color: 0x4a5630, roughness: 0.95, side: THREE.DoubleSide });
        [[2, -9, 1], [11.5, -12, 0.85]].forEach(function (p) { var t = halfTube(2.4 * p[2], 7 * p[2], tentMat); t.position.set(p[0], 0, p[1]); g.add(t); [-1, 1].forEach(function (s) { var cap = new THREE.Mesh(new THREE.CircleGeometry(2.4 * p[2], 18, 0, Math.PI), capMat); cap.position.set(p[0] + s * 3.5 * p[2], 0, p[1]); cap.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(cap); }); var door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.9), std({ color: 0x2a3220, roughness: 1 })); door.position.set(p[0] - 3.45 * p[2], 0.8, p[1]); g.add(door); });
        var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 11, 8), steelMat); mast.position.set(15.5, 5.5, -9); mast.castShadow = true; g.add(mast);
        var beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), std({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 2 })); beacon.position.set(15.5, 11.1, -9); g.add(beacon); o.parts.beacon = beacon;
        [[-1, 0], [0.5, 0.87], [0.5, -0.87]].forEach(function (d) { var guy = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 11.2, 4), darkMat); guy.position.set(15.5 + d[0] * 2, 5.2, -9 + d[1] * 2); guy.lookAt(15.5, 10.4, -9); guy.rotateX(Math.PI / 2); g.add(guy); });
        sandbags(g, 15.5, -9, 10, 1.4, 1); signAt(g, 'OPS CENTER', 1.4, -4.6, 2.6, 0.8);
        var gen = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.8), greenMat); gen.position.set(7, 0.5, -6.5); gen.castShadow = true; g.add(gen);
      } else if (kind === 'market') {
        var cols = [['#c0392b', '#f4efe4'], ['#2d7fb8', '#f4efe4'], ['#d9a23a', '#f4efe4']], fruit = [0xe2b04a, 0x7fb24a, 0xd65a3a, 0xc9c3b5, 0x9a4a8a];
        cols.forEach(function (c, s) {
          var x = 1 + s * 5.6;
          [[-1.9, -5.6], [1.9, -5.6], [-1.9, -8.8], [1.9, -8.8]].forEach(function (p) { var post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.7, 8), woodMat); post.position.set(x + p[0], 1.35, p[1]); post.castShadow = true; g.add(post); });
          var roof = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.8), stripeMat(c[0], c[1])); roof.position.set(x, 2.85, -7.2); roof.rotation.x = -Math.PI / 2 + 0.22; roof.castShadow = true; g.add(roof);
          var counter = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.9, 1.1), woodMat); counter.position.set(x, 0.45, -5.9); counter.castShadow = counter.receiveShadow = true; g.add(counter);
          for (k = 0; k < 6; k++) { var f = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), std({ color: fruit[(s + k) % fruit.length], roughness: 0.6 })); f.position.set(x - 1.5 + k * 0.6, 1.05, -5.9 + (k % 2) * 0.3 - 0.15); f.castShadow = true; g.add(f); }
          var cr = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), woodMat); cr.position.set(x + 1.6, 0.25, -4.9); cr.castShadow = true; g.add(cr);
        });
        signAt(g, 'MARKET', 1.4, -4.6, 2.2, 0.8);
      } else if (kind === 'bridge') {
        var waterN = tex(X.dirtN, 10, 5), water = new THREE.Mesh(new THREE.PlaneGeometry(70, 30), std({ color: 0x2b5f82, metalness: 0.75, roughness: 0.18, normalMap: waterN, normalScale: new THREE.Vector2(0.35, 0.35) })); water.rotation.x = -Math.PI / 2; water.position.set(9, -0.25, -23); g.add(water); o.parts.waterN = waterN;
        var bank = new THREE.Mesh(new THREE.BoxGeometry(70, 0.3, 2), dirtMat); bank.position.set(9, -0.1, -7.6); g.add(bank);
        var deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 32), concMat); deck.position.set(9, 0.95, -23); deck.castShadow = deck.receiveShadow = true; g.add(deck);
        [6.8, 11.2].forEach(function (x) {
          var top = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 32), steelMat); top.position.set(x, 3.3, -23); top.castShadow = true; g.add(top);
          for (k = 0; k < 9; k++) { var z = -37.6 + k * 3.65, v = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), steelMat); v.position.set(x, 2.1, z); v.castShadow = true; g.add(v); if (k < 8) { var dg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.3, 0.1), steelMat); dg.position.set(x, 2.1, z + 1.82); dg.rotation.x = (k % 2 ? 1 : -1) * 1.0; g.add(dg); } }
        });
        [-30, -16].forEach(function (z) { var pier = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 1.2), concMat); pier.position.set(9, 0.1, z); g.add(pier); });
        var ramp = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.08, 4.2), dirtMat); ramp.position.set(9, 0.03, -5.4); ramp.receiveShadow = true; g.add(ramp);
        signAt(g, 'BRIDGE 30T', 1.4, -4.6, 2.6, 0.8);
      } else if (kind === 'depot') {
        var wall = std({ color: 0x6d7a86, roughness: 0.88, normalMap: fineN }), roofMat = std({ color: 0x4a545c, roughness: 0.75, metalness: 0.3 });
        var wh = new THREE.Mesh(new THREE.BoxGeometry(17, 5, 9), wall); wh.position.set(8.5, 2.5, -11.5); wh.castShadow = wh.receiveShadow = true; g.add(wh);
        [-1, 1].forEach(function (s) { var rf = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.2, 5.2), roofMat); rf.position.set(8.5, 6.0, -11.5 + s * 2.3); rf.rotation.x = s * 0.33; rf.castShadow = true; g.add(rf); });
        var doorTex = St.label('', { w: 128, h: 128, bg: '#3d454d', border: false }); var dc = doorTex.image.getContext('2d'); dc.strokeStyle = '#59636d'; dc.lineWidth = 3; for (k = 1; k < 10; k++) { dc.beginPath(); dc.moveTo(0, k * 12.8); dc.lineTo(128, k * 12.8); dc.stroke(); } doorTex.needsUpdate = true;
        [2.5, 8.5, 14.5].forEach(function (x) { var d = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.6), std({ map: doorTex, roughness: 0.6, metalness: 0.3 })); d.position.set(x, 1.8, -6.99); g.add(d); });
        [[-1.2, -6, 0], [-1.2, -6, 1], [-0.3, -6.3, 0], [0.5, -5.6, 0]].forEach(function (p, n) { var c = new THREE.Mesh(crateGeo, crateMat({ label: ['MRE', 'PARTS', 'WATER', 'MED'][n], color: ['#8f7a46', '#7d838c', '#3f93cf', '#eeeeee'][n], ink: n === 3 ? '#c0392b' : '#fff' })); c.position.set(p[0] + 17, 0.43 + p[2] * 0.86, p[1]); c.castShadow = c.receiveShadow = true; g.add(c); });
        var fl = new THREE.Group(), yel = std({ color: 0xd9a23a, roughness: 0.6, metalness: 0.2 });
        box(fl, 1.7, 0.8, 1.1, 0, 0.75, 0, yel); box(fl, 0.9, 0.9, 1.0, -0.3, 1.6, 0, darkMat); box(fl, 0.08, 2.4, 0.1, 1.0, 1.4, 0.35, steelMat); box(fl, 0.08, 2.4, 0.1, 1.0, 1.4, -0.35, steelMat); box(fl, 1.1, 0.05, 0.12, 1.5, 0.3, 0.3, steelMat); box(fl, 1.1, 0.05, 0.12, 1.5, 0.3, -0.3, steelMat);
        [[0.5, 0.6], [0.5, -0.6], [-0.6, 0.6], [-0.6, -0.6]].forEach(function (p) { var geo = new THREE.CylinderGeometry(0.28, 0.28, 0.25, 12); geo.rotateX(Math.PI / 2); var w = new THREE.Mesh(geo, tireMat); w.position.set(p[0], 0.28, p[1]); fl.add(w); });
        fl.position.set(19.5, 0, -5.4); fl.rotation.y = 0.5; g.add(fl);
        signAt(g, 'DEPOT', 1.4, -4.6, 2.0, 0.8);
      } else if (kind === 'fob') {
        var hesco = tex(X.dirt, 1, 1), hescoMat = std({ map: hesco, roughness: 1, color: 0xc2b08a });
        for (k = 0; k < 14; k++) { if (k === 6 || k === 7 || k === 8) continue; for (var r = 0; r < 2; r++) { var hb = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.12, 1.12), hescoMat); hb.position.set(0.5 + k * 1.15, 0.56 + r * 1.12, -8.5); hb.rotation.y = (hash(k + r * 20, 3) - 0.5) * 0.06; hb.castShadow = hb.receiveShadow = true; g.add(hb); } }
        [[7.1, -7.6], [10.1, -7.6]].forEach(function (p) { var post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 8), steelMat); post.position.set(p[0], 1.3, p[1]); post.castShadow = true; g.add(post); });
        var arm = new THREE.Group(); arm.position.set(7.1, 1.3, -7.5); var armM = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.14, 0.14), stripeMat('#c0392b', '#f2f2f2')); armM.position.x = 1.55; armM.castShadow = true; arm.add(armM); g.add(arm); o.parts.arm = arm;
        var tw = new THREE.Group(); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) { var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 8), steelMat); leg.position.set(p[0] * 1.1, 2.5, p[1] * 1.1); leg.castShadow = true; tw.add(leg); });
        var cab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.0, 2.8), std({ color: 0x5c6b4a, roughness: 0.85 })); cab.position.y = 6.0; cab.castShadow = true; tw.add(cab); var tr = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.18, 3.3), darkMat); tr.position.y = 7.1; tw.add(tr); var tg = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.7, 2.85), glassMat); tg.position.y = 6.2; tw.add(tg); tw.position.set(15.5, 0, -12); g.add(tw);
        var fp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 7.5, 8), steelMat); fp.position.set(12.5, 3.75, -6.4); fp.castShadow = true; g.add(fp); var head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), darkMat); head.position.set(12.5, 7.4, -6.2); g.add(head);
        var flood = new THREE.SpotLight(0xfff3d0, 0, 45, 0.7, 0.5, 1.5); flood.position.set(12.5, 7.3, -6.0); flood.target.position.set(8.5, 0, -2); g.add(flood); g.add(flood.target); o.parts.flood = flood;
        var lampM = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), lampMat.clone()); lampM.position.set(12.5, 7.25, -6.0); g.add(lampM); o.parts.lamp = lampM;
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 6, 8), steelMat); pole.position.set(3.5, 3, -10.5); pole.castShadow = true; g.add(pole);
        var flagGeo = new THREE.PlaneGeometry(1.6, 0.9, 10, 2), flag = new THREE.Mesh(flagGeo, std({ color: 0xe6b85a, roughness: 0.8, side: THREE.DoubleSide })); flag.position.set(3.5 + 0.82, 5.5, -10.5); flag.castShadow = true; g.add(flag); o.parts.flag = flag; o.parts.flagBase = flagGeo.attributes.position.array.slice();
        [[2, -6.2], [4.5, -6.2]].forEach(function (p) { var tw2 = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.4, 0.3), concMat); tw2.position.set(p[0] + 15, 1.7, p[1] - 1.6); tw2.castShadow = tw2.receiveShadow = true; g.add(tw2); });
        sandbags(g, 7.1, -6.4, 7, 0.9, 5); sandbags(g, 10.1, -6.4, 7, 0.9, 6);
        signAt(g, 'FOB KEYSTONE', 1.4, -4.6, 3.2, 0.8);
      }
      g.visible = false; world.add(g); places[kind] = o; return o;
    }
    S.place = function (kind, wx) { var o = places[kind] || buildPlace(kind); o.wx = wx; o.g.position.x = wx; o.g.visible = true; shown.push(o); while (shown.length > 2) { var old = shown.shift(); if (shown.indexOf(old) < 0) old.g.visible = false; } return o; };
    S.clearPlaces = function () { shown.forEach(function (o) { o.g.visible = false; }); shown = []; };
    S.gate = function (k) { S.gateOpen = clamp(k, 0, 1); };

    // dust from the wheels, exhaust from the stack, a cloud when the convoy stops
    var dusts = [];
    for (i = 0; i < 18; i++) { var d = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.dust, transparent: true, depthWrite: false, opacity: 0 })); d.userData.life = 0; scene.add(d); dusts.push(d); }
    function emitDust(p, n, big) { if (reduce()) return; var k = 0; dusts.forEach(function (d) { if (k >= n || d.userData.life > 0) return; d.userData.life = (big ? 1.2 : 0.7) + Math.random() * 0.4; d.userData.max = d.userData.life; d.position.set(p.x + (Math.random() - 0.5) * 0.8, p.y + 0.1, p.z + (Math.random() - 0.5) * 0.6); d.userData.vy = 0.5 + Math.random() * 0.5; d.userData.vx = -1.5 - Math.random() * 1.5; d.userData.big = big ? 2 : 1; d.scale.setScalar(0.4); k++; }); }
    S.dustAt = function (p, n) { emitDust(p, n || 4, true); };
    var smokes = [];
    for (i = 0; i < 5; i++) { var sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.smoke, color: 0x9a9a9a, transparent: true, depthWrite: false, opacity: 0 })); sm.userData.life = 0; scene.add(sm); smokes.push(sm); }
    function puff() { if (reduce()) return; var sm = smokes.filter(function (x) { return x.userData.life <= 0; })[0]; if (!sm) return; cargo.localToWorld(tmp.set(1.45, 4.15, -1.0)); sm.position.copy(tmp); sm.userData.life = 0.9; sm.userData.max = 0.9; sm.scale.setScalar(0.25); }
    var dustAcc = 0, puffAcc = 0;

    // camera: a three-quarter view from the road's near side; farther back when the screen is narrow
    var camBase = new THREE.Vector3(16.5, 6.5, 20), camLook = new THREE.Vector3(16.5, 1.4, -3.5), lastPos = 0, blend = null;
    S.resize = function (w, h) {
      if (!St.resize(w, h)) return; S.w = St.w; S.h = St.h;
      var aspect = S.w / S.h, fov = aspect < 1.2 ? 58 : 50, want = aspect < 1.2 ? 25 : aspect < 1.6 ? 29 : 33, d = clamp(want / (2 * aspect * Math.tan(fov / 2 * Math.PI / 180)), 14, 30);
      camera.fov = fov; camera.updateProjectionMatrix(); var lx = aspect < 1.2 ? 13 : aspect < 1.6 ? 14 : 15; camBase.set(lx, 2.3 + d * 0.17, d * 0.98); camLook.set(lx, 1.2, -3.5);
    };
    S.setLight = function (name) { St.setLight(name, name); St.refreshEnv(); S.light = name; blend = null; };
    S.driveLight = function (name, seconds) { if (name === S.light) return; blend = { from: S.light, to: name, k: 0, len: seconds || 3 }; };
    S.project = function (v) { tmp2.copy(v).project(camera); return { x: (tmp2.x + 1) / 2, y: (1 - tmp2.y) / 2 }; };
    // named points for floaters: 'cargo' (over the bed), 'lead', 'crate' k, 'bay'
    S.point = function (what, k) { if (what === 'cargo') { cargo.localToWorld(tmp.set(-0.9, 3.0, 0)); return tmp.clone(); } if (what === 'lead') { lead.localToWorld(tmp.set(0, 4.2, 0)); return tmp.clone(); } if (what === 'crate' && crates[k]) { crates[k].m.getWorldPosition(tmp); return tmp.clone(); } if (what === 'bay' && pallet) { pallet.getWorldPosition(tmp); tmp.y += 1.4; return tmp.clone(); } return new THREE.Vector3(16, 2, 0); };
    S.update = function (dt, frozen) {
      S.t += dt;
      if (blend) { blend.k = Math.min(1, blend.k + dt / blend.len); St.blendLight(blend.from, blend.to, blend.k < 1 ? A.ease.inOutQuad(blend.k) : 1); if (blend.k >= 1) { S.light = blend.to; St.setLight(blend.to, blend.to); St.refreshEnv(); blend = null; } }
      var night = St.night();
      world.position.x = -S.scroll; far.position.x = -S.scroll * 0.3; mid.position.x = -S.scroll * 0.6; convoy.position.x = S.off;
      var pos = S.scroll + S.off, ds = pos - lastPos; lastPos = pos; S.speed = dt > 0 ? ds / dt : 0;
      var moving = Math.abs(S.speed) > 0.2;
      if (!frozen) {
        wheels.forEach(function (w) { w.m.rotation.z -= ds / w.r; });
        convoy.position.y = moving && !reduce() ? Math.sin(S.t * 19) * 0.018 + Math.sin(S.t * 7.3) * 0.012 : convoy.position.y * 0.8;
        cargo.rotation.z = moving ? Math.sin(S.t * 5) * 0.004 : cargo.rotation.z * 0.9; lead.rotation.z = moving ? Math.sin(S.t * 6 + 1) * 0.004 : lead.rotation.z * 0.9;
        lead.userData.ant.rotation.x = Math.sin(S.t * 4) * (moving ? 0.12 : 0.03);
        props.forEach(function (p) { if (p.wx - S.scroll < -48) { p.wx += p.span; p.m.position.x = p.wx; } });
        if (moving && !reduce()) { dustAcc += dt * 9; while (dustAcc > 1) { dustAcc--; wheels.forEach(function (w, n) { if (n % 3 === 0) { w.m.getWorldPosition(tmp); tmp.y = 0.05; tmp.x -= 0.4; emitDust(tmp, 1); } }); } puffAcc += dt * 3; while (puffAcc > 1) { puffAcc--; puff(); } }
        crates.forEach(function (c) {
          if (c.state === 'fly') { c.fly = Math.min(1, c.fly + dt / 0.7); var e = A.ease.inOutQuad(c.fly), slot = cargo.userData.slots[c.slot] || cargo.userData.slots[0]; cargo.localToWorld(tmp.copy(slot)); c.m.position.lerpVectors(c.from, tmp, e); c.m.position.y += Math.sin(e * Math.PI) * 2.2; c.m.rotation.y = e * Math.PI * 2 * 0.5; if (c.fly >= 1) { c.state = 'on'; scene.remove(c.m); cargo.add(c.m); c.m.position.copy(slot); c.m.rotation.set(0, (hash(c.slot, 9) - 0.5) * 0.08, 0); S.punch = 0.4; } }
          if (c.shake > 0) { c.shake -= dt; c.m.position.x = c.from.x + Math.sin(S.t * 60) * 0.06 * c.shake; }
        });
        if (person) { var wv = person.userData.wave ? Math.sin(S.t * 7) * 0.5 - 2.6 : -0.15; person.userData.arm.rotation.z += (wv - person.userData.arm.rotation.z) * Math.min(1, dt * 8); person.position.y = person.userData.wave ? Math.abs(Math.sin(S.t * 7)) * 0.03 : 0; }
        shown.forEach(function (o) {
          var P = o.parts;
          if (P.beacon) P.beacon.material.emissiveIntensity = Math.sin(S.t * 4) > 0 ? 3 : 0.2;
          if (P.waterN) P.waterN.offset.set(S.t * 0.02, S.t * 0.01);
          if (P.arm) P.arm.rotation.z += (S.gateOpen * 1.35 - P.arm.rotation.z) * Math.min(1, dt * 3);
          if (P.flood) { P.flood.intensity = night * 160; P.lamp.material.emissiveIntensity = night * 3; }
          if (P.flag) { var fp = P.flag.geometry.attributes.position.array, fb = P.flagBase; for (var q = 0; q < fp.length; q += 3) { var u = (fb[q] + 0.8) / 1.6; fp[q + 2] = Math.sin(S.t * 5 + u * 5) * 0.1 * u; } P.flag.geometry.attributes.position.needsUpdate = true; }
        });
        dusts.forEach(function (d) { if (d.userData.life <= 0) { d.material.opacity = 0; return; } d.userData.life -= dt; var a = d.userData.life / d.userData.max; d.position.y += d.userData.vy * dt; d.position.x += d.userData.vx * dt * (moving ? 1 : 0.3); d.scale.setScalar(0.4 + (1 - a) * 1.6 * d.userData.big); d.material.opacity = a * 0.45; });
        smokes.forEach(function (sm) { if (sm.userData.life <= 0) { sm.material.opacity = 0; return; } sm.userData.life -= dt; var a = sm.userData.life / sm.userData.max; sm.position.y += 0.9 * dt; sm.position.x -= 1.2 * dt; sm.scale.setScalar(0.25 + (1 - a) * 1.2); sm.material.opacity = a * 0.35; });
      }
      headlights.forEach(function (sp) { sp.intensity = night * 110; }); glows.forEach(function (sp) { sp.material.opacity = night * 0.75; });
      lamps.forEach(function (l) { l.material.emissiveIntensity = l.material.color.r > 0.9 && l.material.color.g > 0.8 ? 0.1 + night * 4 : 0.3 + night * 2.5; });
      S.punch = Math.max(0, S.punch - dt * 2);
      var sway = moving && !reduce() ? 1 : 0;
      camera.position.set(camBase.x + Math.sin(S.t * 0.7) * 0.15 * sway, camBase.y + Math.sin(S.t * 11) * 0.02 * sway - S.punch * 0.08, camBase.z + Math.cos(S.t * 0.5) * 0.1 * sway);
      camera.lookAt(camLook.x + Math.sin(S.t * 0.4) * 0.2 * sway, camLook.y, camLook.z);
    };
    S.render = function () { St.render(S.t); S.tri = St.tri; S.calls = St.calls; };
    S.setQuality = function (q) { St.setQuality(q); };
    S.dispose = function () { St.dispose(); };
    S.resize(opts.width || 640, opts.height || 400);
    return S;
  };
})();
