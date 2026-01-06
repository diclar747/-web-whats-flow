const crypto = require('crypto');

/**
 * Crea los tableros Kanban por defecto para un usuario si no existen.
 * @param {Object} pool - Pool de conexión MySQL
 * @param {string|number} userId - ID del usuario (users.id)
 */
async function createDefaultKanbanBoards(pool, userId) {
    if (!pool) {
        console.log(`[KANBAN] Base de datos no disponible`);
        return;
    }

    const connection = await pool.getConnection();
    try {
        // Verificar si ya existen tableros para este usuario
        const [existing] = await connection.execute(
            'SELECT COUNT(*) as count FROM kanban_boards WHERE session_id = ?',
            [userId]
        );

        if (existing[0].count > 0) {
            // console.log(`[KANBAN] Usuario ${userId} ya tiene ${existing[0].count} tableros.`);
            return;
        }

        // Crear 5 tableros por defecto
        const defaultBoards = [
            { name: 'Sin Categoría', color: '#607d8b', order: 0, is_default: 1 },
            { name: 'Clientes', color: '#4caf50', order: 1, is_default: 0 },
            { name: 'Prospectos', color: '#ff9800', order: 2, is_default: 0 },
            { name: 'Nuevos', color: '#2196f3', order: 3, is_default: 0 },
            { name: 'Varios', color: '#9c27b0', order: 4, is_default: 0 }
        ];

        console.log(`[KANBAN] Creando ${defaultBoards.length} tableros por defecto para usuario ${userId}...`);

        for (const board of defaultBoards) {
            const boardId = `board_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await connection.execute(
                'INSERT INTO kanban_boards (id, session_id, name, color, board_order, is_default) VALUES (?, ?, ?, ?, ?, ?)',
                [boardId, userId, board.name, board.color, board.order, board.is_default]
            );
        }

        console.log(`[KANBAN] ✅ Tableros por defecto creados exitosamente para usuario ${userId}`);

    } catch (error) {
        console.error(`[KANBAN] Error creando tableros por defecto:`, error);
    } finally {
        connection.release();
    }
}

module.exports = { createDefaultKanbanBoards };
