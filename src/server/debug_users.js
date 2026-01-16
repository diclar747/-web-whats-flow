const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function checkUsers() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'whatsflow',
        password: process.env.DB_PASSWORD || 'WhatsFlow2024!',
        database: process.env.DB_NAME || 'whatsflow'
    };

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.query("SELECT id, email, phone, role FROM users LIMIT 5");
        console.log("Users:", rows);
        await connection.end();
    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkUsers();
