const mysql = require('mysql2/promise');
require('dotenv').config();

async function verificarAgentes() {
    try {
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'whatsflow',
            connectionLimit: 10
        };

        console.log('🔧 Configuración DB:', {
            host: dbConfig.host,
            user: dbConfig.user,
            database: dbConfig.database
        });

        const pool = mysql.createPool(dbConfig);
        const connection = await pool.getConnection();

        try {
            console.log('✅ Conexión a DB establecida');

            // Verificar agentes para admin 595985768793
            const [agents] = await connection.execute(`
                SELECT 
                    id, 
                    name, 
                    email, 
                    phone, 
                    role, 
                    status, 
                    admin_phone,
                    created_at,
                    updated_at
                FROM users 
                WHERE admin_phone = '595985768793' 
                AND role = 'agent'
                ORDER BY id
            `);

            console.log('\n🔍 AGENTES ENCONTRADOS PARA ADMIN 595985768793:');
            console.log('================================================');
            
            if (agents.length === 0) {
                console.log('❌ No se encontraron agentes para este admin');
            } else {
                agents.forEach((agent, index) => {
                    console.log(`\n👤 Agente ${index + 1}:`);
                    console.log(`   ID: ${agent.id}`);
                    console.log(`   Nombre: ${agent.name}`);
                    console.log(`   Email: ${agent.email}`);
                    console.log(`   Teléfono: ${agent.phone}`);
                    console.log(`   Rol: ${agent.role}`);
                    console.log(`   Estado: ${agent.status}`);
                    console.log(`   Admin Phone: ${agent.admin_phone}`);
                    console.log(`   Creado: ${agent.created_at}`);
                    console.log(`   Actualizado: ${agent.updated_at}`);
                });
                
                console.log(`\n📊 TOTAL DE AGENTES: ${agents.length}`);
            }

            // Verificar duplicados por email
            const [duplicates] = await connection.execute(`
                SELECT email, COUNT(*) as count 
                FROM users 
                WHERE admin_phone = '595985768793' 
                AND role = 'agent'
                GROUP BY email 
                HAVING COUNT(*) > 1
            `);

            console.log('\n🔍 VERIFICACIÓN DE DUPLICADOS:');
            console.log('==============================');
            
            if (duplicates.length === 0) {
                console.log('✅ No se encontraron duplicados por email');
            } else {
                duplicates.forEach(dup => {
                    console.log(`❌ Email duplicado: ${dup.email} (${dup.count} registros)`);
                });
            }

            // Verificar también usuarios admin
            const [adminUsers] = await connection.execute(`
                SELECT id, name, email, phone, role, status
                FROM users 
                WHERE phone = '595985768793'
                ORDER BY id
            `);

            console.log('\n🔍 USUARIOS CON TELÉFONO 595985768793:');
            console.log('=======================================');
            
            adminUsers.forEach(user => {
                console.log(`👤 ID: ${user.id}, Nombre: ${user.name}, Email: ${user.email}, Rol: ${user.role}, Estado: ${user.status}`);
            });

        } finally {
            connection.release();
            await pool.end();
            console.log('\n✅ Conexión cerrada');
        }

    } catch (error) {
        console.error('❌ Error al verificar agentes:', error.message);
        if (error.code) {
            console.error('Código de error:', error.code);
        }
    }
}

verificarAgentes();