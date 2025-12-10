require('dotenv').config({ path: __dirname + '/.env' });
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'whatsflow'
};

const plans = [
    {
        name: 'Básico',
        price: 80000,
        description: 'Plan inicial para pequeños negocios',
        max_agents: 1,
        max_channels: 1,
        max_messages: 1000,
        max_sessions: 1,
        bot_enabled: true,
        api_enabled: true,
        modules: []
    },
    {
        name: 'Estándar',
        price: 160000,
        description: 'Plan estándar para crecimiento',
        max_agents: 2,
        max_channels: 2,
        max_messages: 2500,
        max_sessions: 2,
        bot_enabled: true,
        api_enabled: true,
        modules: []
    },
    {
        name: 'Manager',
        price: 320000,
        description: 'Plan para equipos en expansión',
        max_agents: 5,
        max_channels: 5,
        max_messages: 5000,
        max_sessions: 5,
        bot_enabled: true,
        api_enabled: true,
        modules: []
    },
    {
        name: 'Comercial',
        price: 640000,
        description: 'Plan comercial avanzado',
        max_agents: 10,
        max_channels: 10,
        max_messages: 10000,
        max_sessions: 10,
        bot_enabled: true,
        api_enabled: true,
        modules: []
    },
    {
        name: 'Ejecutivo',
        price: 1280000,
        description: 'Plan ejecutivo de alto rendimiento',
        max_agents: 15,
        max_channels: 15,
        max_messages: 15000,
        max_sessions: 15,
        bot_enabled: true,
        api_enabled: true,
        modules: []
    },
    {
        name: 'Corporativo',
        price: 2560000,
        description: 'Solución corporativa completa',
        max_agents: 25,
        max_channels: 25,
        max_messages: 25000,
        max_sessions: 25,
        bot_enabled: true,
        api_enabled: true,
        modules: []
    }
];

async function seedPlans() {
    console.log('🌱 Iniciando carga de planes...');
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado a la base de datos');

        // Eliminar planes existentes para evitar duplicados o conflictos
        console.log('🗑️ Eliminando planes existentes...');
        await connection.execute('DELETE FROM plans');
        console.log('✅ Planes eliminados');

        // Reiniciar contador de ID
        await connection.execute('ALTER TABLE plans AUTO_INCREMENT = 1');

        console.log('📝 Insertando nuevos planes...');
        for (const plan of plans) {
            await connection.execute(`
                INSERT INTO plans (name, description, price, modules, max_agents, max_sessions, max_channels, max_messages, bot_enabled, api_enabled)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                plan.name,
                plan.description,
                plan.price,
                JSON.stringify(plan.modules),
                plan.max_agents,
                plan.max_sessions,
                plan.max_channels,
                plan.max_messages,
                plan.bot_enabled,
                plan.api_enabled
            ]);
            console.log(`   - Plan ${plan.name} creado.`);
        }

        console.log('🎉 Carga de planes completada con éxito.');

    } catch (error) {
        console.error('❌ Error durante la carga de planes:', error);
    } finally {
        if (connection) await connection.end();
    }
}

seedPlans();
