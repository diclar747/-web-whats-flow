const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'whatsflow2024',
    database: 'whatsflow'
});

async function fixAgentLink() {
    try {
        console.log('🛠️ Corrigiendo vinculación de agentes (admin_phone = 1 -> real phone)...\n');

        // 1. Obtener teléfono del admin ID 1
        const [admins] = await pool.query('SELECT phone FROM users WHERE id = 1');
        if (!admins.length || !admins[0].phone) {
            console.error('❌ No se encontró phone para admin ID 1');
            process.exit(1);
        }
        const adminPhone = admins[0].phone;
        console.log('📞 Admin Phone real:', adminPhone);

        // 2. Actualizar usuarios que tienen admin_phone = '1'
        const [result] = await pool.query(
            'UPDATE users SET admin_phone = ? WHERE admin_phone = ?',
            [adminPhone, '1']
        );
        console.log('✅ Registros actualizados en users:', result.affectedRows);

        // 2b. Actualizar agents (si tienen admin_phone)
        try {
            const [res2] = await pool.query(
                'UPDATE agents SET admin_phone = ? WHERE admin_phone = ?',
                [adminPhone, '1']
            );
            console.log('✅ Registros actualizados en agents:', res2.affectedRows);
        } catch (e) {
            console.log('ℹ️ Tabla agents no tiene columna admin_phone o error:', e.message);
        }

        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
}

fixAgentLink();
