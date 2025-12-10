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
        plan_name: 'basico',
        plan_display_name: 'Básico',
        duration_days: 30,
        price: 80000,
        max_users: 1,
        max_channels: 1,
        max_messages_per_month: 1000,
        max_campaigns: 10,
        max_contacts: 1000,
        bot_enabled: true,
        api_enabled: true
    },
    {
        plan_name: 'estandar',
        plan_display_name: 'Estándar',
        duration_days: 30,
        price: 160000,
        max_users: 2,
        max_channels: 2,
        max_messages_per_month: 2500,
        max_campaigns: 20,
        max_contacts: 2500,
        bot_enabled: true,
        api_enabled: true
    },
    {
        plan_name: 'manager',
        plan_display_name: 'Manager',
        duration_days: 30,
        price: 320000,
        max_users: 5,
        max_channels: 5,
        max_messages_per_month: 5000,
        max_campaigns: 50,
        max_contacts: 5000,
        bot_enabled: true,
        api_enabled: true
    },
    {
        plan_name: 'comercial',
        plan_display_name: 'Comercial',
        duration_days: 30,
        price: 640000,
        max_users: 10,
        max_channels: 10,
        max_messages_per_month: 10000,
        max_campaigns: 100,
        max_contacts: 10000,
        bot_enabled: true,
        api_enabled: true
    },
    {
        plan_name: 'ejecutivo',
        plan_display_name: 'Ejecutivo',
        duration_days: 30,
        price: 1280000,
        max_users: 15,
        max_channels: 15,
        max_messages_per_month: 15000,
        max_campaigns: 150,
        max_contacts: 15000,
        bot_enabled: true,
        api_enabled: true
    },
    {
        plan_name: 'corporativo',
        plan_display_name: 'Corporativo',
        duration_days: 30,
        price: 2560000,
        max_users: 25,
        max_channels: 25,
        max_messages_per_month: 25000,
        max_campaigns: 250,
        max_contacts: 25000,
        bot_enabled: true,
        api_enabled: true
    }
];

async function seedPlans() {
    console.log('🌱 Iniciando carga de planes en subscription_plans...');
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado a la base de datos');

        // Eliminar planes existentes para evitar duplicados
        console.log('🗑️ Eliminando planes existentes...');
        await connection.execute('DELETE FROM subscription_plans');
        console.log('✅ Planes eliminados');

        // Reiniciar contador de ID
        await connection.execute('ALTER TABLE subscription_plans AUTO_INCREMENT = 1');

        console.log('📝 Insertando nuevos planes...');
        for (const plan of plans) {
            await connection.execute(`
                INSERT INTO subscription_plans (
                    plan_name, 
                    plan_display_name, 
                    duration_days, 
                    price, 
                    max_users, 
                    max_messages_per_month, 
                    max_campaigns, 
                    max_contacts,
                    max_channels,
                    bot_enabled,
                    api_enabled,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `, [
                plan.plan_name,
                plan.plan_display_name,
                plan.duration_days,
                plan.price,
                plan.max_users,
                plan.max_messages_per_month,
                plan.max_campaigns,
                plan.max_contacts,
                plan.max_channels,
                plan.bot_enabled,
                plan.api_enabled
            ]);
            console.log(`   - Plan ${plan.plan_display_name} creado (${plan.price} Gs, ${plan.max_users} agentes, ${plan.max_channels} canales)`);
        }

        console.log('🎉 Carga de planes completada con éxito.');

    } catch (error) {
        console.error('❌ Error durante la carga de planes:', error);
    } finally {
        if (connection) await connection.end();
    }
}

seedPlans();
