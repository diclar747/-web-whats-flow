const mysql = require('mysql2/promise');

async function checkContacts() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'whatsflow2024',
        database: 'whatsflow'
    });

    try {
        const adminPhone = '595994854167';
        
        console.log('\n🔍 Buscando contactos para el admin:', adminPhone);
        
        const [contacts] = await pool.execute(
            `SELECT jid, name, notify_name, session_id 
             FROM contacts 
             WHERE session_id = ? AND jid LIKE '%@s.whatsapp.net' 
             ORDER BY name 
             LIMIT 10`,
            [adminPhone]
        );
        
        console.log(`\n📊 Encontrados ${contacts.length} contactos individuales\n`);
        console.log('════════════════════════════════════════════════════════');
        
        if (contacts.length > 0) {
            contacts.forEach((c, i) => {
                console.log(`${i + 1}. ${c.name || c.notify_name || 'Sin nombre'}`);
                console.log(`   JID: ${c.jid}`);
                console.log(`   SessionID: ${c.session_id}`);
                console.log('────────────────────────────────────────────────────');
            });
        } else {
            console.log('❌ No se encontraron contactos');
            console.log('Posibles razones:');
            console.log('1. No se han sincronizado contactos');
            console.log('2. El sessionId no coincide');
            console.log('3. No hay contactos individuales (solo grupos)');
        }
        
        // Ver si hay contactos con otros session_ids
        const [allContacts] = await pool.execute(
            `SELECT DISTINCT session_id, COUNT(*) as total 
             FROM contacts 
             WHERE jid LIKE '%@s.whatsapp.net' 
             GROUP BY session_id 
             LIMIT 5`
        );
        
        console.log('\n📋 Contactos por SessionID:');
        console.log('════════════════════════════════════════════════════════');
        allContacts.forEach(row => {
            console.log(`SessionID: ${row.session_id} → ${row.total} contactos`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkContacts();
