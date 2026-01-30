const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUser() {
    try {
        const password = process.env.DB_PASSWORD;
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: password,
            database: process.env.DB_NAME || 'whatsflow'
        });

        const [users] = await pool.query("SELECT id, name, email, phone, role, is_super_admin FROM users WHERE phone = '595994854167' OR email = 'sistempar@gmail.com'");
        console.log('--- USERS ---');
        console.log(JSON.stringify(users, null, 2));

        await pool.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkUser();
