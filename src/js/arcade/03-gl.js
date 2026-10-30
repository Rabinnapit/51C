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
    var St = { canvas: canvas, renderer: renderer, gl2: isGL2, scene: scene, camera: camera, X: X, post: post, skyU: skyU, sun: sun, hemi: hemi, w: 4, h: 4, tri: 0, calls: 0, quality: 2, hdr: post.hdr, mobile: mobile, aberr: 0, white: 0, light: 'day' };
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
