
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkStatuses() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'whatsflow'
        });

        const [rows] = await connection.execute('SELECT * FROM whatsapp_statuses ORDER BY id DESC LIMIT 5');
        console.log(JSON.stringify(rows, null, 2));

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkStatuses();
