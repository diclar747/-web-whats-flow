const mysql = require('mysql2/promise');

async function checkChatAssignments() {
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
            // Ver estructura de chat_assignments
            console.log('\n📋 Estructura de chat_assignments:');
            const [columns] = await connection.execute('DESCRIBE chat_assignments');
            console.table(columns);

            // Ver datos de ejemplo
            console.log('\n📊 Datos de ejemplo (primeras 5 filas):');
            const [assignments] = await connection.execute(`
                SELECT id, chat_jid, session_id, user_id, status, assigned_at 
                FROM chat_assignments 
                ORDER BY assigned_at DESC
                LIMIT 5
            `);
            console.table(assignments);

            // Analizar qué contiene session_id en chat_assignments
            console.log('\n🔍 Análisis de session_id en chat_assignments:');
            const [analysis] = await connection.execute(`
                SELECT 
                    session_id,
                    COUNT(*) as count,
                    CASE 
                        WHEN session_id REGEXP '^[0-9]+$' THEN 'Parece teléfono/ID numérico'
                        WHEN session_id REGEXP '^[a-f0-9]{16}$' THEN 'Parece UUID/hex 16 chars'
                        ELSE 'Otro formato'
                    END as tipo
                FROM chat_assignments 
                GROUP BY session_id
                LIMIT 10
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

checkChatAssignments();
