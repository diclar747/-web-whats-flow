
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkMessagesSession() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log("--- Checking messages table session_id formats ---");
        const [rows] = await connection.execute(
            "SELECT session_id, COUNT(*) as count FROM messages GROUP BY session_id LIMIT 20"
        );
        console.log(JSON.stringify(rows, null, 2));

        console.log("--- Checking for Session 1 ID ('1') vs Phone ('595985768793') ---");
        const [check1] = await connection.execute("SELECT COUNT(*) as cnt FROM messages WHERE session_id='1'");
        const [checkPhone] = await connection.execute("SELECT COUNT(*) as cnt FROM messages WHERE session_id='595985768793'");

        console.log("Count with ID '1':", check1[0].cnt);
        console.log("Count with Phone '595985768793':", checkPhone[0].cnt);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkMessagesSession();
