// Use relative paths for GitHub Pages
const CACHE_NAME = 'pwa-video-cache-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './video.mp4', // precache full video for offline
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

// Helper: serve partial content (Range) from a fully cached video
async function serveRangeFromCache(request) {
  const url = new URL(request.url);
  // Only handle same-origin MP4 range requests we’ve cached fully
  if (!url.pathname.endsWith('.mp4')) return null;

  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match('./video.mp4'); // our demo has a single video
  if (!cached) return null;

  const rangeHeader = request.headers.get('range');
  if (!rangeHeader) return cached;

  // Example: "bytes=12345-"
  const size = (await cached.clone().blob()).size;
  const m = /bytes=(\d+)-(\d+)?/.exec(rangeHeader);
  if (!m) {
    // Bad range header; return entire file
    return new Response(await cached.clone().arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes'
      }
    });
  }

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

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  // Try to satisfy Range requests from cache (for the video)
  if (request.headers.has('range')) {
    event.respondWith((async () => {
      const ranged = await serveRangeFromCache(request);
      if (ranged) return ranged;

      // If not cached yet, fall back to network (browser will stream)
      // Optionally, kick off a background fetch of the full file for future offline use
      try {
        const net = await fetch(request);
        return net;
      } catch (e) {
        // As last resort, attempt to serve the full cached video
        const cachedFull = await caches.match('./video.mp4');
        if (cachedFull) return cachedFull;
        throw e;
      }
    })());
    return;
  }

  // For everything else: cache-first, then network
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const net = await fetch(request);
      const cache = await caches.open(CACHE_NAME);
      // Avoid caching opaque responses from cross-origin if not desired
      if (net && net.status === 200 && net.type === 'basic') {
        cache.put(request, net.clone());
      }
      return net;
    } catch (e) {
      // Offline fallbacks
      const url = new URL(request.url);
      if (request.destination === 'document') {
        return caches.match('./index.html');
      }
      if (request.destination === 'video') {
        return caches.match('./video.mp4');
      }
      // Nothing better
      return new Response('Offline', { status: 503 });
    }
  })());
});
