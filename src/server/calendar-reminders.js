/**
 * Servicio de Recordatorios Automáticos para Citas
 * Revisa periódicamente las citas y envía recordatorios por WhatsApp
 */

const moment = require('moment');

// Función para obtener plantillas predeterminadas
function getDefaultTemplates() {
    return [
        {
            id: 'default',
            name: 'Recordatorio Básico',
            message: 'Hola {nombre}, le recordamos su cita el {fecha} a las {hora}. Confirmenos su asistencia.',
            is_default: true
        },
        {
            id: 'formal',
            name: 'Recordatorio Formal',
            message: 'Estimado/a {nombre}, le informamos que tiene programada una cita para el {fecha} a las {hora}. Por favor, confirme su asistencia.',
            is_default: false
        },
        {
            id: 'friendly',
            name: 'Recordatorio Amigable',
            message: '¡Hola {nombre}! 👋 Te recordamos tu cita del {fecha} a las {hora}. ¿Nos confirmas que vendrás? 😊',
            is_default: false
        }
    ];
}

// Función para procesar plantilla con variables de forma flexible
function processTemplate(templateText, appointment) {
    let message = templateText;

    // Formatear fecha correctamente
    let dateStr = appointment.appointment_date;
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
        dateStr = dateStr.split('T')[0];
    }
    const formattedDate = moment(dateStr, 'YYYY-MM-DD').format('DD/MM/YYYY');

    // Formatear hora (asegurar formato HH:mm)
    let timeStr = appointment.appointment_time.toString();
    if (timeStr.includes(':')) {
        const parts = timeStr.split(':');
        timeStr = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    } else {
        timeStr = timeStr.substring(0, 5);
    }

    const doctorName = appointment.doctor_name || 'el equipo';
    const patientName = appointment.patient_name || 'Cliente';

    // Soportar múltiples formatos de variables: {nombre}, [Nombre], {fecha}, [Fecha], etc.
    const replacements = [
        { regex: /\{nombre\}|\[nombre\]|\[Nombre\]/gi, value: patientName },
        { regex: /\{fecha\}|\[fecha\]|\[Fecha\]/gi, value: formattedDate },
        { regex: /\{hora\}|\[hora\]|\[Hora\]/gi, value: timeStr },
        { regex: /\{doctor\}|\[doctor\]|\[Doctor\]/gi, value: doctorName },
        { regex: /\{paciente\}|\[paciente\]|\[Paciente\]/gi, value: patientName }
    ];

    replacements.forEach(r => {
        message = message.replace(r.regex, r.value);
    });

    return message;
}

