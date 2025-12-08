const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function forceSchedule() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('Forcing campaign 47 to scheduled...');
        await conn.execute("UPDATE campaigns SET status = 'scheduled' WHERE id = 47");
        console.log('Done.');

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

forceSchedule();
