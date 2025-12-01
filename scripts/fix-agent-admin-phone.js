const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixAgentAdminPhone() {
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

            // Verificar el agente actual
            const [agents] = await connection.execute(`
                SELECT id, name, email, phone, admin_phone
                FROM users 
                WHERE id = 11
            `);

            console.log('\n🔍 AGENTE ACTUAL (ID: 11):');
            console.log('==========================');
            console.log(agents[0]);

            // Actualizar el admin_phone del agente
            const [updateResult] = await connection.execute(`
                UPDATE users 
                SET admin_phone = '595985768793'
                WHERE id = 11
            `);

            console.log('\n✅ AGENTE ACTUALIZADO:');
            console.log('=====================');
            console.log(`Filas afectadas: ${updateResult.affectedRows}`);

            // Verificar la actualización
            const [updatedAgent] = await connection.execute(`
                SELECT id, name, email, phone, admin_phone
                FROM users 
                WHERE id = 11
            `);

            console.log('\n🔍 AGENTE DESPUÉS DE LA ACTUALIZACIÓN:');
            console.log('======================================');
            console.log(updatedAgent[0]);

            console.log('\n🎯 RESULTADO:');
            console.log('=============');
            if (updatedAgent[0].admin_phone === '595985768793') {
                console.log('✅ Agente actualizado correctamente con admin_phone: 595985768793');
            } else {
                console.log('❌ Error: El admin_phone no se actualizó correctamente');
            }

        } finally {
            connection.release();
            await pool.end();
            console.log('\n✅ Conexión cerrada');
        }

    } catch (error) {
        console.error('❌ Error al actualizar agente:', error.message);
    }
}

fixAgentAdminPhone();