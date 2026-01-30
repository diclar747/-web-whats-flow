const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function checkSessions() {
    console.log(`Checking User Sessions`);

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const [sessions] = await connection.execute('SELECT * FROM user_sessions');
        console.log(`Found ${sessions.length} sessions`);
        sessions.forEach(s => {
            console.log(`- Session ID: ${s.session_id}`);
            console.log(`  Owner: ${s.owner_phone_number}`);
            console.log(`  Active: ${s.is_active}`);
            console.log(`  Status: ${s.status}`);
            console.log(`  Updated: ${s.updated_at}`);
            console.log('---');
        });

        await connection.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkSessions();
