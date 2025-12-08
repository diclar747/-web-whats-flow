const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function checkAllCampaigns() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('\n--- ALL CAMPAIGNS (LIMIT 5) ---');
        const [campaigns] = await conn.execute(`
        SELECT id, name, status, scheduled_at 
        FROM campaigns 
        ORDER BY id DESC LIMIT 5
    `);
        console.table(campaigns);

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

checkAllCampaigns();
