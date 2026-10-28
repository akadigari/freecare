// Keeps a copy of the page on the phone so it opens with no signal, which is what a hospital
// basement has. Everything comes from this site; the worker never asks any other.
// Each visit serves the saved copy at once and quietly refreshes it for next time.

const CACHE = 'freecare-1';

// Saved on install. The 13 MB bill reader is not here; it is saved the first time it is used.
const PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'src/styles.css',
  'src/app.js',
  'src/apply.js',
  'src/bill.js',
  'src/calendar.js',
  'src/check.js',
  'src/dates.js',
  'src/form.js',
  'src/hospitals.js',
  'src/i18n.js',
  'src/income.js',
  'src/ocr.js',
  'src/policies.js',
  'src/poverty.js',
  'src/present.js',
  'src/rights.js',
  'src/rules.js',
  'src/strings.js',
  'forms/md-uniform-financial-assistance-2026-03-06.pdf',
  'vendor/pdf-lib/pdf-lib.esm.min.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

async function refresh(cache, request) {
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(request, { ignoreSearch: true });
    const fresh = refresh(cache, request).catch(() => null);
    if (saved) {
      fresh.catch(() => {});
      return saved;
    }
    const response = await fresh;
    if (response) return response;
    if (request.mode === 'navigate') return cache.match('index.html');
    return Response.error();
  })());
});
