/* VIEW settings — help, profile, display and read-aloud, my data (save, export, import, reset), about */
(function () {
  'use strict';
  var CORB = window.CORB;
  var TABS = [['help', 'Help'], ['profile', 'My profile'], ['display', 'Display'], ['data', 'My data']];

  function help(root, h, icon) {
    var meta = CORB.meta(), ed = CORB.edition();
    var steps = [
      ['route', 'Build your plan', 'Home asks three questions and turns them into dated steps in My plan. Tick steps as you finish them.'],
      ['certificate', 'Learn the rules', 'Certification 101 explains the courses, the exam, the 12 months of experience and who does what.'],
      ['book', 'Study a little every day', 'Lessons are about ten minutes each. Tap any word with a dotted underline to see what it means.'],
      ['volume', 'Listen instead of reading', 'Every lesson, card and question has a Listen button. It works without the internet.'],
      ['quiz', 'Practice like the real exam', 'Practice test explains every answer. The exam simulator is timed and mixed like CON 3990V.'],
      ['cards', 'Drill what you must memorize', 'Flashcards bring back what you miss. Start with the FAR part titles.'],
      ['search', 'Find anything', 'Press / or the Search button, then type a word, an acronym or a course number.']
    ];
    root.appendChild(h('div.callout.brass.mb-4', {}, icon('help'), h('div', {}, h('b', {}, 'New here?'), h('span', {}, 'A short tour points at each part of the guide and says what it is for. '),
      h('div.row.mt-2', {}, h('button.btn.sm.primary', { type: 'button', onclick: function () { if (CORB.tour) CORB.tour.start(); } }, icon('play'), 'Take the tour'), CORB.buddy ? h('button.btn.sm', { type: 'button', onclick: function () { CORB.buddy.open(); } }, icon('message'), 'Ask ' + CORB.buddy.name()) : null, h('a.btn.sm.ghost', { href: '#/about' }, icon('info'), 'About B2B Exam Prep')))));
    root.appendChild(h('div.grid.cols-2.help-grid', {}, steps.map(function (s) { return h('div.card.tight.help-step', {}, h('div.help-icon', {}, icon(s[0])), h('div', {}, h('b', {}, s[1]), h('p.small.muted', {}, s[2]))); })));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'Where your progress lives')));
    root.appendChild(h('div.card', {}, CORB.ui.rich(
      ed === 'web' ? 'Your ticks, scores and flashcard history stay in this browser on this device. Sign in to an account (below) to keep them in your account too and pick up on any device. Without one, nothing is sent anywhere. To move them to another device, use My data → Export, then Import on the other device.\n\nThis website updates itself: when the maintainer publishes a change, you get it the next time you open the guide with an internet connection.'
        : ed === 'preview' ? 'This is a preview copy. Your progress stays in this browser only, and file downloads and printing are turned off here. For daily use, get the full copy from the maintainer or the website.'
        : 'Your ticks, scores and flashcard history stay in this browser on this device. Nothing is sent anywhere.\n\nSome government computers erase browser data at restart. To keep your progress safe, use **Save progress** (top of the page, or My data) and pick this same B2B Exam Prep file. Your progress is then stored inside the file and comes back every time you open it.')));
    if (ed === 'web' && CORB.account && CORB.account.ready()) {
      root.appendChild(h('div.section-head', {}, h('h2', {}, 'Your account')));
      root.appendChild(CORB.account.card());
    }
    if (ed === 'web' && CORB.pwa) {
      root.appendChild(h('div.section-head', {}, h('h2', {}, 'Install B2B Exam Prep as an app')));
      root.appendChild(h('div.card', {}, CORB.pwa.isStandalone() ? h('p', {}, 'You are using the installed app. It works offline and updates itself.') : h('div.stack', {},
        h('p', {}, 'The installed app has its own icon, opens full screen without a browser bar, works with no signal, and updates itself.'),
        h('button.btn.primary', { type: 'button', onclick: function () { CORB.pwa.showInstall(); } }, icon('download'), 'Install the app'),
        h('ul.tips', {}, h('li', {}, 'Android: Chrome installs it with one tap. Samsung Internet and other browsers cannot: they make a shortcut or show an "unsafe app" warning, so the page hands over to Chrome.'),
          h('li', {}, 'iPhone or iPad: Safari only (Apple\'s rule). Share → Add to Home Screen → Add.'),
          h('li', {}, 'Computer: Edge or Chrome, the install icon at the right end of the address bar.')))));
    }
    if (ed === 'web') {
      root.appendChild(h('div.section-head', {}, h('h2', {}, 'Copies for computers without internet')));
      root.appendChild(h('div.card', {}, h('p', {}, 'Some government networks block websites like this one. Download the single-file copy and share it on Teams or SharePoint, or use the Word package to send it by Army email (which blocks .html attachments).'),
        h('div.row.mt-3', {},
          h('a.btn', { href: 'B2B-Exam-Prep.html', download: 'B2B-Exam-Prep.html' }, icon('download'), 'Offline copy (.html)'),
          h('a.btn', { href: 'downloads/B2B-Exam-Prep-READ-ME-FIRST.docx', download: '' }, icon('file'), 'Email package: READ ME FIRST'),
          h('a.btn', { href: 'downloads/B2B-Exam-Prep.html.docx', download: '' }, icon('file'), 'Email package: code document')),
        h('p.small.muted.mt-3', {}, 'A downloaded copy keeps the date it was built. When the guide changes, download it again.')));
    }
    if (meta.site_url && ed !== 'web') root.appendChild(h('div.mt-4', {}, CORB.ui.callout('brass', 'refresh', 'Is there a newer version?', h('span', {}, 'This copy was built ' + CORB.util.fmtDate((meta.built_on || '').slice(0, 10)) + '. The newest guide is always on the website: ', h('a', { href: meta.site_url, target: '_blank', rel: 'noopener' }, meta.site_url)))));
    var maint = CORB.ui.maintainer();
    if (maint) {
      root.appendChild(h('div.section-head', {}, h('h2', {}, 'Feedback')));
      root.appendChild(h('div.card', {}, h('p', {}, 'This is a test version. Your feedback decides what changes next: what helped, what confused you, and anything that is wrong or out of date.'),
        h('div.row.mt-3', {},
          h('a.btn.primary', { href: CORB.ui.feedbackMailto('feedback') }, icon('mail'), 'Send tester feedback'),
          h('a.btn', { href: CORB.ui.feedbackMailto('problem') }, icon('alert'), 'Report a problem')),
        h('p.small.muted.mt-3', {}, 'The buttons open your email with questions filled in. If nothing opens, write to ', h('b', {}, maint.email), ' (', maint.name, ', ', maint.role.toLowerCase(), ').')));
    }
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'Keyboard')));
    root.appendChild(h('div.card.small', {}, h('div.row', {}, h('kbd', {}, '/'), 'Search'), h('div.row.mt-2', {}, h('kbd', {}, 'Esc'), 'Close a window'), h('div.row.mt-2', {}, h('kbd', {}, 'Space'), 'Flip a flashcard; ', h('kbd', {}, '1'), h('kbd', {}, '2'), h('kbd', {}, '3'), ' grade it'),
      h('div.row.mt-2', {}, h('kbd', {}, '1'), '–', h('kbd', {}, '4'), ' answer a practice question; ', h('kbd', {}, 'Enter'), ' or ', h('kbd', {}, '→'), ' next question; in the exam simulator ', h('kbd', {}, '←'), ' back and ', h('kbd', {}, 'F'), ' flag')));
  }

  function profile(root, h, icon) {
    var f = CORB.setupForm();
    root.appendChild(h('div.card', {}, f.el, h('div.row.mt-5', {}, h('button.btn.primary', { type: 'button', onclick: function () { if (f.save()) { CORB.ui.toast('Profile saved. Your plan dates moved to match.', 'ok'); CORB.render(); } } }, icon('save'), 'Save'))));
  }

  var SAMPLE = 'Hi, this is how B2B Exam Prep sounds.\nWho can bind the Government to a contract? Only the contracting officer, the KO.\nBelow the micro-purchase threshold, $15,000, you can buy without competitive quotes, as long as the price is reasonable.\nReady when you are.';
  CORB.VOICE_SAMPLE = SAMPLE;
  function voicePicker() {
  var h = CORB.ui.h, icon = CORB.ui.icon;
    var AV = CORB.voices && CORB.voices.available ? CORB.voices : null, haveIds = [];
    var sel = h('select#tts-voice.input', { 'aria-label': 'Voice' });
    var dlBar = CORB.ui.bar(0), dlText = h('span.small.muted', {}, ''), dl = h('div.stack.tight.mt-2', { hidden: true }, dlText, dlBar);
    function fill() {
      var list = CORB.speech.voices(), cur = CORB.get('settings.voice', '');
      sel.innerHTML = '';
      sel.appendChild(h('option', { value: '' }, 'Best voice on this device' + (list[0] ? ': ' + list[0].name : '')));
      function group(label, vs) { if (!vs.length) return; var g = h('optgroup', { label: label }); vs.forEach(function (v) { g.appendChild(h('option', { value: v.id }, v.name)); }); sel.appendChild(g); }
      if (AV) { var ag = h('optgroup', { label: 'App voices: download once, then offline' }); AV.list().forEach(function (v) { ag.appendChild(h('option', { value: 'app:' + v.id }, v.name + ' · ' + v.who + (haveIds.indexOf(v.id) >= 0 ? ' · downloaded' : ' · ' + v.mb + ' MB'))); }); sel.appendChild(ag); }
      group(AV ? 'Natural voices on this device' : 'Natural voices', list.filter(function (v) { return v.natural; })); group(AV ? 'Standard voices on this device' : 'Standard voices', list.filter(function (v) { return !v.natural; }));
      var isApp = cur.indexOf('app:') === 0 && AV && AV.get(cur.slice(4));
      sel.value = isApp || list.some(function (v) { return v.id === cur; }) ? cur : '';
    }
    fill();
    if (AV) AV.downloaded().then(function (ids) { haveIds = ids; if (sel.isConnected) fill(); });
    var off = CORB.on('voices', function () { if (sel.isConnected) fill(); else off(); });
    var off2 = CORB.on('voices-changed', function () { if (!sel.isConnected) { off2(); return; } if (AV) AV.downloaded().then(function (ids) { haveIds = ids; fill(); paintManage(); }); });
    sel.addEventListener('change', function () {
      var val = sel.value, prev = CORB.get('settings.voice', '');
      if (val.indexOf('app:') === 0 && AV) {
        var v = AV.get(val.slice(4));
        AV.ready(v.id).then(function (ready) {
          if (ready) { CORB.speech.setVoice(val); CORB.speech.speak(SAMPLE); return; }
          var need = v.mb + (haveIds.length ? 0 : AV.RUNTIME_MB);
          if (!navigator.onLine) { CORB.ui.toast('You are offline. ' + v.name + ' needs a one-time download of about ' + need + ' MB.', 'warn', 5000); sel.value = prev; return; }
          dl.hidden = false; dlText.textContent = 'Downloading ' + v.name + ' (about ' + need + ' MB, once)…'; sel.disabled = true;
          AV.download(v.id, function (p) { dlText.textContent = 'Downloading ' + v.name + ': ' + Math.round(p.loadedMB) + ' of ' + Math.round(p.totalMB) + ' MB'; var nb = CORB.ui.bar(p.pct); dlBar.replaceWith(nb); dlBar = nb; })
            .then(function () { dl.hidden = true; sel.disabled = false; CORB.speech.setVoice(val); CORB.ui.toast(v.name + ' is ready and works offline from now on.', 'ok', 4000); CORB.speech.speak(SAMPLE); },
              function (err) { dl.hidden = true; sel.disabled = false; sel.value = prev; CORB.ui.toast('Could not download ' + v.name + ': ' + (err && err.message || err), 'danger', 6000); });
        });
        return;
      }
      CORB.speech.setVoice(val); CORB.speech.speak(SAMPLE);
    });
    var manageRow = h('div.row.tight.mt-2', {});
    function paintManage() {
      if (!AV) return;
      AV.downloaded().then(function (ids) {
        manageRow.innerHTML = '';
        if (!ids.length) { manageRow.appendChild(h('span.small.muted', {}, 'No app voice is downloaded yet. Pick one in the list to download it.')); return; }
        ids.forEach(function (id) { var v = AV.get(id); if (!v) return; manageRow.appendChild(h('button.btn.sm.ghost', { type: 'button', onclick: function () { CORB.ui.confirm('Remove ' + v.name + ' from this device? You can download it again later.', { ok: 'Remove' }).then(function (ok) { if (!ok) return; AV.remove(id).then(function () { if (CORB.get('settings.voice') === 'app:' + id) CORB.speech.setVoice(''); CORB.render(); }); }); } }, icon('x'), 'Remove ' + v.name)); });
        manageRow.appendChild(h('button.btn.sm.ghost', { type: 'button', onclick: function () { CORB.ui.confirm('Remove every app voice and the speech engine from this device?', { ok: 'Remove all' }).then(function (ok) { if (!ok) return; AV.removeAll().then(function () { if ((CORB.get('settings.voice') || '').indexOf('app:') === 0) CORB.speech.setVoice(''); CORB.render(); }); }); } }, 'Remove all (frees about ' + (AV.RUNTIME_MB + 63 * ids.length) + ' MB)'));
      });
    }
    paintManage();
    var manage = AV ? h('details.inst-more.mt-2', {}, h('summary', {}, 'About the app voices'),
      h('p.small.muted', {}, 'Four voices that run inside the app: Amber and Joe (US), Cori and Leo (UK). Each is a one-time download of about 63 MB, plus 31 MB for the speech engine the first time; after that they work offline and sound the same on every phone. Download on Wi-Fi. They come from the owner\'s GitHub page, not from a cloud service: nothing you read is sent anywhere.'),
      manageRow) : null;
    return h('div', {}, sel, dl, manage);
  }
  // the look picker: day or night, the colour theme (CORB.PALETTES) and the text size, each applied as soon as it is tapped.
  // Shared by Settings -> Display, the side menu's Theme sheet and the onboarding on Home.
  function lookPicker() {
    var h = CORB.ui.h;
    function cur() { var t = CORB.get('profile.theme'); return t === 'dark' || t === 'system' ? t : 'light'; }
    var modeSeg = h('div.seg', { role: 'radiogroup', 'aria-label': 'Day or night' }), swatches = h('div.swatches', { role: 'radiogroup', 'aria-label': 'Theme' }), sizeSeg = h('div.seg', { role: 'radiogroup', 'aria-label': 'Text size' });
    function paintMode() { modeSeg.innerHTML = ''; var t = cur(); [['light', 'Day'], ['dark', 'Night'], ['system', 'Match my device']].forEach(function (o) { modeSeg.appendChild(h('button' + (o[0] === t ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': o[0] === t ? 'true' : 'false', onclick: function () { CORB.setTheme(o[0]); paintMode(); } }, o[1])); }); }
    function paintSw() { swatches.innerHTML = ''; var p = CORB.get('profile.palette') || ''; (CORB.PALETTES || []).forEach(function (pal) { var on = pal.id === p; swatches.appendChild(h('button.swatch' + (on ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', title: pal.sub, onclick: function () { CORB.setPalette(pal.id); paintSw(); } }, h('span.swatch-dot', { style: { '--d': pal.day[0], '--db': pal.day[1], '--n': pal.night[0], '--nb': pal.night[1] } }), h('b', {}, pal.name), h('small', {}, pal.sub))); }); }
    function paintSize() { sizeSeg.innerHTML = ''; var n = +CORB.get('profile.textSize', 0) || 0; [[0, 'Normal'], [1, 'Large'], [2, 'Larger'], [3, 'Largest']].forEach(function (o) { sizeSeg.appendChild(h('button' + (o[0] === n ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': o[0] === n ? 'true' : 'false', onclick: function () { CORB.setTextSize(o[0]); paintSize(); } }, o[1])); }); }
    paintMode(); paintSw(); paintSize();
    return h('div.look-picker.stack.loose', {},
      h('div.field', {}, h('div.label', {}, 'Day or night'), modeSeg, h('div.hint', {}, 'Each theme has a day look and a night look; the left half of a swatch is day, the right half night.')),
      h('div.field', {}, h('div.label', {}, 'Theme'), swatches),
      h('div.field', {}, h('div.label', {}, 'Text size'), sizeSeg));
  }
  CORB.lookPicker = lookPicker; CORB.voicePicker = voicePicker;
  function display(root, h, icon) {
    function seg(opts, cur, fn) { return h('div.seg', {}, opts.map(function (o) { return h('button' + (o[0] === cur ? '.on' : ''), { type: 'button', onclick: function () { fn(o[0]); CORB.render(); } }, o[1]); })); }
    var rate = h('input#tts-rate', { type: 'range', min: '0.7', max: '1.4', step: '0.1', value: String(CORB.get('settings.ttsRate', 1)) });
    rate.addEventListener('change', function () { CORB.set('settings.ttsRate', +rate.value); });
    function sw(path, label, def) { var i = h('input', { type: 'checkbox', checked: CORB.get(path, def) !== false }); i.addEventListener('change', function () { CORB.set(path, i.checked); if (path === 'settings.glossaryLinks') CORB.data.invalidate(); }); return h('label.switch', {}, i, label); }
    root.appendChild(h('div.card.stack.loose', {},
      lookPicker(),
      h('div.field', {}, h('div.label', {}, 'Motion'), seg([['', 'Normal'], ['reduce', 'Less motion']], CORB.get('settings.motion') || '', function (v) { CORB.setMotion(v); })),
      sw('settings.glossaryLinks', 'Underline acronyms I can tap for a meaning', true)));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'Read aloud')));
    var tone = CORB.get('settings.ttsTone', 'lively') === 'even' ? 'even' : 'lively';
    // the device's English voices, natural ones first, then the app's own downloadable voices; the choice lives in settings.voice
    var ok = CORB.speech.available;
    root.appendChild(h('div.card.stack', {},
      ok ? sw('settings.tts', 'Show Listen buttons', true) : h('p.muted', {}, 'This browser has no built-in voice, so Listen buttons are hidden. Edge on Windows has good voices.'),
      ok ? h('div.field', {}, h('label', { for: 'tts-voice' }, 'Voice'), voicePicker(), h('p.small.muted', {}, (CORB.voices && CORB.voices.available ? 'App voices run inside the app and sound the same on every phone, after a one-time download. The other voices come from your phone or computer; natural ones sound like a person. ' : 'Voices come from your phone or computer; natural ones sound like a person. ') + 'The list shows the best first.')) : null,
      ok ? h('div.field', {}, h('div.label', {}, 'Tone'), seg([['lively', 'Lively'], ['even', 'Even']], tone, function (v) { CORB.set('settings.ttsTone', v); CORB.speech.speak(SAMPLE); }),
        h('p.small.muted', {}, 'Lively reads the way a person does: questions rise, sentences settle, a heading gets a breath, a list keeps a beat. Even keeps one steady tone.')) : null,
      ok ? h('div.field', {}, h('label', { for: 'tts-rate' }, 'Speed'), h('div.row', {}, h('span.small', {}, 'Slower'), rate, h('span.small', {}, 'Faster'))) : null,
      ok ? h('div.row', {}, h('button.btn', { type: 'button', onclick: function () { CORB.speech.speak(SAMPLE); } }, icon('volume'), 'Hear a sample'), h('button.btn.ghost', { type: 'button', onclick: function () { CORB.speech.stop(); } }, icon('stop'), 'Stop')) : null,
      ok ? h('details.inst-more', {}, h('summary', {}, 'Want a more human voice?'), h('ul.tips', {},
        CORB.voices && CORB.voices.available ? h('li', {}, h('b', {}, 'Any phone: '), 'pick an App voice in the list above. On Android, Chrome ignores the voice you choose from the phone\'s own list and always speaks with the system default, so an App voice is the way to get a man\'s voice or a UK accent there.') : null,
        h('li', {}, h('b', {}, 'iPhone or iPad: '), 'Settings → Accessibility → Spoken Content → Voices → English → download an Enhanced or Premium voice (Ava, Zoe, Evan). Reload this page, then pick it above.'),
        h('li', {}, h('b', {}, 'Android: '), 'Settings → General management (or System) → Language → Text-to-speech → Google Speech Services → Install voice data → English → pick a different voice (some are men). That changes the one voice Chrome uses. Samsung phones also offer Samsung text-to-speech voices.'),
        h('li', {}, h('b', {}, 'Windows: '), 'Microsoft Edge has natural voices built in (Aria, Guy, Jenny); Chrome has only the basic ones.'),
        h('li', {}, h('b', {}, 'Mac: '), 'System Settings → Accessibility → Spoken Content → System voice → Manage Voices → download an Enhanced voice.'))) : null));
  }

  function data(root, h, icon) {
    var ed = CORB.edition(), st = CORB.store;
    root.appendChild(h('div.card.stack', {}, h('h3', {}, 'Your progress'),
      h('p', {}, st.available === false ? 'This browser is blocking storage, so progress lasts only until you close the page. Use Save progress into this file or Export.' : 'Saved automatically in this browser on this device.'),
      ed === 'offline' ? h('div.stack.tight', {}, h('p.small.muted', {}, 'Government computers often clear browser data at restart. Saving into the file keeps your progress inside B2B Exam Prep itself.'),
        h('div', {}, h('button.btn.primary', { type: 'button', onclick: function () { CORB.saveProgressToFile(); } }, icon('save'), 'Save progress into this file')),
        st.fileStamp ? h('p.tiny.muted', {}, 'Last saved into the file: ' + CORB.util.fmtDateTime(st.fileStamp)) : null) : null));
    var file = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    file.addEventListener('change', function () { var f = file.files && file.files[0]; if (!f) return; st.importProgress(f).then(function () { CORB.ui.toast('Progress imported', 'ok'); CORB.render(); }).catch(function (e) { CORB.ui.toast(e.message || 'Import failed', 'danger', 5000); }); });
    root.appendChild(h('div.card.stack.mt-4', {}, h('h3', {}, 'Move to another device'),
      h('p.small.muted', {}, 'Export makes a small file with your progress. Import it on another computer or phone.'),
      h('div.row', {}, CORB.can('download') ? h('button.btn', { type: 'button', onclick: function () { var n = st.exportProgress(); if (n) CORB.ui.toast('Saved ' + n, 'ok'); } }, icon('download'), 'Export progress') : null,
        h('button.btn', { type: 'button', onclick: function () { file.click(); } }, icon('upload'), 'Import progress'), file)));
    root.appendChild(h('div.card.stack.mt-4', {}, h('h3', {}, 'Start over'),
      h('div.row', {},
        h('button.btn.danger', { type: 'button', onclick: function () { CORB.ui.confirm('Clear all ticks, scores and flashcard history? Your profile and plan dates stay.', { ok: 'Clear progress', danger: true }).then(function (ok) { if (ok) { st.resetProgress(); CORB.ui.toast('Progress cleared'); CORB.render(); } }); } }, icon('trash'), 'Clear progress'),
        h('button.btn.danger', { type: 'button', onclick: function () { CORB.ui.confirm('Erase everything, including your profile? The guide will start fresh.', { ok: 'Erase everything', danger: true }).then(function (ok) { if (ok) { st.resetAll(); CORB.go('home'); CORB.render(); } }); } }, icon('trash'), 'Erase everything'))));
  }

  CORB.registerView({ id: 'settings', title: 'Settings & help', section: 'Help', icon: 'settings', nav: true, order: 130,
    blurb: 'Help, display, read-aloud, your data, feedback', keywords: 'help settings text size dark mode night read aloud voice export import save progress reset feedback install app update version about',
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon, tab = ctx.params.tab || 'help';
      if (tab === 'about') { location.replace('#/about'); return; }   // About has its own page now; old links still work
      root.appendChild(CORB.ui.pageHead({ title: 'Settings & help' }));
      root.appendChild(h('div.tabs', { role: 'tablist' }, TABS.map(function (t) { return h('button' + (t[0] === tab ? '.on' : ''), { type: 'button', role: 'tab', 'aria-selected': t[0] === tab ? 'true' : 'false', onclick: function () { CORB.go('settings', { tab: t[0] }); } }, t[1]); })));
      var body = h('div'); root.appendChild(body);
      ({ help: help, profile: profile, display: display, data: data }[tab] || help)(body, h, icon);
    } });
})();
