
// Para verificar el estado actual de las sesiones
console.log('📊 Estado actual de sesiones activas:');
console.log('Cantidad de sesiones activas:', activeSessions?.size || 0);

if (activeSessions) {
    console.log('Sesiones activas:');
    for (const [token, session] of activeSessions.entries()) {
        console.log('  -', session.email, 'en', session.deviceId?.substr(0, 20) || 'unknown');
    }
}
