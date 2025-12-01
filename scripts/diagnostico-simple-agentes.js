#!/usr/bin/env node

/**
 * DIAGNÓSTICO SIMPLE DE AGENTES
 * Identifica por qué muestra 2 agentes cuando solo debería haber 1
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mysql = require('mysql2/promise');

console.log('🔍 DIAGNÓSTICO SIMPLE DE AGENTES');
console.log('=================================\n');

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

    // 1. Verificar tabla de agentes
    console.log('📋 VERIFICANDO TABLA DE AGENTES:');
    const [agents] = await connection.execute(`
      SELECT id, email, phone, is_active, status, created_at 
      FROM agents 
      ORDER BY created_at DESC
    `);

    console.log(`   👥 Total de agentes encontrados: ${agents.length}`);
    
    if (agents.length === 0) {
      console.log('   ⚠️  NO HAY AGENTES EN LA BASE DE DATOS');
      console.log('   💡 Esto explica por qué el sistema puede mostrar comportamientos extraños');
    } else {
      agents.forEach(agent => {
        const status = agent.is_active ? 'ACTIVO' : 'INACTIVO';
        console.log(`      ${status} - ID: ${agent.id}, Email: ${agent.email}, Teléfono: ${agent.phone}, Estado: ${agent.status}`);
      });
    }

    // 2. Verificar si hay agentes duplicados
    console.log('\n🔍 BUSCANDO AGENTES DUPLICADOS:');
    const [duplicates] = await connection.execute(`
      SELECT email, COUNT(*) as count 
      FROM agents 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `);

    if (duplicates.length > 0) {
      console.log('   ⚠️  SE ENCONTRARON AGENTES DUPLICADOS:');
      duplicates.forEach(dup => {
        console.log(`      Email: ${dup.email}, Cantidad: ${dup.count}`);
      });
    } else {
      console.log('   ✅ No se encontraron agentes duplicados por email');
    }

    // 3. Buscar específicamente al agente claudio
    console.log('\n🔍 BUSCANDO AGENTE CLAUDIO ESPECÍFICAMENTE:');
    const [claudioAgents] = await connection.execute(`
      SELECT id, email, phone, is_active, status, created_at 
      FROM agents 
      WHERE email LIKE '%claudio%' OR email LIKE '%cnid%' OR name LIKE '%claudio%'
      ORDER BY created_at DESC
    `);

    if (claudioAgents.length > 0) {
      console.log(`   ✅ Se encontraron ${claudioAgents.length} agentes relacionados con claudio:`);
      claudioAgents.forEach(agent => {
        const status = agent.is_active ? 'ACTIVO' : 'INACTIVO';
        console.log(`      ${status} - ID: ${agent.id}, Email: ${agent.email}, Teléfono: ${agent.phone}, Estado: ${agent.status}`);
      });
    } else {
      console.log('   ❌ No se encontraron agentes relacionados con claudio');
    }

    // 4. Verificar tabla de sesiones
    console.log('\n📱 VERIFICANDO TABLA DE SESIONES:');
    try {
      const [sessions] = await connection.execute(`
        SELECT session_id, device_id, user_id, is_active, created_at 
        FROM whatsapp_sessions 
        WHERE is_active = 1
        ORDER BY created_at DESC
      `);

      console.log(`   📱 Sesiones activas encontradas: ${sessions.length}`);
      sessions.forEach(session => {
        console.log(`      Sesión: ${session.session_id}, Device: ${session.device_id}, User: ${session.user_id}`);
      });
    } catch (error) {
      console.log('   ❌ Tabla "whatsapp_sessions" NO existe o hay error al consultar');
    }

    // 5. Análisis del problema
    console.log('\n💡 ANÁLISIS DEL PROBLEMA:');
    console.log('   "El sistema muestra 2 agentes en la sesión 5959857687983 pero solo debería haber 1 (claudio@cnid.com.py)"');
    
    if (agents.length === 0) {
      console.log('\n   🎯 DIAGNÓSTICO:');
      console.log('      - La tabla "agents" está VACÍA (0 agentes)');
      console.log('      - El agente claudio@cnid.com.py NO existe en la base de datos');
      console.log('      - El sistema puede estar mostrando datos de memoria o caché');
      console.log('      - Se necesita crear el agente claudio@cnid.com.py');
    } else if (agents.length > 1) {
      console.log('\n   🎯 DIAGNÓSTICO:');
      console.log('      - Hay múltiples agentes en la base de datos');
      console.log('      - Se necesita identificar cuál es el agente correcto');
      console.log('      - Desactivar agentes no deseados');
    }

    // 6. Crear script de corrección
    console.log('\n🔧 CREANDO SCRIPT DE CORRECCIÓN...');
    await createCorrectionScript(agents, duplicates, claudioAgents);

  } catch (error) {
    console.error('❌ Error en el diagnóstico:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Conexión a base de datos cerrada');
    }
  }
}

async function createCorrectionScript(agents, duplicates, claudioAgents) {
  let correctionScript = `-- SCRIPT DE CORRECCIÓN PARA AGENTES WHATSAPP FLOW
-- Fecha: ${new Date().toISOString()}
-- Problema: Muestra 2 agentes cuando solo debería haber 1 (claudio@cnid.com.py)

USE ${dbConfig.database};

`;

  if (agents.length === 0) {
    // No hay agentes - crear el agente claudio
    correctionScript += `-- 1. CREAR AGENTE CLAUDIO (no existe ningún agente)
INSERT INTO agents (
  session_id, name, email, phone, status, 
  max_concurrent_chats, current_chats, is_active, 
  avatar_url, created_at, updated_at, last_activity
) VALUES (
  'session_5959857687983', 
  'Claudio', 
  'claudio@cnid.com.py', 
  '5959857687983', 
  'available', 
  10, 0, 1, 
  NULL, 
  NOW(), NOW(), NOW()
);

`;
  } else if (agents.length > 1) {
    // Hay múltiples agentes - mantener solo claudio
    correctionScript += `-- 1. DESACTIVAR TODOS LOS AGENTES EXCEPTO CLAUDIO
UPDATE agents 
SET is_active = 0 
WHERE email != 'claudio@cnid.com.py';

-- 2. ACTIVAR SOLO CLAUDIO
UPDATE agents 
SET is_active = 1 
WHERE email = 'claudio@cnid.com.py';

`;
  }

  // Agregar eliminación de duplicados si existen
  if (duplicates.length > 0) {
    duplicates.forEach(dup => {
      correctionScript += `-- 3. ELIMINAR AGENTES DUPLICADOS PARA: ${dup.email}
DELETE FROM agents 
WHERE email = '${dup.email}' 
AND id NOT IN (
  SELECT id FROM (
    SELECT MAX(id) as id 
    FROM agents 
    WHERE email = '${dup.email}'
  ) as latest
);

`;
    });
  }

  // Verificación final
  correctionScript += `-- 4. VERIFICAR RESULTADO
SELECT 'AGENTES ACTIVOS DESPUÉS DE LA CORRECCIÓN:' as info;
SELECT id, email, phone, is_active, status 
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
runDiagnosis().catch(console.error);