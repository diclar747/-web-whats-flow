// Script para limpiar chats propios de la base de datos
// Ejecutar: node cleanup_own_chats.js

const mysql = require('mysql2/promise');

async function cleanupOwnChats() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'whatsflow_user',
        password: 'Cnid2024**',
        database: 'whatsflow_db',
        waitForConnections: true,
        connectionLimit: 10
    });

    try {
        const connection = await pool.getConnection();

        console.log('🔍 Buscando chats propios en la base de datos...');

        // Buscar y eliminar chats donde el chat_jid coincide con el número de sesión
        const [result] = await connection.execute(`
            DELETE c FROM chats c
            WHERE c.chat_jid LIKE CONCAT(SUBSTRING_INDEX(c.session_id, '@', 1), '%')
               OR c.chat_jid = CONCAT(SUBSTRING_INDEX(c.session_id, '@', 1), '@s.whatsapp.net')
               OR c.chat_jid = CONCAT(SUBSTRING_INDEX(c.session_id, '@', 1), '@c.us')
        `);

        console.log(`✅ Eliminados ${result.affectedRows} chats propios de la base de datos`);

        // Específicamente para el número 595985768793
        const [result2] = await connection.execute(`
            DELETE FROM chats 
            WHERE chat_jid LIKE '595985768793%'
               OR chat_jid = '595985768793@s.whatsapp.net'
               OR chat_jid = '595985768793@c.us'
        `);

        console.log(`✅ Eliminados ${result2.affectedRows} chats del número 595985768793`);

        connection.release();
        await pool.end();

        console.log('✅ Limpieza completada. Reinicia el navegador para ver los cambios.');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

cleanupOwnChats();
