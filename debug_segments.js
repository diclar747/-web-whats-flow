const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function debugSegments() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('\n=== SEGMENTS TABLE SCHEMA ===');
        const [columns] = await conn.execute(`SHOW COLUMNS FROM segments`);
        console.log(columns);

        console.log('\n=== CAMPAIGNS TABLE SCHEMA ===');
        const [campCols] = await conn.execute(`SHOW COLUMNS FROM campaigns`);
        console.log(campCols);

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

debugSegments();
