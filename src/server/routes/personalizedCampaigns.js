const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');
const { resolveToUserId } = require('../helpers/sessionIdResolver');

// Configurar multer para uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads/campaigns');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Crear pool de conexiones a la base de datos
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'whatsflow',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// GET - Obtener todas las campañas de una sesión
router.get('/:sessionId', async (req, res) => {
  try {
    let { sessionId } = req.params;

    // ✅ CRÍTICO: Resolver sessionId a user.id
    sessionId = await resolveToUserId(sessionId);
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID inválido'
      });
    }

    // Verificar que el pool de conexiones esté disponible
    if (!pool) {
      console.error('Pool de conexiones no disponible');
      return res.status(503).json({
        success: false,
        error: 'Servicio de base de datos no disponible'
      });
    }

    const [campaigns] = await pool.execute(
      `SELECT id, session_id as sessionId, name as nombre, message_text as mensaje,
              message_media_url as archivo, contacts, status, created_at as createdAt,
              scheduled_at as scheduledAt,
              progress_total as totalContactos, progress_sent as enviados,
              (progress_total - progress_sent - progress_failed) as pendientes,
              progress_failed as errores
       FROM campaigns
       WHERE session_id = ? AND type = 'personalized'
       ORDER BY created_at DESC`,
      [sessionId]
    );

    // Parsear el JSON de contactos con manejo de errores
    const parsedCampaigns = campaigns.map(c => {
      try {
        // Convertir status del backend a español para el frontend
        let estadoTexto = 'activa';
        if (c.status === 'scheduled') estadoTexto = 'programada';
        else if (c.status === 'completed') estadoTexto = 'completada';
        else if (c.status === 'paused') estadoTexto = 'pausada';
        else if (c.status === 'active') estadoTexto = 'activa';

        return {
          ...c,
          estado: estadoTexto,
          contactos: c.contacts ? JSON.parse(c.contacts) : [],
          archivo: c.archivo || null,
          archivoNombre: c.archivo ? path.basename(c.archivo) : null,
          scheduledAt: c.scheduledAt
        };
      } catch (parseError) {
        console.error(`Error parseando contactos para campaña ${c.id}:`, parseError);
        return {
          ...c,
          estado: 'activa',
          contactos: [],
          archivo: c.archivo || null,
          archivoNombre: c.archivo ? path.basename(c.archivo) : null
        };
      }
    });

    res.json({
      success: true,
      campaigns: parsedCampaigns
    });
  } catch (error) {
    console.error('Error obteniendo campañas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener campañas'
    });
  }
});

