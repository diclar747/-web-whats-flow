
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkChats() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log("--- Checking Chats for Session 1 ---");
        const [rows] = await connection.execute(
            "SELECT COUNT(*) as count FROM whatsapp_chats WHERE session_id='1'"
        );
        console.log("Total Chats:", rows[0].count);

        console.log("--- Checking Recent Chats (Last 24h) ---");
        const [recent] = await connection.execute(
            "SELECT COUNT(*) as count FROM whatsapp_chats WHERE session_id='1' AND last_message_time > (UNIX_TIMESTAMP() - 86400)"
        );
        console.log("Recent Chats:", recent[0].count);

        // Sample 5 chats
        const [sample] = await connection.execute(
            "SELECT jid, name, last_message_time, unread_count FROM whatsapp_chats WHERE session_id='1' ORDER BY last_message_time DESC LIMIT 5"
        );
        console.log("Sample:", sample);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkChats();
