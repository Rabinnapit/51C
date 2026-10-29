/* CORE-12-VOICES — the app's own voices (web edition only). Four Piper neural voices, US and UK, a woman and a man of
   each, run on the device: ONNX Runtime Web in a worker, the phonemizer compiled to WebAssembly. The speech engine
   (about 31 MB) and each voice (about 63 MB) are fetched once from the owner's GitHub Pages (rabinnapit.github.io/
   51C-voices, $0) and kept in Cache Storage, so after the first download they work offline and sound the same on every
   phone. The phone's own voices stay available; an app voice is chosen in Settings → Display → Read aloud.
   CORB.voices: list(), get(id), selected(), ready(id), downloaded(), download(id, onProgress), remove(id), removeAll(),
   speak(segments, { rate, onend, onfail }), stop(). */
(function () {
  'use strict';
  var CORB = window.CORB;
  var meta = (CORB.DATA && CORB.DATA.meta) || {};
  var AC = window.AudioContext || window.webkitAudioContext;
  var V = CORB.voices = { available: !!(window.Worker && window.WebAssembly && AC && window.caches && window.fetch && window.Blob && window.URL && URL.createObjectURL && window.BigInt64Array) };
  var DEFAULT_BASE = 'https://rabinnapit.github.io/51C-voices/v1/';
  var BASE = (function () { try { return localStorage.getItem('b2b.voicesBase') || (meta.voices && meta.voices.base) || DEFAULT_BASE; } catch (e) { return (meta.voices && meta.voices.base) || DEFAULT_BASE; } })();
  var CACHE = 'b2b-voices-v1';
  var RUNTIME = ['ort/ort.min.js', 'ort/ort-wasm-simd.wasm', 'piper/piper_phonemize.js', 'piper/piper_phonemize.wasm', 'piper/piper_phonemize.data'];
  V.RUNTIME_MB = 31;
  var LIST = [
    { id: 'en_US-hfc_female-medium', name: 'Amber', who: 'US · woman', mb: 63, license: 'CC BY-NC-SA 4.0 (HFC dataset)' },
    { id: 'en_US-joe-medium', name: 'Joe', who: 'US · man', mb: 63, license: 'CC0' },
    { id: 'en_GB-cori-medium', name: 'Cori', who: 'UK · woman', mb: 63, license: 'public domain' },
    { id: 'en_GB-northern_english_male-medium', name: 'Leo', who: 'UK · man', mb: 63, license: 'CC BY-SA 4.0' }];
  V.list = function () { return LIST.slice(); };
  V.get = function (id) { return LIST.filter(function (v) { return v.id === id; })[0] || null; };
  V.selected = function () { var s = CORB.get('settings.voice', ''); return s && s.indexOf('app:') === 0 ? V.get(s.slice(4)) : null; };
  function url(p) { return BASE + p; }
  function files(id) { return RUNTIME.concat([id + '.onnx.json', id + '.onnx']); }

  // ---- storage: Cache Storage, one entry per file, keyed by its URL ----
  function cache() { return caches.open(CACHE); }
  function have(c, p) { return c.match(url(p)).then(function (r) { return !!r; }, function () { return false; }); }
  V.ready = function (id) { return cache().then(function (c) { return Promise.all(files(id).map(function (p) { return have(c, p); })); }).then(function (a) { return a.every(Boolean); }, function () { return false; }); };
  V.downloaded = function () { return cache().then(function (c) { return Promise.all(LIST.map(function (v) { return have(c, v.id + '.onnx'); })); }).then(function (a) { return LIST.filter(function (v, i) { return a[i]; }).map(function (v) { return v.id; }); }, function () { return []; }); };
  function fetchInto(c, path, onBytes) {
    return fetch(url(path), { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('Could not download ' + path.split('/').pop() + ' (' + res.status + ')');
      var type = res.headers.get('Content-Type') || 'application/octet-stream', size = +res.headers.get('Content-Length') || 0;
      var reader = res.body && res.body.getReader ? res.body.getReader() : null;
      if (!reader) return res.blob().then(function (b) { onBytes(b.size, b.size); return c.put(url(path), new Response(b, { headers: { 'Content-Type': type } })); });
      var chunks = [], loaded = 0;
      return (function read() { return reader.read().then(function (r) { if (r.done) return; chunks.push(r.value); loaded += r.value.length; onBytes(loaded, size); return read(); }); })()
        .then(function () { return c.put(url(path), new Response(new Blob(chunks, { type: type }), { headers: { 'Content-Type': type } })); });
    });
  }
  var downloads = {};
  // fetch what is missing for a voice; onProgress({ loadedMB, totalMB, pct, file })
  V.download = function (id, onProgress) {
    if (downloads[id]) return downloads[id];
    var v = V.get(id); if (!v) return Promise.reject(new Error('Unknown voice ' + id));
    downloads[id] = cache().then(function (c) {
      var list = files(id);
      return Promise.all(list.map(function (p) { return have(c, p); })).then(function (has) {
        var todo = list.filter(function (p, i) { return !has[i]; });
        var est = { 'ort/ort.min.js': 0.6, 'ort/ort-wasm-simd.wasm': 11.8, 'piper/piper_phonemize.js': 0.1, 'piper/piper_phonemize.wasm': 0.6, 'piper/piper_phonemize.data': 18.1 };
        var sizes = {}; todo.forEach(function (p) { sizes[p] = (est[p] || (/\.onnx$/.test(p) ? v.mb : 0.01)) * 1e6; });
        var total = todo.reduce(function (s, p) { return s + sizes[p]; }, 0), doneBytes = 0;
        return todo.reduce(function (chain, p) {
          return chain.then(function () {
            return fetchInto(c, p, function (loaded, size) { if (size) { total += size - sizes[p]; sizes[p] = size; } if (onProgress) onProgress({ loadedMB: (doneBytes + loaded) / 1e6, totalMB: total / 1e6, pct: total ? Math.min(100, Math.round((doneBytes + loaded) * 100 / total)) : 0, file: p }); })
              .then(function () { doneBytes += sizes[p]; });
          });
        }, Promise.resolve());
      });
    }).then(function () { delete downloads[id]; CORB.emit('voices-changed'); }, function (e) { delete downloads[id]; throw e; });
    return downloads[id];
  };
  V.remove = function (id) { return cache().then(function (c) { return Promise.all([id + '.onnx', id + '.onnx.json'].map(function (p) { return c.delete(url(p)); })); }).then(function () { if (engine && engine.id === id) killEngine(); CORB.emit('voices-changed'); }); };
  V.removeAll = function () { return caches.delete(CACHE).then(function () { killEngine(); CORB.emit('voices-changed'); }); };

  // ---- the engine: a worker that holds ONNX Runtime, the phonemizer and one voice ----
  var WORKER_SRC = [
    'var S = { cancel: false };',
    'function blobUrl(buf, type) { return URL.createObjectURL(new Blob([buf], { type: type })); }',
    'async function init(m) {',
    '  importScripts(blobUrl(m.ortJs, "text/javascript"));',
    '  var w = blobUrl(m.ortWasm, "application/wasm");',
    '  ort.env.wasm.numThreads = 1; ort.env.wasm.simd = true; ort.env.wasm.proxy = false;',
    '  ort.env.wasm.wasmPaths = { "ort-wasm-simd.wasm": w, "ort-wasm.wasm": w, "ort-wasm-simd-threaded.wasm": w, "ort-wasm-threaded.wasm": w };',
    '  importScripts(blobUrl(m.piperJs, "text/javascript"));',
    '  S.piperWasm = m.piperWasm; S.piperData = m.piperData; S.config = m.config;',
    '  S.session = await ort.InferenceSession.create(m.model, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });',
    '}',
    'function phonemize(texts) { return new Promise(function (resolve, reject) { var out = [];',
    '  createPiperPhonemize({ wasmBinary: S.piperWasm, getPreloadedPackage: function () { return S.piperData.slice(0); }, locateFile: function (f) { return f; }, noInitialRun: true,',
    '    print: function (line) { try { var j = JSON.parse(line); out.push(j.phoneme_ids || []); } catch (e) {} }, printErr: function () {} })',
    '  .then(function (mod) { try { mod.callMain(["-l", S.config.espeak.voice, "--input", JSON.stringify(texts.map(function (t) { return { text: t }; })), "--espeak_data", "/espeak-ng-data"]); resolve(out); } catch (e) { reject(e); } }, reject); }); }',
    'async function phonemizeAll(texts) { var all = await phonemize(texts); if (all.length === texts.length) return all;',
    '  var one = []; for (var i = 0; i < texts.length; i++) { var r = await phonemize([texts[i]]); one.push(r[0] || []); } return one; }',
    'async function synth(ids, rate) {',
    '  var inf = S.config.inference, scales = new Float32Array([inf.noise_scale, inf.length_scale / (rate || 1), inf.noise_w]);',
    '  var feeds = { input: new ort.Tensor("int64", BigInt64Array.from(ids.map(function (x) { return BigInt(x); })), [1, ids.length]), input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]), scales: new ort.Tensor("float32", scales, [3]) };',
    '  if ((S.config.num_speakers || 1) > 1) feeds.sid = new ort.Tensor("int64", BigInt64Array.from([BigInt(0)]), [1]);',
    '  var out = await S.session.run(feeds); var pcm = out.output.data;',
    '  return pcm instanceof Float32Array ? pcm : Float32Array.from(pcm);',
    '}',
    'async function say(m) { S.cancel = false; var rate = S.config.audio.sample_rate; var all = await phonemizeAll(m.texts);',
    '  for (var i = 0; i < m.texts.length; i++) { if (S.cancel) break; var ids = all[i];',
    '    var pcm = ids && ids.length ? await synth(ids, m.rate) : new Float32Array(0);',
    '    if (S.cancel) break; postMessage({ type: "pcm", id: m.id, i: i, pcm: pcm, rate: rate }, [pcm.buffer]); }',
    '  postMessage({ type: "done", id: m.id }); }',
    'self.onmessage = function (e) { var m = e.data;',
    '  if (m.type === "init") init(m).then(function () { postMessage({ type: "ready" }); }, function (err) { postMessage({ type: "error", error: String(err && err.message || err) }); });',
    '  else if (m.type === "say") say(m).catch(function (err) { postMessage({ type: "error", id: m.id, error: String(err && err.message || err) }); });',
    '  else if (m.type === "cancel") S.cancel = true;',
    '};'].join('\n');
  var engine = null;
  function killEngine() { if (engine) { try { engine.worker.terminate(); } catch (e) {} engine = null; } }
  function bytes(c, p, asText) { return c.match(url(p)).then(function (r) { if (!r) throw new Error('missing ' + p); return asText ? r.text() : r.arrayBuffer(); }); }
  function loadEngine(id) {
    if (engine && engine.id === id) return engine.ready;
    killEngine();
    var worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
    var e = engine = { id: id, worker: worker, reqs: {}, seq: 0 };
    e.ready = cache().then(function (c) { return Promise.all([bytes(c, 'ort/ort.min.js', true), bytes(c, 'ort/ort-wasm-simd.wasm'), bytes(c, 'piper/piper_phonemize.js', true), bytes(c, 'piper/piper_phonemize.wasm'), bytes(c, 'piper/piper_phonemize.data'), bytes(c, id + '.onnx.json', true), bytes(c, id + '.onnx')]); })
      .then(function (b) {
        return new Promise(function (resolve, reject) {
          worker.onmessage = function (ev) {
            var m = ev.data;
            if (m.type === 'ready') { resolve(); return; }
            if (m.type === 'error' && m.id == null) { reject(new Error(m.error)); return; }
            var r = e.reqs[m.id]; if (!r) return;
            if (m.type === 'pcm') r.onpcm(m.pcm, m.rate, m.i);
            else if (m.type === 'done') { delete e.reqs[m.id]; r.ondone(); }
            else if (m.type === 'error') { delete e.reqs[m.id]; r.onerror(new Error(m.error)); }
          };
          worker.onerror = function (ev) { reject(new Error(ev && ev.message || 'The voice engine failed to start')); };
          worker.postMessage({ type: 'init', ortJs: b[0], ortWasm: b[1], piperJs: b[2], piperWasm: b[3], piperData: b[4], config: JSON.parse(b[5]), model: b[6] }, [b[1], b[3], b[4], b[6]]);
        });
      });
    e.ready.catch(function () { if (engine === e) killEngine(); });
    return e.ready;
  }
  V.warm = function () { var v = V.selected(); if (!v) return; V.ready(v.id).then(function (ok) { if (ok) loadEngine(v.id).catch(function () {}); }); };

  // ---- playback: each sentence arrives as PCM and is queued back to back, with the reader's pauses between ----
  var ctx = null, playing = null, playId = 0;
  function audioCtx() { if (!ctx) ctx = new AC(); if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} } return ctx; }
  function stopPlayback() { if (playing) { var p = playing; playing = null; p.ended = true; p.sources.forEach(function (s) { try { s.onended = null; s.stop(); } catch (e) {} }); } }
  function schedule(p, pcm, rate, pauseMs) {
    var c = audioCtx(), n = Math.max(1, pcm.length), buf = c.createBuffer(1, n, rate);
    if (pcm.length) buf.getChannelData(0).set(pcm);
    var src = c.createBufferSource(); src.buffer = buf; src.connect(c.destination);
    var at = Math.max(c.currentTime + 0.03, p.nextAt); src.start(at); p.nextAt = at + buf.duration + (pauseMs || 0) / 1000;
    p.sources.push(src); p.received++;
    src.onended = function () { p.played++; checkEnd(p); };
  }
  function checkEnd(p) { if (p.ended || !p.doneSynth || p.played < p.received) return; p.ended = true; if (playing === p) playing = null; if (p.onend) p.onend(); }
  // segments: CORB.speech.segments(text); returns true when the app voice took the text
  V.speak = function (segments, o) {
    o = o || {};
    var voice = V.selected(); if (!voice || !V.available) return false;
    var texts = segments.map(function (s) { return s.text; }), pauses = segments.map(function (s) { return s.pause || 0; });
    if (!texts.length) { if (o.onend) o.onend(); return true; }
    V.stop(); var my = ++playId; audioCtx();   // created inside the tap that asked for speech, which iPhones require
    var p = playing = { id: my, sources: [], nextAt: 0, received: 0, played: 0, doneSynth: false, ended: false, onend: o.onend };
    V.ready(voice.id).then(function (ok) {
      if (!ok) { var err = new Error('not-downloaded'); err.code = 'not-downloaded'; throw err; }
      return loadEngine(voice.id);
    }).then(function () {
      if (my !== playId) return;
      var e = engine, reqId = ++e.seq;
      e.reqs[reqId] = {
        onpcm: function (pcm, rate, i) { if (my !== playId) return; schedule(p, pcm, rate, pauses[i]); },
        ondone: function () { if (my !== playId) return; p.doneSynth = true; checkEnd(p); },
        onerror: function (err) { if (my !== playId) return; stopPlayback(); if (o.onfail) o.onfail(err); } };
      e.worker.postMessage({ type: 'say', id: reqId, texts: texts, rate: o.rate || 1 });
    }).catch(function (err) { if (my !== playId) return; stopPlayback(); if (o.onfail) o.onfail(err); });
    return true;
  };
  V.stop = function () { playId++; stopPlayback(); if (engine) { try { engine.worker.postMessage({ type: 'cancel' }); } catch (e) {} } };

  // Listen buttons appear when either kind of voice can speak
  if (V.available && CORB.speech) CORB.speech.available = true;
  if (V.available) setTimeout(V.warm, 1500);
})();
