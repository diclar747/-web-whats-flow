const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function checkAgents() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log('✅ Connected to database');

        // Check agents in 'users' table
        const [users] = await connection.execute(
            `SELECT id, name, email, role, status, agent_status, admin_phone, session_id, last_activity 
             FROM users 
             WHERE role = 'agent'`
        );

        console.log('\n--- AGENTS IN USERS TABLE ---');
        console.table(users);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkAgents();
