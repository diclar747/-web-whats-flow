const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireSuperAdmin } = require('../auth-utils');
const { checkAdmin } = require('../middleware/subscriptionMiddleware');
const { sendPlanActivationMessage } = require('../utils/subscriptionNotification');

module.exports = function (app, pool) {
    // ============================================
    // ENDPOINTS PARA CLIENTES
    // ============================================

    // POST /api/plan-requests - Cliente solicita un plan
    app.post('/api/plan-requests', async (req, res) => {
        const { phone, planId } = req.body;

        console.log('[PLAN-REQUEST] Nueva solicitud:', { phone, planId });

        if (!phone || !planId) {
            return res.status(400).json({
                success: false,
                error: 'Teléfono y plan son requeridos'
            });
        }

        try {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                // Verificar que el plan existe
                const [plans] = await connection.execute(
                    'SELECT * FROM plans WHERE id = ?',
                    [planId]
                );

                if (plans.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({
                        success: false,
                        error: 'Plan no encontrado'
                    });
                }

                const plan = plans[0];

                // Verificar si ya tiene una solicitud pendiente
                const [existingRequests] = await connection.execute(
                    'SELECT id FROM plan_requests WHERE phone_number = ? AND status = "pending"',
                    [phone]
                );

                if (existingRequests.length > 0) {
                    await connection.rollback();
                    return res.status(409).json({
                        success: false,
                        error: 'Ya tienes una solicitud pendiente. Por favor espera la aprobación del administrador.'
                    });
                }

                // Crear la solicitud
                await connection.execute(`
                    INSERT INTO plan_requests
                    (phone_number, plan_id, plan_name, plan_price, duration_days, status)
                    VALUES (?, ?, ?, ?, ?, 'pending')
                `, [
                    phone,
                    plan.id,
                    plan.name,
                    plan.price,
                    30 // Por defecto 30 días
                ]);

                await connection.commit();

                // Enviar mensaje de WhatsApp al cliente confirmando la solicitud
                try {
                    const whatsappMessage = `🎉 *¡Gracias por tu solicitud!*\n\n` +
                        `Has solicitado el plan *${plan.name}* por un valor de *Gs. ${plan.price.toLocaleString()}*\n\n` +
                        `💳 *Instrucciones de Pago:*\n` +
                        `📌 Monto: Gs. ${plan.price.toLocaleString()}\n` +
                        `📌 Alias: *3626142*\n` +
                        `📌 Banco: *Banco UENO*\n\n` +
                        `📸 Una vez realizado el pago, guarda tu comprobante.\n\n` +
                        `⏳ Tu solicitud será verificada en breve y tu plan será activado.\n\n` +
                        `¡Gracias por confiar en nosotros! 🚀`;

                    // Usar la utilidad de carga de WhatsApp para enviar desde el admin
                    const { sendWhatsAppMessage } = require('../whatsapp-loader');
                    await sendWhatsAppMessage('session_595994854167', phone, whatsappMessage).catch(err => {
                        console.log('[PLAN-REQUEST] ⚠️ No se pudo enviar mensaje WhatsApp al cliente:', err.message);
                    });

                    console.log('[PLAN-REQUEST] ✅ Mensaje WhatsApp enviado al cliente:', phone);
                } catch (whatsappError) {
                    console.log('[PLAN-REQUEST] ⚠️ Error enviando WhatsApp:', whatsappError.message);
                    // No fallar la solicitud si el WhatsApp falla
                }

                res.json({
                    success: true,
                    message: 'Solicitud enviada exitosamente. El administrador la revisará pronto.',
                    paymentInfo: {
                        alias: '3626142',
                        bank: 'Banco UENO',
                        amount: plan.price,
                        planName: plan.name
                    }
                });

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[PLAN-REQUEST] Error creating request:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear solicitud'
            });
        }
    });

    // GET /api/plan-requests/my-request - Cliente consulta su solicitud
    app.get('/api/plan-requests/my-request', async (req, res) => {
        const phone = req.query.phone;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'Teléfono requerido'
            });
        }

        try {
            const connection = await pool.getConnection();
            try {
                const [requests] = await connection.execute(`
                    SELECT pr.*, p.name as plan_display_name, p.description as plan_description
                    FROM plan_requests pr
                    LEFT JOIN plans p ON pr.plan_id = p.id
                    WHERE pr.phone_number = ?
                    ORDER BY pr.requested_at DESC
                    LIMIT 1
                `, [phone]);

                if (requests.length === 0) {
                    return res.json({
                        success: true,
                        request: null
                    });
                }

                res.json({
                    success: true,
                    request: requests[0]
                });

            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[PLAN-REQUEST] Error fetching request:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener solicitud'
            });
        }
    });

    // ============================================
    // ENDPOINTS PARA ADMINISTRADORES
    // ============================================

    // GET /api/plan-requests - Admin obtiene todas las solicitudes
    app.get('/api/plan-requests', authenticateToken, requireSuperAdmin, async (req, res) => {
        const status = req.query.status; // 'pending', 'approved', 'rejected', o undefined para todas

        console.log('[PLAN-REQUEST] GET /api/plan-requests - status:', status);

        try {
            const connection = await pool.getConnection();
            try {
                let query = `
                    SELECT
                        pr.*,
                        p.name as plan_display_name,
                        p.description as plan_description,
                        p.max_agents,
                        p.max_sessions,
                        p.max_messages
                    FROM plan_requests pr
                    LEFT JOIN plans p ON pr.plan_id = p.id
                `;

                const params = [];

                if (status) {
                    query += ' WHERE pr.status = ?';
                    params.push(status);
                }

                query += ' ORDER BY pr.requested_at DESC';

                const [requests] = await connection.execute(query, params);

                console.log('[PLAN-REQUEST] Requests found:', requests.length);

                res.json({
                    success: true,
                    requests
                });

            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[PLAN-REQUEST] Error fetching requests:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener solicitudes'
            });
        }
    });

    // PUT /api/plan-requests/:id/approve - Admin aprueba una solicitud
    app.put('/api/plan-requests/:id/approve', authenticateToken, requireSuperAdmin, async (req, res) => {
        const { id } = req.params;
        const adminPhone = req.user?.phone || req.body?.adminPhone || '595994854167';

        console.log('[PLAN-REQUEST] Aprobando solicitud:', { id, adminPhone });

        try {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                // Obtener la solicitud
                const [requests] = await connection.execute(
                    'SELECT * FROM plan_requests WHERE id = ?',
                    [id]
                );

                if (requests.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({
                        success: false,
                        error: 'Solicitud no encontrada'
                    });
                }

                const request = requests[0];

                if (request.status !== 'pending') {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'Esta solicitud ya fue procesada'
                    });
                }

                // Marcar solicitud como aprobada
                await connection.execute(`
                    UPDATE plan_requests
                    SET status = 'approved',
                        reviewed_at = NOW(),
                        reviewed_by = ?
                    WHERE id = ?
                `, [adminPhone, id]);

                // Activar plan en user_sessions y users
                const startDate = new Date();
                const endDate = new Date(startDate.getTime() + request.duration_days * 24 * 60 * 60 * 1000);

                // 1. Actualizar user_sessions
                const [sessions] = await connection.execute(
                    'SELECT * FROM user_sessions WHERE phone = ?',
                    [request.phone_number]
                );

                if (sessions.length > 0) {
                    await connection.execute(`
                        UPDATE user_sessions
                        SET
                            subscription_plan = ?,
                            subscription_status = 'active',
                            subscription_start_date = ?,
                            subscription_end_date = ?,
                            subscription_days = ?
                        WHERE phone = ?
                    `, [request.plan_name, startDate, endDate, request.duration_days, request.phone_number]);
                    console.log('[PLAN-REQUEST] Plan activado en user_sessions para:', request.phone_number);
                } else {
                    await connection.execute(`
                        INSERT INTO user_sessions
                        (phone, session_id, subscription_plan, subscription_status, subscription_start_date, subscription_end_date, subscription_days, is_active)
                        VALUES (?, ?, ?, 'active', ?, ?, ?, 0)
                    `, [request.phone_number, `session_${request.phone_number}`, request.plan_name, startDate, endDate, request.duration_days]);
                }

                // 2. Actualizar tabla users (SINCRONIZACIÓN CRÍTICA)
                // Buscamos al usuario por su teléfono tanto en 'phone' como en 'admin_phone' (si es el admin quien solicitó para sí mismo)
                await connection.execute(`
                    UPDATE users 
                    SET 
                        subscription_plan = ?,
                        subscription_status = 'active',
                        subscription_start_date = ?,
                        subscription_end_date = ?,
                        subscription_days = ?,
                        plan_id = ?
                    WHERE phone = ? OR email = ?
                `, [
                    request.plan_name,
                    startDate,
                    endDate,
                    request.duration_days,
                    request.plan_id,
                    request.phone_number,
                    request.phone_number // Por si el teléfono está en el campo email (viejos registros)
                ]);
                console.log('[PLAN-REQUEST] Plan sincronizado en tabla users para:', request.phone_number);

                await connection.commit();

                // Enviar mensaje de WhatsApp al cliente notificando la aprobación
                try {
                    // 🎉 Utilizar la nueva utilidad centralizada para enviar el mensaje de bienvenida
                    console.log('[PLAN-REQUEST] 📨 Enviando notificación de aprobación a:', request.phone_number);

                    // Ejecutar de forma asíncrona pero registrar errores
                    sendPlanActivationMessage(request.phone_number, request.plan_name, request.duration_days)
                        .then(success => {
                            if (success) {
                                console.log('[PLAN-REQUEST] ✅ Mensaje de aprobación enviado por WhatsApp a:', request.phone_number);
                            } else {
                                console.log('[PLAN-REQUEST] ⚠️ Falló el envío de mensaje de aprobación a:', request.phone_number);
                            }
                        })
                        .catch(err => {
                            console.error('[PLAN-REQUEST] ❌ Error en sendPlanActivationMessage:', err);
                        });
                } catch (whatsappError) {
                    console.log('[PLAN-REQUEST] ⚠️ Error enviando WhatsApp de aprobación:', whatsappError.message);
                    // No fallar la aprobación si el WhatsApp falla
                }

                res.json({
                    success: true,
                    message: 'Solicitud aprobada y plan activado exitosamente'
                });

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[PLAN-REQUEST] Error approving request:', error);
            res.status(500).json({
                success: false,
                error: 'Error al aprobar solicitud'
            });
        }
    });

    // PUT /api/plan-requests/:id/reject - Admin rechaza una solicitud
    app.put('/api/plan-requests/:id/reject', authenticateToken, requireSuperAdmin, async (req, res) => {
        const { id } = req.params;
        const { reason } = req.body;
        const adminPhone = req.user?.phone || req.body?.adminPhone || '595994854167';

        console.log('[PLAN-REQUEST] Rechazando solicitud:', { id, reason, adminPhone });

        try {
            const connection = await pool.getConnection();
            try {
                // Obtener la solicitud
                const [requests] = await connection.execute(
                    'SELECT * FROM plan_requests WHERE id = ?',
                    [id]
                );

                if (requests.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Solicitud no encontrada'
                    });
                }

                const request = requests[0];

                if (request.status !== 'pending') {
                    return res.status(400).json({
                        success: false,
                        error: 'Esta solicitud ya fue procesada'
                    });
                }

                // Marcar solicitud como rechazada
                await connection.execute(`
                    UPDATE plan_requests
                    SET status = 'rejected',
                        reviewed_at = NOW(),
                        reviewed_by = ?,
                        rejection_reason = ?
                    WHERE id = ?
                `, [adminPhone, reason || 'Sin motivo especificado', id]);

                res.json({
                    success: true,
                    message: 'Solicitud rechazada'
                });

            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[PLAN-REQUEST] Error rejecting request:', error);
            res.status(500).json({
                success: false,
                error: 'Error al rechazar solicitud'
            });
        }
    });

    // DELETE /api/plan-requests/:id - Admin elimina una solicitud
    app.delete('/api/plan-requests/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
        const { id } = req.params;

        try {
            const connection = await pool.getConnection();
            try {
                const [result] = await connection.execute(
                    'DELETE FROM plan_requests WHERE id = ?',
                    [id]
                );

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Solicitud no encontrada'
                    });
                }

                res.json({
                    success: true,
                    message: 'Solicitud eliminada'
                });

            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[PLAN-REQUEST] Error deleting request:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar solicitud'
            });
        }
    });
};
