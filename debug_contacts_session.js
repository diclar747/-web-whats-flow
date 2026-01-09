
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkContactsSession() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log("--- Checking contacts table session_id formats ---");
        const [rows] = await connection.execute(
            "SELECT session_id, COUNT(*) as count FROM contacts GROUP BY session_id LIMIT 20"
        );
        console.log(JSON.stringify(rows, null, 2));

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkContactsSession();