// POST - Crear nueva campaña
router.post('/create', upload.single('archivo'), async (req, res) => {
  try {
    const { sessionId, nombre, mensaje, contactos } = req.body;

    if (!sessionId || !nombre || !mensaje || !contactos) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos'
      });
    }

    const parsedContacts = JSON.parse(contactos);
    const campaignId = uuidv4();

    // Determinar el estado inicial (scheduled si tiene fechas futuras, active si es inmediato)
    const hasFutureDates = parsedContacts.some(c => {
      const contactDate = new Date(c.fecha);
      return contactDate > new Date();
    });
    const initialStatus = hasFutureDates ? 'scheduled' : 'active';

    // Insertar en la base de datos
    await pool.execute(
      `INSERT INTO campaigns (
        id, session_id, name, type, status, message_text, 
        message_media_url, contacts, progress_total, progress_sent, progress_failed, created_at
      ) VALUES (?, ?, ?, 'personalized', ?, ?, ?, ?, ?, 0, 0, NOW())`,
      [
        campaignId,
        sessionId,
        nombre,
        initialStatus,
        mensaje,
        req.file ? req.file.path : null,
        JSON.stringify(parsedContacts),
        parsedContacts.length
      ]
    );

    const campaign = {
      id: campaignId,
      sessionId,
      nombre,
      mensaje,
      archivo: req.file ? req.file.path : null,
      archivoNombre: req.file ? req.file.originalname : null,
      contactos: parsedContacts,
      createdAt: new Date().toISOString(),
      estado: initialStatus === 'scheduled' ? 'programada' : 'activa',
      totalContactos: parsedContacts.length,
      enviados: 0,
      pendientes: parsedContacts.filter(c => c.estado === 'pendiente').length,
      errores: 0
    };

    console.log(`✅ Campaña personalizada creada en DB: ${nombre} con ${parsedContacts.length} contactos`);

    res.json({
      success: true,
      campaign
    });
  } catch (error) {
    console.error('Error creando campaña:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST - Verificar y enviar mensajes programados
router.post('/check-scheduled/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessions = req.app.get('whatsappSessions');
    const sessionData = sessions?.get(sessionId);

    if (!sessionData || !sessionData.sock) {
      return res.json({ success: false, error: 'Cliente no conectado', sent: 0 });
    }

    const whatsappClient = sessionData.sock;

    // Obtener configuración de envíos
    const [settings] = await pool.execute(
      `SELECT reminder_days_before, send_hour_start, send_hour_end, 
              interval_min_seconds, interval_max_seconds
       FROM campaign_settings 
       WHERE session_id = ?`,
      [sessionId]
    );

    const config = settings[0] || {
      reminder_days_before: 0,
      send_hour_start: '07:00:00',
      send_hour_end: '18:00:00',
      interval_min_seconds: 60,
      interval_max_seconds: 120
    };

    // Resolver userId para socket
    const { resolveToUserId } = require('../helpers/sessionIdResolver');
    const userId = await resolveToUserId(sessionId);

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const currentHour = currentTime.substring(0, 5); // HH:MM

    // Verificar si estamos dentro del horario permitido
    const startTime = config.send_hour_start.substring(0, 5); // HH:MM
    const endTime = config.send_hour_end.substring(0, 5); // HH:MM

    if (currentHour < startTime || currentHour > endTime) {
      return res.json({
        success: true,
        sent: 0,
        message: `Fuera del horario de envío (${startTime} - ${endTime})`
      });
    }

    let sentCount = 0;

    // Obtener campañas activas y programadas de la sesión desde la base de datos
    const [campaignsFromDB] = await pool.execute(
      `SELECT id, name, message_text, message_media_url, contacts 
       FROM campaigns 
       WHERE session_id = ? AND status IN ('active', 'scheduled') AND type = 'personalized'`,
      [sessionId]
    );

    // Iterar sobre todas las campañas de la sesión
    for (const campaignRow of campaignsFromDB) {
      const campaign = {
        id: campaignRow.id,
        nombre: campaignRow.name,
        mensaje: campaignRow.message_text,
        archivo: campaignRow.message_media_url,
        contactos: JSON.parse(campaignRow.contacts || '[]')
      };

      let campaignUpdated = false;

      for (const contact of campaign.contactos) {
        if (contact.estado !== 'pendiente') continue;

        // Calcular fecha de envío basada en el recordatorio
        const dueDate = new Date(contact.fecha);
        const sendDate = new Date(dueDate);
        sendDate.setDate(sendDate.getDate() - config.reminder_days_before);
        const sendDateStr = sendDate.toISOString().split('T')[0];

        // Verificar si es el día de envío
        if (sendDateStr !== currentDate) continue;

        // Si el contacto tiene hora específica, respetarla
        const contactHour = contact.hora || startTime;

        const shouldSend = contactHour <= currentHour;

        if (shouldSend) {
          console.log(`📅 Enviando mensaje programado: ${contact.nombre} - Fecha vencimiento: ${contact.fecha} - Envío: ${sendDateStr} ${contactHour}`);

          try {
            // Reemplazar variables en el mensaje - usar contact.nombre, no contact.numero
            let personalizedMessage = campaign.mensaje
              .replace(/{nombre}/g, contact.nombre || contact.numero || '')
              .replace(/{dato1}/g, contact.dato1 || '')
              .replace(/{dato2}/g, contact.dato2 || '')
              .replace(/{dato3}/g, contact.dato3 || '')
              .replace(/{fecha}/g, contact.fecha || '');

            // Formatear número
            let phoneNumber = contact.numero.replace(/\D/g, '');
            if (!phoneNumber.endsWith('@s.whatsapp.net')) {
              phoneNumber = `${phoneNumber}@s.whatsapp.net`;
            }

            // Enviar mensaje
            if (campaign.archivo) {
              // Enviar con archivo adjunto
              const mediaBuffer = await fs.readFile(campaign.archivo);
              await whatsappClient.sendMessage(phoneNumber, {
                caption: personalizedMessage,
                image: mediaBuffer
              });
            } else {
              // Enviar solo texto
              await whatsappClient.sendMessage(phoneNumber, {
                text: personalizedMessage
              });
            }

            contact.estado = 'enviado';
            contact.enviadoEn = new Date().toISOString();
            sentCount++;
            campaignUpdated = true;

            // Guardar mensaje en la base de datos para historial
            try {
              const messageId = uuidv4();
              await pool.execute(
                `INSERT INTO messages (
                  id, session_id, chat_jid, sender_jid, from_me, 
                  message_type, text_content, media_url, status, timestamp, is_read
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
                [
                  messageId,
                  sessionId,
                  phoneNumber,
                  whatsappClient.user?.id?.split(':')[0] || sessionId, // Sender JID
                  true, // from_me
                  campaign.archivo ? 'image' : 'text',
                  personalizedMessage,
                  campaign.archivo || null,
                  'sent',
                  true // is_read
                ]
              );
              console.log(`[CAMPAIGN-MSG] Mensaje guardado en historial: ${messageId}`);
            } catch (dbError) {
              console.error('[CAMPAIGN-MSG] Error guardando mensaje en historial:', dbError);
            }

            console.log(`✅ Mensaje enviado a ${contact.nombre} (${contact.numero})`);

            // Esperar tiempo aleatorio entre mensajes según configuración
            const minDelay = (config.interval_min_seconds || 60) * 1000;
            const maxDelay = (config.interval_max_seconds || 120) * 1000;
            const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

            console.log(`⏱️  Esperando ${Math.floor(randomDelay / 1000)} segundos antes del próximo envío...`);
            await new Promise(resolve => setTimeout(resolve, randomDelay));

          } catch (error) {
            console.error(`❌ Error enviando a ${contact.numero}:`, error);
            contact.estado = 'error';
            contact.errorMessage = error.message;
            campaignUpdated = true;
          }
        }
      }

      // Si se actualizó la campaña, guardar cambios en la base de datos
      if (campaignUpdated) {
        const enviados = campaign.contactos.filter(c => c.estado === 'enviado').length;
        const errores = campaign.contactos.filter(c => c.estado === 'error').length;
        const pendientes = campaign.contactos.filter(c => c.estado === 'pendiente').length;

        // Determinar el estado correcto
        let newStatus = 'active';
        if (pendientes === 0 && enviados > 0) {
          newStatus = 'completed';
        } else if (pendientes > 0 && enviados === 0) {
          newStatus = 'scheduled';
        } else if (pendientes > 0 && enviados > 0) {
          newStatus = 'active'; // Enviando
        }

        // Actualizar en base de datos
        await pool.execute(
          `UPDATE campaigns 
           SET contacts = ?, 
               progress_sent = ?, 
               progress_failed = ?,
               status = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [
            JSON.stringify(campaign.contactos),
            enviados,
            errores,
            newStatus,
            campaign.id
          ]
        );

        console.log(`[CAMPAIGN-DB] Campaña ${campaign.nombre} actualizada: ${enviados} enviados, ${errores} errores, ${pendientes} pendientes`);

        // Emitir evento de progreso por Socket.IO
        try {
          const io = req.app.get('io');
          if (io && userId) {
            const totalContactos = campaign.contactos.length;
            const percentage = totalContactos > 0 ? Math.round(((enviados + errores) / totalContactos) * 100) : 0;

            io.to(`sms_${userId}`).emit('sms_progress', {
              campaignId: campaign.id,
              progress: percentage,
              sent: enviados,
              failed: errores,
              total: totalContactos
            });
          }
        } catch (socketError) {
          console.error('Error emitiendo socket en check-scheduled:', socketError);
        }
      }
    }

    res.json({
      success: true,
      sent: sentCount
    });

  } catch (error) {
    console.error('Error verificando mensajes programados:', error);
    res.status(500).json({ success: false, error: error.message, sent: 0 });
  }
});

// POST - Reprogramar campaña (cambiar todos los enviados a pendiente)
router.post('/reprogram/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Obtener campaña de la base de datos
    const [campaigns] = await pool.execute(
      'SELECT * FROM campaigns WHERE id = ?',
      [campaignId]
    );

    if (campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaña no encontrada'
      });
    }

    const campaign = campaigns[0];
    const contactos = JSON.parse(campaign.contacts || '[]');

    // Cambiar todos los contactos enviados a pendiente
    contactos.forEach(contact => {
      if (contact.estado === 'enviado' || contact.estado === 'error') {
        contact.estado = 'pendiente';
        delete contact.enviadoEn;
        delete contact.errorMessage;
      }
    });

    // Actualizar en base de datos
    await pool.execute(
      `UPDATE campaigns 
       SET contacts = ?, 
           status = 'scheduled',
           progress_sent = 0, 
           progress_failed = 0,
           updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(contactos), campaignId]
    );

    console.log(`🔄 Campaña ${campaign.name} reprogramada con ${contactos.length} contactos`);

    res.json({
      success: true,
      campaign: {
        id: campaignId,
        estado: 'programada',
        enviados: 0,
        pendientes: contactos.filter(c => c.estado === 'pendiente').length,
        errores: 0
      }
    });

  } catch (error) {
    console.error('Error reprogramando campaña:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE - Eliminar campaña
router.delete('/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Obtener campaña de la base de datos
    const [campaigns] = await pool.execute(
      'SELECT * FROM campaigns WHERE id = ?',
      [campaignId]
    );

    if (campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaña no encontrada'
      });
    }

    const campaign = campaigns[0];

    // Eliminar archivo si existe
    if (campaign.message_media_url) {
      try {
        await fs.unlink(campaign.message_media_url);
      } catch (error) {
        console.error('Error eliminando archivo:', error);
      }
    }

    // Eliminar de la base de datos
    await pool.execute('DELETE FROM campaigns WHERE id = ?', [campaignId]);

    console.log(`🗑️ Campaña ${campaign.name} eliminada de BD`);

    res.json({ success: true });

  } catch (error) {
    console.error('Error eliminando campaña:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET - Obtener detalle de campaña específica
router.get('/detail/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    // FIX: Consultar a BD en lugar de usar Map no definido
    const pool = getPool();
    const [campaigns] = await pool.execute(
      'SELECT * FROM campaigns WHERE id = ?',
      [campaignId]
    );

    if (campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaña no encontrada'
      });
    }

    res.json({
      success: true,
      campaign: campaigns[0]
    });

  } catch (error) {
    console.error('Error obteniendo detalle de campaña:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE - Eliminar un contacto específico de una campaña
router.delete('/:campaignId/contact/:phoneNumber', async (req, res) => {
  try {
    const { campaignId, phoneNumber } = req.params;
    const { sessionId } = req.query;

    // Obtener campaña de la base de datos
    const [campaigns] = await pool.execute(
      'SELECT * FROM campaigns WHERE id = ? AND session_id = ?',
      [campaignId, sessionId]
    );

    if (campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaña no encontrada o no tienes permiso'
      });
    }

    const campaign = campaigns[0];
    let contactos = JSON.parse(campaign.contacts || '[]');

    // Filtrar el contacto a eliminar
    const originalLength = contactos.length;
    contactos = contactos.filter(c => c.numero !== phoneNumber);

    if (contactos.length === originalLength) {
      return res.status(404).json({
        success: false,
        error: 'Contacto no encontrado en la campaña'
      });
    }

    // Calcular estadísticas actualizadas
    const totalContactos = contactos.length;
    const enviados = contactos.filter(c => c.estado === 'enviado').length;
    const errores = contactos.filter(c => c.estado === 'error').length;

    // Guardar cambios en la base de datos
    await pool.execute(
      `UPDATE campaigns 
       SET contacts = ?, 
           progress_total = ?,
           progress_sent = ?, 
           progress_failed = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(contactos), totalContactos, enviados, errores, campaignId]
    );

    console.log(`[CAMPAIGN-DB] Contacto ${phoneNumber} eliminado de campaña ${campaignId}`);

    res.json({
      success: true,
      message: 'Contacto eliminado correctamente'
    });

  } catch (error) {
    console.error('Error eliminando contacto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT - Actualizar un contacto específico de una campaña
router.put('/:campaignId/contact', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { contact, sessionId } = req.body;

    if (!contact || !contact.numero) {
      return res.status(400).json({
        success: false,
        error: 'Datos del contacto incompletos'
      });
    }

    // Obtener campaña de la base de datos
    const [campaigns] = await pool.execute(
      'SELECT * FROM campaigns WHERE id = ? AND session_id = ?',
      [campaignId, sessionId]
    );

    if (campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaña no encontrada o no tienes permiso'
      });
    }

    const campaign = campaigns[0];
    let contactos = JSON.parse(campaign.contacts || '[]');

    // Encontrar y actualizar el contacto
    const contactIndex = contactos.findIndex(c => c.numero === contact.numero);

    if (contactIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Contacto no encontrado en la campaña'
      });
    }

    // Actualizar el contacto
    contactos[contactIndex] = {
      ...contactos[contactIndex],
      ...contact
    };

    // Calcular estadísticas actualizadas
    const enviados = contactos.filter(c => c.estado === 'enviado').length;
    const errores = contactos.filter(c => c.estado === 'error').length;

    // Guardar cambios en la base de datos
    await pool.execute(
      `UPDATE campaigns 
       SET contacts = ?, 
           progress_sent = ?, 
           progress_failed = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(contactos), enviados, errores, campaignId]
    );

    console.log(`[CAMPAIGN-DB] Contacto ${contact.numero} actualizado en campaña ${campaignId}`);

    res.json({
      success: true,
      message: 'Contacto actualizado correctamente',
      campaign: {
        ...campaign,
        contactos,
        enviados,
        errores
      }
    });

  } catch (error) {
    console.error('Error actualizando contacto:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST - Enviar campaña inmediatamente (todas las personas)
router.post('/send-now/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId es requerido'
      });
    }

    // Obtener campaña de la base de datos
    const [campaigns] = await pool.execute(
      'SELECT * FROM campaigns WHERE id = ? AND session_id = ?',
      [campaignId, sessionId]
    );

    if (campaigns.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Campaña no encontrada'
      });
    }

    const campaign = campaigns[0];
    const contactos = JSON.parse(campaign.contacts || '[]');

    // Obtener cliente de WhatsApp
    const sessions = req.app.get('whatsappSessions');
    const sessionData = sessions?.get(sessionId);

    if (!sessionData || !sessionData.sock) {
      return res.status(400).json({
        success: false,
        error: 'Cliente de WhatsApp no conectado'
      });
    }

    // Resolver userId para socket
    const { resolveToUserId } = require('../helpers/sessionIdResolver');
    const userId = await resolveToUserId(sessionId);

    if (!userId) {
      console.warn('No se pudo resolver userId para sessionId:', sessionId);
    }

    const whatsappClient = sessionData.sock;
    let enviados = 0;
    let errores = 0;

    // Obtener configuración de envíos para respetar intervalos de seguridad
    const [settings] = await pool.execute(
      `SELECT interval_min_seconds, interval_max_seconds
       FROM campaign_settings 
       WHERE session_id = ?`,
      [sessionId]
    );

    const config = settings[0] || {
      interval_min_seconds: 60,
      interval_max_seconds: 120
    };

    console.log(`🚀 Iniciando envío inmediato de campaña: ${campaign.name} con ${contactos.length} contactos`);
    console.log(`⏱️ Configuración de velocidad: ${config.interval_min_seconds}s - ${config.interval_max_seconds}s entre mensajes`);

    // Cambiar estado a 'active' - enviando
    await pool.execute(
      'UPDATE campaigns SET status = ? WHERE id = ?',
      ['active', campaignId]
    );

    // Enviar mensajes a todos los contactos pendientes
    for (const contact of contactos) {
      if (contact.estado !== 'pendiente') continue;

      try {
        // Reemplazar variables en el mensaje - CORREGIDO: usar contact.nombre no contact.numero
        let personalizedMessage = campaign.message_text
          .replace(/{nombre}/g, contact.nombre || contact.numero || '')
          .replace(/{dato1}/g, contact.dato1 || '')
          .replace(/{dato2}/g, contact.dato2 || '')
          .replace(/{dato3}/g, contact.dato3 || '')
          .replace(/{fecha}/g, contact.fecha || '');

        // Formatear número
        let phoneNumber = contact.numero.replace(/\D/g, '');
        if (!phoneNumber.endsWith('@s.whatsapp.net')) {
          phoneNumber = `${phoneNumber}@s.whatsapp.net`;
        }

        // Enviar mensaje
        if (campaign.message_media_url) {
          const mediaBuffer = await fs.readFile(campaign.message_media_url);
          await whatsappClient.sendMessage(phoneNumber, {
            caption: personalizedMessage,
            image: mediaBuffer
          });
        } else {
          await whatsappClient.sendMessage(phoneNumber, {
            text: personalizedMessage
          });
        }

        contact.estado = 'enviado';
        contact.enviadoEn = new Date().toISOString();
        enviados++;

        console.log(`✅ Mensaje enviado a ${contact.nombre} (${contact.numero})`);

        // Guardar mensaje en la base de datos
        try {
          const messageId = uuidv4();
          await pool.execute(
            `INSERT INTO messages (
              id, session_id, chat_jid, sender_jid, from_me, 
              message_type, text_content, media_url, status, timestamp, is_read
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
            [
              messageId,
              sessionId,
              phoneNumber,
              whatsappClient.user?.id?.split(':')[0] || sessionId,
              true,
              campaign.message_media_url ? 'image' : 'text',
              personalizedMessage,
              campaign.message_media_url || null,
              'sent',
              true
            ]
          );
        } catch (dbError) {
          console.error('[CAMPAIGN-MSG] Error guardando mensaje:', dbError);
        }

        // Emitir evento de progreso por Socket.IO
        try {
          const io = req.app.get('io');
          if (io && userId) {
            const totalContactos = contactos.length;
            const percentage = totalContactos > 0 ? Math.round(((enviados + errores) / totalContactos) * 100) : 0;

            io.to(`sms_${userId}`).emit('sms_progress', {
              campaignId: campaign.id,
              progress: percentage,
              sent: enviados,
              failed: errores,
              total: totalContactos
            });
          }
        } catch (socketError) {
          console.error('Error emitiendo socket:', socketError);
        }

        // Esperar tiempo aleatorio entre mensajes según configuración (seguridad anti-ban)
        const minDelay = (config.interval_min_seconds || 60) * 1000;
        const maxDelay = (config.interval_max_seconds || 120) * 1000;
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

        console.log(`⏱️  Esperando ${Math.floor(randomDelay / 1000)} segundos antes del próximo envío...`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));

    } catch (error) {
      console.error(`❌ Error enviando a ${contact.numero}:`, error);
      contact.estado = 'error';
      contact.errorMessage = error.message;
      errores++;
    }
  }

    const pendientes = contactos.filter(c => c.estado === 'pendiente').length;
  const newStatus = pendientes === 0 ? 'completed' : 'active';

  // Actualizar campaña en base de datos
  await pool.execute(
    `UPDATE campaigns 
       SET contacts = ?, 
           progress_sent = ?, 
           progress_failed = ?,
           status = ?,
           updated_at = NOW()
       WHERE id = ?`,
    [
      JSON.stringify(contactos),
      enviados,
      errores,
      newStatus,
      campaignId
    ]
  );

  console.log(`✅ Campaña finalizada: ${enviados} enviados, ${errores} errores, ${pendientes} pendientes`);

  res.json({
    success: true,
    enviados,
    errores,
    pendientes,
    estado: newStatus === 'completed' ? 'completada' : 'enviando'
  });

} catch (error) {
  console.error('Error enviando campaña:', error);
  res.status(500).json({ success: false, error: error.message });
}
});

// POST - Pausar campaña
router.post('/pause/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    await pool.execute(
      'UPDATE campaigns SET status = ? WHERE id = ?',
      ['paused', campaignId]
    );

    res.json({ success: true, estado: 'pausada' });
  } catch (error) {
    console.error('Error pausando campaña:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST - Reanudar campaña
router.post('/resume/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    await pool.execute(
      'UPDATE campaigns SET status = ? WHERE id = ?',
      ['active', campaignId]
    );

    res.json({ success: true, estado: 'activa' });
  } catch (error) {
    console.error('Error reanudando campaña:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
