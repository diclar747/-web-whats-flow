const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'whatsflow'
};

// Middleware de autenticación por API Key
const authenticateAPIKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API Key requerida. Incluye el header X-API-Key o el parámetro api_key'
    });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [keys] = await connection.query(
      'SELECT * FROM api_keys WHERE api_key = ? AND is_active = TRUE',
      [apiKey]
    );
    await connection.end();

    if (keys.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'API Key inválida o inactiva'
      });
    }

    req.apiKeyData = keys[0];
    req.sessionId = keys[0].session_id;
    
    // Actualizar último uso
    const conn = await mysql.createConnection(dbConfig);
    await conn.query(
      'UPDATE api_keys SET last_used_at = NOW(), request_count = request_count + 1 WHERE id = ?',
      [keys[0].id]
    );
    await conn.end();
    
    next();
  } catch (error) {
    console.error('Error authenticating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Error de autenticación'
    });
  }
};

// Generar nueva API Key
router.post('/keys/generate', async (req, res) => {
  try {
    const { sessionId, name, description } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId es requerido'
      });
    }

    // Generar API key única
    const apiKey = 'wf_' + crypto.randomBytes(32).toString('hex');
    const connection = await mysql.createConnection(dbConfig);

    await connection.query(
      `INSERT INTO api_keys (session_id, api_key, name, description, is_active, created_at)
       VALUES (?, ?, ?, ?, TRUE, NOW())`,
      [sessionId, apiKey, name || 'API Key', description || '']
    );

    await connection.end();

    res.json({
      success: true,
      api_key: apiKey,
      message: 'API Key generada exitosamente'
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Listar API Keys
router.get('/keys/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const connection = await mysql.createConnection(dbConfig);

    const [keys] = await connection.query(
      `SELECT id, api_key, name, description, is_active, created_at, last_used_at, request_count
       FROM api_keys 
       WHERE session_id = ?
       ORDER BY created_at DESC`,
      [sessionId]
    );

    await connection.end();

    res.json({
      success: true,
      keys: keys
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Desactivar API Key
router.delete('/keys/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    const connection = await mysql.createConnection(dbConfig);

    await connection.query(
      'UPDATE api_keys SET is_active = FALSE WHERE id = ?',
      [keyId]
    );

    await connection.end();

    res.json({
      success: true,
      message: 'API Key desactivada'
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============== ENDPOINTS DE LA API REST ==============

// Helper para encontrar sesión activa de WhatsApp
const findActiveSession = (sessions, sessionId) => {
  if (!sessions) return null;
  
  console.log(`[API-REST] Buscando sesión activa para: ${sessionId}`);
  console.log(`[API-REST] Sesiones disponibles: ${Array.from(sessions.keys()).join(', ')}`);
  
  // Primero intenta con el sessionId directo
  if (sessions.has(sessionId)) {
    const sessionInfo = sessions.get(sessionId);
    console.log(`[API-REST] ✅ Sesión encontrada directamente: ${sessionId}, conectada: ${sessionInfo.isConnected}`);
    if (sessionInfo.sock) {
      return { sock: sessionInfo.sock, foundSessionId: sessionId };
    }
  }
  
  // Busca cualquier sesión activa conectada
  for (const [sid, sessionInfo] of sessions.entries()) {
    console.log(`[API-REST] Verificando sesión: ${sid}, conectada: ${sessionInfo.isConnected}`);
    // Verifica si está conectada y tiene socket
    if (sessionInfo.isConnected && sessionInfo.sock && sessionInfo.sock.user) {
      console.log(`[API-REST] ✅ Sesión activa encontrada: ${sid}`);
      return { sock: sessionInfo.sock, foundSessionId: sid };
    }
  }
  
  console.log(`[API-REST] ❌ No se encontró ninguna sesión activa`);
  return null;
};

// Enviar mensaje de texto
router.post('/send/text', authenticateAPIKey, async (req, res) => {
  try {
    const { to, message } = req.body;
    const { sessionId } = req;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" y "message" son requeridos'
      });
    }

    console.log(`[API-REST] Intentando enviar mensaje a ${to} desde sesión ${sessionId}`);
    const sessions = req.sessions;
    const activeSession = findActiveSession(sessions, sessionId);
    
    if (!activeSession) {
      return res.status(404).json({
        success: false,
        error: 'No hay sesión de WhatsApp activa. Escanea el código QR primero.',
        hint: 'Ve a tu dashboard y conecta WhatsApp'
      });
    }

    const { sock } = activeSession;
    
    if (!sock.user) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp no está autenticado. Por favor escanea el código QR.',
        hint: 'Ve a tu dashboard y conecta WhatsApp'
      });
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    await sock.sendMessage(jid, { text: message });

    res.json({
      success: true,
      message: 'Mensaje enviado exitosamente',
      to: jid,
      from: sock.user.id
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enviar imagen
router.post('/send/image', authenticateAPIKey, async (req, res) => {
  try {
    const { to, image, caption } = req.body;
    const { sessionId } = req;

    if (!to || !image) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" e "image" (URL o base64) son requeridos'
      });
    }

    const sessions = req.sessions;
    const activeSession = findActiveSession(sessions, sessionId);
    
    if (!activeSession || !activeSession.sock.user) {
      return res.status(404).json({
        success: false,
        error: 'No hay sesión de WhatsApp autenticada'
      });
    }

    const { sock } = activeSession;
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    await sock.sendMessage(jid, { 
      image: { url: image },
      caption: caption || ''
    });

    res.json({
      success: true,
      message: 'Imagen enviada exitosamente',
      to: jid
    });
  } catch (error) {
    console.error('Error sending image:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enviar archivo/documento
router.post('/send/document', authenticateAPIKey, async (req, res) => {
  try {
    const { to, document, filename, mimetype, caption } = req.body;
    const { sessionId } = req;

    if (!to || !document || !filename) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to", "document" (URL) y "filename" son requeridos'
      });
    }

    const sessions = req.sessions;
    const activeSession = findActiveSession(sessions, sessionId);
    
    if (!activeSession || !activeSession.sock.user) {
      return res.status(404).json({
        success: false,
        error: 'No hay sesión de WhatsApp autenticada'
      });
    }

    const { sock } = activeSession;
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    await sock.sendMessage(jid, { 
      document: { url: document },
      fileName: filename,
      mimetype: mimetype || 'application/pdf',
      caption: caption || ''
    });

    res.json({
      success: true,
      message: 'Documento enviado exitosamente',
      to: jid
    });
  } catch (error) {
    console.error('Error sending document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enviar audio
router.post('/send/audio', authenticateAPIKey, async (req, res) => {
  try {
    const { to, audio, ptt } = req.body;
    const { sessionId } = req;

    if (!to || !audio) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" y "audio" (URL) son requeridos'
      });
    }

    const sessions = req.sessions;
    const activeSession = findActiveSession(sessions, sessionId);
    
    if (!activeSession) {
      return res.status(404).json({
        success: false,
        error: 'No hay sesión de WhatsApp activa. Escanea el código QR primero.',
        hint: 'Ve a tu dashboard y conecta WhatsApp'
      });
    }

    const { sock } = activeSession;
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    await sock.sendMessage(jid, { 
      audio: { url: audio },
      ptt: ptt || false
    });

    res.json({
      success: true,
      message: 'Audio enviado exitosamente',
      to: jid
    });
  } catch (error) {
    console.error('Error sending audio:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enviar video
router.post('/send/video', authenticateAPIKey, async (req, res) => {
  try {
    const { to, video, caption } = req.body;
    const { sessionId } = req;

    if (!to || !video) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" y "video" (URL) son requeridos'
      });
    }

    const sessions = req.sessions;
    const activeSession = findActiveSession(sessions, sessionId);
    
    if (!activeSession) {
      return res.status(404).json({
        success: false,
        error: 'No hay sesión de WhatsApp activa. Escanea el código QR primero.',
        hint: 'Ve a tu dashboard y conecta WhatsApp'
      });
    }

    const { sock } = activeSession;
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    await sock.sendMessage(jid, { 
      video: { url: video },
      caption: caption || ''
    });

    res.json({
      success: true,
      message: 'Video enviado exitosamente',
      to: jid
    });
  } catch (error) {
    console.error('Error sending video:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener mensajes recibidos
router.get('/messages/:sessionId', authenticateAPIKey, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50, offset = 0, chat } = req.query;

    const connection = await mysql.createConnection(dbConfig);
    
    let query = `
      SELECT * FROM messages 
      WHERE session_id = ?
    `;
    let params = [sessionId];

    if (chat) {
      query += ' AND remote_jid = ?';
      params.push(chat);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [messages] = await connection.query(query, params);
    await connection.end();

    res.json({
      success: true,
      messages: messages,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener chats
router.get('/chats/:sessionId', authenticateAPIKey, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const connection = await mysql.createConnection(dbConfig);

    const [chats] = await connection.query(
      `SELECT DISTINCT remote_jid, push_name, 
       (SELECT COUNT(*) FROM messages m WHERE m.remote_jid = messages.remote_jid AND m.session_id = ?) as message_count,
       MAX(timestamp) as last_message_time
       FROM messages 
       WHERE session_id = ?
       GROUP BY remote_jid, push_name
       ORDER BY last_message_time DESC`,
      [sessionId, sessionId]
    );

    await connection.end();

    res.json({
      success: true,
      chats: chats
    });
  } catch (error) {
    console.error('Error getting chats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener código QR para autenticación
router.get('/qr/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessions = req.sessions;
    const qrCodes = req.app.get('qrCodes') || {};

    // Verificar si hay una sesión activa y autenticada
    if (sessions && sessions.has(sessionId)) {
      const sessionInfo = sessions.get(sessionId);
      if (sessionInfo.isConnected && sessionInfo.sock && sessionInfo.sock.user) {
        return res.json({
          success: true,
          authenticated: true,
          user: sessionInfo.sock.user
        });
      }
    }

    if (qrCodes[sessionId]) {
      return res.json({
        success: true,
        authenticated: false,
        qr: qrCodes[sessionId]
      });
    }

    res.json({
      success: false,
      error: 'No hay código QR disponible. Inicia sesión primero.'
    });
  } catch (error) {
    console.error('Error getting QR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Estado de conexión
router.get('/status/:sessionId', authenticateAPIKey, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessions = req.sessions;
    
    const activeSession = findActiveSession(sessions, sessionId);

    if (!activeSession) {
      return res.json({
        success: true,
        connected: false,
        authenticated: false,
        message: 'No hay sesión activa. Escanea el código QR en tu dashboard.'
      });
    }

    const { sock, foundSessionId } = activeSession;
    
    res.json({
      success: true,
      connected: true,
      authenticated: !!sock.user,
      user: sock.user || null,
      sessionId: foundSessionId
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
