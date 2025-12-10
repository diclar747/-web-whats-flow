require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });
const mysql = require('mysql2/promise');

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'whatsflow'
    });

    try {
        console.log('--- Sesiones Recientes ---');
        const [rows] = await connection.execute(
            `SELECT session_id, phone_number, is_active, last_connection_time, created_at
             FROM user_sessions 
             ORDER BY last_connection_time DESC 
             LIMIT 10`
        );
        console.table(rows);
    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

run();
