/**
 * Endpoints para gestión de Estados de WhatsApp
 * Sistema de programación automática y rotación de estados
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'status-media');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `status-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF, WebP) y videos (MP4)'));
        }
    }
});

module.exports = (app, io) => {

    // Helper para obtener pool de forma lazy
    const getPool = () => {
        const pool = app.get('pool');
        if (!pool) {
            throw new Error('Base de datos no disponible');
        }
        return pool;
    };

    // Resolver sessionId cuando viene como owner_phone_number (hex) o phone (numérico)
    const resolveSessionId = async (rawId) => {
        if (!rawId) return rawId;
        try {
            // Si parece un owner_phone_number (16 hex)
            if (typeof rawId === 'string' && rawId.length === 16 && /^[a-f0-9]{16}$/i.test(rawId)) {
                const [rows] = await getPool().query(
                    'SELECT session_id FROM user_sessions WHERE owner_phone_number = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1',
                    [rawId]
                );
                if (rows.length > 0 && rows[0].session_id) {
                    console.log(`[STATUSES] 🔄 owner_phone_number ${rawId} → session_id ${rows[0].session_id}`);
                    return rows[0].session_id;
                }
            }

            // Si parece un número de teléfono, mapear a session_id
            if (/^\d{6,}$/.test(String(rawId))) {
                const [rows] = await getPool().query(
                    'SELECT session_id FROM user_sessions WHERE phone = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1',
                    [String(rawId)]
                );
                if (rows.length > 0 && rows[0].session_id) {
                    console.log(`[STATUSES] 🔄 phone ${rawId} → session_id ${rows[0].session_id}`);
                    return rows[0].session_id;
                }
            }

            // Si ya es un session_id válido, devolverlo tal cual
            return rawId;
        } catch (err) {
            console.warn('[STATUSES] ⚠️ Error resolviendo sessionId:', err.message);
            return rawId;
        }
    };

    // ==================== CREAR ESTADO ====================
    /**
     * POST /api/statuses/create
     * Crea un nuevo estado de WhatsApp
     */
    router.post('/create', upload.single('mediaFile'), async (req, res) => {
        try {
            const pool = getPool();
            const { sessionId: rawSessionId, textContent, backgroundColor, fontStyle } = req.body;
            const sessionId = await resolveSessionId(rawSessionId);

            if (!sessionId) {
                return res.status(400).json({ success: false, error: 'sessionId es requerido' });
            }

            let mediaUrl = null;
            let mediaType = 'text';

            if (req.file) {
                mediaUrl = `/status-media/${req.file.filename}`;
                mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
            }

            const [result] = await getPool().query(
                `INSERT INTO whatsapp_statuses 
        (phone_number, text_content, media_url, media_type, background_color, font_style, status) 
        VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
                [sessionId, textContent || null, mediaUrl, mediaType, backgroundColor || '#075E54', fontStyle || 'default']
            );

            res.json({
                success: true,
                statusId: result.insertId,
                message: 'Estado creado exitosamente'
            });
        } catch (error) {
            console.error('Error creando estado:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== LISTAR ESTADOS ====================
    /**
     * GET /api/statuses/:sessionId
     * Obtiene todos los estados y programaciones de una sesión
     */
    router.get('/:sessionId', async (req, res) => {
        try {
            const pool = getPool();
            const { sessionId: rawSessionId } = req.params;
            const sessionId = await resolveSessionId(rawSessionId);
            const { status } = req.query;

            let statusQuery = `
        SELECT * FROM whatsapp_statuses 
        WHERE phone_number = ?
      `;
            const params = [sessionId];

            if (status) {
                statusQuery += ` AND status = ?`;
                params.push(status);
            }

            statusQuery += ` ORDER BY created_at DESC`;

            const [statuses] = await getPool().query(statusQuery, params);

            // Obtener programaciones activas (sin total_items ya que la tabla no existe)
            const [schedules] = await getPool().query(
                `SELECT s.*
         FROM status_schedules s
         WHERE s.session_id = ?
         ORDER BY s.created_at DESC`,
                [sessionId]
            );

            // Para cada schedule, obtener sus items
            for (let schedule of schedules) {
                const [items] = await getPool().query(
                    `SELECT si.*, ws.text_content, ws.media_url, ws.media_type 
           FROM status_schedule_items si
           JOIN whatsapp_statuses ws ON si.status_id = ws.id
           WHERE si.schedule_id = ?
           ORDER BY si.order_index ASC`,
                    [schedule.id]
                );
                schedule.items = items;
            }

            // Obtener historial de estados publicados (últimos 30)
            const [history] = await getPool().query(
                `SELECT * FROM whatsapp_statuses 
         WHERE phone_number = ? AND status = 'published'
         ORDER BY published_at DESC
         LIMIT 30`,
                [sessionId]
            );

            res.json({
                success: true,
                statuses,
                schedules,
                history
            });
        } catch (error) {
            console.error('Error obteniendo estados:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== ACTUALIZAR ESTADO ====================
    /**
     * PUT /api/statuses/:id
     * Actualiza un estado existente
     */
    router.put('/:id', upload.single('mediaFile'), async (req, res) => {
        try {
            const { id } = req.params;
            const { textContent, backgroundColor, fontStyle } = req.body;

            let updateFields = [];
            let updateValues = [];

            if (textContent !== undefined) {
                updateFields.push('text_content = ?');
                updateValues.push(textContent);
            }

            if (backgroundColor) {
                updateFields.push('background_color = ?');
                updateValues.push(backgroundColor);
            }

            if (fontStyle) {
                updateFields.push('font_style = ?');
                updateValues.push(fontStyle);
            }

            if (req.file) {
                const mediaUrl = `/status-media/${req.file.filename}`;
                const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
                updateFields.push('media_url = ?', 'media_type = ?');
                updateValues.push(mediaUrl, mediaType);
            }

            if (updateFields.length === 0) {
                return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
            }

            updateValues.push(id);

            await getPool().query(
                `UPDATE whatsapp_statuses SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );

            res.json({ success: true, message: 'Estado actualizado exitosamente' });
        } catch (error) {
            console.error('Error actualizando estado:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== ELIMINAR ESTADO ====================
    /**
     * DELETE /api/statuses/:id
     * Elimina un estado
     */
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;

            // Obtener info del estado para eliminar archivo multimedia
            const [status] = await getPool().query('SELECT media_url FROM whatsapp_statuses WHERE id = ?', [id]);

            if (status.length > 0 && status[0].media_url) {
                const filePath = path.join(__dirname, 'public', status[0].media_url);
                try {
                    await fs.unlink(filePath);
                } catch (err) {
                    console.warn('No se pudo eliminar archivo multimedia:', err.message);
                }
            }

            await getPool().query('DELETE FROM whatsapp_statuses WHERE id = ?', [id]);

            res.json({ success: true, message: 'Estado eliminado exitosamente' });
        } catch (error) {
            console.error('Error eliminando estado:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== CREAR PROGRAMACIÓN ====================
    /**
     * POST /api/statuses/schedule/create
     * Crea una nueva programación de estados
     */
    router.post('/schedule/create', async (req, res) => {
        try {
            const { sessionId: rawSessionId, name, statusIds, intervalMinutes, rotationDays } = req.body;
            const sessionId = await resolveSessionId(rawSessionId);

            if (!sessionId || !name || !statusIds || !Array.isArray(statusIds) || statusIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'sessionId, name y statusIds (array) son requeridos'
                });
            }

            // Calcular próxima publicación
            const nextPublishAt = new Date(Date.now() + (intervalMinutes || 60) * 60 * 1000);

            const [result] = await getPool().query(
                `INSERT INTO status_schedules 
        (session_id, name, interval_minutes, rotation_days, is_active, next_publish_at) 
        VALUES (?, ?, ?, ?, TRUE, ?)`,
                [sessionId, name, intervalMinutes || 60, rotationDays || 30, nextPublishAt]
            );

            const scheduleId = result.insertId;

            // Insertar items de la programación
            for (let i = 0; i < statusIds.length; i++) {
                await getPool().query(
                    `INSERT INTO status_schedule_items (schedule_id, status_id, order_index) 
           VALUES (?, ?, ?)`,
                    [scheduleId, statusIds[i], i]
                );

                // Actualizar estados a 'scheduled'
                await getPool().query(
                    `UPDATE whatsapp_statuses SET status = 'scheduled' WHERE id = ?`,
                    [statusIds[i]]
                );
            }

            res.json({
                success: true,
                scheduleId,
                message: `Programación creada con ${statusIds.length} estados`
            });
        } catch (error) {
            console.error('Error creando programación:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== ACTIVAR/DESACTIVAR PROGRAMACIÓN ====================
    /**
     * PUT /api/statuses/schedule/:id/toggle
     * Activa o desactiva una programación
     */
    router.put('/schedule/:id/toggle', async (req, res) => {
        try {
            const { id } = req.params;
            const { isActive } = req.body;

            await getPool().query(
                `UPDATE status_schedules SET is_active = ? WHERE id = ?`,
                [isActive, id]
            );

            res.json({
                success: true,
                message: `Programación ${isActive ? 'activada' : 'desactivada'}`
            });
        } catch (error) {
            console.error('Error actualizando programación:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== TEST ENDPOINT ====================
    router.get('/test', (req, res) => {
        console.log('🧪 [TEST-ENDPOINT] Router de estados funcionando correctamente');
        res.json({ success: true, message: 'Router de estados activo' });
    });

    // ==================== PUBLICAR ESTADO MANUALMENTE ====================
    /**
     * POST /api/statuses/publish/:id
     * Publica un estado inmediatamente en WhatsApp
     */
    router.post('/publish/:id', async (req, res) => {
        console.log(`🚀 [PUBLISH-ENDPOINT] Solicitud recibida para publicar estado`);
        console.log(`📋 [PUBLISH-ENDPOINT] ID: ${req.params.id}, SessionId: ${req.body.sessionId}`);

        try {
            const { id } = req.params;
            const { sessionId } = req.body;

            if (!sessionId) {
                console.log(`❌ [PUBLISH-ENDPOINT] sessionId no proporcionado`);
                return res.status(400).json({ success: false, error: 'sessionId es requerido' });
            }

            // Obtener el estado
            console.log(`🔍 [PUBLISH-ENDPOINT] Buscando estado ID ${id} en base de datos...`);
            const [statuses] = await getPool().query('SELECT * FROM whatsapp_statuses WHERE id = ?', [id]);

            if (statuses.length === 0) {
                console.log(`❌ [PUBLISH-ENDPOINT] Estado ${id} no encontrado`);
                return res.status(404).json({ success: false, error: 'Estado no encontrado' });
            }

            const status = statuses[0];
            console.log(`✅ [PUBLISH-ENDPOINT] Estado encontrado: ${status.text_content || 'multimedia'}`);

            // Obtener sesión de WhatsApp
            console.log(`🔍 [PUBLISH-ENDPOINT] Buscando sesión ${sessionId}...`);
            const sessions = app.get('sessions');
            if (!sessions) {
                console.log(`❌ [PUBLISH-ENDPOINT] Sistema de sesiones no disponible`);
                return res.status(500).json({ success: false, error: 'Sistema de sesiones no disponible' });
            }

            // Intentar obtener la sesión por sessionId y por phone_number como fallback
            let sessionKey = sessionId;
            let session = sessions.get(sessionKey);
            if (!session) {
                try {
                    const [rows] = await getPool().query(
                        'SELECT phone FROM user_sessions WHERE phone = ? OR session_id = ? LIMIT 1',
                        [sessionId, sessionId]
                    );
                    if (rows.length > 0 && rows[0].phone) {
                        const phoneNumber = rows[0].phone;
                        console.log(`ℹ️ [PUBLISH-ENDPOINT] Fallback por phoneNumber: ${phoneNumber}`);
                        if (sessions.has(phoneNumber)) {
                            sessionKey = phoneNumber;
                            session = sessions.get(phoneNumber);
                        }
                    }
                } catch (mapErr) {
                    console.warn(`⚠️ [PUBLISH-ENDPOINT] Error buscando mapeo phone_number/session_id:`, mapErr.message);
                }
            }
            console.log(`📊 [PUBLISH-ENDPOINT] Sesión encontrada:`, session ? 'SÍ' : 'NO');
            console.log(`📊 [PUBLISH-ENDPOINT] Sock disponible:`, session?.sock ? 'SÍ' : 'NO');
            console.log(`📊 [PUBLISH-ENDPOINT] isConnected:`, session?.isConnected);

            if (!session || !session.sock || !session.isConnected) {
                console.log(`❌ [PUBLISH-ENDPOINT] WhatsApp no conectado para sesión ${sessionId}`);
                return res.status(400).json({
                    success: false,
                    error: 'WhatsApp no está conectado. Por favor, conecta tu sesión primero.'
                });
            }

            const sock = session.sock;
            console.log(`✅ [PUBLISH-ENDPOINT] Sock obtenido, procediendo a publicar...`);

            // Preparar contenido del estado
            let statusContent = {};

            if (status.media_url && status.media_type !== 'text') {
                // Estado con imagen o video
                const path = require('path');
                const fs = require('fs');
                const safeRelative = (status.media_url || '').replace(/^\//, '');
                const mediaPath = path.join(__dirname, 'public', safeRelative);

                if (!fs.existsSync(mediaPath)) {
                    return res.status(404).json({
                        success: false,
                        error: 'Archivo multimedia no encontrado'
                    });
                }

                const mediaBuffer = fs.readFileSync(mediaPath);

                statusContent = {
                    [status.media_type]: mediaBuffer,
                    caption: status.text_content || ''
                };
            } else {
                // Estado solo texto - Estructura específica para estados
                statusContent = {
                    text: status.text_content || '📱 Estado de Winsap',
                    backgroundColor: status.background_color || '#315594', // Color azul por defecto
                    font: 1 // 1 = SERIF, 2 = NORICAN, 3 = BRYNDAN_WRITE, 4 = BEBASNEUE, 5 = OSWALD
                };
            }

            // Publicar estado en WhatsApp usando Baileys
            console.log(`📱 [DEBUG] Intentando publicar estado ${id} para sesión ${sessionId}`);


            let messageResult = null;
            try {
                // PASO 1: Inicializar el chat status@broadcast (recomendación de Baileys)
                console.log(`📱 [DEBUG] Inicializando chat status@broadcast...`);
                try {
                    await sock.sendMessage('status@broadcast', {});
                    console.log(`✅ [DEBUG] Chat status@broadcast inicializado`);
                } catch (initError) {
                    console.log(`⚠️ [DEBUG] No se pudo inicializar status@broadcast (puede ser normal):`, initError.message);
                }

                // PASO 2: Preparar contenido
                let messageContent;

                if (status.media_url && status.media_type !== 'text') {
                    // Estado con imagen o video - EXACTAMENTE como el ejemplo de Baileys
                    messageContent = statusContent;
                } else {
                    // Estado de texto - EXACTAMENTE como el ejemplo de Baileys
                    messageContent = {
                        text: status.text_content || '📱 Estado de Winsap'
                    };
                }

                console.log(`📦 [DEBUG] Enviando mensaje a status@broadcast...`);
                console.log(`📦 [DEBUG] Contenido:`, messageContent);

                // PASO 3: Enviar estado y capturar respuesta completa
                const result = await sock.sendMessage('status@broadcast', messageContent);
                messageResult = result;

                // PASO 4: Logging detallado de la respuesta
                console.log(`✅ [DEBUG] Resultado Baileys completo:`, JSON.stringify(result || {}, null, 2));

                if (result && result.key && result.key.id) {
                    console.log(`✅ [DEBUG] MessageID recibido: ${result.key.id}`);
                    console.log(`✅ [DEBUG] RemoteJid: ${result.key.remoteJid}`);
                    console.log(`✅ [DEBUG] Status: ${result.status || 'N/A'}`);
                } else {
                    console.log(`⚠️ [DEBUG] Respuesta sin messageID - posible bloqueo de WhatsApp`);
                    throw new Error('WhatsApp no confirmó publicación del estado');
                }

                if (!result || !result.key || !result.key.id) {
                    console.log(`❌ [DEBUG] Publicación no confirmada por Baileys (sin messageID)`);
                    return res.status(502).json({
                        success: false,
                        error: 'Publicación no confirmada por WhatsApp (sin messageID)',
                        result
                    });
                }
                console.log(`✅ Estado publicado exitosamente en WhatsApp`);
            } catch (baileysError) {
                console.error(`❌ [DEBUG] Error Baileys sendMessage:`, baileysError);
                throw baileysError;
            }

            // Actualizar estado a 'published'
            const publishedAt = new Date();
            const expiresAt = new Date(publishedAt.getTime() + 24 * 60 * 60 * 1000); // 24 horas

            await getPool().query(
                `UPDATE whatsapp_statuses 
         SET status = 'published', published_at = ?, expires_at = ? 
         WHERE id = ?`,
                [publishedAt, expiresAt, id]
            );

            res.json({
                success: true,
                message: 'Estado publicado exitosamente en WhatsApp',
                publishedAt,
                expiresAt,
                messageId: messageResult && messageResult.key ? messageResult.key.id : null,
                remoteJid: messageResult && messageResult.key ? messageResult.key.remoteJid : 'status@broadcast'
            });
        } catch (error) {
            console.error('❌ Error publicando estado:', error);
            await getPool().query(
                `UPDATE whatsapp_statuses SET status = 'failed', error_message = ? WHERE id = ?`,
                [error.message, req.params.id]
            );
            res.status(500).json({
                success: false,
                error: 'Error al publicar estado: ' + error.message
            });
        }
    });

    // ==================== ESTADÍSTICAS ====================
    /**
     * GET /api/statuses/stats/:sessionId
     * Obtiene estadísticas de estados
     */
    router.get('/stats/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;

            const [stats] = await getPool().query(
                `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(views_count) as total_views
         FROM whatsapp_statuses
         WHERE phone_number = ?`,
                [sessionId]
            );

            const [recentPublished] = await getPool().query(
                `SELECT * FROM whatsapp_statuses 
         WHERE phone_number = ? AND status = 'published'
         ORDER BY published_at DESC
         LIMIT 10`,
                [sessionId]
            );

            res.json({
                success: true,
                stats: stats[0],
                recentPublished
            });
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
};
