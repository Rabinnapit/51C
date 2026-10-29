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
      h('div.row.mt-2', {}, h('button.btn.sm.primary', { type: 'button', onclick: function () { if (CORB.tour) CORB.tour.start(); } }, icon('play'), 'Take the tour'), h('a.btn.sm.ghost', { href: '#/about' }, icon('info'), 'About B2B Exam Prep')))));
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
        h('p', {}, 'Installing puts B2B Exam Prep on your home screen or desktop like any other app. It opens without a browser bar, works offline, and still updates itself.'),
        CORB.pwa.canInstall ? h('button.btn.primary', { type: 'button', onclick: function () { CORB.pwa.install().then(function (ok) { if (ok) CORB.render(); }); } }, icon('download'), 'Install B2B Exam Prep')
          : h('button.btn.primary', { type: 'button', onclick: function () { CORB.pwa.howTo(); } }, icon('phone'), 'Show me how to install'),
        h('ul.tips', {}, h('li', {}, 'Computer (Edge or Chrome): click the install icon at the right end of the address bar, or the browser menu → Apps → Install.'), h('li', {}, 'Android: browser menu (⋮) → Add to Home screen or Install app.'), h('li', {}, 'iPhone or iPad (Safari): Share button → Add to Home Screen.')))));
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
    root.appendChild(h('div.card.small', {}, h('div.row', {}, h('kbd', {}, '/'), 'Search'), h('div.row.mt-2', {}, h('kbd', {}, 'Esc'), 'Close a window'), h('div.row.mt-2', {}, h('kbd', {}, 'Space'), 'Flip a flashcard; ', h('kbd', {}, '1'), h('kbd', {}, '2'), h('kbd', {}, '3'), ' grade it')));
  }

  function profile(root, h, icon) {
    var f = CORB.setupForm();
    root.appendChild(h('div.card', {}, f.el, h('div.row.mt-5', {}, h('button.btn.primary', { type: 'button', onclick: function () { if (f.save()) { CORB.ui.toast('Profile saved. Your plan dates moved to match.', 'ok'); CORB.render(); } } }, icon('save'), 'Save'))));
  }

  function display(root, h, icon) {
    var theme = CORB.get('profile.theme'), size = +CORB.get('profile.textSize', 0) || 0;
    theme = theme === 'dark' || theme === 'system' ? theme : 'light';
    function seg(opts, cur, fn) { return h('div.seg', {}, opts.map(function (o) { return h('button' + (o[0] === cur ? '.on' : ''), { type: 'button', onclick: function () { fn(o[0]); CORB.render(); } }, o[1]); })); }
    var rate = h('input#tts-rate', { type: 'range', min: '0.7', max: '1.4', step: '0.1', value: String(CORB.get('settings.ttsRate', 1)) });
    rate.addEventListener('change', function () { CORB.set('settings.ttsRate', +rate.value); });
    function sw(path, label, def) { var i = h('input', { type: 'checkbox', checked: CORB.get(path, def) !== false }); i.addEventListener('change', function () { CORB.set(path, i.checked); if (path === 'settings.glossaryLinks') CORB.data.invalidate(); }); return h('label.switch', {}, i, label); }
    root.appendChild(h('div.card.stack.loose', {},
      h('div.field', {}, h('div.label', {}, 'Day or night'), seg([['light', 'Day'], ['dark', 'Night'], ['system', 'Match my device']], theme, function (v) { CORB.setTheme(v); })),
      h('div.field', {}, h('div.label', {}, 'Text size'), seg([[0, 'Normal'], [1, 'Large'], [2, 'Larger'], [3, 'Largest']], size, function (v) { CORB.setTextSize(v); })),
      h('div.field', {}, h('div.label', {}, 'Motion'), seg([['', 'Normal'], ['reduce', 'Less motion']], CORB.get('settings.motion') || '', function (v) { CORB.setMotion(v); })),
      sw('settings.glossaryLinks', 'Underline acronyms I can tap for a meaning', true)));
    root.appendChild(h('div.section-head', {}, h('h2', {}, 'Read aloud')));
    root.appendChild(h('div.card.stack', {},
      CORB.speech.available ? sw('settings.tts', 'Show Listen buttons', true) : h('p.muted', {}, 'This browser has no built-in voice, so Listen buttons are hidden. Edge on Windows has good voices.'),
      CORB.speech.available ? h('div.field', {}, h('label', { for: 'tts-rate' }, 'Speed'), h('div.row', {}, h('span.small', {}, 'Slower'), rate, h('span.small', {}, 'Faster'))) : null,
      CORB.speech.available ? h('div', {}, h('button.btn', { type: 'button', onclick: function () { CORB.speech.speak('This is how B2B Exam Prep sounds. A contracting officer is the only person who can bind the Government to a contract.'); } }, icon('volume'), 'Test the voice')) : null));
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
