const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixOrphan() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const [result] = await pool.execute(
            "UPDATE user_sessions SET owner_phone_number = 'ffd03bf21c750b14' WHERE phone = '595994854167'"
        );
        console.log('Update result:', result);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

fixOrphan();
