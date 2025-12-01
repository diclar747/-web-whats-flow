#!/usr/bin/env node

/**
 * SCRIPT DE PRUEBA PARA EVENTOS DE SOCKET.IO COMPLETOS
 * Verifica que todos los eventos críticos estén funcionando
 */

const io = require('socket.io-client');
const axios = require('axios');

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3002';
const TEST_SESSION_ID = 'test-session-' + Date.now();

console.log('🧪 INICIANDO PRUEBA DE SOCKETS COMPLETOS');
console.log('=========================================\n');

// Configuración de prueba
const testConfig = {
  socketUrl: SOCKET_URL,
  sessionId: TEST_SESSION_ID,
  timeout: 10000
};

// Resultados de las pruebas
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// Función para ejecutar prueba
async function runTest(name, testFunction) {
  testResults.total++;
  console.log(`\n🧪 Ejecutando prueba: ${name}`);
  
  try {
    await testFunction();
    testResults.passed++;
    testResults.details.push({ name, status: '✅ PASÓ', error: null });
    console.log(`✅ ${name}: PASÓ`);
  } catch (error) {
    testResults.failed++;
    testResults.details.push({ name, status: '❌ FALLÓ', error: error.message });
    console.log(`❌ ${name}: FALLÓ - ${error.message}`);
  }
}

// Prueba 1: Conexión básica
async function testBasicConnection() {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      query: {
        sessionId: TEST_SESSION_ID,
        userRole: 'admin'
      },
      timeout: 5000
    });

    socket.on('connect', () => {
      console.log('   🔌 Socket conectado exitosamente');
      socket.disconnect();
      resolve();
    });

    socket.on('connect_error', (error) => {
      reject(new Error(`Error de conexión: ${error.message}`));
    });

    setTimeout(() => {
      reject(new Error('Timeout en conexión'));
    }, 5000);
  });
}

// Prueba 2: Unirse a sesión
async function testJoinSession() {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      query: {
        sessionId: TEST_SESSION_ID,
        userRole: 'admin'
      }
    });

    socket.on('connect', () => {
      socket.emit('join-session', { sessionId: TEST_SESSION_ID });
    });

    socket.on('joined-session', (data) => {
      if (data.success && data.sessionId === TEST_SESSION_ID) {
        console.log('   ✅ Unido a sesión exitosamente');
        socket.disconnect();
        resolve();
      } else {
        reject(new Error('Respuesta de join-session incorrecta'));
      }
    });

    setTimeout(() => {
      reject(new Error('Timeout en join-session'));
    }, 5000);
  });
}

// Prueba 3: Mensajes en tiempo real
async function testRealTimeMessages() {
  return new Promise((resolve, reject) => {
    const senderSocket = io(SOCKET_URL, {
      query: {
        sessionId: TEST_SESSION_ID,
        userRole: 'admin'
      }
    });

    const receiverSocket = io(SOCKET_URL, {
      query: {
        sessionId: TEST_SESSION_ID,
        userRole: 'admin'
      }
    });

    let senderConnected = false;
    let receiverConnected = false;
    let messageReceived = false;

    senderSocket.on('connect', () => {
      senderConnected = true;
      senderSocket.emit('join-session', { sessionId: TEST_SESSION_ID });
    });

    receiverSocket.on('connect', () => {
      receiverConnected = true;
      receiverSocket.emit('join-session', { sessionId: TEST_SESSION_ID });
    });

    // Escuchar mensaje en el receptor
    receiverSocket.on('new-message', (data) => {
      if (data.message && data.message.text === 'Test message') {
        messageReceived = true;
        console.log('   💬 Mensaje recibido exitosamente');
        cleanup();
        resolve();
      }
    });

    // Enviar mensaje cuando ambos estén conectados
    const sendMessage = () => {
      if (senderConnected && receiverConnected) {
        setTimeout(() => {
          senderSocket.emit('new-message', {
            sessionId: TEST_SESSION_ID,
            chatId: 'test-chat',
            message: {
              id: 'test-msg-' + Date.now(),
              text: 'Test message',
              type: 'text',
              timestamp: Date.now()
            }
          });
        }, 1000);
      }
    };

    senderSocket.on('joined-session', sendMessage);
    receiverSocket.on('joined-session', sendMessage);

    const cleanup = () => {
      senderSocket.disconnect();
      receiverSocket.disconnect();
    };

    setTimeout(() => {
      if (!messageReceived) {
        cleanup();
        reject(new Error('Timeout en mensaje en tiempo real'));
      }
    }, 10000);
  });
}

