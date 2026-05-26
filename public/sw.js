// Service Worker — 离线缓存所有静态资源
const CACHE_NAME = 'interviewer-v2';
const ASSETS = [
  '/interviewer/',
  '/interviewer/index.html',
  '/interviewer/assets/index.js',
  '/interviewer/assets/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 跳过 API 请求（LLM / 讯飞等）
  if (
    event.request.url.includes('/chat/completions') ||
    event.request.url.includes('xfyun') ||
    event.request.url.includes('iflytek')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
