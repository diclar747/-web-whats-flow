const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../../.env' });

async function checkPlans() {
    try {
        const pool = await mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'whatsflow',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        const [plans] = await pool.query('SELECT * FROM plans');
        console.log('--- PLANS ---');
        console.log(JSON.stringify(plans, null, 2));

        const [planRequests] = await pool.query('SHOW TABLES LIKE "plan_requests"');
        if (planRequests.length > 0) {
            const [requests] = await pool.query('SELECT * FROM plan_requests');
            console.log('--- PLAN REQUESTS ---');
            console.log(JSON.stringify(requests, null, 2));
        } else {
            console.log('Table plan_requests does not exist');
        }

        await pool.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkPlans();
