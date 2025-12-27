
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'whatsflow2024',
    database: process.env.DB_NAME || 'whatsflow'
};

async function checkSpecificGroup() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        const partialJid = '120363420507868002';
        console.log(`Searching for JID starting with ${partialJid}...`);

        // Check messages
        const [msgs] = await connection.execute(
            `SELECT chat_jid, session_id, count(*) as count FROM messages WHERE chat_jid LIKE '${partialJid}%' GROUP BY chat_jid, session_id`
        );
        console.log('Messages Table Matches:', msgs);

        if (msgs.length > 0) {
            const exactJid = msgs[0].chat_jid;
            console.log(`Checking contact_groups for exact JID: '${exactJid}'`);

            const [groups] = await connection.execute(
                'SELECT jid, name, session_id FROM contact_groups WHERE jid = ?',
                [exactJid]
            );
            console.log('Contact Groups Match:', groups);

            if (groups.length === 0) {
                console.log('Trying partial match in contact_groups...');
                const [groupsPartial] = await connection.execute(
                    `SELECT jid, name, session_id FROM contact_groups WHERE jid LIKE '${partialJid}%'`
                );
                console.log('Contact Groups Partial Match:', groupsPartial);
            }
        } else {
            console.log('No messages found with that JID prefix.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

checkSpecificGroup();
