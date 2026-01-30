const mysql = require('mysql2/promise');
const { hashPassword } = require('./src/server/auth-utils');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'whatsflow2024',
    database: 'whatsflow'
};

async function fixUser3() {
    try {
        console.log('Connecting to DB...');
        const connection = await mysql.createConnection(dbConfig);

        console.log('Hashing password "123456"...');
        const hashedPassword = await hashPassword('123456');

        console.log('Updating user 3...');
        // Set password, session=1, session_id=1
        const [result] = await connection.execute(
            'UPDATE users SET password = ?, session = 1, session_id = 1 WHERE id = 3',
            [hashedPassword]
        );

        console.log('Update result:', result);

        // Also ensure an agent record exists if needed?
        // Checking if agent_id is set
        const [rows] = await connection.execute('SELECT agent_id FROM users WHERE id = 3');
        if (rows.length > 0 && rows[0].agent_id) {
            console.log('User 3 is linked to agent_id:', rows[0].agent_id);
            // Ensure agent record exists and is active
            await connection.execute('UPDATE agents SET status = "active", session_id = 1 WHERE id = ?', [rows[0].agent_id]);
            console.log('Agent status set to active and linked to session 1');
        }

        console.log('Done.');
        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

fixUser3();
