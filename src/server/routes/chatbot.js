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

// GET - Obtener flujos de un session desde BD
router.get('/flows/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const connection = await mysql.createConnection(dbConfig);
    
    const [flows] = await connection.query(
      'SELECT * FROM chatbot_flows WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    );
    
    await connection.end();
    
    // Parsear triggers y adaptar al formato del frontend
    const parsedFlows = flows.map(flow => ({
      id: flow.id,
      name: flow.name,
      description: flow.description,
      active: Boolean(flow.active),
      triggers: JSON.parse(flow.triggers || '[]'),
      responses: [{
        id: '1',
        type: flow.response_type || 'text',
        content: flow.response_text || '',
        mediaUrl: flow.response_media || ''
      }],
      kanbanBoardId: flow.kanban_board_id || null,
      createdAt: flow.created_at,
      stats: {
        totalTriggers: flow.stats_total_triggers || 0,
        successRate: flow.stats_success_rate || 100,
        lastTriggered: flow.stats_last_triggered
      }
    }));
    
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
    
    const flowId = Date.now().toString();
    const connection = await mysql.createConnection(dbConfig);
    
    // Extraer la primera respuesta del array de respuestas
    const firstResponse = flowData.responses && flowData.responses.length > 0 
      ? flowData.responses[0] 
      : null;
    
    const responseType = firstResponse?.type || flowData.responseType || 'text';
    const responseText = firstResponse?.content || flowData.responseText || '';
    const responseMedia = firstResponse?.mediaUrl || flowData.responseMedia || '';
    
    await connection.query(
      `INSERT INTO chatbot_flows (
        id, session_id, name, description, triggers, 
        response_type, response_text, response_media, kanban_board_id, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        flowId,
        sessionId,
        flowData.name,
        flowData.description || '',
        JSON.stringify(flowData.triggers || []),
        responseType,
        responseText,
        responseMedia,
        flowData.kanbanBoardId || null,
        flowData.active !== false
      ]
    );
    
    await connection.end();
    
    const newFlow = {
      id: flowId,
      ...flowData,
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
    
    // Extraer la primera respuesta del array de respuestas
    const firstResponse = updatedFlow.responses && updatedFlow.responses.length > 0 
      ? updatedFlow.responses[0] 
      : null;
    
    const responseType = firstResponse?.type || updatedFlow.responseType || 'text';
    const responseText = firstResponse?.content || updatedFlow.responseText || '';
    const responseMedia = firstResponse?.mediaUrl || updatedFlow.responseMedia || '';
    
    const [result] = await connection.query(
      `UPDATE chatbot_flows SET 
        name = ?, description = ?, triggers = ?, 
        response_type = ?, response_text = ?, response_media = ?, kanban_board_id = ?, active = ?
      WHERE id = ? AND session_id = ?`,
      [
        updatedFlow.name,
        updatedFlow.description || '',
        JSON.stringify(updatedFlow.triggers || []),
        responseType,
        responseText,
        responseMedia,
        updatedFlow.kanbanBoardId || null,
        updatedFlow.active !== false,
        flowId,
        sessionId
      ]
    );
    
    await connection.end();
    
    if (result.affectedRows > 0) {
      console.log(`[CHATBOT] ✏️ Flujo actualizado en BD: ${updatedFlow.name}`);
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
    
    await connection.query(
      'DELETE FROM chatbot_flows WHERE id = ? AND session_id = ?',
      [flowId, sessionId]
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
    
    await connection.query(
      'UPDATE chatbot_flows SET active = ? WHERE id = ? AND session_id = ?',
      [active ? 1 : 0, flowId, sessionId]
    );
    
    const [flows] = await connection.query(
      'SELECT * FROM chatbot_flows WHERE id = ? AND session_id = ?',
      [flowId, sessionId]
    );
    
    await connection.end();
    
    if (flows.length > 0) {
      console.log(`[CHATBOT] ${active ? '▶️' : '⏸️'} Flujo ${active ? 'activado' : 'pausado'}: ${flows[0].name}`);
      res.json({ success: true, flow: flows[0] });
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
    const [rows] = await connection.query(
      'SELECT * FROM chatbot_settings WHERE session_id = ?',
      [sessionId]
    );
    await connection.end();

    let settings;
    if (rows.length > 0) {
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

    // Verificar si existe configuración
    const [existing] = await connection.query(
      'SELECT id FROM chatbot_settings WHERE session_id = ?',
      [sessionId]
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
          JSON.stringify(settings.workingHours?.days || [1,2,3,4,5]),
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
          sessionId
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
          sessionId,
          settings.enabled ? 1 : 0,
          settings.workingHours?.enabled ? 1 : 0,
          settings.workingHours?.start || '09:00',
          settings.workingHours?.end || '18:00',
          JSON.stringify(settings.workingHours?.days || [1,2,3,4,5]),
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
    
    // Obtener configuración del chatbot desde BD
    const [settingsRows] = await connection.query(
      'SELECT * FROM chatbot_settings WHERE session_id = ?',
      [sessionId]
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
      settings = settingsRows[0];
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
    
    // Buscar flujos activos desde BD
    const [flows] = await connection.query(
      'SELECT * FROM chatbot_flows WHERE session_id = ? AND active = 1',
      [sessionId]
    );
    
    await connection.end();
    
    const messageLower = message.toLowerCase().trim();
    let matchedFlow = null;
    
    for (const flow of flows) {
      const triggers = JSON.parse(flow.triggers || '[]');
      const matched = triggers.some(trigger => {
        const triggerLower = trigger.toLowerCase().trim();
        return messageLower === triggerLower || 
               messageLower.includes(' ' + triggerLower + ' ') ||
               messageLower.startsWith(triggerLower + ' ') ||
               messageLower.endsWith(' ' + triggerLower) ||
               messageLower.includes(triggerLower);
      });
      
      if (matched) {
        matchedFlow = flow;
        
        // Actualizar stats en BD
        const connection2 = await mysql.createConnection(dbConfig);
        await connection2.query(
          'UPDATE chatbot_flows SET stats_total_triggers = stats_total_triggers + 1, stats_last_triggered = NOW() WHERE id = ?',
          [flow.id]
        );
        await connection2.end();
        
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
    
    if (matchedFlow) {
      console.log(`[CHATBOT] 🎯 Flujo activado: ${matchedFlow.name} por mensaje de ${from}`);
      
      // Si el flujo tiene un kanban asociado, agregar el contacto al kanban
      if (matchedFlow.kanban_board_id) {
        try {
          const connection2 = await mysql.createConnection(dbConfig);
          
          // Verificar si el contacto ya existe en ese kanban
          const [existingContact] = await connection2.query(
            'SELECT id FROM kanban_contacts WHERE board_id = ? AND contact_jid = ?',
            [matchedFlow.kanban_board_id, from]
          );
          
          if (existingContact.length === 0) {
            // Agregar el contacto al kanban
            await connection2.query(
              'INSERT INTO kanban_contacts (board_id, contact_jid, notes) VALUES (?, ?, ?)',
              [matchedFlow.kanban_board_id, from, `Agregado automáticamente por chatbot: ${matchedFlow.name}`]
            );
            console.log(`[CHATBOT] 📋 Contacto ${from} agregado al kanban ${matchedFlow.kanban_board_id}`);
          } else {
            console.log(`[CHATBOT] 📋 Contacto ${from} ya existe en kanban ${matchedFlow.kanban_board_id}`);
          }
          
          await connection2.end();
        } catch (kanbanError) {
          console.error('[CHATBOT] Error agregando contacto al kanban:', kanbanError);
          // No fallar la respuesta del bot si falla el kanban
        }
      }
      
      const responses = [{
        id: '1',
        type: matchedFlow.response_type || 'text',
        content: matchedFlow.response_text || '',
        mediaUrl: matchedFlow.response_media || ''
      }];
      
      res.json({
        success: true,
        botResponse: responses,
        flow: {
          id: matchedFlow.id,
          name: matchedFlow.name
        }
      });
    } else {
      console.log(`[CHATBOT] ❌ No se encontró flujo para: "${message}"`);
      
      // NO enviar mensaje de fallback - solo ignorar el mensaje
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
    
    // Obtener todos los flujos del usuario
    const [flows] = await connection.query(
      'SELECT * FROM chatbot_flows WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    );
    
    await connection.end();
    
    // Formatear analíticas para el dashboard
    const analytics = flows.map(flow => {
      const triggers = JSON.parse(flow.triggers || '[]');
      
      return {
        id: flow.id,
        name: flow.name,
        status: flow.active ? 'active' : 'inactive',
        totalInteractions: flow.stats_total_triggers || 0,
        successfulResponses: flow.stats_total_triggers || 0,
        failedResponses: 0,
        avgResponseTime: '< 1s',
        deliveryRate: 100,
        responseRate: flow.stats_success_rate || 100,
        lastActivity: flow.stats_last_triggered || flow.created_at,
        keywords: triggers,
        color: flow.active ? '#00a884' : '#94a3b8'
      };
    });
    
    console.log(`[CHATBOT-ANALYTICS] Enviando ${analytics.length} chatbots para ${sessionId}`);
    
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

// ==================== ENDPOINTS DE IA CON DEEPSEEK ====================

// POST - Scraping de URL
router.post('/scrape-url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL requerida' });
    }

    // Usar JSDOM o Cheerio para scraping
    const axios = require('axios');
    const cheerio = require('cheerio');

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);

      // Remover scripts y estilos
      $('script, style, nav, footer, header').remove();

      // Extraer texto
      let content = $('body').text()
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

      // Limitar a 5000 caracteres
      if (content.length > 5000) {
        content = content.substring(0, 5000) + '...';
      }

      console.log(`[SCRAPER] ✅ Contenido extraído de ${url}: ${content.length} caracteres`);

      res.json({ success: true, content });
    } catch (scrapeError) {
      console.error('[SCRAPER] ❌ Error al hacer scraping:', scrapeError.message);
      res.status(500).json({
        success: false,
        error: 'No se pudo acceder a la URL',
        details: scrapeError.message
      });
    }
  } catch (error) {
    console.error('[SCRAPER] ❌ Error:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

// POST - Respuesta con IA DeepSeek
router.post('/ai-response', async (req, res) => {
  try {
    const { message, businessData, scrapedContent, temperature = 0.7, maxTokens = 500 } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Mensaje requerido' });
    }

    const axios = require('axios');

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
      const deepseekResponse = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: temperature,
          max_tokens: maxTokens,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sk-1a63bb1681514e0982ab42b0a13377c8'
          },
          timeout: 30000
        }
      );

      const aiResponse = deepseekResponse.data.choices[0].message.content;

      console.log('[DEEPSEEK-AI] ✅ Respuesta generada:', aiResponse.substring(0, 100) + '...');

      res.json({
        success: true,
        response: aiResponse,
        model: 'deepseek-chat',
        tokensUsed: deepseekResponse.data.usage?.total_tokens || 0
      });
    } catch (aiError) {
      console.error('[DEEPSEEK-AI] ❌ Error de API:', aiError.response?.data || aiError.message);
      res.status(500).json({
        success: false,
        error: 'Error al generar respuesta con IA',
        details: aiError.response?.data?.error?.message || aiError.message
      });
    }
  } catch (error) {
    console.error('[DEEPSEEK-AI] ❌ Error:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor' });
  }
});

module.exports = router;
