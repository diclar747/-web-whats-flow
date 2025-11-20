const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = function(app, pool) {

// ==================== GESTIÓN DE AGENTES CON PRIVILEGIOS ====================

/**
 * Obtener todos los agentes creados por el usuario actual
 * GET /api/agents/list
 */
app.get('/api/agents/list', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const connection = await pool.getConnection();

        try {
            let userPhone = null;

            // Método 1: Intentar con JWT token
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.split(' ')[1];
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'whatsflow_jwt_secret');

                    // Para agentes de tipo 'agent', usar directamente el teléfono del agente
                    if (decoded.type === 'agent' && decoded.id) {
                        const [agents] = await connection.execute(
                            'SELECT phone FROM agents WHERE id = ?',
                            [decoded.id]
                        );

                        if (agents.length > 0) {
                            userPhone = agents[0].phone || decoded.id; // Usar el teléfono si existe, sino el ID
                            console.log('✅ [LIST] Autenticación de agente por JWT exitosa:', userPhone);
                        }
                    }
                    // Para usuarios tipo 'user', obtener el teléfono
                    else if (decoded.type !== 'agent' && decoded.id) {
                        const [users] = await connection.execute(
                            'SELECT phone FROM users WHERE id = ?',
                            [decoded.id]
                        );

                        if (users.length > 0) {
                            userPhone = users[0].phone;
                            console.log('✅ [LIST] Autenticación por JWT exitosa:', userPhone);
                        }
                    }
                } catch (jwtError) {
                    console.log('⚠️ [LIST] JWT inválido, intentando con sessionId:', jwtError.message);
                }
            }

            // Método 2: Intentar con sessionId de query params o body
            if (!userPhone && (req.query.sessionId || req.body.sessionId)) {
                const sessionId = req.query.sessionId || req.body.sessionId;
                const [users] = await connection.execute(
                    'SELECT phone FROM users WHERE phone = ?',
                    [sessionId]
                );

                if (users.length > 0) {
                    userPhone = users[0].phone;
                    console.log('✅ [LIST] Autenticación por sessionId exitosa:', userPhone);
                } else {
                    // También verificar si es un agente con ese sessionId
                    const [agents] = await connection.execute(
                        'SELECT phone FROM agents WHERE id = ?',
                        [sessionId]
                    );

                    if (agents.length > 0) {
                        userPhone = agents[0].phone || sessionId;
                        console.log('✅ [LIST] Autenticación de agente por sessionId exitosa:', userPhone);
                    }
                }
            }

            // Si no se pudo autenticar
            if (!userPhone) {
                connection.release();
                return res.status(401).json({
                    success: false,
                    error: 'No autorizado. Debe iniciar sesión primero.'
                });
            }

            // SOLO mostrar agentes que tienen relación explícita con este admin
            // Esto evita que agentes de otros admins aparezcan en la lista
            const query = `
                SELECT 
                    a.*,
                    aar.admin_phone,
                    COUNT(DISTINCT ap.permission_id) as total_permissions
                FROM agents a
                INNER JOIN agent_admin_relations aar ON a.id = aar.agent_id
                LEFT JOIN agent_permissions ap ON a.id = ap.agent_id
                WHERE aar.admin_phone = ?
                GROUP BY a.id
                ORDER BY a.created_at DESC
            `;
            const params = [userPhone];

            const [agents] = await connection.execute(query, params);
            res.json({ success: true, agents });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error obteniendo agentes:', error);
        res.status(500).json({ success: false, error: 'Error obteniendo agentes' });
    }
});

/**
 * Crear nuevo agente con privilegios
 * POST /api/agents/create
 */
