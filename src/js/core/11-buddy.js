/* CORE-11-BUDDY — Buddy, the study buddy (name and tagline in meta.buddy). A chat bubble on every page: the reader asks
   in plain words and Buddy answers from the guide's own content, on this device, with no internet and no AI account.
   It is not an AI: it finds the passage that answers the question (glossary, FAR numbers and deadlines, lessons,
   certification facts and FAQ, courses, how-to guides, official documents, flashcards, practice questions, links and
   what changed), shows it with an Open button and related passages. For more depth, one tap sends the question, with
   the exam context, to Google AI Mode, ChatGPT or Claude in the reader's own account; nothing leaves the device until
   that tap. In every edition: no network code here. The shell draws the bubble (core/02-router.js); the panel lives on
   body and survives page changes. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var buddy = CORB.buddy = {};
  function cfg() { var m = CORB.meta ? CORB.meta() : {}; return m.buddy || {}; }
  function name() { return cfg().name || 'Buddy'; }
  buddy.name = name;
  function arr(a) { return Array.isArray(a) ? a : []; }
  function raw(key) { var d = window.CORB_DATA || {}; return d[key]; }

  // ---- words: lower-case, no punctuation, no filler words, light stemming so "thresholds" finds "threshold" ----
  var STOP = {};
  'a an and are as at be by can could do does did for from how i if in is it its of on or so that the this to us was we what when where which who why will with you your me my our should would there their them they go get got have has had need about tell know want much many long please mean means'.split(' ').forEach(function (w) { STOP[w] = 1; });
  function norm(s) { return String(s || '').toLowerCase().replace(/[$,’']/g, '').replace(/[^a-z0-9.&\-\s]+/g, ' '); }
  function stem(w) { if (/^certif(y|ied|ies|ying|ication|ications)$/.test(w)) return 'certif'; return w.length > 4 ? w.replace(/(ings?|ies|es|ed|ly|s)$/, '') : w; }
  function toks(s, keepStop) { return norm(s).split(/\s+/).filter(function (w) { return w.length > 1 && (keepStop || !STOP[w]); }).map(stem); }
  function clip(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim(); if (s.length <= n) return s;
    var cut = s.slice(0, n), i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
    return i > n * 0.5 ? cut.slice(0, i + 1) : cut.replace(/\s\S*$/, '') + '…';
  }
  // the first useful string in an item of unknown shape (cert.json has several small shapes)
  var T_KEYS = ['title', 'name', 'k', 'q', 't', 'h', 'code', 'term', 'label'], X_KEYS = ['plain', 'a', 'v', 'd', 'body', 'text', 'note', 'definition', 'about', 'summary', 'why', 'desc'];
  function pick(o, keys) { if (typeof o === 'string') return o; for (var i = 0; i < keys.length; i++) if (o && typeof o[keys[i]] === 'string' && o[keys[i]]) return o[keys[i]]; return ''; }

  // ---- the index: short passages, each with the place in the guide that holds it ----
  var idx = null;
  function build() {
    idx = [];
    var D = CORB.data;
    function add(type, title, text, view, params, extra, w) {
      var t = String(title || '').trim(), x = String(text || '').replace(/\s+/g, ' ').trim();
      if (!t || !x) return;
      idx.push({ type: type, title: t, text: x, view: view, params: params || {}, w: w || 1, tt: toks(t, true), tx: toks(t + ' ' + x + ' ' + (extra || ''), true) });
    }
    D.glossary().forEach(function (g) { add('Term', g.term + (g.expansion ? ' (' + g.expansion + ')' : ''), g.definition + (g.cite ? ' (' + g.cite + ')' : ''), 'glossary', { q: g.term }, 'what is means meaning define ' + (g.cat || ''), 1.3); });
    var far = raw('far') || {};
    arr(far.numbers).forEach(function (n) { add('Key number', n.name, n.value + ': ' + n.plain + (n.cite ? ' (' + n.cite + ')' : ''), 'far', { tab: 'numbers' }, (n.q || '') + ' threshold amount dollars how much limit', 1.4); });
    arr(far.deadlines).forEach(function (d) { add('Deadline', d.name, d.value + ': ' + d.plain + (d.cite ? ' (' + d.cite + ')' : ''), 'far', { tab: 'numbers' }, (d.q || '') + ' deadline days when time clock long', 1.4); });
    arr(far.crosswalk).forEach(function (c) { add('Renumbered', c.what + ' (' + c.old + ' \u2192 ' + c.new + ')', 'Was ' + c.old + '; now ' + c.new + ' after the FAR overhaul.', 'far', { tab: 'moved' }, c.old + ' ' + c.new + ' moved renumbered old new where cite citation', 1.2); });
    arr(far.basics).forEach(function (b) { add('FAR basics', b.h, clip(b.body, 440), 'far', { tab: 'basics' }, 'far regulation rulebook', 1); });
    D.farParts().forEach(function (p) { add('FAR part', 'FAR Part ' + p.n + ': ' + p.title, p.plain, 'far', { tab: 'parts', q: String(p.n) }, 'part ' + p.n, 1); });
    D.lessons().forEach(function (l) {
      add('Lesson', l.title, l.summary, 'lesson', { id: l.id }, (l.why || '') + ' ' + arr(l.terms).join(' ') + ' ' + (l.compName || ''), 1.1);
      arr(l.sections).forEach(function (s) { add('Lesson', l.title + ' › ' + s.h, clip(s.body, 460), 'lesson', { id: l.id }, '', 1); });
    });
    var cert = raw('cert') || {}, ex = cert.exam || {}, reg = cert.register || {}, exp = cert.experience || {}, af = cert.after || {};
    arr(cert.faq).forEach(function (f, i) { add('FAQ', f.q, f.a, 'cert', { tab: 'faq', open: String(i) }, 'question', 1.35); });
    arr(ex.facts).forEach(function (f) { add('The exam', 'The exam (CON 3990V): ' + f.k, f.v + (f.note ? '. ' + f.note : ''), 'cert', { tab: 'exam' }, 'exam test certification how many', 1.35); });
    arr(cert.phases).forEach(function (p) { add('Exam area', p.code + ' ' + p.name, (p.plain || '') + (p.qs ? ' About ' + p.qs + ' exam questions.' : ''), 'cert', { tab: 'exam' }, (p.short || '') + ' ' + arr(p.items).map(function (i) { return (i.code || '') + ' ' + (i.name || ''); }).join(' ') + ' blueprint competency area', 1); });
    arr(ex.study).forEach(function (s) { add('Study tips', pick(s, T_KEYS) || 'Study tip', pick(s, X_KEYS) || pick(s, []), 'cert', { tab: 'exam' }, 'study prepare how to pass', 1); });
    arr(ex.testday).forEach(function (s) { add('The exam', 'Test day', s, 'cert', { tab: 'exam' }, 'test day exam center pearson online', 1); });
    arr(ex.retake).forEach(function (s) { add('The exam', 'Retakes', s, 'cert', { tab: 'exam' }, 'retake fail failed again attempts wait', 1.1); });
    arr(cert.requirements).forEach(function (s) { add('Requirement', pick(s, T_KEYS) || 'Requirement', pick(s, X_KEYS), 'cert', { tab: 'overview' }, 'need required requirement certification', 1.2); });
    arr(cert.deadlines).forEach(function (s) { add('Deadline', pick(s, T_KEYS) || 'Certification deadline', pick(s, X_KEYS), 'cert', { tab: 'overview' }, 'months deadline grace time how long', 1.5); });
    arr(cert.roles).forEach(function (s) { add('Who does what', pick(s, T_KEYS) || 'Role', pick(s, X_KEYS), 'cert', { tab: 'overview' }, 'role who does', 1); });
    if (cert.education) add('Certification', 'Education requirement', cert.education, 'cert', { tab: 'overview' }, 'degree college credits education', 1.1);
    if (reg.intro) add('Registering', 'How to register in AITAS for courses and the exam', reg.intro, 'cert', { tab: 'signup' }, 'aitas register sign up enroll apply', 1.3);
    arr(reg.steps).forEach(function (s, i) { add('Registering', 'Register, step ' + (i + 1) + ': ' + (pick(s, T_KEYS) || ''), pick(s, X_KEYS) || pick(s, T_KEYS), 'cert', { tab: 'signup' }, 'aitas register', 1); });
    arr(reg.tips).forEach(function (s) { add('Registering', 'Registration tip', s, 'cert', { tab: 'signup' }, 'aitas register', 1); });
    if (exp.intro) add('Experience', 'The 12 months of experience', exp.intro, 'cert', { tab: 'experience' }, 'ojt on the job experience months work', 1.2);
    arr(exp.items).forEach(function (s) { add('Experience', pick(s, T_KEYS) || 'Experience', pick(s, X_KEYS), 'cert', { tab: 'experience' }, 'experience', 1); });
    if (af.cl) add('After certification', 'Continuous learning', af.cl, 'cert', { tab: 'after' }, 'clp points hours continuous learning keep', 1.2);
    if (af.next) add('After certification', 'What comes next', af.next, 'cert', { tab: 'after' }, 'warrant career next level', 1);
    if (af.reciprocity) add('After certification', 'Reciprocity', af.reciprocity, 'cert', { tab: 'after' }, 'fac-c civilian agency transfer', 1);
    arr(af.credentials).forEach(function (s) { add('Credential', pick(s, T_KEYS) || 'Credential', pick(s, X_KEYS), 'cert', { tab: 'after' }, 'credential', 1); });
    D.courses().forEach(function (c) { add('Course', c.code + ': ' + c.title, (c.about || c.short_about || '') + ' ' + [c.delivery, c.length, c.prereq_text].filter(Boolean).join('. '), 'courses', { id: c.id }, (c.short || '') + ' ' + arr(c.learn).join(' ') + ' ' + (c.group || '') + ' course class', 1.3); });
    D.howtos().forEach(function (x) { add('How-to', x.title, (x.when ? x.when + ' ' : '') + 'Steps: ' + arr(x.steps).map(function (s, i) { return (i + 1) + '. ' + s.t; }).join(' '), 'howto', { id: x.id }, (x.who || '') + ' ' + arr(x.steps).map(function (s) { return s.d || ''; }).join(' ') + ' how do i', 1.3); });
    arr((raw('official') || {}).docs).forEach(function (d) { add('Official document', d.title, (d.summary || arr(d.simple).join(' ')) + (d.who ? ' (' + d.who + (d.date ? ', ' + d.date : '') + ')' : ''), 'official', { doc: d.id }, 'document official memo policy', 1); });
    arr(raw('cards')).forEach(function (deck) { arr(deck.cards).forEach(function (c) { add('Flashcard', c.front, c.back + (c.more ? '. ' + c.more : ''), 'cards', { deck: deck.id }, deck.title || '', 1.25); }); });
    D.questions().forEach(function (q) { var ok = arr(q.options).filter(function (o) { return o.correct; })[0]; if (ok) add('Practice question', q.stem, ok.text + (ok.why ? '. ' + ok.why : '') + (q.cite ? ' (' + q.cite + ')' : ''), 'lesson', { id: q.lesson }, '', 0.8); });
    D.links().forEach(function (l) { add('Link', l.title, (l.note || '') + ' ' + l.url, 'links', {}, (l.group || '') + ' website link address where find', 1); });
    arr(D.updates().far_updates).forEach(function (u) { add('What changed', u.title + ' (' + u.date + ')', u.body, 'far', { tab: 'new' }, 'changed change new update latest recent overhaul', 1); });
  }
  var INTENT = [
    [/how long|how many (months|days|years)|deadline|time limit|grace period|by when|when (do|must|should) i/, 'Deadline', 1.6],
    [/how much|dollar|\$|threshold|limit/, 'Key number', 1.3], [/which course|what course|course/, 'Course', 1.3],
    [/how do i|how to|where do i|steps to/, 'How-to', 1.3], [/what is|what does|whats|mean|define|stand for/, 'Term', 1.25]];
  buddy.search = function (q, limit) {
    if (!idx) build();
    var ql = String(q || '').toLowerCase(), qs = toks(q), whole = norm(q).split(/\s+/).filter(function (w) { return w && !STOP[w]; }).join(' ');   // the question without its filler
    if (!qs.length) return [];
    var out = [];
    for (var i = 0; i < idx.length; i++) {
      var it = idx[i], s = 0, hits = 0;
      for (var j = 0; j < qs.length; j++) {
        var w = qs[j], inT = it.tt.indexOf(w) >= 0, inX = inT || it.tx.indexOf(w) >= 0, k = /\d/.test(w) && w.length > 2 ? 3 : 1;   // a cite or a number is very specific
        if (inT) s += 5 * k; else if (inX) s += 2 * k;
        if (inX) hits++;
      }
      if (!hits) continue;
      if (hits < qs.length) s *= hits / qs.length;                 // a passage that misses half the words ranks low
      var tl = it.title.toLowerCase(), head = tl.replace(/\s*\(.*$/, '').replace(/[?.:]+$/, '');   // "KO (Contracting Officer)" answers "what is a KO"
      if (head === whole || tl === whole) s += 14; else if (whole.length > 2 && tl.indexOf(whole) >= 0) s += 7;
      s *= it.w;
      for (var m = 0; m < INTENT.length; m++) if (it.type === INTENT[m][1] && INTENT[m][0].test(ql)) s *= INTENT[m][2];   // the kind of question hints at the kind of answer
      out.push({ it: it, s: s, hits: hits, n: qs.length });
    }
    out.sort(function (a, b) { return b.s - a.s; });
    return out.slice(0, limit || 6);
  };
  CORB.on && CORB.on('change', function (e) { if (e && e.path === 'file') idx = null; });

  // ---- hand-off to the reader's own AI, with the exam context so the answer uses the right FAR ----
  function aiPrompt(q) { return (cfg().prompt || 'I am a new Army 51C / 1102 preparing for the DoW Contracting Professional certification exam (CON 3990V), which uses the FAR as rewritten by the 2026 Revolutionary FAR Overhaul. Please answer for that, and name the FAR or DFARS cite. ') + 'My question: ' + q; }
  var AI = [
    ['Google AI Mode', function (p) { return 'https://www.google.com/search?udm=50&q=' + encodeURIComponent(p); }],
    ['ChatGPT', function (p) { return 'https://chatgpt.com/?q=' + encodeURIComponent(p); }],
    ['Claude', function (p) { return 'https://claude.ai/new?q=' + encodeURIComponent(p); }]
  ];
  buddy.aiLinks = function (q) { return AI.map(function (a) { return { label: a[0], url: a[1](aiPrompt(q)) }; }); };

  // ---- the chat panel ----
  var panel = null, log = null, input = null, chips = null, lastQ = '', lastRes = [], shown = 0;
  var STARTERS = ['What is the micro-purchase threshold?', 'What is a KO?', 'How do I register in AITAS?', 'How many questions are on the exam?', 'What changed in the FAR overhaul?', 'What is CON 1300V?'];
  function h() { return CORB.ui.h.apply(null, arguments); }
  function icon(n) { return CORB.ui.icon(n); }
  function narrow() { return window.innerWidth <= 860; }
  function scrollDown() { if (log) log.scrollTop = log.scrollHeight; }
  function say(node, who) { var m = h('div.bmsg.' + who, {}, node); log.appendChild(m); scrollDown(); return m; }
  function aiRow(q) {
    return h('div.buddy-ai', {}, h('span', {}, 'More depth? Ask'), buddy.aiLinks(q).map(function (a) { return h('a.btn.sm.ghost', { href: a.url, target: '_blank', rel: 'noopener' }, icon('external'), a.label); }));
  }
  function openIt(it) { CORB.go(it.view, it.params); if (narrow()) buddy.close(); }
  function card(it) {
    var speakable = CORB.speech && CORB.speech.available;
    return h('div.bcard', {},
      h('div.bcard-top', {}, h('span.badge.neutral', {}, it.type), h('b', {}, it.title)),
      h('p', {}, CORB.ui.rich ? CORB.ui.rich(it.text) : it.text),
      h('div.row', {},
        h('button.btn.sm', { type: 'button', onclick: function () { openIt(it); } }, icon('arrow-right'), 'Open in the guide'),
        speakable ? h('button.btn.sm.ghost', { type: 'button', onclick: function () { CORB.speech.speak(it.title + '. ' + it.text); } }, icon('volume'), 'Listen') : null));
  }
  function more(list) {
    if (!list.length) return null;
    return h('div.bmore', {}, h('span', {}, 'Also in the guide:'), list.map(function (r) {
      return h('button.linkish', { type: 'button', onclick: function () { openIt(r.it); } }, r.it.title + ' (' + r.it.type.toLowerCase() + ')');
    }));
  }
  function canned(q) {
    var s = q.toLowerCase().trim();
    if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening)|hola)\b/.test(s)) return 'Hi! Ask me anything about contracting, the courses or the exam, in plain words. Try one of the questions below.';
    if (/\bthank/.test(s)) return 'Any time. Ask me another one.';
    if (/\b(who|what) (are|r) (you|u)\b|who made you|are you (an? )?(ai|robot|bot)/.test(s)) return 'I am ' + name() + ', the study buddy built into B2B Exam Prep' + (CORB.meta().owner ? ' by ' + CORB.meta().owner : '') + '. I am not an AI: I find the part of the guide that answers you, right on this device, so I work with no signal. For more depth, the buttons under my answers send your question to an AI in your own account.';
    if (/^(help|\?)$/.test(s)) return 'Ask like you would ask a mentor: "what is a J&A", "how much is the SAT", "when do I have to protest", "which course comes after CON 1200V", "how do I get a CAC". I answer from the guide and show where to read more.';
    return null;
  }
  function reply(q) {
    var c = canned(q);
    if (c) { say(h('div.bcard.plain', {}, h('p', {}, c)), 'bot'); return; }
    var res;
    if (/^(more|next|other|another|else)\b/.test(q.toLowerCase()) && lastQ) { res = buddy.search(lastQ, shown + 4).slice(shown); q = lastQ; }
    else { res = buddy.search(q, 8); lastQ = q; shown = 0; }
    lastRes = res;
    var top = res[0], good = top && top.hits >= Math.ceil(top.n / 2) && top.s >= 4;
    if (!good) {
      say(h('div.bcard.plain', {}, h('p', {}, 'I could not find that in the guide. Try other words or an acronym (KO, COR, PWS, J&A), or ask an AI:'), aiRow(q),
        top ? h('p.small.muted', {}, 'Closest I have: ', h('button.linkish', { type: 'button', onclick: function () { openIt(top.it); } }, top.it.title)) : null), 'bot');
      return;
    }
    shown += 1;
    var rest = res.slice(1, 4).filter(function (r) { return r.s >= top.s * 0.35; });
    shown += rest.length;
    say(h('div', {}, card(top.it), more(rest), aiRow(q), shown < res.length ? h('p.small.muted', {}, 'Say "more" for other matches.') : null), 'bot');
  }
  buddy.ask = function (q) {
    q = String(q || '').replace(/\s+/g, ' ').trim(); if (!q) return;
    if (!panel) buddy.open();
    if (chips) { chips.remove(); chips = null; }
    say(h('p', {}, q), 'me');
    setTimeout(function () { reply(q); }, 120);
  };
  buddy.open = function (q) {
    if (!panel) {
      var n = name();
      log = h('div.buddy-log', { role: 'log', 'aria-live': 'polite' });
      input = h('input.input', { type: 'text', placeholder: 'Ask ' + n + '…', 'aria-label': 'Ask ' + n, autocomplete: 'off', enterkeyhint: 'send' });
      chips = h('div.buddy-chips', {}, STARTERS.map(function (s) { return h('button.chip', { type: 'button', onclick: function () { buddy.ask(s); } }, s); }));
      panel = h('div.buddy', { role: 'dialog', 'aria-label': n, onkeydown: function (e) { if (e.key === 'Escape') buddy.close(); } },
        h('div.buddy-head', {}, h('span.buddy-avatar', {}, n.charAt(0)),
          h('div.grow', {}, h('b', {}, n), h('span', {}, cfg().tagline || 'Your study buddy')),
          h('button.btn.icon.sm.ghost', { type: 'button', 'aria-label': 'Close', onclick: buddy.close }, icon('x'))),
        log,
        h('form.buddy-ask', { onsubmit: function (e) { e.preventDefault(); var v = input.value; input.value = ''; buddy.ask(v); input.focus(); } },
          input, h('button.btn.primary.icon', { type: 'submit', 'aria-label': 'Send' }, icon('arrow-right'))),
        h('p.buddy-foot', {}, n + ' answers from the guide on this device. Your question leaves it only when you tap Google AI Mode, ChatGPT or Claude.'));
      say(h('div.bcard.plain', {}, h('p', {}, 'Hi, I am ' + n + '. Ask me anything in the guide: a term, a dollar limit, a deadline, a course, the exam, or how to do something.'), chips), 'bot');
      document.body.appendChild(panel);
    }
    document.querySelectorAll('.buddy-fab').forEach(function (b) { b.hidden = true; });
    if (q) buddy.ask(q); else setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
  };
  buddy.close = function () {
    if (panel) { panel.remove(); panel = null; log = null; input = null; chips = null; }
    document.querySelectorAll('.buddy-fab').forEach(function (b) { b.hidden = false; });
  };
  buddy.isOpen = function () { return !!panel; };
  // the chat bubble the shell draws on every page
  buddy.fab = function () {
    return h('button.buddy-fab', { type: 'button', 'aria-label': 'Ask ' + name(), title: 'Ask ' + name() + ' a question', hidden: !!panel, onclick: function () { buddy.open(); } }, icon('message'), h('span', {}, 'Ask ' + name()));
  };
})();
