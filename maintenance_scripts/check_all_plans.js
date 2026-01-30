const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('--- plans ---');
        const [rows1] = await pool.execute('SELECT * FROM plans');
        console.log(JSON.stringify(rows1, null, 2));

        console.log('--- subscription_plans ---');
        const [rows2] = await pool.execute('SELECT * FROM subscription_plans');
        console.log(JSON.stringify(rows2, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
