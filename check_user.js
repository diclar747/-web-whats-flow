const mysql = require('mysql2/promise');

// Conectar a la base de datos
async function checkUser() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'whatsapp_bot_db'
    });

    try {
        // Buscar al usuario
        const [users] = await connection.query("SELECT * FROM users WHERE email = 'claudio@cnid.com.py' OR phone = '595985768793';");
        console.log('Usuario encontrado:', JSON.stringify(users, null, 2));

        if (users.length > 0) {
            const user = users[0];
            console.log('\nID del usuario:', user.id);
            
            // Buscar suscripción activa
            const [subscriptions] = await connection.query('SELECT * FROM user_subscriptions WHERE user_id = ?', [user.id]);
            console.log('\nSuscripciones:', JSON.stringify(subscriptions, null, 2));
            
            // Buscar sesiones activas del usuario
            const [sessions] = await connection.query('SELECT * FROM user_sessions WHERE user_id = ? OR phone = ? OR owner_phone_number = ?', [user.id, user.phone, user.phone]);
            console.log('\nSesiones:', JSON.stringify(sessions, null, 2));
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkUser();