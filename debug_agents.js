const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function checkAgentStatus() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('\n=== AGENTS IN DATABASE ===');
        const [agents] = await conn.execute(`
      SELECT id, name, email, role, status, agent_status, created_at, updated_at
      FROM users 
      WHERE role = 'agent'
    `);
        console.table(agents);

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

checkAgentStatus();
