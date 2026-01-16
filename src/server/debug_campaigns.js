const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function check() {
    console.log('DB Connection:', {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        database: process.env.DB_NAME
    });

    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'whatsflow',
        password: process.env.DB_PASSWORD || 'WhatsFlow2024!',
        database: process.env.DB_NAME || 'whatsflow'
    };

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.query("SELECT id, user_id, status FROM push_campaigns");
        console.log("Campaigns found:", rows);
        await connection.end();
    } catch (err) {
        console.error("Error:", err.message);
    }
}

check();
