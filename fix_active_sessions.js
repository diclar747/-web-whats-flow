/**
 * Script para marcar sesiones activas y limpiar datos inconsistentes
 */

const mysql = require('mysql2/promise');

async function fix() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: process.env.DB_PASSWORD || '',
        database: 'whatsflow',
        waitForConnections: true,
        connectionLimit: 10
    });

    try {
        console.log('\n========================================');
        console.log('FIXING ACTIVE SESSIONS & DATA INCONSISTENCIES');
        console.log('========================================\n');

        // 1. Identificar las sesiones que deberían estar activas basándose en chats recientes
        console.log('1️⃣  Identificando sesiones con actividad reciente...\n');

        const [activeSessions] = await pool.execute(
            `SELECT
                c.session_id,
                c.phone,
                COUNT(*) as chat_count,
                MAX(c.last_message_time) as last_activity
             FROM chats c
             WHERE c.last_message_time >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
             GROUP BY c.session_id, c.phone
             ORDER BY last_activity DESC`
        );

        console.log('Sesiones con actividad reciente:');
        console.table(activeSessions);

        // 2. Actualizar user_sessions para marcar como activas las sesiones que coinciden
        console.log('\n2️⃣  Actualizando user_sessions...\n');

        for (const session of activeSessions) {
            // Intentar encontrar la sesión en user_sessions
            const [existing] = await pool.execute(
                `SELECT id, session_id, phone FROM user_sessions
                 WHERE (session_id = ? OR phone = ?)
                 LIMIT 1`,
                [session.session_id, session.phone]
            );

            if (existing.length > 0) {
                // Actualizar a activa
                await pool.execute(
                    `UPDATE user_sessions
                     SET is_active = 1, updated_at = NOW()
                     WHERE id = ?`,
                    [existing[0].id]
                );
                console.log(`✅ Actualizada sesión: session_id=${existing[0].session_id}, phone=${existing[0].phone} → ACTIVA`);
            } else {
                console.log(`⚠️  No se encontró en user_sessions: session_id=${session.session_id}, phone=${session.phone}`);
                // Opcionalmente, insertar
                try {
                    await pool.execute(
                        `INSERT INTO user_sessions
                         (session_id, phone, owner_phone_number, is_active, created_at, updated_at)
                         VALUES (?, ?, ?, 1, NOW(), NOW())`,
                        [session.session_id, session.phone, session.phone]
                    );
                    console.log(`✅ Insertada nueva sesión activa: session_id=${session.session_id}, phone=${session.phone}`);
                } catch (insertErr) {
                    console.log(`   ⚠️  No se pudo insertar: ${insertErr.message}`);
                }
            }
        }

        // 3. Verificar sesiones activas resultantes
        console.log('\n3️⃣  Verificando sesiones activas resultantes...\n');
        const [activeNow] = await pool.execute(
            `SELECT id, session_id, phone, owner_phone_number, is_active
             FROM user_sessions
             WHERE is_active = 1
             ORDER BY updated_at DESC`
        );
        console.table(activeNow);

        // 4. Análisis de datos inconsistentes
        console.log('\n4️⃣  Analizando datos inconsistentes (múltiples session_id por phone)...\n');

        const [duplicates] = await pool.execute(
            `SELECT
                phone,
                COUNT(DISTINCT session_id) as session_count,
                GROUP_CONCAT(DISTINCT session_id ORDER BY session_id) as session_ids,
                GROUP_CONCAT(DISTINCT session_id ORDER BY session_id) as all_ids
             FROM chats
             WHERE last_message_time >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
             GROUP BY phone
             HAVING session_count > 1`
        );

        if (duplicates.length > 0) {
            console.log('⚠️  Números con múltiples session_id:');
            console.table(duplicates);

            console.log('\n5️⃣  Recomendación para consolidación:\n');
            console.log('Para cada phone con múltiples session_id, deberías elegir UNO como principal.');
            console.log('Estrategia recomendada: Usar el session_id con más actividad reciente.\n');

            for (const dup of duplicates) {
                const [sessions] = await pool.execute(
                    `SELECT
                        session_id,
                        COUNT(*) as chat_count,
                        MAX(last_message_time) as last_activity
                     FROM chats
                     WHERE phone = ?
                       AND last_message_time >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
                     GROUP BY session_id
                     ORDER BY last_activity DESC`,
                    [dup.phone]
                );

                console.log(`\n📱 Phone: ${dup.phone}`);
                console.table(sessions);
                console.log(`   👉 RECOMENDACIÓN: Usar session_id="${sessions[0].session_id}" como principal`);
            }
        } else {
            console.log('✅ No se encontraron inconsistencias de session_id por phone');
        }

        console.log('\n========================================');
        console.log('FIX COMPLETADO');
        console.log('========================================\n');

        console.log('⚠️  IMPORTANTE: Si hay múltiples session_id por phone, considera:');
        console.log('   1. Consolidar todos los chats bajo un solo session_id');
        console.log('   2. O actualizar la lógica de consulta para buscar por phone sin importar session_id');
        console.log('   3. O actualizar el frontend para usar el session_id correcto al consultar\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

fix();
