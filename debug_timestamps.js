
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkMessageTimestamps() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log("Current Server Time:", new Date().toISOString());
        console.log("UNIX Timestamp:", Math.floor(Date.now() / 1000));

        console.log("--- Checking Timestamps for Session 1 ---");

        // Check latest message
        const [latest] = await connection.execute(
            "SELECT timestamp FROM messages WHERE session_id='1' ORDER BY timestamp DESC LIMIT 1"
        );
        if (latest.length > 0) {
            console.log("Latest Message Timestamp (raw):", latest[0].timestamp);
            console.log("Latest Message Date:", new Date(latest[0].timestamp * 1000).toISOString()); // timestamp is usually seconds in Whatsapp/Baileys?
            // Wait, Baileys/MySQL timestamp might be full datetime OR unix int?
            // DESCRIBE messages showed `timestamp` as... I didn't see schema.
            // Assuming it's datetime or int.
        } else {
            console.log("No messages found for session 1.");
        }

        // Count messages in last 24h
        // Assuming timestamp is DATETIME (standard in this app?) OR INT?
        // Query usually uses `timestamp > (UNIX_TIMESTAMP() - ...)` implies INT.
        // OR `timestamp` column is TIMESTAMP type.

        // I'll define schema check too.

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkMessageTimestamps();
