/* VIEW learn — the lesson list, grouped by exam area. VIEW lesson — one lesson with read-aloud, example, memory aid and checks */
(function () {
  'use strict';
  var CORB = window.CORB;

  CORB.registerView({ id: 'learn', title: 'Lessons', section: 'Learn', icon: 'book', nav: true, order: 50, mobile: true, short: 'Learn',
    blurb: 'Short plain-English lessons by exam area', keywords: 'study lesson guiding principles pre-award award post-award',
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon, U = CORB.util;
      var phase = ctx.params.phase || 'all', st = CORB.scoring.lessonStats();
      root.appendChild(CORB.ui.pageHead({ title: 'Lessons', lede: 'Short lessons in plain English, in the same four areas as the exam. Each takes about ten minutes, has a real-world example, and ends with a few questions to check yourself.' }));
      root.appendChild(h('div.card.learn-top', {}, h('div.row.between', {}, h('b', {}, st.done + ' of ' + st.total + ' lessons done'), CORB.data.nextLesson() ? h('a.btn.primary.sm', { href: '#/lesson?id=' + CORB.data.nextLesson().id }, icon('play'), st.done ? 'Continue' : 'Start the first lesson') : null), CORB.ui.bar(U.pct(st.done, st.total))));
      var phases = CORB.data.phases().concat([CORB.data.phase('job')]);
      root.appendChild(h('div.chips.mt-4.mb-2', {}, [h('button.chip' + (phase === 'all' ? '.on' : ''), { type: 'button', onclick: function () { CORB.go('learn'); } }, 'All')].concat(phases.map(function (p) {
        var n = CORB.data.lessonsIn(p.id).length; if (!n) return null;
        return h('button.chip' + (phase === p.id ? '.on' : ''), { type: 'button', onclick: function () { CORB.go('learn', { phase: p.id }); } }, h('span.phase-dot.ph-' + p.id), p.short, h('span.count', {}, String(n)));
      }))));
      var num = 0;
      phases.forEach(function (p) {
        var ls = CORB.data.lessonsIn(p.id); if (!ls.length) return;
        var first = num; num += ls.length;
        if (phase !== 'all' && phase !== p.id) return;
        var dn = ls.filter(function (l) { return CORB.data.lessonDone(l.id); }).length;
        root.appendChild(h('section.lesson-group.ph-' + p.id, {},
          h('div.section-head', {}, h('h2', {}, h('span.phase-dot.ph-' + p.id), ' ', (p.code ? p.code + ' ' : '') + p.name), h('span.muted', {}, (p.qs ? p.qs + ' of 150 exam questions · ' : '') + dn + ' of ' + ls.length + ' done')),
          p.plain ? h('p.muted.small.group-plain', {}, p.plain) : null,
          h('div.grid.auto', {}, ls.map(function (l, i) {
            var done = CORB.data.lessonDone(l.id);
            return h('a.card.lift.lesson-tile' + (done ? '.done' : ''), { href: '#/lesson?id=' + l.id },
              h('div.row.between', {}, h('span.l-num.num', {}, String(first + i + 1).padStart(2, '0')), done ? CORB.ui.badge('ok', 'Done', 'check') : h('span.tiny.muted', {}, '~' + (l.minutes || 8) + ' min')),
              h('b.l-title', {}, l.title), h('span.small.muted.clamp-2', {}, l.summary),
              l.comp ? h('span.tiny.l-comp', {}, l.comp + ' ' + (l.compName || '')) : null);
          }))));
      });
    } });

  function check(lesson, h, icon) {
    var qs = CORB.data.questionsFor(lesson.id); if (!qs.length) return null;
    var right = 0, answered = 0;
    var wrap = h('section.lesson-check', {}, h('div.section-head', {}, h('h2', {}, icon('quiz'), ' Check yourself'), h('span.muted', {}, qs.length + ' questions')));
    var result = h('div.check-result', { hidden: true });
    qs.forEach(function (q, qi) {
      var opts = CORB.util.shuffle(q.options), box = h('div.card.qbox');
      var fb = h('div.q-feedback', { hidden: true });
      box.appendChild(h('div.q-stem', {}, h('span.q-n.num', {}, (qi + 1) + '.'), h('span', {}, q.stem)));
      var btns = opts.map(function (o, oi) {
        var b = h('button.opt', { type: 'button' }, h('span.opt-l', {}, 'ABCD'[oi]), h('span', {}, o.text));
        b.addEventListener('click', function () {
          if (box.classList.contains('answered')) return;
          box.classList.add('answered'); answered++; if (o.correct) right++;
          CORB.scoring.recordAnswer(q.id, !!o.correct);
          btns.forEach(function (x, xi) { x.disabled = true; if (opts[xi].correct) x.classList.add('right'); });
          if (!o.correct) b.classList.add('wrong');
          fb.hidden = false;
          fb.appendChild(CORB.ui.callout(o.correct ? 'ok' : 'warn', o.correct ? 'check' : 'info', o.correct ? 'Right.' : 'Not quite.', CORB.ui.rich((o.correct ? '' : (o.why ? o.why + '\n\n' : '')) + (opts.filter(function (x) { return x.correct; })[0].why || '') + (q.cite ? '\n\nWhere it is written: ' + q.cite : ''))));
          if (answered === qs.length) {
            CORB.set('progress.checks.' + lesson.id, { right: right, total: qs.length, date: CORB.util.today() });
            result.hidden = false; result.innerHTML = '';
            result.appendChild(CORB.ui.callout(right === qs.length ? 'ok' : 'info', right === qs.length ? 'trophy' : 'info', right + ' of ' + qs.length + ' right', right === qs.length ? 'You have this one. Mark the lesson done and move on.' : 'Read the explanations above, then mark the lesson done when it makes sense. Missed questions come back in Practice test → Missed questions.'));
          }
        });
        return b;
      });
      box.appendChild(h('div.opts', {}, btns)); box.appendChild(fb);
      wrap.appendChild(box);
    });
    wrap.appendChild(result);
    return wrap;
  }

  CORB.registerView({ id: 'lesson', title: 'Lesson', navAs: 'learn', nav: false,
    topTitle: function (p) { var l = CORB.data.lesson(p.id); return l ? l.title : 'Lesson'; },
    render: function (root, ctx) {
      var h = CORB.ui.h, icon = CORB.ui.icon;
      var l = CORB.data.lesson(ctx.params.id);
      if (!l) { root.appendChild(h('div.empty', {}, h('h3', {}, 'Lesson not found'), h('a.btn.mt-3', { href: '#/learn' }, 'All lessons'))); return; }
      var all = CORB.data.lessons(), i = all.indexOf(l), prev = all[i - 1], next = all[i + 1];
      var p = CORB.data.phase(l.phase), done = CORB.data.lessonDone(l.id);
      CORB.touch(l.id);
      // headings, paragraphs and bullets are kept: the reader gives each its own tone and pause
      function fullText() { return [l.title, l.summary, l.why].concat((l.sections || []).map(function (s) { return '## ' + s.h + '\n' + s.body; })).concat(l.example ? ['## ' + l.example.title + '\n' + l.example.body] : []).concat((l.remember || []).length ? ['## Remember\n' + l.remember.map(function (r) { return '- ' + r; }).join('\n')] : []).filter(Boolean).join('\n\n'); }
      var doneBtn = h('button.btn.sm' + (done ? '.on' : ''), { type: 'button', onclick: function () { CORB.scoring.setLessonDone(l.id, !CORB.data.lessonDone(l.id)); CORB.ui.toast(CORB.data.lessonDone(l.id) ? 'Lesson marked done' : 'Marked not done', 'ok'); CORB.render(); } }, icon('check'), done ? 'Done' : 'Mark done');
      root.appendChild(h('header.page-head.lesson-head', {},
        h('a.back-link', { href: '#/learn' + (l.phase ? '?phase=' + l.phase : '') }, icon('arrow-left'), 'All lessons'),
        h('div.row.tight.mt-2', {}, CORB.ui.phaseBadge(l.phase), l.comp ? CORB.ui.badge('neutral', l.comp + ' ' + (l.compName || '')) : null, h('span.tiny.muted', {}, 'Lesson ' + (i + 1) + ' of ' + all.length + ' · about ' + (l.minutes || 8) + ' minutes')),
        h('h1', {}, l.title),
        h('div.row.tight.mt-3.no-print', {}, CORB.ui.listenBtn(fullText, 'Listen to the lesson'), doneBtn, CORB.can('print') ? h('button.btn.sm.ghost', { type: 'button', onclick: function () { window.print(); } }, icon('print'), 'Print') : null)));
      root.appendChild(h('div.plain-box', {}, h('div.eyebrow', {}, 'In plain English'), CORB.ui.rich(l.summary)));
      var fig = CORB.lessonFig(l); if (fig) root.appendChild(fig);
      if (l.why) root.appendChild(h('div.why', {}, h('h2', {}, 'Why it matters'), CORB.ui.rich(l.why)));
      (l.sections || []).forEach(function (s) { root.appendChild(h('section.l-sec', {}, h('h2', {}, s.h), CORB.ui.rich(s.body))); });
      if (l.example) root.appendChild(h('section.card.example', {}, h('div.eyebrow', {}, 'Picture this'), h('h3', {}, l.example.title), CORB.ui.rich(l.example.body)));
      if ((l.remember || []).length) root.appendChild(h('section.card.remember', {}, h('div.row.tight', {}, icon('bulb'), h('h3', {}, 'Remember it')), h('ul.tips', {}, l.remember.map(function (t) { return h('li', {}, CORB.ui.rich(t)); }))));
      if ((l.mistakes || []).length) root.appendChild(h('section.card.mistakes', {}, h('div.row.tight', {}, icon('alert'), h('h3', {}, 'Common mistakes')), h('ul.tips', {}, l.mistakes.map(function (t) { return h('li', {}, CORB.ui.rich(t)); }))));
      var foot = h('div.grid.cols-2.l-refs', {});
      if ((l.cites || []).length) foot.appendChild(h('div.card.tight', {}, h('h4', {}, 'Where it is written'), h('div.row.tight.mt-2', {}, l.cites.map(function (c) { var u = CORB.data.citeUrl(c); return u ? h('a.cite', { href: u, target: '_blank', rel: 'noopener' }, c) : h('span.cite', {}, c); })), h('p.tiny.muted.mt-2', {}, 'FAR citations use the FAR Overhaul (RFO) numbers in force for DoW since 1 February 2026.')));
      if ((l.terms || []).length) foot.appendChild(h('div.card.tight', {}, h('h4', {}, 'Key terms'), h('div.row.tight.mt-2', {}, l.terms.map(function (t) { var g = CORB.data.term(t); return h('button.chip', { type: 'button', onclick: function (e) { if (g) CORB.ui.showTerm(g.term, e.currentTarget); else CORB.go('glossary', { q: t }); } }, t); }))));
      if (foot.childNodes.length) root.appendChild(foot);
      if (l.verify) root.appendChild(h('div.mt-4', {}, CORB.ui.callout('info', 'flag', 'Verify locally', l.verify)));
      var ck = check(l, h, icon); if (ck) root.appendChild(ck);
      root.appendChild(h('nav.lesson-nav.no-print', { 'aria-label': 'Lesson navigation' },
        prev ? h('a.card.lift', { href: '#/lesson?id=' + prev.id }, h('span.tiny.muted', {}, '← Previous'), h('b', {}, prev.title)) : h('span'),
        h('button.btn' + (done ? '' : '.primary'), { type: 'button', onclick: function () { CORB.scoring.setLessonDone(l.id, true); CORB.ui.toast('Lesson done', 'ok'); if (next) CORB.go('lesson', { id: next.id }); else CORB.go('learn'); } }, icon('check'), next ? 'Done, next lesson' : 'Done'),
        next ? h('a.card.lift.next', { href: '#/lesson?id=' + next.id }, h('span.tiny.muted', {}, 'Next →'), h('b', {}, next.title)) : h('span')));
    } });
})();
