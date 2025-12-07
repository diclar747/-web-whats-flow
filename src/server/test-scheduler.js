// Test manual del scheduler de campañas programadas
const mysql = require('mysql2/promise');

async function testScheduler() {
    console.log('🕐 Iniciando test del scheduler...');

    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'whatsflow2024',
        database: 'whatsflow',
        waitForConnections: true,
        connectionLimit: 10
    });

    try {
        const connection = await pool.getConnection();
        console.log('✅ Conectado a la base de datos');

        try {
            // Buscar campañas programadas cuya fecha ya pasó
            const [campaigns] = await connection.execute(`
                SELECT id, session_id, name, scheduled_at, status, NOW() as now
                FROM campaigns
                WHERE status = 'scheduled'
                AND scheduled_at IS NOT NULL
                AND scheduled_at <= NOW()
            `);

            console.log(`\n📊 Encontradas ${campaigns.length} campañas programadas listas para ejecutar:`);

            for (const campaign of campaigns) {
                console.log(`\n[CAMPAIGN] ID: ${campaign.id}`);
                console.log(`[CAMPAIGN] Nombre: ${campaign.name}`);
                console.log(`[CAMPAIGN] Session ID: ${campaign.session_id}`);
                console.log(`[CAMPAIGN] Status: ${campaign.status}`);
                console.log(`[CAMPAIGN] Scheduled: ${campaign.scheduled_at}`);
                console.log(`[CAMPAIGN] Now: ${campaign.now}`);
                console.log(`[CAMPAIGN] Debería ejecutarse: SÍ`);
            }

            if (campaigns.length === 0) {
                console.log('\n⚠️ No hay campañas programadas pendientes de ejecutar');

                // Mostrar todas las campañas programadas
                const [allScheduled] = await connection.execute(`
                    SELECT id, name, status, scheduled_at, NOW() as now
                    FROM campaigns
                    WHERE scheduled_at IS NOT NULL
                    ORDER BY id DESC
                    LIMIT 5
                `);

                console.log(`\n📋 Últimas 5 campañas con fecha programada:`);
                for (const c of allScheduled) {
                    console.log(`  - ID ${c.id}: ${c.name} | Status: ${c.status} | Scheduled: ${c.scheduled_at}`);
                }
            }

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

testScheduler();
