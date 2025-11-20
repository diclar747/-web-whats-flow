const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'whatsflow'
};

// Obtener configuración de sincronización del usuario
router.get('/preference/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    
    try {
      const [users] = await connection.query(
        'SELECT auto_sync, sync_completed, last_sync_date FROM users WHERE phone = ?',
        [sessionId]
      );

      if (users.length === 0) {
        return res.json({
          success: true,
          auto_sync: false,
          sync_completed: false,
          last_sync_date: null
        });
      }

      res.json({
        success: true,
        auto_sync: users[0].auto_sync || false,
        sync_completed: users[0].sync_completed || false,
        last_sync_date: users[0].last_sync_date
      });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('Error getting sync preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar preferencia de sincronización automática
router.post('/preference/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { auto_sync } = req.body;

    console.log(`[SYNC-PREF] Actualizando auto_sync a ${auto_sync} para ${sessionId}`);

    const connection = await mysql.createConnection(dbConfig);
    
    try {
      // Solo actualizar si el usuario ya existe (admin que escaneó QR)
      const result = await connection.query(
        'UPDATE users SET auto_sync = ? WHERE phone = ?',
        [auto_sync, sessionId]
      );
      
      console.log(`[SYNC-PREF] Filas afectadas: ${result[0].affectedRows}`);

      if (result[0].affectedRows === 0) {
        console.log(`[SYNC-PREF] Usuario no existe en BD todavía (aún no escaneó QR)`);
      } else {
        console.log(`[SYNC-PREF] auto_sync actualizado a ${auto_sync} para ${sessionId}`);
      }

      res.json({
        success: true,
        message: auto_sync ? 'Sincronización automática activada' : 'Sincronización automática desactivada',
        auto_sync: auto_sync
      });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('Error updating sync preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Forzar sincronización manual completa
router.post('/force/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Obtener el cliente de WhatsApp
    const whatsappClients = req.app.get('whatsappClients');
    
    if (!whatsappClients || !whatsappClients[sessionId]) {
      return res.status(404).json({
        success: false,
        error: 'Sesión de WhatsApp no encontrada. Escanea el código QR primero.'
      });
    }

    const sock = whatsappClients[sessionId];
    
    if (!sock.user) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp no está conectado'
      });
    }

    console.log(`[SYNC] 🔄 Iniciando sincronización manual completa para ${sessionId}`);

    // Emit evento para que el cliente sepa que inició la sincronización
    const io = req.app.get('io');
    if (io) {
      io.to(`session-${sessionId}`).emit('sync-started', {
        message: 'Sincronización iniciada'
      });
    }

    const connection = await mysql.createConnection(dbConfig);
    let totalChats = 0;
    let totalContacts = 0;
    let totalGroups = 0;

    try {
      // Verificar si el store existe
      console.log(`[SYNC] 🔍 Verificando store de WhatsApp...`);
      console.log(`[SYNC] - sock.store existe:`, !!sock.store);
      console.log(`[SYNC] - sock.store.chats existe:`, !!sock.store?.chats);
      console.log(`[SYNC] - sock.store.contacts existe:`, !!sock.store?.contacts);
      
      // ALTERNATIVA: Si el store está vacío, consultar directamente a la base de datos local de WhatsApp
      let allChatsSource = sock.store?.chats;
      
      if (!allChatsSource || allChatsSource.size === 0) {
        console.log(`[SYNC] ⚠️ Store vacío, consultando base de datos de WhatsApp...`);
        // Consultar la BD local que ya tiene los chats
        try {
          const [existingChats] = await connection.query(
            'SELECT DISTINCT jid, name FROM contacts WHERE session_id = ? AND is_group = 0',
            [sessionId]
          );
          console.log(`[SYNC] - Chats encontrados en BD local:`, existingChats.length);
          
          // Convertir a formato Map para usar el mismo código
          allChatsSource = new Map();
          existingChats.forEach(chat => {
            allChatsSource.set(chat.jid, { id: chat.jid, name: chat.name });
          });
        } catch (err) {
          console.error(`[SYNC] Error consultando BD local:`, err.message);
          allChatsSource = new Map();
        }
      }
      
      // 1. Sincronizar CHATS INDIVIDUALES
      console.log(`[SYNC] 📱 Obteniendo chats individuales...`);
      const chatArray = Array.from(allChatsSource.values());
      console.log(`[SYNC] - Total chats a sincronizar:`, chatArray.length);
      
      for (const chat of chatArray) {
        try {
          const chatId = chat.id;
          const isGroup = chatId.endsWith('@g.us');
          
          if (!isGroup) {
            // Es un chat individual
            const [existing] = await connection.query(
              'SELECT id FROM contacts WHERE jid = ? AND session_id = ?',
              [chatId, sessionId]
            );

            if (existing.length === 0) {
              await connection.query(
                `INSERT INTO contacts (jid, name, session_id, is_group, created_at) 
                 VALUES (?, ?, ?, ?, NOW())`,
                [chatId, chat.name || chatId.split('@')[0], sessionId, false]
              );
              totalChats++;
            }
          }
        } catch (err) {
          console.error(`[SYNC] Error guardando chat ${chat.id}:`, err.message);
        }
      }
      console.log(`[SYNC] ✅ ${totalChats} chats individuales sincronizados`);

      // 2. Sincronizar GRUPOS
      console.log(`[SYNC] 👥 Obteniendo grupos...`);
      let groupList = [];
      
      try {
        const groups = await sock.groupFetchAllParticipating();
        groupList = Object.values(groups);
        console.log(`[SYNC] - Total grupos desde WhatsApp:`, groupList.length);
      } catch (err) {
        console.log(`[SYNC] ⚠️ No se pudieron obtener grupos de WhatsApp, consultando BD...`);
        // Consultar grupos de la BD local
        const [existingGroups] = await connection.query(
          'SELECT jid, name FROM contact_groups WHERE session_id = ?',
          [sessionId]
        );
        groupList = existingGroups.map(g => ({ id: g.jid, subject: g.name }));
        console.log(`[SYNC] - Total grupos desde BD:`, groupList.length);
      }

      for (const group of groupList) {
        try {
          const [existing] = await connection.query(
            'SELECT id FROM contact_groups WHERE jid = ? AND session_id = ?',
            [group.id, sessionId]
          );

          if (existing.length === 0) {
            await connection.query(
              `INSERT INTO contact_groups (jid, name, session_id, created_at) 
               VALUES (?, ?, ?, NOW())`,
              [group.id, group.subject, sessionId]
            );
            totalGroups++;
          }
        } catch (err) {
          console.error(`[SYNC] Error guardando grupo ${group.id}:`, err.message);
        }
      }
      console.log(`[SYNC] ✅ ${totalGroups} grupos sincronizados`);

      // 3. Sincronizar CONTACTOS
      console.log(`[SYNC] 📞 Obteniendo contactos...`);
      const contacts = sock.store?.contacts || {};
      const contactList = Object.values(contacts);
      console.log(`[SYNC] - Total contactos en store:`, contactList.length);

      for (const contact of contactList) {
        try {
          if (contact.id && !contact.id.includes('@g.us')) {
            const [existing] = await connection.query(
              'SELECT id FROM contacts WHERE jid = ? AND session_id = ?',
              [contact.id, sessionId]
            );

            if (existing.length === 0) {
              await connection.query(
                `INSERT INTO contacts (jid, name, session_id, is_group, created_at) 
                 VALUES (?, ?, ?, ?, NOW())`,
                [contact.id, contact.name || contact.notify || contact.id.split('@')[0], sessionId, false]
              );
              totalContacts++;
            }
          }
        } catch (err) {
          console.error(`[SYNC] Error guardando contacto ${contact.id}:`, err.message);
        }
      }
      console.log(`[SYNC] ✅ ${totalContacts} contactos sincronizados`);

      // Marcar como sincronizado en la BD
      await connection.query(
        'UPDATE users SET sync_completed = TRUE, last_sync_date = NOW() WHERE phone = ?',
        [sessionId]
      );

      console.log(`[SYNC] 🎉 Sincronización completada!`);
      console.log(`[SYNC]    - Chats: ${totalChats}`);
      console.log(`[SYNC]    - Contactos: ${totalContacts}`);
      console.log(`[SYNC]    - Grupos: ${totalGroups}`);

      // Emit evento de sincronización completada
      if (io) {
        io.to(`session-${sessionId}`).emit('sync-complete', {
          message: 'Sincronización completada',
          stats: {
            chats: totalChats + totalGroups,
            contacts: totalContacts
          }
        });
      }

      res.json({
        success: true,
        message: 'Sincronización completada',
        stats: {
          chats: totalChats + totalGroups,
          contacts: totalContacts
        }
      });
    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('Error forcing sync:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Limpiar todos los datos de sincronización de un usuario
router.delete('/clear/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const connection = await mysql.createConnection(dbConfig);

    console.log(`[SYNC-CLEAR] Limpiando datos de sincronización para ${sessionId}`);

    try {
      // Desactivar verificaciones de llaves foráneas
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');

      // Limpiar mensajes del usuario
      const [messagesResult] = await connection.query(
        'DELETE FROM messages WHERE session_id = ?',
        [sessionId]
      );

      // Obtener IDs de grupos del usuario para limpiar miembros
      const [groups] = await connection.query(
        'SELECT id FROM contact_groups WHERE session_id = ?',
        [sessionId]
      );
      const groupIds = groups.map(g => g.id);

      let membersCount = 0;
      if (groupIds.length > 0) {
        const [membersResult] = await connection.query(
          'DELETE FROM contact_group_members WHERE group_id IN (?)',
          [groupIds]
        );
        membersCount = membersResult.affectedRows;
      }

      // Limpiar grupos del usuario
      const [groupsResult] = await connection.query(
        'DELETE FROM contact_groups WHERE session_id = ?',
        [sessionId]
      );

      // Limpiar contactos del usuario
      const [contactsResult] = await connection.query(
        'DELETE FROM contacts WHERE session_id = ?',
        [sessionId]
      );

      // Limpiar broadcasts del usuario
      const [broadcastsResult] = await connection.query(
        'DELETE FROM broadcasts WHERE session_id = ?',
        [sessionId]
      );

      // Resetear flags de sincronización del usuario
      await connection.query(
        `UPDATE users
         SET auto_sync = FALSE,
             sync_completed = FALSE,
             last_sync_date = NULL
         WHERE phone = ?`,
        [sessionId]
      );

      // Reactivar verificaciones de llaves foráneas
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');

      console.log(`[SYNC-CLEAR] Limpieza completada:`);
      console.log(`  - Mensajes: ${messagesResult.affectedRows}`);
      console.log(`  - Contactos: ${contactsResult.affectedRows}`);
      console.log(`  - Grupos: ${groupsResult.affectedRows}`);
      console.log(`  - Miembros: ${membersCount}`);
      console.log(`  - Broadcasts: ${broadcastsResult.affectedRows}`);

      res.json({
        success: true,
        message: 'Datos de sincronización eliminados exitosamente',
        stats: {
          messages: messagesResult.affectedRows,
          contacts: contactsResult.affectedRows,
          groups: groupsResult.affectedRows,
          members: membersCount,
          broadcasts: broadcastsResult.affectedRows
        }
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('[SYNC-CLEAR] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
