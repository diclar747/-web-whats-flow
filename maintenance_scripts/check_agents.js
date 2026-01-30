const mysql = require('mysql2/promise');

async function checkAgents() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: process.env.DB_PASSWORD || 'whatsflow2024',
        database: 'whatsflow',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const connection = await pool.getConnection();

        try {
            console.log('\n📋 Agentes en la base de datos:\n');

            const [agents] = await connection.execute(`
                SELECT id, name, email, role, admin_phone, session_id, status
                FROM users 
                WHERE role = 'agent'
                ORDER BY created_at DESC
            `);

            console.table(agents);
            console.log(`\n✅ Total agentes: ${agents.length}`);

            // Ver qué admin_phone tienen
            console.log('\n🔍 Valores de admin_phone:');
            const uniqueAdminPhones = [...new Set(agents.map(a => a.admin_phone))];
            console.log(uniqueAdminPhones);

        } finally {
            connection.release();
        }

        await pool.end();

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkAgents();
