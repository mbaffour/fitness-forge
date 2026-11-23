// FITNESS FORGE — Service Worker
// Cache-first strategy for full offline support

const CACHE = 'forge-v66';

const PRECACHE = [
  './',
  './index.html',
  './preview.html',
  './src/components/feature-gallery.js',
  './src/style.css',
  './src/programs-polish.css',
  './src/components/program-art.js',
  './src/components/program-tools.js',
  './src/components/program-visuals.js',
  './src/components/movement-patterns.js',
  './src/data/exercises-coached.js',
  './src/components/program-coach.js',
  './src/data/programs-extra.js',
  './src/vendor/chart.umd.min.js',
  './src/main.js',
  './src/store.js',
  './src/components/onboarding.js',
  './src/components/pages.js',
  './src/components/freestyle.js',
  './src/components/calisthenics.js',
  './src/components/modal.js',
  './src/components/exercise-video.js',
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
  './src/components/overload-mode.js',
  './src/components/body-map.js',
  './src/components/stations.js',
  './src/components/programs.js',
  './src/components/equipment.js',
  './src/components/ui.js',
  './src/components/feedback.js',
  './src/components/library.js',
  './src/components/import-workouts.js',
  './src/engine/generator.js',
  './src/engine/overload.js',
  './src/engine/gamify.js',
  './src/engine/bmr.js',
  './src/data/exercises.js',
  './src/data/exercises-library.js',
  './src/data/exercise-gifs.js',
  './src/data/exercise-anim.js',
  './src/data/exercise-videos.js',
  './src/data/exercises-wg.js',
  './src/data/exercise-meta.js',
  './src/data/exercises-wger.js',
  './src/data/body-model.js',
  './src/data/programs.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE).then(cache => {
      // Attempt to cache each file, ignore failures (e.g. CDN).
      //
      // `cache: 'reload'` is essential. GitHub Pages serves every file with
      // `Cache-Control: max-age=600`, and a plain cache.add() goes through the
      // browser's HTTP cache — so anyone who had opened the app in the ten
      // minutes before a deploy got the OLD files written into the NEW cache.
      // Cache-first then served that stale copy forever: v3.38 shipped, the
      // cache was named forge-v64, and the app still had no Forge Rank.
      return Promise.allSettled(PRECACHE.map(url => cache.add(new Request(url, { cache: 'reload' }))));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  const ready = (async () => {
    const keys = await caches.keys();
    // An older forge-vN cache means this is an UPGRADE, not a first install.
    const upgraded = keys.some(k => k.startsWith('forge-') && k !== CACHE);
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    return upgraded;
  })();
  evt.waitUntil(ready);
  // Any page open right now is running the previous version's code — it was
  // served before this worker existed, and nothing in that old code knows how
  // to pick up an update. Reload it from here, the one place guaranteed to be
  // new. Without this an update was only seen on the SECOND open. An
  // in-progress workout survives: sessions are drafted and resume on load.
  //
  // Deliberately OUTSIDE waitUntil: the reload's own request is answered by
  // this worker, which handles no fetches until activation has finished — so
  // awaiting navigate() inside waitUntil deadlocks and freezes the page.
  ready.then(async (upgraded) => {
    if (!upgraded) return;
    const wins = await self.clients.matchAll({ type: 'window' });
    wins.forEach(w => w.navigate(w.url).catch(() => {}));
  });
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
