/* Lesson pictures (helper, not a view): the "At a glance" figures near the top of each lesson page, drawn from
   src/data/figs.json. Short labels and icons first, few words, so readers at every English level can follow.
   A lesson's entry is one figure or a list of figures; each has a type below, a title and an optional note.
   Pictures build themselves as they scroll into view (not with reduced motion), Play walks through one part at a
   time and reads it aloud, and some are hands-on: "calc" figures answer for a value you pick, a "sum" with
   interactive set loses a piece when tapped, a "check" with a test fails when a condition is tapped, and a "scale"
   whose items have a d explains the item tapped. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var h, icon;

  function tone(t) { return t ? '.lf-' + t : ''; }
  function ic(name) { return h('span.lf-ic', {}, icon(name || 'dot')); }
  // an animated, playable part of a figure; i sets its place in the build-up
  function item(el, i) { el.classList.add('lf-item'); el.style.setProperty('--d', String(i)); return el; }
  function money(v) { return '$' + Math.round(v).toLocaleString('en-US'); }
  function hint(t) { return t ? h('p.lf-hint', {}, icon('hand'), h('span', {}, t)) : null; }
  function pop(el) { el.classList.remove('lf-pop'); void el.offsetWidth; el.classList.add('lf-pop'); }

  var DRAW = {
    // tiles: who does what, or a short list of things to know
    roles: function (f) {
      return h('div.lf-tiles', {}, (f.items || []).map(function (it, i) {
        return item(h('div.lf-tile' + tone(it.tone), {}, ic(it.icon), h('div', {}, h('b', {}, it.t), it.s ? h('span', {}, it.s) : null)), i);
      }));
    },
    // steps in order, joined by arrows (they stack on phones)
    flow: function (f) {
      return h('ol.lf-flow', {}, (f.steps || []).map(function (s, i) {
        return item(h('li.lf-step', {}, ic(s.icon), h('b', {}, s.t), s.s ? h('span', {}, s.s) : null), i);
      }));
    },
    // layers, widest first (the rulebook, levels of competition)
    stack: function (f) {
      var n = (f.items || []).length;
      return h('div.lf-stack', {}, f.items.map(function (it, i) {
        return item(h('div.lf-layer', { style: { '--w': (100 - i * (n > 3 ? 12 : 16)) + '%' } }, h('b', {}, it.t), it.s ? h('span', {}, it.s) : null), i);
      }));
    },
    // parts that add up to a result; with interactive set, a tap takes a part away
    sum: function (f) {
      var parts = [], terms = [], resB, resS, res;
      (f.items || []).forEach(function (it, i) {
        if (i) parts.push(h('span.lf-op', { 'aria-hidden': 'true' }, '+'));
        var t = item(h((f.interactive ? 'button' : 'div') + '.lf-term', f.interactive ? { type: 'button', 'aria-pressed': 'true' } : {}, ic(it.icon), h('b', {}, it.t), it.s ? h('span', {}, it.s) : null), i);
        t.dataset.name = it.t;
        if (f.interactive) t.addEventListener('click', function () { var off = t.classList.toggle('lf-off'); t.setAttribute('aria-pressed', off ? 'false' : 'true'); update(); });
        terms.push(t); parts.push(t);
      });
      function update() {
        var off = terms.filter(function (t) { return t.classList.contains('lf-off'); }).map(function (t) { return t.dataset.name; });
        res.classList.toggle('lf-bad', off.length > 0);
        resB.textContent = off.length ? (f.fail || 'Missing: {x}').replace('{x}', off.join(', ')) : f.result.t;
        res.querySelector('.lf-ic').replaceChildren(icon(off.length ? 'x' : f.result.icon));
        pop(res);
      }
      if (f.result) {
        parts.push(h('span.lf-op', { 'aria-hidden': 'true' }, '='));
        res = item(h('div.lf-term.lf-result', { 'aria-live': 'polite' }, ic(f.result.icon), resB = h('b', {}, f.result.t)), terms.length);
        parts.push(res);
      }
      return h('div', {}, h('div.lf-sum', {}, parts), f.interactive ? hint(f.hint || 'Tap a part to take it away.') : null);
    },
    // side-by-side columns
    compare: function (f) {
      return h('div.lf-cols', { style: { '--n': String((f.cols || []).length) } }, f.cols.map(function (c, i) {
        return item(h('div.lf-col' + tone(c.tone), {}, h('div.lf-col-head', {}, ic(c.icon), h('b', {}, c.t)),
          h('ul', {}, (c.rows || []).map(function (r) { return h('li', {}, r); }))), i);
      }));
    },
    // thresholds or levels: the first rung is drawn at the bottom and builds first
    ladder: function (f) {
      return h('ol.lf-ladder', {}, (f.rungs || []).map(function (r, i) {
        return item(h('li.lf-rung' + tone(r.tone), { style: { '--i': String(i) } }, h('span.lf-v', {}, r.v), h('div', {}, h('b', {}, r.t), r.s ? h('span', {}, r.s) : null)), i);
      }).reverse());
    },
    // a spectrum between two ends; items with a d explain themselves when tapped
    scale: function (f) {
      var items = (f.items || []).map(function (t) { return typeof t === 'string' ? { t: t } : t; });
      var live = items.some(function (t) { return t.d; });
      var marker = live ? h('span.lf-marker', { hidden: true, 'aria-hidden': 'true' }) : null;
      var desc = live ? h('div.lf-scale-desc', { 'aria-live': 'polite' }, h('span.lf-muted', {}, f.hint || 'Tap a type to see how it works.')) : null;
      var ticks = items.map(function (t, i) {
        var li = item(h('li', {}, live ? h('button.lf-tick', { type: 'button' }, t.t) : t.t), i);
        if (live) li.firstChild.addEventListener('click', function () {
          ticks.forEach(function (x) { x.classList.remove('lf-sel'); }); li.classList.add('lf-sel');
          marker.hidden = false; marker.style.left = ((i + 0.5) * 100 / items.length) + '%';
          desc.replaceChildren(h('b', {}, t.t), h('span', {}, t.d)); pop(desc);
        });
        return li;
      });
      return h('div.lf-scale', {},
        h('div.lf-ends', {}, h('span', {}, f.left), h('span', {}, f.right)),
        h('div.lf-bar', { 'aria-hidden': 'true' }, marker),
        h('ol.lf-ticks', { style: { '--n': String(items.length) } }, ticks), desc);
    },
    // dated steps on a line
    timeline: function (f) {
      return h('ol.lf-time', {}, (f.marks || []).map(function (m, i) {
        return item(h('li', {}, h('span.lf-dot', { 'aria-hidden': 'true' }), h('span.lf-at', {}, m.at), h('b', {}, m.t)), i);
      }));
    },
    // a citation taken apart
    parts: function (f) {
      return h('div.lf-parts', {}, (f.items || []).map(function (p, i) { return item(h('div.lf-part', {}, h('code', {}, p.x), h('span', {}, p.t)), i); }));
    },
    // who is linked to whom, and who is not
    chain: function (f) {
      var row = [], k = 0;
      (f.nodes || []).forEach(function (n, i) {
        if (i) row.push(item(h('div.lf-link', {}, h('span', {}, (f.links || [])[i - 1] || ''), icon('arrow-right')), k++));
        row.push(item(h('div.lf-node', {}, ic(n.icon), h('b', {}, n.t)), k++));
      });
      return h('div.lf-chain', {}, h('div.lf-chain-row', {}, row), f.skip ? item(h('div.lf-skip', {}, icon('ban'), h('span', {}, f.skip)), k) : null);
    },
    // a numbered list; starred items are the preferred ones
    rank: function (f) {
      return h('ol.lf-rank', {}, (f.items || []).map(function (it, i) {
        return item(h('li' + (it.star ? '.lf-star' : ''), {}, h('div.lf-rank-row', {}, h('div', {}, h('b', {}, it.t), it.s ? h('span', {}, it.s) : null), it.star ? icon('star') : null)), i);
      }));
    },
    // proportional bars that grow into place
    bars: function (f) {
      var max = Math.max.apply(null, (f.items || []).map(function (it) { return it.n; }));
      return h('div.lf-bars', {}, f.items.map(function (it, i) {
        return item(h('div.lf-barrow', {}, h('span.lf-bar-t', {}, it.t),
          h('div.lf-bar-track', {}, h('div.lf-bar-fill' + (it.phase ? '.ph-' + it.phase : ''), { style: { width: Math.round(100 * it.n / max) + '%' } }, h('b', {}, String(it.n))))), i);
      }));
    },
    // conditions that must all be true (or, with tone bad, the exceptions); with a test, a tap fails a condition
    check: function (f) {
      var mark = f.tone === 'bad' ? 'alert' : 'check', out = null, rows = [];
      var list = h('ul.lf-check' + tone(f.tone), {}, (f.items || []).map(function (t, i) {
        if (!f.test) return item(h('li', {}, icon(mark), h('span', {}, t)), i);
        var b = h('button.lf-tog', { type: 'button', 'aria-pressed': 'true' }, icon('check'), h('span', {}, t));
        b.addEventListener('click', function () { var off = b.classList.toggle('lf-off'); b.setAttribute('aria-pressed', off ? 'false' : 'true'); b.replaceChild(icon(off ? 'x' : 'check'), b.firstChild); update(); });
        rows.push(b);
        return item(h('li', {}, b), i);
      }));
      function update() {
        var off = rows.filter(function (b) { return b.classList.contains('lf-off'); }).map(function (b) { return b.textContent; });
        out.className = 'lf-test-out ' + (off.length ? 'lf-bad' : 'lf-ok');
        out.replaceChildren(icon(off.length ? 'x' : 'check'), h('b', {}, off.length ? f.test.fail.replace('{x}', off.join(', ').toLowerCase()) : f.test.pass));
        pop(out);
      }
      if (!f.test) return list;
      out = h('div.lf-test-out.lf-ok', { 'aria-live': 'polite' }, icon('check'), h('b', {}, f.test.pass));
      return h('div', {}, list, out, hint(f.hint || 'Tap a test to see what happens when it fails.'));
    },
    // try it: pick a value (and any switches) and see which rule applies; rules are read in order and the first match wins
    calc: function (f) {
      var I = f.input || {}, lo = I.min || 1, hi = I.max || 1e9, st = { v: I.start || lo, t: {} };
      (f.toggles || []).forEach(function (t) { st.t[t.id] = !!t.on; });
      function toX(v) { return Math.round(1000 * Math.log(Math.min(hi, Math.max(lo, v)) / lo) / Math.log(hi / lo)); }
      function toV(x) { var v = lo * Math.pow(hi / lo, x / 1000), p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10) - 1); return Math.round(v / p) * p; }
      var range = h('input.lf-range', { type: 'range', min: '0', max: '1000', step: '1', 'aria-label': I.label || 'Value' });
      var box = h('input.lf-amount', { type: 'text', inputmode: 'decimal', 'aria-label': (I.label || 'Value') + ', in dollars' });
      var out = h('div.lf-calc-out', { 'aria-live': 'polite' });
      function rule() {
        return (f.rules || []).filter(function (r) {
          return (r.max == null || st.v <= r.max) && Object.keys(r.if || {}).every(function (k) { return !!st.t[k] === !!r.if[k]; });
        })[0];
      }
      function show(from) {
        if (from !== 'range') range.value = String(toX(st.v));
        if (from !== 'box') box.value = money(st.v);
        var r = rule(); if (!r) return;
        out.className = 'lf-calc-out lf-' + (r.tone || 'key');
        out.replaceChildren(ic(r.tone === 'ok' ? 'check' : r.icon || 'arrow-right'), h('div', {}, h('b', {}, r.t), r.s ? h('span', {}, r.s) : null));
        pop(out);
      }
      range.addEventListener('input', function () { st.v = toV(+range.value); show('range'); });
      box.addEventListener('change', function () {
        var s = String(box.value).toLowerCase().replace(/[$,\s]/g, ''), m = /^([\d.]+)([km]?)/.exec(s);
        if (m) { st.v = Math.max(0, parseFloat(m[1]) * (m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1)); show('box'); } else box.value = money(st.v);
      });
      var toggles = (f.toggles || []).map(function (t) {
        var b = h('button.lf-toggle', { type: 'button', 'aria-pressed': String(st.t[t.id]) }, icon('check'), t.t);
        b.addEventListener('click', function () { st.t[t.id] = !st.t[t.id]; b.setAttribute('aria-pressed', String(st.t[t.id])); show(); });
        return b;
      });
      show();
      return h('div.lf-calc', {},
        h('label.lf-calc-label', {}, I.label || 'Value'),
        h('div.lf-calc-row', {}, box, range),
        toggles.length ? h('div.lf-calc-row', {}, toggles) : null,
        out, hint(f.hint || 'Slide, or type an amount such as 2.4m or 80k.'));
    }
  };

  // ---- watch and listen: highlight each part in turn and read it aloud ----
  var player = null;
  function readText(el) { return String(el.innerText || el.textContent || '').replace(/\s*\n+\s*/g, '. ').replace(/\s+/g, ' ').trim(); }
  function setBtn(b, on) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.replaceChildren(icon(on ? 'stop' : 'play'), on ? 'Stop' : 'Play'); }
  function stopPlay() {
    if (!player) return;
    var p = player; player = null; clearTimeout(p.timer);
    if (CORB.speech && CORB.speech.available && p.spoke) CORB.speech.stop();
    p.fig.querySelectorAll('.lf-on').forEach(function (x) { x.classList.remove('lf-on'); });
    setBtn(p.btn, false);
  }
  function play(fig, btn) {
    var same = player && player.fig === fig; stopPlay(); if (same) return;
    var parts = [fig.querySelector('.lf-title')].concat([].slice.call(fig.querySelectorAll('.lf-item'))).filter(Boolean);
    fig.classList.add('lf-in');
    var me = player = { fig: fig, btn: btn, i: -1, timer: 0, spoke: false }; setBtn(btn, true);
    function next() {
      if (player !== me) return;
      if (!fig.isConnected) { stopPlay(); return; }
      if (me.i >= 0) parts[me.i].classList.remove('lf-on');
      if (++me.i >= parts.length) { stopPlay(); return; }
      var el = parts[me.i], text = readText(el), moved = false;
      el.classList.add('lf-on');
      try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
      function go() { if (!moved) { moved = true; clearTimeout(me.timer); me.timer = setTimeout(next, 350); } }
      if (CORB.speech && CORB.speech.available && text) {
        me.spoke = true;
        CORB.speech.speak(text, { onend: go });
        me.timer = setTimeout(go, 2500 + text.length * 90);   // keep going if the voice never reports the end
      } else me.timer = setTimeout(go, 1300 + text.length * 25);
    }
    next();
  }
  window.addEventListener('hashchange', stopPlay);

  // ---- build-up as the figure scrolls into view ----
  var io = null;
  function reduced() { return document.documentElement.getAttribute('data-motion') === 'reduce' || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function reveal(fig) {
    if (reduced()) return;
    fig.classList.add('lf-anim');
    if (!('IntersectionObserver' in window)) { fig.classList.add('lf-in'); return; }
    if (!io) io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('lf-in'); io.unobserve(e.target); } }); }, { threshold: 0.2 });
    io.observe(fig);
  }

  function figure(f) {
    var draw = DRAW[f.type];
    if (!draw) return null;
    var body = draw(f), fig, btn = null;
    if (f.type !== 'calc') {
      btn = h('button.lf-play', { type: 'button', 'aria-pressed': 'false', title: 'Show each part in turn and read it aloud' });
      setBtn(btn, false);
    }
    fig = h('figure.lf.lf-type-' + f.type, {},
      h('div.lf-head', {}, f.title ? h('figcaption.lf-title', {}, f.title) : h('span'), btn),
      body,
      f.note ? h('div.lf-note', {}, icon('info'), CORB.ui.rich(f.note)) : null);
    if (btn) btn.addEventListener('click', function () { play(fig, btn); });
    reveal(fig);
    return fig;
  }

  CORB.lessonFigTypes = Object.keys(DRAW);
  CORB.lessonFig = function (lesson) {
    h = CORB.ui.h; icon = CORB.ui.icon;
    var spec = (CORB.DATA.figs || {})[lesson.id];
    if (!spec) return null;
    var figs = (Array.isArray(spec) ? spec : [spec]).map(figure).filter(Boolean);
    if (!figs.length) return null;
    return h('section.lesson-figs.ph-' + lesson.phase, { 'aria-label': 'At a glance' },
      h('div.eyebrow', {}, icon('eye'), ' At a glance'), figs);
  };
})();
