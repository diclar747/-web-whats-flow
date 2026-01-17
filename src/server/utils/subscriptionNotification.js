/**
 * Utility to send WhatsApp notifications for subscription plan activations and approvals
 */
const { sendWhatsAppMessage } = require('../whatsapp-loader');

const ADMIN_SESSION_ID = 'session_595994854167'; // Sesión del admin principal para enviar notificaciones
const DEFAULT_PHONE = '595994854167';

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
                `💡 Ahora puedes disfrutar de todas las funcionalidades básicas de WhatsFlow.\n\n` +
                `¿Necesitas ayuda? Estamos aquí para ti 🤝\n\n` +
                `¡Bienvenido a WhatsFlow! 💙`,

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
                `¡Bienvenido a WhatsFlow! 🚀`,

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
                `¡Bienvenido a la experiencia Premium de WhatsFlow! 🎯`,

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
                `📈 ¡Impulsa tu negocio con WhatsFlow Pro!\n\n` +
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
        console.log(`[SUBSCRIPTION-NOTIF] 📨 Enviando notificación de plan ${planName} a ${cleanPhone} desde ${ADMIN_SESSION_ID}`);

        const result = await sendWhatsAppMessage(ADMIN_SESSION_ID, cleanPhone, message);

        if (result.success) {
            console.log(`[SUBSCRIPTION-NOTIF] ✅ Notificación enviada exitosamente`);
            return true;
        } else {
            console.error(`[SUBSCRIPTION-NOTIF] ❌ Error al enviar notificación:`, result.error);
            return false;
        }

    } catch (error) {
        console.error(`[SUBSCRIPTION-NOTIF] ❌ Error inesperado en utilidad de notificación:`, error);
        return false;
    }
}

module.exports = {
    sendPlanActivationMessage
};
