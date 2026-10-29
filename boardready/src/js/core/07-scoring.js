/* CORE-07-SCORING — rubric, readiness math, spaced repetition (SM-2 lite), quiz and board records */
(function () {
  'use strict';
  var CORB = window.CORB;
  var sc = CORB.scoring = {};
  // Local-date ISO string (YYYY-MM-DD). Never use toISOString() for calendar days: it is UTC and is a day off in Korea after 09:00.
  function localISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  sc.localISO = localISO;

  sc.rubric = function () {
    var r = (CORB.DATA.rubric_board && CORB.DATA.rubric_board.rubric) || CORB.DATA.rubric;
    if (r && r.dimensions && r.dimensions.length) return r;
    return { dimensions: [
      { id: 'knowledge', name: 'Regulatory knowledge', description: 'Correct rule, correct cite, correct thresholds.', anchors: { '1': 'Wrong or missing rule.', '3': 'Right rule, shaky cite or detail.', '5': 'Precise rule, cite, and exceptions.' } },
      { id: 'judgment', name: 'Judgment & risk', description: 'Applies the rule to the facts, names risk and approvals.', anchors: { '1': 'Recites without applying.', '3': 'Applies but misses a risk or coordination.', '5': 'Weighs options, names risk, legal and approval path.' } },
      { id: 'communication', name: 'Communication', description: 'Structured, concise, confident answer.', anchors: { '1': 'Rambling or inaudible.', '3': 'Clear but unstructured.', '5': 'Rule → cite → application → risk, in under two minutes.' } },
      { id: 'composure', name: 'Composure', description: 'Handles probes and "I don\'t know" professionally.', anchors: { '1': 'Freezes or bluffs.', '3': 'Recovers with help.', '5': 'Calm, asks clarifying questions, owns gaps.' } }
    ], pass_rule: 'unanimous', numeric_guide: 'Average 3.5 or higher across dimensions with no dimension below 3 is a common informal bar.' };
  };

  // ---- spaced repetition (SM-2 lite). grade: 0-5 ----
  var srs = sc.srs = {};
  srs.get = function (id) { return CORB.get('progress.srs.' + id) || { ef: 2.5, interval: 0, reps: 0, due: '', last: '' }; };
  srs.grade = function (id, grade) {
    var s = srs.get(id); grade = CORB.util.clamp(Math.round(grade), 0, 5);
    if (grade < 3) { s.reps = 0; s.interval = 1; }
    else { if (s.reps === 0) s.interval = 1; else if (s.reps === 1) s.interval = 3; else s.interval = Math.round(s.interval * s.ef); s.reps++; }
    s.ef = Math.max(1.3, s.ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
    var d = new Date(); d.setDate(d.getDate() + s.interval); s.due = localISO(d); s.last = CORB.util.today(); s.lastGrade = grade;
    CORB.set('progress.srs.' + id, s);
    CORB.set('progress.seen.' + id, CORB.util.today(), { silent: true });
    return s;
  };
  srs.due = function (filter) { var today = CORB.util.today(); var all = CORB.get('progress.srs', {}) || {}; var pool = CORB.data.questions(filter || {}); return pool.filter(function (q) { var s = all[q.id]; return s && s.due && s.due <= today; }); };
  srs.newCards = function (filter, n) { var all = CORB.get('progress.srs', {}) || {}; var pool = CORB.data.questions(filter || {}).filter(function (q) { return !all[q.id]; }); return CORB.util.shuffle(pool).slice(0, n || 10); };
  srs.mastery = function (id) { var s = CORB.get('progress.srs.' + id); if (!s) return 0; return CORB.util.clamp(Math.round(((s.ef - 1.3) / 1.4) * 50 + Math.min(50, s.interval * 5)), 0, 100); };

  // ---- records ----
  sc.recordQuiz = function (rec) { rec.ts = new Date().toISOString(); CORB.push('progress.quiz', rec); return rec; };
  sc.recordBoard = function (rec) { rec.ts = rec.ts || new Date().toISOString(); CORB.push('progress.boards', rec); return rec; };
  sc.recordGame = function (game, rec) { var g = CORB.get('progress.games.' + game, { plays: 0, best: 0, history: [] }); g.plays++; g.best = Math.max(g.best || 0, rec.score || 0); g.history = (g.history || []).concat([Object.assign({ ts: new Date().toISOString() }, rec)]).slice(-20); CORB.set('progress.games.' + game, g); return g; };

  // ---- readiness ----
  sc.readiness = function () {
    var seen = CORB.get('progress.seen', {}) || {}; var srsAll = CORB.get('progress.srs', {}) || {};
    var quiz = (CORB.get('progress.quiz', []) || []).filter(function (r) { return r && typeof r === 'object'; });
    var boards = (CORB.get('progress.boards', []) || []).filter(function (r) { return r && typeof r === 'object'; });
    var byDomain = {}, pool = CORB.data.questions({});
    pool.forEach(function (q) { var d = byDomain[q.domain] = byDomain[q.domain] || { total: 0, seen: 0, mastery: 0, mastered: 0, quizC: 0, quizT: 0, boardScores: [] }; d.total++; if (seen[q.id]) d.seen++; var m = srsAll[q.id] ? sc.srs.mastery(q.id) : 0; d.mastery += m; if (m >= 60) d.mastered++; });
    quiz.forEach(function (r) { (r.items || []).forEach(function (it) { var q = CORB.data.byId(it.qid); if (!q || !byDomain[q.domain]) return; byDomain[q.domain].quizT++; if (it.correct) byDomain[q.domain].quizC++; }); });
    boards.forEach(function (b) { (b.questions || []).forEach(function (it) { var q = CORB.data.byId(it.id); if (!q || !byDomain[q.domain]) return; var vals = Object.keys(it.scores || {}).map(function (k) { return it.scores[k]; }).filter(Boolean); if (vals.length) byDomain[q.domain].boardScores.push(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length); }); });
    var overallNum = 0, overallDen = 0;
    Object.keys(byDomain).forEach(function (k) {
      var d = byDomain[k];
      var cov = d.total ? d.seen / d.total : 0; var mas = d.total ? d.mastery / d.total / 100 : 0; var qz = d.quizT ? d.quizC / d.quizT : null; var bd = d.boardScores.length ? d.boardScores.reduce(function (a, b) { return a + b; }, 0) / d.boardScores.length / 5 : null;
      var parts = [[cov, .3], [mas, .3]]; if (qz != null) parts.push([qz, .2]); if (bd != null) parts.push([bd, .2]);
      var w = parts.reduce(function (a, p) { return a + p[1]; }, 0); d.score = Math.round(parts.reduce(function (a, p) { return a + p[0] * p[1]; }, 0) / w * 100);
      d.coverage = Math.round(cov * 100); d.quizAcc = qz == null ? null : Math.round(qz * 100); d.boardAvg = bd == null ? null : Math.round(bd * 50) / 10;
      overallNum += d.score * d.total; overallDen += d.total;
    });
    var overall = overallDen ? Math.round(overallNum / overallDen) : 0;
    var streak = sc.streak();
    return { overall: overall, byDomain: byDomain, seenCount: Object.keys(seen).length, total: pool.length, quizCount: quiz.length, boardCount: boards.length, streak: streak, weakest: Object.keys(byDomain).sort(function (a, b) { return byDomain[a].score - byDomain[b].score; }).slice(0, 3) };
  };
  sc.streak = function () {
    var days = {}; var seen = CORB.get('progress.seen', {}) || {}; Object.keys(seen).forEach(function (k) { if (typeof seen[k] === 'string') days[seen[k]] = 1; });
    (CORB.get('progress.quiz', []) || []).forEach(function (r) { if (r && r.ts) days[String(r.ts).slice(0, 10)] = 1; });
    (CORB.get('progress.boards', []) || []).forEach(function (r) { if (r && r.ts) days[String(r.ts).slice(0, 10)] = 1; });
    var n = 0; var d = new Date();
    for (var i = 0; i < 365; i++) { var key = localISO(d); if (days[key]) n++; else if (i > 0) break; d.setDate(d.getDate() - 1); }
    return n;
  };
})();
