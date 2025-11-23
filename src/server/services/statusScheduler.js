/**
 * Servicio de Scheduler para Estados de WhatsApp
 * Publica estados automáticamente según programación
 */

const cron = require('node-cron');

class StatusScheduler {
    constructor(pool, sessions, io) {
        this.pool = pool;
        this.sessions = sessions;
        this.io = io;
        this.isRunning = false;
        this.cronJob = null;
    }

    /**
     * Inicia el scheduler
     */
    start() {
        if (this.isRunning) {
            console.log('[STATUS-SCHEDULER] Ya está en ejecución');
            return;
        }

        // Ejecutar cada minuto
        this.cronJob = cron.schedule('* * * * *', async () => {
            await this.checkAndPublishStatuses();
        });

        this.isRunning = true;
        console.log('✅ [STATUS-SCHEDULER] Iniciado - verificando cada minuto');
    }

    /**
     * Detiene el scheduler
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.isRunning = false;
            console.log('[STATUS-SCHEDULER] Detenido');
        }
    }

    /**
     * Verifica y publica estados programados
     */
    async checkAndPublishStatuses() {
        if (!this.pool) {
            return;
        }

        try {
            // Buscar schedules activos que deben publicar ahora
            const [schedules] = await this.pool.query(
                `SELECT * FROM status_schedules 
         WHERE is_active = TRUE 
         AND next_publish_at <= NOW()
         ORDER BY next_publish_at ASC`
            );

            if (schedules.length === 0) {
                return;
            }

            console.log(`[STATUS-SCHEDULER] 📅 ${schedules.length} programaciones pendientes`);

            for (const schedule of schedules) {
                await this.publishNextStatus(schedule);
            }
        } catch (error) {
            console.error('[STATUS-SCHEDULER] Error verificando programaciones:', error);
        }
    }

    /**
     * Publica el siguiente estado en la rotación
     */
    async publishNextStatus(schedule) {
        try {
            console.log(`[STATUS-SCHEDULER] 📱 Procesando programación: ${schedule.name} (ID: ${schedule.id})`);

            // Obtener items de la programación
            const [items] = await this.pool.query(
                `SELECT si.*, ws.* 
         FROM status_schedule_items si
         JOIN whatsapp_statuses ws ON si.status_id = ws.id
         WHERE si.schedule_id = ?
         ORDER BY si.order_index ASC`,
                [schedule.id]
            );

            if (items.length === 0) {
                console.log(`[STATUS-SCHEDULER] ⚠️ No hay estados en la programación ${schedule.id}`);
                return;
            }

            // Obtener el índice actual (rotación circular)
            const currentIndex = schedule.current_index || 0;
            const statusToPublish = items[currentIndex];

            console.log(`[STATUS-SCHEDULER] 📤 Publicando estado ${currentIndex + 1}/${items.length}: "${statusToPublish.text_content?.substring(0, 50) || 'Sin texto'}..."`);

            // Publicar el estado en WhatsApp
            const published = await this.publishToWhatsApp(
                schedule.session_id,
                statusToPublish
            );

            if (published) {
                // Actualizar estado a 'published'
                const publishedAt = new Date();
                const expiresAt = new Date(publishedAt.getTime() + 24 * 60 * 60 * 1000); // 24 horas

                await this.pool.query(
                    `UPDATE whatsapp_statuses 
           SET status = 'published', published_at = ?, expires_at = ? 
           WHERE id = ?`,
                    [publishedAt, expiresAt, statusToPublish.id]
                );

                // Actualizar contador de veces publicado
                await this.pool.query(
                    `UPDATE status_schedule_items 
           SET times_published = times_published + 1, last_published_at = NOW()
           WHERE id = ?`,
                    [statusToPublish.id]
                );

                // Calcular siguiente índice (rotación circular)
                const nextIndex = (currentIndex + 1) % items.length;

                // Calcular próxima publicación
                const nextPublishAt = new Date(Date.now() + schedule.interval_minutes * 60 * 1000);

                // Actualizar programación
                await this.pool.query(
                    `UPDATE status_schedules 
           SET current_index = ?, 
               last_published_at = NOW(), 
               next_publish_at = ?,
               total_published = total_published + 1
           WHERE id = ?`,
                    [nextIndex, nextPublishAt, schedule.id]
                );

                // Verificar si debe desactivarse por rotación de 30 días
                await this.checkRotationExpiry(schedule);

                // Emitir evento Socket.IO para notificar al frontend
                this.io.emit(`status-published-${schedule.session_id}`, {
                    scheduleId: schedule.id,
                    statusId: statusToPublish.id,
                    publishedAt,
                    nextPublishAt,
                    currentIndex: nextIndex,
                    totalItems: items.length
                });

                console.log(`[STATUS-SCHEDULER] ✅ Estado publicado exitosamente. Próximo: ${nextPublishAt.toLocaleString()}`);
            } else {
                // Marcar como fallido
                await this.pool.query(
                    `UPDATE whatsapp_statuses 
           SET status = 'failed', error_message = 'Error al publicar en WhatsApp' 
           WHERE id = ?`,
                    [statusToPublish.id]
                );

                console.log(`[STATUS-SCHEDULER] ❌ Error publicando estado ${statusToPublish.id}`);
            }
        } catch (error) {
            console.error(`[STATUS-SCHEDULER] Error publicando estado:`, error);
        }
    }

