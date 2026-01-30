const mysql = require('mysql2/promise');

async function fixOwnerPhoneNumber() {
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
            console.log('\n🔧 Arreglando owner_phone_number en user_sessions...\n');

            // 1. Ver registros actuales
            console.log('📋 Registros ANTES del arreglo:');
            const [before] = await connection.execute(`
                SELECT id, session_id, phone, owner_phone_number 
                FROM user_sessions 
                WHERE owner_phone_number IS NOT NULL
                LIMIT 10
            `);
            console.table(before);

            // 2. Actualizar owner_phone_number de teléfono a user ID
            console.log('\n🔄 Actualizando owner_phone_number...');
            const [result] = await connection.execute(`
                UPDATE user_sessions us
                INNER JOIN users u ON u.phone = us.owner_phone_number
                SET us.owner_phone_number = u.id
                WHERE us.owner_phone_number REGEXP '^[0-9]{6,}$'
            `);

            console.log(`✅ Actualizados ${result.affectedRows} registros`);

            // 3. Ver registros después
            console.log('\n📋 Registros DESPUÉS del arreglo:');
            const [after] = await connection.execute(`
                SELECT id, session_id, phone, owner_phone_number 
                FROM user_sessions 
                WHERE owner_phone_number IS NOT NULL
                LIMIT 10
            `);
            console.table(after);

            // 4. Verificar que ahora son IDs válidos
            console.log('\n🔍 Verificación: owner_phone_number ahora apunta a users.id');
            const [verification] = await connection.execute(`
                SELECT 
                    us.id,
                    us.phone,
                    us.owner_phone_number,
                    u.id as user_id,
                    u.name as owner_name,
                    u.email as owner_email
                FROM user_sessions us
                LEFT JOIN users u ON u.id = us.owner_phone_number
                WHERE us.owner_phone_number IS NOT NULL
                LIMIT 5
            `);
            console.table(verification);

            console.log('\n✅ ¡Arreglo completado!');

        } finally {
            connection.release();
        }

        await pool.end();

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixOwnerPhoneNumber();
