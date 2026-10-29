/* CORE-10-ACCOUNT (web edition only; tools/build.py leaves this file out of the offline and preview editions)
   Optional accounts. A reader who signs in with an email and password gets their progress (CORB.state) saved to their
   account a few seconds after every change, and restored on any other phone or computer where they sign in.
   Backend: the Supabase project 51C (meta.sync holds its public address and publishable key). The progress table lets
   each signed-in reader read and write only their own row; the signup function creates accounts that work at once.
   Nothing is sent until the reader signs in, and the guide works the same without an account.
   Session on this device: localStorage b2b.account {email, uid, access, refresh, exp, lastSync, lastLocal}. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var SESSION = 'b2b.account';
  var acct = CORB.account = { error: '' };
  var applying = false;

  function cfg() { return CORB.meta().sync || {}; }
  function load() { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (e) { return null; } }
  function save(s) { try { if (s) localStorage.setItem(SESSION, JSON.stringify(s)); else localStorage.removeItem(SESSION); } catch (e) {} }
  acct.ready = function () { var c = cfg(); return !!(c.url && c.key); };
  acct.signedIn = function () { var s = load(); return !!(s && s.refresh); };
  acct.email = function () { var s = load(); return (s && s.email) || ''; };
  acct.lastSync = function () { var s = load(); return (s && s.lastSync) || ''; };
  function changed() { CORB.emit('change', { path: 'account' }); }

  // ---- talking to Supabase (plain fetch: no library) ----
  function friendly(msg, status) {
    if (/invalid login credentials/i.test(msg)) return 'That email and password do not match an account.';
    if (status === 429) return 'Too many tries. Wait a minute and try again.';
    return msg;
  }
  function call(path, o) {
    var c = cfg();
    if (!c.url || !c.key) return Promise.reject(new Error('Accounts are not set up in this copy.'));
    var headers = { apikey: c.key, 'Content-Type': 'application/json' };
    if (o.token) headers.Authorization = 'Bearer ' + o.token;
    Object.keys(o.headers || {}).forEach(function (k) { headers[k] = o.headers[k]; });
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : 0;
    return fetch(c.url + path, { method: o.method || 'GET', headers: headers, body: o.body ? JSON.stringify(o.body) : undefined, signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        return r.text().then(function (txt) {
          var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
          if (!r.ok) { var err = new Error(friendly((j && (j.error_description || j.msg || j.message || j.error)) || 'Error ' + r.status, r.status)); err.status = r.status; throw err; }
          return j;
        });
      }, function () {
        clearTimeout(timer);
        throw new Error(navigator.onLine === false ? 'You are offline. Try again when you have a connection.' : 'Could not reach the account server. Try again in a moment.');
      });
  }
  function keep(j, email, prev) {
    var s = { email: email || (j.user && j.user.email) || (prev && prev.email) || '', uid: (j.user && j.user.id) || (prev && prev.uid) || '',
      access: j.access_token, refresh: j.refresh_token, exp: Date.now() + ((j.expires_in || 3600) - 60) * 1000,
      lastSync: prev ? prev.lastSync : '', lastLocal: prev ? prev.lastLocal : '' };
    save(s); return s;
  }
  // a valid access token, refreshed when it is about to run out; a refused refresh signs the reader out on this device
  function session() {
    var s = load();
    if (!s || !s.refresh) return Promise.reject(new Error('Not signed in.'));
    if (s.access && Date.now() < s.exp) return Promise.resolve(s);
    return call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh } })
      .then(function (j) { return keep(j, s.email, s); }, function (e) { if (e.status === 400 || e.status === 401) { save(null); changed(); } throw e; });
  }

  // ---- the progress row ----
  function getRow() {
    return session().then(function (s) { return call('/rest/v1/progress?select=state,updated_at&user_id=eq.' + encodeURIComponent(s.uid), { token: s.access }); })
      .then(function (rows) { return (rows && rows[0]) || null; });
  }
  function putRow() {
    return session().then(function (s) {
      return call('/rest/v1/progress?on_conflict=user_id', { method: 'POST', token: s.access, headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { user_id: s.uid, state: CORB.state } });
    }).then(function (rows) {
      var cur = load(); if (cur) { cur.lastSync = (rows && rows[0] && rows[0].updated_at) || new Date().toISOString(); cur.lastLocal = CORB.state.meta.updatedAt || ''; save(cur); }
      acct.error = ''; changed();
    });
  }
  // replace this device's progress with the account's copy
  function useRow(row) {
    if (!row || !row.state || row.state.version !== 'b2b-state-1') return;
    applying = true;
    CORB.state = JSON.parse(JSON.stringify(row.state));
    CORB.state.meta = CORB.state.meta || {};
    CORB.state.meta.lastOpened = new Date().toISOString();
    CORB.store.persistNow();
    var cur = load(); if (cur) { cur.lastSync = row.updated_at; cur.lastLocal = CORB.state.meta.updatedAt || ''; save(cur); }
    CORB.emit('change', { path: '*' }); CORB.render();
    applying = false;
  }
  // wait until no other screen (install, terms, tour, another question) is open
  function whenFree(fn) { if (document.querySelector('.modal-scrim, .tour-layer')) setTimeout(function () { whenFree(fn); }, 1500); else fn(); }
  function when(t) { try { return t ? new Date(t).toLocaleString() : 'not yet'; } catch (e) { return t; } }
  function choose(row) {
    return new Promise(function (resolve) {
      whenFree(function () {
        var h = CORB.ui.h;
        CORB.ui.modal({ title: 'Which progress should we keep?', sticky: true, body: h('div', {},
            h('p', {}, 'Your account and this device both have progress, and they are different.'),
            h('ul.tips', {}, h('li', {}, h('b', {}, 'Your account: '), 'saved ' + when(row.updated_at)), h('li', {}, h('b', {}, 'This device: '), 'last changed ' + when(CORB.state.meta.updatedAt)))),
          actions: [
            { label: 'Keep this device', onClick: function () { putRow().then(function () { resolve('saved'); }, function (e) { acct.error = e.message; resolve('error'); }); } },
            { label: 'Use my account', primary: true, onClick: function () { useRow(row); resolve('restored'); } }] });
      });
    });
  }
  // right after signing in: a new account takes this device's progress; a fresh device takes the account's
  function firstSync() {
    return getRow().then(function (row) {
      if (!row) return putRow().then(function () { return 'saved'; });
      if (!CORB.store.hasProgress()) { useRow(row); return 'restored'; }
      if (JSON.stringify(row.state.progress) === JSON.stringify(CORB.state.progress)) return putRow().then(function () { return 'same'; });
      return choose(row);
    });
  }

  acct.signIn = function (email, password) {
    email = String(email || '').trim().toLowerCase();
    return call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: password } })
      .then(function (j) { keep(j, email, null); changed(); return firstSync(); });
  };
  acct.signUp = function (email, password) {
    email = String(email || '').trim().toLowerCase();
    return call('/functions/v1/signup', { method: 'POST', body: { email: email, password: password } }).then(function () { return acct.signIn(email, password); });
  };
  acct.signOut = function () {
    var s = load(); save(null); changed();
    if (s && s.access) call('/auth/v1/logout', { method: 'POST', token: s.access }).catch(function () {});
  };
  acct.saveNow = function () { return putRow(); };

  // save a few seconds after every change while signed in (and again when the connection comes back)
  var push = CORB.util.debounce(function () {
    if (!acct.signedIn() || navigator.onLine === false) return;
    putRow().catch(function (e) { acct.error = e.message; changed(); });
  }, 4000);
  CORB.on('change', function (e) {
    var p = (e && e.path) || '';
    if (applying || p === 'account' || p === 'pwa' || p === 'file' || !acct.signedIn()) return;
    push();
  });
  window.addEventListener('online', function () { if (acct.signedIn()) push(); });

  // on opening: bring in progress saved from another device, or send up what changed here
  CORB.on('boot', function () {
    if (!acct.ready() || !acct.signedIn()) return;
    setTimeout(function () {
      getRow().then(function (row) {
        var s = load() || {};
        if (!row) { putRow(); return; }
        var here = (CORB.state.meta.updatedAt || '') !== (s.lastLocal || ''), there = row.updated_at !== s.lastSync;
        if (there && !here) whenFree(function () { useRow(row); CORB.ui.toast('Your progress from your account is here.', 'ok', 4000); });
        else if (there && here) choose(row);
        else if (here) putRow();
      }).catch(function (e) { acct.error = e.message; });
    }, 2500);
  });

  // ---- the card on Settings & help ----
  acct.card = function () {
    var h = CORB.ui.h, icon = CORB.ui.icon, box = h('div.card.acct-card');
    function msg(text, kind) { return h('p.acct-msg' + (kind ? '.' + kind : ''), { role: 'status' }, text); }
    function draw(note) {
      box.innerHTML = '';
      if (acct.signedIn()) {
        box.appendChild(h('div.acct-who', {}, icon('user'), h('div', {}, h('b', {}, acct.email()), h('span', {}, 'Saved to your account: ' + when(acct.lastSync())))));
        box.appendChild(h('p.small.muted', {}, 'Your progress saves to your account a few seconds after each change. Sign in with the same email on another phone or computer to pick up where you left off.'));
        if (acct.error) box.appendChild(msg(acct.error, 'bad'));
        if (note) box.appendChild(msg(note, 'ok'));
        box.appendChild(h('div.row.mt-2', {},
          h('button.btn.sm', { type: 'button', onclick: function (e) { var b = e.currentTarget; b.disabled = true; acct.saveNow().then(function () { draw('Saved.'); }, function (er) { acct.error = er.message; draw(); }); } }, icon('upload'), 'Save now'),
          h('button.btn.sm.ghost', { type: 'button', onclick: function () { acct.signOut(); draw('Signed out. Your progress stays on this device.'); } }, icon('arrow-left'), 'Sign out')));
        return;
      }
      var email = h('input.input', { type: 'email', autocomplete: 'email', placeholder: 'you@example.com', 'aria-label': 'Email' });
      var pass = h('input.input', { type: 'password', autocomplete: 'current-password', placeholder: 'Password (8 or more characters)', 'aria-label': 'Password' });
      var out = h('div');
      function go(kind) {
        out.innerHTML = '';
        if (!email.value || pass.value.length < 8) { out.appendChild(msg('Enter your email and a password of at least 8 characters.', 'bad')); return; }
        box.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
        (kind === 'up' ? acct.signUp : acct.signIn)(email.value, pass.value).then(function (r) {
          draw(r === 'restored' ? 'Signed in. Your saved progress is now on this device.' : 'Signed in. Your progress is saved to your account.');
        }, function (er) { box.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); out.appendChild(msg(er.message, 'bad')); });
      }
      box.appendChild(h('p', {}, 'Optional. Sign in to save your progress to your account, then pick up where you left off on any phone or computer. Without an account, your progress stays on this device only.'));
      box.appendChild(h('form.acct-form', { onsubmit: function (e) { e.preventDefault(); go('in'); } }, email, pass,
        h('div.row', {}, h('button.btn.primary', { type: 'submit' }, icon('user'), 'Sign in'), h('button.btn', { type: 'button', onclick: function () { go('up'); } }, icon('plus'), 'Create account')), out));
      box.appendChild(h('p.tiny.muted', {}, 'Only your email address and your progress are stored, with Supabase in the United States. There is no password reset yet, so keep your password safe.'));
      if (note) box.appendChild(msg(note, 'ok'));
    }
    draw();
    return box;
  };
})();
