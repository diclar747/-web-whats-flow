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
                username: username || 'claudio@cnid.com.py',
                password: password || 'Cadc@1978'
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

    // Enviar SMS
    app.post('/api/sms/send', async (req, res) => {
        const connection = await pool.getConnection();
        try {
            const { userId, messages, token } = req.body; // messages: [{ mensaje, telefono, identificador }]

            if (!userId || !messages || !messages.length || !token) {
                return res.status(400).json({ success: false, error: 'Faltan datos requeridos (userId, messages, token)' });
            }

            // Verificar saldo (cantidad de SMS disponibles)
            const [user] = await connection.execute('SELECT sms_balance FROM users WHERE id = ?', [userId]);
            if (!user.length) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            const currentBalance = parseInt(user[0].sms_balance) || 0;
            const requiredSms = messages.length;

            if (currentBalance < requiredSms) {
                return res.status(403).json({
                    success: false,
                    error: `Saldo insuficiente. Tiene ${currentBalance} SMS, necesita ${requiredSms} SMS`,
                    balance: currentBalance,
                    required: requiredSms
                });
            }

            // Enviar a Mayten
            const response = await axios.post('https://mayten.cloud/api/Mensajes/Texto', {
                origen: 'SMS_CORTO',
                mensajes: messages
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            // Descontar saldo (1 SMS por mensaje)
            await connection.execute(
                'UPDATE users SET sms_balance = sms_balance - ? WHERE id = ?',
                [messages.length, userId]
            );

            // Registrar en historial
            for (const msg of messages) {
                await connection.execute(
                    'INSERT INTO sms_history (user_id, phone, message, status, sent_at) VALUES (?, ?, ?, ?, NOW())',
                    [userId, msg.telefono, msg.mensaje, 'sent']
                );
            }

            // Crear un registro de campaña para este envío directo
            await connection.execute(
                'INSERT INTO sms_campaigns (user_id, name, message_template, status, total_recipients, sent_count, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    userId,
                    req.body.campaignName || `Envío Directo ${new Date().toLocaleString()}`,
                    messages[0].mensaje,
                    'completed',
                    messages.length,
                    messages.length,
                    'Envío Directo'
                ]
            );

            res.json({
                success: true,
                data: response.data,
                newBalance: currentBalance - messages.length
            });

        } catch (error) {
            console.error('[SMS-SEND] Error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error al enviar SMS',
                details: error.response?.data || error.message
            });
        } finally {
            connection.release();
        }
    });

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
                            username: 'claudio@cnid.com.py',
                            password: 'Cadc@1978'
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
