/* CORE-06B-CONNECTOR-NETWORK — the optional AI endpoint for the mentor: provider presets, the system prompt and the only
   fetch() in the app. tools/build.py leaves this file out of the offline candidate edition. */
(function () {
  'use strict';
  var CORB = window.CORB, cx = CORB.connector;
  if (!cx) return;
  cx.online = true;

  cx.PROVIDERS = [
    { id: 'openai', name: 'OpenAI-compatible (chat.genai, Azure, Ollama, vLLM, OpenRouter…)', hint: 'Base URL ends before /chat/completions, e.g. https://host/v1', defaultModel: 'gpt-4o' },
    { id: 'anthropic', name: 'Anthropic (Claude)', hint: 'Base URL https://api.anthropic.com', defaultModel: 'claude-sonnet-5' },
    { id: 'gemini', name: 'Google Gemini (generateContent)', hint: 'Base URL https://generativelanguage.googleapis.com', defaultModel: 'gemini-2.5-flash' }
  ];
  cx.systemPrompt = function () {
    var meta = CORB.DATA.meta || {};
    return 'You are a warrant-board mentor for U.S. Army contracting professionals (411th Contracting Support Brigade, Korea) preparing for a Contracting Officer Review Board. ' +
      'Answer the way a seasoned contracting officer coaches a candidate: direct, structured, board-ready, citing the Revolutionary FAR Overhaul (RFO) numbering in effect since 1 Feb 2026, DFARS, AFARS, statutes, and the Army Warranting Program Policy v12. ' +
      'Use the GROUNDING excerpts first; if they do not cover the question, say so and answer from general knowledge with lower confidence. Never invent local 411th thresholds or names; say "confirm with C&P" for Korea-specific procedure. ' +
      'End with a "Cite:" line and, when useful, a one-line "Board tip:". This is a training aid, not legal advice. Keep answers under 300 words unless asked for depth.';
  };
  cx.ask = function (messages, o) {
    o = o || {};
    var s = cx.settings();
    if (!cx.configured()) return Promise.reject(new Error('No AI connector configured. Open Settings to connect Army chat.genai, Claude, or another endpoint. The offline mentor still works.'));
    var sys = o.system || cx.systemPrompt();
    var headers = { 'Content-Type': 'application/json' };
    try { if (s.headers) Object.assign(headers, JSON.parse(s.headers)); } catch (e) {}
    var url, body;
    var base = String(s.baseUrl || '').replace(/\/+$/, '');
    if (s.provider === 'anthropic') {
      url = base + '/v1/messages';
      headers['x-api-key'] = s.apiKey; headers['anthropic-version'] = '2023-06-01'; headers['anthropic-dangerous-direct-browser-access'] = 'true';
      body = { model: s.model, max_tokens: o.maxTokens || 1200, system: sys, messages: messages.map(function (m) { return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }; }) };
    } else if (s.provider === 'gemini') {
      url = base + '/v1beta/models/' + encodeURIComponent(s.model) + ':generateContent?key=' + encodeURIComponent(s.apiKey);
      body = { systemInstruction: { parts: [{ text: sys }] }, contents: messages.map(function (m) { return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }; }), generationConfig: { maxOutputTokens: o.maxTokens || 1200 } };
    } else {
      url = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
      if (s.apiKey) headers['Authorization'] = 'Bearer ' + s.apiKey;
      body = { model: s.model, max_tokens: o.maxTokens || 1200, messages: [{ role: 'system', content: sys }].concat(messages.map(function (m) { return { role: m.role, content: m.content }; })) };
    }
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null; var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, o.timeout || 60000) : null;
    return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        if (!r.ok) throw new Error('Endpoint returned ' + r.status + (j && (j.error && (j.error.message || j.error)) ? ': ' + (j.error.message || JSON.stringify(j.error)) : t ? ': ' + t.slice(0, 200) : ''));
        if (!j) throw new Error('Endpoint returned a non-JSON response.');
        if (s.provider === 'anthropic') return (j.content || []).map(function (c) { return c.text || ''; }).join('');
        if (s.provider === 'gemini') return (((j.candidates || [])[0] || {}).content || {}).parts ? j.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('') : '';
        var ch = (j.choices || [])[0]; return ch ? (ch.message && ch.message.content) || ch.text || '' : '';
      });
    }).catch(function (e) { if (timer) clearTimeout(timer); if (e.name === 'AbortError') throw new Error('The endpoint did not answer within 60 seconds.'); if (/Failed to fetch|NetworkError|Load failed/i.test(String(e.message))) throw new Error('Could not reach the endpoint. On NIPR this is expected; on the internet check the base URL, key, and that the service allows browser requests (CORS).'); throw e; });
  };

  cx.mentor = function (question, history) {
    var g = cx.grounding(question, 6);
    var groundingText = g.length ? 'GROUNDING (from the app\'s repository):\n' + g.map(function (x, i) { return '[' + (i + 1) + '] (' + x.type + ') ' + x.body; }).join('\n\n') : 'GROUNDING: none found.';
    var messages = (history || []).slice(-6).concat([{ role: 'user', content: groundingText + '\n\nQUESTION: ' + question }]);
    return cx.ask(messages).then(function (text) { return { text: text, sources: g, mode: 'llm' }; });
  };

  cx.test = function () { return cx.ask([{ role: 'user', content: 'Reply with the single word READY.' }], { maxTokens: 20, system: 'You are a connectivity test.' }); };
})();