app.post('/api/agents/create', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { name, email, password, phone, permissions, sessionId: userSessionId } = req.body;

        if (!name || !email) {
            return res.status(400).json({ success: false, error: 'Nombre y email son requeridos' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            let adminPhone = null;
            
            // Intentar autenticación por JWT token
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.split(' ')[1];
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'whatsflow_jwt_secret');
                    
                    // Obtener teléfono del admin usando el JWT
                    const [users] = await connection.execute(
                        'SELECT phone FROM users WHERE id = ?',
                        [decoded.id]
                    );
                    
                    if (users.length > 0) {
                        adminPhone = users[0].phone;
                        console.log('✅ Autenticación por JWT exitosa. Admin:', adminPhone);
                    }
                } catch (jwtError) {
                    console.log('⚠️ JWT inválido, intentando con sessionId...');
                }
            }
            
            // Si no hay JWT válido, intentar con sessionId
            if (!adminPhone && userSessionId) {
                const [users] = await connection.execute(
                    'SELECT phone FROM users WHERE phone = ?',
                    [userSessionId]
                );
                
                if (users.length > 0) {
                    adminPhone = users[0].phone;
                    console.log('✅ Autenticación por sessionId exitosa. Admin:', adminPhone);
                }
            }
            
            // Si no se pudo autenticar de ninguna manera
            if (!adminPhone) {
                await connection.rollback();
                connection.release();
                return res.status(401).json({ 
                    success: false, 
                    error: 'No autorizado. Debe iniciar sesión primero.' 
                });
            }

            // Verificar si el email ya existe
            const [existingAgents] = await connection.execute(
                'SELECT id FROM agents WHERE email = ?',
                [email]
            );

            if (existingAgents.length > 0) {
                return res.status(400).json({ success: false, error: 'El email ya está registrado' });
            }

            // Generar ID único para el agente
            const agentId = uuidv4();

            // Hashear contraseña si se proporciona
            let hashedPassword = null;
            if (password) {
                hashedPassword = await bcrypt.hash(password, 12);
            }

            // Crear agente
            await connection.execute(`
                INSERT INTO agents (
                    id, name, email, phone, password, login_type, 
                    status, is_active, created_by, parent_session_id
                ) VALUES (?, ?, ?, ?, ?, ?, 'offline', 1, ?, ?)
            `, [
                agentId,
                name,
                email,
                phone || null,
                hashedPassword,
                password ? 'email' : 'qr',
                decoded.id,
                decoded.session_id || null
            ]);

            // Crear relación admin-agente
            await connection.execute(`
                INSERT INTO agent_admin_relations (admin_phone, agent_id)
                VALUES (?, ?)
            `, [adminPhone, agentId]);

            // Asignar permisos si se proporcionan
            if (permissions && Array.isArray(permissions)) {
                for (const perm of permissions) {
                    await connection.execute(`
                        INSERT INTO agent_permissions (
                            agent_id, permission_id, can_view, can_create, can_edit, can_delete
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                        agentId,
                        perm.permission_id,
                        perm.can_view ? 1 : 0,
                        perm.can_create ? 1 : 0,
                        perm.can_edit ? 1 : 0,
                        perm.can_delete ? 1 : 0
                    ]);
                }
            }

            await connection.commit();

            console.log(`✅ Agente creado: ${email} por admin: ${adminPhone}`);
            res.json({ 
                success: true, 
                agentId,
                message: 'Agente creado exitosamente' 
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error creando agente:', error);
        res.status(500).json({ success: false, error: error.message || 'Error creando agente' });
    }
});

/**
 * Obtener permisos de un agente específico
 * GET /api/agents/:agentId/permissions
 */
app.get('/api/agents/:agentId/permissions', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { agentId } = req.params;
        const connection = await pool.getConnection();

        try {
            const [permissions] = await connection.execute(`
                SELECT 
                    p.id as permission_id,
                    p.name as permission_name,
                    p.description,
                    p.module,
                    COALESCE(ap.can_view, 0) as can_view,
                    COALESCE(ap.can_create, 0) as can_create,
                    COALESCE(ap.can_edit, 0) as can_edit,
                    COALESCE(ap.can_delete, 0) as can_delete
                FROM permissions p
                LEFT JOIN agent_permissions ap ON p.id = ap.permission_id AND ap.agent_id = ?
                ORDER BY p.module, p.name
            `, [agentId]);

            // Agrupar por módulo
            const permissionsByModule = {};
            permissions.forEach(perm => {
                if (!permissionsByModule[perm.module]) {
                    permissionsByModule[perm.module] = [];
                }
                permissionsByModule[perm.module].push(perm);
            });

            res.json({ 
                success: true, 
                permissions,
                permissionsByModule 
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error obteniendo permisos:', error);
        res.status(500).json({ success: false, error: 'Error obteniendo permisos' });
    }
});

/**
 * Actualizar permisos de un agente
 * PUT /api/agents/:agentId/permissions
 */
app.put('/api/agents/:agentId/permissions', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { agentId } = req.params;
        const { permissions } = req.body;

        if (!permissions || !Array.isArray(permissions)) {
            return res.status(400).json({ success: false, error: 'Permisos inválidos' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Eliminar permisos existentes
            await connection.execute(
                'DELETE FROM agent_permissions WHERE agent_id = ?',
                [agentId]
            );

            // Insertar nuevos permisos
            for (const perm of permissions) {
                if (perm.can_view || perm.can_create || perm.can_edit || perm.can_delete) {
                    await connection.execute(`
                        INSERT INTO agent_permissions (
                            agent_id, permission_id, can_view, can_create, can_edit, can_delete
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                        agentId,
                        perm.permission_id,
                        perm.can_view ? 1 : 0,
                        perm.can_create ? 1 : 0,
                        perm.can_edit ? 1 : 0,
                        perm.can_delete ? 1 : 0
                    ]);
                }
            }

            await connection.commit();

            console.log(`✅ Permisos actualizados para agente: ${agentId}`);
            res.json({ 
                success: true, 
                message: 'Permisos actualizados exitosamente' 
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error actualizando permisos:', error);
        res.status(500).json({ success: false, error: 'Error actualizando permisos' });
    }
});

