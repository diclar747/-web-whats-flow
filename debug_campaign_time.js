const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function checkCampaigns() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('\n=== TIME CHECK ===');
        const [timeLink] = await conn.execute('SELECT NOW() as db_time, @@global.time_zone as global_tz, @@session.time_zone as session_tz');
        console.log('DB Time:', timeLink[0].db_time);
        console.log('JS Date:', new Date().toString());
        console.log('JS ISO:', new Date().toISOString());

        console.log('\n=== SCHEDULED CAMPAIGNS ===');
        const [campaigns] = await conn.execute(`
      SELECT id, name, status, scheduled_at, phone_number, session_id 
      FROM campaigns 
      WHERE status = 'scheduled'
    `);

        if (campaigns.length === 0) {
            console.log('No scheduled campaigns found.');
        } else {
            console.table(campaigns);
            campaigns.forEach(c => {
                const scheduled = new Date(c.scheduled_at);
                const now = new Date();
                console.log(`Campaign ${c.id}: Scheduled ${scheduled.toISOString()} vs Now ${now.toISOString()}`);
                console.log(`Should run? ${scheduled <= now ? 'YES' : 'NO (Future)'}`);
            });
        }

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

checkCampaigns();
