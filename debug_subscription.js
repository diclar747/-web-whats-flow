
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkSubscription() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log('--- User Session 1 ---');
        const [sessions] = await connection.execute(
            'SELECT session_id, phone, subscription_plan, subscription_status, subscription_end_date FROM user_sessions WHERE session_id = "1"'
        );
        console.log(JSON.stringify(sessions, null, 2));

        if (sessions.length > 0) {
            const planName = sessions[0].subscription_plan;
            console.log(`--- Plan: ${planName} ---`);
            const [plans] = await connection.execute(
                'SELECT * FROM plans WHERE name = ?',
                [planName]
            );
            console.log(JSON.stringify(plans, null, 2));
        }

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkSubscription();
