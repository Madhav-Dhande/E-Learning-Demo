if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('Service Worker Registered', reg))
    .catch(err => console.log('SW Registration Failed', err));
}
