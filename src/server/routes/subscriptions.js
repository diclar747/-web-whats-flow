const express = require('express');
const router = express.Router();
const { checkAdmin, checkSubscription } = require('../middleware/subscriptionMiddleware');

// Función para obtener el pool desde el servidor principal
function getPool(req) {
  // Intentar obtener del parent app
  const pool = req.app.get('dbPool') || req.app.parent?.get('dbPool');
  
  // Si no existe, buscar en el scope global del servidor
  if (!pool && global.dbPool) {
    return global.dbPool;
  }
  
  return pool;
}

// Obtener información de planes disponibles
router.get('/plans', async (req, res) => {
  const pool = getPool(req);
  
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }
  
  try {
    const connection = await pool.getConnection();
    
    try {
      const [plans] = await connection.query(
        'SELECT * FROM subscription_plans WHERE status = "active" ORDER BY price ASC'
      );
      
      res.json({ success: true, plans });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ success: false, error: 'Error al obtener planes' });
  }
});

// Crear nuevo plan (solo admin)
router.post('/plans', checkAdmin, async (req, res) => {
  const pool = getPool(req);
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }
  
  try {
    const {
      plan_name,
      plan_display_name,
      duration_days,
      price,
      max_users,
      max_messages_per_month,
      max_campaigns,
      max_contacts
    } = req.body;

    if (!plan_name || !plan_display_name || !duration_days || price === undefined) {
      return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
    }

    const connection = await pool.getConnection();
    try {
      // Verificar si el plan ya existe
      const [existing] = await connection.query(
        'SELECT id FROM subscription_plans WHERE plan_name = ?',
        [plan_name]
      );

      if (existing.length > 0) {
        return res.status(409).json({ success: false, error: 'Ya existe un plan con ese nombre' });
      }

      // Crear el plan
      await connection.query(`
        INSERT INTO subscription_plans (
          plan_name, 
          plan_display_name, 
          duration_days, 
          price, 
          max_users, 
          max_messages_per_month, 
          max_campaigns, 
          max_contacts,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `, [
        plan_name,
        plan_display_name,
        duration_days,
        price,
        max_users || 1,
        max_messages_per_month || 1000,
        max_campaigns || 10,
        max_contacts || 1000
      ]);

      res.json({ success: true, message: 'Plan creado exitosamente' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ success: false, error: 'Error al crear plan' });
  }
});

