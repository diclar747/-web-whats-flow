const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'whatsflow'
};

// Mantener Maps en memoria para stats y interacciones en tiempo real
const chatbotStats = new Map();
const chatbotInteractions = new Map();
const chatbotFlows = new Map();
const chatbotSettings = new Map();

// Función para resolver el ID de usuario real si se proporciona un teléfono o session_id string
async function resolveUserId(identifier, connection) {
  if (!identifier) return null;

  // Si ya es un ID numérico pequeño (< 1000000), es probable que sea el user_id
  if (/^\d+$/.test(identifier) && parseInt(identifier) < 1000000) {
    return identifier;
  }

  // Buscar en users por phone o admin_phone o session_id
  const [userResult] = await connection.query(
    'SELECT id FROM users WHERE phone = ? OR admin_phone = ? OR session_id = ? LIMIT 1',
    [identifier, identifier, identifier]
  );
  if (userResult.length > 0) return userResult[0].id.toString();

  return identifier; // Fallback
}

// GET - Obtener flujos de un session desde BD
router.get('/flows/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`[CHATBOT-DEBUG] Recibida petición de flujos para sessionId: '${sessionId}'`);
    const connection = await mysql.createConnection(dbConfig);

    // Resolver el ID de usuario real
    const resolvedId = await resolveUserId(sessionId, connection);
    console.log(`[CHATBOT-DEBUG] sessionId original: '${sessionId}', resolvedId: '${resolvedId}'`);

    let flows;

    // Primero intentar con resolvedId
    const [exactFlows] = await connection.query(
      'SELECT * FROM chatbot_flows WHERE session_id = ? ORDER BY created_at DESC',
      [resolvedId]
    );

    // Si no hay resultados y sessionId es un número pequeño (ID de usuario), buscar todos los flujos
    // como fallback (esto maneja el caso donde sessionId=1 pero los flujos están guardados con phone IDs)
    if (exactFlows.length === 0 && /^\d+$/.test(sessionId) && parseInt(sessionId) < 100) {
      console.log(`[CHATBOT-DEBUG] No se encontraron flujos para sessionId='${sessionId}', intentando fallback (obtener todos los flujos)...`);
      const [allFlows] = await connection.query(
        'SELECT * FROM chatbot_flows ORDER BY created_at DESC LIMIT 50'
      );
      flows = allFlows;
      console.log(`[CHATBOT-DEBUG] Fallback encontró ${allFlows.length} flujos`);
    } else {
      flows = exactFlows;
    }

    await connection.end();

    // Parsear flow_data y adaptar al formato del frontend
    const parsedFlows = flows.map(flow => {
      const flowData = flow.flow_data ? JSON.parse(flow.flow_data) : {};
      return {
        id: flow.id.toString(),
        name: flowData.name || flow.flow_name,
        description: flowData.description || '',
        active: Boolean(flow.is_active),
        flowType: flowData.flowType || 'programmed',
        triggers: flowData.triggers || [],
        responses: flowData.responses || [{
          id: '1',
          type: 'text',
          content: '',
          mediaUrl: ''
        }],
        kanbanBoardId: flowData.kanbanBoardId || null,
        createdAt: flow.created_at,
        stats: flowData.stats || {
          totalTriggers: 0,
          successRate: 100,
          lastTriggered: null
        },
        aiConfig: flowData.aiConfig || {
          businessData: '',
          websiteUrl: '',
          scrapedContent: '',
          temperature: 0.7,
          maxTokens: 500
        }
      };
    });

    res.json({ success: true, flows: parsedFlows });
  } catch (error) {
    console.error('Error obteniendo flujos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST - Crear nuevo flujo en BD
router.post('/flows/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const flowData = req.body;

    const connection = await mysql.createConnection(dbConfig);

    // Resolver el ID de usuario real para guardar consistentemente
    const resolvedId = await resolveUserId(sessionId, connection);
    console.log(`[CHATBOT-SAVE] Guardando flujo para resolvedId: '${resolvedId}' (original: '${sessionId}')`);

    // Guardar todos los datos del flujo en flow_data como JSON
    const completeFlowData = {
      name: flowData.name,
      description: flowData.description || '',
      triggers: flowData.triggers || [],
      responses: flowData.responses || [],
      flowType: flowData.flowType || 'programmed',
      kanbanBoardId: flowData.kanbanBoardId || null,
      aiConfig: flowData.aiConfig || {
        businessData: '',
        websiteUrl: '',
        scrapedContent: '',
        temperature: 0.7,
        maxTokens: 500
      },
      stats: {
        totalTriggers: 0,
        successRate: 100,
        lastTriggered: null
      }
    };

    const [result] = await connection.query(
      `INSERT INTO chatbot_flows (
        session_id, flow_name, flow_data, is_active
      ) VALUES (?, ?, ?, ?)`,
      [
        resolvedId,
        flowData.name,
        JSON.stringify(completeFlowData),
        flowData.active !== false ? 1 : 0
      ]
    );

    const flowId = result.insertId.toString();

    await connection.end();

    const newFlow = {
      id: flowId,
      name: flowData.name,
      description: flowData.description || '',
      active: flowData.active !== false,
      flowType: flowData.flowType || 'programmed',
      triggers: flowData.triggers || [],
      responses: flowData.responses || [],
      kanbanBoardId: flowData.kanbanBoardId || null,
      aiConfig: completeFlowData.aiConfig,
      createdAt: new Date().toISOString(),
      stats: {
        totalTriggers: 0,
        successRate: 100,
        lastTriggered: null
      }
    };

    console.log(`[CHATBOT] ✅ Flujo creado en BD: ${newFlow.name} (${flowData.triggers?.length} triggers)`);

    res.json({ success: true, flow: newFlow });
  } catch (error) {
    console.error('Error creando flujo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT - Actualizar flujo en BD
router.put('/flows/:sessionId/:flowId', async (req, res) => {
  try {
    const { sessionId, flowId } = req.params;
    const updatedFlow = req.body;

    const connection = await mysql.createConnection(dbConfig);

    // Resolver el ID de usuario real
    const resolvedId = await resolveUserId(sessionId, connection);
    console.log(`[CHATBOT-UPDATE] Actualizando flujo para resolvedId: '${resolvedId}' (original: '${sessionId}')`);

    // Guardar todos los datos del flujo en flow_data como JSON
    const completeFlowData = {
      name: updatedFlow.name,
      description: updatedFlow.description || '',
      triggers: updatedFlow.triggers || [],
      responses: updatedFlow.responses || [],
      flowType: updatedFlow.flowType || 'programmed',
      kanbanBoardId: updatedFlow.kanbanBoardId || null,
      aiConfig: updatedFlow.aiConfig || {
        businessData: '',
        websiteUrl: '',
        scrapedContent: '',
        temperature: 0.7,
        maxTokens: 500
      },
      stats: updatedFlow.stats || {
        totalTriggers: 0,
        successRate: 100,
        lastTriggered: null
      }
    };

    const [result] = await connection.query(
      `UPDATE chatbot_flows 
       SET session_id = ?, flow_name = ?, flow_data = ?, is_active = ?
       WHERE id = ?`,
      [
        resolvedId,
        updatedFlow.name,
        JSON.stringify(completeFlowData),
        updatedFlow.active !== false ? 1 : 0,
        flowId
      ]
    );

    await connection.end();

    if (result.affectedRows > 0) {
      console.log(`[CHATBOT] ✏️ Flujo actualizado en BD: ${updatedFlow.name} (${updatedFlow.flowType})`);
      res.json({ success: true, flow: updatedFlow });
    } else {
      res.status(404).json({ success: false, error: 'Flujo no encontrado' });
    }
  } catch (error) {
    console.error('Error actualizando flujo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE - Eliminar flujo
router.delete('/flows/:sessionId/:flowId', async (req, res) => {
  try {
    const { sessionId, flowId } = req.params;

    const connection = await mysql.createConnection(dbConfig);
    const resolvedId = await resolveUserId(sessionId, connection);

    await connection.query(
      'DELETE FROM chatbot_flows WHERE id = ? AND session_id = ?',
      [flowId, resolvedId]
    );

    await connection.end();

    console.log(`[CHATBOT] 🗑️ Flujo eliminado de BD: ${flowId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando flujo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH - Toggle activo/inactivo
router.patch('/flows/:sessionId/:flowId/toggle', async (req, res) => {
  try {
    const { sessionId, flowId } = req.params;
    const { active } = req.body;

    const connection = await mysql.createConnection(dbConfig);
    const resolvedId = await resolveUserId(sessionId, connection);

    await connection.query(
      'UPDATE chatbot_flows SET is_active = ? WHERE id = ? AND session_id = ?',
      [active ? 1 : 0, flowId, resolvedId]
    );

    const [flows] = await connection.query(
      'SELECT * FROM chatbot_flows WHERE id = ? AND session_id = ?',
      [flowId, resolvedId]
    );

    await connection.end();

    if (flows.length > 0) {
      const flow = flows[0];
      const flowData = flow.flow_data ? JSON.parse(flow.flow_data) : {};

      const parsedFlow = {
        id: flow.id.toString(),
        name: flowData.name || flow.flow_name,
        description: flowData.description || '',
        active: Boolean(active),
        flowType: flowData.flowType || 'programmed',
        triggers: flowData.triggers || [],
        responses: flowData.responses || [],
        kanbanBoardId: flowData.kanbanBoardId || null,
        aiConfig: flowData.aiConfig || {},
        stats: flowData.stats || {}
      };

      console.log(`[CHATBOT] ${active ? '▶️' : '⏸️'} Flujo ${active ? 'activado' : 'pausado'}: ${parsedFlow.name}`);
      res.json({ success: true, flow: parsedFlow });
    } else {
      res.status(404).json({ success: false, error: 'Flujo no encontrado' });
    }
  } catch (error) {
    console.error('Error cambiando estado del flujo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET - Obtener configuración
router.get('/settings/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Intentar obtener desde BD primero
    const connection = await mysql.createConnection(dbConfig);
    const resolvedId = await resolveUserId(sessionId, connection);
    let rows;

    // Primero intentar con resolvedId
    const [exactRows] = await connection.query(
      'SELECT * FROM chatbot_settings WHERE session_id = ?',
      [resolvedId]
    );

    // Si no hay resultados y sessionId es un número pequeño, buscar cualquier configuración como fallback
    if (exactRows.length === 0 && /^\d+$/.test(sessionId) && parseInt(sessionId) < 100) {
      console.log(`[CHATBOT-DEBUG] No se encontró configuración para sessionId='${sessionId}', usando primera disponible...`);
      const [allRows] = await connection.query(
        'SELECT * FROM chatbot_settings LIMIT 1'
      );
      rows = allRows;
    } else {
      rows = exactRows;
    }

    await connection.end();

    let settings;
    if (rows && rows.length > 0) {
      const row = rows[0];
      settings = {
        enabled: Boolean(row.enabled),
        workingHours: {
          enabled: Boolean(row.working_hours_enabled),
          start: row.working_hours_start || '09:00',
          end: row.working_hours_end || '18:00',
          days: JSON.parse(row.working_days || '[1,2,3,4,5]')
        },
        fallbackMessage: row.fallback_message || 'Lo siento, no entiendo tu mensaje.',
        transferToAgent: Boolean(row.transfer_to_agent),
        aiEnabled: Boolean(row.ai_enabled),
        responseDelay: row.response_delay || 1000,
        botMode: row.bot_mode || 'flows',
        aiConfig: {
          businessData: row.ai_business_data || '',
          websiteUrl: row.ai_website_url || '',
          scrapedContent: row.ai_scraped_content || '',
          temperature: parseFloat(row.ai_temperature) || 0.7,
          maxTokens: parseInt(row.ai_max_tokens) || 500
        }
      };
    } else {
      // Valores por defecto si no existe configuración
      settings = {
        enabled: false,
        workingHours: {
          enabled: false,
          start: '09:00',
          end: '18:00',
          days: [1, 2, 3, 4, 5]
        },
        fallbackMessage: 'Lo siento, no entiendo tu mensaje.',
        transferToAgent: true,
        aiEnabled: false,
        responseDelay: 1000,
        botMode: 'flows',
        aiConfig: {
          businessData: '',
          websiteUrl: '',
          scrapedContent: '',
          temperature: 0.7,
          maxTokens: 500
        }
      };
    }

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT - Actualizar configuración
router.put('/settings/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const settings = req.body;

    const connection = await mysql.createConnection(dbConfig);
    const resolvedId = await resolveUserId(sessionId, connection); // Added resolvedId

    // Verificar si existe configuración
    const [existing] = await connection.query(
      'SELECT id FROM chatbot_settings WHERE session_id = ?',
      [resolvedId] // Changed to resolvedId
    );

    const aiConfig = settings.aiConfig || {};

    if (existing.length > 0) {
      // Actualizar
      await connection.query(
        `UPDATE chatbot_settings SET
          enabled = ?,
          working_hours_enabled = ?,
          working_hours_start = ?,
          working_hours_end = ?,
          working_days = ?,
          fallback_message = ?,
          transfer_to_agent = ?,
          ai_enabled = ?,
          response_delay = ?,
          bot_mode = ?,
          ai_business_data = ?,
          ai_website_url = ?,
          ai_scraped_content = ?,
          ai_temperature = ?,
          ai_max_tokens = ?
        WHERE session_id = ?`,
        [
          settings.enabled ? 1 : 0,
          settings.workingHours?.enabled ? 1 : 0,
          settings.workingHours?.start || '09:00',
          settings.workingHours?.end || '18:00',
          JSON.stringify(settings.workingHours?.days || [1, 2, 3, 4, 5]),
          settings.fallbackMessage || 'Lo siento, no entiendo tu mensaje.',
          settings.transferToAgent ? 1 : 0,
          settings.aiEnabled ? 1 : 0,
          settings.responseDelay || 1000,
          settings.botMode || 'flows',
          aiConfig.businessData || '',
          aiConfig.websiteUrl || '',
          aiConfig.scrapedContent || '',
          aiConfig.temperature || 0.7,
          aiConfig.maxTokens || 500,
          resolvedId // Changed to resolvedId
        ]
      );
    } else {
      // Insertar
      await connection.query(
        `INSERT INTO chatbot_settings (
          session_id, enabled, working_hours_enabled, working_hours_start,
          working_hours_end, working_days, fallback_message, transfer_to_agent,
          ai_enabled, response_delay, bot_mode, ai_business_data,
          ai_website_url, ai_scraped_content, ai_temperature, ai_max_tokens
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resolvedId, // Changed to resolvedId
          settings.enabled ? 1 : 0,
          settings.workingHours?.enabled ? 1 : 0,
          settings.workingHours?.start || '09:00',
          settings.workingHours?.end || '18:00',
          JSON.stringify(settings.workingHours?.days || [1, 2, 3, 4, 5]),
          settings.fallbackMessage || 'Lo siento, no entiendo tu mensaje.',
          settings.transferToAgent ? 1 : 0,
          settings.aiEnabled ? 1 : 0,
          settings.responseDelay || 1000,
          settings.botMode || 'flows',
          aiConfig.businessData || '',
          aiConfig.websiteUrl || '',
          aiConfig.scrapedContent || '',
          aiConfig.temperature || 0.7,
          aiConfig.maxTokens || 500
        ]
      );
    }

    await connection.end();

    chatbotSettings.set(sessionId, settings);

    console.log(`[CHATBOT] ⚙️ Configuración actualizada para sesión: ${sessionId}`);
    console.log(`[CHATBOT] - Bot ${settings.enabled ? 'ACTIVO' : 'PAUSADO'}`);
    console.log(`[CHATBOT] - Modo: ${settings.botMode || 'flows'}`);
    console.log(`[CHATBOT] - IA: ${settings.botMode === 'ai' ? 'HABILITADA' : 'DESHABILITADA'}`);

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error actualizando configuración:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET - Obtener estadísticas
router.get('/stats/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = chatbotStats.get(sessionId) || {
      totalInteractions: 0,
      successfulResponses: 0,
      transferredToAgent: 0,
      avgResponseTime: 0
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET - Obtener analíticas de todos los chatbots
// POST - Procesar mensaje entrante (para el bot)
router.post('/process-message/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message, from } = req.body;

    const connection = await mysql.createConnection(dbConfig);

    // Construir lista de posibles sessionIds (sessionId, phone, owner_phone)
    const candidateSessionIds = new Set([sessionId]);
    try {
      const [sessionMappings] = await connection.query(
        'SELECT session_id, phone, owner_phone_number FROM user_sessions WHERE session_id = ? OR phone = ? OR owner_phone_number = ? LIMIT 5',
        [sessionId, sessionId, sessionId]
      );
      sessionMappings.forEach(row => {
        [row.session_id, row.phone, row.owner_phone_number].forEach(id => {
          if (id) candidateSessionIds.add(String(id));
        });
      });

      const [userMappings] = await connection.query(
        'SELECT id, phone, admin_phone, session_id FROM users WHERE id = ? OR phone = ? OR admin_phone = ? OR session_id = ? LIMIT 5',
        [sessionId, sessionId, sessionId, sessionId]
      );
      userMappings.forEach(row => {
        [row.id, row.phone, row.admin_phone, row.session_id].forEach(id => {
          if (id) candidateSessionIds.add(String(id));
        });
      });
    } catch (mapErr) {
      console.warn('[CHATBOT] ⚠️ No se pudo mapear sessionIds alternativos:', mapErr.message);
    }

    const candidateIds = Array.from(candidateSessionIds).filter(Boolean);
    const placeholders = candidateIds.length > 0 ? candidateIds.map(() => '?').join(',') : '?';
    const idsForQuery = candidateIds.length > 0 ? candidateIds : [sessionId];
    console.log(`[CHATBOT] 🔑 sessionIds considerados: ${idsForQuery.join(', ')}`);

    // Obtener configuración del chatbot desde BD
    const [settingsRows] = await connection.query(
      `SELECT * FROM chatbot_settings WHERE session_id IN (${placeholders})`,
      idsForQuery
    );

    // Si no hay configuración, usar valores por defecto (bot HABILITADO)
    let settings = null;
    if (settingsRows.length === 0) {
      settings = {
        enabled: true,
        working_hours_enabled: false
      };
      console.log(`[CHATBOT] ℹ️ No hay configuración para ${sessionId}, usando valores por defecto (HABILITADO)`);
    } else {
      const preferredSettings = settingsRows.find(row => String(row.session_id) === String(sessionId)) || settingsRows[0];
      settings = preferredSettings;
      if (!settings.enabled) {
        await connection.end();
        return res.json({ success: false, botResponse: null, reason: 'Bot desactivado' });
      }
    }

    // Verificar horario de atención (si existe en BD)
    if (settings.working_hours_enabled) {
      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = now.toTimeString().slice(0, 5);

      const workingDays = JSON.parse(settings.working_days || '[]');

      if (!workingDays.includes(currentDay) ||
        currentTime < settings.working_hours_start ||
        currentTime > settings.working_hours_end) {
        await connection.end();
        return res.json({
          success: true,
          botResponse: null,
          reason: 'Fuera de horario'
        });
      }
    }

    // Buscar flujos activos desde BD (considerando IDs mapeados)
    const [flows] = await connection.query(
      `SELECT * FROM chatbot_flows WHERE session_id IN (${placeholders}) AND is_active = 1`,
      idsForQuery
    );

    await connection.end();

    const messageLower = message.toLowerCase().trim();
    let matchedFlow = null;

    // Parsear flujos con flow_data
    const parsedFlows = flows.map(flow => {
      const flowData = flow.flow_data ? JSON.parse(flow.flow_data) : {};
      return {
        ...flow,
        flowType: flowData.flowType || flow.flow_type || 'programmed',
        triggers: flowData.triggers || [],
        responses: flowData.responses || [],
        aiConfig: flowData.aiConfig || {},
        kanbanBoardId: flowData.kanbanBoardId || null // 🔥 Extraer kanbanBoardId del JSON
      };
    });

    // Primero buscar flujos programados con triggers
    for (const flow of parsedFlows) {
      if (flow.flowType === 'programmed') {
        const matched = flow.triggers.some(trigger => {
          const triggerLower = trigger.toLowerCase().trim();
          return messageLower === triggerLower ||
            messageLower.includes(' ' + triggerLower + ' ') ||
            messageLower.startsWith(triggerLower + ' ') ||
            messageLower.endsWith(' ' + triggerLower) ||
            messageLower.includes(triggerLower);
        });

        if (matched) {
          matchedFlow = flow;

          // Actualizar stats globales
          const stats = chatbotStats.get(sessionId) || {
            totalInteractions: 0,
            successfulResponses: 0,
            transferredToAgent: 0,
            avgResponseTime: 0
          };
          stats.totalInteractions++;
          stats.successfulResponses++;
          chatbotStats.set(sessionId, stats);

          break;
        }
      }
    }

    if (!matchedFlow) {
      // Si no hay flujo con triggers, buscar el primer flujo con IA activo
      matchedFlow = parsedFlows.find(f => f.flowType === 'ai');
      if (matchedFlow) {
        console.log(`[CHATBOT] 🤖 No hay flujo específico, usando IA: ${matchedFlow.flow_name}`);
      }
    }

    if (matchedFlow) {
      console.log(`[CHATBOT] 🎯 Flujo activado: ${matchedFlow.flow_name} (${matchedFlow.flowType}) por mensaje de ${from}`);

      // Si el flujo tiene un kanban asociado, agregar el contacto al kanban
      // 🔥 El kanbanBoardId está en flowData.kanbanBoardId (JSON parseado)
      const kanbanBoardId = matchedFlow.kanbanBoardId || matchedFlow.aiConfig?.kanbanBoardId;
      console.log(`[CHATBOT] 📋 Verificando kanban: boardId=${kanbanBoardId}, flowData=${JSON.stringify(matchedFlow.aiConfig || {})}`);

      if (kanbanBoardId && kanbanBoardId.trim()) {
        try {
          console.log(`[CHATBOT] 🔍 Intentando conectar a BD para agregar contacto a kanban...`);
          const connection2 = await mysql.createConnection(dbConfig);
          console.log(`[CHATBOT] ✅ Conexión establecida`);

          // Verificar si el contacto ya existe en ese kanban
          console.log(`[CHATBOT] 🔍 Verificando si contacto ${from} ya existe en board ${kanbanBoardId}...`);
          const [existingContact] = await connection2.query(
            'SELECT id FROM kanban_contacts WHERE board_id = ? AND contact_jid = ?',
            [kanbanBoardId, from]
          );

          if (existingContact.length === 0) {
            // Agregar el contacto al kanban
            console.log(`[CHATBOT] ➕ Insertando nuevo contacto ${from} en kanban ${kanbanBoardId}...`);
            const [insertResult] = await connection2.query(
              'INSERT INTO kanban_contacts (board_id, contact_jid, notes) VALUES (?, ?, ?)',
              [kanbanBoardId, from, `Agregado automáticamente por chatbot: ${matchedFlow.flow_name}`]
            );
            console.log(`[CHATBOT] ✅ Contacto ${from} agregado al kanban ${kanbanBoardId} (ID: ${insertResult.insertId})`);
          } else {
            console.log(`[CHATBOT] ℹ️ Contacto ${from} ya existe en kanban ${kanbanBoardId}`);
          }

          await connection2.end();
          console.log(`[CHATBOT] ✅ Conexión cerrada correctamente`);
        } catch (kanbanError) {
          console.error('[CHATBOT] ❌ Error agregando contacto al kanban:', {
            error: kanbanError.message,
            code: kanbanError.code,
            sqlMessage: kanbanError.sqlMessage,
            boardId: kanbanBoardId,
            contactJid: from
          });
          // No fallar la respuesta del bot si falla el kanban
        }
      } else {
        console.log(`[CHATBOT] ⚠️ No hay kanban asociado a este flujo (boardId: ${kanbanBoardId})`);
      }

      let responses = [];

      // Verificar si es flujo con IA o programado
      if (matchedFlow.flowType === 'ai') {
        console.log(`[CHATBOT] 🤖 Generando respuesta con IA para: "${message}"`);

        try {
          const axios = require('axios');

          // Construir contexto del negocio desde aiConfig
          let systemPrompt = 'Eres un asistente virtual de servicio al cliente. Responde de manera amable, profesional y útil en español.';

          console.log(`[CHATBOT-AI] 📋 aiConfig disponible:`, JSON.stringify(matchedFlow.aiConfig, null, 2));

          if (matchedFlow.aiConfig?.businessData || matchedFlow.aiConfig?.scrapedContent) {
            systemPrompt += '\n\nInformación del negocio:\n';
            if (matchedFlow.aiConfig.businessData) {
              console.log(`[CHATBOT-AI] ✅ Usando businessData: ${matchedFlow.aiConfig.businessData.substring(0, 100)}...`);
              systemPrompt += matchedFlow.aiConfig.businessData + '\n\n';
            }
            if (matchedFlow.aiConfig.scrapedContent) {
              console.log(`[CHATBOT-AI] ✅ Usando scrapedContent: ${matchedFlow.aiConfig.scrapedContent.substring(0, 100)}...`);
              systemPrompt += matchedFlow.aiConfig.scrapedContent;
            }
          } else {
            console.log(`[CHATBOT-AI] ⚠️ No hay businessData ni scrapedContent configurado`);
          }

          systemPrompt += '\n\nResponde siempre basándote en la información proporcionada. Si no sabes algo, sé honesto y ofrece ayuda alternativa. Mantén las respuestas concisas y útiles.';

          console.log(`[CHATBOT-AI] 📝 System Prompt (primeros 200 chars): ${systemPrompt.substring(0, 200)}...`);

          // Usar API de Kimi (Moonshot AI)
          const KIMI_API_KEY = process.env.KIMI_API_KEY;
          
          if (!KIMI_API_KEY) {
            console.error('[KIMI-AI] ❌ KIMI_API_KEY no está configurada en .env');
            throw new Error('KIMI_API_KEY no configurada');
          }
          
          console.log(`[KIMI-AI] 🚀 Enviando prompt a Kimi AI...`);
          console.log(`[KIMI-AI] 🔑 API Key (primeros 20 chars): ${KIMI_API_KEY.substring(0, 20)}...`);
          
          // Configuración correcta para Kimi API
          const requestBody = {
            model: 'moonshot-v1-8k',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            temperature: matchedFlow.aiConfig?.temperature || 0.7,
            max_tokens: matchedFlow.aiConfig?.maxTokens || 500
          };
          
          console.log(`[KIMI-AI] 📤 Request body:`, JSON.stringify(requestBody, null, 2));
          
          const kimiResponse = await axios.post('https://api.moonshot.cn/v1/chat/completions', requestBody, {
            headers: {
              'Authorization': `Bearer ${KIMI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 segundos timeout
          });
          
          console.log(`[KIMI-AI] ✅ Respuesta recibida de Kimi`);
          console.log(`[KIMI-AI] 📥 Response status:`, kimiResponse.status);
          console.log(`[KIMI-AI] 📥 Response data:`, JSON.stringify(kimiResponse.data, null, 2));
          
          const aiResponse = kimiResponse.data.choices?.[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';

          console.log(`[CHATBOT] 🤖 IA respondió (${aiResponse.length} chars): ${aiResponse.substring(0, 100)}...`);

          responses = [{
            id: '1',
            type: 'text',
            content: aiResponse
          }];

        } catch (aiError) {
          console.error('[KIMI-AI] ❌ ERROR COMPLETO:');
          console.error('[KIMI-AI] Tipo de error:', aiError.constructor.name);
          console.error('[KIMI-AI] Mensaje:', aiError.message);
          if (aiError.stack) console.error('[KIMI-AI] Stack:', aiError.stack);

          // Intentar obtener detalles específicos de Kimi
          if (aiError.response) {
            console.error('[KIMI-AI] Response status:', aiError.response.status);
            console.error('[KIMI-AI] Response data:', JSON.stringify(aiError.response.data, null, 2));
          }

          // Logs adicionales para debugging
          console.error('[KIMI-AI] Full error object:', JSON.stringify(aiError, Object.getOwnPropertyNames(aiError)));

          // Usar respuesta de error pero continuar
          responses = [{
            id: '1',
            type: 'text',
            content: 'Lo siento, hay un problema técnico con el servicio de IA. Por favor, intenta más tarde.'
          }];
        }

      } else {
        // Flujo programado - usar respuestas guardadas
        responses = matchedFlow.responses || [{
          id: '1',
          type: 'text',
          content: 'Hola, ¿en qué puedo ayudarte?',
          mediaUrl: ''
        }];
      }

      res.json({
        success: true,
        botResponse: responses,
        flow: {
          id: matchedFlow.id,
          name: matchedFlow.flow_name,
          type: matchedFlow.flowType
        }
      });
    } else {
      // No hay flujos activos
      console.log(`[CHATBOT] ❌ No se encontró flujo activo para: "${message}"`);

      res.json({
        success: false,
        botResponse: null,
        reason: 'No matching flow',
        flow: null
      });
    }
  } catch (error) {
    console.error('Error procesando mensaje:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET - Obtener analíticas de chatbots para el dashboard
router.get('/analytics/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    const resolvedId = await resolveUserId(sessionId, connection); // Added resolvedId

    // Obtener configuración del chatbot
    const [settings] = await connection.query(
      'SELECT enabled FROM chatbot_settings WHERE session_id = ?',
      [resolvedId] // Changed to resolvedId
    );

    const chatbotEnabled = settings.length > 0 ? Boolean(settings[0].enabled) : false;

    // Obtener todos los flujos del usuario
    const [flows] = await connection.query(
      'SELECT * FROM chatbot_flows WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    );

    await connection.end();

    // Formatear analíticas para el dashboard
    const analytics = flows.map(flow => {
      const flowData = flow.flow_data ? JSON.parse(flow.flow_data) : {};
      const triggers = flowData.triggers || [];
      const flowIsActive = flow.is_active === 1 || flow.is_active === true;
      const isActive = chatbotEnabled && flowIsActive;

      console.log(`[CHATBOT-ANALYTICS] Flow ${flow.id}: chatbotEnabled=${chatbotEnabled}, flow.is_active=${flow.is_active}, flowIsActive=${flowIsActive}, final=${isActive}`);

      return {
        id: flow.id,
        name: flowData.name || flow.flow_name,
        status: isActive ? 'active' : 'inactive',
        totalInteractions: flowData.stats?.totalTriggers || 0,
        successfulResponses: flowData.stats?.totalTriggers || 0,
        failedResponses: 0,
        avgResponseTime: '< 1s',
        deliveryRate: 100,
        responseRate: flowData.stats?.successRate || 100,
        lastActivity: flowData.stats?.lastTriggered || flow.created_at,
        keywords: triggers,
        color: isActive ? '#00a884' : '#94a3b8'
      };
    });

    console.log(`[CHATBOT-ANALYTICS] Enviando ${analytics.length} chatbots para ${sessionId} (enabled: ${chatbotEnabled})`);

    res.json({
      success: true,
      analytics: analytics,
      total: analytics.length
    });
  } catch (error) {
    console.error('Error obteniendo analíticas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ENDPOINT DE UPLOAD ====================

// POST - Upload de archivos multimedia para chatbot
router.post('/upload', async (req, res) => {
  const multer = require('multer');
  const path = require('path');
  const fs = require('fs');

  try {
    // Configurar storage de multer
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/chatbot');

        // Crear directorio si no existe
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'chatbot-' + uniqueSuffix + ext);
      }
    });

    const upload = multer({
      storage: storage,
      limits: {
        fileSize: 16 * 1024 * 1024 // 16MB max
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
          return cb(null, true);
        } else {
          cb(new Error('Tipo de archivo no permitido'));
        }
      }
    }).single('file');

    upload(req, res, (err) => {
      if (err) {
        console.error('[UPLOAD] Error:', err);
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No se proporcionó archivo'
        });
      }

      // Retornar URL del archivo
      const fileUrl = `/uploads/chatbot/${req.file.filename}`;

      console.log(`[UPLOAD] ✅ Archivo subido: ${req.file.filename}`);

      res.json({
        success: true,
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size
      });
    });

  } catch (error) {
    console.error('[UPLOAD] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al subir archivo'
    });
  }
});

// ==================== ENDPOINTS DE IA CON GOOGLE GEMINI ====================

// POST - Scraping de URL
router.post('/scrape-url', async (req, res) => {
  const axios = require('axios');
  const cheerio = require('cheerio');

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL requerida' });
    }

    console.log(`[SCRAPER] 🔍 Iniciando scraping de: ${url}`);

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);

    // Remover elementos no deseados
    $('script, style, nav, footer, header, iframe, noscript, svg').remove();
    $('.advertisement, .ads, .cookie-banner, .popup').remove();

    // Extraer texto del main content o body
    let content = '';

    // Intentar obtener contenido principal
    const mainSelectors = ['main', 'article', '[role="main"]', '.content', '.main-content', '#content'];
    for (const selector of mainSelectors) {
      const mainContent = $(selector).first();
      if (mainContent.length > 0) {
        content = mainContent.text();
        break;
      }
    }

    // Si no hay main content, usar body
    if (!content) {
      content = $('body').text();
    }

    // Limpiar el texto
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .replace(/\t+/g, '')
      .trim();

    // Limitar a 8000 caracteres para mejor contexto
    if (content.length > 8000) {
      content = content.substring(0, 8000) + '...';
    }

    // Verificar que hay contenido útil
    if (content.length < 50) {
      throw new Error('No se pudo extraer contenido significativo de la página');
    }

    console.log(`[SCRAPER] ✅ Contenido extraído exitosamente: ${content.length} caracteres`);

    res.json({
      success: true,
      content,
      metadata: {
        title: $('title').text() || '',
        description: $('meta[name="description"]').attr('content') || '',
        length: content.length
      }
    });

  } catch (error) {
    console.error('[SCRAPER] ❌ Error al hacer scraping:', error.message);
    res.status(500).json({
      success: false,
      error: 'No se pudo extraer el contenido de la URL',
      details: error.message
    });
  }
});

// POST - Respuesta con IA Google Gemini
router.post('/ai-response', async (req, res) => {
  try {
    const { message, businessData, scrapedContent, temperature = 0.7, maxTokens = 500 } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Mensaje requerido' });
    }

    // Construir contexto del negocio
    let systemPrompt = 'Eres un asistente virtual de servicio al cliente. Responde de manera amable, profesional y útil.';

    if (businessData || scrapedContent) {
      systemPrompt += '\n\nInformación del negocio:\n';
      if (businessData) {
        systemPrompt += businessData + '\n\n';
      }
      if (scrapedContent) {
        systemPrompt += scrapedContent;
      }
    }

    systemPrompt += '\n\nResponde siempre basándote en la información proporcionada. Si no sabes algo, sé honesto y ofrece ayuda alternativa.';

    try {
      // Usar API de Kimi (Moonshot AI)
      const KIMI_API_KEY = process.env.KIMI_API_KEY;
      
      if (!KIMI_API_KEY) {
        console.error('[KIMI-AI] ❌ KIMI_API_KEY no está configurada en .env');
        throw new Error('KIMI_API_KEY no configurada');
      }
      
      console.log(`[KIMI-AI] 🚀 Enviando prompt a Kimi AI...`);
      
      const kimiResponse = await axios.post('https://api.moonshot.cn/v1/chat/completions', {
        model: 'moonshot-v1-8k',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: temperature,
        max_tokens: maxTokens
      }, {
        headers: {
          'Authorization': `Bearer ${KIMI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      console.log('[KIMI-AI] ✅ Respuesta generada');
      
      const aiResponse = kimiResponse.data.choices?.[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';

      res.json({
        success: true,
        response: aiResponse,
        model: 'moonshot-v1-8k',
        tokensUsed: kimiResponse.data.usage?.total_tokens || 0
      });
    } catch (aiError) {
      console.error('[KIMI-AI] ❌ Error de API:', aiError.message);
      if (aiError.response) {
        console.error('[KIMI-AI] Response status:', aiError.response.status);
        console.error('[KIMI-AI] Response data:', aiError.response.data);
      }
      res.status(500).json({
        success: false,
        error: 'Error al generar respuesta con IA',
        details: aiError.message
      });
    }
  } catch (error) {
    console.error('[GEMINI-AI] ❌ Error:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

module.exports = router;
