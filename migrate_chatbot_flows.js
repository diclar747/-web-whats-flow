const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'whatsflow'
};

async function migrateFlows() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to database');

        const oldSessionId = '1';
        const newSessionId = '595985768793';

        console.log(`🔄 Migrating flows from ${oldSessionId} to ${newSessionId}...`);

        const [result] = await connection.query(
            'UPDATE chatbot_flows SET session_id = ? WHERE session_id = ?',
            [newSessionId, oldSessionId]
        );

        console.log(`✅ Migrated ${result.affectedRows} flows.`);

        // Check if settings need migration (merge logic: only if new doesn't exist? But it does.)
        // For now, only logging settings status.
        const [oldSettings] = await connection.query('SELECT * FROM chatbot_settings WHERE session_id = ?', [oldSessionId]);
        const [newSettings] = await connection.query('SELECT * FROM chatbot_settings WHERE session_id = ?', [newSessionId]);

        console.log(`ℹ️ Settings status: Old (${oldSettings.length}), New (${newSettings.length})`);

        if (oldSettings.length > 0 && newSettings.length > 0) {
            console.log('⚠️ Both IDs have settings. Keeping active session settings.');
        } else if (oldSettings.length > 0 && newSettings.length === 0) {
            console.log('🔄 Migrating settings as none exist for new session...');
            const [resSettings] = await connection.query(
                'UPDATE chatbot_settings SET session_id = ? WHERE session_id = ?',
                [newSessionId, oldSessionId]
            );
            console.log(`✅ Migrated settings: ${resSettings.affectedRows}`);
        }

        await connection.end();
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

migrateFlows();
