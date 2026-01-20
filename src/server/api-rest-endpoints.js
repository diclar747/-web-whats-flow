/**
 * API REST Endpoints para WhatsApp
 * Incluye autenticación, verificación de plan, y envío de multimedia
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar multer para archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/api');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 16 * 1024 * 1024 // 16MB (límite de WhatsApp)
    }
});

/**
 * Middleware: Autenticar API Key
 */
async function authenticateAPIKey(req, res, pool) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
        return { success: false, status: 401, error: 'API Key requerida. Incluye el header X-API-Key' };
    }

    // Obtener pool de argumentos o de global
    const activePool = pool || global.dbPool;

    if (!activePool) {
        console.error('[API-REST] Error: Database pool not available');
        return { success: false, status: 500, error: 'Base de datos no disponible' };
    }

    try {
        // Buscar API Key en BD
        const [keys] = await activePool.execute(
            'SELECT * FROM api_keys WHERE api_key = ? AND is_active = TRUE',
            [apiKey]
        );

        if (keys.length === 0) {
            return { success: false, status: 401, error: 'API Key inválida o inactiva' };
        }

        const apiKeyData = keys[0];

        // Incrementar contador de uso
        await activePool.execute(
            'UPDATE api_keys SET request_count = request_count + 1, last_used_at = NOW() WHERE id = ?',
            [apiKeyData.id]
        );

        return { success: true, apiKeyData };
    } catch (error) {
        console.error('[API-REST] Error autenticando:', error);
        return { success: false, status: 500, error: 'Error de autenticación' };
    }
}

/**
 * Middleware: Verificar límite de mensajes del plan
 */
async function checkPlanLimit(sessionId, pool) {
    const activePool = pool || global.dbPool;
    if (!activePool) return { success: false, status: 500, error: 'Base de datos no disponible' };

    try {
        // Obtener plan del usuario desde user_sessions
        const [users] = await activePool.execute(
            `SELECT us.*, p.max_messages_per_month
             FROM user_sessions us
             LEFT JOIN plans p ON us.plan_id = p.id
             WHERE us.phone_number = ? OR us.session_id = ?`,
            [sessionId, sessionId]
        );

        if (users.length === 0) {
            return { success: false, status: 404, error: 'Usuario no encontrado' };
        }

        const user = users[0];
        const maxMessages = user.max_messages_per_month || 0;
        const usedMessages = user.messages_sent_this_month || 0;
        const availableMessages = maxMessages - usedMessages;

        if (availableMessages <= 0) {
            return {
                success: false,
                status: 402, // Payment Required
                error: 'Sin mensajes disponibles en tu plan',
                used: usedMessages,
                limit: maxMessages,
                available: 0
            };
        }

        return { success: true, availableMessages };
    } catch (error) {
        console.error('[API-REST] Error verificando plan:', error);
        return { success: false, status: 500, error: 'Error al verificar plan' };
    }
}

/**
 * Decrementar contador de mensajes del plan
 */
async function decrementPlanCounter(sessionId, pool) {
    const activePool = pool || global.dbPool;
    if (!activePool) return;

    try {
        console.log(`[API-REST] Descontando 1 mensaje del plan de ${sessionId}`);
        await activePool.execute(
            'UPDATE user_sessions SET messages_sent_this_month = messages_sent_this_month + 1, messages_api = messages_api + 1 WHERE phone_number = ? OR session_id = ?',
            [sessionId, sessionId]
        );
        console.log(`[API-REST] ✅ Mensaje descontado del plan`);
    } catch (error) {
        console.error('[API-REST] Error descontando del plan:', error);
    }
}

/**
 * Registrar endpoints de API REST
 */
