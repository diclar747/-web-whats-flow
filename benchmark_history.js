const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function benchmark() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0
    });

    const activeSessionId = '1';
    const limit = 15;
    const offset = 0;

    console.time('TOTAL_BENCH');

    const connection = await pool.getConnection();
    try {
        console.time('COUNT_QUERY');
        const countQuery = `SELECT COUNT(id) as total FROM messages m WHERE m.session_id = ?`;
        const [totalRows] = await connection.execute(countQuery, [activeSessionId]);
        const totalMessages = totalRows && totalRows[0] ? totalRows[0].total : 0;
        console.timeEnd('COUNT_QUERY');

        console.time('MAIN_QUERY');
        let query = `SELECT m.id, m.session_id, m.chat_jid,
COALESCE(cg.name, c.name, c.notify_name, SUBSTRING_INDEX(m.chat_jid, '@', 1)) as chat_name,
COALESCE(cg.avatar_url, c.avatar_url) as chat_avatar,
m.sender_jid,
COALESCE(s.name, s.notify_name, SUBSTRING_INDEX(m.sender_jid, '@', 1)) as sender_name,
m.from_me, m.agent_id, m.agent_name, m.message_type, m.text_content, m.media_url, m.media_mime_type, m.timestamp, m.status
FROM messages m
LEFT JOIN contacts c ON m.chat_jid = c.jid AND c.session_id = ?
LEFT JOIN (SELECT jid, MAX(name) as name, MAX(avatar_url) as avatar_url FROM contact_groups GROUP BY jid) cg ON (cg.jid = m.chat_jid OR cg.jid = CONCAT(m.chat_jid, '@g.us'))
LEFT JOIN contacts s ON m.sender_jid = s.jid AND s.session_id = ?
WHERE m.session_id = ?
ORDER BY m.timestamp DESC
LIMIT ? OFFSET ?`;

        const queryParams = [activeSessionId, activeSessionId, activeSessionId, limit, offset];
        const [rows] = await connection.execute(query, queryParams);
        console.timeEnd('MAIN_QUERY');

        console.log(`Total: ${totalMessages}, Rows: ${rows.length}`);

    } finally {
        console.timeEnd('TOTAL_BENCH');
        connection.release();
        await pool.end();
    }
}

benchmark();
