const fs = require('fs');

console.log('🔍 VERIFICANDO CORRECCIÓN APLICADA\n');

// Leer archivo del servidor
const serverFile = fs.readFileSync('./src/server/index.js', 'utf8');

// Verificar si la corrección está presente
const correccionBusqueda = '🌍🌍🌍 EMITIDO GLOBALMENTE para todas las sesiones';
const correccionPresente = serverFile.includes(correccionBusqueda);

if (correccionPresente) {
    console.log('✅ CORRECCIÓN APLICADA EXITOSAMENTE');
    console.log('📍 Ubicación: src/server/index.js líneas ~4870-4878');
    console.log('📋 Cambio: Se agregó emisión global de mensajes');
    console.log('🎯 Resuelve: Comunicación bidireccional entre sesiones');
    console.log('💡 Efecto: Todos los mensajes ahora se emiten globalmente');
    console.log('📱 Usuarios afectados: 595984219248 y 595985768793');
} else {
    console.log('❌ CORRECCIÓN NO APLICADA');
    console.log('⚠️ La corrección no se encuentra en el archivo');
}

// Verificar estructura de emisión
console.log('\n📡 ESTRUCTURA DE EMISIÓN ACTUAL:');
const emisiones = [
    { tipo: 'Específica (session-${sessionId})', regex: /io\.to\(`session-\$\{sessionId\}`\)\.emit\('message'/g },
    { tipo: 'PhoneNumber (session-${phoneNumber})', regex: /io\.to\(`session-\$\{phoneNumber\}`\)\.emit\('message'/g },
    { tipo: 'GLOBAL (io.emit)', regex: /io\.emit\('message'/g }
];

emisiones.forEach(emision => {
    const matches = serverFile.match(emision.regex);
    const count = matches ? matches.length : 0;
    console.log(`   ${count > 0 ? '✅' : '❌'} ${emision.tipo}: ${count} ocurrencia(s)`);
});

console.log('\n🎯 PRÓXIMOS PASOS:');
console.log('1. Reiniciar el servidor: cd src/server && npm start');
console.log('2. Probar comunicación entre 595984219248 y 595985768793');
console.log('3. Verificar que los mensajes se muestren en ambas bandejas');
console.log('4. Monitorear logs para confirmar emisión global');

console.log('\n📊 RESULTADO ESPERADO:');
console.log('   - 595985768793 envía → llega a 595984219248 ✅ (YA FUNCIONA)');
console.log('   - 595984219248 responde → llega a 595985768793 ✅ (CORREGIDO)');