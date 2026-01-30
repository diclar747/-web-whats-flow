const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkPlans() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'whatsflow',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SHOW TABLES LIKE 'plans'");
        console.log('Plans table exists:', rows.length > 0);

        if (rows.length > 0) {
            const [desc] = await connection.query("DESCRIBE plans");
            console.log('Plans table structure:', desc);
        } else {
            // Create it if missing for test
            console.log('Creating plans table manually...');
            await connection.query(`
                CREATE TABLE IF NOT EXISTS plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                modules JSON COMMENT 'Array of module names',
                max_agents INT DEFAULT 1,
                max_sessions INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
             `);
            console.log('Plans table created manually.');
        }

        connection.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkPlans();
