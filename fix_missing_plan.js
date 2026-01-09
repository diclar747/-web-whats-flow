
require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixPlan() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'whatsflow'
        });

        // Check if Manager exists
        const [rows] = await connection.execute('SELECT * FROM plans WHERE name = ?', ['Manager']);

        if (rows.length === 0) {
            console.log("Plan 'Manager' missing. Inserting...");
            await connection.execute(`
                INSERT INTO plans (name, description, price, max_agents, max_sessions, max_channels, max_messages, bot_enabled, api_enabled, created_at, updated_at) 
                VALUES ('Manager', 'Plan Manager Admin', 0, 50, 50, 50, 1000000, 1, 1, NOW(), NOW())
            `);
            console.log("Inserted 'Manager' plan.");
        } else {
            console.log("Plan 'Manager' already exists.");
        }

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

fixPlan();
