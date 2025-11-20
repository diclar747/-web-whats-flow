/**
 * Función para actualizar activamente los nombres de contactos que actualmente solo tienen números
 * Esta función se puede llamar periódicamente para mantener actualizados los nombres
 */

// NOTA: Esta función se agregará al archivo principal

// Función para actualizar contactos con nombres reales desde el store de Baileys
async function updateContactsWithRealNamesFromStore(sessionId, sock) {
    if (!sock || !sock.store || !sock.store.contacts) {
        return;
    }

    try {
        const phoneNumber = await getUserPhoneNumber(sessionId);
        if (!pool || !phoneNumber) {
            return;
        }
        
        console.log(`[STORE-UPDATE] Iniciando actualización de nombres desde store para sesión: ${sessionId}`);
        
        const connection = await pool.getConnection();
        try {
            let updatedCount = 0;
            
            // Iterar a través de todos los contactos en el store
            for (const [jid, storeContact] of sock.store.contacts.entries()) {
                if (jid.includes('@s.whatsapp.net')) {
                    // Verificar si el contacto tiene un nombre real (no solo el número)
                    const hasRealName = storeContact.name && 
                                       storeContact.name !== jid.split('@')[0] && 
                                       storeContact.name.trim() !== '';
                    
                    if (hasRealName) {
                        // Actualizar en la base de datos si tiene un nombre real
                        await connection.execute(
                            `UPDATE contacts 
                             SET name = ?, notify_name = ?, updated_at = NOW()
                             WHERE jid = ? AND session_id = ? AND 
                                   (name IS NULL OR name = '' OR name = SUBSTRING_INDEX(?, '@', 1))`,
                            [storeContact.name, storeContact.notify || storeContact.name, jid, phoneNumber, jid]
                        );
                        
                        updatedCount++;
                        console.log(`[STORE-UPDATE] Actualizado contacto ${jid} con nombre: ${storeContact.name}`);
                    }
                }
            }
            
            console.log(`[STORE-UPDATE] Actualizados ${updatedCount} contactos desde el store`);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(`[STORE-UPDATE] Error actualizando contactos desde store para ${sessionId}:`, error);
    }
}

// Función para forzar actualización de todos los contactos que solo tienen números como nombres
async function forceUpdateAllNumberOnlyContacts(sessionId) {
    console.log(`[FORCE-UPDATE] Iniciando actualización forzada de contactos con solo números para sesión: ${sessionId}`);
    
    const session = sessions.get(sessionId);
    if (!session || !session.sock || !session.isConnected) {
        console.log(`[FORCE-UPDATE] Sesión no disponible para ${sessionId}`);
        return;
    }
    
    const sock = session.sock;
    const phoneNumber = await getUserPhoneNumber(sessionId);
    
    if (!pool) {
        console.log('[FORCE-UPDATE] Pool no disponible');
        return;
    }
    
    const connection = await pool.getConnection();
    try {
        // Buscar contactos que actualmente solo tienen número como nombre
        const [numberOnlyContacts] = await connection.execute(`
            SELECT jid FROM contacts 
            WHERE session_id = ? 
            AND (name IS NULL OR name = '' OR name = SUBSTRING_INDEX(jid, '@', 1))
            AND jid LIKE '%@s.whatsapp.net'
            LIMIT 100  -- Procesar por lotes
        `, [phoneNumber]);
        
        console.log(`[FORCE-UPDATE] Encontrados ${numberOnlyContacts.length} contactos con solo números como nombres`);
        
        for (const contact of numberOnlyContacts) {
            try {
                // Intentar obtener nombre real de WhatsApp
                let realName = null;
                
                // Primero intentar con sock.getName
                try {
                    realName = await sock.getName(contact.jid).catch(() => null);
                } catch (getNameErr) {
                    console.log(`[FORCE-UPDATE] getName falló para ${contact.jid}:`, getNameErr.message);
                }
                
                // Si getName no funciona, intentar actualizar store
                if (!realName || realName === contact.jid.split('@')[0]) {
                    try {
                        await sock.profilePictureUrl(contact.jid, 'image').catch(() => null);
                        
                        // Esperar a que el store se actualice
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // Verificar si el store ahora tiene el nombre
                        if (sock.store?.contacts) {
                            const storeContact = sock.store.contacts.get(contact.jid);
                            if (storeContact?.name && storeContact.name !== contact.jid.split('@')[0] && storeContact.name.trim() !== '') {
                                realName = storeContact.name;
                            }
                        }
                    } catch (updateErr) {
                        console.log(`[FORCE-UPDATE] Error actualizando store para ${contact.jid}:`, updateErr.message);
                    }
                }
                
                // Si obtenemos un nombre real, actualizar en la base de datos
                if (realName && realName !== contact.jid.split('@')[0] && realName.trim() !== '') {
                    await connection.execute(`
                        UPDATE contacts 
                        SET name = ?, notify_name = ?, updated_at = NOW()
                        WHERE jid = ? AND session_id = ?
                    `, [realName, realName, contact.jid, phoneNumber]);
                    
                    console.log(`[FORCE-UPDATE] Contacto actualizado: ${contact.jid} -> ${realName}`);
                }
            } catch (updateErr) {
                console.error(`[FORCE-UPDATE] Error actualizando contacto ${contact.jid}:`, updateErr.message);
            }
        }
        
        console.log(`[FORCE-UPDATE] Finalizada actualización para ${numberOnlyContacts.length} contactos`);
        
    } catch (error) {
        console.error(`[FORCE-UPDATE] Error general para sesión ${sessionId}:`, error);
    } finally {
        connection.release();
    }
}

module.exports = { 
    updateContactsWithRealNamesFromStore, 
    forceUpdateAllNumberOnlyContacts 
};