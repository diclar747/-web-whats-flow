const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function checkUsers() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('=== USUARIOS EN LA BASE DE DATOS ===\n');
        const [users] = await conn.execute(`
      SELECT id, name, email, role, status, session_id, admin_phone, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);

        console.table(users);
        console.log(`\nTotal de usuarios: ${users.length}`);

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

checkUsers();
