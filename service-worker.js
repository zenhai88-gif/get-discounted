/* Get Discounted — service worker
   Handles: offline caching of the app shell, live promo data pass-through,
   and web push notifications for nearby / new promotions. */

const CACHE = 'getdiscounted-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//  - promos.json  -> network-first (always try fresh, fall back to cache offline)
//  - app shell    -> cache-first (fast, installable, works offline)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  if (url.pathname.endsWith('promos.json')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./promos.json', copy));
          return res;
        })
        .catch(() => caches.match('./promos.json'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});

// Web Push: the backend sends a payload; render a notification even if the app is closed.
// Payload shape: { title, body, url, tag }
self.addEventListener('push', (event) => {
  let data = { title: 'Get Discounted', body: 'A new promotion is available near you.' };
  try { if (event.data) data = event.data.json(); } catch (e) { /* keep default */ }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Get Discounted', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: data.tag || 'promo',
      data: { url: data.url || './index.html' }
    })
  );
});

// Tapping a notification opens (or focuses) the app at the relevant promo.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) { w.navigate(target); return w.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
