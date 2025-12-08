const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'whatsapp_crm'
};

async function inspectData() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        console.log('--- USER INFO ---');
        const [users] = await connection.execute('SELECT id, name, email, role FROM users WHERE email = ?', ['claudio@cnid.com.py']);
        console.log(users);

        if (users.length > 0) {
            const userId = users[0].id;
            console.log(`\n--- CHAT ASSIGNMENTS FOR USER ${userId} ---`);
            const [assignments] = await connection.execute('SELECT * FROM chat_assignments WHERE user_id = ?', [userId]);
            console.log(assignments);

            if (assignments.length === 0) {
                console.log('\n--- CHECKING FOR UNASSIGNED OR PENDING TRANSFERS ---');
                // Maybe they were assigned to an ID that assumes numeric vs string mismatch?
                const [all_assignments] = await connection.execute('SELECT * FROM chat_assignments ORDER BY id DESC LIMIT 5');
                console.log('Latest 5 assignments in DB:', all_assignments);
            }
        } else {
            console.log('User not found!');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

inspectData();
