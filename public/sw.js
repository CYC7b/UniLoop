// green2H Marketplace — Service Worker
// 缓存策略：Network First + Cache Fallback

const CACHE_NAME = 'green2h-v1'
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json'
]

// Install: 预缓存静态资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching static assets')
            return cache.addAll(STATIC_ASSETS)
        })
    )
    self.skipWaiting()
})

// Activate: 清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        )
    )
    self.clients.claim()
})

// Fetch: Network First 策略
self.addEventListener('fetch', (event) => {
    // 跳过非 GET 请求和 API 请求
    if (event.request.method !== 'GET') return
    const url = new URL(event.request.url)
    if (url.hostname.includes('supabase')) return

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // 缓存成功的响应
                if (response.ok) {
                    const clone = response.clone()
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
                }
                return response
            })
            .catch(() => {
                // 网络失败时使用缓存
                return caches.match(event.request)
            })
    )
})
