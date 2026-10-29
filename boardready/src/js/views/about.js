/* VIEW: about — what this app is, what it is not, and how to read everything in it.
   Layout: the app name with its edition and dates, the developer and maintainer (where to report a problem),
   the owner and terms, the phone app with its QR code and install sheet, what's new, the three candidate names (full
   edition), an is/is-not pair, what is inside (counts from this build), the badge legend with the RFO baseline, sources,
   how progress is stored, how a facilitator updates content (full edition) and the keyboard shortcuts, collapsed.
   Data: CORB.DATA.meta (name_options, sources, disclaimer, version, built_on, content_verified_on).
   Renders sensible copy when meta is missing or partial. Never throws. Stores nothing. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, util = CORB.util;

  var BADGES = [
    ['official', 'The answer comes from a study document, such as the PAM warrant board question list. It is a study answer, not policy. Confirm the citation.'],
    ['ai-draft', 'No sourced answer existed, so one was drafted as a starting point. Treat it as unverified. Check the citation on acquisition.gov before you use it.'],
    ['open', 'The question has no answer yet. Write your own in My notes and ask a mentor to check it.'],
    ['verify-locally', 'The answer depends on a local procedure, threshold or delegation, such as Korea LCS or SOFA procedures. Nothing in this app sets a local 411th approval level. Confirm current practice with your Contracting & Policy (C&P) office.'],
    ['rfo-unverifiable', 'The citation could not be matched to the overhauled FAR with confidence, or its review is not finished. Look it up before you quote the number.']
  ];

  var IS = [
    ['cards', 'A study and rehearsal tool', 'The board questions from the source lists with answers, citations and a verification status, plus flashcards, a quiz, scenarios, mock boards' + (CORB.isCandidateEdition() ? ' and the Arcade.' : ' and a projector mode for group sessions.')],
    ['shield', (CORB.isWeb && CORB.isWeb()) ? 'An app, or one file' : 'One file', 'No account. It works without a network connection, on a laptop or a phone' + ((CORB.isWeb && CORB.isWeb()) ? ', and installs from the website with one tap.' : '; the website version installs as an app.')]
  ];
  var IS_NOT = [
    ['alert', 'Not authoritative guidance', 'It is a training aid built from study material. It does not state policy and it is not legal advice. The FAR, DFARS, AFARS, the Army Warranting Program Policy and your C&P office always win.'],
    ['scale', 'Not a warrant decision', 'A mock board score here means nothing official. The real board and the appointing authority decide. Scores only show you where to study next.'],
    ['users', 'Not a record system', 'It holds no candidate, mentor or board member names and no real board results. The only contact in it is the developer and maintainer. Do not type anyone\'s name or personal information into a copy you share.']
  ];

  var SHORTCUTS = [
    ['Everywhere', [['/', 'Open the search palette'], ['?', 'Open the guided tour'], ['Esc', 'Close a dialog, the menu, or the filter drawer']]],
    ['Flashcards', [['Space or Enter', 'Flip the card'], ['1 – 4', 'Grade the card once it is flipped'], ['N or →', 'Skip to the next card'], ['B', 'Bookmark'], ['R', 'Read aloud']]],
    ['Quiz', [['1 – 9', 'Choose an option'], ['Enter', 'Go to the next question after answering']]],
    ['Mock board', [['Space', 'Reveal the model answer'], ['Enter', 'Next question'], ['Ctrl + Enter', 'Next question while typing notes'], ['Esc', 'End the board early']]],
    ['Projector', [['→ or Page Down', 'Next slide'], ['← or Page Up', 'Previous slide'], ['Home / End', 'First / last slide'], ['Space', 'Reveal the answer'], ['R', 'Read aloud'], ['T', 'Start or stop the timer'], ['F', 'Full screen'], ['Esc', 'Leave full screen, then end the session']]]
  ];

  // ---------------------------------------------------------------- helpers
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return v == null ? '' : String(v); }
  function meta() { return (CORB.DATA && CORB.DATA.meta) || {}; }
  function hasView(id) { return !!(CORB.views && CORB.views[id]); }
  function badgeSafe(kind) { return safe(function () { return ui.badge(kind); }, h('span.badge.neutral', {}, kind)); }
  function section(id, eyebrow, title, children, lede) {
    return h('section.ab-sec', { id: 'ab-' + id, 'aria-labelledby': 'ab-h-' + id },
      h('div.ab-sec-head', {}, h('h2', { id: 'ab-h-' + id }, title), lede ? h('p.ab-sec-lede', {}, lede) : null),
      children);
  }

  // ------------------------------------------------------------------- hero
  function hero() {
    var m = meta();
    var name = m.app_name || 'CORB prep';
    var facts = [
      (CORB.isCandidateEdition() ? 'Candidate edition' : 'Full edition') + (CORB.hasConnector() ? '' : ' (offline)'),
      m.version || CORB.VERSION ? 'version ' + str(m.version || CORB.VERSION) : null,
      m.content_verified_on ? 'content verified ' + util.fmtDate(m.content_verified_on) : null
    ].filter(Boolean);

    return h('header.ab-hero', {},
      h('div.ab-hero-mark', {}, h('span', {}, (CORB.monogram && CORB.monogram()) || str(name).charAt(0).toUpperCase() || 'B')),
      h('div.ab-hero-copy', {},
        h('h1', {}, name),
        h('p.ab-hero-facts', {}, facts.join(' · '))));
  }

  // ------------------------------------------------ developer and maintainer
  function maintainer() {
    var who = safe(function () { return ui.maintainer(); }, null);
    if (!who) return null;
    function href() { return safe(function () { return ui.maintainerMailto(''); }, 'mailto:' + who.email); }
    function mail(tag, label, extra) {
      return h(tag, Object.assign({ href: href(), onclick: function (e) { e.currentTarget.href = href(); } }, extra || {}), label);
    }
    var words = who.name.split(/\s+/).filter(Boolean);
    if (words.length > 2) words = words.slice(1);          // leave the rank out of the initials
    var initials = [words[0], words[words.length - 1]].map(function (w) { return str(w).charAt(0); }).join('').toUpperCase();
    return h('section.ab-maint', { id: 'ab-maintainer', 'aria-labelledby': 'ab-h-maintainer' },
      h('div.ab-maint-mark', { 'aria-hidden': 'true' }, initials),
      h('div.ab-maint-copy', {},
        h('div.eyebrow', {}, who.role),
        h('h2.ab-maint-name', { id: 'ab-h-maintainer' }, mail('a', who.name, { title: 'Email ' + who.name })),
        h('p.ab-maint-line', {}, 'Found a wrong answer or a broken page? Email ', mail('a.ab-maint-mail', who.email), '. Include the question ID from the top right of the card and what it should say.'),
        h('p.ab-maint-line.muted', {}, 'For policy and local procedures, your Contracting & Policy (C&P) office has the final word.')),
      mail('a.btn.primary.ab-maint-btn', 'Email the maintainer'));
  }

  // ----------------------------------------------------------- name options
  function names() {
    var m = meta();
    var opts = arr(m.name_options).filter(function (x) { return str(x).trim(); });
    if (!opts.length) {
      return section('names', 'Naming', 'The name is not final', h('div.callout.info', {}, icon('info'), h('div', {},
        h('b', {}, 'This build carries no alternative names'),
        'The facilitator sets the name once, in the content metadata (meta.app_name), and rebuilds. Everything else in the app picks it up automatically.')));
    }
    var current = str(m.app_name);
    var why = {
      'Signatory': 'The warrant is signature authority. The word is the whole point of the board, it is short, and it sounds like a product rather than a course.',
      'The Warrant Room': 'Names the place you are preparing for. Warm, a little collegial, and it reads well on a conference-room screen during a study group.',
      'Board Ready': 'States the outcome. Easy to say out loud — "are you board ready?" — which is exactly the question the brigade is asking. Chosen by the 411th study group.'
    };
    var cards = h('div.ab-names', {}, opts.map(function (o) {
      var on = str(o) === current;
      return h('article.ab-name' + (on ? '.on' : ''), {},
        h('div.ab-name-top', {}, h('h3', {}, str(o)), on ? h('span.badge.gold', {}, 'In use') : h('span.badge.neutral', {}, 'Option')),
        h('p', {}, why[str(o)] || 'A working title the study group put forward for this app.'));
    }));
    return section('names', 'Naming', 'Three names, one still to pick', [cards,
      h('div.callout.info.mt-4', {}, icon('edit'), h('div', {},
        h('b', {}, 'The facilitator makes the call'),
        'Set meta.app_name in the content metadata and rebuild the single file. The name then appears in the sidebar, the browser tab, saved copies and every printed sheet. Nobody has to touch a view to change it.'))],
      'The brigade has not settled on a name. All three were drafted for the same app and the choice is a facilitator decision, not a code change.');
  }


  // ------------------------------------------------------- owner and terms
  function owner() {
    var m = meta();
    if (!m.owner && !m.copyright) return null;
    var t = m.terms || {};
    return section('owner', '', 'Owner and terms of use',
      [h('p.ab-body', {}, (m.app_name || 'Board Ready') + ' is the work of ' + str(m.owner || '') + '. ' + (m.copyright ? m.copyright + ' ' : '') +
        'Free for your own study and for sharing unchanged; copying, changing, rehosting or selling it needs the owner\'s written permission.'),
       h('div.ab-legend-actions', {},
         t.points && t.points.length ? h('button.btn', { type: 'button', onclick: function () { if (CORB.terms) CORB.terms.show(); } }, icon('shield'), 'Read the terms of use') : null,
         safe(function () { return ui.maintainer(); }, null) ? h('a.btn.ghost', { href: safe(function () { return ui.maintainerMailto(''); }, '#') }, icon('mail'), 'Ask for permission') : null)]);
  }

  // ------------------------------------------- the phone app and the website
  function phone() {
    var m = meta(), rows = arr(m.app_qr), web = !!(CORB.isWeb && CORB.isWeb());
    if (!m.site_url) return null;
    var svg = rows.length && ui.qrSvg ? ui.qrSvg(rows, 'QR code for ' + m.site_url) : '';
    return section('phone', '', web ? 'Share it: the phone app' : 'The newest version, and the phone app',
      [h('div.ab-phone', {},
        svg ? h('div.ab-qr', { html: svg }) : null,
        h('div', {},
          web ? null : h('p', {}, 'This copy was built ' + (m.built_on ? util.fmtDate(str(m.built_on).slice(0, 10)) : 'on an earlier date') + ' and does not update itself. The newest version is always on the website, where it installs as an app:'),
          web ? h('p', {}, 'Scan this code with a phone camera to get ' + (m.app_name || 'Board Ready') + ' as an app: free, with no app store and no account. Show it to anyone who needs it.') : null,
          h('a.ab-url', { href: m.site_url, target: '_blank', rel: 'noopener' }, m.site_url),
          h('ul.ab-steps', {},
            h('li', {}, icon('phone'), h('span', {}, h('b', {}, 'iPhone: '), 'scan with the Camera app. The page opens in Safari: tap Share, then "Add to Home Screen", then Add.')),
            h('li', {}, icon('phone'), h('span', {}, h('b', {}, 'Android: '), 'scan with the Camera app, then tap "Install app". If the page opens in Samsung Internet, it offers "Install with Chrome" first.')),
            h('li', {}, icon('refresh'), h('span', {}, 'Open it once while online. After that it works offline, and new versions arrive by themselves.')),
            web ? null : h('li', {}, icon('shield'), h('span', {}, 'Where the network blocks the website, keep using this file; the website\'s Settings page offers the newest file for download.'))),
          h('div.ab-legend-actions', {},
            web ? h('a.btn', { href: 'handout/Board_Ready_Install_Sheet.html', target: '_blank', rel: 'noopener' }, icon('print'), 'Print the install sheet') : null,
            h('button.btn' + (web ? '.ghost' : ''), { type: 'button', onclick: function () { ui.copyText(m.site_url); } }, icon('copy'), 'Copy the link'))))]);
  }

  // ------------------------------------------------------------ what is inside
  function inside() {
    var D = CORB.DATA || {}, R = D.regulations || {};
    function n(v) { return Array.isArray(v) ? v.length : 0; }
    var games = 0;
    try { var A = window.ARCADE, g = A && (A.games || A.order); games = Array.isArray(g) ? g.length : g && typeof g === 'object' ? Object.keys(g).length : 0; } catch (e) { games = 0; }
    var items = [
      ['book', n(D.questions), 'board questions', 'library'], ['quiz', n(D.mcq), 'quiz items', 'quiz'], ['layers', n(D.primers), 'study primers', 'primers'],
      ['process', n((D.process || {}).steps), 'process steps', 'process'], ['refresh', arr(R.crosswalk).filter(function (c) { return c && c.confidence === 'verified'; }).length, 'old-to-new FAR pairs', 'regulations'],
      ['scale', n(R.thresholds), 'dollar thresholds', 'regulations'], ['glossary', n(D.glossary), 'glossary terms', 'glossary'], ['gamepad', games, 'Arcade games', 'arcade'], ['link', n(D.resources), 'links checked', 'resources']
    ].filter(function (x) { return x[1] && hasView(x[3]); });
    if (!items.length) return null;
    return section('inside', '', 'What is inside', h('div.ab-stats', {}, items.map(function (x) {
      return h('a.ab-stat', { href: '#/' + x[3] }, h('span.ab-stat-icon', {}, icon(x[0])), h('b.num', {}, String(x[1])), h('span', {}, x[2]));
    })), 'Every count comes from this build. Tap one to open it.');
  }

  // --------------------------------------------------------------- what's new
  function whatsNew() {
    var list = arr(meta().whats_new).filter(function (v) { return v && v.version; });
    if (!list.length) return null;
    return section('new', '', 'What\'s new',
      h('div.ab-new', {}, list.map(function (v, i) {
        return h('details.ab-new-item', { open: i === 0 },
          h('summary', {}, h('b', {}, 'Version ' + str(v.version)), v.date ? h('span.muted', {}, ' · ' + util.fmtDate(v.date)) : null, v.title ? h('span', {}, ' · ' + str(v.title)) : null),
          h('ul', {}, arr(v.items).map(function (it) { return h('li', {}, str(it)); })));
      })));
  }

  // --------------------------------------------------------------- is / not
  function whatItIs() {
    function col(title, items, kind) {
      return h('div.ab-col.' + kind, {},
        h('h3.ab-col-title', {}, icon(kind === 'is' ? 'check' : 'x'), title),
        h('div.ab-col-items', {}, items.map(function (it) {
          return h('div.ab-item', {}, h('span.ab-item-icon', {}, icon(it[0])), h('div', {}, h('b', {}, it[1]), h('p', {}, it[2])));
        })));
    }
    return section('what', 'Scope', 'What this app is — and is not',
      h('div.ab-cols', {}, col('What it is', IS, 'is'), col('What it is not', IS_NOT, 'not')));
  }

  // ------------------------------------------------------------ badge legend
  function legend() {
    var rows = BADGES.map(function (b) {
      return h('div.ab-legend-row', {}, h('div.ab-legend-badge', {}, badgeSafe(b[0])), h('p.ab-legend-text', {}, b[1]));
    });
    return section('legend', '', 'What the badges mean',
      [h('div.ab-legend', {}, rows),
       h('div.callout.warn.mt-4', {}, icon('alert'), h('div', {},
         h('b', {}, 'No answer in this app is verified for you'),
         'An official badge means a person wrote the answer in a study document. It does not mean anyone checked it against the current FAR.')),
       h('p.ab-body.mt-4', {}, 'Citations use the Revolutionary FAR Overhaul (RFO) numbering, effective in the FAR, DFARS and AFARS from 1 February 2026 per the Army Warranting Program Policy.'),
       h('div.ab-legend-actions', {},
         hasView('regulations') ? h('button.btn', { type: 'button', onclick: function () { CORB.go('regulations', { tab: 'crosswalk' }); } }, icon('refresh'), 'Old to new FAR numbers') : null,
         hasView('library') ? h('button.btn.ghost', { type: 'button', onclick: function () { CORB.go('library', { flag: 'korea-verify-cp' }); } }, icon('globe'), 'Show the Korea procedures') : null)],
      'Each question card shows how far to trust its answer.');
  }

  // ---------------------------------------------------------------- sources
  function sources() {
    var list = arr(meta().sources).filter(function (s) { return str(s).trim(); });
    var body = list.length
      ? h('ol.ab-sources', {}, list.map(function (s) { return h('li', {}, str(s)); }))
      : h('div.callout.info', {}, icon('info'), h('div', {}, h('b', {}, 'No source list in this build'),
          'The question bank still records a source on each item. Ask the facilitator for the document set.'));
    return section('sources', '', 'Where the content came from',
      [body,
       h('p.ab-note', {}, 'Every question records its source document, and every drafted answer says it was drafted. Where the sources say nothing about a 411th threshold or approval level, the item says so and tells you to ask C&P.')]);
  }

  // ------------------------------------------------------------- your data
  function storage() {
    var avail = safe(function () { return CORB.store.available; }, null);
    var items = [
      ['user', 'It stays in this browser', 'Your profile, progress and notes are saved in this browser on this computer. Clearing site data, a private window or another computer starts fresh.'],
      ['save', 'Save notes into the file', 'Save notes writes your notes into the Board Ready file itself, so they come back even after the browser is cleared. Anyone you give that file to can read them.'],
      ['download', 'Export is your backup', 'Settings → Your data downloads one file with your progress. Import it on another computer.' + (CORB.hasConnector() ? ' Your API key is never written to it.' : '')],
      CORB.hasConnector() ? ['key', 'Keys are separate', 'If you set up an AI endpoint, the key stays in this browser and is left out of every file the app produces.'] : null
    ].filter(Boolean);
    return section('data', '', 'How your progress is stored',
      [h('div.ab-data', {}, items.map(function (it) {
        return h('div.ab-data-item', {}, h('span.ab-data-icon', {}, icon(it[0])), h('div', {}, h('b', {}, it[1]), h('p', {}, it[2])));
      })),
      avail === false ? h('div.callout.warn.mt-4', {}, icon('alert'), h('div', {}, h('b', {}, 'Storage is blocked right now'), 'This session will not be remembered. Export your progress before you close the tab.')) : null,
      hasView('settings') ? h('div.ab-legend-actions', {}, h('button.btn', { type: 'button', onclick: function () { CORB.go('settings', { section: 'data' }); } }, icon('settings'), 'Open data settings')) : null]);
  }

  // ----------------------------------------------------------- updating
  function updating() {
    var steps = [
      ['Fix it in the app', 'A facilitator opens the content editor, corrects the answer, adds the citation, sets the verification status honestly, and the change takes effect immediately in that browser.'],
      ['Save a new copy', 'The editor writes a fresh single HTML file with the corrections baked in. That file is the new master — email it, and everyone who opens it sees the corrected content with their own progress untouched.'],
      ['Rebuild from source, for bigger changes', 'New questions in bulk, a new module, or a new app name go back to the source folder: update the data file, run the build tool, and it produces the single file again.']
    ];
    return section('update', '', 'How the content gets fixed',
      [h('ol.ab-steps', {}, steps.map(function (s, i) {
        return h('li.ab-step', {}, h('span.ab-step-n.num', {}, String(i + 1)), h('div', {}, h('b', {}, s[0]), h('p', {}, s[1])));
      })),
      h('p.ab-note', {}, 'Candidates cannot change the shared content — edits made in the editor belong to the facilitator role, and a candidate\'s own answers live in personal notes instead. That keeps one authoritative file circulating rather than a dozen drifting ones.')],
      'This app is a file, not a service, so a correction is a new file rather than a deploy.');
  }

  // ----------------------------------------------------------- shortcuts
  function shortcuts() {
    var groups = SHORTCUTS.filter(function (g) { return !(CORB.isCandidateEdition() && g[0] === 'Projector'); }).map(function (g) {
      return h('div.ab-keys-group', {},
        h('h3', {}, g[0]),
        h('table.table.ab-keys', {},
          h('tbody', {}, g[1].map(function (k) {
            return h('tr', {}, h('td.ab-key-cell', {}, k[0].split(/\s+or\s+|\s+\/\s+|\s+–\s+/).map(function (part, i, all) {
              return [h('kbd.ab-kbd', {}, part), i < all.length - 1 ? h('span.ab-key-sep', {}, k[0].indexOf('/') >= 0 ? '/' : k[0].indexOf('–') >= 0 ? 'to' : 'or') : null];
            })), h('td', {}, k[1]));
          }))));
    });
    return h('details.acc.ab-keys-acc', { id: 'ab-keys' },
      h('summary', {}, icon('grid'), 'Keyboard shortcuts', icon('chevron', 'chev')),
      h('div.acc-body', {}, h('div.ab-keys-grid', {}, groups),
        h('p.ab-note', {}, 'Shortcuts do nothing while you type in a box. Every one has a button on screen.')));
  }

  // ------------------------------------------------------------- disclaimer
  function closing() {
    var m = meta();
    return h('div.ab-closing', {},
      h('div.ab-closing-rule', {}),
      h('p.ab-disclaimer', {}, m.disclaimer || 'Training aid, not authoritative guidance. Verify every citation, threshold and local procedure against the current FAR, DFARS and AFARS on acquisition.gov, the Army Warranting Program Policy, and your Contracting & Policy office before relying on it.'),
      h('p.ab-colophon', {}, [
        m.app_name ? m.app_name : null,
        m.version || CORB.VERSION ? 'v' + str(m.version || CORB.VERSION) : null,
        m.built_on ? 'built ' + util.fmtDate(m.built_on) : null,
        m.content_verified_on ? 'content verified ' + util.fmtDate(m.content_verified_on) : null,
        m.org || null
      ].filter(Boolean).join(' · ')));
  }

  // ------------------------------------------------------------------ build
  function build(root) {
    var wrap = h('div.ab-app');
    root.appendChild(wrap);
    var blocks = CORB.isCandidateEdition()
      ? [hero, maintainer, owner, phone, whatsNew, whatItIs, inside, legend, storage, sources, shortcuts, closing]
      : [hero, maintainer, owner, phone, whatsNew, names, whatItIs, inside, legend, storage, sources, updating, shortcuts, closing];
    blocks.forEach(function (fn, i) {
      var node;
      try { node = fn(); } catch (e) { node = null; }
      if (!node) return;
      try { node.style.animationDelay = Math.min(i, 8) * 40 + 'ms'; } catch (e) {}
      wrap.appendChild(node);
    });
    if (!wrap.children.length) {
      wrap.appendChild(h('div.empty', {}, icon('info'), h('h3', {}, 'About is unavailable in this copy'), h('p', {}, 'The app metadata did not load. The rest of the app still works.')));
    }
  }

  CORB.registerView({
    id: 'about', title: 'About', icon: 'info', section: 'System', order: 430, nav: true, short: 'About',
    render: function (root, ctx) {
      build(root);
      var want = (ctx && ctx.params && ctx.params.section) || '';
      if (want) setTimeout(function () {
        var el = document.getElementById('ab-' + want);
        if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); } }
      }, 60);
    },
    onLeave: function () {}
  });
})();
