const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixOwners() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const correctOwnerPhone = '595985768793'; // Claudio's actual phone

        // Update ALL sessions that should belong to this user
        // We identify them by their phone numbers
        const phonesToUpdate = ['595985768793', '595994854167'];

        for (const phone of phonesToUpdate) {
            const [result] = await pool.execute(
                "UPDATE user_sessions SET owner_phone_number = ? WHERE phone = ?",
                [correctOwnerPhone, phone]
            );
            console.log(`Updated ${phone}:`, result.info);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

fixOwners();
