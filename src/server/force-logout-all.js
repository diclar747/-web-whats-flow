// Script para forzar logout de todos los usuarios
const io = require('socket.io-client');

const socket = io('https://winsap.com.py', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Conectado al servidor');
  
  // Emitir evento de cierre de sesión global
  socket.emit('admin-force-logout-all', {
    reason: 'Sistema limpiado completamente - Reautenticación requerida',
    timestamp: new Date().toISOString()
  });
  
  console.log('📢 Evento de logout global enviado');
  
  setTimeout(() => {
    socket.disconnect();
    console.log('✅ Desconectado');
    process.exit(0);
  }, 2000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Error de conexión:', error.message);
  process.exit(1);
});
