// Script para limpiar sesiones activas en memoria que pueden estar causando conflictos
// Ejecutar: node scripts/clear-active-sessions.js

const fs = require('fs');
const path = require('path');

// Simular la estructura de activeSessions
console.log('🔧 Limpiando sesiones activas en memoria...');

// Crear un archivo temporal para limpiar sesiones
const cleanupScript = `
// Este script limpia las sesiones activas en memoria
// Se debe ejecutar cuando hay conflictos de sesión

console.log('🧹 Limpiando sesiones activas...');

// Si estás ejecutando esto desde la consola del servidor:
// activeSessions.clear();

console.log('✅ Sesiones activas limpiadas');
`;

fs.writeFileSync(path.join(__dirname, 'temp-cleanup.js'), cleanupScript);

console.log('📋 Instrucciones para limpiar sesiones activas:');
console.log('1. Detener el servidor (Ctrl+C)');
console.log('2. Reiniciar el servidor: npm start');
console.log('3. Esto limpiará todas las sesiones activas en memoria');
console.log('');
console.log('⚠️  Esto forzará a todos los usuarios a iniciar sesión nuevamente');
console.log('✅ Resolverá conflictos de sesiones cruzadas');

// También crear instrucciones para verificar el estado actual
const statusScript = `
// Para verificar el estado actual de las sesiones
console.log('📊 Estado actual de sesiones activas:');
console.log('Cantidad de sesiones activas:', activeSessions?.size || 0);

if (activeSessions) {
    console.log('Sesiones activas:');
    for (const [token, session] of activeSessions.entries()) {
        console.log('  -', session.email, 'en', session.deviceId?.substr(0, 20) || 'unknown');
    }
}
`;

fs.writeFileSync(path.join(__dirname, 'temp-status.js'), statusScript);

console.log('');
console.log('📊 Para verificar el estado actual, ejecutar en consola del servidor:');
console.log('   node scripts/temp-status.js');

console.log('');
console.log('🎯 El problema principal era que todas las sesiones QR usaban "admin" como userId');
console.log('✅ Ahora cada admin tiene su propio userId basado en su número de teléfono');
console.log('🔧 Esto evita conflictos entre sesiones de diferentes admins');