    /**
     * Publica un estado en WhatsApp
     */
    async publishToWhatsApp(sessionId, status) {
        try {
            // Buscar sesión activa
            const session = this.sessions.get(sessionId);

            if (!session || !session.sock || !session.isConnected) {
                console.log(`[STATUS-SCHEDULER] ⚠️ Sesión ${sessionId} no conectada`);
                return false;
            }

            const sock = session.sock;

            // Preparar contenido del estado
            let statusContent = {};

            if (status.media_url && status.media_type !== 'text') {
                // Estado con imagen o video
                const path = require('path');
                const fs = require('fs');
                const mediaPath = path.join(__dirname, '..', 'routes', 'public', status.media_url);

                if (!fs.existsSync(mediaPath)) {
                    console.log(`[STATUS-SCHEDULER] ⚠️ Archivo multimedia no encontrado: ${mediaPath}`);
                    return false;
                }

                const mediaBuffer = fs.readFileSync(mediaPath);

                statusContent = {
                    [status.media_type]: mediaBuffer,
                    caption: status.text_content || ''
                };
            } else {
                // Estado solo texto
                statusContent = {
                    text: status.text_content || '📱 Estado de WhatsFlow'
                };
            }

            // Publicar estado usando la API de Baileys
            console.log(`[STATUS-SCHEDULER] 📤 Enviando estado a WhatsApp...`);
            await sock.sendMessage('status@broadcast', statusContent);

            console.log(`[STATUS-SCHEDULER] ✅ Estado publicado exitosamente en WhatsApp:`, {
                sessionId,
                type: status.media_type,
                hasMedia: !!status.media_url,
                textPreview: status.text_content?.substring(0, 30)
            });

            return true;
        } catch (error) {
            console.error(`[STATUS-SCHEDULER] ❌ Error publicando en WhatsApp:`, error);
            return false;
        }
    }

    /**
     * Verifica si una programación debe desactivarse por rotación de 30 días
     */
    async checkRotationExpiry(schedule) {
        try {
            if (!schedule.rotation_days) {
                return;
            }

            const [result] = await this.pool.query(
                `SELECT DATEDIFF(NOW(), created_at) as days_running 
         FROM status_schedules 
         WHERE id = ?`,
                [schedule.id]
            );

            if (result.length > 0 && result[0].days_running >= schedule.rotation_days) {
                // Desactivar programación
                await this.pool.query(
                    `UPDATE status_schedules SET is_active = FALSE WHERE id = ?`,
                    [schedule.id]
                );

                console.log(`[STATUS-SCHEDULER] 🔄 Programación ${schedule.id} desactivada por rotación de ${schedule.rotation_days} días`);

                // Notificar al frontend
                this.io.emit(`schedule-expired-${schedule.session_id}`, {
                    scheduleId: schedule.id,
                    name: schedule.name,
                    reason: `Rotación de ${schedule.rotation_days} días completada`
                });
            }
        } catch (error) {
            console.error(`[STATUS-SCHEDULER] Error verificando expiración:`, error);
        }
    }

    /**
     * Limpia estados expirados (más de 24 horas)
     */
    async cleanExpiredStatuses() {
        try {
            const [result] = await this.pool.query(
                `UPDATE whatsapp_statuses 
         SET status = 'expired' 
         WHERE status = 'published' 
         AND expires_at < NOW()`
            );

            if (result.affectedRows > 0) {
                console.log(`[STATUS-SCHEDULER] 🧹 ${result.affectedRows} estados expirados marcados`);
            }
        } catch (error) {
            console.error(`[STATUS-SCHEDULER] Error limpiando estados expirados:`, error);
        }
    }
}

module.exports = StatusScheduler;
