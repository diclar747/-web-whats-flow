// pushService.ts
import axios from 'axios';

const VAPID_PUBLIC_KEY = 'BFqasfX88n63OaxH04nLh9N-G7W-_7M9_rI8x8O87Y_5x-4O8n63OaxH04nLh9N-G7W-_7M9_rI8x8O87Y_5'; // This usually comes from backend

export const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export const subscribeToPush = async (urlCode: string, name?: string, email?: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Tu navegador no soporta notificaciones Push. Por favor, intenta con Chrome o Edge.');
    }

    try {
        console.log('[PushService] 1. Obteniendo llave VAPID...');
        // 1. Get VAPID Key from server
        const keyRes = await axios.get(`/api/push/vapid-public-key?urlCode=${urlCode}`);
        const publicKey = keyRes.data.publicKey;

        if (!publicKey) {
            throw new Error('No se pudo obtener la llave pública del servidor');
        }

        console.log('[PushService] 2. Solicitando permiso...');
        // 2. Request Permission BEFORE Service Worker (some browsers prefer this)
        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
            throw new Error('Debes permitir las notificaciones para suscribirte. Verifica el icono de candado en la barra de direcciones.');
        }

        console.log('[PushService] 3. Registrando Service Worker...');
        // 3. Register Service Worker
        const registration = await navigator.serviceWorker.register('/push-sw.js', {
            scope: '/'
        });

        // Ensure it's updated
        await registration.update();

        console.log('[PushService] 4. Creando suscripción en el navegador...');
        // 4. Subscribe (with auto-retry for key mismatch)
        console.log('[PushService] 4. Creando suscripción en el navegador...');
        let subscription;
        try {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
        } catch (subError: any) {
            // Handle error: "A subscription with a different applicationServerKey... already exists"
            if (subError.message && (subError.message.includes('applicationServerKey') || subError.message.includes('gcm_sender_id'))) {
                console.warn('[PushService] Detectada suscripción con llave diferente. Desuscribiendo y reintentando...');

                const existingSub = await registration.pushManager.getSubscription();
                if (existingSub) {
                    await existingSub.unsubscribe();
                    console.log('[PushService] Suscripción anterior eliminada.');
                }

                // Retry subscription
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });
                console.log('[PushService] Re-suscripción exitosa.');
            } else {
                throw subError; // Re-throw other errors
            }
        }

        console.log('[PushService] 5. Guardando en servidor...');
        // 5. Send to Server
        const res = await axios.post(`/api/push/subscribe/${urlCode}`, {
            subscription,
            name,
            email
        });

        console.log('[PushService] ✅ Éxito:', res.data);
        return res.data;
    } catch (error: any) {
        console.error('[PushService] Error crítico:', error);

        // Error messages more friendly for the user
        if (error.response?.status === 401) throw new Error('No autorizado para esta suscripción');
        if (error.response?.data?.error) throw new Error(error.response.data.error);
        if (error.message?.includes('registration')) throw new Error('Error al registrar el motor de notificaciones');

        throw error;
    }
};
