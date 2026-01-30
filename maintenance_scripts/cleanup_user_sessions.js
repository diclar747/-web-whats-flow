const mysql = require('mysql2/promise');

async function cleanupUserSessions() {
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
            console.log('\n🧹 Limpiando user_sessions incorrectos...\n');

            // Ver qué hay actualmente
            console.log('📋 Registros ANTES de limpiar:');
            const [before] = await connection.execute(`
                SELECT id, session_id, email, phone, is_active 
                FROM user_sessions 
                LIMIT 10
            `);
            console.table(before);

            // Eliminar registros que NO son sesiones de WhatsApp
            // (sesiones de WhatsApp tienen phone con formato de número largo)
            // Los que tienen email de agentes/admin NO deberían estar aquí
            console.log('\n🗑️ Eliminando registros de login por email/password...');
            const [result] = await connection.execute(`
                DELETE FROM user_sessions 
                WHERE email IS NOT NULL 
                AND email LIKE '%@%'
                AND session_id IN (SELECT id FROM users WHERE email = user_sessions.email)
            `);

            console.log(`✅ Eliminados ${result.affectedRows} registros incorrectos`);

            // Ver qué quedó
            console.log('\n📋 Registros DESPUÉS de limpiar:');
            const [after] = await connection.execute(`
                SELECT id, session_id, email, phone, is_active 
                FROM user_sessions 
                LIMIT 10
            `);
            console.table(after);

            console.log('\n✅ ¡Limpieza completada!');
            console.log('ℹ️ user_sessions ahora solo contiene sesiones de WhatsApp (QR)');

        } finally {
            connection.release();
        }

        await pool.end();

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

cleanupUserSessions();
