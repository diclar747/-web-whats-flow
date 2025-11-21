const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const moment = require('moment');

// Importar middleware de autenticación
const { authenticateToken, authorizeRole } = require('./middleware/auth');
const { validateUniqueSession, createUniqueSession, destroySession } = require('./middleware/sessionValidator');
const { generalLimiter, authLimiter, apiMessageLimiter, webhookLimiter, qrLimiter } = require('./middleware/rateLimiter');

// Importar sistema de logging para debug de sesiones (desactivado temporalmente)
// const sessionLogger = require('./sessionLogger');

// Logger dummy para evitar errores
const sessionLogger = {
    log: (sessionId, eventType, data) => {
        console.log(`[SESSION-LOG] ${eventType}:`, { sessionId, ...data });
    },
    getSessionLogs: () => [],
    getSummary: () => ({ totalEvents: 0, eventCounts: {} }),
    generateHTML: () => '<html><body><h1>Logging desactivado temporalmente</h1></body></html>',
    logs: new Map()
};


// Función para generar delay aleatorio entre min y max segundos
function getRandomDelay(minSeconds = 60, maxSeconds = 120) {
    const randomSeconds = Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
    console.log(`⏱️  Delay aleatorio: ${randomSeconds} segundos`);
    return randomSeconds * 1000; // Convertir a milisegundos
}

const app = express();
const server = createServer(app);

// Aumentar límites del servidor HTTP
server.maxConnections = 5000;
server.timeout = 120000; // 2 minutos
server.keepAliveTimeout = 65000; // 65 segundos
server.headersTimeout = 66000; // 66 segundos

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://web.whats-flow.com',
      'http://web.whats-flow.com'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,        // 60 segundos antes de considerar desconectado
  pingInterval: 25000,       // Enviar ping cada 25 segundos
  upgradeTimeout: 30000,     // 30 segundos para upgrade de transporte
  maxHttpBufferSize: 1e8,    // 100 MB para archivos grandes
  transports: ['websocket', 'polling'],  // Permitir ambos transportes
  allowEIO3: true,           // Compatibilidad con clientes antiguos
  perMessageDeflate: false,  // Desactivar compresión para mejor performance
  httpCompression: false,    // Desactivar compresión HTTP
  connectTimeout: 45000,     // Timeout de conexión inicial
  path: '/socket.io/',       // Path explícito
  serveClient: false,        // No servir el cliente de Socket.IO
  // Configuración adicional para estabilidad
  allowUpgrades: true,       // Permitir upgrade de transporte
  cookie: false,             // No usar cookies para sesión
  destroyUpgrade: true,      // Destruir upgrade si falla
  destroyUpgradeTimeout: 1000 // Timeout para destruir upgrade
});

// Monitoring de conexiones activas
let activeConnections = 0;
setInterval(() => {
  const connectedSockets = io.sockets.sockets.size;
  if (connectedSockets !== activeConnections) {
    console.log(`[SOCKET.IO-MONITOR] 📊 Conexiones activas: ${connectedSockets}`);
    activeConnections = connectedSockets;
  }
}, 30000); // Cada 30 segundos

// Configuración de multer para uploads
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
        fieldSize: 100 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        // Tipos de archivo permitidos expandidos
        const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|svg|mp4|mov|avi|mkv|flv|wmv|webm|mp3|wav|ogg|m4a|aac|flac|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        
        // Lista de mimetypes permitidos (más completa)
        const allowedMimetypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml',
            'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/x-flv', 'video/x-ms-wmv', 'video/webm',
            'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/x-m4a',
            'application/pdf',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'application/zip', 'application/x-rar-compressed'
        ];
        
        const mimetypeAllowed = allowedMimetypes.includes(file.mimetype);

        if (mimetypeAllowed || extname) {
            return cb(null, true);
        } else {
            console.log(`[UPLOAD] Archivo rechazado: ${file.originalname} (${file.mimetype})`);
            cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
        }
    }
});

// Configuración de CORS optimizada
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? ['https://web.whats-flow.com', 'http://web.whats-flow.com']
        : ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    credentials: true,
    maxAge: 3600
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.options('*', cors(corsOptions));

// 🔓 Rate limiter DESACTIVADO para desarrollo (estaba bloqueando demasiado)
// app.use(generalLimiter);

// Health check endpoint (sin rate limit)
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.json({
        status: 'ok',
        uptime: Math.floor(uptime),
        timestamp: new Date().toISOString(),
        memory: {
            rss: Math.floor(memoryUsage.rss / 1024 / 1024) + ' MB',
            heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
            heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024) + ' MB'
        },
        database: pool ? 'connected' : 'disconnected',
        sessions: sessions.size,
        version: '1.0.0'
    });
});

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

// Mapa para almacenar preferencias de sincronización por sesión
const sessionSyncPreferences = new Map();

// Mapa para vincular sesiones con deviceId (seguridad)
const sessionDeviceMap = new Map();

// Caché de sesiones inexistentes para evitar reintentos infinitos
const nonExistentSessions = new Map(); // sessionId -> timestamp
const NON_EXISTENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Limpiar caché de sesiones inexistentes periódicamente
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, timestamp] of nonExistentSessions.entries()) {
        if (now - timestamp > NON_EXISTENT_CACHE_TTL) {
            nonExistentSessions.delete(sessionId);
        }
    }
}, 60000); // Limpiar cada minuto

// Sistema de caché para Kanban
const kanbanCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos

// JWT Secret para autenticación de admin - DEBE estar en .env
if (!process.env.JWT_SECRET) {
    console.error('❌ ERROR CRÍTICO: JWT_SECRET no está definido en .env');
    console.error('   Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// Almacenamiento en memoria (cuando no hay DB)
const memoryStorage = {
    contacts: new Map(),
    messages: new Map(),
    userSessions: new Map(),
    isMemoryMode: false
};

// Crear directorio para autenticación si no existe (path absoluto)
const BASE_AUTH_DIR = path.join(__dirname, '../../auth_info_multi');
if (!fs.existsSync(BASE_AUTH_DIR)) {
    fs.mkdirSync(BASE_AUTH_DIR, { recursive: true });
}
console.log(`[AUTH] Directorio de autenticación: ${BASE_AUTH_DIR}`);

// MySQL Connection Pool - Configuración optimizada para alta concurrencia
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'whatsflow',
    waitForConnections: true,
    connectionLimit: 50,        // Más conexiones simultáneas
    queueLimit: 500,            // Mayor cola para evitar "Queue limit reached"
    enableKeepAlive: true,      // Habilitar keep-alive
    keepAliveInitialDelay: 0,   // Delay inicial para keep-alive
    idleTimeout: 60000,         // Timeout de conexiones idle (60 segundos)
    decimalNumbers: true        // Tratar decimales como números
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
        
        // Configurar zona horaria de Paraguay para todas las conexiones
        pool.on('connection', (connection) => {
            connection.query("SET time_zone = '-03:00'", (error) => {
                if (error) {
                    console.error('[DB-INIT] Error setting timezone:', error);
                } else {
                    console.log('[DB-INIT] ✅ Timezone set to America/Asuncion (-03:00) for new connection');
                }
            });
        });
        
        // Hacer el pool disponible para las rutas
        app.set('dbPool', pool);
        global.dbPool = pool; // También global para fácil acceso
        console.log('[DB-INIT] Pool made available to routes');
        
        const connection = await pool.getConnection();
        console.log('[DB-INIT] Successfully got a connection from pool.');
        connection.release();
        console.log('[DB-INIT] Connection from pool released. Calling createTables().');
        await createTables();
        console.log('[DB-INIT] createTables() finished.');
        console.log('[DB-INIT] Running migrations...');
        await migrateTables();
        console.log('[DB-INIT] Migrations finished.');
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

        // Tabla para SOLO contactos individuales (@s.whatsapp.net)
        await connection.query(
            'CREATE TABLE IF NOT EXISTS contacts ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'jid VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255),'
            + 'notify_name VARCHAR(255),'
            + 'session_id VARCHAR(255),'
            + 'avatar_url VARCHAR(1024),'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'UNIQUE KEY unique_contact_per_session (jid, session_id),'
            + 'INDEX idx_session_id (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'contacts\' ensured (ONLY individual contacts).');

        // NOTA: Los grupos ahora se guardan en la tabla 'contact_groups' (existente)
        // NOTA: Los miembros de grupos se guardan en 'contact_group_members' (existente)
        // Las siguientes tablas ya NO se usan:
        /*
        // Tabla para grupos de WhatsApp (@g.us) - YA NO SE USA
        await connection.query(
            'CREATE TABLE IF NOT EXISTS whatsapp_groups ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'jid VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255),'
            + 'subject VARCHAR(255),'
            + 'session_id VARCHAR(255),'
            + 'avatar_url VARCHAR(1024),'
            + 'owner_jid VARCHAR(255),'
            + 'description TEXT,'
            + 'participant_count INT DEFAULT 0,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'UNIQUE KEY unique_group_per_session (jid, session_id),'
            + 'INDEX idx_session_id (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'whatsapp_groups\' ensured.');

        // Tabla para miembros de grupos de WhatsApp - YA NO SE USA
        await connection.query(
            'CREATE TABLE IF NOT EXISTS whatsapp_group_members ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'group_id INT NOT NULL,'
            + 'contact_jid VARCHAR(255) NOT NULL,'
            + 'is_admin BOOLEAN DEFAULT FALSE,'
            + 'is_super_admin BOOLEAN DEFAULT FALSE,'
            + 'session_id VARCHAR(255),'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'FOREIGN KEY (group_id) REFERENCES whatsapp_groups(id) ON DELETE CASCADE,'
            + 'UNIQUE KEY unique_member_per_group (group_id, contact_jid),'
            + 'INDEX idx_contact_jid (contact_jid),'
            + 'INDEX idx_session_id (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'whatsapp_group_members\' ensured.');
        */

        // Tabla para broadcasts y status
        await connection.query(
            'CREATE TABLE IF NOT EXISTS broadcasts ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'jid VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255),'
            + 'session_id VARCHAR(255),'
            + 'broadcast_type VARCHAR(50),'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'UNIQUE KEY unique_broadcast_per_session (jid, session_id),'
            + 'INDEX idx_session_id (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'broadcasts\' ensured.');

        // Tabla unificada para grupos de WhatsApp (@g.us) y organización personalizada
        await connection.query(
            'CREATE TABLE IF NOT EXISTS contact_groups ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'jid VARCHAR(255),'
            + 'name VARCHAR(255) NOT NULL,'
            + 'session_id VARCHAR(255),'
            + 'description TEXT,'
            + 'participants_count INT DEFAULT 0,'
            + 'is_announcement BOOLEAN DEFAULT FALSE,'
            + 'is_restricted BOOLEAN DEFAULT FALSE,'
            + 'avatar_url VARCHAR(1024),'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'UNIQUE KEY unique_group_per_session (jid, session_id),'
            + 'INDEX idx_session_id (session_id),'
            + 'INDEX idx_name (name)'
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
            + 'is_read BOOLEAN DEFAULT FALSE, '
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'FOREIGN KEY (chat_jid) REFERENCES contacts(jid) ON DELETE CASCADE,'
            + 'INDEX idx_user_session_id (user_session_id),'
            + 'INDEX idx_session_id (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'messages\' ensured.');

        // Agregar columna is_read si no existe (para bases de datos existentes)
        try {
            await connection.query(
                'ALTER TABLE messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE'
            );
            console.log('[DB-TABLES] Columna \'is_read\' agregada a tabla messages.');
        } catch (error) {
            // Ignorar si la columna ya existe
            if (error.code !== 'ER_DUP_FIELDNAME') {
                console.log('[DB-TABLES] Columna \'is_read\' ya existe o error:', error.message);
            }
        }

        await connection.query(
            'CREATE TABLE IF NOT EXISTS campaigns ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
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

        // Tabla de tableros Kanban
        await connection.query(
            'CREATE TABLE IF NOT EXISTS kanban_boards ('
            + 'id VARCHAR(255) PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'color VARCHAR(20) DEFAULT \'#3b82f6\','
            + 'board_order INT DEFAULT 0,'
            + 'is_default BOOLEAN DEFAULT FALSE,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'INDEX idx_session_id (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'kanban_boards\' ensured.');

        // Tabla de contactos en tableros Kanban (sin FK a contacts primero)
        await connection.query(
            'CREATE TABLE IF NOT EXISTS kanban_contacts ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'board_id VARCHAR(255) NOT NULL,'
            + 'contact_jid VARCHAR(255) NOT NULL,'
            + 'notes TEXT,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE,'
            + 'INDEX idx_contact_jid (contact_jid),'
            + 'UNIQUE KEY unique_board_contact (board_id, contact_jid)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'kanban_contacts\' ensured.');

        // Intentar agregar FK a contacts si no existe (puede fallar si ya existe, lo ignoramos)
        try {
            await connection.query(
                'ALTER TABLE kanban_contacts ADD CONSTRAINT fk_kanban_contacts_jid '
                + 'FOREIGN KEY (contact_jid) REFERENCES contacts(jid) ON DELETE CASCADE'
            );
            console.log('[DB-TABLES] Foreign key kanban_contacts -> contacts added.');
        } catch (fkError) {
            // Ignorar si la FK ya existe
            if (fkError.code !== 'ER_DUP_KEYNAME' && fkError.code !== 'ER_FK_DUP_NAME') {
                console.log('[DB-TABLES] FK kanban_contacts -> contacts already exists or skipped:', fkError.code);
            }
        }

        // Tabla de asignaciones de chats a agentes
        await connection.query(
            'CREATE TABLE IF NOT EXISTS chat_assignments ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'chat_jid VARCHAR(255) NOT NULL,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'user_id INT,'  // ID del agente asignado
            + 'assigned_by INT,'  // ID del admin que asignó
            + 'status VARCHAR(50) DEFAULT \'pending\','  // pending, accepted, rejected, active, closed, transferred
            + 'assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'accepted_at TIMESTAMP NULL,'
            + 'closed_at TIMESTAMP NULL,'
            + 'notes TEXT,'
            + 'transfer_history JSON,'  // Historial de transferencias
            + 'INDEX idx_chat_jid (chat_jid),'
            + 'INDEX idx_session_id (session_id),'
            + 'INDEX idx_user_id (user_id),'
            + 'INDEX idx_status (status)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'chat_assignments\' ensured.');

        // Tabla de Citas/Agenda
        await connection.query(
            'CREATE TABLE IF NOT EXISTS appointments ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'patient_name VARCHAR(255) NOT NULL,'
            + 'patient_phone VARCHAR(20) NOT NULL,'
            + 'doctor_name VARCHAR(255),'
            + 'company_name VARCHAR(255),'
            + 'description TEXT,'
            + 'appointment_date DATE NOT NULL,'
            + 'appointment_time TIME NOT NULL,'
            + 'status ENUM(\'scheduled\', \'confirmed\', \'cancelled\', \'completed\') DEFAULT \'scheduled\','
            + 'notes TEXT,'
            + 'reminder_time INT DEFAULT 60 COMMENT \'Minutos antes del recordatorio\',' 
            + 'notification_template VARCHAR(255) DEFAULT \'default\' COMMENT \'ID de plantilla de notificación\','
            + 'category_id INT COMMENT \'ID de categoría de cita\','
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'INDEX idx_session (session_id),'
            + 'INDEX idx_date (appointment_date),'
            + 'INDEX idx_phone (patient_phone)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'appointments\' ensured.');
        
        // Agregar columnas nuevas si no existen
        try {
            await connection.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_time INT DEFAULT 60');
            await connection.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notification_template VARCHAR(255) DEFAULT \'default\'');
            await connection.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS category_id INT');
        } catch (err) {
            // Ignorar si las columnas ya existen
        }

        // Tabla de Plantillas de Mensajes para Citas
        await connection.query(
            'CREATE TABLE IF NOT EXISTS appointment_templates ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'message_text TEXT NOT NULL,'
            + 'variables JSON COMMENT \'["patient_name", "doctor_name", "company_name", "date", "time"]\','
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'INDEX idx_session (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'appointment_templates\' ensured.');

        // Tabla de Configuración de Recordatorios
        await connection.query(
            'CREATE TABLE IF NOT EXISTS appointment_reminder_config ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'time_before_hours INT NOT NULL COMMENT \'Horas antes: 1, 2, 4, 24\','
            + 'template_id INT,'
            + 'is_enabled BOOLEAN DEFAULT TRUE,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'FOREIGN KEY (template_id) REFERENCES appointment_templates(id) ON DELETE SET NULL,'
            + 'INDEX idx_session (session_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'appointment_reminder_config\' ensured.');

        // Tabla de Recordatorios Enviados
        await connection.query(
            'CREATE TABLE IF NOT EXISTS appointment_reminders_sent ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'appointment_id INT NOT NULL,'
            + 'sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'hours_before INT NOT NULL,'
            + 'message_text TEXT,'
            + 'status ENUM(\'sent\', \'delivered\', \'read\', \'failed\') DEFAULT \'sent\','
            + 'error_message TEXT,'
            + 'FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,'
            + 'INDEX idx_appointment (appointment_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'appointment_reminders_sent\' ensured.');

        // Tabla de Administradores
        await connection.query(
            'CREATE TABLE IF NOT EXISTS admin_users ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'email VARCHAR(255) UNIQUE NOT NULL,'
            + 'password VARCHAR(255) NOT NULL COMMENT \'Hashed password\','
            + 'name VARCHAR(255) NOT NULL,'
            + 'role ENUM(\'super_admin\', \'admin\', \'support\') DEFAULT \'admin\','
            + 'is_active BOOLEAN DEFAULT TRUE,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'last_login TIMESTAMP NULL,'
            + 'INDEX idx_email (email)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'admin_users\' ensured.');

        // Insertar admin por defecto si no existe
        // Password: Cadc++**1978
        await connection.query(
            'INSERT IGNORE INTO admin_users (email, password, name, role) '
            + 'VALUES (?, ?, ?, ?)',
            ['admin@admin.com', '$2a$10$rbc6e2Qtk8dp2ChpJsExPeVXVUVxp6YggoqRyW6kjyqeNeAnQQUWa', 'Super Admin', 'super_admin']
        );
        console.log('[DB-TABLES] Default admin user ensured.');

        // Tabla de Suscripciones/Planes
        await connection.query(
            'CREATE TABLE IF NOT EXISTS subscriptions ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL COMMENT \'Phone number of user\','
            + 'plan_type ENUM(\'free\', \'basic\', \'pro\', \'enterprise\') DEFAULT \'free\','
            + 'status ENUM(\'active\', \'inactive\', \'suspended\', \'expired\') DEFAULT \'inactive\','
            + 'start_date DATE NOT NULL,'
            + 'end_date DATE NOT NULL,'
            + 'days_granted INT DEFAULT 0 COMMENT \'Days granted by admin (30, 60, 90, etc)\','
            + 'features JSON COMMENT \'{"campaigns": true, "kanban": true, "agents": false}\','
            + 'max_campaigns INT DEFAULT 0,'
            + 'max_contacts INT DEFAULT 0,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'activated_by INT COMMENT \'admin_users.id who activated\','
            + 'notes TEXT,'
            + 'FOREIGN KEY (activated_by) REFERENCES admin_users(id) ON DELETE SET NULL,'
            + 'INDEX idx_session (session_id),'
            + 'INDEX idx_status (status),'
            + 'INDEX idx_end_date (end_date)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'subscriptions\' ensured.');

        // Tabla de Agentes (operadores de chat)
        await connection.query(
            'CREATE TABLE IF NOT EXISTS agents ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'session_id VARCHAR(255) NOT NULL COMMENT \'Phone number of business owner\','
            + 'name VARCHAR(255) NOT NULL,'
            + 'email VARCHAR(255) UNIQUE,'
            + 'phone VARCHAR(20),'
            + 'status ENUM(\'available\', \'busy\', \'away\', \'offline\') DEFAULT \'offline\','
            + 'max_concurrent_chats INT DEFAULT 10,'
            + 'current_chats INT DEFAULT 0,'
            + 'is_active BOOLEAN DEFAULT TRUE,'
            + 'avatar_url VARCHAR(500),'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'last_activity TIMESTAMP NULL,'
            + 'INDEX idx_session (session_id),'
            + 'INDEX idx_status (status),'
            + 'INDEX idx_email (email)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'agents\' ensured.');

        // Tabla de Historial de Conversaciones por Agente
        // Crear tabla sin FK primero para evitar errores de constraint
        await connection.query(
            'CREATE TABLE IF NOT EXISTS agent_chat_history ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'agent_id INT NOT NULL,'
            + 'chat_jid VARCHAR(255) NOT NULL,'
            + 'session_id VARCHAR(255) NOT NULL,'
            + 'assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'closed_at TIMESTAMP NULL,'
            + 'status ENUM(\'active\', \'closed\', \'transferred\') DEFAULT \'active\','
            + 'transferred_to INT COMMENT \'agent_id if transferred\','
            + 'messages_count INT DEFAULT 0,'
            + 'notes TEXT,'
            + 'INDEX idx_agent (agent_id),'
            + 'INDEX idx_chat (chat_jid),'
            + 'INDEX idx_session (session_id),'
            + 'INDEX idx_status (status)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'agent_chat_history\' ensured.');

        // Agregar FK solo si no existen (evita errores si la tabla ya existe)
        try {
            await connection.query(
                'ALTER TABLE agent_chat_history '
                + 'ADD CONSTRAINT fk_agent_chat_history_agent '
                + 'FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE'
            );
            console.log('[DB-TABLES] FK agent_chat_history -> agents (agent_id) added.');
        } catch (fkError) {
            if (fkError.code !== 'ER_DUP_KEYNAME' && fkError.code !== 'ER_FK_DUP_NAME') {
                console.log('[DB-TABLES] FK agent_chat_history -> agents (agent_id) already exists or error:', fkError.code);
            }
        }

        try {
            await connection.query(
                'ALTER TABLE agent_chat_history '
                + 'ADD CONSTRAINT fk_agent_chat_history_transferred '
                + 'FOREIGN KEY (transferred_to) REFERENCES agents(id) ON DELETE SET NULL'
            );
            console.log('[DB-TABLES] FK agent_chat_history -> agents (transferred_to) added.');
        } catch (fkError) {
            if (fkError.code !== 'ER_DUP_KEYNAME' && fkError.code !== 'ER_FK_DUP_NAME') {
                console.log('[DB-TABLES] FK agent_chat_history -> agents (transferred_to) already exists or error:', fkError.code);
            }
        }

        // Tabla de Usuarios (admins y agentes)
        await connection.query(
            'CREATE TABLE IF NOT EXISTS users ('
            + 'id INT AUTO_INCREMENT PRIMARY KEY,'
            + 'name VARCHAR(255) NOT NULL,'
            + 'email VARCHAR(255) UNIQUE,'
            + 'password VARCHAR(255) NOT NULL,'
            + 'role ENUM(\'admin\', \'agent\', \'supervisor\') DEFAULT \'agent\','
            + 'department VARCHAR(255),'
            + 'category VARCHAR(255),'
            + 'status ENUM(\'active\', \'inactive\', \'suspended\') DEFAULT \'active\','
            + 'avatar_url TEXT,'
            + 'phone VARCHAR(50),'
            + 'last_login TIMESTAMP NULL,'
            + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
            + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
            + 'subscription_plan VARCHAR(50),'
            + 'subscription_status ENUM(\'active\', \'inactive\', \'trial\', \'expired\', \'cancelled\') DEFAULT \'inactive\','
            + 'subscription_start_date DATETIME,'
            + 'subscription_end_date DATETIME,'
            + 'subscription_days INT DEFAULT 0,'
            + 'is_admin TINYINT(1) DEFAULT 0 COMMENT \'1 if admin (QR login), 0 if agent (email login)\','
            + 'is_super_admin TINYINT(1) DEFAULT 0 COMMENT \'1 if super admin from admin_users table\','
            + 'admin_phone VARCHAR(20) COMMENT \'Phone of the admin who created this user/agent\','
            + 'auto_sync TINYINT(1) DEFAULT 0 COMMENT \'Auto sync on connect\','
            + 'sync_completed TINYINT(1) DEFAULT 0 COMMENT \'Sync completed at least once\','
            + 'last_sync_date DATETIME COMMENT \'Last full sync date\','
            + 'agent_id VARCHAR(255) COMMENT \'Agent ID if user is an agent\','
            + 'INDEX idx_email (email),'
            + 'INDEX idx_role (role),'
            + 'INDEX idx_department (department),'
            + 'INDEX idx_status (status),'
            + 'INDEX idx_users_role_status (role, status),'
            + 'INDEX idx_subscription_status (subscription_status),'
            + 'INDEX idx_subscription_end_date (subscription_end_date),'
            + 'INDEX idx_admin_phone (admin_phone),'
            + 'INDEX idx_is_super_admin (is_super_admin),'
            + 'INDEX idx_agent_id (agent_id)'
            + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
        );
        console.log('[DB-TABLES] Table \'users\' ensured.');

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

// Función de migración para actualizar tablas existentes
async function migrateTables() {
    console.log('[DB-MIGRATION] Starting table migrations...');
    if (!pool) {
        console.log('[DB-MIGRATION] No pool available, skipping migrations.');
        return;
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // Migración 1: Agregar columnas faltantes a contact_groups
        console.log('[DB-MIGRATION] Checking contact_groups structure...');

        const addColumnIfNotExists = async (tableName, columnName, columnDef) => {
            try {
                const [columns] = await connection.query(
                    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME = ?
                     AND COLUMN_NAME = ?`,
                    [tableName, columnName]
                );

                if (columns.length === 0) {
                    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
                    console.log(`[DB-MIGRATION] ✓ Added column ${columnName} to ${tableName}`);
                } else {
                    console.log(`[DB-MIGRATION] ✓ Column ${columnName} already exists in ${tableName}`);
                }
            } catch (error) {
                console.error(`[DB-MIGRATION] Error adding column ${columnName} to ${tableName}:`, error.message);
            }
        };

        // Agregar columnas a contact_groups si no existen
        await addColumnIfNotExists('contact_groups', 'jid', 'VARCHAR(255)');
        await addColumnIfNotExists('contact_groups', 'session_id', 'VARCHAR(255)');
        await addColumnIfNotExists('contact_groups', 'description', 'TEXT');
        await addColumnIfNotExists('contact_groups', 'participants_count', 'INT DEFAULT 0');
        await addColumnIfNotExists('contact_groups', 'is_announcement', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfNotExists('contact_groups', 'is_restricted', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfNotExists('contact_groups', 'avatar_url', 'VARCHAR(1024)');

        // Migración: Agregar columna is_read a messages si no existe
        await addColumnIfNotExists('messages', 'is_read', 'BOOLEAN DEFAULT FALSE');

        // Migración 2: Agregar índice único si no existe
        console.log('[DB-MIGRATION] Checking contact_groups indexes...');
        try {
            const [indexes] = await connection.query(
                `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE()
                 AND TABLE_NAME = 'contact_groups'
                 AND INDEX_NAME = 'unique_group_per_session'`
            );

            if (indexes.length === 0) {
                // Primero eliminar el índice UNIQUE de 'name' si existe
                try {
                    await connection.query('ALTER TABLE contact_groups DROP INDEX name');
                    console.log('[DB-MIGRATION] ✓ Removed old UNIQUE index on name');
                } catch (error) {
                    // Ignorar si no existe
                }

                // Agregar el nuevo índice único
                await connection.query(
                    'ALTER TABLE contact_groups ADD UNIQUE KEY unique_group_per_session (jid, session_id)'
                );
                console.log('[DB-MIGRATION] ✓ Added UNIQUE index on (jid, session_id)');
            } else {
                console.log('[DB-MIGRATION] ✓ UNIQUE index unique_group_per_session already exists');
            }
        } catch (error) {
            console.error('[DB-MIGRATION] Error managing indexes:', error.message);
        }

        console.log('[DB-MIGRATION] Migrations completed successfully.');

    } catch (error) {
        console.error('[DB-MIGRATION] Error during migration:', error);
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// ========== HELPER FUNCTIONS FOR DIFFERENT ENTITY TYPES ==========

// Función auxiliar para obtener el nombre más preciso de un contacto
// Helper para reemplazar sock.getName que no existe en Baileys
function getContactNameFromStore(sock, jid) {
    try {
        if (!sock || !jid) return null;
        
        // Verificar en store.contacts
        if (sock.store?.contacts) {
            const contact = sock.store.contacts.get(jid);
            if (contact) {
                return contact.name || contact.notify || contact.verifiedName || null;
            }
        }
        
        // Buscar en mensajes recientes
        if (sock.store?.messages) {
            const chatMessages = sock.store.messages.get(jid);
            if (chatMessages && chatMessages.size > 0) {
                for (const msg of Array.from(chatMessages.values()).reverse()) {
                    if (msg.pushName && msg.pushName.trim() !== '') {
                        return msg.pushName;
                    }
                }
            }
        }
        
        return null;
    } catch (err) {
        return null;
    }
}

// Crear un wrapper para sock.getName que use nuestro método
if (!Object.prototype.hasOwnProperty.call(Object.prototype, 'getName')) {
    Object.defineProperty(Object.prototype, 'getName', {
        value: function(jid) {
            return Promise.resolve(getContactNameFromStore(this, jid));
        },
        writable: false,
        enumerable: false,
        configurable: false
    });
}

async function getBestContactName(sock, jid, providedName = null, providedNotify = null) {
    // Si ya tenemos un nombre válido (no es solo el número), usarlo
    if (providedName && providedName !== jid.split('@')[0] && providedName.trim() !== '') {
        return { name: providedName, notifyName: providedNotify || providedName };
    }
    
    if (providedNotify && providedNotify !== jid.split('@')[0] && providedNotify.trim() !== '') {
        return { name: providedNotify, notifyName: providedNotify };
    }
    
    let displayName = jid.split('@')[0]; // Default: número de teléfono
    let displayNotifyName = jid.split('@')[0];
    
    // Método 1: Verificar directamente en el store de contactos
    try {
        if (sock.store?.contacts) {
            const storeContact = sock.store.contacts.get(jid);
            if (storeContact) {
                // Prioridad: name > notify > verifiedName
                if (storeContact.name && storeContact.name !== jid.split('@')[0] && storeContact.name.trim() !== '') {
                    displayName = storeContact.name;
                    displayNotifyName = storeContact.notify || storeContact.name;
                    console.log(`[NAME-RESOLVE] ✓ Nombre desde store.contacts: ${displayName}`);
                    return { name: displayName, notifyName: displayNotifyName };
                } else if (storeContact.notify && storeContact.notify !== jid.split('@')[0] && storeContact.notify.trim() !== '') {
                    displayName = storeContact.notify;
                    displayNotifyName = storeContact.notify;
                    console.log(`[NAME-RESOLVE] ✓ NotifyName desde store.contacts: ${displayName}`);
                    return { name: displayName, notifyName: displayNotifyName };
                } else if (storeContact.verifiedName && storeContact.verifiedName !== jid.split('@')[0]) {
                    displayName = storeContact.verifiedName;
                    displayNotifyName = storeContact.verifiedName;
                    console.log(`[NAME-RESOLVE] ✓ VerifiedName desde store.contacts: ${displayName}`);
                    return { name: displayName, notifyName: displayNotifyName };
                }
            }
        }
    } catch (storeErr) {
        console.log(`[NAME-RESOLVE] Error accediendo a store.contacts:`, storeErr.message);
    }
    
    // Método 2: Buscar en mensajes recientes por pushName
    try {
        if (sock.store?.messages) {
            const chatMessages = sock.store.messages.get(jid);
            if (chatMessages && chatMessages.size > 0) {
                // Buscar el pushName más reciente
                for (const msg of Array.from(chatMessages.values()).reverse()) {
                    if (msg.pushName && msg.pushName !== jid.split('@')[0] && msg.pushName.trim() !== '') {
                        displayName = msg.pushName;
                        displayNotifyName = msg.pushName;
                        console.log(`[NAME-RESOLVE] ✓ PushName desde mensajes: ${displayName}`);
                        return { name: displayName, notifyName: displayNotifyName };
                    }
                }
            }
        }
    } catch (msgErr) {
        console.log(`[NAME-RESOLVE] Error accediendo a mensajes:`, msgErr.message);
    }
    
    // Si no encontramos nombre real, devolver el número
    console.log(`[NAME-RESOLVE] ⚠ Sin nombre real para ${jid}, usando número`);
    return { name: displayName, notifyName: displayNotifyName };
}

// Helper function para SOLO contactos individuales (@s.whatsapp.net)
async function getOrInsertContact(jid, name = null, notifyName = null, phoneNumber = null, sock = null) {
    console.log(`[DIAGNÓSTICO-DB-WRITE] --- getOrInsertContact ---`);
    console.log(`[DIAGNÓSTICO-DB-WRITE] JID: ${jid}`);
    console.log(`[DIAGNÓSTICO-DB-WRITE] Name: ${name}`);
    console.log(`[DIAGNÓSTICO-DB-WRITE] Notify Name: ${notifyName}`);
    console.log(`[DIAGNÓSTICO-DB-WRITE] Phone Number: ${phoneNumber}`);
    console.log(`[DIAGNÓSTICO-DB-WRITE] -------------------------`);

    // Validar que sea un contacto individual
    if (!jid.includes('@s.whatsapp.net')) {
        console.warn(`[DB-CONTACT-WARN] Attempted to save non-individual contact: ${jid}. Skipping.`);
        return null;
    }

    // Validar que el phone_number tenga valor
    if (!phoneNumber) {
        console.warn(`[DB-CONTACT-WARN] Called getOrInsertContact without phone_number for jid: ${jid}.`);
    }

    // Modo memoria si no hay DB
    if (process.env.SKIP_DB === 'true' || !pool) {
        if (!memoryStorage.contacts.has(jid)) {
            // Obtener el mejor nombre disponible
            let contactName = name || notifyName || jid.split('@')[0];
            let contactNotifyName = notifyName || name || jid.split('@')[0];
            
            // Intentar obtener nombre más preciso si sock está disponible
            if (sock) {
                const bestNames = await getBestContactName(sock, jid, name, notifyName);
                contactName = bestNames.name;
                contactNotifyName = bestNames.notifyName;
            }
            
            const contactData = {
                id: Date.now() + Math.random(),
                jid,
                name: contactName,
                notify_name: contactNotifyName,
                session_id: phoneNumber,
                created_at: new Date()
            };
            memoryStorage.contacts.set(jid, contactData);
            console.log(`[MEMORY-CONTACT] Contact ${jid} stored in memory with name: ${contactName}`);
        }
        return memoryStorage.contacts.get(jid).id;
    }

    if (!pool) {
        console.error('[DB-CONTACT] DB Pool not initialized!');
        return null;
    }
    const connection = await pool.getConnection();
    try {
        let contactName = name || notifyName || jid.split('@')[0];
        let contactNotifyName = notifyName || name || jid.split('@')[0];

        // Intentar obtener nombre más preciso si sock está disponible
        if (sock) {
            const bestNames = await getBestContactName(sock, jid, name, notifyName);
            contactName = bestNames.name;
            contactNotifyName = bestNames.notifyName;
            
            // IMPORTANTE: Si el nombre es solo el número de teléfono, forzamos la actualización con el nombre real
            if (contactName === jid.split('@')[0] && sock) {
                try {
                    // Intentar obtener el nombre real directamente de WhatsApp
                    const realName = await sock.getName(jid);
                    if (realName && realName !== jid.split('@')[0]) {
                        contactName = realName;
                        contactNotifyName = realName;
                        console.log(`[NAME-FORCE] Nombre forzado para ${jid}: ${realName}`);
                    }
                } catch (getNameErr) {
                    console.warn(`[NAME-FORCE] No se pudo obtener nombre real para ${jid}:`, getNameErr.message);
                }
            }
        }

        // Verificar si tenemos un nombre real (no solo el número de teléfono)
        const hasRealName = contactName && contactName !== jid.split('@')[0] && contactName.trim() !== '';
        
        // Si es solo un número, actualizar solo si el nombre actual también es solo un número
        const currentIsNumberOnly = !hasRealName || contactName === jid.split('@')[0];
        
        // Insertar/actualizar contacto - proteger nombres reales existentes
        const [result] = await connection.execute(
            `INSERT INTO contacts (jid, name, notify_name, session_id)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                name = CASE 
                    -- Solo actualizar si el nuevo nombre es real (no es número ni empieza con # o @)
                    WHEN ? != SUBSTRING_INDEX(VALUES(jid), '@', 1) 
                         AND ? NOT LIKE '#%' 
                         AND ? NOT LIKE '@%'
                         AND ? != '' 
                         AND ? IS NOT NULL 
                    THEN ?
                    -- Si el nombre existente ya es bueno, no sobrescribir
                    WHEN name IS NOT NULL 
                         AND name != SUBSTRING_INDEX(jid, '@', 1)
                         AND name NOT LIKE '#%'
                         AND name NOT LIKE '@%'
                    THEN name
                    ELSE ?
                END,
                notify_name = CASE 
                    -- Solo actualizar si el nuevo nombre es real (no es número ni empieza con # o @)
                    WHEN ? != SUBSTRING_INDEX(VALUES(jid), '@', 1) 
                         AND ? NOT LIKE '#%'
                         AND ? NOT LIKE '@%' 
                         AND ? != '' 
                         AND ? IS NOT NULL 
                    THEN ?
                    -- Si el nombre existente ya es bueno, no sobrescribir
                    WHEN notify_name IS NOT NULL 
                         AND notify_name != SUBSTRING_INDEX(jid, '@', 1)
                         AND notify_name NOT LIKE '#%'
                         AND notify_name NOT LIKE '@%'
                    THEN notify_name
                    ELSE ?
                END,
                updated_at = CURRENT_TIMESTAMP`,
            [
                jid, contactName, contactNotifyName, phoneNumber,
                // Parámetros para el CASE de name (6 condiciones)
                contactName, contactName, contactName, contactName, contactName, contactName,
                // Valor por defecto si ninguna condición se cumple
                contactName,
                // Parámetros para el CASE de notify_name (6 condiciones)
                contactNotifyName, contactNotifyName, contactNotifyName, contactNotifyName, contactNotifyName, contactNotifyName,
                // Valor por defecto si ninguna condición se cumple
                contactNotifyName
            ]
        );
        console.log(`[DB-CONTACT-SUCCESS] Individual contact ${jid} saved with name: ${contactName}${hasRealName ? ' (REAL NAME)' : ' (NUMBER ONLY)'}`);

        // Get the contact ID
        if (result.insertId) {
            return result.insertId;
        } else {
            let [rows] = await connection.execute(
                'SELECT id FROM contacts WHERE jid = ? AND session_id = ?',
                [jid, phoneNumber]
            );
            return rows[0]?.id || null;
        }
    } catch (error) {
        console.error(`[DB-CONTACT] Error in getOrInsertContact for ${jid}:`, error);
        return null;
    } finally {
        if (connection) connection.release();
    }
}

// Helper function para grupos de WhatsApp (@g.us)
async function getOrInsertWhatsAppGroup(jid, name = null, subject = null, phoneNumber = null, metadata = null, sock = null) {
    console.log(`[DB-GROUP-CALL] Called getOrInsertWhatsAppGroup for jid: ${jid}, name: ${name}, subject: ${subject}`);

    // Validar que sea un grupo
    if (!jid.includes('@g.us')) {
        console.warn(`[DB-GROUP-WARN] Attempted to save non-group: ${jid}. Skipping.`);
        return null;
    }

    if (!phoneNumber) {
        console.warn(`[DB-GROUP-WARN] Called getOrInsertWhatsAppGroup without phone_number for jid: ${jid}.`);
    }

    // Modo memoria si no hay DB
    if (process.env.SKIP_DB === 'true' || !pool) {
        let groupName = name || subject || jid.split('@')[0];
        let groupSubject = subject || name || jid.split('@')[0];
        
        // Intentar obtener nombre más preciso si sock está disponible
        if (sock) {
            try {
                const displayName = await sock.getName(jid);
                if (displayName && displayName !== jid.split('@')[0]) {
                    groupName = displayName;
                    groupSubject = displayName;
                    console.log(`[MEMORY-GROUP] Nombre actualizado para ${jid}: ${displayName}`);
                }
            } catch (nameErr) {
                console.warn(`[MEMORY-GROUP] Error obteniendo nombre de sock para ${jid}:`, nameErr.message);
            }
        }

        if (!memoryStorage.groups) memoryStorage.groups = new Map();
        if (!memoryStorage.groups.has(jid)) {
            const groupData = {
                id: Date.now() + Math.random(),
                jid,
                name: groupName,
                subject: groupSubject,
                session_id: phoneNumber,
                created_at: new Date()
            };
            memoryStorage.groups.set(jid, groupData);
            console.log(`[MEMORY-GROUP] Group ${jid} stored in memory with name: ${groupName}`);
        }
        return memoryStorage.groups.get(jid).id;
    }

    if (!pool) {
        console.error('[DB-GROUP] DB Pool not initialized!');
        return null;
    }
    const connection = await pool.getConnection();
    try {
        let groupName = name || subject || jid.split('@')[0];
        let groupSubject = subject || name || jid.split('@')[0];

        // Intentar obtener nombre más preciso si sock está disponible
        if (sock) {
            try {
                const displayName = await sock.getName(jid);
                if (displayName && displayName !== jid.split('@')[0]) {
                    groupName = displayName;
                    groupSubject = displayName;
                    console.log(`[DB-GROUP] Nombre actualizado para ${jid}: ${displayName}`);
                }
            } catch (nameErr) {
                console.warn(`[DB-GROUP] Error obteniendo nombre de sock para ${jid}:`, nameErr.message);
            }
        }

        const description = metadata?.desc || null;
        const participantCount = metadata?.participants?.length || 0;
        const isAnnouncement = metadata?.announce || false;
        const isRestricted = metadata?.restrict || false;

        const [result] = await connection.execute(
            `INSERT INTO contact_groups (jid, name, session_id, description, participants_count, is_announcement, is_restricted)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                name = CASE 
                    WHEN VALUES(name) IS NOT NULL AND VALUES(name) != '' AND VALUES(name) != SUBSTRING_INDEX(VALUES(jid), '@', 1) 
                    THEN VALUES(name) 
                    ELSE name 
                END,
                description = IF(VALUES(description) IS NOT NULL, VALUES(description), description),
                participants_count = IF(VALUES(participants_count) > 0, VALUES(participants_count), participants_count),
                is_announcement = VALUES(is_announcement),
                is_restricted = VALUES(is_restricted),
                updated_at = CURRENT_TIMESTAMP`,
            [jid, groupName, phoneNumber, description, participantCount, isAnnouncement, isRestricted]
        );
        console.log(`[DB-GROUP-SUCCESS] WhatsApp group ${jid} saved to contact_groups with name: ${groupName}`);

        // Get the group ID
        if (result.insertId) {
            return result.insertId;
        } else {
            let [rows] = await connection.execute(
                'SELECT id FROM contact_groups WHERE jid = ? AND session_id = ?',
                [jid, phoneNumber]
            );
            return rows[0]?.id || null;
        }
    } catch (error) {
        console.error(`[DB-GROUP] Error in getOrInsertWhatsAppGroup for ${jid}:`, error);
        return null;
    } finally {
        if (connection) connection.release();
    }
}

// Helper function para insertar miembros de grupos
async function insertGroupMembers(groupJid, participants = [], phoneNumber = null) {
    if (!participants || participants.length === 0) {
        console.log(`[DB-GROUP-MEMBERS] No participants to insert for group ${groupJid}`);
        return;
    }

    if (process.env.SKIP_DB === 'true' || !pool) {
        console.log(`[MEMORY-GROUP-MEMBERS] Skipping member storage in memory mode`);
        return;
    }

    if (!pool) {
        console.error('[DB-GROUP-MEMBERS] DB Pool not initialized!');
        return;
    }

    // ===== LOGS DE DEPURACIÓN =====
    console.log(`[DB-GROUP-MEMBERS-DEBUG] ==========================================`);
    console.log(`[DB-GROUP-MEMBERS-DEBUG] Procesando grupo: ${groupJid}`);
    console.log(`[DB-GROUP-MEMBERS-DEBUG] Total participantes: ${participants.length}`);
    console.log(`[DB-GROUP-MEMBERS-DEBUG] Primeros 3 participantes completos:`,
        JSON.stringify(participants.slice(0, 3), null, 2)
    );
    // ===== FIN LOGS DE DEPURACIÓN =====

    const connection = await pool.getConnection();
    try {
        for (const participant of participants) {
            const contactJid = participant.id || participant;
            const isAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';
            const isSuperAdmin = participant.admin === 'superadmin';

            // LOG: Ver qué contactJid se está usando
            console.log(`[DB-GROUP-MEMBERS-DEBUG] Procesando participante: contactJid="${contactJid}", groupJid="${groupJid}"`);

            // Extraer número de teléfono del JID
            let participantPhone = null;
            if (contactJid.includes('@s.whatsapp.net')) {
                // JID normal: "5491112345678@s.whatsapp.net"
                participantPhone = contactJid.split('@')[0];
                console.log(`[DB-GROUP-MEMBERS-DEBUG] ✅ JID normal, phone extraído: ${participantPhone}`);
            } else if (contactJid.includes('@lid')) {
                // LID: guardar null, el número real se intentará obtener después
                participantPhone = null;
                console.log(`[DB-GROUP-MEMBERS-DEBUG] ⚠️ LID detectado, phone=null, se resolverá después`);
            } else if (typeof contactJid === 'string' && contactJid.match(/^\d+$/)) {
                // Solo números
                participantPhone = contactJid;
                console.log(`[DB-GROUP-MEMBERS-DEBUG] ✅ Solo números, phone: ${participantPhone}`);
            } else {
                console.log(`[DB-GROUP-MEMBERS-DEBUG] ❌ FORMATO DESCONOCIDO: contactJid="${contactJid}"`);
            }

            // Obtener nombre del participante si existe en contacts
            let participantName = null;
            let participantNotifyName = null;
            try {
                const [contactRows] = await connection.execute(
                    'SELECT name, notify_name FROM contacts WHERE jid = ? AND session_id = ? LIMIT 1',
                    [contactJid, phoneNumber]
                );
                if (contactRows.length > 0) {
                    participantName = contactRows[0].name;
                    participantNotifyName = contactRows[0].notify_name;
                    // Si no tenemos phone pero está en contacts, intentar extraerlo
                    if (!participantPhone && contactRows[0].jid) {
                        const contactJidStr = contactRows[0].jid;
                        if (contactJidStr.includes('@s.whatsapp.net')) {
                            participantPhone = contactJidStr.split('@')[0];
                        }
                    }
                }
            } catch (err) {
                // Ignorar error, solo no tendremos nombre
            }

            await connection.execute(
                `INSERT INTO contact_group_members (contact_jid, group_jid, is_admin, is_super_admin, session_id, phone_number, name, notify_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    is_admin = VALUES(is_admin),
                    is_super_admin = VALUES(is_super_admin),
                    phone_number = IF(VALUES(phone_number) IS NOT NULL, VALUES(phone_number), phone_number),
                    name = IF(VALUES(name) IS NOT NULL, VALUES(name), name),
                    notify_name = IF(VALUES(notify_name) IS NOT NULL, VALUES(notify_name), notify_name)`,
                [contactJid, groupJid, isAdmin, isSuperAdmin, phoneNumber, participantPhone, participantName, participantNotifyName]
            );
        }
        console.log(`[DB-GROUP-MEMBERS-SUCCESS] Inserted ${participants.length} members for group ${groupJid} into contact_group_members`);
    } catch (error) {
        console.error(`[DB-GROUP-MEMBERS] Error inserting group members:`, error);
    } finally {
        if (connection) connection.release();
    }
}

// Helper function para broadcasts/status
async function getOrInsertBroadcast(jid, name = null, phoneNumber = null, broadcastType = 'status') {
    console.log(`[DB-BROADCAST-CALL] Called getOrInsertBroadcast for jid: ${jid}, type: ${broadcastType}`);

    if (!phoneNumber) {
        console.warn(`[DB-BROADCAST-WARN] Called getOrInsertBroadcast without phone_number for jid: ${jid}.`);
    }

    // Modo memoria si no hay DB
    if (process.env.SKIP_DB === 'true' || !pool) {
        if (!memoryStorage.broadcasts) memoryStorage.broadcasts = new Map();
        if (!memoryStorage.broadcasts.has(jid)) {
            const broadcastData = {
                id: Date.now() + Math.random(),
                jid,
                name: name || jid,
                session_id: phoneNumber,
                broadcast_type: broadcastType,
                created_at: new Date()
            };
            memoryStorage.broadcasts.set(jid, broadcastData);
            console.log(`[MEMORY-BROADCAST] Broadcast ${jid} stored in memory`);
        }
        return memoryStorage.broadcasts.get(jid).id;
    }

    if (!pool) {
        console.error('[DB-BROADCAST] DB Pool not initialized!');
        return null;
    }
    const connection = await pool.getConnection();
    try {
        const broadcastName = name || jid;

        const [result] = await connection.execute(
            `INSERT INTO broadcasts (jid, name, session_id, broadcast_type)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                name = IF(VALUES(name) IS NOT NULL AND VALUES(name) != '', VALUES(name), name),
                updated_at = CURRENT_TIMESTAMP`,
            [jid, broadcastName, phoneNumber, broadcastType]
        );
        console.log(`[DB-BROADCAST-SUCCESS] Broadcast ${jid} saved.`);

        if (result.insertId) {
            return result.insertId;
        } else {
            let [rows] = await connection.execute(
                'SELECT id FROM broadcasts WHERE jid = ? AND session_id = ?',
                [jid, phoneNumber]
            );
            return rows[0]?.id || null;
        }
    } catch (error) {
        console.error(`[DB-BROADCAST] Error in getOrInsertBroadcast for ${jid}:`, error);
        return null;
    } finally {
        if (connection) connection.release();
    }
}

// ============= SISTEMA DE MAPEO DE LIDs =============

// Función para guardar mapeo de LID
async function saveLidMapping(lid, realJid, phoneNumber, name, notifyName, sessionId) {
    if (!pool || !lid || !lid.includes('@lid')) {
        return;
    }

    try {
        const connection = await pool.getConnection();
        try {
            await connection.execute(
                `INSERT INTO lid_mappings (lid, real_jid, phone_number, name, notify_name, session_id)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    real_jid = IF(VALUES(real_jid) IS NOT NULL, VALUES(real_jid), real_jid),
                    phone_number = IF(VALUES(phone_number) IS NOT NULL, VALUES(phone_number), phone_number),
                    name = IF(VALUES(name) IS NOT NULL, VALUES(name), name),
                    notify_name = IF(VALUES(notify_name) IS NOT NULL, VALUES(notify_name), notify_name),
                    last_seen = CURRENT_TIMESTAMP`,
                [lid, realJid, phoneNumber, name, notifyName, sessionId]
            );
            console.log(`[LID-MAPPING] Guardado: ${lid} -> ${phoneNumber || realJid} (${name || 'sin nombre'})`);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(`[LID-MAPPING] Error guardando mapeo:`, error.message);
    }
}

// Función para resolver un LID
async function resolveLid(lid, sessionId, sock = null) {
    if (!lid || !lid.includes('@lid')) {
        return null;
    }

    try {
        // Buscar en la base de datos (solo lugar confiable donde están mapeados)
        if (pool) {
            const connection = await pool.getConnection();
            try {
                const [rows] = await connection.execute(
                    'SELECT real_jid, phone_number, name, notify_name FROM lid_mappings WHERE lid = ? AND session_id = ? LIMIT 1',
                    [lid, sessionId]
                );
                
                if (rows.length > 0) {
                    console.log(`[LID-RESOLVE] ${lid} -> ${rows[0].phone_number || rows[0].real_jid}`);
                    return rows[0];
                }
            } finally {
                connection.release();
            }
        }
        
        // Los LIDs solo se pueden resolver cuando el contacto interactúa
        // No hay API de WhatsApp para resolverlos directamente
        console.log(`[LID-RESOLVE] ⚠️  LID no mapeado: ${lid} (se resolverá cuando el contacto envíe un mensaje)`);
        return null;
    } catch (error) {
        console.error(`[LID-RESOLVE] Error resolviendo LID:`, error.message);
        return null;
    }
}

// Helper function to save a message to the database
async function saveMessageToDB(sessionId, msg) {
    console.log(`[DB-MSG-CALL] Called saveMessageToDB for session: ${sessionId}, messageId: ${msg.id}, chat_jid: ${msg.chat_jid}`);

    // Obtener el número de teléfono del usuario en lugar de la session_id temporal
    const phoneNumber = await getUserPhoneNumber(sessionId);

    if (!phoneNumber) {
        console.error(`[DB-MSG] No se pudo obtener phoneNumber para sessionId ${sessionId}. No se puede guardar mensaje ${msg.id}.`);
        return null;
    }

    // Modo memoria si no hay DB
    if (process.env.SKIP_DB === 'true' || !pool || memoryStorage.isMemoryMode) {
        const messageKey = `${phoneNumber || sessionId}_${msg.id}`;
        memoryStorage.messages.set(messageKey, {
            ...msg,
            session_id: phoneNumber, // Usar número de teléfono en lugar de session_id
            created_at: new Date()
        });
        console.log(`[MEMORY-MSG] Message ${msg.id} stored in memory for phone number ${phoneNumber}`);
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

        // 🆕 OBTENER NOMBRE Y AVATAR DEL REMITENTE DESDE CONTACTS
        let senderName = null;
        let senderAvatar = null;

        if (from_me) {
            // Para mensajes propios, obtener el nombre y avatar del usuario actual
            try {
                const [userRows] = await connection.execute(
                    'SELECT name, avatar_url FROM users WHERE phone = ? LIMIT 1',
                    [phoneNumber]
                );

                if (userRows.length > 0) {
                    const user = userRows[0];
                    senderName = user.name || phoneNumber;
                    senderAvatar = user.avatar_url;
                    console.log(`[DB-MSG] 👤 Mensaje propio - Usuario: ${senderName}, avatar: ${senderAvatar ? 'Sí' : 'No'}`);
                } else {
                    senderName = phoneNumber;
                    console.log(`[DB-MSG] ⚠️ Usuario no encontrado, usando número: ${phoneNumber}`);
                }
            } catch (err) {
                console.error('[DB-MSG] Error obteniendo información del usuario:', err);
                senderName = phoneNumber;
            }
        } else if (finalSenderJid) {
            // Para mensajes recibidos, obtener del contacto
            try {
                const [contactRows] = await connection.execute(
                    'SELECT name, notify_name, avatar_url FROM contacts WHERE jid = ? AND session_id = ? LIMIT 1',
                    [finalSenderJid, phoneNumber]
                );

                if (contactRows.length > 0) {
                    const contact = contactRows[0];
                    senderName = contact.name || contact.notify_name || finalSenderJid.split('@')[0];
                    senderAvatar = contact.avatar_url;
                    console.log(`[DB-MSG] 👤 Información del remitente obtenida: ${senderName}, avatar: ${senderAvatar ? 'Sí' : 'No'}`);
                } else {
                    // Si no encuentra el contacto, usar el JID como nombre
                    senderName = finalSenderJid.split('@')[0];
                    console.log(`[DB-MSG] ⚠️ Contacto no encontrado para ${finalSenderJid}, usando JID como nombre`);
                }
            } catch (err) {
                console.error('[DB-MSG] Error obteniendo información del remitente:', err);
                senderName = finalSenderJid.split('@')[0];
            }
        }

        const params = [
            messageId,
            phoneNumber, // Usar número de teléfono en lugar de session_id temporal
            userSessionId, // Agregar user_session_id
            chat_jid,
            finalSenderJid,
            from_me,
            message_type || null, // Asegurar null si message_type es undefined
            text_content || null,
            media_url || null,
            media_mime_type || null,
            mysqlTimestamp,
            status || 'pending', // Asegurar un estado por defecto si es undefined
            senderName, // 🆕 Nombre del remitente
            senderAvatar // 🆕 Avatar del remitente
        ];

        console.log(`[DB-MSG-QUERY] Attempting to insert/update messageId: ${messageId} for phone number: ${phoneNumber}, user_session_id: ${userSessionId}, chat_jid: ${chat_jid}, sender_jid: ${finalSenderJid}, from_me: ${from_me}, type: ${params[6]}, status: ${params[11]}, sender_name: ${senderName}`);
        const [result] = await connection.execute(
            'INSERT INTO messages (id, session_id, user_session_id, chat_jid, sender_jid, from_me, message_type, text_content, media_url, media_mime_type, timestamp, status, sender_name, sender_avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), sender_name = VALUES(sender_name), sender_avatar = VALUES(sender_avatar), media_url = COALESCE(VALUES(media_url), media_url), media_mime_type = COALESCE(VALUES(media_mime_type), media_mime_type), text_content = COALESCE(VALUES(text_content), text_content), updated_at = CURRENT_TIMESTAMP',
            params
        );
        console.log(`[DB-MSG-QUERY-RESULT] Result for messageId ${messageId}: affectedRows: ${result.affectedRows}, insertId: ${result.insertId !== undefined ? result.insertId : 'N/A (update)'}`);

        if (result.affectedRows > 0) {
             if (result.insertId !== 0 && result.insertId !== undefined) { // insertId is 0 for ON DUPLICATE KEY UPDATE if no new row was inserted
                console.log(`[DB-MSG] Message ${messageId} for phone number ${phoneNumber} inserted into DB.`);
             } else {
                console.log(`[DB-MSG] Message ${messageId} for phone number ${phoneNumber} updated in DB (e.g. status).`);
             }
        } else {
            // This case might happen if ON DUPLICATE KEY UPDATE didn't change anything or no insert occurred.
            // For messages, usually an insert or an update (if status changes) is expected.
            console.log(`[DB-MSG] Message ${messageId} for phone number ${phoneNumber} - no change in DB (already exists with same status?).`);
        }

        // ═══════════════════════════════════════════════════════════
        // EMITIR MENSAJE EN TIEMPO REAL DESPUÉS DE GUARDAR EN BD
        // ═══════════════════════════════════════════════════════════
        console.log(`[${sessionId}] 🔍💾 Verificando emisión:`, {
            messageId: messageId.substring(0, 20),
            chat_jid: chat_jid.substring(0, 30),
            isLid: chat_jid.includes('@lid'),
            from_me: from_me,
            shouldEmit: !chat_jid.includes('@lid') && !from_me
        });
        
        if (!chat_jid.includes('@lid') && !from_me) { // Solo mensajes ENTRANTES
            console.log(`[${sessionId}] 🚀💾 EMITIENDO desde saveMessageToDB:`, messageId.substring(0, 20));
            console.log(`[${sessionId}] 📡 Emitiendo a sala: session-${phoneNumber}`);
            io.to(`session-${phoneNumber}`).emit('message', {
                id: messageId,
                from: sender_jid || chat_jid,
                chatJid: chat_jid,
                message: text_content || 'Media',
                text: text_content || 'Media',
                timestamp: new Date(timestamp).toISOString(),
                type: message_type?.replace('Message', '').toLowerCase() || 'text',
                isFromMe: Boolean(from_me),
                isGroup: chat_jid.includes('@g.us'),
                status: status
            });
            console.log(`[${sessionId}] ✅💾 Mensaje emitido desde BD`);
        }
        // ═══════════════════════════════════════════════════════════
        
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

// Cache para phoneNumbers ya resueltos
const phoneNumberCache = new Map();

// Función para obtener el número de teléfono del usuario de la sesión
async function getUserPhoneNumber(sessionId) {
    // Verificar cache primero
    if (phoneNumberCache.has(sessionId)) {
        return phoneNumberCache.get(sessionId);
    }

    // Intento 1: Obtener de la sesión activa de WhatsApp
    const session = sessions.get(sessionId);
    if (session && session.sock && session.sock.user) {
        // El user.id viene en formato como "5491234567890:XX@s.whatsapp.net"
        const userJid = session.sock.user.id;
        const phoneNumber = userJid.split(':')[0]; // Extraer solo el número
        phoneNumberCache.set(sessionId, phoneNumber); // Cachear resultado
        console.log(`[${sessionId}] ✅ Usuario identificado desde sesión activa: ${phoneNumber}`);
        return phoneNumber;
    }

    // Intento 2: Si la sesión tiene phoneNumber almacenado (se guarda al conectar)
    if (session && session.phoneNumber) {
        phoneNumberCache.set(sessionId, session.phoneNumber); // Cachear resultado
        console.log(`[${sessionId}] ✅ Usuario identificado desde sesión almacenada: ${session.phoneNumber}`);
        return session.phoneNumber;
    }

    // Intento 3: Buscar en user_sessions por phone_number o session_id
    if (pool && !memoryStorage.isMemoryMode) {
        try {
            const connection = await pool.getConnection();
            try {
                // Buscar por phone_number primero
                const [phoneRows] = await connection.execute(
                    'SELECT phone_number, session_id FROM user_sessions WHERE phone_number = ? OR session_id = ? LIMIT 1',
                    [sessionId, sessionId]
                );
                if (phoneRows.length > 0) {
                    const phoneNumber = phoneRows[0].phone_number;
                    console.log(`[${sessionId}] ✅ Usuario identificado desde user_sessions: ${phoneNumber}`);
                    
                    // CRÍTICO: Establecer preferencia de sincronización en TRUE por defecto para sincronizar todo al conectar
                    if (sessionSyncPreferences.get(sessionId) === undefined) {
                        sessionSyncPreferences.set(sessionId, true);
                        console.log(`[${sessionId}] ✅ Preferencia de sincronización establecida en TRUE por defecto (sincroniza todo al conectar)`);
                    }
                    
                    return phoneNumber;
                }

                // Buscar en messages como fallback (datos antiguos)
                const [msgRows] = await connection.execute(
                    'SELECT DISTINCT session_id FROM messages WHERE session_id LIKE ? ORDER BY timestamp DESC LIMIT 1',
                    [`%${sessionId}%`]
                );
                if (msgRows.length > 0 && msgRows[0].session_id) {
                    // Intentar buscar el phone_number correspondiente a este session_id
                    const [mappingRows] = await connection.execute(
                        'SELECT phone_number FROM user_sessions WHERE session_id = ? LIMIT 1',
                        [msgRows[0].session_id]
                    );
                    if (mappingRows.length > 0) {
                        const phoneNumber = mappingRows[0].phone_number;
                        console.log(`[${sessionId}] ✅ Usuario identificado desde BD con mapeo: ${phoneNumber}`);
                        return phoneNumber;
                    }
                    console.log(`[${sessionId}] ✅ Usuario identificado desde BD: ${msgRows[0].session_id}`);
                    return msgRows[0].session_id;
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.warn(`[${sessionId}] ⚠️ Error buscando en BD:`, error.message);
        }
    }

    // Intento 4: Buscar en tabla users por phone
    if (pool && !memoryStorage.isMemoryMode) {
        try {
            const connection = await pool.getConnection();
            try {
                const [userRows] = await connection.execute(
                    'SELECT phone FROM users WHERE phone = ? LIMIT 1',
                    [sessionId]
                );
                if (userRows.length > 0 && userRows[0].phone) {
                    const phoneNumber = userRows[0].phone;
                    phoneNumberCache.set(sessionId, phoneNumber); // Cachear resultado
                    console.log(`[${sessionId}] ✅ Usuario identificado desde tabla users: ${phoneNumber}`);
                    return phoneNumber;
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.warn(`[${sessionId}] ⚠️ Error buscando en tabla users:`, error.message);
        }
    }

    // Fallback final: Si el sessionId parece un número de teléfono, usarlo directamente
    if (sessionId && /^\d+$/.test(sessionId)) {
        phoneNumberCache.set(sessionId, sessionId); // Cachear resultado
        console.log(`[${sessionId}] ℹ️ Usando sessionId como phoneNumber (parece número válido)`);
        return sessionId;
    }

    // Último recurso: retornar el sessionId tal cual (mejor que null)
    // Solo log una vez para evitar spam
    if (!phoneNumberCache.has(`warned_${sessionId}`)) {
        console.warn(`[${sessionId}] ⚠️ No se pudo determinar phoneNumber, usando sessionId como fallback`);
        phoneNumberCache.set(`warned_${sessionId}`, true);
    }
    return sessionId;
}

// Función para obtener todos los session_ids válidos para un usuario (incluyendo phone_number y session_id hash)
async function getAllSessionIds(sessionId) {
    const sessionIds = [sessionId]; // Siempre incluir el sessionId original

    if (pool && !memoryStorage.isMemoryMode) {
        try {
            const connection = await pool.getConnection();
            try {
                // Buscar en user_sessions por phone_number o session_id
                const [rows] = await connection.execute(
                    'SELECT phone_number, session_id FROM user_sessions WHERE phone_number = ? OR session_id = ?',
                    [sessionId, sessionId]
                );

                for (const row of rows) {
                    if (row.phone_number && !sessionIds.includes(row.phone_number)) {
                        sessionIds.push(row.phone_number);
                    }
                    if (row.session_id && !sessionIds.includes(row.session_id)) {
                        sessionIds.push(row.session_id);
                    }
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.warn(`[getAllSessionIds] ⚠️ Error:`, error.message);
        }
    }

    return sessionIds;
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
            // Actualizar con el nuevo session_id, device_id, session_token y marcar como activa
            const deviceId = sessionDeviceMap.get(sessionId) || null;
            const sessionToken = sessionTokenMap.get(sessionId)?.sessionToken || null;
            await connection.execute(
                'UPDATE user_sessions SET session_id = ?, is_active = TRUE, device_id = ?, session_token = ?, last_activity = CURRENT_TIMESTAMP WHERE phone_number = ?',
                [sessionId, deviceId, sessionToken, phoneNumber]
            );
            console.log(`[DB-USER] Sesión existente actualizada para ${phoneNumber}: user_session_id ${userSessionId}, deviceId: ${deviceId?.substring(0,20)}...`);
        } else {
            // Primera vez que este número inicia sesión, crear nuevo registro
            const deviceId = sessionDeviceMap.get(sessionId) || null;
            const sessionToken = sessionTokenMap.get(sessionId)?.sessionToken || null;
            const [result] = await connection.execute(
                'INSERT INTO user_sessions (session_id, phone_number, is_active, device_id, session_token) VALUES (?, ?, TRUE, ?, ?)',
                [sessionId, phoneNumber, deviceId, sessionToken]
            );
            userSessionId = result.insertId;
            console.log(`[DB-USER] Nueva sesión creada para ${phoneNumber}: user_session_id ${userSessionId}, deviceId: ${deviceId?.substring(0,20)}...`);
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

// Función para actualizar nombres de contactos existentes con los más recientes
async function updateContactNames(sessionId) {
    console.log(`[UPDATE-NAMES] 🔄 Iniciando actualización de nombres de contactos para: ${sessionId}`);
    
    const phoneNumber = await getUserPhoneNumber(sessionId);
    const session = sessions.get(sessionId) || sessions.get(phoneNumber);
    
    if (!session || !session.sock) {
        console.error(`[UPDATE-NAMES] ❌ No se encontró sesión activa para: ${sessionId}`);
        return { updated: 0, errors: 0 };
    }
    
    const sock = session.sock;
    let updatedCount = 0;
    let errorCount = 0;
    
    try {
        const connection = await pool.getConnection();
        try {
            // Obtener todos los contactos individuales para esta sesión
            const [existingContacts] = await connection.execute(
                `SELECT jid, name, notify_name 
                 FROM contacts 
                 WHERE session_id = ? AND jid LIKE '%@s.whatsapp.net'`,
                [phoneNumber]
            );
            
            console.log(`[UPDATE-NAMES] 📋 Encontrados ${existingContacts.length} contactos para actualizar`);
            
            for (const contact of existingContacts) {
                try {
                    // Intentar obtener el nombre actualizado de WhatsApp
                    const displayName = await sock.getName(contact.jid).catch(() => null);
                    
                    if (displayName && displayName !== contact.jid.split('@')[0] && 
                        displayName !== contact.name && displayName !== contact.notify_name) {
                        
                        // Actualizar el contacto con el nuevo nombre
                        await connection.execute(
                            `UPDATE contacts 
                             SET name = ?, notify_name = ?, updated_at = CURRENT_TIMESTAMP 
                             WHERE jid = ? AND session_id = ?`,
                            [displayName, displayName, contact.jid, phoneNumber]
                        );
                        
                        console.log(`[UPDATE-NAMES] ✅ Actualizado: ${contact.jid} -> ${displayName}`);
                        updatedCount++;
                    } else {
                        // Verificar si el nombre actual es solo el número (sin nombre real)
                        if (!contact.name || contact.name === contact.jid.split('@')[0]) {
                            // El contacto no tiene un nombre real, dejarlo como está
                            console.log(`[UPDATE-NAMES] ℹ️ Sin nombre real para: ${contact.jid}`);
                        }
                    }
                } catch (err) {
                    console.error(`[UPDATE-NAMES] Error actualizando contacto ${contact.jid}:`, err.message);
                    errorCount++;
                }
            }
            
            console.log(`[UPDATE-NAMES] ✅ Actualización de nombres completada`);
            console.log(`[UPDATE-NAMES]   - Contactos actualizados: ${updatedCount}`);
            console.log(`[UPDATE-NAMES]   - Errores: ${errorCount}`);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(`[UPDATE-NAMES] ❌ Error general en actualización de nombres:`, error);
        errorCount++;
    }
    
    return { updated: updatedCount, errors: errorCount };
}

// Función para forzar sincronización completa de chats, contactos y mensajes
async function forceFullSync(sessionId, sock, userSessionId) {
    console.log(`[FORCE-SYNC] 🔄 Iniciando sincronización completa para: ${sessionId}`);
    
    const stats = {
        chats: 0,
        contacts: 0,
        groups: 0,
        messages: 0,
        errors: 0
    };

    try {
        const connection = await pool.getConnection();

        try {
            // 1. Obtener el número de teléfono del usuario
            const phoneNumber = await getUserPhoneNumber(sessionId);
            
            // 2. Sincronizar contactos desde la tienda de Baileys
            console.log(`[FORCE-SYNC] 📇 Sincronizando contactos...`);
            const contacts = sock?.contacts || {};
            for (const [jid, contact] of Object.entries(contacts)) {
                if (typeof contact === 'object' && jid.includes('@s.whatsapp.net')) {
                    try {
                        await getOrInsertContact(
                            jid, 
                            contact.name || contact.notify || jid.split('@')[0], 
                            contact.notify || contact.name, 
                            false, 
                            phoneNumber,
                            sock
                        );
                        stats.contacts++;
                    } catch (err) {
                        console.error(`[FORCE-SYNC] Error guardando contacto ${jid}:`, err.message);
                        stats.errors++;
                    }
                } else if (jid.includes('@g.us')) {
                    try {
                        await getOrInsertWhatsAppGroup(
                            jid, 
                            contact.name || contact.subject || jid.split('@')[0], 
                            contact.subject || contact.name, 
                            phoneNumber, 
                            contact,
                            sock
                        );
                        stats.groups++;
                    } catch (err) {
                        console.error(`[FORCE-SYNC] Error guardando grupo ${jid}:`, err.message);
                        stats.errors++;
                    }
                }
            }
            console.log(`[FORCE-SYNC] ✅ ${stats.contacts} contactos y ${stats.groups} grupos sincronizados`);

            // 3. Sincronizar chats
            console.log(`[FORCE-SYNC] 💬 Sincronizando chats...`);
            const chats = sock?.chats || new Map();
            for (const [jid, chat] of chats.entries()) {
                if (typeof chat === 'object' && jid.includes('@s.whatsapp.net')) {
                    try {
                        await getOrInsertContact(
                            jid, 
                            chat.name || chat.subject || jid.split('@')[0], 
                            chat.name || chat.subject || jid.split('@')[0], 
                            false, 
                            phoneNumber,
                            sock
                        );
                        stats.chats++;
                    } catch (err) {
                        console.error(`[FORCE-SYNC] Error guardando chat ${jid}:`, err.message);
                        stats.errors++;
                    }
                }
            }
            console.log(`[FORCE-SYNC] ✅ ${stats.chats} chats individuales sincronizados`);

            // 4. Sincronizar grupos participantes
            console.log(`[FORCE-SYNC] 👥 Sincronizando grupos participantes...`);
            try {
                const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
                for (const [jid, groupData] of Object.entries(groups)) {
                    if (jid.includes('@g.us')) {
                        try {
                            await getOrInsertWhatsAppGroup(
                                jid, 
                                groupData.subject || groupData.name || jid.split('@')[0], 
                                groupData.subject || groupData.name || jid.split('@')[0], 
                                phoneNumber, 
                                groupData,
                                sock
                            );
                            
                            // Sincronizar miembros del grupo
                            if (groupData.participants && groupData.participants.length > 0) {
                                await insertGroupMembers(jid, groupData.participants, phoneNumber);
                            }
                            
                            stats.groups++;
                        } catch (err) {
                            console.error(`[FORCE-SYNC] Error guardando grupo participante ${jid}:`, err.message);
                            stats.errors++;
                        }
                    }
                }
                console.log(`[FORCE-SYNC] ✅ Grupos participantes procesados`);
            } catch (err) {
                console.error(`[FORCE-SYNC] Error obteniendo grupos participantes:`, err.message);
            }

            // 5. Sincronizar mensajes recientes
            console.log(`[FORCE-SYNC] 💬 Sincronizando mensajes recientes...`);
            if (sock?. chats) { // Asegurarse de que exista el store de chats
                for (const [jid, chat] of sock.chats.entries()) {
                    if (chat?.unreadCount > 0 || chat?.timestamp > Date.now() - (7 * 24 * 60 * 60 * 1000)) { // Últimos 7 días o no leídos
                        try {
                            // Intentar obtener mensajes recientes de este chat
                            const messages = await sock.fetchMessagesFromWA ? 
                                await sock.fetchMessagesFromWA({ jid, count: 50 }) : [];
                            
                            for (const msg of messages) {
                                if (msg.key && msg.message) {
                                    const dbMessage = {
                                        id: msg.key.id,
                                        chat_jid: msg.key.remoteJid,
                                        sender_jid: msg.key.fromMe ? 
                                            (sock.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net') : 
                                            (msg.key.participant || msg.key.remoteJid),
                                        from_me: msg.key.fromMe,
                                        message_type: Object.keys(msg.message)[0] || 'unknown',
                                        text_content: msg.message?.conversation || 
                                                     msg.message?.extendedTextMessage?.text || 
                                                     msg.message?.imageMessage?.caption || 
                                                     msg.message?.videoMessage?.caption || '',
                                        media_url: null,
                                        media_mime_type: null,
                                        timestamp: msg.messageTimestamp ? 
                                            new Date(Number(msg.messageTimestamp) * 1000) : 
                                            new Date(),
                                        status: msg.key.fromMe ? 'sent' : 'received'
                                    };
                                    
                                    await saveMessageToDB(sessionId, dbMessage);
                                    stats.messages++;
                                }
                            }
                        } catch (err) {
                            console.error(`[FORCE-SYNC] Error obteniendo mensajes de ${jid}:`, err.message);
                            stats.errors++;
                        }
                    }
                }
            }
            console.log(`[FORCE-SYNC] ✅ ${stats.messages} mensajes recientes sincronizados`);

            // Actualizar tableros Kanban con contactos nuevos
            await loadContactsToDefaultBoard(phoneNumber);
            console.log(`[FORCE-SYNC] 📋 Contactos cargados en tableros Kanban`);

            // Descargar avatares
            await downloadAllAvatars(sessionId, sock);
            console.log(`[FORCE-SYNC] 🖼️ Avatares descargados`);

            console.log(`[FORCE-SYNC] 🎉 Sincronización completa terminada!`);
            console.log(`[FORCE-SYNC]   - Contactos: ${stats.contacts}`);
            console.log(`[FORCE-SYNC]   - Grupos: ${stats.groups}`);
            console.log(`[FORCE-SYNC]   - Chats: ${stats.chats}`);
            console.log(`[FORCE-SYNC]   - Mensajes: ${stats.messages}`);
            console.log(`[FORCE-SYNC]   - Errores: ${stats.errors}`);

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error(`[FORCE-SYNC] ❌ Error en sincronización completa:`, error);
        stats.errors++;
    }

    return stats;
}

// Función para crear tableros Kanban por defecto
async function createDefaultKanbanBoards(phoneNumber) {
    if (!pool) {
        console.log(`[KANBAN-DEFAULT] Base de datos no disponible`);
        return;
    }

    const connection = await pool.getConnection();
    try {
        // Verificar si ya existen tableros para este usuario
        const [existing] = await connection.execute(
            'SELECT COUNT(*) as count FROM kanban_boards WHERE session_id = ?',
            [phoneNumber]
        );

        if (existing[0].count > 0) {
            console.log(`[KANBAN-DEFAULT] Usuario ${phoneNumber} ya tiene ${existing[0].count} tableros. No se crean tableros por defecto.`);
            return;
        }

        // Crear 4 tableros por defecto
        const defaultBoards = [
            { name: 'Sin Categoría', color: '#607d8b', order: 0, is_default: 1 },
            { name: 'Interesados', color: '#2196f3', order: 1, is_default: 0 },
            { name: 'Clientes', color: '#4caf50', order: 2, is_default: 0 },
            { name: 'Prospectos', color: '#ff9800', order: 3, is_default: 0 }
        ];

        console.log(`[KANBAN-DEFAULT] Creando ${defaultBoards.length} tableros por defecto para ${phoneNumber}...`);

        let sinCategoriaBoardId = null;

        for (const board of defaultBoards) {
            const boardId = `board_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await connection.execute(
                'INSERT INTO kanban_boards (id, session_id, name, color, board_order, is_default) VALUES (?, ?, ?, ?, ?, ?)',
                [boardId, phoneNumber, board.name, board.color, board.order, board.is_default]
            );
            console.log(`[KANBAN-DEFAULT] ✅ Tablero "${board.name}" creado`);

            // Guardar el ID del tablero "Sin Categoría"
            if (board.name === 'Sin Categoría') {
                sinCategoriaBoardId = boardId;
            }
        }

        console.log(`[KANBAN-DEFAULT] ✅ Tableros por defecto creados exitosamente para ${phoneNumber}`);

    } catch (error) {
        console.error(`[KANBAN-DEFAULT] Error creando tableros por defecto:`, error);
    } finally {
        connection.release();
    }
}

// Función para cargar contactos en el tablero "Sin Categoría"
async function loadContactsToDefaultBoard(phoneNumber) {
    if (!pool) {
        console.log(`[KANBAN-LOAD] Base de datos no disponible`);
        return;
    }

    const connection = await pool.getConnection();
    try {
        // Obtener el tablero "Sin Categoría" (is_default = 1)
        const [boards] = await connection.execute(
            'SELECT id FROM kanban_boards WHERE session_id = ? AND is_default = 1 LIMIT 1',
            [phoneNumber]
        );

        if (boards.length === 0) {
            console.log(`[KANBAN-LOAD] No se encontró tablero "Sin Categoría" para usuario ${phoneNumber}`);
            return;
        }

        const sinCategoriaBoardId = boards[0].id;

        // Verificar si ya hay contactos en el tablero
        const [existingContacts] = await connection.execute(
            'SELECT COUNT(*) as count FROM kanban_contacts WHERE board_id = ?',
            [sinCategoriaBoardId]
        );

        if (existingContacts[0].count > 0) {
            console.log(`[KANBAN-LOAD] El tablero "Sin Categoría" ya tiene ${existingContacts[0].count} contactos. No se cargan más.`);
            return;
        }

        // Obtener todos los contactos individuales del usuario
        const [contacts] = await connection.execute(
            'SELECT jid FROM contacts WHERE session_id = ? AND jid LIKE "%@s.whatsapp.net"',
            [phoneNumber]
        );

        if (contacts.length > 0) {
            console.log(`[KANBAN-LOAD] Cargando ${contacts.length} contactos en tablero "Sin Categoría"...`);

            let loadedCount = 0;
            for (const contact of contacts) {
                try {
                    await connection.execute(
                        'INSERT INTO kanban_contacts (board_id, contact_jid) VALUES (?, ?)',
                        [sinCategoriaBoardId, contact.jid]
                    );
                    loadedCount++;
                } catch (err) {
                    // Ignorar duplicados
                    if (err.code !== 'ER_DUP_ENTRY') {
                        console.error(`[KANBAN-LOAD] Error insertando contacto ${contact.jid}:`, err.message);
                    }
                }
            }

            console.log(`[KANBAN-LOAD] ✅ ${loadedCount} contactos cargados en "Sin Categoría"`);
        } else {
            console.log(`[KANBAN-LOAD] No hay contactos disponibles para cargar en "Sin Categoría"`);
        }

    } catch (error) {
        console.error(`[KANBAN-LOAD] Error cargando contactos en tablero por defecto:`, error);
    } finally {
        connection.release();
    }
}

// Función para descargar todos los avatares de contactos y grupos
// Helper para hacer llamadas a profilePictureUrl con timeout
async function safeGetProfilePicture(sock, jid, type = 'image', timeoutMs = 10000) {
    try {
        return await Promise.race([
            sock.profilePictureUrl(jid, type),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), timeoutMs)
            )
        ]);
    } catch (err) {
        return null;
    }
}

async function downloadAllAvatars(sessionId, sock) {
    if (!pool) {
        console.log(`[${sessionId}] ⚠️ Base de datos no disponible, saltando descarga de avatares`);
        return;
    }

    const connection = await pool.getConnection();
    try {
        // Obtener el número de teléfono del usuario
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            console.log(`[${sessionId}] ⚠️ No se pudo obtener el número de teléfono, saltando descarga de avatares`);
            return;
        }

        // Obtener contactos individuales sin avatar
        const [contacts] = await connection.execute(
            'SELECT jid, name FROM contacts WHERE session_id = ? AND jid LIKE "%@s.whatsapp.net" AND (avatar_url IS NULL OR avatar_url = "") LIMIT 100',
            [phoneNumber]
        );

        // Obtener grupos sin avatar
        const [groups] = await connection.execute(
            'SELECT jid, name FROM contact_groups WHERE session_id = ? AND (avatar_url IS NULL OR avatar_url = "") LIMIT 100',
            [phoneNumber]
        );

        const totalToDownload = contacts.length + groups.length;
        console.log(`[${sessionId}] 🖼️ Descargando avatares para ${contacts.length} contactos y ${groups.length} grupos (total: ${totalToDownload})...`);
        let downloadedCount = 0;
        let errorCount = 0;

        // Descargar avatares de contactos individuales
        for (const contact of contacts) {
            try {
                const profilePicUrl = await safeGetProfilePicture(sock, contact.jid, 'image');

                if (profilePicUrl) {
                    await connection.execute(
                        'UPDATE contacts SET avatar_url = ?, updated_at = NOW() WHERE jid = ? AND session_id = ?',
                        [profilePicUrl, contact.jid, phoneNumber]
                    );
                    downloadedCount++;

                    if (downloadedCount % 10 === 0) {
                        console.log(`[${sessionId}] 🖼️ Progreso: ${downloadedCount}/${totalToDownload} avatares descargados...`);
                    }
                } else {
                    const previewUrl = await safeGetProfilePicture(sock, contact.jid, 'preview');
                    if (previewUrl) {
                        await connection.execute(
                            'UPDATE contacts SET avatar_url = ?, updated_at = NOW() WHERE jid = ? AND session_id = ?',
                            [previewUrl, contact.jid, phoneNumber]
                        );
                        downloadedCount++;
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (err) {
                errorCount++;
                console.error(`[${sessionId}] ❌ Error descargando avatar de contacto ${contact.jid}:`, err.message);
            }
        }

        // Descargar avatares de grupos
        for (const group of groups) {
            try {
                const profilePicUrl = await safeGetProfilePicture(sock, group.jid, 'image');

                if (profilePicUrl) {
                    await connection.execute(
                        'UPDATE contact_groups SET avatar_url = ?, updated_at = NOW() WHERE jid = ? AND session_id = ?',
                        [profilePicUrl, group.jid, phoneNumber]
                    );
                    downloadedCount++;

                    if (downloadedCount % 10 === 0) {
                        console.log(`[${sessionId}] 🖼️ Progreso: ${downloadedCount}/${totalToDownload} avatares descargados...`);
                    }
                } else {
                    const previewUrl = await safeGetProfilePicture(sock, group.jid, 'preview');
                    if (previewUrl) {
                        await connection.execute(
                            'UPDATE contact_groups SET avatar_url = ?, updated_at = NOW() WHERE jid = ? AND session_id = ?',
                            [previewUrl, group.jid, phoneNumber]
                        );
                        downloadedCount++;
                    }
                }

                // Delay pequeño para no saturar WhatsApp (reducido para acelerar)
                await new Promise(resolve => setTimeout(resolve, 50));

            } catch (err) {
                errorCount++;
                console.error(`[${sessionId}] ❌ Error descargando avatar de grupo ${group.jid}:`, err.message);
            }
        }

        console.log(`[${sessionId}] ✅ Descarga de avatares completada: ${downloadedCount} exitosos, ${errorCount} errores`);

        // Actualizar los chats después de descargar avatares
        const updatedChats = await loadChatListFromDB(sessionId);
        io.emit(`initial-chats-${sessionId}`, { chats: updatedChats });
        console.log(`[${sessionId}] 📡 Chats actualizados con avatares emitidos al cliente`);

    } catch (error) {
        console.error(`[${sessionId}] ❌ Error en proceso de descarga de avatares:`, error.message);
    } finally {
        connection.release();
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

// Función para realizar sincronización completa activa (no solo esperar eventos)
async function performFullSync(sessionId, sock, userSessionId) {
    console.log(`[FULL-SYNC] 🔄 Iniciando sincronización completa para ${sessionId}`);
    
    const stats = {
        chats: 0,
        contacts: 0,
        groups: 0,
        errors: 0
    };

    try {
        const connection = await pool.getConnection();

        try {
            // 1. Sincronizar CHATS desde el store de Baileys
            console.log(`[FULL-SYNC] 📱 Sincronizando chats...`);
            io.to(`session-${sessionId}`).emit('sync-progress', {
                message: 'Descargando chats...',
                progress: 10
            });

            const allChats = sock.store?.chats || new Map();
            let chatArray = Array.from(allChats.values());
            
            console.log(`[FULL-SYNC] - Chats en store: ${chatArray.length}`);
            
            // Si el store está vacío, obtener de la tabla contacts existente
            if (chatArray.length === 0) {
                console.log(`[FULL-SYNC] ⚠️ Store vacío, obteniendo chats existentes de la tabla contacts...`);
                const [existingContacts] = await connection.query(
                    `SELECT jid, name FROM contacts 
                     WHERE session_id = ? AND is_group = 0 
                     ORDER BY created_at DESC`,
                    [sessionId]
                );
                chatArray = existingContacts.map(c => ({ id: c.jid, name: c.name }));
                console.log(`[FULL-SYNC] - Chats desde tabla contacts: ${chatArray.length}`);
                
                // Si aún así no hay, crear al menos el contacto propio
                if (chatArray.length === 0) {
                    console.log(`[FULL-SYNC] ⚠️ No hay chats, agregando contacto propio...`);
                    const ownJid = sock.user.id;
                    chatArray = [{ id: ownJid, name: 'Yo' }];
                }
            }
            
            for (const chat of chatArray) {
                try {
                    const chatId = chat.id;
                    const isGroup = chatId.endsWith('@g.us');
                    
                    if (!isGroup) {
                        const [existing] = await connection.query(
                            'SELECT id FROM contacts WHERE jid = ? AND session_id = ?',
                            [chatId, sessionId]
                        );

                        if (existing.length === 0) {
                            await connection.query(
                                `INSERT INTO contacts (jid, name, session_id, is_group, created_at) 
                                 VALUES (?, ?, ?, ?, NOW())`,
                                [chatId, chat.name || chatId.split('@')[0], sessionId, false]
                            );
                            stats.chats++;
                        }
                    }
                } catch (err) {
                    console.error(`[FULL-SYNC] Error guardando chat ${chat.id}:`, err.message);
                    stats.errors++;
                }
            }
            console.log(`[FULL-SYNC] ✅ ${stats.chats} chats sincronizados`);

            // 2. Sincronizar GRUPOS
            console.log(`[FULL-SYNC] 👥 Sincronizando grupos...`);
            io.to(`session-${sessionId}`).emit('sync-progress', {
                message: 'Descargando grupos...',
                progress: 40,
                chats: stats.chats
            });

            const groups = await sock.groupFetchAllParticipating();
            const groupList = Object.values(groups);

            for (const group of groupList) {
                try {
                    const [existing] = await connection.query(
                        'SELECT id FROM contact_groups WHERE jid = ? AND session_id = ?',
                        [group.id, sessionId]
                    );

                    let groupDbId;
                    if (existing.length === 0) {
                        const [result] = await connection.query(
                            `INSERT INTO contact_groups (jid, name, session_id, created_at) 
                             VALUES (?, ?, ?, NOW())`,
                            [group.id, group.subject, sessionId]
                        );
                        groupDbId = result.insertId;
                        stats.groups++;
                    } else {
                        groupDbId = existing[0].id;
                    }

                    // Guardar MIEMBROS del grupo
                    if (group.participants && group.participants.length > 0) {
                        console.log(`[FULL-SYNC] 👤 Guardando ${group.participants.length} miembros del grupo ${group.subject}`);

                        // Primero limpiar miembros existentes
                        await connection.query(
                            'DELETE FROM contact_group_members WHERE group_jid = ? AND session_id = ?',
                            [group.id, sessionId]
                        );

                        // Insertar todos los miembros con phone_number, name y notify_name
                        // Procesar en lotes para evitar sobrecarga
                        const BATCH_SIZE = 5;
                        for (let i = 0; i < group.participants.length; i += BATCH_SIZE) {
                            const batch = group.participants.slice(i, i + BATCH_SIZE);
                            
                            await Promise.all(batch.map(async (participant) => {
                                try {
                                    const contactJid = participant.id;
                                    const isAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';
                                    const isSuperAdmin = participant.admin === 'superadmin';

                                    // Extraer número de teléfono del JID
                                    let participantPhone = null;
                                    let participantName = null;
                                    let participantNotifyName = null;
                                    
                                    if (contactJid.includes('@s.whatsapp.net')) {
                                        // JID normal: "5491112345678@s.whatsapp.net"
                                        participantPhone = contactJid.split('@')[0];
                                    } else if (contactJid.includes('@lid')) {
                                        // LID: intentar resolver usando la función mejorada
                                        const lidInfo = await resolveLid(contactJid, sessionId, sock);
                                        if (lidInfo && lidInfo.phone_number) {
                                            participantPhone = lidInfo.phone_number;
                                            participantName = lidInfo.name;
                                            participantNotifyName = lidInfo.notify_name;
                                            console.log(`[FULL-SYNC] ✅ LID resuelto: ${contactJid} -> ${participantPhone}`);
                                        } else {
                                            console.log(`[FULL-SYNC] ⚠️  LID no resuelto: ${contactJid}`);
                                        }
                                    } else if (typeof contactJid === 'string' && contactJid.match(/^\d+$/)) {
                                        // Solo números
                                        participantPhone = contactJid;
                                    }

                                    // Si no obtuvimos nombre del LID, buscar en contacts
                                    if (!participantName && !participantNotifyName) {
                                        try {
                                            const [contactRows] = await connection.query(
                                                'SELECT name, notify_name FROM contacts WHERE jid = ? AND session_id = ? LIMIT 1',
                                                [contactJid, sessionId]
                                            );
                                            if (contactRows.length > 0) {
                                                participantName = contactRows[0].name;
                                                participantNotifyName = contactRows[0].notify_name;
                                            }
                                        } catch (err) {
                                            // Ignorar error
                                        }
                                    }
                                    
                                    // Si aún no hay nombre, intentar obtener de WhatsApp
                                    if (!participantName && !participantNotifyName) {
                                        try {
                                            const waName = await sock.getName(contactJid);
                                            if (waName && waName !== contactJid.split('@')[0] && !waName.includes('@')) {
                                                participantName = waName;
                                                console.log(`[FULL-SYNC] 📛 Nombre obtenido de WA: ${contactJid} -> ${waName}`);
                                            }
                                        } catch (nameErr) {
                                            // Ignorar, no hay nombre disponible
                                        }
                                    }

                                    await connection.query(
                                        `INSERT INTO contact_group_members (contact_jid, group_jid, is_admin, is_super_admin, session_id, phone_number, name, notify_name)
                                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                        [
                                            contactJid,
                                            group.id,
                                            isAdmin,
                                            isSuperAdmin,
                                            sessionId,
                                            participantPhone,
                                            participantName,
                                            participantNotifyName
                                        ]
                                    );
                                } catch (memberErr) {
                                    console.error(`[FULL-SYNC] Error guardando miembro ${participant.id}:`, memberErr.message);
                                }
                            }));
                            
                            // Pequeña pausa entre lotes
                            if (i + BATCH_SIZE < group.participants.length) {
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        }
                    }
                } catch (err) {
                    console.error(`[FULL-SYNC] Error guardando grupo ${group.id}:`, err.message);
                    stats.errors++;
                }
            }
            console.log(`[FULL-SYNC] ✅ ${stats.groups} grupos sincronizados`);

            // 3. Sincronizar CONTACTOS
            console.log(`[FULL-SYNC] 📞 Sincronizando contactos...`);
            io.to(`session-${sessionId}`).emit('sync-progress', {
                message: 'Descargando contactos...',
                progress: 70,
                chats: stats.chats,
                groups: stats.groups
            });

            const contacts = sock.store?.contacts || {};
            let contactList = Object.values(contacts);
            
            console.log(`[FULL-SYNC] - Contactos en store: ${contactList.length}`);
            
            // Si el store está vacío, obtener contactos de los participantes de grupos
            if (contactList.length === 0) {
                console.log(`[FULL-SYNC] ⚠️ Store de contactos vacío, extrayendo de miembros de grupos...`);
                
                // Obtener todos los miembros de grupos como contactos
                const [groupMembers] = await connection.query(
                    `SELECT DISTINCT cgm.contact_jid as jid, cgm.contact_jid as name
                     FROM contact_group_members cgm
                     INNER JOIN contact_groups cg ON cgm.group_jid = cg.jid
                     WHERE cgm.session_id = ?
                     AND cgm.contact_jid LIKE '%@s.whatsapp.net'
                     LIMIT 500`,
                    [sessionId]
                );
                
                contactList = groupMembers.map(c => ({ 
                    id: c.jid, 
                    name: c.jid.split('@')[0] 
                }));
                
                console.log(`[FULL-SYNC] - Contactos extraídos de grupos: ${contactList.length}`);
            }

            for (const contact of contactList) {
                try {
                    if (contact.id && !contact.id.includes('@g.us')) {
                        const [existing] = await connection.query(
                            'SELECT id FROM contacts WHERE jid = ? AND session_id = ?',
                            [contact.id, sessionId]
                        );

                        if (existing.length === 0) {
                            await connection.query(
                                `INSERT INTO contacts (jid, name, session_id, is_group, created_at) 
                                 VALUES (?, ?, ?, ?, NOW())`,
                                [contact.id, contact.name || contact.notify || contact.id.split('@')[0], sessionId, false]
                            );
                            stats.contacts++;
                        }
                    }
                } catch (err) {
                    console.error(`[FULL-SYNC] Error guardando contacto ${contact.id}:`, err.message);
                    stats.errors++;
                }
            }
            console.log(`[FULL-SYNC] ✅ ${stats.contacts} contactos sincronizados`);

            // Marcar como sincronizado en la BD
            await connection.query(
                'UPDATE users SET sync_completed = TRUE, last_sync_date = NOW() WHERE phone = ?',
                [sessionId]
            );

            // Emitir evento de finalización
            io.to(`session-${sessionId}`).emit('sync-complete', {
                message: 'Sincronización completada',
                stats: {
                    chats: stats.chats + stats.groups,
                    contacts: stats.contacts,
                    groups: stats.groups
                }
            });

            console.log(`[FULL-SYNC] 🎉 Sincronización completada!`);
            console.log(`[FULL-SYNC]   - Chats: ${stats.chats}`);
            console.log(`[FULL-SYNC]   - Contactos: ${stats.contacts}`);
            console.log(`[FULL-SYNC]   - Grupos: ${stats.groups}`);
            console.log(`[FULL-SYNC]   - Errores: ${stats.errors}`);

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error(`[FULL-SYNC] ❌ Error en sincronización:`, error);
        io.to(`session-${sessionId}`).emit('sync-error', {
            error: error.message
        });
        stats.errors++;
    }

    return stats;
}

// Helper function to load chat list from DB
async function loadChatListFromDB(sessionId, includeGroups = false) {
    // Obtener el número de teléfono del usuario en lugar de la session_id temporal
    const phoneNumber = await getUserPhoneNumber(sessionId);
    
    // Modo memoria si no hay DB
    if (process.env.SKIP_DB === 'true' || !pool || memoryStorage.isMemoryMode) {
        console.log(`[MEMORY-CHATLIST] Loading chats from memory for phone number ${phoneNumber}`);
        const chats = [];
        const chatMap = new Map();

        // Procesar mensajes en memoria para crear lista de chats (filtrar por número de teléfono como session_id)
        for (const [messageKey, message] of memoryStorage.messages) {
            if (message.session_id === phoneNumber) {
                const chatJid = message.chat_jid;
                const isGroup = chatJid.includes('@g.us');
                
                // Filtrar grupos si includeGroups es false
                if (!includeGroups && isGroup) continue;
                
                if (!chatMap.has(chatJid) || new Date(message.timestamp) > new Date(chatMap.get(chatJid).timestamp)) {
                    const contact = memoryStorage.contacts.get(chatJid);
                    chatMap.set(chatJid, {
                        id: chatJid,
                        name: contact?.name || contact?.notify_name || chatJid.split('@')[0],
                        isGroup: contact?.is_group || false,
                        lastMessage: message.text_content,
                        timestamp: new Date(message.timestamp).toISOString(),
                        fromMe: message.from_me,
                        status: message.status,
                        unreadCount: 0,
                        avatar: contact?.avatar_url || null,
                        isOnline: contact?.is_online || null
                    });
                }
            }
        }

        const chatList = Array.from(chatMap.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 25); // Limitar a los últimos 25 chats

        console.log(`[MEMORY-CHATLIST] Loaded ${chatList.length} chats from memory for phone number ${phoneNumber}`);
        return chatList;
    }

    if (!pool) {
        console.error('[DB-CHATLIST] DB Pool not initialized!');
        return [];
    }

    const connection = await pool.getConnection();
    try {
        console.log(`[DB-CHATLIST] Loading chat list for phone number ${phoneNumber}`);

        // Query modificada para usar phone_number en lugar de session_id
        // Incluye tanto contacts como contact_groups para obtener nombres y avatares correctos
        // Filtrar grupos si includeGroups es false
        const groupFilterSubquery = includeGroups ? '' : " AND chat_jid NOT LIKE '%@g.us'";
        const groupFilterMain = includeGroups ? '' : " AND m.chat_jid NOT LIKE '%@g.us'";
        
        const [rows] = await connection.execute(
            `SELECT
                m.chat_jid,
                COALESCE(
                    CASE WHEN m.chat_jid LIKE '%@g.us' THEN cg.name ELSE c.name END,
                    CASE WHEN m.chat_jid LIKE '%@g.us' THEN cg.name ELSE c.notify_name END,
                    SUBSTRING_INDEX(m.chat_jid, '@', 1)
                ) AS contact_name,
                c.notify_name AS contact_notify_name,
                CASE WHEN m.chat_jid LIKE '%@g.us' THEN 1 ELSE COALESCE(c.is_group, 0) END AS is_group,
                COALESCE(
                    CASE WHEN m.chat_jid LIKE '%@g.us' THEN cg.avatar_url ELSE c.avatar_url END
                ) AS avatar_url,
                m.text_content AS last_message_text,
                m.timestamp AS last_message_timestamp,
                m.from_me AS last_message_from_me,
                m.status AS last_message_status,
                (SELECT COUNT(*) FROM messages m2
                 WHERE m2.chat_jid = m.chat_jid
                   AND (m2.phone_number = ? OR m2.session_id = ?)
                   AND m2.from_me = false
                   AND COALESCE(m2.is_read, false) = false) AS unread_count
            FROM messages m
            JOIN (
                SELECT chat_jid, MAX(timestamp) AS max_timestamp
                FROM messages
                WHERE (phone_number = ? OR session_id = ?)
                  AND chat_jid NOT LIKE CONCAT(?, '%')
                  ${groupFilterSubquery}
                GROUP BY chat_jid
            ) latest_msg ON m.chat_jid = latest_msg.chat_jid AND m.timestamp = latest_msg.max_timestamp
            LEFT JOIN contacts c ON m.chat_jid = c.jid AND (c.phone_number = ? OR c.session_id = ?)
            LEFT JOIN contact_groups cg ON m.chat_jid = cg.jid AND cg.session_id = ?
            WHERE (m.phone_number = ? OR m.session_id = ?)
              AND m.chat_jid NOT LIKE CONCAT(?, '%')
              ${groupFilterMain}
            ORDER BY m.timestamp DESC
            LIMIT 25;`,
            [phoneNumber, phoneNumber, phoneNumber, phoneNumber, phoneNumber, phoneNumber, phoneNumber, phoneNumber, phoneNumber, phoneNumber, phoneNumber]
        );

        const chatList = rows.map(row => ({
            id: row.chat_jid,
            name: row.contact_name || row.chat_jid.split('@')[0],
            isGroup: !!row.is_group,
            lastMessage: row.last_message_text,
            timestamp: new Date(row.last_message_timestamp).toISOString(),
            fromMe: !!row.last_message_from_me,
            status: row.last_message_status,
            unreadCount: row.unread_count || 0,
            avatar: row.avatar_url || null // Ahora incluimos el avatar
        }));

        console.log(`[DB-CHATLIST] Loaded ${chatList.length} chats for phone number ${phoneNumber}`);
        return chatList;

    } catch (error) {
        console.error(`[DB-CHATLIST] Error loading chat list for session ${sessionId}:`, error);
        return [];
    } finally {
        if (connection) connection.release();
    }
}

// const messageStore = new Map(); // <-- Comentado para transicionar a DB

// Función para actualizar contactos con la mejor información de nombre disponible
async function updateContactWithAvailableInfo(sock, jid, pushName, notifyName, phoneNumber) {
    try {
        // PRIORIDAD 1: Si tenemos pushName (nombre del perfil de WhatsApp), usarlo SIEMPRE
        let contactName = pushName || notifyName || jid.split('@')[0];
        let contactNotifyName = notifyName || pushName || jid.split('@')[0];
        
        // PRIORIDAD 2: Si pushName existe y NO es el número, guardarlo directamente
        if (pushName && pushName !== jid.split('@')[0] && pushName.trim() !== '') {
            contactName = pushName;
            contactNotifyName = pushName;
            console.log(`[PUSHNAME-SAVE] ✓ Guardando pushName para ${jid.split('@')[0]}: "${pushName}"`);
            
            // Guardar INMEDIATAMENTE sin buscar en otros lugares
            await getOrInsertContact(jid, contactName, contactNotifyName, phoneNumber, sock);
            return;
        }
        
        // PRIORIDAD 3: Si NO tenemos pushName, buscar en store.contacts
        if (!pushName || pushName === jid.split('@')[0]) {
            try {
                if (sock.store?.contacts) {
                    const storeContact = sock.store.contacts.get(jid);
                    if (storeContact) {
                        if (storeContact.name && storeContact.name !== jid.split('@')[0]) {
                            contactName = storeContact.name;
                            contactNotifyName = storeContact.notify || storeContact.name;
                            console.log(`[STORE-NAME] ✓ Nombre desde store para ${jid.split('@')[0]}: "${contactName}"`);
                        } else if (storeContact.notify && storeContact.notify !== jid.split('@')[0]) {
                            contactName = storeContact.notify;
                            contactNotifyName = storeContact.notify;
                            console.log(`[STORE-NOTIFY] ✓ Notify desde store para ${jid.split('@')[0]}: "${contactName}"`);
                        } else if (storeContact.verifiedName && storeContact.verifiedName !== jid.split('@')[0]) {
                            contactName = storeContact.verifiedName;
                            contactNotifyName = storeContact.verifiedName;
                            console.log(`[VERIFIED-NAME] ✓ VerifiedName desde store para ${jid.split('@')[0]}: "${contactName}"`);
                        }
                    }
                }
            } catch (storeErr) {
                console.log(`[NAME-UPDATE] Error accediendo al store:`, storeErr.message);
            }
        }
        
        // Guardar contacto con el mejor nombre encontrado
        await getOrInsertContact(jid, contactName, contactNotifyName, phoneNumber, sock);
        
    } catch (error) {
        console.error(`[NAME-UPDATE] Error actualizando contacto:`, error.message);
    }
}

// Función para forzar actualización de nombres de contactos existentes en la base de datos
async function forceUpdateContactNamesInDatabase(sessionId) {
    console.log(`[FORCE-NAME-UPDATE] Iniciando actualización forzada de nombres para sesión: ${sessionId}`);
    
    const session = sessions.get(sessionId);
    if (!session || !session.sock) {
        console.error(`[FORCE-NAME-UPDATE] No se encontró sesión activa para: ${sessionId}`);
        return { updated: 0, total: 0 };
    }
    
    const sock = session.sock;
    const phoneNumber = await getUserPhoneNumber(sessionId);
    
    if (!pool) {
        console.error('[FORCE-NAME-UPDATE] Pool de base de datos no disponible');
        return { updated: 0, total: 0 };
    }
    
    const connection = await pool.getConnection();
    try {
        // Obtener contactos que solo tienen número como nombre (no tienen nombre real)
        const [numberOnlyContacts] = await connection.execute(`
            SELECT jid, name 
            FROM contacts 
            WHERE session_id = ? 
            AND (name IS NULL OR name = '' OR name = SUBSTRING_INDEX(jid, '@', 1))
            AND jid LIKE '%@s.whatsapp.net'
            LIMIT 100  -- Limitar para procesamiento por lotes
        `, [phoneNumber]);
        
        console.log(`[FORCE-NAME-UPDATE] Encontrados ${numberOnlyContacts.length} contactos con solo número como nombre`);
        
        let updatedCount = 0;
        
        // Procesar cada contacto para obtener su nombre real
        for (const contact of numberOnlyContacts) {
            try {
                console.log(`[FORCE-NAME-UPDATE] Procesando contacto: ${contact.jid}`);
                
                let realName = null;
                
                // Intentar obtener nombre real de WhatsApp
                try {
                    realName = await sock.getName(contact.jid).catch(() => null);
                    if (realName && realName !== contact.jid.split('@')[0]) {
                        console.log(`[FORCE-NAME-UPDATE] Nombre real obtenido vía getName para ${contact.jid}: ${realName}`);
                    }
                } catch (getNameErr) {
                    console.log(`[FORCE-NAME-UPDATE] getName falló para ${contact.jid}:`, getNameErr.message);
                }
                
                // Si getName no funciona, actualizar store y volver a intentar
                if (!realName || realName === contact.jid.split('@')[0]) {
                    try {
                        // Pedir imagen de perfil para actualizar el store
                        await sock.profilePictureUrl(contact.jid, 'image').catch(() => null);
                        
                        // Esperar a que el store se actualice
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        
                        // Verificar si el store ahora tiene el nombre
                        if (sock.store?.contacts) {
                            const storeContact = sock.store.contacts.get(contact.jid);
                            if (storeContact?.name && storeContact.name !== contact.jid.split('@')[0]) {
                                realName = storeContact.name;
                                console.log(`[FORCE-NAME-UPDATE] Nombre obtenido del store para ${contact.jid}: ${realName}`);
                            } else if (storeContact?.notify && storeContact.notify !== contact.jid.split('@')[0]) {
                                realName = storeContact.notify;
                                console.log(`[FORCE-NAME-UPDATE] NotifyName obtenido del store para ${contact.jid}: ${realName}`);
                            }
                        }
                    } catch (updateErr) {
                        console.log(`[FORCE-NAME-UPDATE] Error actualizando store para ${contact.jid}:`, updateErr.message);
                    }
                }
                
                // Si encontramos un nombre real, actualizar en la base de datos
                if (realName && realName !== contact.jid.split('@')[0] && realName.trim() !== '') {
                    await connection.execute(`
                        UPDATE contacts 
                        SET name = ?, notify_name = ?, updated_at = NOW() 
                        WHERE jid = ? AND session_id = ?
                    `, [realName, realName, contact.jid, phoneNumber]);
                    
                    console.log(`[FORCE-NAME-UPDATE] ✅ Contacto actualizado: ${contact.jid} -> "${realName}"`);
                    updatedCount++;
                } else {
                    console.log(`[FORCE-NAME-UPDATE] ❌ No se pudo obtener nombre real para: ${contact.jid}`);
                }
                
                // Pequeño delay para no sobrecargar
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (updateErr) {
                console.error(`[FORCE-NAME-UPDATE] Error actualizando contacto ${contact.jid}:`, updateErr);
            }
        }
        
        console.log(`[FORCE-NAME-UPDATE] ✅ Actualizados ${updatedCount} de ${numberOnlyContacts.length} contactos`);
        return { updated: updatedCount, total: numberOnlyContacts.length };
        
    } finally {
        connection.release();
    }
}

// Función para actualizar contactos con solo números como nombres
async function forceUpdateAllNumberOnlyContacts(sessionId) {
    console.log(`[NUMBER-UPDATE] Iniciando actualización de contactos con solo números para sesión: ${sessionId}`);
    
    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        console.log(`[NUMBER-UPDATE] Sesión no disponible para ${sessionId}`);
        return 0;
    }
    
    const sock = session.sock;
    const phoneNumber = await getUserPhoneNumber(sessionId);
    
    if (!pool || !phoneNumber) {
        console.log(`[NUMBER-UPDATE] Pool o número de teléfono no disponible para ${sessionId}`);
        return 0;
    }
    
    const connection = await pool.getConnection();
    try {
        // Buscar contactos que solo tienen números como nombres
        const [numberOnlyContacts] = await connection.execute(`
            SELECT jid, name 
            FROM contacts 
            WHERE session_id = ? 
            AND (name IS NULL OR name = '' OR name = SUBSTRING_INDEX(jid, '@', 1))
            AND jid LIKE '%@s.whatsapp.net'
            LIMIT 100
        `, [phoneNumber]);
        
        console.log(`[NUMBER-UPDATE] Encontrados ${numberOnlyContacts.length} contactos con solo números como nombres`);
        
        let updatedCount = 0;
        
        for (const contact of numberOnlyContacts) {
            try {
                console.log(`[NUMBER-UPDATE] Procesando contacto: ${contact.jid}`);
                
                let realName = null;
                
                // Intentar obtener nombre real de varias fuentes
                try {
                    // 1. Intentar con sock.getName
                    realName = await sock.getName(contact.jid).catch(() => null);
                    if (realName && realName !== contact.jid.split('@')[0] && realName.trim() !== '') {
                        console.log(`[NUMBER-UPDATE] Nombre obtenido con getName: ${realName}`);
                    }
                } catch (getNameErr) {
                    console.log(`[NUMBER-UPDATE] getName falló para ${contact.jid}:`, getNameErr.message);
                }
                
                // 2. Si getName no funciona, intentar actualizar store
                if (!realName || realName === contact.jid.split('@')[0]) {
                    try {
                        await sock.profilePictureUrl(contact.jid, 'image').catch(() => null);
                        
                        // Esperar para que el store se actualice
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        
                        // Verificar si el store ahora tiene el nombre
                        if (sock.store?.contacts) {
                            const storeContact = sock.store.contacts.get(contact.jid);
                            if (storeContact?.name && storeContact.name !== contact.jid.split('@')[0] && storeContact.name.trim() !== '') {
                                realName = storeContact.name;
                            } else if (storeContact?.notify && storeContact.notify !== contact.jid.split('@')[0] && storeContact.notify.trim() !== '') {
                                realName = storeContact.notify;
                            }
                        }
                    } catch (updateErr) {
                        console.log(`[NUMBER-UPDATE] Error actualizando store para ${contact.jid}:`, updateErr.message);
                    }
                }
                
                // 3. Si aún no tenemos nombre real, intentar desde mensajes recientes
                if (!realName || realName === contact.jid.split('@')[0]) {
                    if (sock.store?.messages) {
                        const messages = Array.from(sock.store.messages.get(contact.jid)?.values() || []);
                        if (messages.length > 0) {
                            const lastMessage = messages[messages.length - 1];
                            if (lastMessage?.pushName && lastMessage.pushName !== contact.jid.split('@')[0]) {
                                realName = lastMessage.pushName;
                            }
                        }
                    }
                }
                
                // Si finalmente conseguimos un nombre real, actualizar en la base de datos
                if (realName && realName !== contact.jid.split('@')[0] && realName.trim() !== '') {
                    await connection.execute(`
                        UPDATE contacts 
                        SET name = ?, notify_name = ?, updated_at = NOW()
                        WHERE jid = ? AND session_id = ?
                    `, [realName, realName, contact.jid, phoneNumber]);
                    
                    console.log(`[NUMBER-UPDATE] ✅ Contacto actualizado: ${contact.jid} -> "${realName}"`);
                    updatedCount++;
                } else {
                    console.log(`[NUMBER-UPDATE] ❌ No se pudo obtener nombre real para: ${contact.jid}`);
                }
                
                // Pequeño delay para no sobrecargar
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (updateErr) {
                console.error(`[NUMBER-UPDATE] Error actualizando contacto ${contact.jid}:`, updateErr.message);
            }
        }
        
        console.log(`[NUMBER-UPDATE] ✅ Actualizados ${updatedCount} contactos con nombres reales`);
        return updatedCount;
        
    } catch (error) {
        console.error(`[NUMBER-UPDATE] Error general actualizando contactos de ${sessionId}:`, error);
        return 0;
    } finally {
        if (connection) connection.release();
    }
}

// Función para actualizar contactos que solo tienen números como nombres
async function forceUpdateAllNumberOnlyContacts(sessionId) {
    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        console.log(`[NUMBER-ONLY-UPDATE] Sesión no disponible para ${sessionId}`);
        return 0;
    }
    
    const sock = session.sock;
    const phoneNumber = await getUserPhoneNumber(sessionId);
    
    if (!pool || !phoneNumber) {
        console.log(`[NUMBER-ONLY-UPDATE] Pool o número de teléfono no disponible para ${sessionId}`);
        return 0;
    }
    
    const connection = await pool.getConnection();
    try {
        // Buscar contactos que solo tienen números como nombres
        const [numberOnlyContacts] = await connection.execute(`
            SELECT jid, name 
            FROM contacts 
            WHERE session_id = ? 
            AND (name IS NULL OR name = '' OR name = SUBSTRING_INDEX(jid, '@', 1))
            AND jid LIKE '%@s.whatsapp.net'
            LIMIT 100
        `, [phoneNumber]);
        
        console.log(`[NUMBER-ONLY-UPDATE] Encontrados ${numberOnlyContacts.length} contactos con solo número como nombre`);
        
        let updatedCount = 0;
        
        for (const contact of numberOnlyContacts) {
            try {
                console.log(`[NUMBER-ONLY-UPDATE] Procesando contacto: ${contact.jid}`);
                
                // Intentar obtener nombre real de varias fuentes
                let realName = null;
                
                // 1. Intentar con sock.getName
                try {
                    realName = await sock.getName(contact.jid).catch(() => null);
                    if (realName && realName !== contact.jid.split('@')[0] && realName.trim() !== '') {
                        console.log(`[NUMBER-ONLY-UPDATE] Nombre obtenido con getName: ${realName}`);
                    }
                } catch (getNameErr) {
                    console.log(`[NUMBER-ONLY-UPDATE] getName falló para ${contact.jid}:`, getNameErr.message);
                }
                
                // 2. Si getName no funciona, actualizar store solicitando imagen de perfil
                if (!realName || realName === contact.jid.split('@')[0]) {
                    try {
                        await sock.profilePictureUrl(contact.jid, 'image').catch(() => null);
                        
                        // Esperar a que el store se actualice
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // Verificar si el store ahora tiene el nombre
                        if (sock.store?.contacts) {
                            const storeContact = sock.store.contacts.get(contact.jid);
                            if (storeContact?.name && storeContact.name !== contact.jid.split('@')[0] && storeContact.name.trim() !== '') {
                                realName = storeContact.name;
                                console.log(`[NUMBER-ONLY-UPDATE] Nombre obtenido del store actualizado: ${realName}`);
                            } else if (storeContact?.notify && storeContact.notify !== contact.jid.split('@')[0] && storeContact.notify.trim() !== '') {
                                realName = storeContact.notify;
                                console.log(`[NUMBER-ONLY-UPDATE] NotifyName obtenido del store actualizado: ${realName}`);
                            }
                        }
                    } catch (updateErr) {
                        console.log(`[NUMBER-ONLY-UPDATE] Error actualizando store para ${contact.jid}:`, updateErr.message);
                    }
                }
                
                // 3. Si aún no tenemos nombre real, intentar desde mensajes recientes
                if (!realName || realName === contact.jid.split('@')[0]) {
                    if (sock.store?.messages) {
                        const messages = Array.from(sock.store.messages.get(contact.jid)?.values() || []);
                        if (messages.length > 0) {
                            const lastMessage = messages[messages.length - 1];
                            if (lastMessage?.pushName && lastMessage.pushName !== contact.jid.split('@')[0]) {
                                realName = lastMessage.pushName;
                                console.log(`[NUMBER-ONLY-UPDATE] Nombre obtenido de mensaje: ${realName}`);
                            }
                        }
                    }
                }
                
                // Si conseguimos un nombre real, actualizar en la base de datos
                if (realName && realName !== contact.jid.split('@')[0] && realName.trim() !== '') {
                    await connection.execute(`
                        UPDATE contacts 
                        SET name = ?, notify_name = ?, updated_at = NOW()
                        WHERE jid = ? AND session_id = ?
                    `, [realName, realName, contact.jid, phoneNumber]);
                    
                    console.log(`[NUMBER-ONLY-UPDATE] ✅ Contacto actualizado: ${contact.jid} -> "${realName}"`);
                    updatedCount++;
                } else {
                    console.log(`[NUMBER-ONLY-UPDATE] ❌ No se pudo obtener nombre real para: ${contact.jid}`);
                }
                
                // Pequeño delay para no sobrecargar
                await new Promise(resolve => setTimeout(resolve, 800));
                
            } catch (updateErr) {
                console.error(`[NUMBER-ONLY-UPDATE] Error actualizando contacto ${contact.jid}:`, updateErr.message);
            }
        }
        
        console.log(`[NUMBER-ONLY-UPDATE] ✅ Actualizados ${updatedCount} de ${numberOnlyContacts.length} contactos`);
        return updatedCount;
        
    } catch (error) {
        console.error(`[NUMBER-ONLY-UPDATE] Error general actualizando contactos de ${sessionId}:`, error);
        return 0;
    } finally {
        if (connection) connection.release();
    }
}

// Función para actualizar contactos desde el store de Baileys
async function updateContactsFromStore(sock, sessionId) {
    if (!sock || !sock.store || !sock.store.contacts) {
        return 0;
    }

    const phoneNumber = await getUserPhoneNumber(sessionId);
    if (!pool || !phoneNumber) {
        return 0;
    }

    const connection = await pool.getConnection();
    try {
        let updatedCount = 0;
        
        console.log(`[STORE-UPDATE] Procesando ${sock.store.contacts.size} contactos del store para ${sessionId}`);
        
        for (const [jid, storeContact] of sock.store.contacts.entries()) {
            if (jid.includes('@s.whatsapp.net')) {
                // Verificar si el contacto tiene nombre real
                const hasRealName = storeContact.name && 
                                   storeContact.name !== jid.split('@')[0] && 
                                   storeContact.name.trim() !== '';
                
                if (hasRealName) {
                    // Actualizar solo si el contacto tiene nombre real en el store
                    await connection.execute(
                        `UPDATE contacts 
                         SET name = ?, notify_name = ?, updated_at = NOW()
                         WHERE jid = ? AND session_id = ? AND 
                               (name IS NULL OR name = '' OR name = SUBSTRING_INDEX(?, '@', 1))`,
                        [storeContact.name, storeContact.notify || storeContact.name, jid, phoneNumber, jid]
                    );
                    
                    updatedCount++;
                    console.log(`[STORE-UPDATE] Actualizado contacto ${jid} con nombre: ${storeContact.name}`);
                }
            }
        }
        
        console.log(`[STORE-UPDATE] ✅ Actualizados ${updatedCount} contactos desde el store`);
        return updatedCount;
    } catch (error) {
        console.error(`[STORE-UPDATE] Error actualizando contactos desde store:`, error);
        return 0;
    } finally {
        connection.release();
    }
}

// Función para crear una nueva sesión de WhatsApp
const createSession = async (sessionId, forceNew = false, syncHistory = true) => {
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
        console.log(`[${sessionId}] 📁 Carpeta de autenticación creada: ${AUTH_DIR}`);
    } else {
        console.log(`[${sessionId}] 📁 Usando carpeta existente: ${AUTH_DIR}`);
    }

    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        console.log(`[${sessionId}] 🔐 Auth state cargado desde: ${AUTH_DIR}`);

        // Crear almacén personalizado para chats y contactos
        const customStore = {
            contacts: new Map(),
            chats: new Map()
        };

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['WhatsFlow', 'Chrome', '120.0.0'],
            syncFullHistory: syncHistory, // Usar la preferencia del usuario
            shouldSyncHistoryMessage: (msg) => {
                // 🚫 NO sincronizar mensajes de estados/status
                if (msg?.key?.remoteJid?.includes('status@broadcast') || msg?.key?.remoteJid?.includes('@broadcast')) {
                    return false;
                }
                return syncHistory; // Usar la preferencia del usuario para otros mensajes
            },
            fireInitQueries: syncHistory, // CRÍTICO: Solo hacer queries iniciales si se quiere sincronizar
            getMessage: async (key) => {
                // 🚫 NO recuperar mensajes de estados/status
                if (key.remoteJid?.includes('status@broadcast') || key.remoteJid?.includes('@broadcast')) {
                    return undefined;
                }
                return { conversation: 'Message not available' };
            },
            // Configuración optimizada para estabilidad y uso eficiente de recursos
            keepAliveIntervalMs: 30000,           // Enviar keep-alive cada 30 segundos
            connectTimeoutMs: 60000,              // Timeout de conexión de 60 segundos
            defaultQueryTimeoutMs: 60000,         // Timeout para queries de 60 segundos
            emitOwnEvents: false,                 // No emitir eventos propios
            markOnlineOnConnect: true,            // Marcar como online al conectar
            retryRequestDelayMs: 250,             // Delay entre reintentos
            maxMsgRetryCount: 5,                  // Máximo de reintentos para mensajes
            shouldIgnoreJid: jid => {
                if (!jid) return true; // Ignorar JIDs nulos/undefined
                // 🚫 IGNORAR ESTADOS/STATUS - NO DESCARGAR
                if (jid.includes('status@broadcast') || jid.includes('@broadcast')) return true;
                // Rechazar @lid (canales de WhatsApp)
                if (jid.includes('@lid')) return true;
                // Los grupos y chats individuales se manejan normalmente
                return false;
            },
            linkPreviewImageThumbnailWidth: 192,   // Tamaño de thumbnails para previews
            // Optimizaciones para reducir uso de recursos
            maxCachedMessages: 100,               // Limitar mensajes cacheados en store
            msgRetryCount: 3,                     // Reducir reintentos para optimizar recursos
            // Usar el store personalizado
            ...customStore
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
                    const qrData = {
                        qrDataUrl,
                        sessionId,
                        timestamp: new Date().toISOString(),
                        expiresIn: 60000 // QR expira en 60 segundos
                    };

                    // Emitir evento global para que el frontend lo reciba
                    io.emit('qr-code', qrData);
                    // También emitir evento específico por sesión
                    io.emit(`qr-${sessionId}`, { qr, ...qrData });
                    // Emitir a sala de sesión específica (para clientes unidos a la sala)
                    io.to(`session-${sessionId}`).emit('qr-code', qrData);

                    console.log(`[${sessionId}] QR emitido globalmente, a sesión específica y a sala session-${sessionId}`);
                    console.log(`[${sessionId}] Clientes conectados: ${io.engine.clientsCount}`);
                }).catch(err => {
                    console.error(`[${sessionId}] Error generando QR DataURL:`, err);
                });
            }

            if (connection === 'open') {
                sessionInfo.isConnected = true;
                sessionInfo.qr = null;
                console.log(`[${sessionId}] ¡WhatsApp conectado exitosamente!`);
                
                // Log detallado para debugging
                sessionLogger.log(sessionId, 'WHATSAPP_CONNECTED', {
                    timestamp: new Date().toISOString(),
                    syncHistory: syncHistory,
                    connectionState: 'open'
                });

                // Informar sobre el estado de sincronización
                if (syncHistory) {
                    console.log(`[${sessionId}] 📥 Sincronización de historial ACTIVADA - Descargando mensajes, chats y contactos...`);
                } else {
                    console.log(`[${sessionId}] 🚫 Sincronización de historial DESACTIVADA - Solo mensajes nuevos serán capturados`);
                }

                console.log(`[${sessionId}] 🔍 INICIANDO registro de usuario...`);

                // Registrar el número de teléfono del usuario en la base de datos
                let userSessionId = null;
                let userPhoneNumber = null;
                let newSessionId = sessionId; // Por defecto, mantener el sessionId actual

                try {
                    console.log(`[${sessionId}] 🔍 Obteniendo número de teléfono...`);
                    userPhoneNumber = await getUserPhoneNumber(sessionId);
                    console.log(`[${sessionId}] 🔍 Número obtenido: ${userPhoneNumber}`);
                    if (userPhoneNumber) {
                        // ✅ GUARDAR phoneNumber en la sesión para futuras consultas
                        sessionInfo.phoneNumber = userPhoneNumber;
                        console.log(`[${sessionId}] ✅ phoneNumber guardado en sesión: ${userPhoneNumber}`);

                        // 🔒 SEGURIDAD: Invalidar sesiones anteriores del mismo número
                        console.log(`[${sessionId}] 🔐 Verificando sesiones anteriores para ${userPhoneNumber}...`);
                        let invalidatedCount = 0;

                        // Buscar y cerrar otras sesiones activas del mismo número
                        for (const [oldSessionId, oldSessionData] of sessions.entries()) {
                            if (oldSessionId !== sessionId && oldSessionData.phoneNumber === userPhoneNumber) {
                                console.log(`[${sessionId}] 🚫 Cerrando sesión anterior: ${oldSessionId}`);

                                // Cerrar socket de la sesión antigua
                                if (oldSessionData.sock) {
                                    try {
                                        await oldSessionData.sock.logout();
                                    } catch (err) {
                                        console.log(`[${oldSessionId}] Error al cerrar socket:`, err.message);
                                    }
                                }

                                // Eliminar de mapas de sesiones
                                sessions.delete(oldSessionId);
                                sessionTokenMap.delete(oldSessionId);
                                sessionDeviceMap.delete(oldSessionId);

                                // Notificar al cliente que su sesión fue cerrada
                                io.to(`session-${oldSessionId}`).emit('session-invalidated', {
                                    message: 'Tu sesión se cerró porque iniciaste sesión desde otro dispositivo',
                                    newSessionId: sessionId
                                });

                                invalidatedCount++;
                            }
                        }

                        if (invalidatedCount > 0) {
                            console.log(`[${sessionId}] ✅ ${invalidatedCount} sesión(es) anterior(es) invalidada(s)`);
                        } else {
                            console.log(`[${sessionId}] ℹ️ No hay sesiones anteriores que invalidar`);
                        }

                        userSessionId = await getOrCreateUserSession(sessionId, userPhoneNumber);
                        console.log(`[${sessionId}] Usuario registrado: ${userPhoneNumber} (user_session_id: ${userSessionId})`);

                        // ✅ CREAR/ACTUALIZAR registro en tabla users para auto_sync
                        if (pool) {
                            try {
                                const [existingUser] = await pool.query('SELECT id, auto_sync, session_id FROM users WHERE phone = ?', [userPhoneNumber]);

                                if (existingUser.length === 0) {
                                    // Crear nuevo usuario con auto_sync activado por defecto y session_id asignado
                                    await pool.query(
                                        `INSERT INTO users (name, email, password, phone, role, status, auto_sync, session_id, subscription_status, subscription_plan, subscription_days)
                                         VALUES (?, ?, ?, ?, 'admin', 'active', 1, ?, 'inactive', 'free', 0)`,
                                        [
                                            `Usuario ${userPhoneNumber}`,
                                            `${userPhoneNumber}@whatsapp.local`,
                                            'no-password',  // Sin password porque es usuario de WhatsApp
                                            userPhoneNumber,
                                            sessionId  // Asignar el session_id actual
                                        ]
                                    );
                                    console.log(`[${sessionId}] ✅ Usuario creado en tabla users con auto_sync=1, session_id=${sessionId}, plan=free (inactivo)`);
                                    console.log(`[${sessionId}] ⚠️ Super Admin debe asignar plan activo para que pueda usar el sistema`);
                                } else {
                                    // Si ya existe, actualizar el session_id si es necesario
                                    if (!existingUser[0].session_id || existingUser[0].session_id !== sessionId) {
                                        await pool.query('UPDATE users SET session_id = ? WHERE phone = ?', [sessionId, userPhoneNumber]);
                                        console.log(`[${sessionId}] ✅ Usuario existente actualizado con nuevo session_id=${sessionId}`);
                                    } else {
                                        console.log(`[${sessionId}] ℹ️ Usuario ya existe en tabla users (auto_sync: ${existingUser[0].auto_sync}, session_id: ${existingUser[0].session_id})`);
                                    }
                                }
                            } catch (userErr) {
                                console.error(`[${sessionId}] ❌ Error creando/actualizando usuario en tabla users:`, userErr.message);
                            }
                        }

                        // CRÍTICO: Si el sessionId es temporal, mover la sesión al número de teléfono
                        if (sessionId !== userPhoneNumber) {
                            console.log(`[${sessionId}] Moviendo sesión de ${sessionId} a ${userPhoneNumber}`);

                            // Copiar sesión al nuevo ID (número de teléfono)
                            sessions.set(userPhoneNumber, sessionInfo);

                            // Mover también la preferencia de sincronización
                            const syncPref = sessionSyncPreferences.get(sessionId);
                            if (syncPref !== undefined) {
                                sessionSyncPreferences.set(userPhoneNumber, syncPref);
                                sessionSyncPreferences.delete(sessionId);
                                console.log(`[${sessionId}] ✅ Preferencia de sincronización movida de ${sessionId} a ${userPhoneNumber}: ${syncPref}`);
                            } else {
                                // Por defecto FALSE si no existe
                                sessionSyncPreferences.set(userPhoneNumber, false);
                                console.log(`[${sessionId}] ⚠️ No había preferencia definida, estableciendo FALSE por defecto para ${userPhoneNumber}`);
                            }

                            // Eliminar sesión temporal
                            sessions.delete(sessionId);

                            // Actualizar newSessionId para usar en eventos
                            newSessionId = userPhoneNumber;

                            console.log(`[${userPhoneNumber}] Sesión movida exitosamente`);
                        }

                        // Crear tableros Kanban por defecto si es la primera vez
                        await createDefaultKanbanBoards(userPhoneNumber);
                    }

                    // Emitir estadísticas iniciales después de conectar
                    emitDashboardStats(userPhoneNumber);
                } catch (error) {
                    console.error(`[${sessionId}] ❌ Error registrando usuario:`, error);
                }

                console.log(`[${sessionId}] 🚀 EMITIENDO eventos connection-update con newSessionId: ${newSessionId}, phoneNumber: ${userPhoneNumber}`);

                // Emitir evento global de conexión actualizada
                io.emit('connection-update', {
                    status: 'connected',
                    sessionId: newSessionId,
                    oldSessionId: sessionId !== newSessionId ? sessionId : undefined,
                    phoneNumber: userPhoneNumber,
                    timestamp: new Date().toISOString()
                });

                console.log(`[${sessionId}] ✅ Evento connection-update EMITIDO`);

                // Emitir evento específico de WhatsApp conectado (para compatibilidad con frontend)
                io.emit('whatsapp-connected', {
                    success: true,
                    sessionId: newSessionId,
                    phoneNumber: userPhoneNumber,
                    timestamp: new Date().toISOString()
                });

                console.log(`[${sessionId}] ✅ Evento whatsapp-connected EMITIDO`);

                // Emitir a sala específica de la sesión antigua
                io.emit(`connection-${sessionId}`, {
                    status: 'connected',
                    newSessionId: newSessionId,
                    phoneNumber: userPhoneNumber
                });

                // Si cambió el sessionId, emitir también al nuevo
                if (sessionId !== newSessionId) {
                    io.emit(`connection-${newSessionId}`, {
                        status: 'connected',
                        sessionId: newSessionId,
                        phoneNumber: userPhoneNumber
                    });

                    // Emitir a sala de la nueva sesión
                    io.to(`session-${newSessionId}`).emit('connection-update', {
                        status: 'connected',
                        sessionId: newSessionId,
                        phoneNumber: userPhoneNumber
                    });
                }

                // Esperar un poco para asegurar que el store esté completamente cargado
                setTimeout(async () => {
                    try {
                        console.log(`[${newSessionId}] 🔄 Forzando carga de contactos...`);
                        
                        // Intentar forzar la carga de contactos usando diferentes métodos
                        try {
                            // Método 1: Intentar cargar contactos usando fetchStatus o getContact
                            if (sock?.contacts && typeof sock.contacts.refresh === 'function') {
                                await sock.contacts.refresh();
                                console.log(`[${newSessionId}] ✅ Contactos actualizados usando refresh()`);
                            }
                        } catch (refreshErr) {
                            console.log(`[${newSessionId}] ⚠️ Error con refresh():`, refreshErr.message);
                        }
                        
                        try {
                            // Método 2: Cargar contactos usando groupMetadata para obtener información adicional
                            const allContacts = await sock.contacts?.all ? 
                                sock.contacts.all() : 
                                sock.contacts || null;
                                
                            if (allContacts && typeof allContacts === 'object') {
                                console.log(`[${newSessionId}] ✅ Obtenidos ${Object.keys(allContacts).length} contactos del store`);
                                
                                // Actualizar contactos individuales que ya tengamos en la BD
                                for (const [jid, contact] of Object.entries(allContacts)) {
                                    if (jid.includes('@s.whatsapp.net')) {
                                        await getOrInsertContact(jid, contact.name, contact.notify, phoneNumber, sock);
                                    }
                                }
                            }
                        } catch (allErr) {
                            console.log(`[${newSessionId}] ⚠️ Error obteniendo todos los contactos:`, allErr.message);
                        }
                        
                        try {
                            // Método 3: Intentar usar fetchSync para cargar contactos
                            if (sock && typeof sock.fetchSync === 'function') {
                                await sock.fetchSync('contacts');
                                console.log(`[${newSessionId}] ✅ Solicitud de sincronización de contactos enviada`);
                            }
                        } catch (syncErr) {
                            console.log(`[${newSessionId}] ⚠️ Error con fetchSync:`, syncErr.message);
                        }
                        
                        try {
                            // Método 4: Intentar directamente con la API de Baileys para cargar contactos
                            if (sock?.user && sock?.query) {
                                const result = await sock.query({
                                    json: ["query", "Contact", sock.user.id],
                                    expect200: true,
                                    clearTimeout: 20000
                                }).catch(err => {
                                    console.log(`[${newSessionId}] ⚠️ Error en contacto query:`, err.message);
                                    return null;
                                });
                                
                                if (result) {
                                    console.log(`[${newSessionId}] ✅ Contactos cargados vía query:`, Array.isArray(result) ? result.length : 'unknown');
                                }
                            }
                        } catch (queryErr) {
                            console.log(`[${newSessionId}] ⚠️ Error en query de contactos:`, queryErr.message);
                        }
                        
                        try {
                            // Método 5: Intentar usar groupFetchAllParticipating para obtener más información
                            // Esto puede ayudar a completar información de contactos
                            const allGroups = await sock.groupFetchAllParticipating().catch(() => ({}));
                            console.log(`[${newSessionId}] ✅ Grupos participantes cargados: ${Object.keys(allGroups).length}`);
                            
                            // También procesar participantes de grupos para obtener más información de contactos
                            for (const [jid, group] of Object.entries(allGroups)) {
                                if (group.participants) {
                                    for (const participant of group.participants) {
                                        if (participant.id && participant.id.includes('@s.whatsapp.net')) {
                                            // Actualizar contacto con información del grupo
                                            await getOrInsertContact(
                                                participant.id, 
                                                participant.name || participant.id.split('@')[0], 
                                                participant.id.split('@')[0], 
                                                phoneNumber, 
                                                sock
                                            );
                                        }
                                    }
                                }
                            }
                        } catch (groupErr) {
                            console.log(`[${newSessionId}] ⚠️ Error obteniendo grupos participantes:`, groupErr.message);
                        }
                        
                        // Forzar actualización de nombres después de cargar los contactos
                        setTimeout(async () => {
                            try {
                                console.log(`[${newSessionId}] 🔄 Actualización forzada de nombres de contactos...`);
                                await updateContactNames(newSessionId);
                            } catch (updateErr) {
                                console.error(`[${newSessionId}] Error en actualización forzada de nombres:`, updateErr);
                            }
                        }, 10000); // Esperar 10 segundos para que se complete la carga de datos
                        
                    } catch (loadErr) {
                        console.log(`[${newSessionId}] ⚠️ Error general forzando carga de contactos:`, loadErr.message);
                    }
                }, 2000); // Esperar 2 segundos para que se establezca la conexión

                // SINCRONIZACIÓN AUTOMÁTICA DEL HISTORIAL COMPLETO - Basada en preferencia de usuario
                if (userSessionId) {
                    // Verificar preferencia de sincronización del usuario
                    pool.query('SELECT auto_sync, sync_completed FROM users WHERE phone = ?', [newSessionId])
                        .then(([rows]) => {
                            // Prioridad: user_sessions > users > sessionSyncPreferences > default TRUE
                            const userAutoSync = rows.length > 0 ? rows[0].auto_sync : true; // Default to true
                            const syncCompleted = rows.length > 0 ? rows[0].sync_completed : false;
                            
                            // Obtener preferencia del localStorage también (sincronizar historial al conectar)
                            const sessionSyncPref = sessionSyncPreferences.get(newSessionId) !== undefined ? 
                                sessionSyncPreferences.get(newSessionId) : true; // Default to true
                            
                            // La sincronización se activa si cualquiera de las preferencias lo permite
                            const autoSync = userAutoSync; // Usamos la de la BD como primaria
                            
                            console.log(`[${newSessionId}] 📊 Preferencias de sincronización:`);
                            console.log(`  - auto_sync (BD): ${autoSync}`);
                            console.log(`  - sync_completed: ${syncCompleted}`);
                            console.log(`  - sessionSyncPref (memoria): ${sessionSyncPref}`);

                            // Activar sincronización si está habilitada en la BD (que es lo más importante)
                            const shouldSync = autoSync;
                            
                            if (shouldSync) {
                                console.log(`[${newSessionId}] 🔄 Sincronización automática ACTIVADA`);
                                console.log(`[${newSessionId}]   Razón: auto_sync=${autoSync}, sessionSyncPref=${sessionSyncPref}, syncCompleted=${syncCompleted}`);

                                // Emitir evento al frontend indicando que inició la sincronización
                                io.to(`session-${newSessionId}`).emit('sync-start', {
                                    message: 'Sincronización automática iniciada'
                                });

                                // Ejecutar sincronización completa
                                performFullSync(newSessionId, sock, userSessionId).then(stats => {
                                    console.log(`[${newSessionId}] ✅ Sincronización completada:`, stats);

                                    // DESCARGAR AVATARES en background
                                    console.log(`[${newSessionId}] 🖼️ Iniciando descarga de avatares...`);
                                    downloadAllAvatars(newSessionId, sock).catch(err => {
                                        console.error(`[${newSessionId}] Error descargando avatares:`, err);
                                    });

                                    // Después de sincronizar, cargar y emitir la lista de chats actualizada
                                    return loadChatListFromDB(newSessionId);
                                }).then(initialChats => {
                                    // Emitir GLOBALMENTE para que el cliente que escucha este evento lo reciba
                                    io.emit(`initial-chats-${newSessionId}`, { chats: initialChats });
                                    console.log(`[${newSessionId}] Emitted initial chat list GLOBALLY for event initial-chats-${newSessionId} with ${initialChats.length} chats.`);

                                    // Emitir evento para notificar que la sincronización inicial está completa
                                    io.emit(`sync-complete-${newSessionId}`, {
                                        success: true,
                                        timestamp: new Date().toISOString(),
                                        chatCount: initialChats.length
                                    });
                                    
                                    // DESPUÉS de la sincronización, intentar actualizar nombres de contactos desde el store
                                    setTimeout(async () => {
                                        try {
                                            console.log(`[${newSessionId}] 🔄 Iniciando actualización de nombres desde store...`);
                                            // Actualización de nombres se hace automáticamente en getOrInsertContact
                                            
                                            // También intentar actualizar cualquier contacto restante que solo tenga números
                                            await forceUpdateAllNumberOnlyContacts(newSessionId);
                                        } catch (updateErr) {
                                            console.error(`[${newSessionId}] Error en actualización posterior de nombres:`, updateErr);
                                        }
                                    }, 5000); // Esperar 5 segundos para que el store esté completamente cargado
                                }).catch(syncError => {
                                    console.error(`[${newSessionId}] ❌ Error en sincronización automática:`, syncError);

                                    // Aunque falle la sincronización, intentar cargar chats existentes de la BD
                                    loadChatListFromDB(newSessionId).then(initialChats => {
                                        io.emit(`initial-chats-${newSessionId}`, { chats: initialChats });
                                        console.log(`[${newSessionId}] Emitted chat list from DB (fallback) with ${initialChats.length} chats.`);

                                        // Emitir evento de error para notificar al cliente
                                        io.emit(`sync-complete-${newSessionId}`, {
                                            success: false,
                                            error: syncError.message,
                                            timestamp: new Date().toISOString(),
                                            chatCount: initialChats.length
                                        });
                                    }).catch(e => {
                                        console.error(`[${newSessionId}] Error loading chats from DB:`, e);

                                        // Emitir evento de error al cliente
                                        io.emit(`sync-complete-${newSessionId}`, {
                                            success: false,
                                            error: e.message,
                                            timestamp: new Date().toISOString(),
                                            chatCount: initialChats.length
                                        });
                                    });
                                });
                            } else {
                                console.log(`[${newSessionId}] 🚫 Sincronización desactivada - Solo mensajes nuevos serán capturados`);
                                
                                // Cargar chats existentes sin sincronizar
                                loadChatListFromDB(newSessionId).then(initialChats => {
                                    io.emit(`initial-chats-${newSessionId}`, { chats: initialChats });
                                    console.log(`[${newSessionId}] Emitted initial chat list with ${initialChats.length} chats (no sync).`);
                                    
                                    // Emitir evento para notificar que NO se sincronizó
                                    io.emit(`sync-complete-${newSessionId}`, { 
                                        success: true,
                                        skipped: true,
                                        message: 'Sincronización desactivada',
                                        timestamp: new Date().toISOString(),
                                        chatCount: initialChats.length
                                    });
                                }).catch(e => {
                                    console.error(`[${newSessionId}] Error loading chats from DB:`, e);
                                    
                                    // Emitir evento de error al cliente
                                    io.emit(`sync-complete-${newSessionId}`, { 
                                        success: false, 
                                        error: e.message,
                                        timestamp: new Date().toISOString(),
                                        chatCount: 0
                                    });
                                });
                            }
                        }).catch(err => {
                            console.error(`[${newSessionId}] Error verificando preferencias de sincronización:`, err);
                            // En caso de error de BD, usar preferencia en memoria
                            const sessionSyncPref = sessionSyncPreferences.get(newSessionId) !== undefined ? 
                                sessionSyncPreferences.get(newSessionId) : true;
                            
                            if (sessionSyncPref) {
                                console.log(`[${newSessionId}] 🔄 Usando preferencia de memoria - Iniciando sincronización`);
                                performFullSync(newSessionId, sock, userSessionId).then(stats => {
                                    console.log(`[${newSessionId}] ✅ Sincronización completada:`, stats);
                                    downloadAllAvatars(newSessionId, sock).catch(err => {
                                        console.error(`[${newSessionId}] Error descargando avatares:`, err);
                                    });
                                    return loadChatListFromDB(newSessionId);
                                }).then(initialChats => {
                                    io.emit(`initial-chats-${newSessionId}`, { chats: initialChats });
                                    io.emit(`sync-complete-${newSessionId}`, {
                                        success: true,
                                        timestamp: new Date().toISOString(),
                                        chatCount: initialChats.length
                                    });
                                }).catch(e => {
                                    console.error(`[${newSessionId}] Error en fallback sync:`, e);
                                });
                            } else {
                                console.log(`[${newSessionId}] 🚫 Sincronización desactivada - Solo mensajes nuevos serán capturados`);
                                
                                // Cargar chats existentes sin sincronizar
                                loadChatListFromDB(newSessionId).then(initialChats => {
                                    io.emit(`initial-chats-${newSessionId}`, { chats: initialChats });
                                    console.log(`[${newSessionId}] Emitted initial chat list with ${initialChats.length} chats (no sync).`);
                                    
                                    // Emitir evento para notificar que NO se sincronizó
                                    io.emit(`sync-complete-${newSessionId}`, { 
                                        success: true,
                                        skipped: true,
                                        message: 'Sincronización desactivada',
                                        timestamp: new Date().toISOString(),
                                        chatCount: initialChats.length
                                    });
                                }).catch(e => {
                                    console.error(`[${newSessionId}] Error loading chats from DB:`, e);
                                    
                                    // Emitir evento de error al cliente
                                    io.emit(`sync-complete-${newSessionId}`, { 
                                        success: false, 
                                        error: e.message,
                                        timestamp: new Date().toISOString(),
                                        chatCount: 0
                                    });
                                });
                            }
                        }).catch(err => {
                            console.error(`[${newSessionId}] Error verificando preferencias de sincronización:`, err);
                            // En caso de error, no sincronizar por seguridad
                            console.log(`[${newSessionId}] 🚫 Error en BD - Omitiendo sincronización por seguridad`);
                        });
                } else {
                    // Si no hay userSessionId, usar preferencia en memoria
                    const sessionSyncPref = sessionSyncPreferences.get(newSessionId) !== undefined ? 
                        sessionSyncPreferences.get(newSessionId) : true;
                    
                    if (sessionSyncPref) {
                        // Intentar crear userSessionId y sincronizar
                        console.log(`[${newSessionId}] 🔄 Creando userSessionId y sincronizando...`);
                        getOrCreateUserSession(newSessionId, await getUserPhoneNumber(newSessionId))
                            .then(newUserSessionId => {
                                if (newUserSessionId) {
                                    performFullSync(newSessionId, sock, newUserSessionId).then(stats => {
                                        console.log(`[${newSessionId}] ✅ Sincronización completada:`, stats);
                                        downloadAllAvatars(newSessionId, sock).catch(err => {
                                            console.error(`[${newSessionId}] Error descargando avatares:`, err);
                                        });
                                        return loadChatListFromDB(newSessionId);
                                    }).then(initialChats => {
                                        io.emit(`initial-chats-${newSessionId}`, { chats: initialChats });
                                        io.emit(`sync-complete-${newSessionId}`, {
                                            success: true,
                                            timestamp: new Date().toISOString(),
                                            chatCount: initialChats.length
                                        });
                                    }).catch(e => {
                                        console.error(`[${newSessionId}] Error en sync sin userSession:`, e);
                                    });
                                }
                            }).catch(err => {
                                console.error(`[${newSessionId}] Error creando user session:`, err);
                            });
                    } else {
                        // Solo cargar chats existentes
                        loadChatListFromDB(newSessionId).then(initialChats => {
                            io.emit(`initial-chats-${newSessionId}`, { chats: initialChats });
                            io.emit(`sync-complete-${newSessionId}`, { 
                                success: true,
                                skipped: true,
                                message: 'Sincronización desactivada',
                                timestamp: new Date().toISOString(),
                                chatCount: initialChats.length
                            });
                        }).catch(e => {
                            console.error(`[${newSessionId}] Error loading chats from DB:`, e);
                            io.emit(`sync-complete-${newSessionId}`, { 
                                success: false, 
                                error: e.message,
                                timestamp: new Date().toISOString(),
                                chatCount: 0
                            });
                        });
                    }
                }

                // MÉTODO DE RESCATE: Si después de 30 segundos no se ha completado la sincronización,
                // forzar una carga de chats y contactos
                setTimeout(async () => {
                    try {
                        const initialChats = await loadChatListFromDB(sessionId);
                        if (initialChats.length === 0) {
                            console.log(`[${sessionId}] ⚠️  Advertencia: No se encontraron chats después de 30 segundos, forzando carga de datos...`);
                            
                            // Forzar descarga de contactos
                            if (sock.contacts && Object.keys(sock.contacts).length > 0) {
                                const phoneNumber = await getUserPhoneNumber(sessionId);
                                for (const [jid, contact] of Object.entries(sock.contacts)) {
                                    if (typeof contact === 'object' && jid.includes('@s.whatsapp.net')) {
                                        await getOrInsertContact(
                                            jid, 
                                            contact.name || contact.notify, 
                                            contact.notify || contact.name, 
                                            false, 
                                            phoneNumber
                                        );
                                    } else if (jid.includes('@g.us')) {
                                        await getOrInsertContact(
                                            jid, 
                                            contact.name || contact.subject, 
                                            contact.subject || contact.name, 
                                            true, 
                                            phoneNumber
                                        );
                                    }
                                }
                                console.log(`[${sessionId}] ✅ Forzada actualización de ${Object.keys(sock.contacts).length} contactos`);
                            }
                            
                            // Reintentar carga de chats
                            const updatedChats = await loadChatListFromDB(sessionId);
                            io.emit(`initial-chats-${sessionId}`, { chats: updatedChats });
                            console.log(`[${sessionId}] Emitted ${updatedChats.length} chats tras rescate.`);
                        }
                    } catch (rescueError) {
                        console.error(`[${sessionId}] Error en método de rescate:`, rescueError);
                    }
                }, 30000); // 30 segundos

                // La carga de contactos a través de sock.getContacts() o customStore se reemplaza/complementa
                // con getOrInsertContact en messages.upsert y contacts.update
            }

            if (connection === 'close') {
                sessionInfo.isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.output?.payload?.error || 'unknown';

                console.log(`[${sessionId}] Conexión cerrada - Código: ${statusCode}, Razón: ${reason}`);

                io.emit(`connection-${sessionId}`, { status: 'disconnected', reason });

                // Get phone number to deactivate session in DB
                const userPhoneNumber = await getUserPhoneNumber(sessionId);

                // Determinar la acción basada en el código de desconexión
                switch(statusCode) {
                    case DisconnectReason.loggedOut:
                        // Usuario cerró sesión manualmente
                        console.log(`[${sessionId}] Usuario cerró sesión (logged out)`);
                        
                        // Log detallado para debugging
                        sessionLogger.log(sessionId, 'LOGOUT_DETECTED', {
                            reason: 'DisconnectReason.loggedOut',
                            phoneNumber: userPhoneNumber,
                            timestamp: new Date().toISOString(),
                            statusCode: statusCode
                        });
                        
                        // Emitir evento al frontend para redirigir a la página principal
                        const logoutData = {
                            sessionId,
                            phoneNumber: userPhoneNumber,
                            message: 'Sesión cerrada desde el teléfono'
                        };
                        
                        // Emitir a TODOS los posibles listeners
                        io.emit('session-logged-out', logoutData); // Global
                        io.emit(`session-logged-out-${sessionId}`, logoutData); // Específico por sessionId
                        io.to(`session-${sessionId}`).emit('session-logged-out', logoutData); // A la sala
                        
                        sessionLogger.log(sessionId, 'LOGOUT_EVENTS_EMITTED', {
                            events: ['session-logged-out (global)', `session-logged-out-${sessionId}`, `sala session-${sessionId}`],
                            phoneNumber: userPhoneNumber
                        });
                        
                        if (userPhoneNumber) {
                            io.emit(`session-logged-out-${userPhoneNumber}`, logoutData); // Específico por phone
                            io.to(`session-${userPhoneNumber}`).emit('session-logged-out', logoutData); // A sala de phone
                            await deactivateUserSession(userPhoneNumber);
                        }
                        
                        console.log(`[${sessionId}] ✅ Eventos de logout emitidos - Frontend será redirigido`);
                        
                        sessions.delete(sessionId);
                        break;

                    case DisconnectReason.badSession:
                        // Sesión corrupta, eliminar archivos de auth y regenerar
                        console.log(`[${sessionId}] Sesión corrupta, eliminando archivos de auth...`);
                        sessions.delete(sessionId);
                        const authDir = path.join(__dirname, 'auth_info_multi', sessionId);
                        if (fs.existsSync(authDir)) {
                            fs.rmSync(authDir, { recursive: true, force: true });
                        }
                        if (userPhoneNumber) {
                            await deactivateUserSession(userPhoneNumber);
                        }
                        // Generar nuevo QR
                        setTimeout(() => createSession(sessionId, true), 2000);
                        break;

                    case DisconnectReason.connectionClosed:
                    case DisconnectReason.connectionLost:
                        // Problemas de red, intentar reconectar
                        console.log(`[${sessionId}] Conexión perdida, intentando reconectar...`);
                        setTimeout(() => createSession(sessionId, true), 3000);
                        break;

                    case DisconnectReason.timedOut:
                        // Timeout, reconectar
                        console.log(`[${sessionId}] Timeout de conexión, reconectando...`);
                        setTimeout(() => createSession(sessionId, true), 5000);
                        break;

                    case DisconnectReason.restartRequired:
                        // WhatsApp requiere reinicio
                        console.log(`[${sessionId}] Reinicio requerido por WhatsApp`);
                        sessions.delete(sessionId);
                        setTimeout(() => createSession(sessionId, true), 2000);
                        break;

                    default:
                        // Otros casos, intentar reconectar
                        console.log(`[${sessionId}] Desconexión desconocida (código: ${statusCode}), intentando reconectar...`);
                        setTimeout(() => createSession(sessionId, true), 3000);
                        break;
                }
            }
        });

        // Manejar mensajes entrantes
        sock.ev.on('messages.upsert', async (m) => {
            // ═══════════════════════════════════════════════════════════
            // CAPTURA DE LIDs ANTES DEL FILTRADO
            // ═══════════════════════════════════════════════════════════
            const phoneNumber = await getUserPhoneNumber(sessionId);
            
            for (const msg of m.messages) {
                // Si es mensaje de grupo y el participante es LID
                if (msg.key?.remoteJid?.includes('@g.us') && msg.key?.participant?.includes('@lid')) {
                    const lid = msg.key.participant;
                    const pushName = msg.pushName;
                    const verifiedName = msg.verifiedBizName;
                    
                    // Intentar obtener número real desde el mensaje
                    let realPhone = null;
                    if (msg.participant) {
                        realPhone = msg.participant.split('@')[0];
                    }
                    
                    // Guardar mapeo
                    await saveLidMapping(lid, null, realPhone, pushName || verifiedName, pushName, phoneNumber);
                    console.log(`[LID-CAPTURE] Capturado LID de mensaje: ${lid} -> ${pushName || realPhone || 'sin info'}`);
                }
            }
            
            // ═══════════════════════════════════════════════════════════
            // FILTRO DE MENSAJES NO DESEADOS
            // ═══════════════════════════════════════════════════════════
            const originalCount = m.messages.length;

            // Contar grupos y status antes de filtrar
            const groupMessages = m.messages.filter(msg => msg.key?.remoteJid?.includes('@g.us'));
            const statusMessages = m.messages.filter(msg => msg.key?.remoteJid?.includes('@broadcast') || msg.key?.remoteJid?.includes('status@'));

            if (groupMessages.length > 0) {
                console.log(`[${sessionId}] 🚫 IGNORANDO ${groupMessages.length} mensajes de GRUPOS`);
            }
            if (statusMessages.length > 0) {
                console.log(`[${sessionId}] 🚫 IGNORANDO ${statusMessages.length} mensajes de STATUS`);
            }

            // Filtrar SOLO mensajes individuales (sin grupos, sin status)
            m.messages = m.messages.filter(msg => {
                const jid = msg.key?.remoteJid;
                if (!jid) return false;

                // Rechazar grupos
                if (jid.includes('@g.us')) return false;

                // Rechazar status/estados
                if (jid.includes('@broadcast') || jid.includes('status@')) return false;

                // Rechazar @lid (canales)
                if (jid.includes('@lid')) return false;

                // Aceptar solo mensajes individuales (terminan en @s.whatsapp.net)
                return jid.includes('@s.whatsapp.net');
            });

            if (m.messages.length === 0) {
                console.log(`[${sessionId}] ⏭️ No hay mensajes individuales para procesar (${originalCount} filtrados)`);
                return;
            }

            console.log(`[${sessionId}] ✅ Procesando ${m.messages.length} mensajes individuales (${originalCount - m.messages.length} filtrados)`);
            // ═══════════════════════════════════════════════════════════
            
            // Verificar si se deben procesar mensajes históricos
            const syncHistory = sessionSyncPreferences.get(sessionId) || false;
            // phoneNumber ya fue declarado arriba, no re-declarar

            let autoSync = false;
            if (phoneNumber && pool) {
                try {
                    const [rows] = await pool.query('SELECT auto_sync FROM users WHERE phone = ?', [phoneNumber]);
                    autoSync = rows.length > 0 ? rows[0].auto_sync : false;
                } catch (err) {
                    console.error(`[${sessionId}] Error consultando auto_sync:`, err.message);
                }
            }

            // PERMITIR mensajes históricos (append/prepend) SOLO si syncHistory O auto_sync están activos
            if (m.type === 'append' || m.type === 'prepend') {
                if (!syncHistory && !autoSync) {
                    console.log(`[${sessionId}] 🚫 BLOQUEADO - Sincronización desactivada, ignorando ${m.messages.length} mensajes históricos tipo ${m.type}`);
                    return;
                }
                console.log(`[${sessionId}] 📥 Procesando ${m.messages.length} mensajes HISTÓRICOS tipo ${m.type} (sincronización activa)`);
            } else {
                console.log(`[${sessionId}] Procesando ${m.messages.length} mensajes tipo: ${m.type}`);
            }

            // ═══════════════════════════════════════════════════════════
            // EMISIÓN FORZADA EN TIEMPO REAL - EJECUTAR SIEMPRE
            // ═══════════════════════════════════════════════════════════
            console.log(`[${sessionId}] 🔵 INICIANDO EMISIÓN - ${m.messages.length} mensajes, tipo: ${m.type}`);
            const now = Date.now();
            for (const msg of m.messages) {
                const msgTime = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : 0;
                const ageSeconds = Math.floor((now - msgTime) / 1000);
                const isRecent = (now - msgTime) < 300000; // Últimos 5 MINUTOS
                
                console.log(`[${sessionId}] 🔍 Verificando mensaje:`, {
                    ageSeconds: ageSeconds,
                    isRecent,
                    hasKey: !!msg.key,
                    remoteJid: msg.key?.remoteJid?.substring(0, 20),
                    messageType: m.type
                });
                
                if (!isRecent) {
                    console.log(`[${sessionId}] ⏰ Mensaje antiguo (${ageSeconds}s > 300s), ignorando`);
                    continue;
                }
                if (!msg.key || !msg.key.remoteJid) {
                    console.log(`[${sessionId}] ⚠️ Sin key o remoteJid`);
                    continue;
                }
                if (msg.key.remoteJid.includes('@lid')) {
                    console.log(`[${sessionId}] 🚫 @lid ignorado`);
                    continue;
                }
                // COMENTADO: Ya NO ignoramos grupos
                // if (msg.key.remoteJid.includes('@g.us')) continue;
                
                const messageId = msg.key.id;
                const senderJid = msg.key.remoteJid;
                const textContent = msg.message?.conversation || 
                                   msg.message?.extendedTextMessage?.text ||
                                   msg.message?.imageMessage?.caption ||
                                   'Media';
                
                console.log(`[${sessionId}] 🚀🚀🚀 EMITIENDO EN TIEMPO REAL:`, {
                    id: messageId.substring(0, 20),
                    from: senderJid.substring(0, 30),
                    text: textContent.substring(0, 30),
                    isGroup: senderJid.includes('@g.us')
                });
                
                io.to(`session-${sessionId}`).emit('message', {
                    id: messageId,
                    from: senderJid,
                    chatJid: senderJid,
                    message: textContent,
                    text: textContent,
                    timestamp: new Date(msgTime).toISOString(),
                    type: 'text',
                    isFromMe: Boolean(msg.key.fromMe),
                    isGroup: senderJid.includes('@g.us'),
                    status: msg.key.fromMe ? 'sent' : 'received'
                });
                
                console.log(`[${sessionId}] ✅✅✅ EMITIDO a session-${sessionId}`);
            }
            console.log(`[${sessionId}] 🏁 EMISIÓN COMPLETADA`);
            // ═══════════════════════════════════════════════════════════

            // CAMBIO: Procesar mensajes de tipo 'notify' Y 'append' recientes (últimos 2 minutos)
            const shouldProcess = m.type === 'notify' || (m.type === 'append' && m.messages.some(msg => {
                const msgTime = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : 0;
                const now = Date.now();
                const isRecent = (now - msgTime) < 120000; // 2 minutos
                return isRecent;
            }));

            if (shouldProcess) {
                for (const msg of m.messages) {
                    const senderJid = msg.key.remoteJid; 
                    const participantJid = msg.key.participant; 
                    const messageId = msg.key.id;
                    let pushName = msg.pushName; // Puede ser el nombre del contacto o el asunto del grupo

                    // 1. REACTIVADO - Guardar contactos automáticamente desde mensajes
                    // SOLO para contactos individuales (@s.whatsapp.net), NO grupos
                    const phoneNumber = await getUserPhoneNumber(sessionId);
                    if (phoneNumber && senderJid && senderJid.includes('@s.whatsapp.net')) {
                        try {
                            // Usar la función especializada para actualizar contacto con la mejor información disponible
                            await updateContactWithAvailableInfo(sock, senderJid, pushName, pushName, phoneNumber);
                            console.log(`[${sessionId}] ✅ Contacto guardado/actualizado: ${pushName || senderJid.split('@')[0]} (${senderJid.split('@')[0]})`);

                            // Descargar avatar si no existe en la base de datos
                            if (pool) {
                                const connection = await pool.getConnection();
                                try {
                                    // Verificar si ya tiene avatar
                                    const [existingContact] = await connection.execute(
                                        'SELECT avatar_url FROM contacts WHERE jid = ? AND session_id = ?',
                                        [senderJid, phoneNumber]
                                    );

                                    const needsAvatar = !existingContact[0] || !existingContact[0].avatar_url;

                                    if (needsAvatar) {
                                        try {
                                            const avatarUrl = await sock.profilePictureUrl(senderJid, 'image').catch(() => null);
                                            if (avatarUrl) {
                                                await connection.execute(
                                                    'UPDATE contacts SET avatar_url = ?, updated_at = NOW() WHERE jid = ? AND session_id = ?',
                                                    [avatarUrl, senderJid, phoneNumber]
                                                );
                                                console.log(`[${sessionId}] 📸 Avatar descargado para ${pushName || senderJid.split('@')[0]}`);
                                            }
                                        } catch (avatarErr) {
                                            console.log(`[${sessionId}] ⚠️ No se pudo descargar avatar para ${senderJid.split('@')[0]}`);
                                        }
                                    }
                                } finally {
                                    connection.release();
                                }
                            }
                        } catch (contactErr) {
                            console.error(`[${sessionId}] Error guardando contacto:`, contactErr);
                        }
                    } else if (senderJid && senderJid.includes('@g.us')) {
                        // Para grupos, solo registrar pero no guardar automáticamente
                        console.log(`[${sessionId}] 📭 Mensaje de grupo ${senderJid.split('@')[0]} - Los grupos se sincronizan manualmente`);
                    }
                    
                    // 2. Procesar y guardar mensaje en la DB
                    // Solo procesar mensajes con contenido visible o de sistema que queramos registrar
                    if (msg.message && messageId) { 
                        const messageType = Object.keys(msg.message)[0] || 'unknown';
                        let textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                        let mediaUrl = null;
                        let mediaMimeType = null;

                        // Descargar y guardar multimedia SOLO si es mensaje tipo 'notify' (tiempo real)
                        // Los mensajes históricos (append/prepend) no tienen claves de media válidas
                        const isRealtimeMessage = m.type === 'notify';
                        
                        if (messageType === 'imageMessage' && msg.message.imageMessage) {
                            textContent = msg.message.imageMessage.caption || '';
                            mediaMimeType = msg.message.imageMessage.mimetype;
                            
                            if (isRealtimeMessage) {
                                try {
                                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                                    if (buffer) {
                                        // Limpiar extensión: "image/jpeg" -> "jpeg"
                                        const ext = mediaMimeType?.split('/')[1]?.split(';')[0]?.trim() || 'jpg';
                                        const filename = `image-${Date.now()}-${messageId.substring(0, 8)}.${ext}`;
                                        const filepath = path.join(__dirname, '../../media', filename);
                                        fs.writeFileSync(filepath, buffer);
                                        mediaUrl = `/media/${filename}`;
                                        console.log(`[${sessionId}] 📸 Imagen guardada: ${mediaUrl}`);
                                    }
                                } catch (err) {
                                    console.error(`[${sessionId}] ❌ Error descargando imagen:`, err.message);
                                    mediaUrl = null; // No guardar URL si falla la descarga
                                    textContent = textContent || '📷 Imagen';
                                }
                            } else {
                                console.log(`[${sessionId}] ⏭️ Imagen histórica ignorada (sin clave de descarga)`);
                                textContent = textContent || '📷 Imagen';
                            }
                        } else if (messageType === 'videoMessage' && msg.message.videoMessage) {
                            textContent = msg.message.videoMessage.caption || '';
                            mediaMimeType = msg.message.videoMessage.mimetype;
                            
                            if (isRealtimeMessage) {
                                try {
                                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                                    if (buffer) {
                                        // Limpiar extensión: "video/mp4" -> "mp4"
                                        const ext = mediaMimeType?.split('/')[1]?.split(';')[0]?.trim() || 'mp4';
                                        const filename = `video-${Date.now()}-${messageId.substring(0, 8)}.${ext}`;
                                        const filepath = path.join(__dirname, '../../media', filename);
                                        fs.writeFileSync(filepath, buffer);
                                        mediaUrl = `/media/${filename}`;
                                        console.log(`[${sessionId}] 🎥 Video guardado: ${mediaUrl}`);
                                    }
                                } catch (err) {
                                    console.error(`[${sessionId}] ❌ Error descargando video:`, err.message);
                                    mediaUrl = null;
                                    textContent = textContent || '🎥 Video';
                                }
                            } else {
                                console.log(`[${sessionId}] ⏭️ Video histórico ignorado (sin clave de descarga)`);
                                textContent = textContent || '🎥 Video';
                            }
                        } else if (messageType === 'audioMessage' && msg.message.audioMessage) {
                            textContent = '🔊 Audio';
                            mediaMimeType = msg.message.audioMessage.mimetype;
                            
                            if (isRealtimeMessage) {
                                try {
                                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                                    if (buffer) {
                                        // Limpiar extensión: "audio/ogg; codecs=opus" -> "ogg"
                                        const ext = mediaMimeType?.split('/')[1]?.split(';')[0]?.trim() || 'ogg';
                                        const filename = `audio-${Date.now()}-${messageId.substring(0, 8)}.${ext}`;
                                        const filepath = path.join(__dirname, '../../media', filename);
                                        fs.writeFileSync(filepath, buffer);
                                        mediaUrl = `/media/${filename}`;
                                        console.log(`[${sessionId}] 🔊 Audio guardado: ${mediaUrl}`);
                                    }
                                } catch (err) {
                                    console.error(`[${sessionId}] ❌ Error descargando audio:`, err.message);
                                    mediaUrl = null;
                                }
                            } else {
                                console.log(`[${sessionId}] ⏭️ Audio histórico ignorado (sin clave de descarga)`);
                            }
                        } else if (messageType === 'documentMessage' && msg.message.documentMessage) {
                            textContent = msg.message.documentMessage.title || msg.message.documentMessage.fileName || 'Document';
                            mediaMimeType = msg.message.documentMessage.mimetype;
                            try {
                                const buffer = await downloadMediaMessage(msg, 'buffer', {});
                                if (buffer) {
                                    const ext = msg.message.documentMessage.fileName?.split('.').pop() || 'pdf';
                                    const filename = `doc-${Date.now()}-${messageId.substring(0, 8)}.${ext}`;
                                    const filepath = path.join(__dirname, '../../media', filename);
                                    fs.writeFileSync(filepath, buffer);
                                    mediaUrl = `/media/${filename}`;
                                    console.log(`[${sessionId}] 📄 Documento guardado: ${mediaUrl}`);
                                }
                            } catch (err) {
                                console.error(`[${sessionId}] Error descargando documento:`, err);
                            }
                        } else if (messageType === 'stickerMessage' && msg.message.stickerMessage) {
                            textContent = '🎨 Sticker';
                            mediaMimeType = msg.message.stickerMessage.mimetype;
                            
                            if (isRealtimeMessage) {
                                try {
                                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                                    if (buffer) {
                                        const ext = mediaMimeType?.includes('webp') ? 'webp' : 'png';
                                        const filename = `sticker-${Date.now()}-${messageId.substring(0, 8)}.${ext}`;
                                        const filepath = path.join(__dirname, '../../media', filename);
                                        fs.writeFileSync(filepath, buffer);
                                        mediaUrl = `/media/${filename}`;
                                        console.log(`[${sessionId}] 🎨 Sticker guardado: ${mediaUrl}`);
                                    }
                                } catch (err) {
                                    console.error(`[${sessionId}] ❌ Error descargando sticker:`, err.message);
                                    mediaUrl = null;
                                }
                            } else {
                                console.log(`[${sessionId}] ⏭️ Sticker histórico ignorado (sin clave de descarga)`);
                            }
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
                        
                        // VALIDACIÓN: chat_jid NO debe ser @lid (JID de participante de grupo)
                        // Si es @lid, ignorar mensaje porque está mal formado
                        if (senderJid && senderJid.includes('@lid')) {
                            console.warn(`[${sessionId}] ⚠️ Ignorando mensaje con chat_jid @lid (participante): ${senderJid}`);
                            continue;
                        }
                        
                        const dbMessage = {
                            id: messageId,
                            chat_jid: senderJid, // El JID de la conversación (grupo o contacto)
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
                        
                        // Emitir al cliente vía Socket.IO - TODOS los mensajes para tiempo real
                        // Cambio: Removido filtro !fromMe para que también emita mensajes propios
                        if (true) { // Emitir TODOS los mensajes en tiempo real
                             // Obtener nombre y avatar del contacto desde la base de datos
                             let contactName = pushName || senderJid?.split('@')[0] || 'Desconocido';
                             let avatarUrl = null;

                             if (pool && phoneNumber && senderJid) {
                                 try {
                                     const connection = await pool.getConnection();
                                     try {
                                         const [contactData] = await connection.execute(
                                             'SELECT name, avatar_url FROM contacts WHERE jid = ? AND session_id = ? LIMIT 1',
                                             [senderJid, phoneNumber]
                                         );

                                         if (contactData[0]) {
                                             contactName = contactData[0].name || contactName;
                                             avatarUrl = contactData[0].avatar_url;
                                         }
                                     } finally {
                                         connection.release();
                                     }
                                 } catch (err) {
                                     console.error(`[${sessionId}] Error obteniendo datos del contacto:`, err);
                                 }
                             }

                             const clientMessage = {
                                id: dbMessage.id,
                                from: dbMessage.sender_jid,
                                message: dbMessage.text_content,
                                text: dbMessage.text_content,
                                text_content: dbMessage.text_content,
                                timestamp: dbMessage.timestamp.toISOString(),
                                type: dbMessage.message_type ? dbMessage.message_type.replace('Message', '').toLowerCase() : 'text', // Normalizar tipo
                                message_type: dbMessage.message_type, // Tipo original
                                media_type: dbMessage.message_type ? dbMessage.message_type.replace('Message', '').toLowerCase() : undefined,
                                isFromMe: Boolean(dbMessage.from_me),
                                from_me: Boolean(dbMessage.from_me),
                                mediaUrl: dbMessage.media_url,
                                media_url: dbMessage.media_url,
                                mediaMimeType: dbMessage.media_mime_type,
                                media_mime_type: dbMessage.media_mime_type,
                                status: dbMessage.status,
                                chatJid: dbMessage.chat_jid,
                                chat_jid: dbMessage.chat_jid,
                                senderJid: dbMessage.sender_jid,
                                sender_jid: dbMessage.sender_jid,
                                sessionId: sessionId, // Agregar sessionId para validación
                                // NUEVOS CAMPOS para nombre y avatar
                                contactName: contactName,
                                contact_name: contactName,
                                avatar: avatarUrl,
                                avatar_url: avatarUrl,
                                pushName: pushName
                            };
                            // SOLO emitir a la sesión específica, NO globalmente
                            console.log(`[${sessionId}] 🚀 PREPARANDO EMISIÓN mensaje a session-${sessionId}`);
                            console.log(`[${sessionId}] 📊 Datos del mensaje:`, {
                                id: clientMessage.id,
                                from: clientMessage.from,
                                chatJid: clientMessage.chatJid,
                                message: clientMessage.message?.substring(0, 50),
                                contactName: contactName
                            });
                            io.to(`session-${sessionId}`).emit('message', clientMessage);
                            console.log(`[${sessionId}] ✅ Nuevo mensaje emitido SOLO a session-${sessionId} de ${contactName}: ${clientMessage.message?.substring(0, 50)}`);
                            
                            // CHATBOT: Procesar mensaje entrante y responder automáticamente
                            if (textContent && senderJid && !msg.key.fromMe) {
                                try {
                                    // Usar phoneNumber si está disponible, sino sessionId
                                    const chatbotKey = phoneNumber || sessionId;
                                    console.log(`[CHATBOT] 📨 Procesando mensaje: "${textContent}" de ${senderJid} con clave ${chatbotKey}`);
                                    
                                    const botResponse = await axios.post(`http://localhost:${process.env.PORT || 3002}/api/chatbot/process-message/${chatbotKey}`, {
                                        message: textContent,
                                        from: senderJid
                                    });
                                    
                                    console.log(`[CHATBOT] 📩 Respuesta del bot:`, botResponse.data);
                                    
                                    if (botResponse.data.success && botResponse.data.botResponse) {
                                        console.log(`[CHATBOT] 🤖 Respuesta automática activada para ${senderJid}`);
                                        
                                        // Enviar cada respuesta del flujo
                                        for (const response of botResponse.data.botResponse) {
                                            // Esperar el delay configurado
                                            if (response.delay) {
                                                await new Promise(resolve => setTimeout(resolve, response.delay));
                                            }
                                            
                                            // Enviar mensaje según el tipo
                                            if (response.type === 'text') {
                                                await sock.sendMessage(senderJid, { text: response.content });
                                                console.log(`[CHATBOT] ✅ Respuesta enviada: ${response.content.substring(0, 50)}...`);
                                            } else if (response.type === 'menu' && response.options) {
                                                // Construir mensaje de menú
                                                let menuText = response.content + '\n\n';
                                                response.options.forEach((opt, idx) => {
                                                    menuText += `${idx + 1}. ${opt.text}\n`;
                                                });
                                                await sock.sendMessage(senderJid, { text: menuText });
                                                console.log(`[CHATBOT] ✅ Menú enviado con ${response.options.length} opciones`);
                                            } else if (response.type === 'image' && response.mediaUrl) {
                                                // Enviar imagen (caption opcional)
                                                const imagePath = path.join(__dirname, '../..', response.mediaUrl);
                                                if (fs.existsSync(imagePath)) {
                                                    const messageData = { image: fs.readFileSync(imagePath) };
                                                    // Solo agregar caption si existe y no está vacío
                                                    if (response.content && response.content.trim()) {
                                                        messageData.caption = response.content;
                                                    }
                                                    await sock.sendMessage(senderJid, messageData);
                                                    console.log(`[CHATBOT] 📸 Imagen enviada: ${response.fileName || response.mediaUrl}`);
                                                } else {
                                                    console.error(`[CHATBOT] ❌ Imagen no encontrada: ${imagePath}`);
                                                }
                                            } else if (response.type === 'video' && response.mediaUrl) {
                                                // Enviar video (caption opcional)
                                                const videoPath = path.join(__dirname, '../..', response.mediaUrl);
                                                if (fs.existsSync(videoPath)) {
                                                    const messageData = { video: fs.readFileSync(videoPath) };
                                                    // Solo agregar caption si existe y no está vacío
                                                    if (response.content && response.content.trim()) {
                                                        messageData.caption = response.content;
                                                    }
                                                    await sock.sendMessage(senderJid, messageData);
                                                    console.log(`[CHATBOT] 🎥 Video enviado: ${response.fileName || response.mediaUrl}`);
                                                } else {
                                                    console.error(`[CHATBOT] ❌ Video no encontrado: ${videoPath}`);
                                                }
                                            } else if (response.type === 'document' && response.mediaUrl) {
                                                // Enviar documento/PDF (sin caption, solo filename)
                                                const docPath = path.join(__dirname, '../..', response.mediaUrl);
                                                if (fs.existsSync(docPath)) {
                                                    await sock.sendMessage(senderJid, { 
                                                        document: fs.readFileSync(docPath),
                                                        fileName: response.fileName || 'documento.pdf',
                                                        mimetype: response.fileName?.endsWith('.pdf') ? 'application/pdf' : 
                                                                 response.fileName?.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                                                                 response.fileName?.endsWith('.doc') ? 'application/msword' : 'application/pdf'
                                                    });
                                                    console.log(`[CHATBOT] 📄 Documento enviado: ${response.fileName || response.mediaUrl}`);
                                                } else {
                                                    console.error(`[CHATBOT] ❌ Documento no encontrado: ${docPath}`);
                                                }
                                            } else if (response.type === 'url') {
                                                // Enviar URL
                                                await sock.sendMessage(senderJid, { text: response.content });
                                                console.log(`[CHATBOT] 🔗 URL enviada: ${response.content}`);
                                            }
                                        }
                                    } else {
                                        console.log(`[CHATBOT] ⏸️ Bot no responde - Razón: ${botResponse.data.reason || 'Sin razón'}`);
                                    }
                                } catch (botError) {
                                    console.error(`[CHATBOT] ❌ Error procesando mensaje:`, botError.message);
                                    if (botError.response) {
                                        console.error(`[CHATBOT] ❌ Respuesta de error:`, botError.response.data);
                                    }
                                }
                            }
                        }
                    } else {
                         console.log(`[${sessionId}] Ignoring message without content or ID:`, msg.key);
                    }
                }

                // Emitir estadísticas actualizadas después de procesar mensajes nuevos
                if (m.type === 'notify') {
                    const phoneNumber = await getUserPhoneNumber(sessionId);
                    if (phoneNumber) {
                        emitDashboardStats(phoneNumber);
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

                    // También actualizar campaign_recipients si este mensaje pertenece a una campaña
                    if (pool) {
                        try {
                            const connection = await pool.getConnection();
                            try {
                                await connection.execute(
                                    'UPDATE campaign_recipients SET status = ? WHERE message_id = ?',
                                    [newStatus, messageId]
                                );
                                console.log(`[${sessionId}] Campaign recipient status updated for message ${messageId} -> ${newStatus}`);
                            } finally {
                                connection.release();
                            }
                        } catch (err) {
                            console.error(`[${sessionId}] Error updating campaign recipient status:`, err);
                        }
                    }

                    // Emitir actualización de estado al cliente
                    const statusUpdate = {
                        messageId: messageId,  // Corregido para coincidir con el frontend
                        id: messageId,         // Agregar 'id' como alias para mayor compatibilidad
                        chatJid: chatJid,
                        status: newStatus,
                        sessionId: sessionId,
                        timestamp: new Date().toISOString()
                    };

                    // Emitir a la sala de la sesión
                    io.to(`session-${sessionId}`).emit('message-status-update', statusUpdate);
                    // También emitir globalmente para asegurar que el cliente lo reciba
                    io.emit('message-status-update', statusUpdate);

                    console.log(`[${sessionId}] ✅ Estado de mensaje emitido: ${messageId} -> ${newStatus}`);
                }
            }
        });

        // Capturar contactos cuando se actualicen
        sock.ev.on('contacts.update', async (contactsUpdate) => {
            // VALIDAR CONFIGURACIONES: syncHistory (localStorage) Y auto_sync (BD)
            const syncHistory = sessionSyncPreferences.get(sessionId) || false;
            const phoneNumber = await getUserPhoneNumber(sessionId);

            let autoSync = false;
            if (phoneNumber && pool) {
                try {
                    const [rows] = await pool.query('SELECT auto_sync FROM users WHERE phone = ?', [phoneNumber]);
                    autoSync = rows.length > 0 ? rows[0].auto_sync : false;
                } catch (err) {
                    console.error(`[${sessionId}] Error consultando auto_sync:`, err.message);
                }
            }

            // Si está deshabilitada la sincronización, solo registrar que se recibieron actualizaciones pero no procesar
            if (!syncHistory && !autoSync) {
                console.log(`[${sessionId}] ⚠️ Sincronización de contactos desactivada, recibiendo actualizaciones sin procesar`);
                return;
            }

            console.log(`[${sessionId}] 📇 Procesando ${contactsUpdate.length} actualizaciones de contactos...`);

            for (const contact of contactsUpdate) {
                try {
                    if (!contact.id) continue;

                    // SOLO procesar contactos individuales (@s.whatsapp.net), NO grupos
                    if (contact.id.includes('@s.whatsapp.net')) {
                        // Validar si los nombres son solo números antes de usarlos
                        const isNameJustNumber = contact.name && contact.name === contact.id.split('@')[0];
                        const isNotifyJustNumber = contact.notify && contact.notify === contact.id.split('@')[0];
                        
                        // Solo usar los nombres si no son solo números, de lo contrario dejar que getOrInsertContact obtenga el nombre real
                        const nameToUse = isNameJustNumber ? null : contact.name;
                        const notifyToUse = isNotifyJustNumber ? null : contact.notify;
                        
                        await getOrInsertContact(contact.id, nameToUse, notifyToUse, phoneNumber, sock);
                        console.log(`[${sessionId}] ✅ Contacto actualizado: ${nameToUse || notifyToUse || contact.id.split('@')[0]} (${contact.id.split('@')[0]})`);
                    }
                } catch (error) {
                    console.error(`[${sessionId}] ❌ Error actualizando contacto ${contact.id}:`, error.message);
                }
            }

            console.log(`[${sessionId}] ✅ Contactos de contacts.update procesados`);
        });

        // Capturar chats/grupos cuando se actualicen
        sock.ev.on('chats.update', async (chatsUpdate) => {
            console.log(`[${sessionId}] 🔄 chats.update: ${chatsUpdate?.length || 0} chats actualizados`);
            // Procesamiento habilitado
        });

        // ⭐ EVENTO CRÍTICO: chats.set - Se dispara al conectar con TODOS los chats
        sock.ev.on('chats.set', async (chatsSet) => {
            // Obtener phoneNumber
            const phoneNumber = await getUserPhoneNumber(sessionId);
            
            console.log(`[${sessionId}] 💾 Recibidos ${chatsSet.chats?.length || 0} chats en chats.set - SINCRONIZANDO SIEMPRE`);
            
            // ═══════════════════════════════════════════════════════════
            // FILTRO DE GRUPOS: Solo procesar chats individuales
            // ═══════════════════════════════════════════════════════════
            const totalChats = chatsSet.chats?.length || 0;
            chatsSet.chats = chatsSet.chats?.filter(chat => !chat.id?.includes('@g.us')) || [];
            const filteredChats = chatsSet.chats.length;
            
            if (totalChats > filteredChats) {
                console.log(`[${sessionId}] 🚫 FILTRADOS ${totalChats - filteredChats} grupos. Procesando solo ${filteredChats} chats individuales`);
            }
            // ═══════════════════════════════════════════════════════════

            if (!phoneNumber) {
                console.error(`[${sessionId}] ❌ No se pudo obtener phoneNumber para sessionId. Saltando guardado de chats.`);
                return;
            }

            for (const chat of chatsSet.chats) {
                try {
                    const chatJid = chat.id;
                    if (!chatJid) continue;

                    const chatName = chat.name || chat.subject || chatJid.split('@')[0];

                    if (chatJid.includes('@s.whatsapp.net')) {
                        await getOrInsertContact(chatJid, chatName, chatName, phoneNumber, sock);
                    } else if (chatJid.includes('@g.us')) {
                        await getOrInsertWhatsAppGroup(chatJid, chatName, chatName, phoneNumber, null, sock);
                    } else if (chatJid.includes('status@broadcast') || chatJid.includes('@broadcast')) {
                        await getOrInsertBroadcast(chatJid, chatName || 'Status', phoneNumber, 'status');
                    } else if (chatJid.includes('@lid')) {
                        await getOrInsertBroadcast(chatJid, chatName || 'Newsletter', phoneNumber, 'newsletter');
                    }
                } catch (err) {
                    console.error(`[${sessionId}] Error guardando chat de chats.set:`, err.message);
                }
            }
            console.log(`[${sessionId}] ✅ Chats de chats.set procesados`);
        });

        // ⭐ EVENTO CRÍTICO: contacts.set - Se dispara al conectar con TODOS los contactos
        sock.ev.on('contacts.set', async (contactsSet) => {
            // VALIDAR AMBAS CONFIGURACIONES: syncHistory (localStorage) Y auto_sync (BD)
            const syncHistory = sessionSyncPreferences.get(sessionId) || false;

            // Obtener phoneNumber primero para consultar auto_sync
            const phoneNumber = await getUserPhoneNumber(sessionId);

            // Consultar auto_sync de la BD si existe el phoneNumber
            let autoSync = false;
            if (phoneNumber && pool) {
                try {
                    const [rows] = await pool.query('SELECT auto_sync FROM users WHERE phone = ?', [phoneNumber]);
                    autoSync = rows.length > 0 ? rows[0].auto_sync : false;
                } catch (err) {
                    console.error(`[${sessionId}] Error consultando auto_sync:`, err.message);
                }
            }

            // Si está deshabilitada la sincronización, solo registrar que se recibieron contactos pero no procesar
            if (!syncHistory && !autoSync) {
                console.log(`[${sessionId}] ⚠️ Sincronización de contactos desactivada (syncHistory: ${syncHistory}, auto_sync: ${autoSync}), recibiendo ${contactsSet.contacts?.length || 0} contactos sin procesar`);
                // Aún así emitir evento para que el frontend sepa que hay nuevos contactos disponibles
                io.emit(`contacts-available-${sessionId}`, { count: contactsSet.contacts?.length || 0 });
                return;
            }

            console.log(`[${sessionId}] 💾 Recibidos ${contactsSet.contacts?.length || 0} contactos en contacts.set (syncHistory: ${syncHistory}, auto_sync: ${autoSync})`);

            if (!phoneNumber) {
                console.error(`[${sessionId}] ❌ No se pudo obtener phoneNumber para sessionId. Saltando guardado de contactos.`);
                return;
            }

            for (const contact of contactsSet.contacts) {
                try {
                    const contactJid = contact.id;
                    if (!contactJid) continue;

                    if (contactJid.includes('@s.whatsapp.net')) {
                        // Para contactos individuales, validar si el nombre es solo el número antes de guardarlo
                        const isNameJustNumber = contact.name && contact.name === contactJid.split('@')[0];
                        const isNotifyJustNumber = contact.notify && contact.notify === contactJid.split('@')[0];
                        
                        // Solo usar los nombres si no son solo números, de lo contrario dejar que getOrInsertContact los obtenga de WhatsApp
                        const nameToUse = isNameJustNumber ? null : contact.name;
                        const notifyToUse = isNotifyJustNumber ? null : contact.notify;
                        
                        await getOrInsertContact(contactJid, nameToUse, notifyToUse, phoneNumber, sock);
                    } else if (contactJid.includes('@g.us')) {
                        // Para grupos, usar la lógica existente
                        await getOrInsertWhatsAppGroup(contactJid, contact.name, contact.subject, phoneNumber, contact, sock);
                    } else if (contactJid.includes('status@broadcast') || contactJid.includes('@broadcast')) {
                        await getOrInsertBroadcast(contactJid, contact.name || 'Status', phoneNumber, 'status');
                    } else if (contactJid.includes('@lid')) {
                        await getOrInsertBroadcast(contactJid, contact.name || 'Newsletter', phoneNumber, 'newsletter');
                    }
                } catch (err) {
                    console.error(`[${sessionId}] Error guardando contacto de contacts.set:`, err.message);
                }
            }
            console.log(`[${sessionId}] ✅ Contactos de contacts.set procesados`);
        });

        // ⭐ EVENTO CRÍTICO: messaging-history.set - Historial de mensajes completo
        sock.ev.on('messaging-history.set', async (historySet) => {
            const phoneNumber = await getUserPhoneNumber(sessionId);
            const userSessionId = await getUserSessionId(sessionId);
            
            console.log(`[${sessionId}] 📥 Procesando historial completo (chats: ${historySet.chats?.length || 0}, contactos: ${historySet.contacts?.length || 0}, mensajes: ${historySet.messages?.length || 0}) - SINCRONIZANDO SIEMPRE`);

            if (!phoneNumber) {
                console.error(`[${sessionId}] ❌ No se pudo obtener phoneNumber para sessionId. Saltando sincronización de historial.`);
                return;
            }

            if (!userSessionId) {
                console.error(`[${sessionId}] ❌ No se pudo obtener userSessionId para sessionId. Saltando sincronización de historial.`);
                return;
            }

            // ═══════════════════════════════════════════════════════════
            // FILTRO DE GRUPOS: No procesar chats de grupos
            // ═══════════════════════════════════════════════════════════
            const totalHistoryChats = historySet.chats?.length || 0;
            historySet.chats = historySet.chats?.filter(chat => !chat.id?.includes('@g.us')) || [];
            
            if (totalHistoryChats > historySet.chats.length) {
                console.log(`[${sessionId}] 🚫 FILTRADOS ${totalHistoryChats - historySet.chats.length} grupos del historial`);
            }
            
            // Filtrar mensajes de grupos
            const totalHistoryMessages = historySet.messages?.length || 0;
            historySet.messages = historySet.messages?.filter(msg => !msg.key?.remoteJid?.includes('@g.us')) || [];
            
            if (totalHistoryMessages > historySet.messages.length) {
                console.log(`[${sessionId}] 🚫 FILTRADOS ${totalHistoryMessages - historySet.messages.length} mensajes de grupos del historial`);
            }
            // ═══════════════════════════════════════════════════════════
            
            // Procesar CHATS del historial
            if (historySet.chats && historySet.chats.length > 0) {
                console.log(`[${sessionId}] 💾 Guardando ${historySet.chats.length} chats individuales del historial...`);
                for (const chat of historySet.chats) {
                    try {
                        const chatJid = chat.id;
                        if (!chatJid) continue;

                        const chatName = chat.name || chat.subject || chatJid.split('@')[0];

                        // Filtrar y clasificar por tipo de JID
                        if (chatJid.includes('@s.whatsapp.net')) {
                            // Contacto individual
                            await getOrInsertContact(chatJid, chatName, chatName, phoneNumber, sock);

                            // Descargar avatar para contactos
                            try {
                                const profilePicUrl = await safeGetProfilePicture(sock, chatJid, 'image');
                                if (profilePicUrl && pool) {
                                    const connection = await pool.getConnection();
                                    try {
                                        await connection.execute(
                                            'UPDATE contacts SET avatar_url = ? WHERE jid = ? AND session_id = ?',
                                            [profilePicUrl, chatJid, phoneNumber]
                                        );
                                        console.log(`[${sessionId}] 🖼️ Avatar descargado para contacto: ${chatName}`);
                                    } finally {
                                        connection.release();
                                    }
                                }
                            } catch (avatarErr) {
                                // Ignorar errores de avatar
                            }
                        } else if (chatJid.includes('@g.us')) {
                            // Grupo de WhatsApp
                            await getOrInsertWhatsAppGroup(chatJid, chatName, chatName, phoneNumber, null, sock);

                            // Descargar avatar para grupos
                            try {
                                const profilePicUrl = await safeGetProfilePicture(sock, chatJid, 'image');
                                if (profilePicUrl && pool) {
                                    const connection = await pool.getConnection();
                                    try {
                                        await connection.execute(
                                            'UPDATE contact_groups SET avatar_url = ? WHERE jid = ? AND session_id = ?',
                                            [profilePicUrl, chatJid, phoneNumber]
                                        );
                                        console.log(`[${sessionId}] 🖼️ Avatar descargado para grupo: ${chatName}`);
                                    } finally {
                                        connection.release();
                                    }
                                }
                            } catch (avatarErr) {
                                // Ignorar errores de avatar
                            }

                            // Intentar obtener metadata del grupo para participantes
                            try {
                                const metadata = await sock.groupMetadata(chatJid).catch(() => null);
                                if (metadata && metadata.participants) {
                                    await insertGroupMembers(chatJid, metadata.participants, phoneNumber);
                                    console.log(`[${sessionId}] 👥 Miembros guardados para grupo: ${chatName}`);
                                }
                            } catch (metaErr) {
                                // Ignorar errores de metadata
                            }
                        } else if (chatJid.includes('status@broadcast') || chatJid.includes('@broadcast')) {
                            // Status/Broadcast
                            await getOrInsertBroadcast(chatJid, chatName || 'Status', phoneNumber, 'status');
                            console.log(`[${sessionId}] 📢 Broadcast guardado: ${chatJid}`);
                        } else if (chatJid.includes('@lid')) {
                            // Newsletter
                            await getOrInsertBroadcast(chatJid, chatName || 'Newsletter', phoneNumber, 'newsletter');
                            console.log(`[${sessionId}] 📰 Newsletter guardado: ${chatJid}`);
                        } else {
                            console.log(`[${sessionId}] ⚠️ Unknown chat type: ${chatJid}`);
                        }
                    } catch (err) {
                        console.error(`[${sessionId}] Error guardando chat del historial:`, err.message);
                    }
                }
                console.log(`[${sessionId}] ✅ Chats del historial guardados`);
            }

            // Procesar CONTACTOS del historial
            if (historySet.contacts && historySet.contacts.length > 0) {
                console.log(`[${sessionId}] 💾 Guardando ${historySet.contacts.length} contactos del historial...`);
                for (const contact of historySet.contacts) {
                    try {
                        const contactJid = contact.id;
                        if (!contactJid) continue;

                        // Definir contactName desde el inicio
                        const contactName = contact.name || contact.notify || contactJid.split('@')[0];

                        // Filtrar y clasificar por tipo de JID
                        if (contactJid.includes('@s.whatsapp.net')) {
                            // Contacto individual
                            // No usar contact.name o contact.notify directamente si son solo el número
                            // Dejar que getOrInsertContact obtenga el nombre más preciso de WhatsApp
                            await getOrInsertContact(contactJid, contact.name, contact.notify, phoneNumber, sock);

                            // Descargar avatar
                            try {
                                const profilePicUrl = await sock.profilePictureUrl(contactJid, 'image').catch(() => null);
                                if (profilePicUrl && pool) {
                                    const connection = await pool.getConnection();
                                    try {
                                        await connection.execute(
                                            'UPDATE contacts SET avatar_url = ? WHERE jid = ? AND session_id = ?',
                                            [profilePicUrl, contactJid, phoneNumber]
                                        );
                                        console.log(`[${sessionId}] 🖼️ Avatar descargado para contacto: ${contactName}`);
                                    } finally {
                                        connection.release();
                                    }
                                }
                            } catch (avatarErr) {
                                // Ignorar errores de avatar
                            }
                        } else if (contactJid.includes('@g.us')) {
                            // Grupo de WhatsApp
                            const groupId = await getOrInsertWhatsAppGroup(contactJid, contactName, contactName, phoneNumber, null, sock);

                            // Descargar avatar
                            try {
                                const profilePicUrl = await sock.profilePictureUrl(contactJid, 'image').catch(() => null);
                                if (profilePicUrl && pool) {
                                    const connection = await pool.getConnection();
                                    try {
                                        await connection.execute(
                                            'UPDATE contact_groups SET avatar_url = ? WHERE jid = ? AND session_id = ?',
                                            [profilePicUrl, contactJid, phoneNumber]
                                        );
                                        console.log(`[${sessionId}] 🖼️ Avatar descargado para grupo: ${contactName}`);
                                    } finally {
                                        connection.release();
                                    }
                                }
                            } catch (avatarErr) {
                                // Ignorar errores de avatar
                            }
                        } else if (contactJid.includes('status@broadcast') || contactJid.includes('@broadcast')) {
                            // Status/Broadcast
                            await getOrInsertBroadcast(contactJid, contactName || 'Status', phoneNumber, 'status');
                            console.log(`[${sessionId}] 📢 Broadcast guardado: ${contactJid}`);
                        } else if (contactJid.includes('@lid')) {
                            // Newsletter
                            await getOrInsertBroadcast(contactJid, contactName || 'Newsletter', phoneNumber, 'newsletter');
                            console.log(`[${sessionId}] 📰 Newsletter guardado: ${contactJid}`);
                        } else {
                            console.log(`[${sessionId}] ⚠️ Unknown contact type: ${contactJid}`);
                        }
                    } catch (err) {
                        console.error(`[${sessionId}] Error guardando contacto del historial:`, err.message);
                    }
                }
                console.log(`[${sessionId}] ✅ Contactos del historial guardados`);
            }

            // Procesar MENSAJES del historial
            if (historySet.messages && historySet.messages.length > 0) {
                console.log(`[${sessionId}] 💾 Guardando ${historySet.messages.length} mensajes del historial...`);
                let savedCount = 0;

                for (const msg of historySet.messages) {
                    try {
                        const senderJid = msg.key.remoteJid;
                        const participantJid = msg.key.participant;
                        const messageId = msg.key.id;

                        if (!senderJid || !messageId || !msg.message) continue;

                        // Guardar contacto/grupo según el tipo
                        const phoneNumber = await getUserPhoneNumber(sessionId);

                        // Clasificar el chat origen del mensaje
                        if (senderJid.includes('@s.whatsapp.net')) {
                            // Mensaje de contacto individual
                            await getOrInsertContact(senderJid, msg.pushName, msg.pushName, phoneNumber, sock);
                        } else if (senderJid.includes('@g.us')) {
                            // Mensaje de grupo
                            await getOrInsertWhatsAppGroup(senderJid, null, null, phoneNumber, null, sock);

                            // Si hay participante (mensaje en grupo), guardar como contacto individual
                            if (participantJid && participantJid.includes('@s.whatsapp.net')) {
                                await getOrInsertContact(participantJid, msg.pushName, msg.pushName, phoneNumber, sock);
                            }
                        } else if (senderJid.includes('status@broadcast') || senderJid.includes('@broadcast')) {
                            // Mensaje de broadcast
                            await getOrInsertBroadcast(senderJid, 'Status', phoneNumber, 'status');
                        } else if (senderJid.includes('@lid')) {
                            // Mensaje de newsletter
                            await getOrInsertBroadcast(senderJid, 'Newsletter', phoneNumber, 'newsletter');
                        }

                        // Extraer contenido del mensaje
                        const messageType = Object.keys(msg.message)[0] || 'unknown';
                        let textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                        let mediaUrl = null;
                        let mediaMimeType = null;

                        if (messageType === 'imageMessage' && msg.message.imageMessage) {
                            textContent = msg.message.imageMessage.caption || '';
                            mediaMimeType = msg.message.imageMessage.mimetype;
                        }

                        const ownJid = sessionInfo.sock?.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net';
                        const finalSenderJid = msg.key.fromMe ? ownJid : (participantJid || senderJid);

                        const dbMessage = {
                            id: messageId,
                            chat_jid: senderJid,
                            sender_jid: finalSenderJid,
                            from_me: msg.key.fromMe,
                            message_type: messageType,
                            text_content: textContent,
                            media_url: mediaUrl,
                            media_mime_type: mediaMimeType,
                            timestamp: msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date(),
                            status: msg.key.fromMe ? 'sent' : 'received'
                        };

                        await saveMessageToDB(sessionId, dbMessage);
                        savedCount++;

                        if (savedCount % 100 === 0) {
                            console.log(`[${sessionId}] 📊 Procesados ${savedCount}/${historySet.messages.length} mensajes históricos...`);
                        }

                    } catch (err) {
                        console.error(`[${sessionId}] Error guardando mensaje del historial:`, err.message);
                    }
                }
                console.log(`[${sessionId}] ✅ ${savedCount} mensajes del historial guardados`);
            }

            console.log(`[${sessionId}] 🎉 Sincronización de historial completada!`);

            // Emitir evento al frontend para notificar la sincronización completada
            io.emit('sync-completed', {
                sessionId,
                phoneNumber,
                timestamp: new Date().toISOString(),
                stats: {
                    chats: historySet.chats?.length || 0,
                    contacts: historySet.contacts?.length || 0,
                    messages: historySet.messages?.length || 0
                }
            });

            // Actualizar nombres de contactos existentes con la información más reciente
            setTimeout(async () => {
                try {
                    console.log(`[${sessionId}] 🔄 Actualizando nombres de contactos existentes...`);
                    await updateContactNames(sessionId);
                } catch (err) {
                    console.error(`[${sessionId}] Error en actualización de nombres:`, err);
                }
            }, 5000); // Ejecutar después de 5 segundos para permitir que termine la sincronización principal

            // Enviar lista actualizada de chats al frontend
            setTimeout(async () => {
                try {
                    console.log(`[${sessionId}] 📤 Enviando lista de chats actualizada al frontend...`);
                    const chats = await loadChatListFromDB(sessionId);
                    io.emit('chats-updated', {
                        sessionId,
                        chats
                    });
                    console.log(`[${sessionId}] ✅ ${chats.length} chats enviados al frontend`);
                } catch (err) {
                    console.error(`[${sessionId}] Error enviando chats al frontend:`, err.message);
                }
            }, 1000);

            // Cargar contactos en tablero "Sin Categoría" después de sincronizar
            setTimeout(async () => {
                try {
                    console.log(`[${sessionId}] 📋 Verificando tableros Kanban para cargar contactos...`);
                    const phoneNumber = await getUserPhoneNumber(sessionId);
                    if (phoneNumber && pool) {
                        await loadContactsToDefaultBoard(phoneNumber);
                    }
                } catch (err) {
                    console.error(`[${sessionId}] Error cargando contactos a tablero por defecto:`, err.message);
                }
            }, 2000);

            // Descargar avatares en batch después de sincronizar
            setTimeout(async () => {
                console.log(`[${sessionId}] 🖼️ Iniciando descarga de avatares...`);
                await downloadAllAvatars(sessionId, sock);
            }, 3000);
        });

        sock.ev.on('creds.update', async () => {
            console.log(`[${sessionId}] 💾 Guardando credenciales en: ${AUTH_DIR}`);
            await saveCreds();
        });
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

// ============= SISTEMA DE RECORDATORIOS AUTOMÁTICOS =============

async function checkAndSendReminders() {
    if (!pool) {
        console.log('[REMINDERS] Pool no disponible, saltando verificación');
        return;
    }

    try {
        const connection = await pool.getConnection();

        try {
            // Obtener citas que necesitan recordatorio (usando reminder_time de cada cita)
            const [reminders] = await connection.execute(`
                SELECT
                    a.id as appointment_id,
                    a.session_id,
                    a.patient_name,
                    a.patient_phone,
                    a.doctor_name,
                    a.company_name,
                    a.appointment_date,
                    a.appointment_time,
                    a.reminder_time,
                    a.notification_template
                FROM appointments a
                WHERE a.status IN ('scheduled', 'confirmed')
                  AND a.reminder_time IS NOT NULL
                  AND a.reminder_time > 0
                  AND TIMESTAMPDIFF(MINUTE, NOW(), CONCAT(a.appointment_date, ' ', a.appointment_time)) <= a.reminder_time
                  AND TIMESTAMPDIFF(MINUTE, NOW(), CONCAT(a.appointment_date, ' ', a.appointment_time)) > 0
                  AND NOT EXISTS (
                      SELECT 1 FROM appointment_reminders_sent ars
                      WHERE ars.appointment_id = a.id
                  )
                LIMIT 50
            `);

            if (reminders.length > 0) {
                console.log(`[REMINDERS] Procesando ${reminders.length} recordatorios pendientes`);
            }

            for (const reminder of reminders) {
                try {
                    let message = '';

                    // Obtener plantilla desde appointment_templates usando notification_template
                    if (reminder.notification_template && reminder.notification_template !== 'default') {
                        const [templates] = await connection.execute(
                            `SELECT message_text FROM appointment_templates 
                             WHERE session_id = ? AND name = ?`,
                            [reminder.session_id, reminder.notification_template]
                        );

                        if (templates.length > 0) {
                            message = templates[0].message_text;
                        }
                    }

                    // Si no hay plantilla, usar mensaje por defecto
                    if (!message) {
                        const reminderMinutes = reminder.reminder_time;
                        let timeText = '';
                        if (reminderMinutes < 60) {
                            timeText = `${reminderMinutes} minutos`;
                        } else if (reminderMinutes === 60) {
                            timeText = '1 hora';
                        } else if (reminderMinutes < 1440) {
                            timeText = `${Math.floor(reminderMinutes / 60)} horas`;
                        } else {
                            timeText = `${Math.floor(reminderMinutes / 1440)} días`;
                        }
                        
                        message = `🏥 *Recordatorio de Cita*\n\nHola *{patient_name}* 👋\n\nTe recordamos que tienes una cita programada en ${timeText}.\n\n📅 *Fecha:* {date}\n⏰ *Hora:* {time}\n\n¡Te esperamos! 😊`;
                    }

                    // Reemplazar variables
                    message = message.replace(/{patient_name}/g, reminder.patient_name || 'Estimado/a');
                    message = message.replace(/{doctor_name}/g, reminder.doctor_name || '');
                    message = message.replace(/{company_name}/g, reminder.company_name || '');
                    message = message.replace(/{date}/g, moment(reminder.appointment_date).format('DD/MM/YYYY') || '');
                    message = message.replace(/{time}/g, reminder.appointment_time || '');

                    // Limpiar variables no reemplazadas
                    message = message.replace(/{[^}]+}/g, '').trim();

                    // Intentar enviar mensaje por WhatsApp
                    const session = sessions.get(reminder.session_id);

                    if (session && session.sock && session.isConnected) {
                        // Limpiar y formatear número de teléfono
                        let phone = reminder.patient_phone.replace(/[\s\-\(\)\.]/g, '');
                        if (phone.startsWith('0')) {
                            phone = phone.substring(1);
                        }
                        if (!phone.startsWith('595')) {
                            phone = '595' + phone;
                        }

                        const jid = `${phone}@s.whatsapp.net`;

                        await session.sock.sendMessage(jid, { text: message });

                        // Registrar envío exitoso
                        await connection.execute(
                            `INSERT INTO appointment_reminders_sent
                             (appointment_id, hours_before, message_text, status)
                             VALUES (?, ?, ?, 'sent')`,
                            [reminder.appointment_id, Math.ceil(reminder.reminder_time / 60), message]
                        );

                        console.log(`✅ [REMINDERS] Recordatorio enviado a ${reminder.patient_name} (${reminder.patient_phone}) - ${reminder.reminder_time} minutos antes`);
                    } else {
                        console.warn(`⚠️ [REMINDERS] Sesión ${reminder.session_id} no conectada, saltando recordatorio para ${reminder.patient_name}`);

                        // Registrar como fallido por falta de conexión
                        await connection.execute(
                            `INSERT INTO appointment_reminders_sent
                             (appointment_id, hours_before, message_text, status, error_message)
                             VALUES (?, ?, ?, 'failed', 'Sesión de WhatsApp no conectada')`,
                            [reminder.appointment_id, Math.ceil(reminder.reminder_time / 60), message]
                        );
                    }
                } catch (error) {
                    console.error(`❌ [REMINDERS] Error enviando recordatorio para cita ${reminder.appointment_id}:`, error);

                    // Registrar error
                    await connection.execute(
                        `INSERT INTO appointment_reminders_sent
                         (appointment_id, hours_before, message_text, status, error_message)
                         VALUES (?, ?, ?, 'failed', ?)`,
                        [reminder.appointment_id, Math.ceil(reminder.reminder_time / 60), message || 'Sin mensaje', error.message]
                    );
                }
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[REMINDERS] Error en sistema de recordatorios:', error);
    }
}

// Ejecutar verificación de recordatorios cada minuto
setInterval(checkAndSendReminders, 60 * 1000);
console.log('[REMINDERS] Sistema de recordatorios automáticos iniciado (verificación cada 60 segundos)');

// ============= FIN SISTEMA DE RECORDATORIOS AUTOMÁTICOS =============

// ============= ENDPOINTS REALES DE WHATSAPP =============

// Obtener código QR para conectar WhatsApp
app.get('/api/qr-status', async (req, res) => {
    const format = req.query.format || 'json';
    const deviceId = req.query.deviceId || req.headers['x-device-id']; // Require device ID for QR-based sessions
    let sessionId = req.query.sessionId;

    // Si no hay deviceId, no permitimos el acceso para sesiones QR
    if (!deviceId) {
        return res.status(400).json({
            success: false,
            error: 'Device ID es requerido para accesos por QR',
            requiresReauth: true
        });
    }
    
    // Si no hay sessionId, buscar sesión existente autenticada
    if (!sessionId && pool) {
        try {
            const connection = await pool.getConnection();
            try {
                // Buscar la sesión más reciente que esté autenticada Y activa
                const [rows] = await connection.execute(
                    `SELECT us.session_id, us.phone_number
                     FROM user_sessions us
                     WHERE us.phone_number IS NOT NULL
                     AND us.phone_number != us.session_id
                     AND us.is_active = TRUE
                     ORDER BY us.created_at DESC
                     LIMIT 1`
                );
                
                if (rows.length > 0) {
                    sessionId = rows[0].session_id;
                    console.log(`[QR] ✅ Sesión autenticada encontrada: ${sessionId} (${rows[0].phone_number})`);
                } else {
                    sessionId = crypto.randomBytes(8).toString('hex');
                    console.log(`[QR] 🆕 No hay sesión autenticada, creando nueva: ${sessionId}`);
                }
            } finally {
                connection.release();
            }
        } catch (err) {
            console.error('[QR] Error buscando sesión:', err);
            sessionId = crypto.randomBytes(8).toString('hex');
        }
    } else if (!sessionId) {
        sessionId = crypto.randomBytes(8).toString('hex');
    }
    
    console.log(`[${sessionId}] Solicitando QR (formato: ${format})`);
    
    // Verificar si ya hay sesión conectada EN MEMORIA
    let existingSession = sessions.get(sessionId);
    
    // Si no está en memoria pero existe en disco, cargarla
    if (!existingSession && sessionId) {
        const authPath = path.join(__dirname, '../../auth_info_multi', sessionId);
        if (fs.existsSync(authPath) && fs.existsSync(path.join(authPath, 'creds.json'))) {
            console.log(`[${sessionId}] 🔄 Sesión encontrada en disco, restaurando...`);
            try {
                const savedSyncPref = sessionSyncPreferences.get(sessionId) !== undefined ? sessionSyncPreferences.get(sessionId) : false;
                existingSession = await createSession(sessionId, false, savedSyncPref);
                
                // Esperar un poco para que se conecte
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Verificar si se conectó
                if (existingSession && existingSession.isConnected) {
                    console.log(`[${sessionId}] ✅ Sesión restaurada y conectada automáticamente`);
                }
            } catch (err) {
                console.error(`[${sessionId}] ❌ Error restaurando sesión:`, err.message);
            }
        }
    }
    
    // Verificar si hay CUALQUIER sesión conectada y usarla
    if (!existingSession || !existingSession.isConnected) {
        for (const [sid, sess] of sessions.entries()) {
            if (sess && sess.isConnected) {
                console.log(`[QR] ✅ Usando sesión ya conectada: ${sid}`);
                // Para QR-based sessions, create a device-specific session token
                const sessionToken = createUniqueSession('admin', deviceId, 'admin@whatsapp', 'admin');
                
                // Store the sessionToken for validation later
                sessionTokenMap.set(sid, { 
                    sessionToken, 
                    deviceId, 
                    timestamp: Date.now() 
                });
                
                return res.json({
                    success: true,
                    sessionId: sid,
                    isConnected: true,
                    message: 'WhatsApp ya está conectado',
                    phoneNumber: sess.user?.id?.split(':')[0],
                    sessionToken // Add the device-specific token to the response
                });
            }
        }
    }
    
    if (existingSession && existingSession.isConnected) {
        // Para QR-based sessions, create a device-specific session token
        const sessionToken = createUniqueSession('admin', deviceId, 'admin@whatsapp', 'admin');
        
        // Store the sessionToken for validation later
        sessionTokenMap.set(sessionId, { 
            sessionToken, 
            deviceId, 
            timestamp: Date.now() 
        });
        
        return res.json({
            success: true,
            sessionId,
            isConnected: true,
            message: 'WhatsApp ya está conectado',
            phoneNumber: existingSession.user?.id?.split(':')[0],
            sessionToken // Add the device-specific token to the response
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
                    // For QR-based sessions, create a device-specific session token
                    const sessionToken = createUniqueSession('admin', deviceId, 'admin@whatsapp', 'admin');
                    
                    // Store the sessionToken for validation later
                    sessionTokenMap.set(sessionId, { 
                        sessionToken, 
                        deviceId, 
                        timestamp: Date.now() 
                    });
                    
                    return res.json({
                        success: true,
                        sessionId,
                        qrDataUrl,
                        isConnected: sessionInfo.isConnected,
                        timestamp: new Date().toISOString(),
                        sessionToken // Add the device-specific token to the response
                    });
                }
            } catch (error) {
                console.error('Error generando QR:', error);
            }
        }
    }

    // Crear nueva sesión (con sincronización completa por defecto)
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
            // We don't return the session token here because the QR hasn't been scanned yet
            // The token will be created after the QR is scanned
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

// Obtener todas las sesiones activas
app.get('/api/sessions/active', async (req, res) => {
    try {
        console.log('[SESSIONS-ACTIVE] 📋 Listando sesiones activas...');
        
        const activeSessions = [];
        
        // Recorrer todas las sesiones en memoria
        for (const [sessionId, sessionData] of sessions.entries()) {
            if (sessionData.isConnected) {
                const phoneNumber = await getUserPhoneNumber(sessionId);
                activeSessions.push({
                    sessionId: sessionId,
                    phoneNumber: phoneNumber,
                    isConnected: true,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        console.log(`[SESSIONS-ACTIVE] ✅ Encontradas ${activeSessions.length} sesiones activas`);
        
        res.json({
            success: true,
            sessions: activeSessions,
            count: activeSessions.length
        });
    } catch (error) {
        console.error('[SESSIONS-ACTIVE] ❌ Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo sesiones activas'
        });
    }
});

// Mapa para almacenar sessionTokens: sessionId -> { sessionToken, deviceId, timestamp }
const sessionTokenMap = new Map();

// Tiempo de expiración de sesiones (24 horas)
const SESSION_EXPIRY_TIME = 24 * 60 * 60 * 1000;

// Registrar sesión con sessionToken
app.post('/api/register-session', (req, res) => {
    const { sessionId, sessionToken, deviceId, userType } = req.body;

    if (!sessionId || !sessionToken || !deviceId) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros requeridos'
        });
    }

    console.log(`[SESSION-REGISTER] 🔐 Registrando sesión única`);
    console.log(`  - SessionId: ${sessionId}`);
    console.log(`  - SessionToken: ${sessionToken.substring(0, 20)}...`);
    console.log(`  - DeviceId: ${deviceId.substring(0, 20)}...`);
    console.log(`  - UserType: ${userType}`);

    // Guardar sessionToken vinculado a deviceId
    sessionTokenMap.set(sessionId, {
        sessionToken,
        deviceId,
        userType,
        timestamp: Date.now()
    });

    // También guardar en sessionDeviceMap (compatibilidad)
    sessionDeviceMap.set(sessionId, deviceId);

    console.log(`[SESSION-REGISTER] ✅ Sesión registrada exitosamente`);

    res.json({ success: true });
});

// Cerrar sesión y eliminar sessionToken
app.post('/api/logout-session', (req, res) => {
    const { sessionId, sessionToken } = req.body;

    if (!sessionId || !sessionToken) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros requeridos'
        });
    }

    console.log(`[SESSION-LOGOUT] 👋 Cerrando sesión: ${sessionId}`);

    // Verificar que el sessionToken sea correcto antes de eliminar
    const sessionData = sessionTokenMap.get(sessionId);
    if (sessionData && sessionData.sessionToken === sessionToken) {
        sessionTokenMap.delete(sessionId);
        sessionDeviceMap.delete(sessionId);
        console.log(`[SESSION-LOGOUT] ✅ Sesión eliminada exitosamente`);
        res.json({ success: true });
    } else {
        console.log(`[SESSION-LOGOUT] ⚠️ SessionToken inválido, no se eliminó`);
        res.json({ success: false, error: 'SessionToken inválido' });
    }
});

// Limpiar sesiones expiradas cada hora
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, data] of sessionTokenMap.entries()) {
        if (now - data.timestamp > SESSION_EXPIRY_TIME) {
            sessionTokenMap.delete(sessionId);
            sessionDeviceMap.delete(sessionId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`[SESSION-CLEANUP] 🧹 Limpiadas ${cleaned} sesiones expiradas`);
    }
}, 60 * 60 * 1000); // Cada hora

// Verificar estado de conexión de una sesión - CON VALIDACIÓN DE DISPOSITIVO
app.get('/api/session/:sessionId/status', async (req, res) => {
    const { sessionId } = req.params;
    const deviceId = req.headers['x-device-id'] || req.query.deviceId;
    const sessionToken = req.headers['x-session-token'] || req.query.sessionToken;

    console.log(`[SESSION-STATUS] 🔍 Verificando sesión: ${sessionId}, deviceId: ${deviceId?.substring(0,20)}...`);

    try {
        if (!pool) {
            return res.json({
                success: false,
                isConnected: false,
                message: 'Base de datos no disponible'
            });
        }

        const connection = await pool.getConnection();
        try {
            // BUSCAR por session_id, phone_number CON device_id y session_token
            let [rows] = await connection.execute(
                'SELECT phone_number, is_active, session_id, device_id, session_token FROM user_sessions WHERE session_id = ? OR phone_number = ? ORDER BY last_activity DESC LIMIT 1',
                [sessionId, sessionId]
            );

            // Si no se encuentra por ID exacto, buscar por deviceId si está presente
            if (rows.length === 0 && deviceId) {
                console.log(`[SESSION-STATUS] ⚠️ No encontrado por ID, buscando por deviceId...`);
                [rows] = await connection.execute(
                    'SELECT phone_number, is_active, session_id, device_id, session_token FROM user_sessions WHERE device_id = ? AND is_active = 1 ORDER BY last_activity DESC LIMIT 1',
                    [deviceId]
                );
            }

            if (rows.length === 0) {
                console.log(`[SESSION-STATUS] ⛔ Ninguna sesión encontrada`);
                return res.json({
                    success: false,
                    isConnected: false,
                    message: 'Sesión no encontrada'
                });
            }

            const sessionRow = rows[0];
            const isActive = sessionRow.is_active === 1;
            const storedDeviceId = sessionRow.device_id;
            const storedToken = sessionRow.session_token;

            console.log(`[SESSION-STATUS] ${isActive ? '✅' : '❌'} Encontrado: phone=${sessionRow.phone_number}, is_active=${sessionRow.is_active}`);

            // PERMITIR MÚLTIPLES DISPOSITIVOS: Solo verificar is_active
            // Ya no bloquear por deviceId diferente - permitir acceso desde múltiples navegadores
            if (!isActive) {
                console.log(`[SESSION-STATUS] ⚠️ Sesión inactiva (is_active=0) - Requiere nuevo login`);
                return res.json({
                    success: false,
                    isConnected: false,
                    requiresAuth: true,
                    message: 'Sin sesión activa'
                });
            }

            // Actualizar deviceId si es diferente (permitir migración de dispositivo)
            if (deviceId && storedDeviceId !== deviceId) {
                console.log(`[SESSION-STATUS] 🔄 Actualizando deviceId para permitir acceso desde nuevo navegador`);
                await connection.execute(
                    'UPDATE user_sessions SET device_id = ?, last_activity = NOW() WHERE session_id = ?',
                    [deviceId, sessionId]
                );
            }

            return res.json({
                success: true,
                isConnected: isActive,
                phoneNumber: sessionRow.phone_number,
                sessionId: sessionRow.session_id,
                message: isActive ? 'Sesión activa' : 'Sesión inactiva'
            });

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(`[SESSION-STATUS] ❌ Error:`, error);
        return res.json({
            success: false,
            isConnected: false,
            message: 'Error verificando sesión'
        });
    }
});

// Nuevo endpoint: Verificar sesión activa por deviceId (para detectar conexión recién establecida)
app.post('/api/session/check-by-device', async (req, res) => {
    const { deviceId } = req.body;
    const headerDeviceId = req.headers['x-device-id'];
    const finalDeviceId = deviceId || headerDeviceId;

    console.log(`[SESSION-CHECK-DEVICE] 🔍 Buscando sesión activa para deviceId: ${finalDeviceId?.substring(0,20)}...`);

    if (!finalDeviceId) {
        return res.json({
            success: false,
            isConnected: false,
            message: 'deviceId requerido'
        });
    }

    try {
        if (!pool) {
            return res.json({
                success: false,
                isConnected: false,
                message: 'Base de datos no disponible'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Buscar sesión activa con este deviceId
            const [rows] = await connection.execute(
                'SELECT phone_number, is_active, session_id, device_id FROM user_sessions WHERE device_id = ? AND is_active = 1 ORDER BY last_activity DESC LIMIT 1',
                [finalDeviceId]
            );

            if (rows.length === 0) {
                console.log(`[SESSION-CHECK-DEVICE] ⚠️ No se encontró sesión activa para este dispositivo`);
                return res.json({
                    success: true,
                    isConnected: false,
                    message: 'Sin sesión activa'
                });
            }

            const sessionRow = rows[0];
            console.log(`[SESSION-CHECK-DEVICE] ✅ Sesión activa encontrada: phone=${sessionRow.phone_number}`);

            return res.json({
                success: true,
                isConnected: true,
                phoneNumber: sessionRow.phone_number,
                sessionId: sessionRow.session_id,
                message: 'Sesión activa encontrada'
            });

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(`[SESSION-CHECK-DEVICE] ❌ Error:`, error);
        return res.json({
            success: false,
            isConnected: false,
            message: 'Error verificando sesión'
        });
    }
});

// Crear nueva sesión de WhatsApp
app.post('/api/create-session', async (req, res) => {
    const syncHistory = req.body.syncHistory !== undefined ? req.body.syncHistory : true; // Por defecto TRUE - SIEMPRE sincronizar
    const deviceId = req.body.deviceId; // ID único del dispositivo/navegador

    console.log(`[SESSION] 🔄 Solicitud de sesión con deviceId: ${deviceId?.substring(0, 20)}...`);

    // PRIMERO: Verificar si ya existe una sesión activa para este dispositivo
    if (deviceId && pool) {
        try {
            const connection = await pool.getConnection();
            try {
                const [existingSessions] = await connection.execute(
                    'SELECT session_id, phone_number, is_active FROM user_sessions WHERE device_id = ? AND is_active = 1 ORDER BY last_activity DESC LIMIT 1',
                    [deviceId]
                );

                if (existingSessions.length > 0) {
                    const existing = existingSessions[0];
                    const existingSessionId = existing.phone_number || existing.session_id;
                    console.log(`[SESSION] ✅ Sesión activa encontrada para dispositivo: ${existingSessionId}`);
                    
                    // Verificar si la sesión de WhatsApp sigue activa
                    const whatsappSession = activeSessions.get(existingSessionId);
                    if (whatsappSession && whatsappSession.isConnected) {
                        console.log(`[SESSION] ♻️ Reutilizando sesión existente: ${existingSessionId}`);
                        return res.json({
                            success: true,
                            sessionId: existingSessionId,
                            message: 'Sesión existente activa',
                            isConnected: true
                        });
                    } else {
                        console.log(`[SESSION] ⚠️ Sesión en BD pero WhatsApp desconectado, limpiando...`);
                        await connection.execute(
                            'UPDATE user_sessions SET is_active = 0 WHERE device_id = ?',
                            [deviceId]
                        );
                    }
                }
            } finally {
                connection.release();
            }
        } catch (dbError) {
            console.error(`[SESSION] ⚠️ Error verificando sesión existente:`, dbError);
            // Continuar con creación de nueva sesión
        }
    }

    // Si no existe sesión activa, crear una nueva
    const sessionId = req.body.sessionId || crypto.randomBytes(8).toString('hex');
    console.log(`[SESSION] 🆕 Creando nueva sesión: ${sessionId}`);
    console.log(`[SESSION] 📊 Sincronización de historial: ${syncHistory ? 'ACTIVA ✅' : 'DESACTIVADA ❌'}`);

    // Guardar preferencia de sincronización para esta sesión
    sessionSyncPreferences.set(sessionId, syncHistory);

    // Registrar deviceId para esta nueva sesión (si se proporcionó)
    if (deviceId) {
        sessionDeviceMap.set(sessionId, deviceId);
        console.log(`[SESSION] 🔑 Device ID registrado para nueva sesión: ${sessionId}`);
    }

    try {
        const sessionInfo = await createSession(sessionId, true, syncHistory);

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

// Marcar mensajes como leídos
app.post('/api/messages/mark-read', async (req, res) => {
    const { sessionId, chatJid } = req.body;

    if (!sessionId || !chatJid) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros: sessionId, chatJid' });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);

        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'No se pudo obtener el número de teléfono del usuario' });
        }

        if (pool) {
            const connection = await pool.getConnection();
            try {
                // Marcar todos los mensajes del chat como leídos
                await connection.execute(
                    'UPDATE messages SET is_read = TRUE WHERE session_id = ? AND chat_jid = ? AND from_me = FALSE AND is_read = FALSE',
                    [phoneNumber, chatJid]
                );

                console.log(`[${sessionId}] Mensajes marcados como leídos para chat: ${chatJid}`);

                // Emitir evento de Socket.IO para actualizar el frontend en tiempo real
                io.to(`session-${sessionId}`).emit('messages-read', {
                    chatJid,
                    timestamp: new Date().toISOString()
                });

                res.json({ success: true, message: 'Mensajes marcados como leídos' });
            } finally {
                connection.release();
            }
        } else {
            // Modo memoria
            for (const [key, message] of memoryStorage.messages) {
                if (message.session_id === phoneNumber && message.chat_jid === chatJid && !message.from_me) {
                    message.is_read = true;
                }
            }

            io.to(`session-${sessionId}`).emit('messages-read', {
                chatJid,
                timestamp: new Date().toISOString()
            });

            res.json({ success: true, message: 'Mensajes marcados como leídos (memoria)' });
        }

    } catch (error) {
        console.error(`[${sessionId}] Error marcando mensajes como leídos:`, error);
        res.status(500).json({ success: false, error: 'Error al marcar mensajes como leídos', details: error.message });
    }
});

// Enviar mensaje de texto
app.post('/api/send/message', async (req, res) => {
    const { sessionId, number, message, sentBy, sentByName } = req.body;
    
    if (!sessionId || !number || !message) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros: sessionId, number, message' });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada, socket no disponible o WhatsApp no conectado' });
    }

    try {
        const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        const phoneNumber = await getUserPhoneNumber(sessionId);
        await getOrInsertContact(jid, null, null, jid.includes('@g.us'), phoneNumber); // Ensure contact exists

        // Obtener nombre del contacto de la BD
        let contactName = null;
        if (pool) {
            try {
                const connection = await pool.getConnection();
                try {
                    const isGroup = jid.includes('@g.us');
                    if (isGroup) {
                        const [rows] = await connection.execute(
                            'SELECT name FROM contact_groups WHERE jid = ? AND session_id = ? LIMIT 1',
                            [jid, phoneNumber]
                        );
                        contactName = rows[0]?.name;
                    } else {
                        const [rows] = await connection.execute(
                            'SELECT name, notify_name FROM contacts WHERE jid = ? AND (phone_number = ? OR session_id = ?) LIMIT 1',
                            [jid, phoneNumber, phoneNumber]
                        );
                        contactName = rows[0]?.name || rows[0]?.notify_name;
                    }
                } finally {
                    connection.release();
                }
            } catch (err) {
                console.warn(`[${sessionId}] No se pudo obtener nombre del contacto ${jid}:`, err);
            }
        }
        if (!contactName) {
            contactName = jid.split('@')[0]; // Fallback al número
        }

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
        
        // Guardar metadata de quién envió el mensaje (para etiquetas de agente)
        if (sentBy && sentByName && pool) {
            try {
                const connection = await pool.getConnection();
                try {
                    await connection.execute(
                        `INSERT INTO message_metadata (message_id, chat_jid, session_id, sent_by_user_id, sent_by_name, sent_at)
                         VALUES (?, ?, ?, ?, ?, NOW())`,
                        [sentResult.key.id, jid, sessionId, sentBy, sentByName]
                    );
                    console.log(`[METADATA] Guardado: ${sentByName} envió mensaje a ${jid}`);
                } finally {
                    connection.release();
                }
            } catch (metaError) {
                console.error('[METADATA] Error guardando metadata:', metaError);
                // No fallar el envío si falla la metadata
            }
        }
        
        const clientMessage = {
            id: dbMessage.id,
            from: 'me',
            to: jid,
            chatJid: jid, // ID del chat (siempre el destinatario)
            chatName: contactName, // Nombre del destinatario
            message: dbMessage.text_content,
            timestamp: dbMessage.timestamp.toISOString(),
            type: dbMessage.message_type,
            isFromMe: true, // Indica que lo enviaste tú
            status: dbMessage.status,
            sentBy: sentByName // Agregar nombre del agente
        };
        io.to(`session-${sessionId}`).emit('message', clientMessage);
        // NO emitir globalmente - solo a la sesión específica
        
        console.log(`[${sessionId}] Mensaje enviado a ${jid} y guardado en DB (pending): ${message}`);
        res.json({ success: true, messageId: sentResult.key.id, message: 'Mensaje enviado correctamente' });

    } catch (error) {
        console.error(`[${sessionId}] Error enviando mensaje de texto:`, error);
        res.status(500).json({ success: false, error: 'Error al enviar mensaje', details: error.message });
    }
});

// Endpoint específico para agentes - obtener mensajes de un chat
app.get('/api/messages/:sessionId/:chatJid', async (req, res) => {
    const { sessionId, chatJid } = req.params;
    const { limit = 100 } = req.query;

    console.log('[AGENT-MESSAGES] 📥 Obteniendo mensajes:', { sessionId, chatJid, limit });

    if (!pool) {
        return res.status(503).json({ success: false, error: 'DB no disponible' });
    }

    try {
        // Obtener el número de teléfono del sessionId
        let phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            phoneNumber = sessionId;
        }

        const connection = await pool.getConnection();
        try {
            const [messages] = await connection.execute(
                `SELECT
                    m.id, m.session_id, m.chat_jid, m.sender_jid,
                    m.from_me, m.message_type, m.text_content, m.media_url,
                    m.timestamp, m.status, m.sender_name, m.sender_avatar
                FROM messages m
                WHERE (m.session_id = ? OR m.phone_number = ?)
                  AND m.chat_jid = ?
                ORDER BY m.timestamp ASC
                LIMIT ?`,
                [phoneNumber, phoneNumber, chatJid, parseInt(limit, 10)]
            );

            console.log('[AGENT-MESSAGES] ✅ Encontrados:', messages.length, 'mensajes');

            // Marcar como leídos los mensajes recibidos
            await connection.execute(
                `UPDATE messages SET is_read = true
                 WHERE chat_jid = ?
                   AND (session_id = ? OR phone_number = ?)
                   AND from_me = false
                   AND COALESCE(is_read, false) = false`,
                [chatJid, phoneNumber, phoneNumber]
            );

            res.json({
                success: true,
                messages: messages.map(msg => ({
                    id: msg.id,
                    chatJid: msg.chat_jid,
                    senderJid: msg.sender_jid,
                    from_me: msg.from_me,
                    message_type: msg.message_type,
                    text_content: msg.text_content,
                    media_url: msg.media_url,
                    timestamp: msg.timestamp,
                    status: msg.status,
                    sender_name: msg.sender_name,
                    sender_avatar: msg.sender_avatar
                }))
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENT-MESSAGES] ❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint específico para agentes - enviar mensajes
app.post('/api/messages/send', async (req, res) => {
    const { sessionId, chatJid, message, agentId } = req.body;
    
    console.log('[AGENT-SEND] 📤 Recibida solicitud de envío:', { sessionId, chatJid, agentId, message: message?.substring(0, 50) });
    
    if (!sessionId || !chatJid || !message) {
        console.log('[AGENT-SEND] ❌ Faltan parámetros');
        return res.status(400).json({ 
            success: false, 
            error: 'Faltan parámetros: sessionId, chatJid, message' 
        });
    }

    // Buscar la sesión activa - puede ser directamente o necesitar buscar por usuario del agente
    let session = sessions.get(sessionId);
    
    // Si no se encuentra la sesión directamente y hay agentId, buscar sesión del admin asociado
    if ((!session || !session.isConnected) && agentId && pool) {
        try {
            const connection = await pool.getConnection();
            try {
                // Obtener el admin_phone asociado al agente
                const [agents] = await connection.execute(
                    `SELECT users.phone 
                     FROM users 
                     INNER JOIN agents ON agents.created_by = users.phone 
                     WHERE agents.id = ? LIMIT 1`,
                    [agentId]
                );
                
                if (agents.length > 0) {
                    const adminPhone = agents[0].phone;
                    console.log('[AGENT-SEND] 🔍 Buscando sesión del admin:', adminPhone);
                    
                    // Buscar sesión activa del admin
                    for (const [sessId, sess] of sessions.entries()) {
                        if (sess.phoneNumber === adminPhone && sess.isConnected) {
                            session = sess;
                            console.log('[AGENT-SEND] ✅ Sesión del admin encontrada:', sessId);
                            break;
                        }
                    }
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[AGENT-SEND] Error buscando sesión del admin:', error);
        }
    }
    
    if (!session || !session.sock || !session.isConnected) {
        console.log('[AGENT-SEND] ❌ Sesión no encontrada o no conectada');
        return res.status(400).json({ 
            success: false, 
            error: 'Sesión de WhatsApp no disponible' 
        });
    }

    try {
        const jid = chatJid.includes('@') ? chatJid : `${chatJid}@s.whatsapp.net`;
        console.log('[AGENT-SEND] 📱 Enviando a:', jid);
        
        // Enviar mensaje a WhatsApp
        const sentResult = await session.sock.sendMessage(jid, { text: message });
        console.log('[AGENT-SEND] ✅ Mensaje enviado a WhatsApp, ID:', sentResult.key.id);
        
        const ownJid = session.sock?.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net';
        
        // Guardar en base de datos
        const dbMessage = {
            id: sentResult.key.id,
            chat_jid: jid,
            sender_jid: ownJid,
            from_me: true,
            message_type: 'text',
            text_content: message,
            timestamp: new Date(Number(sentResult.messageTimestamp) * 1000 || Date.now()),
            status: 'pending'
        };
        await saveMessageToDB(sessionId, dbMessage);
        console.log('[AGENT-SEND] 💾 Mensaje guardado en BD');
        
        // Emitir evento Socket.IO para actualización en tiempo real
        io.to(`session-${sessionId}`).emit('message', {
            id: dbMessage.id,
            chatJid: jid,
            message: message,
            timestamp: dbMessage.timestamp.toISOString(),
            from_me: true,
            status: 'sent'
        });
        console.log('[AGENT-SEND] 📡 Evento Socket.IO emitido');
        
        res.json({ 
            success: true, 
            messageId: sentResult.key.id,
            message: 'Mensaje enviado correctamente'
        });
    } catch (error) {
        console.error('[AGENT-SEND] ❌ Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al enviar mensaje', 
            details: error.message 
        });
    }
});

// Enviar archivo multimedia (imagen, video, audio, documento)
app.post('/api/send/media', upload.single('file'), async (req, res) => {
    const { sessionId, number } = req.body;
    const file = req.file;

    if (!sessionId || !number || !file) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: sessionId, number, file'
        });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({
            success: false,
            error: 'Sesión no encontrada, socket no disponible o WhatsApp no conectado'
        });
    }

    try {
        const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        const phoneNumber = await getUserPhoneNumber(sessionId);
        await getOrInsertContact(jid, null, null, jid.includes('@g.us'), phoneNumber);

        // Obtener nombre del contacto de la BD
        let contactName = null;
        if (pool) {
            try {
                const connection = await pool.getConnection();
                try {
                    const isGroup = jid.includes('@g.us');
                    if (isGroup) {
                        const [rows] = await connection.execute(
                            'SELECT name FROM contact_groups WHERE jid = ? AND session_id = ? LIMIT 1',
                            [jid, phoneNumber]
                        );
                        contactName = rows[0]?.name;
                    } else {
                        const [rows] = await connection.execute(
                            'SELECT name, notify_name FROM contacts WHERE jid = ? AND (phone_number = ? OR session_id = ?) LIMIT 1',
                            [jid, phoneNumber, phoneNumber]
                        );
                        contactName = rows[0]?.name || rows[0]?.notify_name;
                    }
                } finally {
                    connection.release();
                }
            } catch (err) {
                console.warn(`[${sessionId}] No se pudo obtener nombre del contacto ${jid}:`, err);
            }
        }
        if (!contactName) {
            contactName = jid.split('@')[0]; // Fallback al número
        }

        console.log(`[${sessionId}] Enviando archivo multimedia: ${file.originalname} (${file.mimetype})`);

        // Determinar tipo de mensaje según el mimetype
        let messagePayload;
        let messageType;

        if (file.mimetype.startsWith('image/')) {
            // Imagen
            messagePayload = {
                image: { url: file.path },
                caption: req.body.caption || ''
            };
            messageType = 'imageMessage';
        } else if (file.mimetype.startsWith('video/')) {
            // Video
            messagePayload = {
                video: { url: file.path },
                caption: req.body.caption || ''
            };
            messageType = 'videoMessage';
        } else if (file.mimetype.startsWith('audio/')) {
            // Audio
            messagePayload = {
                audio: { url: file.path },
                mimetype: file.mimetype
            };
            messageType = 'audioMessage';
        } else {
            // Documento
            messagePayload = {
                document: { url: file.path },
                mimetype: file.mimetype,
                fileName: file.originalname
            };
            messageType = 'documentMessage';
        }

        // Enviar mensaje
        const sentResult = await session.sock.sendMessage(jid, messagePayload);
        const ownJid = session.sock?.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net';

        // Guardar en BD
        const dbMessage = {
            id: sentResult.key.id,
            chat_jid: jid,
            sender_jid: ownJid,
            from_me: true,
            message_type: messageType,
            text_content: req.body.caption || file.originalname,
            media_url: `/uploads/${file.filename}`, // URL relativa para el frontend
            media_mime_type: file.mimetype,
            timestamp: new Date(Number(sentResult.messageTimestamp) * 1000 || Date.now()),
            status: 'pending'
        };
        await saveMessageToDB(sessionId, dbMessage);

        // Emitir via Socket.IO
        const clientMessage = {
            id: dbMessage.id,
            from: 'me',
            to: jid,
            chatJid: jid, // ID del chat (destinatario)
            chatName: contactName, // Nombre del destinatario
            message: dbMessage.text_content,
            text: dbMessage.text_content,
            timestamp: dbMessage.timestamp.toISOString(),
            type: messageType,
            isFromMe: true,
            mediaUrl: dbMessage.media_url,
            mediaMimeType: dbMessage.media_mime_type,
            fileName: file.originalname,
            status: dbMessage.status
        };
        io.to(`session-${sessionId}`).emit('message', clientMessage);
        // NO emitir globalmente - solo a la sesión específica

        console.log(`[${sessionId}] ✅ Archivo multimedia enviado a ${jid} y guardado en DB`);
        res.json({
            success: true,
            messageId: sentResult.key.id,
            message: 'Archivo enviado correctamente',
            mediaUrl: dbMessage.media_url
        });

    } catch (error) {
        console.error(`[${sessionId}] ❌ Error enviando archivo multimedia:`, error);
        res.status(500).json({
            success: false,
            error: 'Error al enviar archivo',
            details: error.message
        });
    }
});

// Enviar imagen
app.post('/api/send/image', async (req, res) => {
    const { sessionId, number, caption, url, mimetype } = req.body;
    
    if (!sessionId || !number || !url) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros: sessionId, number, url'});
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada, socket no disponible o WhatsApp no conectado' });
    }

    try {
        const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        const phoneNumber = await getUserPhoneNumber(sessionId);
        await getOrInsertContact(jid, null, null, jid.includes('@g.us'), phoneNumber);
        
        console.log(`[${sessionId}] 📎 Recibiendo petición de envío de imagen a ${jid}`);
        console.log(`[${sessionId}] URL type: ${url?.startsWith('data:') ? 'base64' : 'path'}, length: ${url?.length || 0}`);
        
        // Check if the URL is a data URL (base64 encoded)
        const isDataURL = url.startsWith('data:');
        
        let imageBuffer;
        let imagePath = url;
        
        if (isDataURL) {
            // Extraer el contenido base64
            const base64Match = url.match(/^data:.*?;base64,(.*)$/);
            if (!base64Match || !base64Match[1]) {
                throw new Error('Formato base64 inválido');
            }
            const base64Content = base64Match[1];
            console.log(`[${sessionId}] Base64 content length: ${base64Content.length}`);
            imageBuffer = Buffer.from(base64Content, 'base64');
            console.log(`[${sessionId}] Buffer created, size: ${imageBuffer.length} bytes`);
        } else {
            // Es una ruta local, convertir a absoluta
            if (imagePath.startsWith('/uploads/')) {
                imagePath = path.join(__dirname, '../../uploads', path.basename(imagePath));
            } else if (imagePath.startsWith('uploads/')) {
                imagePath = path.join(__dirname, '../../uploads', path.basename(imagePath));
            }
            console.log(`[${sessionId}] Ruta de imagen convertida: ${url} -> ${imagePath}`);
        }
        
        const sentResult = await session.sock.sendMessage(jid, {
            image: isDataURL ? { 
                data: imageBuffer 
            } : { url: imagePath },
            caption: caption || ''
        });
        
        console.log(`[${sessionId}] ✅ Imagen enviada exitosamente`);

        // Guardar imagen base64 en disco para persistencia
        let savedMediaUrl = url;
        if (isDataURL && imageBuffer) {
            try {
                const ext = (mimetype || 'image/jpeg').split('/')[1] || 'jpg';
                const filename = `image-${Date.now()}-${sentResult.key.id?.substring(0, 8)}.${ext}`;
                const filepath = path.join(__dirname, '../../media', filename);
                fs.writeFileSync(filepath, imageBuffer);
                savedMediaUrl = `/media/${filename}`;
                console.log(`[${sessionId}] 💾 Imagen enviada guardada: ${savedMediaUrl}`);
            } catch (err) {
                console.error(`[${sessionId}] Error guardando imagen enviada:`, err);
            }
        }

        const ownJid = session.sock?.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net';

        const dbMessage = {
            id: sentResult.key.id,
            chat_jid: jid,
            sender_jid: ownJid,
            from_me: true,
            message_type: 'image',
            text_content: caption || '',
            media_url: savedMediaUrl, 
            media_mime_type: mimetype || req.body.mimetype || 'image/jpeg',
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

// Enviar audio
app.post('/api/send/audio', async (req, res) => {
    const { sessionId, number, caption, url, mimetype } = req.body;
    
    if (!sessionId || !number || !url) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros: sessionId, number, url'});
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada, socket no disponible o WhatsApp no conectado' });
    }

    try {
        const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        const phoneNumber = await getUserPhoneNumber(sessionId);
        await getOrInsertContact(jid, null, null, jid.includes('@g.us'), phoneNumber);
        
        // Check if the URL is a data URL (base64 encoded)
        const isDataURL = url.startsWith('data:');
        
        // Convertir URL relativa a ruta absoluta si es necesario
        let audioPath = url;
        if (!isDataURL && !url.startsWith('http')) {
            // Es una ruta local, convertir a absoluta
            if (audioPath.startsWith('/uploads/')) {
                audioPath = path.join(__dirname, '../../uploads', path.basename(audioPath));
            } else if (audioPath.startsWith('uploads/')) {
                audioPath = path.join(__dirname, '../../uploads', path.basename(audioPath));
            }
            console.log(`[${sessionId}] Ruta de audio convertida: ${url} -> ${audioPath}`);
        }
        
        const sentResult = await session.sock.sendMessage(jid, {
            audio: isDataURL ? { 
                data: Buffer.from(url.replace(/^data:.*?;base64,/, ''), 'base64') 
            } : { url: audioPath },
            caption: caption || '',
            ptt: false // ptt = push to talk, false means it's a regular audio message
        });
        const ownJid = session.sock?.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net';

        const dbMessage = {
            id: sentResult.key.id,
            chat_jid: jid,
            sender_jid: ownJid,
            from_me: true,
            message_type: 'audio',
            text_content: caption || '',
            media_url: url, 
            media_mime_type: mimetype || req.body.mimetype || 'audio/mp4', // Default to audio/mp4 for WhatsApp compatibility
            timestamp: new Date(Number(sentResult.messageTimestamp) * 1000 || Date.now()),
            status: 'pending'
        };
        await saveMessageToDB(sessionId, dbMessage);
        
        const clientMessage = {
            id: dbMessage.id,
            from: 'me',
            to: jid,
            chatJid: jid,
            message: dbMessage.text_content,
            mediaUrl: dbMessage.media_url,
            mediaMimeType: dbMessage.media_mime_type,
            timestamp: dbMessage.timestamp.toISOString(),
            type: dbMessage.message_type,
            isFromMe: true,
            status: dbMessage.status
        };
        io.to(`session-${sessionId}`).emit('message', clientMessage);
        // NO emitir globalmente - solo a la sesión específica
        
        console.log(`[${sessionId}] Audio enviado a ${jid} y guardado en DB (pending)`);
        res.json({ success: true, messageId: sentResult.key.id, message: 'Audio enviado correctamente' });

    } catch (error) {
        console.error(`[${sessionId}] Error enviando audio:`, error);
        res.status(500).json({ success: false, error: 'Error al enviar audio', details: error.message });
    }
});

// Enviar video
app.post('/api/send/video', async (req, res) => {
    const { sessionId, number, caption, url, mimetype } = req.body;
    
    if (!sessionId || !number || !url) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros: sessionId, number, url'});
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada, socket no disponible o WhatsApp no conectado' });
    }

    try {
        const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        const phoneNumber = await getUserPhoneNumber(sessionId);
        await getOrInsertContact(jid, null, null, jid.includes('@g.us'), phoneNumber);
        
        // Check if the URL is a data URL (base64 encoded)
        const isDataURL = url.startsWith('data:');
        
        // Convertir URL relativa a ruta absoluta si es necesario
        let videoPath = url;
        if (!isDataURL && !url.startsWith('http')) {
            // Es una ruta local, convertir a absoluta
            if (videoPath.startsWith('/uploads/')) {
                videoPath = path.join(__dirname, '../../uploads', path.basename(videoPath));
            } else if (videoPath.startsWith('uploads/')) {
                videoPath = path.join(__dirname, '../../uploads', path.basename(videoPath));
            }
            console.log(`[${sessionId}] Ruta de video convertida: ${url} -> ${videoPath}`);
        }
        
        const sentResult = await session.sock.sendMessage(jid, {
            video: isDataURL ? { 
                data: Buffer.from(url.replace(/^data:.*?;base64,/, ''), 'base64') 
            } : { url: videoPath },
            caption: caption || ''
        });
        const ownJid = session.sock?.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net';

        const dbMessage = {
            id: sentResult.key.id,
            chat_jid: jid,
            sender_jid: ownJid,
            from_me: true,
            message_type: 'video',
            text_content: caption || '',
            media_url: url, 
            media_mime_type: mimetype || req.body.mimetype || 'video/mp4', // Default to video/mp4
            timestamp: new Date(Number(sentResult.messageTimestamp) * 1000 || Date.now()),
            status: 'pending'
        };
        await saveMessageToDB(sessionId, dbMessage);
        
        const clientMessage = {
            id: dbMessage.id,
            from: 'me',
            to: jid,
            chatJid: jid,
            message: dbMessage.text_content,
            mediaUrl: dbMessage.media_url,
            mediaMimeType: dbMessage.media_mime_type,
            timestamp: dbMessage.timestamp.toISOString(),
            type: dbMessage.message_type,
            isFromMe: true,
            status: dbMessage.status
        };
        io.to(`session-${sessionId}`).emit('message', clientMessage);
        // NO emitir globalmente - solo a la sesión específica
        
        console.log(`[${sessionId}] Video enviado a ${jid} y guardado en DB (pending)`);
        res.json({ success: true, messageId: sentResult.key.id, message: 'Video enviado correctamente' });

    } catch (error) {
        console.error(`[${sessionId}] Error enviando video:`, error);
        res.status(500).json({ success: false, error: 'Error al enviar video', details: error.message });
    }
});

// Enviar documento
app.post('/api/send/document', async (req, res) => {
    const { sessionId, number, fileName, caption, url, mimetype } = req.body;
    
    if (!sessionId || !number || !url) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros: sessionId, number, url'});
    }

    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        return res.status(400).json({ success: false, error: 'Sesión no encontrada, socket no disponible o WhatsApp no conectado' });
    }

    try {
        const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        const phoneNumber = await getUserPhoneNumber(sessionId);
        await getOrInsertContact(jid, null, null, jid.includes('@g.us'), phoneNumber);
        
        // Check if the URL is a data URL (base64 encoded)
        const isDataURL = url.startsWith('data:');
        
        // Convertir URL relativa a ruta absoluta si es necesario
        let documentPath = url;
        if (!isDataURL && !url.startsWith('http')) {
            // Es una ruta local, convertir a absoluta
            if (documentPath.startsWith('/uploads/')) {
                documentPath = path.join(__dirname, '../../uploads', path.basename(documentPath));
            } else if (documentPath.startsWith('uploads/')) {
                documentPath = path.join(__dirname, '../../uploads', path.basename(documentPath));
            }
            console.log(`[${sessionId}] Ruta de documento convertida: ${url} -> ${documentPath}`);
        }
        
        const sentResult = await session.sock.sendMessage(jid, {
            document: isDataURL ? { 
                data: Buffer.from(url.replace(/^data:.*?;base64,/, ''), 'base64') 
            } : { url: documentPath },
            fileName: fileName || 'documento',
            caption: caption || ''
        });
        const ownJid = session.sock?.user?.id?.replace(/:.*$/, '') + '@s.whatsapp.net';

        const dbMessage = {
            id: sentResult.key.id,
            chat_jid: jid,
            sender_jid: ownJid,
            from_me: true,
            message_type: 'document',
            text_content: caption || '',
            media_url: url, 
            media_mime_type: mimetype || req.body.mimetype || 'application/pdf', // Default to PDF
            timestamp: new Date(Number(sentResult.messageTimestamp) * 1000 || Date.now()),
            status: 'pending'
        };
        await saveMessageToDB(sessionId, dbMessage);
        
        const clientMessage = {
            id: dbMessage.id,
            from: 'me',
            to: jid,
            chatJid: jid,
            message: dbMessage.text_content,
            mediaUrl: dbMessage.media_url,
            mediaMimeType: dbMessage.media_mime_type,
            timestamp: dbMessage.timestamp.toISOString(),
            type: dbMessage.message_type,
            isFromMe: true,
            status: dbMessage.status
        };
        io.to(`session-${sessionId}`).emit('message', clientMessage);
        // NO emitir globalmente - solo a la sesión específica
        
        console.log(`[${sessionId}] Documento enviado a ${jid} y guardado en DB (pending)`);
        res.json({ success: true, messageId: sentResult.key.id, message: 'Documento enviado correctamente' });

    } catch (error) {
        console.error(`[${sessionId}] Error enviando documento:`, error);
        res.status(500).json({ success: false, error: 'Error al enviar documento', details: error.message });
    }
});

// Middleware para servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use('/media', express.static(path.join(__dirname, '../../media')));

// Servir archivos estáticos del frontend React
app.use(express.static(path.join(__dirname, '../../public')));

// Obtener mensajes
app.get('/api/messages/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { number, startDate, endDate, limit = 50, offset = 0 } = req.query;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'DB service unavailable' });
    }

    // Obtener el número de teléfono del usuario en lugar de la session_id temporal
    let phoneNumber = await getUserPhoneNumber(sessionId);
    if (!phoneNumber) {
        console.warn(`[API-MSG] ⚠️ No se pudo determinar phoneNumber para ${sessionId}. Usando sessionId como fallback.`);
        phoneNumber = sessionId; // fallback para no bloquear la carga del chat
    }

    const connection = await pool.getConnection();
    try {
        // Consulta simplificada sin join innecesario que puede causar errores
        let query = `SELECT
            m.id, m.session_id, m.user_session_id, m.chat_jid, m.sender_jid,
            m.from_me, m.message_type, m.text_content, m.media_url, m.media_mime_type,
            m.timestamp, m.status,
            m.sender_name, m.sender_avatar,  -- 🆕 Campos de información del remitente
            NULL as sentBy  -- No usar join si la tabla no existe
        FROM messages m
        WHERE (m.session_id = ? OR m.phone_number = ?)`;
        const queryParams = [phoneNumber, phoneNumber]; // Buscar por phone_number O session_id

        if (number) {
            const chatJid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
            query += ' AND m.chat_jid = ?';
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

        query += ' ORDER BY m.timestamp ASC';

        // Ejecutar consulta principal directamente; calcular total a partir del resultado para simplificar.
        query += ' LIMIT ? OFFSET ?';
        queryParams.push(parseInt(limit, 10));
        queryParams.push(parseInt(offset, 10));

        const [messagesFromDB] = await connection.execute(query, queryParams);
        const totalMessages = Array.isArray(messagesFromDB) ? messagesFromDB.length : 0;

        // MARCAR MENSAJES COMO LEÍDOS cuando se cargan (solo los recibidos, no los enviados)
        if (number && messagesFromDB.length > 0) {
            try {
                const chatJid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
                await connection.execute(
                    `UPDATE messages SET is_read = true
                     WHERE chat_jid = ?
                       AND (session_id = ? OR phone_number = ?)
                       AND from_me = false
                       AND COALESCE(is_read, false) = false`,
                    [chatJid, phoneNumber, phoneNumber]
                );
                console.log(`[API-MSG] ✓ Mensajes de ${chatJid} marcados como leídos`);
            } catch (readErr) {
                console.error('[API-MSG] Error marcando mensajes como leídos:', readErr);
            }
        }

        const clientMessages = messagesFromDB.map(msg => {
            // Parsear context_info si existe
            let contextInfo = null;
            if (msg.context_info) {
                try {
                    const parsed = JSON.parse(msg.context_info);
                    contextInfo = {
                        quotedMessageSender: parsed.participant || parsed.quotedParticipant || 'Desconocido',
                        quotedMessageText: parsed.quotedMessage?.conversation || parsed.quotedMessage?.extendedTextMessage?.text || 'Mensaje citado'
                    };
                } catch (e) {
                    console.error('Error parseando context_info:', e);
                }
            }
            
            return {
                id: msg.id,
                from: msg.from_me ? 'me' : msg.sender_jid,
                to: msg.from_me ? msg.chat_jid : undefined,
                message: msg.text_content,
                text: msg.text_content,
                mediaUrl: msg.media_url,
                mediaMimeType: msg.media_mime_type,
                timestamp: new Date(msg.timestamp).toISOString(),
                type: msg.message_type ? msg.message_type.replace('Message', '').toLowerCase() : 'text',
                isFromMe: Boolean(msg.from_me),
                status: msg.status || 'delivered',
                chatJid: msg.chat_jid,
                senderJid: msg.sender_jid,
                senderName: msg.sender_name, // 🆕 Nombre del remitente
                senderAvatar: msg.sender_avatar, // 🆕 Avatar del remitente
                sentBy: msg.sentBy || null,
                contextInfo: contextInfo
            };
        });

        res.json({
            success: true,
            messages: clientMessages,
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
    const { includeGroups } = req.query; // Parámetro opcional para incluir grupos
    const phoneNumber = await getUserPhoneNumber(sessionId);
    const session = sessions.get(sessionId) || (phoneNumber ? sessions.get(phoneNumber) : undefined);

    // No bloquear la UI si no hay conexión: intentar cargar desde DB igualmente
    const isConnected = !!(session && session.isConnected);

    try {
        console.log(`[API][${sessionId}] Solicitud para cargar lista de chats. includeGroups: ${includeGroups}`);
        const chats = await loadChatListFromDB(sessionId, includeGroups === 'true');
        console.log(`[API][${sessionId}] Devolviendo ${chats.length} chats. Conectado: ${isConnected}`);
        res.json({
            success: true,
            sessionId,
            chats,
            isConnected
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

    console.log(`[API-HISTORY] Request for sessionId: ${sessionId}`);

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible.' });
    }
    
    // Obtener todos los session_ids válidos para este usuario
    const sessionIds = await getAllSessionIds(sessionId);
    console.log(`[API-HISTORY] SessionIds found: ${sessionIds.join(', ')}`);
    
    const connection = await pool.getConnection();
    try {
        // Construir placeholders para IN clause
        const placeholders = sessionIds.map(() => '?').join(',');
        
        let query = `SELECT m.id, m.session_id, m.chat_jid,
                     COALESCE(c.name, c.notify_name, SUBSTRING_INDEX(m.chat_jid, '@', 1)) as chat_name,
                     m.sender_jid,
                     COALESCE(s.name, s.notify_name, SUBSTRING_INDEX(m.sender_jid, '@', 1)) as sender_name,
                     m.from_me, m.message_type, m.text_content, m.media_url, m.media_mime_type, m.timestamp, m.status
                     FROM messages m
                     LEFT JOIN contacts c ON m.chat_jid = c.jid AND c.session_id IN (${placeholders})
                     LEFT JOIN contacts s ON m.sender_jid = s.jid AND s.session_id IN (${placeholders})
                     WHERE m.session_id IN (${placeholders})`;
        const queryParams = [...sessionIds, ...sessionIds, ...sessionIds];

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
        
        const countQuery = query.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
        const [totalRows] = await connection.execute(countQuery, queryParams);
        const totalMessages = totalRows[0].total;

        query += ' LIMIT ? OFFSET ?';
        queryParams.push(parseInt(limit, 10));
        queryParams.push(parseInt(offset, 10));
        
        const [messagesFromDB] = await connection.execute(query, queryParams);

        const historyMessages = messagesFromDB.map(msg => ({
            id: msg.id,
            sessionId: msg.session_id,
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
        
        console.log(`[API-HISTORY] Returning ${historyMessages.length} messages, total: ${totalMessages}`);
        
        res.json({
            success: true,
            messages: historyMessages,
            pagination: {
                total: totalMessages,
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
                page: Math.floor(parseInt(offset, 10) / parseInt(limit, 10)) + 1,
                totalPages: Math.ceil(totalMessages / parseInt(limit, 10))
            }
        });

    } catch (error) {
        console.error(`[API-HISTORY] Error fetching history messages:`, error);
        res.status(500).json({ success: false, error: 'Error al obtener historial de mensajes.' });
    } finally {
        if (connection) connection.release();
    }
});

// Nuevo endpoint para historial completo por número de teléfono
app.get('/api/history/full/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    if (!pool) {
        return res.status(503).json({ 
            success: false, 
            error: 'Servicio de base de datos no disponible.' 
        });
    }

    try {
        // Obtener el número de teléfono del usuario
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Consultar todos los mensajes para este número de teléfono
            const [messages] = await connection.execute(
                `SELECT 
                    m.id,
                    m.chat_jid,
                    c.name as chat_name,
                    m.sender_jid,
                    s.name as sender_name,
                    m.from_me,
                    m.message_type,
                    m.text_content,
                    m.media_url,
                    m.media_mime_type,
                    m.timestamp,
                    m.status
                FROM messages m
                LEFT JOIN contacts c ON m.chat_jid = c.jid
                LEFT JOIN contacts s ON m.sender_jid = s.jid
                WHERE m.session_id = ?
                ORDER BY m.timestamp DESC
                LIMIT ? OFFSET ?`,
                [phoneNumber, parseInt(limit, 10), parseInt(offset, 10)]
            );

            // Contar total de mensajes
            const [totalRows] = await connection.execute(
                'SELECT COUNT(*) as total FROM messages WHERE session_id = ?',
                [phoneNumber]
            );
            const totalMessages = totalRows[0].total;

            const historyMessages = messages.map(msg => ({
                id: msg.id,
                chatJid: msg.chat_jid,
                chatName: msg.chat_name || msg.chat_jid.split('@')[0],
                senderJid: msg.sender_jid,
                senderName: msg.sender_name || (msg.from_me ? 'Yo' : msg.sender_jid?.split('@')[0]),
                fromMe: !!msg.from_me,
                type: msg.message_type,
                message: msg.text_content,
                mediaUrl: msg.media_url,
                mediaMimeType: msg.media_mime_type,
                timestamp: new Date(msg.timestamp).toISOString(),
                status: msg.status
            }));

            res.json({
                success: true,
                messages: historyMessages,
                total: totalMessages,
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
                phoneNumber: phoneNumber
            });

        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error(`[API-HISTORY-FULL] Error obteniendo historial completo para sesión ${sessionId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al obtener historial completo'
        });
    }
});

// Función reutilizable para obtener estadísticas del dashboard
async function getDashboardStats(sessionId) {
    try {
        // Obtener el número de teléfono del usuario en lugar de user_session_id
        const phoneNumber = await getUserPhoneNumber(sessionId);
        // Si no hay sesión activa en memoria, usar el sessionId directamente (podría ser ya el número de teléfono)
        const sessionFilter = phoneNumber || sessionId;

        console.log(`[STATS] Obteniendo estadísticas para: ${sessionFilter}`);

        if (!pool && !memoryStorage.isMemoryMode) {
            return {
                success: false,
                error: 'Base de datos no disponible'
            };
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
                if (msg.session_id === sessionFilter) {  // Usar número de teléfono en lugar de sessionId
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
            // Modo base de datos - OPTIMIZADO: Reducir consultas para mejor rendimiento
            const connection = await pool.getConnection();
            try {
                // CONSULTA 1: Todas las estadísticas de mensajes en una sola query
                const [mensajesStats] = await connection.execute(
                    `SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN DATE(timestamp) = CURDATE() THEN 1 ELSE 0 END) as hoy,
                        SUM(CASE WHEN DATE(timestamp) = CURDATE() AND from_me = TRUE THEN 1 ELSE 0 END) as enviados_hoy,
                        SUM(CASE WHEN DATE(timestamp) = CURDATE() AND from_me = FALSE THEN 1 ELSE 0 END) as recibidos_hoy,
                        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as vistos,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendientes,
                        SUM(CASE WHEN from_me = 0 AND is_read = 0 THEN 1 ELSE 0 END) as no_leidos,
                        COUNT(DISTINCT CASE WHEN timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN chat_jid END) as chats_activos
                    FROM messages
                    WHERE session_id = ?`,
                    [sessionFilter]
                );

                const msgStats = mensajesStats[0];
                stats.mensajesTotales = msgStats.total || 0;
                stats.mensajesHoy = msgStats.hoy || 0;
                stats.mensajesEnviados = msgStats.enviados_hoy || 0;
                stats.mensajesRecibidos = msgStats.recibidos_hoy || 0;
                stats.mensajesVistos = msgStats.vistos || 0;
                stats.mensajesPendientes = msgStats.pendientes || 0;
                stats.mensajesNoLeidos = msgStats.no_leidos || 0;
                stats.chatsActivos = msgStats.chats_activos || 0;

                // CONSULTA 2: Contactos individuales
                const [contactos] = await connection.execute(
                    `SELECT COUNT(*) as contactos
                    FROM contacts
                    WHERE session_id = ? AND jid LIKE '%@s.whatsapp.net'`,
                    [sessionFilter]
                );

                // CONSULTA 3: Grupos
                const [grupos] = await connection.execute(
                    `SELECT COUNT(*) as grupos
                    FROM contact_groups
                    WHERE session_id = ?`,
                    [sessionFilter]
                );

                stats.gruposTotales = grupos[0].grupos || 0;
                stats.contactosTotales = contactos[0].contactos || 0;

                // CONSULTA 3: Campañas globales
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

                // CONSULTA 4: Agentes y líneas activas (datos globales)
                const [globales] = await connection.execute(
                    `SELECT
                        (SELECT COUNT(*) FROM users WHERE status = 'active') as agentes,
                        (SELECT COUNT(*) FROM user_sessions WHERE is_active = 1) as lineas
                    FROM DUAL`
                );
                stats.agentesActivos = globales[0].agentes || 0;
                stats.lineasActivas = globales[0].lineas || 0;

                console.log(`[STATS] Estadísticas calculadas para: ${sessionFilter}:`, stats);

            } finally {
                connection.release();
            }
        }

        // Mapear los nombres de campos al formato esperado por el DashboardOverview
        return {
            success: true,
            stats: {
                messages: {
                    total: parseInt(stats.mensajesTotales) || 0,
                    sent: parseInt(stats.mensajesEnviados) || 0,
                    received: parseInt(stats.mensajesRecibidos) || 0,
                    today: parseInt(stats.mensajesHoy) || 0,
                    thisWeek: parseInt(stats.mensajesHoy) || 0, // TODO: calcular semana real
                    pending: parseInt(stats.mensajesPendientes) || 0,
                    delivered: parseInt(stats.mensajesEnviados) || 0, // Aproximación
                    read: parseInt(stats.mensajesVistos) || 0,
                    failed: 0 // TODO: agregar campo failed
                },
                contacts: {
                    total: parseInt(stats.contactosTotales) || 0,
                    groups: parseInt(stats.gruposTotales) || 0,
                    individual: parseInt(stats.contactosTotales) || 0
                },
                agents: parseInt(stats.agentesActivos) || 0,
                activeLines: parseInt(stats.lineasActivas) || 0,
                unreadMessages: parseInt(stats.mensajesNoLeidos) || 0
            }
        };

    } catch (error) {
        console.error(`[STATS] Error obteniendo estadísticas para ${sessionId}:`, error);
        return {
            success: false,
            error: 'Error al obtener estadísticas',
            details: error.message
        };
    }
}

// Emitir estadísticas via Socket.IO para actualizaciones en tiempo real
function emitDashboardStats(sessionId) {
    getDashboardStats(sessionId).then(data => {
        if (data.success) {
            // Emitir a la sesión específica
            io.emit(`dashboard-stats-${sessionId}`, data.stats);
            console.log(`[SOCKET] 📊 Estadísticas emitidas para sesión: ${sessionId}`);
        }
    }).catch(err => {
        console.error(`[SOCKET] Error emitiendo estadísticas para ${sessionId}:`, err);
    });
}

// Dashboard stats endpoint HTTP
app.get('/api/dashboard/stats/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const data = await getDashboardStats(sessionId);
    res.json(data);
});

// Obtener contactos por sesión (usando el número de teléfono del usuario)
app.get('/api/contacts/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    console.log(`[API-CONTACTS] Request for sessionId: ${sessionId}`);

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible.'
        });
    }

    try {
        // Obtener todos los session_ids válidos para este usuario
        const sessionIds = await getAllSessionIds(sessionId);
        console.log(`[API-CONTACTS] SessionIds found: ${sessionIds.join(', ')}`);
        
        if (!sessionIds || sessionIds.length === 0) {
            console.log(`[API-CONTACTS] No sessionIds found for: ${sessionId}`);
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener información de la sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Obtener todos los phone_numbers asociados a estos sessionIds
            const [userSessions] = await connection.execute(
                `SELECT DISTINCT phone_number FROM user_sessions 
                 WHERE phone_number IN (${sessionIds.map(() => '?').join(',')}) 
                    OR session_id IN (${sessionIds.map(() => '?').join(',')})`,
                [...sessionIds, ...sessionIds]
            );
            
            // Agregar los phone_numbers a la lista de sessionIds
            const allSessionIds = [...sessionIds];
            userSessions.forEach(row => {
                if (row.phone_number && !allSessionIds.includes(row.phone_number)) {
                    allSessionIds.push(row.phone_number);
                }
            });
            
            console.log(`[API-CONTACTS] Expanded sessionIds: ${allSessionIds.join(', ')}`);
            
            // Construir placeholders para IN clause
            const placeholders = allSessionIds.map(() => '?').join(',');

            // Consultar SOLO contactos individuales (@s.whatsapp.net)
            // 🆕 Ordenar por última actualización (updated_at) para mostrar contactos con actividad reciente primero
            const [contacts] = await connection.execute(
                `SELECT
                    jid,
                    name,
                    notify_name,
                    avatar_url,
                    session_id,
                    created_at,
                    updated_at
                FROM contacts
                WHERE session_id IN (${placeholders}) AND jid LIKE '%@s.whatsapp.net'
                ORDER BY updated_at DESC, created_at DESC, name ASC`,
                allSessionIds
            );

            const contactsFormatted = contacts.map(contact => ({
                id: contact.jid,
                jid: contact.jid,
                name: contact.name || contact.notify_name || contact.jid.split('@')[0],
                notify: contact.notify_name, // Alias para compatibilidad con CRM
                notify_name: contact.notify_name,
                phone: contact.jid.split('@')[0],
                isGroup: false,
                avatarUrl: contact.avatar_url,
                sessionId: contact.session_id,
                createdAt: contact.created_at,
                updatedAt: contact.updated_at
            }));

            res.json({
                success: true,
                contacts: contactsFormatted,
                total: contactsFormatted.length
            });

        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error(`[API-CONTACTS] Error obteniendo contactos para sesión ${sessionId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al obtener contactos'
        });
    }
});

// Obtener grupos por sesión (usando el número de teléfono del usuario)
app.get('/api/groups/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible.'
        });
    }

    try {
        // Obtener todos los session_ids válidos para este usuario
        const sessionIds = await getAllSessionIds(sessionId);
        if (!sessionIds || sessionIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener información de la sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Obtener todos los phone_numbers asociados a estos sessionIds
            const [userSessions] = await connection.execute(
                `SELECT DISTINCT phone_number FROM user_sessions 
                 WHERE phone_number IN (${sessionIds.map(() => '?').join(',')}) 
                    OR session_id IN (${sessionIds.map(() => '?').join(',')})`,
                [...sessionIds, ...sessionIds]
            );
            
            // Agregar los phone_numbers a la lista de sessionIds
            const allSessionIds = [...sessionIds];
            userSessions.forEach(row => {
                if (row.phone_number && !allSessionIds.includes(row.phone_number)) {
                    allSessionIds.push(row.phone_number);
                }
            });
            
            console.log(`[API-GROUPS] Expanded sessionIds: ${allSessionIds.join(', ')}`);
            
            // Construir placeholders para IN clause
            const placeholders = allSessionIds.map(() => '?').join(',');

            // Consultar grupos desde contact_groups
            const [groups] = await connection.execute(
                `SELECT
                    jid,
                    name,
                    avatar_url,
                    session_id,
                    description,
                    participants_count,
                    created_at,
                    updated_at
                FROM contact_groups
                WHERE session_id IN (${placeholders})
                ORDER BY created_at DESC, name ASC`,
                allSessionIds
            );

            // Enriquecer con conteo de miembros desde contact_group_members
            const groupsFormatted = await Promise.all(groups.map(async (group) => {
                let memberCount = group.participants_count || 0;

                // Obtener el conteo actualizado desde contact_group_members
                try {
                    const [memberRows] = await connection.execute(
                        `SELECT COUNT(*) as count FROM contact_group_members WHERE group_jid = ? AND session_id IN (${placeholders})`,
                        [group.jid, ...allSessionIds]
                    );
                    memberCount = memberRows[0]?.count || memberCount;
                } catch (err) {
                    console.error(`[API-GROUPS] Error obteniendo miembros de grupo ${group.jid}:`, err.message);
                }

                return {
                    id: group.jid,
                    jid: group.jid,
                    name: group.name || group.jid.split('@')[0],
                    subject: group.name || group.jid.split('@')[0],
                    notifyName: group.name,
                    isGroup: true,
                    avatar: group.avatar_url,
                    avatar_url: group.avatar_url,
                    session_id: group.session_id,
                    description: group.description,
                    createdAt: group.created_at,
                    updatedAt: group.updated_at,
                    memberCount: memberCount,
                    member_count: memberCount,
                };
            }));

            res.json({
                success: true,
                groups: groupsFormatted,
                total: groupsFormatted.length
            });

        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error(`[API-GROUPS] Error obteniendo grupos para sesión ${sessionId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al obtener grupos'
        });
    }
});

// Obtener contactos/miembros de un grupo específico
app.get('/api/group-contacts/:sessionId/:groupId', async (req, res) => {
    const { sessionId, groupId } = req.params;

    try {
        // Obtener el número de teléfono del usuario asociado a esta sesión
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        // Obtener sesión de WhatsApp
        const session = sessions.get(phoneNumber);

        if (!session || !session.sock || !session.isConnected) {
            return res.status(400).json({
                success: false,
                error: 'Sesión de WhatsApp no conectada'
            });
        }

        // Obtener metadata del grupo con la lista de participantes
        try {
            const metadata = await session.sock.groupMetadata(groupId);

            console.log(`[API-GROUP-CONTACTS] Grupo: ${metadata.subject}, Participantes: ${metadata.participants?.length || 0}`);
            
            // Debug: Ver estructura completa de TODOS los participantes
            if (metadata.participants && metadata.participants.length > 0) {
                console.log(`[API-GROUP-PARTICIPANTS] ========== DEBUG METADATA ==========`);
                console.log(`[API-GROUP-PARTICIPANTS] Grupo: ${metadata.subject || metadata.id}`);
                console.log(`[API-GROUP-PARTICIPANTS] Total participantes: ${metadata.participants.length}`);
                console.log(`[API-GROUP-PARTICIPANTS] Primeros 3 participantes COMPLETOS:`);
                metadata.participants.slice(0, 3).forEach((p, i) => {
                    console.log(`[API-GROUP-PARTICIPANTS] Participante ${i + 1}:`, JSON.stringify(p, null, 2));
                });
                console.log(`[API-GROUP-PARTICIPANTS] ====================================`);
            }

            // Obtener conexión a la base de datos para buscar nombres
            const connection = await pool.getConnection();
            
            let contacts = [];
            try {
                // Formatear participantes como contactos
                const contactsPromises = (metadata.participants || []).map(async participant => {
                    // participant.id contiene el JID completo del participante
                    const jid = participant.id;
                    let phone = jid.split('@')[0];
                    let name = phone;
                    
                    console.log(`[API-GROUP-CONTACTS] Participante JID: ${jid}, Phone: ${phone}`);
                    
                    // Si es LID, intentar resolver primero
                    if (jid.includes('@lid')) {
                        const lidInfo = await resolveLid(jid, phoneNumber);
                        if (lidInfo) {
                            phone = lidInfo.phone_number || phone;
                            name = lidInfo.name || lidInfo.notify_name || phone;
                            console.log(`[API-GROUP-CONTACTS] LID resuelto: ${jid} -> ${phone} (${name})`);
                        } else {
                            console.log(`[API-GROUP-CONTACTS] LID no resuelto aún: ${jid}`);
                        }
                    }
                    
                    // Primero buscar en la tabla contact_group_members que ya tiene phone_number y name
                    try {
                        const [memberRows] = await connection.execute(
                            `SELECT phone_number, name, notify_name 
                             FROM contact_group_members 
                             WHERE contact_jid = ? AND group_jid = ? AND session_id = ? 
                             LIMIT 1`,
                            [jid, groupId, phoneNumber]
                        );
                        
                        if (memberRows.length > 0 && memberRows[0].phone_number) {
                            phone = memberRows[0].phone_number;
                            name = memberRows[0].name || memberRows[0].notify_name || phone;
                            console.log(`[API-GROUP-CONTACTS] Encontrado en members: ${jid} -> ${phone} (${name})`);
                        } else {
                            // Si no está en members, buscar en contacts
                            const [contactRows] = await connection.execute(
                                'SELECT name, notify_name FROM contacts WHERE jid = ? AND session_id = ? LIMIT 1',
                                [jid, phoneNumber]
                            );
                            
                            if (contactRows.length > 0) {
                                name = contactRows[0].name || contactRows[0].notify_name || phone;
                            } else {
                                // Como último recurso, intentar obtener de WhatsApp
                                try {
                                    const waName = await session.sock.getName(jid);
                                    if (waName && waName !== phone && !waName.includes('@')) {
                                        name = waName;
                                    }
                                } catch (nameErr) {
                                    // Ignorar error, usar número
                                }
                            }
                        }
                    } catch (dbError) {
                        console.error(`[API-GROUP-CONTACTS] Error buscando contacto ${jid}:`, dbError);
                    }
                    
                    return {
                        id: jid,
                        jid: jid,
                        phone: phone,
                        name: name,
                        isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin',
                        isSuperAdmin: participant.admin === 'superadmin'
                    };
                });
                
                contacts = await Promise.all(contactsPromises);
                
                connection.release();
            } catch (dbError) {
                console.error(`[API-GROUP-CONTACTS] Error con base de datos:`, dbError);
                if (connection) connection.release();
                throw dbError;
            }

            res.json({
                success: true,
                contacts: contacts,
                total: contacts.length,
                groupName: metadata.subject || metadata.name
            });

        } catch (metadataError) {
            console.error(`[API-GROUP-CONTACTS] Error obteniendo metadata del grupo ${groupId}:`, metadataError);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo información del grupo'
            });
        }

    } catch (error) {
        console.error(`[API-GROUP-CONTACTS] Error:`, error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// Alias para el endpoint anterior (para compatibilidad con frontend)
app.get('/api/group/participants/:sessionId/:groupId', async (req, res) => {
    const { sessionId, groupId } = req.params;

    try {
        // Obtener el número de teléfono del usuario asociado a esta sesión
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        // Obtener sesión de WhatsApp
        const session = sessions.get(phoneNumber);

        if (!session || !session.sock || !session.isConnected) {
            return res.status(400).json({
                success: false,
                error: 'Sesión de WhatsApp no conectada'
            });
        }

        // Obtener metadata del grupo con la lista de participantes
        try {
            const metadata = await session.sock.groupMetadata(groupId);

            console.log(`[API-GROUP-PARTICIPANTS] Grupo: ${metadata.subject}, Participantes: ${metadata.participants?.length || 0}`);

            // Obtener conexión a la base de datos para buscar nombres
            const connection = await pool.getConnection();
            
            let participants = [];
            try {
                // Procesar participantes en lotes pequeños para evitar "Queue limit reached"
                const BATCH_SIZE = 5; // Procesar 5 participantes a la vez
                const allParticipants = metadata.participants || [];
                
                console.log(`[API-GROUP-PARTICIPANTS] Procesando ${allParticipants.length} participantes en lotes de ${BATCH_SIZE}...`);
                
                for (let i = 0; i < allParticipants.length; i += BATCH_SIZE) {
                    const batch = allParticipants.slice(i, i + BATCH_SIZE);
                    
                    const batchResults = await Promise.all(batch.map(async participant => {
                        const jid = participant.id;
                        let phone = jid.split('@')[0];
                        let name = null;
                        let isLid = jid.includes('@lid');
                        
                        // Si es LID, intentar resolver primero
                        if (isLid) {
                            const lidInfo = await resolveLid(jid, phoneNumber, session.sock);
                            if (lidInfo && lidInfo.phone_number) {
                                phone = lidInfo.phone_number;
                                name = lidInfo.name || lidInfo.notify_name;
                                isLid = false; // Ya se resolvió
                                console.log(`[API-GROUP-PARTICIPANTS] ✅ LID resuelto: ${jid} -> ${phone} (${name || 'sin nombre'})`);
                            }
                        } else if (jid.includes('@s.whatsapp.net')) {
                            phone = jid.split('@')[0];
                        }
                        
                        // Buscar nombre si aún no lo tenemos
                        if (!name) {
                            try {
                                // Primero buscar en contact_group_members
                                const [memberRows] = await connection.execute(
                                    `SELECT phone_number, name, notify_name 
                                     FROM contact_group_members 
                                     WHERE contact_jid = ? AND group_jid = ? AND session_id = ? 
                                     LIMIT 1`,
                                    [jid, groupId, phoneNumber]
                                );
                                
                                if (memberRows.length > 0) {
                                    if (memberRows[0].phone_number && !isLid) {
                                        phone = memberRows[0].phone_number;
                                    }
                                    name = memberRows[0].name || memberRows[0].notify_name;
                                }
                                
                                // Si no hay nombre, buscar en contacts
                                if (!name) {
                                    const [contactRows] = await connection.execute(
                                        'SELECT name, notify_name FROM contacts WHERE jid = ? AND session_id = ? LIMIT 1',
                                        [jid, phoneNumber]
                                    );
                                    
                                    if (contactRows.length > 0) {
                                        name = contactRows[0].name || contactRows[0].notify_name;
                                    }
                                }
                                
                                // Como último recurso, obtener de WhatsApp (incluso para LIDs)
                                if (!name) {
                                    try {
                                        const waName = await session.sock.getName(jid);
                                        if (waName && waName !== phone && !waName.includes('@')) {
                                            name = waName;
                                            console.log(`[API-GROUP-PARTICIPANTS] 📛 Nombre obtenido: ${jid.substring(0, 20)}... -> ${waName}`);
                                        }
                                    } catch (nameErr) {
                                        // Ignorar
                                    }
                                }
                            } catch (dbError) {
                                console.error(`[API-GROUP-PARTICIPANTS] Error buscando contacto ${jid}:`, dbError);
                            }
                        }
                        
                        // Para LIDs sin resolver, extraer un "pseudo-nombre" del JID
                        let displayName = name;
                        if (!displayName && isLid) {
                            const lidNumber = jid.split('@')[0];
                            displayName = `Miembro ${lidNumber.substring(0, 8)}`;
                        }
                        
                        return {
                            id: jid,
                            jid: jid,
                            phone: isLid ? null : phone, // No mostrar número si es LID no resuelto
                            name: displayName || 'Usuario de WhatsApp',
                            isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin',
                            isSuperAdmin: participant.admin === 'superadmin',
                            isUnresolved: isLid, // Flag para indicar que es LID no resuelto
                            note: isLid ? 'Este contacto no ha enviado mensajes aún' : null
                        };
                    }));
                    
                    participants.push(...batchResults);
                    
                    // Pequeña pausa entre lotes para dar respiro a la DB
                    if (i + BATCH_SIZE < allParticipants.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
                
                console.log(`[API-GROUP-PARTICIPANTS] Procesamiento completado: ${participants.length} participantes`);
                
                connection.release();
            } catch (dbError) {
                console.error(`[API-GROUP-PARTICIPANTS] Error con base de datos:`, dbError);
                if (connection) connection.release();
                throw dbError;
            }

            // Contar cuántos son LIDs sin resolver
            const unresolvedCount = participants.filter(p => p.isUnresolved).length;
            
            res.json({
                success: true,
                participants: participants,
                total: participants.length,
                groupName: metadata.subject || metadata.name,
                unresolvedLids: unresolvedCount,
                warning: unresolvedCount > 0 ? 
                    `${unresolvedCount} contactos usan identificadores privados de WhatsApp. Los números reales se mostrarán cuando estos contactos envíen mensajes.` : 
                    null
            });

        } catch (metadataError) {
            console.error(`[API-GROUP-PARTICIPANTS] Error obteniendo metadata del grupo ${groupId}:`, metadataError);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo información del grupo'
            });
        }

    } catch (error) {
        console.error(`[API-GROUP-PARTICIPANTS] Error:`, error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// ============================================================================
// GRUPOS LOCALES (SEGMENTS) PARA CAMPAÑAS
// ============================================================================

// GET: Obtener todos los grupos locales del usuario
app.get('/api/local-groups/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            const [segments] = await connection.execute(`
                SELECT
                    s.id,
                    s.name,
                    s.description,
                    s.count,
                    s.created_at,
                    COUNT(cs.id) as contact_count
                FROM segments s
                LEFT JOIN contact_segments cs ON s.id = cs.segment_id
                WHERE s.session_id = ? AND s.is_system = 0
                GROUP BY s.id
                ORDER BY s.name ASC
            `, [phoneNumber]);

            res.json({
                success: true,
                localGroups: segments
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[API-LOCAL-GROUPS] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al cargar grupos locales'
        });
    }
});

// GET: Obtener contactos de un grupo local específico
app.get('/api/local-group-contacts/:sessionId/:segmentId', async (req, res) => {
    const { sessionId, segmentId } = req.params;

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Obtener contactos del segmento
            const [contacts] = await connection.execute(`
                SELECT DISTINCT
                    c.jid,
                    c.phone_number as phone,
                    c.name,
                    c.notify_name
                FROM contact_segments cs
                INNER JOIN contacts c ON cs.contact_jid = c.jid
                WHERE cs.segment_id = ? AND cs.session_id = ?
            `, [segmentId, phoneNumber]);

            res.json({
                success: true,
                contacts: contacts,
                total: contacts.length
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[API-LOCAL-GROUP-CONTACTS] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al cargar contactos del grupo local'
        });
    }
});

// POST: Crear un nuevo grupo local (segmento)
app.post('/api/segments/create', async (req, res) => {
    const { sessionId, name, description } = req.body;

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Generar un ID único para el segmento
            const segmentId = `segment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Insertar el nuevo segmento
            await connection.execute(`
                INSERT INTO segments (id, name, description, session_id, is_system, count, created_at, updated_at)
                VALUES (?, ?, ?, ?, 0, 0, NOW(), NOW())
            `, [segmentId, name, description || null, phoneNumber]);

            // Obtener el segmento recién creado
            const [segments] = await connection.execute(`
                SELECT id, name, description, count, created_at, updated_at
                FROM segments
                WHERE id = ?
            `, [segmentId]);

            console.log(`[API-SEGMENTS-CREATE] Grupo local creado: ${name} (${segmentId}) para ${phoneNumber}`);

            res.json({
                success: true,
                segment: segments[0]
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[API-SEGMENTS-CREATE] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear el grupo local'
        });
    }
});

// POST: Agregar contactos a un grupo local
app.post('/api/segments/:segmentId/contacts', async (req, res) => {
    const { segmentId } = req.params;
    const { sessionId, contactJids } = req.body;

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Agregar contactos al segmento
            for (const contactJid of contactJids) {
                await connection.execute(`
                    INSERT IGNORE INTO contact_segments (contact_jid, segment_id, session_id)
                    VALUES (?, ?, ?)
                `, [contactJid, segmentId, phoneNumber]);
            }

            // Actualizar el contador
            const [result] = await connection.execute(`
                SELECT COUNT(*) as count FROM contact_segments WHERE segment_id = ?
            `, [segmentId]);

            await connection.execute(`
                UPDATE segments SET count = ?, updated_at = NOW() WHERE id = ?
            `, [result[0].count, segmentId]);

            console.log(`[API-SEGMENTS-CONTACTS] ${contactJids.length} contactos agregados al grupo ${segmentId}`);

            res.json({
                success: true,
                count: result[0].count
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[API-SEGMENTS-CONTACTS] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al agregar contactos al grupo local'
        });
    }
});

// GET: Obtener todos los segmentos (grupos locales) del usuario
app.get('/api/segments/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            const [segments] = await connection.execute(`
                SELECT
                    s.id,
                    s.name,
                    s.description,
                    s.count,
                    s.created_at,
                    s.updated_at,
                    COUNT(cs.id) as contact_count
                FROM segments s
                LEFT JOIN contact_segments cs ON s.id = cs.segment_id
                WHERE s.session_id = ? AND s.is_system = 0
                GROUP BY s.id
                ORDER BY s.name ASC
            `, [phoneNumber]);

            res.json({
                success: true,
                segments: segments
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[API-SEGMENTS-GET] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al cargar segmentos'
        });
    }
});

// PUT: Actualizar un grupo local
app.put('/api/segments/:segmentId', async (req, res) => {
    const { segmentId } = req.params;
    const { sessionId, name, description } = req.body;

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Actualizar el segmento
            await connection.execute(`
                UPDATE segments 
                SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND session_id = ?
            `, [name, description, segmentId, phoneNumber]);

            console.log(`[API-SEGMENTS-UPDATE] Grupo local actualizado: ${segmentId}`);

            res.json({
                success: true,
                message: 'Grupo local actualizado exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[API-SEGMENTS-UPDATE] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar el grupo local'
        });
    }
});

// DELETE: Eliminar un grupo local
app.delete('/api/segments/:segmentId', async (req, res) => {
    const { segmentId } = req.params;
    const { sessionId } = req.query;

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Eliminar las relaciones de contactos
            await connection.execute(`
                DELETE FROM contact_segments WHERE segment_id = ? AND session_id = ?
            `, [segmentId, phoneNumber]);

            // Eliminar el segmento
            await connection.execute(`
                DELETE FROM segments WHERE id = ? AND session_id = ?
            `, [segmentId, phoneNumber]);

            console.log(`[API-SEGMENTS-DELETE] Grupo local eliminado: ${segmentId}`);

            res.json({
                success: true
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[API-SEGMENTS-DELETE] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar el grupo local'
        });
    }
});

// ============================================================================
// SISTEMA MODERNO DE ESTADOS DE WHATSAPP
// ============================================================================

// GET: Obtener todos los estados pendientes y programados
app.get('/api/statuses/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Sesión no válida' });
        }

        const connection = await pool.getConnection();
        try {
            // Obtener estados pendientes y próximos a publicar
            const [pendingStatuses] = await connection.execute(`
                SELECT 
                    id, text_content, media_url, media_type, media_mime_type,
                    scheduled_time, publish_order, interval_minutes, status,
                    published_at, created_at
                FROM whatsapp_statuses
                WHERE phone_number = ? AND status IN ('pending', 'published')
                ORDER BY publish_order ASC, created_at ASC
            `, [phoneNumber]);

            // Obtener historial reciente (últimos 50)
            const [history] = await connection.execute(`
                SELECT 
                    id, text_content, media_url, media_type,
                    published_at, views_count
                FROM whatsapp_statuses_history
                WHERE phone_number = ?
                ORDER BY published_at DESC
                LIMIT 50
            `, [phoneNumber]);

            res.json({
                success: true,
                statuses: pendingStatuses,
                history: history,
                total: pendingStatuses.length,
                historyCount: history.length
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(`[API-STATUSES] Error obteniendo estados:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST: Guardar estados para programación (sin publicar aún)
app.post('/api/statuses/save', upload.any(), async (req, res) => {
    const { sessionId, statuses: statusesJSON } = req.body;

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Sesión no válida' });
        }

        const statuses = JSON.parse(statusesJSON || '[]');
        if (statuses.length === 0) {
            return res.status(400).json({ success: false, error: 'No hay estados para guardar' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Limpiar estados pendientes anteriores
            await connection.execute(
                `DELETE FROM whatsapp_statuses WHERE phone_number = ? AND status = 'pending'`,
                [phoneNumber]
            );

            // Insertar nuevos estados
            for (let i = 0; i < statuses.length; i++) {
                const status = statuses[i];
                const imageFile = req.files?.find(f => f.fieldname === `status_${i}_image`);

                await connection.execute(`
                    INSERT INTO whatsapp_statuses 
                    (session_id, phone_number, text_content, media_url, media_type, media_mime_type, publish_order, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
                `, [
                    sessionId,
                    phoneNumber,
                    status.text || '',
                    imageFile ? `/uploads/${imageFile.filename}` : null,
                    imageFile ? 'image' : null,
                    imageFile ? imageFile.mimetype : null,
                    i
                ]);
            }

            await connection.commit();

            res.json({
                success: true,
                message: `${statuses.length} estados guardados correctamente`,
                count: statuses.length
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(`[API-STATUSES-SAVE] Error:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE: Eliminar un estado pendiente
app.delete('/api/statuses/:statusId', async (req, res) => {
    const { statusId } = req.params;

    try {
        const connection = await pool.getConnection();
        try {
            await connection.execute(
                `DELETE FROM whatsapp_statuses WHERE id = ? AND status = 'pending'`,
                [statusId]
            );

            res.json({ success: true, message: 'Estado eliminado correctamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(`[API-STATUSES-DELETE] Error:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT: Actualizar un estado pendiente
app.put('/api/statuses/:statusId', upload.single('image'), async (req, res) => {
    const { statusId } = req.params;
    const { text } = req.body;

    try {
        const connection = await pool.getConnection();
        try {
            const updates = [];
            const values = [];

            if (text !== undefined) {
                updates.push('text_content = ?');
                values.push(text);
            }

            if (req.file) {
                updates.push('media_url = ?, media_type = ?, media_mime_type = ?');
                values.push(`/uploads/${req.file.filename}`, 'image', req.file.mimetype);
            }

            if (updates.length > 0) {
                values.push(statusId);
                await connection.execute(
                    `UPDATE whatsapp_statuses SET ${updates.join(', ')} WHERE id = ? AND status = 'pending'`,
                    values
                );
            }

            res.json({ success: true, message: 'Estado actualizado correctamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(`[API-STATUSES-UPDATE] Error:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST: Publicar estados programados
app.post('/api/publish-statuses', async (req, res) => {
    const { sessionId, interval } = req.body;

    console.log(`[STATUS-PUBLISH] 📢 Iniciando publicación para sesión ${sessionId}`);
    console.log(`[STATUS-PUBLISH] ⏱️ Intervalo: ${interval} minutos`);

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Sesión no válida' });
        }

        const session = sessions.get(phoneNumber) || sessions.get(sessionId);
        if (!session || !session.sock || !session.isConnected) {
            return res.status(400).json({ 
                success: false, 
                error: 'WhatsApp no conectado. Por favor, escanea el código QR primero.' 
            });
        }

        const connection = await pool.getConnection();
        try {
            // Obtener estados pendientes ordenados
            const [statuses] = await connection.execute(`
                SELECT id, text_content, media_url, media_type, publish_order
                FROM whatsapp_statuses
                WHERE phone_number = ? AND status = 'pending'
                ORDER BY publish_order ASC
            `, [phoneNumber]);

            if (statuses.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'No hay estados pendientes para publicar' 
                });
            }

            console.log(`[STATUS-PUBLISH] 📝 ${statuses.length} estados para publicar`);

            // Publicar el primer estado inmediatamente
            const firstStatus = statuses[0];
            try {
                if (firstStatus.media_url) {
                    const mediaPath = path.join(__dirname, '../..', firstStatus.media_url);
                    const mediaBuffer = await fs.promises.readFile(mediaPath);
                    await session.sock.sendMessage('status@broadcast', {
                        image: mediaBuffer,
                        caption: firstStatus.text_content || ''
                    });
                } else if (firstStatus.text_content) {
                    await session.sock.sendMessage('status@broadcast', {
                        text: firstStatus.text_content
                    });
                }

                // Marcar como publicado
                await connection.execute(`
                    UPDATE whatsapp_statuses 
                    SET status = 'published', published_at = NOW() 
                    WHERE id = ?
                `, [firstStatus.id]);

                // Guardar en historial
                await connection.execute(`
                    INSERT INTO whatsapp_statuses_history 
                    (session_id, phone_number, text_content, media_url, media_type, published_at)
                    VALUES (?, ?, ?, ?, ?, NOW())
                `, [sessionId, phoneNumber, firstStatus.text_content, firstStatus.media_url, firstStatus.media_type]);

                console.log(`[STATUS-PUBLISH] ✅ Estado 1/${statuses.length} publicado`);
                
                // Emitir evento al frontend
                io.to(`session-${sessionId}`).emit('status-published', {
                    statusId: firstStatus.id,
                    order: 1,
                    total: statuses.length
                });

            } catch (error) {
                console.error(`[STATUS-PUBLISH] ❌ Error publicando estado 1:`, error);
                await connection.execute(
                    `UPDATE whatsapp_statuses SET status = 'failed', error_message = ? WHERE id = ?`,
                    [error.message, firstStatus.id]
                );
            }

            // Programar el resto de estados
            if (statuses.length > 1) {
                const intervalMs = parseInt(interval) * 60 * 1000;
                
                for (let i = 1; i < statuses.length; i++) {
                    const status = statuses[i];
                    const delay = i * intervalMs;
                    const scheduledTime = new Date(Date.now() + delay);

                    // Actualizar hora programada en DB
                    await connection.execute(
                        `UPDATE whatsapp_statuses SET scheduled_time = ?, interval_minutes = ? WHERE id = ?`,
                        [scheduledTime, interval, status.id]
                    );
                    
                    setTimeout(async () => {
                        const conn = await pool.getConnection();
                        try {
                            // Verificar que el estado sigue pendiente
                            const [rows] = await conn.execute(
                                `SELECT * FROM whatsapp_statuses WHERE id = ? AND status = 'pending'`,
                                [status.id]
                            );

                            if (rows.length === 0) {
                                console.log(`[STATUS-PUBLISH] ⏭️ Estado ${i + 1} ya no está pendiente, omitiendo`);
                                return;
                            }

                            const currentStatus = rows[0];

                            // Publicar estado
                            if (currentStatus.media_url) {
                                const mediaPath = path.join(__dirname, '../..', currentStatus.media_url);
                                const mediaBuffer = await fs.promises.readFile(mediaPath);
                                await session.sock.sendMessage('status@broadcast', {
                                    image: mediaBuffer,
                                    caption: currentStatus.text_content || ''
                                });
                            } else if (currentStatus.text_content) {
                                await session.sock.sendMessage('status@broadcast', {
                                    text: currentStatus.text_content
                                });
                            }

                            // Marcar como publicado
                            await conn.execute(
                                `UPDATE whatsapp_statuses SET status = 'published', published_at = NOW() WHERE id = ?`,
                                [status.id]
                            );

                            // Guardar en historial
                            await conn.execute(`
                                INSERT INTO whatsapp_statuses_history 
                                (session_id, phone_number, text_content, media_url, media_type, published_at)
                                VALUES (?, ?, ?, ?, ?, NOW())
                            `, [sessionId, phoneNumber, currentStatus.text_content, currentStatus.media_url, currentStatus.media_type]);

                            console.log(`[STATUS-PUBLISH] ✅ Estado ${i + 1}/${statuses.length} publicado`);

                            // Emitir evento
                            io.to(`session-${sessionId}`).emit('status-published', {
                                statusId: status.id,
                                order: i + 1,
                                total: statuses.length
                            });

                        } catch (error) {
                            console.error(`[STATUS-PUBLISH] ❌ Error publicando estado ${i + 1}:`, error);
                            await conn.execute(
                                `UPDATE whatsapp_statuses SET status = 'failed', error_message = ? WHERE id = ?`,
                                [error.message, status.id]
                            );
                        } finally {
                            conn.release();
                        }
                    }, delay);

                    console.log(`[STATUS-PUBLISH] ⏰ Estado ${i + 1} programado para ${scheduledTime.toLocaleString()}`);
                }
            }

            res.json({
                success: true,
                message: `${statuses.length} ${statuses.length === 1 ? 'estado publicado' : 'estados programados'}`,
                published: 1,
                scheduled: statuses.length - 1,
                interval: `${interval} minutos`,
                nextPublish: statuses.length > 1 ? new Date(Date.now() + parseInt(interval) * 60 * 1000).toLocaleString('es-ES') : null
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error(`[STATUS-PUBLISH] ❌ Error general:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint POST para sincronización forzada desde SettingsModule
app.post('/api/sync/force/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    console.log(`[SYNC-FORCE] 🔄 Sincronización forzada solicitada para: ${sessionId}`);

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            console.error(`[SYNC-FORCE] ❌ No se pudo obtener phoneNumber`);
            return res.status(400).json({ success: false, error: 'No se pudo obtener el número de teléfono' });
        }

        console.log(`[SYNC-FORCE] ✅ PhoneNumber: ${phoneNumber}`);

        let session = sessions.get(phoneNumber) || sessions.get(sessionId);

        if (!session || !session.sock || !session.isConnected) {
            console.error(`[SYNC-FORCE] ❌ Sesión no conectada`);
            return res.status(400).json({ success: false, error: 'Sesión de WhatsApp no encontrada. Escanea el código QR primero.' });
        }

        console.log(`[SYNC-FORCE] ✅ Sesión encontrada`);

        let stats = { contacts: 0, chats: 0, groups: 0, avatars: 0 };

        if (session.sock.contacts) {
            console.log(`[SYNC-FORCE] 📇 Sincronizando ${Object.keys(session.sock.contacts).length} contactos...`);
            for (const [jid, contact] of Object.entries(session.sock.contacts)) {
                if (typeof contact === 'object' && jid.includes('@s.whatsapp.net')) {
                    try {
                        await getOrInsertContact(jid, contact.name || contact.notify, contact.notify || contact.name, phoneNumber, session.sock);
                        stats.contacts++;
                        try {
                            const avatarUrl = await session.sock.profilePictureUrl(jid, 'image').catch(() => null);
                            if (avatarUrl && pool) {
                                const conn = await pool.getConnection();
                                try {
                                    await conn.execute('UPDATE contacts SET avatar_url = ? WHERE jid = ? AND session_id = ?', [avatarUrl, jid, phoneNumber]);
                                    stats.avatars++;
                                } finally { conn.release(); }
                            }
                        } catch {}
                    } catch (err) { console.error(`[SYNC-FORCE] Error contacto:`, err.message); }
                }
            }
        }

        if (session.sock.chats) {
            console.log(`[SYNC-FORCE] 💬 Sincronizando ${Object.keys(session.sock.chats).length} chats...`);
            for (const [jid, chat] of Object.entries(session.sock.chats)) {
                if (typeof chat === 'object' && (jid.includes('@s.whatsapp.net') || jid.includes('@g.us'))) {
                    try {
                        await getOrInsertContact(jid, chat.name || chat.subject || jid.split('@')[0], chat.name || chat.subject || jid.split('@')[0], phoneNumber, session.sock);
                        jid.includes('@g.us') ? stats.groups++ : stats.chats++;
                    } catch (err) { console.error(`[SYNC-FORCE] Error chat:`, err.message); }
                }
            }
        }

        console.log(`[SYNC-FORCE] ✅ Completado:`, stats);
        return res.json({ success: true, message: 'Sincronización completada', stats });

    } catch (error) {
        console.error('[SYNC-FORCE] ❌ Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint GET para forzar la descarga completa de contactos y grupos (mantener compatibilidad)
app.get('/api/sync/full/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        const session = sessions.get(sessionId);
        if (!session || !session.sock || !session.isConnected) {
            return res.status(400).json({ 
                success: false, 
                error: 'Sesión no encontrada o no conectada' 
            });
        }

        // Obtener número de teléfono del usuario
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({ 
                success: false, 
                error: 'No se pudo obtener número de teléfono para la sesión' 
            });
        }
        
        let stats = {
            contacts: 0,
            groups: 0,
            messagesProcessed: 0,
            avatarDownloads: 0
        };
        
        // Forzar descarga de contactos
        if (session.sock.contacts) {
            for (const [jid, contact] of Object.entries(session.sock.contacts)) {
                if (typeof contact === 'object' && jid.includes('@s.whatsapp.net')) {
                    await getOrInsertContact(
                        jid, 
                        contact.name || contact.notify, 
                        contact.notify || contact.name, 
                        false, 
                        phoneNumber
                    );
                    stats.contacts++;
                    
                    // Intentar descargar avatar
                    try {
                        const avatarUrl = await session.sock.profilePictureUrl(jid, 'image').catch(() => null);
                        if (avatarUrl && pool) {
                            const connection = await pool.getConnection();
                            try {
                                await connection.execute(
                                    'UPDATE contacts SET avatar_url = ? WHERE jid = ? AND session_id = ?',
                                    [avatarUrl, jid, phoneNumber]
                                );
                                stats.avatarDownloads++;
                            } finally {
                                connection.release();
                            }
                        }
                    } catch (avatarErr) {
                        // Ignorar errores de avatar
                    }
                } else if (jid.includes('@g.us')) {
                    // Registrar grupos también
                    await getOrInsertContact(
                        jid, 
                        contact.name || contact.subject, 
                        contact.subject || contact.name, 
                        true, 
                        phoneNumber
                    );
                    stats.groups++;
                    
                    // Intentar descargar avatar del grupo
                    try {
                        const avatarUrl = await session.sock.profilePictureUrl(jid, 'image').catch(() => null);
                        if (avatarUrl && pool) {
                            const connection = await pool.getConnection();
                            try {
                                await connection.execute(
                                    'UPDATE contacts SET avatar_url = ? WHERE jid = ? AND session_id = ?',
                                    [avatarUrl, jid, phoneNumber]
                                );
                                stats.avatarDownloads++;
                            } finally {
                                connection.release();
                            }
                        }
                    } catch (avatarErr) {
                        // Ignorar errores de avatar
                    }
                }
            }
        }
        
        // Forzar descarga de chats
        if (session.sock.chats) {
            for (const [jid, chat] of Object.entries(session.sock.chats)) {
                if (typeof chat === 'object' && (jid.includes('@s.whatsapp.net') || jid.includes('@g.us'))) {
                    await getOrInsertContact(
                        jid, 
                        chat.name || chat.subject || jid.split('@')[0], 
                        chat.name || chat.subject || jid.split('@')[0], 
                        jid.includes('@g.us'), 
                        phoneNumber
                    );
                }
            }
        }
        
        // Forzar descarga de mensajes recientes
        const allMessages = await session.sock.fetchMessagesFromWA ? 
            await session.sock.fetchMessagesFromWA({ limit: 1000 }) : 
            [];
        
        for (const msg of allMessages) {
            if (msg.key && msg.message) {
                const chatJid = msg.key.remoteJid;
                const phoneNumber = await getUserPhoneNumber(sessionId);
                
                // Guardar contacto si no existe
                if (chatJid) {
                    const isGroup = chatJid.includes('@g.us');
                    await getOrInsertContact(
                        chatJid, 
                        null, 
                        msg.pushName, 
                        isGroup, 
                        phoneNumber
                    );
                }
                
                // Preparar mensaje para guardar
                const messageType = Object.keys(msg.message)[0] || 'unknown';
                let textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                
                const dbMessage = {
                    id: msg.key.id,
                    chat_jid: chatJid,
                    sender_jid: msg.key.fromMe ? phoneNumber + '@s.whatsapp.net' : (msg.key.participant || chatJid),
                    from_me: msg.key.fromMe,
                    message_type: messageType,
                    text_content: textContent,
                    media_url: null, 
                    media_mime_type: null,
                    timestamp: msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date(),
                    status: msg.key.fromMe ? 'sent' : 'received'
                };
                
                await saveMessageToDB(sessionId, dbMessage);
                stats.messagesProcessed++;
            }
        }
        
        res.json({
            success: true,
            message: 'Sincronización completa exitosa',
            stats
        });
    } catch (error) {
        console.error(`[SYNC-FULL] Error en sincronización completa para ${sessionId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Error durante la sincronización completa',
            details: error.message
        });
    }
});

// Función para actualizar directamente los contactos en la base de datos con información de nombre real
async function forceUpdateContactNamesInDatabase(sessionId) {
    console.log(`[FORCE-UPDATE-NAMES] Iniciando actualización forzada de nombres para sesión: ${sessionId}`);
    
    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        console.error(`[FORCE-UPDATE-NAMES] Sesión ${sessionId} no encontrada o no conectada`);
        throw new Error('Sesión no encontrada o no conectada');
    }
    
    const sock = session.sock;
    const phoneNumber = await getUserPhoneNumber(sessionId);
    
    if (!pool) {
        throw new Error('Base de datos no disponible');
    }
    
    const connection = await pool.getConnection();
    try {
        // Obtener contactos que solo tienen números como nombre
        const [contactsToUpdate] = await connection.execute(`
            SELECT jid, name, session_id 
            FROM contacts 
            WHERE session_id = ? 
            AND (name IS NULL OR name = '' OR name = SUBSTRING_INDEX(jid, '@', 1))
            AND jid LIKE '%@s.whatsapp.net'
        `, [phoneNumber]);
        
        console.log(`[FORCE-UPDATE-NAMES] Encontrados ${contactsToUpdate.length} contactos para actualizar`);
        
        let updatedCount = 0;
        
        for (const contact of contactsToUpdate) {
            try {
                console.log(`[FORCE-UPDATE-NAMES] Procesando contacto: ${contact.jid}`);
                
                // Intentar obtener nombre real de WhatsApp
                let realName = null;
                
                try {
                    realName = await sock.getName(contact.jid);
                    console.log(`[FORCE-UPDATE-NAMES] Nombre obtenido de WhatsApp: ${realName}`);
                } catch (getNameErr) {
                    console.warn(`[FORCE-UPDATE-NAMES] Error con getName para ${contact.jid}:`, getNameErr.message);
                }
                
                // Si getName no funciona, intentar con otros métodos
                if (!realName || realName === contact.jid.split('@')[0]) {
                    if (sock.store?.contacts) {
                        const storeContact = sock.store.contacts.get(contact.jid);
                        if (storeContact && storeContact.name && storeContact.name !== contact.jid.split('@')[0]) {
                            realName = storeContact.name;
                            console.log(`[FORCE-UPDATE-NAMES] Nombre obtenido del store: ${realName}`);
                        }
                    }
                }
                
                // Si aún no tenemos un nombre real (diferente del número), intentar con profilePictureUrl
                if (!realName || realName === contact.jid.split('@')[0]) {
                    try {
                        await sock.profilePictureUrl(contact.jid, 'image');
                        // Esperar un poco para que se actualice el store
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Reintentar obtener del store
                        if (sock.store?.contacts) {
                            const storeContact = sock.store.contacts.get(contact.jid);
                            if (storeContact && storeContact.name && storeContact.name !== contact.jid.split('@')[0]) {
                                realName = storeContact.name;
                                console.log(`[FORCE-UPDATE-NAMES] Nombre obtenido del store tras profilePictureUrl: ${realName}`);
                            }
                        }
                    } catch (picErr) {
                        console.warn(`[FORCE-UPDATE-NAMES] No se pudo obtener avatar para ${contact.jid}:`, picErr.message);
                    }
                }
                
                // Si tenemos un nombre real (diferente del número), actualizar en la base de datos
                if (realName && realName !== contact.jid.split('@')[0] && realName.trim() !== '') {
                    await connection.execute(`
                        UPDATE contacts 
                        SET name = ?, notify_name = ?, updated_at = NOW()
                        WHERE jid = ? AND session_id = ?
                    `, [realName, realName, contact.jid, phoneNumber]);
                    
                    console.log(`[FORCE-UPDATE-NAMES] ✅ Contacto actualizado: ${contact.jid} -> "${realName}"`);
                    updatedCount++;
                } else {
                    console.log(`[FORCE-UPDATE-NAMES] ❌ No se pudo obtener nombre real para: ${contact.jid}`);
                }
                
            } catch (contactErr) {
                console.error(`[FORCE-UPDATE-NAMES] Error procesando contacto ${contact.jid}:`, contactErr);
            }
        }
        
        console.log(`[FORCE-UPDATE-NAMES] ✅ Actualizados ${updatedCount} contactos`);
        return { updated: updatedCount, total: contactsToUpdate.length };
        
    } finally {
        connection.release();
    }
}

// Endpoint para actualizar nombres de contactos
app.post('/api/contacts/update-names/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        const session = sessions.get(sessionId);
        if (!session || !session.sock || !session.isConnected) {
            return res.status(400).json({ 
                success: false, 
                error: 'Sesión no encontrada o no conectada' 
            });
        }
        
        console.log(`[${sessionId}] 🔄 Iniciando actualización de nombres de contactos...`);
        
        const result = await forceUpdateContactNamesInDatabase(sessionId);
        
        res.json({
            success: true,
            message: `Actualización de nombres completada`,
            result
        });
        
    } catch (error) {
        console.error(`[${sessionId}] ❌ Error actualizando nombres de contactos:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Función para actualizar periódicamente los nombres de contactos recientes
function schedulePeriodicNameUpdates() {
    console.log('⏰ Programando actualizaciones periódicas de nombres de contactos...');
    
    // Actualizar nombres cada 30 minutos
    setInterval(async () => {
        try {
            console.log('🔄 Iniciando actualización periódica de nombres de contactos...');
            
            // Iterar a través de todas las sesiones activas
            for (const [sessionId, session] of sessions.entries()) {
                if (session && session.sock && session.isConnected) {
                    try {
                        console.log(`[${sessionId}] Iniciando actualización de nombres para sesión activa...`);
                        await updateContactNames(sessionId);
                    } catch (err) {
                        console.error(`[${sessionId}] Error en actualización periódica:`, err.message);
                    }
                }
            }
        } catch (error) {
            console.error('Error general en actualización periódica de nombres:', error.message);
        }
    }, 30 * 60 * 1000); // Cada 30 minutos
}

// Iniciar actualizaciones periódicas después de que el servidor esté completamente iniciado
setTimeout(schedulePeriodicNameUpdates, 60000); // Comenzar después de 1 minuto para permitir la inicialización completa

// Endpoint para estadísticas del Dashboard
app.get('/api/dashboard/stats/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible.'
        });
    }

    try {
        // Obtener todos los session_ids válidos para este usuario
        const sessionIds = await getAllSessionIds(sessionId);
        if (!sessionIds || sessionIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener información de la sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Construir placeholders para IN clause
            const placeholders = sessionIds.map(() => '?').join(',');

            // Contar mensajes por estado
            const [messageStats] = await connection.execute(
                `SELECT
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN from_me = 1 THEN 1 ELSE 0 END) as sent_messages,
                    SUM(CASE WHEN from_me = 0 THEN 1 ELSE 0 END) as received_messages,
                    SUM(CASE WHEN from_me = 1 AND status = 'pending' THEN 1 ELSE 0 END) as pending_messages,
                    SUM(CASE WHEN from_me = 1 AND status = 'sent' THEN 1 ELSE 0 END) as sent_status,
                    SUM(CASE WHEN from_me = 1 AND status = 'delivered' THEN 1 ELSE 0 END) as delivered_messages,
                    SUM(CASE WHEN from_me = 1 AND status = 'read' THEN 1 ELSE 0 END) as read_messages,
                    SUM(CASE WHEN from_me = 1 AND status = 'failed' THEN 1 ELSE 0 END) as failed_messages
                FROM messages
                WHERE session_id IN (${placeholders})`,
                sessionIds
            );

            // Contar contactos individuales
            const [contactStats] = await connection.execute(
                `SELECT COUNT(*) as individual_contacts
                FROM contacts
                WHERE session_id IN (${placeholders}) AND jid LIKE '%@s.whatsapp.net'`,
                sessionIds
            );

            // Contar grupos
            const [groupStats] = await connection.execute(
                `SELECT COUNT(*) as groups
                FROM contact_groups
                WHERE session_id IN (${placeholders})`,
                sessionIds
            );

            const totalContacts = (contactStats[0]?.individual_contacts || 0) + (groupStats[0]?.groups || 0);

            // Mensajes hoy
            const [todayMessages] = await connection.execute(
                `SELECT COUNT(*) as today_messages
                FROM messages
                WHERE session_id IN (${placeholders}) AND DATE(timestamp) = CURDATE()`,
                sessionIds
            );

            // Mensajes esta semana
            const [weekMessages] = await connection.execute(
                `SELECT COUNT(*) as week_messages
                FROM messages
                WHERE session_id IN (${placeholders}) AND YEARWEEK(timestamp, 1) = YEARWEEK(CURDATE(), 1)`,
                sessionIds
            );

            const stats = {
                messages: {
                    total: parseInt(messageStats[0].total_messages) || 0,
                    sent: parseInt(messageStats[0].sent_messages) || 0,
                    received: parseInt(messageStats[0].received_messages) || 0,
                    pending: parseInt(messageStats[0].pending_messages) || 0,
                    delivered: parseInt(messageStats[0].delivered_messages) || 0,
                    read: parseInt(messageStats[0].read_messages) || 0,
                    failed: parseInt(messageStats[0].failed_messages) || 0,
                    today: parseInt(todayMessages[0].today_messages) || 0,
                    thisWeek: parseInt(weekMessages[0].week_messages) || 0
                },
                contacts: {
                    total: totalContacts,
                    individual: parseInt(contactStats[0].individual_contacts) || 0,
                    groups: parseInt(groupStats[0].groups) || 0
                }
            };

            res.json({
                success: true,
                stats
            });

        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error(`[API-DASHBOARD-STATS] Error obteniendo estadísticas para sesión ${sessionId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al obtener estadísticas'
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
// Mapa para rastrear conexiones por sessionId
const sessionConnectionsMap = new Map();

io.on('connection', (socket) => {
    const sessionId = socket.handshake.query.sessionId;
    
    // LOG DETALLADO PARA DEBUG
    console.log(`🔌 Nueva conexión Socket.IO:`);
    console.log(`   - Socket ID: ${socket.id}`);
    console.log(`   - SessionId recibido: ${sessionId || 'NO RECIBIDO'}`);
    console.log(`   - Query completo:`, socket.handshake.query);
    console.log(`   - Headers:`, {
        'user-agent': socket.handshake.headers['user-agent'],
        'origin': socket.handshake.headers.origin,
        'x-real-ip': socket.handshake.headers['x-real-ip'],
        'x-forwarded-for': socket.handshake.headers['x-forwarded-for']
    });
    console.log(`   - Transporte: ${socket.conn.transport.name}`);
    
    // Limitar conexiones por sessionId
    // Guardar timeout para poder cancelarlo
    let disconnectTimeout = null;

    if (sessionId) {
        if (!sessionConnectionsMap.has(sessionId)) {
            sessionConnectionsMap.set(sessionId, new Set());
        }
        const connections = sessionConnectionsMap.get(sessionId);

        // Si ya hay más de 5 conexiones, desconectar las más antiguas
        if (connections.size >= 5) {
            const oldestSocket = Array.from(connections)[0];
            console.warn(`⚠️ Límite de conexiones alcanzado para ${sessionId}, desconectando ${oldestSocket}`);
            io.sockets.sockets.get(oldestSocket)?.disconnect(true);
            connections.delete(oldestSocket);
        }

        connections.add(socket.id);
        socket.join(`session-${sessionId}`);
        console.log(`Cliente ${socket.id} conectado a session-${sessionId} (${connections.size} conexiones activas)`);
    } else {
        // Desconectar conexiones sin sessionId después de 30 segundos (dar tiempo al evento join-session)
        console.warn(`Cliente ${socket.id} conectado sin sessionId inicial, esperando join-session (timeout: 30s)`);
        disconnectTimeout = setTimeout(() => {
            if (socket.connected) {
                console.warn(`⚠️ Cliente ${socket.id} sin sessionId después de 30s, desconectando...`);
                socket.disconnect(true);
            }
        }, 30000); // Aumentado a 30 segundos
    }

    socket.on('join-session', (data) => {
        console.log(`📡 [JOIN-SESSION] Recibido de ${socket.id}:`, {
            data: data,
            type: typeof data,
            sessionId: data?.sessionId,
            dataString: typeof data === 'string' ? data : 'no es string'
        });

        const sid = data?.sessionId || data;
        console.log(`📡 [JOIN-SESSION] sessionId extraído: "${sid}" (tipo: ${typeof sid})`);

        if(sid){
             // Cancelar timeout de desconexión si existe
             if (disconnectTimeout) {
                 clearTimeout(disconnectTimeout);
                 disconnectTimeout = null;
                 console.log(`✅ Timeout cancelado para ${socket.id} - sessionId recibido via join-session`);
             }

             // Agregar a mapa de conexiones
             if (!sessionConnectionsMap.has(sid)) {
                 sessionConnectionsMap.set(sid, new Set());
             }
             sessionConnectionsMap.get(sid).add(socket.id);

             socket.join(`session-${sid}`);
             console.log(`🔌 [Socket.IO] Cliente ${socket.id} unido explícitamente a session-${sid}`);
             // Confirmar al cliente que se unió exitosamente
             socket.emit('joined-session', { sessionId: sid, success: true });
        } else {
             console.error(`❌ [JOIN-SESSION] sessionId vacío o inválido para ${socket.id}`, {
                 data: data,
                 sid: sid
             });
        }
    });

    socket.on('leave-session', (data) => {
        const sid = data?.sessionId || data;
        if(sid){
            socket.leave(`session-${sid}`);
            console.log(`🔌 [Socket.IO] Cliente ${socket.id} abandonó session-${sid}`);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
        
        // Limpiar de sessionConnectionsMap
        if (sessionId && sessionConnectionsMap.has(sessionId)) {
            sessionConnectionsMap.get(sessionId).delete(socket.id);
            if (sessionConnectionsMap.get(sessionId).size === 0) {
                sessionConnectionsMap.delete(sessionId);
            }
        }
    });
});

// Cleanup periódico de conexiones huérfanas
setInterval(() => {
    const totalConnections = io.engine.clientsCount;
    if (totalConnections > 100) {
        console.warn(`⚠️ Alto número de conexiones Socket.IO: ${totalConnections}`);
    }
}, 60000); // Cada minuto

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
// Endpoint para servir avatares de contactos
app.get('/api/avatar/:sessionId/:jid', async (req, res) => {
    const { sessionId, jid } = req.params;

    if (!pool) {
        // Devolver avatar por defecto si no hay conexión a la base de datos
        return res.redirect('https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png');
    }

    try {
        // Obtener el número de teléfono del usuario en lugar del sessionId temporal
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            // Si no podemos obtener el número de teléfono, devolver avatar por defecto
            return res.redirect('https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png');
        }

        const connection = await pool.getConnection();
        try {
            // Consultar el avatar_url del contacto usando el número de teléfono
            const [rows] = await connection.execute(
                'SELECT avatar_url FROM contacts WHERE jid = ? AND session_id = ?',
                [jid, phoneNumber]
            );

            if (rows.length > 0 && rows[0].avatar_url) {
                // Redirigir a la URL del avatar
                res.redirect(rows[0].avatar_url);
            } else {
                // Devolver avatar por defecto
                res.redirect('https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png');
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(`[API-AVATAR] Error obteniendo avatar para ${jid}:`, error);
        // Devolver avatar por defecto en caso de error
        res.redirect('https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png');
    }
});

// POST - Actualizar avatares de contactos
app.post('/api/update-contacts-avatars/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock || !session.isConnected) {
            return res.status(400).json({ success: false, error: 'WhatsApp no conectado' });
        }

        console.log(`[AVATAR-UPDATE] Iniciando actualización de avatares para ${phoneNumber}`);

        const connection = await pool.getConnection();
        try {
            // Obtener contactos sin avatar o con avatar vacío
            const [contacts] = await connection.execute(
                `SELECT jid, name FROM contacts 
                 WHERE session_id = ? 
                 AND jid LIKE "%@s.whatsapp.net" 
                 AND (avatar_url IS NULL OR avatar_url = "")
                 LIMIT 50`,
                [phoneNumber]
            );

            console.log(`[AVATAR-UPDATE] Encontrados ${contacts.length} contactos sin avatar`);

            let updatedCount = 0;
            let errorCount = 0;

            for (const contact of contacts) {
                try {
                    // Obtener URL del avatar desde WhatsApp
                    const avatarUrl = await session.sock.profilePictureUrl(contact.jid, 'image');
                    
                    if (avatarUrl) {
                        // Actualizar en base de datos
                        await connection.execute(
                            'UPDATE contacts SET avatar_url = ? WHERE jid = ? AND session_id = ?',
                            [avatarUrl, contact.jid, phoneNumber]
                        );
                        updatedCount++;
                        console.log(`[AVATAR-UPDATE] ✅ Avatar actualizado para ${contact.name || contact.jid}`);
                    }
                } catch (error) {
                    errorCount++;
                    // Es normal que algunos contactos no tengan avatar
                    if (!error.message?.includes('not-authorized') && !error.message?.includes('item-not-found')) {
                        console.error(`[AVATAR-UPDATE] ⚠️ Error obteniendo avatar de ${contact.jid}:`, error.message);
                    }
                }
                
                // Pequeña pausa para no saturar
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const stats = {
                totalContacts: contacts.length,
                updatedAvatars: updatedCount,
                errors: errorCount
            };

            console.log(`[AVATAR-UPDATE] ✅ Completado: ${updatedCount} actualizados, ${errorCount} errores`);

            res.json({
                success: true,
                message: `Avatares actualizados: ${updatedCount} de ${contacts.length} contactos`,
                stats
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('[AVATAR-UPDATE] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error actualizando avatares: ' + error.message
        });
    }
});

// ============= SISTEMA DE LÍMITE DE FRECUENCIA PARA PREVENIR SOBRECARGA =============
const rateLimit = require('express-rate-limit');

// Limitar peticiones a endpoints de Kanban
const kanbanRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // Aumentado a 100 solicitudes por minuto por IP
    message: {
        success: false,
        error: 'Demasiadas solicitudes al sistema Kanban, por favor inténtalo de nuevo más tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Aplicar límite a rutas de kanban
app.use(['/api/kanban/*'], kanbanRateLimit);

// ============= ENDPOINTS DE KANBAN =============
// NOTA: El endpoint GET /api/kanban/boards/:sessionId está definido más adelante (línea 4025)
// Este endpoint duplicado fue eliminado para evitar conflictos

// Crear tablero Kanban
app.post('/api/kanban/boards', async (req, res) => {
    const { sessionId, name, color } = req.body;

    if (!sessionId || !name) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: sessionId, name'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        if (!pool) {
            return res.status(500).json({
                success: false,
                error: 'Base de datos no disponible'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Generar UUID para el ID del tablero
            const boardId = `board_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            await connection.execute(
                'INSERT INTO kanban_boards (id, session_id, name, color) VALUES (?, ?, ?, ?)',
                [boardId, phoneNumber, name, color || '#3b82f6']
            );

            // 🔥 INVALIDAR CACHÉ después de crear tablero
            const cacheKey = `kanban_boards_${sessionId}`;
            if (kanbanCache && kanbanCache.has(cacheKey)) {
                kanbanCache.delete(cacheKey);
                console.log(`[KANBAN] ✅ Caché invalidado para ${sessionId}`);
            }

            res.json({
                success: true,
                data: {
                    id: boardId,
                    name,
                    color: color || '#3b82f6',
                    session_id: phoneNumber
                }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[KANBAN] Error creando tablero:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener contactos por categoría/tablero
app.get('/api/contacts/by-category/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { boardId } = req.query;

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        if (!pool) {
            return res.json({ success: true, data: { contacts: [] } });
        }

        const connection = await pool.getConnection();
        try {
            let query, params;

            if (boardId) {
                // Obtener contactos de un tablero específico
                query = `SELECT
                    c.jid,
                    c.name,
                    c.notify_name,
                    c.avatar_url,
                    c.is_group,
                    kc.board_id,
                    kc.notes,
                    kc.created_at as added_to_board_at
                FROM kanban_contacts kc
                JOIN contacts c ON kc.contact_jid = c.jid
                WHERE kc.board_id = ?
                ORDER BY kc.created_at DESC`;
                params = [boardId];
            } else {
                // Obtener todos los contactos de todos los tableros de la sesión
                query = `SELECT
                    c.jid,
                    c.name,
                    c.notify_name,
                    c.avatar_url,
                    c.is_group,
                    kc.board_id,
                    kb.name as board_name,
                    kb.color as board_color,
                    kc.notes,
                    kc.created_at as added_to_board_at
                FROM kanban_contacts kc
                JOIN contacts c ON kc.contact_jid = c.jid
                JOIN kanban_boards kb ON kc.board_id = kb.id
                WHERE kb.session_id = ?
                ORDER BY kc.created_at DESC`;
                params = [phoneNumber];
            }

            const [contactsRaw] = await connection.execute(query, params);

            // Si no hay boardId, agrupar contactos por board_name
            let contacts;
            if (!boardId) {
                // Agrupar contactos por board_name (no por board_id)
                contacts = contactsRaw.reduce((acc, contact) => {
                    const boardName = contact.board_name;
                    if (!acc[boardName]) {
                        acc[boardName] = [];
                    }
                    acc[boardName].push({
                        id: contact.jid,
                        name: contact.name || contact.notify_name || contact.jid.split('@')[0],
                        phone: contact.jid.split('@')[0],
                        avatar: contact.avatar_url,
                        category: contact.board_id,
                        board_name: contact.board_name,
                        board_color: contact.board_color,
                        notes: contact.notes,
                        last_message_time: contact.added_to_board_at
                    });
                    return acc;
                }, {});
            } else {
                // Devolver array simple si se pidió un boardId específico
                contacts = contactsRaw.map(contact => ({
                    id: contact.jid,
                    name: contact.name || contact.notify_name || contact.jid.split('@')[0],
                    phone: contact.jid,
                    avatar: contact.avatar_url,
                    category: contact.board_id,
                    notes: contact.notes,
                    last_message_time: contact.added_to_board_at
                }));
            }

            res.json({ success: true, data: { contacts } });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[KANBAN] Error obteniendo contactos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Agregar contacto a tablero Kanban
app.post('/api/kanban/contacts', async (req, res) => {
    const { boardId, contactJid, notes } = req.body;

    if (!boardId || !contactJid) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: boardId, contactJid'
        });
    }

    try {
        if (!pool) {
            return res.status(500).json({
                success: false,
                error: 'Base de datos no disponible'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Verificar si el contacto ya existe en el tablero
            const [existing] = await connection.execute(
                'SELECT id FROM kanban_contacts WHERE board_id = ? AND contact_jid = ?',
                [boardId, contactJid]
            );

            if (existing.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'El contacto ya está en este tablero'
                });
            }

            // Agregar contacto al tablero
            await connection.execute(
                'INSERT INTO kanban_contacts (board_id, contact_jid, notes) VALUES (?, ?, ?)',
                [boardId, contactJid, notes || '']
            );

            res.json({
                success: true,
                message: 'Contacto agregado al tablero exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[KANBAN] Error agregando contacto:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mover contacto entre tableros
app.put('/api/kanban/contacts/move', async (req, res) => {
    const { contactJid, fromBoardId, toBoardId, notes, sessionId } = req.body;

    if (!contactJid || !fromBoardId || !toBoardId) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: contactJid, fromBoardId, toBoardId'
        });
    }

    try {
        if (!pool) {
            return res.status(500).json({
                success: false,
                error: 'Base de datos no disponible'
            });
        }

        const connection = await pool.getConnection();
        try {
            const phoneNumber = sessionId ? await getUserPhoneNumber(sessionId) : null;
            
            // Asegurar que el contacto existe en la tabla contacts
            if (phoneNumber) {
                await connection.execute(
                    `INSERT INTO contacts (jid, session_id, name)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE jid = jid`,
                    [
                        contactJid, 
                        phoneNumber,
                        contactJid.split('@')[0]
                    ]
                );
            }
            
            // Eliminar del tablero anterior
            await connection.execute(
                'DELETE FROM kanban_contacts WHERE board_id = ? AND contact_jid = ?',
                [fromBoardId, contactJid]
            );

            // Agregar al nuevo tablero
            await connection.execute(
                'INSERT INTO kanban_contacts (board_id, contact_jid, notes) VALUES (?, ?, ?)',
                [toBoardId, contactJid, notes || '']
            );

            console.log(`[KANBAN] ✅ Contacto ${contactJid} movido de ${fromBoardId} a ${toBoardId}`);

            res.json({
                success: true,
                message: 'Contacto movido exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[KANBAN] Error moviendo contacto:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mover un solo contacto a un tablero (nuevo endpoint para menú contextual)
app.post('/api/kanban/move-contact', async (req, res) => {
    const { contactJid, boardId, contactName, contactAvatar, sessionId } = req.body;

    if (!contactJid || !boardId) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: contactJid, boardId'
        });
    }

    try {
        if (!pool) {
            return res.status(500).json({
                success: false,
                error: 'Base de datos no disponible'
            });
        }

        const connection = await pool.getConnection();
        try {
            const phoneNumber = sessionId ? await getUserPhoneNumber(sessionId) : null;
            
            // Asegurar que el contacto existe en la tabla contacts
            if (phoneNumber) {
                await connection.execute(
                    `INSERT INTO contacts (jid, session_id, name, avatar_url)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        name = COALESCE(VALUES(name), name),
                        avatar_url = COALESCE(VALUES(avatar_url), avatar_url)`,
                    [
                        contactJid,
                        phoneNumber,
                        contactName || contactJid.split('@')[0],
                        contactAvatar || null
                    ]
                );

                // PASO 1: Eliminar el contacto de TODOS los tableros del usuario
                await connection.execute(
                    `DELETE kc FROM kanban_contacts kc
                     INNER JOIN kanban_boards kb ON kc.board_id = kb.id
                     WHERE kc.contact_jid = ? AND kb.session_id = ?`,
                    [contactJid, phoneNumber]
                );
                console.log(`[KANBAN] 🗑️ Contacto ${contactJid} eliminado de tableros anteriores`);
            }

            // PASO 2: Insertar el contacto en el nuevo tablero
            await connection.execute(
                `INSERT INTO kanban_contacts (board_id, contact_jid, notes)
                 VALUES (?, ?, ?)`,
                [boardId, contactJid, '']
            );
            console.log(`[KANBAN] ✅ Contacto ${contactJid} movido al tablero ${boardId}`);

            res.json({
                success: true,
                message: 'Contacto agregado al tablero exitosamente',
                contactJid,
                boardId
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[KANBAN] Error moviendo contacto a tablero:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para mover contactos en bulk (usado en campañas)
app.post('/api/kanban/move-contacts-bulk', async (req, res) => {
    const { contacts, boardId } = req.body;

    if (!contacts || !Array.isArray(contacts) || !boardId) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: contacts (array), boardId'
        });
    }

    try {
        if (!pool) {
            return res.status(500).json({
                success: false,
                error: 'Base de datos no disponible'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Agregar todos los contactos al tablero
            for (const contact of contacts) {
                await connection.execute(
                    'INSERT INTO kanban_contacts (board_id, contact_jid, notes) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE board_id = VALUES(board_id)',
                    [boardId, contact.jid, '']
                );
            }

            res.json({
                success: true,
                message: `Contactos agregados al tablero exitosamente`,
                contactCount: contacts.length
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[KANBAN] Error moviendo contactos bulk:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Eliminar contacto de tablero
app.delete('/api/kanban/contacts/:boardId/:contactJid', async (req, res) => {
    const { boardId, contactJid } = req.params;

    try {
        if (!pool) {
            return res.status(500).json({
                success: false,
                error: 'Base de datos no disponible'
            });
        }

        const connection = await pool.getConnection();
        try {
            await connection.execute(
                'DELETE FROM kanban_contacts WHERE board_id = ? AND contact_jid = ?',
                [boardId, contactJid]
            );

            res.json({
                success: true,
                message: 'Contacto eliminado del tablero'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[KANBAN] Error eliminando contacto:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Actualizar tablero Kanban (nombre y color)
app.put('/api/kanban/boards/:boardId', async (req, res) => {
    const { boardId } = req.params;
    const { name, color } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({
            success: false,
            error: 'El nombre del tablero es requerido'
        });
    }

    try {
        if (!pool) {
            return res.status(500).json({
                success: false,
                error: 'Base de datos no disponible'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Primero obtener el session_id del tablero para invalidar caché
            const [boardData] = await connection.execute(
                'SELECT session_id FROM kanban_boards WHERE id = ?',
                [boardId]
            );

            if (boardData.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Tablero no encontrado'
                });
            }

            // Actualizar el tablero
            const [result] = await connection.execute(
                'UPDATE kanban_boards SET name = ?, color = ?, updated_at = NOW() WHERE id = ?',
                [name.trim(), color || '#607d8b', boardId]
            );

            // Invalidar caché después de actualizar tablero
            const sessionPhone = boardData[0].session_id;
            for (const [sid, sessionData] of sessions.entries()) {
                if (sessionData.phoneNumber === sessionPhone) {
                    const cacheKey = `kanban_boards_${sid}`;
                    if (kanbanCache && kanbanCache.has(cacheKey)) {
                        kanbanCache.delete(cacheKey);
                        console.log(`[KANBAN] ✅ Caché invalidado para ${sid} después de actualizar tablero`);
                    }
                    break;
                }
            }

            if (result.affectedRows > 0) {
                res.json({
                    success: true,
                    message: 'Tablero actualizado exitosamente'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'No se pudo actualizar el tablero'
                });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[KANBAN] Error actualizando tablero:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Eliminar tablero Kanban
app.delete('/api/kanban/boards/:boardId', async (req, res) => {
    const { boardId } = req.params;

    try {
        if (!pool) {
            return res.status(500).json({
                success: false,
                error: 'Base de datos no disponible'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Primero obtener el session_id del tablero para invalidar caché
            const [boardData] = await connection.execute(
                'SELECT session_id FROM kanban_boards WHERE id = ?',
                [boardId]
            );

            // Eliminar el tablero (los contactos se eliminan automáticamente por CASCADE)
            const [result] = await connection.execute(
                'DELETE FROM kanban_boards WHERE id = ?',
                [boardId]
            );

            // 🔥 INVALIDAR CACHÉ después de eliminar tablero
            if (boardData.length > 0) {
                const sessionPhone = boardData[0].session_id;
                // Buscar sessionId temporal que corresponde a este phoneNumber
                for (const [sid, sessionData] of sessions.entries()) {
                    if (sessionData.phoneNumber === sessionPhone) {
                        const cacheKey = `kanban_boards_${sid}`;
                        if (kanbanCache && kanbanCache.has(cacheKey)) {
                            kanbanCache.delete(cacheKey);
                            console.log(`[KANBAN] ✅ Caché invalidado para ${sid} después de eliminar tablero`);
                        }
                        break;
                    }
                }
            }

            if (result.affectedRows > 0) {
                res.json({
                    success: true,
                    message: 'Tablero eliminado exitosamente'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Tablero no encontrado'
                });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[KANBAN] Error eliminando tablero:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para buscar contactos en toda la base de datos (no solo en Kanban)
app.get('/api/kanban/search-all-contacts/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { search } = req.query;

    console.log(`[KANBAN-SEARCH-ALL] Buscando en toda la BD: "${search}"`);

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Base de datos no disponible'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            if (!search || search.trim() === '') {
                return res.json({
                    success: true,
                    contacts: [],
                    totalContacts: 0
                });
            }

            // Buscar en TODA la tabla contacts, no solo en kanban_contacts
            const searchTerm = `%${search.trim()}%`;
            const [contacts] = await connection.execute(`
                SELECT
                    c.jid,
                    c.name,
                    c.notify_name,
                    c.avatar_url,
                    c.created_at,
                    CASE
                        WHEN kc.id IS NOT NULL THEN kc.board_id
                        ELSE NULL
                    END as current_board_id,
                    CASE
                        WHEN kc.id IS NOT NULL THEN kb.name
                        ELSE NULL
                    END as current_board_name
                FROM contacts c
                LEFT JOIN kanban_contacts kc ON c.jid = kc.contact_jid
                LEFT JOIN kanban_boards kb ON kc.board_id = kb.id AND kb.session_id = c.session_id
                WHERE c.session_id = ?
                AND c.jid LIKE '%@s.whatsapp.net'
                AND (
                    c.name LIKE ? OR
                    c.notify_name LIKE ? OR
                    c.jid LIKE ?
                )
                ORDER BY c.created_at DESC
                LIMIT 100
            `, [phoneNumber, searchTerm, searchTerm, searchTerm]);

            console.log(`[KANBAN-SEARCH-ALL] ✅ ${contacts.length} contactos encontrados en toda la BD`);

            const formattedContacts = contacts.map(c => ({
                jid: c.jid,
                phone: c.jid?.split('@')[0] || '',
                name: c.name || c.notify_name || c.jid?.split('@')[0] || 'Sin nombre',
                avatarUrl: c.avatar_url,
                currentBoardId: c.current_board_id,
                currentBoardName: c.current_board_name,
                inKanban: c.current_board_id !== null
            }));

            res.json({
                success: true,
                contacts: formattedContacts,
                totalContacts: contacts.length
            });

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[KANBAN-SEARCH-ALL] Error buscando contactos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al buscar contactos: ' + error.message
        });
    }
});

// Endpoint para sincronizar todos los contactos al tablero Kanban por defecto
app.post('/api/kanban/sync-all-contacts/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    console.log('[KANBAN-SYNC] Iniciando sincronización de contactos al Kanban...');

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Base de datos no disponible'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // 1. Obtener el tablero "Sin Categoría" (por defecto)
            const [boards] = await connection.execute(
                'SELECT id FROM kanban_boards WHERE session_id = ? AND name = ? LIMIT 1',
                [phoneNumber, 'Sin Categoría']
            );

            if (boards.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Tablero "Sin Categoría" no encontrado. Crea los tableros primero.'
                });
            }

            const defaultBoardId = boards[0].id;
            console.log(`[KANBAN-SYNC] Tablero por defecto ID: ${defaultBoardId}`);

            // 2. Obtener todos los contactos que NO están en kanban_contacts
            const [contactsToSync] = await connection.execute(`
                SELECT c.jid, c.name, c.avatar_url
                FROM contacts c
                WHERE c.session_id = ?
                AND c.jid LIKE '%@s.whatsapp.net'
                AND NOT EXISTS (
                    SELECT 1 FROM kanban_contacts kc
                    INNER JOIN kanban_boards kb ON kc.board_id = kb.id
                    WHERE kc.contact_jid = c.jid
                    AND kb.session_id = ?
                )
                LIMIT 5000
            `, [phoneNumber, phoneNumber]);

            console.log(`[KANBAN-SYNC] Contactos a sincronizar: ${contactsToSync.length}`);

            if (contactsToSync.length === 0) {
                return res.json({
                    success: true,
                    message: 'Todos los contactos ya están sincronizados',
                    syncedCount: 0,
                    totalContacts: 0
                });
            }

            // 3. Insertar contactos en lote al tablero por defecto
            let syncedCount = 0;
            const batchSize = 100;

            for (let i = 0; i < contactsToSync.length; i += batchSize) {
                const batch = contactsToSync.slice(i, i + batchSize);
                const values = batch.map(c => `(${connection.escape(defaultBoardId)}, ${connection.escape(c.jid)}, '')`).join(',');

                await connection.query(`
                    INSERT INTO kanban_contacts (board_id, contact_jid, notes)
                    VALUES ${values}
                    ON DUPLICATE KEY UPDATE board_id = VALUES(board_id)
                `);

                syncedCount += batch.length;
                console.log(`[KANBAN-SYNC] Sincronizados ${syncedCount}/${contactsToSync.length}...`);
            }

            console.log(`[KANBAN-SYNC] ✅ Sincronización completada: ${syncedCount} contactos`);

            res.json({
                success: true,
                message: `${syncedCount} contactos sincronizados exitosamente`,
                syncedCount: syncedCount,
                totalContacts: contactsToSync.length
            });

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[KANBAN-SYNC] Error sincronizando contactos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al sincronizar contactos: ' + error.message
        });
    }
});

// Endpoint para sincronizar contactos
app.post('/api/sync/contacts', async (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ 
            success: false, 
            error: 'sessionId es requerido' 
        });
    }
    
    try {
        console.log(`[SYNC-CONTACTS] Iniciando sincronización para sessionId: ${sessionId}`);
        
        // Obtener el phoneNumber del usuario primero
        const phoneNumber = await getUserPhoneNumber(sessionId);
        console.log(`[SYNC-CONTACTS] PhoneNumber obtenido: ${phoneNumber}`);
        
        // Obtener socket de WhatsApp desde sessions - intentar con phoneNumber primero, luego sessionId
        let session = sessions.get(phoneNumber) || sessions.get(sessionId);
        
        if (!session) {
            console.log(`[SYNC-CONTACTS] Intentando con todas las sesiones activas...`);
            // Buscar en todas las sesiones activas
            for (const [key, sess] of sessions.entries()) {
                if (sess.sock?.user?.id?.includes(phoneNumber) || key === phoneNumber || key === sessionId) {
                    session = sess;
                    console.log(`[SYNC-CONTACTS] Sesión encontrada con key: ${key}`);
                    break;
                }
            }
        }
        
        const sock = session?.sock;
        
        if (!sock || !sock.user) {
            console.error(`[SYNC-CONTACTS] Sesión no encontrada. SessionId: ${sessionId}, PhoneNumber: ${phoneNumber}`);
            console.log(`[SYNC-CONTACTS] Sesiones activas:`, Array.from(sessions.keys()));
            return res.status(400).json({ 
                success: false, 
                error: 'Sesión no encontrada o no conectada. Escanea el QR primero.' 
            });
        }
        
        console.log(`[SYNC-CONTACTS] Sesión encontrada, usuario: ${sock.user?.id}`);
        
        console.log(`[SYNC-CONTACTS] WhatsApp conectado, obteniendo contactos...`);
        
        // Obtener contactos desde múltiples fuentes
        let contacts = {};
        let chats = [];
        let skippedGroups = 0;
        
        // 1. Obtener TODOS los chats (esto incluye todos los contactos con los que has hablado)
        try {
            // Intentar obtener chats desde el store primero
            if (sock.store?.chats && sock.store.chats.all) {
                chats = sock.store.chats.all();
                console.log(`[SYNC-CONTACTS] Chats desde store:`, chats.length);
            } else if (sock.store?.chats) {
                chats = Array.from(sock.store.chats.values?.() || []);
                console.log(`[SYNC-CONTACTS] Chats desde store (values):`, chats.length);
            }
            
            // Si no hay chats en store, obtener desde mensajes históricos
            if (chats.length === 0) {
                console.log(`[SYNC-CONTACTS] Obteniendo chats desde mensajes históricos...`);
                const chatList = await sock.chatFetch?.({ count: 10000 }) || [];
                chats = Array.isArray(chatList) ? chatList : Object.values(chatList);
                console.log(`[SYNC-CONTACTS] Chats históricos obtenidos:`, chats.length);
            }
        } catch (err) {
            console.error(`[SYNC-CONTACTS] Error obteniendo chats:`, err.message);
        }
        
        // 2. PRIMERO: Obtener contactos del store (LO MÁS IMPORTANTE)
        console.log(`[SYNC-CONTACTS] Obteniendo contactos desde sock.store.contacts...`);
        if (sock.store?.contacts) {
            let storeContactsCount = 0;
            for (const [jid, contact] of sock.store.contacts.entries()) {
                if (jid.includes('@s.whatsapp.net')) {
                    contacts[jid] = {
                        id: jid,
                        name: contact.name || contact.notify || contact.verifiedName || jid.split('@')[0],
                        notify: contact.notify || contact.name || jid.split('@')[0],
                        verifiedName: contact.verifiedName
                    };
                    storeContactsCount++;
                }
            }
            console.log(`[SYNC-CONTACTS] ✓ ${storeContactsCount} contactos desde store.contacts`);
        }
        
        // 3. SEGUNDO: Procesar chats para obtener pushName y nombres adicionales
        console.log(`[SYNC-CONTACTS] Procesando ${chats.length} chats para obtener nombres...`);
        for (const chat of chats) {
            if (chat && chat.id && chat.id.includes('@s.whatsapp.net')) {
                const jid = chat.id;
                const chatName = chat.name || chat.notify || chat.pushName;
                
                // Si ya existe, actualizar SOLO si tenemos un nombre mejor
                if (contacts[jid]) {
                    // Actualizar solo si el nuevo nombre no es el número
                    if (chatName && chatName !== jid.split('@')[0] && chatName.trim() !== '') {
                        if (!contacts[jid].name || contacts[jid].name === jid.split('@')[0]) {
                            contacts[jid].name = chatName;
                            contacts[jid].notify = chat.notify || chatName;
                        }
                    }
                } else {
                    // Crear nuevo contacto
                    contacts[jid] = { 
                        id: jid, 
                        name: chatName || jid.split('@')[0], 
                        notify: chat.notify || chatName || jid.split('@')[0]
                    };
                }
            }
        }
        
        // 4. TERCERO: Buscar pushName en mensajes recientes
        console.log(`[SYNC-CONTACTS] Buscando pushName en mensajes recientes...`);
        if (sock.store?.messages) {
            let pushNameCount = 0;
            for (const [jid, messages] of sock.store.messages.entries()) {
                if (jid.includes('@s.whatsapp.net') && messages.size > 0) {
                    // Buscar el pushName más reciente
                    for (const msg of Array.from(messages.values()).reverse()) {
                        if (msg.pushName && msg.pushName !== jid.split('@')[0] && msg.pushName.trim() !== '') {
                            if (contacts[jid]) {
                                // Actualizar solo si no tenemos nombre o es solo el número
                                if (!contacts[jid].name || contacts[jid].name === jid.split('@')[0]) {
                                    contacts[jid].name = msg.pushName;
                                    contacts[jid].notify = msg.pushName;
                                    pushNameCount++;
                                }
                            } else {
                                contacts[jid] = {
                                    id: jid,
                                    name: msg.pushName,
                                    notify: msg.pushName
                                };
                                pushNameCount++;
                            }
                            break; // Ya encontramos el pushName, siguiente contacto
                        }
                    }
                }
            }
            console.log(`[SYNC-CONTACTS] ✓ ${pushNameCount} nombres obtenidos desde pushName`);
        }
        
        console.log(`[SYNC-CONTACTS] Total contactos únicos recopilados:`, Object.keys(contacts).length);
        
        let processedContacts = 0;
        let processedGroups = 0;

        // 4. Procesar y guardar en BD
        for (const [jid, contact] of Object.entries(contacts)) {
            if (typeof contact === 'object' && jid) {
                if (jid.includes('@s.whatsapp.net')) {
                    // Solo contactos individuales - IMPORTANTE: pasar sock para obtener nombres reales
                    await getOrInsertContact(
                        jid,
                        contact.name || contact.notify || jid.split('@')[0],
                        contact.notify || contact.name,
                        phoneNumber,
                        sock  // ← AGREGADO: pasar sock para obtener nombres reales desde WhatsApp
                    );
                    processedContacts++;
                } else if (jid.includes('@g.us')) {
                    // Grupos - contar pero no procesar aquí (usar sync groups)
                    skippedGroups++;
                } else if (jid.includes('status@broadcast')) {
                    // Status broadcast
                    await getOrInsertBroadcast(jid, 'status@broadcast', phoneNumber, 'status');
                } else if (jid.includes('@lid')) {
                    // Newsletter
                    await getOrInsertBroadcast(jid, contact.name || jid, phoneNumber, 'newsletter');
                }
            }
        }
        
        console.log(`[SYNC-CONTACTS] ✅ Sincronización completada:`);
        console.log(`[SYNC-CONTACTS]    - Contactos procesados: ${processedContacts}`);
        console.log(`[SYNC-CONTACTS]    - Grupos omitidos: ${skippedGroups}`)
        
        res.json({
            success: true,
            stats: {
                processedContacts,
                skippedGroups,
                totalProcessed: processedContacts + skippedGroups
            }
        });
    } catch (error) {
        console.error('[SYNC-CONTACTS] Error sincronizando contactos:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Endpoint para sincronizar grupos
app.post('/api/sync/groups', async (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ 
            success: false, 
            error: 'sessionId es requerido' 
        });
    }
    
    try {
        console.log(`[SYNC-GROUPS] Iniciando sincronización de grupos para sessionId: ${sessionId}`);
        
        // Obtener el phoneNumber del usuario primero
        const phoneNumber = await getUserPhoneNumber(sessionId);
        console.log(`[SYNC-GROUPS] PhoneNumber obtenido: ${phoneNumber}`);
        
        // Obtener socket de WhatsApp desde sessions - intentar con phoneNumber primero, luego sessionId
        let session = sessions.get(phoneNumber) || sessions.get(sessionId);
        
        if (!session) {
            console.log(`[SYNC-GROUPS] Intentando con todas las sesiones activas...`);
            // Buscar en todas las sesiones activas
            for (const [key, sess] of sessions.entries()) {
                if (sess.sock?.user?.id?.includes(phoneNumber) || key === phoneNumber || key === sessionId) {
                    session = sess;
                    console.log(`[SYNC-GROUPS] Sesión encontrada con key: ${key}`);
                    break;
                }
            }
        }
        
        const sock = session?.sock;
        
        if (!sock || !sock.user) {
            console.error(`[SYNC-GROUPS] Sesión no encontrada. SessionId: ${sessionId}, PhoneNumber: ${phoneNumber}`);
            console.log(`[SYNC-GROUPS] Sesiones activas:`, Array.from(sessions.keys()));
            return res.status(400).json({ 
                success: false, 
                error: 'Sesión no encontrada o no conectada. Escanea el QR primero.' 
            });
        }
        
        console.log(`[SYNC-GROUPS] Sesión encontrada, usuario: ${sock.user?.id}`);
        
        console.log(`[SYNC-GROUPS] WhatsApp conectado, obteniendo grupos...`);
        
        // Obtener grupos de WhatsApp
        const groupFetchResult = await sock.groupFetchAllParticipating().catch(err => {
            console.error('[SYNC-GROUPS] Error obteniendo grupos:', err);
            return {};
        });
        
        console.log(`[SYNC-GROUPS] Grupos obtenidos:`, Object.keys(groupFetchResult).length);
        
        let groups = 0;
        let totalMembers = 0;
        
        if (groupFetchResult && typeof groupFetchResult === 'object') {
            for (const [jid, groupData] of Object.entries(groupFetchResult)) {
                if (jid.includes('@g.us') && typeof groupData === 'object') {
                    // Guardar grupo en contact_groups
                    await getOrInsertWhatsAppGroup(
                        jid,
                        groupData.subject || groupData.name,
                        groupData.subject || groupData.name,
                        phoneNumber,
                        groupData
                    );

                    // Guardar miembros en contact_group_members
                    const participants = groupData.participants || groupData.participant || [];
                    if (participants.length > 0) {
                        await insertGroupMembers(jid, participants, phoneNumber);
                        totalMembers += participants.length;
                    }

                    groups++;
                }
            }
        }
        
        res.json({
            success: true,
            stats: {
                groups,
                totalMembers,
                message: `Sincronizados ${groups} grupos con ${totalMembers} miembros`
            }
        });
    } catch (error) {
        console.error('[SYNC-GROUPS] Error sincronizando grupos:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// SINCRONIZACIÓN COMPLETA - MEJORAS CHAT
// =====================================================

// Sincronizar todos los contactos
app.post('/api/contacts/sync/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        const sock = sessions.get(sessionId)?.sock;
        if (!sock) {
            return res.status(404).json({ 
                success: false, 
                error: 'Sesión no encontrada o no conectada' 
            });
        }
        
        console.log(`[${sessionId}] 🔄 Iniciando sincronización de contactos...`);
        
        // Obtener todos los contactos del store de Baileys
        const phoneNumber = await getUserPhoneNumber(sessionId);
        let syncedCount = 0;
        
        // Intentar obtener contactos del store
        if (sock.store?.contacts) {
            const contactsMap = sock.store.contacts;
            
            for (const [jid, contact] of Object.entries(contactsMap)) {
                if (jid.includes('@s.whatsapp.net')) {
                    await getOrInsertContact(
                        jid, 
                        contact.name, 
                        contact.notify, 
                        phoneNumber
                    );
                    syncedCount++;
                }
            }
        }
        
        // También obtener contactos de los chats
        if (sock.store?.chats) {
            const chatsMap = sock.store.chats;
            
            for (const [jid, chat] of Object.entries(chatsMap)) {
                if (jid.includes('@s.whatsapp.net')) {
                    await getOrInsertContact(
                        jid,
                        chat.name || null,
                        chat.notify || null,
                        phoneNumber
                    );
                    syncedCount++;
                }
            }
        }
        
        console.log(`[${sessionId}] ✅ ${syncedCount} contactos sincronizados`);
        
        res.json({
            success: true,
            message: `${syncedCount} contactos sincronizados`,
            count: syncedCount
        });
        
    } catch (error) {
        console.error(`[${sessionId}] ❌ Error sincronizando contactos:`, error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Sincronizar todos los grupos
app.post('/api/groups/sync/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        const session = sessions.get(sessionId);
        if (!session || !session.sock || !session.isConnected) {
            return res.status(404).json({ 
                success: false, 
                error: 'Sesión no encontrada o no conectada' 
            });
        }
        
        console.log(`[${sessionId}] 🔄 Iniciando sincronización de grupos...`);
        
        const phoneNumber = await getUserPhoneNumber(sessionId);
        let syncedCount = 0;
        let membersCount = 0;
        
        // Obtener todos los grupos usando groupFetchAllParticipating
        const groupFetchResult = await session.sock.groupFetchAllParticipating().catch(err => {
            console.error(`[${sessionId}] Error obteniendo grupos:`, err);
            return {};
        });
        
        if (groupFetchResult && typeof groupFetchResult === 'object') {
            for (const [jid, groupData] of Object.entries(groupFetchResult)) {
                if (jid.includes('@g.us') && typeof groupData === 'object') {
                    try {
                        // Obtener metadatos completos del grupo incluyendo participantes
                        console.log(`[${sessionId}] 📥 Obteniendo metadatos de ${groupData.subject || jid}...`);
                        const metadata = await session.sock.groupMetadata(jid).catch(err => {
                            console.error(`[${sessionId}] Error obteniendo metadatos de ${jid}:`, err);
                            return null;
                        });
                        
                        let participants = [];
                        let participantCount = 0;
                        
                        if (metadata && metadata.participants) {
                            participants = metadata.participants;
                            participantCount = participants.length;
                        } else if (groupData.participants) {
                            participants = groupData.participants;
                            participantCount = participants.length;
                        }
                        
                        // Guardar grupo con el contador correcto
                        const groupDbId = await getOrInsertWhatsAppGroup(
                            jid,
                            groupData.subject || groupData.name || 'Grupo',
                            groupData.subject || groupData.name || 'Grupo',
                            phoneNumber,
                            { ...groupData, participants: participants, participantCount: participantCount }
                        );
                        
                        // Guardar miembros del grupo
                        if (participants.length > 0) {
                            console.log(`[${sessionId}] 👥 Guardando ${participants.length} miembros de ${groupData.subject || jid}`);
                            await insertGroupMembers(jid, participants, phoneNumber);
                            membersCount += participants.length;
                            
                            // Actualizar el contador en la base de datos
                            if (pool) {
                                const connection = await pool.getConnection();
                                await connection.query(
                                    'UPDATE contact_groups SET participants_count = ? WHERE jid = ? AND session_id = ?',
                                    [participants.length, jid, phoneNumber]
                                );
                                connection.release();
                            }
                        }
                        
                        syncedCount++;
                    } catch (groupError) {
                        console.error(`[${sessionId}] Error procesando grupo ${jid}:`, groupError);
                    }
                }
            }
        }
        
        console.log(`[${sessionId}] ✅ ${syncedCount} grupos sincronizados con ${membersCount} miembros`);
        
        res.json({
            success: true,
            message: `${syncedCount} grupos sincronizados con ${membersCount} miembros`,
            count: syncedCount,
            members: membersCount
        });
        
    } catch (error) {
        console.error(`[${sessionId}] ❌ Error sincronizando grupos:`, error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Descargar todos los mensajes de un chat
app.post('/api/messages/sync/:sessionId/:chatJid', async (req, res) => {
    const { sessionId, chatJid } = req.params;
    const { limit = 50 } = req.body; // Reducido a 50 para mejor rendimiento
    
    try {
        const session = sessions.get(sessionId);
        if (!session || !session.sock || !session.isConnected) {
            return res.status(404).json({ 
                success: false, 
                error: 'Sesión no encontrada o no conectada' 
            });
        }
        
        console.log(`[${sessionId}] 🔄 Sincronizando ${limit} mensajes de ${chatJid}...`);
        
        const phoneNumber = await getUserPhoneNumber(sessionId);
        
        // Obtener mensajes del store primero
        let savedCount = 0;
        
        if (session.sock.store?.messages && session.sock.store.messages[chatJid]) {
            const messagesArray = Array.from(session.sock.store.messages[chatJid].values());
            
            // Limitar cantidad de mensajes
            const messagesToSync = messagesArray.slice(0, limit);
            
            for (const msg of messagesToSync) {
                if (!msg.key || !msg.key.id) continue;
                
                try {
                    const messageType = Object.keys(msg.message || {})[0] || 'text';
                    
                    await saveMessageToDB(phoneNumber, {
                        id: msg.key.id,
                        chat_jid: msg.key.remoteJid,
                        from_me: msg.key.fromMe || false,
                        sender_jid: msg.key.participant || msg.key.remoteJid,
                        timestamp: new Date((msg.messageTimestamp * 1000) || Date.now()),
                        message_type: messageType,
                        text_content: msg.message?.conversation || 
                                      msg.message?.extendedTextMessage?.text || 
                                      msg.message?.imageMessage?.caption ||
                                      msg.message?.videoMessage?.caption || '',
                        media_url: null,
                        status: msg.key.fromMe ? 'sent' : 'received',
                        is_deleted: false
                    });
                    savedCount++;
                } catch (msgError) {
                    console.error(`Error guardando mensaje ${msg.key.id}:`, msgError.message);
                }
            }
        }
        
        console.log(`[${sessionId}] ✅ ${savedCount} mensajes sincronizados para ${chatJid}`);
        
        res.json({
            success: true,
            message: `${savedCount} mensajes sincronizados`,
            count: savedCount,
            chatJid: chatJid
        });
        
    } catch (error) {
        console.error(`[${sessionId}] ❌ Error sincronizando mensajes:`, error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ============================================================
// KANBAN ENDPOINTS
// ============================================================

// Obtener tableros Kanban de una sesión con sistema de caché
app.get('/api/kanban/boards/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const cacheKey = `kanban_boards_${sessionId}`;
    
    // Verificar si hay datos en caché
    if (kanbanCache.has(cacheKey)) {
        const cachedData = kanbanCache.get(cacheKey);
        if (Date.now() - cachedData.timestamp < CACHE_DURATION) {
            console.log(`[CACHE-KANBAN] Sirviendo tableros desde caché para ${sessionId}`);
            return res.json({
                success: true,
                boards: cachedData.data,
                total: cachedData.data.length,
                fromCache: true
            });
        }
    }

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Consulta optimizada con timeout
            const queryPromise = connection.execute(
                `SELECT
                    id,
                    session_id,
                    name,
                    color,
                    board_order,
                    is_default,
                    created_at,
                    updated_at
                FROM kanban_boards
                WHERE session_id = ?
                ORDER BY board_order ASC, created_at ASC
                LIMIT 20`,  // Reducir límite para evitar sobrecarga de recursos
                [phoneNumber]
            );
            
            // Agregar timeout para evitar bloqueos
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Tiempo de consulta excedido')), 8000)
            );
            
            const [boards] = await Promise.race([queryPromise, timeoutPromise]);

            // Almacenar en caché
            kanbanCache.set(cacheKey, {
                data: boards,
                timestamp: Date.now()
            });

            res.json({
                success: true,
                boards: boards,
                total: boards.length,
                fromCache: false
            });

        } catch (queryError) {
            console.error('[API-KANBAN-BOARDS] Error en la consulta:', queryError);
            res.status(500).json({
                success: false,
                error: 'Error consultando los tableros'
            });
        } finally {
            if (connection) {
                connection.release(); // Asegurar que la conexión se libere correctamente
            }
        }
    } catch (error) {
        console.error('[API-KANBAN-BOARDS] Error obteniendo tableros Kanban:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al obtener tableros Kanban'
        });
    }
});

// Obtener contactos de tableros Kanban organizados por tablero
app.get('/api/kanban/contacts/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { search } = req.query;

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            let sql = `SELECT
                    kc.id,
                    kc.board_id,
                    kc.contact_jid,
                    kc.notes,
                    kc.created_at,
                    kc.updated_at,
                    c.name,
                    c.notify_name,
                    c.avatar_url,
                    kb.is_default
                FROM kanban_contacts kc
                INNER JOIN kanban_boards kb ON kc.board_id = kb.id
                LEFT JOIN contacts c ON kc.contact_jid = c.jid AND c.session_id = kb.session_id
                WHERE kb.session_id = ?`;

            const params = [phoneNumber];

            // Si hay búsqueda, agregar filtro
            if (search && search.trim()) {
                sql += ` AND (
                    c.name LIKE ? OR
                    c.notify_name LIKE ? OR
                    kc.contact_jid LIKE ?
                )`;
                const searchTerm = `%${search.trim()}%`;
                params.push(searchTerm, searchTerm, searchTerm);
                console.log(`[KANBAN] 🔍 Buscando: "${search}"`);
            }

            // Orden condicional: Sin Categoría (is_default=1) en ASC, los demás en DESC
            sql += ' ORDER BY CASE WHEN kb.is_default = 1 THEN kc.created_at END ASC, CASE WHEN kb.is_default != 1 THEN kc.created_at END DESC LIMIT 25';

            // Consulta con timeout
            const queryPromise = connection.execute(sql, params);
            
            // Agregar timeout para evitar bloqueos
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Tiempo de consulta Kanban Contacts excedido')), 10000)
            );
            
            const [kanbanContacts] = await Promise.race([queryPromise, timeoutPromise]);

            // Organizar contactos por tablero
            const contactsByBoard = new Map(); // Usar Map para mejor rendimiento

            for (const contact of kanbanContacts) {
                if (!contactsByBoard.has(contact.board_id)) {
                    contactsByBoard.set(contact.board_id, []);
                }

                contactsByBoard.get(contact.board_id).push({
                    id: contact.id,
                    jid: contact.contact_jid,
                    phone: contact.contact_jid?.split('@')[0] || '',
                    name: contact.name || contact.notify_name || contact.contact_jid?.split('@')[0] || 'Sin nombre',
                    avatarUrl: contact.avatar_url,
                    notes: contact.notes,
                    category: contact.board_id,
                    addedAt: contact.created_at,
                    updatedAt: contact.updated_at
                });
            }

            res.json({
                success: true,
                contactsByBoard: Object.fromEntries(contactsByBoard), // Convertir a objeto para compatibilidad
                totalContacts: kanbanContacts.length
            });

        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error('[API-KANBAN-CONTACTS] Error obteniendo contactos de Kanban:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al obtener contactos de Kanban'
        });
    }
});

// ============= SISTEMA DE LIMPIEZA DE CACHÉ =============

// Limpiar caché de Kanban periódicamente (cada 10 minutos)
setInterval(() => {
    if (kanbanCache && typeof kanbanCache.forEach === 'function') {
        const now = Date.now();
        let cleanedCount = 0;
        
        kanbanCache.forEach((value, key) => {
            if (now - value.timestamp > CACHE_DURATION) {
                kanbanCache.delete(key);
                cleanedCount++;
            }
        });
        
        if (cleanedCount > 0) {
            console.log(`[CACHE-CLEANUP] Limpiados ${cleanedCount} elementos del caché de Kanban`);
        }
    }
}, 600000); // 10 minutos

// ============= ENDPOINTS DE CAMPAÑAS =============

// Obtener campañas por sesión
app.get('/api/campaigns/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    if (!pool) {
        return res.json({ success: true, data: { campaigns: [] } });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            const [campaigns] = await connection.execute(
                `SELECT
                    c.id,
                    c.name,
                    c.message_template,
                    c.use_random_timing,
                    c.random_timing_msg_count,
                    c.random_timing_time_span_minutes,
                    c.use_id_flow,
                    c.id_flow_size,
                    c.status,
                    c.created_at,
                    c.updated_at,
                    COUNT(cr.id) as total_recipients,
                    SUM(CASE WHEN cr.status = 'sent' THEN 1 ELSE 0 END) as sent_count,
                    SUM(CASE WHEN cr.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                    SUM(CASE WHEN cr.status = 'pending' THEN 1 ELSE 0 END) as pending_count
                FROM campaigns c
                LEFT JOIN campaign_recipients cr ON c.id = cr.campaign_id
                WHERE c.session_id = ?
                GROUP BY c.id
                ORDER BY c.created_at DESC`,
                [phoneNumber]
            );

            res.json({ success: true, data: { campaigns } });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CAMPAIGNS] Error obteniendo campañas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Subir archivo multimedia para campaña
app.post('/api/campaigns/upload-media', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('[CAMPAIGNS] Error Multer:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    success: false,
                    error: 'Archivo demasiado grande. Máximo permitido: 100MB'
                });
            }
            return res.status(400).json({
                success: false,
                error: `Error al subir archivo: ${err.message}`
            });
        } else if (err) {
            console.error('[CAMPAIGNS] Error subiendo archivo:', err);
            return res.status(400).json({
                success: false,
                error: err.message
            });
        }

        try {
            const { sessionId } = req.body;
            const file = req.file;

            if (!file) {
                return res.status(400).json({
                    success: false,
                    error: 'No se proporcionó archivo'
                });
            }

            console.log(`[CAMPAIGNS] ✅ Archivo subido: ${file.filename} (${file.mimetype}) - ${(file.size / 1024 / 1024).toFixed(2)}MB`);

            // Construir URL del archivo
            const mediaUrl = `/uploads/${file.filename}`;

            res.json({
                success: true,
                data: {
                    mediaUrl: mediaUrl,
                    mediaType: file.mimetype,
                    fileName: file.originalname,
                    fileSize: file.size
                }
            });
        } catch (error) {
            console.error('[CAMPAIGNS] Error procesando archivo:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
});

// Crear nueva campaña
app.post('/api/campaigns/create', async (req, res) => {
    const { sessionId, campaign } = req.body;

    if (!sessionId || !campaign) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: sessionId, campaign'
        });
    }

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Insertar campaña
            const [result] = await connection.execute(
                `INSERT INTO campaigns (
                    session_id, name, message_template, message_media_url, message_media_type,
                    use_random_timing, random_timing_msg_count, random_timing_time_span_minutes,
                    use_id_flow, id_flow_size, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [
                    phoneNumber,
                    campaign.name,
                    campaign.message?.text || campaign.messageTemplate || '',
                    campaign.mediaUrl || null,
                    campaign.mediaType || null,
                    campaign.useRandomTiming || false,
                    campaign.randomTimingMsgCount || null,
                    campaign.randomTimingTimeSpanMinutes || null,
                    campaign.useIdFlow || false,
                    campaign.idFlowSize || null
                ]
            );

            const campaignId = result.insertId;

            // Insertar destinatarios
            if (campaign.recipients && campaign.recipients.length > 0) {
                const recipientValues = campaign.recipients.map(r => [
                    campaignId,
                    r.jid || r.id,
                    'pending',
                    null,
                    null
                ]);

                await connection.query(
                    `INSERT INTO campaign_recipients (campaign_id, contact_jid, status, message_id, error_message)
                     VALUES ?`,
                    [recipientValues]
                );
            }

            res.json({
                success: true,
                data: { campaignId },
                message: 'Campaña creada exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CAMPAIGNS] Error creando campaña:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT: Actualizar contacto en campaña personalizada
app.put('/api/personalized-campaigns/:campaignId/contact', async (req, res) => {
    const { campaignId } = req.params;
    const { sessionId, contact } = req.body;

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            // Obtener la campaña actual
            const [campaigns] = await connection.execute(
                'SELECT contacts FROM campaigns WHERE id = ? AND session_id = ?',
                [campaignId, phoneNumber]
            );

            if (campaigns.length === 0) {
                connection.release();
                return res.status(404).json({ success: false, error: 'Campaña no encontrada' });
            }

            // Parsear contactos
            let contacts = JSON.parse(campaigns[0].contacts || '[]');

            // Buscar y actualizar el contacto por teléfono
            const contactIndex = contacts.findIndex((c) => c.telefono === contact.telefono);
            
            if (contactIndex === -1) {
                connection.release();
                return res.status(404).json({ success: false, error: 'Contacto no encontrado' });
            }

            // Actualizar el contacto
            contacts[contactIndex] = contact;

            // Guardar de vuelta en la base de datos
            await connection.execute(
                'UPDATE campaigns SET contacts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [JSON.stringify(contacts), campaignId]
            );

            console.log(`[PERSONALIZED-CAMPAIGN] Contacto actualizado en campaña ${campaignId}`);

            res.json({ success: true, message: 'Contacto actualizado correctamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[PERSONALIZED-CAMPAIGN] Error actualizando contacto:', error);
        res.status(500).json({ success: false, error: 'Error al actualizar contacto' });
    }
});

// DELETE: Eliminar contacto de campaña personalizada
app.delete('/api/personalized-campaigns/:campaignId/contact/:phoneNumber', async (req, res) => {
    const { campaignId, phoneNumber } = req.params;
    const { sessionId } = req.query;

    try {
        const userPhone = await getUserPhoneNumber(sessionId);
        if (!userPhone) {
            return res.status(400).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            // Obtener la campaña actual
            const [campaigns] = await connection.execute(
                'SELECT contacts, progress_total FROM campaigns WHERE id = ? AND session_id = ?',
                [campaignId, userPhone]
            );

            if (campaigns.length === 0) {
                connection.release();
                return res.status(404).json({ success: false, error: 'Campaña no encontrada' });
            }

            // Parsear contactos
            let contacts = JSON.parse(campaigns[0].contacts || '[]');
            const originalCount = contacts.length;

            // Filtrar el contacto a eliminar
            contacts = contacts.filter((c) => c.telefono !== phoneNumber);

            if (contacts.length === originalCount) {
                connection.release();
                return res.status(404).json({ success: false, error: 'Contacto no encontrado' });
            }

            // Actualizar la base de datos
            await connection.execute(
                'UPDATE campaigns SET contacts = ?, progress_total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [JSON.stringify(contacts), contacts.length, campaignId]
            );

            console.log(`[PERSONALIZED-CAMPAIGN] Contacto ${phoneNumber} eliminado de campaña ${campaignId}`);

            res.json({ success: true, message: 'Contacto eliminado correctamente', remainingContacts: contacts.length });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[PERSONALIZED-CAMPAIGN] Error eliminando contacto:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar contacto' });
    }
});

// PUT - Editar item individual de campaña personalizada
app.put('/api/personalized-campaigns/items/:id', authenticateToken, async (req, res) => {
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const { id } = req.params;
        const { name, phone, data1, data2, data3, scheduled_date, scheduled_time, status } = req.body;
        
        const connection = await pool.getConnection();
        try {
            // Verificar si existe tabla personalized_campaign_items
            const [tables] = await connection.execute(
                "SHOW TABLES LIKE 'personalized_campaign_items'"
            );
            
            if (tables.length > 0) {
                await connection.execute(`
                    UPDATE personalized_campaign_items 
                    SET name = ?, phone = ?, data1 = ?, data2 = ?, data3 = ?, 
                        scheduled_date = ?, scheduled_time = ?, status = ?
                    WHERE id = ?
                `, [name, phone, data1, data2, data3, scheduled_date, scheduled_time, status, id]);
                
                console.log(`[PERSONALIZED-CAMPAIGN] ✅ Item actualizado: ${id}`);
                res.json({ success: true, message: 'Item actualizado exitosamente' });
            } else {
                // Fallback: actualizar en campo contacts de campaigns
                res.json({ success: true, message: 'Actualización simulada (tabla no existe)' });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[PERSONALIZED-CAMPAIGN] Error updating item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE - Eliminar item individual de campaña personalizada
app.delete('/api/personalized-campaigns/items/:id', authenticateToken, async (req, res) => {
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const { id } = req.params;
        
        const connection = await pool.getConnection();
        try {
            // Verificar si existe tabla personalized_campaign_items
            const [tables] = await connection.execute(
                "SHOW TABLES LIKE 'personalized_campaign_items'"
            );
            
            if (tables.length > 0) {
                await connection.execute('DELETE FROM personalized_campaign_items WHERE id = ?', [id]);
                
                console.log(`[PERSONALIZED-CAMPAIGN] 🗑️ Item eliminado: ${id}`);
                res.json({ success: true, message: 'Item eliminado exitosamente' });
            } else {
                res.json({ success: true, message: 'Eliminación simulada (tabla no existe)' });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[PERSONALIZED-CAMPAIGN] Error deleting item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Enviar campaña
app.post('/api/campaigns/send/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { campaignId } = req.body;

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.isConnected) {
            return res.status(400).json({
                success: false,
                error: 'Sesión de WhatsApp no conectada'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Obtener campaña y destinatarios
            const [campaigns] = await connection.execute(
                'SELECT * FROM campaigns WHERE id = ? AND session_id = ?',
                [campaignId, phoneNumber]
            );

            if (campaigns.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaña no encontrada'
                });
            }

            const campaign = campaigns[0];

            // Actualizar estado de campaña
            await connection.execute(
                'UPDATE campaigns SET status = \'active\', updated_at = NOW() WHERE id = ?',
                [campaignId]
            );

            // Obtener destinatarios pendientes
            const [recipients] = await connection.execute(
                'SELECT * FROM campaign_recipients WHERE campaign_id = ? AND status = \'pending\'',
                [campaignId]
            );

            res.json({
                success: true,
                message: 'Campaña iniciada',
                data: {
                    totalRecipients: recipients.length
                }
            });

            // Enviar mensajes en background
            (async () => {
                // Si usa envíos aleatorios, calcular los tiempos de envío de todos los mensajes
                let sendTimes = [];
                if (campaign.use_random_timing && campaign.random_timing_msg_count > 0) {
                    const totalTimeMs = campaign.random_timing_time_span_minutes * 60 * 1000;
                    const msgCount = Math.min(recipients.length, campaign.random_timing_msg_count);

                    console.log(`[CAMPAIGN-${campaignId}] 🎲 Configurando envíos aleatorios:`);
                    console.log(`[CAMPAIGN-${campaignId}]    - Total de mensajes: ${msgCount}`);
                    console.log(`[CAMPAIGN-${campaignId}]    - Distribuir en: ${campaign.random_timing_time_span_minutes} minutos`);
                    console.log(`[CAMPAIGN-${campaignId}]    - Tiempo total: ${totalTimeMs}ms`);

                    // Generar tiempos aleatorios para cada mensaje
                    for (let i = 0; i < msgCount; i++) {
                        // Generar un tiempo aleatorio entre 0 y totalTimeMs
                        sendTimes.push(Math.random() * totalTimeMs);
                    }

                    // Ordenar los tiempos de menor a mayor
                    sendTimes.sort((a, b) => a - b);

                    console.log(`[CAMPAIGN-${campaignId}] 🕐 Tiempos de envío programados:`);
                    sendTimes.forEach((time, index) => {
                        const seconds = Math.round(time / 1000);
                        const minutes = Math.floor(seconds / 60);
                        const remainingSeconds = seconds % 60;
                        console.log(`[CAMPAIGN-${campaignId}]    - Mensaje ${index + 1}: ${minutes}m ${remainingSeconds}s`);
                    });
                }

                const startTime = Date.now();

                for (let i = 0; i < recipients.length; i++) {
                    const recipient = recipients[i];

                    try {
                        // Si usa timing aleatorio y tenemos tiempo programado, esperar hasta ese momento
                        if (campaign.use_random_timing && sendTimes[i] !== undefined) {
                            const elapsedTime = Date.now() - startTime;
                            const targetTime = sendTimes[i];
                            const waitTime = targetTime - elapsedTime;

                            if (waitTime > 0) {
                                console.log(`[CAMPAIGN-${campaignId}] ⏳ Esperando ${Math.round(waitTime / 1000)}s para mensaje ${i + 1}...`);
                                await new Promise(resolve => setTimeout(resolve, waitTime));
                            }
                        } else if (!campaign.use_random_timing && i > 0) {
                            // Delay fijo de 2 segundos entre mensajes si no usa timing aleatorio
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }

                        // Personalizar mensaje si tiene variables
                        let messageText = campaign.message_template;

                        // Preparar payload del mensaje
                        let messagePayload;

                        if (campaign.message_media_url && campaign.message_media_type) {
                            // Mensaje con multimedia
                            console.log(`[CAMPAIGN-${campaignId}] Enviando multimedia tipo: ${campaign.message_media_type}`);

                            // Convertir URL relativa a ruta absoluta del sistema
                            let mediaPath = campaign.message_media_url;
                            if (mediaPath.startsWith('/uploads/')) {
                                mediaPath = path.join(__dirname, '../../uploads', path.basename(mediaPath));
                            } else if (mediaPath.startsWith('uploads/')) {
                                mediaPath = path.join(__dirname, '../../uploads', path.basename(mediaPath));
                            }

                            console.log(`[CAMPAIGN-${campaignId}] Ruta del archivo: ${mediaPath}`);

                            if (campaign.message_media_type.startsWith('image')) {
                                messagePayload = {
                                    image: { url: mediaPath },
                                    caption: messageText || ''
                                };
                            } else if (campaign.message_media_type.startsWith('video')) {
                                messagePayload = {
                                    video: { url: mediaPath },
                                    caption: messageText || ''
                                };
                            } else if (campaign.message_media_type.startsWith('audio')) {
                                messagePayload = {
                                    audio: { url: mediaPath },
                                    mimetype: campaign.message_media_type
                                };
                            } else {
                                // Documento
                                messagePayload = {
                                    document: { url: mediaPath },
                                    mimetype: campaign.message_media_type,
                                    fileName: campaign.message_media_url.split('/').pop()
                                };
                            }
                        } else {
                            // Solo texto
                            messagePayload = {
                                text: messageText
                            };
                        }

                        // Enviar mensaje
                        const sentMsg = await session.sock.sendMessage(recipient.contact_jid, messagePayload);

                        // Actualizar estado en DB
                        await connection.execute(
                            'UPDATE campaign_recipients SET status = \'sent\', message_id = ?, sent_at = NOW() WHERE id = ?',
                            [sentMsg.key.id, recipient.id]
                        );

                        const elapsedMinutes = Math.round((Date.now() - startTime) / 1000 / 60 * 10) / 10;
                        console.log(`[CAMPAIGN-${campaignId}] ✅ Mensaje ${i + 1}/${recipients.length} enviado a ${recipient.contact_jid} (${elapsedMinutes}min desde inicio)`);

                    } catch (error) {
                        console.error(`[CAMPAIGN-${campaignId}] ❌ Error enviando a ${recipient.contact_jid}:`, error);

                        // Actualizar estado de error
                        await connection.execute(
                            'UPDATE campaign_recipients SET status = \'failed\', error_message = ? WHERE id = ?',
                            [error.message, recipient.id]
                        );
                    }
                }

                // Actualizar estado final de campaña
                await connection.execute(
                    'UPDATE campaigns SET status = \'completed\', updated_at = NOW() WHERE id = ?',
                    [campaignId]
                );

                console.log(`[CAMPAIGN-${campaignId}] Campaña completada`);
            })();

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CAMPAIGNS] Error enviando campaña:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Iniciar campaña (nuevo endpoint para compatibilidad con frontend)
app.post('/api/campaigns/:id/start', async (req, res) => {
    const { id } = req.params;

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Obtener campaña
            const [campaigns] = await connection.execute(
                'SELECT * FROM campaigns WHERE id = ?',
                [id]
            );

            if (campaigns.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaña no encontrada'
                });
            }

            const campaign = campaigns[0];
            const sessionId = campaign.session_id;

            // Verificar que la sesión existe y está conectada
            const session = sessions.get(sessionId);
            if (!session || !session.isConnected) {
                return res.status(400).json({
                    success: false,
                    error: 'Sesión de WhatsApp no conectada'
                });
            }

            // Actualizar estado de campaña
            await connection.execute(
                'UPDATE campaigns SET status = \'active\', updated_at = NOW() WHERE id = ?',
                [id]
            );

            // Obtener destinatarios pendientes
            const [recipients] = await connection.execute(
                'SELECT * FROM campaign_recipients WHERE campaign_id = ? AND status = \'pending\'',
                [id]
            );

            if (recipients.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No hay destinatarios pendientes para esta campaña'
                });
            }

            res.json({
                success: true,
                message: 'Campaña iniciada',
                data: {
                    totalRecipients: recipients.length
                }
            });

            console.log(`[CAMPAIGN-${id}] 🚀 Iniciando campaña "${campaign.name}" con ${recipients.length} destinatarios`);

            // Enviar mensajes en background
            (async () => {
                let sendTimes = [];
                if (campaign.use_random_timing && campaign.random_timing_msg_count > 0) {
                    const totalTimeMs = campaign.random_timing_time_span_minutes * 60 * 1000;
                    const msgCount = Math.min(recipients.length, campaign.random_timing_msg_count);

                    console.log(`[CAMPAIGN-${id}] 🎲 Configurando envíos aleatorios:`);
                    console.log(`[CAMPAIGN-${id}]    - Total de mensajes: ${msgCount}`);
                    console.log(`[CAMPAIGN-${id}]    - Distribuir en: ${campaign.random_timing_time_span_minutes} minutos`);

                    for (let i = 0; i < msgCount; i++) {
                        sendTimes.push(Math.random() * totalTimeMs);
                    }
                    sendTimes.sort((a, b) => a - b);
                }

                const startTime = Date.now();

                for (let i = 0; i < recipients.length; i++) {
                    const recipient = recipients[i];

                    try {
                        if (campaign.use_random_timing && sendTimes[i] !== undefined) {
                            const elapsedTime = Date.now() - startTime;
                            const targetTime = sendTimes[i];
                            const waitTime = targetTime - elapsedTime;

                            if (waitTime > 0) {
                                console.log(`[CAMPAIGN-${id}] ⏳ Esperando ${Math.round(waitTime / 1000)}s para mensaje ${i + 1}...`);
                                await new Promise(resolve => setTimeout(resolve, waitTime));
                            }
                        } else if (!campaign.use_random_timing && i > 0) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }

                        let messageText = campaign.message_template;
                        let messagePayload;

                        if (campaign.message_media_url && campaign.message_media_type) {
                            let mediaPath = campaign.message_media_url;
                            if (mediaPath.startsWith('/uploads/')) {
                                mediaPath = path.join(__dirname, '../../uploads', path.basename(mediaPath));
                            } else if (mediaPath.startsWith('uploads/')) {
                                mediaPath = path.join(__dirname, '../../uploads', path.basename(mediaPath));
                            }

                            if (campaign.message_media_type.startsWith('image')) {
                                messagePayload = {
                                    image: { url: mediaPath },
                                    caption: messageText || ''
                                };
                            } else if (campaign.message_media_type.startsWith('video')) {
                                messagePayload = {
                                    video: { url: mediaPath },
                                    caption: messageText || ''
                                };
                            } else if (campaign.message_media_type.startsWith('audio')) {
                                messagePayload = {
                                    audio: { url: mediaPath },
                                    mimetype: campaign.message_media_type
                                };
                            } else {
                                messagePayload = {
                                    document: { url: mediaPath },
                                    mimetype: campaign.message_media_type,
                                    fileName: campaign.message_media_url.split('/').pop()
                                };
                            }
                        } else {
                            messagePayload = {
                                text: messageText
                            };
                        }

                        const sentMsg = await session.sock.sendMessage(recipient.contact_jid, messagePayload);

                        await connection.execute(
                            'UPDATE campaign_recipients SET status = \'sent\', message_id = ?, sent_at = NOW() WHERE id = ?',
                            [sentMsg.key.id, recipient.id]
                        );

                        const elapsedMinutes = Math.round((Date.now() - startTime) / 1000 / 60 * 10) / 10;
                        console.log(`[CAMPAIGN-${id}] ✅ Mensaje ${i + 1}/${recipients.length} enviado a ${recipient.contact_jid} (${elapsedMinutes}min)`);

                    } catch (error) {
                        console.error(`[CAMPAIGN-${id}] ❌ Error enviando a ${recipient.contact_jid}:`, error);
                        await connection.execute(
                            'UPDATE campaign_recipients SET status = \'failed\', error_message = ? WHERE id = ?',
                            [error.message, recipient.id]
                        );
                    }
                }

                await connection.execute(
                    'UPDATE campaigns SET status = \'completed\', updated_at = NOW() WHERE id = ?',
                    [id]
                );

                console.log(`[CAMPAIGN-${id}] ✅ Campaña completada`);
            })();

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CAMPAIGNS] Error iniciando campaña:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Pausar campaña
app.post('/api/campaigns/pause/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { campaignId } = req.body;

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            await connection.execute(
                'UPDATE campaigns SET status = \'paused\', updated_at = NOW() WHERE id = ? AND session_id = ?',
                [campaignId, phoneNumber]
            );

            res.json({
                success: true,
                message: 'Campaña pausada exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CAMPAIGNS] Error pausando campaña:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Editar campaña
app.put('/api/campaigns/:sessionId/:campaignId', async (req, res) => {
    const { sessionId, campaignId } = req.params;
    const { name, message_template, scheduled_at } = req.body;

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            const updates = [];
            const values = [];

            if (name !== undefined) {
                updates.push('name = ?');
                values.push(name);
            }
            if (message_template !== undefined) {
                updates.push('message_template = ?');
                values.push(message_template);
            }
            if (scheduled_at !== undefined) {
                updates.push('scheduled_at = ?');
                values.push(scheduled_at);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No se proporcionaron campos para actualizar'
                });
            }

            updates.push('updated_at = NOW()');
            values.push(campaignId, phoneNumber);

            await connection.execute(
                `UPDATE campaigns SET ${updates.join(', ')} WHERE id = ? AND session_id = ?`,
                values
            );

            res.json({
                success: true,
                message: 'Campaña actualizada exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CAMPAIGNS] Error editando campaña:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Eliminar campaña
app.delete('/api/campaigns/:sessionId/:campaignId', async (req, res) => {
    const { sessionId, campaignId } = req.params;

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Los campaign_recipients se eliminarán automáticamente por ON DELETE CASCADE
            await connection.execute(
                'DELETE FROM campaigns WHERE id = ? AND session_id = ?',
                [campaignId, phoneNumber]
            );

            res.json({
                success: true,
                message: 'Campaña eliminada exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CAMPAIGNS] Error eliminando campaña:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener detalles de campaña específica
app.get('/api/campaigns/:sessionId/:campaignId', async (req, res) => {
    const { sessionId, campaignId } = req.params;

    if (!pool) {
        return res.json({ success: true, data: null });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            const [campaigns] = await connection.execute(
                'SELECT * FROM campaigns WHERE id = ? AND session_id = ?',
                [campaignId, phoneNumber]
            );

            if (campaigns.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaña no encontrada'
                });
            }

            const [recipients] = await connection.execute(
                `SELECT cr.*, c.name as contact_name
                 FROM campaign_recipients cr
                 LEFT JOIN contacts c ON cr.contact_jid = c.jid
                 WHERE cr.campaign_id = ?`,
                [campaignId]
            );

            res.json({
                success: true,
                data: {
                    campaign: campaigns[0],
                    recipients
                }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CAMPAIGNS] Error obteniendo detalles de campaña:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= FIN ENDPOINTS DE CAMPAÑAS =============

// ============= ENDPOINTS DE CALENDARIO Y CITAS =============

// GET - Obtener citas de una sesión
app.get('/api/appointments/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    if (!pool) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not available' 
        });
    }
    
    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        const connection = await pool.getConnection();
        try {
            const [appointments] = await connection.execute(
                'SELECT *, DATE_FORMAT(appointment_date, "%Y-%m-%d") as appointment_date_formatted FROM appointments WHERE session_id = ? ORDER BY appointment_date, appointment_time',
                [phoneNumber]
            );
            
            // Formatear fechas para evitar conversiones de zona horaria
            const formattedAppointments = appointments.map(apt => ({
                ...apt,
                appointment_date: apt.appointment_date_formatted || apt.appointment_date
            }));
            
            res.json({
                success: true,
                appointments: formattedAppointments
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[APPOINTMENTS] Error loading:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST - Crear nueva cita (acepta tanto snake_case como camelCase)
app.post('/api/appointments', async (req, res) => {
    // Soportar ambos formatos de nombres
    const sessionId = req.body.session_id || req.body.sessionId;
    const patientName = req.body.patient_name || req.body.patientName;
    const patientPhone = req.body.patient_phone || req.body.patientPhone;
    const doctorName = req.body.doctor_name || req.body.doctorName;
    const companyName = req.body.company_name || req.body.companyName;
    const description = req.body.description;
    const appointmentDate = req.body.appointment_date || req.body.appointmentDate;
    const appointmentTime = req.body.appointment_time || req.body.appointmentTime;
    const status = req.body.status || 'scheduled';
    const notes = req.body.notes;
    const reminderTime = req.body.reminder_time || req.body.reminderTime || 60;
    const notificationTemplate = req.body.notification_template || req.body.notificationTemplate || 'default';
    const categoryId = req.body.category_id || req.body.categoryId || null;
    
    if (!sessionId || !patientName || !patientPhone || !appointmentDate || !appointmentTime) {
        return res.status(400).json({
            success: false,
            error: 'Campos requeridos: sessionId, patientName, patientPhone, appointmentDate, appointmentTime'
        });
    }
    
    if (!pool) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not available' 
        });
    }
    
    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        // Convertir fecha ISO a formato DATE (YYYY-MM-DD)
        let dateOnly = appointmentDate;
        if (appointmentDate && appointmentDate.includes('T')) {
            dateOnly = appointmentDate.split('T')[0];
        }
        
        // Normalizar tiempo a formato HH:mm (sin segundos)
        let timeOnly = appointmentTime;
        if (appointmentTime && appointmentTime.length > 5) {
            timeOnly = appointmentTime.substring(0, 5);
        }
        
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                `INSERT INTO appointments 
                (session_id, patient_name, patient_phone, doctor_name, company_name, 
                 description, appointment_date, appointment_time, status, notes, 
                 reminder_time, notification_template, category_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    phoneNumber,
                    patientName,
                    patientPhone,
                    doctorName || null,
                    companyName || null,
                    description || null,
                    dateOnly,
                    timeOnly,
                    status,
                    notes || null,
                    reminderTime,
                    notificationTemplate,
                    categoryId
                ]
            );
            
            console.log(`[APPOINTMENTS] ✅ Cita creada: ${patientName} - ${dateOnly} ${timeOnly}`);
            
            res.json({
                success: true,
                id: result.insertId,
                appointmentId: result.insertId,
                message: 'Appointment created successfully'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[APPOINTMENTS] Error creating:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT - Actualizar cita
app.put('/api/appointments/:id', async (req, res) => {
    const { id } = req.params;
    const {
        patient_name,
        patient_phone,
        doctor_name,
        company_name,
        description,
        appointment_date,
        appointment_time,
        status,
        notes,
        reminder_time,
        notification_template,
        category_id
    } = req.body;
    
    if (!pool) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not available' 
        });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            // Convertir fecha ISO a formato DATE (YYYY-MM-DD)
            let dateOnly = appointment_date;
            if (appointment_date && appointment_date.includes('T')) {
                dateOnly = appointment_date.split('T')[0];
            }
            
            // Normalizar tiempo a formato HH:mm (sin segundos)
            let timeOnly = appointment_time;
            if (appointment_time && appointment_time.length > 5) {
                timeOnly = appointment_time.substring(0, 5);
            }
            
            await connection.execute(
                `UPDATE appointments SET
                patient_name = ?,
                patient_phone = ?,
                doctor_name = ?,
                company_name = ?,
                description = ?,
                appointment_date = ?,
                appointment_time = ?,
                status = ?,
                notes = ?,
                reminder_time = ?,
                notification_template = ?,
                category_id = ?
                WHERE id = ?`,
                [
                    patient_name,
                    patient_phone,
                    doctor_name || null,
                    company_name || null,
                    description || null,
                    dateOnly,
                    timeOnly,
                    status,
                    notes || null,
                    reminder_time || 60,
                    notification_template || 'default',
                    category_id || null,
                    id
                ]
            );
            
            console.log(`[APPOINTMENTS] ✅ Cita actualizada: ID ${id} - ${dateOnly} ${timeOnly}`);
            
            res.json({
                success: true,
                message: 'Appointment updated successfully'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[APPOINTMENTS] Error updating:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE - Eliminar cita
app.delete('/api/appointments/:id', async (req, res) => {
    const { id } = req.params;
    
    if (!pool) {
        return res.status(503).json({ 
            success: false, 
            error: 'Database not available' 
        });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            await connection.execute(
                'DELETE FROM appointments WHERE id = ?',
                [id]
            );
            
            console.log(`[APPOINTMENTS] 🗑️ Cita eliminada: ID ${id}`);
            
            res.json({
                success: true,
                message: 'Appointment deleted successfully'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[APPOINTMENTS] Error deleting:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= FIN ENDPOINTS DE CALENDARIO =============

// ============= ENDPOINTS DE AUTENTICACIÓN =============

// POST - Login de usuarios/agentes
app.post('/api/auth/login', async (req, res) => {
    const { email, password, deviceId } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    if (!deviceId) {
        return res.status(400).json({ success: false, error: 'Device ID requerido para sesión única' });
    }
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const bcrypt = require('bcrypt');
        const connection = await pool.getConnection();
        
        try {
            // Buscar usuario por email
            const [users] = await connection.execute(
                'SELECT id, name, email, password, role, department, category, status, phone, avatar_url FROM users WHERE email = ?',
                [email]
            );
            
            if (users.length === 0) {
                return res.status(401).json({ success: false, error: 'Invalid email or password' });
            }
            
            const user = users[0];
            
            // Verificar si está activo
            if (user.status !== 'active') {
                return res.status(403).json({ success: false, error: 'Account is inactive or suspended' });
            }
            
            // Verificar contraseña
            const passwordMatch = await bcrypt.compare(password, user.password);
            
            if (!passwordMatch) {
                return res.status(401).json({ success: false, error: 'Invalid email or password' });
            }
            
            // Actualizar último login
            await connection.execute(
                'UPDATE users SET last_login = NOW() WHERE id = ?',
                [user.id]
            );
            
            // No enviar password en la respuesta
            delete user.password;
            
            // Crear sesión única por dispositivo usando el nuevo sistema
            const sessionToken = createUniqueSession(user.id, deviceId, email, user.role);
            const token = Buffer.from(`${user.id}:${user.email}:${Date.now()}:${sessionToken}`).toString('base64');
            
            // Para TODOS los usuarios (admin, agente, supervisor), obtener el sessionId activo del sistema
            let sessionId = null;

            // IMPORTANTE: Cada usuario tiene su propio session_id vinculado en la tabla users
            // Primero buscar si este usuario tiene un session_id asignado
            const [userSessionData] = await connection.execute(
                'SELECT session_id FROM users WHERE id = ? AND session_id IS NOT NULL',
                [user.id]
            );

            if (userSessionData.length > 0 && userSessionData[0].session_id) {
                sessionId = userSessionData[0].session_id;
                console.log(`[AUTH] ✅ Usuario ${email} (${user.role}) usando su sesión asignada: ${sessionId}`);
                
                // Verificar que la sesión esté activa en user_sessions
                const [sessionCheck] = await connection.execute(
                    'SELECT session_id, phone_number, is_active FROM user_sessions WHERE session_id = ?',
                    [sessionId]
                );
                
                if (sessionCheck.length > 0) {
                    if (!sessionCheck[0].is_active) {
                        console.log(`[AUTH] ⚠️ La sesión ${sessionId} existe pero no está activa`);
                    } else {
                        console.log(`[AUTH] ✅ Sesión ${sessionId} está activa con número: ${sessionCheck[0].phone_number || 'sin vincular'}`);
                    }
                } else {
                    console.log(`[AUTH] ⚠️ Sesión ${sessionId} no encontrada en user_sessions - usuario debe escanear QR`);
                }
            } else {
                console.log(`[AUTH] ⚠️ Usuario ${email} no tiene session_id asignado en su cuenta - debe configurar WhatsApp`);
                
                // Si es SUPER ADMIN, puede usar cualquier sesión disponible para administrar
                if (user.role === 'super_admin' || user.role === 'superadmin') {
                    const [anySessions] = await connection.execute(
                        `SELECT session_id, phone_number FROM user_sessions
                         WHERE is_active = true
                         ORDER BY last_activity DESC
                         LIMIT 1`
                    );
                    
                    if (anySessions.length > 0) {
                        sessionId = anySessions[0].session_id;
                        console.log(`[AUTH] ✅ Super Admin ${email} puede ver sesión activa: ${sessionId} (administración)`);
                    }
                }
            }
            
            console.log(`[AUTH] ✅ Login exitoso: ${email} (${user.role}) - Dispositivo: ${deviceId.substr(0, 20)}...`);
            
            // Obtener permisos del usuario
            const [permissions] = await connection.execute(`
                SELECT 
                    p.id as permission_id,
                    p.name as permission_name,
                    p.module,
                    COALESCE(up.can_view, 0) as can_view,
                    COALESCE(up.can_create, 0) as can_create,
                    COALESCE(up.can_edit, 0) as can_edit,
                    COALESCE(up.can_delete, 0) as can_delete
                FROM permissions p
                LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.user_id = ?
                WHERE (up.can_view = 1 OR up.can_create = 1 OR up.can_edit = 1 OR up.can_delete = 1)
                ORDER BY p.module, p.name
            `, [user.id]);

            // Agrupar permisos por módulo
            const permissionsByModule = {};
            permissions.forEach(perm => {
                if (!permissionsByModule[perm.module]) {
                    permissionsByModule[perm.module] = {
                        view: false,
                        create: false,
                        edit: false,
                        delete: false
                    };
                }
                if (perm.can_view) permissionsByModule[perm.module].view = true;
                if (perm.can_create) permissionsByModule[perm.module].create = true;
                if (perm.can_edit) permissionsByModule[perm.module].edit = true;
                if (perm.can_delete) permissionsByModule[perm.module].delete = true;
            });
            
            // Log detallado para debugging
            sessionLogger.log(sessionId || 'NO_SESSION', 'LOGIN_SUCCESS', {
                userId: user.id,
                email: user.email,
                role: user.role,
                deviceId: deviceId.substr(0, 30),
                sessionId: sessionId,
                permissionsCount: permissions.length,
                timestamp: new Date().toISOString()
            });
            
            res.json({ 
                success: true, 
                user,
                token,
                sessionToken, // Token único de sesión
                sessionId, // Agregar sessionId a la respuesta
                permissions: permissions, // Lista completa de permisos
                permissionsByModule: permissionsByModule, // Permisos agrupados por módulo
                message: 'Login successful'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AUTH] Error en login:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET - Obtener sesión activa del sistema (para agentes/supervisores)
// ENDPOINT ELIMINADO POR SEGURIDAD
// Este endpoint permitía que cualquier usuario accediera a sesiones activas sin autenticación
// Para verificar una sesión específica, use: GET /api/session/:sessionId/status

// POST - Logout
app.post('/api/auth/logout', async (req, res) => {
    const sessionToken = req.headers['x-session-token'] || req.body.sessionToken;
    
    if (sessionToken) {
        destroySession(sessionToken);
        console.log('[AUTH] 👋 Sesión cerrada correctamente');
    }
    
    res.json({ success: true, message: 'Logout successful' });
});

// GET - Verificar sesión (si se usa JWT o cookies)
app.get('/api/auth/me', async (req, res) => {
    // Por ahora retornamos error, en producción verificarías JWT/session
    res.status(401).json({ success: false, error: 'Not authenticated' });
});

// ============= FIN ENDPOINTS DE AUTENTICACIÓN =============

// ============= MIDDLEWARE DE SESIÓN ESPECÍFICA PARA QR =============

// Nota: sessionTokenMap ya está declarado anteriormente en el archivo

// Middleware para validar que la sesión QR sea específica por dispositivo
const validateQRSession = (req, res, next) => {
    const sessionToken = req.headers['x-session-token'] || req.query.sessionToken;
    const deviceId = req.headers['x-device-id'] || req.query.deviceId;
    const sessionId = req.params.sessionId || req.query.sessionId || req.body.sessionId;

    if (!sessionToken || !deviceId) {
        return res.status(401).json({
            success: false,
            error: 'Session token y device ID requeridos',
            requiresReauth: true
        });
    }

    const storedTokenData = sessionTokenMap.get(sessionId);
    
    if (!storedTokenData) {
        return res.status(401).json({
            success: false,
            error: 'Sesión no encontrada',
            requiresReauth: true
        });
    }

    // Verificar que el sessionToken coincida
    if (storedTokenData.sessionToken !== sessionToken) {
        return res.status(403).json({
            success: false,
            error: 'Token de sesión inválido',
            requiresReauth: true
        });
    }

    // Verificar que el deviceId coincida
    if (storedTokenData.deviceId !== deviceId) {
        console.log(`[QR-SESSION] 🚫 Intento de acceso desde otro dispositivo bloqueado`);
        console.log(`  - Session: ${sessionId}`);
        console.log(`  - Device esperado: ${storedTokenData.deviceId.substr(0, 20)}...`);
        console.log(`  - Device recibido: ${deviceId.substr(0, 20)}...`);

        return res.status(403).json({
            success: false,
            error: 'Esta sesión está activa en otro dispositivo',
            requiresReauth: true
        });
    }

    // Actualizar o eliminar tokens antiguos (más de 24 horas)
    if (Date.now() - storedTokenData.timestamp > 24 * 60 * 60 * 1000) {
        sessionTokenMap.delete(sessionId);
        return res.status(401).json({
            success: false,
            error: 'Sesión expirada',
            requiresReauth: true
        });
    }

    // Adjuntar info de sesión al request
    req.sessionId = sessionId;
    req.sessionToken = sessionToken;

    next();
};

// ============= ENDPOINTS DE GESTIÓN DE USUARIOS =============

// GET - Listar usuarios/agentes
app.get('/api/users', authenticateToken, async (req, res) => {
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const { role, department, status } = req.query;
        let adminPhone = req.user?.phone || req.user?.id;
        
        // Si adminPhone parece un sessionId temporal, buscar el número real
        if (adminPhone && !/^\d+$/.test(adminPhone)) {
            console.log(`[USERS] ${adminPhone} parece sessionId temporal, buscando número real...`);
            const realPhone = await getUserPhoneNumber(adminPhone);
            if (realPhone) {
                adminPhone = realPhone;
                console.log(`[USERS] ✅ Número real encontrado: ${adminPhone}`);
            }
        }
        
        console.log(`[USERS] Admin ${adminPhone} solicitando lista de usuarios`);
        
        // Verificar si el usuario que hace la petición es admin
        const connection = await pool.getConnection();
        try {
            const [adminCheck] = await connection.execute(
                'SELECT is_admin, is_super_admin FROM users WHERE phone = ? LIMIT 1',
                [adminPhone]
            );
            
            if (adminCheck.length === 0 || adminCheck[0].is_admin !== 1) {
                console.log(`[USERS] ❌ Acceso denegado: ${adminPhone} no es admin`);
                return res.status(403).json({ 
                    success: false, 
                    error: 'No tiene permisos para ver usuarios' 
                });
            }
            
            const isAdmin = adminCheck[0].is_admin === 1;
            
            // Cada admin solo ve sus propios agentes (is_admin = 0, admin_phone = su teléfono)
            let query = `SELECT id, name, email, role, department, category, status, phone, avatar_url, last_login, created_at, admin_phone
                         FROM users 
                         WHERE is_admin = 0 AND admin_phone = ?`;
            const params = [adminPhone];
            
            if (role) {
                query += ' AND role = ?';
                params.push(role);
            }
            if (department) {
                query += ' AND department = ?';
                params.push(department);
            }
            if (status) {
                query += ' AND status = ?';
                params.push(status);
            }
            
            query += ' ORDER BY name ASC';
            
            const [users] = await connection.execute(query, params);
            console.log(`[USERS] ✅ Devolviendo ${users.length} agentes para admin ${adminPhone}`);
            res.json({ success: true, users });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[USERS] Error loading:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET - Lista de clientes admin (usuarios que se conectan con QR) - SOLO SUPER ADMIN
app.get('/api/admin-clients', authenticateToken, async (req, res) => {
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        let userPhone = req.user?.phone || req.user?.id;
        
        // Si parece sessionId temporal, buscar número real
        if (userPhone && !/^\d+$/.test(userPhone)) {
            const realPhone = await getUserPhoneNumber(userPhone);
            if (realPhone) userPhone = realPhone;
        }
        
        console.log(`[ADMIN-CLIENTS] Usuario ${userPhone} solicitando lista de clientes`);
        
        const connection = await pool.getConnection();
        try {
            // Verificar que es super admin
            const [superAdminCheck] = await connection.execute(
                'SELECT is_super_admin, is_admin FROM users WHERE phone = ? LIMIT 1',
                [userPhone]
            );
            
            if (!superAdminCheck.length || superAdminCheck[0].is_super_admin !== 1) {
                console.log(`[ADMIN-CLIENTS] ❌ Acceso denegado: ${userPhone} no es super admin`);
                return res.status(403).json({ 
                    success: false, 
                    error: 'Solo el Super Administrador puede acceder a esta función' 
                });
            }
            
            // Devolver SOLO usuarios admin (los que se conectan con QR), excepto el super admin
            const [clients] = await connection.execute(`
                SELECT id, name, email, phone, status, is_admin, is_super_admin,
                       created_at, last_login
                FROM users 
                WHERE is_admin = 1 AND phone != ?
                ORDER BY created_at DESC
            `, [userPhone]);
            
            console.log(`[ADMIN-CLIENTS] ✅ Devolviendo ${clients.length} clientes admin`);
            res.json({ success: true, clients });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[ADMIN-CLIENTS] Error loading:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT - Actualizar estado de cliente admin (activar/desactivar) - SOLO SUPER ADMIN
app.put('/api/admin-clients/:phone/status', authenticateToken, async (req, res) => {
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        let userPhone = req.user?.phone || req.user?.id;
        const { phone } = req.params;
        const { status } = req.body; // 'active' or 'inactive'
        
        // Si parece sessionId temporal, buscar número real
        if (userPhone && !/^\d+$/.test(userPhone)) {
            const realPhone = await getUserPhoneNumber(userPhone);
            if (realPhone) userPhone = realPhone;
        }
        
        console.log(`[ADMIN-CLIENTS] Usuario ${userPhone} cambiando estado de ${phone} a ${status}`);
        
        const connection = await pool.getConnection();
        try {
            // Verificar que es super admin
            const [superAdminCheck] = await connection.execute(
                'SELECT is_super_admin FROM users WHERE phone = ? LIMIT 1',
                [userPhone]
            );
            
            if (!superAdminCheck.length || superAdminCheck[0].is_super_admin !== 1) {
                console.log(`[ADMIN-CLIENTS] ❌ Acceso denegado: ${userPhone} no es super admin`);
                return res.status(403).json({ 
                    success: false, 
                    error: 'Solo el Super Administrador puede cambiar estados' 
                });
            }
            
            // Actualizar estado del cliente
            await connection.execute(
                'UPDATE users SET status = ? WHERE phone = ? AND is_admin = 1',
                [status, phone]
            );
            
            console.log(`[ADMIN-CLIENTS] ✅ Estado actualizado: ${phone} -> ${status}`);
            res.json({ success: true, message: 'Estado actualizado exitosamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[ADMIN-CLIENTS] Error updating status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET - Obtener usuario por ID
app.get('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            const [users] = await connection.execute('SELECT * FROM users WHERE id = ?', [id]);
            if (users.length === 0) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            res.json({ success: true, user: users[0] });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[USERS] Error loading user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/users/stats', async (req, res) => {
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            const [stats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
                    SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
                    SUM(CASE WHEN role = 'agent' THEN 1 ELSE 0 END) as agents,
                    SUM(CASE WHEN role = 'supervisor' THEN 1 ELSE 0 END) as supervisors
                FROM users
            `);
            
            res.json({ success: true, stats: stats[0] });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[USERS] Error loading stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST - Crear usuario/agente
app.post('/api/users', authenticateToken, async (req, res) => {
    const { name, email, password, role, department, category, phone, sessionId } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    }
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        // Obtener el teléfono del admin que está creando el usuario
        let adminPhone = req.user?.phone || req.user?.id;
        
        // Si adminPhone parece un sessionId temporal, buscar el número real
        if (adminPhone && !/^\d+$/.test(adminPhone)) {
            console.log(`[USERS] ${adminPhone} parece sessionId temporal, buscando número real...`);
            const realPhone = await getUserPhoneNumber(adminPhone);
            if (realPhone) {
                adminPhone = realPhone;
                console.log(`[USERS] ✅ Número real encontrado: ${adminPhone}`);
            }
        }
        
        console.log(`[USERS] Admin ${adminPhone} creando nuevo usuario: ${email}`);
        
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const connection = await pool.getConnection();
        try {
            // Verificar que el creador sea admin
            const [adminCheck] = await connection.execute(
                'SELECT is_admin FROM users WHERE phone = ? LIMIT 1',
                [adminPhone]
            );
            
            if (adminCheck.length === 0 || adminCheck[0].is_admin !== 1) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'No tiene permisos para crear usuarios' 
                });
            }
            
            // Los usuarios creados desde aquí son AGENTES (is_admin = 0)
            // Se asigna el admin_phone del creador
            const finalRole = role || 'agent';
            
            // Crear usuario en tabla users
            const [result] = await connection.execute(
                `INSERT INTO users (name, email, password, role, department, category, phone, status, is_admin, admin_phone)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)`,
                [
                    name, 
                    email, 
                    hashedPassword, 
                    finalRole, 
                    department || null, 
                    category || null, 
                    phone || null,
                    adminPhone  // Asignar el teléfono del admin creador
                ]
            );
            
            const userId = result.insertId;
            console.log(`[USERS] ✅ Agente creado: ${email} (${finalRole}) por admin ${adminPhone}`);
            
            // Si es un agente, también crearlo en la tabla agents
            if (finalRole === 'agent' && sessionId) {
                try {
                    const { v4: uuidv4 } = require('uuid');
                    const agentId = uuidv4();
                    
                    await connection.execute(
                        `INSERT INTO agents (id, session_id, name, email, phone, password, status, admin_phone)
                         VALUES (?, ?, ?, ?, ?, ?, 'offline', ?)`,
                        [agentId, sessionId, name, email, phone || null, hashedPassword, adminPhone]
                    );
                    
                    console.log(`[AGENTS] ✅ Agente también creado en tabla agents: ${email}`);
                } catch (agentError) {
                    console.error('[AGENTS] Error creando en tabla agents:', agentError);
                    // No fallar la creación del usuario si falla el agente
                }
            }
            
            res.json({ success: true, id: userId, message: 'User created successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, error: 'Email already exists' });
        }
        console.error('[USERS] Error creating:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT - Actualizar usuario
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, password, role, department, category, phone, status } = req.body;
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            // Verificar si el número inicia con 595994854167 para asignar admin
            const isAdmin = phone && phone.startsWith('595994854167');
            const finalRole = isAdmin ? 'admin' : role;
            
            let query = 'UPDATE users SET name = ?, email = ?, role = ?, department = ?, category = ?, phone = ?, status = ?, is_admin = ?, admin_phone = ?';
            let params = [name, email, finalRole, department, category, phone, status, isAdmin, isAdmin ? phone : null];
            
            // Si es admin y no tiene plan, asignar Enterprise
            if (isAdmin) {
                query += ', subscription_plan = ?, subscription_status = ?, subscription_start_date = ?, subscription_end_date = ?, subscription_days = ?';
                params.push('enterprise', 'active', new Date(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 365);
            }
            
            if (password) {
                const bcrypt = require('bcrypt');
                const hashedPassword = await bcrypt.hash(password, 10);
                query += ', password = ?';
                params.push(hashedPassword);
            }
            
            query += ' WHERE id = ?';
            params.push(id);
            
            await connection.execute(query, params);
            
            console.log(`[USERS] ✅ Usuario actualizado: ID ${id}`);
            
            res.json({ success: true, message: 'User updated successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[USERS] Error updating:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE - Eliminar usuario
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            await connection.execute('DELETE FROM users WHERE id = ?', [id]);
            
            console.log(`[USERS] 🗑️ Usuario eliminado: ID ${id}`);
            
            res.json({ success: true, message: 'User deleted successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[USERS] Error deleting:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST - Generar token JWT para sesión de WhatsApp
app.post('/api/auth/generate-token', async (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ success: false, error: 'SessionId es requerido' });
    }
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            // Buscar el usuario por phone (el sessionId es el phone)
            const [users] = await connection.execute(
                'SELECT id, phone, name, email, role, is_admin FROM users WHERE phone = ? LIMIT 1',
                [sessionId]
            );
            
            if (users.length === 0) {
                // Si no existe, crear el usuario admin
                console.log(`[AUTH] Creando nuevo usuario admin para phone: ${sessionId}`);
                
                const [result] = await connection.execute(
                    `INSERT INTO users (phone, name, is_admin, admin_phone, status, created_at) 
                     VALUES (?, ?, 1, NULL, 'active', NOW())`,
                    [sessionId, `Usuario ${sessionId}`]
                );
                
                const newUserId = result.insertId;
                
                // Generar token para el nuevo usuario
                const token = jwt.sign(
                    {
                        id: newUserId,
                        phone: sessionId,
                        name: `Usuario ${sessionId}`,
                        role: 'admin',
                        is_admin: 1
                    },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );
                
                console.log(`[AUTH] ✅ Nuevo usuario admin creado y token generado para: ${sessionId}`);
                
                return res.json({
                    success: true,
                    token,
                    user: {
                        id: newUserId,
                        phone: sessionId,
                        name: `Usuario ${sessionId}`,
                        role: 'admin',
                        is_admin: 1
                    }
                });
            }
            
            // Usuario ya existe, generar token
            const user = users[0];
            const token = jwt.sign(
                {
                    id: user.id,
                    phone: user.phone,
                    name: user.name,
                    email: user.email,
                    role: user.role || 'admin',
                    is_admin: user.is_admin
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            
            console.log(`[AUTH] ✅ Token generado para usuario existente: ${sessionId}`);
            
            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    phone: user.phone,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    is_admin: user.is_admin
                }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AUTH] Error generating token:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= PERMISOS DE USUARIOS =============

// GET - Obtener permisos de un usuario
app.get('/api/users/:userId/permissions', async (req, res) => {
    const { userId } = req.params;
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            const [permissions] = await connection.execute(`
                SELECT 
                    p.id as permission_id,
                    p.name as permission_name,
                    p.description,
                    p.module,
                    COALESCE(up.can_view, 0) as can_view,
                    COALESCE(up.can_create, 0) as can_create,
                    COALESCE(up.can_edit, 0) as can_edit,
                    COALESCE(up.can_delete, 0) as can_delete
                FROM permissions p
                LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.user_id = ?
                ORDER BY p.module, p.name
            `, [userId]);
            
            // Agrupar por módulo
            const permissionsByModule = {};
            permissions.forEach(perm => {
                if (!permissionsByModule[perm.module]) {
                    permissionsByModule[perm.module] = [];
                }
                permissionsByModule[perm.module].push(perm);
            });
            
            res.json({ 
                success: true, 
                permissions,
                permissionsByModule 
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[USER-PERMISSIONS] Error loading:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT - Actualizar permisos de un usuario
app.put('/api/users/:userId/permissions', async (req, res) => {
    const { userId } = req.params;
    const { permissions } = req.body;
    
    if (!permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ success: false, error: 'Permisos inválidos' });
    }
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Eliminar permisos existentes
            await connection.execute(
                'DELETE FROM user_permissions WHERE user_id = ?',
                [userId]
            );
            
            // Insertar nuevos permisos
            for (const perm of permissions) {
                if (perm.can_view || perm.can_create || perm.can_edit || perm.can_delete) {
                    await connection.execute(`
                        INSERT INTO user_permissions (
                            user_id, permission_id, can_view, can_create, can_edit, can_delete
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                        userId,
                        perm.permission_id,
                        perm.can_view ? 1 : 0,
                        perm.can_create ? 1 : 0,
                        perm.can_edit ? 1 : 0,
                        perm.can_delete ? 1 : 0
                    ]);
                }
            }
            
            await connection.commit();
            
            console.log(`[USER-PERMISSIONS] ✅ Permisos actualizados para usuario: ${userId}`);
            res.json({ 
                success: true, 
                message: 'Permisos actualizados exitosamente' 
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[USER-PERMISSIONS] Error updating:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT - Asignar session_id a un usuario (solo Super Admin)
app.put('/api/users/:userId/assign-session', async (req, res) => {
    const { userId } = req.params;
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ success: false, error: 'Session ID requerido' });
    }
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const connection = await pool.getConnection();
        
        try {
            // Verificar que el usuario existe
            const [users] = await connection.execute(
                'SELECT id, name, email, role FROM users WHERE id = ?',
                [userId]
            );
            
            if (users.length === 0) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }
            
            // Verificar que la sesión existe en user_sessions
            const [sessions] = await connection.execute(
                'SELECT session_id, phone_number, is_active FROM user_sessions WHERE session_id = ?',
                [sessionId]
            );
            
            if (sessions.length === 0) {
                return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
            }
            
            // Asignar session_id al usuario
            await connection.execute(
                'UPDATE users SET session_id = ? WHERE id = ?',
                [sessionId, userId]
            );
            
            console.log(`[USER-SESSION] ✅ Session ${sessionId} asignado a usuario: ${users[0].email}`);
            
            res.json({ 
                success: true, 
                message: 'Sesión asignada exitosamente',
                user: users[0],
                session: sessions[0]
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[USER-SESSION] Error assigning session:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET - Obtener sessionId y phoneNumber del usuario (para agentes)
app.get('/api/users/:userId/session', async (req, res) => {
    const { userId } = req.params;
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const connection = await pool.getConnection();
        
        try {
            // Obtener datos del usuario (role, admin_phone)
            const [users] = await connection.execute(
                'SELECT role, admin_phone, session_id FROM users WHERE id = ?',
                [userId]
            );
            
            if (users.length === 0) {
                return res.json({ success: false, message: 'Usuario no encontrado' });
            }
            
            const user = users[0];
            let sessionId = null;
            let phoneNumber = null;
            
            // Si es agente, obtener session_id del admin
            if (user.role === 'agent' && user.admin_phone) {
                // Buscar sesión activa del admin
                const [adminSessions] = await connection.execute(
                    'SELECT session_id, phone_number FROM user_sessions WHERE phone_number = ? AND is_active = 1 ORDER BY last_activity DESC LIMIT 1',
                    [user.admin_phone]
                );
                
                if (adminSessions.length > 0) {
                    sessionId = adminSessions[0].session_id;
                    phoneNumber = adminSessions[0].phone_number;
                    console.log(`[AGENT-SESSION] ✅ Agente ${userId} usando sesión del admin: ${sessionId} (${phoneNumber})`);
                } else {
                    return res.json({ 
                        success: false, 
                        message: 'Admin sin sesión activa de WhatsApp' 
                    });
                }
            } else {
                // Si es admin, usar su propia sesión
                sessionId = user.session_id;
                if (sessionId) {
                    const [sessions] = await connection.execute(
                        'SELECT phone_number FROM user_sessions WHERE session_id = ?',
                        [sessionId]
                    );
                    if (sessions.length > 0) {
                        phoneNumber = sessions[0].phone_number;
                    }
                }
            }
            
            if (!sessionId) {
                return res.json({ success: false, message: 'Sin sesión disponible' });
            }
            
            res.json({
                success: true,
                sessionId,
                phoneNumber
            });
            
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[USER-SESSION] Error obteniendo sesión:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET - Estadísticas de usuarios
// ============= ASIGNACIÓN Y TRANSFERENCIA DE CHATS =============

// GET - Obtener asignaciones de chat de una sesión
app.get('/api/chat-assignments/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Session not found' });
        }
        
        const connection = await pool.getConnection();
        try {
            const [assignments] = await connection.execute(`
                SELECT 
                    ca.*,
                    u.name as user_name,
                    u.email as user_email,
                    u.department,
                    ab.name as assigned_by_name
                FROM chat_assignments ca
                LEFT JOIN users u ON ca.user_id = u.id
                LEFT JOIN users ab ON ca.assigned_by = ab.id
                WHERE ca.session_id = ? AND ca.status = 'active'
                ORDER BY ca.assigned_at DESC
            `, [phoneNumber]);
            
            res.json({ success: true, assignments });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CHAT-ASSIGNMENTS] Error loading:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET - Obtener chats asignados a un agente específico
app.get('/api/agent/:userId/chats', async (req, res) => {
    const { userId } = req.params;
    const { sessionId } = req.query;
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            // Obtener phone_number si se proporciona sessionId
            let phoneNumber = sessionId;
            if (sessionId) {
                const [sessions] = await connection.execute(
                    'SELECT phone_number FROM user_sessions WHERE session_id = ? LIMIT 1',
                    [sessionId]
                );
                if (sessions.length > 0 && sessions[0].phone_number) {
                    phoneNumber = sessions[0].phone_number;
                }
            }
            
            // Obtener chats asignados activos para este agente
            // Incluye tanto contacts como contact_groups
            const [assignments] = await connection.execute(`
                SELECT 
                    ca.chat_jid,
                    ca.session_id,
                    ca.status,
                    ca.assigned_at,
                    ca.notes,
                    COALESCE(
                        CASE WHEN ca.chat_jid LIKE '%@g.us' THEN cg.name ELSE c.name END,
                        SUBSTRING_INDEX(ca.chat_jid, '@', 1)
                    ) as chat_name,
                    COALESCE(
                        CASE WHEN ca.chat_jid LIKE '%@g.us' THEN cg.avatar_url ELSE c.avatar_url END
                    ) as avatar_url,
                    (SELECT text_content FROM messages 
                     WHERE chat_jid = ca.chat_jid 
                     AND (phone_number = ? OR session_id = ?)
                     ORDER BY timestamp DESC LIMIT 1) as last_message,
                    (SELECT timestamp FROM messages 
                     WHERE chat_jid = ca.chat_jid 
                     AND (phone_number = ? OR session_id = ?)
                     ORDER BY timestamp DESC LIMIT 1) as last_message_timestamp,
                    (SELECT COUNT(*) FROM messages 
                     WHERE chat_jid = ca.chat_jid 
                     AND (phone_number = ? OR session_id = ?)
                     AND from_me = 0 
                     AND timestamp > ca.assigned_at) as unread_count
                FROM chat_assignments ca
                LEFT JOIN contacts c ON ca.chat_jid = c.jid
                LEFT JOIN contact_groups cg ON ca.chat_jid = cg.jid AND cg.session_id = ca.session_id
                WHERE ca.user_id = ? 
                AND ca.status = 'active'
                ${sessionId ? 'AND ca.session_id = ?' : ''}
                ORDER BY ca.assigned_at DESC
            `, sessionId ? 
                [phoneNumber, phoneNumber, phoneNumber, phoneNumber, phoneNumber, phoneNumber, userId, sessionId] : 
                [phoneNumber, phoneNumber, phoneNumber, phoneNumber, phoneNumber, phoneNumber, userId]);
            
            console.log(`[AGENT-CHATS] Agente ${userId} tiene ${assignments.length} chats asignados`);
            
            res.json({ success: true, chats: assignments });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENT-CHATS] Error loading:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET - Admin: Todos los chats con info de asignación
app.get('/api/admin/all-chats', async (req, res) => {
    const { sessionId } = req.query;
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            // Obtener todos los chats con info de asignación y último agente que respondió
            // Union de contacts y contact_groups
            const [chats] = await connection.execute(`
                SELECT 
                    c.jid,
                    c.name,
                    c.phone_number,
                    c.last_message,
                    c.last_message_timestamp,
                    c.unread_count,
                    c.avatar_url,
                    0 as is_group,
                    u.name as assigned_to,
                    u.id as assigned_to_id,
                    mm.sent_by_name as last_agent_response,
                    mm.sent_at as last_agent_response_time,
                    ca.status as assignment_status
                FROM contacts c
                LEFT JOIN chat_assignments ca 
                    ON c.jid = ca.chat_jid 
                    AND ca.status = 'active'
                LEFT JOIN users u ON ca.user_id = u.id
                LEFT JOIN (
                    SELECT chat_jid, sent_by_name, sent_at
                    FROM message_metadata mm1
                    WHERE sent_at = (
                        SELECT MAX(sent_at)
                        FROM message_metadata mm2
                        WHERE mm2.chat_jid = mm1.chat_jid
                    )
                ) mm ON c.jid = mm.chat_jid
                WHERE c.session_id = ?
                
                UNION ALL
                
                SELECT 
                    cg.jid,
                    cg.name,
                    cg.phone_number,
                    (SELECT text_content FROM messages WHERE chat_jid = cg.jid ORDER BY timestamp DESC LIMIT 1) as last_message,
                    (SELECT timestamp FROM messages WHERE chat_jid = cg.jid ORDER BY timestamp DESC LIMIT 1) as last_message_timestamp,
                    0 as unread_count,
                    cg.avatar_url,
                    1 as is_group,
                    u.name as assigned_to,
                    u.id as assigned_to_id,
                    mm.sent_by_name as last_agent_response,
                    mm.sent_at as last_agent_response_time,
                    ca.status as assignment_status
                FROM contact_groups cg
                LEFT JOIN chat_assignments ca 
                    ON cg.jid = ca.chat_jid 
                    AND ca.status = 'active'
                LEFT JOIN users u ON ca.user_id = u.id
                LEFT JOIN (
                    SELECT chat_jid, sent_by_name, sent_at
                    FROM message_metadata mm1
                    WHERE sent_at = (
                        SELECT MAX(sent_at)
                        FROM message_metadata mm2
                        WHERE mm2.chat_jid = mm1.chat_jid
                    )
                ) mm ON cg.jid = mm.chat_jid
                WHERE cg.session_id = ?
                
                ORDER BY last_message_timestamp DESC
            `, [sessionId, sessionId]);
            
            console.log(`[ADMIN-CHATS] Total chats: ${chats.length}`);
            
            res.json({ success: true, chats });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[ADMIN-CHATS] Error loading:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST - Asignar chat a usuario
app.post('/api/chat-assignments', async (req, res) => {
    const { chat_jid, session_id, user_id, assigned_by, notes } = req.body;
    
    if (!chat_jid || !session_id || !user_id) {
        return res.status(400).json({ success: false, error: 'chat_jid, session_id and user_id are required' });
    }
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const phoneNumber = await getUserPhoneNumber(session_id);
        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Session not found' });
        }
        
        const connection = await pool.getConnection();
        try {
            // Cerrar asignación anterior si existe
            await connection.execute(
                `UPDATE chat_assignments SET status = 'transferred' 
                 WHERE chat_jid = ? AND session_id = ? AND status = 'active'`,
                [chat_jid, phoneNumber]
            );
            
            // Crear nueva asignación
            const [result] = await connection.execute(
                `INSERT INTO chat_assignments (chat_jid, session_id, user_id, assigned_by, notes, status)
                 VALUES (?, ?, ?, ?, ?, 'active')`,
                [chat_jid, phoneNumber, user_id, assigned_by, notes]
            );
            
            console.log(`[CHAT-ASSIGNMENTS] ✅ Chat asignado: ${chat_jid} → Usuario ${user_id}`);
            
            res.json({ success: true, id: result.insertId, message: 'Chat assigned successfully' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CHAT-ASSIGNMENTS] Error assigning:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST - Transferir chat a otro usuario
app.post('/api/chat-transfers', async (req, res) => {
    const { chat_jid, session_id, from_user_id, to_user_id, transferred_by, reason } = req.body;
    
    if (!chat_jid || !session_id || !to_user_id) {
        return res.status(400).json({ success: false, error: 'chat_jid, session_id and to_user_id are required' });
    }
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const phoneNumber = await getUserPhoneNumber(session_id);
        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Session not found' });
        }
        
        const connection = await pool.getConnection();
        try {
            // Registrar transferencia
            const [transferResult] = await connection.execute(
                `INSERT INTO chat_transfers (chat_jid, session_id, from_user_id, to_user_id, transferred_by, reason)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [chat_jid, phoneNumber, from_user_id, to_user_id, transferred_by, reason]
            );
            
            // Cerrar asignación anterior
            await connection.execute(
                `UPDATE chat_assignments SET status = 'transferred' 
                 WHERE chat_jid = ? AND session_id = ? AND status = 'active'`,
                [chat_jid, phoneNumber]
            );
            
            // Crear nueva asignación
            await connection.execute(
                `INSERT INTO chat_assignments (chat_jid, session_id, user_id, assigned_by, notes, status)
                 VALUES (?, ?, ?, ?, ?, 'active')`,
                [chat_jid, phoneNumber, to_user_id, transferred_by, `Transferido: ${reason || 'Sin razón'}`, 'active']
            );
            
            console.log(`[CHAT-TRANSFERS] ✅ Chat transferido: ${chat_jid} → Usuario ${to_user_id}`);
            
            res.json({ success: true, id: transferResult.insertId, message: 'Chat transferido exitosamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CHAT-TRANSFERS] Error transferring:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET - Historial de transferencias de un chat
app.get('/api/chat-transfers/:sessionId/:chatJid', async (req, res) => {
    const { sessionId, chatJid } = req.params;
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Database not available' });
    }
    
    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Session not found' });
        }
        
        const connection = await pool.getConnection();
        try {
            const [transfers] = await connection.execute(`
                SELECT 
                    ct.*,
                    uf.name as from_user_name,
                    ut.name as to_user_name,
                    ub.name as transferred_by_name
                FROM chat_transfers ct
                LEFT JOIN users uf ON ct.from_user_id = uf.id
                LEFT JOIN users ut ON ct.to_user_id = ut.id
                LEFT JOIN users ub ON ct.transferred_by = ub.id
                WHERE ct.session_id = ? AND ct.chat_jid = ?
                ORDER BY ct.transferred_at DESC
            `, [phoneNumber, chatJid]);
            
            res.json({ success: true, transfers });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CHAT-TRANSFERS] Error loading history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= FIN ENDPOINTS DE USUARIOS =============

// ============= ENDPOINTS DE SISTEMA MULTI-AGENTES =============

// ============= CRUD DE AGENTES =============

// Listar todos los agentes
app.get('/api/agents', async (req, res) => {
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    try {
        const { sessionId } = req.query;
        const connection = await pool.getConnection();
        try {
            let query = `SELECT id, session_id, name, email, phone, status, max_concurrent_chats, current_chats,
                         is_active, avatar_url, created_at, updated_at, last_activity
                         FROM agents`;
            let params = [];

            // Filtrar por sesión si se proporciona
            if (sessionId) {
                query += ` WHERE session_id = ?`;
                params.push(sessionId);
            }

            query += ` ORDER BY created_at DESC`;

            const [agents] = await connection.execute(query, params);

            res.json({ success: true, agents });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENTS] Error listing agents:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener agentes disponibles para transferencia (activos y online)
app.get('/api/agents/available', async (req, res) => {
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    try {
        const { sessionId } = req.query;
        const connection = await pool.getConnection();
        try {
            // Obtener usuarios activos (agentes y supervisores) de la tabla users
            let query = `SELECT id, name, email, phone, role, status, avatar_url, last_login as last_activity
                         FROM users
                         WHERE status = 'active' AND role IN ('agent', 'supervisor')`;
            let params = [];

            query += ` ORDER BY role DESC, name ASC`;

            const [users] = await connection.execute(query, params);

            // Formatear usuarios para que sean compatibles con el frontend
            const agents = users.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                status: 'online', // Podemos mejorar esto después con estado real
                role: user.role,
                avatar_url: user.avatar_url,
                last_activity: user.last_activity
            }));

            console.log(`[AGENTS] Usuarios disponibles encontrados: ${agents.length}`, sessionId ? `para sesión ${sessionId}` : 'todas las sesiones');

            res.json({ success: true, agents });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENTS] Error listing available agents:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== ENDPOINTS DE GESTIÓN DE AGENTES CON PRIVILEGIOS =====
// IMPORTANTE: Estos deben ir ANTES de '/api/agents/:id' para evitar conflictos

// Listar agentes del admin actual
app.get('/api/agents/list', async (req, res) => {
    try {
        const sessionId = req.query.sessionId;
        
        if (!sessionId) {
            return res.status(401).json({ success: false, error: 'SessionId requerido' });
        }

        const connection = await pool.getConnection();
        try {
            const [agents] = await connection.execute(
                `SELECT id, name, email, phone, status, max_concurrent_chats as totalPermissions, created_at as createdAt
                 FROM agents WHERE session_id = ? ORDER BY created_at DESC`,
                [sessionId]
            );

            console.log(`[AGENTS-LIST] ✅ Encontrados ${agents.length} agentes para sessionId: ${sessionId}`);
            res.json({ success: true, agents });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENTS-LIST] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Crear agente con contraseña
app.post('/api/agents/create', async (req, res) => {
    try {
        const { sessionId, name, email, password, phone } = req.body;

        if (!sessionId || !name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Todos los campos son requeridos' });
        }

        const connection = await pool.getConnection();
        try {
            const { v4: uuidv4 } = require('uuid');
            const agentId = uuidv4();
            
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(password, 12);

            await connection.execute(
                `INSERT INTO agents (id, session_id, name, email, phone, password, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'offline')`,
                [agentId, sessionId, name, email, phone || null, hashedPassword]
            );

            const [newAgent] = await connection.execute(
                'SELECT id, name, email, phone, status, created_at FROM agents WHERE id = ?',
                [agentId]
            );

            console.log(`✅ Agente creado: ${name} (${email}) por usuario ${sessionId}`);
            res.json({ success: true, agent: newAgent[0], message: 'Agente creado exitosamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENTS-CREATE] Error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: 'El email ya está registrado' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== FIN ENDPOINTS GESTIÓN AGENTES =====

// Obtener agente por ID
app.get('/api/agents/:id', async (req, res) => {
    const { id } = req.params;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const [agents] = await connection.execute(
                `SELECT id, session_id, name, email, phone, status, max_concurrent_chats, current_chats,
                 is_active, avatar_url, created_at, updated_at, last_activity
                 FROM agents WHERE id = ?`,
                [id]
            );

            if (agents.length === 0) {
                return res.status(404).json({ success: false, error: 'Agente no encontrado' });
            }

            res.json({ success: true, agent: agents[0] });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENTS] Error getting agent:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Crear nuevo agente
app.post('/api/agents', async (req, res) => {
    const { sessionId, name, email, phone, maxConcurrentChats, avatarUrl } = req.body;

    if (!name || !email) {
        return res.status(400).json({ success: false, error: 'Nombre y email son requeridos' });
    }

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                `INSERT INTO agents (session_id, name, email, phone, max_concurrent_chats, avatar_url, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'offline')`,
                [sessionId || null, name, email, phone || null, maxConcurrentChats || 10, avatarUrl || null]
            );

            const [newAgent] = await connection.execute(
                'SELECT * FROM agents WHERE id = ?',
                [result.insertId]
            );

            res.json({ success: true, agent: newAgent[0], message: 'Agente creado exitosamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENTS] Error creating agent:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: 'El email ya está registrado' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// Actualizar agente
app.put('/api/agents/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, maxConcurrentChats, isActive, avatarUrl } = req.body;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const updates = [];
            const values = [];

            if (name !== undefined) {
                updates.push('name = ?');
                values.push(name);
            }
            if (email !== undefined) {
                updates.push('email = ?');
                values.push(email);
            }
            if (phone !== undefined) {
                updates.push('phone = ?');
                values.push(phone);
            }
            if (maxConcurrentChats !== undefined) {
                updates.push('max_concurrent_chats = ?');
                values.push(maxConcurrentChats);
            }
            if (isActive !== undefined) {
                updates.push('is_active = ?');
                values.push(isActive);
            }
            if (avatarUrl !== undefined) {
                updates.push('avatar_url = ?');
                values.push(avatarUrl);
            }

            if (updates.length === 0) {
                return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
            }

            updates.push('updated_at = NOW()');
            values.push(id);

            await connection.execute(
                `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            const [updatedAgent] = await connection.execute(
                'SELECT * FROM agents WHERE id = ?',
                [id]
            );

            res.json({ success: true, agent: updatedAgent[0], message: 'Agente actualizado exitosamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENTS] Error updating agent:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Eliminar agente
app.delete('/api/agents/:id', async (req, res) => {
    const { id } = req.params;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Verificar si el agente tiene chats asignados activos
            const [activeChats] = await connection.execute(
                'SELECT COUNT(*) as count FROM chat_assignments WHERE user_id = ? AND status IN (\'pending\', \'active\')',
                [id]
            );

            if (activeChats[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No se puede eliminar un agente con chats activos. Cierra o transfiere los chats primero.'
                });
            }

            await connection.execute('DELETE FROM agents WHERE id = ?', [id]);

            res.json({ success: true, message: 'Agente eliminado exitosamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENTS] Error deleting agent:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cambiar estado del agente
app.put('/api/agents/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['available', 'busy', 'away', 'offline'].includes(status)) {
        return res.status(400).json({
            success: false,
            error: 'Estado inválido. Use: available, busy, away, offline'
        });
    }

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            await connection.execute(
                'UPDATE agents SET status = ?, last_activity = NOW() WHERE id = ?',
                [status, id]
            );

            // Emitir evento Socket.IO para actualizar en tiempo real
            io.emit('agent-status-changed', { agentId: id, status });

            res.json({ success: true, message: 'Estado actualizado exitosamente' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENTS] Error updating status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Transferir chat a otro agente
app.post('/api/agents/transfer-chat', async (req, res) => {
    const { assignmentId, fromAgentId, toAgentId, reason } = req.body;

    if (!assignmentId || !fromAgentId || !toAgentId) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: assignmentId, fromAgentId, toAgentId'
        });
    }

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Verificar que la asignación existe y pertenece al agente origen
            const [assignments] = await connection.execute(
                'SELECT * FROM chat_assignments WHERE id = ? AND user_id = ?',
                [assignmentId, fromAgentId]
            );

            if (assignments.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Asignación no encontrada o no pertenece al agente'
                });
            }

            const assignment = assignments[0];

            // Cerrar la asignación actual
            await connection.execute(
                `UPDATE chat_assignments SET status = 'transferred',
                 notes = CONCAT(IFNULL(notes, ''), '\nTransferido a agente ID ', ?, ': ', ?)
                 WHERE id = ?`,
                [toAgentId, reason || 'Sin razón', assignmentId]
            );

            // Crear nueva asignación para el agente destino
            const [result] = await connection.execute(
                `INSERT INTO chat_assignments (chat_jid, session_id, user_id, assigned_by, status, notes)
                 VALUES (?, ?, ?, ?, 'pending', ?)`,
                [
                    assignment.chat_jid,
                    assignment.session_id,
                    toAgentId,
                    fromAgentId,
                    `Transferido desde agente ID ${fromAgentId}: ${reason || 'Sin razón'}`
                ]
            );

            // Emitir eventos Socket.IO
            io.emit(`agent-${toAgentId}-assignment`, {
                assignmentId: result.insertId,
                chatJid: assignment.chat_jid,
                sessionId: assignment.session_id,
                transferredFrom: fromAgentId
            });

            io.emit(`chat-transferred`, {
                oldAssignmentId: assignmentId,
                newAssignmentId: result.insertId,
                fromAgentId,
                toAgentId
            });

            res.json({
                success: true,
                newAssignmentId: result.insertId,
                message: 'Chat transferido exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENTS] Error transferring chat:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint simplificado para transferir chat
app.post('/api/chats/transfer', async (req, res) => {
    const { sessionId, chatJid, toAgentId, fromAgentId } = req.body;

    if (!sessionId || !chatJid || !toAgentId) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros requeridos'
        });
    }

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // IMPORTANTE: Obtener el session_id correcto del agente destino
            const [agentData] = await connection.execute(
                'SELECT session_id FROM users WHERE id = ?',
                [toAgentId]
            );

            if (agentData.length === 0 || !agentData[0].session_id) {
                return res.status(400).json({
                    success: false,
                    error: 'El agente no tiene una sesión asignada'
                });
            }

            const agentSessionId = agentData[0].session_id;
            console.log(`[TRANSFER] 📝 Session ID del agente destino: ${agentSessionId}`);

            // Verificar si ya existe una asignación activa para este chat y agente
            const [existingAssignments] = await connection.execute(
                `SELECT id FROM chat_assignments 
                 WHERE chat_jid = ? AND user_id = ? AND status = 'active'`,
                [chatJid, toAgentId]
            );

            if (existingAssignments.length > 0) {
                // Ya está asignado a este agente, no hacer nada
                return res.json({
                    success: true,
                    message: 'El chat ya está asignado a este agente'
                });
            }

            // Buscar asignación actual (de cualquier agente)
            const [currentAssignments] = await connection.execute(
                `SELECT id FROM chat_assignments 
                 WHERE chat_jid = ? AND status = 'active'`,
                [chatJid]
            );

            if (currentAssignments.length > 0) {
                // Marcar asignación actual como transferida
                await connection.execute(
                    `UPDATE chat_assignments SET status = 'transferred' WHERE id = ?`,
                    [currentAssignments[0].id]
                );
            }

            // Crear nueva asignación para el agente destino usando SU session_id
            await connection.execute(
                `INSERT INTO chat_assignments (chat_jid, session_id, user_id, assigned_by, status, notes)
                 VALUES (?, ?, ?, ?, 'active', ?)`,
                [
                    chatJid,
                    agentSessionId,  // ← Usar el session_id del agente, no el que viene del request
                    toAgentId,
                    fromAgentId || null,
                    `Transferido ${fromAgentId ? `desde agente ID ${fromAgentId}` : 'manualmente'}`
                ]
            );

            // Obtener información del chat y del agente
            const [agentInfo] = await connection.execute(
                'SELECT name, email FROM users WHERE id = ?',
                [toAgentId]
            );

            const [chatInfo] = await connection.execute(
                `SELECT COALESCE(c.name, SUBSTRING_INDEX(?, '@', 1)) as chat_name
                 FROM (SELECT 1) as dummy
                 LEFT JOIN contacts c ON c.jid = ?
                 LIMIT 1`,
                [chatJid, chatJid]
            );

            const agentName = agentInfo[0]?.name || 'Agente';
            const chatName = chatInfo[0]?.chat_name || chatJid.split('@')[0];

            // Insertar mensaje de notificación en la BD para el agente
            const notificationText = `📢 *Chat transferido por Admin*\n\n` +
                                   `Hola ${agentName},\n` +
                                   `Se te ha asignado el chat con: *${chatName}*\n\n` +
                                   `Por favor, atiende esta conversación lo antes posible.\n\n` +
                                   `_Mensaje automático del sistema_`;

            await connection.execute(
                `INSERT INTO messages (
                    id, session_id, phone_number, chat_jid, sender_jid, 
                    from_me, message_type, text_content, timestamp, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
                [
                    `SYSTEM-${Date.now()}`,
                    sessionId,
                    sessionId, // phone_number
                    chatJid,
                    'system@whatsflow.com',
                    false, // from_me
                    'notification',
                    notificationText,
                    'read'
                ]
            );

            // Emitir evento Socket.IO al agente con sonido
            io.emit(`agent-${toAgentId}-new-chat`, {
                type: 'transfer',
                chatJid,
                sessionId,
                chatName,
                message: notificationText,
                transferredFrom: fromAgentId,
                playSound: true,
                showNotification: true,
                timestamp: new Date().toISOString()
            });

            // También emitir evento general para que el frontend recargue
            io.emit('chat-assignment-changed', {
                agentId: toAgentId,
                chatJid,
                action: 'assigned'
            });

            console.log(`[TRANSFER] ✅ Chat ${chatJid} transferido al agente ${agentName} (ID: ${toAgentId})`);
            console.log(`[TRANSFER] 📧 Notificación enviada al agente`);

            res.json({
                success: true,
                message: 'Chat transferido exitosamente',
                agentName,
                chatName
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[TRANSFER] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener chats asignados activos de un agente (para el dashboard del agente)
app.get('/api/agents/:userId/chats', async (req, res) => {
    const { userId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            error: 'sessionId is required'
        });
    }

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Obtener todos los chats asignados activos al agente (GROUP BY para evitar duplicados)
            // Incluye tanto contacts como contact_groups
            const [assignments] = await connection.execute(
                `SELECT 
                    ca.chat_jid,
                    ca.session_id,
                    MAX(ca.assigned_at) as assigned_at,
                    MAX(ca.notes) as notes,
                    COALESCE(
                        MAX(CASE WHEN ca.chat_jid LIKE '%@g.us' THEN cg.name ELSE c.name END),
                        SUBSTRING_INDEX(ca.chat_jid, '@', 1)
                    ) as contact_name,
                    COALESCE(
                        MAX(CASE WHEN ca.chat_jid LIKE '%@g.us' THEN cg.avatar_url ELSE c.avatar_url END)
                    ) as avatar_url,
                    (SELECT text_content FROM messages m 
                     WHERE m.chat_jid = ca.chat_jid 
                     ORDER BY m.timestamp DESC LIMIT 1) as last_message,
                    (SELECT timestamp FROM messages m 
                     WHERE m.chat_jid = ca.chat_jid 
                     ORDER BY m.timestamp DESC LIMIT 1) as last_message_time,
                    (SELECT COUNT(*) FROM messages m 
                     WHERE m.chat_jid = ca.chat_jid 
                     AND m.from_me = 0 
                     AND m.status != 'read') as unread_count
                FROM chat_assignments ca
                LEFT JOIN contacts c ON c.jid = ca.chat_jid AND c.session_id = ca.session_id
                LEFT JOIN contact_groups cg ON cg.jid = ca.chat_jid AND cg.session_id = ca.session_id
                WHERE ca.user_id = ? 
                AND ca.session_id = ?
                AND ca.status = 'active'
                GROUP BY ca.chat_jid, ca.session_id
                ORDER BY last_message_time DESC`,
                [userId, sessionId]
            );

            // Formatear para que sea compatible con el formato de chats
            const formattedChats = assignments.map(assignment => ({
                id: assignment.chat_jid,
                name: assignment.contact_name || assignment.chat_jid.split('@')[0],
                isGroup: assignment.chat_jid.includes('@g.us'),
                lastMessage: assignment.last_message || '',
                timestamp: assignment.last_message_time || assignment.assigned_at,
                unreadCount: assignment.unread_count || 0,
                avatar: assignment.avatar_url,
                assigned: true,
                assignedAt: assignment.assigned_at
            }));

            res.json({
                success: true,
                sessionId,
                chats: formattedChats,
                count: formattedChats.length
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENTS] Error obteniendo chats asignados:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener historial de chats de un agente
app.get('/api/agents/:id/history', async (req, res) => {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!pool) {
        return res.status(503).json({ success: false, error: 'Servicio de base de datos no disponible' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const [assignments] = await connection.execute(
                `SELECT ca.*,
                 (SELECT COUNT(*) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id) as messages_count
                 FROM chat_assignments ca
                 WHERE ca.user_id = ?
                 ORDER BY ca.created_at DESC
                 LIMIT ? OFFSET ?`,
                [id, parseInt(limit), parseInt(offset)]
            );

            const [total] = await connection.execute(
                'SELECT COUNT(*) as total FROM chat_assignments WHERE user_id = ?',
                [id]
            );

            res.json({
                success: true,
                assignments,
                total: total[0].total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AGENTS] Error getting history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= FIN CRUD DE AGENTES =============

// Asignar chat a un agente
app.post('/api/chat-assignments/assign', async (req, res) => {
    const { sessionId, chatJid, userId, assignedBy, notes } = req.body;

    if (!sessionId || !chatJid || !userId) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: sessionId, chatJid, userId'
        });
    }

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Verificar si ya existe una asignación activa para este chat
            const [existing] = await connection.execute(
                'SELECT id, status FROM chat_assignments WHERE chat_jid = ? AND session_id = ? AND status IN (\'pending\', \'accepted\', \'active\')',
                [chatJid, phoneNumber]
            );

            if (existing.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Este chat ya tiene una asignación activa',
                    currentAssignment: existing[0]
                });
            }

            // Crear nueva asignación
            const [result] = await connection.execute(
                `INSERT INTO chat_assignments (chat_jid, session_id, user_id, assigned_by, status, notes)
                 VALUES (?, ?, ?, ?, 'pending', ?)`,
                [chatJid, phoneNumber, userId, assignedBy || null, notes || null]
            );

            // Emitir evento Socket.IO al agente
            io.emit(`agent-${userId}-assignment`, {
                assignmentId: result.insertId,
                chatJid,
                sessionId: phoneNumber,
                notes
            });

            res.json({
                success: true,
                assignmentId: result.insertId,
                message: 'Chat asignado exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CHAT-ASSIGNMENT] Error asignando chat:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Agente acepta chat asignado
app.post('/api/chat-assignments/accept', async (req, res) => {
    const { assignmentId, userId } = req.body;

    if (!assignmentId || !userId) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: assignmentId, userId'
        });
    }

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Verificar que la asignación pertenece al agente
            const [assignments] = await connection.execute(
                'SELECT * FROM chat_assignments WHERE id = ? AND user_id = ?',
                [assignmentId, userId]
            );

            if (assignments.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Asignación no encontrada o no pertenece al agente'
                });
            }

            // Actualizar estado a aceptado
            await connection.execute(
                'UPDATE chat_assignments SET status = \'active\', accepted_at = NOW() WHERE id = ?',
                [assignmentId]
            );

            // Emitir evento Socket.IO
            io.emit(`assignment-${assignmentId}-accepted`, {
                assignmentId,
                userId,
                acceptedAt: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Chat aceptado exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CHAT-ASSIGNMENT] Error aceptando chat:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Agente rechaza chat asignado
app.post('/api/chat-assignments/reject', async (req, res) => {
    const { assignmentId, userId, reason } = req.body;

    if (!assignmentId || !userId) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: assignmentId, userId'
        });
    }

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Verificar que la asignación pertenece al agente
            const [assignments] = await connection.execute(
                'SELECT * FROM chat_assignments WHERE id = ? AND user_id = ?',
                [assignmentId, userId]
            );

            if (assignments.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Asignación no encontrada o no pertenece al agente'
                });
            }

            // Actualizar estado a rechazado
            await connection.execute(
                'UPDATE chat_assignments SET status = \'rejected\', notes = CONCAT(IFNULL(notes, \'\'), \'\nRechazado: \', ?) WHERE id = ?',
                [reason || 'Sin razón especificada', assignmentId]
            );

            // Emitir evento Socket.IO
            io.emit(`assignment-${assignmentId}-rejected`, {
                assignmentId,
                userId,
                reason,
                rejectedAt: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Chat rechazado'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CHAT-ASSIGNMENT] Error rechazando chat:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cerrar chat
app.post('/api/chat-assignments/close', async (req, res) => {
    const { assignmentId, userId, notes } = req.body;

    if (!assignmentId || !userId) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: assignmentId, userId'
        });
    }

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Verificar que la asignación pertenece al agente
            const [assignments] = await connection.execute(
                'SELECT * FROM chat_assignments WHERE id = ? AND user_id = ?',
                [assignmentId, userId]
            );

            if (assignments.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Asignación no encontrada o no pertenece al agente'
                });
            }

            // Actualizar estado a cerrado
            await connection.execute(
                'UPDATE chat_assignments SET status = \'closed\', closed_at = NOW(), notes = CONCAT(IFNULL(notes, \'\'), \'\nCerrado: \', ?) WHERE id = ?',
                [notes || 'Chat finalizado', assignmentId]
            );

            // Emitir evento Socket.IO
            io.emit(`assignment-${assignmentId}-closed`, {
                assignmentId,
                userId,
                notes,
                closedAt: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Chat cerrado exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CHAT-ASSIGNMENT] Error cerrando chat:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Transferir chat a otro agente
app.post('/api/chat-assignments/transfer', async (req, res) => {
    const { assignmentId, fromUserId, toUserId, reason } = req.body;

    if (!assignmentId || !fromUserId || !toUserId) {
        return res.status(400).json({
            success: false,
            error: 'Faltan parámetros: assignmentId, fromUserId, toUserId'
        });
    }

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Verificar que la asignación pertenece al agente actual
            const [assignments] = await connection.execute(
                'SELECT * FROM chat_assignments WHERE id = ? AND user_id = ?',
                [assignmentId, fromUserId]
            );

            if (assignments.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Asignación no encontrada o no pertenece al agente'
                });
            }

            const assignment = assignments[0];

            // Actualizar historial de transferencias
            const transferHistory = assignment.transfer_history ?
                JSON.parse(assignment.transfer_history) : [];

            transferHistory.push({
                from: fromUserId,
                to: toUserId,
                reason: reason || 'Transferencia',
                timestamp: new Date().toISOString()
            });

            // Actualizar asignación
            await connection.execute(
                'UPDATE chat_assignments SET user_id = ?, status = \'pending\', transfer_history = ?, notes = CONCAT(IFNULL(notes, \'\'), \'\nTransferido de agente \', ?, \' a agente \', ?, \': \', ?) WHERE id = ?',
                [toUserId, JSON.stringify(transferHistory), fromUserId, toUserId, reason || 'Sin razón', assignmentId]
            );

            // Emitir eventos Socket.IO
            io.emit(`agent-${toUserId}-assignment`, {
                assignmentId,
                chatJid: assignment.chat_jid,
                sessionId: assignment.session_id,
                transferredFrom: fromUserId,
                reason
            });

            io.emit(`assignment-${assignmentId}-transferred`, {
                assignmentId,
                fromUserId,
                toUserId,
                reason,
                transferredAt: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Chat transferido exitosamente'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CHAT-ASSIGNMENT] Error transfiriendo chat:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener asignaciones de chats (para admin)
app.get('/api/chat-assignments/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { status } = req.query;

    if (!pool) {
        return res.json({ success: true, assignments: [] });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el número de teléfono para esta sesión'
            });
        }

        const connection = await pool.getConnection();
        try {
            let query = `
                SELECT
                    ca.id,
                    ca.chat_jid,
                    ca.session_id,
                    ca.user_id,
                    ca.assigned_by,
                    ca.status,
                    ca.assigned_at,
                    ca.accepted_at,
                    ca.closed_at,
                    ca.notes,
                    ca.transfer_history,
                    c.name as contact_name,
                    c.avatar_url as contact_avatar,
                    u.name as agent_name,
                    u.email as agent_email,
                    a.name as assigned_by_name,
                    (SELECT COUNT(*) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id) as message_count,
                    (SELECT MAX(timestamp) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id) as last_message_time
                FROM chat_assignments ca
                LEFT JOIN contacts c ON ca.chat_jid = c.jid AND ca.session_id = c.session_id
                LEFT JOIN users u ON ca.user_id = u.id
                LEFT JOIN users a ON ca.assigned_by = a.id
                WHERE ca.session_id = ?
            `;

            const params = [phoneNumber];

            if (status) {
                query += ' AND ca.status = ?';
                params.push(status);
            }

            query += ' ORDER BY ca.assigned_at DESC';

            const [assignments] = await connection.execute(query, params);

            res.json({ success: true, assignments });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CHAT-ASSIGNMENT] Error obteniendo asignaciones:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener asignaciones de un agente específico
app.get('/api/chat-assignments/agent/:userId', async (req, res) => {
    const { userId } = req.params;
    const { status } = req.query;

    if (!pool) {
        return res.json({ success: true, assignments: [] });
    }

    try {
        const connection = await pool.getConnection();
        try {
            let query = `
                SELECT
                    ca.id,
                    ca.chat_jid,
                    ca.session_id,
                    ca.user_id,
                    ca.status,
                    ca.assigned_at,
                    ca.accepted_at,
                    ca.closed_at,
                    ca.notes,
                    c.name as contact_name,
                    c.avatar_url as contact_avatar,
                    (SELECT COUNT(*) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id) as message_count,
                    (SELECT MAX(timestamp) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id) as last_message_time,
                    (SELECT COUNT(*) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id AND m.from_me = FALSE AND m.is_read = FALSE) as unread_count
                FROM chat_assignments ca
                LEFT JOIN contacts c ON ca.chat_jid = c.jid
                WHERE ca.user_id = ?
            `;

            const params = [userId];

            if (status) {
                query += ' AND ca.status = ?';
                params.push(status);
            }

            query += ' ORDER BY ca.assigned_at DESC';

            const [assignments] = await connection.execute(query, params);

            res.json({ success: true, assignments });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CHAT-ASSIGNMENT] Error obteniendo asignaciones del agente:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= FIN ENDPOINTS DE SISTEMA MULTI-AGENTES =============

// ============= ENDPOINT DE ESTADÍSTICAS DEL DASHBOARD =============

app.get('/api/dashboard/stats/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    if (!pool) {
        return res.json({
            success: true,
            stats: {
                contacts: 0,
                groups: 0,
                messages: 0,
                messagesToday: 0,
                agents: 0,
                activeLines: 0
            }
        });
    }

    try {
        // Obtener todos los session_ids válidos para este usuario
        const sessionIds = await getAllSessionIds(sessionId);
        if (!sessionIds || sessionIds.length === 0) {
            return res.json({
                success: true,
                stats: {
                    contacts: 0,
                    groups: 0,
                    messages: 0,
                    messagesToday: 0,
                    agents: 0,
                    activeLines: 0,
                    unreadMessages: 0
                }
            });
        }

        const connection = await pool.getConnection();
        try {
            // Construir placeholders para IN clause
            const placeholders = sessionIds.map(() => '?').join(',');

            // Obtener todas las estadísticas en paralelo
            const [contactsResult] = await connection.execute(
                `SELECT COUNT(*) as total FROM contacts WHERE session_id IN (${placeholders}) AND jid LIKE "%@s.whatsapp.net"`,
                sessionIds
            );

            const [groupsResult] = await connection.execute(
                `SELECT COUNT(*) as total FROM contact_groups WHERE session_id IN (${placeholders})`,
                sessionIds
            );

            const [messagesResult] = await connection.execute(
                `SELECT COUNT(*) as total FROM messages WHERE session_id IN (${placeholders})`,
                sessionIds
            );

            const [messagesTodayResult] = await connection.execute(
                `SELECT COUNT(*) as total FROM messages WHERE session_id IN (${placeholders}) AND DATE(timestamp) = CURDATE()`,
                sessionIds
            );

            const [agentsResult] = await connection.execute(
                'SELECT COUNT(*) as total FROM users WHERE status = \'active\''
            );

            const [activeLinesResult] = await connection.execute(
                'SELECT COUNT(*) as total FROM user_sessions WHERE is_active = 1'
            );

            const [unreadMessagesResult] = await connection.execute(
                `SELECT COUNT(*) as total FROM messages WHERE session_id IN (${placeholders}) AND from_me = 0 AND is_read = 0`,
                sessionIds
            );

            res.json({
                success: true,
                stats: {
                    contacts: contactsResult[0].total || 0,
                    groups: groupsResult[0].total || 0,
                    messages: messagesResult[0].total || 0,
                    messagesToday: messagesTodayResult[0].total || 0,
                    agents: agentsResult[0].total || 0,
                    activeLines: activeLinesResult[0].total || 0,
                    unreadMessages: unreadMessagesResult[0].total || 0
                }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[DASHBOARD-STATS] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= FIN ENDPOINT DE ESTADÍSTICAS =============

// ============= ENDPOINTS DE AGENDA/CITAS =============
// NOTA: El endpoint POST /api/appointments está definido anteriormente en la línea ~6795

// Listar citas
app.get('/api/appointments/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { startDate, endDate, status } = req.query;

        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            let query = `SELECT * FROM appointments WHERE session_id = ?`;
            const params = [phoneNumber];

            if (startDate && endDate) {
                query += ` AND appointment_date BETWEEN ? AND ?`;
                params.push(startDate, endDate);
            }

            if (status) {
                query += ` AND status = ?`;
                params.push(status);
            }

            query += ` ORDER BY appointment_date ASC, appointment_time ASC`;

            const [appointments] = await connection.execute(query, params);

            console.log(`[APPOINTMENTS] ${appointments.length} citas encontradas para sesión ${sessionId}`);
            res.json({ success: true, appointments });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[APPOINTMENTS] Error listando citas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener una cita por ID
app.get('/api/appointments/detail/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const connection = await pool.getConnection();
        try {
            const [appointments] = await connection.execute(
                `SELECT * FROM appointments WHERE id = ?`,
                [id]
            );

            if (appointments.length === 0) {
                return res.status(404).json({ success: false, error: 'Cita no encontrada' });
            }

            res.json({ success: true, appointment: appointments[0] });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[APPOINTMENTS] Error obteniendo cita:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Actualizar cita
app.put('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Construir query dinámicamente
        const allowedFields = [
            'patient_name', 'patient_phone', 'doctor_name', 'company_name',
            'description', 'appointment_date', 'appointment_time', 'status', 'notes'
        ];

        const updateFields = [];
        const updateValues = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                updateFields.push(`${key} = ?`);
                // Convertir fecha ISO a formato DATE si es appointment_date
                if (key === 'appointment_date' && value && value.includes('T')) {
                    updateValues.push(value.split('T')[0]);
                } else {
                    updateValues.push(value);
                }
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: 'No hay campos válidos para actualizar' });
        }

        updateValues.push(id);

        const connection = await pool.getConnection();
        try {
            await connection.execute(
                `UPDATE appointments SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );

            console.log(`[APPOINTMENTS] Cita ${id} actualizada`);
            res.json({ success: true });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[APPOINTMENTS] Error actualizando cita:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Eliminar cita
app.delete('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const connection = await pool.getConnection();
        try {
            await connection.execute(`DELETE FROM appointments WHERE id = ?`, [id]);

            console.log(`[APPOINTMENTS] Cita ${id} eliminada`);
            res.json({ success: true });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[APPOINTMENTS] Error eliminando cita:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= ENDPOINTS DE PLANTILLAS DE NOTIFICACIONES =============

const { getDefaultTemplates, processTemplate } = require('./calendar-reminders');

// Obtener plantillas predeterminadas
app.get('/api/notification-templates/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Obtener plantillas predeterminadas
        const defaultTemplates = getDefaultTemplates();

        // Obtener plantillas personalizadas del usuario
        const connection = await pool.getConnection();
        try {
            const phoneNumber = await getUserPhoneNumber(sessionId);
            if (phoneNumber) {
                const [customTemplates] = await connection.execute(
                    'SELECT * FROM notification_templates WHERE session_id = ? ORDER BY created_at DESC',
                    [phoneNumber]
                );

                // Combinar plantillas predeterminadas y personalizadas
                const allTemplates = [...defaultTemplates, ...customTemplates];
                res.json({ success: true, templates: allTemplates });
            } else {
                // Solo devolver plantillas predeterminadas
                res.json({ success: true, templates: defaultTemplates });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[TEMPLATES] Error obteniendo plantillas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Crear plantilla personalizada
app.post('/api/notification-templates', async (req, res) => {
    try {
        const { sessionId, name, message } = req.body;

        if (!sessionId || !name || !message) {
            return res.status(400).json({
                success: false,
                error: 'Campos requeridos: sessionId, name, message'
            });
        }

        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            const templateId = `custom_${Date.now()}`;
            await connection.execute(
                'INSERT INTO notification_templates (id, session_id, name, message, is_default) VALUES (?, ?, ?, ?, ?)',
                [templateId, phoneNumber, name, message, false]
            );

            console.log(`[TEMPLATES] Plantilla creada: ${name} (ID: ${templateId})`);
            res.json({ success: true, templateId });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[TEMPLATES] Error creando plantilla:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Eliminar plantilla personalizada
app.delete('/api/notification-templates/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // No permitir eliminar plantillas predeterminadas
        if (['default', 'formal', 'friendly'].includes(id)) {
            return res.status(400).json({
                success: false,
                error: 'No se pueden eliminar plantillas predeterminadas'
            });
        }

        const connection = await pool.getConnection();
        try {
            await connection.execute('DELETE FROM notification_templates WHERE id = ?', [id]);

            console.log(`[TEMPLATES] Plantilla ${id} eliminada`);
            res.json({ success: true });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[TEMPLATES] Error eliminando plantilla:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= ENDPOINTS DE CATEGORÍAS DE CONSULTAS =============

// Obtener categorías de una sesión
app.get('/api/appointment-categories/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            const [categories] = await connection.execute(
                'SELECT * FROM appointment_categories WHERE session_id = ? AND is_active = TRUE ORDER BY name ASC',
                [phoneNumber]
            );

            res.json({ success: true, categories });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CATEGORIES] Error obteniendo categorías:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Crear categoría
app.post('/api/appointment-categories', async (req, res) => {
    try {
        const { sessionId, name, color, icon } = req.body;

        if (!sessionId || !name) {
            return res.status(400).json({
                success: false,
                error: 'Campos requeridos: sessionId, name'
            });
        }

        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                'INSERT INTO appointment_categories (session_id, name, color, icon) VALUES (?, ?, ?, ?)',
                [phoneNumber, name, color || '#1a73e8', icon || '📋']
            );

            console.log(`[CATEGORIES] Categoría creada: ${name} (ID: ${result.insertId})`);
            res.json({ success: true, categoryId: result.insertId });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CATEGORIES] Error creando categoría:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Actualizar categoría
app.put('/api/appointment-categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color, icon } = req.body;

        const connection = await pool.getConnection();
        try {
            const updates = [];
            const values = [];

            if (name) {
                updates.push('name = ?');
                values.push(name);
            }
            if (color) {
                updates.push('color = ?');
                values.push(color);
            }
            if (icon !== undefined) {
                updates.push('icon = ?');
                values.push(icon);
            }

            if (updates.length === 0) {
                return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
            }

            values.push(id);

            await connection.execute(
                `UPDATE appointment_categories SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            console.log(`[CATEGORIES] Categoría ${id} actualizada`);
            res.json({ success: true });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CATEGORIES] Error actualizando categoría:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Eliminar categoría (soft delete)
app.delete('/api/appointment-categories/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const connection = await pool.getConnection();
        try {
            await connection.execute('UPDATE appointment_categories SET is_active = FALSE WHERE id = ?', [id]);

            console.log(`[CATEGORIES] Categoría ${id} eliminada`);
            res.json({ success: true });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CATEGORIES] Error eliminando categoría:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar contacto por teléfono
app.get('/api/contacts/search/:sessionId/:phone', async (req, res) => {
    try {
        const { sessionId, phone } = req.params;

        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            // Buscar en contactos por JID (extraer número antes de @) o phone_number
            const searchPattern = `%${phone}%`;
            const [contacts] = await connection.execute(
                `SELECT name, 
                        SUBSTRING_INDEX(jid, '@', 1) as phone,
                        jid
                 FROM contacts 
                 WHERE session_id = ? 
                   AND (SUBSTRING_INDEX(jid, '@', 1) LIKE ? OR phone_number LIKE ?)
                   AND jid LIKE '%@s.whatsapp.net'
                 ORDER BY name IS NOT NULL DESC, updated_at DESC
                 LIMIT 1`,
                [phoneNumber, searchPattern, searchPattern]
            );

            if (contacts.length > 0) {
                res.json({ 
                    success: true, 
                    contact: {
                        name: contacts[0].name,
                        phone: contacts[0].phone,
                        jid: contacts[0].jid
                    }
                });
            } else {
                res.json({ success: true, contact: null });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CONTACTS] Error buscando contacto:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET: Buscar contactos por nombre
app.get('/api/contacts/search-by-name/:sessionId/:searchTerm', async (req, res) => {
    try {
        const { sessionId, searchTerm } = req.params;

        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            // Buscar contactos por nombre (case-insensitive)
            const searchPattern = `%${searchTerm}%`;
            const [contacts] = await connection.execute(
                `SELECT name, 
                        SUBSTRING_INDEX(jid, '@', 1) as phone,
                        jid
                 FROM contacts 
                 WHERE session_id = ? 
                   AND name LIKE ?
                   AND jid LIKE '%@s.whatsapp.net'
                   AND name IS NOT NULL
                   AND name != SUBSTRING_INDEX(jid, '@', 1)
                 ORDER BY name ASC
                 LIMIT 20`,
                [phoneNumber, searchPattern]
            );

            res.json({ 
                success: true, 
                contacts: contacts
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CONTACTS] Error buscando contactos por nombre:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT: Actualizar contacto
app.put('/api/contacts/update', async (req, res) => {
    try {
        const { sessionId, jid, name, phone } = req.body;

        if (!sessionId || !jid || !name) {
            return res.status(400).json({
                success: false,
                error: 'Campos requeridos: sessionId, jid, name'
            });
        }

        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            // Actualizar nombre del contacto
            const [result] = await connection.execute(
                'UPDATE contacts SET name = ?, notify_name = ?, updated_at = NOW() WHERE jid = ? AND session_id = ?',
                [name, name, jid, phoneNumber]
            );

            if (result.affectedRows > 0) {
                console.log(`[CONTACTS] Contacto actualizado: ${jid} -> ${name}`);
                res.json({ success: true, message: 'Contacto actualizado correctamente' });
            } else {
                res.status(404).json({ success: false, error: 'Contacto no encontrado' });
            }
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[CONTACTS] Error actualizando contacto:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= ENDPOINTS DE PLANTILLAS =============

// Crear plantilla
app.post('/api/appointment-templates', async (req, res) => {
    try {
        const { sessionId, name, messageText, variables } = req.body;

        if (!sessionId || !name || !messageText) {
            return res.status(400).json({
                success: false,
                error: 'Campos requeridos: sessionId, name, messageText'
            });
        }

        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                `INSERT INTO appointment_templates
                 (session_id, name, message_text, variables)
                 VALUES (?, ?, ?, ?)`,
                [phoneNumber, name, messageText, JSON.stringify(variables || [])]
            );

            console.log(`[TEMPLATES] Plantilla creada: ${name} (ID: ${result.insertId})`);
            res.json({ success: true, templateId: result.insertId });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[TEMPLATES] Error creando plantilla:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar plantillas
app.get('/api/appointment-templates/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            const [templates] = await connection.execute(
                `SELECT * FROM appointment_templates WHERE session_id = ? ORDER BY created_at DESC`,
                [phoneNumber]
            );

            // Parse JSON variables
            const parsedTemplates = templates.map(t => ({
                ...t,
                variables: typeof t.variables === 'string' ? JSON.parse(t.variables) : t.variables
            }));

            console.log(`[TEMPLATES] ${parsedTemplates.length} plantillas encontradas`);
            res.json({ success: true, templates: parsedTemplates });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[TEMPLATES] Error listando plantillas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Actualizar plantilla
app.put('/api/appointment-templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, messageText, variables } = req.body;

        const connection = await pool.getConnection();
        try {
            const updates = [];
            const values = [];

            if (name) {
                updates.push('name = ?');
                values.push(name);
            }
            if (messageText) {
                updates.push('message_text = ?');
                values.push(messageText);
            }
            if (variables) {
                updates.push('variables = ?');
                values.push(JSON.stringify(variables));
            }

            if (updates.length === 0) {
                return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
            }

            values.push(id);

            await connection.execute(
                `UPDATE appointment_templates SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            console.log(`[TEMPLATES] Plantilla ${id} actualizada`);
            res.json({ success: true });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[TEMPLATES] Error actualizando plantilla:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Eliminar plantilla
app.delete('/api/appointment-templates/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const connection = await pool.getConnection();
        try {
            await connection.execute(`DELETE FROM appointment_templates WHERE id = ?`, [id]);

            console.log(`[TEMPLATES] Plantilla ${id} eliminada`);
            res.json({ success: true });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[TEMPLATES] Error eliminando plantilla:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= ENDPOINTS DE RECORDATORIOS =============

// Configurar recordatorios para una sesión
app.post('/api/appointment-reminders/config', async (req, res) => {
    try {
        const { sessionId, reminders } = req.body;
        // reminders = [{ timeBeforeHours: 1, templateId: 1, isEnabled: true }, ...]

        if (!sessionId || !Array.isArray(reminders)) {
            return res.status(400).json({
                success: false,
                error: 'Campos requeridos: sessionId, reminders (array)'
            });
        }

        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            // Eliminar configuración anterior
            await connection.execute(
                `DELETE FROM appointment_reminder_config WHERE session_id = ?`,
                [phoneNumber]
            );

            // Insertar nueva configuración
            for (const reminder of reminders) {
                await connection.execute(
                    `INSERT INTO appointment_reminder_config
                     (session_id, time_before_hours, template_id, is_enabled)
                     VALUES (?, ?, ?, ?)`,
                    [
                        phoneNumber,
                        reminder.timeBeforeHours,
                        reminder.templateId || null,
                        reminder.isEnabled !== false
                    ]
                );
            }

            console.log(`[REMINDERS] Configuración actualizada para sesión ${sessionId}: ${reminders.length} recordatorios`);
            res.json({ success: true });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[REMINDERS] Error configurando recordatorios:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener configuración de recordatorios
app.get('/api/appointment-reminders/config/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!phoneNumber) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
        }

        const connection = await pool.getConnection();
        try {
            const [config] = await connection.execute(
                `SELECT * FROM appointment_reminder_config WHERE session_id = ? ORDER BY time_before_hours ASC`,
                [phoneNumber]
            );

            res.json({ success: true, reminders: config });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[REMINDERS] Error obteniendo configuración:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener historial de recordatorios enviados
app.get('/api/appointment-reminders/history/:appointmentId', async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const connection = await pool.getConnection();
        try {
            const [reminders] = await connection.execute(
                `SELECT * FROM appointment_reminders_sent WHERE appointment_id = ? ORDER BY sent_at DESC`,
                [appointmentId]
            );

            res.json({ success: true, reminders });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[REMINDERS] Error obteniendo historial:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= MIDDLEWARE DE AUTENTICACIÓN =============

// Middleware para verificar JWT de admin
const verifyAdminToken = (req, res, next) => {
    console.log(`[ADMIN-AUTH] Verificando token para: ${req.method} ${req.path}`);
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[ADMIN-AUTH] ❌ No se proporcionó token o formato incorrecto');
        return res.status(401).json({
            success: false,
            error: 'No se proporcionó token de autenticación'
        });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded; // Attach admin info to request
        console.log(`[ADMIN-AUTH] ✅ Token válido para admin: ${decoded.email}`);
        next();
    } catch (error) {
        console.error('[ADMIN-AUTH] ❌ Token verification failed:', error.message);
        return res.status(401).json({
            success: false,
            error: 'Token inválido o expirado'
        });
    }
};

// ============= ENDPOINTS DE ADMIN LOGIN =============
// ============= LOGIN DE USUARIOS/AGENTES =============

// POST /api/auth/login - Login de usuarios (agentes, supervisores)

// GET /api/auth/verify - Verificar token JWT Y sesión única
app.get('/api/auth/verify', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const sessionToken = req.headers['x-session-token'];
    const deviceId = req.headers['x-device-id'];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Token no proporcionado', requiresReauth: true });
    }

    // VALIDAR SESSION TOKEN Y DEVICE ID (sesión única)
    if (!sessionToken || !deviceId) {
        console.log('[AUTH-VERIFY] ❌ Falta sessionToken o deviceId');
        return res.status(401).json({ success: false, error: 'Sesión no válida', requiresReauth: true });
    }

    const { activeSessions } = require('./middleware/sessionValidator');
    const session = activeSessions.get(sessionToken);

    if (!session) {
        console.log('[AUTH-VERIFY] ❌ SessionToken no encontrado en sesiones activas');
        return res.status(401).json({ success: false, error: 'Sesión expirada o no válida', requiresReauth: true });
    }

    if (session.deviceId !== deviceId) {
        console.log('[AUTH-VERIFY] ❌ DeviceId no coincide - sesión en otro dispositivo');
        return res.status(403).json({ success: false, error: 'Sesión activa en otro dispositivo', requiresReauth: true });
    }

    // Actualizar última actividad
    session.lastActivity = Date.now();

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (!pool) {
            return res.json({ success: true, user: decoded });
        }

        // Verificar que el usuario siga existiendo y activo
        const connection = await pool.getConnection();
        try {
            const [users] = await connection.execute(
                'SELECT id, email, name, role, department, status FROM users WHERE id = ?',
                [decoded.id]
            );

            if (users.length === 0 || users[0].status !== 'active') {
                console.log('[AUTH-VERIFY] ❌ Usuario no válido o inactivo');
                return res.status(401).json({ success: false, error: 'Usuario no válido', requiresReauth: true });
            }

            console.log(`[AUTH-VERIFY] ✅ Sesión válida para ${users[0].email}`);
            res.json({ success: true, user: users[0] });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[AUTH-VERIFY] Error:', error);
        res.status(401).json({ success: false, error: 'Token inválido', requiresReauth: true });
    }
});

// POST /api/admin/login - Login de administrador
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Email y contraseña son requeridos'
        });
    }

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const connection = await pool.getConnection();
        try {
            // Buscar admin por email
            const [admins] = await connection.execute(
                'SELECT id, email, password, name, role, is_active FROM admin_users WHERE email = ?',
                [email]
            );

            if (admins.length === 0) {
                return res.status(401).json({
                    success: false,
                    error: 'Credenciales inválidas'
                });
            }

            const admin = admins[0];

            // Verificar que el admin esté activo
            if (!admin.is_active) {
                return res.status(403).json({
                    success: false,
                    error: 'Usuario desactivado. Contacte al administrador.'
                });
            }

            // Comparar contraseña
            const passwordMatch = await bcrypt.compare(password, admin.password);

            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    error: 'Credenciales inválidas'
                });
            }

            // Actualizar último login
            await connection.execute(
                'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [admin.id]
            );

            // Generar JWT token
            const token = jwt.sign(
                {
                    id: admin.id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            console.log(`[ADMIN-LOGIN] Admin logged in: ${admin.email}`);

            res.json({
                success: true,
                token,
                admin: {
                    id: admin.id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role
                }
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[ADMIN-LOGIN] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/admin/verify - Verificar sesión de admin
app.get('/api/admin/verify', verifyAdminToken, (req, res) => {
    res.json({
        success: true,
        admin: {
            id: req.admin.id,
            email: req.admin.email,
            name: req.admin.name,
            role: req.admin.role
        }
    });
});

// ============= ENDPOINTS DE GESTIÓN DE PLANES/SUSCRIPCIONES =============
// Cargar router de suscripciones (maneja /plans, /users, /my-subscription sin auth estricto)
const subscriptionsRouter = require('./routes/subscriptions');
app.use('/api/subscriptions', subscriptionsRouter);

// GET /api/subscriptions/:sessionId - Obtener suscripción activa de un usuario
app.get('/api/subscriptions/:sessionId', verifyAdminToken, async (req, res) => {
    const { sessionId } = req.params;

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);

        const connection = await pool.getConnection();
        try {
            const [subscriptions] = await connection.execute(
                `SELECT s.*, a.name as activated_by_name
                 FROM subscriptions s
                 LEFT JOIN admin_users a ON s.activated_by = a.id
                 WHERE s.session_id = ?
                 ORDER BY s.created_at DESC
                 LIMIT 1`,
                [phoneNumber]
            );

            if (subscriptions.length === 0) {
                return res.json({
                    success: true,
                    subscription: null,
                    message: 'No hay suscripción activa'
                });
            }

            const subscription = subscriptions[0];

            // Parse JSON features if exists
            if (subscription.features && typeof subscription.features === 'string') {
                subscription.features = JSON.parse(subscription.features);
            }

            res.json({
                success: true,
                subscription
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[SUBSCRIPTIONS] Error getting subscription:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/subscriptions/users - Obtener usuarios con suscripciones (solo el admin actual)
app.post('/api/subscriptions/users', async (req, res) => {
    const { phone } = req.body;
    
    if (!phone) {
        return res.status(400).json({ success: false, error: 'Teléfono requerido' });
    }
    
    if (!pool) {
        return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
    }
    
    try {
        const connection = await pool.getConnection();
        try {
            console.log(`[SUBSCRIPTIONS] Consultando usuarios para phone: ${phone}`);
            
            // Verificar si el usuario es Super Admin
            const [currentUser] = await connection.execute(
                'SELECT is_super_admin FROM users WHERE phone = ?',
                [phone]
            );
            
            const isSuperAdmin = currentUser.length > 0 && currentUser[0].is_super_admin === 1;
            
            let users;
            if (isSuperAdmin) {
                // Super Admin ve TODOS los usuarios
                [users] = await connection.execute(`
                    SELECT 
                        u.id,
                        u.name,
                        u.email,
                        u.phone,
                        u.role,
                        u.subscription_plan,
                        u.subscription_status,
                        u.subscription_start_date,
                        u.subscription_end_date,
                        u.subscription_days,
                        u.is_admin,
                        u.is_super_admin,
                        DATEDIFF(u.subscription_end_date, NOW()) as days_remaining,
                        CASE 
                            WHEN u.subscription_plan = 'free' THEN 'Gratis'
                            WHEN u.subscription_plan = 'basic' THEN 'Plan Basico'
                            WHEN u.subscription_plan = 'premium' THEN 'Premium'
                            WHEN u.subscription_plan = 'enterprise' THEN 'Empresarial'
                            ELSE u.subscription_plan
                        END as plan_display_name,
                        CASE 
                            WHEN u.subscription_plan = 'free' THEN 0
                            WHEN u.subscription_plan = 'basic' THEN 50
                            WHEN u.subscription_plan = 'premium' THEN 100
                            WHEN u.subscription_plan = 'enterprise' THEN 200
                            ELSE 0
                        END as price
                    FROM users u
                    ORDER BY u.is_super_admin DESC, u.is_admin DESC, u.created_at DESC
                `);
                console.log(`[SUBSCRIPTIONS] Super Admin ${phone} ve todos los usuarios (${users.length} usuarios)`);
            } else {
                // Admin normal solo ve su propia cuenta
                [users] = await connection.execute(`
                    SELECT 
                        u.id,
                        u.name,
                        u.email,
                        u.phone,
                        u.role,
                        u.subscription_plan,
                        u.subscription_status,
                        u.subscription_start_date,
                        u.subscription_end_date,
                        u.subscription_days,
                        u.is_admin,
                        DATEDIFF(u.subscription_end_date, NOW()) as days_remaining,
                        CASE 
                            WHEN u.subscription_plan = 'free' THEN 'Gratis'
                            WHEN u.subscription_plan = 'basic' THEN 'Plan Basico'
                            WHEN u.subscription_plan = 'premium' THEN 'Premium'
                            WHEN u.subscription_plan = 'enterprise' THEN 'Empresarial'
                            ELSE u.subscription_plan
                        END as plan_display_name,
                        CASE 
                            WHEN u.subscription_plan = 'free' THEN 0
                            WHEN u.subscription_plan = 'basic' THEN 50
                            WHEN u.subscription_plan = 'premium' THEN 100
                            WHEN u.subscription_plan = 'enterprise' THEN 200
                            ELSE 0
                        END as price
                    FROM users u
                    WHERE u.phone = ?
                    ORDER BY u.created_at DESC
                `, [phone]);
                console.log(`[SUBSCRIPTIONS] Admin ${phone} consultó su propia cuenta (${users.length} resultado)`);
            }
            
            res.json({ 
                success: true, 
                users: users 
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[SUBSCRIPTIONS] Error al obtener usuarios:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// POST /api/subscriptions/activate - Activar plan para un usuario
app.post('/api/subscriptions/activate', verifyAdminToken, async (req, res) => {
    const {
        sessionId: bodySessionId,
        planType = 'basic',
        days = 30,
        maxCampaigns = 10,
        maxContacts = 1000,
        features = {},
        notes = ''
    } = req.body;

    // Aceptar sessionId del body o phone del query parameter
    const sessionId = bodySessionId || req.query.phone;

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            error: 'sessionId o phone es requerido'
        });
    }

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        // Si sessionId parece un número de teléfono (solo dígitos), usarlo directamente
        let phoneNumber;
        if (/^\d+$/.test(sessionId)) {
            phoneNumber = sessionId;
            console.log('[SUBSCRIPTIONS] Usando número de teléfono directo:', phoneNumber);
        } else {
            phoneNumber = await getUserPhoneNumber(sessionId);
        }
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo identificar el número de teléfono'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Desactivar suscripciones anteriores
            await connection.execute(
                'UPDATE subscriptions SET status = \'inactive\' WHERE session_id = ? AND status = \'active\'',
                [phoneNumber]
            );

            // Calcular fechas
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + parseInt(days));

            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];

            // Crear nueva suscripción
            const [result] = await connection.execute(
                `INSERT INTO subscriptions
                (session_id, plan_type, status, start_date, end_date, days_granted,
                 features, max_campaigns, max_contacts, activated_by, notes)
                VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    phoneNumber,
                    planType,
                    startDateStr,
                    endDateStr,
                    days,
                    JSON.stringify(features),
                    maxCampaigns,
                    maxContacts,
                    req.admin.id,
                    notes
                ]
            );

            console.log(`[SUBSCRIPTIONS] Plan activated for ${phoneNumber} by admin ${req.admin.email}`);

            // Emitir evento Socket.IO para notificar al usuario
            io.emit(`subscription-updated-${phoneNumber}`, {
                planType,
                status: 'active',
                endDate: endDateStr
            });

            res.json({
                success: true,
                subscriptionId: result.insertId,
                message: `Plan ${planType} activado por ${days} días`,
                endDate: endDateStr
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[SUBSCRIPTIONS] Error activating plan:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/subscriptions/deactivate - Desactivar usuario
app.post('/api/subscriptions/deactivate', verifyAdminToken, async (req, res) => {
    const { sessionId, reason = '' } = req.body;

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            error: 'sessionId es requerido'
        });
    }

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);

        const connection = await pool.getConnection();
        try {
            // Desactivar todas las suscripciones activas
            const [result] = await connection.execute(
                'UPDATE subscriptions SET status = \'suspended\', notes = CONCAT(notes, \' | Suspendido: \', ?) WHERE session_id = ? AND status = \'active\'',
                [reason, phoneNumber]
            );

            console.log(`[SUBSCRIPTIONS] User ${phoneNumber} deactivated by admin ${req.admin.email}`);

            // Emitir evento Socket.IO
            io.emit(`subscription-updated-${phoneNumber}`, {
                status: 'suspended',
                reason
            });

            res.json({
                success: true,
                message: 'Usuario desactivado exitosamente',
                affectedRows: result.affectedRows
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[SUBSCRIPTIONS] Error deactivating user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/subscriptions - Listar todas las suscripciones (admin)
app.get('/api/subscriptions', verifyAdminToken, async (req, res) => {
    const { status, planType, limit = 50, offset = 0 } = req.query;

    if (!pool) {
        return res.status(503).json({
            success: false,
            error: 'Servicio de base de datos no disponible'
        });
    }

    try {
        const connection = await pool.getConnection();
        try {
            let query = `
                SELECT s.*, a.name as activated_by_name
                FROM subscriptions s
                LEFT JOIN admin_users a ON s.activated_by = a.id
                WHERE 1=1
            `;
            const params = [];

            if (status) {
                query += ' AND s.status = ?';
                params.push(status);
            }

            if (planType) {
                query += ' AND s.plan_type = ?';
                params.push(planType);
            }

            query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const [subscriptions] = await connection.execute(query, params);

            // Parse JSON features
            subscriptions.forEach(sub => {
                if (sub.features && typeof sub.features === 'string') {
                    sub.features = JSON.parse(sub.features);
                }
            });

            const [countResult] = await connection.execute(
                'SELECT COUNT(*) as total FROM subscriptions WHERE 1=1' +
                (status ? ' AND status = ?' : '') +
                (planType ? ' AND plan_type = ?' : ''),
                params.filter((_, i) => i < params.length - 2)
            );

            res.json({
                success: true,
                subscriptions,
                total: countResult[0].total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[SUBSCRIPTIONS] Error listing subscriptions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= MIDDLEWARE PARA VERIFICAR FEATURES DEL PLAN =============

// Middleware para verificar que el usuario tenga un plan activo con la feature requerida
const checkPlanFeature = (featureName) => {
    return async (req, res, next) => {
        // Si no hay pool, permitir acceso (modo sin DB)
        if (!pool) {
            return next();
        }

        try {
            // Obtener sessionId del request (puede venir de params, query o body)
            const sessionId = req.params.sessionId || req.query.sessionId || req.body.sessionId;

            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'sessionId es requerido'
                });
            }

            const phoneNumber = await getUserPhoneNumber(sessionId);

            const connection = await pool.getConnection();
            try {
                // Buscar suscripción activa
                const [subscriptions] = await connection.execute(
                    `SELECT status, features, end_date FROM subscriptions
                     WHERE session_id = ? AND status = 'active'
                     ORDER BY created_at DESC LIMIT 1`,
                    [phoneNumber]
                );

                // Si no hay suscripción activa, denegar
                if (subscriptions.length === 0) {
                    return res.status(403).json({
                        success: false,
                        error: 'No tienes un plan activo. Contacta al administrador.',
                        requiresSubscription: true
                    });
                }

                const subscription = subscriptions[0];

                // Verificar si el plan expiró
                const endDate = new Date(subscription.end_date);
                if (endDate < new Date()) {
                    return res.status(403).json({
                        success: false,
                        error: 'Tu plan ha expirado. Contacta al administrador.',
                        planExpired: true
                    });
                }

                // Verificar si tiene la feature requerida
                let features = {};
                if (subscription.features) {
                    features = typeof subscription.features === 'string'
                        ? JSON.parse(subscription.features)
                        : subscription.features;
                }

                if (featureName && features[featureName] !== true) {
                    return res.status(403).json({
                        success: false,
                        error: `Esta funcionalidad (${featureName}) no está disponible en tu plan actual.`,
                        missingFeature: featureName
                    });
                }

                // Todo OK, continuar
                next();
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[PLAN-CHECK] Error verificando plan:', error);
            // En caso de error, permitir acceso para no bloquear el servicio
            next();
        }
    };
};

// ============= FIN ENDPOINTS DE AGENDA/CITAS =============

// ============= ENDPOINTS DE CAMPAÑAS PERSONALIZADAS =============
const personalizedCampaignsRouter = require('./routes/personalizedCampaigns');
app.use('/api/personalized-campaigns', personalizedCampaignsRouter);
app.set('whatsappSessions', sessions); // Hacer disponible para las rutas
// ============= FIN ENDPOINTS DE CAMPAÑAS PERSONALIZADAS =============

// ============= ENDPOINT DE UPLOAD PARA CHATBOT =============
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'No se recibió ningún archivo'
            });
        }

        // La ruta relativa desde la raíz del proyecto
        const relativePath = `/uploads/${file.filename}`;
        
        console.log(`[UPLOAD] ✅ Archivo subido: ${file.originalname} -> ${relativePath}`);
        
        res.json({
            success: true,
            url: relativePath,
            path: relativePath,
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype
        });
    } catch (error) {
        console.error('[UPLOAD] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// ============= FIN ENDPOINT DE UPLOAD =============

// ============= ENDPOINTS DE CHATBOT =============
const chatbotRouter = require('./routes/chatbot');
app.use('/api/chatbot', chatbotRouter);
console.log('✅ Sistema de Chatbot cargado correctamente');
// ============= FIN ENDPOINTS DE CHATBOT =============

// NOTA: Router de suscripciones cargado anteriormente en línea ~9500
// ============= FIN ENDPOINTS DE SUSCRIPCIONES =============

// ============= ENDPOINTS DE SINCRONIZACIÓN =============
const syncRouter = require('./routes/sync');
app.use('/api/sync', syncRouter);
app.set('io', io); // Hacer disponible Socket.IO para las rutas de sync

// Endpoint para actualizar nombres de contactos desde WhatsApp
app.post('/api/update-contact-names/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        console.log(`[UPDATE-NAMES] Solicitud para actualizar nombres de contactos para sesión: ${sessionId}`);
        
        const result = await forceUpdateContactNamesInDatabase(sessionId);
        
        res.json({
            success: true,
            updated: result.updated || 0,
            total: result.total || 0,
            message: `Se actualizaron ${result.updated || 0} de ${result.total || 0} contactos`
        });
    } catch (error) {
        console.error('[UPDATE-NAMES] Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});
// ============= FIN ENDPOINTS DE SINCRONIZACIÓN =============

// ============= ENDPOINTS DE API REST =============
const apiRestRouter = require('./routes/api-rest');
// Pasar sessions a las rutas de API REST
app.use((req, res, next) => {
    req.sessions = sessions;
    next();
});
app.use('/api/rest', apiRestRouter);
// ============= FIN ENDPOINTS DE API REST =============

// Endpoint para obtener/actualizar la configuración de sincronización
app.get('/api/sync-settings/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        if (!pool) {
            return res.json({ 
                success: true, 
                autoSync: true, // Default to true if no DB
                message: 'DB not available, using default settings' 
            });
        }
        
        const phoneNumber = await getUserPhoneNumber(sessionId);
        const connection = await pool.getConnection();
        try {
            // Primero intentar obtener de user_sessions
            const [userSessions] = await connection.execute(
                'SELECT auto_sync FROM user_sessions WHERE session_id = ? OR phone_number = ? ORDER BY created_at DESC LIMIT 1',
                [sessionId, phoneNumber]
            );
            
            // Luego intentar obtener de users
            const [users] = await connection.execute(
                'SELECT auto_sync FROM users WHERE phone = ? LIMIT 1',
                [phoneNumber]
            );
            
            let autoSync = true; // Default value
            if (userSessions.length > 0) {
                autoSync = userSessions[0].auto_sync;
            } else if (users.length > 0) {
                autoSync = users[0].auto_sync;
            }
            
            res.json({ 
                success: true, 
                autoSync: autoSync,
                phoneNumber: phoneNumber
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[SYNC-SETTINGS] Error getting sync settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para actualizar la configuración de sincronización
app.post('/api/sync-settings/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { autoSync } = req.body;
    
    if (typeof autoSync === 'undefined') {
        return res.status(400).json({ 
            success: false, 
            error: 'autoSync parameter is required (true/false)' 
        });
    }
    
    try {
        if (!pool) {
            return res.json({ 
                success: true, 
                message: 'DB not available, settings would apply when DB is available' 
            });
        }
        
        const phoneNumber = await getUserPhoneNumber(sessionId);
        const connection = await pool.getConnection();
        try {
            // Actualizar en user_sessions
            await connection.execute(
                `INSERT INTO user_sessions (session_id, phone_number, auto_sync) 
                 VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE auto_sync = ?`,
                [sessionId, phoneNumber, autoSync, autoSync]
            );
            
            // Actualizar en users también si existe
            await connection.execute(
                `INSERT INTO users (phone, auto_sync) 
                 VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE auto_sync = ?`,
                [phoneNumber, autoSync, autoSync]
            );
            
            // Actualizar preferencia en memoria
            sessionSyncPreferences.set(sessionId, autoSync);
            
            // Si se activa la sincronización y hay una sesión activa, iniciar la sincronización
            if (autoSync) {
                const session = sessions.get(sessionId) || sessions.get(phoneNumber);
                if (session && session.sock && session.isConnected) {
                    console.log(`[${sessionId}] 🔁 Iniciando sincronización completa por cambio de configuración`);
                    
                    // Ejecutar sincronización completa en background
                    setTimeout(async () => {
                        try {
                            await performFullSync(sessionId, session.sock, await getUserSessionId(sessionId));
                            
                            // Emitir evento para notificar al frontend sobre la sincronización
                            const updatedChats = await loadChatListFromDB(sessionId);
                            io.emit(`initial-chats-${sessionId}`, { chats: updatedChats });
                        } catch (syncErr) {
                            console.error(`[${sessionId}] Error en sincronización por cambio de configuración:`, syncErr);
                        }
                    }, 1000);
                }
            }
            
            res.json({ 
                success: true, 
                autoSync: autoSync,
                message: autoSync ? 'Sincronización automática activada' : 'Sincronización automática desactivada'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[SYNC-SETTINGS] Error updating sync settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint simplificado para verificar estado de WhatsApp
app.get('/api/whatsapp-connected', async (req, res) => {
    try {
        // Verificar primero en memoria usando sessions
        if (sessions && sessions.size > 0) {
            for (const [sid, session] of sessions.entries()) {
                if (session && session.sock && session.sock.user) {
                    return res.json({
                        success: true,
                        connected: true,
                        sessionId: sid,
                        phoneNumber: session.sock.user.id.split(':')[0] || sid,
                        source: 'memory'
                    });
                }
            }
        }
        
        // Si no hay en memoria, buscar en BD
        if (!pool) {
            return res.json({ success: true, connected: false, reason: 'No WhatsApp clients in memory and DB not available' });
        }
        
        const connection = await pool.getConnection();
        try {
            // Buscar cualquier sesión activa con número válido
            const [rows] = await connection.execute(
                `SELECT session_id, phone_number FROM user_sessions 
                 WHERE is_active = TRUE 
                 AND phone_number IS NOT NULL 
                 AND phone_number REGEXP '^[0-9]+$'
                 AND LENGTH(phone_number) >= 10
                 ORDER BY created_at DESC LIMIT 1`
            );
            
            if (rows.length > 0) {
                return res.json({
                    success: true,
                    connected: true,
                    sessionId: rows[0].session_id,
                    phoneNumber: rows[0].phone_number,
                    source: 'database'
                });
            }
            
            res.json({ success: true, connected: false, reason: 'No active WhatsApp session found' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[WHATSAPP-CONNECTED] Error:', error);
        res.json({ success: false, connected: false, error: error.message });
    }
});

// Endpoint para forzar actualización de nombres de contactos que solo tienen números
app.post('/api/contacts/force-name-update/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        const session = sessions.get(sessionId);
        if (!session || !session.sock || !session.isConnected) {
            return res.status(400).json({ 
                success: false, 
                error: 'Sesión no encontrada, socket no disponible o WhatsApp no conectado' 
            });
        }
        
        console.log(`[${sessionId}] 🔄 Iniciando actualización forzada de nombres de contactos...`);
        
        const result = await forceUpdateContactNamesInDatabase(sessionId);
        
        res.json({
            success: true,
            message: `Actualización de nombres completada`,
            result
        });
        
    } catch (error) {
        console.error(`[${sessionId}] ❌ Error en actualización forzada de nombres:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint para forzar actualización de nombres de contactos que solo tienen número
app.post('/api/contacts/force-name-update/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    
    // Responder inmediatamente para evitar timeouts
    res.json({
        success: true,
        message: 'Solicitud recibida, actualización en proceso',
        processing: true
    });
    
    // Procesar en segundo plano para evitar timeouts
    process.nextTick(async () => {
        try {
            const session = sessions.get(sessionId);
            if (!session || !session.sock || !session.isConnected) {
                console.log(`[${sessionId}] ❌ Sesión no disponible para actualización de nombres`);
                return;
            }
            
            console.log(`[${sessionId}] 🔄 Iniciando actualización forzada de nombres de contactos en segundo plano...`);
            
            // Usar la función específica que creamos
            const updatedCount = await forceUpdateAllNumberOnlyContacts(sessionId);
            
            console.log(`[${sessionId}] ✅ Actualización completada: ${updatedCount} contactos actualizados`);
            
        } catch (error) {
            console.error(`[${sessionId}] ❌ Error en actualización forzada de nombres:`, error);
        }
    });
});

process.on('SIGTERM', cleanup);
process.on('uncaughtException', async (err) => {
    console.error('Error no capturado:', err);
    await cleanup();
});

// ========================================
// 🔍 ENDPOINTS DE DEBUGGING - SESSION LOGS
// ========================================

// Endpoint para ver logs de sesión en formato HTML
app.get('/api/debug/session-logs/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    try {
        const html = sessionLogger.generateHTML(sessionId);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Error generando logs',
            message: error.message 
        });
    }
});

// Endpoint para obtener logs en formato JSON
app.get('/api/debug/session-logs-json/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    try {
        const logs = sessionLogger.getSessionLogs(sessionId);
        const summary = sessionLogger.getSummary(sessionId);
        
        res.json({
            success: true,
            sessionId,
            summary,
            logs
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Error obteniendo logs',
            message: error.message 
        });
    }
});

// Endpoint para ver todas las sesiones con logs
app.get('/api/debug/sessions-list', (req, res) => {
    try {
        const sessionsList = [];
        
        for (const [sessionId, logs] of sessionLogger.logs.entries()) {
            const summary = sessionLogger.getSummary(sessionId);
            sessionsList.push({
                sessionId,
                eventCount: summary.totalEvents,
                firstEvent: summary.firstEvent,
                lastEvent: summary.lastEvent,
                eventTypes: Object.keys(summary.eventCounts)
            });
        }
        
        res.json({
            success: true,
            count: sessionsList.length,
            sessions: sessionsList
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Error listando sesiones',
            message: error.message 
        });
    }
});

// Endpoint para recibir logs del frontend
app.post('/api/debug/frontend-log', express.json(), (req, res) => {
    try {
        const { timestamp, eventType, sessionId, data, stackTrace } = req.body;
        
        // Agregar prefijo FRONTEND_ para distinguir de logs del backend
        sessionLogger.log(
            sessionId || 'UNKNOWN', 
            `FRONTEND_${eventType}`, 
            {
                ...data,
                clientTimestamp: timestamp,
                clientStackTrace: stackTrace
            }
        );

        res.json({ success: true });
    } catch (error) {
        // No devolver error para no interrumpir el frontend
        res.json({ success: false, error: error.message });
    }
});

// Middleware para manejar errores en rutas API (antes del catch-all)
app.use('/api/*', (err, req, res, next) => {
    console.error('API Error:', err.stack);
    if (!res.headersSent) {
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            message: err.message
        });
    }
});

// Ruta catch-all para servir index.html (debe estar al final, después de todas las rutas API)
app.get('*', (req, res) => {
    // Si la ruta empieza con /api/, devolver un error JSON en lugar de index.html
    if (req.path.startsWith('/api/')) {
        res.status(404).json({
            success: false,
            error: 'Endpoint no encontrado'
        });
    } else {
        res.sendFile(path.join(__dirname, '../../public/index.html'));
    }
});

// Configuración de timeouts del servidor para evitar cierres prematuros
server.setTimeout(300000); // 5 minutos para manejar operaciones largas
server.keepAliveTimeout = 310000; // 5 minutos 10 segundos
server.headersTimeout = 320000; // 5 minutos 20 segundos

// Iniciar servidor
const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n🚀 WhatsApp Web API iniciado en puerto ${PORT} (IPv4 + IPv6)`);
    console.log(`📱 Endpoints disponibles:`);
    console.log(`   GET  /api/qr-status - Obtener código QR`);
    console.log(`   POST /api/send/message - Enviar mensaje`);
    console.log(`   POST /api/send/image - Enviar imagen`);
    console.log(`   POST /api/send/audio - Enviar audio`);
    console.log(`   POST /api/send/video - Enviar video`);
    console.log(`   POST /api/send/document - Enviar documento`);
    console.log(`   GET  /api/messages/:sessionId - Obtener mensajes`);
    console.log(`   GET  /api/chats/:sessionId - Obtener chats`);
    console.log(`   GET  /api/health - Estado del servidor`);
    console.log(`   GET  /api/history/messages - Obtener historial de mensajes`);
    console.log(`\n✅ Servidor listo para recibir conexiones`);
    console.log(`⏰ Timeouts configurados: 5 minutos para operaciones largas`);
    await initializeDatabase();
    
    // Restaurar sesiones guardadas automáticamente
    console.log(`\n🔄 Buscando sesiones guardadas para restaurar...`);
    try {
        // Primero buscar sesiones activas en la BD
        if (pool) {
            try {
                const connection = await pool.getConnection();
                const [activeSessions] = await connection.execute(
                    `SELECT session_id, phone_number FROM user_sessions 
                     WHERE is_active = TRUE 
                     AND phone_number IS NOT NULL 
                     AND phone_number REGEXP '^[0-9]+$'
                     ORDER BY created_at DESC LIMIT 5`
                );
                connection.release();
                
                if (activeSessions.length > 0) {
                    console.log(`   ✅ Encontradas ${activeSessions.length} sesiones activas en BD`);
                    for (const session of activeSessions) {
                        const authPath = path.join(BASE_AUTH_DIR, session.session_id);
                        if (fs.existsSync(authPath) && fs.existsSync(path.join(authPath, 'creds.json'))) {
                            console.log(`   📱 Restaurando sesión activa: ${session.session_id} (${session.phone_number})`);
                            try {
                                await createSession(session.session_id, false);
                                sessionSyncPreferences.set(session.session_id, true);
                            } catch (err) {
                                console.error(`   ❌ Error restaurando ${session.session_id}:`, err.message);
                            }
                        }
                    }
                }
            } catch (dbErr) {
                console.error('   ⚠️  Error consultando BD:', dbErr.message);
            }
        }
        
        // Luego buscar otras sesiones guardadas
        const authDirs = fs.readdirSync(BASE_AUTH_DIR);
        let restoredCount = 0;
        
        for (const dirName of authDirs) {
            const authPath = path.join(BASE_AUTH_DIR, dirName);
            const credsPath = path.join(authPath, 'creds.json');
            
            // Saltar si ya fue restaurada como sesión activa
            if (sessions.has(dirName)) continue;
            
            if (fs.existsSync(credsPath)) {
                console.log(`   📱 Encontrada sesión guardada: ${dirName}`);
                try {
                    // Restaurar sesión automáticamente con sincronización completa
                    await createSession(dirName, false);
                    
                    // CRÍTICO: Establecer preferencia de sincronización en TRUE para sincronizar todo al conectar
                    sessionSyncPreferences.set(dirName, true);
                    console.log(`   ✅ Preferencia de sincronización establecida en TRUE para ${dirName} (sincroniza todo al conectar)`);
                    
                    restoredCount++;
                    console.log(`   ✅ Sesión ${dirName} restaurada`);
                } catch (error) {
                    console.log(`   ⚠️  Error restaurando ${dirName}:`, error.message);
                }
            }
        }
        
        if (restoredCount > 0) {
            console.log(`\n✅ ${restoredCount} sesión(es) restaurada(s) automáticamente`);
        } else {
            console.log(`\n📝 No hay sesiones guardadas para restaurar`);
        }
    } catch (error) {
        console.log(`⚠️  Error buscando sesiones guardadas:`, error.message);
    }
    
    // Hacer io accesible globalmente en app
    app.set('io', io);

    // ============= SISTEMA MULTI-AGENTE =============
    // Cargar endpoints del sistema multi-agente después de inicializar BD
    if (pool) {
        try {
            require('./multiagent-endpoints')(app, pool);
            console.log('✅ Sistema multi-agente cargado correctamente');
        } catch (error) {
            console.error('❌ Error cargando sistema multi-agente:', error);
        }
        
        // Cargar sistema de gestión de agentes con privilegios
        try {
            require('./agents-permissions-endpoints')(app, pool);
            console.log('✅ Sistema de gestión de agentes con privilegios cargado correctamente');
        } catch (error) {
            console.error('❌ Error cargando sistema de privilegios:', error);
        }
    } else {
        console.log('⚠️  Pool no disponible - Sistema multi-agente no cargado');
    }

    // ============= SERVICIO DE RECORDATORIOS AUTOMÁTICOS =============
    // Iniciar servicio de recordatorios para citas
    if (pool) {
        try {
            const { startReminderService } = require('./calendar-reminders');
            startReminderService(pool, sessions);
            console.log('✅ Servicio de recordatorios automáticos iniciado');
        } catch (error) {
            console.error('❌ Error iniciando servicio de recordatorios:', error);
        }
    }
});
