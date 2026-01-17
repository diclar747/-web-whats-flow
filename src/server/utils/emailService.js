const nodemailer = require('nodemailer');

/**
 * Configuración del transportador SMTP para envío de correos
 * Usando credenciales proporcionadas para cnid.py@gmail.com
 */
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true para 465, false para otros puertos
    auth: {
        user: 'cnid.py@gmail.com',
        pass: 'jwny hrlq brzg iamu'
    }
});

/**
 * Verificar la configuración del transportador
 */
transporter.verify((error, success) => {
    if (error) {
        console.error('[EMAIL] ❌ Error en configuración SMTP:', error);
    } else {
        console.log('[EMAIL] ✅ Servidor SMTP listo para enviar correos');
    }
});

/**
 * Logo SVG de Winsap inline para emails
 */
const WINSAP_LOGO_SVG = `
<svg width="120" height="120" viewBox="0 0 512 512" style="margin: 0 auto; display: block;">
    <defs>
        <linearGradient id="winsapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#00d2ff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#32CD32;stop-opacity:1" />
        </linearGradient>
    </defs>
    <rect x="80" y="120" width="70" height="272" rx="35" fill="url(#winsapGradient)" transform="rotate(-15, 115, 256)" opacity="0.7"/>
    <rect x="221" y="160" width="70" height="192" rx="35" fill="url(#winsapGradient)" transform="rotate(-15, 256, 256)" opacity="0.9"/>
    <rect x="362" y="120" width="70" height="272" rx="35" fill="url(#winsapGradient)" transform="rotate(-15, 397, 256)"/>
    <path d="M100 400 Q 256 460, 412 400" fill="none" stroke="url(#winsapGradient)" stroke-width="12" stroke-linecap="round" opacity="0.3"/>
</svg>`;

/**
 * Estilos CSS comunes para emails
 */
const EMAIL_STYLES = `
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f4f4f4;
        margin: 0;
        padding: 0;
    }
    .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    .header {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        padding: 40px 20px;
        text-align: center;
    }
    .header h1 {
        color: #ffffff;
        margin: 10px 0 0 0;
        font-size: 28px;
        font-weight: 600;
    }
    .content {
        padding: 40px 30px;
    }
    .content h2 {
        color: #1f2937;
        margin-top: 0;
        margin-bottom: 20px;
        font-size: 22px;
    }
    .content p {
        color: #4b5563;
        margin-bottom: 20px;
        font-size: 16px;
    }
    .button-container {
        text-align: center;
        margin: 35px 0;
    }
    .button {
        display: inline-block;
        padding: 16px 40px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #ffffff;
        text-decoration: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
    }
    .info-box {
        background-color: #f3f4f6;
        border-left: 4px solid #10b981;
        padding: 15px;
        margin: 25px 0;
        border-radius: 4px;
    }
    .info-box p {
        margin: 0;
        color: #374151;
        font-size: 14px;
    }
    .footer {
        background-color: #f9fafb;
        padding: 25px 30px;
        text-align: center;
        border-top: 1px solid #e5e7eb;
    }
    .footer p {
        color: #6b7280;
        margin: 5px 0;
        font-size: 14px;
    }
    .link-text {
        word-break: break-all;
        color: #10b981;
        font-size: 14px;
        margin-top: 20px;
    }
`;

/**
 * Enviar correo de bienvenida con enlace de activación
 * @param {string} email - Email del destinatario
 * @param {string} name - Nombre del usuario
 * @param {string} token - Token de activación único
 * @returns {Promise<boolean>} - true si se envió correctamente
 */
