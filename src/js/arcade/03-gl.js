/* ARCADE-03-GL — real-3D helpers on three.js (bundled from src/js/vendor): the WebGL probe, procedural PBR textures
   (nothing is an image file), the post pass (bloom, vignette, grain, a chromatic kick on each shot), lighting presets from
   dawn to night, the Stage every scene starts from (renderer, camera, the HDR sky that also lights the scene, sun with soft
   shadows, haze), RangeScene (the desert qualification range, the M4A1 and its effects) and RoadScene (Supply Line's
   convoy, the road and its five checkpoints). A game owns the clock, the questions and the HUD; a scene only draws, into
   its own canvas; the game copies that frame onto the engine's 2D canvas each frame, so the engine's particles, floaters
   and shake stay on top. */
(function () {
  'use strict';
  var A = window.ARCADE; if (!A) return;
  var GL = A.GL = {};
  var THREE = window.THREE;
  function hash(i, seed) { var x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  GL.hash = hash; GL.clamp = clamp;
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
  GL.fbm = fbm; GL.normalFrom = normalFrom; GL.texFrom = texFrom; GL.softTexture = softTexture;
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
      road: texFrom(T, function (i, x, y) { var v = 46 + fine[i] * 22 + sandH[i] * 8, u = x / T, w = y / T, p = [v, v + 1, v + 3]; if (Math.abs(w - 0.5) < 0.012 && u < 0.42) p = [214, 178, 60]; if (Math.abs(w - 0.055) < 0.01 || Math.abs(w - 0.945) < 0.01) p = [212, 210, 200]; return p; }, true),
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

  // ---- lighting presets: the sky, the sun, the haze and the fill light of one time of day. A scene applies one or blends
  //      two (Supply Line drives from dawn to night). `night` fades in the stars and the headlights. ----
  GL.LIGHT = {
    day: { top: 0x2d5f9a, horizon: 0xa9c9e6, bot: 0x7a7f74, sunDir: [0.5, 0.55, -0.4], sunColor: 0xfff2dc, sun: 2.8, haze: 0.35, fog: 0xb9cbd6, fogD: 0.0042, hemiSky: 0x9fc3e8, hemiGround: 0x8a7046, hemi: 0.35, night: 0, exposure: 1.0 },
    dawn: { top: 0x2a2060, horizon: 0xe8a080, bot: 0x6a5a62, sunDir: [0.85, 0.16, -0.35], sunColor: 0xffb27a, sun: 1.7, haze: 0.55, fog: 0xd2aaa4, fogD: 0.0052, hemiSky: 0x7a6aaa, hemiGround: 0x5a4a3a, hemi: 0.3, night: 0.05, exposure: 1.0 },
    gold: { top: 0x4a2a12, horizon: 0xf6c37c, bot: 0x8a6a3c, sunDir: [-0.7, 0.2, -0.45], sunColor: 0xffc27a, sun: 2.3, haze: 0.6, fog: 0xe4bd8c, fogD: 0.0046, hemiSky: 0xb08860, hemiGround: 0x6a5030, hemi: 0.3, night: 0, exposure: 1.0 },
    dusk: { top: 0x0a2e3a, horizon: 0x8fc4c8, bot: 0x3a4a4a, sunDir: [0.35, 0.08, -0.6], sunColor: 0xb08a6a, sun: 0.9, haze: 0.5, fog: 0x5f8a90, fogD: 0.0058, hemiSky: 0x4a7a88, hemiGround: 0x2a3a3a, hemi: 0.45, night: 0.35, exposure: 1.05 },
    night: { top: 0x04071a, horizon: 0x2a3a6e, bot: 0x141a2a, sunDir: [-0.35, 0.6, -0.4], sunColor: 0xa8bcff, sun: 0.45, haze: 0.15, fog: 0x1a2238, fogD: 0.0075, hemiSky: 0x3a4a7a, hemiGround: 0x14181f, hemi: 0.5, night: 1, exposure: 1.2 }
  };

  // ---- the stage every 3D scene starts from: renderer, camera, the HDR sky (also the environment light), sun with soft
  //      shadows, haze, fill light and the post pass. A scene adds its objects to St.scene and calls St.render(). ----
  GL.Stage = function (opts) {
    opts = opts || {};
    if (!THREE) throw new Error('three.js is not loaded');
    var mobile = !!opts.mobile;
    var canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 4;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    var isGL2 = renderer.capabilities.isWebGL2;
    renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(opts.fov || 58, 1, 0.05, opts.far || 700), X = GL.textures();
    var post = GL.Post(renderer, isGL2); post.msaa(mobile ? 2 : 4);
    var skyU = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0.5, 0.55, -0.4) }, sunColor: { value: new THREE.Color() }, haze: { value: 0.35 }, night: { value: 0 } };
    var skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: skyU,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 top, horizon, bot, sunDir, sunColor; uniform float haze, night; varying vec3 vW;\n' +
        'void main(){ vec3 d = normalize(vW - cameraPosition); float h = d.y; vec3 sky = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.45)); sky = mix(bot, sky, smoothstep(-0.25, 0.03, h));' +
        ' float s = max(dot(d, sunDir), 0.0); sky += sunColor * (pow(s, 1400.0) * 9.0 + pow(s, 24.0) * 0.35 + pow(s, 3.0) * haze);' +
        ' if (night > 0.001) { vec3 c = floor(d * 230.0); float r = fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); float tw = 0.6 + 0.4 * sin(r * 40.0 + vW.x * 0.01); sky += vec3(1.6, 1.7, 2.0) * smoothstep(0.994, 0.9985, r) * tw * night * smoothstep(0.02, 0.25, h); }' +
        ' gl_FragColor = vec4(sky, 1.0); }' });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(550, 32, 16), skyMat));
    var envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), skyMat));
    var pmrem = new THREE.PMREMGenerator(renderer), envTex = null;
    scene.fog = new THREE.FogExp2(0xb9cbd6, 0.0042);
    var hemi = new THREE.HemisphereLight(0x9fc3e8, 0x8a7046, 0.35); scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff2dc, 2.8), sb = opts.shadow || { l: -30, r: 30, t: 30, b: -30, far: 220 };
    sun.castShadow = true; sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    sun.shadow.camera.left = sb.l; sun.shadow.camera.right = sb.r; sun.shadow.camera.top = sb.t; sun.shadow.camera.bottom = sb.b; sun.shadow.camera.near = 1; sun.shadow.camera.far = sb.far || 220; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    scene.add(sun); scene.add(sun.target);
    var St = { canvas: canvas, renderer: renderer, gl2: isGL2, scene: scene, camera: camera, X: X, post: post, skyU: skyU, sun: sun, hemi: hemi, w: 4, h: 4, tri: 0, calls: 0, quality: 2, hdr: post.hdr, mobile: mobile, aberr: 0, white: 0, light: 'day' , reduce: opts.reduce || function () { return false; } };
    St.std = function (o) { return new THREE.MeshStandardMaterial(o); };
    // the live light values; set() copies a preset, blend() mixes two, push() writes them into the sky, sun, fog and fill
    var cur = { top: new THREE.Color(), horizon: new THREE.Color(), bot: new THREE.Color(), sunDir: new THREE.Vector3(), sunColor: new THREE.Color(), sun: 1, haze: 0.3, fog: new THREE.Color(), fogD: 0.004, hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), hemi: 0.3, night: 0, exposure: 1 };
    var ca = new THREE.Color(), cb = new THREE.Color(), va = new THREE.Vector3(), vb = new THREE.Vector3();
    function colorKeys() { return ['top', 'horizon', 'bot', 'sunColor', 'fog', 'hemiSky', 'hemiGround']; }
    function numKeys() { return ['sun', 'haze', 'fogD', 'hemi', 'night', 'exposure']; }
    function presetOf(p) { return typeof p === 'string' ? GL.LIGHT[p] || GL.LIGHT.day : p; }
    St.setLight = function (p, name) {
      p = presetOf(p); colorKeys().forEach(function (k) { cur[k].setHex(p[k]); }); numKeys().forEach(function (k) { cur[k] = p[k]; });
      cur.sunDir.set(p.sunDir[0], p.sunDir[1], p.sunDir[2]).normalize(); St.light = name || (typeof p === 'string' ? p : St.light); St.push();
    };
    St.blendLight = function (a, b, k) {
      a = presetOf(a); b = presetOf(b); k = clamp(k, 0, 1);
      colorKeys().forEach(function (key) { ca.setHex(a[key]); cb.setHex(b[key]); cur[key].lerpColors(ca, cb, k); });
      numKeys().forEach(function (key) { cur[key] = a[key] + (b[key] - a[key]) * k; });
      va.set(a.sunDir[0], a.sunDir[1], a.sunDir[2]).normalize(); vb.set(b.sunDir[0], b.sunDir[1], b.sunDir[2]).normalize(); cur.sunDir.lerpVectors(va, vb, k).normalize(); St.push();
    };
    St.push = function () {
      skyU.top.value.copy(cur.top); skyU.horizon.value.copy(cur.horizon); skyU.bot.value.copy(cur.bot); skyU.sunDir.value.copy(cur.sunDir); skyU.sunColor.value.copy(cur.sunColor); skyU.haze.value = cur.haze; skyU.night.value = cur.night;
      sun.color.copy(cur.sunColor); sun.intensity = cur.sun; sun.position.copy(cur.sunDir).multiplyScalar(90).add(sun.target.position);
      scene.fog.color.copy(cur.fog); scene.fog.density = cur.fogD; hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGround); hemi.intensity = cur.hemi;
      post.u.exposure.value = cur.exposure;
    };
    St.night = function () { return cur.night; };
    // the environment map comes from the sky: rebuilt when the light changes for good (a few milliseconds), not every frame
    St.refreshEnv = function () { var old = envTex; envTex = pmrem.fromScene(envScene, 0.03).texture; scene.environment = envTex; if (old) old.dispose(); };
    St.resize = function (w, h) {
      w = Math.max(4, Math.round(w)); h = Math.max(4, Math.round(h)); if (w === St.w && h === St.h) return false;
      St.w = w; St.h = h; renderer.setSize(w, h, false); post.size(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); return true;
    };
    St.render = function (t) { post.u.aberr.value = St.aberr; post.u.white.value = St.white; post.render(scene, camera, t); St.tri = post.tri; St.calls = post.calls; };
    // quality: 2 full, 1 lighter shadows and no multisampling, 0 also no soft shadows
    St.setQuality = function (q) { if (q === St.quality) return; St.quality = q; post.msaa(q >= 2 ? (mobile ? 2 : 4) : 0); var sz = q >= 2 ? (mobile ? 1024 : 2048) : 1024; sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } renderer.shadowMap.type = q >= 1 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; renderer.shadowMap.needsUpdate = true; };
    St.dispose = function () { try { post.dispose(); pmrem.dispose(); if (envTex) envTex.dispose(); renderer.dispose(); var ext = renderer.getContext().getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) {} };
    // position-hashed vertex jitter: the same vertex always moves the same way, so shared edges stay closed
    St.jitter = function (geo, ax, ay, az, seed) { var p = geo.attributes.position; for (var i = 0; i < p.count; i++) { var key = Math.round(p.getX(i) * 97) * 3 + Math.round(p.getY(i) * 89) * 7 + Math.round(p.getZ(i) * 83) * 11, j = hash(key, seed) - 0.5; p.setXYZ(i, p.getX(i) * (1 + j * ax), p.getY(i) * (1 + j * ay), p.getZ(i) * (1 + j * az)); } geo.computeVertexNormals(); return geo; };
    // a canvas texture with text on a painted board (signs, labels)
    St.label = function (txt, o) { o = o || {}; var c = document.createElement('canvas'); c.width = o.w || 256; c.height = o.h || 128; var g = c.getContext('2d'); g.fillStyle = o.bg || '#f4ead6'; g.fillRect(0, 0, c.width, c.height); if (o.border !== false) { g.strokeStyle = o.ink || '#1c1a16'; g.lineWidth = Math.max(4, c.height * 0.07); g.strokeRect(0, 0, c.width, c.height); } g.fillStyle = o.ink || '#1c1a16'; g.font = A.font(o.size || c.height * 0.5, o.fam || 'display', o.weight || 800); g.textAlign = 'center'; g.textBaseline = 'middle'; var lines = String(txt).split('\n'); lines.forEach(function (ln, i) { g.fillText(ln, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * (o.size || c.height * 0.5) * 1.1 + 2); }); var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    St.setLight(opts.light || 'day', typeof opts.light === 'string' ? opts.light : 'day'); St.refreshEnv();
    return St;
  };

  // ---- the kit: props and effects the scenes share. kit(St) binds materials and particle pools to one stage. ----
  GL.kit = function (St) {
    var X = St.X, std = St.std, scene = St.scene, K = { St: St };
    function tex(t, rx, ry) { var c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; }
    K.tex = tex;
    var fineN = normalFrom(256, X.fineH, 0.8); fineN.repeat.set(4, 4);
    K.mat = {
      wood: std({ map: X.wood, normalMap: X.woodN, roughness: 0.8 }), steel: std({ map: X.metal, roughnessMap: X.metalR, normalMap: X.metalN, metalness: 0.9, roughness: 0.5, color: 0x8a8f96 }),
      rock: std({ map: X.rock, roughness: 0.92 }), conc: std({ color: 0x9a9890, roughness: 0.9, normalMap: fineN }), bag: std({ map: tex(X.dirt, 2, 1), roughness: 0.95, color: 0xc9b58a }),
      leaf: std({ color: 0x2f5a2a, roughness: 0.9 }), bush: std({ color: 0x5a6a3a, roughness: 0.95 }), trunk: std({ map: X.wood, roughness: 0.9, color: 0x8a6a48 }),
      tan: std({ color: 0xa8976a, roughness: 0.62, metalness: 0.1, normalMap: X.metalN }), green: std({ color: 0x5b6641, roughness: 0.62, metalness: 0.1, normalMap: X.metalN }), olive: std({ color: 0x4f5a3c, roughness: 0.7, metalness: 0.12, normalMap: X.metalN }),
      tire: std({ color: 0x1b1d1f, roughness: 0.95 }), hub: std({ color: 0x8a8060, roughness: 0.5, metalness: 0.4 }), glass: std({ color: 0x14202c, metalness: 0.7, roughness: 0.12 }),
      lamp: std({ color: 0xfff1c0, emissive: 0xfff1c0, emissiveIntensity: 0.1, roughness: 0.3 }), tail: std({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 0.3, roughness: 0.4 }), dark: std({ color: 0x2c2f33, roughness: 0.75, metalness: 0.2 }),
      yellow: std({ color: 0xd9a23a, roughness: 0.6, metalness: 0.2 }), wreck: std({ color: 0x1b1a18, roughness: 0.95 }), skin: std({ color: 0xc69c76, roughness: 0.7 })
    };
    K.box = function (parent, w, h, d, x, y, z, mat, ry) { var p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || K.mat.dark); p.position.set(x, y, z); if (ry) p.rotation.y = ry; p.castShadow = p.receiveShadow = true; parent.add(p); return p; };
    // a cylinder along x, y or z
    K.tube = function (parent, r, len, x, y, z, mat, axis, r2) { var g = new THREE.CylinderGeometry(r, r2 == null ? r : r2, len, 14); if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(Math.PI / 2); var p = new THREE.Mesh(g, mat || K.mat.steel); p.position.set(x, y, z); p.castShadow = true; parent.add(p); return p; };
    K.wheel = function (parent, x, z, r, wdt) { var geo = new THREE.CylinderGeometry(r, r, wdt, 18); geo.rotateX(Math.PI / 2); var w = new THREE.Mesh(geo, K.mat.tire); w.position.set(x, r, z); w.castShadow = true; parent.add(w); var hg = new THREE.CylinderGeometry(r * 0.55, r * 0.55, wdt + 0.02, 12); hg.rotateX(Math.PI / 2); w.add(new THREE.Mesh(hg, K.mat.hub)); return { m: w, r: r }; };
    // crates: a wooden box with a coloured label band, one material per label
    var crateGeo = new THREE.BoxGeometry(1, 1, 1), crateMats = {};
    K.crateMat = function (c) {
      var key = c.label + c.color; if (crateMats[key]) return crateMats[key];
      var cv = document.createElement('canvas'); cv.width = cv.height = 256; var g = cv.getContext('2d');
      g.drawImage(X.wood.image, 0, 0, 256, 256); g.fillStyle = 'rgba(0,0,0,.18)'; [84, 170].forEach(function (y) { g.fillRect(0, y, 256, 4); }); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 8; g.strokeRect(0, 0, 256, 256);
      g.fillStyle = c.color; g.fillRect(16, 96, 224, 64); g.fillStyle = c.ink || '#ffffff'; g.font = A.font(44, 'mono', 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.label, 128, 130);
      var t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return crateMats[key] = std({ map: t, roughness: 0.8 });
    };
    K.crate = function (c, size) { var m = new THREE.Mesh(crateGeo, K.crateMat(c || { label: 'B2B', color: '#8f7a46' })); if (size) m.scale.setScalar(size); m.castShadow = m.receiveShadow = true; return m; };
    // a text board (canvas label) on a post; faces +z unless rotated by the caller
    K.sign = function (parent, text, x, z, w, h, o) {
      o = o || {}; var g = new THREE.Group(); g.position.set(x, 0, z);
      var ph = o.post == null ? 2.2 : o.post; if (ph > 0) { var post = new THREE.Mesh(new THREE.BoxGeometry(0.1, ph, 0.1), K.mat.wood); post.position.set(0, ph / 2, 0); post.castShadow = true; g.add(post); }
      var mat = std({ map: St.label(text, { w: o.w || 512, h: o.h || 160, size: o.size || 92, bg: o.bg, ink: o.ink, fam: o.fam }), roughness: 0.7, emissive: 0x000000 });
      var b = new THREE.Mesh(new THREE.BoxGeometry(w || 2.2, h || 0.8, 0.06), mat); b.position.set(0, ph + (h || 0.8) / 2 - 0.05, 0.03); b.castShadow = true; g.add(b);
      if (o.ry) g.rotation.y = o.ry; parent.add(g); g.userData.board = b; return g;
    };
    // vehicles and figures
    K.truck = function (wheels, opts) {
      opts = opts || {}; var g = new THREE.Group(), body = opts.mat || K.mat.green, W = wheels || [];
      K.box(g, 7.0, 0.3, 2.0, 0, 0.95, 0, K.mat.dark); K.box(g, 2.1, 2.1, 2.3, 2.55, 1.95, 0, body);
      K.box(g, 0.1, 0.8, 2.0, 3.62, 2.25, 0, K.mat.glass); K.box(g, 1.2, 0.6, 0.06, 2.6, 2.2, 1.17, K.mat.glass); K.box(g, 1.2, 0.6, 0.06, 2.6, 2.2, -1.17, K.mat.glass);
      K.box(g, 0.3, 0.4, 2.4, 3.75, 0.9, 0, K.mat.dark); K.box(g, 0.1, 0.5, 1.4, 3.64, 1.35, 0, K.mat.dark);
      K.box(g, 0.06, 0.2, 0.3, 3.78, 1.2, 0.85, K.mat.lamp); K.box(g, 0.06, 0.2, 0.3, 3.78, 1.2, -0.85, K.mat.lamp);
      K.tube(g, 0.07, 1.4, 1.45, 3.4, -1.0, K.mat.steel, 'y'); K.box(g, 0.06, 0.3, 0.3, 3.0, 2.4, 1.3, K.mat.dark); K.box(g, 0.06, 0.3, 0.3, 3.0, 2.4, -1.3, K.mat.dark);
      K.box(g, 4.4, 0.12, 2.3, -0.9, 1.16, 0, K.mat.wood);
      if (!opts.flat) { K.box(g, 4.4, 0.55, 0.06, -0.9, 1.5, 1.15, K.mat.wood); K.box(g, 4.4, 0.55, 0.06, -0.9, 1.5, -1.15, K.mat.wood); K.box(g, 0.06, 0.9, 2.3, 1.28, 1.67, 0, K.mat.wood); K.box(g, 0.06, 0.5, 2.3, -3.1, 1.47, 0, K.mat.wood); }
      if (opts.canvas) { var cv = K.box(g, 4.3, 1.5, 2.3, -0.95, 2.45, 0, K.mat.olive); cv.castShadow = true; }
      [[-2.6, 1.2], [-2.6, -1.2], [-1.4, 1.2], [-1.4, -1.2], [2.5, 1.2], [2.5, -1.2]].forEach(function (p) { W.push(K.wheel(g, p[0], p[1], 0.55, 0.38)); });
      return g;
    };
    K.forklift = function () {
      var fl = new THREE.Group();
      K.box(fl, 1.7, 0.8, 1.1, 0, 0.75, 0, K.mat.yellow); K.box(fl, 0.9, 0.9, 1.0, -0.3, 1.6, 0, K.mat.dark); K.box(fl, 0.08, 2.4, 0.1, 1.0, 1.4, 0.35, K.mat.steel); K.box(fl, 0.08, 2.4, 0.1, 1.0, 1.4, -0.35, K.mat.steel);
      var forks = new THREE.Group(); forks.position.set(1.0, 0.3, 0); K.box(forks, 1.1, 0.05, 0.12, 0.5, 0, 0.3, K.mat.steel); K.box(forks, 1.1, 0.05, 0.12, 0.5, 0, -0.3, K.mat.steel); fl.add(forks); fl.userData.forks = forks;
      var ws = []; [[0.5, 0.6], [0.5, -0.6], [-0.6, 0.6], [-0.6, -0.6]].forEach(function (p) { ws.push(K.wheel(fl, p[0], p[1], 0.28, 0.25)); }); fl.userData.wheels = ws;
      var beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), std({ color: 0xffa020, emissive: 0xff9000, emissiveIntensity: 1.5 })); beacon.position.set(-0.3, 2.1, 0); fl.add(beacon); fl.userData.beacon = beacon;
      return fl;
    };
    K.person = function (civ) {
      var g = new THREE.Group(), uni = std({ color: civ ? 0x7d6a52 : 0x6b6a4e, roughness: 0.85 }), pants = std({ color: civ ? 0x3a4a6a : 0x5f5e45, roughness: 0.85 });
      [-0.12, 0.12].forEach(function (z) { var leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 3, 8), pants); leg.position.set(0, 0.42, z); leg.castShadow = true; g.add(leg); });
      var torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 3, 10), uni); torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
      var armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 3, 8), uni); armL.position.set(0, 0.95, -0.3); armL.rotation.x = 0.15; g.add(armL);
      var armR = new THREE.Group(); armR.position.set(0, 1.28, 0.28); var ar = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 3, 8), uni); ar.position.y = -0.28; armR.add(ar); g.add(armR); g.userData.arm = armR;
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), K.mat.skin); head.position.y = 1.55; head.castShadow = true; g.add(head);
      if (civ) { var hat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12), K.mat.dark); hat.position.y = 1.68; g.add(hat); var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 12), K.mat.dark); brim.position.y = 1.64; g.add(brim); }
      else { var helm = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), uni); helm.position.y = 1.56; helm.castShadow = true; g.add(helm); }
      return g;
    };
    // scenery
    K.tree = function (seed) { var g = new THREE.Group(), th = 4.5 + hash(seed, 61) * 3.5, trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, th, 7), K.mat.trunk); trunk.position.y = th / 2; trunk.castShadow = true; g.add(trunk); for (var k = 0; k < 3; k++) { var fol = new THREE.Mesh(St.jitter(new THREE.IcosahedronGeometry(1, 1), 0.35, 0.35, 0.35, 200 + seed * 3 + k), K.mat.leaf), fs = 1.9 + hash(seed + k, 63) * 1.6; fol.scale.setScalar(fs); fol.position.set((hash(seed, k + 70) - 0.5) * 1.8, th - 0.8 + k * 1.3, (hash(seed, k + 80) - 0.5) * 1.8); fol.castShadow = true; g.add(fol); } return g; };
    K.rock = function (seed, rs) { var rk = new THREE.Mesh(St.jitter(new THREE.IcosahedronGeometry(1, 1), 0.5, 0.6, 0.5, 100 + seed), K.mat.rock); rs = rs || 0.3 + hash(seed, 41) * 1.1; rk.scale.setScalar(rs); rk.position.y = rs * 0.35 - 0.1; rk.rotation.y = hash(seed, 49) * 6; rk.castShadow = rk.receiveShadow = true; return rk; };
    K.bush = function (seed) { var bs = new THREE.Mesh(St.jitter(new THREE.IcosahedronGeometry(1, 1), 0.4, 0.3, 0.4, 300 + seed), K.mat.bush), bsc = 0.35 + hash(seed, 51) * 0.5; bs.scale.set(bsc * 1.3, bsc, bsc * 1.3); bs.position.y = bsc * 0.5; bs.castShadow = true; return bs; };
    K.sandbags = function (g, cx, cz, n, rad) { for (var k = 0; k < n; k++) { var a = k / n * Math.PI * 2, bg = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.45, 4, 8), K.mat.bag); bg.rotation.z = Math.PI / 2; bg.rotation.y = a + Math.PI / 2; bg.position.set(cx + Math.cos(a) * rad, 0.18 + (k % 2) * 0.3, cz + Math.sin(a) * rad); bg.castShadow = bg.receiveShadow = true; g.add(bg); } };
    // a strip of hills: a displaced plane coloured sand -> green -> rock by height. o: len, depth, segs, xc, zc, amp, seed, near, far, fn(x, z) optional height override
    K.hills = function (group, o) {
      var geo = new THREE.PlaneGeometry(o.len, o.depth, o.segs, Math.max(8, Math.round(o.segs * o.depth / o.len * 2))); geo.rotateX(-Math.PI / 2); geo.translate(o.xc || 0, 0, o.zc);
      var pos = geo.attributes.position, hf = fbm(128, o.seed || 7, 5, 0.55), col = new Float32Array(pos.count * 3), c = new THREE.Color(), amp = o.amp;
      for (var k = 0; k < pos.count; k++) {
        var x = pos.getX(k), z = pos.getZ(k), u = Math.floor((((x - (o.xc || 0) + o.len / 2) / o.len * 4) % 1) * 127), v = Math.floor(clamp((z - (o.zc - o.depth / 2)) / o.depth, 0, 0.999) * 127);
        var hgt = hf[v * 128 + u], y = o.fn ? o.fn(x, z, hgt) : Math.pow(hgt, 1.6) * amp * clamp((o.near - z) / (o.near - o.far), 0, 1) - 0.4;
        pos.setY(k, y); var g = clamp((y - amp * 0.12) / (amp * 0.5), 0, 1), rock = clamp((y - amp * 0.55) / (amp * 0.4), 0, 1);
        c.setRGB(0.72, 0.62, 0.42).lerp(new THREE.Color(0.33, 0.45, 0.24), g).lerp(new THREE.Color(0.5, 0.47, 0.44), rock); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
      geo.computeVertexNormals(); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      var m = new THREE.Mesh(geo, std({ vertexColors: true, roughness: 0.96, normalMap: tex(X.dirtN, o.len / 10, o.depth / 10) })); m.receiveShadow = true; group.add(m); return m;
    };

    // ---- effects: pooled sprites and points, one step() a frame ----
    var reduce = St.reduce || function () { return false; };
    function spritePool(n, map, color, additive) { var out = []; for (var i = 0; i < n; i++) { var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: map, color: color || 0xffffff, transparent: true, depthWrite: false, opacity: 0, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })); s.userData = { life: 0, max: 1 }; scene.add(s); out.push(s); } return out; }
    function pointsSet(n, color, size, additive) { var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [], life = new Float32Array(n); for (var i = 0; i < n; i++) { pos[i * 3 + 1] = -100; vel.push(new THREE.Vector3()); } geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); var mat = new THREE.PointsMaterial({ color: color, size: size, sizeAttenuation: true, map: X.soft, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, transparent: true }); var pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts); return { geo: geo, pos: pos, vel: vel, life: life, n: n, g: additive ? 12 : 9.8 }; }
    var dusts = spritePool(24, X.dust), smokes = spritePool(16, X.smoke, 0x9a9a9a), flashes = spritePool(8, X.flash, 0xffffff, true), fires = spritePool(10, X.flash, 0xff9a30, true);
    var sparks = pointsSet(90, new THREE.Color(5, 3, 1.2), 0.08, true), debris = pointsSet(70, 0x4a3a2a, 0.09, false);
    var lights = []; for (var li = 0; li < 2; li++) { var pl = new THREE.PointLight(0xffc070, 0, 40, 2); pl.userData.life = 0; scene.add(pl); lights.push(pl); }
    var scorches = [], scorchMat = new THREE.MeshBasicMaterial({ color: 0x120e0a, transparent: true, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    function take(pool) { for (var i = 0; i < pool.length; i++) if (pool[i].userData.life <= 0) return pool[i]; return null; }
    var fx = K.fx = {};
    fx.dust = function (p, n, big) { if (reduce()) return; for (var k = 0; k < n; k++) { var d = take(dusts); if (!d) return; d.userData.life = d.userData.max = (big ? 1.4 : 0.8) + Math.random() * 0.4; d.position.set(p.x + (Math.random() - 0.5) * (big ? 2 : 0.8), p.y + 0.1, p.z + (Math.random() - 0.5) * (big ? 2 : 0.6)); d.userData.vx = (Math.random() - 0.5) * 2; d.userData.vy = 0.6 + Math.random() * 0.6; d.userData.vz = (Math.random() - 0.5) * 2; d.userData.size = big ? 3.5 : 1.2; d.scale.setScalar(0.4); } };
    fx.smoke = function (p, n, size, drift) { if (reduce()) return; for (var k = 0; k < n; k++) { var s = take(smokes); if (!s) return; s.userData.life = s.userData.max = 1.4 + Math.random() * 0.8; s.position.set(p.x + (Math.random() - 0.5) * 0.6, p.y + 0.3, p.z + (Math.random() - 0.5) * 0.6); s.userData.vx = (drift ? drift.x : 0) + (Math.random() - 0.5) * 0.6; s.userData.vy = 1.2 + Math.random() * 0.8; s.userData.vz = (drift ? drift.z : 0) + (Math.random() - 0.5) * 0.6; s.userData.size = size || 2.5; s.scale.setScalar(0.3); } };
    fx.flash = function (p, scale, color) { var f = take(flashes); if (!f) return; f.userData.life = f.userData.max = 0.22; f.position.copy(p); f.userData.size = scale || 3; f.material.color.set(color == null ? 0xffffff : color); f.material.rotation = Math.random() * 6; f.scale.setScalar(scale || 3); f.material.opacity = 1; };
    fx.fire = function (p, secs) { var f = take(fires); if (!f) return; f.userData.life = f.userData.max = secs || 2.5; f.position.set(p.x, p.y + 0.4, p.z); f.userData.size = 1.6; f.userData.vy = 0.1; };
    function emit(set, p, n, strength, up) { if (reduce()) return; var k = 0; for (var i = 0; i < set.n && k < n; i++) { if (set.life[i] > 0) continue; set.life[i] = 0.4 + Math.random() * 0.6; set.pos[i * 3] = p.x; set.pos[i * 3 + 1] = p.y; set.pos[i * 3 + 2] = p.z; set.vel[i].set((Math.random() - 0.5) * strength, Math.random() * strength * (up || 0.8) + 1, (Math.random() - 0.5) * strength); k++; } }
    fx.sparks = function (p, n, strength) { emit(sparks, p, n, strength || 6, 0.9); };
    fx.debris = function (p, n, strength) { emit(debris, p, n, strength || 7, 1.1); };
    fx.light = function (p, intensity, secs) { var l = lights.filter(function (x) { return x.userData.life <= 0; })[0] || lights[0]; l.position.set(p.x, p.y + 1.5, p.z); l.userData.life = l.userData.max = secs || 0.35; l.userData.peak = intensity || 60; l.intensity = l.userData.peak; };
    fx.scorch = function (p, r) { var m = scorches.length < 14 ? new THREE.Mesh(new THREE.CircleGeometry(1, 18), scorchMat) : scorches.shift(); if (!m.parent) scene.add(m); m.rotation.x = -Math.PI / 2; m.position.set(p.x, p.y + 0.03, p.z); m.scale.setScalar(r || 1.5); m.rotation.z = Math.random() * 6; scorches.push(m); };
    // an explosion at p: flash, light, sparks, debris, dust, smoke; scale 1 = a 155 mm round
    fx.explosion = function (p, scale) {
      scale = scale || 1; fx.flash(p, 4 * scale, new THREE.Color(8, 5, 2)); fx.flash(new THREE.Vector3(p.x, p.y + 1.2 * scale, p.z), 2.5 * scale, new THREE.Color(6, 2.5, 1));
      fx.light(p, 120 * scale, 0.4); fx.sparks(p, 40, 9 * scale); fx.debris(p, 30, 8 * scale); fx.dust(p, 8, true); fx.smoke(p, 6, 3.5 * scale);
    };
    fx.step = function (dt) {
      dusts.forEach(function (d) { if (d.userData.life <= 0) { d.material.opacity = 0; return; } d.userData.life -= dt; var a = d.userData.life / d.userData.max; d.position.x += d.userData.vx * dt; d.position.y += d.userData.vy * dt; d.position.z += d.userData.vz * dt; d.scale.setScalar(0.4 + (1 - a) * d.userData.size); d.material.opacity = a * 0.5; });
      smokes.forEach(function (s) { if (s.userData.life <= 0) { s.material.opacity = 0; return; } s.userData.life -= dt; var a = s.userData.life / s.userData.max; s.position.x += s.userData.vx * dt; s.position.y += s.userData.vy * dt; s.position.z += s.userData.vz * dt; s.scale.setScalar(0.3 + (1 - a) * s.userData.size); s.material.opacity = a * 0.4; });
      flashes.forEach(function (f) { if (f.userData.life <= 0) { f.material.opacity = 0; return; } f.userData.life -= dt; var a = f.userData.life / f.userData.max; f.scale.setScalar(f.userData.size * (1.3 - a * 0.3)); f.material.opacity = a; });
      fires.forEach(function (f) { if (f.userData.life <= 0) { f.material.opacity = 0; return; } f.userData.life -= dt; var a = Math.min(1, f.userData.life / 0.6); f.scale.set(f.userData.size * (0.8 + Math.random() * 0.4), f.userData.size * (1 + Math.random() * 0.6), 1); f.material.opacity = a * 0.9; f.material.rotation += dt * 2; });
      [sparks, debris].forEach(function (set) { for (var i = 0; i < set.n; i++) { if (set.life[i] <= 0) continue; set.life[i] -= dt; set.vel[i].y -= set.g * dt; set.pos[i * 3] += set.vel[i].x * dt; set.pos[i * 3 + 1] += set.vel[i].y * dt; set.pos[i * 3 + 2] += set.vel[i].z * dt; if (set.pos[i * 3 + 1] < 0) { set.pos[i * 3 + 1] = 0; set.vel[i].y *= -0.3; set.vel[i].x *= 0.6; set.vel[i].z *= 0.6; } if (set.life[i] <= 0) set.pos[i * 3 + 1] = -100; } set.geo.attributes.position.needsUpdate = true; });
      lights.forEach(function (l) { if (l.userData.life <= 0) { l.intensity = 0; return; } l.userData.life -= dt; l.intensity = l.userData.peak * Math.max(0, l.userData.life / l.userData.max); });
    };
    return K;
  };
})();
