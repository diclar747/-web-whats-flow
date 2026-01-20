/**
 * API REST Extended Endpoints
 * Endpoints adicionales para todos los módulos del sistema
 */

/**
 * Registrar endpoints extendidos de API REST
 */
function registerAPIRestExtendedEndpoints(app, pool, sessions) {
    console.log('🔌 [API-REST-EXT] Registrando endpoints extendidos...');

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
                return { success: false, status: 401, error: 'API Key inválida o inactiva' };
            }

            await activePool.execute(
                'UPDATE api_keys SET request_count = request_count + 1, last_used_at = NOW() WHERE id = ?',
                [keys[0].id]
            );

            return { success: true, apiKeyData: keys[0] };
        } catch (error) {
            console.error('[API-REST-EXT] Error autenticando:', error);
            return { success: false, status: 500, error: 'Error de autenticación' };
        }
    }

    // ============================================================
    // ACCOUNT ENDPOINTS
    // ============================================================

    // GET /api/rest/account/info - Información de la cuenta
    app.get('/api/rest/extended/account/info', async (req, res) => {
        console.log('[API-REST-EXT] GET /account/info');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;

        try {
            const [users] = await pool.execute(
                `SELECT us.*, p.name as plan_name, p.max_messages_per_month
                 FROM user_sessions us
                 LEFT JOIN plans p ON us.plan_id = p.id
                 WHERE us.session_id = ? OR us.phone_number = ?`,
                [sessionId, sessionId]
            );

            if (users.length === 0) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            const user = users[0];
            const session = sessions.get(sessionId);

            return res.json({
                success: true,
                account: {
                    session_id: sessionId,
                    phone_number: user.phone_number,
                    plan: user.plan_name || 'Básico',
                    messages_limit: user.max_messages_per_month || 0,
                    messages_used: user.messages_sent_this_month || 0,
                    messages_api: user.messages_api || 0,
                    connected: session?.isConnected || false,
                    created_at: user.created_at
                }
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/rest/account/profile - Perfil de WhatsApp
    app.get('/api/rest/extended/account/profile', async (req, res) => {
        console.log('[API-REST-EXT] GET /account/profile');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const session = sessions.get(sessionId);

        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const user = session.sock.user;

            return res.json({
                success: true,
                profile: {
                    id: user?.id,
                    name: user?.name,
                    phone: user?.id?.split(':')[0]?.replace('@s.whatsapp.net', '') || null,
                    connected: session.isConnected || false
                }
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/rest/account/logout - Cerrar sesión
    app.post('/api/rest/extended/account/logout', async (req, res) => {
        console.log('[API-REST-EXT] POST /account/logout');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const session = sessions.get(sessionId);

        if (!session || !session.sock) {
            return res.json({ success: true, message: 'Sesión ya estaba desconectada' });
        }

        try {
            await session.sock.logout();
            sessions.delete(sessionId);

            return res.json({
                success: true,
                message: 'Sesión cerrada exitosamente'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================================
    // GROUPS ENDPOINTS
    // ============================================================

    // GET /api/rest/groups - Listar grupos
    app.get('/api/rest/extended/groups', async (req, res) => {
        console.log('[API-REST-EXT] GET /groups');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;

        try {
            const [groups] = await pool.execute(
                `SELECT DISTINCT g.*, 
                 (SELECT COUNT(*) FROM group_members gm WHERE gm.group_jid = g.jid) as member_count
                 FROM \`groups\` g
                 WHERE g.owner_session_id = ?
                 ORDER BY g.created_at DESC
                 LIMIT 100`,
                [sessionId]
            );

            return res.json({
                success: true,
                groups: groups,
                total: groups.length
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/rest/groups/:groupId - Info de grupo
    app.get('/api/rest/groups/:groupId', async (req, res) => {
        console.log('[API-REST-EXT] GET /groups/:groupId');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { groupId } = req.params;
        const session = sessions.get(sessionId);

        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;
            const metadata = await session.sock.groupMetadata(jid);

            return res.json({
                success: true,
                group: {
                    id: metadata.id,
                    subject: metadata.subject,
                    description: metadata.desc || '',
                    owner: metadata.owner,
                    creation: metadata.creation,
                    participants: metadata.participants?.map(p => ({
                        id: p.id,
                        admin: p.admin || null
                    })),
                    size: metadata.size || metadata.participants?.length
                }
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/rest/groups/:groupId/send - Enviar a grupo
    app.post('/api/rest/extended/groups/:groupId/send', async (req, res) => {
        console.log('[API-REST-EXT] POST /groups/:groupId/send');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { groupId } = req.params;
        const { message, image, document } = req.body;

        if (!message && !image && !document) {
            return res.status(400).json({ success: false, error: 'Se requiere: message, image o document' });
        }

        const session = sessions.get(sessionId);
        if (!session || !session.sock) {
            return res.status(400).json({ success: false, error: 'Sesión no conectada' });
        }

        try {
            const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;

            let payload;
            if (message) {
                payload = { text: message };
            } else if (image) {
                payload = { image: { url: image }, caption: req.body.caption || '' };
            } else if (document) {
                payload = { document: { url: document }, fileName: req.body.filename || 'file' };
            }

            const sentMsg = await session.sock.sendMessage(jid, payload);

            return res.json({
                success: true,
                messageId: sentMsg.key.id,
                to: jid
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================================
    // CHATBOT/FLOWS ENDPOINTS
    // ============================================================

    // GET /api/rest/chatbot/flows - Listar flujos
    app.get('/api/rest/extended/chatbot/flows', async (req, res) => {
        console.log('[API-REST-EXT] GET /chatbot/flows');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;

        try {
            const [flows] = await pool.execute(
                `SELECT id, flow_name, is_active, created_at, updated_at
                 FROM chatbot_flows
                 WHERE session_id = ?
                 ORDER BY created_at DESC`,
                [sessionId]
            );

            return res.json({
                success: true,
                flows: flows,
                total: flows.length
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/rest/chatbot/flows - Crear flujo
    app.post('/api/rest/extended/chatbot/flows', async (req, res) => {
        console.log('[API-REST-EXT] POST /chatbot/flows');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { name, triggers, responses, active } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Se requiere: name' });
        }

        try {
            const flowData = {
                name,
                triggers: triggers || [],
                responses: responses || [],
                active: active !== false
            };

            const [result] = await pool.execute(
                `INSERT INTO chatbot_flows (session_id, flow_name, flow_data, is_active, created_at)
                 VALUES (?, ?, ?, ?, NOW())`,
                [sessionId, name, JSON.stringify(flowData), active !== false ? 1 : 0]
            );

            return res.json({
                success: true,
                flow: {
                    id: result.insertId,
                    name,
                    active: active !== false
                },
                message: 'Flujo creado exitosamente'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/rest/chatbot/flows/:id - Actualizar flujo
    app.put('/api/rest/extended/chatbot/flows/:id', async (req, res) => {
        console.log('[API-REST-EXT] PUT /chatbot/flows/:id');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { id } = req.params;
        const { name, triggers, responses, active } = req.body;

        try {
            const flowData = { name, triggers, responses };

            const [result] = await pool.execute(
                `UPDATE chatbot_flows 
                 SET flow_name = ?, flow_data = ?, is_active = ?, updated_at = NOW()
                 WHERE id = ? AND session_id = ?`,
                [name, JSON.stringify(flowData), active ? 1 : 0, id, sessionId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Flujo no encontrado' });
            }

            return res.json({
                success: true,
                message: 'Flujo actualizado exitosamente'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // DELETE /api/rest/chatbot/flows/:id - Eliminar flujo
    app.delete('/api/rest/extended/chatbot/flows/:id', async (req, res) => {
        console.log('[API-REST-EXT] DELETE /chatbot/flows/:id');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { id } = req.params;

        try {
            const [result] = await pool.execute(
                'DELETE FROM chatbot_flows WHERE id = ? AND session_id = ?',
                [id, sessionId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Flujo no encontrado' });
            }

            return res.json({
                success: true,
                message: 'Flujo eliminado exitosamente'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // PATCH /api/rest/chatbot/flows/:id/toggle - Activar/desactivar flujo
    app.patch('/api/rest/extended/chatbot/flows/:id/toggle', async (req, res) => {
        console.log('[API-REST-EXT] PATCH /chatbot/flows/:id/toggle');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { id } = req.params;
        const { active } = req.body;

        try {
            const [result] = await pool.execute(
                'UPDATE chatbot_flows SET is_active = ? WHERE id = ? AND session_id = ?',
                [active ? 1 : 0, id, sessionId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Flujo no encontrado' });
            }

            return res.json({
                success: true,
                active: active,
                message: `Flujo ${active ? 'activado' : 'desactivado'}`
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================================
    // CAMPAIGNS ENDPOINTS
    // ============================================================

    // GET /api/rest/campaigns - Listar campañas
    app.get('/api/rest/extended/campaigns', async (req, res) => {
        console.log('[API-REST-EXT] GET /campaigns');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { status, limit = 50 } = req.query;

        try {
            let query = `SELECT * FROM personalized_campaigns WHERE session_id = ?`;
            const params = [sessionId];

            if (status) {
                query += ' AND status = ?';
                params.push(status);
            }

            query += ' ORDER BY created_at DESC LIMIT ?';
            params.push(parseInt(limit));

            const [campaigns] = await pool.execute(query, params);

            return res.json({
                success: true,
                campaigns: campaigns,
                total: campaigns.length
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/rest/campaigns/:id - Detalles de campaña
    app.get('/api/rest/extended/campaigns/:id', async (req, res) => {
        console.log('[API-REST-EXT] GET /campaigns/:id');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { id } = req.params;

        try {
            const [campaigns] = await pool.execute(
                'SELECT * FROM personalized_campaigns WHERE id = ? AND session_id = ?',
                [id, sessionId]
            );

            if (campaigns.length === 0) {
                return res.status(404).json({ success: false, error: 'Campaña no encontrada' });
            }

            // Obtener estadísticas
            const [stats] = await pool.execute(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
                 FROM campaign_recipients WHERE campaign_id = ?`,
                [id]
            );

            return res.json({
                success: true,
                campaign: campaigns[0],
                stats: stats[0] || { total: 0, sent: 0, failed: 0, pending: 0 }
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/rest/campaigns/:id/start - Iniciar campaña
    app.post('/api/rest/extended/campaigns/:id/start', async (req, res) => {
        console.log('[API-REST-EXT] POST /campaigns/:id/start');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { id } = req.params;

        try {
            const [result] = await pool.execute(
                `UPDATE personalized_campaigns SET status = 'running', started_at = NOW()
                 WHERE id = ? AND session_id = ?`,
                [id, sessionId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Campaña no encontrada' });
            }

            return res.json({
                success: true,
                message: 'Campaña iniciada'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/rest/campaigns/:id/pause - Pausar campaña
    app.post('/api/rest/extended/campaigns/:id/pause', async (req, res) => {
        console.log('[API-REST-EXT] POST /campaigns/:id/pause');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { id } = req.params;

        try {
            const [result] = await pool.execute(
                `UPDATE personalized_campaigns SET status = 'paused'
                 WHERE id = ? AND session_id = ?`,
                [id, sessionId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Campaña no encontrada' });
            }

            return res.json({
                success: true,
                message: 'Campaña pausada'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================================
    // CONTACTS ENDPOINTS
    // ============================================================

    // GET /api/rest/contacts - Listar contactos
    app.get('/api/rest/extended/contacts', async (req, res) => {
        console.log('[API-REST-EXT] GET /contacts');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { search, limit = 100, offset = 0 } = req.query;

        try {
            let query = `SELECT * FROM contacts WHERE session_id = ?`;
            const params = [sessionId];

            if (search) {
                query += ' AND (name LIKE ? OR phone LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }

            query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const [contacts] = await pool.execute(query, params);

            return res.json({
                success: true,
                contacts: contacts,
                total: contacts.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/rest/contacts - Crear contacto
    app.post('/api/rest/extended/contacts', async (req, res) => {
        console.log('[API-REST-EXT] POST /contacts');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { name, phone, email, notes, tags } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, error: 'Se requiere: phone' });
        }

        try {
            const [result] = await pool.execute(
                `INSERT INTO contacts (session_id, name, phone, email, notes, tags, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [sessionId, name || '', phone, email || null, notes || null, tags ? JSON.stringify(tags) : null]
            );

            return res.json({
                success: true,
                contact: {
                    id: result.insertId,
                    name,
                    phone,
                    email,
                    notes,
                    tags
                },
                message: 'Contacto creado exitosamente'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/rest/contacts/:id - Actualizar contacto
    app.put('/api/rest/extended/contacts/:id', async (req, res) => {
        console.log('[API-REST-EXT] PUT /contacts/:id');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { id } = req.params;
        const { name, phone, email, notes, tags } = req.body;

        try {
            const [result] = await pool.execute(
                `UPDATE contacts 
                 SET name = ?, phone = ?, email = ?, notes = ?, tags = ?, updated_at = NOW()
                 WHERE id = ? AND session_id = ?`,
                [name, phone, email, notes, tags ? JSON.stringify(tags) : null, id, sessionId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Contacto no encontrado' });
            }

            return res.json({
                success: true,
                message: 'Contacto actualizado exitosamente'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // DELETE /api/rest/contacts/:id - Eliminar contacto
    app.delete('/api/rest/extended/contacts/:id', async (req, res) => {
        console.log('[API-REST-EXT] DELETE /contacts/:id');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { id } = req.params;

        try {
            const [result] = await pool.execute(
                'DELETE FROM contacts WHERE id = ? AND session_id = ?',
                [id, sessionId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Contacto no encontrado' });
            }

            return res.json({
                success: true,
                message: 'Contacto eliminado exitosamente'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================================
    // KANBAN ENDPOINTS
    // ============================================================

    // GET /api/rest/kanban/boards - Listar tableros
    app.get('/api/rest/extended/kanban/boards', async (req, res) => {
        console.log('[API-REST-EXT] GET /kanban/boards');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;

        try {
            const [boards] = await pool.execute(
                'SELECT * FROM kanban_boards WHERE session_id = ? ORDER BY created_at DESC',
                [sessionId]
            );

            return res.json({
                success: true,
                boards: boards,
                total: boards.length
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/rest/kanban/boards/:id/columns - Columnas del tablero
    app.get('/api/rest/extended/kanban/boards/:id/columns', async (req, res) => {
        console.log('[API-REST-EXT] GET /kanban/boards/:id/columns');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const { id } = req.params;

        try {
            const [columns] = await pool.execute(
                'SELECT * FROM kanban_columns WHERE board_id = ? ORDER BY position ASC',
                [id]
            );

            return res.json({
                success: true,
                columns: columns
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/rest/kanban/boards/:id/cards - Tarjetas del tablero
    app.get('/api/rest/extended/kanban/boards/:id/cards', async (req, res) => {
        console.log('[API-REST-EXT] GET /kanban/boards/:id/cards');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const { id } = req.params;
        const { column_id } = req.query;

        try {
            let query = `SELECT c.* FROM kanban_cards c
                         JOIN kanban_columns col ON c.column_id = col.id
                         WHERE col.board_id = ?`;
            const params = [id];

            if (column_id) {
                query += ' AND c.column_id = ?';
                params.push(column_id);
            }

            query += ' ORDER BY c.position ASC';

            const [cards] = await pool.execute(query, params);

            return res.json({
                success: true,
                cards: cards
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/rest/kanban/cards/:id/move - Mover tarjeta
    app.put('/api/rest/extended/kanban/cards/:id/move', async (req, res) => {
        console.log('[API-REST-EXT] PUT /kanban/cards/:id/move');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const { id } = req.params;
        const { column_id, position } = req.body;

        if (!column_id) {
            return res.status(400).json({ success: false, error: 'Se requiere: column_id' });
        }

        try {
            const [result] = await pool.execute(
                'UPDATE kanban_cards SET column_id = ?, position = ?, updated_at = NOW() WHERE id = ?',
                [column_id, position || 0, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Tarjeta no encontrada' });
            }

            return res.json({
                success: true,
                message: 'Tarjeta movida exitosamente'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================================
    // STATUSES ENDPOINTS
    // ============================================================

    // GET /api/rest/statuses - Listar estados programados
    app.get('/api/rest/extended/statuses', async (req, res) => {
        console.log('[API-REST-EXT] GET /statuses');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;

        try {
            const [statuses] = await pool.execute(
                `SELECT * FROM scheduled_statuses 
                 WHERE session_id = ?
                 ORDER BY scheduled_time DESC`,
                [sessionId]
            );

            return res.json({
                success: true,
                statuses: statuses,
                total: statuses.length
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/rest/statuses - Programar estado
    app.post('/api/rest/extended/statuses', async (req, res) => {
        console.log('[API-REST-EXT] POST /statuses');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { media_url, caption, scheduled_time, type } = req.body;

        if (!media_url) {
            return res.status(400).json({ success: false, error: 'Se requiere: media_url' });
        }

        try {
            const [result] = await pool.execute(
                `INSERT INTO scheduled_statuses (session_id, media_url, caption, scheduled_time, type, status, created_at)
                 VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
                [sessionId, media_url, caption || '', scheduled_time || new Date(), type || 'image']
            );

            return res.json({
                success: true,
                status: {
                    id: result.insertId,
                    media_url,
                    caption,
                    scheduled_time
                },
                message: 'Estado programado exitosamente'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // DELETE /api/rest/statuses/:id - Eliminar estado
    app.delete('/api/rest/extended/statuses/:id', async (req, res) => {
        console.log('[API-REST-EXT] DELETE /statuses/:id');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { id } = req.params;

        try {
            const [result] = await pool.execute(
                'DELETE FROM scheduled_statuses WHERE id = ? AND session_id = ?',
                [id, sessionId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Estado no encontrado' });
            }

            return res.json({
                success: true,
                message: 'Estado eliminado exitosamente'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================================
    // AGENTS ENDPOINTS
    // ============================================================

    // GET /api/rest/agents - Listar agentes
    app.get('/api/rest/extended/agents', async (req, res) => {
        console.log('[API-REST-EXT] GET /agents');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;

        try {
            const [agents] = await pool.execute(
                `SELECT id, username, email, role, permissions, status, created_at
                 FROM agents 
                 WHERE owner_session_id = ?
                 ORDER BY created_at DESC`,
                [sessionId]
            );

            // Parsear permisos
            const parsedAgents = agents.map(a => ({
                ...a,
                permissions: typeof a.permissions === 'string' ? JSON.parse(a.permissions) : a.permissions
            }));

            return res.json({
                success: true,
                agents: parsedAgents,
                total: parsedAgents.length
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/rest/agents/:id/chats - Chats del agente
    app.get('/api/rest/extended/agents/:id/chats', async (req, res) => {
        console.log('[API-REST-EXT] GET /agents/:id/chats');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const { id } = req.params;

        try {
            const [chats] = await pool.execute(
                `SELECT ca.*, m.sender_name as customer_name
                 FROM chat_assignments ca
                 LEFT JOIN messages m ON ca.chat_jid = m.chat_jid
                 WHERE ca.agent_id = ? AND ca.status = 'active'
                 GROUP BY ca.chat_jid
                 ORDER BY ca.assigned_at DESC`,
                [id]
            );

            return res.json({
                success: true,
                chats: chats,
                total: chats.length
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/rest/agents/:id/assign - Asignar chat a agente
    app.post('/api/rest/extended/agents/:id/assign', async (req, res) => {
        console.log('[API-REST-EXT] POST /agents/:id/assign');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const { id } = req.params;
        const { chat_jid } = req.body;

        if (!chat_jid) {
            return res.status(400).json({ success: false, error: 'Se requiere: chat_jid' });
        }

        try {
            const [result] = await pool.execute(
                `INSERT INTO chat_assignments (agent_id, chat_jid, status, assigned_at)
                 VALUES (?, ?, 'active', NOW())
                 ON DUPLICATE KEY UPDATE agent_id = ?, status = 'active', assigned_at = NOW()`,
                [id, chat_jid, id]
            );

            return res.json({
                success: true,
                message: 'Chat asignado exitosamente'
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================================
    // ANALYTICS ENDPOINTS
    // ============================================================

    // GET /api/rest/analytics/dashboard - Resumen general
    app.get('/api/rest/analytics/dashboard', async (req, res) => {
        console.log('[API-REST-EXT] GET /analytics/dashboard');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { period = '7d' } = req.query;

        // Calcular fecha de inicio
        let startDate = new Date();
        if (period === '24h') startDate.setHours(startDate.getHours() - 24);
        else if (period === '7d') startDate.setDate(startDate.getDate() - 7);
        else if (period === '30d') startDate.setDate(startDate.getDate() - 30);
        else if (period === '90d') startDate.setDate(startDate.getDate() - 90);

        try {
            // Mensajes
            const [msgStats] = await pool.execute(
                `SELECT 
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN is_from_me = 1 THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN is_from_me = 0 THEN 1 ELSE 0 END) as received
                 FROM messages 
                 WHERE session_id = ? AND timestamp >= ?`,
                [sessionId, startDate]
            );

            // Chats únicos
            const [chatStats] = await pool.execute(
                `SELECT COUNT(DISTINCT chat_jid) as unique_chats
                 FROM messages 
                 WHERE session_id = ? AND timestamp >= ?`,
                [sessionId, startDate]
            );

            // Campañas
            const [campaignStats] = await pool.execute(
                `SELECT 
                    COUNT(*) as total_campaigns,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as active
                 FROM personalized_campaigns 
                 WHERE session_id = ?`,
                [sessionId]
            );

            return res.json({
                success: true,
                period,
                dashboard: {
                    messages: {
                        total: msgStats[0]?.total_messages || 0,
                        sent: msgStats[0]?.sent || 0,
                        received: msgStats[0]?.received || 0
                    },
                    chats: {
                        unique: chatStats[0]?.unique_chats || 0
                    },
                    campaigns: {
                        total: campaignStats[0]?.total_campaigns || 0,
                        completed: campaignStats[0]?.completed || 0,
                        active: campaignStats[0]?.active || 0
                    }
                }
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/rest/extended/analytics/messages - Estadísticas de mensajes
    app.get('/api/rest/extended/analytics/messages', async (req, res) => {
        console.log('[API-REST-EXT] GET /extended/analytics/messages');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;
        const { start, end, group_by = 'day' } = req.query;

        const activePool = (pool || global.dbPool);
        try {
            let dateFormat = '%Y-%m-%d';
            if (group_by === 'hour') dateFormat = '%Y-%m-%d %H:00';
            else if (group_by === 'month') dateFormat = '%Y-%m';

            let query = `
                SELECT 
                    DATE_FORMAT(timestamp, '${dateFormat}') as period,
                    COUNT(*) as total,
                    SUM(CASE WHEN is_from_me = 1 THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN is_from_me = 0 THEN 1 ELSE 0 END) as received
                FROM messages 
                WHERE session_id = ?
            `;
            const params = [sessionId];

            if (start) {
                query += ' AND timestamp >= ?';
                params.push(start);
            }
            if (end) {
                query += ' AND timestamp <= ?';
                params.push(end);
            }

            query += ` GROUP BY period ORDER BY period DESC LIMIT 100`;

            const [stats] = await activePool.execute(query, params);

            return res.json({
                success: true,
                group_by,
                statistics: stats
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/rest/templates - Listar templates
    app.get('/api/rest/extended/templates', async (req, res) => {
        console.log('[API-REST-EXT] GET /templates');

        const auth = await authenticateAPIKey(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const sessionId = auth.apiKeyData.session_id;

        const activePool = (pool || global.dbPool);
        try {
            const [templates] = await activePool.execute(
                `SELECT id, name, content, category, created_at
                 FROM message_templates 
                 WHERE session_id = ?
                 ORDER BY created_at DESC`,
                [sessionId]
            );

            return res.json({
                success: true,
                templates: templates,
                total: templates.length
            });
        } catch (error) {
            console.error('[API-REST-EXT] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    });

    console.log('[API-REST-EXT] ✅ Endpoints extendidos registrados');
}

module.exports = { registerAPIRestExtendedEndpoints };
