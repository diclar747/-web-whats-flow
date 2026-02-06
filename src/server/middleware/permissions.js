const jwt = require('jsonwebtoken');

/**
 * Middleware para verificar permisos de agente
 * @param {string} module - Módulo del sistema (chat, campaign, calendar, etc.)
 * @param {string} action - Acción requerida (view, create, edit, delete)
 */
function checkPermission(module, action) {
    return async (req, res, next) => {
        try {
            // Obtener token
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'No autorizado' 
                });
            }

            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Si es super admin, permitir TODO
            if (decoded.email === '595994854167@whatsapp.local' || 
                decoded.email === '595994854167' ||
                decoded.phone === '595994854167' ||
                decoded.is_super_admin === true) {
                req.user = decoded;
                return next();
            }

            // Si es admin normal, verificar si es admin
            const pool = req.app.get('pool');
            if (!pool) {
                return res.status(503).json({ 
                    success: false, 
                    error: 'Servicio de base de datos no disponible' 
                });
            }

            const connection = await pool.getConnection();
            try {
                // Buscar por id O email y verificar is_super_admin
                const [users] = await connection.execute(
                    'SELECT id, is_super_admin, is_admin FROM users WHERE id = ? OR email = ?',
                    [decoded.id, decoded.email]
                );

                if (users.length > 0) {
                    // Si es super admin, permitir TODO
                    if (users[0].is_super_admin) {
                        req.user = decoded;
                        return next();
                    }
                    
                    // Si es admin normal, permitir acceso
                    if (users[0].is_admin) {
                        req.user = decoded;
                        return next();
                    }
                }

                // Si no es admin, verificar si es agente con permisos
                if (decoded.type === 'agent') {
                    // Verificar permisos del agente
                    const columnName = `can_${action}`;
                    const [permissions] = await connection.execute(`
                        SELECT COUNT(*) as has_permission
                        FROM agent_permissions ap
                        INNER JOIN permissions p ON ap.permission_id = p.id
                        WHERE ap.agent_id = ? 
                        AND p.module = ? 
                        AND ap.${columnName} = 1
                    `, [decoded.id, module]);

                    const hasPermission = permissions[0].has_permission > 0;

                    if (!hasPermission) {
                        return res.status(403).json({
                            success: false,
                            error: `No tienes permiso para ${action} en el módulo ${module}`,
                            requiredPermission: { module, action }
                        });
                    }

                    req.user = decoded;
                    return next();
                }

                // Usuario normal sin permisos de agente
                return res.status(403).json({
                    success: false,
                    error: 'No tienes permisos para realizar esta acción'
                });

            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error verificando permisos:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Error verificando permisos' 
            });
        }
    };
}

/**
 * Middleware para verificar si el usuario es admin (super admin o admin normal)
 */
function requireAdmin(req, res, next) {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'No autorizado' 
                });
            }

            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Si es super admin
            if (decoded.email === '595994854167@whatsapp.local' || 
                decoded.email === '595994854167' ||
                decoded.phone === '595994854167' ||
                decoded.is_super_admin === true) {
                req.user = decoded;
                return next();
            }

            const pool = req.app.get('pool');
            if (!pool) {
                return res.status(503).json({ 
                    success: false, 
                    error: 'Servicio de base de datos no disponible' 
                });
            }

            const connection = await pool.getConnection();
            try {
                const [users] = await connection.execute(
                    'SELECT id, is_super_admin, is_admin FROM users WHERE id = ? OR email = ?',
                    [decoded.id, decoded.email]
                );

                if (users.length > 0) {
                    // Si es super admin, permitir TODO
                    if (users[0].is_super_admin) {
                        req.user = decoded;
                        return next();
                    }
                    
                    // Si es admin normal, permitir acceso
                    if (users[0].is_admin) {
                        req.user = decoded;
                        return next();
                    }
                }

                req.user = decoded;
                next();
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error verificando admin:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Error verificando permisos de administrador' 
            });
        }
    };
}

/**
 * Obtener todos los permisos de un agente
 */
async function getAgentPermissions(agentId, pool) {
    if (!pool) {
        throw new Error('Pool de base de datos no disponible');
    }

    const connection = await pool.getConnection();
    try {
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
        `, [agentId]);

        // Organizar permisos por módulo
        const permissionsByModule = {};
        permissions.forEach(perm => {
            if (!permissionsByModule[perm.module]) {
                permissionsByModule[perm.module] = {
                    view: false,
                    create: false,
                    edit: false,
                    delete: false
                };
            }
            if (perm.can_view) permissionsByModule[perm.module].view = true;
            if (perm.can_create) permissionsByModule[perm.module].create = true;
            if (perm.can_edit) permissionsByModule[perm.module].edit = true;
            if (perm.can_delete) permissionsByModule[perm.module].delete = true;
        });

        return permissionsByModule;
    } finally {
        connection.release();
    }
}

/**
 * Verificar si un agente tiene un permiso específico
 */
async function hasPermission(agentId, module, action, pool) {
    if (!pool) {
        throw new Error('Pool de base de datos no disponible');
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

        return result[0].has_permission > 0;
    } finally {
        connection.release();
    }
}

module.exports = {
    checkPermission,
    requireAdmin,
    getAgentPermissions,
    hasPermission
};
