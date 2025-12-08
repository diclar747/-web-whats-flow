const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'whatsapp_crm'
};

async function inspectSession() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        console.log('--- AGENT INFO (User 2) ---');
        const [users] = await connection.execute('SELECT id, name, email, role, created_by FROM users WHERE id = 2');
        console.log(users);

        if (users.length > 0) {
            const agent = users[0];
            const adminId = agent.created_by || 1; // Fallback to 1 if null (usually main admin)
            console.log(`\n--- ADMIN INFO (User ${adminId}) ---`);

            // Check User Sessions for Admin
            const [sessions] = await connection.execute('SELECT * FROM user_sessions WHERE user_id = ?', [adminId]);
            console.log('Admin Sessions:', sessions);

            console.log('\n--- TARGET SESSION IN ASSIGNMENTS ---');
            console.log('595985768793');

            // Check if 595985768793 is in the sessions list
            const match = sessions.find(s => s.session_id === '595985768793');
            if (match) {
                console.log('MATCH FOUND! The assignment session ID exists for the admin.');
                console.log('Is Active:', match.is_active);
            } else {
                console.log('MISMATCH! The assignment session ID is NOT in the admin sessions.');
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

inspectSession();
