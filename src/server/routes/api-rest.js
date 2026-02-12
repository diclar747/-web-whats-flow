const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const axios = require('axios');
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
    req.userId = keys[0].session_id; // Vinculado a user_id en la BD

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
  let connection;
  try {
    const { sessionId, name, description } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId es requerido'
      });
    }

    connection = await mysql.createConnection(dbConfig);

    // Verificar límites del plan antes de generar
    const [userRows] = await connection.query(
      'SELECT subscription_plan, subscription_status, is_super_admin FROM users WHERE id = ? LIMIT 1',
      [sessionId]
    );

    if (userRows.length === 0) {
      await connection.end();
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const user = userRows[0];

    if (!user.is_super_admin) {
      if (!user.subscription_status || user.subscription_status !== 'active') {
        await connection.end();
        return res.status(403).json({
          success: false,
          error: 'Tu suscripción no está activa. Activa tu plan para generar API Keys.'
        });
      }

      if (user.subscription_plan) {
        const [planRows] = await connection.query(
          'SELECT max_channels FROM plans WHERE name = ? LIMIT 1',
          [user.subscription_plan]
        );

        if (planRows.length > 0 && planRows[0].max_channels) {
          const maxKeys = planRows[0].max_channels;
          const [countRows] = await connection.query(
            'SELECT COUNT(*) as total FROM api_keys WHERE session_id = ? AND is_active = TRUE',
            [sessionId]
          );
          const currentCount = countRows[0].total;

          if (currentCount >= maxKeys) {
            await connection.end();
            return res.status(403).json({
              success: false,
              error: `Has alcanzado el límite de ${maxKeys} API Keys de tu plan. Elimina una existente para crear una nueva.`,
              limit: maxKeys,
              current: currentCount
            });
          }
        }
      }
    }

    // Generar API key única
    const apiKey = 'wf_' + crypto.randomBytes(32).toString('hex');

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
    if (connection) try { await connection.end(); } catch(e) {}
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Listar API Keys
router.get('/keys/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await mysql.createConnection(dbConfig);

    const [keys] = await connection.query(
      `SELECT id, api_key, name, description, is_active, created_at, last_used_at, request_count,
              COALESCE(is_auto_generated, 0) as is_auto_generated, phone_number
       FROM api_keys
       WHERE session_id = ? AND is_active = TRUE
       ORDER BY is_auto_generated DESC, created_at DESC`,
      [userId]
    );

    // Obtener phones conectados actualmente
    const sessions = req.sessions;
    const connectedPhones = new Set();
    if (sessions) {
      for (const [, sess] of sessions) {
        if (sess && sess.isConnected && sess.sock && sess.sock.user) {
          const phone = sess.sock.user.id.split(':')[0].replace(/\D/g, '');
          if (phone) connectedPhones.add(phone);
        }
      }
    }

    // Agregar estado de conexión a cada key
    for (const key of keys) {
      if (key.phone_number && connectedPhones.has(key.phone_number)) {
        key.connection_status = 'connected';
      } else {
        key.connection_status = 'disconnected';
      }
    }

    // Obtener max_channels del plan del usuario
    let maxKeys = null;
    const [userRows] = await connection.query(
      'SELECT subscription_plan, is_super_admin FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (userRows.length > 0 && !userRows[0].is_super_admin && userRows[0].subscription_plan) {
      const [planRows] = await connection.query(
        'SELECT max_channels FROM plans WHERE name = ? LIMIT 1',
        [userRows[0].subscription_plan]
      );
      if (planRows.length > 0 && planRows[0].max_channels) {
        maxKeys = planRows[0].max_channels;
      }
    }

    await connection.end();

    res.json({
      success: true,
      keys: keys,
      maxKeys: maxKeys
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Eliminar API Key
router.delete('/keys/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    const connection = await mysql.createConnection(dbConfig);

    // Verificar si es auto-generada (no se puede eliminar)
    const [keyRows] = await connection.query(
      'SELECT id, is_auto_generated FROM api_keys WHERE id = ?',
      [keyId]
    );

    if (keyRows.length > 0 && keyRows[0].is_auto_generated === 1) {
      await connection.end();
      return res.status(403).json({
        success: false,
        error: 'No se puede eliminar la API Key principal. Esta key fue generada automaticamente al conectar WhatsApp.'
      });
    }

    await connection.query(
      'DELETE FROM api_keys WHERE id = ?',
      [keyId]
    );

    await connection.end();

    res.json({
      success: true,
      message: 'API Key eliminada correctamente'
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

// Helper para encontrar sesión activa de WhatsApp vinculada al usuario
const findActiveSession = (sessions, userId) => {
  if (!sessions) return null;

  console.log(`[API-REST] Buscando sesión activa para el Usuario ID: ${userId}`);

  // Buscar cualquier sesión activa conectada que pertenezca a este userId
  for (const [sid, sessionInfo] of sessions.entries()) {
    // Verificamos si la sesión está conectada y si el userId coincide
    // Note: sessionInfo.userId se guarda como número o string en index.js
    const sessionUserId = String(sessionInfo.userId || '');
    const targetUserId = String(userId || '');

    if (sessionInfo.isConnected && sessionInfo.sock && sessionInfo.sock.user && sessionUserId === targetUserId) {
      console.log(`[API-REST] ✅ Sesión activa encontrada para usuario ${userId}: ${sid}`);
      return { sock: sessionInfo.sock, foundSessionId: sid };
    }
  }

  // Fallback: Si no coincide el userId, pero el sid es el userId (escenario de migración o key legacy)
  if (sessions.has(userId)) {
    const sessionInfo = sessions.get(userId);
    if (sessionInfo.isConnected && sessionInfo.sock) {
      return { sock: sessionInfo.sock, foundSessionId: userId };
    }
  }

  console.log(`[API-REST] ❌ No se encontró ninguna sesión activa vinculada al usuario ${userId}`);
  return null;
};

// Enviar mensaje de texto
router.post('/send/text', authenticateAPIKey, async (req, res) => {
  try {
    const { to, message } = req.body;
    const { userId } = req;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" y "message" son requeridos'
      });
    }

    console.log(`[API-REST] Intentando enviar mensaje a ${to} desde Usuario ID ${userId}`);
    const sessions = req.sessions;
    const activeSession = findActiveSession(sessions, userId);

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
    const { userId } = req;

    if (!to || !image) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" e "image" (URL o base64) son requeridos'
      });
    }

    const sessions = req.sessions;
    const activeSession = findActiveSession(sessions, userId);

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
    const { userId } = req;

    if (!to || !document || !filename) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to", "document" (URL) y "filename" son requeridos'
      });
    }

    const sessions = req.sessions;
    const activeSession = findActiveSession(sessions, userId);

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
    const { dateFilter, limit = 500, offset = 0 } = req.query;

    console.log(`[API-CHATS] 📥 GET /api/chats/${sessionId} - dateFilter: ${dateFilter}, limit: ${limit}, offset: ${offset}`);

    const connection = await mysql.createConnection(dbConfig);

    // Construir filtro de fecha
    let dateFilterSQL = '';
    if (dateFilter === 'today') {
      dateFilterSQL = 'AND DATE(timestamp) = CURDATE()';
    } else if (dateFilter === 'limit_24h') {
      dateFilterSQL = 'AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)';
    } else if (dateFilter === 'week') {
      dateFilterSQL = 'AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (dateFilter === 'month') {
      dateFilterSQL = 'AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    console.log(`[API-CHATS] 🔍 SQL Filter: "${dateFilterSQL || 'SIN FILTRO'}"`);

    const [chats] = await connection.query(
      `SELECT DISTINCT chat_jid as remote_jid,
       MAX(sender_name) as push_name,
       COUNT(*) as message_count,
       MAX(timestamp) as last_message_time
       FROM messages
       WHERE session_id = ? ${dateFilterSQL}
       GROUP BY chat_jid
       ORDER BY last_message_time DESC
       LIMIT ? OFFSET ?`,
      [sessionId, parseInt(limit), parseInt(offset)]
    );

    await connection.end();

    console.log(`[API-CHATS] ✅ Retornando ${chats.length} chats para session ${sessionId}`);

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

// Endpoint para conectar WhatsApp mediante API Key (Vista HTML interactiva)
router.get('/connect', async (req, res) => {
  const apiKey = req.query.api_key;
  let sessionId = req.query.session_id;

  if (!apiKey) {
    return res.status(401).send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px; background: #0f1419; color: white;">
        <h1 style="color: #e74c3c;">API Key requerida</h1>
        <p>Por favor, incluye el parametro <code>?api_key=TU_KEY</code> en la URL.</p>
      </div>
    `);
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [keys] = await connection.query(
      'SELECT id, session_id FROM api_keys WHERE api_key = ? AND is_active = TRUE',
      [apiKey]
    );
    await connection.end();

    if (keys.length === 0) {
      return res.status(401).send(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 50px; background: #0f1419; color: white;">
          <h1 style="color: #e74c3c;">API Key invalida</h1>
          <p>La API Key proporcionada no es valida o esta inactiva.</p>
        </div>
      `);
    }

    const userId = keys[0].session_id; // Vinculado al id de usuario

    // Si no hay sessionId en la URL, generar uno nuevo y redirigir
    if (!sessionId) {
      sessionId = crypto.randomBytes(8).toString('hex');
      return res.redirect(`/api/rest/connect?api_key=${apiKey}&session_id=${sessionId}`);
    }

    const sessions = req.sessions;
    const sessionOwnerMap = req.app.get('sessionOwnerMap');
    const qrCodes = req.app.get('qrCodes') || {};
    const session = sessions.get(sessionId);

    // 1. Si ya está conectado, mostrar éxito
    if (session && session.isConnected && session.sock && session.sock.user) {
      return res.send(`
        <html>
        <body style="font-family: sans-serif; text-align: center; margin-top: 50px; background: #0f1419; color: white;">
          <h1 style="color: #25d366;">¡WhatsApp Conectado!</h1>
          <p>La sesion <strong>${sessionId}</strong> ya esta vinculada con exito.</p>
          <p>Puedes cerrar esta ventana y empezar a usar la API.</p>
          <button onclick="window.close()" style="background: #25d366; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold;">Cerrar</button>
        </body>
        </html>
      `);
    }

    // 2. Vincular este sessionId temporal con el userId
    if (sessionOwnerMap) {
      sessionOwnerMap.set(sessionId, userId);
    }

    // 3. Asegurar que la sesión existe
    if (!session) {
      console.log(`[API-REST] Creando sesion temporal para vinculacion: ${sessionId} (User: ${userId})`);
      req.createSession(sessionId, true, false); // forceNew=true para asegurar limpieza
    }

    const qrDataUrl = qrCodes[sessionId];

    // 4. Renderizar vista interactiva con Socket.IO
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Conectar WhatsApp - WhatsFlow API</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="/socket.io/socket.io.js"></script>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', sans-serif; background: #0f1419; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #1a2332; padding: 40px; border-radius: 20px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 420px; width: 90%; transition: all 0.5s ease; }
          .qr-container { background: white; padding: 15px; border-radius: 10px; display: inline-block; margin: 20px 0; min-width: 250px; min-height: 250px; }
          .qr-image { width: 250px; height: 250px; display: block; }
          h1 { margin: 0 0 10px 0; color: #58a6ff; font-size: 24px; }
          p { color: #8b949e; line-height: 1.5; font-size: 14px; }
          .status { margin-top: 20px; font-weight: bold; color: #25d366; display: flex; align-items: center; justify-content: center; gap: 10px; }
          .loader { border: 3px solid #f3f3f3; border-top: 3px solid #25d366; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: inline-block; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
          @keyframes checkmark { 0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
          .success-icon { font-size: 80px; animation: checkmark 0.6s ease; display: block; margin: 20px 0; }
          .success-card { animation: fadeIn 0.5s ease; }
          .phone-number { font-size: 22px; color: #25d366; font-weight: bold; background: rgba(37, 211, 102, 0.1); padding: 12px 20px; border-radius: 10px; display: inline-block; margin: 10px 0; border: 1px solid rgba(37, 211, 102, 0.3); }
          .api-info { background: #0d1117; border: 1px solid #30363d; border-radius: 10px; padding: 15px; margin: 15px 0; text-align: left; }
          .api-info-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; }
          .api-info-label { color: #8b949e; font-size: 12px; }
          .api-info-value { color: #58a6ff; font-size: 12px; font-family: monospace; }
          .btn-primary { background: #25d366; color: white; border: none; padding: 12px 30px; border-radius: 10px; cursor: pointer; font-weight: bold; font-size: 15px; transition: background 0.3s; }
          .btn-primary:hover { background: #1da851; }
          .btn-copy { background: none; border: 1px solid #30363d; color: #8b949e; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 11px; transition: all 0.3s; }
          .btn-copy:hover { border-color: #58a6ff; color: #58a6ff; }
          .footer { margin-top: 25px; font-size: 11px; color: #444; }
          .btn-retry { display: block; margin-top: 15px; color: #58a6ff; text-decoration: none; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="card" id="main-card">
          <h1>Vincular WhatsApp</h1>
          <p>Abre WhatsApp en tu telefono &gt; Dispositivos vinculados &gt; Vincular dispositivo</p>

          <div class="qr-container" id="qr-box">
            ${qrDataUrl ? `<img src="${qrDataUrl}" id="qr-img" class="qr-image" />` : `
              <div style="width: 250px; height: 250px; display: flex; align-items: center; justify-content: center; flex-direction: column; color: #000;">
                <div class="loader"></div>
                <p style="margin-top: 10px; font-size: 12px; color: #666;">Generando codigo QR...</p>
              </div>
            `}
          </div>

          <div class="status" id="status-text">
            <div class="loader"></div>
            <span>Esperando escaneo...</span>
          </div>

          <div class="footer">
            <a href="?api_key=${apiKey}" class="btn-retry">¿Problemas? Generar nuevo QR</a>
          </div>
        </div>

        <script>
          const socket = io();
          const sessionId = '${sessionId}';
          const apiKeyFull = '${apiKey}';
          let connected = false;

          socket.on('connect', () => {
             socket.emit('join-session', sessionId);
          });

          socket.on('qr-code', (data) => {
            if (data.sessionId === sessionId && !connected) {
              updateQR(data.qrDataUrl);
            }
          });

          socket.on('qr-' + sessionId, (data) => {
             if (!connected) updateQR(data.qrDataUrl);
          });

          function updateQR(url) {
            const qrBox = document.getElementById('qr-box');
            if (qrBox) qrBox.innerHTML = '<img src="' + url + '" class="qr-image" id="qr-img" />';
          }

          function showSuccess(phoneNumber) {
            if (connected) return;
            connected = true;
            const card = document.getElementById('main-card');
            card.className = 'card success-card';
            card.innerHTML =
              '<span class="success-icon">✅</span>' +
              '<h1 style="color: #25d366; font-size: 28px;">Conexion Exitosa</h1>' +
              '<p style="color: #e3e8ef; font-size: 16px;">WhatsApp vinculado correctamente</p>' +
              '<div class="phone-number">' + (phoneNumber || 'Conectado') + '</div>' +
              '<div class="api-info">' +
                '<div class="api-info-row"><span class="api-info-label">API Key</span><span class="api-info-value">' + apiKeyFull.substring(0, 20) + '...</span></div>' +
                '<div class="api-info-row"><span class="api-info-label">Estado</span><span style="color: #25d366; font-size: 12px;">● Activo</span></div>' +
              '</div>' +
              '<div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">' +
                '<button class="btn-primary" onclick="window.close()">Cerrar</button>' +
                '<button class="btn-copy" onclick="copyKey()">Copiar API Key</button>' +
              '</div>';
          }

          function copyKey() {
            navigator.clipboard.writeText(apiKeyFull).then(() => {
              const btn = document.querySelector('.btn-copy');
              if (btn) { btn.textContent = '✓ Copiado!'; btn.style.borderColor = '#25d366'; btn.style.color = '#25d366'; }
            });
          }

          // Escuchar conexion exitosa - multiples listeners para mayor cobertura
          socket.on('whatsapp-connected', (data) => {
            if (data.sessionId === sessionId || data.phoneNumber) {
              showSuccess(data.phoneNumber);
            }
          });

          socket.on('connection-update', (data) => {
            if (data.sessionId === sessionId && data.status === 'connected') {
              showSuccess(data.phoneNumber);
            }
          });

          socket.on('session-status', (data) => {
            if (data.sessionId === sessionId && data.isConnected) {
              showSuccess(data.phoneNumber);
            }
          });

          // Polling cada 3s como fallback por si el socket no entrega el evento
          const pollInterval = setInterval(async () => {
            if (connected) { clearInterval(pollInterval); return; }
            try {
              const resp = await fetch('/api/rest/status/' + sessionId + '?api_key=' + apiKeyFull);
              const data = await resp.json();
              if (data.connected) {
                showSuccess(data.phoneNumber || '');
                clearInterval(pollInterval);
              }
            } catch(e) {}
          }, 3000);

          socket.on('disconnect', () => {
            if (!connected) {
              const st = document.getElementById('status-text');
              if (st) st.innerHTML = '<span style="color: #e74c3c;">Reconectando...</span>';
            }
          });

          socket.on('reconnect', () => {
            if (!connected) {
              const st = document.getElementById('status-text');
              if (st) st.innerHTML = '<div class="loader"></div><span>Esperando escaneo...</span>';
              socket.emit('join-session', sessionId);
            }
          });
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Error in /connect:', error);
    res.status(500).send('Error interno en la vinculacion');
  }
});

// Enviar SMS (Premium)
router.post('/sms/send', authenticateAPIKey, async (req, res) => {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const { to, message } = req.body;
    const { userId } = req; // Obtenido del API Key

    if (!to || !message) {
      await connection.end();
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" y "message" son requeridos'
      });
    }

    // 1. Calcular costo
    const cleanPhone = to.replace(/\D/g, '');
    const cost = Math.ceil(message.length / 160);

    // 2. Verificar saldo
    const [users] = await connection.query('SELECT sms_balance FROM users WHERE id = ?', [userId]);
    if (users.length === 0 || users[0].sms_balance < cost) {
      await connection.end();
      return res.status(402).json({ // 402 Payment Required
        success: false,
        error: 'Saldo insuficiente para enviar este mensaje',
        details: {
          required: cost,
          available: users[0]?.sms_balance || 0,
          chars: message.length
        }
      });
    }

    // 3. Autenticación con Mayten (Proveedor SMS)
    const authRes = await axios.post('https://mayten.cloud/auth', {
      username: process.env.SMS_MAYTEN_USERNAME,
      password: process.env.SMS_MAYTEN_PASSWORD
    });
    const token = authRes.data.token;

    // 4. Enviar SMS
    await axios.post('https://mayten.cloud/api/Mensajes/Texto', {
      origen: 'SMS_CORTO',
      mensajes: [{
        mensaje: message,
        telefono: cleanPhone,
        identificador: `api_${userId}_${Date.now()}`
      }]
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // 5. Descontar saldo
    await connection.execute('UPDATE users SET sms_balance = sms_balance - ? WHERE id = ?', [cost, userId]);

    // 6. Registrar en Campañas (para visualización en tabla)
    const [campResult] = await connection.execute(
      'INSERT INTO sms_campaigns (user_id, name, message_template, status, total_recipients, sent_count, failed_count, created_at, category) VALUES (?, ?, ?, "completed", 1, 1, 0, NOW(), "API")',
      [userId, 'API', message]
    );
    const campaignId = campResult.insertId;

    await connection.execute(
      'INSERT INTO sms_campaign_recipients (campaign_id, phone, name, status) VALUES (?, ?, "API User", "sent")',
      [campaignId, cleanPhone]
    );

    // 7. Registrar historial (vinculado a la campaña)
    await connection.execute(
      'INSERT INTO sms_history (user_id, phone, message, status, sent_at, campaign_id) VALUES (?, ?, ?, ?, NOW(), ?)',
      [userId, to, message, 'sent', campaignId]
    );

    await connection.end();

    res.json({
      success: true,
      message: 'SMS enviado exitosamente',
      cost: cost,
      remaining_balance: users[0].sms_balance - cost,
      to: cleanPhone
    });

  } catch (error) {
    if (connection) await connection.end();
    console.error('Error sending SMS via API:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar SMS: ' + (error.response?.data?.message || error.message)
    });
  }
});

module.exports = router;
