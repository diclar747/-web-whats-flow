const mysql = require('mysql2/promise');

async function insertTemplates() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'whatsflow',
        charset: 'utf8mb4'
    });

    try {
        // Eliminar plantillas existentes
        await connection.execute('DELETE FROM campaign_templates_predefined');

        // Plantillas sin emojis problemáticos
        const templates = [
            {
                id: 1,
                name: 'Recordatorio Simple',
                category: 'simple',
                message: `Hola {nombre}!

Te recordamos que tienes un pago pendiente de Gs. {monto}.

Vencimiento: dia {fecha_vencimiento}

Gracias por tu preferencia!`,
                variables: '["nombre","monto","fecha_vencimiento"]'
            },
            {
                id: 2,
                name: 'Recordatorio Formal',
                category: 'formal',
                message: `Estimado/a {nombre},

Le informamos que registra un saldo pendiente de Gs. {monto} con fecha de vencimiento el dia {fecha_vencimiento} de este mes.

Por favor, regularice su situacion a la brevedad.

Saludos cordiales.`,
                variables: '["nombre","monto","fecha_vencimiento"]'
            },
            {
                id: 3,
                name: 'Recordatorio Urgente',
                category: 'urgent',
                message: `*** RECORDATORIO URGENTE ***

{nombre}, su pago de Gs. {monto} vence el dia {fecha_vencimiento}.

Evite recargos realizando su pago HOY.

Para consultas, contactenos.`,
                variables: '["nombre","monto","fecha_vencimiento"]'
            },
            {
                id: 4,
                name: 'Recordatorio con Cuotas',
                category: 'installments',
                message: `Hola {nombre}!

Recordatorio de cuota:
- Monto: Gs. {monto}
- Cuotas pendientes: {cuotas_pendientes}
- Vencimiento: dia {fecha_vencimiento}

Gracias por mantenerte al dia!`,
                variables: '["nombre","monto","fecha_vencimiento","cuotas_pendientes"]'
            },
            {
                id: 5,
                name: 'Recordatorio Previo',
                category: 'simple',
                message: `{nombre}, te recordamos que en 3 dias vence tu pago de Gs. {monto}.

Vence: dia {fecha_vencimiento}

Evita recargos pagando con anticipacion.`,
                variables: '["nombre","monto","fecha_vencimiento"]'
            }
        ];

        // Insertar cada plantilla
        for (const template of templates) {
            await connection.execute(
                `INSERT INTO campaign_templates_predefined 
         (id, name, category, message_text, variables, is_active) 
         VALUES (?, ?, ?, ?, ?, TRUE)`,
                [template.id, template.name, template.category, template.message, template.variables]
            );
            console.log(`✅ Insertada: ${template.name}`);
        }

        console.log('\n✅ Todas las plantillas insertadas correctamente');

        // Verificar
        const [rows] = await connection.execute('SELECT id, name FROM campaign_templates_predefined');
        console.log('\n📋 Plantillas en BD:');
        rows.forEach(row => console.log(`   ${row.id}. ${row.name}`));

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await connection.end();
    }
}

insertTemplates();
