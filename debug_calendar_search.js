const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function checkContactSearch() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log('✅ Connected to database');

        // 1. Get a valid session for admin 'gestion@cnid.com.py' or similar
        // The user mentioned checking for "Gestion"
        // Let's first find the phone number for the active session of ID 1 or 8

        const [sessions] = await connection.execute(
            `SELECT * FROM user_sessions LIMIT 1`
        );

        if (sessions.length === 0) {
            console.log('❌ No connected sessions found');
            await connection.end();
            return;
        }

        if (sessions.length > 0) {
            console.log('first session row:', sessions[0]);
            // If phone is missing, try to guess it from other columns
            const session = sessions[0];
            const phoneNumber = session.phone || session.client_id || session.session_id; // Try to resolve
            console.log('Resolved Phone:', phoneNumber);

            const searchTerm = 'Ges'; // Partial search for "Gestion"
            const searchPattern = `%${searchTerm}%`;

            // 2. Execute the search query exactly as in index.js
            const [contacts] = await connection.execute(
                `SELECT name, 
                        SUBSTRING_INDEX(jid, '@', 1) as phone,
                        jid
                 FROM contacts 
                 WHERE session_id = ? 
                   AND name LIKE ?
                   AND jid LIKE '%@s.whatsapp.net'
                   AND name IS NOT NULL
                   AND name != SUBSTRING_INDEX(jid, '@', 1)
                 ORDER BY name ASC
                 LIMIT 20`,
                [phoneNumber, searchPattern]
            );

            console.log(`\n--- SEARCH RESULTS FOR "${searchTerm}" ---`);
            console.table(contacts);
        }

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkContactSearch();
