const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'whatsflow'
        });

        const [plans] = await pool.query("SELECT * FROM plans");
        console.log('--- PLANS DATA ---');
        console.log(JSON.stringify(plans, null, 2));

        await pool.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

run();
