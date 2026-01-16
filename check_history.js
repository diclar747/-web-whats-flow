const mysql = require('mysql2/promise');

// Conectar a la base de datos
async function checkHistory() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'whatsapp_bot_db'
    });

    try {
        // Verificar mensajes en la base de datos
        const [messages] = await connection.execute('SELECT COUNT(*) as total FROM messages');
        console.log('Total de mensajes en BD:', messages[0].total);

        // Verificar mensajes de los últimos 7 días
        const [recentMessages] = await connection.execute(`
            SELECT COUNT(*) as total FROM messages 
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);
        console.log('Mensajes de los últimos 7 días:', recentMessages[0].total);

        // Verificar mensajes del usuario claudio@cnid.com.py
        const [userMessages] = await connection.execute(`
            SELECT COUNT(*) as total FROM messages 
            WHERE session_id IN (
                SELECT id FROM users WHERE email = 'claudio@cnid.com.py'
            ) OR session_id IN (
                SELECT session_id FROM user_sessions WHERE email = 'claudio@cnid.com.py' OR phone = '595985768793' OR phone = '595994854167'
            )
        `);
        console.log('Mensajes para el usuario claudio@cnid.com.py:', userMessages[0].total);

        // Verificar información específica de los canales del usuario - corregido para evitar ambigüedad
        const [channelMessages] = await connection.execute(`
            SELECT
                m.phone,
                COUNT(*) as message_count,
                MAX(m.timestamp) as last_message
            FROM messages m
            JOIN user_sessions us ON m.session_id = us.session_id OR m.phone = us.phone
            WHERE us.email = 'claudio@cnid.com.py'
            GROUP BY m.phone
        `);
        console.log('Mensajes por canal del usuario:', channelMessages);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkHistory();