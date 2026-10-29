/* CORE-05-SPEECH — offline read-aloud through the browser's speechSynthesis; a quiet no-op where it is missing.
   Voices: the device's own (Apple's Enhanced and Premium voices, Google's and Samsung's on Android, Microsoft's natural
   voices in Edge). sp.voices() lists the English ones, best first; the reader picks one in Settings (settings.voice) or
   gets the best one by default. sp.prepare() makes text sound spoken, not read: acronyms are spelled or said the way
   contracting people say them (K O, "core", "eye-tass"), course numbers come out as "thirteen hundred V" and
   "thirty-nine ninety V", bullets and markdown become pauses. */
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

  // ---- saying it the way people say it ----
  // said as a word, or as contracting people say it (everything else in capitals is spelled out)
  var SAY = { AITAS: 'eye-tass', DACM: 'dack-em', WarU: 'War U', DAU: 'D A U', 'J&A': 'J and A', 'T&M': 'T and M', 'Q&A': 'Q and A', DoW: 'Department of War', DoD: 'D O D',
    KO: 'K O', KOs: 'K Os', COR: 'core', CORs: 'cores', PWS: 'P W S', SOW: 'S O W', IGCE: 'I G C E', PIID: 'pid', PIIDs: 'pids', CLIN: 'clin', CLINs: 'clins', SLIN: 'slin', UCF: 'U C F',
    CAC: 'cack', NIPR: 'nipper', SIPR: 'sipper', FOB: 'fob', OnVUE: 'on view', RFO: 'R F O', FFP: 'F F P', CPFF: 'C P F F', IDIQ: 'I D I Q', GSA: 'G S A', SBA: 'S B A', OJT: 'O J T',
    NCO: 'N C O', NCOs: 'N C Os', MOS: 'M O S', MPT: 'M P T', SAT: 'S A T', PALT: 'palt', NAICS: 'nakes', SAM: 'sam', CAGE: 'cage', GAO: 'G A O', WAWF: 'wawf', PIEE: 'P I E E',
    FPDS: 'F P D S', CAMP: 'camp', CON: 'con', ATRRS: 'atters', CONUS: 'konus', OCONUS: 'oh-konus', DAWIA: 'da-wee-ah', COTS: 'cots', CICA: 'sika', SBIR: 'sibber', KMG: 'K M G', IDP: 'I D P', CLP: 'C L P', CLPs: 'C L Ps', FAR: 'far', DFARS: 'dee-fars', AFARS: 'ay-fars', FAC: 'F A C', FAQ: 'F A Q', PDF: 'P D F', QR: 'Q R',
    B2B: 'B to B', '51C': 'fifty-one charlie', '51Cs': 'fifty-one charlies', '1102': 'eleven oh two', '1102s': 'eleven oh twos', 'e.g.': 'for example', 'i.e.': 'that is', 'vs.': 'versus', 'U.S.': 'U S', 'U.S.C.': 'U S code' };
  var SAY_RE = new RegExp('(^|[^A-Za-z0-9&])(' + Object.keys(SAY).sort(function (a, b) { return b.length - a.length; }).map(function (k) { return k.replace(/[.&]/g, '\\$&'); }).join('|') + ')(?=$|[^A-Za-z0-9&])', 'g');
  sp.prepare = function (text) {
    var t = String(text == null ? '' : text);
    t = t.replace(/\*\*|__|`/g, '').replace(/§\s*/g, 'section ').replace(/\s*→\s*/g, ' to ').replace(/\s*·\s*/g, ', ').replace(/\s+\/\s+/g, ' or ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    t = t.replace(/(^|\n)\s*[-*•]\s+/g, '$1. ').replace(/\n+/g, '. ').replace(/\.\s*\.\s*/g, '. ');
    t = t.replace(/\bCON (\d)(\d)00(V?)\b/g, 'CON $1$2 hundred $3').replace(/\b(\d{2})(\d{2})V\b/g, '$1 $2 V');       // CON 1300V: thirteen hundred V; 3990V: thirty-nine ninety V
    t = t.replace(/\bFY(\d{2})\b/g, 'F Y $1').replace(/\bPart (\d+)\.(\d)/g, 'Part $1 point $2');
    t = t.replace(SAY_RE, function (m, pre, k) { return pre + SAY[k]; });
    t = t.replace(/\b([A-Z]{2,5})(s?)\b/g, function (m, a, s) { return a.split('').join(' ') + (s ? ' ' + s : ''); });   // anything else in capitals is spelled out
    return t.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
  };

  // Speech engines stumble on long text, so it is spoken in sentence-sized chunks, one after another.
  function chunks(text) {
    var t = sp.prepare(text);
    var parts = t.match(/[^.!?;:]+[.!?;:]*\s*/g) || [t], out = [], cur = '';
    parts.forEach(function (p) { if ((cur + p).length > 220 && cur) { out.push(cur); cur = p; } else cur += p; });
    if (cur.trim()) out.push(cur);
    return out;
  }
  var queueId = 0;
  sp.speak = function (text, o) {
    o = o || {};
    if (!sp.available || !CORB.get('settings.tts', true)) { if (!sp.available) CORB.ui.toast('Read-aloud is not available in this browser.', 'warn'); if (o.onend) o.onend(); return false; }
    try {
      synth.cancel(); var my = ++queueId, list = chunks(text), i = 0, voice = o.voice || sp.current();
      sp.speaking = true; CORB.emit('speech', { speaking: true });
      (function next() {
        if (my !== queueId) return;
        if (i >= list.length) { sp.speaking = false; CORB.emit('speech', { speaking: false }); if (o.onend) o.onend(); return; }
        var u = new SpeechSynthesisUtterance(list[i++]);
        u.rate = o.rate || CORB.get('settings.ttsRate', 1) || 1; u.pitch = 1;
        if (voice) { u.voice = voice; u.lang = voice.lang || 'en-US'; } else u.lang = 'en-US';
        u.onend = next; u.onerror = function () { if (my === queueId) { sp.speaking = false; CORB.emit('speech', { speaking: false }); if (o.onend) o.onend(); } };
        synth.speak(u);
      })();
      return true;
    } catch (e) { if (o.onend) o.onend(); return false; }
  };
  sp.stop = function () { queueId++; try { if (synth) synth.cancel(); } catch (e) {} sp.speaking = false; CORB.emit('speech', { speaking: false }); document.querySelectorAll('.speaking').forEach(function (b) { b.classList.remove('speaking'); if (b.lastChild && b.lastChild.nodeType === 3) b.lastChild.textContent = 'Listen'; }); };
  window.addEventListener('hashchange', function () { if (sp.speaking) sp.stop(); });
})();
