const mysql = require('mysql2/promise');

async function checkAvatars() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'whatsflow_user',
        password: 'Diclar2024@',
        database: 'whatsapp_crm',
        waitForConnections: true,
        connectionLimit: 10
    });

    try {
        // Contar contactos sin avatar
        const [contactsWithoutAvatar] = await pool.query(
            `SELECT COUNT(*) as count FROM contacts 
             WHERE (avatar_url IS NULL OR avatar_url = '') 
             AND jid LIKE '%@s.whatsapp.net'`
        );

        console.log('\n=== DIAGNÓSTICO DE AVATARES ===');
        console.log(`Contactos SIN avatar: ${contactsWithoutAvatar[0].count}`);

        // Contar contactos CON avatar
        const [contactsWithAvatar] = await pool.query(
            `SELECT COUNT(*) as count FROM contacts 
             WHERE avatar_url IS NOT NULL AND avatar_url != '' 
             AND jid LIKE '%@s.whatsapp.net'`
        );
        console.log(`Contactos CON avatar: ${contactsWithAvatar[0].count}`);

        // Mostrar algunos ejemplos de contactos sin avatar
        const [examples] = await pool.query(
            `SELECT jid, name, session_id FROM contacts 
             WHERE (avatar_url IS NULL OR avatar_url = '') 
             AND jid LIKE '%@s.whatsapp.net'
             LIMIT 10`
        );

        console.log('\n=== EJEMPLOS DE CONTACTOS SIN AVATAR ===');
        examples.forEach(c => {
            console.log(`  - ${c.name || 'Sin nombre'} (${c.jid}) - session: ${c.session_id}`);
        });

        // Verificar sesiones activas
        const [activeSessions] = await pool.query(
            `SELECT session_id, phone, name, is_active FROM user_sessions 
             WHERE is_active = 1 
             LIMIT 5`
        );

        console.log('\n=== SESIONES ACTIVAS ===');
        activeSessions.forEach(s => {
            console.log(`  - ${s.name || s.phone} (session_id: ${s.session_id}, is_active: ${s.is_active})`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkAvatars();
