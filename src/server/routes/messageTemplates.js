const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

// Crear pool de conexiones a la base de datos
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'whatsflow',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// GET - Obtener todas las plantillas (públicas + de la sesión)
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const [templates] = await pool.execute(
      `SELECT id, session_id as sessionId, name, message_text as messageText, 
              created_at as createdAt, updated_at as updatedAt
       FROM message_templates 
       WHERE session_id = 'default' OR session_id = ?
       ORDER BY session_id ASC, created_at ASC`,
      [sessionId]
    );

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error obteniendo plantillas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST - Crear nueva plantilla personalizada
router.post('/create', async (req, res) => {
  try {
    const { sessionId, name, messageText } = req.body;
    
    if (!sessionId || !name || !messageText) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos'
      });
    }

    const templateId = uuidv4();

    await pool.execute(
      `INSERT INTO message_templates (id, session_id, name, message_text) 
       VALUES (?, ?, ?, ?)`,
      [templateId, sessionId, name, messageText]
    );

    const template = {
      id: templateId,
      sessionId,
      name,
      messageText,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log(`✅ Plantilla creada: ${name} para sesión ${sessionId}`);

    res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Error creando plantilla:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT - Actualizar plantilla
router.put('/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { sessionId, name, messageText } = req.body;

    // Verificar que la plantilla existe
    const [templates] = await pool.execute(
      'SELECT session_id FROM message_templates WHERE id = ?',
      [templateId]
    );

    if (templates.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Plantilla no encontrada'
      });
    }

    // Permitir edición de todas las plantillas
    await pool.execute(
      `UPDATE message_templates 
       SET name = ?, message_text = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, messageText, templateId]
    );

    console.log(`✅ Plantilla actualizada: ${templateId} (${name})`);

    res.json({
      success: true,
      message: 'Plantilla actualizada correctamente'
    });
  } catch (error) {
    console.error('Error actualizando plantilla:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE - Eliminar plantilla
router.delete('/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { sessionId } = req.query;

    // Verificar que no sea una plantilla default
    const [templates] = await pool.execute(
      'SELECT session_id FROM message_templates WHERE id = ?',
      [templateId]
    );

    if (templates.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Plantilla no encontrada'
      });
    }

    if (templates[0].session_id === 'default') {
      return res.status(403).json({
        success: false,
        error: 'No se pueden eliminar las plantillas predeterminadas'
      });
    }

    await pool.execute(
      'DELETE FROM message_templates WHERE id = ? AND session_id = ?',
      [templateId, sessionId]
    );

    console.log(`🗑️ Plantilla eliminada: ${templateId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando plantilla:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET - Obtener configuración de envíos de una sesión
router.get('/settings/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const [settings] = await pool.execute(
      `SELECT id, session_id as sessionId, reminder_days_before as reminderDaysBefore,
              send_hour_start as sendHourStart, send_hour_end as sendHourEnd,
              interval_min_seconds as intervalMinSeconds, interval_max_seconds as intervalMaxSeconds,
              created_at as createdAt, updated_at as updatedAt
       FROM campaign_settings 
       WHERE session_id = ?`,
      [sessionId]
    );

    if (settings.length === 0) {
      // Devolver configuración por defecto
      return res.json({
        success: true,
        settings: {
          sessionId,
          reminderDaysBefore: 0,
          sendHourStart: '07:00:00',
          sendHourEnd: '18:00:00',
          intervalMinSeconds: 60,
          intervalMaxSeconds: 120
        }
      });
    }

    res.json({
      success: true,
      settings: settings[0]
    });
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST - Guardar/actualizar configuración de envíos
router.post('/settings/save', async (req, res) => {
  try {
    const {
      sessionId,
      reminderDaysBefore,
      sendHourStart,
      sendHourEnd,
      intervalMinSeconds,
      intervalMaxSeconds
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId es requerido'
      });
    }

    // Verificar si ya existe configuración
    const [existing] = await pool.execute(
      'SELECT id FROM campaign_settings WHERE session_id = ?',
      [sessionId]
    );

    if (existing.length > 0) {
      // Actualizar
      await pool.execute(
        `UPDATE campaign_settings 
         SET reminder_days_before = ?, 
             send_hour_start = ?, 
             send_hour_end = ?,
             interval_min_seconds = ?,
             interval_max_seconds = ?,
             updated_at = NOW()
         WHERE session_id = ?`,
        [
          reminderDaysBefore || 0,
          sendHourStart || '07:00:00',
          sendHourEnd || '18:00:00',
          intervalMinSeconds || 60,
          intervalMaxSeconds || 120,
          sessionId
        ]
      );
    } else {
      // Insertar
      const settingId = uuidv4();
      await pool.execute(
        `INSERT INTO campaign_settings 
         (id, session_id, reminder_days_before, send_hour_start, send_hour_end,
          interval_min_seconds, interval_max_seconds) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          settingId,
          sessionId,
          reminderDaysBefore || 0,
          sendHourStart || '07:00:00',
          sendHourEnd || '18:00:00',
          intervalMinSeconds || 60,
          intervalMaxSeconds || 120
        ]
      );
    }

    console.log(`✅ Configuración guardada para sesión ${sessionId}`);

    res.json({
      success: true,
      message: 'Configuración guardada correctamente'
    });
  } catch (error) {
    console.error('Error guardando configuración:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
