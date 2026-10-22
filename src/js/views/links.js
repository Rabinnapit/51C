/* VIEW links — official websites, grouped, with what each one is for and whether it needs a CAC */
(function () {
  'use strict';
  var CORB = window.CORB;
  var ORDER = ['Certification and training', 'Regulations', 'Army contracting', 'Systems you will use', 'Guides and handbooks', 'Practice and games', 'Career'];
  CORB.registerView({ id: 'links', mobileAs: 'glossary', title: 'Official links', section: 'Look it up', icon: 'link', nav: true, order: 120,
    blurb: 'Official websites, with what each is for', keywords: 'links websites WarU iCatalog AITAS ATRRS CAMP Pearson acquisition.gov SAM.gov PIEE WAWF',
    render: function (root) {
      var h = CORB.ui.h, icon = CORB.ui.icon, all = CORB.data.links();
      root.appendChild(CORB.ui.pageHead({ title: 'Official links', lede: 'The websites you will use, what each one is for, and whether you need your CAC. On a government computer some of them only open on the network at work.' }));
      var groups = ORDER.concat(all.map(function (l) { return l.group; }).filter(function (g, i, a) { return ORDER.indexOf(g) < 0 && a.indexOf(g) === i; }));
      groups.forEach(function (g) {
        var ls = all.filter(function (l) { return l.group === g; }); if (!ls.length) return;
        root.appendChild(h('section', {}, h('div.section-head', {}, h('h2', {}, g)),
          h('div.grid.auto.link-grid', {}, ls.map(function (l) {
            return h('a.card.lift.link-card', { href: l.url, target: '_blank', rel: 'noopener' },
              h('div.row.between', {}, h('b', {}, l.title), icon('external')),
              h('span.small.muted', {}, l.note),
              h('div.row.tight.mt-1', {}, CORB.ui.badge(l.access === 'cac' ? 'warn' : 'ok', l.access === 'cac' ? 'CAC needed' : 'Public', l.access === 'cac' ? 'key' : 'globe'), h('span.tiny.muted.link-host', {}, (l.url.split('/')[2] || '').replace(/^www\./, ''))));
          }))));
      });
      root.appendChild(h('p.muted.small.mt-5', {}, 'Links were checked on ' + CORB.util.fmtDate(CORB.meta().content_verified_on) + '. Government sites move; if a link breaks, search the site name or tell the maintainer.'));
    } });
})();
