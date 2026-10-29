/* CORE-00-NAMESPACE */
(function () {
  'use strict';
  window.CORB_DATA = window.CORB_DATA || {};
  var CORB = window.CORB = window.CORB || {};
  CORB.VERSION = '1.2.0';
  CORB.DATA = window.CORB_DATA;
  CORB.views = {};
  CORB.viewOrder = [];
  CORB._listeners = {};

  CORB.on = function (evt, fn) { (CORB._listeners[evt] = CORB._listeners[evt] || []).push(fn); return function () { CORB.off(evt, fn); }; };
  CORB.off = function (evt, fn) { var l = CORB._listeners[evt] || []; var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
  CORB.emit = function (evt, payload) { (CORB._listeners[evt] || []).slice().forEach(function (fn) { try { fn(payload); } catch (e) { console.error('[CORB] listener error', evt, e); } }); };

  CORB.registerView = function (def) {
    if (!def || !def.id) throw new Error('registerView needs an id');
    CORB.views[def.id] = def;
    if (CORB.viewOrder.indexOf(def.id) < 0) CORB.viewOrder.push(def.id);
  };

  CORB.appName = function () { return (CORB.DATA.meta && CORB.DATA.meta.app_name) || 'Board Ready'; };
  CORB.monogram = function () { var w = CORB.appName().split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 1)).toUpperCase(); };
  // Editions (tools/build.py writes meta.edition): 'full' serves candidates, board members and facilitators;
  // 'candidate' is study only, with no board room, projector, content editor or role switching.
  CORB.edition = function () { return (CORB.DATA.meta && CORB.DATA.meta.edition) === 'candidate' ? 'candidate' : 'full'; };
  CORB.isCandidateEdition = function () { return CORB.edition() === 'candidate'; };
  // The offline candidate edition is built without the AI endpoint code (core/06b-connector-network.js), so the mentor only
  // retrieves and the app makes no network requests. Views hide every connector setting and mention when this is false.
  CORB.hasConnector = function () { return !!(CORB.connector && CORB.connector.online); };
  // The web edition (tools/build.py marks meta.web) is served from GitHub Pages, installs as an app and updates itself.
  CORB.isWeb = function () { return !!(CORB.DATA.meta && CORB.DATA.meta.web); };
  CORB.util = {
    uid: function () { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); },
    today: function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    stamp: function () { var d = new Date(); return CORB.util.today() + '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); },
    shuffle: function (arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
    clamp: function (n, lo, hi) { return Math.max(lo, Math.min(hi, n)); },
    pct: function (n, d) { return d ? Math.round((n / d) * 100) : 0; },
    plural: function (n, s, p) { return n + ' ' + (n === 1 ? s : (p || s + 's')); },
    debounce: function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; },
    deepClone: function (o) { return JSON.parse(JSON.stringify(o)); },
    fmtDate: function (iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return iso; return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); },
    fmtDateTime: function (iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return iso; return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); },
    daysUntil: function (iso) { var d = new Date(iso + 'T00:00:00'); var now = new Date(); now.setHours(0, 0, 0, 0); return Math.round((d - now) / 86400000); },
    // The next board date. meta.next_board is used while it is today or later; after that the date is computed from
    // meta.board_rule ({week: 2, weekday: 3} is the second Wednesday of the month, the 411th cadence) so it never goes stale.
    nextBoard: function (meta) {
      meta = meta || {}; var today = CORB.util.today();
      if (meta.next_board && /^\d{4}-\d{2}-\d{2}$/.test(meta.next_board) && meta.next_board >= today) return meta.next_board;
      var rule = meta.board_rule || { week: 2, weekday: 3 }, now = new Date();
      for (var k = 0; k < 14; k++) {
        var first = new Date(now.getFullYear(), now.getMonth() + k, 1);
        var day = 1 + ((rule.weekday - first.getDay() + 7) % 7) + 7 * (rule.week - 1);
        var d = new Date(first.getFullYear(), first.getMonth(), day);
        var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        if (iso >= today) return iso;
      }
      return meta.next_board || '';
    },
    money: function (n) { if (n == null || isNaN(n)) return ''; if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(n % 1e9 ? 1 : 0) + 'B'; if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M'; if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(n % 1e3 ? 1 : 0) + 'K'; return '$' + n; }
  };
})();