/**
 * Actualizar información de un agente
 * PUT /api/agents/:agentId
 */
app.put('/api/agents/:agentId', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { agentId } = req.params;
        const { name, email, phone, password, is_active, max_concurrent_chats } = req.body;

        const connection = await pool.getConnection();

        try {
            const updates = [];
            const params = [];

            if (name) {
                updates.push('name = ?');
                params.push(name);
            }
            if (email) {
                updates.push('email = ?');
                params.push(email);
            }
            if (phone !== undefined) {
                updates.push('phone = ?');
                params.push(phone);
            }
            if (password) {
                const hashedPassword = await bcrypt.hash(password, 12);
                updates.push('password = ?');
                params.push(hashedPassword);
            }
            if (is_active !== undefined) {
                updates.push('is_active = ?');
                params.push(is_active ? 1 : 0);
            }
            if (max_concurrent_chats !== undefined) {
                updates.push('max_concurrent_chats = ?');
                params.push(max_concurrent_chats);
            }

            if (updates.length === 0) {
                return res.status(400).json({ success: false, error: 'No hay datos para actualizar' });
            }

            params.push(agentId);

            await connection.execute(
                `UPDATE agents SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
                params
            );

            console.log(`✅ Agente actualizado: ${agentId}`);
            res.json({ 
                success: true, 
                message: 'Agente actualizado exitosamente' 
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error actualizando agente:', error);
        res.status(500).json({ success: false, error: 'Error actualizando agente' });
    }
});

/**
 * Eliminar un agente
 * DELETE /api/agents/:agentId
 */
app.delete('/api/agents/:agentId', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { agentId } = req.params;
        const connection = await pool.getConnection();

        try {
            await connection.execute(
                'DELETE FROM agents WHERE id = ?',
                [agentId]
            );

            console.log(`✅ Agente eliminado: ${agentId}`);
            res.json({ 
                success: true, 
                message: 'Agente eliminado exitosamente' 
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error eliminando agente:', error);
        res.status(500).json({ success: false, error: 'Error eliminando agente' });
    }
});

/**
 * Obtener todos los módulos y permisos disponibles
 * GET /api/permissions/modules
 */
app.get('/api/permissions/modules', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const connection = await pool.getConnection();

        try {
            const [permissions] = await connection.execute(`
                SELECT 
                    id as permission_id,
                    name,
                    description,
                    module
                FROM permissions
                ORDER BY module, name
            `);

            // Agrupar por módulo
            const modules = {};
            permissions.forEach(perm => {
                if (!modules[perm.module]) {
                    modules[perm.module] = {
                        name: perm.module,
                        permissions: []
                    };
                }
                modules[perm.module].permissions.push(perm);
            });

            res.json({ 
                success: true, 
                modules: Object.values(modules),
                permissions 
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error obteniendo módulos:', error);
        res.status(500).json({ success: false, error: 'Error obteniendo módulos' });
    }
});

/**
 * Login de agente (con email y contraseña)
 * POST /api/agents/login
 */
app.post('/api/agents/login', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email y contraseña son requeridos' });
        }

        const connection = await pool.getConnection();

        try {
            // Buscar agente por email
            const [agents] = await connection.execute(
                'SELECT * FROM agents WHERE email = ? AND is_active = 1',
                [email]
            );

            if (agents.length === 0) {
                return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
            }

            const agent = agents[0];

            // Verificar contraseña
            if (!agent.password) {
                return res.status(401).json({ success: false, error: 'Este agente no tiene contraseña configurada' });
            }

            const isValidPassword = await bcrypt.compare(password, agent.password);
            if (!isValidPassword) {
                return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
            }

            // Generar token JWT
            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { 
                    id: agent.id, 
                    email: agent.email, 
                    type: 'agent',
                    name: agent.name
                },
                process.env.JWT_SECRET || 'whatsflow_jwt_secret',
                { expiresIn: '24h' }
            );

            // Actualizar última actividad
            await connection.execute(
                'UPDATE agents SET last_activity = NOW(), status = "online" WHERE id = ?',
                [agent.id]
            );

            // Obtener permisos del agente
            const [permissions] = await connection.execute(`
                SELECT 
                    p.module,
                    p.name as permission_name,
                    ap.can_view,
                    ap.can_create,
                    ap.can_edit,
                    ap.can_delete
                FROM agent_permissions ap
                INNER JOIN permissions p ON ap.permission_id = p.id
                WHERE ap.agent_id = ?
            `, [agent.id]);

            const { password: _, ...agentWithoutPassword } = agent;

            console.log(`✅ Agent Login: ${email}`);
            res.json({ 
                success: true, 
                token,
                agent: agentWithoutPassword,
                permissions,
                message: 'Login exitoso'
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error en login de agente:', error);
        res.status(500).json({ success: false, error: 'Error en el proceso de login' });
    }
});

/**
 * Verificar permisos de un agente para una acción específica
 * POST /api/agents/check-permission
 */
app.post('/api/agents/check-permission', async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ success: false, error: 'DB service unavailable' });
        }

        const { agentId, module, action } = req.body; // action: 'view', 'create', 'edit', 'delete'

        if (!agentId || !module || !action) {
            return res.status(400).json({ success: false, error: 'Datos incompletos' });
        }

        const connection = await pool.getConnection();

        try {
            const columnName = `can_${action}`;
            
            const [result] = await connection.execute(`
                SELECT COUNT(*) as has_permission
                FROM agent_permissions ap
                INNER JOIN permissions p ON ap.permission_id = p.id
                WHERE ap.agent_id = ? 
                AND p.module = ? 
                AND ap.${columnName} = 1
            `, [agentId, module]);

            const hasPermission = result[0].has_permission > 0;

            res.json({ 
                success: true, 
                hasPermission,
                module,
                action
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error verificando permisos:', error);
        res.status(500).json({ success: false, error: 'Error verificando permisos' });
    }
});

console.log('✅ Endpoints de gestión de agentes con privilegios cargados');

};
