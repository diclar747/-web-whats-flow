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

        console.log('--- SERVER TIME DIAGNOSTICS ---');
        console.log('JS Date.now():', new Date().toString());
        console.log('JS ISO String:', new Date().toISOString());
        const [dbTime] = await conn.execute('SELECT NOW() as db_now, @@global.time_zone as global_tz, @@session.time_zone as session_tz');
        console.log('DB NOW():', dbTime[0].db_now);
        console.log('DB Timezones:', { global: dbTime[0].global_tz, session: dbTime[0].session_tz });

        console.log('\n--- SCHEDULED CAMPAIGNS ---');
        const [campaigns] = await conn.execute(`
        SELECT id, name, status, scheduled_at, created_at 
        FROM campaigns 
        WHERE status = 'scheduled' 
        ORDER BY scheduled_at ASC
    `);

        if (campaigns.length === 0) {
            console.log('No campaigns found with status "scheduled".');
        } else {
            console.table(campaigns);
            campaigns.forEach(c => {
                const scheduledTime = new Date(c.scheduled_at);
                const now = new Date();
                console.log(`Campaign ${c.id} "${c.name}":`);
                console.log(`  Scheduled: ${scheduledTime.toISOString()}`);
                console.log(`  Now:       ${now.toISOString()}`);
                console.log(`  Should Run? ${scheduledTime <= now ? 'YES (Past Due)' : 'NO (Future)'}`);
                console.log(`  Diff (mins): ${(now - scheduledTime) / 60000}`);
            });
        }

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

checkCampaigns();
