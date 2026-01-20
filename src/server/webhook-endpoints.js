/**
 * Webhook Endpoints para API REST
 * Sistema de notificaciones en tiempo real a URLs externas
 */

const crypto = require('crypto');

/**
 * Registrar endpoints de webhooks
 */
function registerWebhookEndpoints(app, pool, sessions) {
    console.log('🔌 [WEBHOOKS] Registrando endpoints de webhooks...');

    /**
     * Middleware: Autenticar API Key
     */
    async function authenticateAPIKey(req, res) {
        const apiKey = req.headers['x-api-key'] || req.query.api_key;

        if (!apiKey) {
            return { success: false, status: 401, error: 'API Key requerida' };
        }

        const activePool = pool || global.dbPool;
        if (!activePool) {
            return { success: false, status: 500, error: 'Base de datos no disponible' };
        }

        try {
            const [keys] = await activePool.execute(
                'SELECT * FROM api_keys WHERE api_key = ? AND is_active = TRUE',
                [apiKey]
            );

            if (keys.length === 0) {
                return { success: false, status: 401, error: 'API Key inválida' };
            }

            // Incrementar contador
            await activePool.execute(
                'UPDATE api_keys SET request_count = request_count + 1, last_used_at = NOW() WHERE id = ?',
                [keys[0].id]
            );

            return { success: true, apiKeyData: keys[0] };
        } catch (error) {
            console.error('[WEBHOOKS] Error autenticando:', error);
            return { success: false, status: 500, error: 'Error de autenticación' };
        }
    }

    // ==========================================
    // POST /api/rest/webhooks/register - Registrar webhook
    // ==========================================
    app.post('/api/rest/webhooks/register', async (req, res) => {
        console.log('[WEBHOOKS] POST /webhooks/register');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { url, events, name, secret } = req.body;

        if (!url || !events || !Array.isArray(events)) {
            return res.status(400).json({
                success: false,
                error: 'Faltan parámetros: url, events (array)'
            });
        }

        // Validar URL
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ success: false, error: 'URL inválida' });
        }

        // Eventos válidos
        const validEvents = [
            'message.received',
            'message.sent',
            'message.delivered',
            'message.read',
            'connection.status',
            'chat.new',
            'chat.updated'
        ];

        const invalidEvents = events.filter(e => !validEvents.includes(e));
        if (invalidEvents.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Eventos inválidos: ${invalidEvents.join(', ')}. Válidos: ${validEvents.join(', ')}`
            });
        }

        try {
            // Generar secret si no se proporciona
            const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

            const activePool = pool || global.dbPool;
            const [result] = await activePool.execute(
                `INSERT INTO api_webhooks (session_id, url, events, name, secret, is_active, created_at)
                 VALUES (?, ?, ?, ?, ?, TRUE, NOW())`,
                [sessionId, url, JSON.stringify(events), name || 'Webhook', webhookSecret]
            );

            console.log(`[WEBHOOKS] ✅ Webhook registrado: ${url}`);

            return res.json({
                success: true,
                webhook: {
                    id: result.insertId,
                    url,
                    events,
                    name: name || 'Webhook',
                    secret: webhookSecret,
                    is_active: true
                },
                message: 'Webhook registrado exitosamente'
            });
        } catch (error) {
            console.error('[WEBHOOKS] Error registrando webhook:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // GET /api/rest/webhooks/list - Listar webhooks
    // ==========================================
    app.get('/api/rest/webhooks/list', async (req, res) => {
        console.log('[WEBHOOKS] GET /webhooks/list');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;

        const activePool = pool || global.dbPool;
        try {
            const [webhooks] = await activePool.execute(
                `SELECT id, url, events, name, is_active, created_at, last_triggered_at, 
                        success_count, failure_count
                 FROM api_webhooks 
                 WHERE session_id = ?
                 ORDER BY created_at DESC`,
                [sessionId]
            );

            // Parsear events JSON
            const parsedWebhooks = webhooks.map(w => ({
                ...w,
                events: typeof w.events === 'string' ? JSON.parse(w.events) : w.events
            }));

            return res.json({
                success: true,
                webhooks: parsedWebhooks,
                total: parsedWebhooks.length
            });
        } catch (error) {
            console.error('[WEBHOOKS] Error listando webhooks:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // DELETE /api/rest/webhooks/:id - Eliminar webhook
    // ==========================================
    app.delete('/api/rest/webhooks/:id', async (req, res) => {
        console.log('[WEBHOOKS] DELETE /webhooks/:id');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { id } = req.params;

        const activePool = pool || global.dbPool;
        try {
            const [result] = await activePool.execute(
                'DELETE FROM api_webhooks WHERE id = ? AND session_id = ?',
                [id, sessionId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Webhook no encontrado' });
            }

            console.log(`[WEBHOOKS] ✅ Webhook ${id} eliminado`);

            return res.json({
                success: true,
                message: 'Webhook eliminado exitosamente'
            });
        } catch (error) {
            console.error('[WEBHOOKS] Error eliminando webhook:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // PUT /api/rest/webhooks/:id - Actualizar webhook
    // ==========================================
    app.put('/api/rest/webhooks/:id', async (req, res) => {
        console.log('[WEBHOOKS] PUT /webhooks/:id');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { id } = req.params;
        const { url, events, name, is_active } = req.body;

        try {
            const updates = [];
            const params = [];

            if (url) {
                updates.push('url = ?');
                params.push(url);
            }
            if (events) {
                updates.push('events = ?');
                params.push(JSON.stringify(events));
            }
            if (name) {
                updates.push('name = ?');
                params.push(name);
            }
            if (is_active !== undefined) {
                updates.push('is_active = ?');
                params.push(is_active ? 1 : 0);
            }

            if (updates.length === 0) {
                return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
            }

            params.push(id, sessionId);

            const activePool = pool || global.dbPool;
            const [result] = await activePool.execute(
                `UPDATE api_webhooks SET ${updates.join(', ')} WHERE id = ? AND session_id = ?`,
                params
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Webhook no encontrado' });
            }

            console.log(`[WEBHOOKS] ✅ Webhook ${id} actualizado`);

            return res.json({
                success: true,
                message: 'Webhook actualizado exitosamente'
            });
        } catch (error) {
            console.error('[WEBHOOKS] Error actualizando webhook:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==========================================
    // POST /api/rest/webhooks/test - Probar webhook (envío manual)
    // ==========================================
    app.post('/api/rest/webhooks/test', async (req, res) => {
        console.log('[WEBHOOKS] POST /webhooks/test');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const { webhookId, url } = req.body;

        if (!webhookId && !url) {
            return res.status(400).json({ success: false, error: 'Proporciona webhookId o url' });
        }

        let targetUrl = url;
        let secret = null;

        // Si se proporciona webhookId, obtener de BD
        if (webhookId) {
            const sessionId = auth.apiKeyData.session_id;
            const [webhooks] = await pool.execute(
                'SELECT url, secret FROM api_webhooks WHERE id = ? AND session_id = ?',
                [webhookId, sessionId]
            );

            if (webhooks.length === 0) {
                return res.status(404).json({ success: false, error: 'Webhook no encontrado' });
            }

            targetUrl = webhooks[0].url;
            secret = webhooks[0].secret;
        }

        try {
            const testPayload = {
                event: 'webhook.test',
                timestamp: new Date().toISOString(),
                data: {
                    message: 'Este es un mensaje de prueba desde WhatsFlow API',
                    test: true
                }
            };

            // Crear firma HMAC
            const signature = secret
                ? crypto.createHmac('sha256', secret).update(JSON.stringify(testPayload)).digest('hex')
                : null;

            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'WhatsFlow-Webhook/1.0'
            };

            if (signature) {
                headers['X-WhatsFlow-Signature'] = signature;
            }

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(testPayload),
                timeout: 10000
            });

            const responseText = await response.text();

            console.log(`[WEBHOOKS] Test enviado a ${targetUrl}: ${response.status}`);

            return res.json({
                success: true,
                test_result: {
                    url: targetUrl,
                    status_code: response.status,
                    response: responseText.substring(0, 500)
                }
            });
        } catch (error) {
            console.error('[WEBHOOKS] Error probando webhook:', error);
            return res.json({
                success: false,
                error: `Error al conectar: ${error.message}`,
                url: targetUrl
            });
        }
    });

    console.log('[WEBHOOKS] ✅ Endpoints de webhooks registrados');
}

/**
 * Función para enviar notificación a webhooks
 */
async function triggerWebhook(pool, sessionId, eventType, data) {
    try {
        const [webhooks] = await pool.execute(
            `SELECT id, url, secret FROM api_webhooks 
             WHERE session_id = ? AND is_active = TRUE 
             AND JSON_CONTAINS(events, ?)`,
            [sessionId, JSON.stringify(eventType)]
        );

        for (const webhook of webhooks) {
            const payload = {
                event: eventType,
                timestamp: new Date().toISOString(),
                session_id: sessionId,
                data
            };

            const signature = webhook.secret
                ? crypto.createHmac('sha256', webhook.secret).update(JSON.stringify(payload)).digest('hex')
                : null;

            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'WhatsFlow-Webhook/1.0'
            };

            if (signature) {
                headers['X-WhatsFlow-Signature'] = signature;
            }

            fetch(webhook.url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            })
                .then(async (response) => {
                    const isSuccess = response.ok;
                    await pool.execute(
                        `UPDATE api_webhooks SET 
                         last_triggered_at = NOW(),
                         success_count = success_count + ?,
                         failure_count = failure_count + ?
                         WHERE id = ?`,
                        [isSuccess ? 1 : 0, isSuccess ? 0 : 1, webhook.id]
                    );
                    console.log(`[WEBHOOKS] ${isSuccess ? '✅' : '❌'} ${eventType} -> ${webhook.url}`);
                })
                .catch(err => {
                    console.error(`[WEBHOOKS] ❌ Error enviando a ${webhook.url}:`, err.message);
                    pool.execute(
                        'UPDATE api_webhooks SET failure_count = failure_count + 1 WHERE id = ?',
                        [webhook.id]
                    );
                });
        }
    } catch (error) {
        console.error('[WEBHOOKS] Error en triggerWebhook:', error);
    }
}

module.exports = { registerWebhookEndpoints, triggerWebhook };
