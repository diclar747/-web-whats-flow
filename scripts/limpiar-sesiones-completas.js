const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function limpiarSesionesCompletas() {
    console.log('🧹 INICIANDO LIMPIEZA COMPLETA DE SESIONES...\n');
    
    try {
        // Conexión a base de datos
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'whatsflow'
        };

        console.log('📡 Conectando a la base de datos...');
        const connection = await mysql.createConnection(dbConfig);

        try {
            // 1. Limpiar tabla user_sessions
            console.log('🗑️  Limpiando tabla user_sessions...');
            const [result1] = await connection.execute('TRUNCATE TABLE user_sessions');
            console.log('✅ user_sessions limpiada');

            // 2. Limpiar tabla whatsapp_sessions
            console.log('🗑️  Limpiando tabla whatsapp_sessions...');
            const [result2] = await connection.execute('TRUNCATE TABLE whatsapp_sessions');
            console.log('✅ whatsapp_sessions limpiada');

            // 3. Verificar limpieza
            console.log('🔍 Verificando limpieza...');
            const [count1] = await connection.execute('SELECT COUNT(*) as total FROM user_sessions');
            const [count2] = await connection.execute('SELECT COUNT(*) as total FROM whatsapp_sessions');
            
            console.log(`📊 user_sessions: ${count1[0].total} registros`);
            console.log(`📊 whatsapp_sessions: ${count2[0].total} registros`);

            // 4. Reiniciar contadores de autoincrement
            console.log('🔧 Reiniciando contadores...');
            await connection.execute('ALTER TABLE user_sessions AUTO_INCREMENT = 1');
            await connection.execute('ALTER TABLE whatsapp_sessions AUTO_INCREMENT = 1');
            console.log('✅ Contadores reiniciados');

            // 5. Limpiar archivos temporales del sistema
            console.log('🧽 Limpiando archivos temporales...');
            
            // Limpiar caché del servidor
            const cacheDir = path.join(__dirname, '../src/server/cache');
            if (fs.existsSync(cacheDir)) {
                fs.rmSync(cacheDir, { recursive: true, force: true });
                console.log('✅ Caché del servidor limpiada');
            }

            // Limpiar archivos de sesión temporales
            const tempDir = path.join(__dirname, '../src/server/temp');
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
                console.log('✅ Archivos temporales limpiados');
            }

            console.log('\n🎉 LIMPIEZA COMPLETA FINALIZADA EXITOSAMENTE!');
            console.log('\n📋 RESUMEN:');
            console.log('- Todas las sesiones de la base de datos han sido eliminadas');
            console.log('- Los contadores de autoincrement han sido reiniciados');
            console.log('- Archivos temporales han sido limpiados');
            console.log('- Ahora puedes intentar escanear el código QR nuevamente');

        } finally {
            await connection.end();
            console.log('\n📡 Conexión a base de datos cerrada');
        }

    } catch (error) {
        console.error('❌ Error durante la limpieza:', error.message);
        process.exit(1);
    }
}

// Ejecutar limpieza
console.log('🚀 Iniciando proceso de limpieza...');
limpiarSesionesCompletas();