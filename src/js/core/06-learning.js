/* CORE-06-LEARNING — spaced repetition (SM-2 lite, same shape as Board Ready), quiz records, exam-area readiness, streak */
(function () {
  'use strict';
  var CORB = window.CORB, U = CORB.util;
  var sc = CORB.scoring = {};

  // ---- flashcards: grade 0-5 (B2B uses 1 = again, 3 = almost, 5 = got it) ----
  var srs = sc.srs = {};
  srs.get = function (id) { return CORB.get('progress.srs.' + id) || null; };
  srs.grade = function (id, grade) {
    var s = srs.get(id) || { ef: 2.5, interval: 0, reps: 0, due: '', last: '' };
    grade = U.clamp(Math.round(grade), 0, 5);
    if (grade < 3) { s.reps = 0; s.interval = 0; }
    else { if (s.reps === 0) s.interval = 1; else if (s.reps === 1) s.interval = 3; else s.interval = Math.round(s.interval * s.ef); s.reps++; }
    s.ef = Math.max(1.3, s.ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
    s.due = U.addDays(U.today(), s.interval); s.last = U.today(); s.g = grade;
    CORB.set('progress.srs.' + id, s); CORB.touch(id);
    return s;
  };
  srs.isDue = function (id) { var s = srs.get(id); return !!s && s.due <= U.today(); };
  srs.isNew = function (id) { return !srs.get(id); };
  srs.known = function (id) { var s = srs.get(id); return !!s && s.reps >= 2; };

  // ---- quiz records ----
  sc.recordAnswer = function (qid, ok) {
    var m = CORB.get('progress.missed', {}) || {};
    if (ok) { if (m[qid]) CORB.set('progress.missed.' + qid, undefined, { silent: true }); }
    else CORB.set('progress.missed.' + qid, (m[qid] || 0) + 1, { silent: true });
    CORB.touch(qid);
  };
  sc.recordQuiz = function (rec) { rec.ts = new Date().toISOString(); CORB.push('progress.quiz', rec, 40); return rec; };
  sc.missedIds = function () { return Object.keys(CORB.get('progress.missed', {}) || {}).filter(function (id) { return CORB.data.question(id); }); };

  // ---- readiness per exam area: share of recent answers right (last 60 answers per area), checks count too ----
  sc.readiness = function () {
    var out = {}; CORB.data.phases().forEach(function (p) { out[p.id] = { right: 0, total: 0 }; });
    var quiz = (CORB.get('progress.quiz', []) || []).slice().reverse();
    quiz.forEach(function (r) { (r.items || []).forEach(function (it) { var q = CORB.data.question(it.id); if (!q || !out[q.phase] || out[q.phase].total >= 60) return; out[q.phase].total++; if (it.ok) out[q.phase].right++; }); });
    var checks = CORB.get('progress.checks', {}) || {};
    Object.keys(checks).forEach(function (lid) { var l = CORB.data.lesson(lid), c = checks[lid]; if (!l || !out[l.phase] || !c) return; out[l.phase].right += c.right || 0; out[l.phase].total += c.total || 0; });
    var weighted = 0, weights = 0, any = false;
    CORB.data.phases().forEach(function (p) { var o = out[p.id]; o.pct = o.total ? Math.round(o.right / o.total * 100) : null; if (o.pct != null) { any = true; weighted += o.pct * p.qs; weights += p.qs; } });
    return { byPhase: out, overall: any ? Math.round(weighted / weights) : null };
  };

  // ---- streak: consecutive days with any study ----
  sc.streak = function () {
    var days = {}, seen = CORB.get('progress.seen', {}) || {};
    Object.keys(seen).forEach(function (k) { if (typeof seen[k] === 'string') days[seen[k]] = 1; });
    var n = 0, d = new Date();
    for (var i = 0; i < 400; i++) { var key = U.iso(d); if (days[key]) n++; else if (i > 0) break; d.setDate(d.getDate() - 1); }
    return n;
  };
  sc.studyDays = function () { var seen = CORB.get('progress.seen', {}) || {}, days = {}; Object.keys(seen).forEach(function (k) { days[seen[k]] = 1; }); return Object.keys(days).length; };

  // ---- lessons ----
  sc.setLessonDone = function (id, done) { CORB.set('progress.lessons.' + id, done ? U.today() : undefined); if (done) CORB.touch(id); };
  sc.lessonStats = function () { var all = CORB.data.lessons(); var done = all.filter(function (l) { return CORB.data.lessonDone(l.id); }).length; return { done: done, total: all.length }; };
})();
