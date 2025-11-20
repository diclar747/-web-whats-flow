const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Configuración de CORS
const corsOptions = {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    credentials: true,
    maxAge: 3600
};

app.use(cors(corsOptions));
app.use(express.json());
app.options('*', cors(corsOptions));

// Headers de seguridad y CORS - Comentado para evitar conflicto con el paquete cors
/*
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, UPDATE, PUT, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    next();
});
*/

// Mapa para almacenar sesiones activas de WhatsApp
const sessions = new Map();
let lastQRSession = null;
const QR_EXPIRY_TIME = 2 * 60 * 1000; // 2 minutos

// Almacenamiento en memoria (cuando no hay DB)
const memoryStorage = {
    contacts: new Map(),
    messages: new Map(),
    userSessions: new Map(),
    isMemoryMode: false
};

// Crear directorio para autenticación si no existe
const BASE_AUTH_DIR = './auth_info_multi';
if (!fs.existsSync(BASE_AUTH_DIR)) {
    fs.mkdirSync(BASE_AUTH_DIR, { recursive: true });
}

// MySQL Connection Pool
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // As per user, no password
    database: 'whatsflow',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;

async function initializeDatabase() {
    // Verificar si se debe omitir la base de datos
    if (process.env.SKIP_DB === 'true') {
        console.log('[DB-INIT] ⚠️  SKIP_DB=true - Funcionando SIN base de datos (memoria temporal)');
        console.log('[DB-INIT] Los mensajes y contactos se guardarán solo en memoria');
        return;
    }
    
    console.log('[DB-INIT] Starting database initialization...');
    try {
        console.log('[DB-INIT] Attempting to create temporary connection for database creation...');
        const tempConnection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });
        console.log('[DB-INIT] Temporary connection successful. Creating database if not exists...');
        await tempConnection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
        console.log(`[DB-INIT] Database '${dbConfig.database}' ensured or already exists.`);
        await tempConnection.end();
        console.log('[DB-INIT] Temporary connection closed.');

        console.log('[DB-INIT] Creating connection pool...');
        pool = mysql.createPool(dbConfig);
        console.log('[DB-INIT] Connection pool created. Attempting to get a connection from pool...');
        const connection = await pool.getConnection();
        console.log('[DB-INIT] Successfully got a connection from pool.');
        connection.release();
        console.log('[DB-INIT] Connection from pool released. Calling createTables().');
        await createTables();
        console.log('[DB-INIT] createTables() finished.');
    } catch (error) {
        console.error('[DB-INIT] Full error during initializeDatabase:', error);
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            console.error('[DB-INIT] ❌ MySQL no disponible. Iniciando en MODO MEMORIA...');
            console.error('[DB-INIT] 🔄 El sistema funcionará sin base de datos');
            console.error('[DB-INIT]  Los mensajes se guardarán solo en memoria (temporal)');
            memoryStorage.isMemoryMode = true;
            return; // Continuar sin DB
        }
        if (error.code === 'ER_BAD_DB_ERROR') {
            console.error(`[DB-INIT] Database '${dbConfig.database}' does not exist after attempting creation. Check permissions or MySQL logs.`);
        }
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('[DB-INIT] Access denied. Check MySQL user credentials and permissions.');
        }
        
        // Activar modo memoria como fallback
        console.error('[DB-INIT] 🔄 Activando modo memoria como respaldo...');
        memoryStorage.isMemoryMode = true;
    }
}

async function createTables() {
    console.log('[DB-TABLES] Starting createTables()...');
    let connection;
    try {
        console.log('[DB-TABLES] Attempting to get connection from pool...');
        connection = await pool.getConnection();
        console.log('[DB-TABLES] Successfully got connection from pool.');
        console.log('[DB-TABLES] Creating tables if they do not exist...');

        await connection.query(
            'CREATE TABLE IF NOT EXISTS contacts ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'jid VARCHAR(255) UNIQUE NOT NULL,'
            + 'name VARCHAR(255),'
            + 'notify_name VARCHAR(255),'
            + 'is_group BOOLEAN DEFAULT FALSE,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'contacts\' ensured.');

        await connection.query(
            'CREATE TABLE IF NOT EXISTS contact_groups ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'name VARCHAR(255) UNIQUE NOT NULL,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'contact_groups\' ensured.');

        await connection.query(
            'CREATE TABLE IF NOT EXISTS contact_group_members ('
            + 'contact_id INT,'
            + 'group_id INT,'
            + 'PRIMARY KEY (contact_id, group_id),'
            + 'FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,'
            + 'FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE CASCADE,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'contact_group_members\' ensured.');
        
        await connection.query(
            'CREATE TABLE IF NOT EXISTS messages ('
            + 'id VARCHAR(255) PRIMARY KEY, '
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'user_session_id INT,'
            + 'chat_jid VARCHAR(255) NOT NULL, '
            + 'sender_jid VARCHAR(255), '
            + 'from_me BOOLEAN NOT NULL,'
            + 'message_type VARCHAR(50), '
            + 'text_content TEXT,'
            + 'media_url VARCHAR(1024),'
            + 'media_mime_type VARCHAR(100),'
            + 'timestamp DATETIME NOT NULL,'
            + 'status VARCHAR(50) DEFAULT \'pending\', '
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'FOREIGN KEY (chat_jid) REFERENCES contacts(jid) ON DELETE CASCADE,'
            + 'INDEX idx_user_session_id (user_session_id),'
            + 'INDEX idx_session_id (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'messages\' ensured.');

        await connection.query(
            'CREATE TABLE IF NOT EXISTS campaigns ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'message_template TEXT NOT NULL,'
            + 'use_random_timing BOOLEAN DEFAULT FALSE,'
            + 'random_timing_msg_count INT,'
            + 'random_timing_time_span_minutes INT,'
            + 'use_id_flow BOOLEAN DEFAULT FALSE,'
            + 'id_flow_size INT,'
            + 'status VARCHAR(50) DEFAULT \'pending\', '
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'campaigns\' ensured.');

        await connection.query(
            'CREATE TABLE IF NOT EXISTS campaign_recipients ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'campaign_id INT NOT NULL,'
            + 'contact_jid VARCHAR(255) NOT NULL,'
            + 'message_id VARCHAR(255), '
            + 'status VARCHAR(50) DEFAULT \'pending\', '
            + 'error_message TEXT,'
            + 'sent_at DATETIME,'
            + 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,'
            + 'FOREIGN KEY (contact_jid) REFERENCES contacts(jid) ON DELETE CASCADE'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'campaign_recipients\' ensured.');
        
        console.log('[DB-TABLES] All tables ensured successfully.');

    } catch (error) {
        console.error('[DB-TABLES] Full error during createTables:', error);
        if (connection) {
            console.error('[DB-TABLES] Error occurred after connection was established.');
        } else {
            console.error('[DB-TABLES] Error occurred before connection was established from pool.');
        }
    } finally {
        if (connection) {
            connection.release();
            console.log('[DB-TABLES] Connection released.');
        }
    }
}

// Helper function to get or insert/update contact in DB
async function getOrInsertContact(jid, name = null, notifyName = null, isGroup = false) {
    console.log(`[DB-CONTACT-CALL] Called getOrInsertContact for jid: ${jid}, name: ${name}, notifyName: ${notifyName}, isGroup: ${isGroup}`);
    
    // Modo memoria si no hay DB
    if (process.env.SKIP_DB === 'true' || !pool) {
        if (!memoryStorage.contacts.has(jid)) {
            const contactData = {
                id: Date.now() + Math.random(),
                jid,
                name: name || notifyName || jid.split('@')[0],
                notify_name: notifyName || name || jid.split('@')[0],
                is_group: isGroup,
                created_at: new Date()
            };
            memoryStorage.contacts.set(jid, contactData);
            console.log(`[MEMORY-CONTACT] Contact ${jid} stored in memory`);
        }
        return memoryStorage.contacts.get(jid).id;
    }
    
    if (!pool) {
        console.error('[DB-CONTACT] DB Pool not initialized!');
        return null;
    }
    const connection = await pool.getConnection();
    try {
        console.log(`[DB-CONTACT-QUERY] Attempting to find existing contact for jid: ${jid}`);
        let [rows] = await connection.execute('SELECT id, name, notify_name FROM contacts WHERE jid = ?', [jid]);
        console.log(`[DB-CONTACT-QUERY-RESULT] Found ${rows.length} existing contacts for jid: ${jid}`);
        
        const contactName = name || notifyName || jid.split('@')[0];
        const contactNotifyName = notifyName || name || jid.split('@')[0];

        if (rows.length > 0) {
            // Contact exists, update if name or notify_name is different or new
            const existingContact = rows[0];
            if ((name && existingContact.name !== contactName) || 
                (notifyName && existingContact.notify_name !== contactNotifyName) ||
                (name === null && existingContact.name !== contactName) || // ensure jid-based name gets updated if current name is null
                (notifyName === null && existingContact.notify_name !== contactNotifyName) ) {
                console.log(`[DB-CONTACT-UPDATE] Attempting to update contact jid: ${jid} with name: ${contactName}, notifyName: ${contactNotifyName}`);
                await connection.execute(
                    'UPDATE contacts SET name = ?, notify_name = ?, updated_at = CURRENT_TIMESTAMP WHERE jid = ?',
                    [contactName, contactNotifyName, jid]
                );
                console.log(`[DB-CONTACT-UPDATE-SUCCESS] Contact ${jid} updated in DB.`);
            }
            return existingContact.id;
        } else {
            // Contact does not exist, insert new
            console.log(`[DB-CONTACT-INSERT] Attempting to insert new contact jid: ${jid} with name: ${contactName}, notifyName: ${contactNotifyName}, isGroup: ${isGroup}`);
            const [result] = await connection.execute(
                'INSERT INTO contacts (jid, name, notify_name, is_group) VALUES (?, ?, ?, ?)',
                [jid, contactName, contactNotifyName, isGroup]
            );
            console.log(`[DB-CONTACT-INSERT-SUCCESS] Contact ${jid} inserted into DB with ID ${result.insertId}.`);
            return result.insertId;
        }
    } catch (error) {
        console.error(`[DB-CONTACT] Error in getOrInsertContact for ${jid}:`, error);
        return null;
    } finally {
        if (connection) connection.release();
    }
}

