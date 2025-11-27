const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkChatAssignments() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectionLimit: 10
        });
        
        const connection = await pool.getConnection();
        
        // Verificar estructura de chat_assignments
        const [columns] = await connection.execute('DESCRIBE chat_assignments');
        console.log('📋 Estructura de chat_assignments:');
        columns.forEach(col => {
            console.log(`  ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
        
        // Verificar algunos registros de ejemplo
        const [assignments] = await connection.execute('SELECT * FROM chat_assignments LIMIT 5');
        console.log('\n📊 Registros de ejemplo en chat_assignments:');
        assignments.forEach(assignment => {
            console.log(`  ID: ${assignment.id}, user_id: ${assignment.user_id}, session_id: ${assignment.session_id}, chat_jid: ${assignment.chat_jid}`);
        });
        
        // Verificar usuarios existentes
        const [users] = await connection.execute('SELECT id, phone, email, role FROM users LIMIT 5');
        console.log('\n👥 Usuarios existentes:');
        users.forEach(user => {
            console.log(`  ID: ${user.id}, Phone: ${user.phone}, Email: ${user.email}, Role: ${user.role}`);
        });
        
        connection.release();
        pool.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkChatAssignments();