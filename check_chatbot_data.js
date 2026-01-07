const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'whatsflow'
};

async function checkChatbotData() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to database');

        const [users] = await connection.query("SELECT id, name, email, phone, session_id FROM users WHERE id = 1 OR phone = '595985768793'");
        console.log('👤 Users found:', users);

        const [flows] = await connection.query('SELECT id, session_id, flow_name, is_active FROM chatbot_flows');
        console.log('📊 Existing Flows:', flows);

        await connection.end();
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkChatbotData();
