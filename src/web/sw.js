/* B2B Exam Prep service worker (web edition). tools/build.py writes the build id below on every build.
   Pages: the network gets 3 seconds to deliver the whole page, so a good connection always gets the newest guide; on a
   slow or stalled one the saved copy opens instead and the new page is saved when it arrives (it opens next time, and
   the app offers the update). Before 0.35.3 a saved copy was used only when fully offline: on a 1 Mbps connection the
   installed app took 36 s to open, and on a stalled one it never did. A first visit has nothing saved and waits.
   Icons and the manifest: cache first. */
var BUILD = '__BUILD_ID__';
var CACHE = 'b2b-guide-' + BUILD;
var CORE = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('b2b-guide-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  var url = new URL(req.url);
  if (/version\.json$/.test(url.pathname)) return;                       // always from the network
  if (/\.(mp4|webm|vtt)$/.test(url.pathname)) return;                     // the intro video streams in ranges: the browser fetches it itself
  var isPage = req.mode === 'navigate' || /\/$|\.html$/.test(url.pathname);
  if (isPage) {
    var saved = caches.match(req).then(function (m) { return m || caches.match('./'); });
    var fresh = fetch(req).then(function (res) {
      if (!res || !res.ok) return res;
      var copy = res.clone();   // put() settles once the whole page has arrived, so `fresh` means complete, not just begun
      return caches.open(CACHE).then(function (c) { return c.put(req, copy); }).then(function () { return res; }, function () { return res; });
    });
    e.waitUntil(fresh.catch(function () {}));   // a slow page keeps downloading after the saved copy has opened
    e.respondWith(saved.then(function (old) {
      if (!old) return fresh;                   // nothing saved yet (a first visit): wait for the network
      return new Promise(function (resolve) {
        var settled = false;
        function done(r) { if (!settled) { settled = true; resolve(r); } }
        setTimeout(function () { done(old); }, 3000);
        fresh.then(function (res) { done(res && res.ok ? res : old); }, function () { done(old); });
      });
    }));
    return;
  }
  e.respondWith(caches.match(req).then(function (m) {
    return m || fetch(req).then(function (res) { if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); } return res; });
  }));
});
