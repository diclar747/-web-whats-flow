const axios = require('axios');

async function testSessionStatus() {
    try {
        // Simular la llamada que hace el frontend
        const response = await axios.get('http://localhost:3002/api/session/1/status', {
            headers: {
                'Authorization': 'Bearer ' + process.env.TEST_TOKEN // Necesitarás un token válido
            }
        });

        console.log('📡 Respuesta del endpoint /api/session/1/status:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        if (error.response) {
            console.error('❌ Error:', error.response.status, error.response.data);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

// También verificar directamente en la base de datos
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'whatsflow'
    });

    try {
        console.log('\n🔍 Verificando user_sessions para usuario ID 1:\n');

        const [rows] = await connection.execute(`
            SELECT phone, is_active, session_id, is_primary, updated_at 
            FROM user_sessions 
            WHERE session_id = ? OR phone = ? 
            ORDER BY is_active DESC, is_primary DESC, updated_at DESC
        `, [1, 1]);

        console.table(rows);

        if (rows.length > 0) {
            console.log(`\n✅ Teléfono encontrado: ${rows[0].phone}`);
            console.log(`✅ Estado activo: ${rows[0].is_active}`);
        } else {
            console.log('\n❌ No se encontró ninguna sesión para el usuario ID 1');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

checkDatabase();
// testSessionStatus(); // Descomentar si tienes un token válido