function registerAPIRestEndpoints(app, pool, sessions) {
    console.log('🔌 [API-REST-MODULE] ===== REGISTRANDO ENDPOINTS DE API REST =====');
    console.log('🔌 [API-REST-MODULE] Parámetros recibidos:', { hasApp: !!app, hasPool: !!pool, hasSessions: !!sessions });

    // ==========================================
    // POST /api/rest/send/text - Enviar mensaje de texto
    // ==========================================
    app.post('/api/rest/send/text', async (req, res) => {
        console.log('[API-REST] 📨 POST /send/text - INICIADO');

        // Autenticar
        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { to, message } = req.body;

        // Validar parámetros
        if (!to || !message) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros: to, message' });
        }

        // Verificar límite del plan
        const planCheck = await checkPlanLimit(sessionId, pool);
        if (!planCheck.success) {
            return res.status(planCheck.status).json({
                success: false,
                error: planCheck.error,
                used: planCheck.used,
                limit: planCheck.limit,
                available: planCheck.available
            });
        }

        // Obtener sesión de WhatsApp
        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión de WhatsApp no conectada' });
        }

        try {
            // Formatear número
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

            // Enviar mensaje
            const sentMsg = await session.sock.sendMessage(jid, { text: message });

            // Descontar del plan
            await decrementPlanCounter(sessionId, pool);

            console.log(`[API-REST] ✅ Mensaje de texto enviado a ${to}`);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                timestamp: sentMsg.messageTimestamp,
                to: jid
            });
        } catch (error) {
            console.error('[API-REST] Error enviando texto:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // POST /api/rest/send/image - Enviar imagen
    // ==========================================
    app.post('/api/rest/send/image', async (req, res) => {
        console.log('[API-REST] POST /send/image');

        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { to, image, caption } = req.body;

        if (!to || !image) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros: to, image' });
        }

        const planCheck = await checkPlanLimit(sessionId, pool);
        if (!planCheck.success) {
            return res.status(planCheck.status).json({ success: false, error: planCheck.error });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

            const sentMsg = await session.sock.sendMessage(jid, {
                image: { url: image },
                caption: caption || ''
            });

            await decrementPlanCounter(sessionId, pool);

            console.log(`[API-REST] ✅ Imagen enviada a ${to}`);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                to: jid
            });
        } catch (error) {
            console.error('[API-REST] Error enviando imagen:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // POST /api/rest/send/video - Enviar video
    // ==========================================
    app.post('/api/rest/send/video', async (req, res) => {
        console.log('[API-REST] POST /send/video');

        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { to, video, caption } = req.body;

        if (!to || !video) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros: to, video' });
        }

        const planCheck = await checkPlanLimit(sessionId, pool);
        if (!planCheck.success) {
            return res.status(planCheck.status).json({ success: false, error: planCheck.error });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

            const sentMsg = await session.sock.sendMessage(jid, {
                video: { url: video },
                caption: caption || ''
            });

            await decrementPlanCounter(sessionId, pool);

            console.log(`[API-REST] ✅ Video enviado a ${to}`);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                to: jid
            });
        } catch (error) {
            console.error('[API-REST] Error enviando video:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // POST /api/rest/send/audio - Enviar audio
    // ==========================================
    app.post('/api/rest/send/audio', async (req, res) => {
        console.log('[API-REST] POST /send/audio');

        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { to, audio, mimetype } = req.body;

        if (!to || !audio) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros: to, audio' });
        }

        const planCheck = await checkPlanLimit(sessionId, pool);
        if (!planCheck.success) {
            return res.status(planCheck.status).json({ success: false, error: planCheck.error });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

            const sentMsg = await session.sock.sendMessage(jid, {
                audio: { url: audio },
                mimetype: mimetype || 'audio/mpeg'
            });

            await decrementPlanCounter(sessionId, pool);

            console.log(`[API-REST] ✅ Audio enviado a ${to}`);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                to: jid
            });
        } catch (error) {
            console.error('[API-REST] Error enviando audio:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // POST /api/rest/send/document - Enviar documento
    // ==========================================
    app.post('/api/rest/send/document', async (req, res) => {
        console.log('[API-REST] POST /send/document');

        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { to, document, filename, mimetype, caption } = req.body;

        if (!to || !document) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros: to, document' });
        }

        const planCheck = await checkPlanLimit(sessionId, pool);
        if (!planCheck.success) {
            return res.status(planCheck.status).json({ success: false, error: planCheck.error });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

            const sentMsg = await session.sock.sendMessage(jid, {
                document: { url: document },
                mimetype: mimetype || 'application/pdf',
                fileName: filename || 'documento.pdf',
                caption: caption || ''
            });

            await decrementPlanCounter(sessionId, pool);

            console.log(`[API-REST] ✅ Documento enviado a ${to}`);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                to: jid
            });
        } catch (error) {
            console.error('[API-REST] Error enviando documento:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // POST /api/rest/send/file - Enviar archivo (UPLOAD)
    // ==========================================
    app.post('/api/rest/send/file', upload.single('file'), async (req, res) => {
        console.log('[API-REST] POST /send/file (upload)');

        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { to, caption } = req.body;
        const file = req.file;

        if (!to || !file) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros: to, file' });
        }

        const planCheck = await checkPlanLimit(sessionId, pool);
        if (!planCheck.success) {
            return res.status(planCheck.status).json({ success: false, error: planCheck.error });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
            const filePath = file.path;
            const mimeType = file.mimetype;

            let messagePayload;

            // Determinar tipo de mensaje según mimetype
            if (mimeType.startsWith('image/')) {
                messagePayload = {
                    image: { url: filePath },
                    caption: caption || ''
                };
            } else if (mimeType.startsWith('video/')) {
                messagePayload = {
                    video: { url: filePath },
                    caption: caption || ''
                };
            } else if (mimeType.startsWith('audio/')) {
                messagePayload = {
                    audio: { url: filePath },
                    mimetype: mimeType
                };
            } else {
                messagePayload = {
                    document: { url: filePath },
                    mimetype: mimeType,
                    fileName: file.originalname,
                    caption: caption || ''
                };
            }

            const sentMsg = await session.sock.sendMessage(jid, messagePayload);

            await decrementPlanCounter(sessionId, pool);

            console.log(`[API-REST] ✅ Archivo ${file.originalname} enviado a ${to}`);

            // Eliminar archivo después de enviar (opcional)
            setTimeout(() => {
                fs.unlink(filePath, (err) => {
                    if (err) console.error('[API-REST] Error eliminando archivo temporal:', err);
                });
            }, 5000);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                to: jid,
                filename: file.originalname,
                size: file.size
            });
        } catch (error) {
            console.error('[API-REST] Error enviando archivo:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // POST /api/rest/send/location - Enviar ubicación
    // ==========================================
    app.post('/api/rest/send/location', async (req, res) => {
        console.log('[API-REST] POST /send/location');

        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { to, latitude, longitude, name, address } = req.body;

        if (!to || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros: to, latitude, longitude' });
        }

        const planCheck = await checkPlanLimit(sessionId, pool);
        if (!planCheck.success) {
            return res.status(planCheck.status).json({ success: false, error: planCheck.error });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

            const sentMsg = await session.sock.sendMessage(jid, {
                location: {
                    degreesLatitude: parseFloat(latitude),
                    degreesLongitude: parseFloat(longitude),
                    name: name || '',
                    address: address || ''
                }
            });

            await decrementPlanCounter(sessionId, pool);

            console.log(`[API-REST] ✅ Ubicación enviada a ${to}`);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                to: jid
            });
        } catch (error) {
            console.error('[API-REST] Error enviando ubicación:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // POST /api/rest/send/contact - Enviar contacto (vCard)
    // ==========================================
    app.post('/api/rest/send/contact', async (req, res) => {
        console.log('[API-REST] POST /send/contact');

        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const to = req.body.to;
        // Soporte para ambos formatos (UI de prueba y API directa)
        const contact = req.body.contact || {
            fullName: req.body.contactName,
            phoneNumber: req.body.phoneNumber || req.body.vcard?.match(/TEL;.*:(.*)/)?.[1]
        };

        if (!to || !contact || !contact.fullName || !contact.phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Faltan parámetros: to, contact.fullName, contact.phoneNumber (o contactName y phoneNumber/vcard)'
            });
        }

        const planCheck = await checkPlanLimit(sessionId, pool);
        if (!planCheck.success) {
            return res.status(planCheck.status).json({ success: false, error: planCheck.error });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

            // Crear vCard
            const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${contact.fullName}
TEL;type=CELL;type=VOICE;waid=${contact.phoneNumber.replace(/\D/g, '')}:${contact.phoneNumber}
${contact.organization ? `ORG:${contact.organization}` : ''}
END:VCARD`;

            const sentMsg = await session.sock.sendMessage(jid, {
                contacts: {
                    displayName: contact.fullName,
                    contacts: [{ vcard }]
                }
            });

            await decrementPlanCounter(sessionId, pool);

            console.log(`[API-REST] ✅ Contacto enviado a ${to}`);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                to: jid
            });
        } catch (error) {
            console.error('[API-REST] Error enviando contacto:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // POST /api/rest/send/sticker - Enviar sticker
    // ==========================================
    app.post('/api/rest/send/sticker', async (req, res) => {
        console.log('[API-REST] POST /send/sticker');

        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { to, sticker } = req.body;

        if (!to || !sticker) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros: to, sticker (URL)' });
        }

        const planCheck = await checkPlanLimit(sessionId, pool);
        if (!planCheck.success) {
            return res.status(planCheck.status).json({ success: false, error: planCheck.error });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

            const sentMsg = await session.sock.sendMessage(jid, {
                sticker: { url: sticker }
            });

            await decrementPlanCounter(sessionId, pool);

            console.log(`[API-REST] ✅ Sticker enviado a ${to}`);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                to: jid
            });
        } catch (error) {
            console.error('[API-REST] Error enviando sticker:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // POST /api/rest/send/buttons - Enviar mensaje con botones
    // ==========================================
    app.post('/api/rest/send/buttons', async (req, res) => {
        console.log('[API-REST] POST /send/buttons');

        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const to = req.body.to;
        const body = req.body.text || req.body.body || req.body.message;
        const { footer, buttons } = req.body;

        if (!to || !body || !buttons || !Array.isArray(buttons)) {
            return res.status(400).json({
                success: false,
                error: 'Faltan parámetros: to, text (o body), buttons (array)'
            });
        }

        const planCheck = await checkPlanLimit(sessionId, pool);
        if (!planCheck.success) {
            return res.status(planCheck.status).json({ success: false, error: planCheck.error });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

            // Formatear botones para Baileys
            const formattedButtons = buttons.slice(0, 3).map((btn, index) => ({
                buttonId: btn.id || `btn_${index}`,
                buttonText: { displayText: btn.text },
                type: 1
            }));

            const sentMsg = await session.sock.sendMessage(jid, {
                text: body,
                footer: footer || '',
                buttons: formattedButtons,
                headerType: 1
            });

            await decrementPlanCounter(sessionId, pool);

            console.log(`[API-REST] ✅ Mensaje con botones enviado a ${to}`);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                to: jid
            });
        } catch (error) {
            console.error('[API-REST] Error enviando botones:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // POST /api/rest/send/list - Enviar mensaje con lista
    // ==========================================
    app.post('/api/rest/send/list', async (req, res) => {
        console.log('[API-REST] POST /send/list');

        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const to = req.body.to;
        const body = req.body.text || req.body.body || req.body.message;
        const { buttonText, sections, title, footer } = req.body;

        if (!to || !body || !buttonText || !sections || !Array.isArray(sections)) {
            return res.status(400).json({
                success: false,
                error: 'Faltan parámetros: to, text (o body), buttonText, sections (array)'
            });
        }

        const planCheck = await checkPlanLimit(sessionId, pool);
        if (!planCheck.success) {
            return res.status(planCheck.status).json({ success: false, error: planCheck.error });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

            // Formatear secciones para Baileys
            const formattedSections = sections.map(section => ({
                title: section.title || '',
                rows: (section.rows || []).map((row, idx) => ({
                    rowId: row.id || `row_${idx}`,
                    title: row.title,
                    description: row.description || ''
                }))
            }));

            const sentMsg = await session.sock.sendMessage(jid, {
                text: body,
                footer: footer || '',
                title: title || '',
                buttonText: buttonText,
                sections: formattedSections
            });

            await decrementPlanCounter(sessionId, pool);

            console.log(`[API-REST] ✅ Mensaje con lista enviado a ${to}`);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                to: jid
            });
        } catch (error) {
            console.error('[API-REST] Error enviando lista:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // POST /api/rest/send/template - Enviar template guardado
    // ==========================================
    app.post('/api/rest/send/template', async (req, res) => {
        console.log('[API-REST] POST /send/template');

        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { to, templateId, variables } = req.body;

        if (!to || !templateId) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros: to, templateId' });
        }

        const planCheck = await checkPlanLimit(sessionId, pool);
        if (!planCheck.success) {
            return res.status(planCheck.status).json({ success: false, error: planCheck.error });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            // Obtener template de la BD
            const [templates] = await pool.execute(
                'SELECT * FROM message_templates WHERE id = ? AND session_id = ?',
                [templateId, sessionId]
            );

            if (templates.length === 0) {
                return res.status(404).json({ success: false, error: 'Template no encontrado' });
            }

            const template = templates[0];
            let message = template.content || template.message;

            // Reemplazar variables
            if (variables && typeof variables === 'object') {
                for (const [key, value] of Object.entries(variables)) {
                    message = message.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
                }
            }

            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

            const sentMsg = await session.sock.sendMessage(jid, { text: message });

            await decrementPlanCounter(sessionId, pool);

            console.log(`[API-REST] ✅ Template ${templateId} enviado a ${to}`);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                to: jid,
                templateId: templateId
            });
        } catch (error) {
            console.error('[API-REST] Error enviando template:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // GET /api/rest/status/:sessionId - Estado de conexión
    // ==========================================
    app.get('/api/rest/status/:sessionId', async (req, res) => {
        console.log('[API-REST] GET /status');

        const auth = await authenticateAPIKey(req, res, pool);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = req.params.sessionId || auth.apiKeyData.session_id;
        const session = sessions.get(sessionId);

        if (!session) {
            return res.json({
                success: true,
                connected: false,
                sessionId: sessionId
            });
        }

        return res.json({
            success: true,
            connected: session.isConnected || false,
            sessionId: sessionId,
            phoneNumber: session.sock?.user?.id || null
        });
    });

    console.log('[API-REST] ✅ Endpoints registrados');
}

module.exports = { registerAPIRestEndpoints };
