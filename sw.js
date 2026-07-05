// Service Worker for 「かずであそぼう！」
// Strategy: Cache First — install時に全リソースを事前キャッシュし、オフライン動作を保証

const CACHE_NAME = 'kazuasobi-v4';

// キャッシュ対象ファイル一覧
const PRECACHE_URLS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './assets/icon-192.png',
    './assets/icon-512.png',
    './assets/mascot_rabbit.png',
    './assets/medal.png',
    './assets/bg_pattern.png',
    // External CDN resources
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
    'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;900&display=swap'
];

// Install: 全リソースを事前キャッシュ
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Pre-caching app shell');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting()) // 即座にアクティブ化
    );
});

// Activate: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim()) // 即座に制御を開始
    );
});

// Fetch: Cache First 戦略
// キャッシュにあればキャッシュから返し、なければネットワークから取得してキャッシュに保存
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then((networkResponse) => {
                        // 正常なレスポンスのみキャッシュに保存
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // オフラインでキャッシュにもない場合のフォールバック
                        // ナビゲーションリクエストの場合はindex.htmlを返す
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});
