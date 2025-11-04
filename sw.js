self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('fetch', event => {
  // Basic network-first (no heavy caching for now)
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});