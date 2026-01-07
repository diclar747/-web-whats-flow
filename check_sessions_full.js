
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSessions() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.execute('SELECT * FROM user_sessions');
        console.log('--- CONTENT OF user_sessions ---');
        console.table(rows);
    } catch (error) {
        console.error('Error fetching sessions:', error);
    } finally {
        connection.end();
    }
}

checkSessions();
