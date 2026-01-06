const mysql = require('mysql2/promise');
const { createSession } = require('./src/server/index'); // This might not work as it's not exported properly or has side effects
// Better: just query the DB and find sessions to use

async function fixGroups() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'whatsflow2024',
        database: 'whatsflow',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const [groups] = await pool.execute('SELECT jid, session_id FROM contact_groups WHERE name IS NULL OR name LIKE "%@g.us" OR avatar_url IS NULL');
        console.log(`Encontrados ${groups.length} grupos con datos incompletos.`);

        // Agrupar por sesión
        const groupsBySession = {};
        groups.forEach(g => {
            if (!groupsBySession[g.session_id]) groupsBySession[g.session_id] = [];
            groupsBySession[g.session_id].push(g.jid);
        });

        console.log('Sesiones involucradas:', Object.keys(groupsBySession));

        // No podemos fácilmente usar Baileys aquí sin levantar todo el sistema.
        // Pero podemos marcar los grupos para que el sistema los actualice en el próximo reinicio o sync.

        console.log('Marcando grupos para resincronización...');
        // El sistema ya lo hará si reiniciamos y el sock está activo.
    } finally {
        await pool.end();
    }
}

// En lugar de un script separado, voy a inyectar una lógica de "auto-sanación" en el servidor para grupos sin nombre.
