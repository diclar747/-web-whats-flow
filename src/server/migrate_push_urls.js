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
        console.log("Adding columns to push_subscription_urls...");

        // Add public_title
        try {
            await connection.query("ALTER TABLE push_subscription_urls ADD COLUMN public_title VARCHAR(255) DEFAULT NULL AFTER name");
            console.log("Column public_title added.");
        } catch (err) {
            if (err.code === 'ER_DUP_COLUMN_NAME') {
                console.log("Column public_title already exists.");
            } else {
                throw err;
            }
        }

        // Add logo_url
        try {
            await connection.query("ALTER TABLE push_subscription_urls ADD COLUMN logo_url VARCHAR(512) DEFAULT NULL AFTER public_title");
            console.log("Column logo_url added.");
        } catch (err) {
            if (err.code === 'ER_DUP_COLUMN_NAME') {
                console.log("Column logo_url already exists.");
            } else {
                throw err;
            }
        }

    } catch (err) {
        console.error("Migration error:", err);
    } finally {
        await connection.end();
    }
}

migrate();
