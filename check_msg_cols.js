require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });
const mysql = require('mysql2/promise');

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'whatsflow'
    });

    try {
        console.log('--- Schema Messages ---');
        const [rows] = await connection.execute(
            `DESCRIBE messages`
        );
        console.table(rows);
    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

run();
