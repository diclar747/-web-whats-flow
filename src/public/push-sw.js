/* eslint-disable no-restricted-globals */
// =====================================================
// SERVICE WORKER - Push Notifications
// =====================================================
// Created: 2026-01-16
// Description: Service worker for handling push notifications
// =====================================================

// Cache name
const CACHE_NAME = 'whatsflow-push-v1';

// Install event
self.addEventListener('install', (event) => {
    console.log('[SW] Service Worker installing...');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Push event - Receive push notification
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received:', event);

    let data = {
        title: 'Nueva Notificación',
        body: 'Tienes una nueva notificación',
        icon: '/logo192.png',
        badge: '/logo192.png',
        data: {}
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            console.error('[SW] Error parsing push data:', e);
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/logo192.png',
        badge: data.badge || '/logo192.png',
        image: data.image,
        vibrate: [200, 100, 200],
        tag: data.data?.campaignId ? `campaign-${data.data.campaignId}` : 'notification',
        requireInteraction: data.requireInteraction || false,
        data: data.data,
        actions: [
            {
                action: 'open',
                title: 'Ver más'
            },
            {
                action: 'close',
                title: 'Gracias'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options).then(() => {
            // Track delivered event
            if (data.data?.campaignId && data.data?.userId) {
                return trackEvent(data.data.campaignId, data.data.userId, 'delivered');
            }
        })
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);

    event.notification.close();

    const data = event.notification.data || {};
    const action = event.action;
    const url = data.url || '/dashboard';

    if (action === 'close') {
        // Track close event
        if (data.campaignId && data.userId) {
            event.waitUntil(
                trackEvent(data.campaignId, data.userId, 'closed')
            );
        }
        return;
    }

    // Track click event
    if (data.campaignId && data.userId) {
        event.waitUntil(
            trackEvent(data.campaignId, data.userId, 'clicked')
        );
    }

    // Open URL
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there's already a window open with the URL
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

// Notification show event (when notification is displayed)
self.addEventListener('notificationshow', (event) => {
    console.log('[SW] Notification shown:', event);

    const data = event.notification.data || {};

    // Track viewed event
    if (data.campaignId && data.userId) {
        event.waitUntil(
            trackEvent(data.campaignId, data.userId, 'viewed')
        );
    }
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed:', event);

    const data = event.notification.data || {};

    // Track close event (only if not clicked)
    if (data.campaignId && data.userId) {
        event.waitUntil(
            trackEvent(data.campaignId, data.userId, 'closed')
        );
    }
});

// Function to track events
async function trackEvent(campaignId, userId, eventType) {
    try {
        // Get subscriber ID from IndexedDB or localStorage clone
        const subscriberId = await getSubscriberId();

        if (!subscriberId) {
            console.warn('[SW] No subscriber ID found for tracking');
            return;
        }

        const response = await fetch('/api/push/analytics/event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                campaignId,
                subscriberId,
                eventType
            })
        });

        if (!response.ok) {
            console.error('[SW] Error tracking event:', await response.text());
        } else {
            console.log(`[SW] Event tracked: ${eventType} for campaign ${campaignId}`);
        }
    } catch (error) {
        console.error('[SW] Error tracking event:', error);
    }
}

// Function to get subscriber ID
async function getSubscriberId() {
    try {
        // Try to get from IndexedDB
        const db = await openDatabase();
        const subscriberId = await getFromDB(db, 'settings', 'subscriberId');

        if (subscriberId) {
            return subscriberId;
        }

        // Fallback: try to get from server using endpoint
        const registration = await self.registration.pushManager.getSubscription();
        if (registration) {
            const response = await fetch('/api/push/subscriber-id', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endpoint: registration.endpoint
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.subscriberId) {
                    // Save to IndexedDB for future use
                    await saveToDB(db, 'settings', 'subscriberId', data.subscriberId);
                    return data.subscriberId;
                }
            }
        }

        return null;
    } catch (error) {
        console.error('[SW] Error getting subscriber ID:', error);
        return null;
    }
}

// IndexedDB helpers
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('whatsflow-push', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings');
            }
        };
    });
}

function getFromDB(db, storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function saveToDB(db, storeName, key, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// Message event (for communication with main thread)
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        // 🔥 Responder para evitar error en consola
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true, type: 'SKIP_WAITING' });
        }
        return;
    }

    if (event.data && event.data.type === 'SET_SUBSCRIBER_ID') {
        // Save subscriber ID to IndexedDB
        event.waitUntil(
            openDatabase().then((db) => {
                return saveToDB(db, 'settings', 'subscriberId', event.data.subscriberId);
            }).then(() => {
                console.log('[SW] Subscriber ID saved:', event.data.subscriberId);
                // 🔥 Responder para evitar error en consola
                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage({ success: true, type: 'SET_SUBSCRIBER_ID' });
                }
            }).catch((error) => {
                console.error('[SW] Error saving subscriber ID:', error);
                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage({ success: false, error: error.message });
                }
            })
        );
        return;
    }
    
    // 🔥 Respuesta por defecto para otros mensajes
    if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, received: true });
    }
});

console.log('[SW] Service Worker loaded');
