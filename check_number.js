const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });

async function checkNumber() {
    const phoneNumber = '595995690346';

    console.log(`Checking DB for ${phoneNumber}`);

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('Connected to DB');

        // Check contacts
        const [contacts] = await connection.execute(
            'SELECT * FROM contacts WHERE jid LIKE ?',
            [`%${phoneNumber}%`]
        );
        console.log(`Found ${contacts.length} contacts matching ${phoneNumber}`);
        contacts.forEach(c => console.log(`- Contact: ${c.name} (${c.jid}) - Session: ${c.session_id}`));

        // Check messages
        const [messages] = await connection.execute(
            'SELECT * FROM messages WHERE sender_jid LIKE ? OR chat_jid LIKE ? ORDER BY timestamp DESC LIMIT 5',
            [`%${phoneNumber}%`, `%${phoneNumber}%`]
        );
        console.log(`Found ${messages.length} recent messages matching ${phoneNumber}`);
        messages.forEach(m => console.log(`- Message [${m.timestamp}]: ${m.text_content} (Chat: ${m.chat_jid})`));

        await connection.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkNumber();
