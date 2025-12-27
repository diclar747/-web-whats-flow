const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'whatsflow2024',
    database: 'whatsflow'
});

async function checkUserLinks() {
    try {
        console.log('🔍 Verificando relación Admin-Agente...\n');

        // 1. Datos del Admin (Claudio) - Buscamos por email o phone
        const [admins] = await pool.query('SELECT id, name, email, phone, role FROM users WHERE email = ?', ['claudio@cnid.com.py']);
        const admin = admins[0];

        if (!admin) {
            console.log('❌ ADMIN claudio@cnid.com.py NO ENCONTRADO');
            process.exit(1);
        }
        console.log('👤 ADMIN:', admin);

        // 2. Datos del Agente (Gestion)
        const [agents] = await pool.query('SELECT id, name, email, phone, role, admin_phone, session_id FROM users WHERE email = ?', ['gestion@gmail.com.py']);
        const agent = agents[0];

        if (!agent) {
            console.log('❌ AGENTE gestion@gmail.com.py NO ENCONTRADO');
            process.exit(1);
        }
        console.log('👤 AGENTE:', agent);

        // Verificación
        const linkedByPhone = agent.admin_phone === admin.phone;
        const linkedByEmail = agent.admin_phone === admin.email;

        console.log('\n🔗 Vinculación por phone:', linkedByPhone ? '✅ SÍ' : '❌ NO');
        console.log('🔗 Vinculación por email:', linkedByEmail ? '✅ SÍ' : '❌ NO');

        if (!linkedByPhone && !linkedByEmail) {
            console.log(`⚠️ ALERTA: Agente tiene admin_phone="${agent.admin_phone}", pero Admin tiene phone="${admin.phone}" y email="${admin.email}"`);
        }

        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
}

checkUserLinks();
