const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function debugSystem() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('\n=== ALL CAMPAIGNS ===');
        const [campaigns] = await conn.execute(`
      SELECT id, name, status, scheduled_at, created_at, updated_at
      FROM campaigns 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
        console.table(campaigns);

        console.log('\n=== USERS TABLE SCHEMA ===');
        const [columns] = await conn.execute(`SHOW COLUMNS FROM users LIKE 'status'`);
        console.log(columns);

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

debugSystem();
