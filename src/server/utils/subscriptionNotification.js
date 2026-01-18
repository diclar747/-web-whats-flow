const fs = require('fs');
const path = require('path');
const { sendWhatsAppMessage } = require('../whatsapp-loader');

const ADMIN_PHONE = '595994854167';
const BASE_AUTH_DIR = path.join(__dirname, '../../auth_info_multi');

/**
 * Dynamically finds the correct sessionId for the admin phone number
 */
async function findAdminSessionId() {
    try {
        // 1. Intentar buscar en las carpetas de autenticación
        if (fs.existsSync(BASE_AUTH_DIR)) {
            const dirs = fs.readdirSync(BASE_AUTH_DIR);

            // Priorizar por fecha de modificación (más recientes primero)
            const stats = dirs.map(dir => {
                const fullPath = path.join(BASE_AUTH_DIR, dir);
                return {
                    name: dir,
                    path: path.join(fullPath, 'creds.json'),
                    time: fs.statSync(fullPath).mtime.getTime()
                };
            }).filter(d => fs.existsSync(d.path))
                .sort((a, b) => b.time - a.time);

            for (const item of stats) {
                try {
                    const creds = JSON.parse(fs.readFileSync(item.path, 'utf8'));
                    const myId = creds.me && creds.me.id;
                    if (myId && myId.includes(ADMIN_PHONE)) {
                        console.log(`[SUBSCRIPTION-NOTIF] 🔍 Encontrada sesión admin en carpeta: ${item.name}`);
                        return item.name;
                    }
                } catch (e) {
                    // Ignorar errores de lectura/json
                }
            }
        }

        // 2. Fallback: Usar el ID que sabemos que funciona actualmente (53f080714c0394eb)
        return '53f080714c0394eb';
    } catch (error) {
        console.error('[SUBSCRIPTION-NOTIF] Error buscando sesión admin:', error.message);
        return '53f080714c0394eb';
    }
}


/**
 * Sends a welcome/activation message when a plan is approved or manually assigned
 * 
 * @param {string} phone - Client's phone number
 * @param {string} planName - Name of the activated plan
 * @param {number} days - Duration of the plan in days
 * @returns {Promise<boolean>}
 */
