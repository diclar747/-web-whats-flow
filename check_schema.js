const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'whatsapp_crm'
};

async function checkSchema() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        const [rows] = await connection.execute("DESCRIBE chat_assignments");
        console.log('Schema:', rows);
    } catch (error) {
        console.error('Check Failed:', error);
    } finally {
        await connection.end();
    }
}

checkSchema();
