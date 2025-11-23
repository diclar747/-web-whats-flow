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

    // ==================== CREAR ESTADO ====================
    /**
     * POST /api/statuses/create
     * Crea un nuevo estado de WhatsApp
     */
    router.post('/create', upload.single('mediaFile'), async (req, res) => {
        try {
            const pool = getPool();
            const { sessionId, textContent, backgroundColor, fontStyle } = req.body;

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
        (session_id, text_content, media_url, media_type, background_color, font_style, status) 
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
            const { sessionId } = req.params;
            const { status } = req.query;

            let statusQuery = `
        SELECT * FROM whatsapp_statuses 
        WHERE session_id = ?
      `;
            const params = [sessionId];

            if (status) {
                statusQuery += ` AND status = ?`;
                params.push(status);
            }

            statusQuery += ` ORDER BY created_at DESC`;

            const [statuses] = await getPool().query(statusQuery, params);

            // Obtener programaciones activas
            const [schedules] = await getPool().query(
                `SELECT s.*, 
         (SELECT COUNT(*) FROM status_schedule_items WHERE schedule_id = s.id) as total_items
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
         WHERE session_id = ? AND status = 'published'
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
            const { sessionId, name, statusIds, intervalMinutes, rotationDays } = req.body;

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

    // ==================== PUBLICAR ESTADO MANUALMENTE ====================
    /**
     * POST /api/statuses/publish/:id
     * Publica un estado inmediatamente en WhatsApp
     */
    router.post('/publish/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { sessionId } = req.body;

            if (!sessionId) {
                return res.status(400).json({ success: false, error: 'sessionId es requerido' });
            }

            // Obtener el estado
            const [statuses] = await getPool().query('SELECT * FROM whatsapp_statuses WHERE id = ?', [id]);

            if (statuses.length === 0) {
                return res.status(404).json({ success: false, error: 'Estado no encontrado' });
            }

            const status = statuses[0];

            // TODO: Integrar con API de WhatsApp para publicar estado
            // Por ahora simulamos la publicación
            console.log(`📱 Publicando estado ${id} en WhatsApp para sesión ${sessionId}`);
            console.log(`Contenido: ${status.text_content || 'Sin texto'}`);
            console.log(`Media: ${status.media_url || 'Sin media'}`);

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
                message: 'Estado publicado exitosamente',
                publishedAt,
                expiresAt
            });
        } catch (error) {
            console.error('Error publicando estado:', error);
            await getPool().query(
                `UPDATE whatsapp_statuses SET status = 'failed', error_message = ? WHERE id = ?`,
                [error.message, req.params.id]
            );
            res.status(500).json({ success: false, error: error.message });
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
         WHERE session_id = ?`,
                [sessionId]
            );

            const [recentPublished] = await getPool().query(
                `SELECT * FROM whatsapp_statuses 
         WHERE session_id = ? AND status = 'published'
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
