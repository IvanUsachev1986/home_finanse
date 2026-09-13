const CACHE_NAME = 'finance-app-cache-v3'; // Изменил версию кэша, чтобы он точно обновился

// Точка слэш (./) говорит браузеру: ищи файлы прямо в этой же папке!
const urlsToCache = [
  './', 
  './index.html', 
  './manifest.json',
  './icon.png'
];

// 1. Установка Service Worker и кэширование файлов
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Устанавливается...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Кэширование файлов');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        return self.skipWaiting(); 
      })
  );
});

// 2. Активация и очистка старого кэша
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Активирован');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); 
    })
  );
});

// 3. Перехват сетевых запросов
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('script.google.com')) {
    return; 
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          }).catch(err => console.log('[Service Worker] Ошибка', err));
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          console.log('[Service Worker] Нет сети:', event.request.url);
        });
      })
  );
});