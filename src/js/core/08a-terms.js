/* CORE-08A-TERMS — the owner notice and terms of use (text in meta.terms). Shown before first use, ahead of the tour
   offer, and again whenever meta.terms.version changes; the reader agrees once per browser (settings.termsAccepted).
   The first-use card is the short version (meta.terms.short: three lines) with the full text one tap away inside it;
   About and the side menu open the full text any time. Never throws: without terms text it does nothing. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var KEY = 'settings.termsAccepted';

  function T() { return (CORB.meta && CORB.meta().terms) || {}; }
  function body(h) {
    var t = T(), m = CORB.meta(), email = (m.maintainer || {}).email || '';
    return h('div.terms', {},
      t.intro ? h('p.terms-intro', {}, t.intro) : null,
      h('ol.terms-list', {}, (t.points || []).map(function (p) { return h('li', {}, CORB.ui.rich(String(p).replace('{email}', email))); })),
      m.copyright ? h('p.terms-copy', {}, m.copyright) : null,
      m.site_url ? h('p.terms-copy', {}, 'Also on the website: ', h('a', { href: m.site_url + 'terms.html', target: '_blank', rel: 'noopener' }, 'terms of use'), ' and ', h('a', { href: m.site_url + 'privacy.html', target: '_blank', rel: 'noopener' }, 'privacy'), '.') : null);
  }

  // the first-use card: three short lines, the full terms folded under them (0.35.0; the full text was eight paragraphs
  // on the very first screen). Without meta.terms.short it is the full text, as before.
  var ICONS = ['check', 'info', 'lock'];
  function brief(h) {
    var s = T().short || {}, pts = s.points || [];
    if (!pts.length) return body(h);
    return h('div.terms.terms-brief', {},
      s.intro ? h('p.terms-intro', {}, s.intro) : null,
      h('ul.terms-short', {}, pts.map(function (p, i) { return h('li', {}, CORB.ui.icon(ICONS[i] || 'check'), CORB.ui.rich(String(p))); })),
      h('details.terms-full', {}, h('summary', {}, 'Read the full terms', CORB.ui.icon('chevron', 'chev')), body(h)));
  }

  var terms = CORB.terms = {
    body: body,
    accepted: function () { var v = T().version; return !v || CORB.get(KEY) === v; },
    // with onAgree: the first-use version, which only closes by agreeing; without: a reading copy with a Close button
    show: function (onAgree) {
      var h = CORB.ui.h, t = T();
      CORB.ui.modal({
        title: t.title || 'Terms of use', wide: !onAgree || !(t.short && (t.short.points || []).length), sticky: !!onAgree, locked: !!onAgree,
        body: h('div', {}, onAgree ? brief(h) : body(h), onAgree && t.agree ? h('p.terms-agree', {}, (t.short && t.short.agree) || t.agree) : null),
        actions: onAgree
          ? [{ label: 'I agree', primary: true, onClick: function () { CORB.set(KEY, t.version); onAgree(); } }]
          : [{ label: 'Close', primary: true }]
      });
    },
    // run `then` once the reader has agreed (at once if they already have)
    require: function (then) {
      if (terms.accepted()) { if (then) then(); return; }
      terms.show(function () { if (then) setTimeout(then, 300); });
    }
  };
})();
