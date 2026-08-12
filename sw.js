const CACHE = 'refy-v19';
const ASSETS = ['./', './index.html', './app.css', './app.js', './manifest.json', './icon-180.png', './icon-512.png'];
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // pdf.js (CDN) : cache d'abord — immuable et nécessaire hors-ligne après le premier usage
  if (e.request.url.startsWith(PDFJS)) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        if (r.ok || r.type === 'opaque') {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return r;
      }))
    );
    return;
  }

  if (!e.request.url.startsWith(self.location.origin)) return;

  // Réseau d'abord (pour récupérer les mises à jour), cache en secours (hors-ligne).
  e.respondWith(
    fetch(e.request)
      .then(r => {
        // ne met en cache que les vraies réponses (pas les pages d'erreur ni les portails captifs)
        if (r.ok && r.type === 'basic') {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
