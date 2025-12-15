const mysql = require('mysql2/promise');

// Configuración de la base de datos
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'WhatsFlow2024!',
  database: 'whatsflow'
};

// Middleware para verificar si el usuario tiene un plan activo
const checkSubscription = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.body.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    // Usar el pool compartido del servidor en lugar de crear conexión directa
    const pool = req.app.get('dbPool') || req.app.parent?.get('dbPool') || global.dbPool;
    
    if (!pool) {
      console.error('[checkSubscription] Pool de base de datos no disponible');
      return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
    }

    const connection = await pool.getConnection();
    
    try {
      // Primero verificar si hay suscripciones expiradas
      await connection.query(`
        UPDATE users 
        SET subscription_status = 'expired'
        WHERE id = ? 
        AND (subscription_status = 'active' OR subscription_status = 'trial')
        AND subscription_end_date IS NOT NULL
        AND subscription_end_date < NOW()
      `, [userId]);

      // Obtener información del usuario
      const [users] = await connection.query(
        'SELECT subscription_status, subscription_end_date, subscription_plan, is_admin FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      }

      const user = users[0];

      // Los administradores siempre tienen acceso
      if (user.is_admin) {
        req.user = { ...req.user, ...user };
        return next();
      }

      // Verificar si la suscripción está activa
      if (user.subscription_status !== 'active' && user.subscription_status !== 'trial') {
        return res.status(403).json({
          success: false,
          error: 'Suscripción inactiva',
          message: 'Tu plan ha expirado. Por favor, contacta al administrador para renovar tu suscripción.',
          subscription_status: user.subscription_status,
          subscription_end_date: user.subscription_end_date
        });
      }

      req.user = { ...req.user, ...user };
      next();
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[checkSubscription] Error:', error);
    res.status(500).json({ success: false, error: 'Error al verificar suscripción' });
  }
};

// Middleware para verificar si el usuario es administrador
const checkAdmin = async (req, res, next) => {
  try {
    // Bug fix: cuando se envía userId del usuario objetivo (no admin) en el body para activar su plan,
    // el middleware lo tomaba como identidad del solicitante y rechazaba con 403.
    // Si viene un phone en query/body que coincide con el patrón de admin, usamos ese como identidad de admin
    // y NO el userId del cuerpo (que es targetUserId).
    const incomingBodyUserId = req.body?.userId;
    const phone = req.user?.phone || req.body?.phone || req.query?.phone;
    let userId = req.user?.id;

    // Solo tomar userId del body si no hay teléfono admin explícito
    if (!userId && !phone) {
      userId = incomingBodyUserId;
    }

    console.log('[checkAdmin] raw incomingBodyUserId:', incomingBodyUserId, 'effective userId used for admin check:', userId, 'phone:', phone);

    if (!userId && !phone) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    // Usar el pool compartido del servidor en lugar de crear conexión directa
    const pool = req.app.get('dbPool') || req.app.parent?.get('dbPool') || global.dbPool;
    
    if (!pool) {
      console.error('[checkAdmin] Pool de base de datos no disponible');
      return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
    }

    const connection = await pool.getConnection();

    try {
      const adminPhonePattern = '595994854167';
      let user = null;

      // Primero buscar en user_sessions si tenemos un teléfono
      if (phone) {
        const [sessions] = await connection.query(
          'SELECT phone_number as phone, session_id as id FROM user_sessions WHERE phone_number = ? AND is_active = 1',
          [phone]
        );

        if (sessions.length > 0) {
          user = sessions[0];
          const isAdminByPhone = user.phone && user.phone.startsWith(adminPhonePattern);

          if (isAdminByPhone) {
            console.log('[checkAdmin] ✅ Super Admin encontrado en user_sessions:', phone);
            req.user = { ...req.user, is_admin: true, is_super_admin: true, phone: user.phone, id: user.id };
            return next();
          }
        }
      }

      // Si no se encontró en user_sessions, buscar en users
      let query = 'SELECT id, is_admin, phone FROM users WHERE ';
      let params = [];

      if (phone && phone.startsWith(adminPhonePattern)) {
        query += 'phone = ?';
        params.push(phone);
      } else if (userId) {
        query += 'id = ?';
        params.push(userId);
      } else if (phone) {
        query += 'phone = ?';
        params.push(phone);
      }

      const [users] = await connection.query(query, params);

      if (users.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden acceder a esta función'
        });
      }

      user = users[0];

      // Verificar si es admin por el número de teléfono o por la bandera is_admin
      const isAdminByPhone = user.phone && user.phone.startsWith(adminPhonePattern);

      if (!user.is_admin && !isAdminByPhone) {
        return res.status(403).json({
          success: false,
          error: 'Acceso denegado',
          message: 'Solo los administradores pueden acceder a esta función'
        });
      }

      // Si es admin por teléfono pero no tiene la bandera, actualizarla
      if (isAdminByPhone && !user.is_admin) {
        await connection.query(
          'UPDATE users SET is_admin = TRUE, admin_phone = ? WHERE id = ?',
          [user.phone, user.id]
        );
        console.log('[checkAdmin] ✅ Usuario', phone, 'elevado a admin');
      }

      req.user = { ...req.user, is_admin: true, phone: user.phone, id: user.id };
      next();
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[checkAdmin] Error:', error);
    res.status(500).json({ success: false, error: 'Error al verificar permisos de administrador' });
  }
};

module.exports = {
  checkSubscription,
  checkAdmin
};
