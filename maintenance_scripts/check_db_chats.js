require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });
const mysql = require('mysql2/promise');

async function checkChats() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('--- Chats TIMESTAMPS for phone 595994854167 (Top 10) ---');
        const [chats] = await pool.execute(
            "SELECT jid, last_message_time, updated_at FROM chats WHERE phone = '595994854167' ORDER BY last_message_time DESC LIMIT 10"
        );
        console.log(chats);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkChats();
