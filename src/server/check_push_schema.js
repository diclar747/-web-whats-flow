const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function check() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'whatsflow',
        password: process.env.DB_PASSWORD || 'WhatsFlow2024!',
        database: process.env.DB_NAME || 'whatsflow'
    };

    const connection = await mysql.createConnection(dbConfig);
    try {
        const [rows] = await connection.query("DESC push_event_logs");
        console.log("Schema of push_event_logs:");
        console.table(rows);

        const [rows2] = await connection.query("DESC push_vapid_keys");
        console.log("\nSchema of push_vapid_keys:");
        console.table(rows2);

        const [rows3] = await connection.query("DESC push_subscription_urls");
        console.log("\nSchema of push_subscription_urls:");
        console.table(rows3);
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

check();
