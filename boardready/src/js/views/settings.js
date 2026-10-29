/* VIEW: settings — every preference in the app, on one page.
   Layout: page head, storage banner, sticky section index beside a stack of setting cards
   (Profile, Appearance, Voice, AI connector, Board room, Data). Version and sources live on the About page.
   Data: CORB.DATA.units, CORB.DATA.meta, CORB.DATA.process.warrant_classes, CORB.connector.PROVIDERS.
   Every card degrades on its own: a missing data module only removes its own control, never throws.
   Persists: profile.name/role/unit/targetClass/started/theme, settings.* (hideAnswersDefault,
   showDrafts, tts, ttsRate, projector, boardPasscode, connector.*). The API key lives only in this
   browser (CORB.store writes it to its own key) and is stripped from every exported file. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, util = CORB.util;

  var SECTIONS = [
    { id: 'profile', title: 'Profile', icon: 'user', blurb: 'Your name, organization and warrant class' },
    { id: 'appearance', title: 'Appearance', icon: 'sun', blurb: CORB.isCandidateEdition() ? 'Theme, text size and answers' : 'Theme, text size, projector mode and answers' },
    { id: 'app', title: 'Get the app', icon: 'download', blurb: 'Install it on a phone or computer, or download a copy for computers without internet' },
    { id: 'voice', title: 'Voice', icon: 'volume', blurb: 'Read questions aloud' },
    { id: 'ai', title: 'AI connector', icon: 'spark', blurb: 'Optional endpoint for the mentor and mock-board feedback' },
    { id: 'boardroom', title: 'Board room', icon: 'key', blurb: 'Keep candidates out of the scoring views' },
    { id: 'data', title: 'Your data', icon: 'download', blurb: 'Save notes, export, import, reset' }
  ];

  var R = null;            // live DOM references for the current render
  var testResult = null;   // {kind, title, detail} kept across re-renders (theme/role toggles re-render)
  var pendingScroll = null;// section to scroll back to after a re-render we caused
  var fieldId = 0;

  // ---------------------------------------------------------------- helpers
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function hasView(id) { return !!(CORB.views && CORB.views[id]); }
  function sec(id) { for (var i = 0; i < SECTIONS.length; i++) { if (SECTIONS[i].id === id) return SECTIONS[i]; } return SECTIONS[0]; }
  function cand() { return CORB.isCandidateEdition(); }
  function online() { return CORB.hasConnector(); }
  function shown(id) { return !(cand() && id === 'boardroom') && !(!online() && id === 'ai') && !(id === 'app' && !(CORB.isWeb && CORB.isWeb())); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return v == null ? '' : String(v); }
  function meta() { return (CORB.DATA && CORB.DATA.meta) || {}; }
  function units() { return arr(CORB.DATA && CORB.DATA.units); }

  var toastSaved = util.debounce(function () { ui.toast('Saved', 'ok'); }, 550);
  function save(path, value, opts) {
    try { CORB.set(path, value); } catch (e) { ui.toast('Could not save that setting', 'danger'); return false; }
    if (opts && opts.message) ui.toast(opts.message, 'ok'); else toastSaved();
    return true;
  }

  function fid() { return 'set-f' + (++fieldId); }
  function field(label, ctl, hint) {
    if (!ctl.id) ctl.id = fid();
    var hintEl = null;
    if (hint) { hintEl = h('div.hint', { id: ctl.id + '-h' }, hint); ctl.setAttribute('aria-describedby', ctl.id + '-h'); }
    return h('div.field.set-field', {}, h('label', { 'for': ctl.id }, label), ctl, hintEl);
  }
  function toggleRow(o) {
    var input = h('input', { type: 'checkbox', checked: !!o.checked, onchange: function (e) { o.onchange(!!e.target.checked, e.target); } });
    return h('label.set-toggle', {},
      h('span.set-toggle-copy', {}, h('span.set-toggle-name', {}, o.name), o.note ? h('span.set-toggle-note', {}, o.note) : null),
      input);
  }
  function cardShell(sec, children) {
    return h('section.card.set-card', { id: 'set-' + sec.id, 'aria-labelledby': 'set-h-' + sec.id, tabindex: '-1' },
      h('div.set-card-head', {},
        h('span.set-card-icon', {}, icon(sec.icon)),
        h('div.set-card-title', {}, h('h2', { id: 'set-h-' + sec.id }, sec.title), h('p', {}, sec.blurb))),
      h('div.set-card-body', {}, children));
  }
  function goSection(id) {
    var el = document.getElementById('set-' + id);
    if (!el) return;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); }
    try { el.focus({ preventScroll: true }); } catch (e) {}
  }

  // ---------------------------------------------------------------- profile
  function profileCard() {
    var body = [];

    var nameIn = h('input.input', {
      type: 'text', value: str(CORB.get('profile.name', '')), maxlength: '60', autocomplete: 'off',
      placeholder: 'Rank and last name, or however you want to be greeted',
      oninput: function (e) { save('profile.name', e.target.value.slice(0, 60)); }
    });
    body.push(field('Your name', nameIn, 'Used to greet you and to name your progress file.'));

    var role = safe(function () { return CORB.role(); }, 'candidate');
    var roleLabel = safe(function () { return CORB.roleLabel(role); }, role);
    if (!cand()) body.push(h('div.field.set-field', {},
      h('label', {}, 'Role'),
      h('div.set-role', {},
        h('span.set-role-now', {}, icon(role === 'candidate' ? 'user' : 'users'), h('b', {}, roleLabel)),
        h('button.btn.sm', { type: 'button', onclick: function () { pendingScroll = 'profile'; ui.rolePicker(); } }, 'Change role', icon('chevron-right'))),
      h('div.hint', {}, 'Candidates study and rehearse. Board members and facilitators also get the board room, the projector and the content editor. A facilitator passcode, if one is set below, is required to switch.')));

    var us = units();
    if (us.length) {
      var unitSel = h('select.select', {
        onchange: function (e) {
          var v = e.target.value;
          save('profile.unit', v, { message: 'Showing ' + safe(function () { return CORB.unitName(v); }, v) });
          var top = document.querySelector('.topbar .unit-select'); if (top) { try { top.value = v; } catch (err) {} }
          var d = R && R.unitDesc; if (d) d.textContent = unitDescription(v);
        }
      }, us.map(function (u) { return h('option', { value: u.id, selected: u.id === safe(function () { return CORB.unit(); }, '') }, u.short || u.name || u.id); }));
      R.unitDesc = h('div.hint', {}, unitDescription(safe(function () { return CORB.unit(); }, '')));
      var unitWrap = h('div.field.set-field', {}, h('label', { 'for': unitSel.id = fid() }, 'Organization'), unitSel, R.unitDesc);
      body.push(unitWrap);
    } else {
      body.push(h('div.callout.info', {}, icon('info'), h('div', {}, h('b', {}, 'No organization list in this copy'), 'Questions from every organization are shown. Rebuild the app with the unit data to filter by command.')));
    }

    // the same class control as every other page: the class, and Change opens the top-bar picker
    body.push(h('div.field.set-field', {}, ui.classLine()));

    return cardShell(sec('profile'), body);
  }
  function unitDescription(id) {
    var u = units().filter(function (x) { return x.id === id; })[0];
    if (u && u.description) return u.description;
    return 'Filters the question bank, flashcards, quizzes and mock boards. ACC-wide questions are always included.';
  }

  // ------------------------------------------------------------- appearance
  function isDark() { return safe(function () { return document.documentElement.getAttribute('data-theme') === 'dark'; }, false); }
  function appearanceCard() {
    var cur = str(CORB.get('profile.theme') || 'light'); cur = cur === 'dark' || cur === 'system' ? cur : 'light';
    var themeBtns = [['light', 'Day', 'sun'], ['dark', 'Night', 'moon'], ['system', 'Match my device', 'monitor']].map(function (o) {
      var on = o[0] === cur;
      return h('button' + (on ? '.on' : ''), {
        type: 'button', 'aria-pressed': on ? 'true' : 'false',
        onclick: function () { if (o[0] === cur) return; pendingScroll = 'appearance'; safe(function () { CORB.setTheme(o[0]); }, null); CORB.render(); }
      }, icon(o[2]), o[1]);
    });
    var theme = h('div.field.set-field', {},
      h('label', {}, 'Theme'),
      h('div.seg.set-seg', { role: 'group', 'aria-label': 'Theme' }, themeBtns),
      h('div.hint', {}, 'Night is easier on the eyes in a dark room. Match my device follows the phone or computer setting.'));
    var size = +CORB.get('profile.textSize', 0) || 0;
    var sizeBtns = [[0, 'Normal'], [1, 'Large'], [2, 'Larger'], [3, 'Largest']].map(function (o) {
      var on = o[0] === size;
      return h('button' + (on ? '.on' : ''), { type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: function () { if (o[0] === size) return; pendingScroll = 'appearance'; safe(function () { CORB.setTextSize(o[0]); }, null); CORB.render(); } }, o[1]);
    });
    var textSize = h('div.field.set-field', {},
      h('label', {}, 'Text size'),
      h('div.seg.set-seg', { role: 'group', 'aria-label': 'Text size' }, sizeBtns),
      h('div.hint', {}, 'Also in the top bar (the text button), and in the side menu on a phone.'));

    var projOn = safe(function () { return document.body.hasAttribute('data-projector'); }, false);
    var proj = toggleRow({
      name: 'Projector mode', checked: projOn,
      note: 'Makes everything bigger for a conference-room screen.',
      onchange: function (v, input) {
        var now = safe(function () { return document.body.hasAttribute('data-projector'); }, false);
        if (now !== v) safe(function () { CORB.toggleProjector(); }, null);
        input.checked = safe(function () { return document.body.hasAttribute('data-projector'); }, v);
      }
    });

    var hideAns = toggleRow({
      name: 'Hide answers until I ask', checked: !!CORB.get('settings.hideAnswersDefault', true),
      note: 'Answers stay hidden until you click Show answer, so you recall the answer first.',
      onchange: function (v) { save('settings.hideAnswersDefault', v, { message: v ? 'Answers stay hidden until you reveal them' : 'Answers show by default' }); }
    });

    var drafts = toggleRow({
      name: 'Show AI-drafted answers', checked: !!CORB.get('settings.showDrafts', true),
      note: 'AI drafts are study starters that are not verified. They always carry the AI draft badge.',
      onchange: function (v) { save('settings.showDrafts', v, { message: v ? 'AI drafts visible — always verify them' : 'AI drafts hidden' }); }
    });

    return cardShell(sec('appearance'), [theme, textSize, h('div.set-toggles', {}, cand() ? null : proj, hideAns, drafts)]);
  }

  // ------------------------------------------------------------------ voice
  function voiceCard() {
    var available = safe(function () { return !!(CORB.speech && CORB.speech.available); }, false);
    if (!available) {
      return cardShell(sec('voice'), h('div.callout.info', {}, icon('info'), h('div', {},
        h('b', {}, 'This browser has no offline speech voice'),
        'Read-aloud buttons stay hidden. Everything else works the same. On a government laptop, try reopening the app after Windows finishes loading its voices.')));
    }
    var on = CORB.get('settings.tts', true) !== false;
    var rate = Number(CORB.get('settings.ttsRate', 1)) || 1;

    var rateOut = h('span.set-rate-val.num', {}, rate.toFixed(2) + '×');
    var slider = h('input.set-range', {
      type: 'range', min: '0.6', max: '1.6', step: '0.05', value: String(rate),
      'aria-label': 'Speaking speed',
      oninput: function (e) { rateOut.textContent = Number(e.target.value).toFixed(2) + '×'; },
      onchange: function (e) { save('settings.ttsRate', Number(e.target.value) || 1); }
    });

    var testBtn = h('button.btn', { type: 'button', onclick: function () {
      var sp = CORB.speech;
      if (sp.speaking) { safe(function () { sp.stop(); }, null); return; }
      if (CORB.get('settings.tts', true) === false) { ui.toast('Turn read aloud on first', 'warn'); return; }
      var ok = safe(function () { return sp.speak('Under what authority may a KO limit the sources solicited? Cite the RFO numbering, for example FAR 6.103-1.', { rate: Number(slider.value) || 1 }); }, false);
      if (!ok) ui.toast('The browser would not start the voice', 'warn');
    } }, icon('play'), 'Test the voice');

    var voiceSel = h('select.select', { 'aria-label': 'Voice', onchange: function (e) { safe(function () { CORB.speech.setVoice(e.target.value); }, null); toastSaved(); } });
    function fillVoices() {
      voiceSel.innerHTML = '';
      var list = safe(function () { return CORB.speech.voices ? CORB.speech.voices() : []; }, []) || [], curV = str(CORB.get('settings.voice', ''));
      voiceSel.appendChild(h('option', { value: '' }, 'Best voice on this device' + (list[0] ? ': ' + list[0].name : '')));
      function group(label, items) { if (!items.length) return; var g = h('optgroup', { label: label }); items.forEach(function (v) { g.appendChild(h('option', { value: v.id, selected: v.id === curV }, v.name)); }); voiceSel.appendChild(g); }
      group('Natural voices', list.filter(function (v) { return v.natural; })); group('Standard voices', list.filter(function (v) { return !v.natural; }));
    }
    fillVoices();
    var offVoices = CORB.on('voices', function () { if (voiceSel.isConnected) fillVoices(); else offVoices(); });
    var toneCur = CORB.get('settings.ttsTone', 'lively') === 'even' ? 'even' : 'lively';
    var toneBtns = [['lively', 'Lively'], ['even', 'Even']].map(function (o) {
      var on = o[0] === toneCur;
      return h('button' + (on ? '.on' : ''), { type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: function () { if (o[0] === toneCur) return; pendingScroll = 'voice'; save('settings.ttsTone', o[0]); CORB.render(); } }, o[1]);
    });
    var body = [
      h('div.set-toggles', {}, toggleRow({
        name: 'Read aloud', checked: on,
        note: 'Adds a speaker button to questions and flashcards.',
        onchange: function (v) { if (!v) safe(function () { CORB.speech.stop(); }, null); save('settings.tts', v, { message: v ? 'Read aloud on' : 'Read aloud off' }); }
      })),
      h('div.field.set-field', {},
        h('label', { 'for': voiceSel.id = fid() }, 'Voice'), voiceSel,
        h('div.hint', {}, 'Voices come from your phone or computer; natural ones sound like a person. The list shows the best first.')),
      h('div.field.set-field', {},
        h('label', {}, 'Tone'), h('div.seg.set-seg', { role: 'group', 'aria-label': 'Tone' }, toneBtns),
        h('div.hint', {}, 'Lively rises on a question and settles at the end of a sentence, and says KO, COR and DFARS the way contracting people do. Even keeps one tone.')),
      h('details.set-more', {}, h('summary', {}, 'Want a more human voice?'), h('ul.set-tips', {},
        h('li', {}, h('b', {}, 'Windows: '), 'Microsoft Edge has natural voices built in (Aria, Guy, Jenny); Chrome has only the basic ones.'),
        h('li', {}, h('b', {}, 'iPhone or iPad: '), 'Settings, Accessibility, Spoken Content, Voices, English: download an Enhanced or Premium voice, then reopen the app and pick it above.'),
        h('li', {}, h('b', {}, 'Android: '), 'Settings, General management (or System), Language, Text-to-speech, Google Speech Services: install voice data.'))),
      h('div.field.set-field', {},
        h('label', { 'for': slider.id = fid() }, 'Speaking speed'),
        h('div.set-rate', {}, h('span.set-rate-end', {}, 'Slower'), slider, h('span.set-rate-end', {}, 'Faster'), rateOut),
        h('div.hint', {}, 'Practising a little faster than normal speech makes the real room feel calm.')),
      h('div.set-actions', {}, testBtn)
    ];
    return cardShell(sec('voice'), body);
  }


  // ------------------------------------------------------------- get the app (web edition)
  function appCard() {
    var m = meta(), standalone = safe(function () { return !!(CORB.pwa && CORB.pwa.isStandalone()); }, false);
    var base = str(m.app_name || 'Board Ready').replace(/[^\w-]+/g, '');
    var install = standalone ? h('p', {}, 'You are using the installed app. It works offline and updates itself when a newer build is published.')
      : h('div.stack', {},
        h('p', {}, 'The installed app has its own icon, opens full screen without a browser bar, works with no signal and updates itself.'),
        h('div.set-actions', {}, h('button.btn.primary', { type: 'button', onclick: function () { safe(function () { CORB.pwa.showInstall(); }, null); } }, icon('download'), 'Install the app')),
        h('ul.set-tips', {},
          h('li', {}, 'Android: Chrome installs it with one tap. Samsung Internet and other browsers make only a shortcut, so the page hands over to Chrome.'),
          h('li', {}, 'iPhone or iPad: Safari only (Apple\'s rule). Share, then Add to Home Screen, then Add.'),
          h('li', {}, 'Computer: Edge or Chrome, the install icon at the right end of the address bar.')));
    var files = h('div.stack', {},
      h('p', {}, 'Army networks often block websites like this one. Download the single-file copy for Teams, SharePoint or a thumb drive, or the Word package for Army email (which blocks .html attachments).'),
      h('div.set-actions', {},
        h('a.btn', { href: 'downloads/' + base + '-Candidate-Offline.html', download: base + '-Candidate-Offline.html' }, icon('download'), 'Candidate copy, offline (.html)'),
        h('a.btn', { href: 'downloads/' + base + '.html', download: base + '.html' }, icon('download'), 'Full copy for board members (.html)'),
        h('a.btn', { href: 'downloads/1 - READ ME FIRST - How to install Board Ready.docx', download: '' }, icon('mail'), 'Email package: READ ME FIRST'),
        h('a.btn', { href: 'downloads/4 - ' + base + '-Candidate-Offline.html.docx', download: '' }, icon('mail'), 'Email package: candidate code document')),
      h('p.small.muted', {}, 'A downloaded copy keeps the date it was built' + (m.built_on ? ' (this build: ' + str(m.built_on).slice(0, 10) + ')' : '') + '. When the content changes, download it again.'));
    return cardShell(sec('app'), [install, h('h3.set-sub', {}, 'Copies for computers without internet'), files]);
  }

  // ------------------------------------------------------------- ai connector
  function providers() {
    var p = arr(safe(function () { return CORB.connector.PROVIDERS; }, []));
    return p.length ? p : [{ id: 'openai', name: 'OpenAI-compatible endpoint', hint: 'Base URL ends before /chat/completions', defaultModel: '' }];
  }
  function providerById(id) { var list = providers(); for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; } return list[0]; }

  function connectorCard() {
    var cs = safe(function () { return CORB.connector.settings() || {}; }, {}) || {};
    var body = [];

    body.push(h('div.callout.info.set-key-note', {}, icon('shield'), h('div', {},
      h('b', {}, 'Your key stays in this browser'),
      'The API key is written only to this browser\'s local storage on this machine. It is stripped from every progress file you export and from every copy of the app you save, so a file you email carries no credential. On a network with no internet route the connector simply fails and the offline mentor answers from the embedded repository instead.')));

    var provSel = h('select.select', { onchange: function (e) {
      var p = providerById(e.target.value);
      save('settings.connector.provider', p.id);
      if (R.provHint) R.provHint.textContent = p.hint || '';
      if (R.modelIn && !R.modelIn.value && p.defaultModel) { R.modelIn.value = p.defaultModel; save('settings.connector.model', p.defaultModel); }
      if (R.modelIn) R.modelIn.placeholder = p.defaultModel || 'model name';
      clearTest();
    } }, providers().map(function (p) { return h('option', { value: p.id, selected: p.id === (cs.provider || 'openai') }, p.name || p.id); }));
    R.provHint = h('div.hint', {}, providerById(cs.provider || 'openai').hint || '');
    body.push(h('div.field.set-field', {}, h('label', { 'for': provSel.id = fid() }, 'Provider'), provSel, R.provHint));

    var preset = h('button.btn.sm.set-preset', { type: 'button', onclick: function () {
      save('settings.connector.provider', 'openai', { message: 'Preset applied — paste the chat.genai base URL' });
      try { provSel.value = 'openai'; } catch (e) {}
      if (R.provHint) R.provHint.textContent = providerById('openai').hint || '';
      clearTest();
      if (R.baseIn) { try { R.baseIn.focus(); R.baseIn.select(); } catch (e) {} }
    } }, icon('zap'), 'Army chat.genai (OpenAI-compatible)');
    body.push(h('div.set-preset-row', {}, preset, h('span.muted.small', {}, 'Sets the provider to OpenAI-compatible and puts the cursor in the base URL. Ask your organization for the current host, model name and key — this app ships none.')));

    R.baseIn = h('input.input', { type: 'url', spellcheck: 'false', autocomplete: 'off', value: str(cs.baseUrl), placeholder: 'https://host/v1',
      oninput: function (e) { save('settings.connector.baseUrl', e.target.value.trim()); clearTest(); paintStatus(); } });
    body.push(field('Base URL', R.baseIn, 'Everything before the path the provider adds. For an OpenAI-compatible endpoint that is usually the address ending in /v1.'));

    R.modelIn = h('input.input', { type: 'text', spellcheck: 'false', autocomplete: 'off', value: str(cs.model), placeholder: providerById(cs.provider || 'openai').defaultModel || 'model name',
      oninput: function (e) { save('settings.connector.model', e.target.value.trim()); clearTest(); paintStatus(); } });
    body.push(field('Model', R.modelIn, 'Exactly as the endpoint names it. A wrong model name is the most common cause of a failed test.'));

    R.keyIn = h('input.input.set-key-input', { type: 'password', autocomplete: 'off', spellcheck: 'false', value: str(cs.apiKey), placeholder: 'Paste the key — it is never shown in exports',
      oninput: function (e) { save('settings.connector.apiKey', e.target.value.trim()); clearTest(); paintStatus(); } });
    var reveal = h('button.btn.icon.sm.ghost.set-key-eye', { type: 'button', 'aria-pressed': 'false', 'aria-label': 'Show the API key', onclick: function () {
      var showing = R.keyIn.type === 'text';
      R.keyIn.type = showing ? 'password' : 'text';
      this.setAttribute('aria-pressed', showing ? 'false' : 'true');
      this.setAttribute('aria-label', showing ? 'Show the API key' : 'Hide the API key');
      this.innerHTML = ''; this.appendChild(icon(showing ? 'eye' : 'eye-off'));
    } }, icon('eye'));
    var keyRow = h('div.set-key-row', {}, R.keyIn, reveal);
    R.keyIn.id = fid();
    body.push(h('div.field.set-field', {}, h('label', { 'for': R.keyIn.id }, 'API key'), keyRow,
      h('div.hint', {}, 'Stored on this machine only. Clear the box to remove it. If your endpoint needs no key, turn on the switch below.')));

    body.push(h('div.set-toggles', {}, toggleRow({
      name: 'This endpoint needs no key', checked: !!cs.noKey,
      note: 'For a local model server such as Ollama or vLLM running on your own machine.',
      onchange: function (v) { save('settings.connector.noKey', v); clearTest(); paintStatus(); }
    })));

    R.headersIn = h('textarea.textarea.set-headers', { spellcheck: 'false', rows: '3', placeholder: '{"X-Api-Group": "contracting"}',
      oninput: function (e) { onHeaders(e.target.value); } });
    R.headersIn.value = str(cs.headers);
    R.headersHint = h('div.hint', {}, 'Optional. A JSON object of extra request headers, if your gateway needs one. Leave empty for a normal endpoint.');
    R.headersIn.id = fid();
    body.push(h('div.field.set-field', {}, h('label', { 'for': R.headersIn.id }, 'Extra headers (JSON)'), R.headersIn, R.headersHint));

    R.testBtn = h('button.btn.primary', { type: 'button', onclick: runTest }, icon('zap'), 'Test connection');
    R.status = h('div.set-conn-status', { 'aria-live': 'polite' });
    R.result = h('div.set-conn-result', { 'aria-live': 'polite' });
    body.push(h('div.set-actions', {}, R.testBtn,
      hasView('mentor') ? h('button.btn.ghost', { type: 'button', onclick: function () { CORB.go('mentor'); } }, icon('chat'), 'Open the mentor') : null,
      R.status));
    body.push(R.result);
    paintStatus(); paintResult();

    body.push(h('p.small.muted.set-foot-note', {}, 'The connector is optional. With no endpoint the mentor still answers from the embedded question bank, primers, glossary and thresholds — it retrieves instead of generating, and says so.'));

    return cardShell(sec('ai'), body);
  }

  function onHeaders(v) {
    var t = String(v == null ? '' : v).trim();
    var ok = true;
    if (t) { try { var o = JSON.parse(t); ok = !!o && typeof o === 'object' && !Array.isArray(o); } catch (e) { ok = false; } }
    if (R.headersIn) R.headersIn.classList.toggle('invalid', !ok);
    if (R.headersHint) {
      R.headersHint.classList.toggle('bad', !ok);
      R.headersHint.textContent = ok
        ? 'Optional. A JSON object of extra request headers, if your gateway needs one. Leave empty for a normal endpoint.'
        : 'That is not a JSON object yet — it must look like {"Header-Name": "value"}. It will be ignored until it parses.';
    }
    if (ok) { save('settings.connector.headers', t); clearTest(); }
  }

  function clearTest() { if (testResult) { testResult = null; paintResult(); } }
  function paintStatus() {
    var el = R && R.status; if (!el) return;
    var ready = safe(function () { return CORB.connector.configured(); }, false);
    el.innerHTML = '';
    el.appendChild(h('span.set-dot' + (ready ? '.ok' : ''), {}));
    el.appendChild(h('span', {}, ready ? 'Ready to test' : 'Base URL, model and key (or no-key) are needed'));
  }
  function paintResult() {
    var el = R && R.result; if (!el) return;
    el.innerHTML = '';
    if (!testResult) return;
    el.appendChild(h('div.callout.' + testResult.kind, {}, icon(testResult.kind === 'ok' ? 'check' : testResult.kind === 'danger' ? 'alert' : 'info'),
      h('div', {}, h('b', {}, testResult.title), testResult.detail)));
  }
  function runTest() {
    if (!safe(function () { return CORB.connector.configured(); }, false)) {
      testResult = { kind: 'warn', title: 'Not enough to test yet', detail: 'Fill in the base URL and the model name, and either paste a key or turn on "this endpoint needs no key".' };
      paintResult(); return;
    }
    var btn = R.testBtn;
    btn.disabled = true; btn.innerHTML = ''; btn.appendChild(icon('refresh')); btn.appendChild(document.createTextNode(' Testing…'));
    testResult = { kind: 'info', title: 'Contacting the endpoint…', detail: 'One short request is sent and the reply is discarded. This times out after 60 seconds.' };
    paintResult();
    var p = safe(function () { return CORB.connector.test(); }, null);
    if (!p || typeof p.then !== 'function') { finishTest({ kind: 'danger', title: 'The connector is not available in this copy', detail: 'Rebuild the app with the connector module, or use the offline mentor.' }); return; }
    p.then(function (text) {
      var got = str(text).trim().slice(0, 160);
      finishTest({ kind: 'ok', title: 'Connected', detail: 'The endpoint answered' + (got ? ' with “' + got + '”' : '') + '. The mentor, mock-board feedback and answer coaching can now use it.' });
    }).catch(function (e) {
      finishTest({ kind: 'danger', title: 'No answer from that endpoint', detail: str(e && e.message || e) || 'The request failed.' });
    });
  }
  function finishTest(res) {
    testResult = res; paintResult();
    var btn = R && R.testBtn;
    if (btn) { btn.disabled = false; btn.innerHTML = ''; btn.appendChild(icon('zap')); btn.appendChild(document.createTextNode(' Test connection')); }
  }

  // ------------------------------------------------------------- board room
  function boardRoomCard() {
    var has = !!str(CORB.get('settings.boardPasscode', ''));
    var input = h('input.input', { type: 'password', autocomplete: 'off', placeholder: has ? 'Enter a new passcode to replace the current one' : 'Choose a short passcode', maxlength: '40' });
    input.id = fid();

    var setBtn = h('button.btn.primary', { type: 'button', onclick: function () {
      var v = input.value.trim();
      if (!v) { ui.toast('Type a passcode first', 'warn'); input.focus(); return; }
      save('settings.boardPasscode', v, { message: 'Passcode set' });
      input.value = ''; paintPass();
    } }, icon('key'), has ? 'Replace passcode' : 'Set passcode');

    var clearBtn = h('button.btn.ghost', { type: 'button', hidden: !has, onclick: function () {
      ui.confirm('Remove the board room passcode? Anyone using this copy will then be able to switch to the board member and facilitator roles.', { ok: 'Remove it', danger: true }).then(function (yes) {
        if (!yes) return;
        save('settings.boardPasscode', '', { message: 'Passcode removed' });
        input.value = ''; paintPass();
      });
    } }, icon('trash'), 'Remove passcode');

    R.passState = h('div.set-pass-state', {});
    R.passSet = setBtn; R.passClear = clearBtn;

    var body = [
      R.passState,
      h('div.field.set-field', {}, h('label', { 'for': input.id }, has ? 'New passcode' : 'Passcode'), input,
        h('div.hint', {}, 'Asked for whenever someone switches to the board member or facilitator role in this copy of the app.')),
      h('div.set-actions', {}, setBtn, clearBtn),
      h('div.callout.warn', {}, icon('alert'), h('div', {},
        h('b', {}, 'This is a curtain, not security'),
        'The passcode is stored in plain text in this browser and anyone who can read the file can read it. It stops a candidate wandering into the scoring views by accident. Never treat it as protection for anything sensitive, and never put real board results or personal information in this app.'))
    ];
    paintPass();
    return cardShell(sec('boardroom'), body);
  }
  function paintPass() {
    var el = R && R.passState; if (!el) return;
    var has = !!str(CORB.get('settings.boardPasscode', ''));
    el.innerHTML = '';
    el.appendChild(h('span.set-dot' + (has ? '.ok' : ''), {}));
    el.appendChild(h('span', {}, has ? 'A passcode is set — the board and facilitator roles ask for it.' : 'No passcode. Any role can be selected freely.'));
    if (R.passSet) { R.passSet.innerHTML = ''; R.passSet.appendChild(icon('key')); R.passSet.appendChild(document.createTextNode(has ? ' Replace passcode' : ' Set passcode')); }
    if (R.passClear) R.passClear.hidden = !has;
  }

  // ------------------------------------------------------------------- data
  function dataCard() {
    var avail = safe(function () { return CORB.store.available; }, null);
    var body = [];

    var fileIn = h('input.set-file', { type: 'file', accept: 'application/json,.json', onchange: function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      var p = safe(function () { return CORB.store.importProgress(f); }, null);
      if (!p || typeof p.then !== 'function') { ui.toast('Import is not available in this copy', 'danger'); return; }
      p.then(function () { ui.toast('Progress imported', 'ok'); pendingScroll = 'data'; safe(function () { CORB.refresh(); }, null); })
        .catch(function (err) {
          ui.modal({ title: 'That file could not be imported', body: h('div.stack', {},
            h('p', {}, str(err && err.message || err) || 'The file could not be read.'),
            h('p.small.muted', {}, 'Choose a file this app exported — it is named CORB-progress_… .json and starts with a version line. A saved copy of the app itself (an .html file) is opened directly in the browser instead of imported here.')), actions: [{ label: 'Close', primary: true }] });
        });
    } });

    body.push(h('div.set-data-grid', {},
      dataAction('save', 'Save my notes into this file', notesBlurb(),
        h('button.btn.primary', { type: 'button', onclick: function () {
          ui.saveNotesToFile().then(function (r) { if (r && r.how !== 'cancel') { pendingScroll = 'data'; safe(function () { CORB.refresh(); }, null); } });
        } }, icon('save'), 'Save notes')),
      dataAction('download', 'Export my progress', 'Downloads a file with your progress, bookmarks and notes. Import it on another computer.',
        h('button.btn.primary', { type: 'button', onclick: function () {
          var name = safe(function () { return CORB.store.exportProgress(); }, null);
          if (name) ui.toast('Exported ' + name, 'ok'); else ui.toast('The browser blocked the download', 'danger');
        } }, icon('download'), 'Export')),
      dataAction('upload', 'Import a progress file', 'Adds a file you exported earlier to this copy.' + (online() ? ' Your API key is left alone.' : ''),
        h('button.btn', { type: 'button', onclick: function () { try { fileIn.click(); } catch (e) { ui.toast('The browser blocked the file picker', 'danger'); } } }, icon('upload'), 'Choose a file')),
      dataAction('refresh', 'Reset my progress', 'Clears your progress, bookmarks and notes. Your profile and settings stay. This cannot be undone, so export first.',
        h('button.btn.danger', { type: 'button', onclick: function () {
          ui.confirm('Reset all of your progress in this copy? Questions opened, review schedule, bookmarks, notes, quiz history and mock board results are all cleared. This cannot be undone.', { title: 'Reset progress', ok: 'Reset everything', danger: true }).then(function (yes) {
            if (!yes) return;
            safe(function () { CORB.store.resetProgress(); }, null);
            ui.toast('Progress reset', 'ok');
            pendingScroll = 'data';
            safe(function () { CORB.refresh(); }, null);
          });
        } }, icon('trash'), 'Reset'))));
    body.push(fileIn);

    var storageNote = avail === false
      ? { kind: 'warn', title: 'Browser storage is blocked in this session', detail: 'Everything on this page still works for as long as the tab is open, but nothing is remembered after you close it. Save your notes into the file and export your progress before you finish, and import it next time. This is normal in a private window or under a locked-down browser policy.' }
      : { kind: 'ok', title: 'Your progress stays on this computer', detail: 'It is saved in this browser only. A different browser or computer starts fresh, so export your progress to move it.' };
    body.push(h('div.callout.' + storageNote.kind, {}, icon(storageNote.kind === 'ok' ? 'check' : 'alert'), h('div', {}, h('b', {}, storageNote.title), storageNote.detail)));
    body.push(h('p.small.muted.set-foot-note', {}, (online() ? 'Exported files never contain your API key. ' : '') + 'Do not put personal information, real board results or anyone\'s name in a file you share.'));

    return cardShell(sec('data'), body);
  }
  function notesBlurb() {
    var notes = CORB.get('progress.notes', {}) || {};
    var n = Object.keys(notes).filter(function (k) { return str(notes[k]).trim(); }).length;
    var unsaved = safe(function () { return CORB.store.unsavedNotes(); }, 0), when = safe(function () { return CORB.embedded && CORB.embedded.notesSavedAt; }, '');
    var status = !n && !unsaved ? 'You have no notes yet.' : unsaved ? util.plural(unsaved, 'note') + ' not in the file yet.' : 'Every note is in this file' + (when ? ', saved ' + util.fmtDate(when) + '.' : '.');
    return 'A restart on a managed computer can clear notes kept only in the browser. This saves them into the Board Ready file: choose the file you open the app from. Anyone you give that file to can read your notes. ' + status;
  }
  function dataAction(ic, title, blurb, btn) {
    return h('div.set-data-item', {}, h('span.set-data-icon', {}, icon(ic)), h('div.set-data-copy', {}, h('h3', {}, title), h('p', {}, blurb)), h('div.set-data-btn', {}, btn));
  }

  // ------------------------------------------------------------------ build
  function build(root) {
    var wrap = h('div.set-app');
    root.appendChild(wrap);

    wrap.appendChild(h('div.page-head.set-head', {},
      h('h1', {}, 'Settings'),
      h('p.lede', {}, 'Your profile, how the app looks and sounds, and your data.'),
      h('p.small.muted.set-head-links', {}, 'Version, sources and the maintainer are on the ', hasView('about') ? h('a', { href: '#/about' }, 'About page') : 'About page', '.')));

    if (safe(function () { return CORB.store.available; }, null) === false) {
      wrap.appendChild(h('div.callout.warn.set-banner', {}, icon('alert'), h('div', {},
        h('b', {}, 'This browser is not saving anything'),
        'Storage is blocked, so settings and progress last only until you close the tab. Use Export in the data section before you finish.')));
    }

    var shownSections = SECTIONS.filter(function (s) { return shown(s.id); });
    var nav = h('nav.set-nav', { 'aria-label': 'Settings sections' },
      h('div.set-nav-inner', {}, shownSections.map(function (s) {
        return h('button.set-nav-item', { type: 'button', onclick: function () { goSection(s.id); } }, icon(s.icon), h('span', {}, s.title));
      })));

    var main = h('div.set-main', {});
    var cards = [['profile', profileCard], ['appearance', appearanceCard], ['app', appCard], ['voice', voiceCard], ['ai', connectorCard], ['boardroom', boardRoomCard], ['data', dataCard]]
      .filter(function (c) { return shown(c[0]); });
    cards.forEach(function (pair, i) {
      var card, fn = pair[1];
      try { card = fn(); }
      catch (e) {
        card = cardShell(sec(pair[0]), h('div.callout.danger', {}, icon('alert'), h('div', {}, h('b', {}, 'This section could not be built'), 'The rest of your settings are unaffected. ' + str(e && e.message || e))));
      }
      card.style.animationDelay = (i * 40) + 'ms';
      main.appendChild(card);
    });

    wrap.appendChild(h('div.set-grid', {}, nav, main));
  }

  // ----------------------------------------------------------- registration
  CORB.registerView({
    id: 'settings', title: 'Settings', icon: 'settings', section: 'System', order: 410, nav: true, short: 'Settings',
    render: function (root, ctx) {
      R = {};
      fieldId = 0;
      build(root);
      var want = pendingScroll || ((ctx && ctx.params && ctx.params.section) || '');
      pendingScroll = null;
      if (want) setTimeout(function () { goSection(want); }, 60);
    },
    onLeave: function () { R = null; }
  });
})();
