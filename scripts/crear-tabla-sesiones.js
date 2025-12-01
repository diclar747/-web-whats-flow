#!/usr/bin/env node

/**
 * CREAR TABLA WHATSAPP_SESSIONS
 * Crea la tabla faltante para manejar sesiones de WhatsApp
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mysql = require('mysql2/promise');

console.log('📱 CREANDO TABLA WHATSAPP_SESSIONS');
console.log('===================================\n');

// Configuración de base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'whatsflow'
};

async function createSessionsTable() {
  let connection;
  
  try {
    console.log('🔌 CONECTANDO A LA BASE DE DATOS...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado exitosamente\n');

    // 1. Verificar si la tabla ya existe
    console.log('🔍 VERIFICANDO SI LA TABLA EXISTE...');
    try {
      const [existingTables] = await connection.execute(`
        SHOW TABLES LIKE 'whatsapp_sessions'
      `);

      if (existingTables.length > 0) {
        console.log('   ✅ La tabla "whatsapp_sessions" ya existe');
        return;
      }
    } catch (error) {
      // La tabla no existe, continuar con la creación
    }

    // 2. Crear la tabla whatsapp_sessions
    console.log('📋 CREANDO TABLA WHATSAPP_SESSIONS...');
    await connection.execute(`
      CREATE TABLE whatsapp_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL UNIQUE,
        device_id VARCHAR(255),
        user_id INT,
        phone_number VARCHAR(20),
        status ENUM('connected', 'disconnected', 'connecting', 'failed') DEFAULT 'disconnected',
        is_active BOOLEAN DEFAULT FALSE,
        qr_code TEXT,
        last_connection TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_session_id (session_id),
        INDEX idx_phone_number (phone_number),
        INDEX idx_is_active (is_active),
        INDEX idx_status (status)
      )
    `);

    console.log('   ✅ Tabla "whatsapp_sessions" creada exitosamente');

    // 3. Crear una sesión de ejemplo para el agente claudio
    console.log('\n👤 CREANDO SESIÓN PARA EL AGENTE CLAUDIO...');
    await connection.execute(`
      INSERT INTO whatsapp_sessions (
        session_id, device_id, user_id, phone_number, 
        status, is_active, last_connection
      ) VALUES (
        'session_5959857687983', 
        'device_5959857687983', 
        1, 
        '5959857687983', 
        'connected', 
        TRUE, 
        NOW()
      )
    `);

    console.log('   ✅ Sesión creada para el agente claudio');

    // 4. Verificar la tabla creada
    console.log('\n🔍 VERIFICANDO TABLA CREADA...');
    const [tableStructure] = await connection.execute(`
      DESCRIBE whatsapp_sessions
    `);

    console.log('   📋 Estructura de la tabla whatsapp_sessions:');
    tableStructure.forEach(column => {
      console.log(`      ${column.Field} (${column.Type}) - ${column.Key || ''}`);
    });

    // 5. Verificar sesiones activas
    const [activeSessions] = await connection.execute(`
      SELECT session_id, phone_number, status, is_active 
      FROM whatsapp_sessions 
      WHERE is_active = 1
    `);

    console.log(`\n   📱 Sesiones activas: ${activeSessions.length}`);
    activeSessions.forEach(session => {
      console.log(`      ✅ Sesión: ${session.session_id}, Teléfono: ${session.phone_number}, Estado: ${session.status}`);
    });

    console.log('\n🎯 TABLA CREADA EXITOSAMENTE:');
    console.log('   ✅ Tabla "whatsapp_sessions" creada y configurada');
    console.log('   ✅ Sesión activa para el agente claudio');
    console.log('   ✅ El sistema ahora puede manejar sesiones correctamente');

  } catch (error) {
    console.error('❌ Error creando tabla:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Conexión a base de datos cerrada');
    }
  }
}

// Ejecutar creación de tabla
createSessionsTable().catch(console.error);