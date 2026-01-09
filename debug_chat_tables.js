
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkChatTables() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'whatsflow'
        });

        const [rows] = await connection.execute("SHOW TABLES LIKE '%chat%'");
        console.log("Tables with 'chat' in name:");
        console.log(JSON.stringify(rows, null, 2));

        const [contacts] = await connection.execute("SHOW TABLES LIKE '%contact%'");
        console.log("Tables with 'contact' in name:");
        console.log(JSON.stringify(contacts, null, 2));

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkChatTables();
