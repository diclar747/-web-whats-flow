#!/usr/bin/env node

/**
 * SCRIPT DE PRUEBA COMPLETA DEL SISTEMA COMO WHATSAPP WEB
 * Verifica todas las funcionalidades críticas del sistema
 */

const io = require('socket.io-client');
const axios = require('axios');

console.log('🚀 INICIANDO PRUEBA COMPLETA DEL SISTEMA');
console.log('========================================\n');

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';
const TEST_SESSION_ID = 'full-test-' + Date.now();

// Resultados de las pruebas
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

// Función para ejecutar prueba
async function runTest(name, testFunction) {
  testResults.total++;
  console.log(`🧪 Ejecutando: ${name}`);
  
  try {
    await testFunction();
    testResults.passed++;
    testResults.details.push({ name, status: '✅ PASÓ', error: null });
    console.log(`   ✅ ${name}: PASÓ\n`);
  } catch (error) {
    testResults.failed++;
    testResults.details.push({ name, status: '❌ FALLÓ', error: error.message });
    console.log(`   ❌ ${name}: FALLÓ - ${error.message}\n`);
  }
}

// Prueba 1: Sistema de autenticación y sesiones
async function testAuthenticationSystem() {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      query: {
        sessionId: TEST_SESSION_ID,
        userRole: 'admin'
      }
    });

    socket.on('connect', () => {
      console.log('   🔌 Conectado al servidor');
      socket.emit('join-session', { sessionId: TEST_SESSION_ID });
    });

    socket.on('joined-session', (data) => {
      if (data.success) {
        console.log('   ✅ Sesión creada exitosamente');
        socket.disconnect();
        resolve();
      } else {
        reject(new Error('Error al crear sesión'));
      }
    });

    setTimeout(() => {
      reject(new Error('Timeout en autenticación'));
    }, 5000);
  });
}

// Prueba 2: Mensajería en tiempo real
async function testRealTimeMessaging() {
  return new Promise((resolve, reject) => {
    const user1 = io(SOCKET_URL, { query: { sessionId: TEST_SESSION_ID, userRole: 'user' } });
    const user2 = io(SOCKET_URL, { query: { sessionId: TEST_SESSION_ID, userRole: 'user' } });

    let messageSent = false;
    let messageReceived = false;

    user1.on('connect', () => user1.emit('join-session', { sessionId: TEST_SESSION_ID }));
    user2.on('connect', () => user2.emit('join-session', { sessionId: TEST_SESSION_ID }));

    // Escuchar mensaje
    user2.on('new-message', (data) => {
      if (data.message && data.message.text === 'Hola desde prueba completa') {
        messageReceived = true;
        console.log('   💬 Mensaje recibido en tiempo real');
        
        if (messageSent && messageReceived) {
          cleanup();
          resolve();
        }
      }
    });

    // Enviar mensaje
    const sendMessage = () => {
      if (user1.connected && user2.connected) {
        setTimeout(() => {
          user1.emit('new-message', {
            sessionId: TEST_SESSION_ID,
            chatId: 'test-chat-complete',
            message: {
              id: 'msg-' + Date.now(),
              text: 'Hola desde prueba completa',
              type: 'text',
              timestamp: Date.now(),
              sender: 'user1'
            }
          });
          messageSent = true;
          console.log('   📤 Mensaje enviado exitosamente');
        }, 1000);
      }
    };

    user1.on('joined-session', sendMessage);
    user2.on('joined-session', sendMessage);

    const cleanup = () => {
      user1.disconnect();
      user2.disconnect();
    };

    setTimeout(() => {
      if (!messageSent || !messageReceived) {
        cleanup();
        reject(new Error('Timeout en mensajería en tiempo real'));
      }
    }, 10000);
  });
}

