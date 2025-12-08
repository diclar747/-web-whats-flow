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
        console.log('--- USERS TABLE SCHEMA ---');
        const [columns] = await connection.execute("DESCRIBE users");
        console.table(columns);
        // Also print JSON for easier parsing if table is messy
        console.log(JSON.stringify(columns, null, 2));
    } catch (error) {
        console.error('Schema Check Failed:', error);
    } finally {
        await connection.end();
    }
}

checkSchema();