// Actualizar plan existente (solo admin)
router.put('/plans/:id', checkAdmin, async (req, res) => {
  const pool = getPool(req);
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }
  
  try {
    const { id } = req.params;
    const {
      plan_display_name,
      duration_days,
      price,
      max_users,
      max_messages_per_month,
      max_campaigns,
      max_contacts
    } = req.body;

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(`
        UPDATE subscription_plans 
        SET 
          plan_display_name = ?,
          duration_days = ?,
          price = ?,
          max_users = ?,
          max_messages_per_month = ?,
          max_campaigns = ?,
          max_contacts = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [
        plan_display_name,
        duration_days,
        price,
        max_users,
        max_messages_per_month,
        max_campaigns,
        max_contacts,
        id
      ]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Plan no encontrado' });
      }

      res.json({ success: true, message: 'Plan actualizado exitosamente' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar plan' });
  }
});

// Eliminar plan (solo admin)
router.delete('/plans/:id', checkAdmin, async (req, res) => {
  const pool = getPool(req);
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }
  
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
      // Verificar si hay usuarios usando este plan
      const [plan] = await connection.query('SELECT plan_name FROM subscription_plans WHERE id = ?', [id]);
      
      if (plan.length === 0) {
        return res.status(404).json({ success: false, error: 'Plan no encontrado' });
      }

      const [users] = await connection.query(
        'SELECT COUNT(*) as count FROM users WHERE subscription_plan = ?',
        [plan[0].plan_name]
      );

      if (users[0].count > 0) {
        return res.status(409).json({ 
          success: false, 
          error: `No se puede eliminar. ${users[0].count} usuario(s) tienen este plan asignado` 
        });
      }

      // Marcar como inactivo en lugar de eliminar
      await connection.query(
        'UPDATE subscription_plans SET status = "inactive" WHERE id = ?',
        [id]
      );

      res.json({ success: true, message: 'Plan eliminado exitosamente' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar plan' });
  }
});

// Obtener información de suscripción del usuario actual
router.get('/my-subscription', async (req, res) => {
  const pool = getPool(req);
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }
  try {
    const phone = req.query.phone || req.user?.phone;
    if (!phone) {
      return res.status(401).json({ success: false, error: 'Teléfono no proporcionado' });
    }
    const connection = await pool.getConnection();
    try {
      // Actualizar suscripciones expiradas
      await connection.query(`
        UPDATE users 
        SET subscription_status = 'expired'
        WHERE phone = ? 
        AND subscription_status = 'active' 
        AND subscription_end_date IS NOT NULL
        AND subscription_end_date < NOW()
      `, [phone]);

      const [users] = await connection.query(`
        SELECT 
          id,
          name,
          email,
          phone,
          subscription_plan,
          subscription_status,
          subscription_start_date,
          subscription_end_date,
          subscription_days,
          is_admin,
          DATEDIFF(subscription_end_date, NOW()) as days_remaining
        FROM users 
        WHERE phone = ?
      `, [phone]);

      if (users.length === 0) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      }

      const user = users[0];

      // Obtener información del plan
      const [plans] = await connection.query(
        'SELECT * FROM subscription_plans WHERE plan_name = ?',
        [user.subscription_plan]
      );

      res.json({
        success: true,
        subscription: {
          ...user,
          plan_details: plans[0] || null,
          days_remaining: user.days_remaining > 0 ? user.days_remaining : 0
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ success: false, error: 'Error al obtener suscripción' });
  }
});

// Obtener todos los usuarios con sus suscripciones (solo admin)
router.get('/users', checkAdmin, async (req, res) => {
  console.log('[SUBSCRIPTIONS:/users] query.phone=', req.query?.phone, 'user.id=', req.user?.id);
  const pool = getPool(req);
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }
  try {
    const connection = await pool.getConnection();
    try {
      const [users] = await connection.query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone,
          u.subscription_plan,
          u.subscription_status,
          u.subscription_start_date,
          u.subscription_end_date,
          u.subscription_days,
          u.is_admin,
          u.created_at,
          u.last_login,
          DATEDIFF(u.subscription_end_date, NOW()) as days_remaining,
          sp.plan_display_name,
          sp.price
        FROM users u
        LEFT JOIN subscription_plans sp ON u.subscription_plan COLLATE utf8mb4_unicode_ci = sp.plan_name COLLATE utf8mb4_unicode_ci
        ORDER BY u.is_admin DESC, u.subscription_end_date ASC
      `);
      res.json({ success: true, users });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Error al obtener usuarios' });
  }
});

