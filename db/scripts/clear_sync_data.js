/**
 * Script para limpiar todos los datos de sincronización de WhatsApp
 *
 * Uso:
 *   node db/scripts/clear_sync_data.js
 *
 * O para limpiar solo datos de un usuario específico:
 *   node db/scripts/clear_sync_data.js +1234567890
 *
 * ADVERTENCIA: Este script eliminará TODOS los datos de sincronización
 * Asegúrate de hacer un backup antes si necesitas los datos
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'WhatsFlow2024!',
  database: process.env.DB_NAME || 'whatsflow'
};

async function clearAllData() {
  let connection;

  try {
    console.log('🔄 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);

    console.log('✅ Conectado a la base de datos\n');

    // Desactivar verificaciones de llaves foráneas
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Limpiar tabla de mensajes
    console.log('🗑️  Limpiando tabla messages...');
    const [messagesResult] = await connection.query('DELETE FROM messages');
    console.log(`   ✅ ${messagesResult.affectedRows} mensajes eliminados\n`);

    // Limpiar tabla de miembros de grupos
    console.log('🗑️  Limpiando tabla contact_group_members...');
    const [membersResult] = await connection.query('DELETE FROM contact_group_members');
    console.log(`   ✅ ${membersResult.affectedRows} relaciones eliminadas\n`);

    // Limpiar tabla de grupos
    console.log('🗑️  Limpiando tabla contact_groups...');
    const [groupsResult] = await connection.query('DELETE FROM contact_groups');
    console.log(`   ✅ ${groupsResult.affectedRows} grupos eliminados\n`);

    // Limpiar tabla de contactos
    console.log('🗑️  Limpiando tabla contacts...');
    const [contactsResult] = await connection.query('DELETE FROM contacts');
    console.log(`   ✅ ${contactsResult.affectedRows} contactos eliminados\n`);

    // Limpiar tabla de broadcasts
    console.log('🗑️  Limpiando tabla broadcasts...');
    const [broadcastsResult] = await connection.query('DELETE FROM broadcasts');
    console.log(`   ✅ ${broadcastsResult.affectedRows} broadcasts eliminados\n`);

    // Resetear flags de sincronización en usuarios
    console.log('🔄 Reseteando flags de sincronización en tabla users...');
    const [usersResult] = await connection.query(`
      UPDATE users
      SET auto_sync = FALSE,
          sync_completed = FALSE,
          last_sync_date = NULL
      WHERE 1=1
    `);
    console.log(`   ✅ ${usersResult.affectedRows} usuarios actualizados\n`);

    // Reactivar verificaciones de llaves foráneas
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // Mostrar resumen
    console.log('📊 Resumen:');
    console.log('━'.repeat(50));
    console.log(`   Mensajes eliminados:        ${messagesResult.affectedRows}`);
    console.log(`   Contactos eliminados:       ${contactsResult.affectedRows}`);
    console.log(`   Grupos eliminados:          ${groupsResult.affectedRows}`);
    console.log(`   Miembros eliminados:        ${membersResult.affectedRows}`);
    console.log(`   Broadcasts eliminados:      ${broadcastsResult.affectedRows}`);
    console.log(`   Usuarios reseteados:        ${usersResult.affectedRows}`);
    console.log('━'.repeat(50));
    console.log('✅ Limpieza completada exitosamente\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

async function clearUserData(phoneNumber) {
  let connection;

  try {
    console.log(`🔄 Conectando a la base de datos...`);
    connection = await mysql.createConnection(dbConfig);

    console.log(`✅ Conectado a la base de datos\n`);
    console.log(`📱 Limpiando datos para usuario: ${phoneNumber}\n`);

    // Desactivar verificaciones de llaves foráneas
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Limpiar mensajes del usuario
    console.log('🗑️  Limpiando mensajes...');
    const [messagesResult] = await connection.query(
      'DELETE FROM messages WHERE session_id = ?',
      [phoneNumber]
    );
    console.log(`   ✅ ${messagesResult.affectedRows} mensajes eliminados\n`);

    // Obtener IDs de grupos del usuario para limpiar miembros
    const [groups] = await connection.query(
      'SELECT id FROM contact_groups WHERE session_id = ?',
      [phoneNumber]
    );
    const groupIds = groups.map(g => g.id);

    if (groupIds.length > 0) {
      console.log('🗑️  Limpiando miembros de grupos...');
      const [membersResult] = await connection.query(
        'DELETE FROM contact_group_members WHERE group_id IN (?)',
        [groupIds]
      );
      console.log(`   ✅ ${membersResult.affectedRows} relaciones eliminadas\n`);
    }

    // Limpiar grupos del usuario
    console.log('🗑️  Limpiando grupos...');
    const [groupsResult] = await connection.query(
      'DELETE FROM contact_groups WHERE session_id = ?',
      [phoneNumber]
    );
    console.log(`   ✅ ${groupsResult.affectedRows} grupos eliminados\n`);

    // Limpiar contactos del usuario
    console.log('🗑️  Limpiando contactos...');
    const [contactsResult] = await connection.query(
      'DELETE FROM contacts WHERE session_id = ?',
      [phoneNumber]
    );
    console.log(`   ✅ ${contactsResult.affectedRows} contactos eliminados\n`);

    // Limpiar broadcasts del usuario
    console.log('🗑️  Limpiando broadcasts...');
    const [broadcastsResult] = await connection.query(
      'DELETE FROM broadcasts WHERE session_id = ?',
      [phoneNumber]
    );
    console.log(`   ✅ ${broadcastsResult.affectedRows} broadcasts eliminados\n`);

    // Resetear flags de sincronización del usuario
    console.log('🔄 Reseteando flags de sincronización...');
    const [usersResult] = await connection.query(`
      UPDATE users
      SET auto_sync = FALSE,
          sync_completed = FALSE,
          last_sync_date = NULL
      WHERE phone = ?
    `, [phoneNumber]);
    console.log(`   ✅ Usuario actualizado\n`);

    // Reactivar verificaciones de llaves foráneas
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // Mostrar resumen
    console.log('📊 Resumen:');
    console.log('━'.repeat(50));
    console.log(`   Usuario:                    ${phoneNumber}`);
    console.log(`   Mensajes eliminados:        ${messagesResult.affectedRows}`);
    console.log(`   Contactos eliminados:       ${contactsResult.affectedRows}`);
    console.log(`   Grupos eliminados:          ${groupsResult.affectedRows}`);
    console.log(`   Broadcasts eliminados:      ${broadcastsResult.affectedRows}`);
    console.log('━'.repeat(50));
    console.log('✅ Limpieza completada exitosamente\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar script
const phoneNumber = process.argv[2];

if (phoneNumber) {
  clearUserData(phoneNumber);
} else {
  console.log('⚠️  ADVERTENCIA: Se eliminarán TODOS los datos de sincronización');
  console.log('⚠️  Presiona Ctrl+C en los próximos 5 segundos para cancelar...\n');

  setTimeout(() => {
    clearAllData();
  }, 5000);
}
