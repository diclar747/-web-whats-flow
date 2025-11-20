const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');

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
    const { sessionId } = req.params;
    
    const [campaigns] = await pool.execute(
      `SELECT id, session_id as sessionId, name as nombre, message_text as mensaje, 
              message_media_url as archivo, contacts, status as estado, created_at as createdAt,
              progress_total as totalContactos, progress_sent as enviados, 
              (progress_total - progress_sent - progress_failed) as pendientes,
              progress_failed as errores
       FROM campaigns 
       WHERE session_id = ? AND type = 'personalized'
       ORDER BY created_at DESC`,
      [sessionId]
    );

    // Parsear el JSON de contactos
    const parsedCampaigns = campaigns.map(c => ({
      ...c,
      contactos: c.contacts ? JSON.parse(c.contacts) : [],
      archivo: c.archivo || null,
      archivoNombre: c.archivo ? path.basename(c.archivo) : null
    }));

    res.json({
      success: true,
      campaigns: parsedCampaigns
    });
  } catch (error) {
    console.error('Error obteniendo campañas:', error);
    res.status(500).json({ success: false, error: error.message });
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

    // Insertar en la base de datos
    await pool.execute(
      `INSERT INTO campaigns (
        id, session_id, name, type, status, message_text, 
        message_media_url, contacts, progress_total
      ) VALUES (?, ?, ?, 'personalized', 'active', ?, ?, ?, ?)`,
      [
        campaignId,
        sessionId,
        nombre,
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
      estado: 'activa',
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

    if (!sessionData || !sessionData.client) {
      return res.json({ success: false, error: 'Cliente no conectado', sent: 0 });
    }

    const whatsappClient = sessionData.client;

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    let sentCount = 0;

    // Obtener campañas activas de la sesión desde la base de datos
    const [campaignsFromDB] = await pool.execute(
      `SELECT id, name, message_text, message_media_url, contacts 
       FROM campaigns 
       WHERE session_id = ? AND status = 'active' AND type = 'personalized'`,
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
        // Verificar si es la fecha y hora de envío y está pendiente
        const contactHour = contact.hora || '00:00';
        const contactDateTime = `${contact.fecha} ${contactHour}`;
        const currentDateTime = `${currentDate} ${currentTime}`;
        
        const shouldSend = contact.estado === 'pendiente' &&
                          contact.fecha === currentDate &&
                          contactHour <= currentTime;

        if (shouldSend) {
          console.log(`📅 Enviando mensaje programado: ${contact.nombre} - Fecha: ${contact.fecha} Hora: ${contactHour}`);

          try {
            // Reemplazar variables en el mensaje
            let personalizedMessage = campaign.mensaje
              .replace(/{nombre}/g, contact.nombre || '')
              .replace(/{dato1}/g, contact.dato1 || '')
              .replace(/{dato2}/g, contact.dato2 || '')
              .replace(/{dato3}/g, contact.dato3 || '');

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
            sentCount++;
            campaignUpdated = true;

            console.log(`✅ Mensaje enviado a ${contact.nombre} (${contact.numero})`);

            // Esperar un poco entre mensajes para evitar bloqueos
            await new Promise(resolve => setTimeout(resolve, 2000));

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
            pendientes === 0 ? 'completed' : 'active',
            campaign.id
          ]
        );

        console.log(`[CAMPAIGN-DB] Campaña ${campaign.nombre} actualizada: ${enviados} enviados, ${errores} errores, ${pendientes} pendientes`);
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
    const campaign = campaigns.get(campaignId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaña no encontrada'
      });
    }

    // Cambiar todos los contactos enviados a pendiente
    campaign.contactos.forEach(contact => {
      if (contact.estado === 'enviado') {
        contact.estado = 'pendiente';
      }
    });

    // Actualizar estadísticas
    campaign.estado = 'activa';
    campaign.enviados = 0;
    campaign.pendientes = campaign.contactos.filter(c => c.estado === 'pendiente').length;
    campaign.errores = campaign.contactos.filter(c => c.estado === 'error').length;

    console.log(`🔄 Campaña ${campaign.nombre} reprogramada`);

    res.json({
      success: true,
      campaign
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
    const campaign = campaigns.get(campaignId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaña no encontrada'
      });
    }

    res.json({
      success: true,
      campaign
    });

  } catch (error) {
    console.error('Error obteniendo detalle de campaña:', error);
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

module.exports = router;
