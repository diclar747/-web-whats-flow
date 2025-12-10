const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/permissions');

module.exports = function (app, pool) {
    // Middleware para verificar que sea Super Admin (595994854167) o Admin
    // Para planes, solo Super Admin debería poder crear/editar? El usuario dijo "el super admin es el que se conecta con el 595994854167".
    // "dentro de panel admin vamos crear los planes precios" -> Solo accesible por Super Admin.

    const requireSuperAdmin = async (req, res, next) => {
        const user = req.user;
        if (user && (user.phone === '595994854167' || user.email?.includes('595994854167') || user.is_super_admin)) {
            next();
        } else {
            res.status(403).json({ success: false, error: 'Acceso denegado: Se requiere Super Admin' });
        }
    };

    // GET /api/plans - Listar todos los planes
    app.get('/api/plans', authenticateToken, async (req, res) => {
        try {
            const connection = await pool.getConnection();
            try {
                const [plans] = await connection.execute('SELECT * FROM plans ORDER BY price ASC');
                res.json({ success: true, plans });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error fetching plans:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo planes' });
        }
    });

    // POST /api/plans - Crear plan
    app.post('/api/plans', authenticateToken, requireSuperAdmin, async (req, res) => {
        const { name, description, price, modules, max_agents, max_sessions, max_channels, max_messages, bot_enabled, api_enabled } = req.body;

        if (!name || price === undefined) {
            return res.status(400).json({ success: false, error: 'Nombre y precio son requeridos' });
        }

        try {
            const connection = await pool.getConnection();
            try {
                const [result] = await connection.execute(`
                    INSERT INTO plans (name, description, price, modules, max_agents, max_sessions, max_channels, max_messages, bot_enabled, api_enabled)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    name,
                    description,
                    price,
                    JSON.stringify(modules || []),
                    max_agents || 1,
                    max_sessions || 1,
                    max_channels || 1,
                    max_messages || 1000,
                    bot_enabled || false,
                    api_enabled || false
                ]);

                res.json({ success: true, message: 'Plan creado', id: result.insertId });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error creating plan:', error);
            res.status(500).json({ success: false, error: 'Error creando plan' });
        }
    });

    // PUT /api/plans/:id - Editar plan
    app.put('/api/plans/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
        const { id } = req.params;
        const { name, description, price, modules, max_agents, max_sessions, max_channels, max_messages, bot_enabled, api_enabled } = req.body;

        try {
            const connection = await pool.getConnection();
            try {
                await connection.execute(`
                    UPDATE plans 
                    SET name = ?, description = ?, price = ?, modules = ?, max_agents = ?, max_sessions = ?, max_channels = ?, max_messages = ?, bot_enabled = ?, api_enabled = ?
                    WHERE id = ?
                `, [
                    name,
                    description,
                    price,
                    JSON.stringify(modules || []),
                    max_agents,
                    max_sessions,
                    max_channels,
                    max_messages,
                    bot_enabled,
                    api_enabled,
                    id
                ]);

                res.json({ success: true, message: 'Plan actualizado' });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error updating plan:', error);
            res.status(500).json({ success: false, error: 'Error actualizando plan' });
        }
    });

    // DELETE /api/plans/:id - Eliminar plan
    app.delete('/api/plans/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
        const { id } = req.params;

        try {
            const connection = await pool.getConnection();
            try {
                // Verificar si hay usuarios usando este plan
                const [users] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE plan_id = ?', [id]);
                if (users[0].count > 0) {
                    return res.status(400).json({ success: false, error: 'No se puede eliminar: Hay usuarios asignados a este plan' });
                }

                await connection.execute('DELETE FROM plans WHERE id = ?', [id]);
                res.json({ success: true, message: 'Plan eliminado' });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error deleting plan:', error);
            res.status(500).json({ success: false, error: 'Error eliminando plan' });
        }
    });
};
