#!/usr/bin/env node

/**
 * SCRIPT PARA VERIFICAR Y CORREGIR AGENTES EN SESIÓN
 * Resuelve el problema de múltiples agentes en una sesión
 */

const mysql = require('mysql2/promise');

console.log('🔍 VERIFICANDO AGENTES EN SESIÓN 5959857687983');
console.log('==============================================\n');

// Configuración de base de datos (misma que el servidor principal)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'whatsflow',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function verifySessionAgents() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos\n');

    // 1. Verificar agentes en la sesión
    console.log('📋 AGENTES REGISTRADOS EN EL SISTEMA:');
    const [agents] = await connection.execute(`
      SELECT id, email, phone, is_active, created_at 
      FROM agents 
      WHERE is_active = 1
      ORDER BY created_at DESC
    `);

    agents.forEach(agent => {
      console.log(`   👤 ID: ${agent.id}, Email: ${agent.email}, Teléfono: ${agent.phone}, Activo: ${agent.is_active}`);
    });

    // 2. Verificar sesiones activas
    console.log('\n📱 SESIONES ACTIVAS EN EL SISTEMA:');
    const [sessions] = await connection.execute(`
      SELECT session_id, device_id, user_id, is_active, created_at 
      FROM whatsapp_sessions 
      WHERE is_active = 1
      ORDER BY created_at DESC
    `);

    sessions.forEach(session => {
      console.log(`   📱 Sesión: ${session.session_id}, Device: ${session.device_id}, User: ${session.user_id}`);
    });

    // 3. Verificar asignaciones de chat
    console.log('\n💬 ASIGNACIONES DE CHAT ACTIVAS:');
    const [assignments] = await connection.execute(`
      SELECT ca.id, ca.chat_id, ca.agent_id, a.email, ca.assigned_at, ca.is_active
      FROM chat_assignments ca
      JOIN agents a ON ca.agent_id = a.id
      WHERE ca.is_active = 1
      ORDER BY ca.assigned_at DESC
    `);

    assignments.forEach(assignment => {
      console.log(`   💬 Chat: ${assignment.chat_id}, Agente: ${assignment.agent_id} (${assignment.email})`);
    });

    // 4. Buscar específicamente el agente claudio@cnid.com.py
    console.log('\n🔍 BUSCANDO AGENTE CLAUDIO ESPECÍFICAMENTE:');
    const [claudioAgent] = await connection.execute(`
      SELECT id, email, phone, is_active 
      FROM agents 
      WHERE email = 'claudio@cnid.com.py'
    `);

    if (claudioAgent.length > 0) {
      console.log(`   ✅ Agente encontrado: ${claudioAgent[0].email} (ID: ${claudioAgent[0].id})`);
    } else {
      console.log('   ❌ Agente claudio@cnid.com.py NO encontrado');
    }

    // 5. Verificar si hay agentes duplicados
    console.log('\n🔄 VERIFICANDO AGENTES DUPLICADOS:');
    const [duplicates] = await connection.execute(`
      SELECT email, COUNT(*) as count 
      FROM agents 
      WHERE is_active = 1
      GROUP BY email 
      HAVING COUNT(*) > 1
    `);

    if (duplicates.length > 0) {
      console.log('   ⚠️  SE ENCONTRARON AGENTES DUPLICADOS:');
      duplicates.forEach(dup => {
        console.log(`      Email: ${dup.email}, Cantidad: ${dup.count}`);
      });
    } else {
      console.log('   ✅ No se encontraron agentes duplicados');
    }

    // 6. Verificar sesiones múltiples para el mismo dispositivo
    console.log('\n📱 VERIFICANDO SESIONES MÚLTIPLES:');
    const [multipleSessions] = await connection.execute(`
      SELECT device_id, COUNT(*) as session_count 
      FROM whatsapp_sessions 
      WHERE is_active = 1
      GROUP BY device_id 
      HAVING COUNT(*) > 1
    `);

    if (multipleSessions.length > 0) {
      console.log('   ⚠️  SE ENCONTRARON SESIONES MÚLTIPLES:');
      multipleSessions.forEach(session => {
        console.log(`      Device: ${session.device_id}, Sesiones: ${session.session_count}`);
      });
    } else {
      console.log('   ✅ No se encontraron sesiones múltiples');
    }

    // 7. Recomendaciones basadas en los hallazgos
    console.log('\n💡 RECOMENDACIONES:');
    
    if (duplicates.length > 0) {
      console.log('   1. Desactivar agentes duplicados manteniendo solo el más reciente');
    }
    
    if (multipleSessions.length > 0) {
      console.log('   2. Limpiar sesiones múltiples para el mismo dispositivo');
    }
    
    if (agents.length > 1) {
      console.log('   3. Verificar que solo el agente claudio esté activo');
    }

    // 8. Crear script de corrección si es necesario
    if (duplicates.length > 0 || multipleSessions.length > 0) {
      console.log('\n🔧 CREANDO SCRIPT DE CORRECCIÓN...');
      await createCorrectionScript(duplicates, multipleSessions, agents, claudioAgent);
    }

  } catch (error) {
    console.error('❌ Error verificando agentes:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Conexión a base de datos cerrada');
    }
  }
}

async function createCorrectionScript(duplicates, multipleSessions, agents, claudioAgent) {
  const correctionScript = `
-- SCRIPT DE CORRECCIÓN PARA AGENTES Y SESIONES
-- Ejecutar en la base de datos whatsflow_db

-- 1. Desactivar agentes duplicados (mantener solo el más reciente)
${duplicates.map(dup => `
-- Para email: ${dup.email}
UPDATE agents 
SET is_active = 0 
WHERE email = '${dup.email}' 
AND id NOT IN (
  SELECT id FROM (
    SELECT MAX(id) as id 
    FROM agents 
    WHERE email = '${dup.email}' 
    AND is_active = 1
  ) as latest
);
`).join('')}

-- 2. Limpiar sesiones múltiples para el mismo dispositivo
${multipleSessions.map(session => `
-- Para device: ${session.device_id}
UPDATE whatsapp_sessions 
SET is_active = 0 
WHERE device_id = '${session.device_id}' 
AND id NOT IN (
  SELECT id FROM (
    SELECT MAX(id) as id 
    FROM whatsapp_sessions 
    WHERE device_id = '${session.device_id}' 
    AND is_active = 1
  ) as latest_session
);
`).join('')}

-- 3. Asegurar que solo claudio@cnid.com.py esté activo si es necesario
${agents.filter(agent => agent.email !== 'claudio@cnid.com.py').map(agent => `
-- Desactivar agente: ${agent.email}
UPDATE agents SET is_active = 0 WHERE id = ${agent.id};
`).join('')}

-- 4. Activar solo claudio@cnid.com.py
${claudioAgent.length > 0 ? `
UPDATE agents SET is_active = 1 WHERE email = 'claudio@cnid.com.py';
` : ''}

COMMIT;
`;

  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'fix-agents-session.sql');
  
  fs.writeFileSync(scriptPath, correctionScript);
  console.log(`   📁 Script de corrección creado: fix-agents-session.sql`);
  console.log('   💡 Ejecuta este script en tu base de datos para corregir los problemas');
}

// Ejecutar verificación
verifySessionAgents().catch(console.error);