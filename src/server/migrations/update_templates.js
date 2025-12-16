const mysql = require('mysql2/promise');

async function updateTemplates() {
    let connection;

    try {
        // Conectar usando sudo mysql
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            database: 'whatsflow',
            charset: 'utf8mb4',
            socketPath: '/var/run/mysqld/mysqld.sock'
        });

        console.log('✅ Conectado a MySQL\n');

        // Eliminar plantillas existentes
        await connection.execute('DELETE FROM campaign_templates_predefined');
        console.log('🗑️  Plantillas antiguas eliminadas\n');

        // Plantillas profesionales sin emojis problemáticos
        const templates = [
            {
                id: 1,
                name: 'Recordatorio Simple',
                category: 'simple',
                message: `Hola {nombre}!

Te recordamos que tienes un pago pendiente de Gs. {monto}.

Vencimiento: dia {fecha_vencimiento} de este mes

Gracias por tu preferencia y puntualidad.

Saludos cordiales.`,
                variables: '["nombre","monto","fecha_vencimiento"]'
            },
            {
                id: 2,
                name: 'Recordatorio Formal',
                category: 'formal',
                message: `Estimado/a {nombre},

Le informamos que registra un saldo pendiente de Gs. {monto} con fecha de vencimiento el dia {fecha_vencimiento} de este mes.

Le solicitamos regularizar su situacion a la brevedad posible para evitar recargos adicionales.

Agradecemos su atencion.

Saludos cordiales.`,
                variables: '["nombre","monto","fecha_vencimiento"]'
            },
            {
                id: 3,
                name: 'Recordatorio Urgente',
                category: 'urgent',
                message: `*** RECORDATORIO URGENTE ***

{nombre}, su pago de Gs. {monto} vence el dia {fecha_vencimiento}.

IMPORTANTE: Evite recargos realizando su pago HOY.

Para consultas o aclaraciones, contactenos de inmediato.

Gracias por su atencion.`,
                variables: '["nombre","monto","fecha_vencimiento"]'
            },
            {
                id: 4,
                name: 'Recordatorio con Cuotas',
                category: 'installments',
                message: `Hola {nombre}!

RECORDATORIO DE CUOTA

- Monto: Gs. {monto}
- Cuotas pendientes: {cuotas_pendientes}
- Vencimiento: dia {fecha_vencimiento} de este mes

Agradecemos tu puntualidad en los pagos.

Gracias por mantenerte al dia!`,
                variables: '["nombre","monto","fecha_vencimiento","cuotas_pendientes"]'
            },
            {
                id: 5,
                name: 'Recordatorio Previo (3 dias antes)',
                category: 'simple',
                message: `{nombre}, te recordamos que en 3 dias vence tu pago de Gs. {monto}.

Fecha de vencimiento: dia {fecha_vencimiento}

Evita recargos pagando con anticipacion.

Gracias por tu confianza.`,
                variables: '["nombre","monto","fecha_vencimiento"]'
            }
        ];

        // Insertar cada plantilla
        console.log('📝 Insertando plantillas profesionales...\n');
        for (const template of templates) {
            await connection.execute(
                `INSERT INTO campaign_templates_predefined 
         (id, name, category, message_text, variables, is_active) 
         VALUES (?, ?, ?, ?, ?, TRUE)`,
                [template.id, template.name, template.category, template.message, template.variables]
            );
            console.log(`   ✅ ${template.name}`);
        }

        console.log('\n✅ Todas las plantillas insertadas correctamente!\n');

        // Verificar
        const [rows] = await connection.execute('SELECT id, name, category FROM campaign_templates_predefined ORDER BY id');
        console.log('📋 Plantillas en la base de datos:');
        rows.forEach(row => console.log(`   ${row.id}. ${row.name} (${row.category})`));

        console.log('\n🎉 Proceso completado exitosamente!');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.code === 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR') {
            console.error('\n💡 Sugerencia: Ejecuta este script con sudo:');
            console.error('   sudo node migrations/update_templates.js');
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

updateTemplates();
