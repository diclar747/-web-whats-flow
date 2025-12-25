const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function test() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'whatsflow'
    });

    try {
        const [rows] = await pool.execute("SELECT COUNT(*) as count FROM user_sessions");
        console.log('User Sessions Count:', rows[0].count);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

test();
