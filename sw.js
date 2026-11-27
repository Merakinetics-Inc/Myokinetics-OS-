/* ═══ MYO — SERVICE WORKER: installable, opens offline, never caches health data ═══
   App files (pages, scripts, manifest, icons): network first, so a deploy shows up on the next load,
   with the cached copy when offline. Large models (anatomy meshes, MoveNet): cache first, they rarely change.
   Pinned libraries and fonts from CDNs: cache first (their URLs carry versions).
   Supabase, wearables, the Ingest API, Myo AI and anything else: straight to the network, never stored. */
const VERSION = 'myo-1.3.0-33-202611262342';            // tools/build-site.ps1 appends the build time
const APP = `${VERSION}-app`, MODELS = 'myo-models-v1', LIBS = 'myo-libs-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'privacy.html', 'terms.html', 'oauth-done.html', 'share.html', 'js/share-view.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png', 'icons/apple-touch-icon.png',
  'js/core.js', 'js/anatomy.js', 'js/health.js', 'js/train.js', 'js/videos.js', 'js/ar.js', 'js/scan.js', 'js/athlete.js',
  'js/enhance.js', 'js/longevity.js', 'js/wearables.js', 'js/imaging.js', 'js/function.js', 'js/augment.js',
  'js/anatomy3d.js', 'js/welcome.js', 'js/recovery.js', 'js/pt.js', 'js/sleep.js', 'js/looks.js', 'js/connect.js', 'js/avatar.js',
  'js/gym.js', 'js/coach.js', 'js/system.js', 'js/hub.js', 'js/report.js', 'js/rights.js', 'js/palette.js', 'js/myoai.js', 'js/kitchen.js', 'js/motion.js', 'js/biochem.js', 'js/research.js', 'js/score.js', 'js/mode.js', 'js/mind.js', 'js/lifespan.js', 'js/heart.js', 'js/stream.js', 'js/logbook.js',
  'js/config.js', 'js/auth.js', 'js/look.js', 'js/boot.js'
];
const LIB_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'storage.googleapis.com'];

self.addEventListener('install', (e) => {
  // each file on its own, so one missing file (the X-ray Mirror is left out of public builds) can't fail the install
  e.waitUntil(caches.open(APP).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('myo-') && k.endsWith('-app') && k !== APP).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const c = await caches.open(APP);
  try {
    // revalidate with the server every time (a cheap 304 when nothing changed), so a deploy shows on the next load
    const res = req.mode === 'navigate'
      ? await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      : await fetch(new Request(req, { cache: 'no-cache' }));
    if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') { const shell = await c.match('index.html'); if (shell) return shell; }
    throw err;
  }
}
async function cacheFirst(name, req) {
  const c = await caches.open(name), hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return;
    if (url.pathname.includes('/models/')) return e.respondWith(cacheFirst(MODELS, req));
    return e.respondWith(networkFirst(req));
  }
  if (LIB_HOSTS.includes(url.hostname)) return e.respondWith(cacheFirst(LIBS, req));
  // everything else (Supabase, partner APIs, video CDNs) goes to the network untouched
});
