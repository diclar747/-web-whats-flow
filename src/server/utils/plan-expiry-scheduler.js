const { sendPlanExpiryReminderEmail } = require('./subscriptionEmail');

/**
 * Servicio para verificar y notificar vencimientos de planes
 */
async function startPlanExpiryScheduler(pool, sessions) {
    console.log('[PLAN-SCHEDULER] 🕒 Iniciando programador de vencimientos...');

    // Ejecutar cada 24 horas (una vez al día)
    // Para pruebas inmediatas, se puede reducir, pero lo ideal es diario
    const ONE_DAY = 24 * 60 * 60 * 1000;

    const checkExpirations = async () => {
        console.log('[PLAN-SCHEDULER] 🔍 Verificando planes que vencen hoy...');
        const connection = await pool.getConnection();

        try {
            // 1. Buscar usuarios cuyos planes vencen hoy (mismo día, sin importar la hora exacta)
            // Solo usuarios que tengan un plan asignado (plan_id IS NOT NULL)
            const [usersToNotify] = await connection.execute(`
                SELECT u.id, u.name, u.email, u.phone, u.plan_expires_at, p.name as plan_name
                FROM users u
                INNER JOIN plans p ON u.plan_id = p.id
                WHERE DATE(u.plan_expires_at) = CURDATE()
                AND u.role != 'super_admin'
            `);

            console.log(`[PLAN-SCHEDULER] 👥 Usuarios encontrados para notificar: ${usersToNotify.length}`);

            for (const user of usersToNotify) {
                console.log(`[PLAN-SCHEDULER] 🔔 Notificando a ${user.name} (${user.phone})`);

                // --- NOTIFICACIÓN VÍA EMAIL ---
                if (user.email && user.email.includes('@') && !user.email.includes('.local')) {
                    await sendPlanExpiryReminderEmail(user.email, user.name, user.plan_name, user.plan_expires_at);
                } else {
                    console.log(`[PLAN-SCHEDULER] 📧 Saltando email para ${user.name} (email no válido o local)`);
                }

                // --- NOTIFICACIÓN VÍA WHATSAPP ---
                if (user.phone) {
                    await sendWhatsAppReminder(user, sessions);
                }
            }

        } catch (error) {
            console.error('[PLAN-SCHEDULER] ❌ Error en el proceso de verificación:', error);
        } finally {
            connection.release();
        }
    };

    // Ejecutar inmediatamente al iniciar
    checkExpirations();

    // Programar ejecución diaria
    setInterval(checkExpirations, ONE_DAY);
}

/**
 * Enviar recordatorio vía WhatsApp usando una sesión administrativa activa
 */
async function sendWhatsAppReminder(user, sessions) {
    // Definir el número del Super Admin explícitamente
    const ADMIN_PHONE = '595994854167';

    console.log(`[PLAN-SCHEDULER] 🚀 Iniciando envío de WhatsApp a ${user.phone}`);
    console.log(`[PLAN-SCHEDULER] 🔍 Buscando sesión del Super Admin: ${ADMIN_PHONE}`);

    if (!sessions || sessions.size === 0) {
        console.log('[PLAN-SCHEDULER] ❌ No hay sesiones activas en el sistema.');
        return;
    }

    let masterSock = null;

    // 1. Buscar específicamente la sesión del Super Admin
    for (const [sessId, sessInfo] of sessions.entries()) {
        if (sessInfo.sock && sessInfo.sock.user) {
            const jid = sessInfo.sock.user.id || '';
            const sessPhone = jid.split(':')[0].split('@')[0];

            // Normalizar número por si acaso (sacar caracteres no numéricos)
            const normalizedSessPhone = sessPhone.replace(/\D/g, '');
            console.log(`[PLAN-SCHEDULER] 🔎 Analizando sesión ${sessId}: ${normalizedSessPhone} (Estado: ${sessInfo.state || 'Unknown'})`);

            if (normalizedSessPhone === ADMIN_PHONE) {
                if (sessInfo.state === 'connected' || sessInfo.status === 'authenticated') {
                    masterSock = sessInfo.sock;
                    console.log(`[PLAN-SCHEDULER] ✅ Sesión de Super Admin ENCONTRADA y CONECTADA: ${sessId}`);
                    break;
                } else {
                    console.log(`[PLAN-SCHEDULER] ⚠️ Sesión de Super Admin encontrada pero NO conectada/autenticada.`);
                }
            }
        }
    }

    // 2. Si no se encuentra la del admin, intentar buscar cualquier otra activa (Fallback opcional)
    if (!masterSock) {
        console.log('[PLAN-SCHEDULER] ⚠️ No se encontró la sesión del Super Admin activa. Buscando alternativa...');
        for (const [sessId, sessInfo] of sessions.entries()) {
            if (sessInfo.sock && (sessInfo.state === 'connected' || sessInfo.status === 'authenticated')) {
                masterSock = sessInfo.sock;
                console.log(`[PLAN-SCHEDULER] 🔄 Usando sesión alternativa: ${sessId}`);
                break;
            }
        }
    }

    if (!masterSock) {
        console.log(`[PLAN-SCHEDULER] ❌ FALLO TOTAL: No hay ninguna sesión válida disponible para enviar el mensaje.`);
        return;
    }

    try {
        const userJid = `${user.phone.replace(/\D/g, '')}@s.whatsapp.net`;
        const message = `Winsap, recuerda que hoy vence su plan.\n\nHola *${user.name}*, su plan actual (*${user.plan_name}*) finaliza hoy.\n\nLe sugerimos renovar su suscripción para mantener su cuenta activa y evitar la interrupción del servicio.`;

        await masterSock.sendMessage(userJid, { text: message });
        console.log(`[PLAN-SCHEDULER] ✅ WhatsApp enviado a ${user.phone}`);
    } catch (err) {
        console.error(`[PLAN-SCHEDULER] ❌ Error enviando WhatsApp a ${user.phone}:`, err.message);
    }
}

