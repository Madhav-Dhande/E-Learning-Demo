const CACHE_NAME = 'pwa-video-cache-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
  })());
  self.clients.claim();
});

// Handle video caching & resume support
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Serve cached video with Range requests
  if (url.pathname.endsWith('.mp4') && request.headers.has('range')) {
    event.respondWith(serveRangeFromCache(request));
    return;
  }

  // Default cache-first for other requests
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const network = await fetch(request);
      if (network.status === 200 && request.method === 'GET') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, network.clone());
      }
      return network;
    } catch {
      return caches.match('./index.html');
    }
  })());
});

async function serveRangeFromCache(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match('./video.mp4');
  if (!cached) return fetch(request);

  const rangeHeader = request.headers.get('range');
  const size = (await cached.clone().blob()).size;
  const m = /bytes=(\d+)-(\d+)?/.exec(rangeHeader);
  if (!m) return cached;

  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : size - 1;
  const chunkSize = (end - start) + 1;

  const ab = await cached.clone().arrayBuffer();
  const sliced = ab.slice(start, end + 1);

  return new Response(sliced, {
    status: 206,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(chunkSize),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes'
    }
  });
}

// Listen for background caching trigger
self.addEventListener('message', async (event) => {
  if (event.data === 'cacheVideo') {
    const cache = await caches.open(CACHE_NAME);
    await cache.add('./video.mp4');
    // Notify page video is ready
    self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage('videoReady'));
    });
  }
});
