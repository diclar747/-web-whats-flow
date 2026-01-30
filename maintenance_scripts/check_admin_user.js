const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function checkAdmin() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const phone = '595985768793';
        console.log(`Checking user with phone ${phone}...`);
        const [users] = await conn.execute('SELECT * FROM users WHERE phone = ?', [phone]);
        console.table(users);

        // Also check session_id column?
        // const [users2] = await conn.execute('SELECT * FROM users WHERE session_id = ?', [phone]);
        // console.table(users2);

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

checkAdmin();
