const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function updatePassword() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        database: 'whatsflow',
        waitForConnections: true,
        connectionLimit: 10
    });
    
    try {
        const hashedPassword = await bcrypt.hash('1234567', 10);
        
        const connection = await pool.getConnection();
        try {
            await connection.execute(
                'UPDATE users SET password = ? WHERE email = ?',
                [hashedPassword, 'claudio@cnid.com.py']
            );
            console.log('✅ Contraseña actualizada para claudio@cnid.com.py');
        } finally {
            connection.release();
        }
        
        await pool.end();
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

updatePassword();
