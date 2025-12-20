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

// Función para obtener las sesiones de WhatsApp
function getSessions(req) {
  return req.app.get('whatsappSessions') || global.whatsappSessions || new Map();
}

// Función para enviar mensaje de bienvenida al activar plan
async function sendWelcomeMessage(phone, planName, days) {
  try {
    const sessions = global.whatsappSessions || new Map();

    // Buscar la sesión activa del cliente
    let clientSession = null;
    for (const [sessionId, sessionData] of sessions.entries()) {
      if (sessionData.phoneNumber === phone && sessionData.isConnected) {
        clientSession = sessionData;
        break;
      }
    }

    if (!clientSession || !clientSession.sock) {
      console.log(`[WELCOME-MSG] ⚠️ No hay sesión activa para ${phone}, buscando admin para enviar...`);

      // Buscar sesión del admin para enviar el mensaje
      const adminPhone = '595994854167';
      for (const [sessionId, sessionData] of sessions.entries()) {
        if (sessionData.phoneNumber === adminPhone && sessionData.isConnected) {
          clientSession = sessionData;
          break;
        }
      }

      if (!clientSession || !clientSession.sock) {
        console.log(`[WELCOME-MSG] ⚠️ No hay sesión activa del admin, no se puede enviar mensaje`);
        return false;
      }
    }

    // Mensajes creativos según el plan
    const messages = {
      basic: `🎉 ¡FELICIDADES! 🎉

✨ Tu Plan BÁSICO ha sido activado exitosamente ✨

🚀 ¡Gracias por confiar en nosotros! 

📋 Detalles de tu plan:
• Plan: Básico
• Duración: ${days} días
• Estado: ✅ ACTIVO

💡 Ahora puedes disfrutar de todas las funcionalidades básicas de WhatsFlow.

¿Necesitas ayuda? Estamos aquí para ti 🤝

¡Bienvenido a WhatsFlow! 💙`,

      standard: `🎊 ¡EXCELENTE ELECCIÓN! 🎊

⭐ Tu Plan ESTÁNDAR ha sido activado con éxito ⭐

🙌 ¡Muchas gracias por tu preferencia!

📋 Detalles de tu plan:
• Plan: Estándar
• Duración: ${days} días
• Estado: ✅ ACTIVO

🎯 Ahora tienes acceso a:
✅ Todas las funciones básicas
✅ Campañas avanzadas
✅ Más contactos y mensajes
✅ Soporte prioritario

💪 ¡Estás listo para llevar tu negocio al siguiente nivel!

¿Preguntas? Contáctanos cuando quieras 📞

¡Bienvenido a WhatsFlow! 🚀`,

      premium: `🏆 ¡BIENVENIDO AL PLAN PREMIUM! 🏆

👑 Tu Plan PREMIUM ha sido activado exitosamente 👑

🌟 ¡Gracias por elegirnos como tu socio tecnológico!

📋 Detalles de tu plan:
• Plan: Premium
• Duración: ${days} días
• Estado: ✅ ACTIVO

💎 Tienes acceso ILIMITADO a:
✅ TODAS las funcionalidades
✅ Campañas ilimitadas
✅ Contactos sin límite
✅ Bot IA avanzado
✅ API personalizada
✅ Soporte VIP 24/7
✅ Asesoría personalizada

🎁 ¡Y muchos beneficios exclusivos más!

🔥 ¡Prepárate para transformar tu negocio!

Tu éxito es nuestro éxito 💪

¡Bienvenido a la experiencia Premium de WhatsFlow! 🎯`,

      pro: `🚀 ¡PLAN PRO ACTIVADO! 🚀

💼 Tu Plan PROFESIONAL está listo para usar 💼

🎯 ¡Gracias por confiar en nuestra plataforma!

📋 Detalles de tu plan:
• Plan: Profesional
• Duración: ${days} días
• Estado: ✅ ACTIVO

⚡ Funcionalidades PRO desbloqueadas:
✅ Multi-agentes
✅ Campañas automatizadas
✅ Gestión avanzada de contactos
✅ Reportes detallados
✅ Integraciones premium
✅ Soporte preferencial

🎓 ¿Necesitas capacitación? ¡Te ayudamos!

📈 ¡Impulsa tu negocio con WhatsFlow Pro!

Estamos contigo en cada paso 🤝

¡Bienvenido! 💙`
    };

    // Obtener el mensaje según el plan (default: basic)
    const planKey = planName.toLowerCase().replace(/\s+/g, '_');
    const message = messages[planKey] || messages.basic.replace('BÁSICO', planName.toUpperCase()).replace('Básico', planName);

    // Enviar mensaje al cliente
    const jid = `${phone}@s.whatsapp.net`;
    await clientSession.sock.sendMessage(jid, { text: message });

    console.log(`[WELCOME-MSG] ✅ Mensaje de bienvenida enviado a ${phone} para plan ${planName}`);
    return true;

  } catch (error) {
    console.error(`[WELCOME-MSG] ❌ Error enviando mensaje de bienvenida:`, error);
    return false;
  }
}

