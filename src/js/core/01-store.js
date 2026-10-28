/* CORE-01-STORE — state, storage-safe persistence, progress export/import, progress saved into the HTML file */
(function () {
  'use strict';
  var CORB = window.CORB, U = CORB.util;
  var KEY = 'b2b.state.v1', THEME = 'b2b.theme', TEXT = 'b2b.textsize';

  var store = CORB.store = {
    available: null,
    safeGet: function (k) { try { var v = localStorage.getItem(k); store.available = true; return v; } catch (e) { store.available = false; return null; } },
    safeSet: function (k, v) { try { localStorage.setItem(k, v); store.available = true; return true; } catch (e) { store.available = false; return false; } },
    safeDel: function (k) { try { localStorage.removeItem(k); return true; } catch (e) { return false; } }
  };

  function defaults() {
    return {
      version: 'b2b-state-1',
      profile: { track: '', start: '', goalMonths: 6, goalDate: '', theme: '', textSize: 0 },
      progress: {
        steps: {},        // plan step id -> date done
        courses: {},      // course id -> { status: 'registered'|'done', date }
        lessons: {},      // lesson id -> date done
        checks: {},       // lesson id -> { right, total, date } from "Check yourself"
        quiz: [],         // { ts, mode, total, correct, byPhase: {gp:[c,t]...}, items: [{id, ok}] } (last 40)
        missed: {},       // question id -> times missed (cleared when answered right later)
        srs: {},          // flashcard id -> { ef, interval, reps, due, last }
        howto: {},        // howto id -> { stepIndex: true }
        exp: {},          // experience checklist id -> date
        games: {},        // game id -> { plays, best, last }
        exam: { scheduled: '', attempts: [] },
        seen: {},         // any id -> last date (drives the study streak)
        bookmarks: {},
        path: {},         // exam path task id -> date ticked, or { d, last, best } for drills, checkpoints and Arcade runs
        arcade: {}        // Arcade: best (game@pace -> { best, plays, last, lastAt }), xp, quest (realm -> { stars, clears }), rot (seen/missed memory)
      },
      settings: { tts: true, ttsRate: 1, glossaryLinks: true, motion: '', setupDone: false, welcomeSeen: false, tourSeen: false },
      meta: { updatedAt: '', lastOpened: '' }
    };
  }

  function merge(base, extra) {
    if (!extra || typeof extra !== 'object') return base;
    Object.keys(extra).forEach(function (k) {
      var v = extra[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], v);
      else base[k] = v;
    });
    return base;
  }

  CORB.state = defaults();
  CORB.embedded = null;
  store.fileStamp = '';     // updatedAt of the progress saved inside this HTML file

  store.load = function () {
    var st = defaults(), file = null, mine = null;
    try { var raw = document.getElementById('embeddedState'); var es = raw ? JSON.parse(raw.textContent || 'null') : null; if (es && typeof es === 'object') { CORB.embedded = es; file = es.state || null; } } catch (e) { CORB.embedded = null; }
    try { var saved = store.safeGet(KEY); if (saved) { mine = JSON.parse(saved); if (!mine || mine.version !== 'b2b-state-1') mine = null; } } catch (e) { mine = null; }
    store.fileStamp = file && file.meta && file.meta.updatedAt || '';
    // The newer copy wins: this browser's progress, or the progress someone saved into this file (a cleared browser keeps it).
    var mineAt = mine && mine.meta && mine.meta.updatedAt || '';
    if (file && (!mine || store.fileStamp > mineAt)) merge(st, file);
    else if (mine) merge(st, mine);
    var th = store.safeGet(THEME); if (th !== null) st.profile.theme = th;
    var tx = store.safeGet(TEXT); if (tx !== null && /^[0-3]$/.test(tx)) st.profile.textSize = +tx;
    st.meta.lastOpened = new Date().toISOString();
    CORB.state = st;
    return st;
  };

  var persist = CORB.util.debounce(function () { store.safeSet(KEY, JSON.stringify(CORB.state)); }, 250);
  store.persistNow = function () { store.safeSet(KEY, JSON.stringify(CORB.state)); };

  CORB.get = function (path, fallback) {
    var cur = CORB.state, parts = path.split('.');
    for (var i = 0; i < parts.length; i++) { if (cur == null) return fallback; cur = cur[parts[i]]; }
    return cur === undefined ? fallback : cur;
  };
  CORB.set = function (path, value, opts) {
    var parts = path.split('.'), cur = CORB.state;
    for (var i = 0; i < parts.length - 1; i++) { if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]]; }
    if (value === undefined) delete cur[parts[parts.length - 1]]; else cur[parts[parts.length - 1]] = value;
    if (path === 'profile.theme') store.safeSet(THEME, value || '');
    if (path === 'profile.textSize') store.safeSet(TEXT, String(value || 0));
    if (path.indexOf('progress') === 0 || path.indexOf('profile') === 0) CORB.state.meta.updatedAt = new Date().toISOString();
    if (!(opts && opts.noPersist)) persist();
    if (!(opts && opts.silent)) CORB.emit('change', { path: path, value: value });
    return value;
  };
  CORB.update = function (path, fn) { return CORB.set(path, fn(CORB.get(path))); };
  CORB.push = function (path, item, cap) { var arr = CORB.get(path, []); arr = Array.isArray(arr) ? arr.slice() : []; arr.push(item); if (cap && arr.length > cap) arr = arr.slice(-cap); return CORB.set(path, arr); };
  CORB.touch = function (id) { CORB.set('progress.seen.' + id, U.today(), { silent: true }); };

  // ---- has this reader done anything yet? ----
  store.hasProgress = function () {
    var p = CORB.get('progress', {});
    return Object.keys(p).some(function (k) { var v = p[k]; return Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v).some(function (x) { var y = v[x]; return Array.isArray(y) ? y.length : !!y; }) : !!v; });
  };

  // ---- downloads ----
  store.download = function (name, text, type) {
    if (!CORB.can('download')) { CORB.ui.toast('Downloads are turned off in this preview. Use the downloaded copy or the website.', 'warn', 4200); return false; }
    try {
      var blob = new Blob([text], { type: type || 'application/octet-stream' });
      var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  store.exportProgress = function () {
    var copy = U.deepClone(CORB.state); copy.meta.exportedAt = new Date().toISOString();
    var file = 'B2B-Guide-progress_' + U.stamp() + '.json';
    return store.download(file, JSON.stringify(copy, null, 1), 'application/json') ? file : '';
  };
  store.importProgress = function (file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        try {
          var p = JSON.parse(r.result);
          if (!p || p.version !== 'b2b-state-1') throw new Error('That file is not a B2B Guide progress file.');
          var st = defaults(); merge(st, p); st.meta.updatedAt = new Date().toISOString(); CORB.state = st;
          store.persistNow(); CORB.emit('change', { path: '*' }); resolve(p);
        } catch (e) { reject(e); }
      };
      r.onerror = function () { reject(new Error('Could not read the file.')); };
      r.readAsText(file);
    });
  };
  store.resetProgress = function () {
    var keep = CORB.state.profile; CORB.state = defaults(); CORB.state.profile = keep; CORB.state.meta.updatedAt = new Date().toISOString();
    store.persistNow(); CORB.emit('change', { path: '*' });
  };
  store.resetAll = function () { CORB.state = defaults(); store.safeDel(KEY); store.persistNow(); CORB.emit('change', { path: '*' }); };

  // ---- save my progress into this HTML file (offline edition) ----
  // Managed computers can clear browser storage at restart, so progress can also live in the file's embeddedState block.
  // Edge and Chrome let the reader pick the file once; later saves write straight to it. Otherwise a copy downloads.
  var fileHandle = null;
  store.unsaved = function () { return CORB.edition() === 'offline' && store.hasProgress() && (CORB.state.meta.updatedAt || '') !== store.fileStamp; };
  store.buildSavedHtml = function (pristine, payloadJson) {
    var safe = payloadJson.replace(/</g, '\\u003c');
    var re = /(<script[^>]*id="embeddedState"[^>]*>)[\s\S]*?(<\/script>)/;
    if (!re.test(pristine)) throw new Error('the data block was not found in this copy');
    return pristine.replace(re, function (m, a, b) { return a + safe + b; });
  };
  store.appFileName = function () {
    var n = ''; try { n = decodeURIComponent(String(location.pathname || '').split('/').pop() || ''); } catch (e) {}
    return /\.html?$/i.test(n) ? n : 'B2B-Guide.html';
  };
  store.saveProgressToFile = function () {
    if (!CORB.can('saveFile')) return Promise.reject(new Error('this edition saves progress in the browser'));
    if (typeof window.PRISTINE_HTML !== 'string') return Promise.reject(new Error('this copy cannot save itself'));
    var stamp = CORB.state.meta.updatedAt || new Date().toISOString(); CORB.state.meta.updatedAt = stamp;
    var payload = { version: 'b2b-embedded-1', savedAt: new Date().toISOString(), state: U.deepClone(CORB.state),
      settings: { theme: CORB.get('profile.theme') || '', textSize: CORB.get('profile.textSize') || 0 } };
    var html = store.buildSavedHtml(window.PRISTINE_HTML, JSON.stringify(payload)), name = store.appFileName();
    function done(how, fileName) { store.fileStamp = stamp; CORB.embedded = payload; store.persistNow(); CORB.emit('change', { path: 'file' }); return { how: how, name: fileName || name }; }
    function download() { if (!store.download(name, html, 'text/html')) throw new Error('the browser blocked the download'); return done('download'); }
    if (typeof window.showSaveFilePicker !== 'function') return Promise.resolve().then(download);
    var pick = fileHandle ? Promise.resolve(fileHandle) : window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'B2B Guide', accept: { 'text/html': ['.html', '.htm'] } }] });
    return pick.then(function (handle) {
      var ask = handle.requestPermission ? handle.requestPermission({ mode: 'readwrite' }) : Promise.resolve('granted');
      return ask.then(function (s) { if (s !== 'granted') throw new Error('permission refused'); return handle.createWritable(); })
        .then(function (w) { return w.write(html).then(function () { return w.close(); }); })
        .then(function () { fileHandle = handle; return done('file', handle.name); });
    }).catch(function (e) { if (e && e.name === 'AbortError') return { how: 'cancel' }; fileHandle = null; return download(); });
  };
})();
