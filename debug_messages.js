const mysql = require('mysql2/promise');
require('dotenv').config();

async function debug() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    const num1 = '595985768793';
    const num2 = '595994854167';

    console.log(`Checking messages between ${num1} and ${num2}...`);

    try {
        // Search in messages table
        const [msgRows] = await pool.execute(
            `SELECT id, chat_jid, phone, text_content, timestamp, from_me 
             FROM messages 
             WHERE (chat_jid LIKE ? AND phone = ?) 
                OR (chat_jid LIKE ? AND phone = ?)
             ORDER BY timestamp DESC LIMIT 20`,
            [`%${num2}%`, num1, `%${num1}%`, num2]
        );

        console.log(`Found ${msgRows.length} recent messages in 'messages' table:`);
        msgRows.forEach(row => {
            console.log(`- [${row.timestamp}] From ${row.phone} to ${row.chat_jid}: "${row.text_content}" (from_me: ${row.from_me})`);
        });

        // Search in chats table
        const [chatRows] = await pool.execute(
            `SELECT jid, phone, last_message_content, last_message_time 
             FROM chats 
             WHERE (jid LIKE ? AND phone = ?) 
                OR (jid LIKE ? AND phone = ?)`,
            [`%${num2}%`, num1, `%${num1}%`, num2]
        );

        console.log(`\nFound ${chatRows.length} entries in 'chats' table:`);
        chatRows.forEach(row => {
            console.log(`- Chat: ${row.jid} | Channel: ${row.phone} | Last: "${row.last_message_content}" at ${row.last_message_time}`);
        });

        // Check user_sessions to see if both are connected
        const [sessionRows] = await pool.execute(
            `SELECT session_id, phone, is_active FROM user_sessions WHERE phone IN (?, ?)`,
            [num1, num2]
        );
        console.log(`\nActive sessions for these numbers:`);
        sessionRows.forEach(row => {
            console.log(`- Phone: ${row.phone} | Session: ${row.session_id} | Active: ${row.is_active}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

debug();
