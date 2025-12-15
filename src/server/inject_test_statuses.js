#!/usr/bin/env node

/**
 * Script para inyectar estados de prueba en la base de datos
 * Esto simula estados reales de WhatsApp para testing
 */

const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'whatsflow',
};

const realStatusMessages = [
  '☕ Buenos días! Que tengan un excelente día todos 🌅',
  '🎉 Feliz viernes! Por fin llegó el fin de semana',
  '💼 Trabajando en nuevos proyectos emocionantes',
  '🍕 Hora del almuerzo! Pizza para todos',
  '🏋️ Entrenamiento completado! 💪 #FitnessMotivation',
  '📚 Aprendiendo cosas nuevas cada día',
  '🎵 Escuchando buena música mientras trabajo',
  '🌎 Viajar es la única cosa que compras que te hace más rico',
  '❤️ Agradecido por todo lo que tengo',
  '🚀 Grandes cosas están por venir',
  '🌟 No te rindas, estás más cerca de lo que crees',
  '📱 Disponible para cualquier consulta',
  '🎯 Enfocado en mis metas',
  '☀️ Disfrutando este hermoso día',
  '🍿 Noche de películas! 🎬'
];

async function injectTestStatuses() {
  let connection;
  
  try {
    console.log('[TEST-STATUSES] 🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    
    // Obtener la primera sesión activa
    const [sessions] = await connection.execute(
      'SELECT phone_number FROM whatsapp_sessions WHERE phone_number IS NOT NULL ORDER BY created_at DESC LIMIT 1'
    );
    
    if (sessions.length === 0) {
      console.log('[TEST-STATUSES] ⚠️ No hay sesiones de WhatsApp. Usando session_id de prueba.');
    }
    
    const sessionId = sessions.length > 0 ? sessions[0].phone_number : 'test-session';
    console.log('[TEST-STATUSES] 📱 Usando session:', sessionId);
    
    // Obtener contactos reales
    const [contacts] = await connection.execute(
      `SELECT jid, name, notify_name, avatar_url 
       FROM contacts 
       WHERE session_id = ? 
         AND jid LIKE '%@s.whatsapp.net'
         AND jid NOT LIKE '%@g.us'
       ORDER BY updated_at DESC 
       LIMIT 15`,
      [sessionId]
    );
    
    console.log(`[TEST-STATUSES] 👥 Encontrados ${contacts.length} contactos`);
    
    if (contacts.length === 0) {
      console.log('[TEST-STATUSES] ❌ No hay contactos en la base de datos para esta sesión');
      return;
    }
    
    // Limpiar estados de prueba anteriores
    await connection.execute(
      'DELETE FROM contact_statuses WHERE session_id = ?',
      [sessionId]
    );
    console.log('[TEST-STATUSES] 🧹 Estados anteriores limpiados');
    
    let insertedCount = 0;
    
    // Inyectar estados para cada contacto (1-3 estados por contacto)
    for (const contact of contacts) {
      const numStatuses = Math.floor(Math.random() * 3) + 1; // 1-3 estados
      
      for (let i = 0; i < numStatuses; i++) {
        const randomMessage = realStatusMessages[Math.floor(Math.random() * realStatusMessages.length)];
        const hoursAgo = Math.floor(Math.random() * 20) + 1; // 1-20 horas atrás
        const publishedAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
        const expiresAt = new Date(publishedAt.getTime() + 24 * 60 * 60 * 1000);
        const messageId = `test-status-${contact.jid}-${Date.now()}-${i}`;
        
        await connection.execute(
          `INSERT INTO contact_statuses 
           (session_id, message_id, contact_jid, contact_name, avatar_url, text_content, media_type, media_url, published_at, expires_at, is_viewed)
           VALUES (?, ?, ?, ?, ?, ?, 'text', NULL, ?, ?, 0)`,
          [
            sessionId,
            messageId,
            contact.jid,
            contact.name || contact.notify_name || contact.jid.split('@')[0],
            contact.avatar_url,
            randomMessage,
            publishedAt,
            expiresAt
          ]
        );
        
        insertedCount++;
      }
    }
    
    console.log(`[TEST-STATUSES] ✅ ${insertedCount} estados de prueba inyectados exitosamente`);
    console.log(`[TEST-STATUSES] 📊 ${contacts.length} contactos tienen estados activos`);
    console.log('[TEST-STATUSES] 🔄 Recarga la interfaz de estados para verlos');
    
  } catch (error) {
    console.error('[TEST-STATUSES] ❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
injectTestStatuses();
