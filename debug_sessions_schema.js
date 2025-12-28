const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSchema() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const [rows] = await connection.execute('DESCRIBE user_sessions');
        console.log('Schema for user_sessions:', rows);

        const [sessions] = await connection.execute('SELECT * FROM user_sessions LIMIT 5');
        console.log('Sample sessions:', sessions);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkSchema();
