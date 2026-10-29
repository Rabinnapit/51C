/* ARCADE-04-MENTOR — the Contracting Master Gunner: the drawn mentor who briefs each campaign chapter, reacts to answers
   (pleased, hint, worried, proud) and explains a miss in one line before the study list does. Drawn in code on a canvas,
   so the portrait is the same on every phone and nothing is an image file. The shell shows the lines in a bubble over the
   stage (api.mentor.say); the lobby draws the portrait next to the chapter brief. */
(function () {
  'use strict';
  var A = window.ARCADE; if (!A) return;
  var M = A.mentor = { name: 'Master Gunner', title: 'Your Contracting Master Gunner (KMG)' };
  M.LINES = {
    pleased: ['That is it.', 'Good call.', 'Clean answer.', 'Right on the money.', 'You read it right.', 'That is how a 51C answers.', 'Yes. Next one.', 'Textbook.'],
    hint: ['Not that one.', 'Close, but no.', 'Look again.', 'Not quite.'],
    tips: ['Read the NOT. Half the misses hide there.', 'The answer is in the stem. Read every word.', 'Cross out two, then decide.', 'Ask who has the authority in the question.', 'The dollar amount decides the method.', 'When two answers look right, the cite decides.'],
    worried: ['Steady. Read every word.', 'Slow down. Nobody is timing you but the game.', 'Take a breath and pick the one you can defend.', 'Careful now. Eliminate first, then choose.'],
    low: ['One heart left. Make this one count.', 'Last heart. Read it twice.'],
    proud: ['Outstanding.', 'That is board material.', 'Write that one in the file.', 'The board would be impressed.', 'Nothing more to teach you on that one.'],
    streak: ['Three in a row. Keep that rhythm.', 'Five straight. You are reading, not guessing.', 'Seven. Now you are showing off.'],
    boss: ['Boss down. That is one career-ender you will never meet.', 'Down. Remember what it fed on.', 'Finished. Now you know its tricks.']
  };
  M.line = function (kind) { return A.pick(M.LINES[kind] || M.LINES.pleased) || ''; };
  // the first sentence of an explanation, short enough for a bubble
  M.oneLine = function (text, max) {
    var s = String(text || '').replace(/\s+/g, ' ').trim(); if (!s) return '';
    var m = /^(.+?[.!?])(\s|$)/.exec(s); s = m ? m[1] : s; max = max || 120;
    if (s.length > max) s = s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
    return s;
  };
  M.missLine = function (why) { var one = M.oneLine(why); return M.line('hint') + (one ? ' ' + one : ' ' + M.line('tips')); };

  // the portrait: an SFC in OCP and a patrol cap. mood: pleased | hint | worried | proud | brief. o.talk animates the mouth.
  var SKIN = '#b98a63', SKIN2 = '#9c704c', OCP = '#6e6b4f', OCP2 = '#5b5a44', OCP3 = '#83805f', OCP4 = '#4a4a37', INK = '#2a1b10';
  function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); }
  M.draw = function (ctx, size, mood, t, o) {
    o = o || {}; mood = mood || 'pleased'; t = t || 0;
    var s = size / 100, cx = size / 2, cy = size / 2, blink = (t % 3.7) > 3.56 ? 1 : 0, talk = o.talk ? (Math.sin(t * 14) * 0.5 + 0.5) : 0;
    var happy = mood === 'proud' ? 1 : mood === 'pleased' ? 0.6 : mood === 'brief' ? 0.35 : mood === 'hint' ? 0.2 : 0;
    var worry = mood === 'worried' ? 1 : mood === 'hint' ? 0.35 : 0;
    ctx.save(); ctx.clearRect(0, 0, size, size); ctx.translate(0, Math.sin(t * 1.4) * 0.5 * s);
    var g = ctx.createRadialGradient(cx, cy * 0.6, 4 * s, cx, cy, 52 * s); g.addColorStop(0, o.bg || '#1d3a3c'); g.addColorStop(1, '#08110f'); ctx.fillStyle = g; ell(ctx, cx, cy, 48 * s, 48 * s); ctx.fill();
    ctx.save(); ell(ctx, cx, cy, 48 * s, 48 * s); ctx.clip();
    // shoulders in OCP, with a few camo blotches and a collar
    ctx.fillStyle = OCP; ctx.beginPath(); ctx.moveTo(cx - 50 * s, 104 * s); ctx.quadraticCurveTo(cx - 46 * s, 66 * s, cx - 19 * s, 61 * s); ctx.lineTo(cx + 19 * s, 61 * s); ctx.quadraticCurveTo(cx + 46 * s, 66 * s, cx + 50 * s, 104 * s); ctx.closePath(); ctx.fill();
    [[-31, 80, 9, 5, OCP2], [-13, 90, 7, 4, OCP3], [25, 78, 8, 5, OCP4], [35, 92, 6, 4, OCP3], [7, 97, 9, 4, OCP2], [-36, 96, 6, 3, OCP4], [20, 95, 5, 3, OCP2]].forEach(function (b) { ctx.fillStyle = b[4]; ell(ctx, cx + b[0] * s, b[1] * s, b[2] * s, b[3] * s); ctx.fill(); });
    ctx.fillStyle = SKIN2; ctx.fillRect(cx - 7 * s, 50 * s, 14 * s, 15 * s); ctx.fillStyle = SKIN; ctx.fillRect(cx - 6 * s, 50 * s, 12 * s, 13 * s);
    ctx.fillStyle = OCP4; ctx.beginPath(); ctx.moveTo(cx - 19 * s, 61 * s); ctx.lineTo(cx - 6 * s, 64 * s); ctx.lineTo(cx - 10 * s, 72 * s); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx + 19 * s, 61 * s); ctx.lineTo(cx + 6 * s, 64 * s); ctx.lineTo(cx + 10 * s, 72 * s); ctx.closePath(); ctx.fill();
    // the rank on the chest: an SFC tab, three chevrons over two rockers
    ctx.save(); ctx.translate(cx, 84 * s); ctx.fillStyle = OCP4; A.roundRect(ctx, -7 * s, -7 * s, 14 * s, 14 * s, 2 * s); ctx.fill();
    ctx.strokeStyle = '#d9c38a'; ctx.lineWidth = 1.1 * s; ctx.lineCap = 'round';
    for (var c = 0; c < 3; c++) { ctx.beginPath(); ctx.moveTo(-5 * s, -2 * s + c * 2.2 * s); ctx.lineTo(0, -5 * s + c * 2.2 * s); ctx.lineTo(5 * s, -2 * s + c * 2.2 * s); ctx.stroke(); }
    for (var r = 0; r < 2; r++) { ctx.beginPath(); ctx.moveTo(-5 * s, 3.4 * s + r * 2 * s); ctx.quadraticCurveTo(0, 6.4 * s + r * 2 * s, 5 * s, 3.4 * s + r * 2 * s); ctx.stroke(); }
    ctx.restore();
    // head, ears, patrol cap
    ctx.fillStyle = SKIN2; ell(ctx, cx - 16 * s, 42 * s, 3.2 * s, 4.5 * s); ctx.fill(); ell(ctx, cx + 16 * s, 42 * s, 3.2 * s, 4.5 * s); ctx.fill();
    ctx.fillStyle = SKIN; ell(ctx, cx, 40 * s, 16 * s, 19.5 * s); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ell(ctx, cx, 48 * s, 12 * s, 7 * s); ctx.fill();
    ctx.fillStyle = OCP; A.roundRect(ctx, cx - 18.5 * s, 19 * s, 37 * s, 15 * s, 7 * s); ctx.fill();
    ctx.fillStyle = OCP2; ell(ctx, cx - 8 * s, 24 * s, 5 * s, 2.5 * s); ctx.fill(); ctx.fillStyle = OCP3; ell(ctx, cx + 9 * s, 27 * s, 4 * s, 2 * s); ctx.fill();
    ctx.fillStyle = OCP4; ell(ctx, cx, 33.5 * s, 20 * s, 3.6 * s); ctx.fill(); ctx.fillStyle = OCP; ctx.fillRect(cx - 18.5 * s, 28 * s, 37 * s, 4 * s);
    // brows: happy lifts them, worry tilts the inner ends up; hint raises one brow
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.8 * s; ctx.lineCap = 'round';
    [-1, 1].forEach(function (side) {
      var lift = -happy * 1.2 * s + (mood === 'hint' && side > 0 ? -2.4 * s : 0), inner = cx + side * 3.5 * s, outer = cx + side * 11 * s;
      ctx.beginPath(); ctx.moveTo(inner, 35.5 * s + lift - worry * 1.6 * s); ctx.quadraticCurveTo(cx + side * 7 * s, 34 * s + lift - worry * 0.4 * s, outer, 35.5 * s + lift + worry * 0.8 * s); ctx.stroke();
    });
    // eyes
    [-1, 1].forEach(function (side) {
      var ex = cx + side * 7 * s, ey = 41.5 * s, open = blink ? 0.12 : 1 - happy * 0.25;
      ctx.fillStyle = '#fff'; ell(ctx, ex, ey, 4.2 * s, 2.9 * s * open); ctx.fill();
      if (!blink) { ctx.fillStyle = INK; ell(ctx, ex + side * 0.3 * s, ey + 0.2 * s, 1.9 * s, 2.0 * s * open); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.85)'; ell(ctx, ex - 0.7 * s, ey - 0.8 * s, 0.6 * s, 0.6 * s); ctx.fill(); }
      ctx.strokeStyle = SKIN2; ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.moveTo(ex - 4.2 * s, ey - 1.5 * s); ctx.quadraticCurveTo(ex, ey - 3.6 * s, ex + 4.2 * s, ey - 1.5 * s); ctx.stroke();
    });
    // nose and mouth
    ctx.strokeStyle = SKIN2; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(cx - 0.5 * s, 43 * s); ctx.quadraticCurveTo(cx - 2.8 * s, 49 * s, cx + 0.5 * s, 49.6 * s); ctx.stroke();
    var my = 54.5 * s, mw = (5 + happy * 4) * s, curve = happy * 3.2 * s - worry * 2.4 * s, openM = (talk * 2.2 + worry * 1.2 + (mood === 'proud' ? 2.4 : 0)) * s;
    ctx.fillStyle = '#4a1f1f'; ctx.beginPath(); ctx.moveTo(cx - mw, my); ctx.quadraticCurveTo(cx, my + curve + openM, cx + mw, my); ctx.quadraticCurveTo(cx, my + curve - openM * 0.1, cx - mw, my); ctx.closePath(); ctx.fill();
    if (openM > 1.2 * s) { ctx.fillStyle = '#f4f1e8'; ctx.beginPath(); ctx.moveTo(cx - mw * 0.8, my + 0.2 * s); ctx.quadraticCurveTo(cx, my + curve * 0.4 + 0.6 * s, cx + mw * 0.8, my + 0.2 * s); ctx.lineTo(cx + mw * 0.8, my + 0.9 * s); ctx.lineTo(cx - mw * 0.8, my + 0.9 * s); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = SKIN2; ctx.lineWidth = 0.9 * s; ctx.beginPath(); ctx.moveTo(cx - mw, my); ctx.quadraticCurveTo(cx, my + curve, cx + mw, my); ctx.stroke();
    // a thumbs-up when proud
    if (mood === 'proud') { ctx.save(); ctx.translate(cx + 30 * s, 78 * s); ctx.fillStyle = SKIN; A.roundRect(ctx, -7 * s, -2 * s, 14 * s, 13 * s, 4 * s); ctx.fill(); A.roundRect(ctx, -2 * s, -12 * s, 5.5 * s, 13 * s, 2.7 * s); ctx.fill(); ctx.fillStyle = OCP; ctx.fillRect(-8 * s, 9 * s, 16 * s, 6 * s); ctx.strokeStyle = SKIN2; ctx.lineWidth = 0.8 * s; [1, 4.2, 7.4].forEach(function (y) { ctx.beginPath(); ctx.moveTo(-6 * s, y * s); ctx.lineTo(6 * s, y * s); ctx.stroke(); }); ctx.restore(); }
    ctx.restore();
    ctx.strokeStyle = o.ring || (mood === 'worried' ? '#ff9c9c' : mood === 'proud' ? '#f6d991' : '#e6b85a'); ctx.lineWidth = 2.4 * s; ell(ctx, cx, cy, 47 * s, 47 * s); ctx.stroke();
    ctx.restore();
  };
})();
