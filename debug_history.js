require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });
const mysql = require('mysql2/promise');

// Mock helpers from index.js
async function getAllSessionIds(pool, sessionId) {
    const sessionIds = [];
    console.log(`[getAllSessionIds] 🔍 INPUT: ${sessionId}`);

    const numericId = parseInt(sessionId);
    const isUserId = !isNaN(numericId) && numericId > 0 && numericId < 1000 && String(sessionId) === String(numericId);

    if (isUserId) {
        console.log(`[getAllSessionIds] 🎯 DETECTADO USER_ID: ${sessionId}`);
        const [userRows] = await pool.execute(
            'SELECT id, phone, admin_phone, session_id FROM users WHERE id = ?',
            [numericId]
        );
        if (userRows.length > 0) {
            const user = userRows[0];
            if (user.phone) sessionIds.push(user.phone);
            if (user.admin_phone && user.admin_phone !== user.phone) sessionIds.push(user.admin_phone);
            if (user.session_id) sessionIds.push(String(user.session_id));
        }

        const [sessionsRows] = await pool.execute(
            `SELECT DISTINCT phone, session_id, owner_phone_number 
             FROM user_sessions 
             WHERE id = ? OR email IN (SELECT email FROM users WHERE id = ?)`,
            [numericId, numericId]
        );

        for (const row of sessionsRows) {
            if (row.phone && !sessionIds.includes(row.phone)) sessionIds.push(row.phone);
            if (row.session_id && !sessionIds.includes(row.session_id)) sessionIds.push(row.session_id);
            if (row.owner_phone_number && !sessionIds.includes(row.owner_phone_number)) sessionIds.push(row.owner_phone_number);
        }
    }

    // Fallback legacy
    if (sessionId == '1' && sessionIds.length === 1 && sessionIds.includes('1')) {
        // Logic inside real function is slightly different, let's just push known phones
        sessionIds.push('595985768793');
        sessionIds.push('595994854167');
    }

    return sessionIds;
}

async function debugHistory() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const sessionId = '1';
        console.log('--- Debugging History for Session ID: 1 ---');

        // 1. Resolve Session IDs
        let allUserSessionIds = await getAllSessionIds(pool, sessionId);
        console.log('Resolved IDs:', allUserSessionIds);

        // 2. Count Messages
        if (allUserSessionIds.length > 0) {
            const placeholders = allUserSessionIds.map(() => '?').join(',');
            const [checkMessages] = await pool.execute(
                `SELECT COUNT(*) as count FROM messages WHERE session_id IN (${placeholders})`,
                allUserSessionIds
            );
            console.log('Total Messages (Simple Count):', checkMessages[0].count);

            // 3. Test Complex Query (Simplified)
            console.log('--- Testing Main Query (Limit 5) ---');
            const query = `SELECT m.id, m.session_id, m.chat_jid, m.timestamp
                             FROM messages m
                             WHERE m.session_id IN (${placeholders})
                             ORDER BY m.timestamp DESC
                             LIMIT 5`;
            const [messages] = await pool.execute(query, allUserSessionIds);
            console.log(messages);
        } else {
            console.log('No session IDs resolved.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

debugHistory();
