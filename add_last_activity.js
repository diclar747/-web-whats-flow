const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'whatsapp_crm',
    multipleStatements: true
};

async function addColumn() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        console.log('Checking for last_activity column...');
        const [columns] = await connection.execute("SHOW COLUMNS FROM users");
        console.log('Current columns in users table:', columns.map(c => c.Field).join(', '));

        const hasLastActivity = columns.some(c => c.Field === 'last_activity');

        if (!hasLastActivity) {
            console.log('Column missing. Adding last_activity...');
            await connection.execute("ALTER TABLE users ADD COLUMN last_activity DATETIME NULL");
            console.log('✅ Column last_activity added successfully.');
        } else {
            console.log('✅ Column last_activity already exists.');
        }
    } catch (error) {
        console.error('Migration Failed:', error);
    } finally {
        await connection.end();
    }
}

addColumn();
