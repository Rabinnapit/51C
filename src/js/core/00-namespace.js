/* CORE-00-NAMESPACE
   B2B Guide shares its core API with Board Ready (window.CORB, the family's original codename) on purpose:
   views and data modules can move between the two apps when they are fused. Storage keys differ (b2b.*). */
(function () {
  'use strict';
  window.CORB_DATA = window.CORB_DATA || {};
  var CORB = window.CORB = window.CORB || {};
  CORB.VERSION = (window.CORB_DATA.meta && window.CORB_DATA.meta.version) || '0.9.0';
  CORB.DATA = window.CORB_DATA;
  CORB.views = {};
  CORB.viewOrder = [];
  CORB._listeners = {};

  CORB.on = function (evt, fn) { (CORB._listeners[evt] = CORB._listeners[evt] || []).push(fn); return function () { CORB.off(evt, fn); }; };
  CORB.off = function (evt, fn) { var l = CORB._listeners[evt] || []; var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
  CORB.emit = function (evt, payload) { (CORB._listeners[evt] || []).slice().forEach(function (fn) { try { fn(payload); } catch (e) { console.error('[B2B] listener error', evt, e); } }); };

  CORB.registerView = function (def) {
    if (!def || !def.id) throw new Error('registerView needs an id');
    CORB.views[def.id] = def;
    if (CORB.viewOrder.indexOf(def.id) < 0) CORB.viewOrder.push(def.id);
  };

  CORB.meta = function () { return CORB.DATA.meta || {}; };
  CORB.appName = function () { return CORB.meta().app_name || 'B2B Guide'; };
  // Editions (tools/build.py writes meta.edition): 'offline' is the single file people pass around; 'web' is the GitHub Pages
  // site (installable, updates itself); 'preview' runs inside a claude.ai artifact, where downloads and printing are blocked.
  CORB.edition = function () { var e = CORB.meta().edition; return e === 'web' || e === 'preview' ? e : 'offline'; };
  CORB.can = function (what) {
    var ed = CORB.edition();
    if (what === 'download' || what === 'print') return ed !== 'preview';
    if (what === 'saveFile') return ed === 'offline';
    if (what === 'install') return ed === 'web';
    return true;
  };

  // ---- small helpers. Calendar dates are local YYYY-MM-DD strings: never toISOString(), which is UTC and a day off in Korea ----
  function pad(n) { return String(n).padStart(2, '0'); }
  var util = CORB.util = {
    uid: function () { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); },
    iso: function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    today: function () { return util.iso(new Date()); },
    parse: function (s) { if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); if (!m) return null; return new Date(+m[1], +m[2] - 1, +m[3]); },
    addDays: function (s, n) { var d = util.parse(s) || new Date(); d.setDate(d.getDate() + Math.round(n)); return util.iso(d); },
    addMonths: function (s, n) {
      var d = util.parse(s) || new Date(); var day = d.getDate();
      d.setDate(1); d.setMonth(d.getMonth() + n);
      var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last)); return util.iso(d);
    },
    daysBetween: function (a, b) { var x = util.parse(a), y = util.parse(b); if (!x || !y) return 0; return Math.round((y - x) / 86400000); },
    daysUntil: function (s) { return util.daysBetween(util.today(), s); },
    fmtDate: function (s, opts) {
      var d = util.parse(s); if (!d) return s || '';
      return d.toLocaleDateString(undefined, opts || { day: 'numeric', month: 'short', year: 'numeric' });
    },
    fmtShort: function (s) { return util.fmtDate(s, { day: 'numeric', month: 'short' }); },
    fmtDateTime: function (iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return iso; return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); },
    stamp: function () { var d = new Date(); return util.iso(d) + '_' + pad(d.getHours()) + pad(d.getMinutes()); },
    shuffle: function (arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
    clamp: function (n, lo, hi) { return Math.max(lo, Math.min(hi, n)); },
    pct: function (n, d) { return d ? Math.round((n / d) * 100) : 0; },
    plural: function (n, s, p) { return n + ' ' + (n === 1 ? s : (p || s + 's')); },
    debounce: function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; },
    deepClone: function (o) { return JSON.parse(JSON.stringify(o)); },
    sum: function (arr) { return arr.reduce(function (a, b) { return a + (+b || 0); }, 0); },
    money: function (n) { if (n == null || isNaN(n)) return ''; return '$' + Number(n).toLocaleString('en-US'); }
  };
})();
