/* CORE-01-STORE — state, storage-safe persistence, progress export/import, save-a-copy */
(function () {
  'use strict';
  var CORB = window.CORB;
  var KEY = 'corb.state.v1', SECRET = 'corb.secret.v1', THEME = 'corb.theme', TEXT = 'corb.textsize';

  var store = CORB.store = {
    available: null,
    safeGet: function (k) { try { var v = localStorage.getItem(k); store.available = true; return v; } catch (e) { store.available = false; return null; } },
    safeSet: function (k, v) { try { localStorage.setItem(k, v); store.available = true; return true; } catch (e) { store.available = false; return false; } },
    safeDel: function (k) { try { localStorage.removeItem(k); return true; } catch (e) { return false; } }
  };

  function defaults() {
    return {
      version: 'corb-state-1',
      profile: { name: '', role: '', unit: '', targetClass: '', theme: '', textSize: 0, started: '' },
      progress: { seen: {}, srs: {}, quiz: [], boards: [], games: {}, notes: {}, notesAt: {}, bookmarks: {}, path: {}, mentor: [] },
      settings: { connector: { provider: 'openai', baseUrl: '', model: '', headers: '' }, tts: true, ttsRate: 1, projector: false, boardPasscode: '', showDrafts: true, hideAnswersDefault: true },
      overrides: { questions: {}, added: [], removed: {}, meta: {} },
      meta: { savedAt: '', lastOpened: '' }
    };
  }

  function merge(base, extra) {
    if (!extra || typeof extra !== 'object') return base;
    Object.keys(extra).forEach(function (k) {
      if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], extra[k]);
      else base[k] = extra[k];
    });
    return base;
  }

  // non-empty notes only: { questionId: text }
  function cleanNotes(o) {
    var out = {};
    if (o && typeof o === 'object') Object.keys(o).forEach(function (id) { if (typeof o[id] === 'string' && o[id].trim()) out[id] = o[id]; });
    return out;
  }

  CORB.state = defaults();
  CORB.embedded = null;      // content of the embeddedState block (overrides + settings, and notes, baked into this file)
  CORB.dirty = false;

  store.load = function () {
    var st = defaults();
    // 1) embedded (a saved copy of the app carries content overrides and default settings)
    try {
      var raw = document.getElementById('embeddedState');
      var es = raw ? JSON.parse(raw.textContent || 'null') : null;
      if (es && typeof es === 'object') { CORB.embedded = es; if (es.overrides) merge(st.overrides, es.overrides); if (es.settings) merge(st.settings, es.settings); if (es.profile) merge(st.profile, es.profile); }
    } catch (e) { CORB.embedded = null; }
    // 2) this viewer's own progress (optional)
    try { var saved = store.safeGet(KEY); if (saved) { var p = JSON.parse(saved); if (p && p.version) { merge(st, p); } } } catch (e) {}
    // 3) notes saved into this file: a note comes back when the browser has none, or when the file holds a newer copy
    var es0 = CORB.embedded || {}, fileAt = (es0.notesAt && typeof es0.notesAt === 'object') ? es0.notesAt : {};
    store.fileNotes = cleanNotes(es0.notes);
    var notes = st.progress.notes = (st.progress.notes && typeof st.progress.notes === 'object') ? st.progress.notes : {};
    var at = st.progress.notesAt = (st.progress.notesAt && typeof st.progress.notesAt === 'object') ? st.progress.notesAt : {};
    Object.keys(store.fileNotes).forEach(function (id) {
      var has = Object.prototype.hasOwnProperty.call(notes, id), newer = !!fileAt[id] && (!at[id] || fileAt[id] > at[id]);
      if (!has || newer) { notes[id] = store.fileNotes[id]; if (fileAt[id]) at[id] = fileAt[id]; }
    });
    try { var sec = store.safeGet(SECRET); if (sec) { st.settings.connector.apiKey = JSON.parse(sec).apiKey || ''; } } catch (e) {}
    var th = store.safeGet(THEME); if (th) st.profile.theme = th; else if (st.settings.theme) st.profile.theme = st.settings.theme;
    var tx = store.safeGet(TEXT); if (tx !== null && /^[0-3]$/.test(tx)) st.profile.textSize = +tx;
    if (!st.profile.started) st.profile.started = CORB.util.today();
    st.meta.lastOpened = new Date().toISOString();
    CORB.state = st;
    return st;
  };

  var persist = CORB.util.debounce(function () {
    var copy = CORB.util.deepClone(CORB.state);
    if (copy.settings && copy.settings.connector) { var key = copy.settings.connector.apiKey; delete copy.settings.connector.apiKey; store.safeSet(SECRET, JSON.stringify({ apiKey: key || '' })); }
    store.safeSet(KEY, JSON.stringify(copy));
  }, 300);

  CORB.get = function (path, fallback) {
    var cur = CORB.state; var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) { if (cur == null) return fallback; cur = cur[parts[i]]; }
    return cur === undefined ? fallback : cur;
  };
  CORB.set = function (path, value, opts) {
    var parts = path.split('.'); var cur = CORB.state;
    for (var i = 0; i < parts.length - 1; i++) { if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]]; }
    cur[parts[parts.length - 1]] = value;
    if (!(opts && opts.silent)) CORB.emit('change', { path: path, value: value });
    if (path === 'profile.theme') store.safeSet(THEME, value || '');
    if (path === 'profile.textSize') store.safeSet(TEXT, String(value || 0));
    if (!(opts && opts.noPersist)) persist();
    if (path.indexOf('overrides') === 0) CORB.dirty = true;
    return value;
  };
  CORB.update = function (path, fn) { return CORB.set(path, fn(CORB.get(path))); };
  // Every note write goes through here so progress.notesAt knows which copy is newer when the file's notes are merged.
  CORB.setNote = function (id, text) {
    CORB.set('progress.notesAt.' + id, new Date().toISOString(), { silent: true });
    return CORB.set('progress.notes.' + id, text == null ? '' : String(text));
  };
  CORB.push = function (path, item) { var arr = CORB.get(path, []); arr = Array.isArray(arr) ? arr : []; arr.push(item); return CORB.set(path, arr); };

  // ---- downloads ----
  store.download = function (name, text, type) {
    try {
      var blob = new Blob([text], { type: type || 'application/octet-stream' });
      var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  store.exportProgress = function () {
    var copy = CORB.util.deepClone(CORB.state);
    if (copy.settings && copy.settings.connector) delete copy.settings.connector.apiKey;
    copy.meta.savedAt = new Date().toISOString();
    var name = (CORB.get('profile.name') || 'candidate').replace(/[^\w-]+/g, '_');
    var file = 'CORB-progress_' + name + '_' + CORB.util.stamp() + '.json';
    store.download(file, JSON.stringify(copy, null, 1), 'application/json');
    return file;
  };
  store.importProgress = function (file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        try { var p = JSON.parse(r.result); if (!p || p.version !== 'corb-state-1') throw new Error('Not a progress file from this app.'); var key = CORB.get('settings.connector.apiKey'); merge(CORB.state, p); if (key) CORB.state.settings.connector.apiKey = key; persist(); CORB.emit('change', { path: '*' }); resolve(p); }
        catch (e) { reject(e); }
      };
      r.onerror = function () { reject(new Error('Could not read the file.')); };
      r.readAsText(file);
    });
  };
  store.resetProgress = function () { var st = CORB.state; st.progress = defaults().progress; persist(); CORB.emit('change', { path: '*' }); };

  // ---- save a copy of the app with embedded overrides (facilitator/content editor) ----
  store.buildSavedHtml = function (pristine, payloadJson) {
    var safe = payloadJson.replace(/</g, '\\u003c');
    var re = /(<script[^>]*id="embeddedState"[^>]*>)[\s\S]*?(<\/script>)/;
    if (!re.test(pristine)) throw new Error('embedded data block not found');
    return pristine.replace(re, function (m, a, b) { return a + safe + b; });
  };
  store.saveCopy = function (opts) {
    opts = opts || {};
    if (typeof window.PRISTINE_HTML !== 'string') throw new Error('Page snapshot unavailable.');
    var markers = ['CORE-00-NAMESPACE', 'CORE-01-STORE', 'CORE-02-ROUTER', 'CORE-03-UI', 'CORE-04-DATA', 'CORE-07-SCORING', 'BOOT-LAST-BLOCK'];
    var missing = markers.filter(function (m) { return window.PRISTINE_HTML.indexOf(m) < 0; });
    if (missing.length) throw new Error('Page snapshot incomplete (' + missing[0] + ') — do not distribute this save.');
    var payload = { version: 'corb-embedded-1', savedAt: new Date().toISOString(), overrides: CORB.util.deepClone(CORB.state.overrides), settings: {} };
    var s = CORB.state.settings;
    payload.settings = { showDrafts: s.showDrafts, hideAnswersDefault: s.hideAnswersDefault, tts: s.tts, theme: opts.includeTheme ? (CORB.get('profile.theme') || '') : '' };
    if (opts.includePasscode && s.boardPasscode) payload.settings.boardPasscode = s.boardPasscode;
    if (opts.defaultUnit) payload.profile = { unit: opts.defaultUnit };
    var html = store.buildSavedHtml(window.PRISTINE_HTML, JSON.stringify(payload));
    var name = (CORB.DATA.meta && CORB.DATA.meta.app_name || 'CORB-App').replace(/[^\w-]+/g, '') + '_' + CORB.util.stamp() + '.html';
    store.download(name, html, 'text/html');
    CORB.dirty = false;
    return name;
  };

  // ---- my notes inside the app file ----
  // Browser storage can be wiped (a managed computer that clears site data at restart, a private window), so notes can also
  // be written into this file's embeddedState block, next to anything a facilitator baked in. Where the browser allows it
  // (Edge and Chrome), the reader picks the file once and later saves write straight to it; otherwise a copy downloads.
  store.fileNotes = {};
  var fileHandle = null;
  store.unsavedNotes = function () {
    var cur = cleanNotes(CORB.get('progress.notes', {})), file = store.fileNotes || {}, n = 0;
    Object.keys(cur).forEach(function (id) { if (cur[id] !== file[id]) n++; });
    Object.keys(file).forEach(function (id) { if (!cur[id]) n++; });
    return n;
  };
  store.appFileName = function () {
    var n = '';
    try { n = decodeURIComponent(String(location.pathname || '').split('/').pop() || ''); } catch (e) {}
    if (/\.html?$/i.test(n)) return n;
    var app = String((CORB.DATA.meta && CORB.DATA.meta.app_name) || 'Board Ready').replace(/[^\w-]+/g, '');
    return app + (CORB.isCandidateEdition && CORB.isCandidateEdition() ? '-Candidate' : '') + '.html';
  };
  store.saveNotesToFile = function () {
    if (typeof window.PRISTINE_HTML !== 'string') return Promise.reject(new Error('this copy cannot save itself'));
    var now = new Date().toISOString(), notes = cleanNotes(CORB.get('progress.notes', {})), stamps = CORB.get('progress.notesAt', {}) || {}, at = {};
    Object.keys(notes).forEach(function (id) { at[id] = stamps[id] || now; });
    var payload = CORB.util.deepClone(CORB.embedded && typeof CORB.embedded === 'object' ? CORB.embedded : {});
    if (!payload.version) payload.version = 'corb-embedded-1';
    payload.notes = notes; payload.notesAt = at; payload.notesSavedAt = now;
    var html = store.buildSavedHtml(window.PRISTINE_HTML, JSON.stringify(payload));
    var name = store.appFileName();
    function done(how, fileName) {
      store.fileNotes = notes; CORB.embedded = payload;
      Object.keys(at).forEach(function (id) { if (!stamps[id]) CORB.set('progress.notesAt.' + id, at[id], { silent: true }); });
      CORB.emit('change', { path: 'progress.notesFile' });
      return { how: how, name: fileName || name, count: Object.keys(notes).length };
    }
    function download() {
      if (!store.download(name, html, 'text/html')) throw new Error('the browser blocked the download');
      return done('download');
    }
    if (typeof window.showSaveFilePicker !== 'function') return Promise.resolve().then(download);
    // Ask for the file inside the click that started the save; the browser only opens the picker during a user gesture.
    var pick = fileHandle ? Promise.resolve(fileHandle) : window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Board Ready app', accept: { 'text/html': ['.html', '.htm'] } }] });
    return pick.then(function (handle) {
      var ask = handle.requestPermission ? handle.requestPermission({ mode: 'readwrite' }) : Promise.resolve('granted');
      return ask.then(function (state) {
        if (state !== 'granted') throw new Error('permission refused');
        return handle.createWritable();
      }).then(function (w) {
        return w.write(html).then(function () { return w.close(); });
      }).then(function () { fileHandle = handle; return done('file', handle.name); });
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return { how: 'cancel' };
      fileHandle = null;
      return download();   // blocked by policy, or the file could not be written: fall back to a downloaded copy
    });
  };

  window.addEventListener('beforeunload', function (e) { if (CORB.dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
