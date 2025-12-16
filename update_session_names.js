const mysql = require('mysql2/promise');

async function updateSessionNames() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'whatsflow2024',
        database: 'whatsflow',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('�� Consultando sesiones activas...');
        
        const [sessions] = await pool.execute(
            'SELECT id, phone_number, session_id, name, avatar_url, last_connection_time FROM user_sessions ORDER BY last_connection_time DESC LIMIT 10'
        );
        
        console.log('\n📊 Últimas 10 sesiones:');
        console.log('════════════════════════════════════════════════════════════════');
        sessions.forEach(s => {
            console.log(`Phone: ${s.phone_number}`);
            console.log(`  SessionID: ${s.session_id}`);
            console.log(`  Nombre: ${s.name || '❌ NULL'}`);
            console.log(`  Avatar: ${s.avatar_url ? '✅ SI' : '❌ NO'}`);
            console.log(`  Última conexión: ${s.last_connection_time}`);
            console.log('────────────────────────────────────────────────────────────────');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

updateSessionNames();