// ⚠️ RUTA DE PRUEBA - Para verificar que el router funciona
router.get('/test', (req, res) => {
  console.log('[SUBSCRIPTIONS] ✅ Test route called');
  res.json({ success: true, message: 'Router is working!' });
});

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
      max_contacts,
      max_channels,
      bot_enabled,
      api_enabled
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
          max_channels,
          bot_enabled,
          api_enabled,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `, [
        plan_name,
        plan_display_name,
        duration_days,
        price,
        max_users || 1,
        max_messages_per_month || 1000,
        max_campaigns || 10,
        max_contacts || 1000,
        max_channels || 1,
        bot_enabled !== undefined ? bot_enabled : true,
        api_enabled !== undefined ? api_enabled : true
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
      max_contacts,
      max_channels,
      bot_enabled,
      api_enabled
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
          max_channels = ?,
          bot_enabled = ?,
          api_enabled = ?,
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
        max_channels,
        bot_enabled,
        api_enabled,
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
  console.log('[SUBSCRIPTIONS] 🔍 GET /my-subscription llamado, query:', req.query);
  const pool = getPool(req);
  console.log('[SUBSCRIPTIONS] 🔍 Pool obtenido:', !!pool);
  if (!pool) {
    console.log('[SUBSCRIPTIONS] ❌ Pool no disponible');
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }
  try {
    // ✅ Verificar si es super admin desde JWT PRIMERO
    let isSuperAdminFromJWT = false;
    let userEmailFromJWT = null;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'whatsflow_jwt_secret');
        userEmailFromJWT = decoded.email;
        if (decoded.role === 'super_admin' || decoded.role === 'superadmin') {
          isSuperAdminFromJWT = true;
          console.log('[SUBSCRIPTIONS] 👑 Super Admin detectado desde JWT:', userEmailFromJWT);
        }
      } catch (jwtErr) {
        console.log('[SUBSCRIPTIONS] ⚠️ JWT inválido:', jwtErr.message);
      }
    }

    const rawInput = (req.query.phone || req.query.sessionId || req.headers['x-session-id'] || req.headers['x-session-token'] || req.user?.phone || '').toString();
    let phone = rawInput.includes(':') ? rawInput.split(':')[0] : rawInput; // normalizar 595xxx:1 -> 595xxx
    console.log('[SUBSCRIPTIONS] 🔍 Phone/Session (sanitized):', phone);

    let sessionIdCandidate = null;

    // Si parece sessionId (hash largo, no numérico), intentar resolver número desde user_sessions
    if (phone && phone.length > 12 && /[a-zA-Z]/.test(phone)) {
      sessionIdCandidate = phone;
      phone = '';
    }

    const connection = await pool.getConnection();
    try {
      // Resolver phone desde sessionId si no se obtuvo
      if (!phone && sessionIdCandidate) {
          const [sessionLookup] = await connection.execute(
            'SELECT phone FROM user_sessions WHERE session_id = ? LIMIT 1',
            [sessionIdCandidate]
          );
          if (sessionLookup.length > 0) {
            phone = sessionLookup[0].phone;
          }
      }

      // ✅ Super admin NO necesita phone
      if (!phone && !isSuperAdminFromJWT) {
        connection.release();
        return res.status(401).json({ success: false, error: 'Teléfono no proporcionado' });
      }

      // Si es super admin sin phone, devolver suscripción enterprise por defecto
      if (isSuperAdminFromJWT && !phone) {
        console.log('[SUBSCRIPTIONS] 👑 Super Admin sin phone, devolviendo suscripción enterprise');
        connection.release();
        return res.json({
          success: true,
          subscription: {
            phone: userEmailFromJWT,
            subscription_status: 'active',
            subscription_plan: 'enterprise',
            subscription_start_date: new Date(),
            subscription_end_date: new Date('2099-12-31'),
            days_remaining: 99999,
            is_admin: true,
            is_super_admin: true,
            plan_features: {
              max_contacts: 999999,
              max_groups: 999999,
              max_campaigns: 999999,
              max_chatbots: 999999,
              max_agents: 999999,
              max_whatsapp_lines: 999999
            }
          }
        });
      }

      // Verificar si el phone corresponde a un usuario y si es super admin
      let isSuperAdmin = false;
      let effectivePhone = phone;

      try {
        const [userRows] = await connection.execute(
          'SELECT phone, is_super_admin FROM users WHERE phone = ? OR email = ? LIMIT 1',
          [phone, phone]
        );
        if (userRows.length > 0) {
          effectivePhone = userRows[0].phone || effectivePhone;
          isSuperAdmin = !!userRows[0].is_super_admin;
        }
      } catch (uErr) {
        console.log('[SUBSCRIPTIONS] ⚠️ No se pudo verificar usuario:', uErr.message);
      }

      // Aceptar tanto número como sessionId; no forzar resolución si ya es sessionId
      if ((!effectivePhone || effectivePhone.length < 6) && phone) {
        const [sessionLookup] = await connection.execute(
          'SELECT session_id FROM user_sessions WHERE session_id = ? LIMIT 1',
          [phone]
        );
        if (sessionLookup.length > 0) {
          effectivePhone = sessionLookup[0].session_id;
        }
      }

      console.log('[SUBSCRIPTIONS] 🔍 effectivePhone:', effectivePhone, 'isSuperAdmin:', isSuperAdmin);

      if (!effectivePhone) {
        return res.status(401).json({ success: false, error: 'Teléfono no proporcionado' });
      }

      // Primero buscar en user_sessions (aceptando phone o sessionId)
      const [userSessions] = await connection.query(`
        SELECT
          session_id,
          phone,
          created_at,
          last_connection_time,
          subscription_plan,
          subscription_status,
          subscription_start_date,
          subscription_end_date,
          subscription_days,
          plan_id,
          messages_sent_this_month,
          messages_scheduled,
          messages_personalized,
          messages_api,
          messages_chatbot
        FROM user_sessions
        WHERE (phone = ? OR session_id = ?) AND is_active = 1
        LIMIT 1
      `, [effectivePhone, effectivePhone]);

      if (userSessions.length > 0) {
        const session = userSessions[0];

        console.log('[SUBSCRIPTIONS] ✅ Usuario encontrado en user_sessions:', effectivePhone, 'Super Admin:', isSuperAdmin);

        // Si es Super Admin, retornar plan ilimitado
        if (isSuperAdmin) {
          return res.json({
            success: true,
            subscription: {
              phone: effectivePhone,
              subscription_plan: 'enterprise',
              subscription_status: 'active',
              subscription_start_date: session.created_at,
              subscription_end_date: null,
              subscription_days: 999999,
              is_admin: true,
              is_super_admin: true,
              days_remaining: 999999,
              plan_details: {
                plan_name: 'enterprise',
                plan_display_name: 'Plan Administrador',
                duration_days: 999999,
                price: 0,
                max_users: 999999,
                max_messages_per_month: 999999,
                messages_sent_this_month: session.messages_sent_this_month || 0,
                messages_scheduled: session.messages_scheduled || 0,
                messages_personalized: session.messages_personalized || 0,
                messages_api: session.messages_api || 0,
                messages_chatbot: session.messages_chatbot || 0,
                max_campaigns: 999999,
                max_contacts: 999999,
                max_channels: 999999,
                bot_enabled: true,
                api_enabled: true
              }
            }
          });
        }

        // Para usuarios regulares en user_sessions, verificar si tienen suscripción activa
        if (session.subscription_plan && session.subscription_status === 'active') {
          // Tiene un plan activo, buscar detalles del plan
          const [planDetails] = await connection.query(
            'SELECT * FROM plans WHERE name = ?',
            [session.subscription_plan]
          );

          const plan = planDetails.length > 0 ? planDetails[0] : null;
          const daysRemaining = session.subscription_end_date
            ? Math.ceil((new Date(session.subscription_end_date) - new Date()) / (1000 * 60 * 60 * 24))
            : 0;

          return res.json({
            success: true,
            subscription: {
              phone: session.session_id, // convención: phone lógico = sessionId
              subscription_plan: session.subscription_plan,
              subscription_status: session.subscription_status,
              subscription_start_date: session.subscription_start_date,
              subscription_end_date: session.subscription_end_date,
              subscription_days: session.subscription_days,
              is_admin: false,
              is_super_admin: false,
              days_remaining: daysRemaining,
              plan_details: plan ? {
                plan_name: plan.name,
                plan_display_name: plan.name,
                duration_days: session.subscription_days,
                price: plan.price,
                max_users: plan.max_agents || 0,
                max_messages_per_month: plan.max_messages || 0,
                messages_sent_this_month: session.messages_sent_this_month || 0,
                messages_scheduled: session.messages_scheduled || 0,
                messages_personalized: session.messages_personalized || 0,
                messages_api: session.messages_api || 0,
                messages_chatbot: session.messages_chatbot || 0,
                max_campaigns: 0,
                max_contacts: 0,
                max_channels: plan.max_channels || 0,
                bot_enabled: plan.bot_enabled || false,
                api_enabled: plan.api_enabled || false
              } : null
            }
          });
        }

        // Usuario en user_sessions sin suscripción activa
        console.log('[SUBSCRIPTIONS] ℹ️ Usuario en user_sessions sin plan activo:', effectivePhone);
        return res.json({
          success: true,
          subscription: null
        });
      }

      // Si no está en user_sessions, buscar en users (Agentes)
      await connection.query(`
        UPDATE users 
        SET subscription_status = 'expired'
        WHERE phone = ? 
        AND (subscription_status = 'active' OR subscription_status = 'trial')
        AND subscription_end_date IS NOT NULL
        AND subscription_end_date < NOW()
      `, [effectivePhone]);

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
      `, [effectivePhone]);

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
    } catch (error) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ success: false, error: 'Error al obtener suscripción' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error general fetching subscription:', error);
    res.status(500).json({ success: false, error: 'Error al obtener suscripción' });
  }
});

