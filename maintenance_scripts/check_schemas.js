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

        const [desc] = await pool.query("DESCRIBE users");
        console.log('--- USERS SCHEMA ---');
        console.log(JSON.stringify(desc, null, 2));

        const [plansDesc] = await pool.query("DESCRIBE plans");
        console.log('--- PLANS SCHEMA ---');
        console.log(JSON.stringify(plansDesc, null, 2));

        await pool.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

run();
