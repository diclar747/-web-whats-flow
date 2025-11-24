const io = require('socket.io-client');

const socket = io('https://web.whats-flow.com', {
  transports: ['websocket', 'polling'],
  reconnection: false
});

socket.on('connect', () => {
  console.log('✅ Conectado - Enviando logout global');
  
  // Emitir eventos de logout global
  const logoutData = {
    reason: 'Sistema limpiado - Reautenticación requerida',
    timestamp: new Date().toISOString()
  };
  
  // Emitir a todos los posibles listeners
  socket.emit('session-invalidated', logoutData);
  socket.emit('session-logged-out', logoutData);
  socket.emit('force-logout-all', logoutData);
  
  console.log('📢 Eventos de logout enviados');
  console.log('🔄 Todos los usuarios deberán reconectar');
  
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
