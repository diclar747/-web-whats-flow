
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkPlans() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log("--- Session 1 ---");
        const [sessionRows] = await connection.execute(
            "SELECT id, session_id, phone, email, subscription_plan, subscription_status FROM user_sessions WHERE session_id='1'"
        );
        console.log(sessionRows);

        console.log("--- Users ---");
        const [userRows] = await connection.execute(
            "SELECT id, email, phone, subscription_plan, subscription_status FROM users WHERE email IN ('claudio@cnid.com.py', 'sistempar@gmail.com')"
        );
        console.log(userRows);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkPlans();
