const nodemailer = require('nodemailer');

/**
 * Configuración del transportador SMTP (Reutilizando configuración de emailService.js)
 */
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'cnid.py@gmail.com',
        pass: 'jwny hrlq brzg iamu'
    }
});

/**
 * Estilos CSS comunes para emails Premium
 */
const PREMIUM_EMAIL_STYLES = `
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1a1a; background-color: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 40px 20px; text-align: center; color: #ffffff; }
    .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; margin-bottom: 8px; }
    .badge { display: inline-block; padding: 6px 12px; background-color: rgba(255, 255, 255, 0.2); border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .content { padding: 40px; }
    .greeting { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 20px; }
    .plan-card { background-color: #f1f5f9; border-radius: 12px; padding: 25px; margin: 30px 0; border: 1px solid #e2e8f0; }
    .plan-name { font-size: 20px; font-weight: 700; color: #2563eb; margin-bottom: 8px; text-transform: uppercase; }
    .plan-detail { font-size: 14px; color: #64748b; margin-bottom: 4px; }
    .plan-price { font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 15px; }
    .status-active { color: #10b981; font-weight: 700; }
    .button { display: inline-block; padding: 16px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; transition: all 0.3s ease; }
    .footer { background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; }
    .footer p { margin: 5px 0; }
    .highlights { margin: 30px 0; padding: 0; list-style: none; }
    .highlight-item { margin-bottom: 12px; display: flex; align-items: flex-start; }
    .highlight-icon { margin-right: 12px; font-size: 18px; }
`;

/**
 * Enviar correo de solicitud de plan recibida
 */
async function sendPlanRequestEmail(email, name, planInfo) {
    try {
        const mailOptions = {
            from: '"Winsap" <cnid.py@gmail.com>',
            to: email,
            subject: `📋 Solicitud de Plan Recibida: ${planInfo.name}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>${PREMIUM_EMAIL_STYLES}</style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">Winsap</div>
                            <div class="badge">Solicitud en Proceso</div>
                        </div>
                        <div class="content">
                            <div class="greeting">¡Hola, ${name}! 👋</div>
                            <p>Hemos recibido tu solicitud para el plan <strong>${planInfo.name}</strong>. Nuestro equipo administrativo está verificando los detalles para activar tu suscripción lo antes posible.</p>
                            
                            <div class="plan-card">
                                <div class="plan-name">${planInfo.name}</div>
                                <div class="plan-detail">ID de Solicitud: #${Math.floor(Math.random() * 9000) + 1000}</div>
                                <div class="plan-price">Gs. ${planInfo.price.toLocaleString()}</div>
                                <p style="margin-top: 15px; font-size: 14px; color: #475569;">
                                    <strong>Instrucciones de Pago:</strong><br>
                                    📌 Transferencia: Banco UENO<br>
                                    📌 Alias: 3626142
                                </p>
                            </div>

                            <p>Una vez realizado el pago, por favor asegúrate de haber enviado el comprobante (si el sistema te lo solicitó) o espera a que validemos la transacción.</p>

                            <p style="margin-top: 30px;">¡Gracias por unirte a la plataforma líder de gestión de WhatsApp!</p>
                        </div>
                        <div class="footer">
                            <p><strong>Winsap Enterprise</strong></p>
                            <p>Asunción, Paraguay • Soporte 24/7</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('[EMAIL-NOTIF] ✅ Solicitud enviada a:', email);
        return true;
    } catch (error) {
        console.error('[EMAIL-NOTIF] ❌ Error enviando email de solicitud:', error);
        return false;
    }
}

/**
 * Enviar correo de plan aprobado/activado
 */
async function sendPlanApprovalEmail(email, name, planInfo) {
    try {
        const mailOptions = {
            from: '"Winsap" <cnid.py@gmail.com>',
            to: email,
            subject: `🎉 ¡Plan Activado con Éxito! - Winsap`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>${PREMIUM_EMAIL_STYLES}</style>
                </head>
                <body>
                    <div class="container">
                        <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                            <div class="logo">Winsap</div>
                            <div class="badge" style="background-color: rgba(255, 255, 255, 0.3);">¡Cuenta Activa!</div>
                        </div>
                        <div class="content">
                            <div class="greeting">¡Buenas noticias, ${name}! 🎊</div>
                            <p>Tu plan <strong>${planInfo.name}</strong> ha sido aprobado y ya se encuentra totalmente activado. Ya puedes disfrutar de todas las potentes herramientas de Winsap para potenciar tu negocio.</p>
                            
                            <div class="plan-card">
                                <div class="plan-name">${planInfo.name}</div>
                                <div class="plan-detail">Estado: <span class="status-active">ACTIVO ✅</span></div>
                                <div class="plan-detail">Duración: ${planInfo.days || 30} días</div>
                                <div class="plan-price">Gs. ${planInfo.price.toLocaleString()}</div>
                            </div>

                            <div style="text-align: center; margin: 40px 0;">
                                <a href="https://crm.whats-flow.com/dashboard" class="button" style="background-color: #10b981;">Ir a mi Panel de Control</a>
                            </div>

                            <p><strong>Lo que puedes hacer ahora:</strong></p>
                            <ul class="highlights">
                                <li class="highlight-item">
                                    <span class="highlight-icon">🚀</span>
                                    <span>Conecta múltiples líneas de WhatsApp sin límites.</span>
                                </li>
                                <li class="highlight-item">
                                    <span class="highlight-icon">🤖</span>
                                    <span>Configura Chatbots con OpenAI para respuestas automáticas.</span>
                                </li>
                                <li class="highlight-item">
                                    <span class="highlight-icon">📊</span>
                                    <span>Accede a reportes detallados de tus campañas.</span>
                                </li>
                            </ul>

                            <p>Si necesitas asistencia técnica, nuestro equipo está listo para ayudarte en cualquier momento.</p>
                        </div>
                        <div class="footer">
                            <p><strong>Winsap Enterprise</strong></p>
                            <p>Haciendo crecer negocios a través de la comunicación</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('[EMAIL-NOTIF] ✅ Aprobación enviada a:', email);
        return true;
    } catch (error) {
        console.error('[EMAIL-NOTIF] ❌ Error enviando email de aprobación:', error);
        return false;
    }
}

module.exports = {
    sendPlanRequestEmail,
    sendPlanApprovalEmail
};