// Variante POST para permitir enviar phone en body desde el frontend
router.post('/users', checkAdmin, async (req, res) => {
  const pool = getPool(req);
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }
  
  const { phone } = req.body;
  
  try {
    const connection = await pool.getConnection();
    try {
      // Verificar si el usuario es SUPER ADMIN
      const [adminCheck] = await connection.query(
        'SELECT is_super_admin FROM users WHERE phone = ? LIMIT 1',
        [phone]
      );
      
      const isSuperAdmin = adminCheck.length > 0 && adminCheck[0].is_super_admin === 1;
      
      let query;
      let params;
      
      if (isSuperAdmin) {
        // SUPER ADMIN (595994854167) ve TODOS los admins
        query = `
          SELECT 
            u.id,
            u.name,
            u.email,
            u.phone,
            u.role,
            u.subscription_plan,
            u.subscription_status,
            u.subscription_start_date,
            u.subscription_end_date,
            u.subscription_days,
            u.is_admin,
            u.is_super_admin,
            u.admin_phone,
            u.created_at,
            u.last_login,
            DATEDIFF(u.subscription_end_date, NOW()) as days_remaining,
            COALESCE(sp.plan_display_name, 
              CASE 
                WHEN u.subscription_plan = 'free' THEN 'Gratis'
                WHEN u.subscription_plan = 'basic' OR u.subscription_plan = 'Basico' THEN 'Plan Basico'
                WHEN u.subscription_plan = 'premium' THEN 'Premium'
                WHEN u.subscription_plan = 'enterprise' THEN 'Empresarial'
                ELSE COALESCE(u.subscription_plan, 'Sin plan')
              END
            ) as plan_display_name,
            COALESCE(sp.price, 0) as price
          FROM users u
          LEFT JOIN subscription_plans sp ON u.subscription_plan COLLATE utf8mb4_unicode_ci = sp.plan_name COLLATE utf8mb4_unicode_ci
          WHERE u.is_admin = 1
          ORDER BY u.is_super_admin DESC, u.created_at DESC
        `;
        params = [];
        console.log(`[SUBSCRIPTIONS] 🔑 SUPER ADMIN ${phone} ve TODOS los admins`);
      } else {
        // Admin normal ve: SU cuenta + usuarios que él registró (admin_phone = su teléfono)
        query = `
          SELECT 
            u.id,
            u.name,
            u.email,
            u.phone,
            u.role,
            u.subscription_plan,
            u.subscription_status,
            u.subscription_start_date,
            u.subscription_end_date,
            u.subscription_days,
            u.is_admin,
            u.is_super_admin,
            u.admin_phone,
            u.created_at,
            u.last_login,
            DATEDIFF(u.subscription_end_date, NOW()) as days_remaining,
            COALESCE(sp.plan_display_name, 
              CASE 
                WHEN u.subscription_plan = 'free' THEN 'Gratis'
                WHEN u.subscription_plan = 'basic' OR u.subscription_plan = 'Basico' THEN 'Plan Basico'
                WHEN u.subscription_plan = 'premium' THEN 'Premium'
                WHEN u.subscription_plan = 'enterprise' THEN 'Empresarial'
                ELSE COALESCE(u.subscription_plan, 'Sin plan')
              END
            ) as plan_display_name,
            COALESCE(sp.price, 0) as price
          FROM users u
          LEFT JOIN subscription_plans sp ON u.subscription_plan COLLATE utf8mb4_unicode_ci = sp.plan_name COLLATE utf8mb4_unicode_ci
          WHERE u.phone = ? OR u.admin_phone = ?
          ORDER BY u.is_admin DESC, u.created_at DESC
        `;
        params = [phone, phone];
        console.log(`[SUBSCRIPTIONS] Admin normal ${phone} ve su cuenta + usuarios que registró`);
      }
      
      const [users] = await connection.query(query, params);
      
      console.log(`[SUBSCRIPTIONS] Devolviendo ${users.length} usuario(s) para ${phone}`);
      
      res.json({ success: true, users, isSuperAdmin });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching users (POST):', error);
    res.status(500).json({ success: false, error: 'Error al obtener usuarios' });
  }
});

