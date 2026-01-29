/**
 * Módulo para cargar sesiones de WhatsApp bajo demanda
 * Permite enviar mensajes sin necesidad de tener el dashboard abierto
 *
 * OPTIMIZADO: Enero 2026
 * - Backoff exponencial para reconexiones
 * - Configuración de Baileys optimizada
 * - Mejor manejo de errores
 * - Integración con sesiones principales
 */

const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

// Cache de sockets activos
const activeSockets = new Map();

// Estado de reconexión con backoff exponencial
const reconnectionState = new Map(); // sessionId -> { attempts, nextAllowedTime }

// Configuración de backoff
const BACKOFF_CONFIG = {
    baseDelay: 30000,      // 30 segundos inicial
    maxDelay: 300000,      // 5 minutos máximo
    maxAttempts: 5,        // Máximo intentos antes de pausar
    jitterFactor: 0.2      // 20% de variación
};

/**
 * Calcula el delay con backoff exponencial
 */
function calculateBackoff(attempts) {
    const delay = Math.min(
        BACKOFF_CONFIG.baseDelay * Math.pow(2, attempts),
        BACKOFF_CONFIG.maxDelay
    );
    const jitter = delay * BACKOFF_CONFIG.jitterFactor * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
}

/**
 * Verifica si puede reconectar
 */
function canReconnect(sessionId) {
    const state = reconnectionState.get(sessionId);
    if (!state) return true;

    if (state.attempts >= BACKOFF_CONFIG.maxAttempts) {
        console.log(`[WA-LOADER] ⏸️ ${sessionId}: Máximo de intentos alcanzado (${state.attempts})`);
        return false;
    }

    if (Date.now() < state.nextAllowedTime) {
        return false;
    }

    return true;
}

/**
 * Registra intento de reconexión
 */
function registerAttempt(sessionId) {
    const state = reconnectionState.get(sessionId) || { attempts: 0, nextAllowedTime: 0 };
    state.attempts++;
    const delay = calculateBackoff(state.attempts);
    state.nextAllowedTime = Date.now() + delay;
    reconnectionState.set(sessionId, state);
    console.log(`[WA-LOADER] 📊 ${sessionId}: Intento #${state.attempts}, próximo en ${Math.round(delay/1000)}s`);
    return delay;
}

/**
 * Resetea estado de reconexión
 */
