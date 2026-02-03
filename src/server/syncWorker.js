/**
 * Sync Worker - Descarga de historial de WhatsApp en segundo plano
 * 
 * Este módulo se encarga de:
 * 1. Descargar TODO el historial de mensajes del teléfono
 * 2. Guardarlos en la tabla 'messages' (histórico completo)
 * 3. No afectar la interfaz del chat (tabla 'chat')
 * 4. Ejecutarse en segundo plano sin bloquear
 * 
 * Arquitectura:
 * - Tabla 'messages': Almacena TODO el historial completo
 * - Tabla 'chat': Solo mensajes nuevos/recientes para UI rápida
 */

const { pool } = require('./index'); // Importar pool de conexiones

// Estado del sync por sesión
const syncState = new Map();

// Configuración
const SYNC_CONFIG = {
    batchSize: 100,           // Mensajes por lote
    batchDelay: 100,          // ms entre lotes
    maxConcurrent: 2,         // Máximo syncs simultáneos
    maxRetries: 3,            // Reintentos por lote fallido
    progressInterval: 50      // Emitir progreso cada X mensajes
};

/**
 * Obtiene el estado de sincronización de una sesión
 */
function getSyncState(sessionId) {
    return syncState.get(sessionId) || {
        isSyncing: false,
        startedAt: null,
        completedAt: null,
        totalMessages: 0,
        processedMessages: 0,
        failedMessages: 0,
        lastError: null
    };
}

/**
 * Inicia la sincronización de historial para una sesión
 * @param {string} sessionId - ID de la sesión
 * @param {Object} sock - Socket de WhatsApp (Baileys)
 * @param {Object} io - Instancia de Socket.IO para emitir progreso
 */
