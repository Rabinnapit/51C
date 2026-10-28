/* VIEW official — Official documents: every DPCAP and WarU document behind the guide, each with a simple picture version
   and the real pages. Page images are stored in the file (CORB.DATA.pages, made by tools/render_official.py), so the
   official pages open offline; the rest open on the official website. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var srcCache = {};
  function O() { return CORB.DATA.official || {}; }
  function pages(id) { return (CORB.DATA.pages || {})[id] || []; }
  function docs() { return O().docs || []; }

  CORB.official = {
    doc: function (id) { return docs().filter(function (d) { return d.id === id; })[0] || null; },
    pageCount: function (id) { return pages(id).length; },
    // a page image as a data: URL; the build stores each page as a list of base64 lines
    src: function (id, n) {
      var k = id + '#' + n;
      if (!srcCache[k]) { var p = pages(id)[n - 1]; if (!p) return ''; srcCache[k] = 'data:image/webp;base64,' + (Array.isArray(p) ? p.join('') : p); }
      return srcCache[k];
    }
  };

  function kindLabel(d) { return d.kind === 'web' ? 'Web page' : d.kind === 'xlsx' ? 'Excel file' : 'PDF'; }
  function stored(d, h, icon) {
    var n = pages(d.id).length;
    if (d.broken) return CORB.ui.badge('danger', 'Link broken', 'alert');
    return n ? CORB.ui.badge('ok', 'In this file · ' + n + (n > 1 ? ' pages' : ' page'), 'check') : CORB.ui.badge('info', kindLabel(d) + ' · website', 'globe');
  }

  // the real pages, stacked like a PDF, with zoom and a full-screen mode
  function viewer(d, h, icon) {
    var n = pages(d.id).length, zoom = 1;
    var strip = h('div.viewer-pages', { tabindex: '0', 'aria-label': d.title + ', official pages' });
    for (var i = 1; i <= n; i++) {
      strip.appendChild(h('figure.vpage', {}, h('img', { src: CORB.official.src(d.id, i), alt: 'Page ' + i + ' of ' + n + ' of ' + d.title, loading: i > 2 ? 'lazy' : null, decoding: 'async' }), h('figcaption', {}, 'Page ' + i + ' of ' + n)));
    }
    var pct = h('span.vz.num', {}, '100%');
    function setZoom(z) { zoom = Math.max(1, Math.min(3, Math.round(z * 4) / 4)); strip.style.setProperty('--z', String(zoom)); pct.textContent = Math.round(zoom * 100) + '%'; }
    var box = h('div.viewer'), home = null;
    // full screen moves the viewer to <body>: the view's animated container would trap position: fixed
    function full(on) {
      if (on === box.classList.contains('full')) return;
      if (on) { home = h('div.viewer-home'); box.parentNode.insertBefore(home, box); document.body.appendChild(box); window.addEventListener('hashchange', leave); }
      else { window.removeEventListener('hashchange', leave); if (home && home.parentNode) home.parentNode.replaceChild(box, home); else box.remove(); home = null; }
      box.classList.toggle('full', on); document.body.style.overflow = on ? 'hidden' : '';
      fsBtn.lastChild.textContent = on ? 'Close full screen' : 'Full screen';
      if (on) strip.focus();
    }
    function leave() { full(false); }
    var fsBtn = h('button.btn.sm', { type: 'button', onclick: function () { full(!box.classList.contains('full')); } }, icon('eye'), 'Full screen');
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('full')) { e.stopPropagation(); full(false); }
      else if (e.key === '+' || e.key === '=') setZoom(zoom + 0.25);
      else if (e.key === '-') setZoom(zoom - 0.25);
    });
    box.appendChild(h('div.viewer-bar', {}, stored(d, h, icon), h('span.viewer-title.small', {}, d.title + (d.date ? ' · ' + d.date : '')), h('div.grow'),
      h('div.row.tight', { role: 'group', 'aria-label': 'Zoom' },
        h('button.btn.sm.icon', { type: 'button', 'aria-label': 'Zoom out', onclick: function () { setZoom(zoom - 0.25); } }, '−'), pct,
        h('button.btn.sm.icon', { type: 'button', 'aria-label': 'Zoom in', onclick: function () { setZoom(zoom + 0.25); } }, '+')),
      fsBtn, CORB.ui.extLink(d.url, 'Official site', '.btn.sm')));
    box.appendChild(strip);
    return box;
  }

  function docCard(d, h, icon) {
    var n = pages(d.id).length;
    var thumb = n ? h('div.doc-thumb', {}, h('img', { src: CORB.official.src(d.id, 1), alt: '', loading: 'lazy', decoding: 'async' }))
      : h('div.doc-thumb.none', {}, icon(d.icon || 'file'), h('span', {}, kindLabel(d)));
    return h('article.card.doc-card' + (d.broken ? '.broken' : ''), {},
      h('a.doc-main', { href: '#/official?doc=' + d.id }, thumb,
        h('div.doc-text', {}, h('b', {}, d.title), h('span.tiny.muted', {}, [d.who, d.date].filter(Boolean).join(' · ')), h('div.mt-1', {}, stored(d, h, icon)), h('p.small', {}, d.summary))),
      h('div.doc-actions', {},
        (d.simple || []).length ? h('a.btn.sm', { href: '#/official?doc=' + d.id + '&show=simple' }, icon('eye'), 'Simple') : null,
        n ? h('a.btn.sm', { href: '#/official?doc=' + d.id + '&show=official' }, icon('file'), 'Pages') : null,
        h('div.grow'), CORB.ui.extLink(d.url, 'Site', '.btn.sm.ghost')));
  }

  function library(root, h, icon) {
    var D = O();
    root.appendChild(CORB.ui.pageHead({ title: 'Official documents', lede: D.lede }));
    if (D.hub) root.appendChild(h('div.callout.info', {}, icon('globe'), h('div', {}, h('b', {}, 'Where these come from'),
      h('span', {}, D.hub.note + ' Checked ' + (D.checked || '') + '. '), CORB.ui.extLink(D.hub.url, D.hub.title))));
    (D.groups || []).forEach(function (g) {
      var list = docs().filter(function (d) { return d.group === g.id; }); if (!list.length) return;
      root.appendChild(h('section', {}, h('div.section-head', {}, h('h2', {}, icon(g.icon || 'folder', 'sec-ic'), g.title), h('span.muted.small', {}, list.length + ' documents')),
        h('div.doc-grid', {}, list.map(function (d) { return docCard(d, h, icon); }))));
    });
  }

  function docPage(root, d, show, h, icon) {
    var g = (O().groups || []).filter(function (x) { return x.id === d.group; })[0];
    var simple = d.simple || [], n = pages(d.id).length;
    var tab = show === 'official' || !simple.length ? 'official' : 'simple';
    root.appendChild(CORB.ui.pageHead({ back: { view: 'official', label: 'Official documents' }, eyebrow: g ? g.title : '', title: d.title,
      meta: [h('span.small.muted', {}, [d.who, d.date].filter(Boolean).join(' · ')), stored(d, h, icon)], lede: d.summary }));
    if (d.broken) root.appendChild(CORB.ui.callout('danger', 'alert', 'This link is broken on the official site', 'Checked ' + (O().checked || '') + '. Ask your DACM office or training office for a copy.'));
    root.appendChild(h('div.seg.doc-seg', { role: 'tablist', 'aria-label': 'Version' },
      simple.length ? h('button' + (tab === 'simple' ? '.on' : ''), { type: 'button', role: 'tab', 'aria-selected': String(tab === 'simple'), onclick: function () { CORB.go('official', { doc: d.id, show: 'simple' }); } }, icon('eye'), 'Simple version') : null,
      h('button' + (tab === 'official' ? '.on' : ''), { type: 'button', role: 'tab', 'aria-selected': String(tab === 'official'), onclick: function () { CORB.go('official', { doc: d.id, show: 'official' }); } }, icon('file'), 'Official document')));
    var body = h('div.doc-body'); root.appendChild(body);
    if (tab === 'simple') {
      body.appendChild(h('p.small.muted', {}, 'Our plain-English picture version. If anything here differs from the official document, the official document wins.'));
      simple.forEach(function (k) {
        var part = CORB.explain && CORB.explain.render(k); if (!part) return;
        body.appendChild(h('section.card.explain-card', {}, h('h2', {}, CORB.explain.TITLES[k] || k), part));
      });
      body.appendChild(h('div.row.mt-4', {}, h('a.btn.primary', { href: '#/official?doc=' + d.id + '&show=official' }, icon('file'), n ? 'See the official pages' : 'Open the official document')));
    } else if (n) {
      body.appendChild(viewer(d, h, icon));
    } else {
      body.appendChild(h('div.card.doc-away', {}, icon(d.icon || 'globe'),
        h('div', {}, h('h3', {}, d.kind === 'web' ? 'This is a web page' : 'Not stored in this file'),
          h('p.small.muted', {}, d.kind === 'web' ? 'It changes often, so it opens on the official website.' : 'It is long or rarely needed, so it opens on the official website. On a government computer it may only open at work.'),
          CORB.ui.extLink(d.url, 'Open the official ' + kindLabel(d).toLowerCase(), '.btn.primary'))));
    }
    var rel = docs().filter(function (x) { return x.group === d.group && x.id !== d.id; });
    if (rel.length) root.appendChild(h('section.mt-6', {}, h('div.section-head', {}, h('h2', {}, 'More in ' + (g ? g.title : 'this group'))), h('div.doc-grid', {}, rel.map(function (x) { return docCard(x, h, icon); }))));
  }

  CORB.registerView({ id: 'official', mobileAs: 'path', title: 'Official documents', section: 'Get certified', icon: 'file', nav: true, order: 45,
    blurb: 'The real DoW and WarU documents, with picture versions',
    keywords: 'official documents PDF DPCAP WarU FAQ roadmap flowchart user experience career field model competency model narrative memo policy reciprocity FAC-C continuous learning CL DoDI 5000.66 CON 7300V OJT tool warrant',
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon, p = ctx.params || {};
      var d = p.doc && CORB.official.doc(p.doc);
      if (d) docPage(root, d, p.show, h, icon); else library(root, h, icon);
    } });
})();
