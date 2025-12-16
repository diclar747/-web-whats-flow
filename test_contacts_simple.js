const mysql = require('mysql2/promise');

async function testContacts() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'whatsflow2024',
        database: 'whatsflow'
    });

    try {
        const phone = '595985768793';
        
        // Buscar "Aldo"
        const [contacts] = await pool.execute(
            `SELECT jid, name, notify_name FROM contacts 
             WHERE session_id = ? 
             AND jid LIKE '%@s.whatsapp.net'
             AND (name LIKE '%aldo%' OR notify_name LIKE '%aldo%')
             LIMIT 5`,
            [phone]
        );
        
        console.log(`\n🔍 Búsqueda "aldo" para ${phone}:`);
        console.log(`Encontrados: ${contacts.length} contactos\n`);
        
        contacts.forEach(c => {
            const displayName = c.name || c.notify_name || 'Sin nombre';
            const phoneNum = c.jid.split('@')[0];
            console.log(`- ${displayName} (${phoneNum})`);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

testContacts();
