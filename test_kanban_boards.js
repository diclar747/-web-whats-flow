const mysql = require('mysql2/promise');
require('dotenv').config();

async function testKanbanBoards() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'whatsflow'
    });

    try {
        console.log('🔍 Verificando tableros Kanban para usuario ID 1 (claudio@cnid.com.py)...\n');

        const [boards] = await connection.execute(`
            SELECT
                kb.id,
                kb.session_id,
                kb.name,
                kb.color,
                kb.board_order,
                kb.is_default,
                kb.created_at,
                kb.updated_at,
                COUNT(kc.id) as user_count
            FROM kanban_boards kb
            LEFT JOIN kanban_contacts kc ON kb.id = kc.board_id
            WHERE kb.session_id = ?
            GROUP BY kb.id
            ORDER BY kb.board_order ASC, kb.created_at ASC
        `, [1]);

        console.log(`✅ Total de tableros encontrados: ${boards.length}\n`);

        boards.forEach((board, index) => {
            console.log(`${index + 1}. ${board.name}`);
            console.log(`   ID: ${board.id}`);
            console.log(`   Color: ${board.color}`);
            console.log(`   Orden: ${board.board_order}`);
            console.log(`   Por defecto: ${board.is_default ? 'Sí' : 'No'}`);
            console.log(`   Contactos: ${board.user_count}`);
            console.log(`   Creado: ${board.created_at}`);
            console.log('');
        });

        // Verificar que sean exactamente 5 tableros con los nombres correctos
        const expectedBoards = ['Sin Categoría', 'Clientes', 'Prospectos', 'Nuevos', 'Varios'];
        const actualBoardNames = boards.map(b => b.name);

        console.log('📋 Verificación de tableros esperados:');
        expectedBoards.forEach(name => {
            const exists = actualBoardNames.includes(name);
            console.log(`   ${exists ? '✅' : '❌'} ${name}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

testKanbanBoards();
