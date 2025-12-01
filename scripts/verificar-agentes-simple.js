#!/usr/bin/env node

/**
 * SCRIPT SIMPLIFICADO PARA VERIFICAR AGENTES EN SESIÓN
 * Usa la misma configuración que el servidor principal
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mysql = require('mysql2/promise');

console.log('🔍 VERIFICANDO AGENTES EN SESIÓN - ANÁLISIS SIMPLIFICADO');
console.log('========================================================\n');

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

console.log('🔧 CONFIGURACIÓN DE BASE DE DATOS:');
console.log(`   - Host: ${dbConfig.host}`);
console.log(`   - Usuario: ${dbConfig.user}`);
console.log(`   - Base de datos: ${dbConfig.database}`);
console.log(`   - Contraseña: ${dbConfig.password ? '***' : '(vacía)'}\n`);

async function analyzeSessionIssue() {
  let connection;
  
  try {
    console.log('🔌 INTENTANDO CONECTAR A LA BASE DE DATOS...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado a la base de datos\n');

    // 1. Verificar agentes activos
    console.log('📋 AGENTES ACTIVOS EN EL SISTEMA:');
    const [agents] = await connection.execute(`
      SELECT id, email, phone, is_active, created_at 
      FROM agents 
      WHERE is_active = 1
      ORDER BY created_at DESC
    `);

    console.log(`   Total de agentes activos: ${agents.length}`);
    agents.forEach(agent => {
      console.log(`   👤 ID: ${agent.id}, Email: ${agent.email}, Teléfono: ${agent.phone}`);
    });

    // 2. Verificar sesiones activas
    console.log('\n📱 SESIONES ACTIVAS EN EL SISTEMA:');
    const [sessions] = await connection.execute(`
      SELECT session_id, device_id, user_id, is_active, created_at 
      FROM whatsapp_sessions 
      WHERE is_active = 1
      ORDER BY created_at DESC
    `);

    console.log(`   Total de sesiones activas: ${sessions.length}`);
    sessions.forEach(session => {
      console.log(`   📱 Sesión: ${session.session_id}, Device: ${session.device_id}, User: ${session.user_id}`);
    });

    // 3. Buscar específicamente el agente claudio@cnid.com.py
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

    // 4. Verificar si hay agentes duplicados
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

    // 5. Verificar sesiones múltiples para el mismo dispositivo
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

    // 6. Análisis del problema
    console.log('\n🔍 ANÁLISIS DEL PROBLEMA:');
    
    if (agents.length > 1) {
      console.log(`   ⚠️  Hay ${agents.length} agentes activos, pero solo debería haber 1 (claudio@cnid.com.py)`);
      console.log('   💡 Posible causa: Agentes duplicados o múltiples sesiones activas');
    }
    
    if (duplicates.length > 0) {
      console.log('   💡 Solución: Desactivar agentes duplicados manteniendo solo el más reciente');
    }
    
    if (multipleSessions.length > 0) {
      console.log('   💡 Solución: Limpiar sesiones múltiples para el mismo dispositivo');
    }

    // 7. Crear recomendaciones específicas
    console.log('\n💡 RECOMENDACIONES ESPECÍFICAS:');
    
    if (agents.length > 1) {
      console.log('   1. Ejecutar script de limpieza de agentes duplicados');
      console.log('   2. Verificar que solo claudio@cnid.com.py esté activo');
    }
    
    if (multipleSessions.length > 0) {
      console.log('   3. Limpiar sesiones múltiples para el mismo dispositivo');
    }

    // 8. Crear script de corrección automático
    if (duplicates.length > 0 || multipleSessions.length > 0 || agents.length > 1) {
      console.log('\n🔧 CREANDO SCRIPT DE CORRECCIÓN AUTOMÁTICO...');
      await createAutoFixScript(duplicates, multipleSessions, agents, claudioAgent);
    } else {
      console.log('\n✅ No se encontraron problemas que requieran corrección automática');
    }

  } catch (error) {
    console.error('❌ Error en el análisis:', error.message);
    console.log('\n💡 POSIBLES SOLUCIONES:');
    console.log('   1. Verificar que MySQL esté ejecutándose');
    console.log('   2. Verificar las credenciales de la base de datos');
    console.log('   3. Verificar que el archivo .env tenga las variables correctas');
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Conexión a base de datos cerrada');
    }
  }
}

async function createAutoFixScript(duplicates, multipleSessions, agents, claudioAgent) {
  const fixScript = `
-- SCRIPT DE CORRECCIÓN AUTOMÁTICO PARA AGENTES Y SESIONES
-- Ejecutar en la base de datos ${dbConfig.database}

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

-- Verificar resultado
SELECT email, is_active FROM agents WHERE is_active = 1;
SELECT device_id, COUNT(*) FROM whatsapp_sessions WHERE is_active = 1 GROUP BY device_id;
`;

  const fs = require('fs');
  const scriptPath = path.join(__dirname, 'fix-agents-automatico.sql');
  
  fs.writeFileSync(scriptPath, fixScript);
  console.log(`   📁 Script de corrección creado: fix-agents-automatico.sql`);
  console.log('   💡 Ejecuta este script en tu base de datos para corregir los problemas');
  console.log('   💡 Comando: mysql -u root -p whatsflow < scripts/fix-agents-automatico.sql');
}

// Ejecutar análisis
analyzeSessionIssue().catch(console.error);