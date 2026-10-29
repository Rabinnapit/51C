/* VIEW: editor — facilitator content editor for the question bank.
   Layout: page head + command bar (edit counts, unsaved indicator, export/import overrides,
   CSV import, and the headline "Save a new copy of the app"), a content status panel
   (answer status + per-organization counts), then a two-pane workbench: a searchable,
   filterable list of every question on the left with override / new / removed indicators,
   and the edit form for the selected question on the right.
   Writes: overrides.questions[id] (changed fields only), overrides.added[] (ids L0001…),
   overrides.removed[id] — all through CORB.set, so the app works with storage disabled.
   Never throws on missing or partly shaped data; renders honest empty states instead. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon, util = CORB.util;

  var PAGE = 60;
  var STATUSES = [['official', 'Official'], ['ai-draft', 'AI draft'], ['open', 'Open · no answer yet']];
  var KINDS = [['knowledge', 'Knowledge'], ['scenario', 'Scenario'], ['leadership', 'Leadership']];
  var FLAGS = [
    ['verify-locally', 'Verify locally'],
    ['ai-drafted', 'AI drafted'],
    ['korea-verify-cp', 'Korea · confirm with C&P']
  ];
  var VIEWS = [['all', 'All'], ['edited', 'Edited'], ['added', 'New'], ['removed', 'Removed']];
  var FIELDS = ['question', 'answer', 'answer_status', 'topic', 'domain', 'classes', 'unit', 'kind', 'tags', 'citations', 'flags', 'key_points'];
  var CSV_COLS = [
    ['question', ['question', 'q', 'prompt', 'questiontext']],
    ['answer', ['answer', 'a', 'response', 'answertext']],
    ['topic', ['topic', 'subtopic', 'subject']],
    ['domain', ['domain', 'area', 'category']],
    ['classes', ['classes', 'class', 'warrantclass']],
    ['unit', ['unit', 'organization', 'org', 'sco']],
    ['tags', ['tags', 'tag', 'keywords']]
  ];
  var OFF_TRACK = 'grants-or-agreements';   // a CSV class for Grants or Agreements officers; Korea has neither, so the row is skipped

  var S = null;   // { q, view, shown, selected, formDirty }
  var R = null;   // live DOM references
  var F = null;   // live form field references
  var last = null;
  var unsub = [];
  var timer = null;

  // ------------------------------------------------------------- helpers
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function str(v) { return v == null ? '' : String(v); }
  function sameList(a, b) { return JSON.stringify(arr(a)) === JSON.stringify(arr(b)); }
  function splitList(v) { return str(v).split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function lines(v) { return str(v).replace(/\r/g, '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function domains() { var d = safe(function () { return CORB.data.DOMAINS; }, null); return arr(d).length ? d : ['General Contracting']; }
  function classes() { var c = safe(function () { return CORB.data.CLASSES; }, null); return arr(c).length ? c : ['I', 'II', 'III', 'IV']; }
  function units() {
    var u = arr(safe(function () { return CORB.DATA.units; }, [])).filter(function (x) { return x && x.id && x.id !== 'all'; });
    return u.length ? u : [{ id: 'ACC-All', name: 'Army Contracting Command (all)', short: 'ACC-All' }];
  }
  function unitLabel(id) {
    var m = units().filter(function (u) { return u.id === id; })[0];
    return m ? (m.short || m.name || m.id) : (id || '—');
  }
  function defaultUnit() {
    var u = safe(function () { return CORB.unit(); }, '') || '';
    if (u && u !== 'all' && units().some(function (x) { return x.id === u; })) return u;
    return units().some(function (x) { return x.id === 'ACC-All'; }) ? 'ACC-All' : units()[0].id;
  }
  function overrides() { return obj(CORB.get('overrides.questions', {})); }
  function added() { return arr(CORB.get('overrides.added', [])).filter(function (q) { return q && q.id; }); }
  function removed() { return obj(CORB.get('overrides.removed', {})); }
  function baseBank() { return arr(safe(function () { return CORB.DATA.questions; }, [])); }
  function truncate(s, n) { s = str(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  // A record wraps one editable question: its baseline, its effective value, and its state.
  function records() {
    var ov = overrides(), rm = removed(), out = [];
    baseBank().forEach(function (q) {
      if (!q || !q.id) return;
      var patch = obj(ov[q.id]);
      out.push({ id: q.id, origin: 'base', base: q, eff: Object.keys(patch).length ? Object.assign({}, q, patch) : q, edited: Object.keys(patch).length > 0, removed: !!rm[q.id] });
    });
    added().forEach(function (q) {
      out.push({ id: q.id, origin: 'added', base: null, eff: q, edited: false, removed: !!rm[q.id] });
    });
    return out;
  }
  function recordFor(id) { var all = records(); for (var i = 0; i < all.length; i++) { if (all[i].id === id) return all[i]; } return null; }

  function editCounts() {
    var ov = overrides(), rm = removed();
    return { edited: Object.keys(ov).length, added: added().length, removed: Object.keys(rm).filter(function (k) { return rm[k]; }).length };
  }
  function nextId() {
    var taken = {}, n = 0;
    baseBank().forEach(function (q) { if (q && q.id) taken[String(q.id).toUpperCase()] = 1; });
    added().forEach(function (q) {
      taken[String(q.id).toUpperCase()] = 1;
      var m = /^L(\d+)$/i.exec(str(q.id)); if (m) n = Math.max(n, parseInt(m[1], 10) || 0);
    });
    var id;
    do { n++; id = 'L' + String(n).padStart(4, '0'); } while (taken[id]);
    return id;
  }

  // Every write goes through here so the UI always repaints from stored truth.
  function writeOverrides(path, value) {
    try { CORB.set(path, value); return true; }
    catch (e) { ui.toast('Could not save that edit: ' + (e && e.message || e), 'danger'); return false; }
  }
  function repaint() { drawTop(); drawStatus(); drawList(); }

  // ------------------------------------------------------------- mutations
  function saveRecord(rec, vals) {
    if (rec.origin === 'added') {
      var list = added().slice();
      var i = -1; list.some(function (q, k) { if (q.id === rec.id) { i = k; return true; } return false; });
      var merged = Object.assign({}, i >= 0 ? list[i] : { id: rec.id }, vals, { units: [vals.unit] });
      if (i >= 0) list[i] = merged; else list.push(merged);
      if (!writeOverrides('overrides.added', list)) return false;
      return true;
    }
    var patch = {};
    FIELDS.forEach(function (k) {
      var a = vals[k], b = rec.base ? rec.base[k] : null;
      if (Array.isArray(a)) { if (!sameList(a, b)) patch[k] = a; }
      else if (str(a) !== str(b)) patch[k] = a;
    });
    if (patch.unit) patch.units = [patch.unit];
    var ov = overrides(); var copy = {};
    Object.keys(ov).forEach(function (k) { copy[k] = ov[k]; });
    if (Object.keys(patch).length) copy[rec.id] = patch; else delete copy[rec.id];
    if (!writeOverrides('overrides.questions', copy)) return false;
    return Object.keys(patch).length;
  }
  function revertRecord(rec) {
    if (rec.origin === 'added') {
      ui.confirm('Delete ' + rec.id + ' from this copy of the app? The question you wrote will be gone.', { ok: 'Delete question', danger: true }).then(function (ok) {
        if (!ok) return;
        var list = added().filter(function (q) { return q.id !== rec.id; });
        if (!writeOverrides('overrides.added', list)) return;
        var rm = removed(), copy = {};
        Object.keys(rm).forEach(function (k) { if (k !== rec.id) copy[k] = rm[k]; });
        writeOverrides('overrides.removed', copy);
        S.selected = ''; S.formDirty = false;
        ui.toast(rec.id + ' deleted', 'ok');
        repaint(); drawForm();
      });
      return;
    }
    var ov = overrides(); var copy = {};
    Object.keys(ov).forEach(function (k) { if (k !== rec.id) copy[k] = ov[k]; });
    if (!writeOverrides('overrides.questions', copy)) return;
    S.formDirty = false;
    ui.toast(rec.id + ' restored to the original wording', 'ok');
    repaint(); drawForm();
  }
  function setRemoved(rec, on) {
    var rm = removed(), copy = {};
    Object.keys(rm).forEach(function (k) { copy[k] = rm[k]; });
    if (on) copy[rec.id] = util.today(); else delete copy[rec.id];
    if (!writeOverrides('overrides.removed', copy)) return;
    ui.toast(on ? rec.id + ' removed from the bank' : rec.id + ' put back in the bank', 'ok');
    repaint(); drawForm();
  }
  function addQuestion() {
    var id = nextId();
    var rec = {
      id: id, question: '', answer: '', answer_status: 'open', answer_source: 'facilitator-' + util.today(),
      deck_notes: [], alt_answers: [], domain: domains()[0], topic: '', alt_topics: [], tags: [],
      classes: [], unit: defaultUnit(), units: [defaultUnit()], kind: 'knowledge', sources: [],
      citations: [], rfo: { status: 'n/a', crosswalk: [], notes: '' }, flags: ['verify-locally'], key_points: []
    };
    var list = added().slice(); list.push(rec);
    if (!writeOverrides('overrides.added', list)) return;
    S.selected = id; S.formDirty = false; S.view = 'added'; S.shown = PAGE;
    if (R && R.search) R.search.value = ''; S.q = '';
    repaint(); drawForm(true);
    ui.toast('Created ' + id + ' — write the question, then save it', 'ok');
  }

  // ------------------------------------------------------------- top bar
  function drawTop() {
    if (!R || !R.counts) return;
    var c = editCounts();
    R.counts.innerHTML = '';
    [['Edited', c.edited, 'edit'], ['New', c.added, 'plus'], ['Removed', c.removed, 'trash']].forEach(function (row) {
      R.counts.appendChild(h('div.ed-count' + (row[1] ? '.on' : ''), {},
        icon(row[2]), h('b.num', {}, String(row[1])), h('span', {}, row[0])));
    });
    R.dirty.hidden = !CORB.dirty;
  }

  // ------------------------------------------------------------- content status
  function drawStatus() {
    if (!R || !R.status) return;
    var bank = safe(function () { return CORB.data.all() || []; }, []);
    var box = R.status; box.innerHTML = '';
    if (!bank.length) {
      box.appendChild(h('div.ed-status-empty', {}, icon('info'),
        h('div', {}, h('b', {}, 'No questions in this copy'), 'Nothing is in the bank yet. Add a question below, or import a CSV of questions you already have.')));
      return;
    }
    var st = { official: 0, 'ai-draft': 0, open: 0 }, byUnit = {}, flagged = 0;
    bank.forEach(function (q) {
      var s = str(q.answer_status) || 'open';
      if (st[s] == null) st[s] = 0;
      st[s]++;
      var u = str(q.unit) || 'Unassigned';
      byUnit[u] = (byUnit[u] || 0) + 1;
      if (arr(q.flags).length) flagged++;
    });
    var total = bank.length;
    box.appendChild(h('div.ed-status-tiles', {},
      tile('In the bank', total, 'Questions this copy will show'),
      tile('Official', st.official || 0, util.pct(st.official || 0, total) + '% of the bank', 'ok'),
      tile('AI draft', st['ai-draft'] || 0, 'Need a human check', 'warn'),
      tile('Open', st.open || 0, 'No answer written yet', 'muted')));

    var unitNames = Object.keys(byUnit).sort(function (a, b) { return byUnit[b] - byUnit[a]; });
    var top = byUnit[unitNames[0]] || 1;
    box.appendChild(h('div.ed-status-units', {},
      h('div.ed-sub', {}, 'Questions by organization'),
      h('div.ed-bars', {}, unitNames.map(function (u) {
        return h('div.ed-bar-row', {},
          h('span.ed-bar-name', { title: u }, units().some(function (x) { return x.id === u; }) ? unitLabel(u) : u),
          h('span.ed-bar-track', {}, h('span.ed-bar-fill', { style: { width: Math.max(3, util.pct(byUnit[u], top)) + '%' } })),
          h('span.ed-bar-n.num', {}, String(byUnit[u])));
      }))));
    if (flagged) box.appendChild(h('div.ed-status-note', {}, icon('flag'), h('span', {}, util.plural(flagged, 'question') + ' carry a verification flag. Flags stay visible to candidates — leave them on anything you have not confirmed against acquisition.gov or your C&P office.')));

    function tile(label, value, note, tone) {
      return h('div.ed-tile' + (tone ? '.' + tone : ''), {}, h('div.ed-tile-label', {}, label), h('div.ed-tile-value', {}, String(value)), h('div.ed-tile-note', {}, note));
    }
  }

  // ------------------------------------------------------------- list
  function matches(rec) {
    if (S.view === 'edited' && !rec.edited) return false;
    if (S.view === 'added' && rec.origin !== 'added') return false;
    if (S.view === 'removed' && !rec.removed) return false;
    if (!S.q) return true;
    var q = S.q.toLowerCase();
    var e = rec.eff || {};
    var hay = (str(e.id) + ' ' + str(e.question) + ' ' + str(e.topic) + ' ' + str(e.domain) + ' ' + str(e.unit) + ' ' + arr(e.tags).join(' ')).toLowerCase();
    return hay.indexOf(q) >= 0;
  }
  function drawList() {
    if (!R || !R.list) return;
    var all = records();
    var hits = all.filter(matches);
    R.tally.textContent = hits.length === all.length
      ? util.plural(all.length, 'question') + ' in this copy'
      : hits.length + ' of ' + all.length + ' questions';

    var counts = { all: all.length, edited: 0, added: 0, removed: 0 };
    all.forEach(function (r) { if (r.edited) counts.edited++; if (r.origin === 'added') counts.added++; if (r.removed) counts.removed++; });
    arr(R.viewBtns).forEach(function (b) {
      var k = b.getAttribute('data-view');
      b.classList.toggle('on', S.view === k);
      b.setAttribute('aria-pressed', S.view === k ? 'true' : 'false');
      var n = b.querySelector('.count'); if (n) n.textContent = String(counts[k] == null ? 0 : counts[k]);
    });

    R.list.innerHTML = ''; R.more.innerHTML = '';
    if (!all.length) {
      R.list.appendChild(h('div.ed-list-empty', {},
        h('b', {}, 'Nothing to edit yet'),
        h('p', {}, 'This copy of the app carries no questions. Add one, or import a CSV, and it will appear here.'),
        h('button.btn.sm.primary', { onclick: addQuestion }, icon('plus'), 'Add the first question')));
      return;
    }
    if (!hits.length) {
      R.list.appendChild(h('div.ed-list-empty', {},
        h('b', {}, 'No questions match'),
        h('p', {}, S.q ? 'Nothing matches “' + truncate(S.q, 40) + '”. Try an ID, a topic, or a word from the question.' : 'No questions are in this state yet.'),
        h('button.btn.sm', { onclick: function () { S.q = ''; S.view = 'all'; if (R.search) R.search.value = ''; drawList(); } }, 'Show every question')));
      return;
    }
    var shown = Math.min(S.shown, hits.length);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < shown; i++) frag.appendChild(listRow(hits[i]));
    R.list.appendChild(frag);
    if (hits.length > shown) {
      R.more.appendChild(h('button.btn.sm.block', { onclick: function () { S.shown += PAGE; drawList(); } },
        icon('chevron'), 'Show ' + Math.min(PAGE, hits.length - shown) + ' more'));
      R.more.appendChild(h('span.ed-more-n.num', {}, shown + ' of ' + hits.length));
    }
  }
  function listRow(rec) {
    var e = rec.eff || {};
    var marks = h('span.ed-row-marks', {});
    if (rec.origin === 'added') marks.appendChild(h('span.ed-mark.new', { title: 'Added in this copy' }, 'New'));
    if (rec.edited) marks.appendChild(h('span.ed-mark.edited', { title: 'Edited in this copy' }, 'Edited'));
    if (rec.removed) marks.appendChild(h('span.ed-mark.removed', { title: 'Hidden from the bank' }, 'Removed'));
    var status = str(e.answer_status) || 'open';
    return h('button.ed-row' + (S.selected === rec.id ? '.on' : '') + (rec.removed ? '.is-removed' : ''), {
      type: 'button', 'data-id': rec.id, 'aria-pressed': S.selected === rec.id ? 'true' : 'false',
      onclick: function () { select(rec.id); }
    },
      h('span.ed-row-top', {}, h('span.ed-row-id.num', {}, rec.id), h('span.ed-row-status.' + status.replace(/[^\w-]/g, ''), {}, status === 'ai-draft' ? 'AI draft' : status === 'open' ? 'Open' : 'Official'), marks),
      h('span.ed-row-q', {}, truncate(e.question, 150) || 'Untitled question — open it and write the prompt'),
      h('span.ed-row-meta', {}, [str(e.domain), str(e.topic)].filter(Boolean).join(' · ') || 'No domain set'));
  }
  function select(id) {
    if (S.selected === id) return;
    if (S.formDirty) {
      ui.confirm('Discard the unsaved edits to ' + S.selected + '?', { ok: 'Discard edits', danger: true }).then(function (ok) {
        if (!ok) return;
        S.formDirty = false; S.selected = id; drawList(); drawForm(true);
      });
      return;
    }
    S.selected = id; drawList(); drawForm(true);
  }

  // ------------------------------------------------------------- form
  function markDirty() { if (!S.formDirty) { S.formDirty = true; paintFormState(); } }
  function paintFormState() {
    if (!R || !R.formState) return;
    R.formState.textContent = S.formDirty ? 'Unsaved edits' : '';
    R.formState.hidden = !S.formDirty;
    if (R.formCard) R.formCard.classList.toggle('is-dirty', !!S.formDirty);
  }
  function collect() {
    return {
      question: str(F.question.value).trim(),
      answer: str(F.answer.value).replace(/\r/g, '').replace(/\s+$/, ''),
      answer_status: F.status.value,
      topic: str(F.topic.value).trim(),
      domain: F.domain.value,
      classes: classes().filter(function (c) { return F.classes[c] && F.classes[c].checked; }),
      unit: F.unit.value,
      kind: F.kind.value,
      tags: splitList(F.tags.value),
      citations: splitList(F.citations.value),
      flags: FLAGS.map(function (f) { return f[0]; }).filter(function (k) { return F.flags[k] && F.flags[k].checked; }),
      key_points: lines(F.key_points.value)
    };
  }
  function onSave(rec) {
    var vals = collect();
    if (!vals.question) { ui.toast('A question needs its prompt before it can be saved', 'warn'); try { F.question.focus(); } catch (e) {} return; }
    if (vals.answer_status !== 'open' && !vals.answer) { ui.toast('Set the status to “Open” or write an answer', 'warn'); try { F.answer.focus(); } catch (e) {} return; }
    if (vals.answer_status === 'open' && vals.answer) vals.answer_status = 'ai-draft';
    var res = saveRecord(rec, vals);
    if (res === false) return;
    S.formDirty = false;
    ui.toast(rec.origin === 'added' ? rec.id + ' saved' : (res ? rec.id + ' saved as an override' : rec.id + ' matches the original — override removed'), 'ok');
    repaint(); drawForm();
  }

  function drawForm(focus) {
    if (!R || !R.form) return;
    var box = R.form; box.innerHTML = ''; F = null;
    var rec = S.selected ? recordFor(S.selected) : null;
    if (!rec) {
      S.selected = '';
      box.appendChild(h('div.ed-form-empty', {},
        icon('edit'),
        h('h3', {}, 'Pick a question to edit'),
        h('p', {}, 'Choose any question on the left to change its wording, answer, domain, class or flags. Edits live in this copy of the app only until you save a new copy of the file.'),
        h('button.btn.primary.mt-4', { onclick: addQuestion }, icon('plus'), 'Add a new question')));
      return;
    }
    var e = rec.eff || {};
    F = { classes: {}, flags: {} };

    var head = h('div.ed-form-head', {},
      h('div.ed-form-id', {},
        h('span.num', {}, rec.id),
        safe(function () { return ui.badge(str(e.answer_status) || 'open'); }, null),
        arr(e.classes).map(function (c) { return safe(function () { return ui.classBadge(c); }, null); }),
        rec.origin === 'added' ? h('span.ed-mark.new', {}, 'New') : null,
        rec.edited ? h('span.ed-mark.edited', {}, 'Edited') : null,
        rec.removed ? h('span.ed-mark.removed', {}, 'Removed') : null,
        R.formState = h('span.ed-form-state', { hidden: true })),
      h('button.btn.sm.ghost.ed-back', { onclick: function () { if (R.listCard && R.listCard.scrollIntoView) try { R.listCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (x) { R.listCard.scrollIntoView(); } } }, icon('arrow-left'), 'Back to the list'));
    box.appendChild(head);

    if (rec.removed) box.appendChild(h('div.callout.warn.mb-4', {}, icon('alert'),
      h('div', {}, h('b', {}, 'Hidden from the bank'), 'Candidates will not see this question in this copy of the app. Put it back with the button at the bottom of the form.')));

    F.question = field('Question', 'The prompt a board member reads aloud. Plain text.', h('textarea.textarea.ed-q', { value: str(e.question), rows: '4', oninput: markDirty, placeholder: 'You are the KO on a services requirement and…' }));
    F.answer = field('Answer', 'Board-ready voice: how a KO would say it in 45–90 seconds, then a "Cite:" line. Plain text, bullets as "- ".', h('textarea.textarea.ed-a', { value: str(e.answer), rows: '9', oninput: markDirty, placeholder: 'Answer in plain text…' }));
    box.appendChild(F.question.wrap);
    box.appendChild(F.answer.wrap);
    F.question = F.question.el; F.answer = F.answer.el;

    var grid = h('div.ed-grid');
    F.status = sel(grid, 'Answer status', STATUSES, str(e.answer_status) || 'open', 'Candidates always see this status on the card.');
    F.kind = sel(grid, 'Kind', KINDS, str(e.kind) || 'knowledge');
    F.domain = sel(grid, 'Domain', domains().map(function (d) { return [d, d]; }), domains().indexOf(str(e.domain)) >= 0 ? str(e.domain) : domains()[0]);
    F.unit = sel(grid, 'Organization', units().map(function (u) { return [u.id, u.short || u.name || u.id]; }), units().some(function (u) { return u.id === str(e.unit); }) ? str(e.unit) : defaultUnit(), 'Who this question is for. ACC-All shows to everyone.');
    var topic = field('Topic', 'Short subject label, e.g. "Bona Fide Need".', h('input.input', { type: 'text', value: str(e.topic), oninput: markDirty, list: 'ed-topics', placeholder: 'Bona Fide Need' }));
    grid.appendChild(topic.wrap); F.topic = topic.el;
    var tags = field('Tags', 'Comma separated.', h('input.input', { type: 'text', value: arr(e.tags).join(', '), oninput: markDirty, placeholder: 'OCONUS, Services' }));
    grid.appendChild(tags.wrap); F.tags = tags.el;
    box.appendChild(grid);
    box.appendChild(topicList());

    var cls = h('div.ed-checks', {}, classes().map(function (c) {
      var on = arr(e.classes).indexOf(c) >= 0;
      var input = h('input', { type: 'checkbox', checked: on, onchange: markDirty });
      F.classes[c] = input;
      return h('label.ed-check', {}, input, h('span', {}, 'Class ' + c));
    }));
    box.appendChild(group('Warrant classes', 'Which boards this question belongs to.', cls));

    var cites = field('Citations', 'Comma separated, RFO numbering (FAR 6.103-1). Statutes stay as they are.', h('input.input', { type: 'text', value: arr(e.citations_rfo).length ? arr(e.citations_rfo).join(', ') : arr(e.citations).join(', '), oninput: markDirty, placeholder: 'FAR 6.103-1, 10 U.S.C. 1724' }));
    box.appendChild(cites.wrap); F.citations = cites.el;

    var flags = h('div.ed-checks', {}, FLAGS.map(function (f) {
      var input = h('input', { type: 'checkbox', checked: arr(e.flags).indexOf(f[0]) >= 0, onchange: markDirty });
      F.flags[f[0]] = input;
      return h('label.ed-check', {}, input, h('span', {}, f[1]));
    }));
    box.appendChild(group('Verification flags', 'Leave a flag on anything you have not confirmed. Korea items keep "confirm with C&P".', flags));

    var kp = field('Key points', 'One per line. Shown as the flashcard checklist and the board rubric prompt.', h('textarea.textarea', { value: arr(e.key_points).join('\n'), rows: '4', oninput: markDirty, placeholder: 'Authority to obligate funds\nRatification chain' }));
    box.appendChild(kp.wrap); F.key_points = kp.el;

    var foot = h('div.ed-form-foot', {},
      R.saveBtn = h('button.btn.primary', { onclick: function () { onSave(rec); } }, icon('check'), 'Save changes'),
      rec.origin === 'added'
        ? h('button.btn.danger', { onclick: function () { revertRecord(rec); } }, icon('trash'), 'Delete question')
        : h('button.btn', { disabled: !rec.edited, onclick: function () { revertRecord(rec); } }, icon('refresh'), 'Revert to original'),
      rec.removed
        ? h('button.btn', { onclick: function () { setRemoved(rec, false); } }, icon('plus'), 'Put back in the bank')
        : h('button.btn.danger', { onclick: function () {
            ui.confirm('Hide ' + rec.id + ' from the bank in this copy? Candidates will not see it in the library, flashcards, quizzes or boards.', { ok: 'Remove from bank', danger: true })
              .then(function (ok) { if (ok) setRemoved(rec, true); });
          } }, icon('trash'), 'Remove from bank'),
      h('span.grow'),
      h('button.btn.ghost', { onclick: function () { S.formDirty = false; drawForm(true); ui.toast('Form reset to the saved values'); } }, 'Reset form'));
    box.appendChild(foot);
    box.appendChild(preview(rec));

    paintFormState();
    if (focus) { try { F.question.focus({ preventScroll: true }); } catch (x) { try { F.question.focus(); } catch (y) {} } }

    function field(label, hint, el) {
      var wrap = h('div.field.ed-field', {}, h('label', {}, label), el, hint ? h('div.hint', {}, hint) : null);
      var id = 'ed-f-' + label.toLowerCase().replace(/[^a-z]+/g, '-');
      el.id = id; wrap.querySelector('label').setAttribute('for', id);
      return { wrap: wrap, el: el };
    }
    function sel(host, label, list, value, hint) {
      var el = h('select.select', { onchange: markDirty }, list.map(function (o) { return h('option', { value: o[0], selected: o[0] === value }, o[1]); }));
      var f = field(label, hint, el);
      host.appendChild(f.wrap);
      return f.el;
    }
    function group(label, hint, body) {
      return h('div.ed-group', {}, h('div.ed-group-label', {}, label), body, hint ? h('div.hint', {}, hint) : null);
    }
  }
  // The card exactly as a candidate sees it, built from the last saved values.
  function preview(rec) {
    var card = safe(function () { return ui.questionCard(rec.eff, { showAnswer: true, actions: false }); }, null);
    if (!card) card = h('div.ed-preview-fallback', {}, 'This question cannot be previewed until its prompt is saved.');
    return h('details.acc.ed-preview', {},
      h('summary', {}, icon('eye'), 'Preview the saved card', icon('chevron', 'chev')),
      h('div.acc-body', {},
        h('p.small.muted.mb-3', {}, 'This is the last saved version of ' + rec.id + ', rendered the way candidates see it in the library, flashcards and the board room.'),
        card));
  }
  function topicList() {
    var seen = {}, out = [];
    safe(function () { return CORB.data.all() || []; }, []).forEach(function (q) { var t = str(q.topic); if (t && !seen[t]) { seen[t] = 1; out.push(t); } });
    out.sort();
    return h('datalist#ed-topics', {}, out.slice(0, 400).map(function (t) { return h('option', { value: t }); }));
  }

  // ------------------------------------------------------------- export / import
  function exportOverrides() {
    var payload = {
      version: 'corb-overrides-1',
      savedAt: new Date().toISOString(),
      app: str(safe(function () { return CORB.DATA.meta.app_name; }, '')) || 'Signatory',
      overrides: { questions: overrides(), added: added(), removed: removed() }
    };
    var c = editCounts();
    if (!c.edited && !c.added && !c.removed) { ui.toast('There are no content edits to export yet', 'warn'); return; }
    var name = 'CORB-content-edits_' + util.stamp() + '.json';
    var ok = safe(function () { return CORB.store.download(name, JSON.stringify(payload, null, 1), 'application/json'); }, false);
    ui.toast(ok ? 'Exported ' + name : 'The download did not start — your browser may be blocking it', ok ? 'ok' : 'danger');
  }
  function importOverridesFile(file) {
    if (!file) return;
    var r = new FileReader();
    r.onerror = function () { ui.toast('Could not read that file', 'danger'); };
    r.onload = function () {
      var p = null;
      try { p = JSON.parse(r.result); } catch (e) { ui.toast('That is not a valid JSON file', 'danger'); return; }
      var src = obj(obj(p).overrides);
      var q = obj(src.questions), a = arr(src.added).filter(function (x) { return x && x.id; }), rm = obj(src.removed);
      var n = Object.keys(q).length + a.length + Object.keys(rm).length;
      if (!n) { ui.toast('That file carries no content edits', 'warn'); return; }
      ui.modal({
        title: 'Merge these content edits?',
        body: h('div.v-editor.ed-dialog.stack', {},
          h('p', {}, 'This file carries ' + util.plural(Object.keys(q).length, 'edited question') + ', ' + util.plural(a.length, 'new question') + ' and ' + util.plural(Object.keys(rm).length, 'removal') + '.'),
          h('p.small.muted', {}, 'Merging keeps your current edits and lets the imported ones win where the same question ID appears in both. Nothing is deleted.'),
          p.savedAt ? h('p.small.muted', {}, 'Exported ' + util.fmtDateTime(p.savedAt)) : null),
        actions: [
          { label: 'Cancel' },
          { label: 'Merge edits', primary: true, onClick: function () { mergeOverrides(q, a, rm); } }
        ]
      });
    };
    r.readAsText(file);
  }
  function mergeOverrides(q, a, rm) {
    var ov = overrides(), copy = {};
    Object.keys(ov).forEach(function (k) { copy[k] = ov[k]; });
    Object.keys(q).forEach(function (k) { if (obj(q[k])) copy[k] = Object.assign({}, copy[k] || {}, obj(q[k])); });
    writeOverrides('overrides.questions', copy);

    var list = added().slice(), index = {};
    list.forEach(function (x, i) { index[x.id] = i; });
    var newCount = 0;
    a.forEach(function (x) { if (index[x.id] != null) list[index[x.id]] = x; else { list.push(x); newCount++; } });
    writeOverrides('overrides.added', list);

    var r0 = removed(), r1 = {};
    Object.keys(r0).forEach(function (k) { r1[k] = r0[k]; });
    Object.keys(rm).forEach(function (k) { if (rm[k]) r1[k] = rm[k]; });
    writeOverrides('overrides.removed', r1);

    S.formDirty = false;
    ui.toast('Merged ' + util.plural(Object.keys(q).length, 'edit') + ' and ' + util.plural(newCount, 'new question'), 'ok');
    repaint(); drawForm();
  }

  // ------------------------------------------------------------- CSV import
  function parseCSV(text) {
    var rows = [], row = [], cur = '', inQ = false, i = 0;
    text = str(text).replace(/^﻿/, '');
    while (i < text.length) {
      var c = text.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { cur += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        if (c === '\r') { if (text.charAt(i + 1) === '\n') i++; cur += '\n'; i++; continue; }
        cur += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { row.push(cur); cur = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        if (c === '\r' && text.charAt(i + 1) === '\n') i++;
        row.push(cur); rows.push(row); row = []; cur = ''; i++; continue;
      }
      cur += c; i++;
    }
    row.push(cur); rows.push(row);
    return rows.filter(function (r) { return r.some(function (cell) { return str(cell).trim() !== ''; }); });
  }
  function headerMap(headers) {
    var norm = headers.map(function (x) { return str(x).toLowerCase().replace(/[^a-z0-9]/g, ''); });
    var map = {};
    CSV_COLS.forEach(function (col) {
      for (var i = 0; i < norm.length; i++) { if (col[1].indexOf(norm[i]) >= 0 && map[col[0]] == null) { map[col[0]] = i; break; } }
    });
    return map;
  }
  function normClass(v) {
    var s = str(v).trim().toUpperCase();
    var byNum = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
    if (byNum[s]) return byNum[s];
    if (/^(AGREEMENT|GRANT)/.test(s)) return OFF_TRACK;
    var ok = classes().filter(function (c) { return c.toUpperCase() === s; })[0];
    return ok || '';
  }
  function normDomain(v) {
    var s = str(v).trim().toLowerCase();
    if (!s) return '';
    var hit = domains().filter(function (d) { return d.toLowerCase() === s; })[0];
    if (hit) return hit;
    hit = domains().filter(function (d) { return d.toLowerCase().indexOf(s) >= 0 || s.indexOf(d.toLowerCase()) >= 0; })[0];
    return hit || '';
  }
  function normUnit(v) {
    var s = str(v).trim().toLowerCase();
    if (!s) return '';
    var list = units();
    var hit = list.filter(function (u) { return str(u.id).toLowerCase() === s || str(u.short).toLowerCase() === s || str(u.name).toLowerCase() === s; })[0];
    if (hit) return hit.id;
    hit = list.filter(function (u) { return str(u.name).toLowerCase().indexOf(s) >= 0 || str(u.id).toLowerCase().indexOf(s) >= 0; })[0];
    return hit ? hit.id : '';
  }
  function csvToQuestions(rows) {
    var out = { items: [], skipped: 0, offTrack: 0, noDomain: 0, noUnit: 0, headers: [] };
    if (!rows.length) return out;
    var map = headerMap(rows[0]);
    out.headers = rows[0].map(function (x) { return str(x).trim(); });
    if (map.question == null) { out.error = 'No "question" column. The first row must name the columns: question, answer, topic, domain, classes, unit, tags.'; return out; }
    var fallbackUnit = defaultUnit();
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var qt = str(r[map.question]).trim();
      if (!qt) { out.skipped++; continue; }
      var ans = map.answer == null ? '' : str(r[map.answer]).replace(/\r/g, '').trim();
      var dom = map.domain == null ? '' : normDomain(r[map.domain]);
      if (!dom) { out.noDomain++; dom = 'General Contracting'; }
      if (domains().indexOf(dom) < 0) dom = domains()[0];
      var un = map.unit == null ? '' : normUnit(r[map.unit]);
      if (!un) { out.noUnit++; un = fallbackUnit; }
      var tagged = map.classes == null ? [] : splitList(r[map.classes]).map(normClass).filter(Boolean);
      var cls = tagged.filter(function (c) { return c !== OFF_TRACK; });
      if (tagged.length && !cls.length) { out.offTrack++; continue; }
      out.items.push({
        question: qt, answer: ans,
        answer_status: ans ? 'official' : 'open',
        topic: map.topic == null ? '' : str(r[map.topic]).trim(),
        domain: dom, unit: un, classes: cls,
        tags: map.tags == null ? [] : splitList(r[map.tags]),
        kind: 'knowledge', citations: [], key_points: [],
        flags: ['verify-locally']
      });
    }
    return out;
  }
  function importCsvFile(file) {
    if (!file) return;
    var r = new FileReader();
    r.onerror = function () { ui.toast('Could not read that file', 'danger'); };
    r.onload = function () {
      var parsed;
      try { parsed = csvToQuestions(parseCSV(r.result)); }
      catch (e) { ui.toast('That CSV could not be parsed: ' + (e && e.message || e), 'danger'); return; }
      if (parsed.error) {
        ui.modal({ title: 'That CSV is missing a column', body: h('div.v-editor.ed-dialog.stack', {}, h('p', {}, parsed.error), parsed.headers.length ? h('p.small.muted', {}, 'Columns found: ' + parsed.headers.join(', ')) : null), actions: [{ label: 'Close', primary: true }] });
        return;
      }
      if (!parsed.items.length) { ui.toast(parsed.offTrack ? 'Every row in that file is for Grants or Agreements officers' : 'No rows with a question in that file', 'warn'); return; }
      var sample = parsed.items.slice(0, 4);
      ui.modal({
        title: 'Import ' + util.plural(parsed.items.length, 'question') + '?',
        wide: true,
        body: h('div.v-editor.ed-dialog.stack', {},
          h('p', {}, 'Each row becomes a new question in this copy of the app, numbered from ' + nextId() + '. Rows with an answer are marked official; rows without one are marked open so a candidate can draft the answer.'),
          h('div.callout.info', {}, icon('info'), h('div', {}, h('b', {}, 'Everything imported is flagged "Verify locally"'), 'Clear the flag on a question only after you have confirmed its answer and citations.')),
          parsed.skipped || parsed.offTrack || parsed.noDomain || parsed.noUnit ? h('ul.ed-import-notes', {}, [
            parsed.skipped ? h('li', {}, util.plural(parsed.skipped, 'row') + ' skipped for having no question text.') : null,
            parsed.offTrack ? h('li', {}, util.plural(parsed.offTrack, 'row') + ' skipped for being only for Grants or Agreements officers.') : null,
            parsed.noDomain ? h('li', {}, util.plural(parsed.noDomain, 'row') + ' had no recognised domain and will land in General Contracting.') : null,
            parsed.noUnit ? h('li', {}, util.plural(parsed.noUnit, 'row') + ' had no recognised organization and will be tagged ' + unitLabel(defaultUnit()) + '.') : null
          ].filter(Boolean)) : null,
          h('div.ed-import-preview', {}, h('div.ed-sub', {}, 'First rows'), sample.map(function (q) {
            return h('div.ed-import-row', {}, h('div.ed-import-q', {}, truncate(q.question, 160)), h('div.ed-import-meta', {}, [q.domain, q.topic, q.unit, q.answer ? 'has answer' : 'open'].filter(Boolean).join(' · ')));
          }))),
        actions: [
          { label: 'Cancel' },
          { label: 'Import ' + parsed.items.length, primary: true, onClick: function () { commitImport(parsed.items); } }
        ]
      });
    };
    r.readAsText(file);
  }
  function commitImport(items) {
    var list = added().slice();
    var taken = {};
    baseBank().forEach(function (q) { if (q && q.id) taken[String(q.id).toUpperCase()] = 1; });
    list.forEach(function (q) { taken[String(q.id).toUpperCase()] = 1; });
    var n = 0;
    list.forEach(function (q) { var m = /^L(\d+)$/i.exec(str(q.id)); if (m) n = Math.max(n, parseInt(m[1], 10) || 0); });
    var first = '';
    items.forEach(function (it) {
      var id;
      do { n++; id = 'L' + String(n).padStart(4, '0'); } while (taken[id]);
      taken[id] = 1;
      if (!first) first = id;
      list.push(Object.assign({
        id: id, answer_source: 'facilitator-csv-' + util.today(), deck_notes: [], alt_answers: [],
        alt_topics: [], units: [it.unit], sources: [{ src: 'facilitator-csv' }],
        rfo: { status: 'pending', crosswalk: [], notes: '' }
      }, it));
    });
    if (!writeOverrides('overrides.added', list)) return;
    S.view = 'added'; S.q = ''; S.shown = PAGE; S.selected = first; S.formDirty = false;
    if (R && R.search) R.search.value = '';
    ui.toast('Imported ' + util.plural(items.length, 'question'), 'ok');
    repaint(); drawForm();
  }

  // ------------------------------------------------------------- save a copy
  function saveCopyModal() {
    var hasPass = !!str(CORB.get('settings.boardPasscode', ''));
    var opts = { includePasscode: false, defaultUnit: defaultUnit() };
    var c = editCounts();
    var body = h('div.v-editor.ed-dialog.stack', {},
      h('p', {}, 'This downloads a complete new copy of the app — one file, with every content edit baked in. It is how your edits reach anyone else.'),
      h('div.callout.warn', {}, icon('alert'), h('div', {}, h('b', {}, 'The new file replaces the old one'),
        'Nothing updates in place. Delete or overwrite the file you are using now, and send the new one to everyone who uses the app, or people will keep studying from stale content.')),
      h('div.ed-save-stats', {},
        h('div', {}, h('b.num', {}, String(c.edited)), ' edited'),
        h('div', {}, h('b.num', {}, String(c.added)), ' new'),
        h('div', {}, h('b.num', {}, String(c.removed)), ' removed')),
      h('div.field', {}, h('label', {}, 'Default organization for the new copy'),
        h('select.select', { onchange: function (ev) { opts.defaultUnit = ev.target.value; } },
          units().map(function (u) { return h('option', { value: u.id, selected: u.id === opts.defaultUnit }, u.short || u.name || u.id); })),
        h('div.hint', {}, 'Whoever opens the new file starts on this organization. They can still switch it in the top bar.')),
      hasPass
        ? h('label.switch', {}, h('input', { type: 'checkbox', onchange: function (ev) { opts.includePasscode = !!ev.target.checked; } }), 'Include the board room passcode in the copy')
        : h('p.small.muted', {}, 'No board room passcode is set, so the copy will not carry one. Set one in the board room first if you want to gate those views.'),
      h('p.small.muted', {}, 'Candidate progress, notes and any connector key stay on this machine — they are never written into the copy.'));
    ui.modal({
      title: 'Save a new copy of the app',
      body: body,
      actions: [
        { label: 'Cancel' },
        { label: 'Download the new copy', primary: true, onClick: function () { doSaveCopy(opts); } }
      ]
    });
  }
  function doSaveCopy(opts) {
    var name;
    try { name = CORB.store.saveCopy({ includePasscode: opts.includePasscode, defaultUnit: opts.defaultUnit }); }
    catch (e) {
      ui.modal({
        title: 'The copy could not be saved',
        body: h('div.v-editor.ed-dialog.stack', {}, h('p', {}, str(e && e.message || e)),
          h('p.small.muted', {}, 'This happens when the page was not opened as the single built file — for example when it is served from a development folder, or the file was altered. Open the distributed .html file and try again. Your edits are untouched; export them as JSON in the meantime.')),
        actions: [{ label: 'Close' }, { label: 'Export edits as JSON', primary: true, onClick: exportOverrides }]
      });
      return;
    }
    ui.toast('Saved ' + name + ' — replace the old file with it', 'ok', 5000);
    drawTop();
  }

  // ------------------------------------------------------------- build
  function build(root) {
    var app = h('div.ed-app'); root.appendChild(app);

    app.appendChild(h('div.page-head.ed-head', {},
      h('div.ed-head-copy', {},
        h('div.eyebrow', {}, 'Facilitator tools'),
        h('h1', {}, 'Content editor'),
        h('p.lede', {}, 'Correct an answer, retag a question, retire one that no longer reflects policy, or add questions your team wrote. Edits apply to this copy of the app immediately and reach everyone else when you save a new copy of the file.')),
      h('div.ed-head-actions', {},
        R.dirty = h('span.ed-dirty', { hidden: true }, icon('alert'), 'Unsaved in this file'),
        h('button.btn.primary.ed-savecopy', { onclick: saveCopyModal }, icon('download'), 'Save a new copy of the app'))));

    R.counts = h('div.ed-counts');
    R.fileOv = h('input.sr-only', { type: 'file', tabindex: '-1', accept: '.json,application/json', 'aria-label': 'Choose a content edits file', onchange: function (ev) { var f = ev.target.files && ev.target.files[0]; ev.target.value = ''; importOverridesFile(f); } });
    R.fileCsv = h('input.sr-only', { type: 'file', tabindex: '-1', accept: '.csv,text/csv,text/plain', 'aria-label': 'Choose a CSV of questions', onchange: function (ev) { var f = ev.target.files && ev.target.files[0]; ev.target.value = ''; importCsvFile(f); } });
    app.appendChild(h('div.ed-bar', {},
      R.counts,
      h('span.grow'),
      h('button.btn.sm', { onclick: exportOverrides }, icon('upload'), 'Export overrides'),
      h('button.btn.sm', { onclick: function () { R.fileOv.click(); } }, icon('download'), 'Import overrides'),
      h('button.btn.sm', { onclick: function () { R.fileCsv.click(); } }, icon('layers'), 'Import questions from CSV'),
      R.fileOv, R.fileCsv));

    R.status = h('div.ed-status');
    app.appendChild(h('section.card.ed-status-card', {},
      h('div.card-head', {}, h('h3', {}, 'Content status'), h('span.muted.small', {}, 'What this copy of the app currently shows')),
      R.status));

    R.search = h('input.input', { type: 'search', value: str(S.q), placeholder: 'Search by ID, question, topic, tag…', 'aria-label': 'Search questions to edit', autocomplete: 'off', spellcheck: 'false', oninput: onSearch, onkeydown: onSearchKey });
    R.viewBtns = VIEWS.map(function (v) {
      return h('button', { type: 'button', 'data-view': v[0], onclick: function () { S.view = v[0]; S.shown = PAGE; drawList(); } }, v[1], h('span.count', {}, '0'));
    });
    R.tally = h('span.ed-tally');
    R.list = h('div.ed-list', { 'aria-label': 'Question list' });
    R.more = h('div.ed-more');
    R.listCard = h('section.card.flush.ed-list-card', { 'aria-label': 'Questions' },
      h('div.ed-list-head', {},
        h('div.search.ed-search', {}, icon('search'), R.search),
        h('button.btn.sm.primary.ed-add', { onclick: addQuestion }, icon('plus'), 'Add new question')),
      h('div.seg.ed-views', { role: 'group', 'aria-label': 'Filter questions' }, R.viewBtns),
      h('div.ed-list-tally', {}, R.tally),
      R.list, R.more);

    R.form = h('div.ed-form');
    R.formCard = h('section.card.ed-form-card', { 'aria-label': 'Edit question' }, R.form);

    app.appendChild(h('div.ed-work', {}, R.listCard, R.formCard));

    drawTop(); drawStatus(); drawList(); drawForm();

    unsub.push(CORB.on('change', function (e) {
      if (!R || !R.counts || !e || !e.path) return;
      if (String(e.path).indexOf('overrides') === 0) drawTop();
    }));
  }

  function onSearch(e) {
    var v = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(function () { timer = null; S.q = str(v).trim(); S.shown = PAGE; drawList(); }, 160);
  }
  function onSearchKey(e) {
    if (e.key === 'Escape') { e.target.value = ''; clearTimeout(timer); timer = null; S.q = ''; S.shown = PAGE; drawList(); }
    if (e.key === 'Enter') { clearTimeout(timer); timer = null; S.q = str(e.target.value).trim(); S.shown = PAGE; drawList(); }
  }

  function leave() {
    clearTimeout(timer); timer = null;
    unsub.forEach(function (u) { try { u(); } catch (e) {} }); unsub = [];
    if (S) { S.formDirty = false; last = S; }
    R = null; F = null;
  }

  CORB.registerView({
    id: 'editor', title: 'Content editor', icon: 'edit', section: 'System', order: 420,
    nav: true, short: 'Editor', roles: ['facilitator'], wide: true,
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || {};
      S = last || { q: '', view: 'all', shown: PAGE, selected: '', formDirty: false };
      S.shown = PAGE; S.formDirty = false;
      if (p.q) S.q = String(p.q).trim();
      if (p.view && VIEWS.some(function (v) { return v[0] === p.view; })) S.view = p.view;
      if (p.id) S.selected = String(p.id).trim();
      if (S.selected && !recordFor(S.selected)) S.selected = '';
      last = S;
      R = {};
      build(root);
    },
    onLeave: leave
  });
})();
