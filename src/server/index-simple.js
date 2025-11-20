const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3001',
    methods: ['GET', 'POST']
  }
});

// Configuración de CORS
const corsOptions = {
    origin: 'http://localhost:3001',
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    credentials: true,
    maxAge: 3600
};

app.use(cors(corsOptions));
app.use(express.json());

// Almacenamiento en memoria (temporal)
const sessions = new Map();
const chatsData = new Map();
const messagesData = new Map();

// Crear directorio para autenticación si no existe
const BASE_AUTH_DIR = './auth_info_multi';
if (!fs.existsSync(BASE_AUTH_DIR)) {
    fs.mkdirSync(BASE_AUTH_DIR, { recursive: true });
}

const createSession = async (sessionId, forceNew = false) => {
    console.log(`[SESSION] Creating session: ${sessionId}`);
    
    if (sessions.has(sessionId) && !forceNew) {
        console.log(`[SESSION] Session ${sessionId} already exists`);
        return sessions.get(sessionId);
    }

    const authDir = path.join(BASE_AUTH_DIR, sessionId);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['WhatsFlow', 'Chrome', '1.0.0']
    });

    const sessionData = {
        sock,
        saveCreds,
        isConnected: false,
        qrCode: null,
        lastActivity: Date.now()
    };

    sessions.set(sessionId, sessionData);

    // Eventos del socket
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        console.log(`[SESSION-${sessionId}] Connection update:`, { connection, qr: !!qr });

        if (qr) {
            try {
                const qrDataUrl = await QRCode.toDataURL(qr);
                sessionData.qrCode = qrDataUrl;
                io.emit(`qr-${sessionId}`, { qr: qrDataUrl });
                io.emit('connection-update', { 
                    status: 'qr', 
                    qr: qrDataUrl, 
                    sessionId,
                    message: 'QR Code generated. Please scan with WhatsApp.'
                });
            } catch (error) {
                console.error(`[SESSION-${sessionId}] Error generating QR:`, error);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[SESSION-${sessionId}] Connection closed. Reconnect:`, shouldReconnect);
            
            sessionData.isConnected = false;
            io.emit('connection-update', { 
                status: 'disconnected', 
                sessionId,
                message: 'WhatsApp disconnected'
            });

            if (shouldReconnect) {
                setTimeout(() => createSession(sessionId, true), 3000);
            }
        } else if (connection === 'open') {
            console.log(`[SESSION-${sessionId}] Connected successfully`);
            sessionData.isConnected = true;
            sessionData.qrCode = null;
            
            io.emit('connection-update', { 
                status: 'connected', 
                sessionId,
                message: 'WhatsApp connected successfully'
            });

            // Cargar chats iniciales
            setTimeout(async () => {
                try {
                    const chats = await sock.getChats();
                    const chatList = chats.slice(0, 20).map(chat => ({
                        id: chat.id,
                        name: chat.name || chat.subject || chat.id.split('@')[0],
                        isGroup: chat.id.includes('@g.us'),
                        lastMessage: 'Tap to load messages',
                        timestamp: new Date().toISOString(),
                        unreadCount: 0
                    }));
                    
                    chatsData.set(sessionId, chatList);
                    io.emit(`initial-chats-${sessionId}`, { chats: chatList });
                } catch (error) {
                    console.error(`[SESSION-${sessionId}] Error loading chats:`, error);
                }
            }, 2000);
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message) return;

        console.log(`[SESSION-${sessionId}] New message:`, message.key);

        const messageData = {
            id: message.key.id,
            sessionId,
            chatJid: message.key.remoteJid,
            senderJid: message.key.participant || message.key.remoteJid,
            fromMe: message.key.fromMe,
            message: message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || 
                    message.message?.imageMessage?.caption || 
                    null,
            timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
            type: Object.keys(message.message || {})[0] || 'text',
            status: message.key.fromMe ? 'sent' : 'received'
        };

        // Guardar mensaje en memoria
        const sessionMessages = messagesData.get(sessionId) || [];
        sessionMessages.push(messageData);
        messagesData.set(sessionId, sessionMessages);

        // Emitir mensaje a clientes
        io.emit('message', messageData);
    });

    return sessionData;
};

// Rutas API
app.get('/api/status', (req, res) => {
    res.json({ success: true, message: 'WhatsFlow Server is running' });
});

app.get('/api/session/:sessionId/status', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.json({ 
            success: true, 
            data: { isConnected: false, message: 'Session not found' }
        });
    }

    res.json({ 
        success: true, 
        data: { 
            isConnected: session.isConnected,
            message: session.isConnected ? 'Connected' : 'Not connected'
        }
    });
});

app.get('/api/chats/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const chats = chatsData.get(sessionId) || [];
    
    res.json({ 
        success: true, 
        data: { chats }
    });
});

app.get('/api/messages/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { number: chatJid, limit = 50, offset = 0 } = req.query;
    
    let messages = messagesData.get(sessionId) || [];
    
    if (chatJid) {
        const fullChatJid = chatJid.includes('@') ? chatJid : `${chatJid}@s.whatsapp.net`;
        messages = messages.filter(msg => msg.chatJid === fullChatJid);
    }
    
    const totalMessages = messages.length;
    const paginatedMessages = messages
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({ 
        success: true, 
        data: { 
            messages: paginatedMessages,
            totalMessages,
            limit: parseInt(limit),
            offset: parseInt(offset)
        }
    });
});

app.post('/api/send/message', async (req, res) => {
    const { sessionId, number, message } = req.body;
    
    if (!sessionId || !number || !message) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: sessionId, number, message' 
        });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.isConnected) {
        return res.status(400).json({ 
            success: false, 
            error: 'Session not connected' 
        });
    }

    try {
        const chatJid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        const result = await session.sock.sendMessage(chatJid, { text: message });
        
        res.json({ 
            success: true, 
            data: { messageId: result.key.id }
        });
    } catch (error) {
        console.error(`[API] Error sending message:`, error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Socket.IO eventos
io.on('connection', (socket) => {
    console.log('[SOCKET] Client connected:', socket.id);

    socket.on('join-session', (sessionId) => {
        console.log(`[SOCKET] Client ${socket.id} joined session: ${sessionId}`);
        socket.join(sessionId);
        
        // Crear sesión si no existe
        if (!sessions.has(sessionId)) {
            createSession(sessionId);
        }
    });

    socket.on('request-qr', async ({ sessionId }) => {
        console.log(`[SOCKET] QR requested for session: ${sessionId}`);
        const session = sessions.get(sessionId);
        
        if (session && session.qrCode) {
            socket.emit(`qr-${sessionId}`, { qr: session.qrCode });
        } else {
            // Recrear sesión para generar nuevo QR
            createSession(sessionId, true);
        }
    });

    socket.on('disconnect', () => {
        console.log('[SOCKET] Client disconnected:', socket.id);
    });
});

// Inicializar sesión por defecto
createSession('default-session');

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`🚀 WhatsFlow Server running on port ${PORT}`);
    console.log(`📱 Frontend should connect to: http://localhost:${PORT}`);
    console.log(`🔗 Socket.IO endpoint: ws://localhost:${PORT}`);
}); 
const { createServer } = require('http');
const { Server } = require('socket.io');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3001',
    methods: ['GET', 'POST']
  }
});

