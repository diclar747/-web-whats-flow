require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });
const mysql = require('mysql2/promise');

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'whatsflow'
    });

    try {
        console.log('Ejecutando corrección de session_id...');
        const [result] = await connection.execute(
            `UPDATE users 
             SET session_id = admin_phone 
             WHERE session_id IS NULL AND admin_phone IS NOT NULL AND role != 'admin'`
        );
        console.log(`Filas actualizadas: ${result.affectedRows}`);

        const [rows] = await connection.execute(
            "SELECT id, email, session_id FROM users WHERE role='agent'"
        );
        console.log('Agentes actuales:', rows);

    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

run();