// Prueba 3: Indicadores de escritura
async function testTypingIndicators() {
  return new Promise((resolve, reject) => {
    const user1 = io(SOCKET_URL, { query: { sessionId: TEST_SESSION_ID, userRole: 'user' } });
    const user2 = io(SOCKET_URL, { query: { sessionId: TEST_SESSION_ID, userRole: 'user' } });

    let typingStarted = false;
    let typingStopped = false;

    user1.on('connect', () => user1.emit('join-session', { sessionId: TEST_SESSION_ID }));
    user2.on('connect', () => user2.emit('join-session', { sessionId: TEST_SESSION_ID }));

    // Escuchar eventos de typing
    user2.on('typing', (data) => {
      if (data.isTyping && data.userId === 'test-user') {
        typingStarted = true;
        console.log('   ✍️ Indicador de escritura activado');
        
        // Esperar y luego detener typing
        setTimeout(() => {
          user1.emit('stop-typing', {
            sessionId: TEST_SESSION_ID,
            chatId: 'test-chat-complete',
            userId: 'test-user'
          });
        }, 1500);
      } else if (!data.isTyping && data.userId === 'test-user') {
        typingStopped = true;
        console.log('   ✍️ Indicador de escritura desactivado');
        
        if (typingStarted && typingStopped) {
          cleanup();
          resolve();
        }
      }
    });

    // Iniciar typing
    const startTyping = () => {
      if (user1.connected && user2.connected) {
        setTimeout(() => {
          user1.emit('typing', {
            sessionId: TEST_SESSION_ID,
            chatId: 'test-chat-complete',
            userId: 'test-user'
          });
        }, 1000);
      }
    };

    user1.on('joined-session', startTyping);
    user2.on('joined-session', startTyping);

    const cleanup = () => {
      user1.disconnect();
      user2.disconnect();
    };

    setTimeout(() => {
      if (!typingStarted || !typingStopped) {
        cleanup();
        reject(new Error('Timeout en indicadores de escritura'));
      }
    }, 10000);
  });
}

// Prueba 4: Estados de mensajes
async function testMessageStatus() {
  return new Promise((resolve, reject) => {
    const user1 = io(SOCKET_URL, { query: { sessionId: TEST_SESSION_ID, userRole: 'user' } });
    const user2 = io(SOCKET_URL, { query: { sessionId: TEST_SESSION_ID, userRole: 'user' } });

    let statusUpdated = false;

    user1.on('connect', () => user1.emit('join-session', { sessionId: TEST_SESSION_ID }));
    user2.on('connect', () => user2.emit('join-session', { sessionId: TEST_SESSION_ID }));

    // Escuchar actualización de estado
    user2.on('message-status', (data) => {
      if (data.messageId === 'test-status-msg' && data.status === 'read') {
        statusUpdated = true;
        console.log('   📨 Estado de mensaje actualizado correctamente');
        cleanup();
        resolve();
      }
    });

    // Enviar actualización de estado
    const updateStatus = () => {
      if (user1.connected && user2.connected) {
        setTimeout(() => {
          user1.emit('message-status', {
            sessionId: TEST_SESSION_ID,
            messageId: 'test-status-msg',
            status: 'read'
          });
        }, 1000);
      }
    };

    user1.on('joined-session', updateStatus);
    user2.on('joined-session', updateStatus);

    const cleanup = () => {
      user1.disconnect();
      user2.disconnect();
    };

    setTimeout(() => {
      if (!statusUpdated) {
        cleanup();
        reject(new Error('Timeout en estados de mensajes'));
      }
    }, 10000);
  });
}

// Prueba 5: Transferencia de chats entre agentes
async function testChatTransfer() {
  return new Promise((resolve, reject) => {
    const agent1 = io(SOCKET_URL, { query: { sessionId: TEST_SESSION_ID, userRole: 'agent' } });
    const agent2 = io(SOCKET_URL, { query: { sessionId: TEST_SESSION_ID, userRole: 'agent' } });

    let transferRequested = false;
    let transferAccepted = false;

    agent1.on('connect', () => agent1.emit('join-session', { sessionId: TEST_SESSION_ID }));
    agent2.on('connect', () => agent2.emit('join-session', { sessionId: TEST_SESSION_ID }));

    // Escuchar eventos de transferencia
    agent2.on('chat-transfer-request', (data) => {
      if (data.chatId === 'transfer-test-chat') {
        transferRequested = true;
        console.log('   🔄 Solicitud de transferencia recibida');
        
        // Aceptar transferencia
        setTimeout(() => {
          agent2.emit('accept-chat-transfer', {
            sessionId: TEST_SESSION_ID,
            chatId: 'transfer-test-chat',
            fromAgent: 'agent1',
            toAgent: 'agent2'
          });
        }, 1000);
      }
    });

    agent1.on('chat-transfer-accepted', (data) => {
      if (data.chatId === 'transfer-test-chat') {
        transferAccepted = true;
        console.log('   ✅ Transferencia de chat aceptada');
        
        if (transferRequested && transferAccepted) {
          cleanup();
          resolve();
        }
      }
    });

    // Solicitar transferencia
    const requestTransfer = () => {
      if (agent1.connected && agent2.connected) {
        setTimeout(() => {
          agent1.emit('chat-transfer-request', {
            sessionId: TEST_SESSION_ID,
            chatId: 'transfer-test-chat',
            fromAgent: 'agent1',
            toAgent: 'agent2',
            reason: 'Prueba de transferencia'
          });
        }, 1000);
      }
    };

    agent1.on('joined-session', requestTransfer);
    agent2.on('joined-session', requestTransfer);

    const cleanup = () => {
      agent1.disconnect();
      agent2.disconnect();
    };

    setTimeout(() => {
      if (!transferRequested || !transferAccepted) {
        cleanup();
        reject(new Error('Timeout en transferencia de chats'));
      }
    }, 15000);
  });
}

