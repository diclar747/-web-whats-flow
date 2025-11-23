/**
 * Service Worker para WhatsFlow PWA
 * Maneja cache, sincronización en background y notificaciones push
 */

const CACHE_NAME = 'whatsflow-pwa-v1.0.0';
const API_URL = 'https://web.whats-flow.com';

// Archivos a cachear
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/styles.css',
    '/modules/sync.js',
    '/modules/storage.js',
    '/modules/automation.js',
    '/modules/notifications.js',
    '/manifest.json'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Cacheando archivos estáticos');
            return cache.addAll(STATIC_ASSETS);
        })
    );

    self.skipWaiting();
});

// Activación del Service Worker
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

// Fetch - Estrategia Network First, fallback a Cache
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cachear respuestas exitosas
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si falla la red, intentar desde cache
                return caches.match(event.request);
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
        const deviceToken = await getDeviceToken(db);

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
            console.log(`[SW] ${data.statuses.length} estados pendientes para publicar`);

            // Guardar en IndexedDB para procesamiento
            await saveStatusesToDB(db, data.statuses);

            // Notificar a la app principal
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

// Push Notifications - Recibir notificaciones del servidor
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification recibida');

    const data = event.data ? event.data.json() : {};

    const options = {
        body: data.body || 'Tienes un nuevo estado para publicar',
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/badge-72.png',
        vibrate: [200, 100, 200],
        data: {
            statusId: data.statusId,
            url: '/'
        },
        actions: [
            {
                action: 'publish',
                title: 'Publicar Ahora'
            },
            {
                action: 'dismiss',
                title: 'Más Tarde'
            }
        ],
        requireInteraction: true
    };

    event.waitUntil(
        self.registration.showNotification(
            data.title || '📱 Nuevo Estado WhatsApp',
            options
        )
    );
});

// Notification Click - Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notificación clickeada:', event.action);

    event.notification.close();

    if (event.action === 'publish') {
        // Abrir la app y publicar
        event.waitUntil(
            clients.openWindow('/').then(client => {
                if (client) {
                    client.postMessage({
                        type: 'PUBLISH_STATUS',
                        statusId: event.notification.data.statusId
                    });
                }
            })
        );
    } else if (event.action === 'dismiss') {
        // Solo cerrar la notificación
        console.log('[SW] Notificación descartada');
    } else {
        // Clic en el cuerpo de la notificación - abrir app
        event.waitUntil(
            clients.openWindow(event.notification.data.url || '/')
        );
    }
});

// Helpers para IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('WhatsFlowPWA', 1);

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

function getDeviceToken(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['config'], 'readonly');
        const store = transaction.objectStore('config');
        const request = store.get('deviceToken');

        request.onsuccess = () => {
            resolve(request.result ? request.result.value : null);
        };
        request.onerror = () => reject(request.error);
    });
}

function saveStatusesToDB(db, statuses) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['statuses'], 'readwrite');
        const store = transaction.objectStore('statuses');

        statuses.forEach(status => {
            store.put(status);
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