// Helper function to save a message to the database
async function saveMessageToDB(sessionId, msg) {
    console.log(`[DB-MSG-CALL] Called saveMessageToDB for session: ${sessionId}, messageId: ${msg.id}, chat_jid: ${msg.chat_jid}`);

    // Modo memoria si no hay DB
    if (process.env.SKIP_DB === 'true' || !pool || memoryStorage.isMemoryMode) {
        const messageKey = `${sessionId}_${msg.id}`;
        memoryStorage.messages.set(messageKey, {
            ...msg,
            session_id: sessionId,
            created_at: new Date()
        });
        console.log(`[MEMORY-MSG] Message ${msg.id} stored in memory for session ${sessionId}`);
        return { affectedRows: 1, insertId: Date.now() };
    }

    if (!pool) {
        console.error('[DB-MSG] DB Pool not initialized!');
        return null;
    }

    // Obtener user_session_id
    const userSessionId = await getUserSessionId(sessionId);

    const connection = await pool.getConnection();
    try {
        const {
            id: messageId, // Baileys message ID
            chat_jid, // JID of the chat (contact or group)
            sender_jid, // JID of the actual sender (can be different from chat_jid in groups)
            from_me,
            message_type,
            text_content,
            media_url,
            media_mime_type,
            timestamp, // Should be a JS Date object or a string parsable by new Date()
            status = 'sent' // Default status, can be updated later
        } = msg;

        // Ensure timestamp is in YYYY-MM-DD HH:MM:SS format for MySQL DATETIME
        const mysqlTimestamp = new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');

        // Define los parámetros para la consulta, convirtiendo undefined a null donde sea necesario
        const finalSenderJid = sender_jid || chat_jid;
        const params = [
            messageId,
            sessionId,
            userSessionId, // Agregar user_session_id
            chat_jid,
            finalSenderJid,
            from_me,
            message_type || null, // Asegurar null si message_type es undefined
            text_content || null,
            media_url || null,
            media_mime_type || null,
            mysqlTimestamp,
            status || 'pending' // Asegurar un estado por defecto si es undefined
        ];

        console.log(`[DB-MSG-QUERY] Attempting to insert/update messageId: ${messageId} for session: ${sessionId}, user_session_id: ${userSessionId}, chat_jid: ${chat_jid}, sender_jid: ${finalSenderJid}, from_me: ${from_me}, type: ${params[6]}, status: ${params[11]}`);
        const [result] = await connection.execute(
            'INSERT INTO messages (id, session_id, user_session_id, chat_jid, sender_jid, from_me, message_type, text_content, media_url, media_mime_type, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = CURRENT_TIMESTAMP',
            params
        );
        console.log(`[DB-MSG-QUERY-RESULT] Result for messageId ${messageId}: affectedRows: ${result.affectedRows}, insertId: ${result.insertId !== undefined ? result.insertId : 'N/A (update)'}`);

        if (result.affectedRows > 0) {
             if (result.insertId !== 0 && result.insertId !== undefined) { // insertId is 0 for ON DUPLICATE KEY UPDATE if no new row was inserted
                console.log(`[DB-MSG] Message ${messageId} for user_session ${userSessionId} inserted into DB.`);
             } else {
                console.log(`[DB-MSG] Message ${messageId} for user_session ${userSessionId} updated in DB (e.g. status).`);
             }
        } else {
            // This case might happen if ON DUPLICATE KEY UPDATE didn't change anything or no insert occurred.
            // For messages, usually an insert or an update (if status changes) is expected.
            console.log(`[DB-MSG] Message ${messageId} for user_session ${userSessionId} - no change in DB (already exists with same status?).`);
        }
        return result;

    } catch (error) {
        console.error(`[DB-MSG] Error in saveMessageToDB for message ${msg.id} in session ${sessionId}:`, error);
        // If it's a duplicate entry error on 'id' (PRIMARY KEY), we can often ignore it if content is the same.
        // However, our ON DUPLICATE KEY UPDATE should handle most cases.
        if (error.code === 'ER_DUP_ENTRY') {
            console.warn(`[DB-MSG] Attempted to insert duplicate message ID: ${msg.id}. Update logic should handle this.`);
        }
        return null;
    } finally {
        if (connection) connection.release();
    }
}

// Función para obtener el número de teléfono del usuario de la sesión
async function getUserPhoneNumber(sessionId) {
    const session = sessions.get(sessionId);
    if (session && session.sock && session.sock.user) {
        // El user.id viene en formato como "5491234567890:XX@s.whatsapp.net"
        const userJid = session.sock.user.id;
        const phoneNumber = userJid.split(':')[0]; // Extraer solo el número
        console.log(`[${sessionId}] Usuario identificado: ${phoneNumber}`);
        return phoneNumber;
    }
    return null;
}

// Función para obtener el user_session_id a partir del session_id
async function getUserSessionId(sessionId) {
    // Modo memoria
    if (process.env.SKIP_DB === 'true' || !pool || memoryStorage.isMemoryMode) {
        if (memoryStorage.userSessions.has(sessionId)) {
            return memoryStorage.userSessions.get(sessionId).id;
        }
        return null;
    }

    if (!pool) {
        console.error('[DB-USER-ID] DB Pool not initialized!');
        return null;
    }

    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(
            'SELECT id FROM user_sessions WHERE session_id = ? ORDER BY last_activity DESC LIMIT 1',
            [sessionId]
        );

        if (rows.length > 0) {
            return rows[0].id;
        }

        // Si no existe, intentar obtener desde la sesión activa y crear
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (phoneNumber) {
            const userSessionId = await getOrCreateUserSession(sessionId, phoneNumber);
            return userSessionId;
        }

        return null;
    } catch (error) {
        console.error(`[DB-USER-ID] Error obteniendo user_session_id:`, error);
        return null;
    } finally {
        if (connection) connection.release();
    }
}