// Configuración de CORS
const corsOptions = {
    origin: 'http://localhost:3001',
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    credentials: true,
    maxAge: 3600
};

app.use(cors(corsOptions));
app.use(express.json());

// Almacenamiento en memoria (temporal)
const sessions = new Map();
const chatsData = new Map();
const messagesData = new Map();

// Crear directorio para autenticación si no existe
const BASE_AUTH_DIR = './auth_info_multi';
if (!fs.existsSync(BASE_AUTH_DIR)) {
    fs.mkdirSync(BASE_AUTH_DIR, { recursive: true });
}

const createSession = async (sessionId, forceNew = false) => {
    console.log(`[SESSION] Creating session: ${sessionId}`);
    
    if (sessions.has(sessionId) && !forceNew) {
        console.log(`[SESSION] Session ${sessionId} already exists`);
        return sessions.get(sessionId);
    }

    const authDir = path.join(BASE_AUTH_DIR, sessionId);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['WhatsFlow', 'Chrome', '1.0.0']
    });

    const sessionData = {
        sock,
        saveCreds,
        isConnected: false,
        qrCode: null,
        lastActivity: Date.now()
    };

    sessions.set(sessionId, sessionData);

    // Eventos del socket
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        console.log(`[SESSION-${sessionId}] Connection update:`, { connection, qr: !!qr });

        if (qr) {
            try {
                const qrDataUrl = await QRCode.toDataURL(qr);
                sessionData.qrCode = qrDataUrl;
                io.emit(`qr-${sessionId}`, { qr: qrDataUrl });
                io.emit('connection-update', { 
                    status: 'qr', 
                    qr: qrDataUrl, 
                    sessionId,
                    message: 'QR Code generated. Please scan with WhatsApp.'
                });
            } catch (error) {
                console.error(`[SESSION-${sessionId}] Error generating QR:`, error);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[SESSION-${sessionId}] Connection closed. Reconnect:`, shouldReconnect);
            
            sessionData.isConnected = false;
            io.emit('connection-update', { 
                status: 'disconnected', 
                sessionId,
                message: 'WhatsApp disconnected'
            });

            if (shouldReconnect) {
                setTimeout(() => createSession(sessionId, true), 3000);
            }
        } else if (connection === 'open') {
            console.log(`[SESSION-${sessionId}] Connected successfully`);
            sessionData.isConnected = true;
            sessionData.qrCode = null;
            
            io.emit('connection-update', { 
                status: 'connected', 
                sessionId,
                message: 'WhatsApp connected successfully'
            });

            // Cargar chats iniciales
            setTimeout(async () => {
                try {
                    const chats = await sock.getChats();
                    const chatList = chats.slice(0, 20).map(chat => ({
                        id: chat.id,
                        name: chat.name || chat.subject || chat.id.split('@')[0],
                        isGroup: chat.id.includes('@g.us'),
                        lastMessage: 'Tap to load messages',
                        timestamp: new Date().toISOString(),
                        unreadCount: 0
                    }));
                    
                    chatsData.set(sessionId, chatList);
                    io.emit(`initial-chats-${sessionId}`, { chats: chatList });
                } catch (error) {
                    console.error(`[SESSION-${sessionId}] Error loading chats:`, error);
                }
            }, 2000);
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message) return;

        console.log(`[SESSION-${sessionId}] New message:`, message.key);

        const messageData = {
            id: message.key.id,
            sessionId,
            chatJid: message.key.remoteJid,
            senderJid: message.key.participant || message.key.remoteJid,
            fromMe: message.key.fromMe,
            message: message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || 
                    message.message?.imageMessage?.caption || 
                    null,
            timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
            type: Object.keys(message.message || {})[0] || 'text',
            status: message.key.fromMe ? 'sent' : 'received'
        };

        // Guardar mensaje en memoria
        const sessionMessages = messagesData.get(sessionId) || [];
        sessionMessages.push(messageData);
        messagesData.set(sessionId, sessionMessages);

        // Emitir mensaje a clientes
        io.emit('message', messageData);
    });

    return sessionData;
};

// Rutas API
app.get('/api/status', (req, res) => {
    res.json({ success: true, message: 'WhatsFlow Server is running' });
});

app.get('/api/session/:sessionId/status', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.json({ 
            success: true, 
            data: { isConnected: false, message: 'Session not found' }
        });
    }

    res.json({ 
        success: true, 
        data: { 
            isConnected: session.isConnected,
            message: session.isConnected ? 'Connected' : 'Not connected'
        }
    });
});

app.get('/api/chats/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const chats = chatsData.get(sessionId) || [];
    
    res.json({ 
        success: true, 
        data: { chats }
    });
});

app.get('/api/messages/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { number: chatJid, limit = 50, offset = 0 } = req.query;
    
    let messages = messagesData.get(sessionId) || [];
    
    if (chatJid) {
        const fullChatJid = chatJid.includes('@') ? chatJid : `${chatJid}@s.whatsapp.net`;
        messages = messages.filter(msg => msg.chatJid === fullChatJid);
    }
    
    const totalMessages = messages.length;
    const paginatedMessages = messages
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({ 
        success: true, 
        data: { 
            messages: paginatedMessages,
            totalMessages,
            limit: parseInt(limit),
            offset: parseInt(offset)
        }
    });
});

app.post('/api/send/message', async (req, res) => {
    const { sessionId, number, message } = req.body;
    
    if (!sessionId || !number || !message) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: sessionId, number, message' 
        });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.isConnected) {
        return res.status(400).json({ 
            success: false, 
            error: 'Session not connected' 
        });
    }

    try {
        const chatJid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        const result = await session.sock.sendMessage(chatJid, { text: message });
        
        res.json({ 
            success: true, 
            data: { messageId: result.key.id }
        });
    } catch (error) {
        console.error(`[API] Error sending message:`, error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Socket.IO eventos
io.on('connection', (socket) => {
    console.log('[SOCKET] Client connected:', socket.id);

    socket.on('join-session', (sessionId) => {
        console.log(`[SOCKET] Client ${socket.id} joined session: ${sessionId}`);
        socket.join(sessionId);
        
        // Crear sesión si no existe
        if (!sessions.has(sessionId)) {
            createSession(sessionId);
        }
    });

    socket.on('request-qr', async ({ sessionId }) => {
        console.log(`[SOCKET] QR requested for session: ${sessionId}`);
        const session = sessions.get(sessionId);
        
        if (session && session.qrCode) {
            socket.emit(`qr-${sessionId}`, { qr: session.qrCode });
        } else {
            // Recrear sesión para generar nuevo QR
            createSession(sessionId, true);
        }
    });

    socket.on('disconnect', () => {
        console.log('[SOCKET] Client disconnected:', socket.id);
    });
});

// Inicializar sesión por defecto
createSession('default-session');

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`🚀 WhatsFlow Server running on port ${PORT}`);
    console.log(`📱 Frontend should connect to: http://localhost:${PORT}`);
    console.log(`🔗 Socket.IO endpoint: ws://localhost:${PORT}`);
}); 
const { createServer } = require('http');
const { Server } = require('socket.io');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3001',
    methods: ['GET', 'POST']
  }
});

