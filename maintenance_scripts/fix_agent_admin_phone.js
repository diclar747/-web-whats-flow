const mysql = require('mysql2/promise');

async function fixAgentAdminPhone() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: process.env.DB_PASSWORD || 'whatsflow2024',
        database: 'whatsflow',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const connection = await pool.getConnection();

        try {
            console.log('\n🔧 Arreglando admin_phone de agentes...\n');

            // Ver agentes sin admin_phone
            console.log('📋 Agentes SIN admin_phone asignado:');
            const [agentsWithoutAdmin] = await connection.execute(`
                SELECT id, name, email, admin_phone, session_id
                FROM users 
                WHERE role = 'agent' AND admin_phone IS NULL
            `);
            console.table(agentsWithoutAdmin);

            if (agentsWithoutAdmin.length === 0) {
                console.log('✅ Todos los agentes ya tienen admin_phone asignado');
                return;
            }

            // Obtener el admin principal (el que creó el sistema)
            const [admins] = await connection.execute(`
                SELECT id, email, phone
                FROM users 
                WHERE role = 'admin'
                ORDER BY id ASC
                LIMIT 1
            `);

            if (admins.length === 0) {
                console.log('❌ No se encontró ningún admin en el sistema');
                return;
            }

            const mainAdmin = admins[0];
            console.log(`\n👤 Admin principal: ${mainAdmin.email} (ID: ${mainAdmin.id})`);

            // Actualizar agentes para asignarles este admin
            // admin_phone debe ser el ID del admin (como descubrimos antes)
            const [result] = await connection.execute(`
                UPDATE users 
                SET admin_phone = ?
                WHERE role = 'agent' AND admin_phone IS NULL
            `, [mainAdmin.id]);

            console.log(`\n✅ Actualizados ${result.affectedRows} agentes`);

            // Verificar
            console.log('\n📋 Agentes DESPUÉS del arreglo:');
            const [after] = await connection.execute(`
                SELECT id, name, email, admin_phone, session_id
                FROM users 
                WHERE role = 'agent'
            `);
            console.table(after);

        } finally {
            connection.release();
        }

        await pool.end();

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixAgentAdminPhone();