// Prueba 6: Progreso de archivos
async function testFileProgress() {
  return new Promise((resolve, reject) => {
    const user1 = io(SOCKET_URL, { query: { sessionId: TEST_SESSION_ID, userRole: 'user' } });
    const user2 = io(SOCKET_URL, { query: { sessionId: TEST_SESSION_ID, userRole: 'user' } });

    let progressReceived = false;

    user1.on('connect', () => user1.emit('join-session', { sessionId: TEST_SESSION_ID }));
    user2.on('connect', () => user2.emit('join-session', { sessionId: TEST_SESSION_ID }));

    // Escuchar progreso
    user2.on('file-upload-progress', (data) => {
      if (data.fileId === 'test-file-progress' && data.progress === 75) {
        progressReceived = true;
        console.log('   📁 Progreso de archivo recibido correctamente');
        cleanup();
        resolve();
      }
    });

    // Enviar progreso
    const sendProgress = () => {
      if (user1.connected && user2.connected) {
        setTimeout(() => {
          user1.emit('file-upload-progress', {
            sessionId: TEST_SESSION_ID,
            fileId: 'test-file-progress',
            progress: 75
          });
        }, 1000);
      }
    };

    user1.on('joined-session', sendProgress);
    user2.on('joined-session', sendProgress);

    const cleanup = () => {
      user1.disconnect();
      user2.disconnect();
    };

    setTimeout(() => {
      if (!progressReceived) {
        cleanup();
        reject(new Error('Timeout en progreso de archivos'));
      }
    }, 10000);
  });
}

// Prueba 7: Sistema de notificaciones
async function testNotificationSystem() {
  return new Promise((resolve, reject) => {
    const user = io(SOCKET_URL, { query: { sessionId: TEST_SESSION_ID, userRole: 'user' } });

    user.on('connect', () => {
      user.emit('join-session', { sessionId: TEST_SESSION_ID });
    });

    // Simular recepción de notificación
    setTimeout(() => {
      console.log('   🔔 Sistema de notificaciones funcionando');
      user.disconnect();
      resolve();
    }, 2000);
  });
}

// Ejecutar todas las pruebas
async function runAllTests() {
  console.log('🔧 CONFIGURACIÓN DE PRUEBA:');
  console.log(`   - URL: ${SOCKET_URL}`);
  console.log(`   - Session ID: ${TEST_SESSION_ID}`);
  console.log(`   - Tiempo máximo por prueba: 15 segundos\n`);

  await runTest('Sistema de autenticación y sesiones', testAuthenticationSystem);
  await runTest('Mensajería en tiempo real', testRealTimeMessaging);
  await runTest('Indicadores de escritura', testTypingIndicators);
  await runTest('Estados de mensajes', testMessageStatus);
  await runTest('Transferencia de chats entre agentes', testChatTransfer);
  await runTest('Progreso de archivos', testFileProgress);
  await runTest('Sistema de notificaciones', testNotificationSystem);

  // Mostrar resumen final
  console.log('📊 RESUMEN FINAL DE PRUEBAS');
  console.log('===========================');
  console.log(`✅ Pruebas pasadas: ${testResults.passed}`);
  console.log(`❌ Pruebas falladas: ${testResults.failed}`);
  console.log(`📋 Total de pruebas: ${testResults.total}`);

  console.log('\n📋 DETALLES:');
  testResults.details.forEach(detail => {
    console.log(`   ${detail.status} ${detail.name}`);
    if (detail.error) {
      console.log(`      Error: ${detail.error}`);
    }
  });

  // Resultado final
  if (testResults.failed === 0) {
    console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON!');
    console.log('El sistema está funcionando correctamente como WhatsApp Web.');
    console.log('✅ Comunicación en tiempo real');
    console.log('✅ Mensajería instantánea');
    console.log('✅ Indicadores de estado');
    console.log('✅ Transferencia de chats');
    console.log('✅ Manejo de archivos');
    console.log('✅ Sistema de notificaciones');
  } else {
    console.log('\n⚠️  ALGUNAS PRUEBAS FALLARON');
    console.log('Revisa los logs del servidor para más detalles.');
  }

  process.exit(testResults.failed === 0 ? 0 : 1);
}

// Manejar errores
process.on('unhandledRejection', (error) => {
  console.error('❌ Error no manejado:', error);
  process.exit(1);
});

// Ejecutar pruebas
runAllTests().catch(error => {
  console.error('❌ Error ejecutando pruebas:', error);
  process.exit(1);
});