/**
 * Test manual del Status Scheduler
 */

const mysql = require('mysql2/promise');
const StatusScheduler = require('./src/server/services/statusScheduler');

// Configuración de BD
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'whatsflow2024',
    database: 'whatsflow',
    waitForConnections: true,
    connectionLimit: 10
});

// Mock sessions y io
const sessions = new Map();
const io = {
    emit: (event, data) => {
        console.log(`[MOCK-IO] Emit: ${event}`, data);
    }
};

console.log('📱 Iniciando test del Status Scheduler...\n');

async function test() {
    try {
        // Crear instancia del scheduler
        const scheduler = new StatusScheduler(pool, sessions, io);
        console.log('✅ Scheduler creado correctamente\n');

        // Verificar programaciones pendientes
        console.log('🔍 Buscando programaciones pendientes...');
        const [schedules] = await pool.query(
            `SELECT * FROM status_schedules
             WHERE is_active = TRUE
             AND next_publish_at <= NOW()
             ORDER BY next_publish_at ASC`
        );

        console.log(`📊 Programaciones encontradas: ${schedules.length}`);
        schedules.forEach(s => {
            console.log(`   - ${s.id}: ${s.name} (next: ${s.next_publish_at})`);
        });

        // Ejecutar manualmente la verificación
        console.log('\n📱 Ejecutando checkAndPublishStatuses...');
        await scheduler.checkAndPublishStatuses();

        console.log('\n✅ Test completado');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en test:', error);
        process.exit(1);
    }
}

test();
