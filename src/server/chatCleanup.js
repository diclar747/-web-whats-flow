/**
 * Chat Cleanup Service - Limpieza automática de tabla chat
 * 
 * Mantiene la tabla 'chat' optimizada eliminando mensajes antiguos.
 * El historial completo se mantiene en la tabla 'messages'.
 * 
 * Configuración:
 * - Retención: 90 días (mensajes más recientes para UI)
 * - Ejecución: Diaria a las 3:00 AM
 * - Límite por ejecución: 10,000 mensajes (evitar bloqueos)
 */

const mysql = require('mysql2/promise');

// Configuración
const CLEANUP_CONFIG = {
    retentionDays: 1,            // 1 día = 24 horas (solo mensajes del día actual)
    batchSize: 10000,            // Máximo mensajes a eliminar por ejecución
    executionHour: 0,            // Hora 00:00 (medianoche) - inicio del nuevo día
    executionMinute: 0,
    enabled: true
};

let pool = null;
let cleanupInterval = null;

/**
 * Inicializa el servicio de limpieza
 */
function initializeCleanup(dbPool) {
    pool = dbPool;
    
    if (!CLEANUP_CONFIG.enabled) {
        console.log('[CHAT-CLEANUP] ⏸️ Servicio de limpieza deshabilitado');
        return;
    }

    console.log('[CHAT-CLEANUP] ✅ Servicio de limpieza inicializado');
    console.log(`[CHAT-CLEANUP] 📋 Configuración: ${CLEANUP_CONFIG.retentionDays} días de retención`);
    
    // Programar primera ejecución
    scheduleNextRun();
    
    // También ejecutar inmediatamente al iniciar (una vez)
    setTimeout(() => {
        runCleanup().catch(err => {
            console.error('[CHAT-CLEANUP] ❌ Error en ejecución inicial:', err.message);
        });
    }, 60000); // Esperar 1 minuto después del inicio
}

/**
 * Programa la siguiente ejecución
 */
function scheduleNextRun() {
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(CLEANUP_CONFIG.executionHour, CLEANUP_CONFIG.executionMinute, 0, 0);
    
    // Si ya pasó la hora hoy, programar para mañana
    if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
    }
    
    const delay = nextRun - now;
    const hoursUntil = Math.floor(delay / (1000 * 60 * 60));
    const minutesUntil = Math.floor((delay % (1000 * 60 * 60)) / (1000 * 60));
    
    console.log(`[CHAT-CLEANUP] ⏰ Próxima ejecución: ${nextRun.toLocaleString()} (en ${hoursUntil}h ${minutesUntil}m)`);
    
    // Programar timeout
    setTimeout(() => {
        runCleanup().catch(err => {
            console.error('[CHAT-CLEANUP] ❌ Error en ejecución programada:', err.message);
        });
        // Reprogramar para el siguiente día
        scheduleNextRun();
    }, delay);
}

/**
 * Ejecuta la limpieza de mensajes antiguos
 */
