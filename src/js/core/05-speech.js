/* CORE-05-SPEECH — offline read-aloud through the browser's speechSynthesis; a quiet no-op where it is missing.
   Voices: the device's own (Apple's Enhanced and Premium voices, Google's and Samsung's on Android, Microsoft's natural
   voices in Edge). sp.voices() lists the English ones, best first; the reader picks one in Settings (settings.voice) or
   gets the best one by default.
   Delivery: sp.segments() turns text into the pieces a person would say, each with its own tone. Questions rise,
   statements fall, a heading comes a little slower with a breath after it, a short list is said in one breath with
   "and", a long one item by item, a paragraph ends with a longer pause and the last sentence settles down. Each piece
   is its own utterance with its own pitch and pace (settings.ttsTone 'lively', the default; 'even' keeps one tone)
   and a real pause after it, so even a plain voice has rhythm; a natural voice follows the punctuation on its own.
   Words: acronyms are spelled or said the way contracting people say them (K O, "core", "eye-tass", "see-pars"),
   cites read "fifteen point four oh four dash one", course numbers "thirteen hundred V", markdown becomes pauses. */
(function () {
  'use strict';
  var CORB = window.CORB;
  var synth = window.speechSynthesis || null;
  var sp = CORB.speech = { available: !!(synth && window.SpeechSynthesisUtterance), speaking: false, voice: null };

  // ---- voices ----
  var NATURAL = /natural|neural|premium|enhanced|\bonline\b/i;
  var GOOD = /\b(Google|Siri|Samantha|Ava|Zoe|Evan|Allison|Nicky|Aria|Jenny|Guy|Emma|Andrew|Brian|Sonia|Ryan|Libby|Michelle|Jane|Ana|Christopher|Eric|Steffan|Roger)\b/i;
  var POOR = /espeak|compact|Microsoft (David|Zira|Mark|Hazel|George|Susan|Catherine|James|Richard)( Desktop)?$/i;
  function score(v) {
    var s = 0, n = v.name || '', l = v.lang || '';
    if (NATURAL.test(n)) s += 6;
    if (GOOD.test(n)) s += 3;
    if (POOR.test(n)) s -= 2;
    if (/^en[-_]?US/i.test(l)) s += 2; else if (/^en/i.test(l)) s += 1; else s -= 10;
    return s;
  }
  function region(l) { var m = { US: 'US', GB: 'UK', AU: 'Australia', IN: 'India', CA: 'Canada', IE: 'Ireland', NZ: 'New Zealand', ZA: 'South Africa' }; var c = (String(l || '').split(/[-_]/)[1] || '').toUpperCase(); return m[c] || c || ''; }
  function label(v) {
    var n = String(v.name || '').replace(/^Microsoft /, '').replace(/^Google /, 'Google ').replace(/\s*Online\s*/, ' ').replace(/\s*\(?Natural\)?/i, ' (Natural)').replace(/\s+/g, ' ').replace(/ - English .*$/, '').trim();
    var r = region(v.lang);
    return n + (r && n.indexOf(r) < 0 ? ' · ' + r : '');
  }
  function all() { try { return (synth && synth.getVoices()) || []; } catch (e) { return []; } }
  // the English voices this device has, best first: {id, name, natural, lang, voice}
  sp.voices = function () {
    return all().map(function (v) { return { id: v.voiceURI || v.name, name: label(v), natural: NATURAL.test(v.name) || /Google|Siri/i.test(v.name), lang: v.lang, s: score(v), voice: v }; })
      .filter(function (x) { return x.s > -5; }).sort(function (a, b) { return b.s - a.s || a.name.localeCompare(b.name); });
  };
  function pickVoice() {
    var list = sp.voices(); if (!list.length) return null;
    var want = CORB.get ? CORB.get('settings.voice', '') : '';
    var chosen = want ? list.filter(function (x) { return x.id === want; })[0] : null;
    return (chosen || list[0]).voice;
  }
  sp.current = function () { sp.voice = pickVoice(); return sp.voice; };
  sp.setVoice = function (id) { CORB.set('settings.voice', id || ''); sp.voice = pickVoice(); };
  if (synth) {
    try { synth.onvoiceschanged = function () { sp.voice = pickVoice(); CORB.emit('voices'); }; } catch (e) {}
    setTimeout(function () { sp.voice = pickVoice(); }, 250);
  }

  // ---- words: said the way people say them ----
  // said as a word, or as contracting people say it (everything else in capitals is spelled out)
  var SAY = { AITAS: 'eye-tass', DACM: 'dack-em', WarU: 'War U', DAU: 'D A U', 'J&A': 'J and A', 'T&M': 'T and M', 'Q&A': 'Q and A', 'D&F': 'D and F', 'O&M': 'O and M', 'G&A': 'G and A', 'R&D': 'R and D', 'A&S': 'A and S', 'RDT&E': 'R D T and E',
    DoW: 'Department of War', DoD: 'D O D', DoDI: 'D O D I', DoDD: 'D O D D', eCFR: 'e C F R',
    KO: 'K O', KOs: "K O's", COR: 'core', CORs: 'cores', PWS: 'P W S', SOW: 'S O W', IGCE: 'I G C E', PIID: 'pid', PIIDs: 'pids', CLIN: 'clin', CLINs: 'clins', SLIN: 'slin', UCF: 'U C F',
    CAC: 'cack', NIPR: 'nipper', SIPR: 'sipper', FOB: 'fob', OnVUE: 'on view', VUE: 'view', RFO: 'R F O', FFP: 'F F P', CPFF: 'C P F F', IDIQ: 'I D I Q', GSA: 'G S A', GSAR: 'G sar', SBA: 'S B A', OJT: 'O J T',
    NCO: 'N C O', NCOs: "N C O's", MOS: 'M O S', MPT: 'M P T', SAT: 'S A T', PALT: 'palt', NAICS: 'nakes', SAM: 'sam', CAGE: 'cage', GAO: 'G A O', WAWF: 'wawf', PIEE: 'P I E E',
    FPDS: 'F P D S', CAMP: 'camp', IDP: 'I D P', CLP: 'C L P', CLPs: "C L P's", FAR: 'far', DFARS: 'dee-fars', AFARS: 'ay-fars', FAC: 'F A C', FAQ: 'F A Q', PDF: 'P D F', QR: 'Q R',
    CON: 'con', ATRRS: 'atters', CONUS: 'konus', OCONUS: 'oh-konus', DAWIA: 'da-wee-ah', COTS: 'cots', CICA: 'sika', SBIR: 'sibber', KMG: 'K M G', CCON: 'C con', FIT: 'fit',
    CPARS: 'see-pars', DPCAP: 'D P cap', GFEBS: 'gee-febs', TINA: 'tina', QASP: 'kwasp', JAM: 'jam', SPOT: 'spot', FOO: 'foo', BATNA: 'bat-na', FOIA: 'foy-ah', SPRS: 'spurs', GAAP: 'gap',
    MICC: 'mick', SOFA: 'sofa', DFAS: 'dee-fass', GWAC: 'gee-wack', MIPR: 'mipper', DUNS: 'duns', PIN: 'pin', HVAC: 'H vack', NASA: 'nasa', NARA: 'nara', CTIP: 'see-tip', DASA: 'dah-sa', MAC: 'mack', CORB: 'corb', OK: 'okay',
    B2B: 'B to B', '51C': 'fifty-one charlie', '51Cs': 'fifty-one charlies', '1102': 'eleven oh two', '1102s': 'eleven oh twos', 'e.g.': 'for example', 'i.e.': 'that is', 'vs.': 'versus', 'U.S.': 'U S', 'U.S.C.': 'U S code' };
  var SAY_RE = new RegExp('(^|[^A-Za-z0-9&])(' + Object.keys(SAY).sort(function (a, b) { return b.length - a.length; }).map(function (k) { return k.replace(/[.&]/g, '\\$&'); }).join('|') + ')(?=$|[^A-Za-z0-9&])', 'g');
  var WORDS = /^(NOT|FIRST|BEST|MOST|OR|AS|ALL|NEW|NO|YES|ONLY|NEVER|ALWAYS|FREE|EVERY|MUST|AND|BUT)$/;   // capitals for emphasis stay words
  var ROMAN = { I: 'one', II: 'two', III: 'three', IV: 'four' };
  function words(t) {
    t = t.replace(/\*\*|__|`/g, '').replace(/§\s*/g, 'section ').replace(/\s*→\s*/g, ' to ').replace(/\s*·\s*/g, ', ').replace(/\s+\/\s+/g, ' or ')
      .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+[–—]\s+/g, ', ').replace(/(\d)\s*–\s*(\d)/g, '$1 to $2');
    t = t.replace(/[ \t]*\(([^()\n]{1,90})\)/g, function (m, a) { return ', ' + a.trim() + ','; });                 // (KMG) becomes an aside between commas
    t = t.replace(/\bNo\.\s*(?=\d)/g, 'number ').replace(/\bpara\.\s*/gi, 'paragraph ').replace(/\bSec\.\s*/g, 'section ').replace(/\bapprox\.\s*/gi, 'approximately ')
      .replace(/\betc\.?/g, 'et cetera').replace(/\.(gov|mil|com|org|net)\b/gi, ' dot $1');
    t = t.replace(/\bCON (\d)(\d)00(V?)\b/g, 'CON $1$2 hundred $3').replace(/\b(\d{2})(\d{2})V\b/g, '$1 $2 V').replace(/\bFY ?(\d{2})\b/g, 'F Y $1');   // CON 1300V: thirteen hundred V; 3990V: thirty-nine ninety V
    t = t.replace(/\b(Part|Level|Phase|Tier|Type|Class) (I{1,3}|IV)\b/g, function (m, a, r) { return a + ' ' + ROMAN[r]; }).replace(/\bTable (\d+)-(\d+)/g, 'Table $1 dash $2');
    // cites and decimals: 15.404-1 is "fifteen point four oh four dash one"; 13.5 stays "thirteen point five"
    t = t.replace(/(\d)\.(\d+)(?:-(\d+))?/g, function (m, a, f, d) { return a + ' point ' + (f.length >= 3 ? f.split('').map(function (x) { return x === '0' ? 'oh' : x; }).join(' ') : f) + (d ? ' dash ' + d : ''); });
    t = t.replace(SAY_RE, function (m, pre, k) { return pre + SAY[k]; });
    t = t.replace(/\b([A-Z]{2,5})(s?)\b/g, function (m, a, s) { return WORDS.test(a) ? a.toLowerCase() + s : a.split('').join(' ') + (s ? "'s" : ''); });   // anything else in capitals is spelled out
    return t.replace(/[ \t]+/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/,([.;:!?])/g, '$1').replace(/,\s*,/g, ',').replace(/ *\n */g, '\n');
  }

  // ---- phrasing: the pieces a person would say, each with its own tone ----
  var QWORD = /^(who|whom|whose|what|when|where|why|which|how(?! to\b)|is|are|do|does|did|can|could|should|will|would|was|were|has|have|may|must)\b/i;
  function endMark(s) { return /[.!?;:]$/.test(s) ? s : s + '.'; }
  function sentences(s) {   // a paragraph into sentences, keeping the end marks; a very short one ("Step 1.") joins the next
    var parts = s.match(/[^.!?]+[.!?]*\s*/g) || [s], out = [], cur = '';
    parts.forEach(function (p) { p = p.trim(); if (!p) return; if (cur && cur.length <= 12) cur += ' ' + p; else { if (cur) out.push(cur); cur = p; } });
    if (cur) out.push(cur);
    return out;
  }
  function splitLong(s) {   // a very long sentence breaks at a comma near the middle
    var out = [];
    while (s.length > 230) { var i = s.lastIndexOf(', ', 200); if (i < 60) i = s.indexOf(', ', 200); if (i < 0 || i > s.length - 30) break; out.push(s.slice(0, i + 1)); s = s.slice(i + 2); }
    out.push(s); return out;
  }
  // text -> [{ text, kind, pitch, rate, pause }]: kind is head, say, item, list or question; pitch and rate are
  // multipliers for the reader's speed; pause is the silence after the piece, in milliseconds
  sp.segments = function (text) {
    var lines = words(String(text == null ? '' : text).replace(/\r/g, '')).split('\n'), blocks = [], segs = [], i, m, first = true;
    for (i = 0; i < lines.length; i++) {
      var s = lines[i].trim();
      if (!s) { blocks.push({ k: 'gap' }); continue; }
      var title = first; first = false;
      if ((m = s.match(/^#{1,6}\s+(.+)$/))) { blocks.push({ k: 'head', t: m[1].trim() }); continue; }
      if ((m = s.match(/^(?:[-*•]|\d{1,2}[.)])\s+(.+)$/))) { blocks.push({ k: 'item', t: m[1].trim() }); continue; }
      if (/^[A-D]:\s/.test(s)) { blocks.push({ k: 'item', t: s }); continue; }                                      // answer choices
      var more = lines.slice(i + 1).some(function (x) { return x.trim(); });
      if (title && more && s.length <= 70 && !/[.!?;:,]$/.test(s)) { blocks.push({ k: 'head', t: s }); continue; }   // a short first line with no end mark, then more text: the title
      if (!/[.!?;:]$/.test(s) && QWORD.test(s) && s.split(' ').length >= 3) s += '?';
      blocks.push({ k: 'para', t: endMark(s) });
    }
    function push(txt, kind, x) { txt = txt.replace(/^[\s.,;:]+/, '').trim(); if (!txt) return; var o = { text: txt, kind: kind }; if (x) for (var k in x) o[k] = x[k]; segs.push(o); }
    function tail(k, v) { if (segs.length) segs[segs.length - 1][k] = v; }
    for (i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.k === 'gap') { tail('gap', true); continue; }
      if (b.k === 'head') { push(endMark(b.t), 'head'); continue; }
      if (b.k === 'item') {
        var run = [b]; while (blocks[i + 1] && blocks[i + 1].k === 'item') run.push(blocks[++i]);
        if (run.length > 1 && run.every(function (x) { return x.t.length <= 48 && !/[.!?;:]/.test(x.t); })) {   // short items: one breath, "a, b, and c"
          var ts = run.map(function (x) { return x.t.replace(/[,.]$/, ''); });
          push((ts.length > 2 ? ts.slice(0, -1).join(', ') + ', and ' : ts[0] + ' and ') + ts[ts.length - 1] + '.', 'list', { end: true });
          continue;
        }
        run.forEach(function (x, j) { var ss = sentences(endMark(x.t)); ss.forEach(function (s, k) { push(s, 'item', { last: j === run.length - 1 && k === ss.length - 1 }); }); });
        tail('end', true);
        continue;
      }
      var ss = sentences(b.t);
      ss.forEach(function (s, k) { splitLong(s).forEach(function (p, q, arr) { push(p, 'say', { first: k === 0 && q === 0, end: k === ss.length - 1 && q === arr.length - 1 }); }); });
    }
    var cyc = 0, n = segs.length;
    segs.forEach(function (s, idx) {
      var t = s.text, last = idx === n - 1, p = 1, r = 1, pause = 130;
      if (s.kind === 'head') { p = 1.04; r = 0.92; pause = 420; }
      else if (/\?$/.test(t)) { s.kind = 'question'; p = 1.08; pause = 260; }
      else if (/!$/.test(t)) { p = 1.06; r = 1.04; pause = 260; }
      else if (/:$/.test(t)) { p = 1.04; r = 0.98; pause = 240; }
      else if (s.kind === 'list') { p = 0.98; pause = 300; }
      else if (s.kind === 'item') { p = s.last ? 0.97 : 1.02; pause = s.last ? 300 : 170; }
      else { p = [1, 1.03, 0.98][cyc++ % 3] + (s.first ? 0.02 : 0); pause = s.end ? 320 : 130; }
      if (s.gap) pause = 450;
      if (last) { pause = 0; if (n > 1 && !/[?!]$/.test(t)) { p = Math.min(p, 0.96); r = Math.min(r, 0.97); } }   // the last sentence settles
      s.pitch = +p.toFixed(2); s.rate = +r.toFixed(2); s.pause = pause;
      delete s.first; delete s.end; delete s.last; delete s.gap;
    });
    return segs;
  };
  sp.prepare = function (text) { return sp.segments(text).map(function (s) { return s.text; }).join(' '); };

  // ---- speaking: one utterance per piece, chained with its pause; cancel stops the chain ----
  var queueId = 0, keep = [];   // Chrome forgets onend for an utterance that was garbage-collected, so the last few are kept
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  // an app voice that is not on the device yet: fetch it in the background once, speak with the phone's voice meanwhile
  var appWarned = {};
  function appFailed(app, err) {
    if (appWarned[app.id]) return; appWarned[app.id] = true;
    var V = CORB.voices;
    if (err && err.code === 'not-downloaded' && navigator.onLine) {
      CORB.ui.toast('Downloading ' + app.name + ' (about ' + app.mb + ' MB) in the background. Until it arrives, the phone\'s own voice reads.', '', 5000);
      V.download(app.id).then(function () { CORB.ui.toast(app.name + ' is ready. The next Listen uses it.', 'ok', 4000); }, function (e) { CORB.ui.toast('Could not download ' + app.name + ': ' + (e && e.message || e), 'warn', 6000); });
    } else if (err && err.code === 'not-downloaded') CORB.ui.toast(app.name + ' is not downloaded yet and you are offline; the phone\'s own voice reads for now.', 'warn', 5000);
    else CORB.ui.toast(app.name + ' could not start on this device (' + (err && err.message || err) + '); the phone\'s own voice reads instead.', 'warn', 6000);
  }
  sp.speak = function (text, o) {
    o = o || {};
    if (!CORB.get('settings.tts', true)) { if (o.onend) o.onend(); return false; }
    var app = !o.device && CORB.voices && CORB.voices.selected && CORB.voices.selected();
    if (app) {
      var mine = ++queueId; try { if (synth) synth.cancel(); } catch (e) {}
      sp.speaking = true; CORB.emit('speech', { speaking: true });
      var took = CORB.voices.speak(sp.segments(text), { rate: o.rate || CORB.get('settings.ttsRate', 1) || 1,
        onend: function () { if (mine !== queueId) return; sp.speaking = false; CORB.emit('speech', { speaking: false }); if (o.onend) o.onend(); },
        onfail: function (err) { if (mine !== queueId) return; sp.speaking = false; appFailed(app, err); var again = {}; for (var k in o) again[k] = o[k]; again.device = true; sp.speak(text, again); } });
      if (took) return true;
      sp.speaking = false;
    }
    if (!synth || !window.SpeechSynthesisUtterance) { CORB.ui.toast('Read-aloud is not available in this browser.', 'warn'); if (o.onend) o.onend(); return false; }
    try {
      var my = ++queueId, list = sp.segments(text), i = 0, voice = o.voice || sp.current();
      var base = o.rate || CORB.get('settings.ttsRate', 1) || 1, lively = CORB.get('settings.ttsTone', 'lively') !== 'even';
      var busy = synth.speaking || synth.pending; synth.cancel();
      sp.speaking = true; CORB.emit('speech', { speaking: true });
      function finish() { if (my !== queueId) return; sp.speaking = false; CORB.emit('speech', { speaking: false }); if (o.onend) o.onend(); }
      function next() {
        if (my !== queueId) return;
        if (i >= list.length) { finish(); return; }
        var s = list[i++], u = new SpeechSynthesisUtterance(s.text), done = false;
        u.rate = clamp(base * (lively ? s.rate : 1), 0.5, 2); u.pitch = lively ? s.pitch : 1;
        if (voice) { u.voice = voice; u.lang = voice.lang || 'en-US'; } else u.lang = 'en-US';
        u.onend = function () { if (done || my !== queueId) return; done = true; if (s.pause && i < list.length) setTimeout(next, s.pause); else next(); };
        u.onerror = function (e) { if (done || my !== queueId) return; done = true; if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; finish(); };
        keep.push(u); if (keep.length > 6) keep.shift();
        synth.speak(u);
      }
      if (busy) setTimeout(next, 80); else next();   // Android drops an utterance queued in the same tick as cancel()
      return true;
    } catch (e) { sp.speaking = false; if (o.onend) o.onend(); return false; }
  };
  sp.stop = function () { queueId++; if (CORB.voices) { try { CORB.voices.stop(); } catch (e) {} } try { if (synth) synth.cancel(); } catch (e) {} sp.speaking = false; CORB.emit('speech', { speaking: false }); document.querySelectorAll('.speaking').forEach(function (b) { b.classList.remove('speaking'); if (b.lastChild && b.lastChild.nodeType === 3) b.lastChild.textContent = 'Listen'; }); };
  window.addEventListener('hashchange', function () { if (sp.speaking) sp.stop(); });
})();
