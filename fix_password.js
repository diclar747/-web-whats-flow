const mysql = require('mysql2/promise');
const { hashPassword } = require('./src/server/auth-utils');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'whatsflow'
};

async function fixPassword() {
    try {
        console.log('Connecting to DB...');
        const connection = await mysql.createConnection(dbConfig);

        console.log('Hashing password...');
        const hashedPassword = await hashPassword('123456');

        console.log('Updating user 3...');
        const [result] = await connection.execute(
            'UPDATE users SET password = ? WHERE id = 3',
            [hashedPassword]
        );

        console.log('Update result:', result);
        console.log('Done.');
        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

fixPassword();
