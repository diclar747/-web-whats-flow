/**
 * SISTEMA DE GESTIÓN DE CRÉDITOS - API ENDPOINTS
 * 
 * Endpoints para gestión completa de créditos, cuotas y recordatorios
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { resolveToUserId } = require('./helpers/sessionIdResolver');

// Middleware de autenticación
const { authenticateToken } = require('./middleware/auth');

module.exports = function (app, pool, io, whatsAppSessions) {

    // ============================================
    // CRÉDITOS - CRUD
    // ============================================

    /**
     * GET /api/credits/:sessionId
     * Obtener todos los créditos de una sesión
     */
    app.get('/api/credits/:sessionId', authenticateToken, async (req, res) => {
        const { sessionId } = req.params;
        const { status, contactId, limit = 50, offset = 0 } = req.query;

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            let query = `
                SELECT 
                    c.*,
                    (SELECT COUNT(*) FROM credit_installments ci WHERE ci.credit_id = c.id) as total_installments,
                    (SELECT COUNT(*) FROM credit_installments ci WHERE ci.credit_id = c.id AND ci.status = 'paid') as paid_installments,
                    (SELECT COUNT(*) FROM credit_installments ci WHERE ci.credit_id = c.id AND ci.status = 'pending') as pending_installments,
                    (SELECT COUNT(*) FROM credit_installments ci WHERE ci.credit_id = c.id AND ci.status = 'overdue') as overdue_installments,
                    (SELECT MIN(ci.due_date) FROM credit_installments ci WHERE ci.credit_id = c.id AND ci.status = 'pending') as next_due_date,
                    (SELECT COALESCE(SUM(ci.amount), 0) FROM credit_installments ci WHERE ci.credit_id = c.id AND ci.status = 'paid') as total_paid,
                    ct.avatar_url as contact_avatar
                FROM credits c
                LEFT JOIN contacts ct ON ct.id = c.contact_id
                WHERE c.session_id = ?
            `;
            const params = [resolvedSessionId];

            if (status) {
                query += ' AND c.status = ?';
                params.push(status);
            }

            if (contactId) {
                query += ' AND c.contact_id = ?';
                params.push(contactId);
            }

            query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const [credits] = await pool.execute(query, params);

            res.json({
                success: true,
                data: credits,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: credits.length
                }
            });
        } catch (error) {
            console.error('[CREDITS] Error al obtener créditos:', error);
            res.status(500).json({ success: false, error: 'Error al obtener créditos: ' + error.message });
        }
    });

    /**
     * GET /api/credits/:sessionId/:creditId
     * Obtener un crédito específico con sus cuotas
     */
    app.get('/api/credits/:sessionId/:creditId', authenticateToken, async (req, res) => {
        const { sessionId, creditId } = req.params;

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            // Obtener el crédito
            const [credits] = await pool.execute(
                `SELECT c.*, ct.avatar_url as contact_avatar, ct.phone as contact_phone
                 FROM credits c
                 LEFT JOIN contacts ct ON ct.id = c.contact_id
                 WHERE c.id = ? AND c.session_id = ?`,
                [creditId, resolvedSessionId]
            );

            if (credits.length === 0) {
                return res.status(404).json({ success: false, error: 'Crédito no encontrado' });
            }

            const credit = credits[0];

            // Obtener las cuotas con conteo de notificaciones y cálculo de interés por mora
            const interestRate = parseFloat(credit.interest_rate) || 0;
            const [installments] = await pool.execute(
                `SELECT ci.*,
                    COALESCE(logs.notification_count, 0) AS notification_count,
                    logs.last_notification_at,
                    CASE
                        WHEN ci.status != 'paid' AND ci.due_date < CURDATE()
                        THEN GREATEST(DATEDIFF(CURDATE(), ci.due_date), 0)
                        ELSE 0
                    END AS days_overdue,
                    CASE
                        WHEN ci.status != 'paid' AND ci.due_date < CURDATE()
                        THEN ROUND(ci.amount * (? / 100) * GREATEST(DATEDIFF(CURDATE(), ci.due_date), 0), 0)
                        ELSE 0
                    END AS interest_amount,
                    CASE
                        WHEN ci.status != 'paid' AND ci.due_date < CURDATE()
                        THEN ROUND(ci.amount + (ci.amount * (? / 100) * GREATEST(DATEDIFF(CURDATE(), ci.due_date), 0)), 0)
                        ELSE ci.amount
                    END AS total_with_interest
                 FROM credit_installments ci
                 LEFT JOIN (
                    SELECT installment_id,
                           COUNT(*) AS notification_count,
                           MAX(sent_at) AS last_notification_at
                    FROM credit_reminder_logs
                    WHERE status = 'sent'
                    GROUP BY installment_id
                 ) logs ON logs.installment_id = ci.id
                 WHERE ci.credit_id = ?
                 ORDER BY ci.installment_number ASC`,
                [interestRate, interestRate, creditId]
            );

            // Obtener estadísticas de recordatorios
            const [reminderStats] = await pool.execute(
                `SELECT 
                    COUNT(*) as total_reminders,
                    SUM(CASE WHEN reminder_type = 'before_due' THEN 1 ELSE 0 END) as before_reminders,
                    SUM(CASE WHEN reminder_type = 'on_due' THEN 1 ELSE 0 END) as on_due_reminders,
                    SUM(CASE WHEN reminder_type = 'overdue' THEN 1 ELSE 0 END) as overdue_reminders
                 FROM credit_reminder_logs 
                 WHERE credit_id = ?`,
                [creditId]
            );

            res.json({
                success: true,
                data: {
                    ...credit,
                    installments,
                    reminderStats: reminderStats[0]
                }
            });
        } catch (error) {
            console.error('[CREDITS] Error al obtener crédito:', error);
            res.status(500).json({ success: false, error: 'Error al obtener crédito' });
        }
    });

    /**
     * POST /api/credits/:sessionId
     * Crear un nuevo crédito con sus cuotas
     */
    app.post('/api/credits/:sessionId', authenticateToken, async (req, res) => {
        const { sessionId } = req.params;
        const {
            contactId,
            contactJid,
            contactName,
            totalAmount,
            installmentCount,
            installmentAmount,
            startDate,
            dueDay,
            interestRate = 0,
            reminderDaysBefore = 1,
            reminderTemplateId,
            description
        } = req.body;

        const connection = await pool.getConnection();

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            // Buscar el contact_id real - convertir a número entero válido
            let realContactId = null;
            const parsedContactId = parseInt(contactId);
            const MAX_INT_VALUE = 2147483647; // Máximo valor para INT en MySQL

            if (contactId && !isNaN(parsedContactId) && parsedContactId > 0 && parsedContactId <= MAX_INT_VALUE) {
                // Es un ID numérico válido (y cabe en un INT)
                realContactId = parsedContactId;
            } else if (contactJid || (parsedContactId > MAX_INT_VALUE)) {
                // Si es inválido, o es mayor al máximo (probablemente un teléfono usado como ID)
                // Usar el JID o el mismo contactId (si parece teléfono) para buscar
                const searchJid = contactJid || (parsedContactId > MAX_INT_VALUE ? contactId + '@s.whatsapp.net' : null);

                if (searchJid) {
                    console.log('[CREDITS] Buscando contacto por JID fallback:', searchJid);
                    // Buscar por JID en la base de datos (buscar en todos los session_id posibles)
                    const [contacts] = await connection.execute(
                        'SELECT id FROM contacts WHERE jid = ? LIMIT 1',
                        [searchJid]
                    );
                    if (contacts.length > 0) {
                        realContactId = contacts[0].id;
                    }
                }
            }


            // Si sigue sin encontrarse, usar NULL (el campo ahora es nullable)

            // Asegurar que realContactId sea un número o null
            const finalContactId = realContactId !== null ? Number(realContactId) : null;

            console.log('[CREDITS] Creando crédito:', {
                resolvedSessionId: Number(resolvedSessionId),
                finalContactId,
                realContactId,
                contactIdReceived: contactId,
                contactJid,
                body: req.body
            });

            // VALIDACIÓN CRÍTICA: El contact_id es obligatorio en la base de datos
            if (!finalContactId) {
                connection.release(); // Liberar conexión antes de retornar
                return res.status(400).json({
                    success: false,
                    error: 'Contacto no válido o no encontrado. Por favor seleccione un contacto existente.'
                });
            }

            await connection.beginTransaction();

            // Crear el crédito
            const [creditResult] = await connection.execute(
                `INSERT INTO credits
                 (session_id, contact_id, contact_jid, contact_name, total_amount,
                  installment_count, installment_amount, start_date, due_day, interest_rate,
                  reminder_days_before, reminder_template_id, description, created_by, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
                [resolvedSessionId, finalContactId, contactJid, contactName, Number(totalAmount),
                    Number(installmentCount), Number(installmentAmount), startDate, Number(dueDay),
                    Number(interestRate) || 0,
                    Number(reminderDaysBefore), reminderTemplateId || null, description || null, req.user?.id || null]
            );

            const creditId = creditResult.insertId;

            // Generar las cuotas
            const installments = [];
            const start = new Date(startDate);

            for (let i = 1; i <= installmentCount; i++) {
                // Calcular fecha de vencimiento
                const dueDate = new Date(start.getFullYear(), start.getMonth() + (i - 1), dueDay);

                // Ajustar si el día no existe en ese mes
                if (dueDate.getDate() !== dueDay) {
                    dueDate.setDate(0); // Último día del mes anterior
                }

                const [installmentResult] = await connection.execute(
                    `INSERT INTO credit_installments 
                     (credit_id, session_id, installment_number, amount, due_date, status)
                     VALUES (?, ?, ?, ?, ?, 'pending')`,
                    [creditId, resolvedSessionId, i, installmentAmount, dueDate.toISOString().split('T')[0]]
                );

                installments.push({
                    id: installmentResult.insertId,
                    installmentNumber: i,
                    amount: installmentAmount,
                    dueDate: dueDate.toISOString().split('T')[0],
                    status: 'pending'
                });
            }

            await connection.commit();

            res.json({
                success: true,
                message: 'Crédito creado exitosamente',
                data: {
                    creditId,
                    installmentsCreated: installments.length,
                    installments
                }
            });
        } catch (error) {
            await connection.rollback();
            console.error('[CREDITS-ERROR] ❌ Error CRÍTICO al crear crédito:', error);
            console.error('[CREDITS-ERROR] Stack:', error.stack);
            console.error('[CREDITS-ERROR] SessionId:', sessionId);
            console.error('[CREDITS-ERROR] ResolvedSessionId:', await resolveToUserId(sessionId));
            console.error('[CREDITS-ERROR] Body:', JSON.stringify(req.body, null, 2));
            console.error('[CREDITS-ERROR] User:', req.user);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor al crear crédito: ' + error.message,
                details: error.sqlMessage || error.message
            });
        } finally {
            connection.release();
        }
    });

    /**
     * PUT /api/credits/:sessionId/:creditId
     * Actualizar un crédito
     */
    app.put('/api/credits/:sessionId/:creditId', authenticateToken, async (req, res) => {
        const { sessionId, creditId } = req.params;
        const updates = req.body;

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            const allowedFields = ['total_amount', 'status', 'reminder_days_before',
                'reminder_template_id', 'description'];
            const setClause = [];
            const values = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = ?`);
                    values.push(value);
                }
            }

            if (setClause.length === 0) {
                return res.status(400).json({ success: false, error: 'No hay campos válidos para actualizar' });
            }

            values.push(creditId, resolvedSessionId);

            await pool.execute(
                `UPDATE credits SET ${setClause.join(', ')} WHERE id = ? AND session_id = ?`,
                values
            );

            // Si se marca como completado, actualizar fecha
            if (updates.status === 'completed') {
                await pool.execute(
                    'UPDATE credits SET completed_at = NOW() WHERE id = ?',
                    [creditId]
                );
            }

            res.json({ success: true, message: 'Crédito actualizado exitosamente' });
        } catch (error) {
            console.error('[CREDITS] Error al actualizar crédito:', error);
            res.status(500).json({ success: false, error: 'Error al actualizar crédito' });
        }
    });

    /**
     * DELETE /api/credits/:sessionId/:creditId
     * Eliminar un crédito y sus cuotas
     */
    app.delete('/api/credits/:sessionId/:creditId', authenticateToken, async (req, res) => {
        const { sessionId, creditId } = req.params;

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            await pool.execute(
                'DELETE FROM credits WHERE id = ? AND session_id = ?',
                [creditId, resolvedSessionId]
            );

            res.json({ success: true, message: 'Crédito eliminado exitosamente' });
        } catch (error) {
            console.error('[CREDITS] Error al eliminar crédito:', error);
            res.status(500).json({ success: false, error: 'Error al eliminar crédito' });
        }
    });

    // ============================================
    // CUOTAS - GESTIÓN
    // ============================================

    /**
     * PUT /api/credits/:sessionId/installments/:installmentId
     * Actualizar estado de una cuota (pagar, marcar vencida, etc.)
     */
    app.put('/api/credits/:sessionId/installments/:installmentId', authenticateToken, async (req, res) => {
        const { sessionId, installmentId } = req.params;
        const { status, paidDate, notes, amount, dueDate } = req.body;

        try {
            const updates = [];
            const values = [];

            if (status) {
                updates.push('status = ?');
                values.push(status);
            }

            if (paidDate) {
                updates.push('paid_date = ?');
                values.push(paidDate);
            }

            if (notes !== undefined) {
                updates.push('notes = ?');
                values.push(notes);
            }

            if (amount !== undefined && amount !== null) {
                updates.push('amount = ?');
                values.push(Number(amount));
            }

            if (dueDate) {
                updates.push('due_date = ?');
                values.push(dueDate);
            }

            values.push(installmentId);

            await pool.execute(
                `UPDATE credit_installments SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            // Si se marca como pagada, verificar si todas están pagadas
            if (status === 'paid') {
                const [installment] = await pool.execute(
                    'SELECT credit_id FROM credit_installments WHERE id = ?',
                    [installmentId]
                );

                if (installment.length > 0) {
                    const creditId = installment[0].credit_id;

                    // Verificar si todas las cuotas están pagadas
                    const [pending] = await pool.execute(
                        'SELECT COUNT(*) as count FROM credit_installments WHERE credit_id = ? AND status != "paid"',
                        [creditId]
                    );

                    if (pending[0].count === 0) {
                        await pool.execute(
                            'UPDATE credits SET status = "completed", completed_at = NOW() WHERE id = ?',
                            [creditId]
                        );
                    }
                }
            }

            res.json({ success: true, message: 'Cuota actualizada exitosamente' });
        } catch (error) {
            console.error('[CREDITS] Error al actualizar cuota:', error);
            res.status(500).json({ success: false, error: 'Error al actualizar cuota' });
        }
    });

    /**
     * DELETE /api/credits/:sessionId/installments/:installmentId
     * Eliminar una cuota individual
     */
    app.delete('/api/credits/:sessionId/installments/:installmentId', authenticateToken, async (req, res) => {
        const { sessionId, installmentId } = req.params;

        try {
            const resolvedSessionId = await resolveToUserId(sessionId);

            // Obtener info de la cuota antes de eliminar
            const [installment] = await pool.execute(
                'SELECT credit_id, installment_number FROM credit_installments WHERE id = ? AND session_id = ?',
                [installmentId, resolvedSessionId]
            );

            if (installment.length === 0) {
                return res.status(404).json({ success: false, error: 'Cuota no encontrada' });
            }

            const creditId = installment[0].credit_id;

            // Eliminar logs de recordatorios asociados
            await pool.execute(
                'DELETE FROM credit_reminder_logs WHERE installment_id = ?',
                [installmentId]
            );

            // Eliminar la cuota
            await pool.execute(
                'DELETE FROM credit_installments WHERE id = ? AND session_id = ?',
                [installmentId, resolvedSessionId]
            );

            // Re-numerar las cuotas restantes
            const [remaining] = await pool.execute(
                'SELECT id FROM credit_installments WHERE credit_id = ? ORDER BY due_date ASC',
                [creditId]
            );

            for (let i = 0; i < remaining.length; i++) {
                await pool.execute(
                    'UPDATE credit_installments SET installment_number = ? WHERE id = ?',
                    [i + 1, remaining[i].id]
                );
            }

            // Actualizar el conteo de cuotas en el crédito
            await pool.execute(
                'UPDATE credits SET installment_count = ? WHERE id = ?',
                [remaining.length, creditId]
            );

            res.json({ success: true, message: 'Cuota eliminada exitosamente' });
        } catch (error) {
            console.error('[CREDITS] Error al eliminar cuota:', error);
            res.status(500).json({ success: false, error: 'Error al eliminar cuota' });
        }
    });

    /**
     * POST /api/credits/:sessionId/installments/:installmentId/pay
     * Marcar cuota como pagada
     */
    app.post('/api/credits/:sessionId/installments/:installmentId/pay', authenticateToken, async (req, res) => {
        const { sessionId, installmentId } = req.params;
        const { paidDate = new Date().toISOString().split('T')[0], notes } = req.body;

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            await pool.execute(
                `UPDATE credit_installments 
                 SET status = 'paid', paid_date = ?, notes = COALESCE(?, notes), updated_at = NOW()
                 WHERE id = ? AND session_id = ?`,
                [paidDate, notes, installmentId, resolvedSessionId]
            );

            // Verificar si todas las cuotas del crédito están pagadas
            const [installment] = await pool.execute(
                'SELECT credit_id FROM credit_installments WHERE id = ?',
                [installmentId]
            );

            if (installment.length > 0) {
                const creditId = installment[0].credit_id;

                const [pending] = await pool.execute(
                    'SELECT COUNT(*) as count FROM credit_installments WHERE credit_id = ? AND status != "paid"',
                    [creditId]
                );

                if (pending[0].count === 0) {
                    await pool.execute(
                        'UPDATE credits SET status = "completed", completed_at = NOW() WHERE id = ?',
                        [creditId]
                    );
                }
            }

            res.json({ success: true, message: 'Cuota marcada como pagada' });
        } catch (error) {
            console.error('[CREDITS] Error al pagar cuota:', error);
            res.status(500).json({ success: false, error: 'Error al pagar cuota' });
        }
    });

    /**
     * POST /api/credits/:sessionId/installments/:installmentId/send-reminder
     * Enviar recordatorio manual
     */
    app.post('/api/credits/:sessionId/installments/:installmentId/send-reminder', authenticateToken, async (req, res) => {
        const { sessionId, installmentId } = req.params;
        const { templateType, customMessage } = req.body;

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            // Obtener información de la cuota
            const [installments] = await pool.execute(
                `SELECT
                    ci.id as installment_id,
                    ci.credit_id,
                    ci.installment_number,
                    ci.amount,
                    ci.due_date,
                    c.session_id,
                    c.contact_jid,
                    c.contact_name,
                    c.installment_count as total_installments,
                    c.reminder_template_id,
                    COALESCE(c.interest_rate, 0) as interest_rate,
                    CASE
                        WHEN ci.status != 'paid' AND ci.due_date < CURDATE()
                        THEN GREATEST(DATEDIFF(CURDATE(), ci.due_date), 0)
                        ELSE 0
                    END AS days_overdue,
                    CASE
                        WHEN ci.status != 'paid' AND ci.due_date < CURDATE()
                        THEN ROUND(ci.amount * (COALESCE(c.interest_rate, 0) / 100) * GREATEST(DATEDIFF(CURDATE(), ci.due_date), 0), 0)
                        ELSE 0
                    END AS interest_amount
                 FROM credit_installments ci
                 JOIN credits c ON ci.credit_id = c.id
                 WHERE ci.id = ? AND c.session_id = ?`,
                [installmentId, resolvedSessionId]
            );

            if (installments.length === 0) {
                return res.status(404).json({ success: false, error: 'Cuota no encontrada' });
            }

            const installment = installments[0];

            // Definir mensajes según el tipo de plantilla
            const templates = {
                'amigable': `¡Hola {{nombre}}! 👋\n\nEsperamos que tengas un excelente día. 🌟\n\nTe recordamos amablemente que tienes una cuota pendiente:\n\n💰 *Monto:* Gs. {{monto}}\n📊 *Cuota:* {{cuota_numero}} de {{total_cuotas}}\n📅 *Vencimiento:* {{fecha_vencimiento}}\n\nSi ya realizaste el pago, por favor ignora este mensaje. 🙏\n\n¡Gracias por tu preferencia! 😊`,
                'formal': `Estimado/a {{nombre}},\n\nPor medio de este mensaje le recordamos su compromiso de pago pendiente:\n\n📋 *Concepto:* Cuota {{cuota_numero}}/{{total_cuotas}}\n💰 *Importe:* Gs. {{monto}}\n📅 *Vencimiento:* {{fecha_vencimiento}}\n\nAgradecemos su puntualidad en los pagos.\n\nAtentamente,\nEquipo de Gestión 💼`,
                'urgente': `⚠️ *AVISO IMPORTANTE* ⚠️\n\n{{nombre}},\n\nLe informamos que su cuota número {{cuota_numero}} de {{total_cuotas}} está próxima a vencer o ha vencido.\n\n💰 *Monto pendiente:* Gs. {{monto}}\n📅 *Fecha de vencimiento:* {{fecha_vencimiento}}\n\nLe solicitamos regularizar su situación a la brevedad posible.\n\nPara coordinar su pago, por favor contáctenos. 📞`,
                'custom': customMessage || 'Mensaje personalizado',
                'default': `Hola {{nombre}}! 👋\n\nTe recordamos que tienes una cuota pendiente:\n\n💰 *Monto:* Gs. {{monto}}\n📊 *Cuota:* {{cuota_numero}} de {{total_cuotas}}\n📅 *Vencimiento:* {{fecha_vencimiento}}`
            };

            const template = templates[templateType] || templates['default'];

            // Helpers para formatear
            const formatCurrency = (amount) => {
                return new Intl.NumberFormat('es-PY', {
                    style: 'decimal',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(amount);
            };

            const formatDate = (dateString) => {
                const date = new Date(dateString);
                return date.toLocaleDateString('es-PY', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });
            };

            // Calcular total con interés
            const interestAmt = Number(installment.interest_amount) || 0;
            const totalWithInterest = installment.amount + interestAmt;
            const daysOverdue = Number(installment.days_overdue) || 0;

            let message = template
                .replace(/{{nombre}}/g, installment.contact_name?.split(' ')[0] || 'Cliente')
                .replace(/{{monto}}/g, formatCurrency(installment.amount))
                .replace(/{{cuota_numero}}/g, installment.installment_number.toString())
                .replace(/{{total_cuotas}}/g, installment.total_installments.toString())
                .replace(/{{fecha_vencimiento}}/g, formatDate(installment.due_date))
                .replace(/{{interes}}/g, formatCurrency(interestAmt))
                .replace(/{{total_con_interes}}/g, formatCurrency(totalWithInterest))
                .replace(/{{dias_mora}}/g, daysOverdue.toString());

            // Si hay interés por mora, agregar info al final del mensaje
            if (interestAmt > 0 && Number(installment.interest_rate) > 0) {
                message += `\n\n📊 *Detalle de mora:*\n💰 Cuota: Gs. ${formatCurrency(installment.amount)}\n📈 Interés (${daysOverdue} días × ${installment.interest_rate}%): Gs. ${formatCurrency(interestAmt)}\n💵 *Total a pagar: Gs. ${formatCurrency(totalWithInterest)}*`;
            }

            // Enviar por WhatsApp
            console.log('[DEBUG-CREDITS] Buscando sesión:', sessionId);
            // Si el sessionId es "1" o corto, intentar buscar una sesión válida en el mapa
            // Esto es un hack temporal para debuggear por qué no encuentra la sesión
            const availableSessions = Array.from(whatsAppSessions.keys());
            console.log('[DEBUG-CREDITS] Sesiones disponibles:', availableSessions);

            let session = whatsAppSessions.get(sessionId);

            // INTENTO DE RECUPERACIÓN MEJORADO:
            // 1. Si no existe por ID, buscar el teléfono del usuario en la BD
            if (!session) {
                console.log('[DEBUG-CREDITS] Sesión no encontrada por ID:', sessionId, '. Buscando teléfono...');
                try {
                    const [userRows] = await pool.execute('SELECT phone FROM users WHERE id = ?', [sessionId]);
                    if (userRows.length > 0 && userRows[0].phone) {
                        const phoneKey = userRows[0].phone;
                        console.log('[DEBUG-CREDITS] Teléfono encontrado:', phoneKey, '. Buscando en sesiones...');
                        session = whatsAppSessions.get(phoneKey);
                        if (session) {
                            console.log('[DEBUG-CREDITS] ✅ Sesión encontrada por teléfono:', phoneKey);
                        }
                    }
                } catch (dbError) {
                    console.error('[DEBUG-CREDITS] Error buscando teléfono de usuario:', dbError);
                }
            }

            // 2. Fallback final: Si aun no hay sesión, usar la primera disponible (legacy hack)
            if (!session && availableSessions.length > 0) {
                console.log('[DEBUG-CREDITS] Sesión no encontrada por teléfono. Usando primera disponible:', availableSessions[0]);
                session = whatsAppSessions.get(availableSessions[0]);
            }

            if (!session || !session.sock) {
                return res.status(400).json({ success: false, error: 'Sesión de WhatsApp no conectada' });
            }

            // Verificar estado del socket
            // @ts-ignore
            if (session.sock.ws && session.sock.ws.readyState !== 1) { // 1 = OPEN
                console.warn('[DEBUG-CREDITS] Socket no está OPEN. State:', session.sock.ws.readyState);
                // No retornamos error aquí, dejamos que sendMessage intente y falle con el error específico
            }

            console.log('[DEBUG-CREDITS] Intentando enviar mensaje a:', installment.contact_jid);
            console.log('[DEBUG-CREDITS] Mensaje length:', message.length);

            try {
                // Validación de JID
                if (!installment.contact_jid || !installment.contact_jid.includes('@')) {
                    console.error('[DEBUG-CREDITS] JID INVÁLIDO:', installment.contact_jid);
                    throw new Error(`JID de contacto inválido: ${installment.contact_jid}`);
                }

                const result = await session.sock.sendMessage(installment.contact_jid, { text: message });
                console.log('[DEBUG-CREDITS] Mensaje enviado OK. ID:', result?.key?.id);

                // Guardar log (usar resolvedSessionId para consistencia)
                await pool.execute(
                    `INSERT INTO credit_reminder_logs
                     (installment_id, credit_id, session_id, contact_jid, reminder_type,
                      days_before, message_text, template_used, whatsapp_message_id, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        installmentId,
                        installment.credit_id,
                        resolvedSessionId,
                        installment.contact_jid,
                        'manual',
                        0,
                        message,
                        templateType,
                        result?.key?.id,
                        'sent'
                    ]
                );

                // Incrementar contador de notificaciones en la cuota
                await pool.execute(
                    `UPDATE credit_installments
                     SET reminder_count = COALESCE(reminder_count, 0) + 1,
                         reminder_sent = TRUE,
                         reminder_sent_at = NOW()
                     WHERE id = ?`,
                    [installmentId]
                );

                res.json({ success: true, message: 'Recordatorio enviado exitosamente' });

            } catch (sendError) {
                console.error('[CREDITS-ERROR] Error al enviar mensaje de WhatsApp via Baileys:', sendError);
                if (sendError?.output?.statusCode === 428 || sendError?.message?.includes('Connection Closed')) {
                    return res.status(503).json({
                        success: false,
                        error: 'La conexión con WhatsApp está cerrada o inestable. Por favor intente reconectar su sesión o escanee el código QR nuevamente.'
                    });
                }
                throw sendError; // Re-lanzar para el catch general si no es error de conexión conocido
            }
        } catch (error) {
            console.error('[CREDITS] Error enviando recordatorio manual:', error);
            res.status(500).json({ success: false, error: 'Error al enviar recordatorio: ' + error.message });
        }
    });

    // ============================================
    // PLANTILLAS DE CRÉDITO
    // ============================================

    /**
     * GET /api/credit-templates/:sessionId
     * Obtener plantillas de recordatorio
     */
    app.get('/api/credit-templates/:sessionId', authenticateToken, async (req, res) => {
        const { sessionId } = req.params;

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            // Obtener plantillas del usuario + plantillas por defecto
            const [templates] = await pool.execute(
                `SELECT * FROM credit_templates 
                 WHERE session_id = ? OR session_id = 'default'
                 AND is_active = TRUE
                 ORDER BY is_default DESC, created_at DESC`,
                [resolvedSessionId]
            );

            res.json({ success: true, data: templates });
        } catch (error) {
            console.error('[CREDITS] Error al obtener plantillas:', error);
            res.status(500).json({ success: false, error: 'Error al obtener plantillas' });
        }
    });

    /**
     * POST /api/credit-templates/:sessionId
     * Crear nueva plantilla
     */
    app.post('/api/credit-templates/:sessionId', authenticateToken, async (req, res) => {
        const { sessionId } = req.params;
        const { name, description, messageText, reminderType, daysBefore } = req.body;

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            const id = uuidv4();

            await pool.execute(
                `INSERT INTO credit_templates 
                 (id, session_id, name, description, message_text, variables, reminder_type, days_before, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
                [id, resolvedSessionId, name, description, messageText,
                    JSON.stringify(['nombre', 'monto', 'cuota_numero', 'total_cuotas', 'fecha_vencimiento']),
                    reminderType, daysBefore]
            );

            res.json({ success: true, message: 'Plantilla creada exitosamente', data: { id } });
        } catch (error) {
            console.error('[CREDITS] Error al crear plantilla:', error);
            res.status(500).json({ success: false, error: 'Error al crear plantilla' });
        }
    });

    /**
     * PUT /api/credit-templates/:sessionId/:templateId
     * Actualizar plantilla
     */
    app.put('/api/credit-templates/:sessionId/:templateId', authenticateToken, async (req, res) => {
        const { sessionId, templateId } = req.params;
        const { name, description, messageText, reminderType, daysBefore, isActive } = req.body;

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            const updates = [];
            const values = [];

            if (name) { updates.push('name = ?'); values.push(name); }
            if (description !== undefined) { updates.push('description = ?'); values.push(description); }
            if (messageText) { updates.push('message_text = ?'); values.push(messageText); }
            if (reminderType) { updates.push('reminder_type = ?'); values.push(reminderType); }
            if (daysBefore !== undefined) { updates.push('days_before = ?'); values.push(daysBefore); }
            if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive); }

            values.push(templateId, resolvedSessionId);

            await pool.execute(
                `UPDATE credit_templates SET ${updates.join(', ')} WHERE id = ? AND session_id = ?`,
                values
            );

            res.json({ success: true, message: 'Plantilla actualizada exitosamente' });
        } catch (error) {
            console.error('[CREDITS] Error al actualizar plantilla:', error);
            res.status(500).json({ success: false, error: 'Error al actualizar plantilla' });
        }
    });

    /**
     * DELETE /api/credit-templates/:sessionId/:templateId
     * Eliminar plantilla
     */
    app.delete('/api/credit-templates/:sessionId/:templateId', authenticateToken, async (req, res) => {
        const { sessionId, templateId } = req.params;

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            await pool.execute(
                'DELETE FROM credit_templates WHERE id = ? AND session_id = ?',
                [templateId, resolvedSessionId]
            );

            res.json({ success: true, message: 'Plantilla eliminada exitosamente' });
        } catch (error) {
            console.error('[CREDITS] Error al eliminar plantilla:', error);
            res.status(500).json({ success: false, error: 'Error al eliminar plantilla' });
        }
    });

    // ============================================
    // ESTADÍSTICAS Y REPORTES
    // ============================================

    /**
     * GET /api/credits/:sessionId/stats/dashboard
     * Estadísticas del dashboard de créditos
     */
    app.get('/api/credits/:sessionId/stats/dashboard', authenticateToken, async (req, res) => {
        const { sessionId } = req.params;

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            // Estadísticas generales
            const [generalStats] = await pool.execute(
                `SELECT 
                    COUNT(*) as total_credits,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_credits,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_credits,
                    SUM(total_amount) as total_portfolio,
                    SUM(CASE WHEN status = 'active' THEN total_amount ELSE 0 END) as active_portfolio
                 FROM credits WHERE session_id = ?`,
                [resolvedSessionId]
            );

            // Estadísticas de cuotas
            const [installmentStats] = await pool.execute(
                `SELECT 
                    COUNT(*) as total_installments,
                    SUM(CASE WHEN ci.status = 'pending' THEN 1 ELSE 0 END) as pending_installments,
                    SUM(CASE WHEN ci.status = 'paid' THEN 1 ELSE 0 END) as paid_installments,
                    SUM(CASE WHEN ci.status = 'overdue' THEN 1 ELSE 0 END) as overdue_installments,
                    SUM(CASE WHEN ci.status = 'pending' THEN ci.amount ELSE 0 END) as pending_amount,
                    SUM(CASE WHEN ci.status = 'overdue' THEN ci.amount ELSE 0 END) as overdue_amount
                 FROM credit_installments ci
                 JOIN credits c ON ci.credit_id = c.id
                 WHERE c.session_id = ?`,
                [resolvedSessionId]
            );

            // Cuotas que vencen esta semana
            const [upcomingDue] = await pool.execute(
                `SELECT COUNT(*) as count
                 FROM credit_installments ci
                 JOIN credits c ON ci.credit_id = c.id
                 WHERE c.session_id = ? 
                 AND ci.status = 'pending'
                 AND ci.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`,
                [resolvedSessionId]
            );

            // Recordatorios enviados este mes
            const [reminderStats] = await pool.execute(
                `SELECT 
                    COUNT(*) as total_sent,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
                    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
                    SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count
                 FROM credit_reminder_logs
                 WHERE session_id = ? 
                 AND MONTH(sent_at) = MONTH(CURRENT_DATE()) 
                 AND YEAR(sent_at) = YEAR(CURRENT_DATE())`,
                [resolvedSessionId]
            );

            res.json({
                success: true,
                data: {
                    credits: generalStats[0],
                    installments: installmentStats[0],
                    upcomingDue: upcomingDue[0].count,
                    reminders: reminderStats[0]
                }
            });
        } catch (error) {
            console.error('[CREDITS] Error al obtener estadísticas:', error);
            res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
        }
    });

    /**
     * GET /api/credits/:sessionId/stats/overdue
     * Obtener cuotas vencidas
     */
    app.get('/api/credits/:sessionId/stats/overdue', authenticateToken, async (req, res) => {
        const { sessionId } = req.params;

        try {
            // Resolver session_id al ID numérico del usuario
            const resolvedSessionId = await resolveToUserId(sessionId);

            const [overdue] = await pool.execute(
                `SELECT 
                    ci.*,
                    c.contact_name,
                    c.contact_jid,
                    c.total_amount as credit_total,
                    DATEDIFF(CURDATE(), ci.due_date) as days_overdue
                 FROM credit_installments ci
                 JOIN credits c ON ci.credit_id = c.id
                 WHERE c.session_id = ? 
                 AND ci.status = 'overdue'
                 ORDER BY ci.due_date ASC`,
                [sessionId]
            );

            res.json({ success: true, data: overdue });
        } catch (error) {
            console.error('[CREDITS] Error al obtener vencidos:', error);
            res.status(500).json({ success: false, error: 'Error al obtener vencidos' });
        }
    });

    console.log('[CREDITS] ✅ Endpoints de gestión de créditos cargados');
};
