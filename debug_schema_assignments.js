const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function checkSchema() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('Checking chat_assignments columns...');
        const [cols] = await conn.execute('DESCRIBE chat_assignments');
        console.table(cols);

        console.log('Checking chat_transfers columns...');
        const [cols2] = await conn.execute('DESCRIBE chat_transfers');
        console.table(cols2);

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

checkSchema();
