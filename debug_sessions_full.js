
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkSessionLinks() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'whatsflow'
        });

        const [rows] = await connection.execute(
            'SELECT id, session_id, phone, email, owner_phone_number, subscription_plan, subscription_status FROM user_sessions'
        );
        console.log(JSON.stringify(rows, null, 2));

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkSessionLinks();
