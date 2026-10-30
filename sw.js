/* 公网页加速：静态资源缓存优先，页面/数据后台更新 */
const CACHE = 'yxg-v20261061';
const CORE = [
  './',
  'assets/css/app.css?v=20261050',
  'assets/js/security.js',
  'assets/js/link-safety.js',
  'assets/js/qrcode.min.js',
  'assets/js/app.js?v=20261061',
  'assets/js/watermark.js?v=20261055'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(
      CORE.map((url) => cache.add(url).catch(() => null))
    ))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallbackKey) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(fallbackKey || request, fresh.clone());
    return fresh;
  } catch (e) {
    const hit = await cache.match(fallbackKey || request);
    if (hit) return hit;
    throw e;
  }
}

async function staleWhileRevalidate(request, cacheKey) {
  const cache = await caches.open(CACHE);
  const key = cacheKey || request;
  const hit = await cache.match(key);
  const network = fetch(request).then((res) => {
    if (res && res.ok) cache.put(key, res.clone());
    return res;
  }).catch(() => null);
  if (hit) return hit;
  const fresh = await network;
  if (fresh) return fresh;
  throw new Error('offline');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf('/yingxiangtu/admin') === 0) return;

  if (req.mode === 'navigate') {
    const navKey = new Request(url.origin + url.pathname);
    event.respondWith(staleWhileRevalidate(req, navKey).catch(() => caches.match('./')));
    return;
  }
  if (url.pathname.endsWith('/data/library.json')) {
    const dataKey = new Request(url.origin + url.pathname);
    event.respondWith(staleWhileRevalidate(req, dataKey).catch(() => caches.match(dataKey)));
    return;
  }
  if (url.pathname.indexOf('/yingxiangtu/assets/') === 0) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }))
    );
  }
});
