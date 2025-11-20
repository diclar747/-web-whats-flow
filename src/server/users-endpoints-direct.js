// Endpoints para gestión de usuarios y agentes - Versión directa integrada
const bcrypt = require('bcryptjs');

module.exports = function(app, pool) {

    // ==================== GESTIÓN DE USUARIOS ====================

    // Obtener todos los usuarios
    app.get('/api/users', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const { role, department, status } = req.query;
            const connection = await pool.getConnection();

            try {
                let query = 'SELECT id, name, email, role, department, category, status, avatar_url, phone, last_login, created_at FROM users WHERE 1=1';
                const params = [];

                if (role) {
                    query += ' AND role = ?';
                    params.push(role);
                }
                if (department) {
                    query += ' AND department = ?';
                    params.push(department);
                }
                if (status) {
                    query += ' AND status = ?';
                    params.push(status);
                }

                query += ' ORDER BY created_at DESC';

                const [users] = await connection.execute(query, params);
                res.json({ success: true, users });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo usuarios:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo usuarios' });
        }
    });

    // Crear nuevo usuario
    app.post('/api/users', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const { name, email, password, role, department, category, phone } = req.body;

            if (!name || !email || !password) {
                return res.status(400).json({ success: false, error: 'Nombre, email y contraseña son requeridos' });
            }

            const connection = await pool.getConnection();

            try {
                // Verificar si el email ya existe
                const [existing] = await connection.execute(
                    'SELECT id FROM users WHERE email = ?',
                    [email]
                );

                if (existing.length > 0) {
                    return res.status(400).json({ success: false, error: 'El email ya está registrado' });
                }

                // Hash de la contraseña
                const hashedPassword = await bcrypt.hash(password, 10);

                // Insertar usuario
                const [result] = await connection.execute(`
                    INSERT INTO users (name, email, password, role, department, category, phone, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
                `, [name, email, hashedPassword, role || 'agent', department || null, category || null, phone || null]);

                // Obtener el usuario creado
                const [newUser] = await connection.execute(
                    'SELECT id, name, email, role, department, category, status, phone, created_at FROM users WHERE id = ?',
                    [result.insertId]
                );

                console.log(`✅ Usuario creado: ${email} (${role || 'agent'})`);
                res.json({ success: true, user: newUser[0] });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error creando usuario:', error);
            res.status(500).json({ success: false, error: 'Error creando usuario' });
        }
    });

    // ==================== ASIGNACIÓN DE CHATS ====================

    // Obtener asignaciones de chats por sesión
    app.get('/api/chat-assignments/:sessionId', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const { sessionId } = req.params;
            const connection = await pool.getConnection();

            try {
                const [assignments] = await connection.execute(`
                    SELECT
                        ca.id,
                        ca.chat_jid,
                        ca.session_id,
                        ca.user_id,
                        ca.assigned_at,
                        ca.notes,
                        ca.status,
                        c.name as contact_name,
                        c.avatar_url,
                        u.name as agent_name,
                        u.role as agent_role,
                        (SELECT COUNT(*) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id) as message_count,
                        (SELECT MAX(timestamp) FROM messages m WHERE m.chat_jid = ca.chat_jid AND m.session_id = ca.session_id) as last_message_time
                    FROM chat_assignments ca
                    LEFT JOIN contacts c ON ca.chat_jid = c.jid AND ca.session_id = c.session_id
                    LEFT JOIN users u ON ca.user_id = u.id
                    WHERE ca.session_id = ? AND ca.status = 'active'
                    ORDER BY ca.assigned_at DESC
                `, [sessionId]);

                res.json({ success: true, assignments });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo asignaciones de chats:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo asignaciones' });
        }
    });

    // Obtener estadísticas de agentes
    app.get('/api/users/stats', async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({ success: false, error: 'DB service unavailable' });
            }

            const connection = await pool.getConnection();

            try {
                const [stats] = await connection.execute(`
                    SELECT
                        u.id,
                        u.name,
                        u.email,
                        u.role,
                        u.department,
                        COUNT(DISTINCT ca.chat_jid) as assigned_chats,
                        COUNT(DISTINCT m.id) as total_messages_sent,
                        MAX(m.timestamp) as last_message_time
                    FROM users u
                    LEFT JOIN chat_assignments ca ON u.id = ca.user_id AND ca.status = 'active'
                    LEFT JOIN messages m ON ca.chat_jid = m.chat_jid AND ca.session_id = m.session_id AND m.from_me = 1
                    WHERE u.status = 'active'
                    GROUP BY u.id
                    ORDER BY assigned_chats DESC
                `);

                res.json({ success: true, stats });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo estadísticas' });
        }
    });

    console.log('✅ Endpoints de usuarios y asignaciones cargados correctamente desde archivo directo');

}; // Fin del módulo