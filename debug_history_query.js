
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'whatsflow2024',
    database: process.env.DB_NAME || 'whatsflow'
};

async function checkQuery() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        const targetJid = '120363420507868002';
        console.log(`Testing query for JID: ${targetJid}`);

        const query = `
            SELECT m.chat_jid, HEX(m.chat_jid) as hex_jid,
                   cg.jid as group_jid_found,
                   cg.name as group_name_found,
                   CONCAT(m.chat_jid, '@g.us') as constructed_jid
            FROM messages m
            LEFT JOIN (
                SELECT jid, MAX(name) as name, MAX(avatar_url) as avatar_url 
                FROM contact_groups 
                GROUP BY jid
            ) cg ON (cg.jid = m.chat_jid OR cg.jid = CONCAT(m.chat_jid, '@g.us'))
            WHERE m.chat_jid LIKE ?
            LIMIT 1
        `;

        const [rows] = await connection.execute(query, [targetJid + '%']);
        console.log('Query Result:', rows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

checkQuery();
