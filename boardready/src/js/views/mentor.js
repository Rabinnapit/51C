/* VIEW: mentor — the coaching chat workspace.
   Layout: conversation column (thread + sticky composer with mode chips and starters) beside a rail
   holding the connection status card and the training-aid disclaimer.
   Logic: when CORB.connector.configured() the Explain and Critique modes call CORB.connector.mentor();
   any failure falls back to CORB.connector.offlineAnswer() with a visible notice on the message.
   Quiz me always draws a real question out of the embedded bank (offline retrieval) and reveals on request.
   Data: CORB.data.search / questions / byId, CORB.scoring.rubric(). Every call is wrapped — a missing or
   empty repository produces an explained empty state, never a throw.
   Params: q (prefills and sends), critique (question id; prefills a critique prompt), mode.
   Persists: progress.mentor (capped at 60 messages), settings.mentorMode. */
(function () {
  'use strict';
  var CORB = window.CORB, ui = CORB.ui, h = ui.h, icon = ui.icon;

  var CAP = 60;
  var HISTORY = 8;

  var MODES = [
    { id: 'explain', label: 'Explain', icon: 'book', hint: 'A board-ready explanation, then the citation line.' },
    { id: 'quiz', label: 'Quiz me', icon: 'quiz', hint: 'A real question from the bank. Answer aloud, then reveal.' },
    { id: 'critique', label: 'Critique', icon: 'scale', hint: 'Your answer beside the model answer and the rubric.' }
  ];

  var STARTERS = [
    { text: 'Explain the bona fide needs rule like I\'m at the board', mode: 'explain', icon: 'book', send: true },
    { text: 'Quiz me on protests', mode: 'quiz', icon: 'quiz', send: true },
    { text: 'What changed under the RFO for sole source?', mode: 'explain', icon: 'refresh', send: true },
    { text: 'Grade this answer: ', mode: 'critique', icon: 'scale', send: false },
    { text: 'What does the 411th board ask Class II candidates?', mode: 'explain', icon: 'users', send: true }
  ];

  var R = null;            // live DOM references
  var pending = false;     // a request is in flight
  var unsub = [];          // CORB.on unsubscribers

  // ---------------------------------------------------------------- helpers
  function safe(fn, fallback) { try { var v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return v == null ? '' : String(v); }
  function lower(v) { return str(v).toLowerCase(); }
  function uid() { return safe(function () { return CORB.util.uid(); }, String(Math.random()).slice(2)); }
  function nowIso() { return new Date().toISOString(); }
  function when(ts) { return safe(function () { return CORB.util.fmtDateTime(ts); }, '') || ''; }
  // Cuts at the nearest earlier space so an excerpt never ends mid-word ("authori…"); "…" marks a real cut.
  function wordCut(s, max) {
    s = str(s).replace(/\s+/g, ' ').trim();
    if (s.length <= max) return s;
    var cut = s.slice(0, max);
    var sp = cut.lastIndexOf(' ');
    if (sp > max * 0.55) cut = cut.slice(0, sp);
    return cut.replace(/[\s,;:.\-–—…]+$/, '') + '…';
  }

  function thread() { return arr(CORB.get('progress.mentor', [])).filter(function (m) { return m && typeof m === 'object' && m.role; }); }
  function saveThread(list) { CORB.set('progress.mentor', list.slice(-CAP)); }
  function pushMsg(msg) { var list = thread(); list.push(msg); saveThread(list); return msg; }
  function replaceMsg(msg) {
    var list = thread();
    for (var i = 0; i < list.length; i++) { if (list[i].id === msg.id) { list[i] = msg; saveThread(list); return; } }
    pushMsg(msg);
  }

  function mode() {
    var m = str(CORB.get('settings.mentorMode', 'explain'));
    for (var i = 0; i < MODES.length; i++) { if (MODES[i].id === m) return m; }
    return 'explain';
  }
  function setMode(m) { CORB.set('settings.mentorMode', m); }
  function modeDef(id) { for (var i = 0; i < MODES.length; i++) { if (MODES[i].id === id) return MODES[i]; } return MODES[0]; }

  function configured() { return !!safe(function () { return CORB.connector && CORB.connector.configured(); }, false); }
  function connSettings() { return safe(function () { return CORB.connector.settings() || {}; }, {}) || {}; }
  function providerLabel() {
    var s = connSettings();
    var map = { openai: 'AI endpoint', anthropic: 'Anthropic Claude', gemini: 'Google Gemini' };
    return map[s.provider] || 'AI endpoint';
  }
  function modelLabel() { var s = connSettings(); return str(s.model); }

  function bankSize() { return safe(function () { return (CORB.data.questions({ anyClass: true }) || []).length; }, 0); }
  function domains() { return safe(function () { return arr(CORB.data.DOMAINS); }, []); }

  // ------------------------------------------------------------ retrieval
  // Keeps a short, always-visible preview and a longer (still capped) excerpt behind "Show excerpt", both cut at a
  // word boundary. `body` (when the caller supplies it, e.g. CORB.connector.grounding) is the real source text; a
  // source with no body beyond its own title shows just the title row, not the same words twice.
  function sourcesFrom(list) {
    return arr(list).slice(0, 6).map(function (s) {
      var body = str(s.body || '').trim();
      var title = wordCut(s.title, 160);
      var preview = body ? wordCut(body, 96) : '';
      var fuller = body ? wordCut(body, 380) : '';
      if (preview && preview.replace(/…$/, '') === title.replace(/…$/, '')) preview = '';
      return { type: str(s.type) || 'Reference', title: title, preview: preview, full: (fuller && fuller !== preview) ? fuller : '',
        view: str(s.view) || 'library', params: (s.params && typeof s.params === 'object') ? s.params : {} };
    });
  }

  function detectDomain(text) {
    var t = lower(text);
    var doms = domains();
    for (var i = 0; i < doms.length; i++) { if (t.indexOf(lower(doms[i])) >= 0) return doms[i]; }
    var hits = safe(function () { return CORB.data.search(text, { limit: 12, types: ['Question'] }) || []; }, []);
    var tally = {}, best = '', bestN = 0;
    hits.forEach(function (hi) {
      var d = hi && hi.ref && hi.ref.domain; if (!d) return;
      tally[d] = (tally[d] || 0) + 1;
      if (tally[d] > bestN) { bestN = tally[d]; best = d; }
    });
    return best;
  }

  function recentQids() {
    var out = {};
    thread().slice(-12).forEach(function (m) { if (m && m.qid) out[m.qid] = true; });
    return out;
  }

  function pickQuiz(text) {
    var domain = detectDomain(text);
    var pool = safe(function () { return CORB.data.questions(domain ? { domain: domain } : {}) || []; }, []);
    if (!pool.length && domain) pool = safe(function () { return CORB.data.questions({}) || []; }, []);
    if (!pool.length) return { q: null, domain: domain };
    var seenQ = recentQids();
    var answered = pool.filter(function (q) { return q && q.answer_status !== 'open' && str(q.answer).trim(); });
    var list = answered.length ? answered : pool;
    var freshList = list.filter(function (q) { return !seenQ[q.id]; });
    if (freshList.length) list = freshList;
    var pick = safe(function () { return CORB.util.shuffle(list)[0]; }, list[0]) || list[0];
    return { q: pick, domain: domain };
  }

  // pull "My answer: …" out of a critique prompt, and find the question it refers to
  function parseCritique(text, qid) {
    var t = str(text);
    var m = /my answer\s*[:\-—]\s*([\s\S]+)$/i.exec(t);
    var mine = m ? m[1].trim() : '';
    var head = m ? t.slice(0, m.index) : t;
    head = head.replace(/^\s*(grade|critique|score|review)\s+(this|my)\s+answer\s*(to)?\s*[:\-—]?\s*/i, '').trim();
    var q = qid ? safe(function () { return CORB.data.byId(qid); }, null) : null;
    if (!q) {
      var probe = head || t;
      var hits = safe(function () { return CORB.data.search(probe, { limit: 4, types: ['Question'] }) || []; }, []);
      if (hits.length && hits[0].ref) q = hits[0].ref;
    }
    if (!mine && q) mine = str(CORB.get('progress.notes.' + q.id, ''));
    return { q: q, mine: mine, prompt: head || t };
  }

  function modelAnswerFor(q) {
    if (!q) return '';
    var body = str(q.answer).trim();
    if (!body) {
      var kp = arr(q.key_points);
      if (kp.length) body = kp.map(function (k) { return '- ' + str(k); }).join('\n');
    }
    return body;
  }

  function rubricDims() {
    var r = safe(function () { return CORB.scoring.rubric(); }, null);
    return arr(r && r.dimensions).filter(function (d) { return d && d.name; });
  }

  // ------------------------------------------------------- answer builders
  // An offline reply is assembled (outside this file) from labelled parts joined by blank lines: closest questions,
  // primers, thresholds, terms, then a generic footer. Pull a "Terms: …" part to the front so a direct definition
  // leads the reply when there is one, and drop that footer — the page header already says "offline" once. This
  // only reshuffles how a stored reply is displayed; text that doesn't match the shape passes through unchanged.
  function offlineLead(text) {
    var parts = str(text).split('\n\n');
    if (parts.length < 2) return text;
    parts = parts.filter(function (p) { return !/^Offline mentor: this is retrieved/i.test(p.trim()); });
    for (var i = 1; i < parts.length; i++) {
      if (/^Terms:/i.test(parts[i].trim())) { var t = parts.splice(i, 1)[0]; parts.unshift(t); break; }
    }
    return parts.join('\n\n');
  }

  function offlineExplain(question) {
    var res = safe(function () { return CORB.connector.offlineAnswer(question); }, null);
    if (!res) return { text: 'The offline mentor could not read the repository. Reload the app, or open the Question library to search by hand.', sources: [] };
    return { text: str(res.text), sources: sourcesFrom(res.sources) };
  }

  function offlineCritiqueMsg(text, qid) {
    var p = parseCritique(text, qid);
    var sources = p.q ? [{ type: 'Question', title: str(p.q.question).slice(0, 160), view: 'library', params: { id: p.q.id } }] : [];
    return {
      id: uid(), role: 'assistant', ts: nowIso(), kind: 'critique', mode: 'offline',
      qid: p.q ? p.q.id : '', mine: p.mine, prompt: p.prompt,
      text: p.q ? 'Here is the model answer beside yours, with the board rubric anchors. Read both aloud and mark where yours drifts.'
                : 'I could not match that to a question in the bank, so there is no model answer to set beside yours. The rubric anchors below still apply — score yourself against them, then open the Question library and search for the rule you were asked about.',
      sources: sources
    };
  }

  function quizMsg(text) {
    var pick = pickQuiz(text);
    if (!pick.q) {
      return {
        id: uid(), role: 'assistant', ts: nowIso(), kind: 'note', mode: 'offline',
        text: 'There are no questions in the bank for the organization you are filtered to, so I have nothing to ask you. Switch the organization in the top bar to "All", or open the Question library to check what loaded.',
        sources: []
      };
    }
    return {
      id: uid(), role: 'assistant', ts: nowIso(), kind: 'quiz', mode: 'offline',
      qid: pick.q.id, revealed: false, domain: pick.domain || str(pick.q.domain),
      text: 'Answer this out loud in 60 to 90 seconds — rule, citation, how it applies, then the risk. Reveal when you are done.',
      sources: [{ type: 'Question', title: str(pick.q.question).slice(0, 160), view: 'library', params: { id: pick.q.id } }]
    };
  }

  function critiquePrompt(text, qid) {
    var p = parseCritique(text, qid);
    var dims = rubricDims();
    var lines = ['Critique my board answer against the CORB rubric. Score each dimension 1-5, quote what I got right, name what a board member would probe, and give the corrected answer in board voice with RFO citations.'];
    if (dims.length) lines.push('Rubric dimensions: ' + dims.map(function (d) { return str(d.name) + ' (' + str(d.description) + ')'; }).join(' | '));
    lines.push('QUESTION: ' + (p.q ? str(p.q.question) : p.prompt));
    if (p.q && modelAnswerFor(p.q)) lines.push('REPOSITORY MODEL ANSWER: ' + modelAnswerFor(p.q));
    lines.push('MY ANSWER: ' + (p.mine || '(the candidate did not write an answer — say so and give the model answer instead)'));
    return { prompt: lines.join('\n\n'), q: p.q };
  }

  function historyFor() {
    return thread().slice(-HISTORY).filter(function (m) { return str(m.text).trim() && (m.role === 'user' || m.role === 'assistant'); })
      .map(function (m) { return { role: m.role === 'assistant' ? 'assistant' : 'user', content: str(m.text).slice(0, 4000) }; });
  }

  // ------------------------------------------------------------- sending
  function send(text, forced) {
    text = str(text).trim();
    if (!text || pending) return;
    var m = forced || mode();
    var cid = (R && R.critiqueId) ? R.critiqueId : '';   // set by ?critique= or the "Grade my answer" action
    if (R) R.critiqueId = '';
    pushMsg({ id: uid(), role: 'user', ts: nowIso(), text: text, mode: m });
    if (R && R.input) { R.input.value = ''; autoGrow(); }
    drawThread();

    if (m === 'quiz') { finish(quizMsg(text)); return; }

    pending = true; paintSending(); showTyping();

    if (!configured()) {
      var res = m === 'critique' ? null : offlineExplain(text);
      window.setTimeout(function () {
        finish(m === 'critique' ? offlineCritiqueMsg(text, cid)
                                : { id: uid(), role: 'assistant', ts: nowIso(), kind: 'answer', mode: 'offline', text: res.text, sources: res.sources });
      }, 220);
      return;
    }

    var ask = m === 'critique' ? critiquePrompt(text, cid).prompt : text;
    var p = safe(function () { return CORB.connector.mentor(ask, historyFor()); }, null);
    if (!p || typeof p.then !== 'function') { finish(fallbackMsg(text, m, 'The connector did not start a request.', cid)); return; }
    p.then(function (res) {
      res = res || {};
      finish({
        id: uid(), role: 'assistant', ts: nowIso(), kind: 'answer', mode: 'llm',
        provider: providerLabel(), model: modelLabel(),
        text: str(res.text).trim() || 'The endpoint answered with an empty message. Try again, or rephrase the question.',
        sources: sourcesFrom(res.sources)
      });
    }, function (err) {
      finish(fallbackMsg(text, m, str(err && err.message) || 'The endpoint could not be reached.', cid));
    });
  }

  function fallbackMsg(text, m, reason, cid) {
    var notice = 'The AI endpoint did not answer, so this came from the offline repository instead. ' + reason;
    if (m === 'critique') { var msg = offlineCritiqueMsg(text, cid); msg.notice = notice; return msg; }
    var res = offlineExplain(text);
    return { id: uid(), role: 'assistant', ts: nowIso(), kind: 'answer', mode: 'offline', text: res.text, sources: res.sources, notice: notice };
  }

  function finish(msg) {
    pending = false;
    hideTyping();
    pushMsg(msg);
    paintSending();
    drawThread();
  }

  // ---------------------------------------------------------- thread view
  function scrollToEnd() {
    if (!R || !R.log) return;
    var last = R.log.lastElementChild;
    if (last && last.scrollIntoView) { try { last.scrollIntoView({ block: 'nearest' }); } catch (e) { last.scrollIntoView(); } }
  }

  function modeBadge(msg) {
    if (msg.mode === 'llm') return h('span.badge.rfo-updated.men-mode', {}, icon('spark'), (msg.provider || 'AI endpoint') + (msg.model ? ' · ' + msg.model : ''));
    return h('span.badge.neutral.men-mode', {}, icon('layers'), 'Offline retrieval');
  }

  // One source: a clickable title row (opens it in the app) plus its word-safe preview, with a longer excerpt
  // available behind "Show excerpt" when there is more to it than the preview already shows.
  function sourceCard(s) {
    var excerptEl = s.full ? h('p.small.muted.men-source-excerpt.men-source-full', { hidden: true }, s.full) : null;
    var toggle = excerptEl ? h('button.btn.xs.ghost.men-show-excerpt', {
      type: 'button', onclick: function () {
        excerptEl.hidden = !excerptEl.hidden;
        toggle.textContent = excerptEl.hidden ? 'Show excerpt' : 'Hide excerpt';
      }
    }, 'Show excerpt') : null;
    return h('div.men-source', {},
      h('button.men-source-open', { type: 'button', onclick: function () { safe(function () { CORB.go(s.view || 'library', s.params || {}); }); } },
        h('span.badge.neutral.men-source-type', {}, s.type),
        h('span.men-source-title', {}, s.title || 'Open'),
        icon('chevron-right')),
      s.preview ? h('p.small.muted.men-source-excerpt', {}, s.preview) : null,
      excerptEl, toggle);
  }

  function sourceList(msg) {
    var list = arr(msg.sources);
    if (!list.length) return null;
    var shown = list.slice(0, 3), rest = list.slice(3);
    var wrap = h('div.men-sources', {},
      h('div.men-sources-lbl', {}, 'Sources in this app'),
      h('div.men-source-items', {}, shown.map(sourceCard)));
    if (rest.length) {
      var restBox = h('div.men-source-items.men-more-sources', { hidden: true }, rest.map(sourceCard));
      var moreBtn = h('button.btn.xs.ghost.men-more-toggle', {
        type: 'button', onclick: function () {
          restBox.hidden = !restBox.hidden;
          moreBtn.lastChild.textContent = restBox.hidden ? ('More sources (' + rest.length + ')') : 'Fewer sources';
        }
      }, icon('chevron-down'), h('span', {}, 'More sources (' + rest.length + ')'));
      wrap.appendChild(moreBtn);
      wrap.appendChild(restBox);
    }
    return wrap;
  }

  // A long reply (mainly a multi-part offline answer) is clamped to roughly one screen with a fade, and a button
  // to see the rest — measured after the rich text is in the DOM, so it only appears when it is actually needed.
  function clampLongReply(el) {
    if (!el) return;
    requestAnimationFrame(function () {
      if (!el.parentNode || el.scrollHeight <= 420) return;
      el.classList.add('men-clamp');
      var btn = h('button.btn.sm.ghost.men-more', {
        type: 'button', onclick: function () {
          var open = el.classList.toggle('men-clamp-open');
          btn.innerHTML = '';
          btn.appendChild(icon(open ? 'chevron-up' : 'chevron-down'));
          btn.appendChild(h('span', {}, open ? 'Show less' : 'Show full answer'));
        }
      }, icon('chevron-down'), h('span', {}, 'Show full answer'));
      el.parentNode.insertBefore(btn, el.nextSibling);
    });
  }

  function quizBody(msg) {
    var q = safe(function () { return CORB.data.byId(msg.qid); }, null);
    if (!q) return h('div.men-note', {}, 'That question is no longer in the bank on this device.');
    var wrap = h('div.men-quiz');
    if (msg.domain) wrap.appendChild(h('div.men-quiz-dom', {}, icon('target'), h('span', {}, msg.domain)));
    wrap.appendChild(safe(function () { return ui.questionCard(q, { showAnswer: !!msg.revealed, actions: false }); }, h('div.men-note', {}, str(q.question))));
    var acts = h('div.men-quiz-acts', {},
      msg.revealed ? null : h('button.btn.sm.primary', {
        type: 'button', onclick: function () {
          msg.revealed = true;
          safe(function () { CORB.set('progress.seen.' + q.id, CORB.util.today()); });
          replaceMsg(msg); drawThread();
        }
      }, icon('eye'), 'Reveal the answer'),
      h('button.btn.sm', { type: 'button', onclick: function () { safe(function () { CORB.go('library', { id: q.id }); }); } }, icon('book'), 'Open in the library'),
      h('button.btn.sm.ghost', {
        type: 'button', onclick: function () {
          setMode('critique'); paintModes();
          R.critiqueId = q.id;
          if (R.input) { R.input.value = 'Grade this answer: ' + str(q.question) + ' — My answer: ' + str(CORB.get('progress.notes.' + q.id, '')); autoGrow(); R.input.focus(); }
        }
      }, icon('scale'), 'Grade my answer'),
      h('button.btn.sm.ghost', { type: 'button', onclick: function () { send('Quiz me on ' + (msg.domain || str(q.domain)), 'quiz'); } }, icon('refresh'), 'Another one'));
    wrap.appendChild(acts);
    return wrap;
  }

  function critiqueBody(msg) {
    var q = msg.qid ? safe(function () { return CORB.data.byId(msg.qid); }, null) : null;
    var model = modelAnswerFor(q);
    var wrap = h('div.men-critique');
    if (q) wrap.appendChild(h('div.men-crit-q', {}, h('div.eyebrow', {}, 'The question'), h('p', {}, str(q.question))));
    wrap.appendChild(h('div.men-crit-cols', {},
      h('div.men-crit-col.mine', {},
        h('div.men-crit-head', {}, icon('user'), h('span', {}, 'Your answer')),
        str(msg.mine).trim() ? ui.rich(msg.mine)
          : h('p.muted.small', {}, 'You have not written an answer for this one yet. Say it out loud, then type it here or save it in the question\'s notes and ask again.')),
      h('div.men-crit-col.model', {},
        h('div.men-crit-head', {}, icon('award'), h('span', {}, 'Model answer'), q ? ui.badge(str(q.answer_status) || 'open') : null),
        model ? ui.rich(model)
          : h('p.muted.small', {}, q ? 'This question is open in the repository — no formal answer has been recorded. Draft one, then have a mentor confirm it.'
                                    : 'No matching question, so there is nothing to compare against.'))));
    var dims = rubricDims();
    if (dims.length) {
      wrap.appendChild(h('div.men-rubric', {},
        h('div.men-rubric-lbl', {}, 'Score yourself against the board rubric'),
        h('div.men-rubric-grid', {}, dims.map(function (d) {
          var a = (d.anchors && typeof d.anchors === 'object') ? d.anchors : {};
          return h('div.men-rubric-item', {},
            h('div.men-rubric-name', {}, str(d.name)),
            d.description ? h('div.men-rubric-desc', {}, str(d.description)) : null,
            a['5'] ? h('div.men-anchor.hi', {}, h('b', {}, '5'), h('span', {}, str(a['5']))) : null,
            a['3'] ? h('div.men-anchor', {}, h('b', {}, '3'), h('span', {}, str(a['3']))) : null,
            a['1'] ? h('div.men-anchor.lo', {}, h('b', {}, '1'), h('span', {}, str(a['1']))) : null);
        }))));
    }
    if (q) {
      wrap.appendChild(h('div.men-quiz-acts', {},
        h('button.btn.sm', { type: 'button', onclick: function () { safe(function () { ui.noteEditor(q); }); } }, icon('note'), 'Edit my note'),
        h('button.btn.sm.ghost', { type: 'button', onclick: function () { safe(function () { CORB.go('library', { id: q.id }); }); } }, icon('book'), 'Open in the library')));
    }
    return wrap;
  }

  function messageEl(msg) {
    if (msg.role === 'user') {
      return h('article.men-msg.user', {},
        h('div.men-avatar', {}, icon('user')),
        h('div.men-bubble', {},
          h('div.men-body', {}, ui.rich(msg.text)),
          h('div.men-foot', {}, h('span.men-time', {}, when(msg.ts)), msg.mode && msg.mode !== 'explain' ? h('span.badge.neutral', {}, modeDef(msg.mode).label) : null)));
    }
    var body = h('div.men-body');
    if (msg.notice) body.appendChild(h('div.callout.warn.men-notice', {}, icon('alert'), h('div', {}, h('b', {}, 'Answered offline'), msg.notice)));
    if (str(msg.text).trim()) {
      var richEl = ui.rich(msg.mode === 'offline' ? offlineLead(msg.text) : msg.text);
      body.appendChild(richEl);
      clampLongReply(richEl);
    }
    if (msg.kind === 'quiz') body.appendChild(quizBody(msg));
    if (msg.kind === 'critique') body.appendChild(critiqueBody(msg));
    var src = sourceList(msg);
    if (src) body.appendChild(src);
    return h('article.men-msg.assistant', {},
      h('div.men-avatar.mentor', {}, icon('spark')),
      h('div.men-bubble', {},
        h('div.men-msg-head', {}, h('span.men-who', {}, 'Mentor'), modeBadge(msg)),
        body,
        h('div.men-foot', {}, h('span.men-time', {}, when(msg.ts)))));
  }

  function starterCards() {
    return h('div.men-starter-cards', {}, STARTERS.map(function (s) {
      return h('button.men-starter-card', { type: 'button', onclick: function () { runStarter(s); } },
        h('span.men-starter-icon', {}, icon(s.icon)),
        h('span.men-starter-text', {}, s.text.trim()),
        h('span.men-starter-mode', {}, modeDef(s.mode).label));
    }));
  }

  function runStarter(s) {
    setMode(s.mode); paintModes();
    R.critiqueId = '';
    if (s.send) { send(s.text.trim(), s.mode); return; }
    if (R.input) { R.input.value = s.text; autoGrow(); R.input.focus(); R.input.setSelectionRange(R.input.value.length, R.input.value.length); }
  }

  function welcome() {
    var n = bankSize();
    return h('div.men-welcome', {},
      h('div.men-welcome-mark', {}, icon('chat')),
      h('h2', {}, 'Ask the way you would answer'),
      h('p.men-welcome-lede', {},
        n ? 'Grounded in the ' + n + ' questions, primers, thresholds and process steps built into this app.'
          : 'The question bank did not load on this device, so the mentor has nothing to retrieve from. Reopen the app file, or ask your facilitator for a current copy. You can still type here — you will just get this notice back.'),
      starterCards());
  }

  function drawThread() {
    if (!R || !R.log) return;
    var list = thread();
    R.log.innerHTML = '';
    R.typing = null;
    if (!list.length) { R.log.appendChild(welcome()); paintClear(); paintStarterRow(); return; }
    list.forEach(function (m) { R.log.appendChild(messageEl(m)); });
    paintClear(); paintStarterRow();
    if (pending) showTyping();
    scrollToEnd();
  }

  // ------------------------------------------------------------ composer
  function autoGrow() {
    if (!R || !R.input) return;
    R.input.style.height = 'auto';
    R.input.style.height = Math.min(220, Math.max(52, R.input.scrollHeight)) + 'px';
  }
  function paintSending() {
    if (!R || !R.sendBtn) return;
    R.sendBtn.disabled = pending;
    R.sendBtn.innerHTML = '';
    R.sendBtn.appendChild(icon(pending ? 'clock' : 'arrow-right'));
    R.sendBtn.appendChild(h('span.hide-sm', {}, pending ? 'Working' : 'Send'));
  }
  function paintModes() {
    if (!R || !R.modeBtns) return;
    var cur = mode();
    R.modeBtns.forEach(function (b) {
      var on = b.getAttribute('data-mode') === cur;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (R.modeHint) R.modeHint.textContent = modeDef(cur).hint;
  }
  function paintClear() {
    if (R && R.clearBtn) R.clearBtn.disabled = !thread().length;
  }
  // Shown around the first question, when a candidate is still finding their footing; collapsed again after that
  // (the welcome cards already covered the empty state, and typing is no harder than tapping a chip by then).
  function paintStarterRow() {
    if (!R || !R.starterRow) return;
    var n = thread().length;
    R.starterRow.hidden = n === 0 || n > 2;
  }
  function showTyping() {
    if (!R || !R.log || R.typing) return;
    R.typing = h('div.men-typing', { 'aria-live': 'polite' },
      h('div.men-avatar.mentor', {}, icon('spark')),
      h('div.men-typing-bubble', {},
        h('span.men-dot'), h('span.men-dot'), h('span.men-dot'),
        h('span.men-typing-label', {}, configured() ? 'Asking ' + providerLabel() + '…' : 'Searching the repository…')));
    R.log.appendChild(R.typing);
    scrollToEnd();
  }
  function hideTyping() { if (R && R.typing) { try { R.typing.remove(); } catch (e) {} R.typing = null; } }

  function composer() {
    R.input = h('textarea.textarea.men-input', {
      rows: '1', placeholder: 'Ask about a rule, a threshold, a Korea procedure — or paste an answer to be graded.',
      'aria-label': 'Message the mentor', spellcheck: 'true',
      oninput: autoGrow,
      onkeydown: function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(R.input.value); }
      }
    });
    R.sendBtn = h('button.btn.primary.men-send', { type: 'button', 'aria-label': 'Send', onclick: function () { send(R.input.value); } });
    paintSending();

    R.modeBtns = MODES.map(function (m) {
      return h('button.men-mode-btn', { type: 'button', 'data-mode': m.id, 'aria-pressed': 'false', onclick: function () { setMode(m.id); paintModes(); if (R.input) R.input.focus(); } },
        icon(m.icon), h('span', {}, m.label));
    });
    R.modeHint = h('span.men-mode-hint');

    R.starterRow = h('div.men-starter-row.scroll-x', { hidden: true },
      STARTERS.map(function (s) {
        return h('button.chip.men-starter-chip', { type: 'button', onclick: function () { runStarter(s); } }, icon(s.icon), h('span', {}, s.text.trim()));
      }));

    var box = h('div.men-composer', {},
      R.starterRow,
      h('div.men-mode-row', {}, h('div.men-mode-group', { role: 'group', 'aria-label': 'Answer style' }, R.modeBtns), R.modeHint),
      h('div.men-input-row', {}, R.input, R.sendBtn),
      h('div.men-composer-foot', {},
        h('span.men-kbd-hint', {}, h('kbd', {}, 'Enter'), ' sends · ', h('kbd', {}, 'Shift'), ' + ', h('kbd', {}, 'Enter'), ' new line'),
        h('span.men-cap', {}, 'Last ' + CAP + ' messages are kept on this device')));
    paintModes();
    return box;
  }

  // ---------------------------------------------------------------- rail
  function connectionCard() {
    var net = CORB.hasConnector();
    if (!net) return null;   // this edition has no connector at all — the page header already says "offline"
    var on = configured();
    var s = connSettings();
    var card = h('section.card.men-conn', {},
      h('div.men-conn-head', {},
        h('span.men-dot-status' + (on ? '.on' : ''), { 'aria-hidden': 'true' }),
        h('h3', {}, on ? 'AI endpoint connected' : 'No endpoint connected'),
        ui.badge(on ? 'rfo-updated' : 'open', on ? 'Live' : 'Offline')),
      h('p.small.muted.men-conn-copy', {},
        on ? 'Explain and Critique go to your endpoint with excerpts from this app attached. If it fails, the answer falls back to the repository and says so.'
           : 'Connect an endpoint in Settings for coached explanations and rubric critiques. Quiz me always draws from the question bank.'));
    if (on) {
      card.appendChild(h('dl.men-conn-facts', {},
        h('div', {}, h('dt', {}, 'Provider'), h('dd', {}, providerLabel())),
        modelLabel() ? h('div', {}, h('dt', {}, 'Model'), h('dd.num', {}, modelLabel())) : null,
        s.baseUrl ? h('div', {}, h('dt', {}, 'Endpoint'), h('dd.num.truncate', { title: str(s.baseUrl) }, str(s.baseUrl))) : null));
    }
    var actions = h('div.men-conn-actions', {},
      h('button.btn.sm' + (on ? '' : '.primary'), { type: 'button', onclick: function () { safe(function () { CORB.go('settings'); }); } }, icon('settings'), 'Configure'));
    if (on) {
      var testBtn = h('button.btn.sm.ghost', {
        type: 'button', onclick: function () {
          testBtn.disabled = true;
          var p = safe(function () { return CORB.connector.test(); }, null);
          if (!p || typeof p.then !== 'function') { testBtn.disabled = false; ui.toast('Could not start the test.', 'danger'); return; }
          p.then(function () { testBtn.disabled = false; ui.toast('Endpoint answered. You are connected.', 'ok'); },
                 function (e) { testBtn.disabled = false; ui.toast(str(e && e.message) || 'The endpoint did not answer.', 'danger'); });
        }
      }, icon('zap'), 'Test');
      actions.appendChild(testBtn);
    }
    card.appendChild(actions);
    return card;
  }

  function railEl() {
    return h('aside.men-rail', { 'aria-label': 'Mentor status' },
      connectionCard(),
      // Said once, quietly: the side menu already carries the app-wide "Training aid" line, so this stays a small
      // note rather than its own heading and full paragraph.
      h('p.small.muted.men-disclaimer-note', {}, icon('shield'),
        h('span', {}, ' Training aid, not authoritative guidance. Answers drawn from AI-drafted items carry their flag on the source card; confirm Korea-specific thresholds and routing with your Chief, Contracting & Policy before you use them.')),
      h('section.card.men-tips', {},
        h('h3', {}, 'Get better answers'),
        h('ul.men-tip-list', {},
          h('li', {}, 'Name the rule or the citation you are unsure about — "bona fide need", "FAR 6.103-1", "cure notice".'),
          h('li', {}, 'Use Quiz me with a domain: "Quiz me on fiscal law" pulls a real board question from that domain.'),
          h('li', {}, 'Open a question in the library, save your answer in its notes, then ask for a critique — your note is pulled in automatically.'))));
  }

  // --------------------------------------------------------------- build
  function build(root) {
    root.appendChild(h('div.page-head.men-head', {},
      h('div.men-head-row', {},
        h('div.men-head-copy', {},
          h('h1', {}, 'Mentor'),
          h('p.lede', {}, 'Explain a rule, quiz you cold, or grade your answer — offline, from this file.')),
        h('div.men-head-actions', {},
          R.clearBtn = h('button.btn.sm.ghost.men-clear', {
            type: 'button', onclick: function () {
              var p = safe(function () { return ui.confirm('Clear this conversation? The messages are removed from this device and cannot be recovered.', { title: 'Clear conversation', ok: 'Clear', danger: true }); }, null);
              if (!p || typeof p.then !== 'function') return;
              p.then(function (yes) {
                if (!yes) return;
                saveThread([]);
                R.critiqueId = '';
                drawThread();
                ui.toast('Conversation cleared', 'ok');
              });
            }
          }, icon('trash'), h('span', {}, 'Clear conversation'))))));

    R.log = h('div.men-log', { role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
    var col = h('div.men-col', {}, R.log, composer());
    root.appendChild(h('div.men-grid', {}, col, railEl()));

    paintClear();
    drawThread();

    unsub.push(safe(function () {
      return CORB.on('change', function (e) {
        if (!R || !R.log || !e || !e.path) return;
        if (String(e.path).indexOf('settings.connector') === 0) {
          var rail = R.log.parentNode && R.log.parentNode.parentNode && R.log.parentNode.parentNode.querySelector('.men-rail');
          if (rail && rail.parentNode) rail.parentNode.replaceChild(railEl(), rail);
        }
      });
    }, null));
  }

  function leave() {
    unsub.forEach(function (u) { if (typeof u === 'function') { try { u(); } catch (e) {} } });
    unsub = [];
    hideTyping();
    pending = false;
    R = null;
  }

  CORB.registerView({
    id: 'mentor', title: 'Mentor', icon: 'chat', section: 'Practice', order: 150, nav: true, mobile: true, short: 'Mentor',
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || {};
      R = { critiqueId: '' };
      if (p.mode) { var want = String(p.mode); for (var i = 0; i < MODES.length; i++) { if (MODES[i].id === want) setMode(want); } }

      var critiqueId = str(p.critique).trim();
      var q = str(p.q).trim();

      build(root);

      if (critiqueId) {
        var qq = safe(function () { return CORB.data.byId(critiqueId); }, null);
        R.critiqueId = critiqueId;
        setMode('critique'); paintModes();
        if (R.input) {
          R.input.value = qq
            ? 'Critique my answer to: ' + str(qq.question) + ' — My answer: ' + str(CORB.get('progress.notes.' + critiqueId, ''))
            : 'Critique my answer to question ' + critiqueId + ' — My answer: ';
          autoGrow();
          window.setTimeout(function () { if (R && R.input) { R.input.focus(); R.input.setSelectionRange(R.input.value.length, R.input.value.length); } }, 40);
        }
        return;
      }

      if (q) {
        // send once: a re-render of the same route (theme toggle, role switch) must not ask twice
        var list = thread(), asked = false;
        for (var j = list.length - 1; j >= 0; j--) { if (list[j].role === 'user') { asked = str(list[j].text).trim() === q; break; } }
        if (R.input) { R.input.value = asked ? '' : q; autoGrow(); }
        if (!asked) window.setTimeout(function () { if (R && R.input) send(q); }, 60);
      }
    },
    onLeave: leave
  });
})();
