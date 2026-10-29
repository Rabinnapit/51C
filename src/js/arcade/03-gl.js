/* ARCADE-03-GL — real-3D helpers on three.js (bundled from src/js/vendor): the WebGL probe, procedural PBR textures
   (nothing is an image file), the HDR sky that also lights the scene as its environment, the post pass (bloom, vignette,
   grain, a chromatic kick on each shot) and RangeScene: the desert qualification range with target boards, the M4A1,
   muzzle flash, smoke, brass, splinters, sparks, dust and bullet holes. A game owns the clock, the questions and the HUD;
   the scene only draws, into its own canvas; the game copies that frame onto the engine's 2D canvas each frame, so the
   engine's particles, floaters and shake stay on top. */
(function () {
  'use strict';
  var A = window.ARCADE; if (!A) return;
  var GL = A.GL = {};
  var THREE = window.THREE;
  function hash(i, seed) { var x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  GL.hash = hash;
  GL.ok = function () {
    if (!THREE) return false; if (GL._ok != null) return GL._ok;
    try { var c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'); GL._ok = !!g; if (g) { var lose = g.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); } } catch (e) { GL._ok = false; }
    return GL._ok;
  };

  // ---- procedural textures (built once, shared by every run) ----
  function fbm(size, seed, octaves, persist) {
    var out = new Float32Array(size * size), amp = 1, n = 4, total = 0, i;
    for (var o = 0; o < octaves; o++) {
      var grid = new Float32Array(n * n); for (i = 0; i < n * n; i++) grid[i] = hash(i, seed + o * 7.1);
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var fx = x / size * n, fy = y / size * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        var ix = x0 % n, iy = y0 % n, ix1 = (x0 + 1) % n, iy1 = (y0 + 1) % n;
        var a = grid[iy * n + ix], b = grid[iy * n + ix1], c = grid[iy1 * n + ix], d = grid[iy1 * n + ix1];
        out[y * size + x] += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty);
      }
      total += amp; amp *= persist; n *= 2;
    }
    for (i = 0; i < out.length; i++) out[i] /= total; return out;
  }
  function texFrom(size, fn, srgb) {
    var c = document.createElement('canvas'); c.width = c.height = size; var g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
    for (var y = 0, i = 0; y < size; y++) for (var x = 0; x < size; x++, i++) { var p = fn(i, x, y); d[i * 4] = p[0]; d[i * 4 + 1] = p[1]; d[i * 4 + 2] = p[2]; d[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0); var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function normalFrom(size, hgt, strength) {
    return texFrom(size, function (i, x, y) { var l = hgt[y * size + (x + size - 1) % size], r = hgt[y * size + (x + 1) % size], u = hgt[((y + size - 1) % size) * size + x], dn = hgt[((y + 1) % size) * size + x]; var nx = (l - r) * strength, ny = (u - dn) * strength, len = Math.sqrt(nx * nx + ny * ny + 1); return [(nx / len * 0.5 + 0.5) * 255, (ny / len * 0.5 + 0.5) * 255, (1 / len * 0.5 + 0.5) * 255]; });
  }
  function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function softTexture(inner, outer) { var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d'); var rg = g.createRadialGradient(64, 64, 4, 64, 64, 64); rg.addColorStop(0, inner); rg.addColorStop(0.35, outer); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128); var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  var TEX = null;
  GL.textures = function () {
    if (TEX) return TEX;
    var T = 256, sandH = fbm(T, 1, 5, 0.5), fine = fbm(T, 3, 6, 0.55), woodH = fbm(T, 2, 4, 0.5);
    TEX = {
      sand: texFrom(T, function (i) { var h = sandH[i], p = mix3([176, 150, 100], [222, 200, 150], h); if (fine[i] > 0.78) p = mix3(p, [110, 90, 60], 0.6); return p; }, true), sandN: normalFrom(T, sandH, 2.2),
      dirt: texFrom(T, function (i) { var h = sandH[i]; return mix3([98, 76, 50], [150, 120, 82], h * 0.8 + fine[i] * 0.2); }, true), dirtN: normalFrom(T, fine, 3),
      wood: texFrom(T, function (i, x, y) { var s = 0.5 + 0.5 * Math.sin(y * 0.22 + woodH[i] * 9); return mix3([112, 78, 44], [168, 128, 84], s * 0.7 + fine[i] * 0.3); }, true), woodN: normalFrom(T, woodH, 1.2),
      metal: texFrom(T, function (i) { var v = 36 + fine[i] * 18; return [v, v + 2, v + 5]; }, true), metalR: texFrom(T, function (i) { var v = 90 + fine[i] * 110; return [v, v, v]; }, false), metalN: normalFrom(T, fine, 0.6),
      paper: texFrom(128, function (i) { var v = 236 + fine[i * 4 % (T * T)] * 16; return [v, v - 4, v - 14]; }, true),
      rock: texFrom(T, function (i) { var v = 84 + sandH[i] * 70; return [v + 8, v, v - 8]; }, true),
      soft: softTexture('rgba(255,255,255,1)', 'rgba(255,255,255,.6)'), flash: softTexture('rgba(255,255,255,1)', 'rgba(255,220,130,.9)'),
      smoke: softTexture('rgba(200,200,200,.8)', 'rgba(170,170,170,.45)'), dust: softTexture('rgba(215,195,150,.9)', 'rgba(190,165,120,.5)'), cloud: softTexture('rgba(255,255,255,.95)', 'rgba(255,255,255,.55)'),
      fineH: fine
    };
    TEX.sand.repeat.set(80, 80); TEX.sandN.repeat.set(80, 80); TEX.dirt.repeat.set(12, 3); TEX.dirtN.repeat.set(12, 3); TEX.wood.repeat.set(1, 2); TEX.woodN.repeat.set(1, 2);
    return TEX;
  };

  // ---- the post pass: scene -> HDR target -> bright pass -> blur -> composite (ACES, bloom, vignette, grain, chromatic kick) ----
  GL.Post = function (renderer, isGL2) {
    var rtType = isGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')) ? THREE.HalfFloatType : THREE.UnsignedByteType;
    var samples = 0;
    var sceneRT = new THREE.WebGLRenderTarget(2, 2, { type: rtType, samples: samples }), brightRT = new THREE.WebGLRenderTarget(2, 2, { type: rtType }), blurA = new THREE.WebGLRenderTarget(2, 2, { type: rtType }), blurB = new THREE.WebGLRenderTarget(2, 2, { type: rtType });
    var QVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    var brightMat = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, threshold: { value: 1.0 } }, vertexShader: QVS, fragmentShader: 'uniform sampler2D tex; uniform float threshold; varying vec2 vUv; void main(){ vec3 c = texture2D(tex, vUv).rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float k = max(l - threshold, 0.0); gl_FragColor = vec4(c * (k / max(l, 1e-4)), 1.0); }' });
    var blurMat = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2(1, 0) }, texel: { value: new THREE.Vector2(1, 1) } }, vertexShader: QVS, fragmentShader: 'uniform sampler2D tex; uniform vec2 dir, texel; varying vec2 vUv; void main(){ float w[5]; w[0] = 0.227; w[1] = 0.194; w[2] = 0.121; w[3] = 0.054; w[4] = 0.016; vec3 c = texture2D(tex, vUv).rgb * w[0]; for (int i = 1; i < 5; i++) { vec2 o = dir * texel * float(i) * 1.5; c += texture2D(tex, vUv + o).rgb * w[i]; c += texture2D(tex, vUv - o).rgb * w[i]; } gl_FragColor = vec4(c, 1.0); }' });
    var compMat = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, bloom: { value: null }, strength: { value: 0.55 }, exposure: { value: 1.0 }, vig: { value: 0.35 }, grain: { value: 0.03 }, time: { value: 0 }, aberr: { value: 0 }, white: { value: 0 } }, vertexShader: QVS,
      fragmentShader: 'uniform sampler2D tex, bloom; uniform float strength, exposure, vig, grain, time, aberr, white; varying vec2 vUv;\n' +
        'vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }\n' +
        'void main(){ vec2 d = (vUv - 0.5) * aberr; vec3 c = vec3(texture2D(tex, vUv + d).r, texture2D(tex, vUv).g, texture2D(tex, vUv - d).b);' +
        ' c += texture2D(bloom, vUv).rgb * strength; c *= exposure; c = aces(c); c += white;' +
        ' float v = smoothstep(0.95, 0.25, distance(vUv, vec2(0.5)) * 1.1); c *= mix(1.0, v, vig);' +
        ' float g = fract(sin(dot(vUv * (time + 1.0), vec2(12.9898, 78.233))) * 43758.5453); c += (g - 0.5) * grain;' +
        ' gl_FragColor = vec4(pow(max(c, 0.0), vec3(1.0 / 2.2)), 1.0); }' });
    var quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat); quadScene.add(quad);
    function pass(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }
    var post = {
      u: compMat.uniforms, hdr: rtType === THREE.HalfFloatType,
      size: function (W, H) { sceneRT.setSize(W, H); brightRT.setSize(Math.max(1, W >> 1), Math.max(1, H >> 1)); blurA.setSize(Math.max(1, W >> 2), Math.max(1, H >> 2)); blurB.setSize(Math.max(1, W >> 2), Math.max(1, H >> 2)); },
      msaa: function (n) { if (!isGL2 || n === samples) return; samples = n; sceneRT.dispose(); sceneRT = new THREE.WebGLRenderTarget(Math.max(2, blurA.width << 2), Math.max(2, blurA.height << 2), { type: rtType, samples: n }); },
      render: function (scene, camera, time) {
        renderer.setRenderTarget(sceneRT); renderer.render(scene, camera); post.tri = renderer.info.render.triangles; post.calls = renderer.info.render.calls;
        brightMat.uniforms.tex.value = sceneRT.texture; pass(brightMat, brightRT);
        blurMat.uniforms.texel.value.set(1 / blurA.width, 1 / blurA.height);
        blurMat.uniforms.tex.value = brightRT.texture; blurMat.uniforms.dir.value.set(1, 0); pass(blurMat, blurA);
        blurMat.uniforms.tex.value = blurA.texture; blurMat.uniforms.dir.value.set(0, 1); pass(blurMat, blurB);
        blurMat.uniforms.tex.value = blurB.texture; blurMat.uniforms.dir.value.set(1, 0); pass(blurMat, blurA);
        blurMat.uniforms.tex.value = blurA.texture; blurMat.uniforms.dir.value.set(0, 1); pass(blurMat, blurB);
        compMat.uniforms.tex.value = sceneRT.texture; compMat.uniforms.bloom.value = blurB.texture; compMat.uniforms.time.value = time || 0;
        pass(compMat, null);
      },
      dispose: function () { [sceneRT, brightRT, blurA, blurB].forEach(function (r) { r.dispose(); }); brightMat.dispose(); blurMat.dispose(); compMat.dispose(); }
    };
    return post;
  };

  // ---- the range ----
  GL.RangeScene = function (opts) {
    opts = opts || {};
    if (!THREE) throw new Error('three.js is not loaded');
    var mobile = !!opts.mobile, reduce = opts.reduce || function () { return false; };
    var canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 4;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    var isGL2 = renderer.capabilities.isWebGL2;
    renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(58, 1, 0.05, 700), X = GL.textures();
    var S = { t: 0, boards: [], recoil: 0, flashT: 0, aberr: 0, white: 0, yaw: 0, pitch: 0, w: 4, h: 4, tri: 0, calls: 0, quality: 2 };
    var post = GL.Post(renderer, isGL2); post.msaa(mobile ? 2 : 4);
    function std(o) { return new THREE.MeshStandardMaterial(o); }
    var sandMat = std({ map: X.sand, normalMap: X.sandN, roughness: 0.95 }), dirtMat = std({ map: X.dirt, normalMap: X.dirtN, roughness: 0.98 }), woodMat = std({ map: X.wood, normalMap: X.woodN, roughness: 0.8 });
    var steelMat = std({ map: X.metal, roughnessMap: X.metalR, normalMap: X.metalN, metalness: 0.9, roughness: 0.5, color: 0x8a8f96 }), rockMat = std({ map: X.rock, roughness: 0.92 });
    var fineN = normalFrom(256, X.fineH, 0.8); fineN.repeat.set(4, 4); var concMat = std({ color: 0x9a9890, roughness: 0.9, normalMap: fineN });
    var bagTex = X.dirt.clone(); bagTex.repeat.set(2, 1); bagTex.needsUpdate = true; var bagMat = std({ map: bagTex, roughness: 0.95, color: 0xc9b58a });

    // sky, sun, environment
    var skyU = { top: { value: new THREE.Color(0x2d5f9a) }, horizon: { value: new THREE.Color(0xa9c9e6) }, bot: { value: new THREE.Color(0x7a7f74) }, sunDir: { value: new THREE.Vector3(0.5, 0.55, -0.4).normalize() }, sunColor: { value: new THREE.Color(0xfff2dc) }, haze: { value: 0.35 } };
    var skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: skyU,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 top, horizon, bot, sunDir, sunColor; uniform float haze; varying vec3 vW; void main(){ vec3 d = normalize(vW - cameraPosition); float h = d.y; vec3 sky = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.45)); sky = mix(bot, sky, smoothstep(-0.25, 0.03, h)); float s = max(dot(d, sunDir), 0.0); sky += sunColor * (pow(s, 1400.0) * 9.0 + pow(s, 24.0) * 0.35 + pow(s, 3.0) * haze); gl_FragColor = vec4(sky, 1.0); }' });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(550, 32, 16), skyMat));
    var envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), skyMat));
    var pmrem = new THREE.PMREMGenerator(renderer), envTex = pmrem.fromScene(envScene, 0.03).texture; scene.environment = envTex;
    scene.fog = new THREE.FogExp2(0xb9cbd6, 0.0042);
    scene.add(new THREE.HemisphereLight(0x9fc3e8, 0x8a7046, 0.35));
    var sun = new THREE.DirectionalLight(0xfff2dc, 2.8); sun.castShadow = true; sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30; sun.shadow.camera.near = 1; sun.shadow.camera.far = 220; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    sun.position.copy(skyU.sunDir.value).multiplyScalar(90); scene.add(sun); scene.add(sun.target); sun.target.position.set(0, 0, -12);

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
    [[-5.5, '25'], [-8.5, '50'], [-12, '75']].forEach(function (s) { var p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), woodMat); p.position.set(-4.4, 0.5, s[0]); p.castShadow = true; scene.add(p); var b = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), std({ map: signTexture(s[1] + ' m'), roughness: 0.7 })); b.position.set(-4.4, 1.1, s[0] + 0.04); scene.add(b); });
    var flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.8, 8), steelMat); flagPole.position.set(4.4, 1.4, -12); flagPole.castShadow = true; scene.add(flagPole);
    var flagGeo = new THREE.PlaneGeometry(1.1, 0.5, 8, 2), flag = new THREE.Mesh(flagGeo, std({ color: 0xe6b85a, roughness: 0.8, side: THREE.DoubleSide })); flag.position.set(4.4 + 0.56, 2.5, -12); flag.castShadow = true; scene.add(flag); var flagBase = flagGeo.attributes.position.array.slice();
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
    S.resize = function (w, h) {
      w = Math.max(4, Math.round(w)); h = Math.max(4, Math.round(h)); if (w === S.w && h === S.h) return;
      S.w = w; S.h = h; renderer.setSize(w, h, false); post.size(w, h); camera.aspect = w / h; baseFov = h > w ? 66 : 56; camera.fov = baseFov; camera.updateProjectionMatrix();
    };
    S.render = function () { post.u.aberr.value = S.aberr; post.u.white.value = S.white; post.render(scene, camera, S.t); S.tri = post.tri; S.calls = post.calls; };
    // quality: 2 full, 1 lighter shadows and no multisampling, 0 also no soft shadows
    S.setQuality = function (q) { if (q === S.quality) return; S.quality = q; post.msaa(q >= 2 ? (mobile ? 2 : 4) : 0); sun.shadow.mapSize.set(q >= 2 ? (mobile ? 1024 : 2048) : 1024, q >= 2 ? (mobile ? 1024 : 2048) : 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } renderer.shadowMap.type = q >= 1 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; renderer.shadowMap.needsUpdate = true; };
    S.dispose = function () { try { post.dispose(); pmrem.dispose(); envTex.dispose(); renderer.dispose(); var ext = renderer.getContext().getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) {} };
    S.canvas = canvas; S.camera = camera; S.scene = scene; S.hdr = post.hdr; S.gl2 = isGL2;
    S.resize(opts.width || 640, opts.height || 400);
    return S;
  };
})();
