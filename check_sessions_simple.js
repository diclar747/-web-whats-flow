
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSessions() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.execute('SELECT id, user_id, session_id, phone_number, is_active, created_at, updated_at FROM user_sessions');
        console.log('--- User Sessions ---');
        console.table(rows);
    } catch (error) {
        console.error('Error fetching sessions:', error);
    } finally {
        connection.end();
    }
}

checkSessions();
