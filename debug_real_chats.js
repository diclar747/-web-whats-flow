
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkChatsTable() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log("--- Checking table: chats ---");
        // Count for session 1
        // Note: checking if column is session_id or something else
        try {
            const [rows] = await connection.execute(
                "SELECT COUNT(*) as count FROM chats WHERE session_id='1'"
            );
            console.log("Total Chats for session_id='1':", rows[0].count);
        } catch (e) {
            console.log("Column session_id might not exist. Describing table...");
            const [desc] = await connection.execute("DESCRIBE chats");
            console.log(JSON.stringify(desc, null, 2));
        }

        // Check for session 'Gestion' (if mapped differently?)
        // User screenshot shows 'diclar' which is session 1.

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkChatsTable();
