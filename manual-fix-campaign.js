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
        console.log('--- Corrigiendo campaña "campa" ---');
        // Buscar campaña por nombre aproximado y estado draft
        const [rows] = await connection.execute(
            `SELECT id, name, status FROM campaigns WHERE name LIKE '%campa%' AND status = 'draft' LIMIT 1`
        );

        if (rows.length > 0) {
            const camp = rows[0];
            console.log(`Encontrada: ${camp.name} (ID: ${camp.id}). Actualizando a scheduled...`);

            await connection.execute(
                "UPDATE campaigns SET status = 'scheduled' WHERE id = ?",
                [camp.id]
            );
            console.log("✅ Actualizada correctamente.");
        } else {
            console.log("⚠️ No se encontró campaña 'campa' en estado draft.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

run();
