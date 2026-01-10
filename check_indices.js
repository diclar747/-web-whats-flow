const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'whatsflow'
};

async function checkIndices() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');
        const [rows] = await connection.query("SHOW INDEX FROM chats");
        console.log('Indexes on chats table:');
        rows.forEach(row => {
            console.log(`- Key: ${row.Key_name}, Column: ${row.Column_name}, Seq: ${row.Seq_in_index}`);
        });
        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkIndices();
