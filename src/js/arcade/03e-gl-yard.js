/* ARCADE-03e-GL-YARD — YardScene on A.GL.Stage: Dispatch's floodlit yard at dusk. A conveyor brings each crate from the
   warehouse to the junction in front of the camera; the diverter arm swings toward the chosen bay and the crate flies
   into it (stacking when right, kicked out when wrong). The game owns the belt clock, the sorting lines and the scoring;
   the scene draws the yard, the belt, the crate with its label, the bays, the forklift and the lights. */
(function () {
  'use strict';
  var A = window.ARCADE; if (!A || !A.GL) return;
  var GL = A.GL, THREE = window.THREE, hash = GL.hash, clamp = GL.clamp;
  var YARD = { top: 0x0a2236, horizon: 0x8a6a62, bot: 0x2a2a2e, sunDir: [-0.6, 0.12, -0.5], sunColor: 0xc8906a, sun: 0.7, haze: 0.5, fog: 0x3a3a44, fogD: 0.0048, hemiSky: 0x3a4a6a, hemiGround: 0x22242a, hemi: 0.5, night: 0.45, exposure: 1.05 };

  GL.YardScene = function (opts) {
    opts = opts || {};
    var reduce = opts.reduce || function () { return false; };
    var St = GL.Stage({ mobile: opts.mobile, reduce: reduce, fov: 48, far: 600, shadow: { l: -22, r: 22, t: 14, b: -40, far: 200 }, light: YARD });
    var K = GL.kit(St), scene = St.scene, camera = St.camera, X = St.X, std = St.std, fx = K.fx, mobile = St.mobile, i;
    St.sun.target.position.set(0, 0, -8); St.push();
    var S = { t: 0, w: 4, h: 4, tri: 0, calls: 0, gl2: St.gl2, hdr: St.hdr, canvas: St.canvas, camera: camera, scene: scene, sel: 0, rushOn: false, crate: null, belt: 0, bays: [] };
    var BELT_FAR = -20, BELT_NEAR = -0.6, BAY_Z = 1.8;

    // ---- the yard: concrete, the warehouse, the belt, lights ----
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), std({ color: 0x8a8882, roughness: 0.92, normalMap: K.tex(X.dirtN, 30, 30), normalScale: new THREE.Vector2(0.3, 0.3) })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.01, -20); ground.receiveShadow = true; scene.add(ground);
    var wallMat = std({ color: 0x5a6670, roughness: 0.88 }), roofMat = std({ color: 0x3a434a, roughness: 0.75, metalness: 0.3 });
    var wh = K.box(scene, 30, 7, 10, 0, 3.5, -36, wallMat); [-1, 1].forEach(function (s) { var rf = K.box(scene, 31, 0.2, 5.6, 0, 8.2, -36 + s * 2.5, roofMat); rf.rotation.x = s * 0.3; });
    var doorTex = St.label('', { w: 128, h: 128, bg: '#2e353c', border: false }); (function () { var dc = doorTex.image.getContext('2d'); dc.strokeStyle = '#4a545c'; dc.lineWidth = 3; for (var k = 1; k < 10; k++) { dc.beginPath(); dc.moveTo(0, k * 12.8); dc.lineTo(128, k * 12.8); dc.stroke(); } doorTex.needsUpdate = true; })();
    [-10, 0, 10].forEach(function (x) { var d = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.6), std({ map: doorTex, roughness: 0.6, metalness: 0.3 })); d.position.set(x, 2.3, -30.99); scene.add(d); });
    K.sign(scene, 'DISPATCH', 0, -30.9, 6, 1.3, { post: 5.2, w: 768, h: 160, size: 100, bg: '#e6b85a', ink: '#1b1407' });
    for (i = 0; i < 10; i++) { var c = K.crate({ label: ['MRE', 'PARTS', 'WATER', 'MED', 'COMMS'][i % 5], color: ['#8f7a46', '#7d838c', '#3f93cf', '#eeeeee', '#5e7f36'][i % 5], ink: i % 5 === 3 ? '#c0392b' : '#fff' }, 1.1); c.position.set(-16 + (i % 5) * 1.3 + (i > 4 ? 0.1 : 0), 0.55 + (i > 4 ? 1.1 : 0), -24 - (i > 4 ? 0.05 : 0)); c.rotation.y = (hash(i, 5) - 0.5) * 0.2; scene.add(c); }
    for (i = 0; i < 6; i++) { var c2 = K.crate({ label: ['FUEL', 'MRE', 'PARTS'][i % 3], color: ['#c9473f', '#8f7a46', '#7d838c'][i % 3] }, 1.1); c2.position.set(13 + (i % 3) * 1.3, 0.55 + (i > 2 ? 1.1 : 0), -22); scene.add(c2); }
    // belt
    var beltLen = BELT_NEAR - BELT_FAR, beltCv = document.createElement('canvas'); beltCv.width = 64; beltCv.height = 256; (function () { var g = beltCv.getContext('2d'); g.fillStyle = '#2a3136'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#3c454b'; for (var k = 0; k < 8; k++) g.fillRect(0, k * 32, 64, 6); g.fillStyle = 'rgba(230,184,90,.35)'; for (k = 0; k < 4; k++) { g.beginPath(); g.moveTo(18, k * 64 + 10); g.lineTo(32, k * 64 + 22); g.lineTo(46, k * 64 + 10); g.lineTo(46, k * 64 + 16); g.lineTo(32, k * 64 + 28); g.lineTo(18, k * 64 + 16); g.closePath(); g.fill(); } })();
    var beltTex = new THREE.CanvasTexture(beltCv); beltTex.colorSpace = THREE.SRGBColorSpace; beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping; beltTex.repeat.set(1, beltLen / 2.4);
    var belt = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, beltLen), std({ map: beltTex, roughness: 0.85 })); belt.position.set(0, 0.35, (BELT_FAR + BELT_NEAR) / 2); belt.castShadow = belt.receiveShadow = true; scene.add(belt);
    [-1, 1].forEach(function (s) { K.box(scene, 0.12, 0.9, beltLen, s * 0.95, 0.45, (BELT_FAR + BELT_NEAR) / 2, K.mat.steel); for (var k = 0; k < 6; k++) K.box(scene, 0.1, 0.7, 0.1, s * 0.95, 0.35, BELT_FAR + k * beltLen / 5.5, K.mat.dark); });
    var hz = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), std({ map: (function () { var cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; var g = cv.getContext('2d'); for (var k = 0; k < 16; k++) { g.fillStyle = k % 2 ? '#e6b85a' : '#1a1a1a'; g.beginPath(); g.moveTo(k * 16, 0); g.lineTo(k * 16 + 16, 0); g.lineTo(k * 16 + 8, 32); g.lineTo(k * 16 - 8, 32); g.closePath(); g.fill(); } var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })(), roughness: 0.9 })); hz.rotation.x = -Math.PI / 2; hz.position.set(0, 0.01, 1.6); scene.add(hz);
    // the diverter: a pivot at the end of the belt and an arm that swings toward the chosen bay
    var pivot = new THREE.Group(); pivot.position.set(0, 0.75, BELT_NEAR + 0.3); scene.add(pivot);
    K.tube(scene, 0.14, 1.5, 0, 0.75, BELT_NEAR + 0.3, K.mat.steel, 'y'); var arm = K.box(pivot, 0.16, 0.3, 2.4, 0, 0.4, 1.2, K.mat.yellow); var armTip = K.box(pivot, 0.4, 0.34, 0.3, 0, 0.4, 2.4, K.mat.dark);
    // floodlights
    var floods = [];
    [[-9, -6], [9, -6], [0, -18]].forEach(function (p) { var pole = K.tube(scene, 0.07, 8, p[0], 4, p[1], K.mat.steel, 'y'); K.box(scene, 0.6, 0.3, 0.5, p[0], 8.1, p[1] + 0.2, K.mat.dark); var lamp = K.box(scene, 0.4, 0.14, 0.4, p[0], 7.95, p[1] + 0.25, K.mat.lamp.clone()); lamp.material.emissiveIntensity = 2.5; var sp = new THREE.SpotLight(0xfff0d0, 90, 40, 0.75, 0.5, 1.4); sp.position.set(p[0], 8, p[1]); sp.target.position.set(p[0] * 0.3, 0, p[1] + 8); scene.add(sp); scene.add(sp.target); floods.push({ sp: sp, lamp: lamp }); });
    var rushLight = new THREE.PointLight(0xff7ab6, 0, 30, 2); rushLight.position.set(0, 4, 0); scene.add(rushLight);
    // the forklift drives across the back
    var fl = K.forklift(); fl.position.set(-8, 0, -14); scene.add(fl); var flDir = 1;
    var person = K.person(false); person.position.set(4.2, 0, -2.6); person.rotation.y = -2.2; scene.add(person);

    // ---- crates on the belt: a box with a label board that faces the camera ----
    var labelCache = {};
    function textTexture(text, tag) {
      var key = text + '|' + tag; if (labelCache[key]) return labelCache[key];
      var cv = document.createElement('canvas'); cv.width = 768; cv.height = 288; var g = cv.getContext('2d');
      g.fillStyle = '#f3e7cf'; g.fillRect(0, 0, 768, 288); g.strokeStyle = '#5a4020'; g.lineWidth = 10; g.strokeRect(0, 0, 768, 288);
      g.fillStyle = 'rgba(60,40,20,.55)'; g.font = A.font(26, 'mono', 800); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(tag || 'B2B · HANDLE WITH CARE', 24, 42);
      var sizes = [60, 52, 46, 40, 34], fs = 60, lines = [text];
      for (var k = 0; k < sizes.length; k++) { fs = sizes[k]; g.font = A.font(fs, 'body', 800); lines = A.wrap(g, text, 700); if (lines.length <= (fs <= 40 ? 4 : 3)) break; }
      g.fillStyle = '#2f2112'; g.textAlign = 'center'; g.textBaseline = 'middle'; var y0 = 168 - (lines.length - 1) * fs * 0.6; lines.forEach(function (ln, j) { g.fillText(ln, 384, y0 + j * fs * 1.18); });
      var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      var keys = Object.keys(labelCache); if (keys.length > 24) { labelCache[keys[0]].dispose(); delete labelCache[keys[0]]; }
      return labelCache[key] = t;
    }
    function makeCrate(text, tag) {
      var g = new THREE.Group(), box = K.crate({ label: 'B2B', color: '#8a6a3a' }, 1.3); box.position.y = 0.65; g.add(box);
      var board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({ map: textTexture(text, tag), transparent: false })); board.position.set(0, 1.95, 0.2); board.rotation.x = -0.55; g.add(board); g.userData.board = board; g.userData.box = box;
      return g;
    }
    S.setCrate = function (text, tag) { if (S.crate) { scene.remove(S.crate.g); S.crate = null; } if (!text) return; var g = makeCrate(text, tag); g.position.set(0, 0.7, BELT_FAR + 1); scene.add(g); S.crate = { g: g, text: text, k: 0, pop: 0 }; };
    S.crateAt = function (k) { if (S.crate) S.crate.k = clamp(k, 0, 1); };
    var flying = [], stacks = [];
    S.drop = function (bayIx, ok) {
      if (!S.crate) return; var c = S.crate; S.crate = null; var bay = S.bays[bayIx] || S.bays[0]; if (!bay) { scene.remove(c.g); return; }
      var from = c.g.position.clone(), to = new THREE.Vector3(bay.x + (hash(stacks.length, 9) - 0.5) * 0.6, 0.65, BAY_Z + (hash(stacks.length, 11) - 0.5) * 0.5);
      flying.push({ g: c.g, from: from, to: to, t: 0, T: 0.55, ok: ok, bay: bayIx, landed: false });
    };
    S.flashBay = function (i, ok, k) { var b = S.bays[i]; if (!b) return; b.flash = clamp(k, 0, 1); b.flashOk = ok; };
    S.setBays = function (bins) {
      S.bays.forEach(function (b) { scene.remove(b.g); }); stacks.forEach(function (m) { scene.remove(m); }); stacks = []; S.bays = [];
      var n = bins.length, bayW = Math.min(3.6, (2 * S.halfW - 0.3) / n), sc = bayW / 3.6;
      S.bays = bins.map(function (bin, k) {
        var g = new THREE.Group(), x = (k - (n - 1) / 2) * bayW; g.position.set(x, 0, BAY_Z); g.scale.setScalar(sc);
        var pad = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 3.0), std({ color: 0x20282d, roughness: 0.9 })); pad.position.y = 0.06; pad.receiveShadow = true; g.add(pad);
        var stripe = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.3), std({ color: new THREE.Color(bin.color || '#e6b85a'), emissive: new THREE.Color(bin.color || '#e6b85a'), emissiveIntensity: 0.4, roughness: 0.6 })); stripe.position.set(0, 0.13, 1.4); g.add(stripe);
        [-1, 1].forEach(function (s) { K.box(g, 0.14, 1.3, 0.14, s * 1.55, 0.65, 1.45, K.mat.steel); });
        var sign = K.sign(g, bin.label + (bin.sub ? '\n' + bin.sub : ''), 0, -1.35, 3.0, 1.1, { post: 1.5, w: 768, h: 288, size: bin.sub ? 74 : 92, bg: '#1c2227', ink: '#ffffff', fam: 'body' });
        var num = K.sign(g, String(k + 1), -1.3, 1.2, 0.5, 0.5, { post: 0.9, w: 128, h: 128, size: 80, bg: new THREE.Color(bin.color || '#e6b85a').getStyle(), ink: '#10140c' });
        var hit = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 3.4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.3; hit.userData.bay = k; g.add(hit);
        scene.add(g); return { g: g, x: x, pad: pad, stripe: stripe, sign: sign, num: num, hit: hit, flash: 0, flashOk: false, color: bin.color, bin: bin };
      });
      S.binsNow = bins; return S.bays;
    };
    S.select = function (i) { S.sel = i; };
    S.rush = function (on) { S.rushOn = !!on; };
    S.bayPoint = function (i) { var b = S.bays[i]; return b ? new THREE.Vector3(b.x, 1.6, BAY_Z) : new THREE.Vector3(0, 1, BAY_Z); };
    S.project = function (v) { var p = v.clone().project(camera); return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 }; };
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    // what is under a screen point: { bay: index } or { crate: true } or null
    S.pick = function (nx, ny) {
      ndc.set(nx, ny); ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(S.bays.map(function (b) { return b.hit; }), false); if (hits.length) return { bay: hits[0].object.userData.bay };
      if (S.crate) { var ch = ray.intersectObject(S.crate.g, true); if (ch.length) return { crate: true }; }
      return null;
    };

    // ---- camera, update ----
    var camBase = new THREE.Vector3(0, 8.6, 12.2), camLook = new THREE.Vector3(0, 1.0, -4), portrait = false; S.halfW = 6;
    S.resize = function (w, h) {
      if (!St.resize(w, h)) return; S.w = St.w; S.h = St.h; var aspect = S.w / S.h; portrait = aspect < 1.1;
      camera.fov = portrait ? 66 : 56; camera.updateProjectionMatrix(); camBase.set(0, portrait ? 9.6 : 8.6, portrait ? 13.5 : 12.2); camLook.set(0, 1.0, portrait ? -4.5 : -4);
      var dist = Math.sqrt(Math.pow(camBase.z - BAY_Z, 2) + camBase.y * camBase.y); S.halfW = dist * Math.tan(camera.fov / 2 * Math.PI / 180) * aspect * 0.9;
      if (S.binsNow) { var sel = S.sel; S.setBays(S.binsNow); S.sel = sel; }
    };
    S.update = function (dt, frozen) {
      S.t += dt;
      if (!frozen) {
        S.belt += dt * (S.rushOn ? 1.6 : 1); beltTex.offset.y = -S.belt * 0.6;
        if (S.crate) { var c = S.crate; c.pop = Math.min(1, c.pop + dt * 5); c.g.position.z = BELT_FAR + 1 + (BELT_NEAR - 1.6 - BELT_FAR - 1) * c.k; c.g.position.y = 0.7 + Math.sin(S.belt * 20) * 0.01; var sc = 1 + (1 - A.ease.outBack(c.pop)) * 0.3; c.g.scale.setScalar(sc); c.g.userData.board.lookAt(camera.position); }
        var want = S.bays[S.sel] ? Math.atan2(S.bays[S.sel].x, BAY_Z - BELT_NEAR) : 0; pivot.rotation.y += (-want - pivot.rotation.y) * Math.min(1, dt * 10);
        for (var k = flying.length - 1; k >= 0; k--) {
          var f = flying[k]; f.t += dt; var u = Math.min(1, f.t / f.T), e = A.ease.inOutQuad(u);
          f.g.position.lerpVectors(f.from, f.to, e); f.g.position.y += Math.sin(u * Math.PI) * 2.6; f.g.rotation.y = e * (f.to.x > f.from.x ? 1.2 : -1.2); f.g.userData.board.lookAt(camera.position);
          if (u >= 1 && !f.landed) { f.landed = true; if (f.ok) { fx.dust(f.to, 4); stacks.push(f.g); f.g.rotation.y = (hash(stacks.length, 17) - 0.5) * 0.4; f.g.userData.board.visible = false; f.g.position.y = 0; while (stacks.length > 6) { var old = stacks.shift(); scene.remove(old); } } else { fx.sparks(f.to, 16, 5); fx.flash(f.to, 1.6, new THREE.Color(5, 3, 1)); f.kick = 0.001; } }
          if (f.landed && f.kick) { f.kick += dt; f.g.position.x += (f.to.x >= 0 ? 1 : -1) * 6 * dt; f.g.position.y = Math.max(0, Math.sin(Math.min(1, f.kick / 0.6) * Math.PI) * 2.2); f.g.rotation.z += dt * 7; f.g.rotation.x += dt * 4; if (f.kick > 0.75) { scene.remove(f.g); flying.splice(k, 1); } continue; }
          if (f.landed) flying.splice(k, 1);
        }
        S.bays.forEach(function (b, j) { var on = j === S.sel; b.stripe.material.emissiveIntensity = on ? 1.6 + Math.sin(S.t * 8) * 0.4 : 0.35; b.sign.position.y = on ? 0.12 : 0; if (b.flash > 0) { b.flash = Math.max(0, b.flash - dt * 1.4); b.pad.material.emissive = new THREE.Color(b.flashOk ? 0x1f7f50 : 0x7f1f1f); b.pad.material.emissiveIntensity = b.flash * 0.9; } else b.pad.material.emissiveIntensity = 0; });
        fl.position.x += flDir * dt * 1.6; if (fl.position.x > 9) flDir = -1; if (fl.position.x < -9) flDir = 1; fl.rotation.y = flDir > 0 ? 0 : Math.PI; fl.userData.wheels.forEach(function (w) { w.m.rotation.z -= flDir * dt * 1.6 / w.r; }); fl.userData.beacon.material.emissiveIntensity = Math.sin(S.t * 6) > 0 ? 2.5 : 0.3;
        person.userData.arm.rotation.z = -0.2 + Math.sin(S.t * 1.2) * 0.1;
        fx.step(dt);
      }
      rushLight.intensity = S.rushOn ? 40 + Math.sin(S.t * 10) * 15 : 0;
      camera.position.set(camBase.x + Math.sin(S.t * 0.5) * 0.05, camBase.y, camBase.z); camera.lookAt(camLook);
    };
    S.render = function () { St.render(S.t); S.tri = St.tri; S.calls = St.calls; };
    S.setQuality = function (q) { St.setQuality(q); };
    S.dispose = function () { St.dispose(); };
    S.resize(opts.width || 640, opts.height || 400);
    return S;
  };
})();
