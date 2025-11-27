#!/usr/bin/env node

/**
 * Script para probar notificaciones de transferencia de chat
 * Útil para verificar que los eventos se están emitiendo correctamente
 */

const mysql = require('mysql2/promise');

async function testTransferNotifications() {
  console.log('🧪 Probando sistema de notificaciones de transferencia...');
  
  try {
    // Configuración de la base de datos
    const pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'whatsflow',
      connectionLimit: 10
    });

    // 1. Verificar agentes existentes
    console.log('\n📋 Verificando agentes en la base de datos...');
    const [agents] = await pool.execute('SELECT id, name, email FROM agents LIMIT 5');
    console.log('Agentes encontrados:', agents);

    // 2. Verificar chats asignados
    console.log('\n📋 Verificando chats asignados...');
    const [chats] = await pool.execute(`
      SELECT ca.chat_jid, ca.user_id, a.name as agent_name 
      FROM chat_assignments ca 
      LEFT JOIN agents a ON ca.user_id = a.id 
      WHERE ca.status = 'active' 
      LIMIT 5
    `);
    console.log('Chats asignados:', chats);

    // 3. Verificar eventos de transferencia recientes
    console.log('\n📋 Verificando transferencias recientes...');
    const [transfers] = await pool.execute(`
      SELECT ct.chat_jid, ct.from_user_id, ct.to_user_id, ct.transferred_at 
      FROM chat_transfers ct 
      ORDER BY ct.transferred_at DESC 
      LIMIT 5
    `);
    console.log('Transferencias recientes:', transfers);

    // 4. Instrucciones para probar manualmente
    console.log('\n🎯 INSTRUCCIONES PARA PROBAR NOTIFICACIONES:');
    console.log('1. Iniciar sesión como admin en el sistema');
    console.log('2. Conectar WhatsApp (escaneo QR)');
    console.log('3. Iniciar sesión como agente (claudio@cnid.com.py / 1234567)');
    console.log('4. Desde el panel admin, transferir un chat al agente');
    console.log('5. Verificar que el agente recibe notificación');

    console.log('\n📡 Eventos Socket.IO que deberían emitirse:');
    console.log('   - agent-{agentId}-new-chat');
    console.log('   - chat_transferred');
    console.log('   - chat:assigned');
    console.log('   - chat-assignment-changed');

    console.log('\n✅ Sistema verificado. Listo para pruebas.');

    await pool.end();
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testTransferNotifications();