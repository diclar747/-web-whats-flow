/**
 * Scheduler para Campañas Personalizadas
 * Envía mensajes automáticamente según la fecha de vencimiento
 */

const moment = require('moment');

let isSchedulerRunning = false;

/**
 * Reemplaza variables en la plantilla del mensaje
 */
function replaceVariables(template, data) {
    let message = template;

    // Reemplazar variables
    message = message.replace(/{nombre}/g, data.name);
    message = message.replace(/{monto}/g, data.amount ? data.amount.toLocaleString('es-PY') : '0');
    message = message.replace(/{fecha_vencimiento}/g, data.due_day);
    message = message.replace(/{cuotas_pendientes}/g, data.installments || 1);
    message = message.replace(/{cuota_actual}/g, `1 de ${data.installments || 1}`);

    return message;
}

/**
 * Procesa campañas activas y envía mensajes según fecha de vencimiento
 */
async function processCampaigns(pool, sessions) {
    if (!pool || !sessions) {
        console.log('[CAMPAIGN-SCHEDULER] ⚠️  Pool o sessions no disponibles');
        return;
    }

    try {
        const today = new Date();
        const currentDay = today.getDate();
        const currentHour = today.getHours();

        // Verificar horario permitido: 07:00 - 18:00
        if (currentHour < 7 || currentHour >= 18) {
            console.log(`[CAMPAIGN-SCHEDULER] ⏰ Fuera de horario (${currentHour}:00). Envíos permitidos: 07:00-18:00`);
            return;
        }

        console.log(`[CAMPAIGN-SCHEDULER] 🕐 Procesando campañas para el día ${currentDay} (${currentHour}:00)...`);

        // Obtener campañas activas
        const [campaigns] = await pool.execute(
            `SELECT * FROM personalized_campaigns WHERE status = 'active'`
        );

        if (campaigns.length === 0) {
            console.log('[CAMPAIGN-SCHEDULER] ℹ️  No hay campañas activas');
            return;
        }

        console.log(`[CAMPAIGN-SCHEDULER] 📋 ${campaigns.length} campañas activas encontradas`);

        for (const campaign of campaigns) {
            try {
                // Verificar límite de mensajes del plan del usuario
                const [userPlan] = await pool.execute(
                    `SELECT u.*, p.max_messages_per_month 
                     FROM users u
                     LEFT JOIN plans p ON u.plan_id = p.id
                     WHERE u.phone_number = ?`,
                    [campaign.session_id]
                );

                if (userPlan.length === 0) {
                    console.log(`[CAMPAIGN-SCHEDULER] ⚠️  Usuario no encontrado: ${campaign.session_id}`);
                    continue;
                }

                const user = userPlan[0];
                const maxMessages = user.max_messages_per_month || 0;
                const usedMessages = user.messages_sent_this_month || 0;
                const availableMessages = maxMessages - usedMessages;

                if (availableMessages <= 0) {
                    console.log(`[CAMPAIGN-SCHEDULER] ⛔ Sin mensajes disponibles para ${campaign.session_id} (${usedMessages}/${maxMessages} usados)`);
                    continue;
                }

                console.log(`[CAMPAIGN-SCHEDULER] 📊 ${campaign.session_id}: ${availableMessages} mensajes disponibles`);

                // Obtener destinatarios pendientes para hoy (limitar por mensajes disponibles)
                const limit = Math.min(50, availableMessages);
                const [recipients] = await pool.execute(
                    `SELECT * FROM campaign_recipients_detailed 
                     WHERE campaign_id = ? 
                     AND due_day = ? 
                     AND paid = FALSE 
                     AND status IN ('pending', 'failed')
                     LIMIT ?`,
                    [campaign.id, currentDay, limit]
                );

                if (recipients.length === 0) {
                    continue;
                }

                console.log(`[CAMPAIGN-SCHEDULER] 📤 Campaña "${campaign.name}": ${recipients.length} mensajes para enviar`);

                // Obtener sesión activa para enviar
                const sessionData = sessions.get(campaign.session_id);
                if (!sessionData || !sessionData.sock) {
                    console.log(`[CAMPAIGN-SCHEDULER] ⚠️  No hay sesión activa para ${campaign.session_id}`);
                    continue;
                }

                const sock = sessionData.sock;
                let sentCount = 0;

                // Enviar a cada destinatario
                for (const recipient of recipients) {
                    try {
                        // Reemplazar variables en la plantilla
                        const message = replaceVariables(campaign.message_template, {
                            name: recipient.name,
                            amount: recipient.amount,
                            due_day: recipient.due_day,
                            installments: recipient.installments
                        });

                        // Formatear número de WhatsApp
                        const whatsappNumber = recipient.phone_number + '@s.whatsapp.net';

                        // Enviar mensaje
                        const sentMessage = await sock.sendMessage(whatsappNumber, { text: message });

                        // Actualizar estado en BD
                        await pool.execute(
                            `UPDATE campaign_recipients_detailed 
                             SET status = 'sent', 
                                 message_id = ?,
                                 sent_at = NOW()
                             WHERE id = ?`,
                            [sentMessage.key.id, recipient.id]
                        );

                        // Actualizar contador de campaña
                        await pool.execute(
                            `UPDATE personalized_campaigns 
                             SET sent_count = sent_count + 1 
                             WHERE id = ?`,
                            [campaign.id]
                        );

                        // Descontar del plan del usuario desde user_sessions
                        await pool.execute(
                            `UPDATE user_sessions 
                             SET messages_sent_this_month = messages_sent_this_month + 1,
                                 messages_personalized = messages_personalized + 1
                             WHERE phone_number = ? OR session_id = ?`,
                            [campaign.session_id, campaign.session_id]
                        );

                        sentCount++;

                        console.log(`[CAMPAIGN-SCHEDULER] ✅ Mensaje enviado a ${recipient.name} (${recipient.phone_number}) [${sentCount}/${recipients.length}]`);

                        // Delay aleatorio entre envíos (evitar spam)
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000)); // 2-5 segundos

                    } catch (sendError) {
                        console.error(`[CAMPAIGN-SCHEDULER] ❌ Error enviando a ${recipient.phone_number}:`, sendError.message);

                        // Marcar como fallido
                        await pool.execute(
                            `UPDATE campaign_recipients_detailed 
                             SET status = 'failed', 
                                 error_message = ?
                             WHERE id = ?`,
                            [sendError.message, recipient.id]
                        );

                        await pool.execute(
                            `UPDATE personalized_campaigns 
                             SET failed_count = failed_count + 1 
                             WHERE id = ?`,
                            [campaign.id]
                        );
                    }
                }

                if (sentCount > 0) {
                    console.log(`[CAMPAIGN-SCHEDULER] ✅ Campaña "${campaign.name}": ${sentCount} mensajes enviados correctamente`);
                }

            } catch (campaignError) {
                console.error(`[CAMPAIGN-SCHEDULER] ❌ Error procesando campaña ${campaign.id}:`, campaignError.message);
            }
        }

        console.log('[CAMPAIGN-SCHEDULER] ✅ Procesamiento completado');

    } catch (error) {
        console.error('[CAMPAIGN-SCHEDULER] ❌ Error general:', error);
    }
}

