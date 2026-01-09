
const mysql = require('mysql2/promise');

async function debug() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'whatsflow2024',
        database: 'whatsflow'
    });

    try {
        console.log('--- SERVER TIME ---');
        const [timeRows] = await connection.execute('SELECT NOW() as now, UTC_TIMESTAMP() as utc');
        console.log(JSON.stringify(timeRows[0]));

        console.log('\n--- CONTACT FOR Gestion ---');
        const [contacts] = await connection.execute(
            "SELECT * FROM contacts WHERE name LIKE '%Gestion%' OR jid LIKE '%595976602659%'"
        );
        console.log(JSON.stringify(contacts, null, 2));

        console.log('\n--- CHAT FOR 595976602659 ---');
        const [chats] = await connection.execute(
            "SELECT * FROM chats WHERE jid LIKE '%595976602659%' OR last_message_content LIKE '%Ahora si ya%'"
        );
        console.log(JSON.stringify(chats, null, 2));

        console.log('\n--- RECENT MESSAGES FOR THIS JID ---');
        const [msgs] = await connection.execute(
            "SELECT id, remote_jid, timestamp, message_text FROM messages WHERE remote_jid LIKE '%595976602659%' ORDER BY timestamp DESC LIMIT 5"
        );
        console.log(JSON.stringify(msgs, null, 2));

        if (chats.length > 0) {
            const chat = chats[0];
            console.log('\n--- DATE FILTER TEST ---');
            const [filterTest] = await connection.execute(
                "SELECT ? > DATE_SUB(NOW(), INTERVAL 24 HOUR) as is_in_24h",
                [chat.last_message_time]
            );
            console.log(`Last message time: ${chat.last_message_time}`);
            console.log(`Is in 24h: ${filterTest[0].is_in_24h}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

debug();
