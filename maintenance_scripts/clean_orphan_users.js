const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function cleanOrphanUsers() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('Eliminando usuarios huérfanos...');
        const [result] = await conn.execute(`
      DELETE FROM users 
      WHERE role = 'agent' 
        AND email IS NULL 
        AND session_id IS NULL 
        AND admin_phone IS NULL
    `);

        console.log(`✅ Eliminados ${result.affectedRows} usuarios huérfanos`);

        console.log('\n=== USUARIOS RESTANTES ===');
        const [users] = await conn.execute(`
      SELECT id, name, email, role, session_id, admin_phone, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);
        console.table(users);

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

cleanOrphanUsers();
