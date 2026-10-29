/* CORE-08A-TERMS — the owner notice and terms of use (text in meta.terms). Shown before first use, after the web
   edition's install page and ahead of the tour offer, and again whenever meta.terms.version changes; the reader agrees
   once per browser (settings.termsAccepted). About, the landing page and the side menu open a reading copy any time.
   The first-use dialog has no close button and comes back if it is dismissed another way (the Escape key), because the
   app is only offered on these terms. Never throws: without terms text it does nothing. Same design as B2B Exam Prep's
   core/08a-terms.js. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var KEY = 'settings.termsAccepted';
  var watch = 0;

  function meta() { return (CORB.DATA && CORB.DATA.meta) || {}; }
  function T() { return meta().terms || {}; }
  // "**Owner.** The rest" becomes a bold lead-in and the rest of the sentence; {email} becomes a mailto link
  function point(h, p, email) {
    var s = String(p == null ? '' : p).replace(/\{email\}/g, email), m = /^\*\*(.+?)\*\*\s*([\s\S]*)$/.exec(s);
    var lead = m ? h('b', {}, m[1] + ' ') : null, rest = m ? m[2] : s, kids = [];
    var i = email ? rest.indexOf(email) : -1;
    if (i >= 0) kids.push(rest.slice(0, i), h('a', { href: 'mailto:' + email }, email), rest.slice(i + email.length));
    else kids.push(rest);
    return h('li', {}, lead, kids);
  }
  function body(h) {
    var t = T(), m = meta(), email = (m.maintainer || {}).email || '';
    return h('div.terms', {},
      t.intro ? h('p.terms-intro', {}, t.intro) : null,
      h('ol.terms-list', {}, (t.points || []).map(function (p) { return point(h, p, email); })),
      m.copyright ? h('p.terms-copy', {}, m.copyright) : null);
  }

  var terms = CORB.terms = {
    body: body,
    available: function () { var t = T(); return !!(t.version && t.points && t.points.length); },
    accepted: function () { var v = T().version; return !v || CORB.get(KEY) === v; },
    // with onAgree: the first-use version, which only closes by agreeing; without: a reading copy with a Close button
    show: function (onAgree) {
      var h = CORB.ui.h, t = T(), title = t.title || 'Terms of use';
      if (!t.points || !t.points.length) { if (onAgree) onAgree(); return null; }
      var box = CORB.ui.modal({
        title: onAgree ? false : title, wide: true, sticky: !!onAgree,
        body: h('div', {}, onAgree ? h('h3.terms-title', {}, title) : null, body(h), onAgree && t.agree ? h('p.terms-agree', {}, t.agree) : null),
        actions: onAgree
          ? [{ label: 'I agree', primary: true, onClick: function () { clearInterval(watch); watch = 0; CORB.set(KEY, t.version); onAgree(); } }]
          : [{ label: 'Close', primary: true }]
      });
      try { box.setAttribute('aria-label', title); box.classList.add('terms-modal'); } catch (e) {}
      return box;
    },
    // run `then` once the reader has agreed (at once if they already have)
    require: function (then) {
      if (!terms.available() || terms.accepted()) { if (then) then(); return; }
      var done = function () { if (then) setTimeout(then, 300); };
      terms.show(done);
      clearInterval(watch);
      watch = setInterval(function () {
        if (terms.accepted()) { clearInterval(watch); watch = 0; return; }
        if (!document.querySelector('.terms-modal') && !document.querySelector('.inst-page')) terms.show(done);
      }, 600);
    }
  };
})();