// Función para crear/obtener sesión de usuario en la base de datos
async function getOrCreateUserSession(sessionId, phoneNumber) {
    if (!pool) {
        console.error('[DB-USER] DB Pool not initialized!');
        return null;
    }
    
    const connection = await pool.getConnection();
    try {
        // Crear tabla de sesiones de usuario si no existe
        await connection.query(
            'CREATE TABLE IF NOT EXISTS user_sessions ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'phone_number VARCHAR(50) UNIQUE NOT NULL,'
            + 'is_active BOOLEAN DEFAULT TRUE,'
            + 'last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'INDEX idx_session_id (session_id),'
            + 'INDEX idx_phone_number (phone_number)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );

        // Buscar sesión existente por número de teléfono
        const [existingSessions] = await connection.execute(
            'SELECT id, session_id FROM user_sessions WHERE phone_number = ?',
            [phoneNumber]
        );

        let userSessionId;
        if (existingSessions.length > 0) {
            // Ya existe una sesión para este número de teléfono
            userSessionId = existingSessions[0].id;
            // Actualizar con el nuevo session_id y marcar como activa
            await connection.execute(
                'UPDATE user_sessions SET session_id = ?, is_active = TRUE, last_activity = CURRENT_TIMESTAMP WHERE phone_number = ?',
                [sessionId, phoneNumber]
            );
            console.log(`[DB-USER] Sesión existente actualizada para ${phoneNumber}: user_session_id ${userSessionId}`);
        } else {
            // Primera vez que este número inicia sesión, crear nuevo registro
            const [result] = await connection.execute(
                'INSERT INTO user_sessions (session_id, phone_number, is_active) VALUES (?, ?, TRUE)',
                [sessionId, phoneNumber]
            );
            userSessionId = result.insertId;
            console.log(`[DB-USER] Nueva sesión creada para ${phoneNumber}: user_session_id ${userSessionId}`);
        }

        console.log(`[DB-USER] Sesión de usuario registrada: ${sessionId} -> ${phoneNumber} (user_session_id: ${userSessionId})`);
        return userSessionId;
    } catch (error) {
        console.error(`[DB-USER] Error managing user session:`, error);
        return null;
    } finally {
        if (connection) connection.release();
    }
}

// Helper function to deactivate a user session in the database
async function deactivateUserSession(phoneNumber) {
    if (!pool || memoryStorage.isMemoryMode) {
        console.log(`[DB-USER-DEACTIVATE] Skipping DB operation for phone number ${phoneNumber} (memory mode or no pool)`);
        // In memory mode, we might need to remove it from memoryStorage.userSessions if it exists
        if (memoryStorage.userSessions.has(phoneNumber)) {
            memoryStorage.userSessions.delete(phoneNumber);
            console.log(`[MEMORY-USER-DEACTIVATE] Removed session for ${phoneNumber} from memory.`);
        }
        return;
    }

    if (!pool) {
        console.error('[DB-USER-DEACTIVATE] DB Pool not initialized!');
        return;
    }

    const connection = await pool.getConnection();
    try {
        console.log(`[DB-USER-DEACTIVATE] Deactivating session for phone number: ${phoneNumber}`);
        const [result] = await connection.execute(
            'UPDATE user_sessions SET is_active = FALSE, last_activity = CURRENT_TIMESTAMP WHERE phone_number = ?',
            [phoneNumber]
        );
        if (result.affectedRows > 0) {
            console.log(`[DB-USER-DEACTIVATE] Session deactivated successfully for ${phoneNumber}.`);
        } else {
            console.log(`[DB-USER-DEACTIVATE] No active session found to deactivate for ${phoneNumber}.`);
        }
    } catch (error) {
        console.error(`[DB-USER-DEACTIVATE] Error deactivating user session for ${phoneNumber}:`, error);
    } finally {
        if (connection) connection.release();
    }
}


// Función para sincronizar el historial completo de WhatsApp
// NOTA: En Baileys, la sincronización es AUTOMÁTICA vía eventos
// Los eventos chats.set, contacts.set y messages.upsert hacen el trabajo real
// Esta función solo registra que la sincronización está lista
async function syncHistoricalData(sessionId, sock, userSessionId) {
    console.log(`[SYNC] 🔄 Registrando sincronización para sessionId: ${sessionId}, user_session_id: ${userSessionId}`);
    console.log(`[SYNC] ℹ️  Los datos se descargarán automáticamente vía eventos de Baileys`);
    console.log(`[SYNC] ℹ️  Escuchando: chats.set, contacts.set, messages.upsert`);

    const stats = {
        chatsProcessed: 0,
        contactsSaved: 0,
        messagesDownloaded: 0,
        errors: 0,
        startTime: Date.now(),
        totalTime: 0
    };

    // Emitir que estamos listos para recibir datos
    io.emit(`sync-progress-${sessionId}`, {
        stage: 'waiting_for_data',
        message: 'Esperando datos de WhatsApp...',
        ...stats
    });

    console.log(`[SYNC] ✅ Sistema de sincronización listo`);
    console.log(`[SYNC] 📡 Los chats, contactos y mensajes se guardarán cuando WhatsApp los envíe\n`);

    return stats;
}

// Helper function to load chat list from DB
async function loadChatListFromDB(sessionId) {
    // Modo memoria si no hay DB
    if (process.env.SKIP_DB === 'true' || !pool || memoryStorage.isMemoryMode) {
        console.log(`[MEMORY-CHATLIST] Loading chats from memory for session ${sessionId}`);
        const chats = [];
        const chatMap = new Map();

        // Procesar mensajes en memoria para crear lista de chats
        for (const [messageKey, message] of memoryStorage.messages) {
            if (message.session_id === sessionId) {
                const chatJid = message.chat_jid;
                if (!chatMap.has(chatJid) || new Date(message.timestamp) > new Date(chatMap.get(chatJid).timestamp)) {
                    const contact = memoryStorage.contacts.get(chatJid);
                    chatMap.set(chatJid, {
                        id: chatJid,
                        name: contact?.name || chatJid.split('@')[0],
                        isGroup: contact?.is_group || false,
                        lastMessage: message.text_content,
                        timestamp: new Date(message.timestamp).toISOString(),
                        fromMe: message.from_me,
                        status: message.status,
                        unreadCount: 0,
                        avatar: null
                    });
                }
            }
        }

        const chatList = Array.from(chatMap.values()).sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        console.log(`[MEMORY-CHATLIST] Loaded ${chatList.length} chats from memory`);
        return chatList;
    }

    if (!pool) {
        console.error('[DB-CHATLIST] DB Pool not initialized!');
        return [];
    }

    // Obtener el user_session_id
    const userSessionId = await getUserSessionId(sessionId);
    if (!userSessionId) {
        console.log(`[DB-CHATLIST] No se pudo obtener el user_session_id para ${sessionId}`);
        return [];
    }

    const connection = await pool.getConnection();
    try {
        console.log(`[DB-CHATLIST] Loading chat list for session ${sessionId} with user_session_id ${userSessionId}`);

        // Query modificada para filtrar por user_session_id
        const [rows] = await connection.execute(
            `SELECT
                m.chat_jid,
                c.name AS contact_name,
                c.notify_name AS contact_notify_name,
                c.is_group,
                m.text_content AS last_message_text,
                m.timestamp AS last_message_timestamp,
                m.from_me AS last_message_from_me,
                m.status AS last_message_status,
                (SELECT COUNT(*) FROM messages unread
                 WHERE unread.chat_jid = m.chat_jid
                 AND unread.user_session_id = m.user_session_id
                 AND unread.status = 'received'
                 AND unread.from_me = FALSE) AS unread_count
            FROM messages m
            JOIN (
                SELECT chat_jid, MAX(timestamp) AS max_timestamp
                FROM messages
                WHERE user_session_id = ?
                GROUP BY chat_jid
            ) latest_msg ON m.chat_jid = latest_msg.chat_jid AND m.timestamp = latest_msg.max_timestamp
            LEFT JOIN contacts c ON m.chat_jid = c.jid
            WHERE m.user_session_id = ?
            ORDER BY m.timestamp DESC;`,
            [userSessionId, userSessionId]
        );

        const chatList = rows.map(row => ({
            id: row.chat_jid,
            name: row.contact_name || row.contact_notify_name || row.chat_jid.split('@')[0],
            isGroup: !!row.is_group,
            lastMessage: row.last_message_text,
            timestamp: new Date(row.last_message_timestamp).toISOString(),
            fromMe: !!row.last_message_from_me,
            status: row.last_message_status,
            unreadCount: row.unread_count || 0,
            avatar: null // Placeholder for avatar
        }));

        console.log(`[DB-CHATLIST] Loaded ${chatList.length} chats for user_session_id ${userSessionId}`);
        return chatList;

    } catch (error) {
        console.error(`[DB-CHATLIST] Error loading chat list for session ${sessionId}:`, error);
        return [];
    } finally {
        if (connection) connection.release();
    }
}

// const messageStore = new Map(); // <-- Comentado para transicionar a DB

// Función para crear una nueva sesión de WhatsApp
const createSession = async (sessionId, forceNew = false) => {
    // Si ya existe una sesión activa y no se fuerza una nueva, retornarla
    const existingSession = sessions.get(sessionId);
    if (existingSession && !forceNew) {
        return existingSession;
    }

    // Si hay un QR reciente válido, usar ese
    if (lastQRSession && !lastQRSession.session.isConnected && !forceNew) {
        const timeSinceCreation = Date.now() - lastQRSession.createdAt;
        if (timeSinceCreation < QR_EXPIRY_TIME) {
            return lastQRSession.session;
        }
    }

    const AUTH_DIR = path.join(BASE_AUTH_DIR, sessionId);
    if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        // Crear almacén personalizado para chats y contactos
        const customStore = {
            contacts: new Map(),
            chats: new Map()
        };

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false, // Deshabilitado para evitar warning
            logger: pino({ level: 'silent' }),
            browser: ['WhatsApp Web Real', 'Chrome', '108.0.0']
        });

        const sessionInfo = {
            sock,
            store: customStore,
            qr: null,
            isConnected: false,
            createdAt: Date.now(),
            messages: [],
            chats: []
        };

        // Manejar actualizaciones de conexión
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                sessionInfo.qr = qr;
                sessionInfo.isConnected = false;
                lastQRSession = {
                    session: sessionInfo,
                    createdAt: Date.now()
                };
                console.log(`[${sessionId}] Nuevo código QR generado`);

                // Convertir QR a Data URL
                QRCode.toDataURL(qr, {
                    width: 300,
                    margin: 1,
                    errorCorrectionLevel: 'H'
                }).then(qrDataUrl => {
                    // Emitir evento global para que el frontend lo reciba
                    io.emit('qr-code', { qrDataUrl, sessionId });
                    // También emitir evento específico por sesión
                    io.emit(`qr-${sessionId}`, { qr, qrDataUrl, sessionId });
                    console.log(`[${sessionId}] QR emitido globalmente y a sesión específica`);
                }).catch(err => {
                    console.error(`[${sessionId}] Error generando QR DataURL:`, err);
                });
            }

            if (connection === 'open') {
                sessionInfo.isConnected = true;
                sessionInfo.qr = null;
                console.log(`[${sessionId}] ¡WhatsApp conectado exitosamente!`);

                // Registrar el número de teléfono del usuario en la base de datos
                let userSessionId = null;
                try {
                    const userPhoneNumber = await getUserPhoneNumber(sessionId);
                    if (userPhoneNumber) {
                        userSessionId = await getOrCreateUserSession(sessionId, userPhoneNumber);
                        console.log(`[${sessionId}] Usuario registrado: ${userPhoneNumber} (user_session_id: ${userSessionId})`);
                    }
                } catch (error) {
                    console.error(`[${sessionId}] Error registrando usuario:`, error);
                }

                io.emit('connection-update', {
                    status: 'connected',
                    sessionId: sessionId,
                    timestamp: new Date().toISOString()
                });
                io.emit(`connection-${sessionId}`, { status: 'connected' });

                // SINCRONIZACIÓN AUTOMÁTICA DEL HISTORIAL COMPLETO
                if (userSessionId) {
                    console.log(`[${sessionId}] 🔄 Iniciando sincronización automática del historial...`);

                    // Ejecutar sincronización en background (no bloquear)
                    syncHistoricalData(sessionId, sock, userSessionId).then(stats => {
                        console.log(`[${sessionId}] ✅ Sincronización completada con éxito:`, stats);

                        // Después de sincronizar, cargar y emitir la lista de chats actualizada
                        return loadChatListFromDB(sessionId);
                    }).then(initialChats => {
                        // Emitir GLOBALMENTE para que el cliente que escucha este evento lo reciba
                        io.emit(`initial-chats-${sessionId}`, { chats: initialChats });
                        console.log(`[${sessionId}] Emitted initial chat list GLOBALLY for event initial-chats-${sessionId} with ${initialChats.length} chats.`);
                    }).catch(syncError => {
                        console.error(`[${sessionId}] ❌ Error en sincronización automática:`, syncError);

                        // Aunque falle la sincronización, intentar cargar chats existentes de la BD
                        loadChatListFromDB(sessionId).then(initialChats => {
                            io.emit(`initial-chats-${sessionId}`, { chats: initialChats });
                            console.log(`[${sessionId}] Emitted chat list from DB (fallback) with ${initialChats.length} chats.`);
                        }).catch(e => {
                            console.error(`[${sessionId}] Error loading chats from DB:`, e);
                        });
                    });
                } else {
                    // Si no hay userSessionId, solo cargar chats existentes
                    try {
                        const initialChats = await loadChatListFromDB(sessionId);
                        io.emit(`initial-chats-${sessionId}`, { chats: initialChats });
                        console.log(`[${sessionId}] Emitted initial chat list with ${initialChats.length} chats (no sync).`);
                    } catch (e) {
                        console.error(`[${sessionId}] Error loading or emitting initial chat list:`, e);
                    }
                }

                // La carga de contactos a través de sock.getContacts() o customStore se reemplaza/complementa
                // con getOrInsertContact en messages.upsert y contacts.update
            }

            if (connection === 'close') {
                sessionInfo.isConnected = false;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                io.emit(`connection-${sessionId}`, { status: 'disconnected' });
                
                // Get phone number to deactivate session in DB
                const userPhoneNumber = await getUserPhoneNumber(sessionId); // Get phone number from current session object

                if (shouldReconnect) {
                    console.log(`[${sessionId}] Intentando reconectar...`);
                    sessions.delete(sessionId);
                    // If the session was logged out, we should also deactivate it in the DB
                    if (userPhoneNumber && lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
                        await deactivateUserSession(userPhoneNumber);
                    }
                    setTimeout(() => createSession(sessionId, true), 3000);
                } else {
                    console.log(`[${sessionId}] Usuario desconectado (logged out)`);
                    sessions.delete(sessionId);
                    // If logged out, deactivate the session in the DB
                    if (userPhoneNumber) {
                        await deactivateUserSession(userPhoneNumber);
                    }
                }
            }
        });

        // Manejar mensajes entrantes
        sock.ev.on('messages.upsert', async (m) => {
            // Procesar TODOS los tipos de mensajes: 'notify', 'append', 'prepend'
            // 'notify' = nuevos mensajes en tiempo real
            // 'append' = mensajes históricos al conectar
            // 'prepend' = mensajes más antiguos
            console.log(`[${sessionId}] Procesando ${m.messages.length} mensajes tipo: ${m.type}`);

            if (m.type === 'notify' || m.type === 'append' || m.type === 'prepend') {
                for (const msg of m.messages) {
                    const senderJid = msg.key.remoteJid; 
                    const participantJid = msg.key.participant; 
                    const messageId = msg.key.id;
                    let pushName = msg.pushName; // Puede ser el nombre del contacto o el asunto del grupo

                    // 1. Guardar/Actualizar Contacto/Grupo en la DB
                    if (senderJid) { // Solo proceder si senderJid está definido
                        const isGroup = senderJid.includes('@g.us');
                         // Para grupos, msg.pushName es el subject. Para contactos, es el pushName.
                        let contactNameForDb = isGroup ? null : pushName; 
                        let notifyNameForDb = pushName;

                        if(isGroup && msg.messageStubType) { // Si es un mensaje de sistema de grupo (ej. alguien se unió)
                           // El pushName podría no ser relevante o ser el nombre del grupo.
                           // A menudo no hay un 'nombre' real para estos, solo el JID del grupo.
                           contactNameForDb = null; // El nombre del grupo se obtiene de groupMetadata o chats.update
                           notifyNameForDb = null; // 
                        }
                        
                        await getOrInsertContact(senderJid, contactNameForDb, notifyNameForDb, isGroup);
                        
                        if (isGroup && participantJid) {
                            // msg.pushName aquí es el del remitente del mensaje, no el nombre del grupo.
                            // Si necesitamos el nombre del grupo, sería de un evento 'chats.update' o 'group-metadata'
                            await getOrInsertContact(participantJid, msg.pushName, msg.pushName, false); 
                        }
                    }
                    
                    // 2. Procesar y guardar mensaje en la DB
                    // Solo procesar mensajes con contenido visible o de sistema que queramos registrar
                    if (msg.message && messageId) { 
                        const messageType = Object.keys(msg.message)[0] || 'unknown';
                        let textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                        let mediaUrl = null; // Placeholder
                        let mediaMimeType = null;

                        if (messageType === 'imageMessage' && msg.message.imageMessage) {
                            textContent = msg.message.imageMessage.caption || '';
                            mediaMimeType = msg.message.imageMessage.mimetype;
                            // Ideal: download logic here, mediaUrl = local/S3 URL
                        } else if (messageType === 'videoMessage' && msg.message.videoMessage) {
                            textContent = msg.message.videoMessage.caption || '';
                            mediaMimeType = msg.message.videoMessage.mimetype;
                        } else if (messageType === 'audioMessage' && msg.message.audioMessage) {
                            textContent = ''; // Audio no suele tener text_content
                            mediaMimeType = msg.message.audioMessage.mimetype;
                        } else if (messageType === 'documentMessage' && msg.message.documentMessage) {
                            textContent = msg.message.documentMessage.title || msg.message.documentMessage.fileName || 'Document';
                            mediaMimeType = msg.message.documentMessage.mimetype;
                        } else if (messageType === 'protocolMessage' || messageType === 'senderKeyDistributionMessage' || messageType === 'deviceSentMessage') {
                            // Ignorar estos tipos de mensajes o manejarlos específicamente si es necesario
                            console.log(`[${sessionId}] Ignoring protocol/device message type: ${messageType}`);
                            continue; 
                        } else if (!textContent && !mediaMimeType && messageType !== 'reactionMessage') { // No guardar mensajes vacíos sin media, a menos que sea una reacción.
                             if(Object.keys(msg.message).length === 0) { // Mensaje realmente vacío
                                console.log(`[${sessionId}] Ignoring empty message (no content, no media) with ID ${messageId}`);
                                continue;
                             }
                        }


                        const ownJid = sessionInfo.sock?.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net';
                        const finalSenderJid = msg.key.fromMe ? ownJid : (participantJid || senderJid);
                        
                        const dbMessage = {
                            id: messageId,
                            chat_jid: senderJid, // El JID de la conversación
                            sender_jid: finalSenderJid, // El JID real del que envió
                            from_me: msg.key.fromMe,
                            message_type: messageType,
                            text_content: textContent,
                            media_url: mediaUrl, 
                            media_mime_type: mediaMimeType,
                            timestamp: msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date(),
                            status: msg.key.fromMe ? 'sent' : 'received' // Estado inicial
                        };

                        await saveMessageToDB(sessionId, dbMessage);
                        
                        // Emitir al cliente vía Socket.IO
                        if (!msg.key.fromMe) { // Solo emitir mensajes entrantes (salientes se emiten desde el endpoint)
                             const clientMessage = {
                                id: dbMessage.id,
                                from: dbMessage.sender_jid, 
                                message: dbMessage.text_content,
                                timestamp: dbMessage.timestamp.toISOString(),
                                type: dbMessage.message_type,
                                mediaUrl: dbMessage.media_url,
                                mediaMimeType: dbMessage.media_mime_type,
                                status: dbMessage.status,
                                chatJid: dbMessage.chat_jid // Importante para que el cliente sepa a qué chat pertenece
                            };
                            io.to(`session-${sessionId}`).emit('message', clientMessage); // Emitir a la sala de la sesión
                            console.log(`[${sessionId}] Nuevo mensaje de ${clientMessage.from} para ${clientMessage.chatJid} guardado y emitido: ${clientMessage.message}`);
                        }
                    } else {
                         console.log(`[${sessionId}] Ignoring message without content or ID:`, msg.key);
                    }
                }
            }
        });
        
        // Manejar actualizaciones de estado de mensajes
        sock.ev.on('messages.update', async (updates) => {
            console.log(`[${sessionId}] Processing ${updates.length} messages.update from Baileys`);
            for (const update of updates) {
                if (update.key && update.update?.status) {
                    const messageId = update.key.id;
                    const chatJid = update.key.remoteJid;
                    let newStatus;
                    // Traducir el estado de Baileys a nuestro estado de DB
                    switch(update.update.status) {
                        case DisconnectReason.connectionClosed: // Example, not a real status, adjust based on Baileys statuses
                        case 1: // PENDING (no enviado aún por el servidor de WA) - puede no ser un evento común aquí
                            newStatus = 'pending';
                            break;
                        case 2: // SERVER_ACK (enviado al servidor de WA)
                            newStatus = 'sent';
                            break;
                        case 3: // DELIVERY_ACK (entregado al destinatario)
                            newStatus = 'delivered';
                            break;
                        case 4: // READ_ACK (leído por el destinatario)
                            newStatus = 'read';
                            break;
                        case 5: // PLAYED_ACK (audio/video reproducido) - podríamos mapearlo a 'read'
                            newStatus = 'read'; // O un estado 'played' si se quiere diferenciar
                            break;
                        default:
                            console.log(`[${sessionId}] Unknown message status update: ${update.update.status} for ${messageId}`);
                            continue; // No actualizar si no conocemos el estado
                    }

                    const messageToUpdate = {
                        id: messageId,
                        chat_jid: chatJid, // Necesario para identificar la sesión si el ID no es globalmente único
                        from_me: update.key.fromMe, // from_me es importante para el contexto
                        timestamp: new Date(), // El timestamp del update, no del mensaje original
                        status: newStatus,
                        // No necesitamos todos los campos, solo los que usa saveMessageToDB para la condición ON DUPLICATE KEY UPDATE
                        // y los que usamos para identificar unívocamente (id, session_id - que se pasa a saveMessageToDB)
                        // session_id, sender_jid, message_type, text_content, etc. pueden ser undefined aquí.
                    };
                    
                    // Reutilizar saveMessageToDB con ON DUPLICATE KEY UPDATE status = VALUES(status)
                    // Necesitamos asegurar que saveMessageToDB tiene la logica de session_id
                    await saveMessageToDB(sessionId, messageToUpdate); 
                    console.log(`[${sessionId}] Message ${messageId} in chat ${chatJid} status updated to ${newStatus} in DB.`);

                    // Emitir actualización de estado al cliente
                    io.to(`session-${sessionId}`).emit('message-status-update', {
                        id: messageId,
                        chatJid: chatJid,
                        status: newStatus,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });

        // Capturar contactos cuando se actualicen
        sock.ev.on('contacts.update', async (contactsUpdate) => {
            console.log(`[${sessionId}] Processing ${contactsUpdate.length} contacts.update from Baileys`);
            for (const contact of contactsUpdate) {
                if (contact.id && (contact.id.includes('@s.whatsapp.net') || contact.id.includes('@g.us'))) {
                    await getOrInsertContact(contact.id, contact.name, contact.notify, contact.id.includes('@g.us'));
                }
            }
        });

        // Capturar chats/grupos cuando se actualicen
        sock.ev.on('chats.update', async (chatsUpdate) => {
            console.log(`[${sessionId}] Processing ${chatsUpdate.length} chats.update from Baileys`);
            for (const chat of chatsUpdate) {
                if (chat.id && (chat.id.includes('@s.whatsapp.net') || chat.id.includes('@g.us'))) {
                    await getOrInsertContact(chat.id, chat.name, null, chat.id.includes('@g.us'));
                    if (chat.id.includes('@g.us') && chat.participants) {
                        // Lógica para actualizar contact_group_members (más compleja, para después)
                        console.log(`[${sessionId}] Group ${chat.id} has participants, member update logic to be implemented.`);
                    }
                }
            }
        });

        // ⭐ EVENTO CRÍTICO: chats.set - Se dispara al conectar con TODOS los chats
        sock.ev.on('chats.set', async (chatsSet) => {
            console.log(`[${sessionId}] 🎯 chats.set recibido con ${chatsSet.chats?.length || 0} chats iniciales`);
            if (chatsSet.chats && Array.isArray(chatsSet.chats)) {
                for (const chat of chatsSet.chats) {
                    try {
                        if (chat.id) {
                            const isGroup = chat.id.includes('@g.us');
                            const chatName = chat.name || chat.subject || chat.id.split('@')[0];
                            await getOrInsertContact(chat.id, chatName, chatName, isGroup);
                            console.log(`[${sessionId}] Chat guardado desde chats.set: ${chatName} (${chat.id})`);
                        }
                    } catch (error) {
                        console.error(`[${sessionId}] Error guardando chat desde chats.set:`, error);
                    }
                }
            }
        });

        // ⭐ EVENTO CRÍTICO: contacts.set - Se dispara al conectar con TODOS los contactos
        sock.ev.on('contacts.set', async (contactsSet) => {
            console.log(`[${sessionId}] 🎯 contacts.set recibido con ${contactsSet.contacts?.length || 0} contactos iniciales`);
            if (contactsSet.contacts && Array.isArray(contactsSet.contacts)) {
                for (const contact of contactsSet.contacts) {
                    try {
                        if (contact.id && (contact.id.includes('@s.whatsapp.net') || contact.id.includes('@g.us'))) {
                            const isGroup = contact.id.includes('@g.us');
                            const contactName = contact.name || contact.notify || contact.id.split('@')[0];
                            await getOrInsertContact(contact.id, contactName, contact.notify, isGroup);
                            console.log(`[${sessionId}] Contacto guardado desde contacts.set: ${contactName} (${contact.id})`);
                        }
                    } catch (error) {
                        console.error(`[${sessionId}] Error guardando contacto desde contacts.set:`, error);
                    }
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
        sessions.set(sessionId, sessionInfo);
        return sessionInfo;
    } catch (error) {
        console.error(`[${sessionId}] Error creando sesión:`, error);
        // Asegurarse de limpiar la sesión si la creación falla a mitad de camino
        if (sessions.has(sessionId)) {
            const failedSession = sessions.get(sessionId);
            if (failedSession.sock) {
                // Intentar cerrar el socket si existe
                try { await failedSession.sock.ws.close(); } catch (e) { /* ignore */ }
            }
            sessions.delete(sessionId);
        }
        io.emit(`connection-${sessionId}`, { status: 'error', error: error.message });
        return null;
    }
};

// ============= ENDPOINTS REALES DE WHATSAPP =============

// Obtener código QR para conectar WhatsApp
app.get('/api/qr-status', async (req, res) => {
    const format = req.query.format || 'json';
    const sessionId = req.query.sessionId || crypto.randomBytes(8).toString('hex');
    
    console.log(`[${sessionId}] Solicitando QR (formato: ${format})`);
    
    // Verificar si ya hay sesión conectada
    const existingSession = sessions.get(sessionId);
    if (existingSession && existingSession.isConnected) {
        return res.json({
            success: true,
            sessionId,
            isConnected: true,
            message: 'WhatsApp ya está conectado'
        });
    }

    // Usar QR existente si es reciente
    if (lastQRSession && !lastQRSession.session.isConnected) {
        const timeSinceCreation = Date.now() - lastQRSession.createdAt;
        if (timeSinceCreation < QR_EXPIRY_TIME) {
            const sessionInfo = lastQRSession.session;
            try {
                if (sessionInfo.qr) {
                    const qrDataUrl = await QRCode.toDataURL(sessionInfo.qr, {
                        width: 300,
                        margin: 1,
                        errorCorrectionLevel: 'H'
                    });
                    return res.json({
                        success: true,
                        sessionId,
                        qrDataUrl,
                        isConnected: sessionInfo.isConnected,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error('Error generando QR:', error);
            }
        }
    }

    // Crear nueva sesión
    const sessionInfo = await createSession(sessionId, true);
    if (!sessionInfo) {
        return res.status(500).json({
            success: false,
            error: 'Error creando sesión de WhatsApp'
        });
    }

    // Esperar a que se genere el QR
    let attempts = 0;
    while (!sessionInfo.qr && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
    }

    if (sessionInfo.qr) {
        try {
            const qrDataUrl = await QRCode.toDataURL(sessionInfo.qr, {
                width: 300,
                margin: 1,
                errorCorrectionLevel: 'H'
            });
            res.json({
                success: true,
                sessionId,
                qrDataUrl,
                isConnected: sessionInfo.isConnected,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                error: 'Error generando código QR' 
            });
        }
    } else {
        res.status(404).json({ 
            success: false, 
            error: 'No se pudo generar el código QR' 
        });
    }
});

// Verificar estado de conexión de una sesión
app.get('/api/session/:sessionId/status', async (req, res) => {
    const { sessionId } = req.params;

    // 1. Try to get the phone number associated with the provided sessionId
    let phoneNumber = await getUserPhoneNumber(sessionId); // This checks memory first

    // If not found in memory, try to get it from the DB
    if (!phoneNumber && pool) {
        const connection = await pool.getConnection();
        try {
            // Query user_sessions to find the phone number associated with the provided sessionId,
            // prioritizing active sessions.
            const [userRows] = await connection.execute(
                'SELECT phone_number FROM user_sessions WHERE session_id = ? AND is_active = TRUE ORDER BY last_activity DESC LIMIT 1',
                [sessionId]
            );
            if (userRows.length > 0) {
                phoneNumber = userRows[0].phone_number;
            }
        } catch (error) {
            console.error('[SESSION-STATUS] Error consulting user_sessions for phone number:', error);
        } finally {
            connection.release();
        }
    }

    // If we have a phone number, find the currently active session in memory for that phone number
    if (phoneNumber) {
        let activeSession = null;
        let activeSessionId = null;
        // Iterate through all active sessions in memory to find the one matching the phone number
        for (const [sId, sessionData] of sessions.entries()) {
            const currentPhoneNumber = await getUserPhoneNumber(sId); // Get phone number for this session
            if (currentPhoneNumber === phoneNumber) {
                activeSession = sessionData;
                activeSessionId = sId;
                break;
            }
        }

        if (activeSession && activeSession.isConnected) {
            // Found an active session in memory for this phone number
            return res.json({
                success: true,
                isConnected: true,
                phoneNumber: phoneNumber,
                message: 'Sesión conectada',
                sessionId: activeSessionId // Return the actual active sessionId
            });
        } else {
            // Session exists in DB but not active in memory, or not connected
            return res.json({
                success: true,
                isConnected: false,
                phoneNumber: phoneNumber,
                message: 'Sesión no activa o desconectada',
                sessionId: sessionId // Return the requested sessionId
            });
        }
    } else {
        // No phone number found for the given sessionId, or session is not active in memory
        return res.json({
            success: true,
            isConnected: false,
            message: 'Sesión no encontrada o no activa'
        });
    }
});

// Crear nueva sesión de WhatsApp
app.post('/api/create-session', async (req, res) => {
    const sessionId = req.body.sessionId || crypto.randomBytes(8).toString('hex');

    console.log(`[SESSION] 🔄 Creando nueva sesión por petición explícita: ${sessionId}`);

    try {
        const sessionInfo = await createSession(sessionId, true);

        if (!sessionInfo) {
            return res.status(500).json({
                success: false,
                error: 'Error creando sesión de WhatsApp'
            });
        }

        res.json({
            success: true,
            sessionId,
            message: 'Sesión creada exitosamente',
            isConnected: sessionInfo.isConnected
        });
    } catch (error) {
        console.error(`[SESSION] ❌ Error creando sesión ${sessionId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al crear sesión',
            details: error.message
        });
    }
});

// Enviar mensaje de texto
app.post('/api/send/message', async (req, res) => {
    const { sessionId, number, message } = req.body;
    
    if (!sessionId || !number || !message) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros: sessionId, number, message' });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada, socket no disponible o WhatsApp no conectado' });
    }

    try {
        const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        await getOrInsertContact(jid, null, null, jid.includes('@g.us')); // Ensure contact exists

        const sentResult = await session.sock.sendMessage(jid, { text: message });
        const ownJid = session.sock?.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net';
        
        const dbMessage = {
            id: sentResult.key.id,
            chat_jid: jid,
            sender_jid: ownJid, // Our own JID
            from_me: true,
            message_type: 'text',
            text_content: message,
            timestamp: new Date(Number(sentResult.messageTimestamp) * 1000 || Date.now()),
            status: 'pending' // Inicialmente pending, 'messages.update' lo cambiará a sent/delivered/read
        };
        await saveMessageToDB(sessionId, dbMessage);
        
        const clientMessage = {
            id: dbMessage.id,
            from: 'me',
            to: jid,
            message: dbMessage.text_content,
            timestamp: dbMessage.timestamp.toISOString(),
            type: dbMessage.message_type,
            status: dbMessage.status
        };
        io.to(`session-${sessionId}`).emit('message', clientMessage);
        
        console.log(`[${sessionId}] Mensaje enviado a ${jid} y guardado en DB (pending): ${message}`);
        res.json({ success: true, messageId: sentResult.key.id, message: 'Mensaje enviado correctamente' });

    } catch (error) {
        console.error(`[${sessionId}] Error enviando mensaje de texto:`, error);
        res.status(500).json({ success: false, error: 'Error al enviar mensaje', details: error.message });
    }
});

// Enviar imagen
app.post('/api/send/image', async (req, res) => {
    const { sessionId, number, caption, url } = req.body;
    
    if (!sessionId || !number || !url) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros: sessionId, number, url'});
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada, socket no disponible o WhatsApp no conectado' });
    }

    try {
        const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        await getOrInsertContact(jid, null, null, jid.includes('@g.us'));
        
        const sentResult = await session.sock.sendMessage(jid, {
            image: { url: url },
            caption: caption || ''
        });
        const ownJid = session.sock?.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net';

        const dbMessage = {
            id: sentResult.key.id,
            chat_jid: jid,
            sender_jid: ownJid,
            from_me: true,
            message_type: 'image',
            text_content: caption || '',
            media_url: url, 
            media_mime_type: req.body.mimetype || 'image/jpeg', // Tratar de obtener mimetype si se envía
            timestamp: new Date(Number(sentResult.messageTimestamp) * 1000 || Date.now()),
            status: 'pending'
        };
        await saveMessageToDB(sessionId, dbMessage);
        
        const clientMessage = {
            id: dbMessage.id,
            from: 'me',
            to: jid,
            message: dbMessage.text_content,
            mediaUrl: dbMessage.media_url,
            mediaMimeType: dbMessage.media_mime_type,
            timestamp: dbMessage.timestamp.toISOString(),
            type: dbMessage.message_type,
            status: dbMessage.status
        };
        io.to(`session-${sessionId}`).emit('message', clientMessage);
        
        console.log(`[${sessionId}] Imagen enviada a ${jid} y guardada en DB (pending)`);
        res.json({ success: true, messageId: sentResult.key.id, message: 'Imagen enviada correctamente' });

    } catch (error) {
        console.error(`[${sessionId}] Error enviando imagen:`, error);
        res.status(500).json({ success: false, error: 'Error al enviar imagen', details: error.message });
    }
});

// Obtener mensajes
app.get('/api/messages/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { number, startDate, endDate, limit = 50, offset = 0 } = req.query;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'DB service unavailable' });
    }

    // Obtener user_session_id primero
    const userSessionId = await getUserSessionId(sessionId);
    if (!userSessionId) {
        return res.status(400).json({
            success: false,
            error: 'No se pudo obtener user_session_id para esta sesión'
        });
    }

    const connection = await pool.getConnection();
    try {
        // Modificar query para filtrar por user_session_id en lugar de session_id
        let query = 'SELECT id, session_id, user_session_id, chat_jid, sender_jid, from_me, message_type, text_content, media_url, media_mime_type, timestamp, status FROM messages WHERE user_session_id = ?';
        const queryParams = [userSessionId]; // Usar userSessionId en lugar de sessionId

        if (number) {
            const chatJid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
            query += ' AND chat_jid = ?';
            queryParams.push(chatJid);
        }

        if (startDate) {
            query += ' AND timestamp >= ?';
            queryParams.push(new Date(startDate).toISOString().slice(0, 19).replace('T', ' '));
        }
        if (endDate) {
            query += ' AND timestamp <= ?';
            queryParams.push(new Date(endDate).toISOString().slice(0, 19).replace('T', ' '));
        }

        query += ' ORDER BY timestamp DESC';

        const countQuery = query.replace('SELECT id, session_id, user_session_id, chat_jid, sender_jid, from_me, message_type, text_content, media_url, media_mime_type, timestamp, status', 'SELECT COUNT(*) as total');
        const [totalRows] = await connection.execute(countQuery, queryParams);
        const totalMessages = totalRows[0].total;

        query += ' LIMIT ? OFFSET ?';
        queryParams.push(parseInt(limit, 10));
        queryParams.push(parseInt(offset, 10));

        const [messagesFromDB] = await connection.execute(query, queryParams);

        const clientMessages = messagesFromDB.map(msg => ({
            id: msg.id,
            from: msg.from_me ? 'me' : msg.sender_jid,
            to: msg.from_me ? msg.chat_jid : undefined,
            message: msg.text_content,
            mediaUrl: msg.media_url,
            mediaMimeType: msg.media_mime_type,
            timestamp: new Date(msg.timestamp).toISOString(),
            type: msg.message_type,
            status: msg.status
        }));

    res.json({
        success: true,
            messages: clientMessages.reverse(),
            totalMessages,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10)
        });

    } catch (error) {
        console.error(`[API-MSG] Error fetching messages for session ${sessionId}:`, error);
        res.status(500).json({ success: false, error: 'Failed to retrieve messages from database' });
    } finally {
        if (connection) connection.release();
    }
});

// Endpoint para forzar sincronización manual del historial
app.post('/api/force-sync/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    console.log(`[API-SYNC] 🔄 Solicitud de sincronización forzada para sessionId: ${sessionId}`);

    try {
        // Verificar que la sesión existe y está conectada
        const session = sessions.get(sessionId);
        if (!session || !session.sock || !session.isConnected) {
            return res.status(400).json({
                success: false,
                error: 'Sesión no encontrada, socket no disponible o WhatsApp no conectado'
            });
        }

        // Obtener user_session_id
        const userSessionId = await getUserSessionId(sessionId);
        if (!userSessionId) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener user_session_id. Asegúrate de que la sesión esté registrada.'
            });
        }

        console.log(`[API-SYNC] Iniciando sincronización para user_session_id: ${userSessionId}`);

        // Ejecutar sincronización
        const stats = await syncHistoricalData(sessionId, session.sock, userSessionId);

        // Cargar chats actualizados
        const chats = await loadChatListFromDB(sessionId);

        res.json({
            success: true,
            message: 'Sincronización completada exitosamente',
            stats,
            chatsCount: chats.length
        });

    } catch (error) {
        console.error(`[API-SYNC] ❌ Error en sincronización forzada:`, error);
        res.status(500).json({
            success: false,
            error: 'Error durante la sincronización',
            details: error.message
        });
    }
});

// Obtener chats/contactos
app.get('/api/chats/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session || !session.isConnected) {
        return res.json({
            success: false,
            error: 'Sesión no encontrada o no conectada aún. Esperando conexión de WhatsApp...',
            chats: []
        });
    }

    try {
        console.log(`[API][${sessionId}] Solicitud para cargar lista de chats.`);
        const chats = await loadChatListFromDB(sessionId);
        console.log(`[API][${sessionId}] Devolviendo ${chats.length} chats.`);
        res.json({
            success: true,
            sessionId,
            chats
        });
    } catch (error) {
        console.error(`[API][${sessionId}] Error cargando chats:`, error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al cargar chats.',
            chats: []
        });
    }
});

// Obtener mensajes de un chat específico
app.get('/api/messages', async (req, res) => {
    const { contactId } = req.query;
    console.log('Solicitud de mensajes para contactId:', contactId);
    
    if (!contactId) {
        return res.status(400).json({
            success: false,
            error: 'El parámetro contactId es requerido'
        });
    }

    if (!pool) {
        console.error('Pool de conexiones no disponible');
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible.'
        });
    }

    const connection = await pool.getConnection();
    try {
        // Verificar si la tabla existe
        const [tables] = await connection.execute(
            `SHOW TABLES LIKE 'messages'`
        );
        
        if (tables.length === 0) {
            console.error('La tabla messages no existe');
            return res.status(500).json({
                success: false,
                error: 'La tabla de mensajes no está configurada'
            });
        }

        console.log('Ejecutando query para obtener mensajes');
        const [messages] = await connection.execute(
            `SELECT
                id as messageId,
                chat_jid as contactId,
                sender_jid,
                from_me as isFromMe,
                message_type as type,
                text_content as text,
                media_url,
                media_mime_type,
                timestamp,
                status
            FROM messages
            WHERE chat_jid = ?
            ORDER BY timestamp ASC`,
            [contactId]
        );

        console.log(`Encontrados ${messages.length} mensajes para ${contactId}`);
        res.json({
            success: true,
            data: messages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp).toISOString()
            })),
            debug: {
                tableExists: true,
                messageCount: messages.length
            }
        });
    } catch (error) {
        console.error('Error obteniendo mensajes:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al obtener mensajes'
        });
    } finally {
        if (connection) connection.release();
    }
});

// Obtener historial de mensajes (con paginación)
app.get('/api/history/messages', async (req, res) => {
    const { limit = 100, offset = 0, sessionId, chatJid, startDate, endDate, direction, status: filterStatus } = req.query;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible.' });
    }
    
    // Obtener el número de teléfono del usuario de la sesión
    let userPhoneNumber = null;
    if (sessionId) {
        userPhoneNumber = await getUserPhoneNumber(sessionId);
        if (!userPhoneNumber) {
            // Si no se puede obtener de la sesión activa, buscar en la base de datos
            const connection = await pool.getConnection();
            try {
                const [userRows] = await connection.execute(
                    'SELECT phone_number FROM user_sessions WHERE session_id = ? ORDER BY last_activity DESC LIMIT 1',
                    [sessionId]
                );
                if (userRows.length > 0) {
                    userPhoneNumber = userRows[0].phone_number;
                }
            } catch (error) {
                console.error(`[API-HISTORY] Error getting user phone number:`, error);
            } finally {
                connection.release();
            }
        }
    }
    
    const connection = await pool.getConnection();
    try {
        let query = 'SELECT m.id, m.session_id, m.chat_jid, c.name as chat_name, m.sender_jid, s.name as sender_name, m.from_me, m.message_type, m.text_content, m.media_url, m.media_mime_type, m.timestamp, m.status FROM messages m LEFT JOIN contacts c ON m.chat_jid = c.jid LEFT JOIN contacts s ON m.sender_jid = s.jid WHERE 1=1';
        const queryParams = [];

        if (sessionId) {
            query += ' AND m.session_id = ?';
            queryParams.push(sessionId);
        }
        if (chatJid) {
            const fullChatJid = chatJid.includes('@') ? chatJid : `${chatJid}@s.whatsapp.net`;
            query += ' AND m.chat_jid = ?';
            queryParams.push(fullChatJid);
        }
        if (startDate) {
            query += ' AND m.timestamp >= ?';
            queryParams.push(new Date(startDate).toISOString().slice(0, 19).replace('T', ' '));
        }
        if (endDate) {
            query += ' AND m.timestamp <= ?';
            queryParams.push(new Date(endDate).toISOString().slice(0, 19).replace('T', ' '));
        }
        if (direction === 'sent') {
            query += ' AND m.from_me = TRUE';
        } else if (direction === 'received') {
            query += ' AND m.from_me = FALSE';
        }

        if (filterStatus && filterStatus !== 'all') {
            query += ' AND m.status = ?';
            queryParams.push(filterStatus);
        }

        query += ' ORDER BY m.timestamp DESC';
        
        const countQuery = query.replace('SELECT m.id, m.session_id, m.chat_jid, c.name as chat_name, m.sender_jid, s.name as sender_name, m.from_me, m.message_type, m.text_content, m.media_url, m.media_mime_type, m.timestamp, m.status', 'SELECT COUNT(*) as total');
        const [totalRows] = await connection.execute(countQuery, queryParams);
        const totalMessages = totalRows[0].total;

        query += ' LIMIT ? OFFSET ?';
        queryParams.push(parseInt(limit, 10));
        queryParams.push(parseInt(offset, 10));
        
        const [messagesFromDB] = await connection.execute(query, queryParams);

        const historyMessages = messagesFromDB.map(msg => ({
            id: msg.id,
            sessionId: userPhoneNumber || msg.session_id, // Mostrar número de teléfono en lugar del ID técnico
            chatJid: msg.chat_jid,
            chatName: msg.chat_name || msg.chat_jid.split('@')[0],
            senderJid: msg.sender_jid,
            senderName: msg.sender_name || (msg.from_me ? 'Yo' : msg.sender_jid?.split('@')[0]),
            fromMe: !!msg.from_me,
            message: msg.text_content,
            mediaUrl: msg.media_url,
            mediaMimeType: msg.media_mime_type,
            timestamp: new Date(msg.timestamp).toISOString(),
            type: msg.message_type,
            status: msg.status
        }));
        
        res.json({
            success: true,
            messages: historyMessages, // Ya están en orden descendente por la query
            totalMessages,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
            userPhoneNumber: userPhoneNumber // Agregar el número de teléfono del usuario para referencia
        });

    } catch (error) {
        console.error(`[API-HISTORY] Error fetching history messages:`, error);
        res.status(500).json({ success: false, error: 'Error al obtener historial de mensajes.' });
    } finally {
        if (connection) connection.release();
    }
});

// Dashboard stats endpoint
app.get('/api/dashboard/stats/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        // Obtener userSessionId PRIMERO - crítico para filtrar correctamente
        const userSessionId = await getUserSessionId(sessionId);

        if (!userSessionId) {
            return res.json({
                success: false,
                error: 'No se pudo obtener user_session_id para esta sesión'
            });
        }

        console.log(`[API-DASHBOARD] Obteniendo estadísticas para user_session_id: ${userSessionId}`);

        if (!pool && !memoryStorage.isMemoryMode) {
            return res.json({
                success: false,
                error: 'Base de datos no disponible'
            });
        }

        let stats = {
            mensajesHoy: 0,
            mensajesEnviados: 0,
            mensajesRecibidos: 0,
            chatsActivos: 0,
            campanasActivas: 0,
            campanasTotales: 0,
            campanasPendientes: 0,
            mensajesVistos: 0,
            mensajesPendientes: 0,
            contactosTotales: 0,
            gruposTotales: 0
        };

        // Modo memoria
        if (memoryStorage.isMemoryMode || !pool) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const [key, msg] of memoryStorage.messages) {
                if (msg.session_id === sessionId) {
                    const msgDate = new Date(msg.timestamp);
                    if (msgDate >= today) {
                        stats.mensajesHoy++;
                        if (msg.from_me) stats.mensajesEnviados++;
                        else stats.mensajesRecibidos++;
                    }
                    if (msg.status === 'read') stats.mensajesVistos++;
                    if (msg.status === 'pending') stats.mensajesPendientes++;
                }
            }

            for (const [jid, contact] of memoryStorage.contacts) {
                if (contact.is_group) stats.gruposTotales++;
                else stats.contactosTotales++;
            }
        } else {
            // Modo base de datos - TODAS las queries con user_session_id
            const connection = await pool.getConnection();
            try {
                // Mensajes de hoy - FILTRADO POR user_session_id
                const [mensajesHoy] = await connection.execute(
                    `SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN from_me = TRUE THEN 1 ELSE 0 END) as enviados,
                        SUM(CASE WHEN from_me = FALSE THEN 1 ELSE 0 END) as recibidos
                    FROM messages
                    WHERE user_session_id = ?
                    AND DATE(timestamp) = CURDATE()`,
                    [userSessionId]
                );

                stats.mensajesHoy = mensajesHoy[0].total || 0;
                stats.mensajesEnviados = mensajesHoy[0].enviados || 0;
                stats.mensajesRecibidos = mensajesHoy[0].recibidos || 0;

                // Chats activos (últimos 7 días) - FILTRADO POR user_session_id
                const [chatsActivos] = await connection.execute(
                    `SELECT COUNT(DISTINCT chat_jid) as total
                    FROM messages
                    WHERE user_session_id = ?
                    AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
                    [userSessionId]
                );
                stats.chatsActivos = chatsActivos[0].total || 0;

                // Campañas - NO filtrar por usuario (son globales de momento)
                const [campanas] = await connection.execute(
                    `SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activas,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendientes
                    FROM campaigns`
                );
                stats.campanasTotales = campanas[0].total || 0;
                stats.campanasActivas = campanas[0].activas || 0;
                stats.campanasPendientes = campanas[0].pendientes || 0;

                // Estados de mensajes - FILTRADO POR user_session_id
                const [estados] = await connection.execute(
                    `SELECT
                        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as vistos,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendientes
                    FROM messages
                    WHERE user_session_id = ?`,
                    [userSessionId]
                );
                stats.mensajesVistos = estados[0].vistos || 0;
                stats.mensajesPendientes = estados[0].pendientes || 0;

                // Contactos y grupos - contar solo los que tienen mensajes del usuario
                // Esto asegura que solo contemos contactos relevantes para este usuario
                const [contactos] = await connection.execute(
                    `SELECT
                        COUNT(DISTINCT c.jid) as total,
                        SUM(CASE WHEN c.is_group = TRUE THEN 1 ELSE 0 END) as grupos,
                        SUM(CASE WHEN c.is_group = FALSE THEN 1 ELSE 0 END) as contactos
                    FROM contacts c
                    INNER JOIN messages m ON c.jid = m.chat_jid
                    WHERE m.user_session_id = ?`,
                    [userSessionId]
                );
                stats.gruposTotales = contactos[0].grupos || 0;
                stats.contactosTotales = contactos[0].contactos || 0;

                console.log(`[API-DASHBOARD] Estadísticas calculadas para user_session_id ${userSessionId}:`, stats);

            } finally {
                connection.release();
            }
        }

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error(`[API-DASHBOARD] Error obteniendo estadísticas para ${sessionId}:`, error);
        res.json({
            success: false,
            error: 'Error al obtener estadísticas',
            details: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'WhatsApp API funcionando',
        timestamp: new Date().toISOString(),
        activeSessions: sessions.size
    });
});

// Socket.IO para comunicación en tiempo real
io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    const sessionId = socket.handshake.query.sessionId;
    
    if (sessionId) {
        socket.join(`session-${sessionId}`);
        console.log(`Cliente ${socket.id} se unió a la sala session-${sessionId}`);
    } else {
        console.warn(`Cliente ${socket.id} conectado sin sessionId en query.`);
    }
    
    socket.on('join-session', (sid) => {
        if(sid){
             socket.join(`session-${sid}`);
             console.log(`Cliente ${socket.id} (re)unido explícitamente a sesión ${sid}`);
        }
    });
    
    socket.on('leave-session', (sessionId) => {
        socket.leave(`session-${sessionId}`);
        console.log(`Cliente ${socket.id} abandonó sesión ${sessionId}`);
    });
    
    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// Función de limpieza al cerrar
const cleanup = async () => {
    console.log('\nCerrando servidor...');
    
    for (const [sessionId, session] of sessions.entries()) {
        try {
            if (session.sock && session.isConnected) {
                await session.sock.logout();
                console.log(`Sesión ${sessionId} cerrada`);
            }
        } catch (err) {
            console.error(`Error cerrando sesión ${sessionId}:`, err.message);
        }
    }
    
    if (server) {
        server.close(() => {
            console.log('Servidor cerrado');
            process.exit(0);
        });
    }
};

// Manejadores de señales
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', async (err) => {
    console.error('Error no capturado:', err);
    await cleanup();
});

// Iniciar servidor
const PORT = process.env.PORT || 3002;
server.listen(PORT, async () => {
    console.log(`\n🚀 WhatsApp Web API iniciado en puerto ${PORT}`);
    console.log(`📱 Endpoints disponibles:`);
    console.log(`   GET  /api/qr-status - Obtener código QR`);
    console.log(`   POST /api/send/message - Enviar mensaje`);
    console.log(`   POST /api/send/image - Enviar imagen`);
    console.log(`   GET  /api/messages/:sessionId - Obtener mensajes`);
    console.log(`   GET  /api/chats/:sessionId - Obtener chats`);
    console.log(`   GET  /api/health - Estado del servidor`);
    console.log(`   GET  /api/history/messages - Obtener historial de mensajes`);
    console.log(`\n✅ Servidor listo para recibir conexiones`);
    await initializeDatabase();
});
