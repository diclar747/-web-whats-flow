const mysql = require('mysql2/promise');

async function checkSessions() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'Diclar2024@',
        database: 'whatsapp_crm',
        waitForConnections: true,
        connectionLimit: 10
    });

    try {
        const [activeSessions] = await pool.query(
            'SELECT session_id, phone, name, is_active, last_activity FROM user_sessions ORDER BY last_activity DESC LIMIT 20'
        );

        console.log('\n=== USER SESSIONS (Last 20) ===');
        console.log('Total sessions:', activeSessions.length);
        console.log('\nDetails:');
        activeSessions.forEach(s => {
            console.log(`\nSession ID: ${s.session_id}`);
            console.log(`  Phone: ${s.phone}`);
            console.log(`  Name: ${s.name}`);
            console.log(`  is_active: ${s.is_active}`);
            console.log(`  last_activity: ${s.last_activity}`);
        });

        const [activeCount] = await pool.query(
            'SELECT COUNT(*) as count FROM user_sessions WHERE is_active = 1'
        );
        console.log(`\n\nTotal ACTIVE sessions (is_active=1): ${activeCount[0].count}`);

        const [totalCount] = await pool.query(
            'SELECT COUNT(*) as count FROM user_sessions'
        );
        console.log(`Total sessions in DB: ${totalCount[0].count}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkSessions();
