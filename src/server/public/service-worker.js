/**
 * Service Worker para Whinsap React PWA
 * Maneja cache, sincronización en background y notificaciones push
 */

const CACHE_NAME = 'whinsap-v1.0.6';
const API_URL = self.location.origin;

// Archivos estáticos a cachear
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/static/css/main.css',
    '/static/js/main.js',
    '/manifest.json',
    '/logo192.png',
    '/logo512.png'
];

// Instalación
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Cacheando archivos estáticos');
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.log('[SW] Error cacheando algunos archivos:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activación
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Eliminando cache antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch - Network First para API, Cache First para assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // API requests - Network First
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    return response;
                })
                .catch(error => {
                    console.log('[SW] API request failed, no cache available');
                    return new Response(
                        JSON.stringify({ error: 'Sin conexión' }),
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                })
        );
        return;
    }

    // Static assets - Cache First
    // 🚫 FILTER: Ignorar requests que no sean GET o que sean de esquemas no soportados (chrome-extension)
    if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(request).then(response => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // Clone the response
                const responseToCache = response.clone();

                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(request, responseToCache);
                    });

                return response;
            });
        })
    );
});

// Background Sync - Sincronizar estados pendientes
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync event:', event.tag);

    if (event.tag === 'sync-statuses') {
        event.waitUntil(syncPendingStatuses());
    }
});

async function syncPendingStatuses() {
    try {
        console.log('[SW] Sincronizando estados pendientes...');

        // Obtener token del dispositivo desde IndexedDB
        const db = await openDB();
        const deviceToken = await getFromDB(db, 'config', 'deviceToken');

        if (!deviceToken) {
            console.log('[SW] No hay token de dispositivo');
            return;
        }

        // Obtener estados pendientes del servidor
        const response = await fetch(`${API_URL}/api/pwa/statuses/pending`, {
            headers: {
                'Authorization': `Bearer ${deviceToken}`
            }
        });

        const data = await response.json();

        if (data.success && data.statuses.length > 0) {
            console.log(`[SW] ${data.statuses.length} estados pendientes`);

            // Guardar en IndexedDB
            await saveToDB(db, 'statuses', data.statuses);

            // Notificar a la app
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'STATUSES_SYNCED',
                    count: data.statuses.length
                });
            });
        }
    } catch (error) {
        console.error('[SW] Error en sincronización:', error);
    }
}

// Push Notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification recibida');

    const data = event.data ? event.data.json() : {};

    const options = {
        body: data.body || 'Tienes un nuevo estado para publicar',
        icon: '/logo192.png',
        badge: '/whatsapp-icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            statusId: data.statusId,
            url: data.url || '/dashboard/whatsapp-status'
        },
        actions: [
            {
                action: 'open',
                title: 'Ver Estado'
            },
            {
                action: 'dismiss',
                title: 'Cerrar'
            }
        ],
        requireInteraction: true,
        tag: 'whatsapp-status'
    };

    event.waitUntil(
        self.registration.showNotification(
            data.title || '📱 Nuevo Estado WhatsApp',
            options
        )
    );
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notificación clickeada:', event.action);

    event.notification.close();

    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url || '/dashboard/whatsapp-status')
        );
    }
});

// IndexedDB Helpers
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('WhinsapPWA', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains('config')) {
                db.createObjectStore('config', { keyPath: 'key' });
            }

            if (!db.objectStoreNames.contains('statuses')) {
                db.createObjectStore('statuses', { keyPath: 'id' });
            }
        };
    });
}

function getFromDB(db, storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result ? request.result.value : null);
        };
        request.onerror = () => reject(request.error);
    });
}

function saveToDB(db, storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        if (Array.isArray(data)) {
            data.forEach(item => store.put(item));
        } else {
            store.put(data);
        }

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
