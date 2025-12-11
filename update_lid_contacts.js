const mysql = require('mysql2/promise');

// Configuración de base de datos
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '6t1UL4.t9-nk',
    database: 'whatsflow',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function updateLidContacts() {
    console.log('🔄 Actualizando contactos LID...');
    
    try {
        const connection = await pool.getConnection();
        
        try {
            // Buscar todos los contactos LID con nombre igual al número
            const [lidContacts] = await connection.execute(`
                SELECT DISTINCT jid, name, notify_name, session_id 
                FROM contacts 
                WHERE jid LIKE '%@lid' 
                AND (name = SUBSTRING_INDEX(jid, '@', 1) OR notify_name IS NULL OR notify_name = SUBSTRING_INDEX(jid, '@', 1))
            `);
            
            console.log(`📋 Encontrados ${lidContacts.length} contactos LID sin nombre real`);
            
            for (const contact of lidContacts) {
                const phoneNumber = contact.jid.split('@')[0];
                console.log(`\n🔍 Procesando: ${contact.jid}`);
                
                // Actualizar el nombre a algo más amigable
                const friendlyName = `Contacto ${phoneNumber.substring(0, 4)}...${phoneNumber.substring(phoneNumber.length - 4)}`;
                
                await connection.execute(`
                    UPDATE contacts 
                    SET name = ?, 
                        notify_name = ?,
                        updated_at = NOW()
                    WHERE jid = ? AND session_id = ?
                `,
                    [friendlyName, friendlyName, contact.jid, contact.session_id]
                );
                
                console.log(`✅ Actualizado: ${contact.jid} -> ${friendlyName}`);
            }
            
            console.log(`\n✨ Proceso completado. ${lidContacts.length} contactos actualizados.`);
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

updateLidContacts();
