const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function test() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD
    });

    try {
        const [rows] = await pool.execute("SHOW DATABASES");
        console.log('Databases:', JSON.stringify(rows.map(r => Object.values(r)[0]), null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

test();
