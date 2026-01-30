const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'whatsflow2024',
    database: 'whatsflow'
};

async function fixDatabaseIds() {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to DB');

    try {
        // 1. Obtener mapeo de phone a user.id
        const [users] = await connection.execute('SELECT id, phone FROM users WHERE phone IS NOT NULL');
        const phoneToId = {};
        users.forEach(u => {
            phoneToId[u.phone] = u.id;
        });
        console.log('Phone to ID mapping:', phoneToId);

        // 2. Obtener mapeo de session_id (hex) a user.id (usando user_sessions)
        const [sessions] = await connection.execute('SELECT session_id, phone FROM user_sessions');
        const sessionToId = {};
        sessions.forEach(s => {
            if (phoneToId[s.phone]) {
                sessionToId[s.session_id] = phoneToId[s.phone];
            }
        });
        console.log('Session HEX to ID mapping:', sessionToId);

        // 3. Arreglar contact_groups
        const [groups] = await connection.execute('SELECT DISTINCT session_id FROM contact_groups');
        for (const row of groups) {
            const oldId = row.session_id;
            let newId = null;

            if (phoneToId[oldId]) {
                newId = phoneToId[oldId];
            } else if (sessionToId[oldId]) {
                newId = sessionToId[oldId];
            }

            if (newId && String(newId) !== String(oldId)) {
                console.log(`Updating contact_groups: ${oldId} -> ${newId}`);
                await connection.execute('UPDATE contact_groups SET session_id = ? WHERE session_id = ?', [newId, oldId]);
                await connection.execute('UPDATE contact_group_members SET session_id = ? WHERE session_id = ?', [newId, oldId]);
                await connection.execute('UPDATE broadcasts SET session_id = ? WHERE session_id = ?', [newId, oldId]);
            }
        }

        console.log('Database ID fix completed');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

fixDatabaseIds();
