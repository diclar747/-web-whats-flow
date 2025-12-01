#!/usr/bin/env node

/**
 * EJECUTAR CORRECCIÓN DE AGENTES
 * Ejecuta el script SQL para crear el agente claudio
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mysql = require('mysql2/promise');

console.log('🔧 EJECUTANDO CORRECCIÓN DE AGENTES');
console.log('===================================\n');

// Configuración de base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'whatsflow'
};

async function executeCorrection() {
  let connection;
  
  try {
    console.log('🔌 CONECTANDO A LA BASE DE DATOS...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado exitosamente\n');

    // 1. Crear agente claudio
    console.log('👤 CREANDO AGENTE CLAUDIO...');
    const insertResult = await connection.execute(`
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
      )
    `);

    console.log(`   ✅ Agente creado exitosamente`);
    console.log(`   📝 ID del agente: ${insertResult[0].insertId}`);

    // 2. Verificar agentes activos
    console.log('\n🔍 VERIFICANDO AGENTES ACTIVOS...');
    const [activeAgents] = await connection.execute(`
      SELECT id, email, phone, is_active, status 
      FROM agents 
      WHERE is_active = 1
    `);

    console.log(`   👥 Agentes activos encontrados: ${activeAgents.length}`);
    activeAgents.forEach(agent => {
      console.log(`      ✅ ID: ${agent.id}, Email: ${agent.email}, Teléfono: ${agent.phone}, Estado: ${agent.status}`);
    });

    // 3. Verificar total de agentes
    console.log('\n📊 VERIFICANDO TOTAL DE AGENTES...');
    const [totalAgents] = await connection.execute(`
      SELECT COUNT(*) as total FROM agents
    `);

    console.log(`   📈 Total de agentes en la base de datos: ${totalAgents[0].total}`);

    // 4. Verificar que solo hay 1 agente activo
    if (activeAgents.length === 1) {
      console.log('\n🎯 CORRECCIÓN EXITOSA:');
      console.log('   ✅ Solo hay 1 agente activo (claudio@cnid.com.py)');
      console.log('   ✅ El problema de mostrar 2 agentes debería estar resuelto');
      console.log('   ✅ El sistema ahora mostrará solo el agente correcto');
    } else {
      console.log('\n⚠️  VERIFICAR MANUALMENTE:');
      console.log(`   Hay ${activeAgents.length} agentes activos`);
      console.log('   Revisar manualmente la base de datos');
    }

  } catch (error) {
    console.error('❌ Error ejecutando corrección:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Conexión a base de datos cerrada');
    }
  }
}

// Ejecutar corrección
executeCorrection().catch(console.error);