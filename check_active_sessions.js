const mysql = require('mysql2/promise');

async function checkSessions() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'whatsflow2024',
        database: 'whatsflow'
    });

    try {
        const [sessions] = await pool.execute(
            'SELECT phone_number, session_id, name, avatar_url, is_active, last_connection_time FROM user_sessions ORDER BY last_connection_time DESC LIMIT 5'
        );
        
        console.log('\n📊 Últimas 5 sesiones:');
        console.log('═══════════════════════════════════════════════════════════');
        sessions.forEach(s => {
            console.log(`Phone: ${s.phone_number}`);
            console.log(`  Activa: ${s.is_active ? '✅ SI' : '❌ NO'}`);
            console.log(`  Nombre: ${s.name || '❌ NULL'}`);
            console.log(`  Avatar: ${s.avatar_url ? '✅ SI' : '❌ NO'}`);
            console.log(`  Última conexión: ${s.last_connection_time}`);
            console.log('───────────────────────────────────────────────────────────');
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkSessions();
