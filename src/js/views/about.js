/* VIEW about — what B2B Exam Prep is and is not, who builds and maintains it (and how to send feedback), what is inside, how it
   works offline, how it stays current, keyboard shortcuts, the disclaimer and credits. Same layout family as Board
   Ready's About page. Data: CORB.DATA.meta (maintainer, disclaimer, currency, credits) and counts from the content. */
(function () {
  'use strict';
  var CORB = window.CORB;

  var IS = [
    ['route', 'A step-by-step path', 'Three questions turn into a dated plan and a 26-week exam path, from your first day to passing CON 3990V and earning the DoW Contracting Professional certification.'],
    ['book', 'A study and practice tool', 'Plain-language lessons, explained practice questions with a timed exam simulator, flashcards, how-to guides, a glossary, FAR & key numbers and the Arcade games.'],
    ['save', 'One file that works offline', 'No install and no account. It runs without a network connection on a laptop or a phone, and your progress can be saved inside the file.']
  ];
  var IS_NOT = [
    ['alert', 'Not official guidance', 'An unofficial training aid. The FAR, DFARS, AFARS, DoW and Army policy, WarU and your Acquisition Career Manager always have the final word.'],
    ['award', 'Not the real exam', 'Practice questions are written for this guide and checked against the FAR Overhaul. None is a real CON 3990V item.'],
    ['users', 'Not a record system', 'It holds no names or personal data except the maintainer\'s contact below. Nothing you do in it is sent anywhere.']
  ];
  var KEYS = [
    ['Everywhere', [['/', 'Search the guide'], ['?', 'Take the tour'], ['Esc', 'Close a dialog or the menu']]],
    ['Flashcards', [['Space or Enter', 'Flip the card'], ['1, 2, 3', 'Again, almost, got it']]],
    ['Arcade', [['Arrows or WASD', 'Move or aim'], ['Space or Enter', 'Act, fire or continue'], ['1 to 4', 'Answer'], ['P', 'Pause'], ['M', 'Sound on or off']]]
  ];

  function arr(v) { return Array.isArray(v) ? v : []; }
  function section(id, title, kids, lede) {
    var h = CORB.ui.h;
    return h('section.ab-sec', { id: 'ab-' + id, 'aria-labelledby': 'ab-h-' + id },
      h('div.ab-sec-head', {}, h('h2', { id: 'ab-h-' + id }, title), lede ? h('p.ab-sec-lede', {}, lede) : null), kids);
  }
  function editionName() { return { offline: 'Offline file', web: 'Website and app', preview: 'Preview' }[CORB.edition()] || 'Offline file'; }

  function hero(h) {
    var m = CORB.meta();
    return h('header.ab-hero', {},
      h('div.ab-hero-mark', { 'aria-hidden': 'true' }, 'B2B'),
      h('div.ab-hero-copy', {},
        h('div.eyebrow', {}, 'About'),
        h('h1', {}, m.app_name || 'B2B Exam Prep'),
        h('p.ab-hero-lede', {}, m.tagline || ''),
        h('p.ab-hero-facts', {}, [editionName(), m.version ? 'version ' + m.version : '', m.content_verified_on ? 'content checked ' + CORB.util.fmtDate(m.content_verified_on) : ''].filter(Boolean).join(' · '))));
  }

  function maintainer(h, icon) {
    var who = CORB.ui.maintainer();
    if (!who) return null;
    var words = String(who.name).split(/\s+/).filter(Boolean);
    if (words.length > 2) words = words.slice(1);          // leave the rank out of the initials
    var initials = [words[0], words[words.length - 1]].map(function (w) { return String(w).charAt(0); }).join('').toUpperCase();
    function mail(kind) { return CORB.ui.feedbackMailto(kind) || 'mailto:' + who.email; }
    function link(tag, kind, label, extra) { return h(tag, Object.assign({ href: mail(kind), onclick: function (e) { e.currentTarget.href = mail(kind); } }, extra || {}), label); }
    return h('section.ab-maint', { id: 'ab-maintainer', 'aria-labelledby': 'ab-h-maintainer' },
      h('div.ab-maint-mark', { 'aria-hidden': 'true' }, initials),
      h('div.ab-maint-copy', {},
        h('div.eyebrow', {}, who.role || 'Developer and maintainer'),
        h('h2.ab-maint-name', { id: 'ab-h-maintainer' }, who.name),
        h('p.ab-maint-line', {}, 'B2B Exam Prep is designed, built and kept up to date by ' + who.name + ', a contracting NCO, for the Soldiers and civilians starting their contracting careers.'),
        h('p.ab-maint-line', {}, 'Found a wrong answer, a rule that changed or a page that does not work? Send feedback: it opens an email to ', h('a.ab-maint-mail', { href: 'mailto:' + who.email }, who.email), ' with the page and version already filled in.'),
        h('div.ab-maint-actions', {},
          link('a.btn.primary', 'feedback', [icon('mail'), 'Send feedback']),
          link('a.btn', 'problem', [icon('alert'), 'Report a problem']))));
  }

  // who owns the guide and the terms people agreed to on first use
  function ownerTerms(h, icon) {
    var m = CORB.meta();
    if (!m.owner) return null;
    return section('terms', 'Owner and terms of use', h('div.ab-terms', {},
      h('p', {}, h('b', {}, (m.app_name || 'This guide') + ' is owned by ' + m.owner + '. '),
        'Use it free for your own study, and share the official link or an unchanged copy. Copying it, changing it, putting it into another product or charging for it needs the owner\'s written permission.'),
      m.copyright ? h('p.small.muted', {}, m.copyright) : null,
      h('button.btn', { type: 'button', onclick: function () { if (CORB.terms) CORB.terms.show(); } }, icon('file'), 'Read the terms of use')));
  }

  function whatItIs(h, icon) {
    function col(title, items, kind) {
      return h('div.ab-col.' + kind, {},
        h('h3.ab-col-title', {}, icon(kind === 'is' ? 'check' : 'x'), title),
        h('div.ab-col-items', {}, items.map(function (it) { return h('div.ab-item', {}, h('span.ab-item-icon', {}, icon(it[0])), h('div', {}, h('b', {}, it[1]), h('p', {}, it[2]))); })));
    }
    return section('what', 'What B2B Exam Prep is, and is not', h('div.ab-cols', {}, col('What it is', IS, 'is'), col('What it is not', IS_NOT, 'not')),
      'An unofficial, plain-language guide for new 51C contracting NCOs and 1102 contract specialists working toward the DoW Contracting Professional certification.');
  }

  function inside(h, icon) {
    var D = CORB.DATA, games = window.ARCADE && window.ARCADE.order ? window.ARCADE.order.length : 0, decks = 0;
    try { decks = CORB.decks ? CORB.decks().length : arr(D.cards).length; } catch (e) { decks = arr(D.cards).length; }
    var weeks = CORB.path && CORB.path.total ? CORB.path.total() : 26;
    var items = [
      ['target', weeks, 'week exam path', 'path'], ['school', CORB.data.courses().length, 'courses explained', 'courses'], ['book', CORB.data.lessons().length, 'short lessons', 'learn'],
      ['quiz', CORB.data.questions().length, 'practice questions', 'quiz'], ['cards', decks, 'flashcard decks', 'cards'], ['gamepad', games, 'Arcade games', 'arcade'],
      ['glossary', CORB.data.glossary().length, 'glossary terms', 'glossary'], ['steps', CORB.data.howtos().length, 'how-to guides', 'howto']
    ].filter(function (x) { return x[1] && CORB.views[x[3]]; });
    return section('inside', 'What is inside', h('div.ab-stats', {}, items.map(function (x) {
      return h('a.ab-stat', { href: '#/' + x[3] }, h('span.ab-stat-icon', {}, icon(x[0])), h('b', {}, String(x[1])), h('span', {}, x[2]));
    })));
  }

  function works(h) {
    var ed = CORB.edition();
    var where = ed === 'web' ? 'Your ticks, scores and flashcard history stay in this browser on this device. To move them, use Settings & help → My data → Export, then Import on the other device.'
      : ed === 'preview' ? 'In this preview your progress stays in this browser only, and downloads and printing are off. Use the offline file or the website to keep your progress.'
      : 'Your ticks, scores and flashcard history stay in this browser. Save progress stores them inside the B2B Exam Prep file itself, so a computer restart or a cleared browser cannot erase them.';
    return section('works', 'How it works', h('div.ab-works', {},
      h('div.ab-work', {}, h('b', {}, 'Everything is in one file'), h('p', {}, 'The lessons, questions, games and even the fonts are inside the guide, so it opens from Teams, SharePoint, OneDrive or a thumb drive and works on government networks with no internet.')),
      h('div.ab-work', {}, h('b', {}, 'Your progress stays with you'), h('p', {}, where)),
      ed === 'web' ? h('div.ab-work', {}, h('b', {}, 'Nothing is sent unless you sign in'), h('p', {}, 'There are no trackers. Accounts are optional: if you create one, only your email address and your progress are saved, so you can continue on any device.')) :
      h('div.ab-work', {}, h('b', {}, 'Nothing is sent anywhere'), h('p', {}, 'There are no accounts, trackers or outside services. The only link out is the feedback email, and only when you choose to send it.'))));
  }

  // the phone app: a QR code drawn from meta.app_qr (made by tools/make_handout.py), so anyone can share the guide in person
  function phone(h, icon) {
    var m = CORB.meta(), rows = arr(m.app_qr), n = rows.length;
    if (!m.site_url || !n) return null;
    var d = '';
    rows.forEach(function (r, y) { var re = /1+/g, run; while ((run = re.exec(r))) d += 'M' + (run.index + 4) + ' ' + (y + 4) + 'h' + run[0].length + 'v1h-' + run[0].length + 'z'; });
    var svg = '<svg viewBox="0 0 ' + (n + 8) + ' ' + (n + 8) + '" shape-rendering="crispEdges" role="img" aria-label="QR code for ' + m.site_url + '">' +
      '<rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="' + d + '"/></svg>';
    return section('phone', 'Get it on your phone', h('div.ab-phone', {},
      h('div.ab-qr', { html: svg }),
      h('div', {},
        h('p', {}, 'Scan this code with a phone camera to get B2B Exam Prep as an app: free, with no app store and no account. Show it to anyone who needs it.'),
        h('a.ab-url', { href: m.site_url, target: '_blank', rel: 'noopener' }, m.site_url),
        h('ul.ab-steps', {},
          h('li', {}, icon('phone'), h('span', {}, h('b', {}, 'iPhone: '), 'scan with the Camera app. The page opens in Safari: tap Share, then "Add to Home Screen", then Add.')),
          h('li', {}, icon('phone'), h('span', {}, h('b', {}, 'Android: '), 'scan with the Camera app, then tap "Install app". If the page opens in Samsung Internet, it offers "Install with Chrome" first.')),
          h('li', {}, icon('refresh'), h('span', {}, 'Open it once while online. After that it works offline, and new versions arrive by themselves.'))))));
  }

  function current(h) {
    var m = CORB.meta(), changes = arr((CORB.data.updates() || {}).guide_changes).slice(0, 4);
    return section('current', 'How it stays current', [
      CORB.ui.rich(m.currency || ''),
      changes.length ? h('div.ab-changes', {}, changes.map(function (c) {
        return h('div.ab-change', {}, h('div.ab-change-head', {}, h('b', {}, 'Version ' + c.version), h('span', {}, CORB.util.fmtDate(c.date))), h('div.ab-change-title', {}, c.title), c.notes ? h('p', {}, c.notes) : null);
      })) : null], 'Content checked ' + CORB.util.fmtDate(m.content_verified_on || '') + '. Every page shows the date its facts were checked.');
  }

  function keys(h) {
    return section('keys', 'Keyboard shortcuts', h('div.ab-keys', {}, KEYS.map(function (g) {
      return h('div.ab-keygroup', {}, h('h3', {}, g[0]), h('dl', {}, g[1].map(function (k) { return [h('dt', {}, h('kbd', {}, k[0])), h('dd', {}, k[1])]; })));
    })));
  }

  function fine(h, icon) {
    var m = CORB.meta();
    return h('div.ab-fine', {},
      CORB.ui.callout('warn', 'alert', 'Unofficial training aid', m.disclaimer || ''),
      h('div.card.mt-4', {}, h('h3', {}, 'Credits'), h('p.small.muted', {}, m.credits || '')),
      h('div.ab-facts.mt-4', {}, [['Version', m.version], ['Edition', editionName()], ['Built', m.built_on], ['Content checked', CORB.util.fmtDate(m.content_verified_on || '')], ['Build id', m.build_id]].filter(function (x) { return x[1]; }).map(function (x) {
        return h('div', {}, h('span', {}, x[0]), h('b', {}, String(x[1])));
      })),
      h('div.row.mt-4', {}, h('button.btn', { type: 'button', onclick: function () { if (CORB.tour) CORB.tour.start(); } }, icon('help'), 'Take the tour'), h('a.btn.ghost', { href: '#/settings?tab=help' }, icon('settings'), 'Settings & help')));
  }

  CORB.registerView({ id: 'about', title: 'About', section: 'Help', icon: 'info', nav: true, order: 140,
    blurb: 'What B2B Exam Prep is, who maintains it, how to send feedback', keywords: 'about developer maintainer feedback contact version credits disclaimer offline privacy shortcuts',
    render: function (root) {
      var h = CORB.ui.h, icon = CORB.ui.icon;
      var page = h('div.ab-app', {}, hero(h), maintainer(h, icon), ownerTerms(h, icon), whatItIs(h, icon), inside(h, icon), works(h), phone(h, icon), current(h), keys(h), fine(h, icon));
      root.appendChild(page);
    } });
})();