function resetReconnection(sessionId) {
    if (reconnectionState.has(sessionId)) {
        console.log(`[WA-LOADER] ✅ ${sessionId}: Estado de reconexión reseteado`);
        reconnectionState.delete(sessionId);
    }
}

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

    // Verificar si puede reconectar
    if (!canReconnect(sessionId)) {
        console.log(`[WA-LOADER] ⏳ ${sessionId}: En cooldown, no se puede crear socket`);
        return null;
    }

    try {
        console.log(`[WA-LOADER] 📡 Cargando sesión de WhatsApp: ${sessionId}`);

        // Ruta a los archivos de autenticación
        const authPath = path.join(__dirname, '../../auth_info_multi', sessionId);

        // Verificar que exista la carpeta de credenciales
        if (!fs.existsSync(authPath)) {
            console.error(`[WA-LOADER] ❌ No existe carpeta de auth para ${sessionId}`);
            return null;
        }

        // Verificar que tenga credenciales válidas
        const credsPath = path.join(authPath, 'creds.json');
        if (!fs.existsSync(credsPath)) {
            console.error(`[WA-LOADER] ❌ No hay credenciales para ${sessionId} (requiere QR)`);
            return null;
        }

        // Cargar estado de autenticación
        const { state, saveCreds } = await useMultiFileAuthState(authPath);

        // Crear socket de WhatsApp con configuración optimizada
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            // Usar browser estándar de Baileys
            browser: Browsers.ubuntu('Winsap'),
            // Timeouts optimizados
            connectTimeoutMs: 45000, // 45 segundos
            defaultQueryTimeoutMs: 30000, // 30 segundos (antes 0 = infinito)
            qrTimeout: 40000, // 40 segundos para QR
            // KeepAlive más frecuente para este módulo bajo demanda
            keepAliveIntervalMs: 20000, // 20 segundos
            // No emitir eventos propios
            emitOwnEvents: false,
            // NO marcar como online (reduce detección)
            markOnlineOnConnect: false,
            // No sincronizar historial
            syncFullHistory: false,
            fireInitQueries: false,
            // Configuraciones adicionales
            retryRequestDelayMs: 500,
            maxMsgRetryCount: 2,
            getMessage: async () => ({ conversation: '' })
        });

        // Guardar credenciales cuando cambien
        sock.ev.on('creds.update', saveCreds);

        // Manejar actualizaciones de conexión
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                console.log(`[WA-LOADER] ⚠️ ${sessionId} desconectado (código: ${statusCode}). Reconectar: ${shouldReconnect}`);

                // Limpiar del cache
                activeSockets.delete(sessionId);

                // Reconectar con backoff si no fue logout
                if (shouldReconnect && canReconnect(sessionId)) {
                    const delay = registerAttempt(sessionId);
                    console.log(`[WA-LOADER] 🔄 Reconectando ${sessionId} en ${Math.round(delay/1000)}s...`);
                    setTimeout(() => {
                        getOrCreateWhatsAppSocket(sessionId).catch(err => {
                            console.error(`[WA-LOADER] Error reconectando ${sessionId}:`, err.message);
                        });
                    }, delay);
                }
            } else if (connection === 'open') {
                console.log(`[WA-LOADER] ✅ ${sessionId} conectado exitosamente`);
                console.log(`[WA-LOADER] 📱 Usuario: ${sock.user?.id || 'unknown'}`);
                // Resetear estado de reconexión
                resetReconnection(sessionId);
            } else if (connection === 'connecting') {
                console.log(`[WA-LOADER] 🔌 ${sessionId} conectando...`);
            }

            if (qr) {
                console.log(`[WA-LOADER] ⚠️ ${sessionId} requiere escaneo de QR (no disponible en modo servidor)`);
                // Cerrar socket si requiere QR (ya no tiene credenciales válidas)
                activeSockets.delete(sessionId);
            }
        });

        // Guardar en cache
        activeSockets.set(sessionId, sock);

        // Esperar a que se conecte (máximo 45 segundos)
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                activeSockets.delete(sessionId);
                reject(new Error('Timeout esperando conexión'));
            }, 45000);

            const handler = (update) => {
                if (update.connection === 'open') {
                    clearTimeout(timeout);
                    sock.ev.off('connection.update', handler);
                    resolve();
                } else if (update.connection === 'close') {
                    clearTimeout(timeout);
                    sock.ev.off('connection.update', handler);
                    reject(new Error('Conexión cerrada durante la carga'));
                }
            };

            sock.ev.on('connection.update', handler);
        });

        return sock;

    } catch (error) {
        console.error(`[WA-LOADER] ❌ Error cargando socket ${sessionId}:`, error.message);
        activeSockets.delete(sessionId);
        registerAttempt(sessionId); // Registrar intento fallido
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

        // Validar que el número no sea inválido
        if (formattedPhone.startsWith('0@') || formattedPhone === '@s.whatsapp.net') {
            throw new Error('Número de teléfono inválido');
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
        resetReconnection(sessionId);
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
        resetReconnection(sessionId);
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
        sessions: Array.from(activeSockets.keys()),
        reconnectionStates: Array.from(reconnectionState.entries()).map(([id, state]) => ({
            sessionId: id,
            attempts: state.attempts,
            nextAllowedTime: new Date(state.nextAllowedTime).toISOString()
        }))
    };
}

// Limpiar estados de reconexión antiguos cada 30 minutos
setInterval(() => {
    const oneHourAgo = Date.now() - 3600000;
    for (const [sessionId, state] of reconnectionState.entries()) {
        if (state.nextAllowedTime < oneHourAgo) {
            reconnectionState.delete(sessionId);
            console.log(`[WA-LOADER] 🧹 Limpiado estado de reconexión antiguo: ${sessionId}`);
        }
    }
}, 1800000);

module.exports = {
    getOrCreateWhatsAppSocket,
    sendWhatsAppMessage,
    closeSocket,
    closeAllSockets,
    getStats
};
