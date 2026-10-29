/* CORE-08A-TERMS — the owner notice and terms of use (text in meta.terms). Shown before first use, ahead of the tour
   offer, and again whenever meta.terms.version changes; the reader agrees once per browser (settings.termsAccepted).
   About and the side menu open them any time. Never throws: without terms text it does nothing. */
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

  var terms = CORB.terms = {
    body: body,
    accepted: function () { var v = T().version; return !v || CORB.get(KEY) === v; },
    // with onAgree: the first-use version, which only closes by agreeing; without: a reading copy with a Close button
    show: function (onAgree) {
      var h = CORB.ui.h, t = T();
      CORB.ui.modal({
        title: t.title || 'Terms of use', wide: true, sticky: !!onAgree,
        body: h('div', {}, body(h), onAgree && t.agree ? h('p.terms-agree', {}, t.agree) : null),
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
