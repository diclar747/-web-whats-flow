const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function fixAgentLinkage() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log('✅ Connected to database');

        // Link 'Agente Gestion' (ID 8) to Admin (ID 1 / Phone 595985768793)
        // Set admin_phone and session_id
        const [result] = await connection.execute(
            `UPDATE users 
             SET admin_phone = '595985768793', session_id = '1'
             WHERE id = 8`
        );

        console.log('✅ Updated agent with ID 8');
        console.log('Rows matched:', result.affectedRows);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

fixAgentLinkage();
