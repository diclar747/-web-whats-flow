const mysql = require('mysql2/promise');

// Conectar a la base de datos
async function checkPlans() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'whatsapp_bot_db'
    });

    try {
        const [rows] = await connection.query('SELECT * FROM plans WHERE name LIKE "%manager%" OR name LIKE "%Manager%" OR name LIKE "%manager%" OR name LIKE "%Manger%";');
        console.log('Planes que contienen "manager":', rows);

        // También obtener todos los planes
        const [allPlans] = await connection.query('SELECT * FROM plans;');
        console.log('\nTodos los planes:', allPlans);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkPlans();