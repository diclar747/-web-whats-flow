// ... (imports remain similar)
const mysql = require('mysql2/promise');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'whatsflow',
    waitForConnections: true,
    connectionLimit: 10
};

async function checkAndStartCampaigns(providedPool = null) {
    let pool = providedPool;
    let localPool = false;

    if (!pool) {
        pool = mysql.createPool(dbConfig);
        localPool = true;
    }

    let connection;

    try {
        connection = await pool.getConnection();

        try {
            // Buscar campañas programadas cuya fecha ya pasó
            const [campaigns] = await connection.execute(`
                SELECT id, session_id, name, scheduled_at
                FROM campaigns
                WHERE status = 'scheduled'
                AND scheduled_at IS NOT NULL
                AND scheduled_at <= NOW()
            `);

            if (campaigns.length > 0) {
                console.log(`[SCHEDULER] ${new Date().toISOString()} - Encontradas ${campaigns.length} campañas listas para ejecutar`);
            }

            for (const campaign of campaigns) {
                console.log(`[SCHEDULER] ⏰ Ejecutando campaña programada: ${campaign.name} (ID: ${campaign.id})`);

                try {
                    // Actualizar estado a 'sending'
                    await connection.execute(
                        'UPDATE campaigns SET status = ?, updated_at = NOW() WHERE id = ?',
                        ['sending', campaign.id]
                    );

                    // Llamar al endpoint para iniciar la campaña
                    // Usar el puerto del env o fallback a 3000 (o el que esté corriendo nginx/app)
                    // Asumimos localhost:3000 por el código original, pero 'index.js' corre en PORT?
                    // Deberíamos usar una URL relativa o loopback segura.
                    const port = process.env.PORT || 3000;
                    const checkUrl = `http://localhost:${port}/api/campaigns/${campaign.id}/start`;

                    const response = await axios.post(
                        checkUrl,
                        {},
                        {
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            timeout: 5000
                        }
                    );

                    if (response.data.success) {
                        console.log(`[SCHEDULER] ✅ Campaña ${campaign.id} iniciada exitosamente`);
                    } else {
                        console.log(`[SCHEDULER] ⚠️ Error iniciando campaña ${campaign.id}:`, response.data.error);
                        // Revertir a scheduled si falló
                        await connection.execute(
                            'UPDATE campaigns SET status = ? WHERE id = ?',
                            ['scheduled', campaign.id]
                        );
                    }
                } catch (error) {
                    console.error(`[SCHEDULER] ❌ Error procesando campaña ${campaign.id}:`, error.message);
                    // Revertir a scheduled si hubo error
                    await connection.execute(
                        'UPDATE campaigns SET status = ? WHERE id = ?',
                        ['scheduled', campaign.id]
                    );
                }
            }
        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error('[SCHEDULER] Error general:', error.message);
    } finally {
        if (localPool && pool) {
            await pool.end();
        }
    }
}

// Si se ejecuta directamente (CLI o Cron)
if (require.main === module) {
    checkAndStartCampaigns()
        .then(() => {
            console.log('[SCHEDULER] Check completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('[SCHEDULER] Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { checkAndStartCampaigns };
