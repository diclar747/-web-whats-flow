const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function updateSuperAdminPassword() {
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
            // 1. Verificar si existe el usuario
            const [users] = await connection.execute(
                'SELECT id, name, email, role, status FROM users WHERE email = ?',
                ['sistempar@gmail.com']
            );

            console.log('📋 Usuario encontrado:', users);

            if (users.length === 0) {
                console.log('❌ Usuario sistempar@gmail.com NO existe. Creándolo...');

                // Crear el usuario super admin
                const hashedPassword = await bcrypt.hash('Cadc//**1978', 12);

                await connection.execute(`
                    INSERT INTO users (
                        name, email, password, role, status, 
                        created_at, updated_at
                    ) VALUES (?, ?, ?, 'admin', 'active', NOW(), NOW())
                `, ['Super Admin', 'sistempar@gmail.com', hashedPassword]);

                console.log('✅ Super Admin creado exitosamente');
            } else {
                console.log('✅ Usuario existe. Actualizando contraseña...');

                // Actualizar contraseña
                const hashedPassword = await bcrypt.hash('Cadc//**1978', 12);

                await connection.execute(
                    'UPDATE users SET password = ?, role = ?, status = ?, updated_at = NOW() WHERE email = ?',
                    [hashedPassword, 'admin', 'active', 'sistempar@gmail.com']
                );

                console.log('✅ Contraseña actualizada exitosamente');
            }

            // Verificar el resultado
            const [updatedUser] = await connection.execute(
                'SELECT id, name, email, role, status FROM users WHERE email = ?',
                ['sistempar@gmail.com']
            );

            console.log('📋 Usuario actualizado:', updatedUser[0]);
            console.log('\n✅ LISTO! Ahora puedes iniciar sesión con:');
            console.log('   Email: sistempar@gmail.com');
            console.log('   Password: Cadc//**1978');

        } finally {
            connection.release();
        }

        await pool.end();

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

updateSuperAdminPassword();