// Configuración de CORS
const corsOptions = {
    origin: 'http://localhost:3001',
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    credentials: true,
    maxAge: 3600
};

app.use(cors(corsOptions));
app.use(express.json());

// Almacenamiento en memoria (temporal)
const sessions = new Map();
const chatsData = new Map();
const messagesData = new Map();

// Crear directorio para autenticación si no existe
const BASE_AUTH_DIR = './auth_info_multi';
if (!fs.existsSync(BASE_AUTH_DIR)) {
    fs.mkdirSync(BASE_AUTH_DIR, { recursive: true });
}

const createSession = async (sessionId, forceNew = false) => {
    console.log(`[SESSION] Creating session: ${sessionId}`);
    
    if (sessions.has(sessionId) && !forceNew) {
        console.log(`[SESSION] Session ${sessionId} already exists`);
        return sessions.get(sessionId);
    }

    const authDir = path.join(BASE_AUTH_DIR, sessionId);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['WhatsFlow', 'Chrome', '1.0.0']
    });

    const sessionData = {
        sock,
        saveCreds,
        isConnected: false,
        qrCode: null,
        lastActivity: Date.now()
    };

    sessions.set(sessionId, sessionData);

    // Eventos del socket
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        console.log(`[SESSION-${sessionId}] Connection update:`, { connection, qr: !!qr });

        if (qr) {
            try {
                const qrDataUrl = await QRCode.toDataURL(qr);
                sessionData.qrCode = qrDataUrl;
                io.emit(`qr-${sessionId}`, { qr: qrDataUrl });
                io.emit('connection-update', { 
                    status: 'qr', 
                    qr: qrDataUrl, 
                    sessionId,
                    message: 'QR Code generated. Please scan with WhatsApp.'
                });
            } catch (error) {
                console.error(`[SESSION-${sessionId}] Error generating QR:`, error);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[SESSION-${sessionId}] Connection closed. Reconnect:`, shouldReconnect);
            
            sessionData.isConnected = false;
            io.emit('connection-update', { 
                status: 'disconnected', 
                sessionId,
                message: 'WhatsApp disconnected'
            });

            if (shouldReconnect) {
                setTimeout(() => createSession(sessionId, true), 3000);
            }
        } else if (connection === 'open') {
            console.log(`[SESSION-${sessionId}] Connected successfully`);
            sessionData.isConnected = true;
            sessionData.qrCode = null;
            
            io.emit('connection-update', { 
                status: 'connected', 
                sessionId,
                message: 'WhatsApp connected successfully'
            });

            // Cargar chats iniciales
            setTimeout(async () => {
                try {
                    const chats = await sock.getChats();
                    const chatList = chats.slice(0, 20).map(chat => ({
                        id: chat.id,
                        name: chat.name || chat.subject || chat.id.split('@')[0],
                        isGroup: chat.id.includes('@g.us'),
                        lastMessage: 'Tap to load messages',
                        timestamp: new Date().toISOString(),
                        unreadCount: 0
                    }));
                    
                    chatsData.set(sessionId, chatList);
                    io.emit(`initial-chats-${sessionId}`, { chats: chatList });
                } catch (error) {
                    console.error(`[SESSION-${sessionId}] Error loading chats:`, error);
                }
            }, 2000);
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];
        if (!message) return;

        console.log(`[SESSION-${sessionId}] New message:`, message.key);

        const messageData = {
            id: message.key.id,
            sessionId,
            chatJid: message.key.remoteJid,
            senderJid: message.key.participant || message.key.remoteJid,
            fromMe: message.key.fromMe,
            message: message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || 
                    message.message?.imageMessage?.caption || 
                    null,
            timestamp: new Date(message.messageTimestamp * 1000).toISOString(),
            type: Object.keys(message.message || {})[0] || 'text',
            status: message.key.fromMe ? 'sent' : 'received'
        };

        // Guardar mensaje en memoria
        const sessionMessages = messagesData.get(sessionId) || [];
        sessionMessages.push(messageData);
        messagesData.set(sessionId, sessionMessages);

        // Emitir mensaje a clientes
        io.emit('message', messageData);
    });

    return sessionData;
};

// Rutas API
app.get('/api/status', (req, res) => {
    res.json({ success: true, message: 'WhatsFlow Server is running' });
});

app.get('/api/session/:sessionId/status', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.json({ 
            success: true, 
            data: { isConnected: false, message: 'Session not found' }
        });
    }

    res.json({ 
        success: true, 
        data: { 
            isConnected: session.isConnected,
            message: session.isConnected ? 'Connected' : 'Not connected'
        }
    });
});

app.get('/api/chats/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const chats = chatsData.get(sessionId) || [];
    
    res.json({ 
        success: true, 
        data: { chats }
    });
});

app.get('/api/messages/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { number: chatJid, limit = 50, offset = 0 } = req.query;
    
    let messages = messagesData.get(sessionId) || [];
    
    if (chatJid) {
        const fullChatJid = chatJid.includes('@') ? chatJid : `${chatJid}@s.whatsapp.net`;
        messages = messages.filter(msg => msg.chatJid === fullChatJid);
    }
    
    const totalMessages = messages.length;
    const paginatedMessages = messages
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({ 
        success: true, 
        data: { 
            messages: paginatedMessages,
            totalMessages,
            limit: parseInt(limit),
            offset: parseInt(offset)
        }
    });
});

app.post('/api/send/message', async (req, res) => {
    const { sessionId, number, message } = req.body;
    
    if (!sessionId || !number || !message) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: sessionId, number, message' 
        });
    }

    const session = sessions.get(sessionId);
    if (!session || !session.isConnected) {
        return res.status(400).json({ 
            success: false, 
            error: 'Session not connected' 
        });
    }

    try {
        const chatJid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        const result = await session.sock.sendMessage(chatJid, { text: message });
        
        res.json({ 
            success: true, 
            data: { messageId: result.key.id }
        });
    } catch (error) {
        console.error(`[API] Error sending message:`, error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Socket.IO eventos
io.on('connection', (socket) => {
    console.log('[SOCKET] Client connected:', socket.id);

    socket.on('join-session', (sessionId) => {
        console.log(`[SOCKET] Client ${socket.id} joined session: ${sessionId}`);
        socket.join(sessionId);
        
        // Crear sesión si no existe
        if (!sessions.has(sessionId)) {
            createSession(sessionId);
        }
    });

    socket.on('request-qr', async ({ sessionId }) => {
        console.log(`[SOCKET] QR requested for session: ${sessionId}`);
        const session = sessions.get(sessionId);
        
        if (session && session.qrCode) {
            socket.emit(`qr-${sessionId}`, { qr: session.qrCode });
        } else {
            // Recrear sesión para generar nuevo QR
            createSession(sessionId, true);
        }
    });

    socket.on('disconnect', () => {
        console.log('[SOCKET] Client disconnected:', socket.id);
    });
});

// Inicializar sesión por defecto
createSession('default-session');

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`🚀 WhatsFlow Server running on port ${PORT}`);
    console.log(`📱 Frontend should connect to: http://localhost:${PORT}`);
    console.log(`🔗 Socket.IO endpoint: ws://localhost:${PORT}`);
}); 
 
 