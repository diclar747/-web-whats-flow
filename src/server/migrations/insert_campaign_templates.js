/**
 * Script para insertar plantillas predefinidas
 * Con soporte UTF-8 completo para emojis
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function insertTemplates() {
    const mysql = require('mysql2/promise');

    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'whatsflow',
        charset: 'utf8mb4'
    });

    const templates = [
        {
            name: 'Recordatorio Simple',
            category: 'simple',
            message_text: `Hola {nombre}! 👋

Te recordamos que tienes un pago pendiente de Gs. {monto}.

📅 Vencimiento: día {fecha_vencimiento}

¡Gracias por tu preferencia! 😊`,
            variables: JSON.stringify(['nombre', 'monto', 'fecha_vencimiento'])
        },
        {
            name: 'Recordatorio Formal',
            category: 'formal',
            message_text: `Estimado/a {nombre},

Le informamos que registra un saldo pendiente de Gs. {monto} con fecha de vencimiento el día {fecha_vencimiento} de este mes.

Por favor, regularice su situación a la brevedad.

Saludos cordiales. 📋`,
            variables: JSON.stringify(['nombre', 'monto', 'fecha_vencimiento'])
        },
        {
            name: 'Recordatorio Urgente',
            category: 'urgent',
            message_text: `⚠️ RECORDATORIO URGENTE ⚠️

{nombre}, su pago de Gs. {monto} vence el día {fecha_vencimiento}.

💳 Evite recargos realizando su pago HOY.

Para consultas, contáctenos. 📞`,
            variables: JSON.stringify(['nombre', 'monto', 'fecha_vencimiento'])
        },
        {
            name: 'Recordatorio con Cuotas',
            category: 'installments',
            message_text: `Hola {nombre}! 👋

Recordatorio de cuota:
💰 Monto: Gs. {monto}
📊 Cuotas pendientes: {cuotas_pendientes}
📅 Vencimiento: día {fecha_vencimiento}

¡Gracias por mantenerte al día! 🙏`,
            variables: JSON.stringify(['nombre', 'monto', 'fecha_vencimiento', 'cuotas_pendientes'])
        },
        {
            name: 'Recordatorio Previo (3 días antes)',
            category: 'simple',
            message_text: `{nombre}, te recordamos que en 3 días vence tu pago de Gs. {monto}.

📅 Vence: día {fecha_vencimiento}

Evita recargos pagando con anticipación. ✅`,
            variables: JSON.stringify(['nombre', 'monto', 'fecha_vencimiento'])
        }
    ];

    try {
        console.log('[TEMPLATES] Insertando plantillas...');

        for (const template of templates) {
            // Check if exists
            const [existing] = await pool.execute(
                'SELECT id FROM campaign_templates_predefined WHERE name = ?',
                [template.name]
            );

            if (existing.length > 0) {
                console.log(`[TEMPLATES] ⏭️  "${template.name}" ya existe`);
                continue;
            }

            await pool.execute(
                'INSERT INTO campaign_templates_predefined (name, category, message_text, variables) VALUES (?, ?, ?, ?)',
                [template.name, template.category, template.message_text, template.variables]
            );

            console.log(`[TEMPLATES] ✅ "${template.name}" insertada`);
        }

        console.log('[TEMPLATES] 🎉 Completado!');
        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('[TEMPLATES] ❌ Error:', error);
        await pool.end();
        process.exit(1);
    }
}

insertTemplates();
