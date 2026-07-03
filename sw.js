/* herSAFE service worker — offline shell, network-first navigation. */
const CACHE = 'hersafe-v3';
const SHELL = [
  './', './index.html',
  './styles/tokens.css', './styles/app.css',
  './src/main.js', './src/config.js', './src/store.js', './src/dom.js',
  './src/emitter.js', './src/state.js', './src/theme.js',
  './src/utils/util.js',
  './src/services/siren.js', './src/services/location.js',
  './src/services/sensors.js', './src/services/dispatch.js',
  './src/features/fakeCall.js', './src/features/safetyTimer.js',
  './src/features/recorder.js', './src/features/flashlight.js',
  './src/ui/toast.js', './src/ui/sheets.js', './src/ui/log.js',
  './src/ui/contacts.js', './src/ui/settings.js', './src/ui/home.js',
  './src/ui/emergency.js', './src/ui/tools.js', './src/ui/onboarding.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                    // never cache POSTs (e.g. /api/alert)
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;        // always hit network for API

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit)),
    );
  }
});
