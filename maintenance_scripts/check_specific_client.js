const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkClient() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'whatsflow',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const connection = await pool.getConnection();

        console.log('--- Checking Users ---');
        const [users] = await connection.query("SELECT id, name, email, phone, role, is_admin FROM users WHERE phone LIKE '%595985768793%' OR email LIKE '%595985768793%'");
        console.log('Users found:', users);

        console.log('--- Checking Sessions ---');
        // Check if user_sessions table exists first
        const [tables] = await connection.query("SHOW TABLES LIKE 'user_sessions'");
        if (tables.length > 0) {
            const [sessions] = await connection.query("SELECT * FROM user_sessions WHERE phone_number LIKE '%595985768793%'");
            console.log('Sessions found:', sessions);
        } else {
            console.log('Table user_sessions does not exist.');
        }

        connection.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkClient();
