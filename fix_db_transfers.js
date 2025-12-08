const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function fixDB() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('Checking assigned_by in chat_assignments...');
        const [cols] = await conn.execute("SHOW COLUMNS FROM chat_assignments LIKE 'assigned_by'");
        console.log(cols);

        console.log('Creating chat_transfers table...');
        await conn.execute(`
      CREATE TABLE IF NOT EXISTS chat_transfers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_jid VARCHAR(255) NOT NULL,
        session_id VARCHAR(255) NOT NULL,
        from_user_id INT NULL,
        to_user_id INT NOT NULL,
        transferred_by INT NULL, -- Allow NULL if admin (no ID) does it?
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_chat_session (chat_jid, session_id),
        INDEX idx_to_user (to_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('Table created.');

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

fixDB();
