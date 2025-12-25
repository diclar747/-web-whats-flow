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
        const [msgCount] = await pool.execute("SELECT COUNT(*) as count FROM messages WHERE session_id = '1'");
        console.log('Messages for session 1:', msgCount[0].count);

        const [contactCount] = await pool.execute("SELECT COUNT(*) as count FROM contacts WHERE session_id = '1'");
        console.log('Contacts for session 1:', contactCount[0].count);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

test();