async function sendPlanActivationMessage(phone, planName, days) {
    try {
        if (!phone) {
            console.warn('[SUBSCRIPTION-NOTIF] ⚠️ No phone provided, skipping notification');
            return false;
        }

        const cleanPhone = phone.toString().replace(/[^0-9]/g, '');

        const messages = {
            basic: `🎉 ¡FELICIDADES! 🎉\n\n` +
                `✨ Tu Plan *BÁSICO* ha sido activado exitosamente ✨\n\n` +
                `🚀 ¡Gracias por confiar en nosotros!\n\n` +
                `📋 Detalles de tu plan:\n` +
                `• Plan: Básico\n` +
                `• Duración: ${days} días\n` +
                `• Estado: ✅ ACTIVO\n\n` +
                `💡 Ahora puedes disfrutar de todas las funcionalidades de Winsap.\n\n` +
                `¿Necesitas ayuda? Estamos aquí para ti 🤝\n\n` +
                `¡Bienvenido a Winsap! 💙`,

            standard: `🎊 ¡EXCELENTE ELECCIÓN! 🎊\n\n` +
                `⭐ Tu Plan *ESTÁNDAR* ha sido activado con éxito ⭐\n\n` +
                `🙌 ¡Muchas gracias por tu preferencia!\n\n` +
                `📋 Detalles de tu plan:\n` +
                `• Plan: Estándar\n` +
                `• Duración: ${days} días\n` +
                `• Estado: ✅ ACTIVO\n\n` +
                `🎯 Ahora tienes acceso a:\n` +
                `✅ Todas las funciones básicas\n` +
                `✅ Campañas avanzadas\n` +
                `✅ Más contactos y mensajes\n` +
                `✅ Soporte prioritario\n\n` +
                `💪 ¡Estás listo para llevar tu negocio al siguiente nivel!\n\n` +
                `¿Preguntas? Contáctanos cuando quieras 📞\n\n` +
                `¡Bienvenido a Winsap! 🚀`,

            premium: `🏆 ¡BIENVENIDO AL PLAN PREMIUM! 🏆\n\n` +
                `👑 Tu Plan *PREMIUM* ha sido activado exitosamente 👑\n\n` +
                `🌟 ¡Gracias por elegirnos como tu socio tecnológico!\n\n` +
                `📋 Detalles de tu plan:\n` +
                `• Plan: Premium\n` +
                `• Duración: ${days} días\n` +
                `• Estado: ✅ ACTIVO\n\n` +
                `💎 Tienes acceso ILIMITADO a:\n` +
                `✅ TODAS las funcionalidades\n` +
                `✅ Campañas ilimitadas\n` +
                `✅ Contactos sin límite\n` +
                `✅ Bot IA avanzado\n` +
                `✅ API personalizada\n` +
                `✅ Soporte VIP 24/7\n` +
                `✅ Asesoría personalizada\n\n` +
                `🎁 ¡Y muchos beneficios exclusivos más!\n\n` +
                `🔥 ¡Prepárate para transformar tu negocio!\n\n` +
                `Tu éxito es nuestro éxito 💪\n\n` +
                `¡Bienvenido a la experiencia Premium de Winsap! 🎯`,

            pro: `🚀 ¡PLAN PRO ACTIVADO! 🚀\n\n` +
                `💼 Tu Plan *PROFESIONAL* está listo para usar 💼\n\n` +
                `🎯 ¡Gracias por confiar en nuestra plataforma!\n\n` +
                `📋 Detalles de tu plan:\n` +
                `• Plan: Profesional\n` +
                `• Duración: ${days} días\n` +
                `• Estado: ✅ ACTIVO\n\n` +
                `⚡ Funcionalidades PRO desbloqueadas:\n` +
                `✅ Multi-agentes\n` +
                `✅ Campañas automatizadas\n` +
                `✅ Gestión avanzada de contactos\n` +
                `✅ Reportes detallados\n` +
                `✅ Integraciones premium\n` +
                `✅ Soporte preferencial\n\n` +
                `🎓 ¿Necesitas capacitación? ¡Te ayudamos!\n\n` +
                `📈 ¡Impulsa tu negocio con Winsap Pro!\n\n` +
                `Estamos contigo en cada paso 🤝\n\n` +
                `¡Bienvenido! 💙`
        };

        // Formatear el nombre del plan para el lookup
        const planKey = planName.toLowerCase().trim().replace(/\s+/g, '_');

        // Fallback: Si no hay un mensaje específico, construir uno genérico
        let message = messages[planKey];

        if (!message) {
            if (planKey.includes('basic') || planKey.includes('basico')) {
                message = messages.basic;
            } else if (planKey.includes('standard') || planKey.includes('estandar')) {
                message = messages.standard;
            } else if (planKey.includes('premium')) {
                message = messages.premium;
            } else if (planKey.includes('pro') || planKey.includes('profesional')) {
                message = messages.pro;
            } else {
                message = `✅ *¡Tu Plan ha sido activado!* ✅\n\n` +
                    `Felicidades, tu plan *${planName}* ya está activo.\n\n` +
                    `📋 Detalles:\n` +
                    `• Plan: ${planName}\n` +
                    `• Duración: ${days} días\n` +
                    `• Estado: ✅ ACTIVO\n\n` +
                    `¡Gracias por confiar en nosotros! 🚀`;
            }
        }

        // Usar whatsapp-loader para enviar el mensaje desde la sesión del admin
        const adminSessionId = await findAdminSessionId();
        console.log(`[SUBSCRIPTION-NOTIF] 📨 Enviando notificación de plan ${planName} a ${cleanPhone} desde ${adminSessionId}`);

        const result = await sendWhatsAppMessage(adminSessionId, cleanPhone, message);

        if (result.success) {
            console.log(`[SUBSCRIPTION-NOTIF] ✅ Notificación enviada exitosamente desde ${adminSessionId}`);
            return true;
        } else {
            console.error(`[SUBSCRIPTION-NOTIF] ❌ Error al enviar notificación desde ${adminSessionId}:`, result.error);
            return false;
        }

    } catch (error) {
        console.error(`[SUBSCRIPTION-NOTIF] ❌ Error inesperado en utilidad de notificación:`, error);
        return false;
    }
}

module.exports = {
    sendPlanActivationMessage,
    findAdminSessionId
};
