const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Helper to get DB pool
function getPool(req) {
    return req.app.get('dbPool') || global.dbPool;
}

// Function to resolve numeric user ID from request user
async function getNumericUserId(req) {
    if (req.user.dbId) return req.user.dbId;
    if (typeof req.user.id === 'number') return req.user.id;
    if (!isNaN(parseInt(req.user.id))) return parseInt(req.user.id);

    // If it's a string like 'admin_595...', resolve from phone
    const pool = getPool(req);
    const connection = await pool.getConnection();
    try {
        const phone = req.user.phone || (req.user.id.startsWith('admin_') ? req.user.id.replace('admin_', '') : null);
        if (phone) {
            const [rows] = await connection.execute('SELECT id FROM users WHERE phone = ? OR admin_phone = ? OR email = ? LIMIT 1', [phone, phone, req.user.email]);
            if (rows.length > 0) return rows[0].id;
        }
    } catch (e) {
        console.error('Error resolving numeric user ID:', e);
    } finally {
        connection.release();
    }
    return null;
}

// --- CATEGORIES ---

router.get('/categories', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Usuario no identificado' });

    try {
        const [rows] = await pool.execute('SELECT * FROM fin_categories WHERE user_id = ? ORDER BY name ASC', [userId]);
        res.json({ success: true, categories: rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/categories', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);
    const { name, type, description } = req.body;

    if (!name || !type) return res.status(400).json({ success: false, error: 'Nombre y tipo son requeridos' });

    try {
        const [result] = await pool.execute(
            'INSERT INTO fin_categories (user_id, name, type, description) VALUES (?, ?, ?, ?)',
            [userId, name, type, description]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/categories/:id', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);
    const { id } = req.params;
    const { name, type, description, status } = req.body;

    try {
        await pool.execute(
            'UPDATE fin_categories SET name = ?, type = ?, description = ?, status = ? WHERE id = ? AND user_id = ?',
            [name, type, description, status, id, userId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/categories/:id', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);
    const { id } = req.params;

    try {
        // Check if has records
        const [records] = await pool.execute('SELECT id FROM fin_records WHERE category_id = ? LIMIT 1', [id]);
        if (records.length > 0) {
            return res.status(400).json({ success: false, error: 'No se puede eliminar una categoría con registros asociados' });
        }
        await pool.execute('DELETE FROM fin_categories WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- BUDGETS ---

router.get('/budgets', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);

    try {
        const [rows] = await pool.execute(`
            SELECT b.*, 
                   c.name as category_name,
                   (SELECT SUM(amount) FROM fin_records WHERE budget_id = b.id AND type = 'expense') as current_spent
            FROM fin_budgets b 
            LEFT JOIN fin_categories c ON b.category_id = c.id
            WHERE b.user_id = ? 
            ORDER BY b.start_date DESC`, [userId]);
        res.json({ success: true, budgets: rows });
    } catch (error) {
        console.error('[MGMT-BUDGETS-GET] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/budgets', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);
    const { name, category_id, start_date, end_date, total_amount, description } = req.body;

    console.log('[MGMT-BUDGETS-POST] userId:', userId, 'user:', req.user?.id, 'role:', req.user?.role);

    if (!userId) {
        return res.status(400).json({ success: false, error: 'No se pudo determinar el ID del usuario' });
    }

    if (!name || !total_amount) {
        return res.status(400).json({ success: false, error: 'Nombre y monto total son requeridos' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO fin_budgets (user_id, name, category_id, start_date, end_date, total_amount, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, name, category_id || null, start_date || null, end_date || null, total_amount, description || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('[MGMT-BUDGETS-POST] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/budgets/:id', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);
    const { id } = req.params;
    const { name, category_id, start_date, end_date, total_amount, description, status } = req.body;

    console.log('[MGMT-BUDGETS-PUT] userId:', userId, 'id:', id);

    if (!userId) {
        return res.status(400).json({ success: false, error: 'No se pudo determinar el ID del usuario' });
    }

    if (!name || !total_amount) {
        return res.status(400).json({ success: false, error: 'Nombre y monto total son requeridos' });
    }

    try {
        await pool.execute(
            'UPDATE fin_budgets SET name = ?, category_id = ?, start_date = ?, end_date = ?, total_amount = ?, description = ?, status = ? WHERE id = ? AND user_id = ?',
            [name, category_id || null, start_date || null, end_date || null, total_amount, description || null, status || 'active', id, userId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('[MGMT-BUDGETS-PUT] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/budgets/:id', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);
    const { id } = req.params;

    console.log('[MGMT-BUDGETS-DELETE] userId:', userId, 'id:', id);

    if (!userId) {
        return res.status(400).json({ success: false, error: 'No se pudo determinar el ID del usuario' });
    }

    try {
        await pool.execute('DELETE FROM fin_budgets WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('[MGMT-BUDGETS-DELETE] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- RECORDS ---

router.get('/records', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);
    const { start_date, end_date, type, category_id, budget_id } = req.query;

    let query = 'SELECT r.*, c.name as category_name, b.name as budget_name FROM fin_records r ';
    query += 'JOIN fin_categories c ON r.category_id = c.id ';
    query += 'LEFT JOIN fin_budgets b ON r.budget_id = b.id ';
    query += 'WHERE r.user_id = ? ';
    const params = [userId];

    if (start_date) { query += 'AND r.record_date >= ? '; params.push(start_date); }
    if (end_date) { query += 'AND r.record_date <= ? '; params.push(end_date); }
    if (type) { query += 'AND r.type = ? '; params.push(type); }
    if (category_id) { query += 'AND r.category_id = ? '; params.push(category_id); }
    if (budget_id) { query += 'AND r.budget_id = ? '; params.push(budget_id); }

    query += 'ORDER BY r.record_date DESC, r.id DESC LIMIT 1000';

    try {
        const [rows] = await pool.execute(query, params);
        res.json({ success: true, records: rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/records', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);
    const { category_id, budget_id, type, amount, description, record_date, payment_method, reference_number } = req.body;

    try {
        const [result] = await pool.execute(
            'INSERT INTO fin_records (user_id, category_id, budget_id, type, amount, description, record_date, payment_method, reference_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, category_id, budget_id || null, type, amount, description, record_date, payment_method, reference_number]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/records/:id', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);
    const { id } = req.params;
    const { category_id, budget_id, type, amount, description, record_date, payment_method, reference_number } = req.body;

    try {
        await pool.execute(
            'UPDATE fin_records SET category_id = ?, budget_id = ?, type = ?, amount = ?, description = ?, record_date = ?, payment_method = ?, reference_number = ? WHERE id = ? AND user_id = ?',
            [category_id, budget_id || null, type, amount, description, record_date, payment_method, reference_number, id, userId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/records/:id', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);
    const { id } = req.params;

    try {
        await pool.execute('DELETE FROM fin_records WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- STATS ---

router.get('/stats', authenticateToken, async (req, res) => {
    const pool = getPool(req);
    const userId = await getNumericUserId(req);
    const { period = 'month' } = req.query; // 'month', 'year'

    try {
        // Summary totals
        const [totals] = await pool.execute(`
            SELECT type, SUM(amount) as total 
            FROM fin_records 
            WHERE user_id = ? 
            GROUP BY type`, [userId]);

        // Grouped by Category
        const [byCategory] = await pool.execute(`
            SELECT c.name as category_name, r.type, SUM(r.amount) as total
            FROM fin_records r
            JOIN fin_categories c ON r.category_id = c.id
            WHERE r.user_id = ?
            GROUP BY c.id, r.type`, [userId]);

        // Grouped by Month (last 12 months)
        const [byMonth] = await pool.execute(`
            SELECT DATE_FORMAT(record_date, '%Y-%m') as month, type, SUM(amount) as total
            FROM fin_records
            WHERE user_id = ? AND record_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
            GROUP BY month, type
            ORDER BY month ASC`, [userId]);

        res.json({
            success: true,
            stats: {
                totals,
                byCategory,
                byMonth
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
