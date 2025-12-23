// Script que verifica y fuerza session=0 automáticamente
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Q7w2E!r8T@y9P#m3',
    database: 'whatsflow',
    waitForConnections: true,
    connectionLimit: 10
});

async function checkAndForceLogout() {
    try {
        const connection = await pool.getConnection();
        
        // Actualizar session=0 donde user_sessions.is_active=0
        const [result] = await connection.query(`
            UPDATE users u
            LEFT JOIN user_sessions us ON u.phone = us.phone OR u.id = us.session_id
            SET u.session = 0
            WHERE us.is_active = 0 OR us.id IS NULL
        `);
        
        if (result.affectedRows > 0) {
            console.log(`[AUTO-LOGOUT] ✅ Forzado session=0 para ${result.affectedRows} usuarios inactivos`);
        }
        
        connection.release();
    } catch (error) {
        console.error('[AUTO-LOGOUT] Error:', error.message);
    }
}

// Ejecutar cada 5 segundos
setInterval(checkAndForceLogout, 5000);
console.log('[AUTO-LOGOUT] ✅ Checker iniciado - ejecutando cada 5 segundos');

// Ejecutar inmediatamente al iniciar
checkAndForceLogout();

module.exports = checkAndForceLogout;