async function sendWelcomeEmail(email, name, token) {
    try {
        const activationUrl = `https://crm.whats-flow.com/activate/${token}`;

        const mailOptions = {
            from: '"Winsap" <cnid.py@gmail.com>',
            to: email,
            subject: 'Bienvenido a Winsap - Activa tu Cuenta',
            html: `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>${EMAIL_STYLES}</style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            ${WINSAP_LOGO_SVG}
                            <h1>Winsap</h1>
                        </div>
                        <div class="content">
                            <h2>¡Bienvenido a Winsap!</h2>
                            <p>Hola <strong>${name}</strong>,</p>
                            <p>¡Gracias por registrarte en Winsap! Estamos emocionados de tenerte con nosotros.</p>
                            <p>Para completar tu registro y activar tu cuenta, por favor haz clic en el botón a continuación:</p>
                            
                            <div class="button-container">
                                <a href="${activationUrl}" class="button">Activar mi Cuenta</a>
                            </div>
                            
                            <div class="info-box">
                                <p><strong>⏱️ Este enlace expirará en 24 horas</strong> por razones de seguridad.</p>
                            </div>
                            
                            <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
                            <p class="link-text">${activationUrl}</p>
                            
                            <p style="margin-top: 30px;"><strong>¿Qué puedes hacer con Winsap?</strong></p>
                            <ul style="color: #4b5563; font-size: 15px; line-height: 1.8;">
                                <li>Gestionar múltiples cuentas de WhatsApp</li>
                                <li>Automatizar respuestas con chatbots</li>
                                <li>Organizar tus chats y contactos</li>
                                <li>Enviar mensajes masivos</li>
                                <li>Y mucho más...</li>
                            </ul>
                            
                            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
                                Si no creaste esta cuenta, puedes ignorar este correo de forma segura.
                            </p>
                        </div>
                        <div class="footer">
                            <p><strong>Winsap</strong> - Gestión de WhatsApp Empresarial</p>
                            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
Bienvenido a Winsap

Hola ${name},

¡Gracias por registrarte en Winsap! Estamos emocionados de tenerte con nosotros.

Para completar tu registro y activar tu cuenta, visita el siguiente enlace:
${activationUrl}

⏱️ Este enlace expirará en 24 horas por razones de seguridad.

¿Qué puedes hacer con Winsap?
• Gestionar múltiples cuentas de WhatsApp
• Automatizar respuestas con chatbots
• Organizar tus chats y contactos
• Enviar mensajes masivos
• Y mucho más...

Si no creaste esta cuenta, puedes ignorar este correo de forma segura.

---
Winsap - Gestión de WhatsApp Empresarial
Este es un correo automático, por favor no respondas a este mensaje.
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('[EMAIL] ✅ Correo de bienvenida enviado a:', email, '| MessageID:', info.messageId);
        return true;
    } catch (error) {
        console.error('[EMAIL] ❌ Error enviando correo de bienvenida:', error);
        return false;
    }
}

/**
 * Enviar correo de recuperación de contraseña
 * @param {string} email - Email del destinatario
 * @param {string} token - Token de recuperación único
 * @returns {Promise<boolean>} - true si se envió correctamente
 */
async function sendPasswordResetEmail(email, token) {
    try {
        const resetUrl = `https://crm.whats-flow.com/reset-password/${token}`;

        const mailOptions = {
            from: '"Winsap" <cnid.py@gmail.com>',
            to: email,
            subject: 'Recuperación de contraseña - Winsap',
            html: `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>${EMAIL_STYLES}</style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            ${WINSAP_LOGO_SVG}
                            <h1>Winsap</h1>
                        </div>
                        <div class="content">
                            <h2>Recuperación de Contraseña</h2>
                            <p>Hola,</p>
                            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Winsap.</p>
                            <p>Haz clic en el botón a continuación para crear una nueva contraseña:</p>
                            
                            <div class="button-container">
                                <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
                            </div>
                            
                            <div class="info-box">
                                <p><strong>⏱️ Este enlace expirará en 1 hora</strong> por razones de seguridad.</p>
                            </div>
                            
                            <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
                            <p class="link-text">${resetUrl}</p>
                            
                            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
                                Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.
                            </p>
                        </div>
                        <div class="footer">
                            <p><strong>Winsap</strong> - Gestión de WhatsApp Empresarial</p>
                            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
Recuperación de Contraseña - Winsap

Hola,

Recibimos una solicitud para restablecer la contraseña de tu cuenta en Winsap.

Para crear una nueva contraseña, visita el siguiente enlace:
${resetUrl}

⏱️ Este enlace expirará en 1 hora por razones de seguridad.

Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.

---
Winsap - Gestión de WhatsApp Empresarial
Este es un correo automático, por favor no respondas a este mensaje.
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('[EMAIL] ✅ Correo enviado exitosamente a:', email, '| MessageID:', info.messageId);
        return true;
    } catch (error) {
        console.error('[EMAIL] ❌ Error enviando correo:', error);
        return false;
    }
}

module.exports = {
    sendWelcomeEmail,
    sendPasswordResetEmail
};