// Obtener todos los usuarios con sus suscripciones (solo admin)
router.get('/users', checkAdmin, async (req, res) => {
  console.log('[SUBSCRIPTIONS:/users] 🔍 GET /users llamado, query:', req.query, 'user:', req.user?.id);
  console.log('[SUBSCRIPTIONS:/users] query.phone=', req.query?.phone, 'user.id=', req.user?.id);
  const pool = getPool(req);
  console.log('[SUBSCRIPTIONS:/users] 🔍 Pool obtenido:', !!pool);
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
router.post('/users', async (req, res) => {
  console.log('[SUBSCRIPTIONS] 🔍 POST /users llamado, body:', req.body);
  const pool = getPool(req);
  console.log('[SUBSCRIPTIONS] 🔍 Pool obtenido:', !!pool);
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
  }

  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, error: 'Teléfono requerido' });
  }

  try {
    const connection = await pool.getConnection();
    try {
      // PRIMERO: Verificar si quien consulta es SUPER ADMIN en user_sessions
      const [superAdminCheck] = await connection.query(
        'SELECT phone FROM user_sessions WHERE phone = ? AND is_active = 1 LIMIT 1',
        [phone]
      );

      const isSuperAdmin = superAdminCheck.length > 0;
      console.log('[SUBSCRIPTIONS] 🔍 Es Super Admin (user_sessions):', isSuperAdmin);

      let users;

      if (isSuperAdmin) {
        // SUPER ADMIN ve solo clientes de user_sessions (usuarios que se conectan con QR)
        // NO debe ver agentes de la tabla users

        const [clientSessions] = await connection.query(`
          SELECT
            us.phone as phone,
            us.session_id,
            us.device_id,
            us.is_active,
            us.subscription_plan,
            us.subscription_status,
            us.subscription_start_date,
            us.subscription_end_date,
            us.subscription_days,
            us.created_at,
            us.last_connection_time as last_login,
            COALESCE(us.phone, 'Cliente') as name,
            CONCAT(us.phone, '@whats-flow.com') as email,
            DATEDIFF(us.subscription_end_date, NOW()) as days_remaining,
            COALESCE(p.name,
              CASE
                WHEN us.phone = '595994854167' THEN 'Plan Administrador'
                WHEN us.subscription_status = 'active' THEN COALESCE(us.subscription_plan, 'Sin plan')
                ELSE 'Sin plan'
              END
            ) as plan_display_name,
            COALESCE(p.price, 0) as price,
            CASE WHEN us.phone = '595994854167' THEN 1 ELSE 0 END as is_admin,
            CASE WHEN us.phone = '595994854167' THEN 1 ELSE 0 END as is_super_admin
          FROM user_sessions us
          LEFT JOIN plans p ON us.subscription_plan = p.name
          WHERE us.is_active = 1
          ORDER BY
            CASE WHEN us.phone = '595994854167' THEN 0 ELSE 1 END,
            us.subscription_status DESC,
            us.created_at DESC
        `);

        users = clientSessions;
        console.log(`[SUBSCRIPTIONS] 🔑 SUPER ADMIN ${phone} ve: ${clientSessions.length} clientes de user_sessions`);
      } else {
        // Admin normal (de user_sessions) ve solo:
        // - SUS propios agentes (donde admin_phone = su teléfono en tabla users)
        const [agentUsers] = await connection.query(`
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
            0 as is_super_admin,
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
          WHERE u.admin_phone = ?
          ORDER BY u.created_at DESC
        `, [phone]);

        users = agentUsers;
        console.log(`[SUBSCRIPTIONS] 👤 Admin ${phone} ve sus ${users.length} agentes registrados`);
      }

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
    const phone = req.body.phone || req.query.phone || req.body.sessionId;
    const { userId, planName, planType, days, customEndDate } = req.body;

    // Aceptar tanto planName como planType
    const finalPlanName = planName || planType;

    console.log('[ACTIVATE] Intentando activar plan:', { phone, userId, finalPlanName, days });

    if ((!userId && !phone) || !finalPlanName) {
      return res.status(400).json({ success: false, error: 'Se requiere userId o phone, y planName/planType' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Buscar el plan en la tabla 'plans' (tabla correcta)
      const [plansFromPlans] = await connection.query('SELECT * FROM plans WHERE name = ?', [finalPlanName]);

      // Si no se encuentra, buscar en subscription_plans
      let plan = plansFromPlans.length > 0 ? plansFromPlans[0] : null;

      if (!plan) {
        const [plansFromSubscription] = await connection.query('SELECT * FROM subscription_plans WHERE plan_name = ?', [finalPlanName]);
        plan = plansFromSubscription.length > 0 ? plansFromSubscription[0] : null;
      }

      if (!plan) {
        await connection.rollback();
        console.log('[ACTIVATE] Plan no encontrado:', finalPlanName);
        return res.status(404).json({ success: false, error: 'Plan no encontrado' });
      }

      console.log('[ACTIVATE] Plan encontrado:', plan);

      const subscriptionDays = days || plan.duration_days || 30;
      const startDate = new Date();
      const endDate = customEndDate ? new Date(customEndDate) : new Date(startDate.getTime() + subscriptionDays * 24 * 60 * 60 * 1000);

      // PRIMERO: Intentar activar en user_sessions (para usuarios que se conectan con QR)
      if (phone) {
        const [sessions] = await connection.query('SELECT * FROM user_sessions WHERE phone = ?', [phone]);

        if (sessions.length > 0) {
          // Usuario existe en user_sessions, actualizar ahí
          await connection.query(`
            UPDATE user_sessions SET
              subscription_plan = ?,
              subscription_status = 'active',
              subscription_start_date = ?,
              subscription_end_date = ?,
              subscription_days = ?
            WHERE phone = ?
          `, [finalPlanName, startDate, endDate, subscriptionDays, phone]);

          console.log('[ACTIVATE] Plan activado en user_sessions para:', phone);

          await connection.commit();

          // 🎉 Enviar mensaje de bienvenida al cliente
          console.log('[ACTIVATE] 📨 Enviando mensaje de bienvenida a:', phone);
          setTimeout(() => {
            sendWelcomeMessage(phone, finalPlanName, subscriptionDays).catch(err => {
              console.error('[ACTIVATE] Error enviando mensaje de bienvenida:', err);
            });
          }, 2000); // Esperar 2 segundos para que el commit se complete

          return res.json({
            success: true,
            message: 'Suscripción activada exitosamente en user_sessions',
            subscription: { phone, plan: finalPlanName, startDate, endDate, days: subscriptionDays }
          });
        }
      }

      // SEGUNDO: Si no está en user_sessions, buscar en users
      let userQuery = 'SELECT id FROM users WHERE ';
      let userParams = [];
      if (userId) { userQuery += 'id = ?'; userParams.push(userId); } else { userQuery += 'phone = ?'; userParams.push(phone); }
      const [users] = await connection.query(userQuery, userParams);

      if (users.length === 0) {
        await connection.rollback();
        console.log('[ACTIVATE] Usuario no encontrado en users ni en user_sessions:', phone || userId);
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

      console.log('[ACTIVATE] Plan activado en users para userId:', targetUserId);

      const adminId = req.user?.id || null;
      await connection.query(`
        INSERT INTO subscription_history
        (user_id, plan_name, start_date, end_date, days, price, status, activated_by)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
      `, [targetUserId, finalPlanName, startDate, endDate, subscriptionDays, plan.price, adminId]);
      await connection.commit();

      // 🎉 Enviar mensaje de bienvenida al cliente
      console.log('[ACTIVATE] 📨 Enviando mensaje de bienvenida a:', phone);
      setTimeout(() => {
        sendWelcomeMessage(phone, finalPlanName, subscriptionDays).catch(err => {
          console.error('[ACTIVATE] Error enviando mensaje de bienvenida:', err);
        });
      }, 2000); // Esperar 2 segundos para que el commit se complete

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
