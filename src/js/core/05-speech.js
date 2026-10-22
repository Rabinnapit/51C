/* CORE-05-SPEECH — offline read-aloud through the browser's speechSynthesis; a quiet no-op where it is missing */
(function () {
  'use strict';
  var CORB = window.CORB;
  var synth = window.speechSynthesis || null;
  var sp = CORB.speech = { available: !!(synth && window.SpeechSynthesisUtterance), speaking: false, voice: null };
  function pickVoice() {
    if (!synth) return null;
    var voices = synth.getVoices() || [];
    var pref = ['Microsoft Aria', 'Microsoft Jenny', 'Microsoft Guy', 'Google US English', 'Samantha', 'Daniel'];
    for (var i = 0; i < pref.length; i++) { var v = voices.filter(function (x) { return x.name.indexOf(pref[i]) >= 0; })[0]; if (v) return v; }
    return voices.filter(function (x) { return /^en(-|_)?(US|GB)?/i.test(x.lang); })[0] || voices[0] || null;
  }
  if (synth) { try { synth.onvoiceschanged = function () { sp.voice = pickVoice(); }; } catch (e) {} setTimeout(function () { sp.voice = pickVoice(); }, 250); }
  // Speech engines stumble on long text, so it is spoken in sentence-sized chunks, one after another.
  function chunks(text) {
    var t = String(text).replace(/\s+/g, ' ').replace(/§/g, 'section ').replace(/\*\*/g, '').trim();
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
      synth.cancel(); var my = ++queueId, list = chunks(text), i = 0;
      sp.speaking = true; CORB.emit('speech', { speaking: true });
      (function next() {
        if (my !== queueId) return;
        if (i >= list.length) { sp.speaking = false; CORB.emit('speech', { speaking: false }); if (o.onend) o.onend(); return; }
        var u = new SpeechSynthesisUtterance(list[i++]);
        u.rate = o.rate || CORB.get('settings.ttsRate', 1) || 1; u.pitch = 1; if (sp.voice) u.voice = sp.voice;
        u.onend = next; u.onerror = function () { if (my === queueId) { sp.speaking = false; CORB.emit('speech', { speaking: false }); if (o.onend) o.onend(); } };
        synth.speak(u);
      })();
      return true;
    } catch (e) { if (o.onend) o.onend(); return false; }
  };
  sp.stop = function () { queueId++; try { if (synth) synth.cancel(); } catch (e) {} sp.speaking = false; CORB.emit('speech', { speaking: false }); document.querySelectorAll('.speaking').forEach(function (b) { b.classList.remove('speaking'); if (b.lastChild && b.lastChild.nodeType === 3) b.lastChild.textContent = 'Listen'; }); };
  window.addEventListener('hashchange', function () { if (sp.speaking) sp.stop(); });
})();
