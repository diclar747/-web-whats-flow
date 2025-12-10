require('dotenv').config({ path: '/var/www/web.whats-flow.com/.env' });
const mysql = require('mysql2/promise');

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'whatsflow'
    });

    try {
        const now = new Date();
        const nowISO = now.toISOString().slice(0, 19).replace('T', ' ');

        console.log(`[DEBUG] JS-Time (UTC): ${now.toISOString()}`);
        console.log(`[DEBUG] Query-Time (should be UTC): ${nowISO}`);

        // Verificando si encuentra la campaña con el query exacto
        const [campaigns] = await connection.execute(`
            SELECT id, session_id, name, scheduled_at, phone_number, status
            FROM campaigns
            WHERE status = 'scheduled'
            AND scheduled_at IS NOT NULL
            AND scheduled_at <= ?
        `, [nowISO]);

        console.log(`[DEBUG] Campañas encontradas: ${campaigns.length}`);
        if (campaigns.length > 0) {
            console.table(campaigns);
        } else {
            // Si no encuentra, buscar por qué
            console.log('[DEBUG] Investigando causa de no encontrar...');
            const [allScheduled] = await connection.execute(`
                SELECT id, name, scheduled_at, status 
                FROM campaigns 
                WHERE status = 'scheduled'
            `);
            console.log('[DEBUG] Todas las campañas Scheduled:');
            console.table(allScheduled);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

run();
