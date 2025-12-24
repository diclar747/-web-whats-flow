const mysql = require('mysql2/promise');

async function checkUserSessions() {
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
            // Ver estructura de user_sessions
            console.log('\n📋 Estructura de user_sessions:');
            const [columns] = await connection.execute('DESCRIBE user_sessions');
            console.table(columns);

            // Ver datos de ejemplo
            console.log('\n📊 Datos de ejemplo (primeras 3 filas):');
            const [sessions] = await connection.execute(`
                SELECT session_id, phone, owner_phone_number, is_active 
                FROM user_sessions 
                WHERE is_active = 1 
                LIMIT 3
            `);
            console.table(sessions);

            // Ver qué contiene owner_phone_number
            console.log('\n🔍 Análisis de owner_phone_number:');
            const [analysis] = await connection.execute(`
                SELECT 
                    owner_phone_number,
                    phone,
                    session_id,
                    CASE 
                        WHEN owner_phone_number REGEXP '^[0-9]+$' THEN 'Parece teléfono'
                        WHEN owner_phone_number REGEXP '^[a-f0-9]{16}$' THEN 'Parece UUID/hex'
                        ELSE 'Otro formato'
                    END as tipo
                FROM user_sessions 
                WHERE is_active = 1
                LIMIT 5
            `);
            console.table(analysis);

        } finally {
            connection.release();
        }

        await pool.end();

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkUserSessions();
