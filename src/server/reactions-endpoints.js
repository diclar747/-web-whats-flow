// ==================== ENDPOINTS DE REACCIONES ====================

// Agregar reacción a un mensaje
app.post('/api/messages/:messageId/reactions', async (req, res) => {
    const { messageId } = req.params;
    const { sessionId, reaction, userJid } = req.body;

    if (!sessionId || !reaction || !userJid) {
        return res.status(400).json({
            success: false,
            error: 'sessionId, reaction y userJid son requeridos'
        });
    }

    try {
        if (!pool) {
            return res.status(500).json({
                success: false,
                error: 'Base de datos no disponible'
            });
        }

        const connection = await pool.getConnection();
        try {
            // Insertar o actualizar reacción
            await connection.execute(`
                INSERT INTO message_reactions (message_id, session_id, user_jid, reaction)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE reaction = VALUES(reaction), updated_at = CURRENT_TIMESTAMP
            `, [messageId, sessionId, userJid, reaction]);

            // Obtener todas las reacciones del mensaje
            const [reactions] = await connection.execute(`
                SELECT user_jid, reaction, created_at
                FROM message_reactions
                WHERE message_id = ? AND session_id = ?
                ORDER BY created_at ASC
            `, [messageId, sessionId]);

            res.json({
                success: true,
                messageId,
                reactions: reactions.map(r => ({
                    userJid: r.user_jid,
                    reaction: r.reaction,
                    timestamp: r.created_at
                }))
            });

            // Emitir evento de reacción via Socket.IO
            if (io) {
                io.emit('message-reaction', {
                    messageId,
                    sessionId,
                    userJid,
                    reaction,
                    reactions: reactions.map(r => ({
                        userJid: r.user_jid,
                        reaction: r.reaction,
                        timestamp: r.created_at
                    }))
                });
            }

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[REACTION-ADD] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al agregar reacción'
        });
    }
});

// Obtener reacciones de un mensaje
app.get('/api/messages/:messageId/reactions', async (req, res) => {
    const { messageId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            error: 'sessionId es requerido'
        });
    }

    try {
        if (!pool) {
            return res.json({
                success: true,
                reactions: []
            });
        }

        const connection = await pool.getConnection();
        try {
            const [reactions] = await connection.execute(`
                SELECT user_jid, reaction, created_at
                FROM message_reactions
                WHERE message_id = ? AND session_id = ?
                ORDER BY created_at ASC
            `, [messageId, sessionId]);

            res.json({
                success: true,
                messageId,
                reactions: reactions.map(r => ({
                    userJid: r.user_jid,
                    reaction: r.reaction,
                    timestamp: r.created_at
                }))
            });

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[REACTION-GET] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener reacciones'
        });
    }
});

// Eliminar reacción de un mensaje
app.delete('/api/messages/:messageId/reactions', async (req, res) => {
    const { messageId } = req.params;
    const { sessionId, userJid } = req.body;

    if (!sessionId || !userJid) {
        return res.status(400).json({
            success: false,
            error: 'sessionId y userJid son requeridos'
        });
    }

    try {
        if (!pool) {
            return res.status(500).json({
                success: false,
                error: 'Base de datos no disponible'
            });
        }

        const connection = await pool.getConnection();
        try {
            await connection.execute(`
                DELETE FROM message_reactions
                WHERE message_id = ? AND session_id = ? AND user_jid = ?
            `, [messageId, sessionId, userJid]);

            // Obtener reacciones restantes
            const [reactions] = await connection.execute(`
                SELECT user_jid, reaction, created_at
                FROM message_reactions
                WHERE message_id = ? AND session_id = ?
                ORDER BY created_at ASC
            `, [messageId, sessionId]);

            res.json({
                success: true,
                messageId,
                reactions: reactions.map(r => ({
                    userJid: r.user_jid,
                    reaction: r.reaction,
                    timestamp: r.created_at
                }))
            });

            // Emitir evento de eliminación de reacción
            if (io) {
                io.emit('message-reaction-removed', {
                    messageId,
                    sessionId,
                    userJid,
                    reactions: reactions.map(r => ({
                        userJid: r.user_jid,
                        reaction: r.reaction,
                        timestamp: r.created_at
                    }))
                });
            }

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[REACTION-DELETE] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar reacción'
        });
    }
});

module.exports = { /* endpoints are defined above */ };