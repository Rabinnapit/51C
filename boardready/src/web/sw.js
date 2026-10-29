/* Board Ready service worker (web edition). tools/build.py writes the build id below on every build.
   The page: network first, so an online reader always gets the newest build; the saved copy is the offline fallback.
   Icons and the manifest: cache first. Downloads (the single-file editions and Word packages) are never cached. */
var BUILD = '__BUILD_ID__';
var CACHE = 'board-ready-' + BUILD;
var CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('board-ready-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  var url = new URL(req.url);
  if (/version\.json$/.test(url.pathname) || /\/downloads\//.test(url.pathname)) return;   // always from the network
  var isPage = req.mode === 'navigate' || /\/$|\.html$/.test(url.pathname);
  if (isPage) {
    e.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match('index.html'); }); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (m) {
    return m || fetch(req).then(function (res) { if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); } return res; });
  }));
});
