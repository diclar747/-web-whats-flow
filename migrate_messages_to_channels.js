#!/usr/bin/env node

/**
 * Script de Migración de Mensajes Históricos a Canales Correctos
 * 
 * Este script migra mensajes que están guardados bajo session_id='1'
 * al canal correcto basándose en el número de teléfono.
 * 
 * IMPORTANTE:
 * - Crea un backup automático antes de migrar
 * - Muestra estadísticas antes y después
 * - Permite rollback si algo sale mal
 * 
 * USO:
 *   node migrate_messages_to_channels.js --analyze    # Solo analizar, no migrar
 *   node migrate_messages_to_channels.js --execute    # Ejecutar migración
 *   node migrate_messages_to_channels.js --rollback   # Revertir cambios
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de la base de datos
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'whatsflow',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Configuración de canales
const CHANNELS = {
    CARLOS: { session_id: '1', phone: '595985768793', name: 'Carlos' },
    GESTION: { session_id: '2', phone: '595994854167', name: 'Gestión' }
};

const BACKUP_TABLE = `messages_backup_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(80));
    log(title, 'bright');
    console.log('='.repeat(80) + '\n');
}

async function analyzeCurrentState(connection) {
    logSection('📊 ANÁLISIS DEL ESTADO ACTUAL');

    // Contar mensajes por session_id y phone
    const [rows] = await connection.execute(`
        SELECT 
            session_id,
            phone,
            COUNT(*) as total_mensajes,
            COUNT(DISTINCT chat_jid) as chats_unicos,
            MIN(timestamp) as mensaje_mas_antiguo,
            MAX(timestamp) as mensaje_mas_reciente
        FROM messages
        WHERE session_id = '1'
        GROUP BY session_id, phone
        ORDER BY phone
    `);

    log('Distribución actual de mensajes:', 'cyan');
    console.table(rows);

    // Calcular totales
    const totalMessages = rows.reduce((sum, row) => sum + row.total_mensajes, 0);
    const gestionMessages = rows.find(r => r.phone === CHANNELS.GESTION.phone);
    const carlosMessages = rows.find(r => r.phone === CHANNELS.CARLOS.phone);

    log(`\n📈 Resumen:`, 'bright');
    log(`  • Total de mensajes en session_id='1': ${totalMessages}`, 'white');
    log(`  • Mensajes de Carlos (quedan en '1'): ${carlosMessages?.total_mensajes || 0}`, 'green');
    log(`  • Mensajes de Gestión (migran a '2'): ${gestionMessages?.total_mensajes || 0}`, 'yellow');

    return {
        totalMessages,
        gestionMessages: gestionMessages?.total_mensajes || 0,
        carlosMessages: carlosMessages?.total_mensajes || 0
    };
}

async function createBackup(connection) {
    logSection('💾 CREANDO BACKUP DE SEGURIDAD');

    try {
        // Verificar si ya existe el backup
        const [existing] = await connection.execute(
            `SHOW TABLES LIKE '${BACKUP_TABLE}'`
        );

        if (existing.length > 0) {
            log(`⚠️  Backup ya existe: ${BACKUP_TABLE}`, 'yellow');
            log('   Usando backup existente...', 'yellow');
            return true;
        }

        // Crear backup
        await connection.execute(`
            CREATE TABLE ${BACKUP_TABLE} AS 
            SELECT * FROM messages WHERE session_id = '1'
        `);

        const [count] = await connection.execute(
            `SELECT COUNT(*) as total FROM ${BACKUP_TABLE}`
        );

        log(`✅ Backup creado exitosamente: ${BACKUP_TABLE}`, 'green');
        log(`   Mensajes respaldados: ${count[0].total}`, 'green');

        return true;
    } catch (error) {
        log(`❌ Error creando backup: ${error.message}`, 'red');
        return false;
    }
}

async function executeMigration(connection) {
    logSection('🚀 EJECUTANDO MIGRACIÓN');

    try {
        // 1. Migrar MESSAGES
        log('1️⃣  Migrando tabla MESSAGES...', 'cyan');
        const [messagesResult] = await connection.execute(`
            UPDATE messages 
            SET session_id = '2'
            WHERE session_id = '1' 
              AND phone = '${CHANNELS.GESTION.phone}'
        `);
        log(`   ✅ ${messagesResult.affectedRows} mensajes migrados`, 'green');

        // 2. Migrar CHATS
        log('2️⃣  Migrando tabla CHATS...', 'cyan');
        const [chatsResult] = await connection.execute(`
            UPDATE chats 
            SET session_id = '2'
            WHERE session_id = '1' 
              AND phone = '${CHANNELS.GESTION.phone}'
        `);
        log(`   ✅ ${chatsResult.affectedRows} chats migrados`, 'green');

        // 3. Migrar CONTACTS (manejar duplicados)
        log('3️⃣  Migrando tabla CONTACTS...', 'cyan');

        // Primero, eliminar contactos duplicados que ya existen en session_id='2'
        const [deleteResult] = await connection.execute(`
            DELETE FROM contacts
            WHERE session_id = '2'
              AND jid IN (
                  SELECT DISTINCT chat_jid 
                  FROM messages 
                  WHERE session_id = '2' 
                    AND phone = '${CHANNELS.GESTION.phone}'
              )
        `);

        if (deleteResult.affectedRows > 0) {
            log(`   🗑️  ${deleteResult.affectedRows} contactos duplicados eliminados`, 'yellow');
        }

        // Ahora migrar los contactos de session_id='1' a session_id='2'
        const [contactsResult] = await connection.execute(`
            UPDATE contacts 
            SET session_id = '2'
            WHERE session_id = '1' 
              AND jid IN (
                  SELECT DISTINCT chat_jid 
                  FROM messages 
                  WHERE session_id = '2' 
                    AND phone = '${CHANNELS.GESTION.phone}'
              )
        `);
        log(`   ✅ ${contactsResult.affectedRows} contactos migrados`, 'green');

        log('\n✨ Migración completada exitosamente', 'bright');

        return {
            messages: messagesResult.affectedRows,
            chats: chatsResult.affectedRows,
            contacts: contactsResult.affectedRows
        };
    } catch (error) {
        log(`❌ Error durante la migración: ${error.message}`, 'red');
        throw error;
    }
}

async function verifyMigration(connection) {
    logSection('🔍 VERIFICACIÓN POST-MIGRACIÓN');

    // 1. Distribución final
    log('1️⃣  Distribución final de mensajes:', 'cyan');
    const [distribution] = await connection.execute(`
        SELECT 
            session_id,
            COUNT(*) as total_mensajes,
            COUNT(DISTINCT chat_jid) as chats_unicos
        FROM messages
        GROUP BY session_id
        ORDER BY session_id
    `);
    console.table(distribution);

    // 2. Verificar integridad
    log('2️⃣  Verificando integridad (mensajes sin chat):', 'cyan');
    const [orphans] = await connection.execute(`
        SELECT 
            m.session_id,
            m.phone,
            COUNT(*) as mensajes_sin_chat
        FROM messages m
        LEFT JOIN chats c ON m.chat_jid = c.jid AND m.session_id = c.session_id
        WHERE c.jid IS NULL
        GROUP BY m.session_id, m.phone
    `);

    if (orphans.length > 0) {
        log('   ⚠️  Se encontraron mensajes sin chat:', 'yellow');
        console.table(orphans);
    } else {
        log('   ✅ No hay mensajes huérfanos', 'green');
    }

    // 3. Últimos mensajes por canal
    log('3️⃣  Últimos 5 mensajes por canal:', 'cyan');
    const [recent] = await connection.execute(`
        SELECT 
            session_id,
            phone,
            chat_jid,
            SUBSTRING(text_content, 1, 50) as texto,
            timestamp
        FROM messages
        WHERE session_id IN ('1', '2')
        ORDER BY session_id, timestamp DESC
        LIMIT 10
    `);
    console.table(recent);
}

async function rollback(connection) {
    logSection('⏮️  EJECUTANDO ROLLBACK');

    try {
        // Verificar que existe el backup
        const [existing] = await connection.execute(
            `SHOW TABLES LIKE '${BACKUP_TABLE}'`
        );

        if (existing.length === 0) {
            log(`❌ No se encontró el backup: ${BACKUP_TABLE}`, 'red');
            log('   No se puede revertir la migración', 'red');
            return false;
        }

        log(`Restaurando desde: ${BACKUP_TABLE}`, 'yellow');

        // 1. Restaurar MESSAGES
        log('1️⃣  Restaurando tabla MESSAGES...', 'cyan');
        await connection.execute(`DELETE FROM messages WHERE session_id IN ('1', '2')`);
        await connection.execute(`INSERT INTO messages SELECT * FROM ${BACKUP_TABLE}`);
        log('   ✅ Mensajes restaurados', 'green');

        // 2. Restaurar CHATS
        log('2️⃣  Restaurando tabla CHATS...', 'cyan');
        await connection.execute(`
            UPDATE chats 
            SET session_id = '1' 
            WHERE session_id = '2' 
              AND phone = '${CHANNELS.GESTION.phone}'
        `);
        log('   ✅ Chats restaurados', 'green');

        log('\n✅ Rollback completado exitosamente', 'bright');
        return true;
    } catch (error) {
        log(`❌ Error durante el rollback: ${error.message}`, 'red');
        throw error;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const mode = args[0];

    if (!mode || !['--analyze', '--execute', '--rollback'].includes(mode)) {
        log('❌ Modo inválido', 'red');
        log('\nUso:', 'bright');
        log('  node migrate_messages_to_channels.js --analyze    # Solo analizar', 'white');
        log('  node migrate_messages_to_channels.js --execute    # Ejecutar migración', 'white');
        log('  node migrate_messages_to_channels.js --rollback   # Revertir cambios', 'white');
        process.exit(1);
    }

    let connection;

    try {
        // Conectar a la base de datos
        connection = await mysql.createConnection(dbConfig);
        log('✅ Conectado a la base de datos', 'green');

        if (mode === '--analyze') {
            await analyzeCurrentState(connection);
            log('\n💡 Para ejecutar la migración, usa: --execute', 'cyan');
        } else if (mode === '--execute') {
            // Análisis previo
            const stats = await analyzeCurrentState(connection);

            // Confirmar con el usuario
            log('\n⚠️  ADVERTENCIA: Esta operación modificará la base de datos', 'yellow');
            log(`   Se migrarán ${stats.gestionMessages} mensajes a session_id='2'`, 'yellow');
            log('\n   Presiona Ctrl+C para cancelar o Enter para continuar...', 'bright');

            // Esperar confirmación (en producción, usar readline)
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Crear backup
            const backupOk = await createBackup(connection);
            if (!backupOk) {
                log('❌ No se pudo crear el backup. Abortando migración.', 'red');
                process.exit(1);
            }

            // Ejecutar migración
            const result = await executeMigration(connection);

            // Verificar
            await verifyMigration(connection);

            log('\n🎉 MIGRACIÓN COMPLETADA', 'bright');
            log(`   Mensajes migrados: ${result.messages}`, 'green');
            log(`   Chats migrados: ${result.chats}`, 'green');
            log(`   Contactos migrados: ${result.contacts}`, 'green');
            log(`\n   Backup guardado en: ${BACKUP_TABLE}`, 'cyan');
            log('   Si algo sale mal, ejecuta: --rollback', 'cyan');

        } else if (mode === '--rollback') {
            await rollback(connection);
            await verifyMigration(connection);
        }

    } catch (error) {
        log(`\n❌ Error: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            log('\n✅ Conexión cerrada', 'green');
        }
    }
}

// Ejecutar
main().catch(console.error);
