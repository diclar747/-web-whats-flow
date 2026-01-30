
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'whatsflow2024',
    database: process.env.DB_NAME || 'whatsflow'
};

async function checkGroupMessages() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        // 1. Get a contact from contacts
        const [groups] = await connection.execute('SELECT * FROM contacts LIMIT 1');
        if (groups.length === 0) {
            console.log('No contacts found.');
            return;
        }

        const group = groups[0];
        console.log('Group columns:', Object.keys(group));
        console.log('Checking messages for group:', group.jid, '(', group.name, ')');
        console.log('Group Session ID:', group.session_id);

        // 2. Check messages for this group
        const [messages] = await connection.execute(
            'SELECT count(*) as count FROM messages WHERE chat_jid = ?',
            [group.jid]
        );
        console.log(`Total messages in DB for this group: ${messages[0].count}`);

        // 3. Check messages with session_id filter
        const [messagesWithSession] = await connection.execute(
            'SELECT count(*) as count FROM messages WHERE chat_jid = ? AND session_id = ?',
            [group.jid, group.session_id]
        );
        console.log(`Messages matching session_id (${group.session_id}): ${messagesWithSession[0].count}`);

        // 4. Show some sample messages if they exist but session_id mismatches
        if (messages[0].count > 0 && messagesWithSession[0].count === 0) {
            const [samples] = await connection.execute(
                'SELECT session_id, count(*) as count FROM messages WHERE chat_jid = ? GROUP BY session_id',
                [group.jid]
            );
            console.log('Messages are stored under these session_ids:', samples);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

checkGroupMessages();