// Prueba 4: Indicador de escritura
async function testTypingIndicator() {
  return new Promise((resolve, reject) => {
    const senderSocket = io(SOCKET_URL, {
      query: {
        sessionId: TEST_SESSION_ID,
        userRole: 'admin'
      }
    });

    const receiverSocket = io(SOCKET_URL, {
      query: {
        sessionId: TEST_SESSION_ID,
        userRole: 'admin'
      }
    });

    let typingReceived = false;
    let stopTypingReceived = false;

    senderSocket.on('connect', () => {
      senderSocket.emit('join-session', { sessionId: TEST_SESSION_ID });
    });

    receiverSocket.on('connect', () => {
      receiverSocket.emit('join-session', { sessionId: TEST_SESSION_ID });
    });

    // Escuchar eventos de typing
    receiverSocket.on('typing', (data) => {
      if (data.isTyping && data.userId === 'test-user') {
        typingReceived = true;
        console.log('   ✍️ Indicador de escritura recibido');
        
        // Esperar un poco y luego enviar stop-typing
        setTimeout(() => {
          senderSocket.emit('stop-typing', {
            sessionId: TEST_SESSION_ID,
            chatId: 'test-chat',
            userId: 'test-user'
          });
        }, 1000);
      } else if (!data.isTyping && data.userId === 'test-user') {
        stopTypingReceived = true;
        console.log('   ✍️ Stop typing recibido');
        
        if (typingReceived && stopTypingReceived) {
          cleanup();
          resolve();
        }
      }
    });

    // Enviar typing cuando ambos estén conectados
    const startTyping = () => {
      if (senderSocket.connected && receiverSocket.connected) {
        setTimeout(() => {
          senderSocket.emit('typing', {
            sessionId: TEST_SESSION_ID,
            chatId: 'test-chat',
            userId: 'test-user'
          });
        }, 1000);
      }
    };

    senderSocket.on('joined-session', startTyping);
    receiverSocket.on('joined-session', startTyping);

    const cleanup = () => {
      senderSocket.disconnect();
      receiverSocket.disconnect();
    };

    setTimeout(() => {
      if (!typingReceived || !stopTypingReceived) {
        cleanup();
        reject(new Error('Timeout en indicador de escritura'));
      }
    }, 10000);
  });
}

// Prueba 5: Estado de mensajes
async function testMessageStatus() {
  return new Promise((resolve, reject) => {
    const senderSocket = io(SOCKET_URL, {
      query: {
        sessionId: TEST_SESSION_ID,
        userRole: 'admin'
      }
    });

    const receiverSocket = io(SOCKET_URL, {
      query: {
        sessionId: TEST_SESSION_ID,
        userRole: 'admin'
      }
    });

    let statusReceived = false;

    senderSocket.on('connect', () => {
      senderSocket.emit('join-session', { sessionId: TEST_SESSION_ID });
    });

    receiverSocket.on('connect', () => {
      receiverSocket.emit('join-session', { sessionId: TEST_SESSION_ID });
    });

    // Escuchar estado de mensaje
    receiverSocket.on('message-status', (data) => {
      if (data.messageId === 'test-msg-status' && data.status === 'delivered') {
        statusReceived = true;
        console.log('   📨 Estado de mensaje recibido');
        cleanup();
        resolve();
      }
    });

    // Enviar estado cuando ambos estén conectados
    const sendStatus = () => {
      if (senderSocket.connected && receiverSocket.connected) {
        setTimeout(() => {
          senderSocket.emit('message-status', {
            sessionId: TEST_SESSION_ID,
            messageId: 'test-msg-status',
            status: 'delivered'
          });
        }, 1000);
      }
    };

    senderSocket.on('joined-session', sendStatus);
    receiverSocket.on('joined-session', sendStatus);

    const cleanup = () => {
      senderSocket.disconnect();
      receiverSocket.disconnect();
    };

    setTimeout(() => {
      if (!statusReceived) {
        cleanup();
        reject(new Error('Timeout en estado de mensaje'));
      }
    }, 10000);
  });
}

