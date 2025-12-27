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

// Función para procesar plantilla con variables
function processTemplate(template, appointment) {
    let message = template.message;
    
    // Formatear fecha correctamente
    let dateStr = appointment.appointment_date;
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
        dateStr = dateStr.split('T')[0];
    }
    const formattedDate = moment(dateStr, 'YYYY-MM-DD').format('DD/MM/YYYY');
    
    // Formatear hora
    const timeStr = appointment.appointment_time.toString().substring(0, 5);

    message = message
        .replace(/{nombre}/g, appointment.patient_name)
        .replace(/{fecha}/g, formattedDate)
        .replace(/{hora}/g, timeStr)
        .replace(/{doctor}/g, appointment.doctor_name || 'el equipo');

    return message;
}

// Función para enviar recordatorio por WhatsApp
async function sendReminder(pool, sessions, appointment) {
    try {
        console.log(`[REMINDERS] Procesando recordatorio para cita ${appointment.id}`);

        // Obtener sessionId desde session_id (phone_number)
        const connection = await pool.getConnection();
        let sessionId = null;

        try {
            const [sessionRows] = await connection.execute(
                'SELECT session_id FROM user_sessions WHERE phone = ? AND is_active = 1 LIMIT 1',
                [appointment.session_id]
            );

            if (sessionRows.length > 0) {
                sessionId = sessionRows[0].session_id;
            }
        } finally {
            connection.release();
        }

        if (!sessionId) {
            console.log(`[REMINDERS] No hay sesión activa para ${appointment.session_id}`);
            return false;
        }

        // Obtener plantilla
        const templates = getDefaultTemplates();
        const template = templates.find(t => t.id === (appointment.notification_template || 'default'));

        if (!template) {
            console.log(`[REMINDERS] Plantilla ${appointment.notification_template} no encontrada`);
            return false;
        }

        // Procesar mensaje
        const message = processTemplate(template, appointment);

        // Formatear número de teléfono
        let phoneNumber = appointment.patient_phone.toString().replace(/[^0-9]/g, '');
        
        // Asegurar que el número sea válido
        if (!phoneNumber) {
            console.log(`[REMINDERS] ❌ Número de teléfono inválido para cita ${appointment.id}`);
            return false;
        }

        console.log(`[REMINDERS] 📤 Intentando enviar a ${phoneNumber} desde sesión ${sessionId}`);
        console.log(`[REMINDERS] 💬 Mensaje: ${message}`);

        // NUEVO: Usar whatsapp-loader para cargar la sesión automáticamente
        const { sendWhatsAppMessage } = require('./whatsapp-loader');
        const result = await sendWhatsAppMessage(sessionId, phoneNumber, message);

        if (!result.success) {
            console.log(`[REMINDERS] ❌ Falló el envío: ${result.error}`);
            return false;
        }

        // Marcar como enviado
        const connection2 = await pool.getConnection();
        try {
            await connection2.execute(
                'UPDATE appointments SET reminder_sent = TRUE, updated_at = NOW() WHERE id = ?',
                [appointment.id]
            );
        } finally {
            connection2.release();
        }

        console.log(`[REMINDERS] ✅ Recordatorio enviado para cita ${appointment.id}`);
        return true;

    } catch (error) {
        console.error(`[REMINDERS] ❌ Error enviando recordatorio para cita ${appointment.id}:`, error);
        return false;
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
