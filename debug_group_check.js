
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkGroups() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'whatsflow'
        });

        console.log("--- Checking contacts table for invalid groups ---");
        // Contacts marked as group but JID not ending in @g.us
        const [fakeGroups] = await connection.execute(
            "SELECT jid, name, is_group FROM contacts WHERE session_id='1' AND is_group=1 AND jid NOT LIKE '%@g.us' LIMIT 10"
        );
        console.log("Contacts marked as Group but valid user JID:", fakeGroups);

        console.log("--- Checking contact_groups table ---");
        // Groups in table not ending in @g.us
        const [fakeContactGroups] = await connection.execute(
            "SELECT jid, name FROM contact_groups WHERE session_id='1' AND jid NOT LIKE '%@g.us' LIMIT 10"
        );
        console.log("Entries in contact_groups not ending in @g.us:", fakeContactGroups);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkGroups();
