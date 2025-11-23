/**
 * API Routes for PWA Device Management and Status Publishing
 * Handles device registration, status synchronization, and confirmations
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

module.exports = (app, io) => {
    const getPool = () => app.get('pool');
    const sessions = app.get('sessions');

    /**
     * POST /api/pwa/register
     * Registra un nuevo dispositivo PWA
     */
    router.post('/register', async (req, res) => {
        try {
            const { sessionId, deviceName, deviceModel, osVersion, appVersion } = req.body;

            if (!sessionId) {
                return res.status(400).json({ success: false, error: 'sessionId es requerido' });
            }

            // Generar token único para el dispositivo
            const deviceToken = crypto.randomBytes(32).toString('hex');

            // Insertar dispositivo en BD
            const [result] = await getPool().execute(
                `INSERT INTO pwa_devices 
                (session_id, device_token, device_name, device_model, os_version, app_version)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [sessionId, deviceToken, deviceName, deviceModel, osVersion, appVersion || '1.0.0']
            );

            console.log(`✅ [PWA] Dispositivo registrado: ${deviceName} (${deviceModel}) para sesión ${sessionId}`);

            // Notificar al dashboard
            io.to(`session-${sessionId}`).emit('pwa:registered', {
                deviceId: result.insertId,
                deviceName,
                deviceModel
            });

            res.json({
                success: true,
                deviceId: result.insertId,
                deviceToken,
                message: 'Dispositivo registrado exitosamente'
            });
        } catch (error) {
            console.error('❌ [PWA] Error registrando dispositivo:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * GET /api/pwa/statuses/pending
     * Obtiene estados pendientes para publicar
     */
    router.get('/statuses/pending', async (req, res) => {
        try {
            const deviceToken = req.headers['authorization']?.replace('Bearer ', '');

            if (!deviceToken) {
                return res.status(401).json({ success: false, error: 'Token de autenticación requerido' });
            }

            // Verificar dispositivo
            const [devices] = await getPool().execute(
                'SELECT * FROM pwa_devices WHERE device_token = ? AND is_active = 1',
                [deviceToken]
            );

            if (devices.length === 0) {
                return res.status(401).json({ success: false, error: 'Dispositivo no autorizado' });
            }

            const device = devices[0];

            // Obtener estados pendientes
            const [statuses] = await getPool().execute(
                `SELECT * FROM whatsapp_statuses 
                WHERE session_id = ? 
                AND publish_method = 'pwa'
                AND status IN ('pending', 'scheduled')
                AND (scheduled_time IS NULL OR scheduled_time <= NOW())
                ORDER BY created_at ASC
                LIMIT 50`,
                [device.session_id]
            );

            // Actualizar last_seen del dispositivo
            await getPool().execute(
                'UPDATE pwa_devices SET last_seen = NOW() WHERE id = ?',
                [device.id]
            );

            res.json({
                success: true,
                statuses: statuses.map(s => ({
                    id: s.id,
                    type: s.media_type,
                    content: s.text_content,
                    mediaUrl: s.media_url ? `${req.protocol}://${req.get('host')}${s.media_url}` : null,
                    scheduledTime: s.scheduled_time,
                    createdAt: s.created_at
                }))
            });
        } catch (error) {
            console.error('❌ [PWA] Error obteniendo estados pendientes:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * POST /api/pwa/statuses/:id/confirm
     * Confirma la publicación exitosa de un estado
     */
    router.post('/statuses/:id/confirm', async (req, res) => {
        try {
            const { id } = req.params;
            const deviceToken = req.headers['authorization']?.replace('Bearer ', '');
            const { publishedAt, error } = req.body;

            if (!deviceToken) {
                return res.status(401).json({ success: false, error: 'Token de autenticación requerido' });
            }

            // Verificar dispositivo
            const [devices] = await getPool().execute(
                'SELECT * FROM pwa_devices WHERE device_token = ? AND is_active = 1',
                [deviceToken]
            );

            if (devices.length === 0) {
                return res.status(401).json({ success: false, error: 'Dispositivo no autorizado' });
            }

            const device = devices[0];

            if (error) {
                // Publicación fallida
                await getPool().execute(
                    `UPDATE whatsapp_statuses 
                    SET publication_attempts = publication_attempts + 1,
                        last_attempt_at = NOW(),
                        error_message = ?
                    WHERE id = ? AND session_id = ?`,
                    [error, id, device.session_id]
                );

                console.log(`⚠️ [PWA] Error publicando estado ${id}: ${error}`);
            } else {
                // Publicación exitosa
                await getPool().execute(
                    `UPDATE whatsapp_statuses 
                    SET status = 'published',
                        published_at = ?,
                        pwa_device_id = ?
                    WHERE id = ? AND session_id = ?`,
                    [publishedAt || new Date(), device.id, id, device.session_id]
                );

                console.log(`✅ [PWA] Estado ${id} publicado exitosamente desde dispositivo ${device.device_name}`);

                // Notificar al dashboard
                io.to(`session-${device.session_id}`).emit('status:published', {
                    statusId: id,
                    publishedAt: publishedAt || new Date(),
                    deviceName: device.device_name
                });
            }

            res.json({ success: true, message: 'Confirmación procesada' });
        } catch (error) {
            console.error('❌ [PWA] Error confirmando publicación:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * GET /api/pwa/devices/:sessionId
     * Lista dispositivos PWA registrados para una sesión
     */
    router.get('/devices/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;

            const [devices] = await getPool().execute(
                `SELECT id, device_name, device_model, os_version, app_version, 
                        last_seen, is_active, created_at
                FROM pwa_devices 
                WHERE session_id = ?
                ORDER BY created_at DESC`,
                [sessionId]
            );

            res.json({ success: true, devices });
        } catch (error) {
            console.error('❌ [PWA] Error listando dispositivos:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * DELETE /api/pwa/devices/:deviceId
     * Desactiva un dispositivo PWA
     */
    router.delete('/devices/:deviceId', async (req, res) => {
        try {
            const { deviceId } = req.params;

            await getPool().execute(
                'UPDATE pwa_devices SET is_active = 0 WHERE id = ?',
                [deviceId]
            );

            console.log(`🗑️ [PWA] Dispositivo ${deviceId} desactivado`);

            res.json({ success: true, message: 'Dispositivo desactivado' });
        } catch (error) {
            console.error('❌ [PWA] Error desactivando dispositivo:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== WebSocket Events ====================

    io.on('connection', (socket) => {
        // PWA se conecta
        socket.on('pwa:connect', async (data) => {
            const { deviceToken } = data;

            try {
                const [devices] = await getPool().execute(
                    'SELECT * FROM pwa_devices WHERE device_token = ? AND is_active = 1',
                    [deviceToken]
                );

                if (devices.length > 0) {
                    const device = devices[0];
                    socket.join(`pwa-${device.session_id}`);

                    // Actualizar last_seen
                    await getPool().execute(
                        'UPDATE pwa_devices SET last_seen = NOW() WHERE id = ?',
                        [device.id]
                    );

                    console.log(`📱 [PWA] Dispositivo ${device.device_name} conectado vía WebSocket`);

                    // Notificar al dashboard
                    io.to(`session-${device.session_id}`).emit('pwa:connected', {
                        deviceId: device.id,
                        deviceName: device.device_name
                    });

                    socket.emit('pwa:connected', { success: true });
                }
            } catch (error) {
                console.error('❌ [PWA] Error en conexión WebSocket:', error);
            }
        });

        // PWA reporta su estado
        socket.on('pwa:status', (data) => {
            console.log(`📊 [PWA] Estado del dispositivo:`, data);
        });
    });

    return router;
};
