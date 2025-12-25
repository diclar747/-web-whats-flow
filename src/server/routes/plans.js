const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireSuperAdmin } = require('../auth-utils');
const { requireAdmin } = require('../middleware/permissions');

module.exports = function (app, pool) {
    // Middleware para verificar que sea Super Admin (595994854167) o Admin
    // Para planes, solo Super Admin debería poder crear/editar? El usuario dijo "el super admin es el que se conecta con el 595994854167".
    // "dentro de panel admin vamos crear los planes precios" -> Solo accesible por Super Admin.


    // GET /api/plans - Listar todos los planes (sin autenticación requerida)
    app.get('/api/plans', async (req, res) => {
        try {
            const connection = await pool.getConnection();
            try {
                const [plans] = await connection.execute(`
                    SELECT id, name, name as plan_name, name as plan_display_name, description, price, 
                           max_agents, max_agents as max_users, 
                           max_sessions, max_channels, 
                           max_messages, max_messages as max_messages_per_month,
                           100 as max_campaigns, 10000 as max_contacts, 30 as duration_days,
                           bot_enabled, api_enabled, 'active' as status
                    FROM plans ORDER BY price ASC
                `);
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
        let {
            name, plan_name,
            description, plan_display_name,
            price,
            modules,
            max_agents, max_users,
            max_sessions,
            max_channels,
            max_messages, max_messages_per_month,
            bot_enabled,
            api_enabled
        } = req.body;

        // Normalizar nombres de campos para compatibilidad con diferentes frontends
        const finalName = name || plan_name;
        const finalDescription = description || plan_display_name;
        const finalMaxAgents = max_agents || max_users || 1;
        const finalMaxMessages = max_messages || max_messages_per_month || 1000;

        if (!finalName || price === undefined) {
            return res.status(400).json({ success: false, error: 'Nombre y precio son requeridos' });
        }

        try {
            const connection = await pool.getConnection();
            try {
                const [result] = await connection.execute(`
                    INSERT INTO plans (name, description, price, modules, max_agents, max_sessions, max_channels, max_messages, bot_enabled, api_enabled)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    finalName,
                    finalDescription,
                    price,
                    JSON.stringify(modules || []),
                    finalMaxAgents,
                    max_sessions || finalMaxAgents,
                    max_channels || 1,
                    finalMaxMessages,
                    bot_enabled ? 1 : 0,
                    api_enabled ? 1 : 0
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
        let {
            name, plan_name,
            description, plan_display_name,
            price,
            modules,
            max_agents, max_users,
            max_sessions,
            max_channels,
            max_messages, max_messages_per_month,
            bot_enabled,
            api_enabled
        } = req.body;

        // Normalizar nombres de campos
        const finalName = name || plan_name;
        const finalDescription = description || plan_display_name;
        const finalMaxAgents = max_agents || max_users;
        const finalMaxMessages = max_messages || max_messages_per_month;

        try {
            const connection = await pool.getConnection();
            try {
                await connection.execute(`
                    UPDATE plans 
                    SET name = ?, description = ?, price = ?, modules = ?, max_agents = ?, max_sessions = ?, max_channels = ?, max_messages = ?, bot_enabled = ?, api_enabled = ?
                    WHERE id = ?
                `, [
                    finalName,
                    finalDescription,
                    price,
                    JSON.stringify(modules || []),
                    finalMaxAgents,
                    max_sessions || finalMaxAgents,
                    max_channels,
                    finalMaxMessages,
                    bot_enabled ? 1 : 0,
                    api_enabled ? 1 : 0,
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
