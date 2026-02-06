const axios = require('axios');

module.exports = function (app, pool) {
    if (!pool && global.dbPool) {
        pool = global.dbPool;
    }

    // Proxy para autenticación en Mayten
    app.post('/api/sms/auth', async (req, res) => {
        try {
            const { username, password } = req.body;

            const response = await axios.post('https://mayten.cloud/auth', {
                username: username || process.env.SMS_MAYTEN_USERNAME,
                password: password || process.env.SMS_MAYTEN_PASSWORD
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            res.json({ success: true, data: response.data });
        } catch (error) {
            console.error('[SMS-AUTH] Error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error al generar token de SMS',
                details: error.response?.data || error.message
            });
        }
    });

    // Enviar SMS (Ahora solo crea la campaña en estado PENDIENTE)
    app.post('/api/sms/send', async (req, res) => {
        const connection = await pool.getConnection();
        try {
            const { userId, messages, campaignName } = req.body;

            if (!userId || !messages || !messages.length) {
                return res.status(400).json({ success: false, error: 'Faltan datos requeridos (userId, messages)' });
            }

            await connection.beginTransaction();

            // Crear la campaña en estado 'pending' (para ser activada manualmente)
            const [campaignResult] = await connection.execute(
                'INSERT INTO sms_campaigns (user_id, name, message_template, status, total_recipients, sent_count, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    userId,
                    campaignName || `Envío Directo ${new Date().toLocaleString()}`,
                    messages[0].mensaje,
                    'pending',
                    messages.length,
                    0,
                    'Envío Directo'
                ]
            );

            const campaignId = campaignResult.insertId;

            // Registrar destinatarios
            for (const msg of messages) {
                await connection.execute(
                    'INSERT INTO sms_campaign_recipients (campaign_id, phone, name, status) VALUES (?, ?, ?, ?)',
                    [campaignId, msg.telefono, msg.mensaje.split(',')[1] || '', 'pending']
                );
            }

            await connection.commit();

            res.json({
                success: true,
                message: 'Campaña guardada como pendiente. Puedes iniciar el envío desde el panel.',
                campaignId
            });

        } catch (error) {
            await connection.rollback();
            console.error('[SMS-SEND] Error:', error.message);
            res.status(500).json({ success: false, error: 'Error al guardar envío directo' });
        } finally {
            connection.release();
        }
    });

    // Endpoint para INICIAR el envío de una campaña (Directo o Programado)
    app.post('/api/sms/campaigns/:id/start', async (req, res) => {
        const { id } = req.params;
        const { userId, token } = req.body;

        if (!userId || !token) {
            return res.status(400).json({ success: false, error: 'userId y token son requeridos' });
        }

        try {
            // Iniciar proceso en segundo plano para no bloquear
            processSmsCampaign(id, userId, token, pool, global.io);

            res.json({ success: true, message: 'Envío iniciado en segundo plano' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    async function processSmsCampaign(campaignId, userId, token, pool, io) {
        let connection;
        try {
            connection = await pool.getConnection();

            // 1. Obtener datos de la campaña
            const [campaigns] = await connection.execute('SELECT * FROM sms_campaigns WHERE id = ?', [campaignId]);
            if (!campaigns.length) return;
            const campaign = campaigns[0];

            // 2. Marcar como activa
            await connection.execute('UPDATE sms_campaigns SET status = "active", paused = 0 WHERE id = ?', [campaignId]);

            // 3. Obtener destinatarios pendientes
            const [recipients] = await connection.execute(
                'SELECT * FROM sms_campaign_recipients WHERE campaign_id = ? AND status = "pending"',
                [campaignId]
            );

            if (recipients.length === 0) {
                await connection.execute('UPDATE sms_campaigns SET status = "completed" WHERE id = ?', [campaignId]);
                return;
            }

            console.log(`[SMS-PROCESS] 🚀 Iniciando envío campaña ${campaignId}: ${recipients.length} mensajes`);

            let sentCount = campaign.sent_count || 0;
            let failedCount = campaign.failed_count || 0;
            const total = campaign.total_recipients;

            for (let i = 0; i < recipients.length; i++) {
                const rec = recipients[i];

                // Verificar si se pausó la campaña entre envíos
                const [statusCheck] = await pool.execute('SELECT paused, status FROM sms_campaigns WHERE id = ?', [campaignId]);
                if (statusCheck[0].paused || statusCheck[0].status === 'paused') {
                    console.log(`[SMS-PROCESS] ⏸️ Campaña ${campaignId} pausada`);
                    return;
                }

                try {
                    // Enviar a Mayten (individualmente para progreso real)
                    await axios.post('https://mayten.cloud/api/Mensajes/Texto', {
                        origen: 'SMS_CORTO',
                        mensajes: [{
                            mensaje: campaign.message_template.replace(/{nombre}/g, rec.name || ''),
                            telefono: rec.phone.replace(/\D/g, ''),
                            identificador: `camp_${campaignId}_${rec.id}`
                        }]
                    }, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    // Descontar saldo y registrar
                    await pool.execute('UPDATE users SET sms_balance = sms_balance - 1 WHERE id = ?', [userId]);
                    await pool.execute('UPDATE sms_campaign_recipients SET status = "sent" WHERE id = ?', [rec.id]);
                    await pool.execute(
                        'INSERT INTO sms_history (user_id, phone, message, status, sent_at, campaign_id) VALUES (?, ?, ?, ?, NOW(), ?)',
                        [userId, rec.phone, campaign.message_template, 'sent', campaignId]
                    );

                    sentCount++;
                } catch (err) {
                    console.error(`[SMS-PROCESS] ❌ Error enviando a ${rec.phone}:`, err.message);
                    await pool.execute('UPDATE sms_campaign_recipients SET status = "failed", error_message = ? WHERE id = ?', [err.message, rec.id]);
                    failedCount++;
                }

                // Actualizar progreso en la campaña
                await pool.execute(
                    'UPDATE sms_campaigns SET sent_count = ?, failed_count = ? WHERE id = ?',
                    [sentCount, failedCount, campaignId]
                );

                // Emitir progreso vía Socket.IO
                if (io) {
                    const progress = Math.round(((sentCount + failedCount) / total) * 100);
                    const progressData = {
                        campaignId: parseInt(campaignId),
                        progress,
                        sent: sentCount,
                        failed: failedCount,
                        total
                    };

                    io.emit('sms_progress', progressData);
                    io.to(`sms_${userId}`).emit('sms_progress', progressData);

                    // Si es envío directo, emitir evento específico para la UI de envío directo
                    if (campaign.category === 'Envío Directo') {
                        io.emit('direct_send_progress', {
                            total,
                            sent: sentCount,
                            failed: failedCount
                        });
                        io.to(`sms_${userId}`).emit('direct_send_progress', {
                            total,
                            sent: sentCount,
                            failed: failedCount
                        });
                    }
                }

                // Pequeño delay de 1 segundo para no saturar y permitir ver progreso real
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Marcar como completada
            await pool.execute('UPDATE sms_campaigns SET status = "completed" WHERE id = ?', [campaignId]);
            console.log(`[SMS-PROCESS] ✅ Campaña ${campaignId} finalizada: ${sentCount} sent, ${failedCount} failed`);

        } catch (error) {
            console.error(`[SMS-PROCESS] ❌ Error fatal en campaña ${campaignId}:`, error.message);
            await pool.execute('UPDATE sms_campaigns SET status = "failed" WHERE id = ?', [campaignId]);
        } finally {
            if (connection) connection.release();
        }
    }

    // Obtener estadísticas de SMS
    app.get('/api/sms/stats/:userId', async (req, res) => {
        const { userId } = req.params;
        try {
            const [totalSent] = await pool.execute(
                'SELECT COUNT(*) as count FROM sms_history WHERE user_id = ? AND status = \'sent\'',
                [userId]
            );
            const [totalFailed] = await pool.execute(
                'SELECT COUNT(*) as count FROM sms_history WHERE user_id = ? AND status = \'failed\'',
                [userId]
            );
            const [activeCampaigns] = await pool.execute(
                'SELECT COUNT(*) as count FROM sms_campaigns WHERE user_id = ? AND status = \'active\'',
                [userId]
            );
            const [user] = await pool.execute('SELECT sms_balance FROM users WHERE id = ?', [userId]);

            res.json({
                success: true,
                stats: {
                    sent: totalSent[0].count,
                    failed: totalFailed[0].count,
                    campaigns: activeCampaigns[0].count,
                    balance: user[0]?.sms_balance || 0
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // CRUD Campañas SMS
    app.post('/api/sms/campaigns', async (req, res) => {
        const connection = await pool.getConnection();
        try {
            const { userId, name, template, scheduledAt, recipients } = req.body; // recipients: [{ phone, name }]

            await connection.beginTransaction();

            const [result] = await connection.execute(
                'INSERT INTO sms_campaigns (user_id, name, message_template, scheduled_at, total_recipients, status) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, name, template, scheduledAt || null, recipients?.length || 0, scheduledAt ? 'pending' : 'active']
            );

            const campaignId = result.insertId;

            if (recipients && recipients.length > 0) {
                for (const rec of recipients) {
                    await connection.execute(
                        'INSERT INTO sms_campaign_recipients (campaign_id, phone, name, status) VALUES (?, ?, ?, ?)',
                        [campaignId, rec.phone, rec.name, 'pending']
                    );
                }
            }

            await connection.commit();
            res.json({ success: true, campaignId });
        } catch (error) {
            await connection.rollback();
            console.error('[SMS-CAMPAIGN-CREATE] Error:', error.message);
            res.status(500).json({ success: false, error: error.message });
        } finally {
            connection.release();
        }
    });

    app.get('/api/sms/campaigns/:userId', async (req, res) => {
        try {
            const [rows] = await pool.execute(
                'SELECT * FROM sms_campaigns WHERE user_id = ? ORDER BY created_at DESC',
                [req.params.userId]
            );
            res.json({ success: true, campaigns: rows });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Endpoint para obtener destinatarios de una campaña (para exportación)
    app.get('/api/sms/campaigns/:id/recipients', async (req, res) => {
        try {
            const [rows] = await pool.execute(
                'SELECT phone, name, status, sent_at, error_message FROM sms_campaign_recipients WHERE campaign_id = ?',
                [req.params.id]
            );
            res.json({ success: true, recipients: rows });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // NEW: Endpoint para programar campañas
    app.post('/api/sms/schedule', async (req, res) => {
        const connection = await pool.getConnection();
        try {
            const { userId, campaignName, message, recipients, scheduledAt, token } = req.body;

            if (!userId || !campaignName || !message || !recipients || !recipients.length) {
                return res.status(400).json({
                    success: false,
                    error: 'Faltan datos requeridos (userId, campaignName, message, recipients)'
                });
            }

            await connection.beginTransaction();

            // Crear campaña programada
            const [result] = await connection.execute(
                'INSERT INTO sms_campaigns (user_id, name, message_template, scheduled_at, total_recipients, status) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, campaignName, message, scheduledAt || null, recipients.length, scheduledAt ? 'pending' : 'active']
            );

            const campaignId = result.insertId;

            // Agregar destinatarios
            for (const rec of recipients) {
                await connection.execute(
                    'INSERT INTO sms_campaign_recipients (campaign_id, phone, name, status) VALUES (?, ?, ?, ?)',
                    [campaignId, rec.phone, rec.name, 'pending']
                );
            }

            await connection.commit();

            res.json({
                success: true,
                campaignId,
                message: `Campaña "${campaignName}" programada exitosamente para ${recipients.length} destinatarios`
            });
        } catch (error) {
            await connection.rollback();
            console.error('[SMS-SCHEDULE] Error:', error.message);
            res.status(500).json({ success: false, error: error.message });
        } finally {
            connection.release();
        }
    });

    // DELETE Campaign
    app.delete('/api/sms/campaigns/:id', async (req, res) => {
        const connection = await pool.getConnection();
        try {
            const { id } = req.params;

            await connection.beginTransaction();
            await connection.execute('DELETE FROM sms_campaign_recipients WHERE campaign_id = ?', [id]);
            await connection.execute('DELETE FROM sms_campaigns WHERE id = ?', [id]);
            await connection.commit();

            res.json({ success: true, message: 'Campaña eliminada exitosamente' });
        } catch (error) {
            await connection.rollback();
            console.error('[SMS-DELETE-CAMPAIGN] Error:', error.message);
            res.status(500).json({ success: false, error: error.message });
        } finally {
            connection.release();
        }
    });

    // UPDATE Campaign (Edit)
    app.put('/api/sms/campaigns/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { name, template } = req.body;

            await pool.execute(
                'UPDATE sms_campaigns SET name = ?, message_template = ?, updated_at = NOW() WHERE id = ?',
                [name, template, id]
            );

            res.json({ success: true, message: 'Campaña actualizada exitosamente' });
        } catch (error) {
            console.error('[SMS-UPDATE-CAMPAIGN] Error:', error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Resend Campaign (Create a new pending campaign from an existing one)
    app.post('/api/sms/campaigns/:id/resend', async (req, res) => {
        const connection = await pool.getConnection();
        try {
            const { id } = req.params;

            await connection.beginTransaction();

            // 1. Get original campaign
            const [campaigns] = await connection.execute('SELECT * FROM sms_campaigns WHERE id = ?', [id]);
            if (!campaigns.length) {
                await connection.rollback();
                return res.status(404).json({ success: false, error: 'Campaña no encontrada' });
            }
            const original = campaigns[0];

            // 2. Create new campaign
            const [result] = await connection.execute(
                'INSERT INTO sms_campaigns (user_id, name, message_template, status, total_recipients, sent_count, failed_count, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    original.user_id,
                    `Reenvío: ${original.name}`,
                    original.message_template,
                    'pending',
                    original.total_recipients,
                    0,
                    0,
                    original.category || 'Reenvío'
                ]
            );

            const newCampaignId = result.insertId;

            // 3. Duplicate recipients
            const [recipients] = await connection.execute('SELECT phone, name FROM sms_campaign_recipients WHERE campaign_id = ?', [id]);
            for (const rec of recipients) {
                await connection.execute(
                    'INSERT INTO sms_campaign_recipients (campaign_id, phone, name, status) VALUES (?, ?, ?, ?)',
                    [newCampaignId, rec.phone, rec.name, 'pending']
                );
            }

            await connection.commit();

            res.json({
                success: true,
                message: 'Campaña duplicada como pendiente. Puedes iniciar el envío desde el panel.',
                campaignId: newCampaignId
            });

        } catch (error) {
            await connection.rollback();
            console.error('[SMS-RESEND] Error:', error.message);
            res.status(500).json({ success: false, error: 'Error al reanudar campaña: ' + error.message });
        } finally {
            connection.release();
        }
    });

    // Pause Campaign
    app.post('/api/sms/campaigns/:id/pause', async (req, res) => {
        try {
            await pool.execute('UPDATE sms_campaigns SET paused = 1 WHERE id = ?', [req.params.id]);
            res.json({ success: true, message: 'Campaña pausada' });
        } catch (error) {
            console.error('[SMS-PAUSE-CAMPAIGN] Error:', error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Resume Campaign
    app.post('/api/sms/campaigns/:id/resume', async (req, res) => {
        try {
            await pool.execute('UPDATE sms_campaigns SET paused = 0 WHERE id = ?', [req.params.id]);
            res.json({ success: true, message: 'Campaña reanudada' });
        } catch (error) {
            console.error('[SMS-RESUME-CAMPAIGN] Error:', error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Charts Data Endpoint
    app.get('/api/sms/charts/:userId', async (req, res) => {
        const { userId } = req.params;
        const { period = 'week' } = req.query; // week, month, year

        try {
            // Stats for Pie Chart
            const [sentCount] = await pool.execute(
                'SELECT COUNT(*) as count FROM sms_history WHERE user_id = ? AND status = "sent"',
                [userId]
            );
            const [failedCount] = await pool.execute(
                'SELECT COUNT(*) as count FROM sms_history WHERE user_id = ? AND status = "failed"',
                [userId]
            );

            // Stats for Time-based Chart
            let timeQuery = '';
            if (period === 'week') {
                timeQuery = `
                    SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, 
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                    FROM sms_history 
                    WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
                    ORDER BY date ASC
                `;
            } else if (period === 'month') {
                timeQuery = `
                    SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, 
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                    FROM sms_history 
                    WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
                    ORDER BY date ASC
                `;
            } else { // year
                timeQuery = `
                    SELECT DATE_FORMAT(created_at, '%Y-%m') as date, 
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                    FROM sms_history 
                    WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
                    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                    ORDER BY date ASC
                `;
            }

            const [timeData] = await pool.execute(timeQuery, [userId]);

            res.json({
                success: true,
                pieData: [
                    { name: 'Enviados', value: sentCount[0].count },
                    { name: 'Errores', value: failedCount[0].count }
                ],
                timeData: timeData
            });
        } catch (error) {
            console.error('[SMS-CHARTS] Error:', error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Scheduler de Campañas SMS
    const startSmsScheduler = () => {
        console.log('🕐 Iniciando scheduler de SMS Premium...');
        setInterval(async () => {
            try {
                const connection = await pool.getConnection();
                try {
                    const nowISO = new Date().toISOString().slice(0, 19).replace('T', ' ');

                    // 1. Buscar campañas pendientes listas para enviar
                    const [pendingCampaigns] = await connection.execute(
                        'SELECT * FROM sms_campaigns WHERE status = \'pending\' AND scheduled_at <= ?',
                        [nowISO]
                    );

                    for (const campaign of pendingCampaigns) {
                        console.log(`[SMS-SCHEDULER] Procesando campaña: ${campaign.name} (${campaign.id})`);

                        // Actualizar estado a activo
                        await connection.execute('UPDATE sms_campaigns SET status = \'active\' WHERE id = ?', [campaign.id]);

                        // Obtener destinatarios pendientes
                        const [recipients] = await connection.execute(
                            'SELECT * FROM sms_campaign_recipients WHERE campaign_id = ? AND status = \'pending\'',
                            [campaign.id]
                        );

                        if (recipients.length === 0) {
                            await connection.execute('UPDATE sms_campaigns SET status = \'completed\' WHERE id = ?', [campaign.id]);
                            continue;
                        }

                        // Obtener token
                        const authRes = await axios.post('https://mayten.cloud/auth', {
                            username: process.env.SMS_MAYTEN_USERNAME,
                            password: process.env.SMS_MAYTEN_PASSWORD
                        });
                        const token = authRes.data.token;

                        // Procesar envíos
                        const messagesToSend = recipients.map(r => ({
                            mensaje: campaign.message_template.replace(/{nombre}/g, r.name || ''),
                            telefono: r.phone.replace(/\D/g, ''),
                            identificador: `camp_${campaign.id}_${r.id}`
                        }));

                        // Enviar a Mayten
                        const totalCost = messagesToSend.length * 0.10;

                        // Verificar saldo del usuario
                        const [user] = await connection.execute('SELECT sms_balance FROM users WHERE id = ?', [campaign.user_id]);
                        if (user[0].sms_balance < totalCost) {
                            console.error(`[SMS-SCHEDULER] Saldo insuficiente para usuario ${campaign.user_id}`);
                            await connection.execute('UPDATE sms_campaigns SET status = \'failed\' WHERE id = ?', [campaign.id]);
                            continue;
                        }

                        try {
                            await axios.post('https://mayten.cloud/api/Mensajes/Texto', {
                                origen: 'SMS_CORTO',
                                mensajes: messagesToSend
                            }, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });

                            // Descontar saldo y actualizar estados
                            await connection.execute('UPDATE users SET sms_balance = sms_balance - ? WHERE id = ?', [totalCost, campaign.user_id]);

                            await connection.execute(
                                'UPDATE sms_campaign_recipients SET status = \'sent\' WHERE campaign_id = ? AND status = \'pending\'',
                                [campaign.id]
                            );

                            await connection.execute(
                                'UPDATE sms_campaigns SET status = \'completed\', sent_count = ?, updated_at = NOW() WHERE id = ?',
                                [recipients.length, campaign.id]
                            );

                            // Registrar en historial
                            for (const r of recipients) {
                                await connection.execute(
                                    'INSERT INTO sms_history (campaign_id, user_id, phone, message, status, sent_at) VALUES (?, ?, ?, ?, ?, NOW())',
                                    [campaign.id, campaign.user_id, r.phone, campaign.message_template.replace(/{nombre}/g, r.name || ''), 'sent']
                                );
                            }

                        } catch (sendErr) {
                            console.error(`[SMS-SCHEDULER] Error enviando SMS para campaña ${campaign.id}:`, sendErr.message);
                            await connection.execute('UPDATE sms_campaigns SET status = \'failed\' WHERE id = ?', [campaign.id]);
                        }
                    }
                } finally {
                    connection.release();
                }
            } catch (err) {
                console.error('[SMS-SCHEDULER] Error crítico:', err.message);
            }
        }, 60000); // Cada minuto
    };

    startSmsScheduler();
};
