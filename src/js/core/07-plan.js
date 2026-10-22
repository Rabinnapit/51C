/* CORE-07-PLAN — the reader's dated certification plan: goal (default 6 months), 12 months of experience, 36-month deadline */
(function () {
  'use strict';
  var CORB = window.CORB, U = CORB.util;
  var plan = CORB.plan = {};
  function P() { return CORB.DATA.plan || { steps: [], baseline_days: 182 }; }

  plan.track = function () { return CORB.get('profile.track') || ''; };
  plan.hasSetup = function () { return !!(CORB.get('profile.track') && CORB.get('profile.start')); };
  plan.start = function () { return CORB.get('profile.start') || U.today(); };
  plan.goal = function () {
    var g = CORB.get('profile.goalDate'); if (g) return g;
    return U.addMonths(plan.start(), +CORB.get('profile.goalMonths', 6) || 6);
  };
  plan.experienceDate = function () { return U.addMonths(plan.start(), (CORB.meta().experience_months || 12)); };
  plan.deadline = function () { return U.addMonths(plan.start(), (CORB.meta().deadline_months || 36)); };
  plan.dayNumber = function () { return Math.max(1, U.daysBetween(plan.start(), U.today()) + 1); };
  plan.monthsIn = function () { var d = U.daysBetween(plan.start(), U.today()); return Math.max(0, d / 30.44); };

  plan.examPassed = function () { return (CORB.get('progress.exam.attempts', []) || []).some(function (a) { return a && a.passed; }); };
  plan.coursesDone = function () { var req = CORB.data.requiredCourses(); return { done: req.filter(function (c) { return CORB.data.courseDone(c.id); }).length, total: req.length }; };

  // A step counts as done when the reader ticks it, or when its course, the exam, or a date says so.
  plan.stepDone = function (s) {
    if (CORB.get('progress.steps.' + s.id)) return true;
    if (s.course) return CORB.data.courseDone(s.course);
    if (s.auto === 'exam') return plan.examPassed();
    if (s.auto === 'experience') return U.today() >= plan.experienceDate();
    if (s.auto === 'goal') { var cd = plan.coursesDone(); return cd.total > 0 && cd.done === cd.total && plan.examPassed(); }
    return false;
  };
  plan.steps = function () {
    var start = plan.start(), goalDays = Math.max(30, U.daysBetween(start, plan.goal())), base = P().baseline_days || 182;
    var track = plan.track(), today = U.today();
    return (P().steps || []).filter(function (s) { return !s.tracks || !track || s.tracks.indexOf(track) >= 0; }).map(function (s) {
      var target = s.months != null ? U.addMonths(start, s.months) : U.addDays(start, Math.round((s.day || 0) * goalDays / base));
      var done = plan.stepDone(s), days = U.daysBetween(today, target);
      var status = done ? 'done' : days < 0 ? 'late' : days <= 14 ? 'soon' : 'later';
      return Object.assign({}, s, { target: target, done: done, status: status, daysLeft: days });
    }).sort(function (a, b) { return a.target < b.target ? -1 : a.target > b.target ? 1 : 0; });
  };
  plan.nextSteps = function (n) { return plan.steps().filter(function (s) { return !s.done && s.phase !== 'after'; }).slice(0, n || 1); };
  plan.progress = function () { var all = plan.steps().filter(function (s) { return s.phase !== 'after'; }); var d = all.filter(function (s) { return s.done; }).length; return { done: d, total: all.length, pct: U.pct(d, all.length) }; };
  plan.setStep = function (id, done) { CORB.set('progress.steps.' + id, done ? U.today() : undefined); if (done) CORB.touch(id); };

  // ---- calendar file (.ics) so the dates land in Outlook ----
  plan.ics = function () {
    function d(s) { return s.replace(/-/g, ''); }
    function esc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//B2B Guide//Certification plan//EN', 'CALSCALE:GREGORIAN'];
    plan.steps().filter(function (s) { return !s.done; }).forEach(function (s) {
      lines.push('BEGIN:VEVENT', 'UID:' + s.id + '-' + d(s.target) + '@b2b-guide', 'DTSTAMP:' + d(U.today()) + 'T000000Z',
        'DTSTART;VALUE=DATE:' + d(s.target), 'DTEND;VALUE=DATE:' + d(U.addDays(s.target, 1)),
        'SUMMARY:' + esc('B2B: ' + s.title), 'DESCRIPTION:' + esc((s.detail || '').slice(0, 600)), 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  };
})();