/**
 * Inicia el scheduler automático
 */
function startScheduler(pool, sessions) {
    if (isSchedulerRunning) {
        console.log('[CAMPAIGN-SCHEDULER] ⚠️  Scheduler ya está corriendo');
        return;
    }

    console.log('[CAMPAIGN-SCHEDULER] 🚀 Iniciando scheduler automático...');
    isSchedulerRunning = true;

    // Ejecutar cada hora
    const INTERVAL = 60 * 60 * 1000; // 1 hora en milisegundos

    // Ejecutar inmediatamente
    processCampaigns(pool, sessions);

    // Programar ejecuciones periódicas
    setInterval(() => {
        processCampaigns(pool, sessions);
    }, INTERVAL);

    console.log('[CAMPAIGN-SCHEDULER] ✅ Scheduler iniciado (ejecución cada hora)');
}

/**
 * Actualiza estados de mensajes (delivered, read)
 */
async function updateMessageStatuses(pool, messageUpdate) {
    try {
        const messageId = messageUpdate.key.id;
        const update = messageUpdate.update;

        if (update.status === 2) { // Message delivered
            const [result] = await pool.execute(
                `UPDATE campaign_recipients_detailed 
                 SET status = 'delivered', delivered_at = NOW() 
                 WHERE message_id = ? AND status = 'sent'`,
                [messageId]
            );

            if (result.affectedRows > 0) {
                await pool.execute(
                    `UPDATE personalized_campaigns pc
                     JOIN campaign_recipients_detailed crd ON pc.id = crd.campaign_id
                     SET pc.delivered_count = (
                         SELECT COUNT(*) FROM campaign_recipients_detailed 
                         WHERE campaign_id = pc.id AND status = 'delivered'
                     )
                     WHERE crd.message_id = ?`,
                    [messageId]
                );
            }
        } else if (update.status === 3) { // Message read
            const [result] = await pool.execute(
                `UPDATE campaign_recipients_detailed 
                 SET status = 'read', read_at = NOW() 
                 WHERE message_id = ? AND status IN ('sent', 'delivered')`,
                [messageId]
            );

            if (result.affectedRows > 0) {
                await pool.execute(
                    `UPDATE personalized_campaigns pc
                     JOIN campaign_recipients_detailed crd ON pc.id = crd.campaign_id
                     SET pc.read_count = (
                         SELECT COUNT(*) FROM campaign_recipients_detailed 
                         WHERE campaign_id = pc.id AND status = 'read'
                     )
                     WHERE crd.message_id = ?`,
                    [messageId]
                );
            }
        }
    } catch (error) {
        console.error('[CAMPAIGN-SCHEDULER] Error actualizando estados:', error.message);
    }
}

module.exports = {
    startScheduler,
    processCampaigns,
    updateMessageStatuses
};
