const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'whatsflow'
};

async function checkBot() {
    const sessionId = '595985768793';
    console.log(`Checking bot flows for session: ${sessionId}`);

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Check flows
        const [flows] = await connection.query(
            'SELECT * FROM chatbot_flows WHERE session_id = ?',
            [sessionId]
        );
        console.log('Flows found:', flows.length);
        flows.forEach(f => {
            console.log(`Flow ID: ${f.id}, Name: ${f.name}, Active: ${f.active}, Type: ${f.flow_type}`);
            console.log(`Triggers: ${f.triggers}`);
            console.log(`AI Config: Temp=${f.ai_temperature}, MaxTokens=${f.ai_max_tokens}`);
        });

        // Check settings
        const [settings] = await connection.query(
            'SELECT * FROM chatbot_settings WHERE session_id = ?',
            [sessionId]
        );
        console.log('Settings:', settings);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkBot();
