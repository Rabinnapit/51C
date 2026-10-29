/* CORE-10-ACCOUNT (web edition only; tools/build.py leaves this file out of the offline and preview editions)
   Optional accounts. A reader who creates an account (name, email, password, or Google when meta.sync.google is on) gets
   their progress (CORB.state) saved to it a few seconds after every change and restored on any other phone or computer
   where they sign in. Sign-up, sign-in and the account screen are pop-ups; the top bar shows the account button.
   Backend: the Supabase project 51C (meta.sync: url, publishable key, google, reset). The progress table lets each
   signed-in reader read and write only their own row; the signup function creates accounts that work at once (the
   name goes in user_metadata); delete-account removes the caller's own account and its saved progress.
   Nothing is sent until the reader signs in, and the guide works the same without an account.
   Session on this device: localStorage b2b.account {name, email, uid, access, refresh, exp, lastSync, lastLocal}. */
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
  acct.name = function () { var s = load(); return (s && s.name) || ''; };
  acct.firstName = function () { return acct.name().trim().split(/\s+/)[0] || ''; };
  acct.lastSync = function () { var s = load(); return (s && s.lastSync) || ''; };
  function initials() {
    var w = (acct.name() || acct.email().replace(/@.*/, '')).split(/[\s._-]+/).filter(Boolean);
    return ((w[0] || '?').charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase();
  }
  function changed() { CORB.emit('change', { path: 'account' }); refreshHome(); }
  // Home greets the reader by name: redraw it once no pop-up is open (the sign-in pop-up closes after the first sync)
  var homePending = false;
  function refreshHome() {
    if (homePending) return; homePending = true;
    (function tick() {
      if (document.querySelector('.modal-scrim')) { setTimeout(tick, 300); return; }
      homePending = false;
      if (/^#\/?(home)?(\?|$)/.test(location.hash || '#/home')) CORB.render();
    })();
  }
  function home() { return location.origin + location.pathname; }

  // ---- talking to Supabase (plain fetch: no library) ----
  function friendly(msg, status) {
    if (/invalid login credentials/i.test(msg)) return 'That email and password do not match an account.';
    if (/provider is not enabled/i.test(msg)) return 'Google sign-in is not switched on yet.';
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
    var md = (j.user && j.user.user_metadata) || {};
    var s = { name: md.name || md.full_name || (prev && prev.name) || '', email: email || (j.user && j.user.email) || (prev && prev.email) || '',
      uid: (j.user && j.user.id) || (prev && prev.uid) || '', access: j.access_token, refresh: j.refresh_token,
      exp: Date.now() + ((j.expires_in || 3600) - 60) * 1000, lastSync: prev ? prev.lastSync : '', lastLocal: prev ? prev.lastLocal : '' };
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
  function whenFree(fn) { if (document.querySelector('.modal-scrim, .tour-layer, .inst-page')) setTimeout(function () { whenFree(fn); }, 1500); else fn(); }
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
  function hello(result) {
    var n = acct.firstName() ? ', ' + acct.firstName() : '';
    return result === 'restored' ? 'Welcome back' + n + '. Your saved progress is here.' : 'Hello' + n + '. Your progress is saved to your account.';
  }

  // ---- account actions ----
  acct.signIn = function (email, password) {
    email = String(email || '').trim().toLowerCase();
    return call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: password } })
      .then(function (j) { keep(j, email, null); changed(); return firstSync(); });
  };
  acct.signUp = function (name, email, password) {
    email = String(email || '').trim().toLowerCase();
    return call('/functions/v1/signup', { method: 'POST', body: { name: name, email: email, password: password } }).then(function () { return acct.signIn(email, password); });
  };
  acct.signOut = function () {
    var s = load(); save(null); changed();
    if (s && s.access) call('/auth/v1/logout', { method: 'POST', token: s.access }).catch(function () {});
  };
  acct.saveNow = function () { return putRow(); };
  acct.setName = function (name) {
    name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    return session().then(function (s) { return call('/auth/v1/user', { method: 'PUT', token: s.access, body: { data: { name: name } } }); })
      .then(function () { var c = load(); if (c) { c.name = name; save(c); } changed(); });
  };
  acct.deleteAccount = function () {
    return session().then(function (s) { return call('/functions/v1/delete-account', { method: 'POST', token: s.access }); })
      .then(function () { save(null); changed(); });
  };
  acct.google = function () {
    if (navigator.onLine === false) { CORB.ui.toast('You are offline. Connect to the internet to continue with Google.', 'warn', 5000); return; }
    location.href = cfg().url + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(home());
  };
  acct.sendReset = function (email) {
    return call('/auth/v1/recover?redirect_to=' + encodeURIComponent(home()), { method: 'POST', body: { email: String(email || '').trim().toLowerCase() } });
  };

  // back from Google or from a password-reset email: the sign-in arrives in the address after #. An error that Supabase
  // could not tie to a sign-in (an expired or lost state, say) arrives after ? at the site URL instead.
  function fromRedirect() {
    var raw = location.hash || '';
    if (raw.indexOf('access_token=') < 0 && raw.indexOf('error_description=') < 0) raw = (location.search || '').indexOf('error_description=') >= 0 ? location.search : '';
    if (!raw) return;
    var p = {};
    raw.replace(/^[#?]/, '').split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
    try { history.replaceState(null, '', location.pathname + '#/home'); } catch (e) {}
    if (p.error_description) {
      var msg = /state has expired|bad_oauth_state/i.test(p.error_description + ' ' + (p.error_code || '')) ? 'That sign-in took too long. Tap Continue with Google again and finish within a few minutes.' : p.error_description;
      whenFree(function () { CORB.ui.toast(msg, 'warn', 8000); }); return;
    }
    call('/auth/v1/user', { token: p.access_token }).then(function (u) {
      keep({ access_token: p.access_token, refresh_token: p.refresh_token, expires_in: +p.expires_in || 3600, user: u }, u && u.email, null); changed();
      if (p.type === 'recovery') whenFree(newPassword);
      else firstSync().then(function (r) { whenFree(function () { CORB.ui.toast(hello(r), 'ok', 5000); }); });
    }).catch(function (e) { whenFree(function () { CORB.ui.toast(e.message, 'warn', 7000); }); });
  }

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

  // on opening: finish a Google sign-in or a reset, then bring in progress saved from another device or send up what changed here
  CORB.on('boot', function () {
    if (!acct.ready()) return;
    fromRedirect();
    if (!acct.signedIn()) return;
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

  // ---- screens ----
  function field(h, type, label, ac, value) { return h('input.input', { type: type, autocomplete: ac, placeholder: label, 'aria-label': label, value: value || null }); }
  function pwField(h, label, ac) {
    var input = field(h, 'password', label, ac);
    var eye = h('button.pw-eye', { type: 'button', 'aria-label': 'Show password', 'aria-pressed': 'false', title: 'Show password' }, CORB.ui.icon('eye'));
    eye.addEventListener('click', function () {
      var show = input.type === 'password'; input.type = show ? 'text' : 'password';
      eye.setAttribute('aria-pressed', String(show)); eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); eye.title = eye.getAttribute('aria-label');
      eye.replaceChildren(CORB.ui.icon(show ? 'eye-off' : 'eye')); input.focus();
    });
    return { el: h('div.pw', {}, input, eye), input: input };
  }
  function googleButton(h) {
    return h('button.btn.google-btn', { type: 'button', onclick: function () { acct.google(); } },
      h('span.g-logo', { html: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>' }),
      'Continue with Google');
  }
  function errorLine(h) { return h('p.acct-msg.bad', { role: 'alert' }); }

  acct.openSignIn = function (prefill) {
    var h = CORB.ui.h, c = cfg();
    var email = field(h, 'email', 'Email', 'email', prefill), pw = pwField(h, 'Password', 'current-password'), err = errorLine(h);
    var btn = h('button.btn.primary.acct-go', { type: 'submit' }, 'Sign in');
    var form = h('form.acct-form', { onsubmit: function (e) {
      e.preventDefault(); err.textContent = '';
      if (!email.value || !pw.input.value) { err.textContent = 'Enter your email and your password.'; return; }
      btn.disabled = true; btn.textContent = 'Signing in…';
      acct.signIn(email.value, pw.input.value).then(function (r) { CORB.ui.closeModal(); CORB.ui.toast(hello(r), 'ok', 5000); },
        function (x) { btn.disabled = false; btn.textContent = 'Sign in'; err.textContent = x.message; });
    } }, email, pw.el, err, btn);
    CORB.ui.modal({ title: 'Sign in to B2B Exam Prep', body: h('div.acct-modal', {},
      c.google ? googleButton(h) : null, c.google ? h('div.acct-or', {}, h('span', {}, 'or')) : null, form,
      h('button.linkish', { type: 'button', onclick: function () {
        err.className = 'acct-msg bad'; err.textContent = '';
        if (!c.reset) { err.className = 'acct-msg'; err.textContent = 'This app sends no email, so there is no reset link. Create a new account with a new password: the progress on this device stays with you' + (c.google ? ', or continue with Google, which needs no password.' : '.'); return; }
        if (!email.value) { err.textContent = 'Type your email above first.'; return; }
        acct.sendReset(email.value).then(function () { err.className = 'acct-msg ok'; err.textContent = 'Check your email for a link to set a new password.'; },
          function (x) { err.className = 'acct-msg bad'; err.textContent = x.message; });
      } }, 'Forgot your password?'),
      h('p.acct-switch', {}, 'New here? ', h('button.linkish', { type: 'button', onclick: function () { acct.openSignUp(email.value); } }, 'Create an account'))) });
    setTimeout(function () { try { (prefill ? pw.input : email).focus(); } catch (e) {} }, 60);
  };

  acct.openSignUp = function (prefill) {
    var h = CORB.ui.h, c = cfg();
    var name = field(h, 'text', 'Your name', 'name'), email = field(h, 'email', 'Email', 'email', prefill), pw = pwField(h, 'Password (8 or more characters)', 'new-password'), err = errorLine(h);
    var agree = h('input', { type: 'checkbox', id: 'acct-agree' });
    var btn = h('button.btn.primary.acct-go', { type: 'submit' }, 'Create account');
    var form = h('form.acct-form', { onsubmit: function (e) {
      e.preventDefault(); err.textContent = '';
      if (!name.value.trim()) { err.textContent = 'Enter your name.'; return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { err.textContent = 'Enter a valid email address.'; return; }
      if (pw.input.value.length < 8) { err.textContent = 'Use a password of at least 8 characters.'; return; }
      if (!agree.checked) { err.textContent = 'Please agree to the terms of use.'; return; }
      btn.disabled = true; btn.textContent = 'Creating your account…';
      acct.signUp(name.value.trim(), email.value, pw.input.value).then(function () {
        CORB.ui.closeModal(); CORB.ui.toast('Welcome, ' + (acct.firstName() || 'friend') + '! Your account is ready and your progress is saved to it.', 'ok', 6000);
      }, function (x) { btn.disabled = false; btn.textContent = 'Create account'; err.textContent = x.message; });
    } }, name, email, pw.el,
      h('label.acct-agree', { for: 'acct-agree' }, agree, h('span', {}, 'I agree to the terms of use')),
      CORB.terms && CORB.terms.body ? h('details.acct-terms', {}, h('summary', {}, 'Read the terms of use'), CORB.terms.body(h)) : null,
      err, btn);
    CORB.ui.modal({ title: 'Create your account', body: h('div.acct-modal', {},
      h('p.small.muted', {}, 'Free. Saves your progress so you can pick up on any phone or computer.'),
      c.google ? googleButton(h) : null, c.google ? h('div.acct-or', {}, h('span', {}, 'or')) : null, form,
      h('p.acct-switch', {}, 'Already have an account? ', h('button.linkish', { type: 'button', onclick: function () { acct.openSignIn(email.value); } }, 'Sign in'))) });
    setTimeout(function () { try { name.focus(); } catch (e) {} }, 60);
  };

  function newPassword() {
    var h = CORB.ui.h, pw = pwField(h, 'New password (8 or more characters)', 'new-password'), err = errorLine(h);
    var btn = h('button.btn.primary.acct-go', { type: 'submit' }, 'Save new password');
    CORB.ui.modal({ title: 'Set a new password', sticky: true, body: h('div.acct-modal', {}, h('form.acct-form', { onsubmit: function (e) {
      e.preventDefault(); err.textContent = '';
      if (pw.input.value.length < 8) { err.textContent = 'Use at least 8 characters.'; return; }
      btn.disabled = true;
      session().then(function (s) { return call('/auth/v1/user', { method: 'PUT', token: s.access, body: { password: pw.input.value } }); })
        .then(function () { CORB.ui.closeModal(); CORB.ui.toast('Password changed. You are signed in.', 'ok', 5000); firstSync().catch(function () {}); },
          function (x) { btn.disabled = false; err.textContent = x.message; });
    } }, pw.el, err, btn)) });
  }

  acct.openMenu = function () {
    var h = CORB.ui.h, icon = CORB.ui.icon, note = h('p.acct-msg', { role: 'status' }, acct.error || '');
    if (acct.error) note.className = 'acct-msg bad';
    var nameIn = field(h, 'text', 'Your name', 'name', acct.name());
    CORB.ui.modal({ title: 'Your account', body: h('div.acct-modal', {},
      h('div.acct-who', {}, h('span.avatar.lg', {}, initials()), h('div', {}, h('b', {}, 'Hello' + (acct.firstName() ? ', ' + acct.firstName() : '') + '!'), h('span', {}, acct.email()), h('span', {}, 'Saved to your account: ' + when(acct.lastSync())))),
      note,
      h('div.row.mt-3', {},
        h('button.btn.sm', { type: 'button', onclick: function () { note.className = 'acct-msg'; note.textContent = 'Saving…'; acct.saveNow().then(function () { note.className = 'acct-msg ok'; note.textContent = 'Saved.'; }, function (x) { note.className = 'acct-msg bad'; note.textContent = x.message; }); } }, icon('upload'), 'Save now'),
        h('button.btn.sm.ghost', { type: 'button', onclick: function () { acct.signOut(); CORB.ui.closeModal(); CORB.ui.toast('Signed out. Your progress stays on this device.', 'ok', 4000); } }, icon('arrow-left'), 'Sign out')),
      h('details.acct-more', {}, h('summary', {}, 'Change your name'),
        h('form.acct-form', { onsubmit: function (e) { e.preventDefault(); acct.setName(nameIn.value).then(function () { CORB.ui.closeModal(); CORB.ui.toast('Name saved.', 'ok'); }, function (x) { note.className = 'acct-msg bad'; note.textContent = x.message; }); } },
          nameIn, h('button.btn.sm', { type: 'submit' }, 'Save name'))),
      h('details.acct-more', {}, h('summary', {}, 'Delete my account'),
        h('p.small', {}, 'This deletes your account and the progress saved in it, for good. The progress on this device stays.'),
        h('button.btn.sm.danger', { type: 'button', onclick: function (e) {
          var b = e.currentTarget; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Tap again to delete for good'; return; }
          b.disabled = true;
          acct.deleteAccount().then(function () { CORB.ui.closeModal(); CORB.ui.toast('Your account was deleted. Your progress stays on this device.', 'ok', 6000); },
            function (x) { b.disabled = false; note.className = 'acct-msg bad'; note.textContent = x.message; });
        } }, icon('trash'), 'Delete my account'))) });
  };

  // the top bar's account button: initials once signed in, otherwise Sign in
  acct.topButton = function () {
    var h = CORB.ui.h, b = h('button.btn.sm.ghost.acct-btn', { type: 'button', onclick: function () { if (acct.signedIn()) acct.openMenu(); else acct.openSignIn(); } });
    function paint() {
      b.innerHTML = '';
      if (acct.signedIn()) { b.appendChild(h('span.avatar', {}, initials())); b.setAttribute('aria-label', 'Your account'); b.title = acct.name() || acct.email(); }
      else { b.appendChild(CORB.ui.icon('user')); b.appendChild(h('span.acct-label', {}, 'Sign in')); b.setAttribute('aria-label', 'Sign in'); b.title = 'Sign in to save your progress'; }
    }
    paint();
    CORB.on('change', function (e) { var p = e && e.path; if (p === 'account' || p === '*') paint(); });
    return b;
  };

  // ---- the card on Settings & help ----
  acct.card = function () {
    var h = CORB.ui.h, icon = CORB.ui.icon, box = h('div.card.acct-card');
    function draw() {
      box.innerHTML = '';
      if (acct.signedIn()) {
        box.appendChild(h('div.acct-who', {}, h('span.avatar.lg', {}, initials()), h('div', {}, h('b', {}, acct.name() || acct.email()), h('span', {}, acct.email()), h('span', {}, 'Saved to your account: ' + when(acct.lastSync())))));
        box.appendChild(h('div.row.mt-3', {}, h('button.btn.sm.primary', { type: 'button', onclick: acct.openMenu }, icon('user'), 'Your account')));
        return;
      }
      box.appendChild(h('p', {}, 'Optional. Create a free account to save your progress, then pick up where you left off on any phone or computer. Without one, your progress stays on this device only.'));
      box.appendChild(h('div.row', {}, h('button.btn.primary', { type: 'button', onclick: function () { acct.openSignUp(); } }, icon('plus'), 'Create account'),
        h('button.btn', { type: 'button', onclick: function () { acct.openSignIn(); } }, icon('user'), 'Sign in')));
      box.appendChild(h('p.tiny.muted', {}, 'Only your name, email address and progress are stored, with Supabase in the United States (with Google, also the profile picture link Google shares).'));
    }
    draw();
    CORB.on('change', function (e) { var p = e && e.path; if ((p === 'account' || p === '*') && box.isConnected) draw(); });
    return box;
  };
})();