// Prueba 6: Progreso de archivos
async function testFileUploadProgress() {
  return new Promise((resolve, reject) => {
    const senderSocket = io(SOCKET_URL, {
      query: {
        sessionId: TEST_SESSION_ID,
        userRole: 'admin'
      }
    });

    const receiverSocket = io(SOCKET_URL, {
      query: {
        sessionId: TEST_SESSION_ID,
        userRole: 'admin'
      }
    });

    let progressReceived = false;

    senderSocket.on('connect', () => {
      senderSocket.emit('join-session', { sessionId: TEST_SESSION_ID });
    });

    receiverSocket.on('connect', () => {
      receiverSocket.emit('join-session', { sessionId: TEST_SESSION_ID });
    });

    // Escuchar progreso de archivo
    receiverSocket.on('file-upload-progress', (data) => {
      if (data.fileId === 'test-file' && data.progress === 50) {
        progressReceived = true;
        console.log('   📁 Progreso de archivo recibido');
        cleanup();
        resolve();
      }
    });

    // Enviar progreso cuando ambos estén conectados
    const sendProgress = () => {
      if (senderSocket.connected && receiverSocket.connected) {
        setTimeout(() => {
          senderSocket.emit('file-upload-progress', {
            sessionId: TEST_SESSION_ID,
            fileId: 'test-file',
            progress: 50
          });
        }, 1000);
      }
    };

    senderSocket.on('joined-session', sendProgress);
    receiverSocket.on('joined-session', sendProgress);

    const cleanup = () => {
      senderSocket.disconnect();
      receiverSocket.disconnect();
    };

    setTimeout(() => {
      if (!progressReceived) {
        cleanup();
        reject(new Error('Timeout en progreso de archivo'));
      }
    }, 10000);
  });
}

// Ejecutar todas las pruebas
async function runAllTests() {
  console.log('🔧 Configuración de prueba:');
  console.log(`   - URL: ${testConfig.socketUrl}`);
  console.log(`   - Session ID: ${testConfig.sessionId}`);
  console.log(`   - Timeout: ${testConfig.timeout}ms\n`);

  await runTest('Conexión básica', testBasicConnection);
  await runTest('Unirse a sesión', testJoinSession);
  await runTest('Mensajes en tiempo real', testRealTimeMessages);
  await runTest('Indicador de escritura', testTypingIndicator);
  await runTest('Estado de mensajes', testMessageStatus);
  await runTest('Progreso de archivos', testFileUploadProgress);

  // Mostrar resumen
  console.log('\n📊 RESUMEN DE PRUEBAS');
  console.log('====================');
  console.log(`✅ Pasaron: ${testResults.passed}`);
  console.log(`❌ Fallaron: ${testResults.failed}`);
  console.log(`📋 Total: ${testResults.total}`);

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
    console.log('El sistema de sockets está funcionando correctamente.');
  } else {
    console.log('\n⚠️  ALGUNAS PRUEBAS FALLARON');
    console.log('Revisa los logs del servidor para más detalles.');
  }

  process.exit(testResults.failed === 0 ? 0 : 1);
}

// Manejar errores no capturados
process.on('unhandledRejection', (error) => {
  console.error('❌ Error no manejado:', error);
  process.exit(1);
});

// Ejecutar pruebas
runAllTests().catch(error => {
  console.error('❌ Error ejecutando pruebas:', error);
  process.exit(1);
});