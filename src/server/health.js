const express = require('express');
const router = express.Router();

let isHealthy = true;

/**
 * Health check endpoint básico
 * GET /api/health
 */
router.get('/health', (req, res) => {
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    const health = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        uptime: `${Math.floor(uptime / 60)} min`,
        memory: {
            heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
            rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
            external: `${Math.round(memory.external / 1024 / 1024)}MB`
        },
        timestamp: new Date().toISOString(),
        instanceId: process.env.INSTANCE_ID || 0,
        nodeVersion: process.version
    };

    res.status(isHealthy ? 200 : 503).json(health);
});

/**
 * Readiness check (para verificar dependencias)
 * GET /api/ready
 */
router.get('/ready', async (req, res) => {
    const checks = {
        server: true,
        database: await checkDatabase(),
        memory: checkMemory()
    };

    const ready = Object.values(checks).every(v => v);

    res.status(ready ? 200 : 503).json({
        ready,
        checks,
        timestamp: new Date().toISOString()
    });
});

/**
 * Liveness check (para K8s futuro)
 * GET /api/live
 */
router.get('/live', (req, res) => {
    res.status(200).json({
        alive: true,
        timestamp: new Date().toISOString()
    });
});

/**
 * Métricas básicas
 * GET /api/metrics
 */
router.get('/metrics', (req, res) => {
    const memory = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    res.json({
        uptime: process.uptime(),
        memory: {
            heapUsed: memory.heapUsed,
            heapTotal: memory.heapTotal,
            rss: memory.rss,
            external: memory.external,
            heapUsagePercent: ((memory.heapUsed / memory.heapTotal) * 100).toFixed(2)
        },
        cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
        },
        pid: process.pid,
        version: process.version,
        timestamp: new Date().toISOString()
    });
});

// Helper functions
async function checkDatabase() {
    try {
        // Aquí deberías hacer un ping a tu base de datos
        // Por ahora retorna true
        return true;
    } catch (error) {
        console.error('Database check failed:', error);
        return false;
    }
}

function checkMemory() {
    const memory = process.memoryUsage();
    const heapUsedMB = memory.heapUsed / 1024 / 1024;
    const heapTotalMB = memory.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    // Considera sano si el uso de heap es menor a 85%
    return usagePercent < 85;
}

// Función para marcar el servidor como unhealthy (útil para graceful shutdown)
function setUnhealthy() {
    isHealthy = false;
}

function setHealthy() {
    isHealthy = true;
}

module.exports = router;
module.exports.setUnhealthy = setUnhealthy;
module.exports.setHealthy = setHealthy;
