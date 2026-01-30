const mysql = require('mysql2/promise');
require('dotenv').config();

async function fix() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // 1. Update Carlos in users table
        const [res1] = await pool.execute(`
            UPDATE users 
            SET subscription_plan = "Manager", 
                plan_id = (SELECT id FROM plans WHERE name = "Manager" LIMIT 1),
                is_admin = 1
            WHERE email = "claudio@cnid.com.py"
        `);
        console.log('Users updated:', res1.affectedRows);

        // 2. Update Carlos in user_sessions table
        const [res2] = await pool.execute(`
            UPDATE user_sessions 
            SET subscription_plan = "Manager",
                plan_id = (SELECT id FROM plans WHERE name = "Manager" LIMIT 1)
            WHERE phone = "595985768793"
        `);
        console.log('Sessions updated:', res2.affectedRows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

fix();
