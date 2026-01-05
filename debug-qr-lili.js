// Script para diagnosticar el problema de "Error al generar QR" para lili@gmail.com
// Ejecutar en la Consola del Navegador (F12) mientras está en https://web.whats-flow.com

console.log('📋 === DIAGNOSTICO DE ERROR QR PARA LILI ===\n');

// 1. Ver sesión y deviceId almacenados
console.log('1️⃣ DATOS ALMACENADOS:');
const sessionData = {
  'sessionStorage.whinsap_session': sessionStorage.getItem('whinsap_session'),
  'sessionStorage.whinsap_session_device_id': sessionStorage.getItem('whinsap_session_device_id'),
  'sessionStorage.device_id': sessionStorage.getItem('device_id'),
  'localStorage.whinsap_session': localStorage.getItem('whinsap_session'),
  'localStorage.whinsap_session_device_id': localStorage.getItem('whinsap_session_device_id'),
  'localStorage.device_id': localStorage.getItem('device_id'),
};
console.table(sessionData);

// 2. Determinar deviceId que se usaría
console.log('\n2️⃣ DEVICE_ID QUE SE USARÍA:');
const deviceId = sessionStorage.getItem('device_id') 
  || sessionStorage.getItem('whinsap_device_id')
  || sessionStorage.getItem('whinsap_session_device_id')
  || localStorage.getItem('device_id')
  || localStorage.getItem('whinsap_device_id')
  || localStorage.getItem('whinsap_session_device_id')
  || crypto.randomUUID?.() 
  || Date.now().toString(36) + Math.random().toString(36).substr(2);
console.log('deviceId:', deviceId);

// 3. Ver información de API_BASE
console.log('\n3️⃣ CONFIGURACION DE API:');
const protocol = window.location.protocol;
const host = window.location.host;
const hostname = window.location.hostname;
const apiBase = (hostname === 'localhost' || hostname === '127.0.0.1') ? 'http://localhost:3002' : '';
console.log('Protocol:', protocol);
console.log('Host:', host);
console.log('Hostname:', hostname);
console.log('API_BASE:', apiBase || '(Empty - usando rutas relativas)');
console.log('URL que se usaría: ' + apiBase + '/api/qr-status?deviceId=' + encodeURIComponent(deviceId));

// 4. Probar fetch directo
console.log('\n4️⃣ PROBANDO FETCH DIRECTO:');
fetch(`/api/qr-status?deviceId=${encodeURIComponent(deviceId)}`)
  .then(r => r.json())
  .then(data => {
    console.log('✅ RESPUESTA DEL SERVIDOR:');
    console.table({
      'success': data.success,
      'error': data.error,
      'isConnected': data.isConnected,
      'hasQR': !!data.qrDataUrl,
      'sessionId': data.sessionId
    });
  })
  .catch(err => {
    console.error('❌ ERROR EN FETCH:');
    console.error(err);
  });

// 5. Ver si hay errors en la consola
console.log('\n5️⃣ Revisa si hay mensajes de ERROR en ROJO arriba ☝️\n');

// 6. Limpiar storage si se quiere
console.log('\n6️⃣ PARA LIMPIAR STORAGE:');
console.log('Copia y pega esto:');
console.log(`
localStorage.removeItem('device_id');
localStorage.removeItem('whinsap_device_id');
localStorage.removeItem('whinsap_session_device_id');
localStorage.removeItem('whinsap_session');
sessionStorage.removeItem('device_id');
sessionStorage.removeItem('whinsap_device_id');
sessionStorage.removeItem('whinsap_session_device_id');
sessionStorage.removeItem('whinsap_session');
console.log('✅ Storage limpiado - recarga la página');
`);
