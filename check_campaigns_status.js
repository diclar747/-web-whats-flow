const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'whatsapp_crm'
};

async function checkCampaigns() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        console.log('Current Server Time:', new Date().toISOString());

        const [rows] = await connection.execute("SELECT id, name, status, scheduled_at, created_at FROM campaigns WHERE status IN ('scheduled', 'draft', 'sending') ORDER BY scheduled_at ASC");
        console.log('Pending/Active Campaigns:', rows);

        // Check scheduler interval in logs if possible, but here we check data/state
    } catch (error) {
        console.error('Check Failed:', error);
    } finally {
        await connection.end();
    }
}

checkCampaigns();
