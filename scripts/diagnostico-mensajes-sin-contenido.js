#!/usr/bin/env node

/**
 * DIAGNÓSTICO DE MENSAJES SIN CONTENIDO
 * Analiza por qué aparecen mensajes sin contenido en el historial
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mysql = require('mysql2/promise');

console.log('🔍 DIAGNÓSTICO DE MENSAJES SIN CONTENIDO');
console.log('=========================================\n');

// Configuración de base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'whatsflow'
};

async function runDiagnosis() {
  let connection;
  
  try {
    console.log('🔌 CONECTANDO A LA BASE DE DATOS...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado exitosamente\n');

    // 1. Verificar estructura de la tabla messages
    console.log('📋 VERIFICANDO ESTRUCTURA DE LA TABLA MESSAGES:');
    const [messageColumns] = await connection.execute(`
      DESCRIBE messages
    `);

    console.log('   📊 Estructura de la tabla messages:');
    messageColumns.forEach(column => {
      console.log(`      ${column.Field} (${column.Type}) - ${column.Key || ''}`);
    });

    // 2. Buscar mensajes sin contenido específicos mencionados
    console.log('\n🔍 BUSCANDO MENSAJES ESPECÍFICOS MENCIONADOS:');
    
    const problematicNumbers = [
      '5493754503758',  // Mariel
      '595985768793',   // Laura Sanabria (nota: parece que falta un dígito, debería ser 5959857687983)
      '595983435996'    // Otro número mencionado
    ];

    for (const phone of problematicNumbers) {
      console.log(`\n   📱 Buscando mensajes para: ${phone}`);
      
      const [messages] = await connection.execute(`
        SELECT id, from_phone, to_phone, message, message_type, 
               media_url, media_type, created_at, is_deleted
        FROM messages 
        WHERE from_phone LIKE '%${phone}%' OR to_phone LIKE '%${phone}%'
        ORDER BY created_at DESC
        LIMIT 10
      `);

      if (messages.length > 0) {
        console.log(`   📊 Encontrados ${messages.length} mensajes:`);
        messages.forEach(msg => {
          const hasContent = msg.message && msg.message.trim() !== '';
          const contentPreview = hasContent 
            ? `"${msg.message.substring(0, 50)}${msg.message.length > 50 ? '...' : ''}"` 
            : 'SIN CONTENIDO';
          
          console.log(`      📝 ID: ${msg.id}, De: ${msg.from_phone}, Para: ${msg.to_phone}`);
          console.log(`         Tipo: ${msg.message_type}, Contenido: ${contentPreview}`);
          console.log(`         Fecha: ${msg.created_at}, Eliminado: ${msg.is_deleted}`);
          
          if (!hasContent && !msg.media_url) {
            console.log(`         ⚠️  PROBLEMA: Mensaje sin contenido ni archivo multimedia`);
          }
        });
      } else {
        console.log(`   ❌ No se encontraron mensajes para ${phone}`);
      }
    }

    // 3. Buscar todos los mensajes sin contenido
    console.log('\n📊 ANALIZANDO TODOS LOS MENSAJES SIN CONTENIDO:');
    
    const [emptyMessages] = await connection.execute(`
      SELECT COUNT(*) as total 
      FROM messages 
      WHERE (message IS NULL OR message = '' OR message = 'Mensaje sin contenido')
        AND (media_url IS NULL OR media_url = '')
    `);

    console.log(`   📈 Total de mensajes sin contenido: ${emptyMessages[0].total}`);

    // 4. Verificar mensajes recientes sin contenido
    const [recentEmptyMessages] = await connection.execute(`
      SELECT id, from_phone, to_phone, message, message_type, 
             media_url, created_at
      FROM messages 
      WHERE (message IS NULL OR message = '' OR message = 'Mensaje sin contenido')
        AND (media_url IS NULL OR media_url = '')
      ORDER BY created_at DESC
      LIMIT 20
    `);

    if (recentEmptyMessages.length > 0) {
      console.log(`\n   📅 Últimos ${recentEmptyMessages.length} mensajes sin contenido:`);
      recentEmptyMessages.forEach(msg => {
        console.log(`      📝 ID: ${msg.id}, De: ${msg.from_phone}, Para: ${msg.to_phone}`);
        console.log(`         Fecha: ${msg.created_at}, Tipo: ${msg.message_type}`);
      });
    }

    // 5. Verificar si hay problemas con los contactos
    console.log('\n👥 VERIFICANDO CONTACTOS MENCIONADOS:');
    
    for (const phone of problematicNumbers) {
      const [contacts] = await connection.execute(`
        SELECT id, phone, name, email, created_at
        FROM contacts 
        WHERE phone LIKE '%${phone}%'
        LIMIT 5
      `);

      if (contacts.length > 0) {
        console.log(`\n   📱 Contacto encontrado para ${phone}:`);
        contacts.forEach(contact => {
          console.log(`      👤 ID: ${contact.id}, Nombre: ${contact.name || 'Sin nombre'}`);
          console.log(`         Teléfono: ${contact.phone}, Email: ${contact.email || 'Sin email'}`);
        });
      } else {
        console.log(`   ❌ No se encontró contacto para ${phone} en la tabla contacts`);
      }
    }

    // 6. Verificar si hay problemas con los usuarios
    console.log('\n👤 VERIFICANDO USUARIOS MENCIONADOS:');
    
    const [users] = await connection.execute(`
      SELECT id, phone, name, email, created_at
      FROM users 
      WHERE phone LIKE '%595985768798%' OR phone LIKE '%595983435996%'
    `);

    if (users.length > 0) {
      console.log(`   📊 Usuarios encontrados: ${users.length}`);
      users.forEach(user => {
        console.log(`      👤 ID: ${user.id}, Nombre: ${user.name || 'Sin nombre'}`);
        console.log(`         Teléfono: ${user.phone}, Email: ${user.email || 'Sin email'}`);
      });
    } else {
      console.log(`   ❌ No se encontraron usuarios con esos números`);
    }

    // 7. Análisis del problema
    console.log('\n💡 ANÁLISIS DEL PROBLEMA:');
    console.log('   "Mensaje sin contenido" puede ocurrir por:');
    console.log('   1. Mensajes con solo archivos multimedia (imágenes, videos, audios)');
    console.log('   2. Mensajes eliminados o borrados');
    console.log('   3. Errores en la sincronización de WhatsApp');
    console.log('   4. Mensajes de sistema o notificaciones');
    console.log('   5. Problemas con el parsing del contenido');

    // 8. Recomendaciones
    console.log('\n🔧 RECOMENDACIONES:');
    console.log('   1. Verificar si los mensajes tienen archivos multimedia adjuntos');
    console.log('   2. Revisar la sincronización de WhatsApp');
    console.log('   3. Actualizar los contactos con nombres correctos');
    console.log('   4. Limpiar mensajes vacíos de la base de datos');
    console.log('   5. Verificar logs de sincronización');

    // 9. Crear script de corrección si es necesario
    if (emptyMessages[0].total > 0) {
      console.log('\n📝 CREANDO SCRIPT DE CORRECCIÓN...');
      await createCorrectionScript(emptyMessages[0].total);
    }

  } catch (error) {
    console.error('❌ Error en el diagnóstico:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Conexión a base de datos cerrada');
    }
  }
}

async function createCorrectionScript(totalEmptyMessages) {
  const correctionScript = `-- SCRIPT DE CORRECCIÓN PARA MENSAJES SIN CONTENIDO
-- Fecha: ${new Date().toISOString()}
-- Total de mensajes sin contenido: ${totalEmptyMessages}

USE ${dbConfig.database};

-- 1. VER MENSAJES SIN CONTENIDO
SELECT 'MENSAJES SIN CONTENIDO:' as info;
SELECT COUNT(*) as total_sin_contenido 
FROM messages 
WHERE (message IS NULL OR message = '' OR message = 'Mensaje sin contenido')
  AND (media_url IS NULL OR media_url = '');

-- 2. VER DETALLES DE MENSAJES PROBLEMÁTICOS
SELECT 'DETALLES DE MENSAJES SIN CONTENIDO:' as info;
SELECT id, from_phone, to_phone, message, message_type, 
       media_url, created_at
FROM messages 
WHERE (message IS NULL OR message = '' OR message = 'Mensaje sin contenido')
  AND (media_url IS NULL OR media_url = '')
ORDER BY created_at DESC
LIMIT 20;

-- 3. ACTUALIZAR NOMBRES DE CONTACTOS MENCIONADOS
-- Mariel (5493754503758)
UPDATE contacts 
SET name = 'Mariel'
WHERE phone LIKE '%5493754503758%' AND (name IS NULL OR name = '');

-- Laura Sanabria (5959857687983 - corregir número)
UPDATE contacts 
SET name = 'Laura Sanabria'
WHERE phone LIKE '%595985768798%' AND (name IS NULL OR name = '');

-- 4. ELIMINAR MENSAJES VACÍOS SI ES NECESARIO (OPCIONAL)
-- NOTA: Descomentar solo si se desea eliminar mensajes vacíos
-- DELETE FROM messages 
-- WHERE (message IS NULL OR message = '' OR message = 'Mensaje sin contenido')
--   AND (media_url IS NULL OR media_url = '')
--   AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- 5. VERIFICAR RESULTADOS
SELECT 'CONTACTOS ACTUALIZADOS:' as info;
SELECT phone, name 
FROM contacts 
WHERE phone IN ('5493754503758', '5959857687983', '595983435996');

COMMIT;
`;

  const fs = require('fs');
  const scriptPath = path.join(__dirname, 'correccion-mensajes-sin-contenido.sql');
  
  fs.writeFileSync(scriptPath, correctionScript);
  console.log(`   📁 Script de corrección creado: correccion-mensajes-sin-contenido.sql`);
  console.log('   💡 Ejecuta este script en MySQL para corregir el problema:');
  console.log('   💡 mysql -u root -p whatsflow < scripts/correccion-mensajes-sin-contenido.sql');
  console.log('\n   ⚠️  IMPORTANTE: Revisa el script antes de ejecutarlo');
}

// Ejecutar diagnóstico
runDiagnosis().catch(console.error);