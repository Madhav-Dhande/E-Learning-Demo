// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').then(reg => {
    console.log('Service Worker Registered', reg);
    // Start background caching
    if (navigator.onLine) {
      reg.active?.postMessage('cacheVideo');
    }
  });
}

// Network status indicator
const statusEl = document.getElementById('status');
function updateStatus() {
  statusEl.textContent = navigator.onLine ? 'Online' : 'Offline - Playing from cache if available';
}
window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);
updateStatus();

// Resume video playback position
const video = document.getElementById('player');
const KEY = 'video-last-time';
video.addEventListener('loadedmetadata', () => {
  const last = localStorage.getItem(KEY);
  if (last) {
    video.currentTime = parseFloat(last);
  }
});
video.addEventListener('timeupdate', () => {
  localStorage.setItem(KEY, video.currentTime);
});

// Listen for "video ready" from SW
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data === 'videoReady') {
    console.log('Video cached fully for offline use');
    statusEl.textContent = 'Video Ready Offline ✅';
  }
});
