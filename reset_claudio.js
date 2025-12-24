const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'whatsflow2024',
    database: process.env.DB_NAME || 'whatsflow_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

async function resetPassword() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Conectado a la base de datos');

        const email = 'claudio@cnid.com.py';
        const newPassword = '123456';
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // 1. Resetear password
        const [result] = await connection.execute(
            'UPDATE users SET password = ? WHERE email = ?',
            [hashedPassword, email]
        );

        if (result.affectedRows > 0) {
            console.log(`✅ Contraseña actualizada para ${email}`);
        } else {
            console.log(`❌ Usuario ${email} no encontrado`);
        }

        // 2. Verificar usuario
        const [users] = await connection.execute(
            'SELECT id, email, role, session FROM users WHERE email = ?',
            [email]
        );
        console.log('Usuario:', users[0]);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

resetPassword();
