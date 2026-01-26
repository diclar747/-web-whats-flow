/**
 * Módulo para cargar sesiones de WhatsApp bajo demanda
 * Permite enviar mensajes sin necesidad de tener el dashboard abierto
 */

const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');

// Cache de sockets activos
const activeSockets = new Map();

/**
 * Obtiene o crea un socket de WhatsApp para una sesión
 */
async function getOrCreateWhatsAppSocket(sessionId) {
    // Si ya existe y está conectado, reutilizar
    if (activeSockets.has(sessionId)) {
        const existingSocket = activeSockets.get(sessionId);
        if (existingSocket && existingSocket.user) {
            console.log(`[WA-LOADER] ✅ Reutilizando socket existente para ${sessionId}`);
            return existingSocket;
        } else {
            // Socket existe pero no está conectado, remover
            activeSockets.delete(sessionId);
        }
    }

    try {
        console.log(`[WA-LOADER] 📡 Cargando sesión de WhatsApp: ${sessionId}`);

        // Ruta a los archivos de autenticación
        const authPath = path.join(__dirname, '../../auth_info_multi', sessionId);

        // Cargar estado de autenticación
        const { state, saveCreds } = await useMultiFileAuthState(authPath);

        // Crear socket de WhatsApp
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }), // Silenciar logs
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Winsap'),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: false,
            markOnlineOnConnect: false // No marcar como online
        });

        // Guardar credenciales cuando cambien
        sock.ev.on('creds.update', saveCreds);

        // Manejar actualizaciones de conexión
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`[WA-LOADER] ⚠️  ${sessionId} desconectado. Reconectar: ${shouldReconnect}`);

                // Limpiar del cache
                activeSockets.delete(sessionId);

                // Reconectar automáticamente si no fue logout
                if (shouldReconnect) {
                    console.log(`[WA-LOADER] 🔄 Reconectando ${sessionId} en 5 segundos...`);
                    setTimeout(() => {
                        getOrCreateWhatsAppSocket(sessionId).catch(err => {
                            console.error(`[WA-LOADER] Error reconectando ${sessionId}:`, err.message);
                        });
                    }, 5000);
                }
            } else if (connection === 'open') {
                console.log(`[WA-LOADER] ✅ ${sessionId} conectado exitosamente`);
                console.log(`[WA-LOADER] 📱 Usuario: ${sock.user?.id || 'unknown'}`);
            } else if (connection === 'connecting') {
                console.log(`[WA-LOADER] 🔌 ${sessionId} conectando...`);
            }

            if (qr) {
                console.log(`[WA-LOADER] ⚠️  ${sessionId} requiere escaneo de QR (no disponible en modo servidor)`);
            }
        });

        // Guardar en cache
        activeSockets.set(sessionId, sock);

        // Esperar a que se conecte (máximo 30 segundos)
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout esperando conexión'));
            }, 30000);

            sock.ev.on('connection.update', (update) => {
                if (update.connection === 'open') {
                    clearTimeout(timeout);
                    resolve();
                } else if (update.connection === 'close') {
                    clearTimeout(timeout);
                    reject(new Error('Conexión cerrada durante la carga'));
                }
            });
        });

        return sock;

    } catch (error) {
        console.error(`[WA-LOADER] ❌ Error cargando socket ${sessionId}:`, error.message);
        activeSockets.delete(sessionId);
        return null;
    }
}

/**
 * Envía un mensaje de WhatsApp
 */
async function sendWhatsAppMessage(sessionId, phoneNumber, message) {
    try {
        console.log(`[WA-LOADER] 📤 Enviando mensaje desde ${sessionId} a ${phoneNumber}`);

        // Obtener o crear socket
        const sock = await getOrCreateWhatsAppSocket(sessionId);

        if (!sock) {
            throw new Error('No se pudo cargar la sesión de WhatsApp');
        }

        // Formatear número de teléfono
        let formattedPhone = phoneNumber.toString().replace(/[^0-9]/g, '');
        if (!formattedPhone.includes('@')) {
            formattedPhone = formattedPhone + '@s.whatsapp.net';
        }

        // Enviar mensaje
        const result = await sock.sendMessage(formattedPhone, { text: message });

        console.log(`[WA-LOADER] ✅ Mensaje enviado exitosamente`);
        return { success: true, result };

    } catch (error) {
        console.error(`[WA-LOADER] ❌ Error enviando mensaje:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Cierra un socket específico
 */
function closeSocket(sessionId) {
    if (activeSockets.has(sessionId)) {
        const sock = activeSockets.get(sessionId);
        try {
            sock.end();
        } catch (error) {
            console.error(`[WA-LOADER] Error cerrando socket ${sessionId}:`, error.message);
        }
        activeSockets.delete(sessionId);
        console.log(`[WA-LOADER] 🔌 Socket ${sessionId} cerrado`);
    }
}

/**
 * Cierra todos los sockets
 */
function closeAllSockets() {
    console.log(`[WA-LOADER] 🔌 Cerrando ${activeSockets.size} sockets...`);
    for (const [sessionId, sock] of activeSockets) {
        try {
            sock.end();
        } catch (error) {
            console.error(`[WA-LOADER] Error cerrando socket ${sessionId}:`, error.message);
        }
    }
    activeSockets.clear();
    console.log(`[WA-LOADER] ✅ Todos los sockets cerrados`);
}

/**
 * Obtiene estadísticas de sockets activos
 */
function getStats() {
    return {
        totalSockets: activeSockets.size,
        sessions: Array.from(activeSockets.keys())
    };
}

module.exports = {
    getOrCreateWhatsAppSocket,
    sendWhatsAppMessage,
    closeSocket,
    closeAllSockets,
    getStats
};
