require('dotenv').config();
const mysql = require('mysql2/promise');

async function simulateEndpoint() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'oscorp_crm'
        });

        const ownerUserId = 1; // We know it resolves to 1
        const boardId = undefined; // Simulating "all boards"

        const query = `SELECT
            c.jid,
            c.name,
            c.notify_name,
            c.avatar_url,
            c.is_group,
            kc.board_id,
            kc.notes,
            kb.name as board_name,
            kb.color as board_color,
            kc.created_at as added_to_board_at
        FROM kanban_contacts kc
        JOIN (
            SELECT jid, MAX(id) AS max_id
            FROM contacts
            GROUP BY jid
        ) latest ON kc.contact_jid = latest.jid
        JOIN contacts c ON c.id = latest.max_id
        JOIN kanban_boards kb ON kc.board_id = kb.id
        WHERE kb.session_id = ?
        GROUP BY c.jid, kc.board_id
        ORDER BY kc.created_at DESC`;

        console.log('Running query for User ID:', ownerUserId);
        const [contactsRaw] = await connection.execute(query, [ownerUserId]);
        console.log(`Row count: ${contactsRaw.length}`);

        const contacts = contactsRaw.reduce((acc, contact) => {
            const boardName = contact.board_name;
            if (!acc[boardName]) {
                acc[boardName] = [];
            }
            acc[boardName].push({
                id: contact.jid,
                name: contact.name,
                board_name: contact.board_name
            });
            return acc;
        }, {});

        console.log('Resulting Map Keys:', Object.keys(contacts));
        Object.keys(contacts).forEach(k => {
            console.log(`Board "${k}": ${contacts[k].length} contacts`);
        });

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

simulateEndpoint();