async function runCleanup() {
    if (!pool) {
        console.error('[CHAT-CLEANUP] ❌ Pool de BD no disponible');
        return;
    }

    console.log('[CHAT-CLEANUP] 🧹 Iniciando limpieza de tabla chat...');
    const startTime = Date.now();
    
    const connection = await pool.getConnection();
    
    try {
        // 1. Contar mensajes antes de la limpieza
        const [beforeCount] = await connection.execute(
            'SELECT COUNT(*) as total FROM chat'
        );
        const totalBefore = beforeCount[0].total;
        
        // 2. Contar mensajes a eliminar
        const [toDeleteCount] = await connection.execute(
            `SELECT COUNT(*) as total FROM chat 
             WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [CLEANUP_CONFIG.retentionDays]
        );
        const totalToDelete = toDeleteCount[0].total;
        
        console.log(`[CHAT-CLEANUP] 📊 Total mensajes en chat: ${totalBefore}`);
        console.log(`[CHAT-CLEANUP] 📊 Mensajes a eliminar: ${totalToDelete}`);
        
        if (totalToDelete === 0) {
            console.log('[CHAT-CLEANUP] ✅ No hay mensajes para eliminar');
            return;
        }
        
        // 3. Eliminar mensajes antiguos en lotes
        const deleteLimit = Math.min(totalToDelete, CLEANUP_CONFIG.batchSize);
        
        const [result] = await connection.execute(
            `DELETE FROM chat 
             WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
             LIMIT ?`,
            [CLEANUP_CONFIG.retentionDays, deleteLimit]
        );
        
        const deletedCount = result.affectedRows;
        const duration = Date.now() - startTime;
        
        // 4. Obtener conteo final
        const [afterCount] = await connection.execute(
            'SELECT COUNT(*) as total FROM chat'
        );
        const totalAfter = afterCount[0].total;
        
        console.log(`[CHAT-CLEANUP] ✅ Limpieza completada:`);
        console.log(`   - Mensajes eliminados: ${deletedCount}`);
        console.log(`   - Total antes: ${totalBefore}`);
        console.log(`   - Total después: ${totalAfter}`);
        console.log(`   - Duración: ${duration}ms`);
        
        // 5. Emitir estadísticas si hay más mensajes por eliminar
        if (totalToDelete > CLEANUP_CONFIG.batchSize) {
            const remaining = totalToDelete - deletedCount;
            console.log(`[CHAT-CLEANUP] ⚠️ Quedan ${remaining} mensajes pendientes por eliminar (límite por ejecución: ${CLEANUP_CONFIG.batchSize})`);
        }
        
        return {
            deleted: deletedCount,
            before: totalBefore,
            after: totalAfter,
            duration: duration
        };
        
    } catch (error) {
        console.error('[CHAT-CLEANUP] ❌ Error durante la limpieza:', error.message);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Limpieza manual (puede llamarse desde endpoint)
 */
async function manualCleanup(days = null, limit = null) {
    const config = {
        retentionDays: days || CLEANUP_CONFIG.retentionDays,
        batchSize: limit || CLEANUP_CONFIG.batchSize
    };
    
    console.log(`[CHAT-CLEANUP] 🧹 Limpieza manual iniciada (retención: ${config.retentionDays} días)`);
    
    if (!pool) {
        throw new Error('Pool de BD no disponible');
    }
    
    const connection = await pool.getConnection();
    
    try {
        const [result] = await connection.execute(
            `DELETE FROM chat 
             WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
             LIMIT ?`,
            [config.retentionDays, config.batchSize]
        );
        
        const deletedCount = result.affectedRows;
        console.log(`[CHAT-CLEANUP] ✅ Limpieza manual completada: ${deletedCount} mensajes eliminados`);
        
        return {
            deleted: deletedCount,
            retentionDays: config.retentionDays
        };
        
    } finally {
        connection.release();
    }
}

/**
 * Obtiene estadísticas de la tabla chat
 */
async function getStats() {
    if (!pool) {
        throw new Error('Pool de BD no disponible');
    }
    
    const connection = await pool.getConnection();
    
    try {
        // Total de mensajes
        const [totalResult] = await connection.execute(
            'SELECT COUNT(*) as total FROM chat'
        );
        
        // Mensajes por antigüedad
        const [oldMessages] = await connection.execute(
            `SELECT COUNT(*) as count FROM chat 
             WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [CLEANUP_CONFIG.retentionDays]
        );
        
        // Mensajes recientes (últimos 7 días)
        const [recentMessages] = await connection.execute(
            `SELECT COUNT(*) as count FROM chat 
             WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
        );
        
        // Tamaño de la tabla
        const [tableSize] = await connection.execute(
            `SELECT 
                ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
            AND table_name = 'chat'`
        );
        
        return {
            total: totalResult[0].total,
            oldMessages: oldMessages[0].count,
            recentMessages: recentMessages[0].count,
            tableSizeMB: tableSize[0]?.size_mb || 0,
            retentionDays: CLEANUP_CONFIG.retentionDays
        };
        
    } finally {
        connection.release();
    }
}

/**
 * Detiene el servicio de limpieza
 */
function stopCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    console.log('[CHAT-CLEANUP] ⏹️ Servicio de limpieza detenido');
}

module.exports = {
    initializeCleanup,
    runCleanup,
    manualCleanup,
    getStats,
    stopCleanup,
    CLEANUP_CONFIG
};
