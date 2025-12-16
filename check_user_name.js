const mysql = require('mysql2/promise');

async function checkUserName() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'whatsflow2024',
        database: 'whatsflow'
    });

    try {
        const phone = '595994854167';
        
        console.log('\n🔍 Verificando nombre guardado para:', phone);
        
        const [sessions] = await pool.execute(
            'SELECT phone_number, name, avatar_url, is_active FROM user_sessions WHERE phone_number = ? ORDER BY last_connection_time DESC LIMIT 1',
            [phone]
        );
        
        if (sessions.length > 0) {
            console.log('\n📋 Información en user_sessions:');
            console.log('  Teléfono:', sessions[0].phone_number);
            console.log('  Nombre:', sessions[0].name || '❌ NULL');
            console.log('  Avatar:', sessions[0].avatar_url ? '✅ SI' : '❌ NO');
            console.log('  Activo:', sessions[0].is_active ? '✅ SI' : '❌ NO');
        } else {
            console.log('❌ No se encontró el usuario en user_sessions');
        }
        
        // Verificar en users
        const [users] = await pool.execute(
            'SELECT name, phone FROM users WHERE phone = ? LIMIT 1',
            [phone]
        );
        
        if (users.length > 0) {
            console.log('\n📋 Información en users:');
            console.log('  Nombre:', users[0].name || '❌ NULL');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkUserName();