// Activar/Actualizar suscripción de usuario (solo admin)
router.post('/activate', checkAdmin, async (req, res) => {
  const pool = getPool(req);
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }
  try {
    // Aceptar phone del query parameter también
    const phone = req.body.phone || req.query.phone;
    const { userId, planName, planType, days, customEndDate } = req.body;
    
    // Aceptar tanto planName como planType
    const finalPlanName = planName || planType;
    
    if ((!userId && !phone) || !finalPlanName) {
      return res.status(400).json({ success: false, error: 'Se requiere userId o phone, y planName/planType' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [plans] = await connection.query('SELECT * FROM subscription_plans WHERE plan_name = ?', [finalPlanName]);
      if (plans.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, error: 'Plan no encontrado' });
      }
      const plan = plans[0];
      const subscriptionDays = days || plan.duration_days;
      const startDate = new Date();
      const endDate = customEndDate ? new Date(customEndDate) : new Date(startDate.getTime() + subscriptionDays * 24 * 60 * 60 * 1000);
      let userQuery = 'SELECT id FROM users WHERE ';
      let userParams = [];
      if (userId) { userQuery += 'id = ?'; userParams.push(userId); } else { userQuery += 'phone = ?'; userParams.push(phone); }
      const [users] = await connection.query(userQuery, userParams);
      if (users.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      }
      const targetUserId = users[0].id;
      await connection.query(`
        UPDATE users SET 
          subscription_plan = ?,
          subscription_status = 'active',
          subscription_start_date = ?,
          subscription_end_date = ?,
          subscription_days = ?
        WHERE id = ?
      `, [finalPlanName, startDate, endDate, subscriptionDays, targetUserId]);
      const adminId = req.user?.id || null;
      await connection.query(`
        INSERT INTO subscription_history 
        (user_id, plan_name, start_date, end_date, days, price, status, activated_by)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
      `, [targetUserId, finalPlanName, startDate, endDate, subscriptionDays, plan.price, adminId]);
      await connection.commit();
      res.json({ success: true, message: 'Suscripción activada exitosamente', subscription: { userId: targetUserId, plan: finalPlanName, startDate, endDate, days: subscriptionDays } });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error activating subscription:', error);
    res.status(500).json({ success: false, error: 'Error al activar suscripción' });
  }
});

// Desactivar suscripción (solo admin)
router.post('/deactivate', checkAdmin, async (req, res) => {
  const pool = getPool(req);
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }
  try {
    const { userId, phone } = req.body;
    if (!userId && !phone) {
      return res.status(400).json({ success: false, error: 'Se requiere userId o phone' });
    }
    const connection = await pool.getConnection();
    try {
      let query = 'UPDATE users SET subscription_status = "cancelled", subscription_end_date = NOW() WHERE ';
      let params = [];
      if (userId) { query += 'id = ?'; params.push(userId); } else { query += 'phone = ?'; params.push(phone); }
      const [result] = await connection.query(query, params);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      }
      res.json({ success: true, message: 'Suscripción desactivada exitosamente' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deactivating subscription:', error);
    res.status(500).json({ success: false, error: 'Error al desactivar suscripción' });
  }
});

// Obtener historial de suscripciones (solo admin)
router.get('/history/:userId', checkAdmin, async (req, res) => {
  const pool = getPool(req);
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }
  try {
    const { userId } = req.params;
    const connection = await pool.getConnection();
    try {
      const [history] = await connection.query(`
        SELECT
          sh.*,
          u.name as user_name,
          admin.name as activated_by_name
        FROM subscription_history sh
        LEFT JOIN users u ON sh.user_id = u.id
        LEFT JOIN users admin ON sh.activated_by = admin.id
        WHERE sh.user_id = ?
        ORDER BY sh.created_at DESC
      `, [userId]);
      res.json({ success: true, history });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, error: 'Error al obtener historial' });
  }
});

// Eliminar suscripción (solo admin)
router.delete('/:id', checkAdmin, async (req, res) => {
  const pool = getPool(req);
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
      // Verificar que la suscripción exista
      const [subscriptions] = await connection.query(
        'SELECT * FROM subscription_history WHERE id = ?',
        [id]
      );

      if (subscriptions.length === 0) {
        return res.status(404).json({ success: false, error: 'Suscripción no encontrada' });
      }

      // Eliminar la suscripción
      await connection.query('DELETE FROM subscription_history WHERE id = ?', [id]);

      res.json({ success: true, message: 'Suscripción eliminada exitosamente' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar suscripción' });
  }
});

module.exports = router;