async function startHistoricalSync(sessionId, sock, io) {
    // Verificar si ya está sincronizando
    const currentState = syncState.get(sessionId);
    if (currentState?.isSyncing) {
        console.log(`[SYNC-WORKER] ⏸️ ${sessionId}: Ya hay una sincronización en progreso`);
        return { success: false, reason: 'already_syncing' };
    }

    console.log(`[SYNC-WORKER] 🚀 Iniciando sincronización de historial para: ${sessionId}`);
    
    // Inicializar estado
    syncState.set(sessionId, {
        isSyncing: true,
        startedAt: new Date(),
        completedAt: null,
        totalMessages: 0,
        processedMessages: 0,
        failedMessages: 0,
        lastError: null
    });

    // Emitir inicio de sync
    if (io) {
        io.to(`session-${sessionId}`).emit('sync-started', {
            sessionId,
            timestamp: new Date().toISOString(),
            message: 'Iniciando descarga de historial...'
        });
    }

    try {
        // Verificar conexión
        if (!sock || !sock.user) {
            throw new Error('Socket no conectado');
        }

        // Obtener propietario de la sesión
        const ownerSessionId = await getOwnerSessionId(sessionId);
        if (!ownerSessionId) {
            throw new Error('No se pudo obtener ownerSessionId');
        }

        // Iniciar descarga de mensajes
        await downloadMessagesHistory(sessionId, sock, io, ownerSessionId);

        // Marcar como completado
        const state = syncState.get(sessionId);
        state.isSyncing = false;
        state.completedAt = new Date();
        syncState.set(sessionId, state);

        console.log(`[SYNC-WORKER] ✅ Sincronización completada para: ${sessionId}`);
        
        if (io) {
            io.to(`session-${sessionId}`).emit('sync-completed', {
                sessionId,
                timestamp: new Date().toISOString(),
                totalMessages: state.processedMessages,
                failedMessages: state.failedMessages
            });
        }

        return { 
            success: true, 
            totalMessages: state.processedMessages,
            failedMessages: state.failedMessages
        };

    } catch (error) {
        console.error(`[SYNC-WORKER] ❌ Error en sincronización ${sessionId}:`, error.message);
        
        const state = syncState.get(sessionId);
        state.isSyncing = false;
        state.lastError = error.message;
        syncState.set(sessionId, state);

        if (io) {
            io.to(`session-${sessionId}`).emit('sync-error', {
                sessionId,
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }

        return { success: false, error: error.message };
    }
}

/**
 * Descarga el historial de mensajes usando fetchMessagesFromWA
 */
async function downloadMessagesHistory(sessionId, sock, io, ownerSessionId) {
    const state = syncState.get(sessionId);
    let hasMoreMessages = true;
    let cursor = null;
    let totalBatches = 0;

    console.log(`[SYNC-WORKER] 📥 Descargando mensajes para ${sessionId}...`);

    // Intentar obtener mensajes de todos los chats
    try {
        // Obtener lista de chats primero
        const chats = await fetchAllChats(sock);
        console.log(`[SYNC-WORKER] 📋 Encontrados ${chats.length} chats para sincronizar`);

        for (const chat of chats) {
            if (!syncState.get(sessionId)?.isSyncing) {
                console.log(`[SYNC-WORKER] ⏹️ Sincronización detenida para ${sessionId}`);
                break;
            }

            const chatJid = chat.id;
            console.log(`[SYNC-WORKER] 📂 Procesando chat: ${chatJid}`);

            // Descargar mensajes de este chat
            await syncChatMessages(sessionId, sock, chatJid, ownerSessionId, io);

            // Pequeña pausa entre chats
            await delay(SYNC_CONFIG.batchDelay);
        }

    } catch (error) {
        console.error(`[SYNC-WORKER] ❌ Error descargando mensajes:`, error);
        throw error;
    }
}

/**
 * Obtiene todos los chats disponibles
 */
async function fetchAllChats(sock) {
    try {
        // Baileys no tiene un método directo para obtener todos los chats
        // Usamos store si está disponible o devolvemos array vacío
        if (sock.store && sock.store.chats) {
            return Object.values(sock.store.chats).map(chat => ({
                id: chat.id,
                name: chat.name || chat.id
            }));
        }
        return [];
    } catch (error) {
        console.error(`[SYNC-WORKER] ⚠️ Error obteniendo chats:`, error.message);
        return [];
    }
}

/**
 * Sincroniza mensajes de un chat específico
 */
async function syncChatMessages(sessionId, sock, chatJid, ownerSessionId, io) {
    const state = syncState.get(sessionId);
    let messagesDownloaded = 0;
    let retryCount = 0;

    try {
        // Intentar obtener mensajes del chat usando diferentes métodos
        let messages = [];

        // Método 1: fetchMessagesFromWA si está disponible
        if (sock.fetchMessagesFromWA) {
            try {
                messages = await sock.fetchMessagesFromWA(chatJid, 100);
            } catch (err) {
                console.log(`[SYNC-WORKER] ⚠️ fetchMessagesFromWA falló para ${chatJid}: ${err.message}`);
            }
        }

        // Método 2: store.messages si está disponible
        if (messages.length === 0 && sock.store && sock.store.messages) {
            const chatMessages = sock.store.messages[chatJid];
            if (chatMessages) {
                messages = Object.values(chatMessages);
            }
        }

        if (messages.length === 0) {
            return;
        }

        console.log(`[SYNC-WORKER] 📨 ${messages.length} mensajes en ${chatJid}`);

        // Procesar mensajes en lotes
        for (let i = 0; i < messages.length; i += SYNC_CONFIG.batchSize) {
            if (!syncState.get(sessionId)?.isSyncing) break;

            const batch = messages.slice(i, i + SYNC_CONFIG.batchSize);
            
            try {
                await processMessageBatch(sessionId, batch, ownerSessionId, chatJid);
                
                messagesDownloaded += batch.length;
                state.processedMessages += batch.length;
                
                // Emitir progreso
                if (io && state.processedMessages % SYNC_CONFIG.progressInterval === 0) {
                    io.to(`session-${sessionId}`).emit('sync-progress', {
                        sessionId,
                        processed: state.processedMessages,
                        currentChat: chatJid,
                        timestamp: new Date().toISOString()
                    });
                }

            } catch (batchError) {
                console.error(`[SYNC-WORKER] ❌ Error procesando lote:`, batchError.message);
                state.failedMessages += batch.length;
                retryCount++;

                if (retryCount >= SYNC_CONFIG.maxRetries) {
                    console.log(`[SYNC-WORKER] ⏭️ Saltando chat ${chatJid} tras ${retryCount} intentos`);
                    break;
                }
            }

            // Pausa entre lotes
            await delay(SYNC_CONFIG.batchDelay);
        }

        syncState.set(sessionId, state);
        console.log(`[SYNC-WORKER] ✅ ${messagesDownloaded} mensajes sincronizados de ${chatJid}`);

    } catch (error) {
        console.error(`[SYNC-WORKER] ❌ Error sincronizando ${chatJid}:`, error.message);
        state.failedMessages++;
        syncState.set(sessionId, state);
    }
}

/**
 * Procesa un lote de mensajes y los guarda en la BD
 */
async function processMessageBatch(sessionId, messages, ownerSessionId, chatJid) {
    if (!pool) {
        throw new Error('Pool de BD no disponible');
    }

    const connection = await pool.getConnection();
    
    try {
        for (const msg of messages) {
            if (!msg.key || !msg.key.id) continue;

            // Verificar si ya existe en BD
            const [existing] = await connection.execute(
                'SELECT id FROM messages WHERE id = ? AND session_id = ? LIMIT 1',
                [msg.key.id, ownerSessionId]
            );

            if (existing.length > 0) {
                continue; // Ya existe, saltar
            }

            // Extraer contenido del mensaje
            const messageType = Object.keys(msg.message || {})[0] || 'text';
            const textContent = extractTextContent(msg.message);
            const timestamp = msg.messageTimestamp 
                ? new Date(msg.messageTimestamp * 1000) 
                : new Date();

            // Guardar en messages (histórico completo)
            await connection.execute(
                `INSERT INTO messages (
                    id, session_id, phone, chat_jid, sender_jid, from_me,
                    message_type, text_content, timestamp, status, is_read
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
                [
                    msg.key.id,
                    ownerSessionId,
                    sessionId,
                    chatJid,
                    msg.key.participant || msg.key.remoteJid,
                    msg.key.fromMe || false,
                    messageType,
                    textContent,
                    timestamp,
                    msg.key.fromMe ? 'sent' : 'received',
                    false
                ]
            );
            
            // Si el mensaje es de HOY, también guardar en tabla chat (interfaz del día)
            const today = new Date();
            const msgDate = new Date(timestamp);
            const isToday = msgDate.toDateString() === today.toDateString();
            
            if (isToday) {
                try {
                    await connection.execute(
                        `INSERT INTO chat (
                            id, session_id, phone, chat_jid, sender_jid, from_me,
                            message_type, text_content, media_url, media_mime_type,
                            timestamp, status, is_read
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
                        [
                            msg.key.id,
                            ownerSessionId,
                            sessionId, // phone - número del canal
                            chatJid,
                            msg.key.participant || msg.key.remoteJid,
                            msg.key.fromMe || false,
                            messageType,
                            textContent,
                            null, // media_url - el sync worker no descarga media
                            null, // media_mime_type
                            timestamp,
                            msg.key.fromMe ? 'sent' : 'received',
                            false
                        ]
                    );
                    console.log(`[SYNC-WORKER] 📱 Mensaje de HOY guardado también en chat: ${msg.key.id.substring(0, 20)}`);
                } catch (chatErr) {
                    console.error(`[SYNC-WORKER] ⚠️ Error guardando en chat: ${chatErr.message}`);
                }
            }
        }

    } finally {
        connection.release();
    }
}

/**
 * Extrae el texto de un mensaje según su tipo
 */
function extractTextContent(message) {
    if (!message) return null;

    const type = Object.keys(message)[0];
    if (!type) return null;

    switch (type) {
        case 'conversation':
            return message.conversation;
        case 'extendedTextMessage':
            return message.extendedTextMessage?.text;
        case 'imageMessage':
            return message.imageMessage?.caption || '[Imagen]';
        case 'videoMessage':
            return message.videoMessage?.caption || '[Video]';
        case 'audioMessage':
            return '[Audio]';
        case 'documentMessage':
            return `[Documento: ${message.documentMessage?.fileName || 'archivo'}]`;
        case 'stickerMessage':
            return '[Sticker]';
        default:
            return `[${type}]`;
    }
}

/**
 * Obtiene el session_id del propietario
 */
async function getOwnerSessionId(sessionId) {
    // Implementación simplificada - ajustar según lógica real del sistema
    if (!pool) return sessionId;
    
    try {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT session_id FROM user_sessions WHERE phone = ? OR session_id = ? LIMIT 1',
                [sessionId, sessionId]
            );
            return rows.length > 0 ? rows[0].session_id : sessionId;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(`[SYNC-WORKER] ⚠️ Error obteniendo owner:`, error.message);
        return sessionId;
    }
}

/**
 * Utilidad: delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Detiene la sincronización de una sesión
 */
function stopSync(sessionId) {
    const state = syncState.get(sessionId);
    if (state) {
        state.isSyncing = false;
        syncState.set(sessionId, state);
        console.log(`[SYNC-WORKER] ⏹️ Sincronización detenida para: ${sessionId}`);
    }
}

/**
 * Obtiene estadísticas de sincronización
 */
function getStats() {
    const stats = [];
    for (const [sessionId, state] of syncState.entries()) {
        stats.push({
            sessionId,
            ...state,
            duration: state.completedAt 
                ? (new Date(state.completedAt) - new Date(state.startedAt)) / 1000
                : state.startedAt 
                    ? (Date.now() - new Date(state.startedAt)) / 1000
                    : 0
        });
    }
    return stats;
}

module.exports = {
    startHistoricalSync,
    stopSync,
    getSyncState,
    getStats
};
