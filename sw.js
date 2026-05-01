// FITNESS FORGE — Service Worker
// Cache-first strategy for full offline support

const CACHE = 'forge-v9';

const PRECACHE = [
  './',
  './index.html',
  './src/style.css',
  './src/main.js',
  './src/store.js',
  './src/components/onboarding.js',
  './src/components/pages.js',
  './src/components/freestyle.js',
  './src/components/calisthenics.js',
  './src/components/modal.js',
  './src/components/active-workout.js',
  './src/components/charts.js',
  './src/components/nutrition.js',
  './src/components/body-stats.js',
  './src/components/achievements.js',
  './src/components/cardio-log.js',
  './src/components/fasting.js',
  './src/components/sleep.js',
  './src/components/activity.js',
  './src/components/analytics.js',
  './src/components/hiit.js',
  './src/engine/generator.js',
  './src/engine/overload.js',
  './src/engine/bmr.js',
  './src/data/exercises.js',
  './manifest.json',
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE).then(cache => {
      // Attempt to cache each file, ignore failures (e.g. CDN)
      return Promise.allSettled(PRECACHE.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evt => {
  // Only handle GET requests
  if (evt.request.method !== 'GET') return;

  evt.respondWith(
    caches.match(evt.request).then(cached => {
      if (cached) return cached;
      return fetch(evt.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(evt.request, clone));
        return response;
      }).catch(() => {
        // Return offline fallback for navigation requests
        if (evt.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
