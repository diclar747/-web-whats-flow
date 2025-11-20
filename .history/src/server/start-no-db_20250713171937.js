console.log('🔥 INICIANDO WHATSFLOW SIN MYSQL...\n');

// Configurar variables de entorno antes de importar
process.env.SKIP_DB = 'true';
process.env.NODE_ENV = 'development';

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
        console.log('⚠️  Error de MySQL ignorado en modo sin DB:', err.message);
        return;
    }
    console.error('❌ Error crítico:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    if (reason && (reason.code === 'ETIMEDOUT' || reason.code === 'ECONNREFUSED')) {
        console.log('⚠️  Rechazo de promesa de MySQL ignorado:', reason.message);
        return;
    }
    console.error('❌ Promesa rechazada:', reason);
});

console.log('✅ Configuración sin DB aplicada');
console.log('🚀 Cargando servidor principal...\n');

// Importar el servidor principal
require('./index.js');
