/* ARCADE-02-FEEL — the shared game-feel kit: reduced-motion awareness, haptics, hit-stop, a camera-trauma helper and
   richer synthesized sounds layered on the engine's audio. Every action game uses the same kit, so a hit feels the same
   everywhere: flash, freeze, shake, sound and a buzz within a tenth of a second. */
(function () {
  'use strict';
  var A = window.ARCADE; if (!A) return;
  var feel = A.feel = {};
  // the reader's Less motion setting, or the operating system's
  feel.reduce = function () {
    try { if (document.documentElement.getAttribute('data-motion') === 'reduce') return true; return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  };
  // a short buzz on phones that have a motor (Android); silent elsewhere and under Less motion
  feel.buzz = function (pattern) { if (feel.reduce()) return; try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(pattern); } catch (e) {} };
  // trauma: a 0..1 value that decays; the shake amplitude is trauma squared, so small hits barely move the camera
  feel.trauma = function () {
    var v = 0;
    return { add: function (n) { v = Math.min(1, v + (feel.reduce() ? 0 : n)); }, update: function (dt, rate) { v = Math.max(0, v - dt * (rate || 1.8)); }, get value() { return v; }, amp: function (px) { return v * v * px; } };
  };
  // hit-stop: a freeze of the game's own clock for a few frames; games skip their update while frozen() and keep drawing
  feel.hitstop = { until: 0, hit: function (ms) { if (feel.reduce()) return; feel.hitstop.until = performance.now() + (ms || 60); }, frozen: function (now) { return (now || performance.now()) < feel.hitstop.until; } };
  // sounds layered on the engine's synth (A.audio.tone(freq, dur, type, gain, slide, delay); A.audio.noise(dur, gain, freq, filter, delay, sweepTo))
  var au = A.audio;
  feel.sfx = {
    rifle: function () { au.noise(0.16, 0.45, 2200, 'bandpass', 0, 400); au.noise(0.5, 0.35, 320, 'lowpass', 0, 60); au.tone(70, 0.22, 'sine', 0.3, 32); },
    ping: function () { au.tone(1480, 0.1, 'triangle', 0.12, 2400); au.noise(0.05, 0.1, 5000, 'highpass'); au.tone(880, 0.16, 'triangle', 0.08, 1760, 0.03); },
    thud: function () { au.noise(0.2, 0.3, 500, 'lowpass', 0, 120); au.tone(120, 0.14, 'sine', 0.16, 50); },
    miss: function () { au.tone(220, 0.22, 'sawtooth', 0.09, 110); au.noise(0.12, 0.06, 900, 'bandpass'); },
    combo: function (n) { for (var i = 0; i < Math.min(n, 4); i++) au.tone(660 + i * 160, 0.07, 'triangle', 0.08, 0, i * 0.06); },
    brass: function () { au.tone(2600, 0.04, 'square', 0.02, 1800, 0.25); au.tone(3200, 0.03, 'square', 0.015, 2200, 0.33); },
    pop: function () { au.noise(0.08, 0.16, 2400, 'bandpass'); au.tone(300, 0.06, 'square', 0.04, 140); },
    timeout: function () { au.tone(330, 0.18, 'square', 0.05); au.tone(262, 0.3, 'square', 0.05, 0, 0.18); }
  };
})();
