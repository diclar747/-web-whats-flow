const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'whatsflow',
        password: process.env.DB_PASSWORD || 'WhatsFlow2024!',
        database: process.env.DB_NAME || 'whatsflow'
    };

    const connection = await mysql.createConnection(dbConfig);
    try {
        console.log("Increasing image_url and action_url column lengths...");
        await connection.query("ALTER TABLE push_campaigns MODIFY image_url TEXT");
        await connection.query("ALTER TABLE push_campaigns MODIFY action_url TEXT");
        await connection.query("ALTER TABLE push_campaigns MODIFY icon_url TEXT");
        console.log("✅ Success!");
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

migrate();