// Función para enviar recordatorio por WhatsApp
async function sendReminder(pool, sessions, appointment) {
    const connection = await pool.getConnection();
    try {
        console.log(`[REMINDERS] --------------------------------------------------`);
        console.log(`[REMINDERS] 🔍 PROCESANDO CITA #${appointment.id}`);
        console.log(`[REMINDERS] 👤 Paciente: ${appointment.patient_name}`);
        console.log(`[REMINDERS] 🔑 SessionId Original: ${appointment.session_id}`);

        // 1. Identificar al dueño de la cita y buscar una sesión de WhatsApp activa
        const originalSessionId = appointment.session_id;
        let userPhone = null;
        let candidateSessionIds = [originalSessionId];

        // Buscar información del dueño en user_sessions
        const [sessionRows] = await connection.execute(
            'SELECT session_id, phone, owner_phone_number FROM user_sessions WHERE session_id = ? OR phone = ? OR owner_phone_number = ?',
            [originalSessionId, originalSessionId, originalSessionId]
        );

        if (sessionRows.length > 0) {
            userPhone = sessionRows[0].owner_phone_number || sessionRows[0].phone;
            // Recolectar todos los session_ids posibles para este usuario
            sessionRows.forEach(row => {
                if (row.session_id && !candidateSessionIds.includes(row.session_id)) candidateSessionIds.push(row.session_id);
                if (row.phone && !candidateSessionIds.includes(row.phone)) candidateSessionIds.push(row.phone);
            });
        }

        console.log(`[REMINDERS] 📱 Dueño: ${userPhone || 'Desconocido'} | Candidatos: ${candidateSessionIds.join(', ')}`);

        // 2. Obtener el mensaje de la plantilla
        let templateText = '';
        const templateId = appointment.notification_template || 'default';

        // Primero buscar en las predeterminadas
        const defaultTemplates = getDefaultTemplates();
        const defaultTemplate = defaultTemplates.find(t => t.id === templateId);

        if (defaultTemplate) {
            templateText = defaultTemplate.message;
        } else {
            // Buscar en bases de datos usando todos los IDs candidatos
            const placeholders = candidateSessionIds.map(() => '?').join(',');

            // Intentar en notification_templates
            const [customTemplates] = await connection.execute(
                `SELECT message FROM notification_templates WHERE session_id IN (${placeholders}) AND (id = ? OR name = ?) LIMIT 1`,
                [...candidateSessionIds, templateId, templateId]
            );

            if (customTemplates.length > 0) {
                templateText = customTemplates[0].message;
            } else {
                // Fallback a appointment_templates
                const [altTemplates] = await connection.execute(
                    `SELECT message_text FROM appointment_templates WHERE session_id IN (${placeholders}) AND (id = ? OR name = ?) LIMIT 1`,
                    [...candidateSessionIds, templateId, templateId]
                );
                if (altTemplates.length > 0) {
                    templateText = altTemplates[0].message_text;
                }
            }
        }

        if (!templateText) {
            console.warn(`[REMINDERS] ⚠️ Plantilla '${templateId}' no encontrada. Usando recordatorio genérico.`);
            templateText = defaultTemplates[0].message;
        }

        // 3. Procesar mensaje con variables de forma flexible
        const finalMessage = processTemplate(templateText, appointment);

        // 4. Formatear destino
        let patientPhone = appointment.patient_phone.toString().replace(/[^0-9]/g, '');
        if (patientPhone.length === 9) patientPhone = '595' + patientPhone;
        const jid = patientPhone.includes('@') ? patientPhone : `${patientPhone}@s.whatsapp.net`;

        console.log(`[REMINDERS] 📤 Enviando a: ${patientPhone}`);

        // 5. INTENTAR ENVÍO - Estrategia de múltiples intentos
        let sent = false;

        // PRIORIDAD: Buscar CUALQUIER sesión activa de este usuario que esté en memoria
        for (const sid of candidateSessionIds) {
            const memSession = sessions.get(sid);
            if (memSession && memSession.sock && memSession.isConnected) {
                try {
                    await memSession.sock.sendMessage(jid, { text: finalMessage });
                    console.log(`[REMINDERS] ✅ ENVIADO EXITOSAMENTE via sesión en memoria: ${sid}`);
                    sent = true;
                    break;
                } catch (err) {
                    console.error(`[REMINDERS] ❌ Error enviando via ${sid}:`, err.message);
                }
            }
        }

        // NUEVA ESTRATEGIA: Buscar en TODAS las sesiones activas una que coincida con el phoneNumber del dueño
        if (!sent && userPhone) {
            console.log(`[REMINDERS] 🔍 Buscando sesión activa para usuario ${userPhone}...`);
            let connectedCount = 0;
            let totalSessions = 0;
            for (const [sessionId, session] of sessions.entries()) {
                totalSessions++;
                // Verificar si tiene sock y sock.user (indica que está conectada)
                if (session && session.sock && session.sock.user) {
                    connectedCount++;
                    // Obtener phoneNumber desde sock.user
                    let sessionPhone = session.sock.user.id.split(':')[0];

                    if (connectedCount <= 5) {
                        console.log(`[REMINDERS]   📱 Sesión ${sessionId.substring(0, 16)}...: phone=${sessionPhone}`);
                    }

                    if (sessionPhone === userPhone) {
                        console.log(`[REMINDERS] 🎯 ENCONTRADA SESIÓN COINCIDENTE: ${sessionId}`);
                        try {
                            await session.sock.sendMessage(jid, { text: finalMessage });
                            console.log(`[REMINDERS] ✅ ENVIADO EXITOSAMENTE via búsqueda global de sesión: ${sessionId}`);
                            sent = true;
                            break;
                        } catch (err) {
                            console.error(`[REMINDERS] ❌ Error enviando via ${sessionId}:`, err.message);
                        }
                    }
                }
            }
            console.log(`[REMINDERS] 🔍 Total sesiones: ${totalSessions}, Conectadas: ${connectedCount}`);
        }

        // TERCERA OPCIÓN: Usar whatsapp-loader para la sesión original
        if (!sent) {
            console.log(`[REMINDERS] 🔄 Intentando carga bajo demanda para ${originalSessionId}...`);
            const { sendWhatsAppMessage } = require('./whatsapp-loader');
            const result = await sendWhatsAppMessage(originalSessionId, patientPhone, finalMessage);
            if (result.success) {
                console.log(`[REMINDERS] ✅ ENVIADO EXITOSAMENTE via whatsapp-loader`);
                sent = true;
            } else {
                console.error(`[REMINDERS] ❌ Error whatsapp-loader: ${result.error}`);
            }
        }

        if (sent) {
            await connection.execute(
                'UPDATE appointments SET reminder_sent = TRUE, updated_at = NOW() WHERE id = ?',
                [appointment.id]
            );
            return true;
        }

        console.error(`[REMINDERS] 🛑 FALLÓ ENVÍO FINAL para cita #${appointment.id}`);
        return false;

    } catch (error) {
        console.error(`[REMINDERS] 🛑 ERROR CRÍTICO:`, error);
        return false;
    } finally {
        connection.release();
    }
}

