const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function checkCampaigns() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            timezone: '+00:00' // Force UTC to see raw values or db config
        });

        console.log('Server Time (JS):', new Date().toString());
        console.log('Server Time (ISO):', new Date().toISOString());

        const [rows] = await conn.execute('SELECT NOW() as db_now, @@global.time_zone as global_tz, @@session.time_zone as session_tz');
        console.log('DB Time:', rows[0]);

        console.log('\n=== SCHEDULED CAMPAIGNS ===');
        const [campaigns] = await conn.execute(`
      SELECT id, name, status, scheduled_at, created_at 
      FROM campaigns 
      WHERE status = 'scheduled'
    `);

        console.table(campaigns);

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

checkCampaigns();
