/* VIEW: jeopardy — Board Jeopardy, the team review game a facilitator runs at the end of a study group.
   Moved here from the old Games page when its four drill games became the Arcade. arcade.js keeps the old
   #/games?g=jeopardy link working by sending it to this view.
   One screen: page head, team bar (1 to 4 teams, names edit in place, click a score to correct it), control bar,
   the 6 by 5 board with used cells dimmed, a clue overlay (reveal, then award or deduct), a wagered final clue,
   and a final result card.
   Data: CORB.DATA.games.jeopardy = { categories:[{ name, clues:[{ value, clue, response, accepted[], cite }] }],
         final:{ category, clue, response, accepted[], cite } }. Missing or misshapen data renders the empty
   state, and nothing here throws on partial data.
   Persists: the live board at progress.games.jeopardy.board, so a refresh does not lose a study-group game, and
   each finished game through CORB.scoring.recordGame('jeopardy', ...).
   Deviation: the clue overlay mounts in a small body-level layer that also carries the v-jeopardy class, so the
   scoped styles still reach it. Inside the view root, the root's entry animation would contain the fixed scrim
   instead of letting it cover the window. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, U = CORB.util;

  var MAX_TEAMS = 4;
  var timers = [];         // pending timeouts, cleared on leave
  var overlays = [];       // close functions of the open overlays, run on leave

  /* ------------------------------------------------------------------ util */
  function safe(fn, fb) { try { var v = fn(); return v === undefined || v === null ? fb : v; } catch (e) { return fb; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var n = parseFloat(str(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : null;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function after(ms, fn) { var t = setTimeout(function () { try { fn(); } catch (e) { /* a late timer must never break the page */ } }, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(function (t) { clearTimeout(t); }); timers = []; }
  function closeOverlays() { overlays.slice().forEach(function (c) { try { c(); } catch (e) {} }); overlays = []; }
  function goIfPresent(view, params) {
    if (CORB.views && CORB.views[view]) CORB.go(view, params || {});
    else ui.toast('That section is not in this build yet', 'warn');
  }
  function storageBlocked() { return !!safe(function () { return CORB.store.available === false; }, false); }

  /* ------------------------------------------------------------------ data */
  function boardData() {
    var j = safe(function () { var g = CORB.DATA.games; return g && typeof g === 'object' && !Array.isArray(g) ? g.jeopardy : null; }, null);
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
    var cats = arr(j.categories).filter(function (c) { return c && typeof c === 'object' && str(c.name); }).map(function (c) {
      return { name: str(c.name), clues: arr(c.clues).filter(function (q) { return q && typeof q === 'object' && (str(q.clue) || str(q.response)); }).slice(0, 5) };
    }).filter(function (c) { return c.clues.length; }).slice(0, 6);
    if (!cats.length) return null;
    var f = j.final;
    var fin = f && typeof f === 'object' && !Array.isArray(f) && (str(f.clue) || str(f.response)) ? f : null;
    return { categories: cats, final: fin };
  }
  function boardSig(d) { return d.categories.map(function (c) { return c.name + ':' + c.clues.length; }).join('|'); }
  function clueValue(clue, row) { var v = num(clue && clue.value); return v !== null && v > 0 ? v : (row + 1) * 200; }
  function totalPoints(d) {
    var t = 0;
    d.categories.forEach(function (c) { c.clues.forEach(function (q, r) { t += clueValue(q, r); }); });
    return t;
  }

  /* ----------------------------------------------------------- persistence */
  function newBoard(d, n) {
    var teams = [], count = U.clamp(num(n) || 3, 1, MAX_TEAMS);
    for (var i = 0; i < count; i++) teams.push({ name: 'Team ' + (i + 1), score: 0 });
    return { sig: boardSig(d), teams: teams, used: {}, final: null, recorded: false, startedAt: new Date().toISOString() };
  }
  function loadBoard(d) {
    var saved = safe(function () { return CORB.get('progress.games.jeopardy.board', null); }, null);
    if (saved && typeof saved === 'object' && !Array.isArray(saved) && saved.sig === boardSig(d) && arr(saved.teams).length) {
      saved.teams = arr(saved.teams).slice(0, MAX_TEAMS).map(function (t, i) {
        return { name: str(t && t.name) || 'Team ' + (i + 1), score: num(t && t.score) || 0 };
      });
      if (!saved.used || typeof saved.used !== 'object' || Array.isArray(saved.used)) saved.used = {};
      return saved;
    }
    return newBoard(d, saved && arr(saved.teams).length ? arr(saved.teams).length : 3);
  }
  function saveBoard(st) { safe(function () { return CORB.set('progress.games.jeopardy.board', st); }, null); }

  // recordGame does plays++ on whatever object sits at progress.games.jeopardy, and the live board is stored
  // there too, so make sure the counters exist before handing it over.
  function recordResult(rec) {
    safe(function () {
      var g = CORB.get('progress.games.jeopardy', null);
      if (g && typeof g === 'object' && !Array.isArray(g)) {
        if (typeof g.plays !== 'number' || !isFinite(g.plays)) g.plays = 0;
        if (typeof g.best !== 'number' || !isFinite(g.best)) g.best = 0;
        if (!Array.isArray(g.history)) g.history = [];
      }
      return CORB.scoring && CORB.scoring.recordGame ? CORB.scoring.recordGame('jeopardy', rec) : null;
    }, null);
  }

  /* -------------------------------------------------------- shared fragments */
  function citeRow(cite) {
    var list = Array.isArray(cite) ? cite : (str(cite) ? [cite] : []);
    list = list.map(str).filter(Boolean);
    if (!list.length) return null;
    return h('div.jp-cites', {}, h('span.jp-cites-label', {}, 'Cite'), list.map(function (c) {
      var url = safe(function () { return CORB.data && CORB.data.citeUrl ? CORB.data.citeUrl(c) : null; }, null);
      return url ? h('a.cite', { href: url, target: '_blank', rel: 'noopener' }, c) : h('span.cite', {}, c);
    }));
  }
  function responseBlock(item) {
    var accepted = arr(item.accepted).map(str).filter(Boolean);
    return h('div.jp-clue-answer', {},
      h('div.eyebrow', {}, 'Response'),
      h('p.jp-clue-response', {}, str(item.response) || '—'),
      accepted.length ? h('div.jp-accepted', {}, h('span.jp-accepted-label', {}, 'Also accept'), accepted.map(function (a) { return h('span.chip', {}, a); })) : null,
      citeRow(item.cite || item.citations));
  }
  function projectorBtn(cls) {
    return h('button.btn' + (cls || ''), { type: 'button', onclick: function () { CORB.go('projector'); } }, icon('monitor'), 'Study group projector');
  }

  function pageHead() {
    return h('header.page-head.jp-head', {},
      h('div.jp-head-copy', {},
        h('div.eyebrow', {}, 'Board room'),
        h('h1', {}, 'Board Jeopardy'),
        h('p.lede', {}, 'Close out a study group with a team review: put the board on the screen, read each clue aloud and award the points.')),
      h('div.jp-head-actions', {}, projectorBtn()));
  }

  function emptyState(title, what) {
    return h('div.empty.jp-empty', {},
      h('div.jp-empty-icon', {}, icon('grid')),
      h('h3', {}, title),
      h('p', {}, what),
      h('div.row.jp-empty-actions', {},
        projectorBtn('.primary'),
        h('button.btn', { type: 'button', onclick: function () { goIfPresent('library'); } }, icon('book'), 'Question library')));
  }

  /* ---------------------------------------------------------------- overlay */
  function overlay(opts) {
    var body = h('div.jp-modal-body');
    var box = h('div.jp-modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': str(opts && opts.label) || 'Clue' },
      h('button.jp-modal-x', { type: 'button', 'aria-label': 'Close', onclick: function () { close(); } }, icon('x')),
      body);
    var scrim = h('div.jp-scrim', { onclick: function (e) { if (e.target === scrim) close(); } }, box);
    var layer = h('div.v-jeopardy.jp-layer', {}, scrim);
    var prev = document.activeElement;
    document.body.appendChild(layer);
    document.addEventListener('keydown', esc, true);
    overlays.push(close);
    // focus the first control in the content (Reveal, or the first wager), not the close button
    after(30, function () { var f = body.querySelector('button, input') || box.querySelector('button'); if (f) f.focus(); });

    function esc(e) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    }
    function close() {
      document.removeEventListener('keydown', esc, true);
      var i = overlays.indexOf(close); if (i >= 0) overlays.splice(i, 1);
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      if (prev && prev.focus && document.contains(prev)) safe(function () { prev.focus(); return 1; }, null);
    }
    return { body: body, close: close };
  }

  /* ------------------------------------------------------------------ board */
  function playBoard(root, d) {
    var st = loadBoard(d);
    var host = h('div.jp-game');
    root.appendChild(host);
    var saveName = U.debounce(function () { saveBoard(st); }, 400);
    paint();

    function cellKey(ci, ri) { return 'c' + ci + 'r' + ri; }
    function remaining() {
      var n = 0;
      d.categories.forEach(function (c, ci) { c.clues.forEach(function (q, ri) { if (!st.used[cellKey(ci, ri)]) n++; }); });
      return n;
    }
    function leader() {
      var top = null;
      st.teams.forEach(function (t) { if (!top || (num(t.score) || 0) > (num(top.score) || 0)) top = t; });
      return top;
    }

    function paint() {
      ui.mount(host, [teamBar(), controls(), board(), st.final && st.final.done ? finalResult() : null, legend()]);
    }

    /* --- teams --- */
    function teamBar() {
      return h('div.jp-teams', {}, st.teams.map(function (t, i) {
        return h('div', { class: 'jp-team t' + (i % 4) },
          h('input.jp-team-name', {
            value: str(t.name), 'aria-label': 'Name of team ' + (i + 1), maxlength: '24',
            oninput: function (e) { t.name = e.target.value; saveName(); }
          }),
          h('button.jp-team-score.num', {
            type: 'button', 'aria-label': 'Adjust the score for ' + str(t.name),
            onclick: function () { editScore(t); }
          }, str(num(t.score) || 0)));
      }));
    }
    function editScore(t) {
      safe(function () {
        return ui.prompt({ title: 'Set score', label: str(t.name) + ' score', value: str(num(t.score) || 0), hint: 'Use this to fix a mis-click. Negative numbers are allowed.' })
          .then(function (v) {
            if (v === null) return;
            var n = num(v);
            if (n === null) { ui.toast('That is not a number', 'warn'); return; }
            t.score = Math.round(n); saveBoard(st); paint();
          });
      }, null);
    }

    /* --- controls --- */
    function controls() {
      var seg = h('div.seg.jp-teamcount', { role: 'group', 'aria-label': 'Number of teams' }, [1, 2, 3, 4].map(function (n) {
        return h('button', {
          class: st.teams.length === n ? 'on' : '', type: 'button', 'aria-pressed': st.teams.length === n ? 'true' : 'false',
          onclick: function () { setTeams(n); }
        }, str(n));
      }));
      var left = remaining();
      var finalDone = !!(st.final && st.final.done);
      return h('div.jp-bar', {},
        h('div.jp-bar-group', {}, h('span.jp-label', {}, 'Teams'), seg),
        h('div.grow'),
        h('span.badge.neutral', {}, icon('grid'), left ? plural(left, 'clue') + ' left' : 'Board cleared'),
        d.final ? h('button', {
          class: 'btn sm' + (!left && !finalDone ? ' gold' : ''), type: 'button',
          disabled: finalDone, onclick: openFinal
        }, icon('star'), finalDone ? 'Final played' : 'Final clue') : null,
        h('button.btn.sm', { type: 'button', onclick: finish }, icon('trophy'), 'Finish & record'),
        h('button.btn.sm.ghost', { type: 'button', onclick: reset }, icon('refresh'), 'New board'));
    }
    function setTeams(n) {
      n = U.clamp(n, 1, MAX_TEAMS);
      while (st.teams.length < n) st.teams.push({ name: 'Team ' + (st.teams.length + 1), score: 0 });
      if (st.teams.length > n) st.teams = st.teams.slice(0, n);
      saveBoard(st); paint();
    }
    function reset() {
      safe(function () {
        return ui.confirm('Clear the board and set every score back to zero?', { ok: 'New board', danger: true, title: 'Start a new game' }).then(function (yes) {
          if (!yes) return;
          st = newBoard(d, st.teams.length);
          saveBoard(st); paint();
          ui.toast('New board', 'ok');
        });
      }, null);
    }
    function finish() {
      var top = leader();
      recordResult({ score: Math.max(0, num(top && top.score) || 0), total: totalPoints(d), teams: st.teams.length, winner: str(top && top.name) });
      st.recorded = true;
      saveBoard(st);
      ui.toast(top ? str(top.name) + ' leads with ' + (num(top.score) || 0) : 'Game recorded', 'ok');
      paint();
    }

    /* --- the board --- */
    function board() {
      var cols = d.categories.length;
      var maxRows = d.categories.reduce(function (m, c) { return Math.max(m, c.clues.length); }, 0);
      var grid = h('div', { class: 'jp-board', style: '--cols:' + cols });
      d.categories.forEach(function (c) { grid.appendChild(h('div.jp-cat', {}, h('span', {}, c.name))); });
      for (var r = 0; r < maxRows; r++) {
        (function (ri) {
          d.categories.forEach(function (c, ci) {
            var clue = c.clues[ri];
            if (!clue) { grid.appendChild(h('div.jp-cell.is-blank', { 'aria-hidden': 'true' })); return; }
            var val = clueValue(clue, ri), key = cellKey(ci, ri), used = !!st.used[key];
            grid.appendChild(h('button', {
              class: 'jp-cell' + (used ? ' is-used' : ''), type: 'button',
              'aria-label': c.name + ', ' + val + ' points' + (used ? ', already played' : ''),
              onclick: function () { openClue(c, clue, key, val); }
            }, h('span.num', {}, str(val))));
          });
        })(r);
      }
      return grid;
    }

    /* --- clue overlay --- */
    function openClue(cat, clue, key, val) {
      var ov = overlay({ label: cat.name + ' for ' + val });
      var revealed = false, mode = 'award';
      draw();
      function draw() {
        ui.mount(ov.body, [
          h('div.jp-clue-head', {}, h('span.jp-clue-cat', {}, cat.name), h('span.jp-clue-val.num', {}, str(val))),
          h('p.jp-clue-text', {}, str(clue.clue) || 'No clue text in this copy.'),
          revealed ? responseBlock(clue) : null,
          !revealed
            ? h('div.jp-clue-foot', {}, h('button.btn.primary.lg', { type: 'button', onclick: function () { revealed = true; draw(); } }, icon('eye'), 'Reveal the response'))
            : h('div.jp-award', {},
              h('div.jp-award-head', {},
                h('span.jp-label', {}, 'Award'),
                h('div.seg.jp-award-mode', { role: 'group', 'aria-label': 'Award or deduct' },
                  h('button', { class: mode === 'award' ? 'on' : '', type: 'button', 'aria-pressed': mode === 'award' ? 'true' : 'false', onclick: function () { mode = 'award'; draw(); } }, '+' + val),
                  h('button', { class: mode === 'deduct' ? 'on' : '', type: 'button', 'aria-pressed': mode === 'deduct' ? 'true' : 'false', onclick: function () { mode = 'deduct'; draw(); } }, '−' + val))),
              h('div.jp-award-teams', {}, st.teams.map(function (t, i) {
                return h('button', { class: 'jp-award-btn t' + (i % 4), type: 'button', onclick: function () { award(t, mode === 'deduct' ? -val : val); } },
                  h('span.jp-award-name', {}, str(t.name)), h('span.jp-award-delta.num', {}, (mode === 'deduct' ? '−' : '+') + val));
              })),
              h('button.btn.ghost.jp-award-none', { type: 'button', onclick: function () { award(null, 0); } }, icon('x'), 'No one — close it out'))
        ]);
      }
      function award(team, delta) {
        if (team) team.score = (num(team.score) || 0) + delta;
        st.used[key] = true;
        saveBoard(st);
        ov.close();
        paint();
        if (team) ui.toast(str(team.name) + ' ' + (delta < 0 ? '−' : '+') + Math.abs(delta), delta < 0 ? 'warn' : 'ok', 1600);
      }
    }

    /* --- final clue --- */
    function openFinal() {
      if (!d.final) return;
      var f = d.final;
      var ov = overlay({ label: 'Final clue' });
      var step = 'wager';
      var wagers = st.teams.map(function (t) { return U.clamp(Math.round((num(t.score) || 0) / 2), 0, Math.max(0, num(t.score) || 0)) || 0; });
      var results = st.teams.map(function () { return null; });
      draw();

      function maxWager(t) { return Math.max(num(t.score) || 0, 1000); }
      function draw() {
        var nodes = [h('div.jp-clue-head', {}, h('span.jp-clue-cat', {}, str(f.category) || 'Final clue'), h('span.jp-clue-val', {}, 'Wager round'))];
        if (step === 'wager') {
          nodes.push(h('p.jp-final-intro', {}, 'Each team writes a wager before the clue is read. A team can risk up to its own score, or up to 1,000 if its score is lower than that.'));
          nodes.push(h('div.jp-wagers', {}, st.teams.map(function (t, i) {
            return h('label', { class: 'jp-wager t' + (i % 4) },
              h('span.jp-wager-name', {}, str(t.name)),
              h('span.jp-wager-score.num', {}, 'score ' + (num(t.score) || 0)),
              h('input.input.num', {
                type: 'number', min: '0', max: str(maxWager(t)), step: '50', value: str(wagers[i]),
                'aria-label': 'Wager for ' + str(t.name),
                oninput: function (e) { wagers[i] = U.clamp(Math.round(num(e.target.value) || 0), 0, maxWager(t)); },
                onchange: function (e) { e.target.value = str(wagers[i]); }
              }));
          })));
          nodes.push(h('div.jp-clue-foot', {}, h('button.btn.primary.lg', { type: 'button', onclick: function () { step = 'clue'; draw(); } }, icon('arrow-right'), 'Wagers are in — read the clue')));
        } else if (step === 'clue') {
          nodes.push(h('p.jp-clue-text.is-final', {}, str(f.clue) || 'No final clue text in this copy.'));
          nodes.push(h('div.jp-clue-foot', {}, h('button.btn.primary.lg', { type: 'button', onclick: function () { step = 'score'; draw(); } }, icon('eye'), 'Reveal the response')));
        } else {
          nodes.push(responseBlock(f));
          nodes.push(h('div.jp-final-grade', {}, st.teams.map(function (t, i) {
            return h('div', { class: 'jp-grade-row t' + (i % 4) },
              h('span.jp-grade-name', {}, str(t.name)),
              h('span.jp-grade-wager.num', {}, 'wagered ' + wagers[i]),
              h('div.seg', { role: 'group', 'aria-label': 'Result for ' + str(t.name) },
                h('button', { class: results[i] === true ? 'on' : '', type: 'button', 'aria-pressed': results[i] === true ? 'true' : 'false', onclick: function () { results[i] = true; draw(); } }, 'Right'),
                h('button', { class: results[i] === false ? 'on' : '', type: 'button', 'aria-pressed': results[i] === false ? 'true' : 'false', onclick: function () { results[i] = false; draw(); } }, 'Wrong')));
          })));
          nodes.push(h('div.jp-clue-foot', {},
            h('button.btn.primary.lg', { type: 'button', onclick: apply }, icon('check'), 'Apply the wagers')));
        }
        ui.mount(ov.body, nodes);
      }
      function apply() {
        st.teams.forEach(function (t, i) {
          if (results[i] === true) t.score = (num(t.score) || 0) + wagers[i];
          else if (results[i] === false) t.score = (num(t.score) || 0) - wagers[i];
        });
        st.final = {
          done: true,
          rows: st.teams.map(function (t, i) { return { name: str(t.name), wager: wagers[i], ok: results[i], score: num(t.score) || 0 }; })
        };
        saveBoard(st);
        ov.close();
        finish();
      }
    }

    function finalResult() {
      var rows = arr(st.final && st.final.rows);
      var top = leader();
      return h('section.jp-final-card', {},
        h('div.jp-final-head', {}, icon('trophy'), h('div', {}, h('div.eyebrow', {}, 'Final result'), h('h2', {}, top ? str(top.name) + ' · ' + (num(top.score) || 0) : 'Game over'))),
        rows.length ? h('div.jp-final-rows', {}, rows.map(function (r, i) {
          var ok = r && r.ok;
          return h('div', { class: 'jp-final-row t' + (i % 4) + (ok === true ? ' is-ok' : ok === false ? ' is-no' : '') },
            h('span.jp-final-name', {}, str(r && r.name)),
            h('span.jp-final-wager.num', {}, (ok === true ? '+' : ok === false ? '−' : '±') + (num(r && r.wager) || 0)),
            h('span.jp-final-score.num', {}, str(num(r && r.score) || 0)));
        })) : null,
        h('div.row.jp-final-actions', {},
          h('button.btn.primary', { type: 'button', onclick: reset }, icon('refresh'), 'New board'),
          projectorBtn()));
    }

    function legend() {
      return h('div.jp-foot', {}, icon('info'),
        h('div', {}, h('b', {}, 'How to run it. '),
          h('span', {}, 'Pick a value, read the clue aloud, take the first team that answers, then reveal and award. Deduct with the − control when a team answers wrong. Turn on projector mode from the top bar to size the board for the room. ' +
            (storageBlocked()
              ? 'This browser is blocking storage, so a refresh starts a new board.'
              : 'The board, the team names and the scores are kept on this device, so a refresh or a closed lid does not lose the game.'))));
    }
  }

  /* ----------------------------------------------------------------- view */
  function render(root) {
    clearTimers();
    closeOverlays();
    root.appendChild(pageHead());
    var d = boardData();
    if (!d) {
      root.appendChild(emptyState('Board Jeopardy is not in this copy yet', 'Board Jeopardy needs categories of clues with their responses. Add them to the games data module and the board turns on: six categories, five clues each, plus a wagered final.'));
      return;
    }
    try { playBoard(root, d); }
    catch (e) {
      if (window.console && console.error) console.error('[CORB] jeopardy', e);
      closeOverlays();
      ui.mount(root, [pageHead(), emptyState('Board Jeopardy could not start', 'The board could not start with the data in this copy. Every other part of the app still works.')]);
    }
  }
  function onLeave() {
    clearTimers();
    closeOverlays();
  }

  CORB.registerView({
    id: 'jeopardy', title: 'Board Jeopardy', icon: 'grid', section: 'Board room', order: 225, nav: true,
    roles: ['board', 'facilitator'], wide: true,
    render: render, onLeave: onLeave
  });
})();
