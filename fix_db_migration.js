const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'whatsflow'
};

async function checkAndFix() {
    console.log('Connecting to DB...');
    const connection = await mysql.createConnection(dbConfig);

    try {
        console.log('Checking segments table...');
        const [segments] = await connection.execute("SHOW TABLES LIKE 'segments'");
        if (segments.length === 0) {
            console.log('Creating segments table...');
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS segments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    session_id VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    count INT DEFAULT 0,
                    is_system BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_session (session_id)
                )
            `);
            console.log('Segments table created.');
        } else {
            console.log('Segments table exists.');
        }

        console.log('Checking contact_segments table...');
        const [contactSegments] = await connection.execute("SHOW TABLES LIKE 'contact_segments'");
        if (contactSegments.length === 0) {
            console.log('Creating contact_segments table...');
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS contact_segments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    contact_id INT NOT NULL, /* Asumiendo que contacts tiene ID o usaremos JID? Revisaré contacts */
                    segment_id INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
                    INDEX idx_segment (segment_id),
                    INDEX idx_contact (contact_id)
                )
            `);
            console.log('contact_segments table created.');
        } else {
            console.log('contact_segments table exists.');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await connection.end();
    }
}

checkAndFix();
