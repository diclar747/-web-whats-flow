const mysql = require('mysql2/promise');
require('dotenv').config();

async function verificarSesionesActivas() {
    try {
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'whatsflow',
            connectionLimit: 10
        };

        console.log('🔧 Conectando a la base de datos...');
        const pool = mysql.createPool(dbConfig);
        const connection = await pool.getConnection();

        try {
            console.log('✅ Conexión establecida');

            // Verificar todas las sesiones activas
            const [sessions] = await connection.execute(`
                SELECT 
                    session_id,
                    phone_number,
                    is_active,
                    created_at,
                    last_activity
                FROM user_sessions 
                WHERE is_active = TRUE
                ORDER BY last_activity DESC
            `);

            console.log('\n🔍 SESIONES ACTIVAS EN LA BASE DE DATOS:');
            console.log('========================================');
            
            if (sessions.length === 0) {
                console.log('❌ No hay sesiones activas');
            } else {
                sessions.forEach((session, index) => {
                    console.log(`\n📱 Sesión ${index + 1}:`);
                    console.log(`   Session ID: ${session.session_id}`);
                    console.log(`   Phone Number: ${session.phone_number}`);
                    console.log(`   Activa: ${session.is_active ? '✅ Sí' : '❌ No'}`);
                    console.log(`   Creada: ${session.created_at}`);
                    console.log(`   Última actividad: ${session.last_activity}`);
                });
                
                console.log(`\n📊 TOTAL DE SESIONES ACTIVAS: ${sessions.length}`);
            }

            // Verificar sesiones específicas para el admin 595985768793
            const [adminSessions] = await connection.execute(`
                SELECT 
                    session_id,
                    phone_number,
                    is_active,
                    created_at,
                    last_activity
                FROM user_sessions 
                WHERE phone_number = '595985768793'
                ORDER BY last_activity DESC
            `);

            console.log('\n🔍 SESIONES DEL ADMIN 595985768793:');
            console.log('===================================');
            
            if (adminSessions.length === 0) {
                console.log('❌ No hay sesiones para el admin 595985768793');
            } else {
                adminSessions.forEach((session, index) => {
                    console.log(`\n📱 Sesión ${index + 1}:`);
                    console.log(`   Session ID: ${session.session_id}`);
                    console.log(`   Phone Number: ${session.phone_number}`);
                    console.log(`   Activa: ${session.is_active ? '✅ Sí' : '❌ No'}`);
                    console.log(`   Creada: ${session.created_at}`);
                    console.log(`   Última actividad: ${session.last_activity}`);
                });
                
                console.log(`\n📊 TOTAL DE SESIONES DEL ADMIN: ${adminSessions.length}`);
            }

            // Verificar si hay sesiones duplicadas
            const [duplicateSessions] = await connection.execute(`
                SELECT 
                    phone_number,
                    COUNT(*) as session_count
                FROM user_sessions 
                WHERE is_active = TRUE
                GROUP BY phone_number
                HAVING COUNT(*) > 1
            `);

            console.log('\n🔍 VERIFICACIÓN DE SESIONES DUPLICADAS:');
            console.log('=======================================');
            
            if (duplicateSessions.length === 0) {
                console.log('✅ No hay sesiones duplicadas');
            } else {
                duplicateSessions.forEach(dup => {
                    console.log(`❌ Teléfono ${dup.phone_number} tiene ${dup.session_count} sesiones activas`);
                });
            }

        } finally {
            connection.release();
            await pool.end();
            console.log('\n✅ Conexión cerrada');
        }

    } catch (error) {
        console.error('❌ Error al verificar sesiones:', error.message);
    }
}

verificarSesionesActivas();