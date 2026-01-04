const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function debugContactSearch() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log('✅ Connected to database\n');

        // 1. Check what contacts exist for session 595985768793
        const phoneNumber = '595985768793';

        console.log('=== STEP 1: All contacts for this session ===');
        const [allContacts] = await connection.execute(
            `SELECT name, jid, session_id FROM contacts WHERE session_id = ? LIMIT 10`,
            [phoneNumber]
        );
        console.log(`Found ${allContacts.length} total contacts`);
        console.table(allContacts);

        console.log('\n=== STEP 2: Contacts with names (not phone numbers) ===');
        const [namedContacts] = await connection.execute(
            `SELECT name, jid, session_id 
             FROM contacts 
             WHERE session_id = ? 
               AND name IS NOT NULL
               AND name != SUBSTRING_INDEX(jid, '@', 1)
             LIMIT 10`,
            [phoneNumber]
        );
        console.log(`Found ${namedContacts.length} named contacts`);
        console.table(namedContacts);

        console.log('\n=== STEP 3: Search for "Ges" (exact query from backend) ===');
        const searchTerm = 'Ges';
        const searchPattern = `%${searchTerm}%`;
        const [searchResults] = await connection.execute(
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
        console.log(`Found ${searchResults.length} results for "${searchTerm}"`);
        console.table(searchResults);

        console.log('\n=== STEP 4: Check if "Gestion" contact exists ===');
        const [gestionContact] = await connection.execute(
            `SELECT name, jid, session_id FROM contacts WHERE session_id = ? AND name LIKE '%Gestion%'`,
            [phoneNumber]
        );
        console.log(`Found ${gestionContact.length} contacts with "Gestion"`);
        console.table(gestionContact);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

debugContactSearch();
