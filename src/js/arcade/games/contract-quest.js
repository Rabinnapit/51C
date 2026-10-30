/* GAME: contract-quest — RPG battles across the four exam areas and the Exam Citadel.
   Pick a realm (one exam area), then beat two monsters and a boss with questions from the bank. A right answer fires the
   hero's RPG: more damage on a streak, on a fast answer, and on a Warrant Strike (charged by three right in a row). A wrong
   answer or a timeout lets the monster hit back for a heart. Every answer shows the reason and the FAR cite.
   The four realm bosses are the four things that end careers: the Unauthorized Commitment, the Bid Bust, the Audit and
   the Protest. Each asks its own family of questions, and at half health it enters a second phase with an attack of its
   own on every miss (ratification, re-solicit, a finding, a stay of award). The Master Gunner briefs the boss and reacts
   in a bubble. A campaign mission (api.opts.boss) is one boss alone with eight health, on the month's lessons.
   Realm stars (3 = no hearts lost) are kept in the reader's progress (progress.arcade.quest). */
(function () {
  'use strict';
  var A = window.ARCADE;
  if (!A || typeof A.register !== 'function') return;

  var REALMS = [
    { id: 'gp', name: 'Principles Peaks', short: 'Principles', sub: 'Guiding Principles', icon: '1.0', color: '#a3a9f2',
      theme: { sky: ['#0d1030', '#2a2f72', '#7d6fbf'], hill: ['#2b2f66', '#1c1f48'], ground: ['#2a2c5e', '#14162f'], mote: '#e9ebff', motes: 'snow', orb: '#f3f0ff' },
      foes: [{ name: 'Gift Goblin', kind: 'imp', color: '#62c98d', hp: 3, line: 'A little gift never hurt anyone...' },
        { name: 'Deviation Wisp', kind: 'wisp', color: '#8cc8ff', hp: 4, line: 'Who needs approval to skip a rule?' },
        { name: 'The Unauthorized Commitment', kind: 'demon', color: '#ff5d5d', hp: 6, boss: 'uc', line: 'Your COR already promised them the work!' }] },
    { id: 'pre', name: 'Pre-Award Plains', short: 'Pre-Award', sub: 'Pre-Award', icon: '2.0', color: '#82b6ef',
      theme: { sky: ['#071a2c', '#1f5b84', '#9bd2ea'], hill: ['#1d5a40', '#123d2b'], ground: ['#2a6340', '#123220'], mote: '#f7f1c4', motes: 'seeds', orb: '#fff6d6' },
      foes: [{ name: 'Vague Requirement', kind: 'blob', color: '#b39dff', hp: 3, line: 'Just buy... you know... the stuff.' },
        { name: 'Sole-Source Serpent', kind: 'serpent', color: '#4fd18b', hp: 4, line: 'Only one company could ever do this.' },
        { name: 'The Bid Bust', kind: 'bust', color: '#ff9d4a', hp: 6, boss: 'bust', line: 'One offer, no notice, no justification. What could go wrong?' }] },
    { id: 'awd', name: 'Award Arena', short: 'Award', sub: 'Award', icon: '3.0', color: '#f0b863',
      theme: { sky: ['#1c0d04', '#6e3510', '#f0a85a'], hill: ['#5a2c10', '#3a1c0a'], ground: ['#6e4b25', '#382510'], mote: '#ffcf86', motes: 'sparks', orb: '#ffe2a8' },
      foes: [{ name: 'Late Proposal Specter', kind: 'wisp', color: '#d6d3ff', hp: 3, line: 'It was only five minutes late...' },
        { name: 'Lowball Bandit', kind: 'imp', color: '#ff9d4a', hp: 4, line: 'Lowest price wins. Always. Right?' },
        { name: 'The Protest', kind: 'wraith', color: '#b98cff', hp: 6, boss: 'protest', line: 'Your evaluation was never documented!' }] },
    { id: 'post', name: 'Post-Award Fortress', short: 'Post-Award', sub: 'Post-Award', icon: '4.0', color: '#6fd3d9',
      theme: { sky: ['#03141a', '#0f4650', '#5fc3cb'], hill: ['#15393f', '#0b2529'], ground: ['#21444a', '#0d2428'], mote: '#c9f6f8', motes: 'rain', orb: '#d8fbff' },
      foes: [{ name: 'Constructive Change Golem', kind: 'golem', color: '#9aa7b4', hp: 3, line: 'The COR told me to add it. Pay me.' },
        { name: 'Invoice Imp', kind: 'imp', color: '#ffd166', hp: 4, line: 'Pay it now, inspect it later!' },
        { name: 'The Audit', kind: 'audit', color: '#45c7bb', hp: 6, boss: 'audit', line: 'Show me the file. All of it.' }] },
    { id: 'all', name: 'Exam Citadel', short: 'Citadel', sub: 'Every exam area', icon: '★', color: '#e6b85a',
      theme: { sky: ['#0e0408', '#43121f', '#d79a4a'], hill: ['#2a0e17', '#180810'], ground: ['#3a1a22', '#1a0a0f'], mote: '#ffb35c', motes: 'embers', orb: '#ffd9a0' },
      foes: [{ name: 'Distractor Drone', kind: 'eye', color: '#ff7ab6', hp: 4, line: 'All of these answers look right...' },
        { name: 'Trick-Question Troll', kind: 'golem', color: '#86b86b', hp: 5, line: 'Read every word. Every. Word.' },
        { name: 'The Gatekeeper', kind: 'gate', color: '#e6b85a', hp: 8, boss: 'gate', line: '150 questions stand between you and certification.' }] }
  ];
  // the four things that end careers: each asks its own family of lessons and has a second-phase attack on every miss
  var BOSSES = {
    uc: { id: 'uc', special: 'Ratification', specialText: 'Every miss now ratifies the commitment: the boss heals 1.', family: ['L02', 'L04', 'L05', 'L07', 'L08'],
      intro: 'It feeds on promises made without a warrant. Remember who can bind the Government, what makes a contract, and what a ratification costs.' },
    bust: { id: 'bust', special: 'Re-solicit', specialText: 'Every miss now re-solicits: your focus is lost and the next question is a hard one.', family: ['L13', 'L16', 'L18', 'L17', 'L12'],
      intro: 'It lives on competition done wrong: no justification, the wrong method, a solicitation nobody could answer. Watch the thresholds.' },
    audit: { id: 'audit', special: 'Finding', specialText: 'Every miss now writes a finding: it takes a potion or a scroll, or heals the boss.', family: ['L26', 'L27', 'L29', 'L30', 'L32', 'L21', 'L20'],
      intro: 'It reads every file. Quality, changes signed by a contracting officer, claims and closeout: know the rules and the time limits.' },
    protest: { id: 'protest', special: 'Stay of award', specialText: 'Every miss now stays the award: your focus is lost and your next hit does 1 damage.', family: ['L23', 'L24', 'L25', 'L22'],
      intro: 'It feeds on evaluations nobody wrote down. Notices, debriefings, the protest clock. Documentation beats it.' },
    gate: { id: 'gate', special: 'Trick question', specialText: 'Every miss now brings a hard question next.', family: [],
      intro: 'Every area at once, like the real exam. Read every word; the Gatekeeper hides a NOT in half its questions.' }
  };

  function bankOf(D) { return ((D && D.bank) || []).filter(function (q) { return q && q.stem && q.options && q.options.length === 4 && q.options.some(function (o) { return o.correct; }); }); }
  // a realm's questions: its exam area; a campaign mission narrows them to the month's lessons when enough exist
  function poolFor(D, realm, lessons) {
    var b = bankOf(D);
    if (lessons && lessons.length) { var l = b.filter(function (q) { return lessons.indexOf(q.lesson) >= 0; }); if (l.length >= 12) return l; }
    return realm.id === 'all' ? b.filter(function (q) { return q.phase !== 'job'; }) : b.filter(function (q) { return q.phase === realm.id; });
  }
  function starText(n) { var s = ''; for (var i = 0; i < 3; i++) s += i < n ? '★' : '☆'; return s; }

  // ---- drawing helpers ----
  function ellipse(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); }
  function eyes(ctx, x, y, r, gap, look, o) {
    o = o || {};
    [-1, 1].forEach(function (s) {
      var ex = x + s * gap;
      ctx.fillStyle = o.white || '#fff'; ellipse(ctx, ex, y, r, r * (o.squint || 1)); ctx.fill();
      ctx.fillStyle = o.pupil || '#14101c'; ellipse(ctx, ex + look * r * 0.35, y + r * 0.1, r * 0.5, r * 0.55 * (o.squint || 1)); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ellipse(ctx, ex + look * r * 0.35 - r * 0.18, y - r * 0.2, r * 0.15, r * 0.15); ctx.fill();
    });
  }
  function glowEyes(ctx, x, y, r, gap, color) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = r * 4; ctx.fillStyle = color; [-1, 1].forEach(function (s) { ellipse(ctx, x + s * gap, y, r * 1.15, r * 0.55); ctx.fill(); }); ctx.restore(); }
  function fillOf(ctx, c, x, y, r, flash) {
    if (flash) return '#ffffff';
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r * 1.25);
    g.addColorStop(0, A.shade(c, 0.35)); g.addColorStop(0.6, c); g.addColorStop(1, A.shade(c, -0.45)); return g;
  }
  function tone(c, k, flash) { return flash ? '#ffffff' : A.shade(c, k); }

  // Monster bodies, drawn from the ground point (0, 0) upward; m = { r, t, c, flash, look }
  var KINDS = {
    blob: function (ctx, m) {
      var r = m.r, t = m.t, sq = 1 + Math.sin(t * 3) * 0.05;
      ctx.save(); ctx.translate(0, -r * 0.9); ctx.scale(1 / sq, sq);
      ctx.beginPath();
      for (var i = 0; i <= 28; i++) { var a = i / 28 * Math.PI * 2, rr = r * (1 + 0.06 * Math.sin(a * 3 + t * 3) + 0.04 * Math.sin(a * 5 - t * 2)); var px = Math.cos(a) * rr, py = Math.sin(a) * rr * (Math.sin(a) > 0 ? 0.88 : 1); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fillStyle = fillOf(ctx, m.c, 0, 0, r, m.flash); ctx.fill();
      ctx.fillStyle = tone(m.c, 0.2, m.flash); for (var d = 0; d < 3; d++) { var dx = (d - 1) * r * 0.55, dl = r * (0.18 + 0.12 * Math.sin(t * 2 + d * 2)); ellipse(ctx, dx, r * 0.82 + dl * 0.5, r * 0.08, dl); ctx.fill(); }
      eyes(ctx, 0, -r * 0.22, r * 0.17, r * 0.32, m.look);
      ctx.strokeStyle = '#1a1024'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(-r * 0.05, r * 0.08, r * 0.3, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ellipse(ctx, -r * 0.42, -r * 0.55, r * 0.18, r * 0.1); ctx.fill();
      ctx.restore();
    },
    imp: function (ctx, m) {
      var r = m.r, t = m.t, c = m.c, f = m.flash, hop = Math.abs(Math.sin(t * 4)) * r * 0.12;
      ctx.save(); ctx.translate(0, -r * 0.82 - hop); ctx.lineCap = 'round';
      ctx.strokeStyle = tone(c, -0.25, f); ctx.lineWidth = r * 0.09;
      ctx.beginPath(); ctx.moveTo(r * 0.45, r * 0.35); ctx.quadraticCurveTo(r * 1.15, r * 0.2 + Math.sin(t * 5) * r * 0.2, r * 0.95, -r * 0.35); ctx.stroke();
      ctx.fillStyle = tone(c, -0.25, f); ctx.beginPath(); ctx.moveTo(r * 0.95, -r * 0.58); ctx.lineTo(r * 1.12, -r * 0.3); ctx.lineTo(r * 0.78, -r * 0.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = tone(c, -0.12, f);
      [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * r * 0.35, -r * 0.5); ctx.lineTo(s * r * 1.0, -r * 0.9); ctx.lineTo(s * r * 0.55, -r * 0.2); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = f ? '#fff' : '#f3e6c8';
      [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * r * 0.12, -r * 0.62); ctx.lineTo(s * r * 0.3, -r * 1.08); ctx.lineTo(s * r * 0.36, -r * 0.56); ctx.closePath(); ctx.fill(); });
      ellipse(ctx, 0, 0, r * 0.62, r * 0.72); ctx.fillStyle = fillOf(ctx, c, 0, 0, r * 0.7, f); ctx.fill();
      ctx.fillStyle = f ? '#fff' : 'rgba(255,255,255,.16)'; ellipse(ctx, 0, r * 0.25, r * 0.34, r * 0.32); ctx.fill();
      ctx.strokeStyle = tone(c, -0.2, f); ctx.lineWidth = r * 0.13;
      ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.05); ctx.lineTo(-r * 0.88, -r * 0.12 + Math.sin(t * 6) * r * 0.14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.5, r * 0.05); ctx.lineTo(r * 0.82, r * 0.32); ctx.stroke();
      ctx.fillStyle = tone(c, -0.35, f); ellipse(ctx, -r * 0.28, r * 0.72, r * 0.2, r * 0.1); ctx.fill(); ellipse(ctx, r * 0.28, r * 0.72, r * 0.2, r * 0.1); ctx.fill();
      eyes(ctx, 0, -r * 0.22, r * 0.15, r * 0.24, m.look, { squint: 0.8 });
      ctx.fillStyle = '#1a0f10'; ctx.beginPath(); ctx.moveTo(-r * 0.28, r * 0.1); ctx.quadraticCurveTo(0, r * 0.42, r * 0.28, r * 0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; for (var i = 0; i < 4; i++) { var tx = -r * 0.21 + i * r * 0.11; ctx.beginPath(); ctx.moveTo(tx, r * 0.12); ctx.lineTo(tx + r * 0.05, r * 0.2); ctx.lineTo(tx + r * 0.1, r * 0.12); ctx.fill(); }
      ctx.restore();
    },
    wisp: function (ctx, m) {
      var r = m.r, t = m.t, c = m.c, f = m.flash, tip = -r * 1.25 + Math.sin(t * 7) * r * 0.08;
      ctx.save(); ctx.translate(0, -r * 1.45 + Math.sin(t * 2) * r * 0.15);
      ctx.shadowColor = c; ctx.shadowBlur = r * 0.9;
      ctx.beginPath(); ctx.moveTo(0, tip);
      ctx.bezierCurveTo(r * 0.55, -r * 0.7, r * 0.95, -r * 0.1, r * 0.75, r * 0.4);
      for (var i = 0; i <= 6; i++) ctx.lineTo(r * 0.75 - i * r * 0.25, r * 0.55 + Math.sin(t * 6 + i) * r * 0.1 + (i % 2 ? r * 0.12 : 0));
      ctx.bezierCurveTo(-r * 0.95, -r * 0.1, -r * 0.55, -r * 0.7, 0, tip); ctx.closePath();
      var g = ctx.createLinearGradient(0, -r * 1.2, 0, r * 0.6); g.addColorStop(0, f ? '#fff' : A.shade(c, 0.5)); g.addColorStop(1, f ? '#fff' : A.hexA(c, 0.55)); ctx.fillStyle = g; ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = f ? '#fff' : 'rgba(255,255,255,.35)'; ellipse(ctx, 0, -r * 0.2, r * 0.4, r * 0.55); ctx.fill();
      eyes(ctx, 0, -r * 0.08, r * 0.15, r * 0.25, m.look, { pupil: '#2b2b5c' });
      ctx.fillStyle = '#2b2b5c'; ellipse(ctx, -r * 0.04, r * 0.24, r * 0.08, r * 0.1 + Math.abs(Math.sin(t * 3)) * r * 0.04); ctx.fill();
      ctx.restore();
    },
    demon: function (ctx, m) {
      var r = m.r, t = m.t, c = m.c, f = m.flash, flap = Math.sin(t * 3) * 0.22;
      ctx.save(); ctx.translate(0, -r * 1.05);
      [-1, 1].forEach(function (s) {
        ctx.save(); ctx.scale(s, 1); ctx.translate(r * 0.35, -r * 0.2); ctx.rotate(-flap); ctx.fillStyle = tone(c, -0.55, f);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.25, -r * 0.85); ctx.lineTo(r * 1.1, -r * 0.3); ctx.lineTo(r * 1.4, -r * 0.05); ctx.lineTo(r * 1.0, r * 0.15); ctx.lineTo(r * 1.2, r * 0.45); ctx.lineTo(r * 0.1, r * 0.45); ctx.closePath(); ctx.fill(); ctx.restore();
      });
      ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.95); ctx.quadraticCurveTo(-r * 1.0, -r * 0.2, -r * 0.45, -r * 0.75); ctx.quadraticCurveTo(0, -r * 1.02, r * 0.45, -r * 0.75); ctx.quadraticCurveTo(r * 1.0, -r * 0.2, r * 0.7, r * 0.95); ctx.closePath();
      ctx.fillStyle = fillOf(ctx, c, 0, -r * 0.1, r, f); ctx.fill();
      ctx.fillStyle = f ? '#fff' : '#f2e2c0';
      [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * r * 0.3, -r * 0.78); ctx.quadraticCurveTo(s * r * 0.8, -r * 1.25, s * r * 0.58, -r * 1.6); ctx.quadraticCurveTo(s * r * 0.55, -r * 1.15, s * r * 0.1, -r * 0.88); ctx.closePath(); ctx.fill(); });
      glowEyes(ctx, 0, -r * 0.42, r * 0.13, r * 0.26, '#ffe066');
      ctx.fillStyle = '#1a0606'; ctx.beginPath(); ctx.moveTo(-r * 0.36, -r * 0.05); ctx.quadraticCurveTo(0, r * 0.32 + Math.sin(t * 2) * r * 0.05, r * 0.36, -r * 0.05); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * r * 0.24, -r * 0.03); ctx.lineTo(s * r * 0.17, r * 0.15); ctx.lineTo(s * r * 0.1, -r * 0.01); ctx.fill(); });
      ctx.save(); ctx.translate(-r * 0.85, r * 0.35); ctx.rotate(-0.25); ctx.fillStyle = f ? '#fff' : '#f4ead2'; ctx.fillRect(-r * 0.32, -r * 0.2, r * 0.64, r * 0.4);
      ctx.fillStyle = '#8b1e1e'; ctx.font = A.font(Math.max(8, r * 0.17), 'display', 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PROMISE', 0, 0); ctx.restore();
      ctx.restore();
    },
    serpent: function (ctx, m) {
      var r = m.r, t = m.t, c = m.c, f = m.flash, pts = [], i;
      for (i = 0; i <= 22; i++) { var k = i / 22; pts.push([r * 0.9 - k * r * 1.15 + Math.sin(k * 6 + t * 2.5) * r * 0.32 * (1 - k * 0.4), -k * r * 1.95]); }
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      function trace() { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]); }
      trace(); ctx.strokeStyle = tone(c, -0.4, f); ctx.lineWidth = r * 0.44; ctx.stroke();
      trace(); ctx.strokeStyle = f ? '#fff' : c; ctx.lineWidth = r * 0.34; ctx.stroke();
      trace(); ctx.setLineDash([r * 0.08, r * 0.15]); ctx.strokeStyle = tone(c, 0.4, f); ctx.lineWidth = r * 0.1; ctx.stroke(); ctx.setLineDash([]);
      var hp = pts[pts.length - 1]; ctx.translate(hp[0], hp[1]);
      ellipse(ctx, -r * 0.12, 0, r * 0.45, r * 0.3); ctx.fillStyle = fillOf(ctx, c, 0, 0, r * 0.4, f); ctx.fill();
      eyes(ctx, -r * 0.05, -r * 0.12, r * 0.1, r * 0.17, m.look, { squint: 0.7, pupil: '#3b2a00', white: '#ffe680' });
      if (Math.sin(t * 5) > 0.2) { ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.moveTo(-r * 0.55, r * 0.05); ctx.lineTo(-r * 0.82, r * 0.05); ctx.lineTo(-r * 0.92, -r * 0.03); ctx.moveTo(-r * 0.82, r * 0.05); ctx.lineTo(-r * 0.92, r * 0.13); ctx.stroke(); }
      ctx.restore();
    },
    bust: function (ctx, m) {
      var r = m.r, t = m.t, c = m.c, f = m.flash, wob = Math.sin(t * 1.3) * 0.04;
      ctx.save(); ctx.rotate(wob);
      ctx.fillStyle = tone('#8a8a90', -0.25, f); ctx.fillRect(-r * 0.7, -r * 0.55, r * 1.4, r * 0.55); ctx.fillStyle = tone('#8a8a90', 0.1, f); ctx.fillRect(-r * 0.82, -r * 0.64, r * 1.64, r * 0.12);
      ctx.fillStyle = fillOf(ctx, c, 0, -r * 1.1, r, f);
      ctx.beginPath(); ctx.moveTo(-r * 0.95, -r * 0.62); ctx.quadraticCurveTo(-r * 0.6, -r * 1.3, -r * 0.3, -r * 1.36); ctx.lineTo(r * 0.3, -r * 1.36); ctx.quadraticCurveTo(r * 0.6, -r * 1.3, r * 0.95, -r * 0.62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = fillOf(ctx, c, 0, -r * 1.85, r * 0.6, f); ellipse(ctx, 0, -r * 1.85, r * 0.5, r * 0.6); ctx.fill();
      ctx.strokeStyle = '#2a1a1a'; ctx.lineWidth = r * 0.035; ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 2.32); ctx.lineTo(-r * 0.05, -r * 2.02); ctx.lineTo(-r * 0.26, -r * 1.76); ctx.moveTo(r * 0.5, -r * 1.12); ctx.lineTo(r * 0.3, -r * 0.92); ctx.lineTo(r * 0.46, -r * 0.7); ctx.stroke();
      ctx.fillStyle = f ? '#fff' : '#3a2a2a'; ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 2.3); ctx.lineTo(r * 0.5, -r * 2.15); ctx.lineTo(r * 0.35, -r * 2.04); ctx.closePath(); ctx.fill();
      glowEyes(ctx, 0, -r * 1.92, r * 0.09, r * 0.2, '#ffb35c');
      ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = r * 0.04; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.14, -r * 1.55); ctx.lineTo(r * 0.14, -r * 1.58); ctx.stroke();
      ctx.save(); ctx.translate(0, -r * 0.95); ctx.rotate(-0.22); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = r * 0.05; ctx.strokeRect(-r * 0.46, -r * 0.17, r * 0.92, r * 0.34); ctx.fillStyle = '#c0392b'; ctx.font = A.font(Math.max(8, r * 0.2), 'display', 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NO BIDS', 0, r * 0.01); ctx.restore();
      ctx.save(); ctx.translate(r * 0.95, -r * 0.5); ctx.rotate(0.3 + Math.sin(t * 2) * 0.1); ctx.fillStyle = f ? '#fff' : '#f4ead2'; ctx.beginPath(); ctx.moveTo(-r * 0.25, -r * 0.36); ctx.lineTo(r * 0.25, -r * 0.36); ctx.lineTo(r * 0.2, r * 0.1); ctx.lineTo(r * 0.05, r * 0.36); ctx.lineTo(-r * 0.2, r * 0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a1f2b'; ctx.font = A.font(Math.max(7, r * 0.12), 'display', 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('RFP', 0, -r * 0.16); ctx.fillStyle = 'rgba(40,20,20,.4)'; for (var i = 0; i < 3; i++) ctx.fillRect(-r * 0.16, -r * 0.02 + i * r * 0.08, r * 0.3, r * 0.03); ctx.restore();
      ctx.restore();
    },
    wraith: function (ctx, m) {
      var r = m.r, t = m.t, c = m.c, f = m.flash, i;
      ctx.save(); ctx.translate(0, -r * 1.3 + Math.sin(t * 1.8) * r * 0.12);
      var au = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.7); au.addColorStop(0, A.hexA(c, 0.35)); au.addColorStop(1, A.hexA(c, 0)); ctx.fillStyle = au; ctx.fillRect(-r * 1.8, -r * 1.8, r * 3.6, r * 3.6);
      ctx.beginPath(); ctx.moveTo(0, -r * 1.05); ctx.quadraticCurveTo(r * 0.7, -r * 1.0, r * 0.72, -r * 0.3); ctx.quadraticCurveTo(r * 1.0, r * 0.2, r * 0.95, r * 0.75);
      for (i = 0; i <= 8; i++) ctx.lineTo(r * 0.95 - i * r * 0.2375, r * 0.75 + (i % 2 ? -r * 0.18 : r * 0.08) + Math.sin(t * 5 + i) * r * 0.06);
      ctx.quadraticCurveTo(-r * 1.0, r * 0.2, -r * 0.72, -r * 0.3); ctx.quadraticCurveTo(-r * 0.7, -r * 1.0, 0, -r * 1.05); ctx.closePath();
      var g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, f ? '#fff' : A.shade(c, -0.15)); g.addColorStop(1, f ? '#fff' : A.shade(c, -0.75)); ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = '#05030a'; ellipse(ctx, 0, -r * 0.45, r * 0.36, r * 0.42); ctx.fill();
      glowEyes(ctx, 0, -r * 0.48, r * 0.09, r * 0.15, '#9cf6ff');
      ctx.save(); ctx.translate(-r * 0.95, r * 0.05); ctx.rotate(-0.18 + Math.sin(t * 2) * 0.06);
      ctx.fillStyle = f ? '#fff' : '#efe6cf'; ctx.fillRect(-r * 0.4, -r * 0.24, r * 0.8, r * 0.48); ctx.fillStyle = f ? '#fff' : '#d8ccae'; ellipse(ctx, -r * 0.4, 0, r * 0.07, r * 0.26); ctx.fill(); ellipse(ctx, r * 0.4, 0, r * 0.07, r * 0.26); ctx.fill();
      ctx.fillStyle = '#7a1f2b'; ctx.font = A.font(Math.max(8, r * 0.17), 'display', 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PROTEST', 0, 0); ctx.restore();
      ctx.restore();
    },
    golem: function (ctx, m) {
      var r = m.r, t = m.t, c = m.c, f = m.flash, sw = Math.sin(t * 1.6);
      ctx.save(); ctx.rotate(sw * 0.03);
      function stone(x, y, w, h, k) { A.roundRect(ctx, x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.28); ctx.fillStyle = tone(c, k, f); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, r * 0.03); ctx.stroke(); }
      stone(-r * 0.35, -r * 0.32, r * 0.42, r * 0.62, -0.3); stone(r * 0.35, -r * 0.32, r * 0.42, r * 0.62, -0.3);
      stone(0, -r * 1.0, r * 1.3, r * 0.98, 0);
      stone(-r * 0.9, -r * 0.95 + sw * r * 0.06, r * 0.4, r * 0.9, -0.18); stone(r * 0.9, -r * 0.95 - sw * r * 0.06, r * 0.4, r * 0.9, -0.18);
      stone(0, -r * 1.72, r * 0.64, r * 0.52, 0.12);
      ctx.save(); ctx.strokeStyle = '#ffb35c'; ctx.shadowColor = '#ffb35c'; ctx.shadowBlur = r * 0.3; ctx.lineWidth = Math.max(1.5, r * 0.04);
      ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 1.35); ctx.lineTo(-r * 0.15, -r * 1.05); ctx.lineTo(-r * 0.28, -r * 0.8); ctx.lineTo(r * 0.05, -r * 0.6); ctx.moveTo(r * 0.35, -r * 1.3); ctx.lineTo(r * 0.2, -r * 1.0); ctx.stroke(); ctx.restore();
      glowEyes(ctx, 0, -r * 1.74, r * 0.08, r * 0.14, '#ffd166');
      ctx.restore();
    },
    audit: function (ctx, m) {
      var r = m.r, t = m.t, c = m.c, f = m.flash, hov = Math.sin(t * 2) * r * 0.1, flut = Math.sin(t * 6) * 0.08, i;
      ctx.save(); ctx.translate(0, -r * 1.35 + hov);
      [-1, 1].forEach(function (s) {
        ctx.save(); ctx.scale(s, 1); ctx.rotate(-flut);
        ctx.fillStyle = f ? '#fff' : '#efe6cf'; ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.quadraticCurveTo(r * 0.9, -r * 1.0, r * 1.1, -r * 0.7); ctx.lineTo(r * 1.0, r * 0.6); ctx.quadraticCurveTo(r * 0.6, r * 0.5, 0, r * 0.7); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(60,40,30,.35)'; ctx.lineWidth = r * 0.025; for (i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(r * 0.12, -r * 0.55 + i * r * 0.2); ctx.lineTo(r * 0.9, -r * 0.62 + i * r * 0.2); ctx.stroke(); }
        ctx.fillStyle = '#c0392b'; ctx.font = A.font(Math.max(7, r * 0.13), 'mono', 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('-$', r * 0.2, r * 0.3);
        ctx.restore();
      });
      ctx.fillStyle = fillOf(ctx, c, 0, 0, r * 0.5, f); A.roundRect(ctx, -r * 0.22, -r * 0.95, r * 0.44, r * 1.75, r * 0.12); ctx.fill();
      glowEyes(ctx, 0, -r * 0.45, r * 0.08, r * 0.1, '#ff5d5d');
      ctx.save(); ctx.translate(r * 0.1, r * 0.9); ctx.rotate(-0.5 + Math.sin(t * 1.5) * 0.15); ctx.strokeStyle = tone(c, -0.3, f); ctx.lineWidth = r * 0.09; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fillStyle = f ? '#fff' : 'rgba(180,230,240,.55)'; ctx.fill(); ctx.strokeStyle = tone(c, -0.3, f); ctx.lineWidth = r * 0.07; ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(-r * 0.6, r * 0.9); ctx.rotate(0.2 + Math.sin(t * 2.2) * 0.1); ctx.fillStyle = f ? '#fff' : '#ffd166'; A.roundRect(ctx, -r * 0.36, -r * 0.14, r * 0.72, r * 0.28, r * 0.04); ctx.fill(); ctx.fillStyle = '#5a2a00'; ctx.font = A.font(Math.max(7, r * 0.14), 'display', 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FINDING', 0, r * 0.01); ctx.restore();
      ctx.restore();
    },
    eye: function (ctx, m) {
      var r = m.r, t = m.t, c = m.c, f = m.flash, blink = Math.sin(t * 0.9) > 0.97 ? 0.12 : 1;
      ctx.save(); ctx.translate(0, -r * 1.5 + Math.sin(t * 2.2) * r * 0.18);
      ctx.strokeStyle = f ? '#fff' : A.hexA(c, 0.85); ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.18, r * 0.32, Math.sin(t * 0.8) * 0.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = tone(c, -0.4, f); [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * r * 0.55, -r * 0.4); ctx.lineTo(s * r * 0.95, -r * 0.85); ctx.lineTo(s * r * 0.7, -r * 0.25); ctx.fill(); });
      ellipse(ctx, 0, 0, r * 0.75, r * 0.75); ctx.fillStyle = fillOf(ctx, c, 0, 0, r * 0.75, f); ctx.fill();
      ctx.fillStyle = '#fff'; ellipse(ctx, -r * 0.05, 0, r * 0.46, r * 0.46 * blink); ctx.fill();
      ctx.fillStyle = '#2b0a1e'; ellipse(ctx, -r * 0.2, r * 0.02, r * 0.22, r * 0.22 * blink); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ellipse(ctx, -r * 0.28, -r * 0.08, r * 0.07, r * 0.07 * blink); ctx.fill();
      ctx.restore();
    },
    gate: function (ctx, m) {
      var r = m.r, t = m.t, c = m.c, f = m.flash, w = r * 2.1, hh = r * 2.25, i;
      ctx.save();
      [-1, 1].forEach(function (s) {
        var fx = s * (w / 2 + r * 0.12), fy = -hh * 0.55 + Math.sin(t * 9 + s) * 2;
        ctx.fillStyle = '#4a3a2a'; ctx.fillRect(fx - r * 0.04, fy, r * 0.08, r * 0.4);
        ctx.save(); ctx.shadowColor = '#ffb35c'; ctx.shadowBlur = r * 0.5; ctx.fillStyle = '#ffb35c'; ctx.beginPath(); ctx.moveTo(fx, fy - r * 0.32 - Math.sin(t * 13 + s) * r * 0.05); ctx.quadraticCurveTo(fx + r * 0.14, fy - r * 0.05, fx, fy); ctx.quadraticCurveTo(fx - r * 0.14, fy - r * 0.05, fx, fy - r * 0.32); ctx.fill(); ctx.restore();
      });
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -hh);
      for (i = 0; i < 7; i++) { var cx = -w / 2 + i * w / 7; ctx.lineTo(cx, -hh); ctx.lineTo(cx, -hh - r * 0.18); ctx.lineTo(cx + w / 14, -hh - r * 0.18); ctx.lineTo(cx + w / 14, -hh); }
      ctx.lineTo(w / 2, -hh); ctx.lineTo(w / 2, 0); ctx.closePath();
      var g = ctx.createLinearGradient(0, -hh, 0, 0); g.addColorStop(0, f ? '#fff' : '#7a6852'); g.addColorStop(1, f ? '#fff' : '#3a2e24'); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1;
      for (i = 1; i < 9; i++) { var by = -hh + i * hh / 9; ctx.beginPath(); ctx.moveTo(-w / 2, by); ctx.lineTo(w / 2, by); ctx.stroke(); for (var j = 0; j < 5; j++) { var bx = -w / 2 + (j + (i % 2) * 0.5) * w / 5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - hh / 9); ctx.stroke(); } }
      ctx.fillStyle = f ? '#fff' : '#7a1f2b'; ctx.fillRect(-w * 0.42, -hh * 0.93, w * 0.84, hh * 0.13);
      ctx.fillStyle = '#f6d991'; ctx.font = A.font(Math.max(9, r * 0.2), 'display', 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CON 3990V', 0, -hh * 0.865);
      glowEyes(ctx, 0, -hh * 0.62, r * 0.14, r * 0.44, c);
      ctx.beginPath(); ctx.moveTo(-w * 0.27, 0); ctx.lineTo(-w * 0.27, -hh * 0.3); ctx.quadraticCurveTo(0, -hh * 0.52, w * 0.27, -hh * 0.3); ctx.lineTo(w * 0.27, 0); ctx.closePath(); ctx.fillStyle = '#0c0705'; ctx.fill();
      ctx.save(); ctx.clip(); var drop = (Math.sin(t * 1.4) * 0.5 + 0.5) * hh * 0.12; ctx.strokeStyle = '#8c7a5a'; ctx.lineWidth = Math.max(2, r * 0.05);
      for (i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * w * 0.075, -hh * 0.5 + drop); ctx.lineTo(i * w * 0.075, drop); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-w * 0.3, -hh * 0.18 + drop); ctx.lineTo(w * 0.3, -hh * 0.18 + drop); ctx.stroke(); ctx.restore();
      ctx.restore();
    }
  };
  function monsterHeight(kind, r) { return { blob: 1.9, imp: 2.0, wisp: 2.8, demon: 2.7, serpent: 2.4, bust: 2.5, wraith: 2.5, golem: 2.1, audit: 2.6, eye: 2.4, gate: 2.5 }[kind] * r || 2 * r; }

  // The hero: a Soldier in OCP with a shoulder-fired RPG launcher. o = { flash, aim (radians, 0 = level), recoil (0..1),
  // loaded (a warhead sits in the muzzle), charged (Warrant Strike ready: the warhead glows gold) }
  var REST_AIM = -0.12;
  function drawHero(ctx, x, y, s, t, o) {
    o = o || {};
    var f = o.flash > 0, bob = Math.sin(t * 3) * 1.5 * s;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ellipse(ctx, 0, 0, 30 * s, 7 * s); ctx.fill();
    ctx.translate(0, bob);
    ctx.fillStyle = f ? '#fff' : '#57553f'; ctx.fillRect(-11 * s, -32 * s, 9 * s, 27 * s); ctx.fillRect(2 * s, -32 * s, 9 * s, 27 * s);
    ctx.fillStyle = f ? '#fff' : '#b39568'; A.roundRect(ctx, -13 * s, -8 * s, 13 * s, 8 * s, 2 * s); ctx.fill(); A.roundRect(ctx, 1 * s, -8 * s, 14 * s, 8 * s, 2 * s); ctx.fill();
    A.roundRect(ctx, -15 * s, -68 * s, 30 * s, 40 * s, 8 * s); ctx.fillStyle = f ? '#fff' : '#76724f'; ctx.fill();
    if (!f) {
      ctx.save(); A.roundRect(ctx, -15 * s, -68 * s, 30 * s, 40 * s, 8 * s); ctx.clip();
      ctx.fillStyle = '#8e8460'; ellipse(ctx, -6 * s, -58 * s, 7 * s, 4 * s); ctx.fill(); ellipse(ctx, 7 * s, -42 * s, 8 * s, 5 * s); ctx.fill();
      ctx.fillStyle = '#5c6142'; ellipse(ctx, 6 * s, -62 * s, 5 * s, 3 * s); ctx.fill(); ellipse(ctx, -7 * s, -37 * s, 6 * s, 4 * s); ctx.fill();
      ctx.fillStyle = '#3f3f2c'; ctx.fillRect(-15 * s, -36 * s, 30 * s, 4 * s);
      ctx.restore();
    }
    ctx.fillStyle = f ? '#fff' : '#d9a77c'; ellipse(ctx, 1 * s, -79 * s, 11 * s, 12 * s); ctx.fill();
    ctx.fillStyle = f ? '#fff' : '#6a6648'; A.roundRect(ctx, -11 * s, -97 * s, 24 * s, 11 * s, 3 * s); ctx.fill(); ctx.fillRect(0, -88 * s, 18 * s, 3 * s);
    ctx.fillStyle = '#1c1a14'; ellipse(ctx, 6 * s, -79 * s, 1.6 * s, 2 * s); ctx.fill();
    // the launcher pivots on the right shoulder and kicks back when it fires
    ctx.save(); ctx.translate(4 * s - (o.recoil || 0) * 6 * s, -66 * s); ctx.rotate(o.aim == null ? REST_AIM : o.aim);
    ctx.strokeStyle = f ? '#fff' : '#76724f'; ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6 * s, 10 * s); ctx.lineTo(0, 12 * s); ctx.moveTo(-2 * s, 6 * s); ctx.lineTo(14 * s, 12 * s); ctx.stroke();
    ctx.fillStyle = f ? '#fff' : '#3a3e2e';
    ctx.beginPath(); ctx.moveTo(-30 * s, -4.5 * s); ctx.lineTo(-38 * s, -7.5 * s); ctx.lineTo(-38 * s, 7.5 * s); ctx.lineTo(-30 * s, 4.5 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = f ? '#fff' : '#4a4f3a'; A.roundRect(ctx, -30 * s, -4.5 * s, 64 * s, 9 * s, 3 * s); ctx.fill();
    ctx.fillStyle = f ? '#fff' : '#8a5a2b'; A.roundRect(ctx, -6 * s, -5.5 * s, 18 * s, 11 * s, 2 * s); ctx.fill();
    ctx.fillStyle = '#23261c'; ctx.fillRect(2 * s, -10 * s, 8 * s, 5 * s);
    ctx.fillStyle = f ? '#fff' : '#3a3e2e'; ctx.fillRect(14 * s, 4 * s, 4 * s, 9 * s); ctx.fillRect(-2 * s, 4 * s, 4 * s, 8 * s);
    ctx.fillStyle = f ? '#fff' : '#d9a77c'; ellipse(ctx, 0, 12 * s, 3.6 * s, 3.6 * s); ctx.fill(); ellipse(ctx, 15 * s, 12.5 * s, 3.6 * s, 3.6 * s); ctx.fill();
    if (o.loaded !== false) {
      if (o.charged) { ctx.shadowColor = '#f6d991'; ctx.shadowBlur = 16 * s; }
      ctx.fillStyle = f ? '#fff' : o.charged ? '#e6b85a' : '#6d7348';
      ctx.beginPath(); ctx.moveTo(34 * s, -4 * s); ctx.quadraticCurveTo(42 * s, -9 * s, 50 * s, -5 * s); ctx.lineTo(60 * s, 0); ctx.lineTo(50 * s, 5 * s); ctx.quadraticCurveTo(42 * s, 9 * s, 34 * s, 4 * s); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    ctx.restore();
  }
  // a rocket in flight: warhead forward, fins and an engine flame behind
  function drawRocket(ctx, x, y, ang, s, big, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    var fl = 8 + Math.sin(t * 60) * 3;
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(-9 * s, -3 * s); ctx.lineTo(-(9 + fl) * s, 0); ctx.lineTo(-9 * s, 3 * s); ctx.fill();
    ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.moveTo(-9 * s, -1.6 * s); ctx.lineTo(-(9 + fl * 0.55) * s, 0); ctx.lineTo(-9 * s, 1.6 * s); ctx.fill();
    if (big) { ctx.shadowColor = '#f6d991'; ctx.shadowBlur = 14 * s; }
    ctx.fillStyle = big ? '#e6b85a' : '#5f6640'; A.roundRect(ctx, -9 * s, -2.6 * s, 12 * s, 5.2 * s, 2 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3 * s, -4.5 * s); ctx.quadraticCurveTo(9 * s, -5 * s, 14 * s, 0); ctx.quadraticCurveTo(9 * s, 5 * s, 3 * s, 4.5 * s); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#2b2e22';
    ctx.beginPath(); ctx.moveTo(-9 * s, -2.6 * s); ctx.lineTo(-12 * s, -5.5 * s); ctx.lineTo(-7 * s, -2.6 * s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-9 * s, 2.6 * s); ctx.lineTo(-12 * s, 5.5 * s); ctx.lineTo(-7 * s, 2.6 * s); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  A.register({
    id: 'contract-quest', title: 'Contract Quest', icon: '⚔️', accent: '#b98cff', genre: 'RPG battles', music: 'quest',
    tagline: 'Fight through the four exam areas and the Exam Citadel. Right answers fire your RPG; wrong ones let the monsters hit back. Each realm ends with one of the four things that end careers, and your Master Gunner is in your ear.',
    drills: 'All 384 bank questions, by exam area',
    controls: 'Answer with 1 to 4, A to D, or a tap; Enter continues. Three right in a row charges a Warrant Strike (triple damage on your next right answer). Fast answers and streaks hit harder. Items: a 50/50 scroll removes two wrong answers; a potion gives back a heart. Bosses ask their own family of questions and, at half health, attack on every miss. Clear a realm without losing a heart for three stars.',
    aspect: [0.95, 2.3], countdown: false, letterKeys: true, outTitle: 'Defeated',
    dataOk: function (D) { return bankOf(D).length >= 40; },
    thumb: function (ctx, w, h, t) {
      var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#120a2a'); g.addColorStop(1, '#4a3786'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#251b52'; ctx.beginPath(); ctx.moveTo(0, h); for (var x = 0; x <= w; x += 12) ctx.lineTo(x, h * 0.66 - 18 * Math.sin(x * 0.012 + t * 0.2) - 8 * Math.sin(x * 0.03)); ctx.lineTo(w, h); ctx.fill();
      ctx.fillStyle = '#1a1338'; ctx.fillRect(0, h * 0.84, w, h);
      var ph = t % 2.4, s = 1.05, aim = -0.08, px = w * 0.24 + 4 * s, py = h * 0.9 - 66 * s;
      var fired = ph > 1.1 && ph < 1.9, fly = ph > 1.1 && ph < 1.42, k = (ph - 1.1) / 0.32;
      var mx = px + Math.cos(aim) * 60 * s, my = py + Math.sin(aim) * 60 * s, tx = w * 0.72, ty = h * 0.9 - 40;
      ctx.save(); ctx.translate(w * 0.73, h * 0.9); KINDS.blob(ctx, { r: 40, t: t, c: '#b39dff', flash: ph > 1.42 && ph < 1.52, look: -1 }); ctx.restore();
      drawHero(ctx, w * 0.24, h * 0.9, s, t, { aim: aim, loaded: !fired, recoil: ph > 1.1 && ph < 1.3 ? 1 - (ph - 1.1) / 0.2 : 0 });
      if (fly) {
        for (var j = 1; j < 7; j++) { var kk = Math.max(0, k - j * 0.07); ctx.fillStyle = 'rgba(220,214,200,' + (0.5 - j * 0.07) + ')'; ctx.beginPath(); ctx.arc(A.lerp(mx, tx, kk), A.lerp(my, ty, kk), 4 + j, 0, Math.PI * 2); ctx.fill(); }
        drawRocket(ctx, A.lerp(mx, tx, k), A.lerp(my, ty, k), Math.atan2(ty - my, tx - mx), s, false, t);
      }
      if (ph >= 1.42 && ph < 1.9) { var e = (ph - 1.42) / 0.48; ctx.globalAlpha = 1 - e; ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.arc(tx, ty, 14 + e * 52, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(tx, ty, 8 + e * 26, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      for (var i = 0; i < 3; i++) { ctx.fillStyle = i < (ph > 1.45 ? 1 : 3) ? '#ff6b6b' : 'rgba(255,255,255,.2)'; A.roundRect(ctx, w * 0.73 - 30 + i * 21, h * 0.35, 17, 8, 3); ctx.fill(); }
      if (ph > 1.42 && ph < 2.2) A.text(ctx, '-2', w * 0.73, h * 0.3 - (ph - 1.42) * 30, { size: 30, fam: 'display', weight: 900, color: '#f6d991', align: 'center', stroke: 'rgba(0,0,0,.7)' });
    },
    create: function (api) {
      var W = api.W, H = api.H, tier = api.difficulty, t = 0, feel = A.feel, opts = api.opts || {};
      var quest = A.save.get('quest', {}); if (!quest || typeof quest !== 'object') quest = {};
      var bossOnly = opts.boss && BOSSES[opts.boss] ? opts.boss : '', hardNext = false, held = false, rights = 0;
      var mode = 'map', realm = null, foes = [], foeIx = 0, foe = null, pool = [];
      var q = null, order = [], shown = 0, limit = 0, timer = 0, answered = false, used5050 = false;
      var streak = 0, focus = 0, charged = false, items = { scroll: 1, potion: 1 }, lost = 0;
      var anim = null, pending = null, clearT = 0, mapSel = 0, mapHover = -1, earned = 1;
      var hero = { flash: 0, aim: null, recoil: 0, loaded: true }, rockets = [], beam = 0, motes = [];
      api.progress.configure({ perLevel: 4 });

      function sc() { return api.clamp(Math.min(H / 360, W / 540), 0.55, 1.5); }
      function heroX() { return W * 0.24; }
      function groundY() { return H * 0.88; }
      function foeX() { return W * 0.7; }
      function foeR() { return api.clamp(Math.min(H * 0.16, W * 0.12), 24, 92) * (foe && foe.def.boss ? 1.25 : 1); }
      function lives() { return api.life(0); }
      function pivot() { var s = sc(); return { x: heroX() + 4 * s - hero.recoil * 6 * s, y: groundY() + Math.sin(t * 3) * 1.5 * s - 66 * s }; }
      function along(p, ang, d) { return { x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d }; }
      function foeAim() { var r = foeR(); return foe ? { x: foeX() - r * 0.15, y: groundY() - monsterHeight(foe.def.kind, r) * 0.5 } : { x: W * 0.7, y: H * 0.6 }; }
      function aimNow() { return hero.aim == null ? REST_AIM : hero.aim; }
      // a rocket waits `delay` seconds, then leaves the muzzle with a backblast; the first rocket of a volley carries the damage
      function launch(a, delay, first) { rockets.push({ a: a, t: -delay, first: first, big: !!a.strike, launched: false, dur: 0.3 }); }
      function impact(rk) {
        var a = rk.a, x = rk.tx, y = rk.ty;
        api.particles.emit({ x: x, y: y, n: rk.big ? 60 : 38, color: rk.big ? ['#fff3c4', '#f6d991', '#ffb347', '#ff8a3d'] : ['#ffd166', '#ff8a3d', '#ff5d3d', '#fff3c4'], speed: rk.big ? 460 : 340, gravity: 160, life: 0.7, size: 7 });
        api.particles.emit({ x: x, y: y, n: 12, color: ['#6f6a62', '#8d877c'], speed: 70, gravity: -40, life: 1.3, size: 16, drag: 0.95 });
        api.particles.ring(x, y, { color: rk.big ? '#f6d991' : '#fff1c4', grow: rk.big ? 460 : 300, life: 0.45, width: rk.big ? 7 : 5 });
        if (rk.big) api.audio.bigBoom(); else api.audio.boom();
        api.shake(rk.big ? 12 : 7);
        if (!rk.first || !foe || a.hit) return;
        a.hit = true; a.hitAt = a.t; foe.hp = Math.max(0, foe.hp - a.dmg); foe.flash = 0.14; foe.kb = 1;
        api.audio.hit(); feel.hitstop.hit(a.strike ? 90 : 50);
        if (foe.def.boss && !foe.phase2 && foe.hp > 0 && foe.hp <= foe.maxHp / 2 && BOSSES[foe.def.boss]) {
          foe.phase2 = true; var B2 = BOSSES[foe.def.boss];
          setTimeout(function () { if (!foe || foe.hp <= 0) return; api.hud.set({ banner: 'Second phase: ' + B2.special, sub: B2.specialText, color: '#ff6b6b', bannerTime: 3.2 }); api.music.setIntense(true); api.audio.alarm(); api.shake(8); feel.buzz([40, 30, 40]); api.mentor.say('worried', A.mentor.line('worried'), 3.5); }, 500);
        }
        api.floaters.add('-' + a.dmg, x, y - foeR() * 0.7, { size: a.strike ? 46 : a.dmg > 1 ? 36 : 30, color: a.strike ? '#f6d991' : '#fff' });
        if (a.fast) api.floaters.add('FAST!', x + 40, y - foeR() * 1.2, { size: 18, color: '#8be0b9' });
        if (a.strike) { beam = 0.5; api.flash('rgba(246,217,145,.55)'); }
        if (foe.hp <= 0) { a.kill = true; a.killAt = a.t + 0.25; }
      }
      function updateRockets(dt) {
        for (var i = rockets.length - 1; i >= 0; i--) {
          var rk = rockets[i], s = sc(); rk.t += dt;
          if (rk.t < 0) continue;
          if (!rk.launched) {
            rk.launched = true;
            var ang = aimNow(), pv = pivot(), m = along(pv, ang, 60 * s), rear = along(pv, ang, -38 * s), tg = foeAim();
            rk.sx = m.x; rk.sy = m.y; rk.tx = tg.x + (rk.first ? 0 : A.rand(-16, 16) * s); rk.ty = tg.y + (rk.first ? 0 : A.rand(-14, 14) * s);
            rk.dur = api.clamp(A.dist(m.x, m.y, rk.tx, rk.ty) / (rk.a.fast ? 1500 : 1100), 0.16, 0.45);
            hero.recoil = 1; hero.loaded = false;
            api.audio.shot(); api.audio.whoosh();
            api.particles.emit({ x: rear.x, y: rear.y, n: 16, color: ['#cfc8bb', '#a9a294', '#e9e4da'], speed: 170, gravity: -30, life: 1, size: 14, angle: ang + Math.PI, spread: 0.45, drag: 0.93 });
            api.particles.emit({ x: rear.x, y: rear.y, n: 10, color: ['#ffd166', '#ff8a3d'], speed: 230, gravity: 0, life: 0.25, size: 6, angle: ang + Math.PI, spread: 0.35 });
            api.particles.emit({ x: m.x, y: m.y, n: 8, color: ['#fff3c4', '#ffd166'], speed: 140, gravity: 0, life: 0.18, size: 5, angle: ang, spread: 0.5 });
          }
          var u = Math.min(1, rk.t / rk.dur), e = u * u * 0.35 + u * 0.65, wob = Math.sin(u * Math.PI * 3) * 4 * s * (1 - u);
          var dx = rk.tx - rk.sx, dy = rk.ty - rk.sy, len = Math.sqrt(dx * dx + dy * dy) || 1;
          rk.x = rk.sx + dx * e - dy / len * wob; rk.y = rk.sy + dy * e + dx / len * wob; rk.ang = Math.atan2(dy, dx);
          api.particles.emit({ x: rk.x - Math.cos(rk.ang) * 10 * s, y: rk.y - Math.sin(rk.ang) * 10 * s, n: 2, color: ['#ddd6c8', '#bdb5a6'], speed: 24, gravity: -18, life: 0.7, size: 8, drag: 0.94 });
          if (u >= 1) { rockets.splice(i, 1); impact(rk); }
        }
      }

      // ---- realm map ----
      function mapNodes() {
        var out = [], n = REALMS.length, top = H * 0.2, bot = H * 0.8;
        for (var i = 0; i < n; i++) out.push({ x: W * (0.12 + 0.76 * i / (n - 1)), y: top + (bot - top) * (0.5 + 0.36 * Math.sin(i * 2.2 + 0.5)) });
        return out;
      }
      function showMap() {
        mode = 'map'; api.music.play('quest');
        api.prompt.set({ kicker: 'Contract Quest · choose a realm', text: 'Where do you fight today?', sub: 'Each realm is one exam area: two monsters and a boss. The Exam Citadel mixes every area.', color: '#b98cff' });
        api.choices.set(REALMS.map(function (r, i) { var s = (quest[r.id] || {}).stars || 0; return { text: r.name + ' · ' + r.sub + '   ' + starText(s), tag: String(i + 1) }; }), function (i) { enter(REALMS[i]); }, { cols: 1 });
        api.choices.tools(null);
      }
      function enter(r) {
        realm = r; pool = poolFor(api.data, r, opts.lessons); foes = r.foes.slice(); foeIx = 0; lost = 0;
        if (bossOnly) { var bd = r.foes.filter(function (f) { return f.boss === bossOnly; })[0] || r.foes[r.foes.length - 1]; var copy = {}; Object.keys(bd).forEach(function (k) { copy[k] = bd[k]; }); copy.hp = 8; foes = [copy]; }
        items = { scroll: 1, potion: 1 }; streak = 0; focus = 0; charged = false; mapSel = REALMS.indexOf(r);
        if (!pool.length) pool = bankOf(api.data);
        api.choices.clear(); api.prompt.clear(); api.music.play('battle'); api.audio.select();
        motes = []; for (var i = 0; i < 46; i++) motes.push(newMote(true));
        spawn();
      }

      // ---- battle flow ----
      function spawn() {
        var d = foes[foeIx];
        foe = { def: d, hp: d.hp, maxHp: d.hp, enter: 0, flash: 0, kb: 0, lunge: 0, dead: 0, t: Math.random() * 10 };
        mode = 'intro';
        api.prompt.set({ kicker: realm.name + (d.boss ? ' · BOSS' : ' · encounter ' + (foeIx + 1) + ' of ' + foes.length), text: d.name, sub: '“' + d.line + '”', color: d.boss ? '#ff6b6b' : realm.color, big: true });
        api.choices.clear();
        if (d.boss) { api.audio.bigBoom(); api.shake(10); api.flash('rgba(255,60,60,.35)'); api.hud.set({ banner: 'BOSS BATTLE', sub: d.name, color: '#ff6b6b', bannerTime: 2 }); feel.buzz([30, 40, 60]); if (BOSSES[d.boss]) api.mentor.say('brief', BOSSES[d.boss].intro, 7); }
        else api.audio.whoosh();
      }
      // a boss asks from its own family of lessons when the realm has enough of them; a re-solicit brings a hard one
      function askPool() {
        var src = pool, B = foe && foe.def.boss && BOSSES[foe.def.boss];
        if (B && B.family.length) { var fam = pool.filter(function (q) { return B.family.indexOf(q.lesson) >= 0; }); if (fam.length >= 10) src = fam; }
        if (hardNext) { hardNext = false; var hard = src.filter(function (q) { return q.d >= 3; }); if (hard.length < 3) hard = src.filter(function (q) { return q.d >= 2; }); if (hard.length >= 3) src = hard; }
        return src;
      }
      function ask() {
        q = api.progress.pick(askPool(), function (x) { return x.id; });
        order = api.shuffle([0, 1, 2, 3]); answered = false; used5050 = false; shown++;
        var words = (q.stem + ' ' + q.options.map(function (o) { return o.text; }).join(' ')).split(/\s+/).length;
        limit = tier.limit ? api.clamp(12 + words * 0.5, 20, 60) * tier.limit : 0; timer = limit;
        var ph = realm.id === 'all' ? A.data.phase(q.phase) : null;
        api.prompt.set({ kicker: (ph ? ph.name : realm.sub) + ' · question ' + shown + (q.__via === 'review' ? ' · missed before' : '') + ' · vs ' + foe.def.name, text: q.stem, color: ph ? ph.color : realm.color });
        api.choices.set(order.map(function (k) { return { text: q.options[k].text }; }), pick);
        api.choices.timer(limit ? 1 : null);
        mode = 'ask'; tools();
      }
      function tools() {
        var full = lives() >= tier.lives;
        api.choices.tools([
          { icon: '📜', label: '50/50', count: items.scroll, disabled: !(mode === 'ask' && !answered && !used5050 && items.scroll > 0), title: 'Remove two wrong answers', onClick: use5050 },
          { icon: '🧪', label: 'Potion', count: items.potion, disabled: !(items.potion > 0 && !full), title: full ? 'Your hearts are full' : 'Get a heart back', onClick: usePotion },
          { icon: '⚡', label: charged ? 'Warrant Strike ready' : 'Focus ' + focus + '/3', on: charged, disabled: true, title: 'Three right in a row charges a Warrant Strike: triple damage on your next right answer' }
        ]);
      }
      function use5050() {
        if (mode !== 'ask' || answered || used5050 || items.scroll <= 0) return;
        var wrong = []; order.forEach(function (k, i) { if (!q.options[k].correct) wrong.push(i); });
        api.shuffle(wrong).slice(0, 2).forEach(function (i) { api.choices.disable(i); });
        items.scroll--; used5050 = true; api.audio.powerup(); tools();
      }
      function usePotion() {
        if (items.potion <= 0 || lives() >= tier.lives) return;
        items.potion--; api.life(1); hero.flash = 0; api.audio.powerup();
        api.floaters.add('+1 ♥', heroX(), groundY() - 110 * sc(), { color: '#5fd39a', size: 24 });
        api.particles.emit({ x: heroX(), y: groundY() - 50 * sc(), n: 22, color: ['#5fd39a', '#bff7da'], speed: 140, gravity: -60, life: 0.9 });
        tools();
      }
      function pick(i) {
        if (mode !== 'ask' || answered) return;
        answered = true;
        resolve(q.options[order[i]], i);
      }
      function resolve(opt, i) {
        var right = null, ri = -1;
        order.forEach(function (k, j) { if (q.options[k].correct) { right = q.options[k]; ri = j; } });
        var ok = !!(opt && opt.correct);
        api.choices.lock(); api.choices.mark(ri, 'right'); if (!ok && i >= 0) api.choices.mark(i, 'wrong'); api.choices.timer(null);
        api.review.add({ prompt: q.stem, given: opt ? opt.text : '(no answer: time ran out)', correct: right.text, ok: ok, explanation: right.why, cite: q.cite, lesson: q.lesson, qid: q.id, key: q.id });
        var title, body;
        if (ok) {
          streak++; rights++;
          var fast = limit && timer > limit * 0.6, strike = charged && !held, dmg = 1 + (streak >= 3 ? 1 : 0) + (fast ? 1 : 0);
          if (strike) { dmg *= 3; charged = false; focus = 0; } else if (!held) { focus = Math.min(3, focus + 1); if (focus >= 3) charged = true; }
          if (held) { dmg = 1; held = false; }
          api.score(100 * dmg + 20 * Math.min(streak, 10) + (fast ? 80 : 0));
          api.progress.correct(); feel.buzz(8);
          anim = { type: 'attack', t: 0, dmg: dmg, strike: strike, fast: fast, hit: false };
          title = strike ? '⚡ Warrant Strike! ' + dmg + ' damage.' : (streak >= 3 ? 'Right! Combo ×' + streak + '.' : 'Right!') + (fast ? ' Fast hit.' : '');
          if (anim.dmg === 1 && !strike && opt && foe.def.boss && foe.phase2 && title === 'Right!') title = 'Right, but the award was stayed: 1 damage.';
          body = opt.why;
          if (charged) title += ' Warrant Strike charged.';
          if (streak === 3 || streak === 5 || streak === 7) api.mentor.say('pleased', A.mentor.LINES.streak[streak === 3 ? 0 : streak === 5 ? 1 : 2], 3);
          else if (foe.def.boss && rights % 3 === 0) api.mentor.say('pleased', A.mentor.line('pleased'), 2.4);
        } else {
          streak = 0; focus = 0; charged = false; lost++;
          anim = { type: 'hurt', t: 0, hit: false };
          if (foe.def.boss) api.mentor.say('hint', A.mentor.line('tips'), 3.5);
          title = opt ? 'Not quite.' : 'Time ran out.';
          body = (opt ? 'Your answer: ' + opt.text + '. ' + (opt.why || '') + ' ' : '') + 'Right answer: ' + right.text + '. ' + (right.why || '');
        }
        mode = 'anim'; tools();
        api.choices.feedback({ ok: ok, title: title, body: body, cite: q.cite, auto: ok && tier.read === 'off' ? 3 : 0 }, function () { if (anim) pending = advance; else advance(); });
      }
      function timeout() { if (answered) return; answered = true; api.audio.alarm(); resolve(null, -1); }
      // the boss's second-phase attack after a miss
      function special() {
        var B = BOSSES[foe.def.boss]; if (!B) return; var kx = foeX(), ky = groundY() - foeR() * 1.7, sub = B.specialText;
        if (B.id === 'uc') { foe.hp = Math.min(foe.maxHp, foe.hp + 1); api.floaters.add('+1 ratified', kx, ky, { size: 22, color: '#ff9c9c', life: 1.4 }); }
        else if (B.id === 'bust' || B.id === 'gate') { focus = 0; charged = false; hardNext = true; if (B.id === 'bust') api.floaters.add('Focus lost', heroX(), groundY() - 130 * sc(), { size: 20, color: '#ff9c9c' }); }
        else if (B.id === 'audit') { if (items.potion > 0) { items.potion--; sub = 'Finding: the Audit took your potion.'; } else if (items.scroll > 0) { items.scroll--; sub = 'Finding: the Audit took your 50/50 scroll.'; } else { foe.hp = Math.min(foe.maxHp, foe.hp + 1); sub = 'Finding: nothing left to take, so the boss heals 1.'; api.floaters.add('+1', kx, ky, { size: 22, color: '#ff9c9c' }); } }
        else if (B.id === 'protest') { focus = 0; charged = false; held = true; api.floaters.add('Next hit held to 1', heroX(), groundY() - 130 * sc(), { size: 18, color: '#ff9c9c' }); }
        api.hud.set({ banner: B.special, sub: sub, color: '#ff6b6b', bannerTime: 2.4 }); api.audio.alarm(); tools();
      }
      function advance() {
        pending = null;
        if (lives() <= 0) return;
        if (foe.hp <= 0) {
          foeIx++;
          if (foeIx >= foes.length) { clear(); return; }
          spawn(); return;
        }
        ask();
      }
      function clear() {
        var stars = lost === 0 ? 3 : lost === 1 ? 2 : 1;
        if (!bossOnly) { var rec = quest[realm.id] || { stars: 0, clears: 0 }; rec.stars = Math.max(rec.stars || 0, stars); rec.clears = (rec.clears || 0) + 1; rec.last = new Date().toISOString().slice(0, 10); quest[realm.id] = rec; A.save.set('quest', quest); }
        api.score(300 * stars); mode = 'clear'; clearT = 0; foe = null;
        api.choices.clear(); api.prompt.set({ kicker: realm.name, text: bossOnly ? foes[0].name + ' defeated' : 'Realm cleared  ' + starText(stars), sub: stars === 3 ? 'Flawless: no hearts lost.' : bossOnly ? 'Its tricks are on your study list.' : 'Clear it without losing a heart for three stars.', color: '#f6d991', big: true });
        api.audio.fanfare(); api.hud.set({ banner: bossOnly ? 'BOSS DOWN' : 'REALM CLEARED', sub: bossOnly ? foes[0].name : starText(stars), color: '#f6d991', bannerTime: 2.4 });
        api.particles.emit({ x: W / 2, y: H * 0.4, n: 90, color: ['#f6d991', '#e6b85a', '#ffffff', realm.color], speed: 420, gravity: 240, life: 1.6, shape: 'square', size: 7 });
        clearT = 0.001; earned = stars;
      }

      // ---- ambient motes per realm ----
      function newMote(any) {
        var k = realm ? realm.theme.motes : 'snow';
        var m = { x: Math.random() * W, y: any ? Math.random() * H : (k === 'sparks' || k === 'embers' || k === 'seeds' ? H + 5 : -5), s: Math.random() * 2 + 0.8, v: Math.random() * 0.6 + 0.6, ph: Math.random() * 6 };
        return m;
      }
      function updateMotes(dt) {
        var k = realm.theme.motes;
        motes.forEach(function (m, i) {
          m.ph += dt;
          if (k === 'snow') { m.y += 26 * m.v * dt; m.x += Math.sin(m.ph) * 12 * dt; }
          else if (k === 'rain') { m.y += 420 * m.v * dt; m.x -= 90 * dt; }
          else if (k === 'seeds') { m.y -= 14 * m.v * dt; m.x += (18 + Math.sin(m.ph) * 10) * dt; }
          else { m.y -= 40 * m.v * dt; m.x += Math.sin(m.ph * 2) * 16 * dt; }
          if (m.y > H + 10 || m.y < -10 || m.x < -20 || m.x > W + 20) motes[i] = newMote(false);
        });
      }
      function drawMotes(ctx) {
        var k = realm.theme.motes; ctx.save(); ctx.fillStyle = realm.theme.mote; ctx.strokeStyle = realm.theme.mote;
        motes.forEach(function (m) {
          if (k === 'rain') { ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - 4, m.y + 14); ctx.stroke(); }
          else { ctx.globalAlpha = (k === 'sparks' || k === 'embers') ? 0.5 + 0.5 * Math.sin(m.ph * 6) : 0.7; ellipse(ctx, m.x, m.y, m.s, m.s); ctx.fill(); }
        });
        ctx.restore();
      }

      // ---- scene ----
      function hills(ctx, base, amp, color, freq, shift) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H); for (var x = 0; x <= W + 12; x += 12) ctx.lineTo(x, base - amp * (0.6 * Math.sin((x + shift) * 0.006 * freq) + 0.4 * Math.sin((x + shift) * 0.014 * freq + 1.3))); ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); }
      function drawScene(ctx) {
        var th = realm.theme, g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, th.sky[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        var ox = W * 0.84, oy = H * 0.2, orr = Math.min(W, H) * 0.07, og = ctx.createRadialGradient(ox, oy, 0, ox, oy, orr * 3.2);
        og.addColorStop(0, A.hexA(th.orb, 0.9)); og.addColorStop(0.3, A.hexA(th.orb, 0.3)); og.addColorStop(1, A.hexA(th.orb, 0)); ctx.fillStyle = og; ctx.fillRect(ox - orr * 3.2, oy - orr * 3.2, orr * 6.4, orr * 6.4);
        ctx.fillStyle = th.orb; ellipse(ctx, ox, oy, orr, orr); ctx.fill();
        hills(ctx, H * 0.62, H * 0.08, th.hill[0], 0.7, t * 5);
        hills(ctx, H * 0.72, H * 0.06, th.hill[1], 1.4, t * 11);
        var gy = H * 0.76, gg = ctx.createLinearGradient(0, gy, 0, H); gg.addColorStop(0, th.ground[0]); gg.addColorStop(1, th.ground[1]); ctx.fillStyle = gg; ctx.fillRect(0, gy, W, H - gy);
        ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
        for (var i = -9; i <= 9; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * W * 0.05, gy); ctx.lineTo(W / 2 + i * W * 0.24, H); ctx.stroke(); }
        drawMotes(ctx);
      }
      function drawFoe(ctx) {
        if (!foe) return;
        var r = foeR(), k = foe.enter < 1 ? A.ease.outBack(foe.enter) : 1, x = foeX() + (1 - k) * W * 0.5 - foe.lunge * (foeX() - heroX() - 90 * sc()) + foe.kb * 30;
        var gy = groundY(), alpha = foe.dead ? Math.max(0, 1 - foe.dead) : 1;
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ellipse(ctx, x, gy, r * 0.95, r * 0.2); ctx.fill();
        if (foe.def.boss) { var au = ctx.createRadialGradient(x, gy - r, r * 0.3, x, gy - r, r * 2.4); au.addColorStop(0, A.hexA(foe.def.color, 0.28)); au.addColorStop(1, A.hexA(foe.def.color, 0)); ctx.fillStyle = au; ctx.fillRect(x - r * 2.4, gy - r * 3.4, r * 4.8, r * 4.8); }
        ctx.translate(x, gy); var sc2 = 1 + (foe.dead || 0) * 0.35; ctx.scale(sc2, sc2);
        KINDS[foe.def.kind](ctx, { r: r, t: foe.t, c: foe.def.color, flash: foe.flash > 0, look: -1 });
        ctx.restore();
        if (foe.dead || foe.enter < 1) return;
        var top = gy - monsterHeight(foe.def.kind, r) - 18, pw = Math.min(26, (r * 2.4) / foe.maxHp - 4), tw = foe.maxHp * (pw + 4) - 4;
        A.text(ctx, foe.def.name, x, top - 12, { size: api.clamp(13 * sc(), 11, 18), weight: 800, color: '#fff', align: 'center', stroke: 'rgba(0,0,0,.7)', strokeWidth: 4 });
        for (var i = 0; i < foe.maxHp; i++) { A.roundRect(ctx, x - tw / 2 + i * (pw + 4), top - 4, pw, 9, 3); ctx.fillStyle = i < foe.hp ? '#ff6b6b' : 'rgba(255,255,255,.2)'; ctx.fill(); }
      }
      function drawHud(ctx) {
        var s = sc(), x = heroX(), top = groundY() - 128 * s;
        for (var i = 0; i < 3; i++) { ctx.save(); ctx.translate(x - 22 * s + i * 22 * s, top); ctx.rotate(Math.PI / 4); var on = i < focus || charged; ctx.fillStyle = on ? (charged ? '#f6d991' : '#8be0b9') : 'rgba(255,255,255,.18)'; if (charged) { ctx.shadowColor = '#f6d991'; ctx.shadowBlur = 12; } ctx.fillRect(-6 * s, -6 * s, 12 * s, 12 * s); ctx.restore(); }
        A.text(ctx, realm.name.toUpperCase(), 14, 24, { size: 12, weight: 800, color: A.hexA(realm.color, 0.95) });
        for (var j = 0; j < foes.length; j++) { ctx.fillStyle = j < foeIx ? '#8be0b9' : j === foeIx ? '#f6d991' : 'rgba(255,255,255,.2)'; ellipse(ctx, 18 + j * 16, 38, 5, 5); ctx.fill(); }
        if (streak >= 2) A.text(ctx, 'Combo ×' + streak, 14 + foes.length * 16 + 10, 42, { size: 13, weight: 800, color: '#f6d991' });
      }
      function drawMap(ctx) {
        var g = ctx.createRadialGradient(W * 0.5, H * 0.4, 10, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
        g.addColorStop(0, '#2a2152'); g.addColorStop(1, '#0a0716'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1; for (var gx = 0; gx < W; gx += 32) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); } for (var gy = 0; gy < H; gy += 32) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
        var nodes = mapNodes(), s = api.clamp(Math.min(W / 760, H / 420), 0.7, 1.4), i;
        ctx.save(); ctx.strokeStyle = 'rgba(230,184,90,.55)'; ctx.lineWidth = 3 * s; ctx.setLineDash([8 * s, 8 * s]); ctx.lineDashOffset = -t * 20;
        ctx.beginPath(); nodes.forEach(function (n, k) { if (k) { var p = nodes[k - 1]; ctx.quadraticCurveTo((p.x + n.x) / 2, Math.min(p.y, n.y) - 30 * s, n.x, n.y); } else ctx.moveTo(n.x, n.y); }); ctx.stroke(); ctx.restore();
        nodes.forEach(function (n, k) {
          var r = REALMS[k], rec = quest[r.id] || {}, sel = k === (mapHover >= 0 ? mapHover : mapSel), rr = 24 * s * (sel ? 1.15 + Math.sin(t * 4) * 0.04 : 1);
          ctx.save(); ctx.shadowColor = r.color; ctx.shadowBlur = sel ? 30 : 12;
          var ng = ctx.createRadialGradient(n.x - rr * 0.3, n.y - rr * 0.3, 2, n.x, n.y, rr); ng.addColorStop(0, A.shade(r.color, 0.4)); ng.addColorStop(1, A.shade(r.color, -0.45));
          ctx.fillStyle = ng; ellipse(ctx, n.x, n.y, rr, rr); ctx.fill(); ctx.restore();
          ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,.4)'; ctx.lineWidth = sel ? 3 : 1.5; ellipse(ctx, n.x, n.y, rr, rr); ctx.stroke();
          A.text(ctx, r.icon, n.x, n.y + 1, { size: 15 * s, fam: 'display', weight: 900, color: '#10091f', align: 'center', baseline: 'middle' });
          var below = n.y < H * 0.62, ly = below ? n.y + rr + 18 * s : n.y - rr - 26 * s;
          A.text(ctx, r.short, n.x, ly, { size: 13 * s, weight: 800, color: '#fff', align: 'center', stroke: 'rgba(0,0,0,.6)', strokeWidth: 3 });
          A.text(ctx, starText(rec.stars || 0), n.x, ly + 15 * s, { size: 12 * s, weight: 800, color: rec.stars ? '#f6d991' : 'rgba(255,255,255,.4)', align: 'center' });
          if (sel) drawHero(ctx, n.x - rr - 16 * s, n.y + rr * 0.9, 0.42 * s, t, {});
        });
      }

      // ---- update ----
      function update(dt) {
        t += dt; hero.flash = Math.max(0, hero.flash - dt);
        if (mode === 'map') return;
        if (realm) updateMotes(dt);
        if (foe) {
          foe.t += dt; foe.flash = Math.max(0, foe.flash - dt); foe.kb = Math.max(0, foe.kb - dt * 4);
          if (foe.enter < 1) { foe.enter = Math.min(1, foe.enter + dt * 1.3); if (foe.enter >= 1 && mode === 'intro') ask(); }
          if (foe.dead) foe.dead += dt * 0.9;
        }
        if (mode === 'ask' && limit && !answered) { timer -= dt; api.choices.timer(timer / limit); if (timer <= 0) timeout(); }
        if (anim) {
          anim.t += dt; var a = anim, s = sc();
          if (a.type === 'attack') {
            // aim, fire (one rocket, or a golden volley of three on a Warrant Strike), reload, then the monster falls
            var tg = foeAim(), pv = pivot(), want = api.clamp(Math.atan2(tg.y - pv.y, tg.x - pv.x), -0.6, 0.35);
            hero.aim = a.t < 0.16 ? A.lerp(REST_AIM, want, A.ease.outCubic(a.t / 0.16)) : want;
            if (!a.fired && a.t >= 0.16) { a.fired = true; var shots = a.strike ? 3 : 1; for (var si = 0; si < shots; si++) launch(a, si * 0.13, si === 0); }
            if (a.fired && !a.reloaded && a.t >= (a.strike ? 1.05 : 0.8)) { a.reloaded = true; hero.loaded = true; api.audio.clank(); }
            if (a.kill && !a.killed && a.t >= a.killAt) {
              a.killed = true; foe.dead = 0.001;
              var kx = foeX(), ky = groundY() - foeR();
              api.particles.emit({ x: kx, y: ky, n: 80, color: [foe.def.color, '#fff', A.shade(foe.def.color, 0.4)], speed: 380, gravity: 120, life: 1.2, size: 8 });
              api.particles.ring(kx, ky, { color: foe.def.color, grow: 420, life: 0.7, width: 6 });
              api.audio.boom(); api.floaters.add(foe.def.boss ? 'BOSS DEFEATED!' : 'DEFEATED!', kx, ky - foeR() * 1.4, { size: 26, color: '#f6d991', life: 1.4 });
              api.score(foe.def.boss ? 500 : 200); feel.buzz(foe.def.boss ? [30, 40, 80] : 20);
              if (foe.def.boss) { api.music.setIntense(false); api.mentor.say('proud', A.mentor.line('boss'), 4); }
              var drop = foe.def.boss ? null : foeIx === 0 ? 'potion' : 'scroll';
              if (drop) { items[drop]++; api.floaters.add(drop === 'potion' ? '+1 🧪 Potion' : '+1 📜 Scroll', kx, ky - foeR() * 0.4, { size: 18, color: '#8be0b9', life: 1.6, vy: -40 }); api.audio.coin(); }
              tools();
            }
            var endAt = a.kill ? a.killAt + 1.25 : (a.hitAt || 0) + 0.5;
            if (a.hit && !rockets.length && a.t >= Math.max(endAt, a.strike ? 1.1 : 0.85)) { anim = null; hero.loaded = true; }
          } else if (a.type === 'hurt') {
            foe.lunge = a.t < 0.3 ? A.ease.inCubic(a.t / 0.3) : a.t < 0.7 ? 1 - A.ease.outCubic((a.t - 0.3) / 0.4) : 0;
            if (!a.hit && a.t >= 0.3) {
              a.hit = true; hero.flash = 0.25; api.audio.hurt(); api.shake(9); api.flash('rgba(255,70,70,.35)'); feel.buzz([30, 40, 30]);
              api.particles.emit({ x: heroX(), y: groundY() - 55 * s, n: 22, color: ['#ff6b6b', '#ffb3b3'], speed: 260, gravity: 300, life: 0.6 });
              api.floaters.add('-1 ♥', heroX(), groundY() - 120 * s, { size: 26, color: '#ff6b6b' });
              var left = api.life(-1); tools();
              if (left === 1) api.mentor.say('worried', A.mentor.line('low'), 3.5);
              if (left > 0 && foe.def.boss && foe.phase2) special();
            }
            if (a.t >= 0.8) { anim = null; foe.lunge = 0; }
          }
          if (!anim && pending) pending();
        }
        updateRockets(dt);
        hero.recoil = Math.max(0, hero.recoil - dt * 5);
        if (!anim || anim.type !== 'attack') hero.aim = hero.aim == null ? REST_AIM : A.lerp(hero.aim, REST_AIM, Math.min(1, dt * 6));
        beam = Math.max(0, beam - dt);
        if (mode === 'clear' && clearT) {
          clearT += dt;
          if (clearT > 2.6) {
            clearT = 0;
            var stars = earned;
            if (bossOnly) { var bn = foes[0].name; api.end({ won: true, title: bn + ' defeated', message: 'Eight health, ' + shown + ' questions, ' + lost + (lost === 1 ? ' heart' : ' hearts') + ' lost.', xpBonus: 90 + stars * 20, campaign: { value: 1, of: 1 }, badge: { icon: '🏆', name: bn, desc: 'Boss down. ' + (lost === 0 ? 'Flawless.' : 'Its tricks are on the study list.'), color: realm.color } }); return; }
            api.end({ won: true, title: realm.name + ' cleared ' + starText(stars), message: 'You beat ' + foes.map(function (f) { return f.name; }).join(', ') + '.', xpBonus: 60 + stars * 30, campaign: { value: 1, of: 1 },
              badge: { icon: stars === 3 ? '🏆' : '⭐', name: starText(stars) + ' ' + realm.name, desc: stars === 3 ? 'Flawless: no hearts lost.' : lost + (lost === 1 ? ' heart' : ' hearts') + ' lost. Clear it without losing one for three stars.', color: realm.color } });
          }
        }
      }

      function draw(ctx) {
        if (mode === 'map') { drawMap(ctx); return; }
        drawScene(ctx);
        var s = sc();
        if (beam > 0) { ctx.save(); ctx.globalAlpha = beam * 2 > 1 ? 1 : beam * 2; var bx = foeX(), bw = foeR() * 1.3, bg = ctx.createLinearGradient(bx - bw, 0, bx + bw, 0); bg.addColorStop(0, 'rgba(246,217,145,0)'); bg.addColorStop(0.5, 'rgba(255,248,220,.95)'); bg.addColorStop(1, 'rgba(246,217,145,0)'); ctx.fillStyle = bg; ctx.fillRect(bx - bw, 0, bw * 2, groundY()); ctx.restore(); }
        drawFoe(ctx);
        drawHero(ctx, heroX(), groundY(), s, t, { flash: hero.flash, aim: hero.aim, recoil: hero.recoil, loaded: hero.loaded, charged: charged });
        rockets.forEach(function (rk) { if (rk.launched && rk.x != null) drawRocket(ctx, rk.x, rk.y, rk.ang, s, rk.big, t); });
        if (foe || mode === 'clear') drawHud(ctx);
      }

      function onPointer(e) {
        if (mode !== 'map') return;
        var nodes = mapNodes(), hit = -1, s = api.clamp(Math.min(W / 760, H / 420), 0.7, 1.4);
        nodes.forEach(function (n, k) { if (api.dist(e.x, e.y, n.x, n.y) < 34 * s) hit = k; });
        if (e.type === 'move') mapHover = hit;
        if (e.type === 'up' && hit >= 0) enter(REALMS[hit]);
      }
      function onKey(k, down) {
        if (!down || mode !== 'map') return;
        if (k === 'ArrowRight' || k === 'ArrowDown') { mapSel = (mapSel + 1) % REALMS.length; mapHover = -1; api.audio.blip(); }
        if (k === 'ArrowLeft' || k === 'ArrowUp') { mapSel = (mapSel + REALMS.length - 1) % REALMS.length; mapHover = -1; api.audio.blip(); }
        if (k === 'Enter' || k === ' ') enter(REALMS[mapSel]);
      }

      var startRealm = null, wantRealm = bossOnly ? { uc: 'gp', bust: 'pre', audit: 'post', protest: 'awd', gate: 'all' }[bossOnly] : opts.realm;
      REALMS.forEach(function (r) { if (wantRealm === r.id) startRealm = r; });
      if (startRealm) enter(startRealm); else showMap();
      return {
        update: update, draw: draw, onPointer: onPointer, onKey: onKey,
        resize: function (w, h) { W = w; H = h; },
        stats: function () { return { mode: mode, realm: realm && realm.id, foe: foe ? { name: foe.def.name, boss: foe.def.boss || '', hp: foe.hp, max: foe.maxHp, phase2: !!foe.phase2 } : null, foeIx: foeIx, focus: focus, charged: charged, held: held, hardNext: hardNext, items: items, lost: lost, streak: streak, anim: anim && anim.type }; }
      };
    }
  });
})();
