const CACHE_NAME = 'web-clipper-v2';

// 仅作为离线兜底的静态资源；这些前缀的开发服务器资源一律不缓存，避免与 Vite 模块图/HMR 冲突
const NETWORK_ONLY_PREFIXES = [
  '/api/',
  '/rss/',
  '/uploads/',
  '/@vite/',
  '/@fs/',
  '/@id/',
  '/node_modules/',
  '/src/'
];

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NETWORK_ONLY_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  // 网络优先：确保始终拿到最新资源，缓存只在断网时兜底，避免旧缓存造成模块失配
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('/');
          return undefined;
        })
      )
  );
});
