const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'whatsflow',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function loadContactsToDefaultBoard(userId) {
    if (!pool) {
        console.log(`[KANBAN-LOAD] Base de datos no disponible`);
        return;
    }

    const connection = await pool.getConnection();
    try {
        console.log(`[KANBAN-LOAD] Iniciando carga de contactos para user_id=${userId}...`);

        // Obtener el tablero "Sin Categoría" (is_default = 1)
        const [boards] = await connection.execute(
            'SELECT id FROM kanban_boards WHERE session_id = ? AND is_default = 1 LIMIT 1',
            [userId]
        );

        if (boards.length === 0) {
            console.log(`[KANBAN-LOAD] No se encontró tablero "Sin Categoría" para user_id=${userId}`);
            return;
        }

        const sinCategoriaBoardId = boards[0].id;
        console.log(`[KANBAN-LOAD] Tablero "Sin Categoría" encontrado: ${sinCategoriaBoardId}`);

        // Verificar si ya hay contactos en el tablero
        const [existingContacts] = await connection.execute(
            'SELECT COUNT(*) as count FROM kanban_contacts WHERE board_id = ?',
            [sinCategoriaBoardId]
        );

        if (existingContacts[0].count > 0) {
            console.log(`[KANBAN-LOAD] El tablero "Sin Categoría" ya tiene ${existingContacts[0].count} contactos. No se cargan más.`);
            // return; // Sigue adelante para depurar
        }

        // Obtener todos los contactos individuales del usuario
        const [contacts] = await connection.execute(
            'SELECT jid FROM contacts WHERE session_id = ? AND jid LIKE "%@s.whatsapp.net"',
            [userId]
        );

        console.log(`[KANBAN-LOAD] Contactos encontrados en DB para user_id=${userId}: ${contacts.length}`);

        if (contacts.length > 0) {
            console.log(`[KANBAN-LOAD] Cargando ${contacts.length} contactos en tablero "Sin Categoría" (board_id=${sinCategoriaBoardId})...`);

            let loadedCount = 0;
            for (const contact of contacts) {
                try {
                    await connection.execute(
                        'INSERT INTO kanban_contacts (board_id, contact_jid) VALUES (?, ?)',
                        [sinCategoriaBoardId, contact.jid]
                    );
                    loadedCount++;
                } catch (err) {
                    // Ignorar duplicados
                    if (err.code !== 'ER_DUP_ENTRY') {
                        console.error(`[KANBAN-LOAD] Error insertando contacto ${contact.jid}:`, err.message);
                    }
                }
            }

            console.log(`[KANBAN-LOAD] ✅ ${loadedCount} contactos procesados para "Sin Categoría"`);
        } else {
            console.log(`[KANBAN-LOAD] No hay contactos disponibles para cargar en "Sin Categoría"`);
        }

    } catch (error) {
        console.error(`[KANBAN-LOAD] Error cargando contactos en tablero por defecto:`, error);
    } finally {
        connection.release();
    }
}

async function run() {
    await loadContactsToDefaultBoard(1);
    await pool.end();
}

run().catch(console.error);