// Función principal que revisa citas y envía recordatorios
async function checkAndSendReminders(pool, sessions) {
    try {
        console.log('[REMINDERS] Revisando citas pendientes de recordatorio...');

        const connection = await pool.getConnection();
        try {
            // Buscar citas que necesitan recordatorio
            // - Estado: scheduled o confirmed
            // - reminder_sent = FALSE
            // - La hora del recordatorio ya pasó
            const [appointments] = await connection.execute(`
                SELECT *,
                TIMESTAMPDIFF(MINUTE, NOW(), CONCAT(appointment_date, ' ', appointment_time)) as minutes_until
                FROM appointments
                WHERE status IN ('scheduled', 'confirmed')
                AND reminder_sent = FALSE
                AND TIMESTAMPDIFF(MINUTE, NOW(), CONCAT(appointment_date, ' ', appointment_time)) <= reminder_time
                AND TIMESTAMPDIFF(MINUTE, NOW(), CONCAT(appointment_date, ' ', appointment_time)) > 0
                ORDER BY appointment_date, appointment_time
                LIMIT 50
            `);

            if (appointments.length > 0) {
                console.log(`[REMINDERS] ✅ Encontradas ${appointments.length} citas para enviar recordatorio:`);
                appointments.forEach(apt => {
                    const dateStr = apt.appointment_date.toString().split('T')[0];
                    const timeStr = apt.appointment_time.toString().substring(0, 5);
                    console.log(`  → Cita #${apt.id}: ${apt.patient_name} (${apt.patient_phone})`);
                    console.log(`    📅 Fecha/Hora: ${dateStr} ${timeStr}`);
                    console.log(`    ⏰ Faltan ${apt.minutes_until} minutos | Recordatorio: ${apt.reminder_time} min antes`);
                });
            } else {
                // Silencioso - no mostrar cuando no hay citas
                // console.log(`[REMINDERS] ℹ️  No hay citas pendientes de recordatorio en este momento`);
            }

            let sentCount = 0;
            for (const appointment of appointments) {
                const sent = await sendReminder(pool, sessions, appointment);
                if (sent) {
                    sentCount++;
                }

                // Esperar 1 segundo entre mensajes para evitar spam
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (sentCount > 0) {
                console.log(`[REMINDERS] ✅ Se enviaron ${sentCount} recordatorios`);
            }

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('[REMINDERS] ❌ Error revisando recordatorios:', error);
    }
}

// Iniciar servicio de recordatorios (cada 1 minuto)
function startReminderService(pool, sessions) {
    console.log('[REMINDERS] 📅 Iniciando servicio de recordatorios automáticos...');
    console.log('[REMINDERS] 🔄 Revisiones cada 1 minuto');

    // Ejecutar inmediatamente
    checkAndSendReminders(pool, sessions);

    // Luego cada 1 minuto
    setInterval(() => {
        checkAndSendReminders(pool, sessions);
    }, 1 * 60 * 1000); // 1 minuto
}

module.exports = {
    getDefaultTemplates,
    processTemplate,
    startReminderService,
    sendReminder,
    checkAndSendReminders
};
