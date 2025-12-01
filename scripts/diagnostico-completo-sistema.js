#!/usr/bin/env node

/**
 * DIAGNÓSTICO COMPLETO DEL SISTEMA
 * Identifica por qué muestra 2 agentes cuando solo debería haber 1
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mysql = require('mysql2/promise');

console.log('🔍 DIAGNÓSTICO COMPLETO DEL SISTEMA');
console.log('===================================\n');

// Configuración de base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'whatsflow',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function runCompleteDiagnosis() {
  let connection;
  
  try {
    console.log('🔌 CONECTANDO A LA BASE DE DATOS...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado exitosamente\n');

    // 1. Verificar todas las tablas en la base de datos
    console.log('📊 VERIFICANDO ESTRUCTURA DE LA BASE DE DATOS:');
    const [tables] = await connection.execute(`
      SHOW TABLES
    `);

    console.log(`   Tablas encontradas: ${tables.length}`);
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   📋 ${tableName}`);
    });

    // 2. Verificar si existe la tabla agents
    console.log('\n🔍 VERIFICANDO TABLA DE AGENTES:');
    const agentsTableExists = tables.some(table => 
      Object.values(table)[0] === 'agents'
    );

    if (agentsTableExists) {
      console.log('   ✅ Tabla "agents" existe');
      
      // Verificar estructura de la tabla agents
      const [agentColumns] = await connection.execute(`
        DESCRIBE agents
      `);
      
      console.log('   📋 Estructura de la tabla agents:');
      agentColumns.forEach(column => {
        console.log(`      ${column.Field} (${column.Type}) - ${column.Key || ''}`);
      });

      // Verificar agentes en la tabla
      let allAgents = [];
      try {
        const [agentsResult] = await connection.execute(`
          SELECT id, email, phone, is_active, created_at
          FROM agents
          ORDER BY created_at DESC
        `);
        allAgents = agentsResult;

        console.log(`\n   👥 Total de agentes en la tabla: ${allAgents.length}`);
        allAgents.forEach(agent => {
          const status = agent.is_active ? 'ACTIVO' : 'INACTIVO';
          console.log(`      ${status} - ID: ${agent.id}, Email: ${agent.email}, Teléfono: ${agent.phone}`);
        });
      } catch (error) {
        console.log(`   ❌ Error al consultar agentes: ${error.message}`);
        allAgents = [];
      }

    } else {
      console.log('   ❌ Tabla "agents" NO existe');
    }

    // 3. Verificar si existe la tabla whatsapp_sessions
    console.log('\n🔍 VERIFICANDO TABLA DE SESIONES:');
    const sessionsTableExists = tables.some(table => 
      Object.values(table)[0] === 'whatsapp_sessions'
    );

    if (sessionsTableExists) {
      console.log('   ✅ Tabla "whatsapp_sessions" existe');
      
      // Verificar sesiones activas
      const [activeSessions] = await connection.execute(`
        SELECT session_id, device_id, user_id, is_active, created_at 
        FROM whatsapp_sessions 
        WHERE is_active = 1
        ORDER BY created_at DESC
      `);

      console.log(`   📱 Sesiones activas: ${activeSessions.length}`);
      activeSessions.forEach(session => {
        console.log(`      Sesión: ${session.session_id}, Device: ${session.device_id}, User: ${session.user_id}`);
      });

    } else {
      console.log('   ❌ Tabla "whatsapp_sessions" NO existe');
    }

    // 4. Verificar otras tablas relevantes
    console.log('\n🔍 VERIFICANDO OTRAS TABLAS RELEVANTES:');
    
    const relevantTables = ['users', 'chat_assignments', 'chats', 'messages'];
    relevantTables.forEach(async tableName => {
      const tableExists = tables.some(table => 
        Object.values(table)[0] === tableName
      );
      
      if (tableExists) {
        console.log(`   ✅ Tabla "${tableName}" existe`);
        
        // Contar registros
        try {
          const [count] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
          console.log(`      Registros: ${count[0].count}`);
        } catch (error) {
          console.log(`      Error contando registros: ${error.message}`);
        }
      } else {
        console.log(`   ❌ Tabla "${tableName}" NO existe`);
      }
    });

    // 5. Análisis del problema
    console.log('\n🔍 ANÁLISIS DEL PROBLEMA REPORTADO:');
    console.log('   "El sistema muestra 2 agentes en la sesión 5959857687983 pero solo debería haber 1 (claudio@cnid.com.py)"');
    
    // Verificar si hay agentes duplicados por email
    const [duplicateEmails] = await connection.execute(`
      SELECT email, COUNT(*) as count 
      FROM agents 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `);

    if (duplicateEmails.length > 0) {
      console.log('\n   ⚠️  SE ENCONTRARON AGENTES DUPLICADOS POR EMAIL:');
      duplicateEmails.forEach(dup => {
        console.log(`      Email: ${dup.email}, Cantidad: ${dup.count}`);
      });
    } else {
      console.log('\n   ✅ No se encontraron agentes duplicados por email');
    }

    // 6. Verificar si el agente claudio existe
    console.log('\n🔍 BUSCANDO AGENTE CLAUDIO ESPECÍFICAMENTE:');
    const [claudioAgents] = await connection.execute(`
      SELECT id, email, phone, is_active, created_at 
      FROM agents 
      WHERE email LIKE '%claudio%' OR email LIKE '%cnid%'
      ORDER BY created_at DESC
    `);

    if (claudioAgents.length > 0) {
      console.log(`   ✅ Se encontraron ${claudioAgents.length} agentes relacionados con claudio:`);
      claudioAgents.forEach(agent => {
        const status = agent.is_active ? 'ACTIVO' : 'INACTIVO';
        console.log(`      ${status} - ID: ${agent.id}, Email: ${agent.email}, Teléfono: ${agent.phone}`);
      });
    } else {
      console.log('   ❌ No se encontraron agentes relacionados con claudio');
    }

    // 7. Recomendaciones específicas
    console.log('\n💡 RECOMENDACIONES ESPECÍFICAS:');
    
    if (allAgents.length > 1) {
      console.log('   1. Verificar que solo el agente claudio@cnid.com.py esté activo');
      console.log('   2. Desactivar otros agentes si es necesario');
    } else if (allAgents.length === 0) {
      console.log('   1. ⚠️  NO HAY AGENTES EN LA BASE DE DATOS');
      console.log('   2. Se necesita crear al menos un agente (claudio@cnid.com.py)');
    }
    
    if (duplicateEmails.length > 0) {
      console.log('   3. Eliminar agentes duplicados manteniendo solo el más reciente');
    }
    
    if (!sessionsTableExists) {
      console.log('   4. La tabla whatsapp_sessions no existe - esto puede causar problemas de sesión');
    }

    // 8. Crear script de corrección si es necesario
    if (allAgents.length > 1 || duplicateEmails.length > 0 || allAgents.length === 0) {
      console.log('\n🔧 CREANDO SCRIPT DE CORRECCIÓN...');
      await createCorrectionScript(allAgents, duplicateEmails, claudioAgents);
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

async function createCorrectionScript(allAgents, duplicateEmails, claudioAgents) {
  const correctionScript = `
-- SCRIPT DE CORRECCIÓN PARA EL SISTEMA WHATSAPP FLOW
-- Fecha: ${new Date().toISOString()}
-- Problema: Muestra 2 agentes cuando solo debería haber 1 (claudio@cnid.com.py)

USE ${dbConfig.database};

-- 1. Desactivar todos los agentes excepto claudio@cnid.com.py
UPDATE agents 
SET is_active = 0 
WHERE email != 'claudio@cnid.com.py';

-- 2. Activar solo claudio@cnid.com.py
UPDATE agents 
SET is_active = 1 
WHERE email = 'claudio@cnid.com.py';

-- 3. Eliminar agentes duplicados (mantener solo el más reciente)
${duplicateEmails.map(dup => `
-- Para email: ${dup.email}
DELETE FROM agents 
WHERE email = '${dup.email}' 
AND id NOT IN (
  SELECT id FROM (
    SELECT MAX(id) as id 
    FROM agents 
    WHERE email = '${dup.email}'
  ) as latest
);
`).join('')}

-- 4. Verificar resultado
SELECT 'AGENTES ACTIVOS DESPUÉS DE LA CORRECCIÓN:' as info;
SELECT id, email, phone, is_active 
FROM agents 
WHERE is_active = 1;

SELECT 'TOTAL DE AGENTES:' as info;
SELECT COUNT(*) as total_agents FROM agents;

COMMIT;
`;

  const fs = require('fs');
  const scriptPath = path.join(__dirname, 'correccion-agentes-sistema.sql');
  
  fs.writeFileSync(scriptPath, correctionScript);
  console.log(`   📁 Script de corrección creado: correccion-agentes-sistema.sql`);
  console.log('   💡 Ejecuta este script en MySQL para corregir el problema:');
  console.log('   💡 mysql -u root -p whatsflow < scripts/correccion-agentes-sistema.sql');
  console.log('\n   ⚠️  IMPORTANTE: Haz un backup de la base de datos antes de ejecutar el script');
}

// Ejecutar diagnóstico
runCompleteDiagnosis().catch(console.error);