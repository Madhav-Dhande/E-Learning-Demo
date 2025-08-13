const CACHE_NAME = 'pwa-video-cache-v2';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/soorajDobaHai.mp4',
  '/manifest.json'
];

// Install and cache assets
self.addEventListener('install', (event) => {
  console.log('📦 Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📥 Caching Files');
        return cache.addAll(FILES_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// Fetch strategy - Cache First for offline support
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Serve from cache if available
        if (response) {
          return response;
        }
        // Else fetch from network and cache
        return fetch(event.request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
      .catch(() => {
        // Offline fallback for video
        if (event.request.destination === 'video') {
          return caches.match('/soorajDobaHai.mp4');
        }
      })
  );
});