/**
 * Enviar mensaje genérico de WhatsApp usando la lógica de sesión del admin
 */
async function sendGenericWhatsApp(user, sessions, messageText) {
    // Definir el número del Super Admin explícitamente
    const ADMIN_PHONE = '595994854167';

    if (!sessions || sessions.size === 0) {
        console.log('[bulk-sender] ❌ No hay mapa de sesiones o está vacío');
        return false;
    }

    let masterSock = null;
    let fallbackSock = null;

    console.log(`[bulk-sender] 🔍 Buscando sesión activa entre ${sessions.size} sesiones total...`);

    // 1. Iterar sobre las sesiones para encontrar la más apta
    for (const [sessId, sessInfo] of sessions.entries()) {
        const isConnected = sessInfo.isConnected === true || sessInfo.status === 'connected' || sessInfo.state === 'connected';

        if (isConnected && sessInfo.sock) {
            // Extraer número de la sesión
            let sessPhone = '';
            if (sessInfo.sock.user && sessInfo.sock.user.id) {
                sessPhone = sessInfo.sock.user.id.split(':')[0].split('@')[0].replace(/\D/g, '');
            } else if (sessInfo.phoneNumber) {
                sessPhone = sessInfo.phoneNumber.replace(/\D/g, '');
            }

            console.log(`[bulk-sender]   - Sesión ${sessId}: phone=${sessPhone}, isConnected=${isConnected}, userId=${sessInfo.userId}`);

            // Prioridad 1: Super Admin (por Teléfono, por ID de Usuario o por Key del Map de sesiones)
            const isAdminPhone = (sessPhone === ADMIN_PHONE);
            const isAdminID = (sessInfo.userId === 2 || sessInfo.userId === '2');
            const isSessIdAdmin = (sessId === '2' || sessId === 2 || sessId === ADMIN_PHONE);

            if (isAdminPhone || isAdminID || isSessIdAdmin) {
                console.log(`[bulk-sender] ⭐ Sesión Super Admin encontrada: ${sessId}`);
                masterSock = sessInfo.sock;
                break;
            }

            // Fallback: Cualquier sesión conectada
            if (!fallbackSock) {
                fallbackSock = sessInfo.sock;
            }
        }
    }

    // Usar fallback si no se encontró al Super Admin
    if (!masterSock && fallbackSock) {
        console.log('[bulk-sender] ⚠️ Super Admin no disponible, usando sesión fallback conectada');
        masterSock = fallbackSock;
    }

    if (!masterSock) {
        console.log(`[bulk-sender] ❌ No se encontró NINGUNA sesión conectada para enviar a ${user.phone}`);
        return false;
    }

    try {
        const userJid = `${user.phone.replace(/\D/g, '')}@s.whatsapp.net`;
        await masterSock.sendMessage(userJid, { text: messageText });
        console.log(`[bulk-sender] ✅ WhatsApp enviado a ${user.phone}`);
        return true;
    } catch (err) {
        console.error(`[bulk-sender] ❌ Error enviando WhatsApp a ${user.phone}:`, err.message);
        return false;
    }
}

module.exports = { startPlanExpiryScheduler, sendWhatsAppReminder, sendGenericWhatsApp };
